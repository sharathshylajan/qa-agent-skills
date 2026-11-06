#!/usr/bin/env node
'use strict';
/**
 * UI test executor: runs any number of runbook .md files (one test case per file) using sessions from
 * playwright-linux-runtime. Usage:
 *   node run_ui_tests.cjs --runbook a.md --runbook b.md [--runbooks c.md,d.md] [--out .] [--jira KEY] [--shared-session]
 * Progress lines go to stderr; ONE JSON summary line goes to stdout. Never prints secrets.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const P = require('./runbook_parser.cjs');
const { Blocked } = P;

const ACTION_TIMEOUT = Math.max(1000, Number(process.env.UI_ACTION_TIMEOUT_MS || 15000));
const EXPECT_TIMEOUT = Math.min(15000, Math.max(500, Number(process.env.UI_EXPECT_TIMEOUT_MS || 15000)));
const NAV_TIMEOUT = Math.max(5000, Number(process.env.PLAYWRIGHT_NAVIGATION_TIMEOUT_MS || 60000));
const INTERACTIVE = new Set(['Click', 'Type', 'Clear', 'Select', 'Check', 'Uncheck', 'Hover over', 'Scroll to', 'Press key']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

function loadRuntime() {
  const rel = path.join('scripts', 'authenticated_browser.cjs');
  const candidates = [];
  if (process.env.RUNTIME_SKILL_DIR) candidates.push(path.join(process.env.RUNTIME_SKILL_DIR, rel));
  if (process.env.PLAYWRIGHT_RUNTIME_MODULE) candidates.push(path.join(process.env.PLAYWRIGHT_RUNTIME_MODULE, rel));
  candidates.push(path.resolve(__dirname, '..', '..', 'playwright-linux-runtime', rel));
  candidates.push(path.resolve(process.cwd(), 'skills', 'playwright-linux-runtime', rel));
  for (const c of candidates) if (fs.existsSync(c)) return require(c);
  throw new Error('RUNTIME_MODULE_NOT_FOUND: set RUNTIME_SKILL_DIR to the playwright-linux-runtime skill folder');
}

// ------------------------------------------------------------------ secrets scrubbing
const secretValues = new Set();
function registerSecret(v) { if (v && String(v).length >= 3) secretValues.add(String(v)); }
function scrub(str) {
  let s = String(str == null ? '' : str);
  for (const v of secretValues) s = s.split(v).join('***');
  return s.replace(/https?:\/\/[^/@\s]+:[^/@\s]+@/g, 'https://***:***@');
}
function deepScrub(o) {
  if (typeof o === 'string') return scrub(o);
  if (Array.isArray(o)) return o.map(deepScrub);
  if (o && typeof o === 'object') { const r = {}; for (const k of Object.keys(o)) r[k] = deepScrub(o[k]); return r; }
  return o;
}
function short(e) {
  return scrub(String(e && e.message ? e.message : e).split('\n')[0]).slice(0, 300);
}

// ------------------------------------------------------------------ page helpers
async function bodyText(page) {
  try { return await page.evaluate(() => (document.body ? document.body.innerText : '')); } catch (e) { return ''; }
}
async function fingerprint(page) {
  const t = await bodyText(page);
  return page.url() + '|' + crypto.createHash('sha1').update(t).digest('hex');
}
function roleLocator(page, role, name, exact) {
  if (role === 'text') return page.getByText(name, { exact });
  return page.getByRole(role, { name, exact });
}
async function visibleIndexes(loc, cap = 60) {
  const n = Math.min(await loc.count(), cap);
  const out = [];
  for (let i = 0; i < n; i++) { if (await loc.nth(i).isVisible().catch(() => false)) out.push(i); }
  return out;
}
async function cardText(el) {
  return normalizeWs(await el.evaluate((node) => {
    const card = node.closest('li, article, [class*="product" i], [class*="card" i], [class*="item" i]') || node;
    return card.innerText || node.innerText || node.textContent || '';
  }).catch(() => ''));
}
function normalizeWs(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

// ------------------------------------------------------------------ context
function makeCtx(session, runbook, targetUrl) {
  const ctx = {
    session, page: session.page, runbook, targetUrl, vars: {}, comparisons: [], itemsTried: [],
    urlBeforeStep: {}, anchorIdx: -1, altOverride: {}, pendingDialog: null, onDialog: null, notes: [],
    lastElement: null, lastChosen: null, preCapture: null
  };
  session.ctxRef = ctx;
  return ctx;
}
function attachPage(ctx, page) {
  page.setDefaultTimeout(ACTION_TIMEOUT);
  page.on('dialog', (d) => { const c = ctx.session.ctxRef || ctx; c.pendingDialog = d; if (c.onDialog) c.onDialog(); });
}
function resolve(ctx, str) {
  const r = P.resolvePlaceholders(str, process.env, ctx.vars, ctx.targetUrl);
  r.usedSecrets.forEach(registerSecret);
  return r;
}

// ------------------------------------------------------------------ element resolution
async function resolveElement(ctx, step, timeoutMs = ACTION_TIMEOUT) {
  const { role, name: rawName } = step.target;
  const { text: name } = resolve(ctx, rawName);
  const page = ctx.page;
  const deadline = Date.now() + timeoutMs;
  const hasRule = !!step.select;
  let rule = null;
  if (hasRule) {
    rule = P.parseSelectRule(step.select);
    if (!rule.supported) throw new Blocked('Select rule not machine-evaluable: "' + step.select + '"');
  }
  let lastTotal = 0;
  while (true) {
    const tries = hasRule ? [false] : [true, false];
    for (const exact of tries) {
      let loc = roleLocator(page, role, name, exact);
      let vis = await visibleIndexes(loc);
      if (vis.length === 0 && !hasRule && ['textbox', 'checkbox', 'combobox'].includes(role)) {
        loc = page.getByLabel(name, { exact });
        vis = await visibleIndexes(loc);
      }
      lastTotal = vis.length;
      if (vis.length === 0) continue;
      if (hasRule) {
        const cards = [];
        for (const i of vis) cards.push(await cardText(loc.nth(i)));
        const order = P.applyRule(cards, rule);
        const off = ctx.altOverride[step.n] || 0;
        if (order[off] === undefined) throw new Error('No visible ' + role + ' "' + name + '" satisfies rule "' + step.select + '" (candidate ' + (off + 1) + ')');
        const pick = vis[order[off]];
        const text = cards[order[off]];
        const price = P.findAmounts(text)[0];
        ctx.lastChosen = { step: step.n, name: text.slice(0, 80), price: price === undefined ? null : price, offset: off };
        return loc.nth(pick);
      }
      if (vis.length === 1) return loc.nth(vis[0]);
      throw new Blocked('Ambiguous target: ' + vis.length + ' visible elements match ' + role + ' "' + name + '" and the step has no Select rule');
    }
    if (Date.now() > deadline) break;
    await sleep(300);
  }
  throw new Error('Element not found: ' + role + ' "' + name + '" (' + lastTotal + ' visible match)');
}

// ------------------------------------------------------------------ banner clearing
async function dismissBlockers(ctx) {
  const page = ctx.page;
  try {
    const containers = page.locator('[id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i], [aria-label*="cookie" i], [role="dialog"][aria-label*="newsletter" i], [role="dialog"][aria-label*="promo" i]');
    const n = Math.min(await containers.count(), 5);
    for (let i = 0; i < n; i++) {
      const c = containers.nth(i);
      if (!(await c.isVisible().catch(() => false))) continue;
      const btn = c.getByRole('button', { name: /^(accept( all)?( cookies)?|i agree|agree|got it|allow all|no thanks|close|dismiss)$/i }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 3000 });
        ctx.notes.push('Blocker cleared (cookie/promo banner)');
        await sleep(300);
      }
    }
  } catch (e) { /* best effort only */ }
}

// ------------------------------------------------------------------ actions
async function clickRace(ctx, el) {
  const p = el.click({ timeout: ACTION_TIMEOUT });
  p.catch(() => {});
  const dialogSeen = new Promise((r) => { ctx.onDialog = r; });
  await Promise.race([p, dialogSeen]);
  ctx.onDialog = null;
}
async function settle(ctx) {
  if (ctx.pendingDialog) return;
  await ctx.page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
}

async function performAction(ctx, step) {
  const page = ctx.page;
  ctx.lastElement = null;
  const valueOf = () => (step.value === null ? null : resolve(ctx, step.value).text);
  switch (step.verb) {
    case 'Navigate to': {
      let url = resolve(ctx, step.target.url).text;
      if (url.startsWith('/')) url = new URL(ctx.targetUrl).origin + url;
      if (!/^https?:\/\//i.test(url)) throw new Blocked('Navigate target is not a valid URL: ' + P.safeUrl(url));
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
      const st = resp ? resp.status() : null;
      if (st === 401 || st === 403) throw new Blocked('HTTP ' + st + ' on navigation (authentication/authorization); not retried');
      if (st && st >= 400) throw new Error('HTTP ' + st + ' on ' + P.safeUrl(url));
      await dismissBlockers(ctx);
      return;
    }
    case 'Click': {
      const el = await resolveElement(ctx, step); ctx.lastElement = el;
      if (step.capture) ctx.preCapture = await readCapture(ctx, step, el);
      await clickRace(ctx, el); await settle(ctx); return;
    }
    case 'Hover over': { const el = await resolveElement(ctx, step); ctx.lastElement = el; await el.hover({ timeout: ACTION_TIMEOUT }); return; }
    case 'Type': { const el = await resolveElement(ctx, step); ctx.lastElement = el; await el.fill(valueOf(), { timeout: ACTION_TIMEOUT }); return; }
    case 'Clear': { const el = await resolveElement(ctx, step); ctx.lastElement = el; await el.fill('', { timeout: ACTION_TIMEOUT }); return; }
    case 'Select': {
      const el = await resolveElement(ctx, step); ctx.lastElement = el;
      const v = valueOf();
      const isNative = await el.evaluate((n) => n.tagName === 'SELECT').catch(() => false);
      if (isNative) { await el.selectOption({ label: v }, { timeout: ACTION_TIMEOUT }); return; }
      await el.click({ timeout: ACTION_TIMEOUT });
      await page.getByRole('option', { name: v, exact: true }).first().click({ timeout: ACTION_TIMEOUT });
      return;
    }
    case 'Check': { const el = await resolveElement(ctx, step); ctx.lastElement = el; await el.check({ timeout: ACTION_TIMEOUT }); return; }
    case 'Uncheck': { const el = await resolveElement(ctx, step); ctx.lastElement = el; await el.uncheck({ timeout: ACTION_TIMEOUT }); return; }
    case 'Scroll to': { const el = await resolveElement(ctx, step); ctx.lastElement = el; await el.scrollIntoViewIfNeeded({ timeout: ACTION_TIMEOUT }); return; }
    case 'Press key': { await page.keyboard.press(valueOf()); await settle(ctx); return; }
    case 'Wait for text': {
      const t = valueOf() || (step.target.name ? resolve(ctx, step.target.name).text : null);
      if (!t) throw new Blocked('Wait for text needs the text in the value field');
      await page.getByText(t, { exact: false }).first().waitFor({ state: 'visible', timeout: EXPECT_TIMEOUT });
      return;
    }
    case 'Verify': return;
    case 'Switch to': {
      const v = valueOf();
      const pages = ctx.session.context.pages();
      let target = null;
      if (!v || /^(new|latest|last)$/i.test(v)) target = pages[pages.length - 1];
      else {
        for (const p of pages) { const t = await p.title().catch(() => ''); if (t.includes(v) || p.url().includes(v)) { target = p; break; } }
      }
      if (!target) throw new Error('No tab matches "' + v + '"');
      attachPageOnce(ctx, target);
      await target.bringToFront();
      ctx.page = target;
      return;
    }
    case 'Accept dialog':
    case 'Dismiss dialog': {
      if (!ctx.pendingDialog) {
        const d = await page.waitForEvent('dialog', { timeout: 5000 }).catch(() => null);
        if (d) ctx.pendingDialog = d;
      }
      if (!ctx.pendingDialog) throw new Error('No browser dialog appeared');
      const d = ctx.pendingDialog; ctx.pendingDialog = null;
      if (step.verb === 'Accept dialog') await d.accept(step.value ? valueOf() : undefined); else await d.dismiss();
      await settle(ctx);
      return;
    }
    default: throw new Blocked('Unsupported verb ' + step.verb);
  }
}
const attached = new WeakSet();
function attachPageOnce(ctx, page) { if (!attached.has(page)) { attached.add(page); attachPage(ctx, page); } }

// ------------------------------------------------------------------ expected evaluation
function urlMatches(cur, chk, ctx) {
  const want = resolve(ctx, chk.value).text;
  let ok;
  if (/^https?:\/\//i.test(want)) {
    const a = cur.replace(/\/+$/, ''); const b = want.replace(/\/+$/, '');
    ok = chk.op === 'equals' ? a === b : chk.op === 'starts with' ? a.startsWith(b) : chk.op === 'ends with' ? a.endsWith(b) : a.includes(b);
  } else {
    const u = new URL(cur);
    const pathAndQ = want.includes('?') ? u.pathname + u.search : u.pathname;
    ok = chk.op === 'equals' ? pathAndQ.replace(/\/+$/, '') === want.replace(/\/+$/, '')
      : chk.op === 'starts with' ? pathAndQ.startsWith(want) : chk.op === 'ends with' ? pathAndQ.endsWith(want) : cur.includes(want);
  }
  return { ok, want };
}

async function evaluateExpected(ctx, expectedStr) {
  const exp = P.parseExpected(expectedStr);
  if (exp.empty) return { unverifiable: true, pass: false, actual: 'Expected result is not machine-checkable: "' + expectedStr + '"', usedVars: [] };
  const page = ctx.page;
  const usedVars = [];
  const fails = [];
  const passes = [];
  const rec = (ok, okMsg, failMsg) => (ok ? passes.push(okMsg) : fails.push(failMsg));
  const res = (s) => { const r = resolve(ctx, s); usedVars.push(...r.usedVars); return r.text; };
  const text = await bodyText(page);
  const normBody = normalizeWs(text);

  for (const c of exp.urlChecks) {
    const cur = page.url();
    const { ok, want } = urlMatches(cur, { op: c.op, value: c.value }, ctx);
    usedVars.push(...P.listPlaceholderNames(c.value).vars);
    const good = exp.negate ? !ok : ok;
    rec(good, 'URL ' + (exp.negate ? 'does not ' : '') + c.op + ' ' + P.safeUrl(want), 'URL ' + P.safeUrl(cur) + (exp.negate ? ' unexpectedly ' : ' does not ') + c.op + ' ' + P.safeUrl(want));
  }
  for (const c of exp.titleChecks) {
    const want = res(c.value); const t = await page.title().catch(() => '');
    const ok = c.op === 'equals' ? t === want : t.includes(want);
    rec(ok, 'Title ' + c.op + ' "' + want + '"', 'Title is "' + normalizeWs(t).slice(0, 100) + '", expected ' + c.op + ' "' + want + '"');
  }
  for (const c of exp.counts) {
    const name = res(c.name);
    const n = (await visibleIndexes(roleLocator(page, c.role, name, false))).length;
    rec(n === c.n, 'Count of ' + c.role + ' "' + name + '" is ' + n, 'Count of ' + c.role + ' "' + name + '" is ' + n + ', expected ' + c.n);
  }
  for (const c of exp.valueChecks) {
    const name = res(c.name); const want = res(c.value);
    const loc = page.getByLabel(name, { exact: false }).first();
    const got = await loc.inputValue({ timeout: 2000 }).catch(() => null);
    rec(got === want, c.role + ' "' + name + '" has expected value', c.role + ' "' + name + '" value is ' + (got === null ? 'not readable' : '"' + got + '"') + ', expected "' + want + '"');
  }
  const checkText = (raw) => {
    const names = P.listPlaceholderNames(raw);
    const only = names.vars.length === 1 && raw.trim() === '{' + names.vars[0] + '}' ? ctx.vars[names.vars[0]] : null;
    if (only && only.kind === 'price' && only.numeric !== null) {
      usedVars.push(names.vars[0]);
      return { found: P.containsAmount(text, only.numeric), want: String(only.value), how: ' (numeric compare)' };
    }
    const want = normalizeWs(res(raw));
    let found = normBody.includes(want);
    let how = '';
    if (!found && normBody.toLowerCase().includes(want.toLowerCase())) { found = true; how = ' (case-insensitive match)'; }
    return { found, want, how };
  };
  const textVerdict = (raw, label) => {
    const { found, want, how } = checkText(raw);
    const good = exp.negate ? !found : found;
    rec(good, label + ' "' + want + '" ' + (exp.negate ? 'absent' : 'present') + how,
      label + ' "' + want + '" ' + (exp.negate ? 'is still present' : 'not found on page') + how);
  };
  for (const c of exp.roleChecks) {
    if (c.role === 'text' && c.state === 'visible') { textVerdict(c.name, 'Text'); continue; }
    const name = res(c.name);
    const loc = roleLocator(page, c.role, name, false);
    const vis = await visibleIndexes(loc);
    let ok;
    if (c.state === 'visible') ok = vis.length > 0;
    else if (vis.length === 0) ok = false;
    else if (c.state === 'enabled') ok = await loc.nth(vis[0]).isEnabled().catch(() => false);
    else if (c.state === 'disabled') ok = await loc.nth(vis[0]).isDisabled().catch(() => false);
    else if (c.state === 'checked') ok = await loc.nth(vis[0]).isChecked().catch(() => false);
    else ok = !(await loc.nth(vis[0]).isChecked().catch(() => true));
    const polarity = c.state === 'visible' ? exp.negate : false;
    const good = polarity ? !ok : ok;
    rec(good, c.role + ' "' + name + '" ' + (polarity ? 'not ' : '') + c.state, c.role + ' "' + name + '" ' + (polarity ? 'is still ' : 'is not ') + c.state);
  }
  for (const c of exp.textChecks) textVerdict(c.text, 'Text');
  const pass = fails.length === 0;
  let actual = pass ? passes.join('; ') : fails.join('; ');
  if (!pass) actual += ' | page title "' + normalizeWs(await page.title().catch(() => '')).slice(0, 80) + '" at ' + P.safeUrl(page.url());
  return { pass, unverifiable: false, actual, usedVars: Array.from(new Set(usedVars)) };
}

async function pollExpected(ctx, expectedStr, timeoutMs) {
  const end = Date.now() + timeoutMs;
  let last;
  while (true) {
    last = await evaluateExpected(ctx, expectedStr);
    if (last.pass || last.unverifiable || Date.now() > end) return last;
    await sleep(500);
  }
}

// ------------------------------------------------------------------ capture
/** Reads (does not store) the value for a Capture field. Click steps read BEFORE the click. */
async function readCapture(ctx, step, el) {
  const cap = step.capture;
  const kind = P.classifyCapture(cap.what);
  if (kind === 'url') return { value: P.safeUrl(ctx.page.url()), numeric: null, kind };
  if (kind === 'title') return { value: normalizeWs(await ctx.page.title()), numeric: null, kind };
  if (!el && step.target && step.target.role && step.target.role !== 'page') el = await resolveElement(ctx, step, 4000);
  if (!el) throw new Blocked('Capture {' + cap.name + '} needs an element target');
  const own = normalizeWs(await el.innerText({ timeout: 3000 }).catch(() => '')) ||
    normalizeWs(await el.inputValue({ timeout: 3000 }).catch(() => ''));
  const card = await cardText(el);
  if (kind === 'value') return { value: await el.inputValue({ timeout: 3000 }).catch(() => own), numeric: null, kind };
  if (kind === 'price') {
    const a = P.firstAmount(own) || P.firstAmount(card);
    if (!a) throw new Error('No price found to capture as {' + cap.name + '}');
    return { value: a.text, numeric: a.num, kind };
  }
  if (kind === 'number') {
    const m = (own || card).match(/\d[\d,]*(?:\.\d+)?/);
    if (!m) throw new Error('No number found to capture as {' + cap.name + '}');
    return { value: m[0], numeric: Number(m[0].replace(/,/g, '')), kind };
  }
  if (kind === 'name') {
    const raw = await el.innerText({ timeout: 3000 }).catch(() => '');
    const firstLine = String(raw || card).split('\n').map((x) => x.trim()).filter(Boolean)[0] || card;
    return { value: firstLine.slice(0, 120), numeric: null, kind };
  }
  return { value: (own || card).slice(0, 200), numeric: null, kind };
}
function storeCapture(ctx, step, cv) {
  ctx.vars[step.capture.name] = { value: String(cv.value), numeric: cv.numeric, kind: cv.kind, setAt: step.n };
  return ctx.vars[step.capture.name];
}

// ------------------------------------------------------------------ one attempt
async function attemptStep(ctx, step) {
  ctx.preCapture = null;
  const before = await fingerprint(ctx.page).catch(() => '');
  try {
    await performAction(ctx, step);
  } catch (e) {
    if (e instanceof Blocked) return { status: 'BLOCKED', actual: scrub(e.message) };
    if (isDisconnect(e)) return { status: 'BLOCKED', actual: 'Browser disconnected', disconnect: true };
    const after = await fingerprint(ctx.page).catch(() => '');
    return { status: 'FAIL', actual: 'Action error: ' + short(e), noEffect: after === before, actionError: true };
  }
  let r;
  try {
    r = step.expected ? await pollExpected(ctx, step.expected, EXPECT_TIMEOUT) : { pass: true, actual: 'Action completed', usedVars: [] };
  } catch (e) {
    if (e instanceof Blocked) return { status: 'BLOCKED', actual: scrub(e.message) };
    if (isDisconnect(e)) return { status: 'BLOCKED', actual: 'Browser disconnected', disconnect: true };
    return { status: 'FAIL', actual: 'Check error: ' + short(e), noEffect: false };
  }
  if (r.unverifiable) return { status: 'BLOCKED', actual: r.actual };
  const dataMismatch = !r.pass && r.usedVars.length > 0;
  for (const v of r.usedVars) if (ctx.vars[v]) ctx.comparisons.push({ name: v, step: step.n, matched: r.pass });
  if (!r.pass) {
    const after = await fingerprint(ctx.page).catch(() => '');
    return { status: 'FAIL', actual: r.actual, noEffect: after === before, dataMismatch };
  }
  let actual = r.actual;
  if (step.capture) {
    try {
      const cv = storeCapture(ctx, step, ctx.preCapture || await readCapture(ctx, step, ctx.lastElement));
      actual += ' | captured {' + step.capture.name + '}=' + cv.value;
    } catch (e) {
      if (e instanceof Blocked) return { status: 'BLOCKED', actual: scrub(e.message) };
      return { status: 'FAIL', actual: 'Capture failed: ' + short(e), noEffect: false };
    }
  }
  if (ctx.lastChosen && ctx.lastChosen.step === step.n) {
    ctx.itemsTried.push({ step: step.n, name: ctx.lastChosen.name, price: ctx.lastChosen.price, outcome: 'selected' });
  }
  return { status: 'PASS', actual };
}
function isDisconnect(e) {
  return /target (page, context or browser has been )?closed|browser has been closed|browser closed|connection closed|disconnected/i.test(String(e && e.message));
}


// ------------------------------------------------------------------ test case execution
async function shot(ctx, tcId, n, outDir) {
  const name = tcId + '_step' + n + '_FAIL.png';
  try { await ctx.page.screenshot({ path: path.join(outDir, 'screenshots', name) }); return name; } catch (e) { return name + ' (capture failed)'; }
}

/** Session manager: new authenticated session per TC unless --shared-session. */
function makeSessionManager(shared) {
  const mgr = { session: null, createFailures: 0, runtime: null };
  mgr.acquire = async () => {
    if (shared && mgr.session) return { session: mgr.session, reused: true };
    mgr.runtime = mgr.runtime || loadRuntime();
    const s = await mgr.runtime.createAuthenticatedSession();
    s.context.on('page', (p) => attachPageOnce(s.ctxRef, p));
    mgr.session = s;
    return { session: s, reused: false };
  };
  mgr.release = async (dropShared) => {
    if (!mgr.session) return;
    if (shared && !dropShared) return;
    try { await mgr.session.close(); } catch (e) { /* ignore */ }
    mgr.session = null;
  };
  return mgr;
}

async function runOne(file, g) {
  const startedAt = new Date();
  let runbook;
  const rel = path.relative(process.cwd(), file) || file;
  const baseName = path.basename(file).replace(/\.md$/i, '');
  const tc = {
    tcId: baseName, title: baseName, file: rel, baseUrlHost: null, runbookStatus: null, result: 'BLOCKED', blockedReason: null,
    startedAt: startedAt.toISOString(), endedAt: null, durationMs: 0, sharedSession: g.shared, steps: [], verifyAll: null,
    captured: [], itemsTried: [], reattempts: [], alternateItemUsed: false, bugs: [], notes: []
  };
  const finish = (result, reason) => {
    tc.result = result; tc.blockedReason = reason || null;
    tc.endedAt = new Date().toISOString(); tc.durationMs = Date.now() - startedAt.getTime();
    process.stderr.write(JSON.stringify(deepScrub({ progress: g.index + '/' + g.total, tc: tc.tcId, result, blockedReason: tc.blockedReason })) + '\n');
    return tc;
  };
  if (!fs.existsSync(file)) {
    tc.steps.push({ n: 0, verb: '-', target: null, value: null, expected: null, capture: null, select: null, status: 'BLOCKED', actual: 'Runbook file not found', reattempt: null, screenshot: null, durationMs: 0 });
    g.usedIds.add(tc.tcId);
    return finish('BLOCKED', 'Runbook file not found: ' + rel);
  }
  runbook = P.parseRunbook(fs.readFileSync(file, 'utf8'));
  let tcId = runbook.tcId;
  if (g.usedIds.has(tcId)) { let k = 2; while (g.usedIds.has(tcId + '-' + k)) k++; tcId = tcId + '-' + k; tc.notes.push('Duplicate TC id in runbooks; renamed ' + runbook.tcId + ' -> ' + tcId); }
  g.usedIds.add(tcId);
  tc.tcId = tcId; tc.title = runbook.title; tc.runbookStatus = runbook.runbookStatus;
  try { tc.baseUrlHost = runbook.baseUrl ? new URL(runbook.baseUrl).host : null; } catch (e) { /* ignore */ }
  if (g.shared) tc.notes.push('shared session');

  const stepRecord = (s, status, actual, extra) => Object.assign({
    n: s.n, verb: s.verb, target: s.target ? s.target.raw : null, value: s.value, expected: s.expected,
    capture: s.capture ? '{' + s.capture.name + '}=' + s.capture.what : null, select: s.select || null,
    status, actual, reattempt: null, screenshot: null, durationMs: 0
  }, extra || {});
  const markRemaining = (from, reason, status) => {
    for (let i = from; i < runbook.steps.length; i++) tc.steps.push(stepRecord(runbook.steps[i], status || 'NOT RUN', reason));
  };

  // ---- pre-checks (no browser)
  try {
    const th = new URL(g.targetUrl).host;
    if (runbook.baseUrl && new URL(runbook.baseUrl).host !== th) {
      markRemaining(0, 'Not run: Base URL does not match TARGET_URL', 'BLOCKED');
      return finish('BLOCKED', 'Base URL host (' + new URL(runbook.baseUrl).host + ') does not match TARGET_URL host (' + th + ')');
    }
  } catch (e) { /* ignore */ }
  if (/^BLOCKED/i.test(runbook.runbookStatus)) {
    markRemaining(0, 'Not run: runbook status is ' + runbook.runbookStatus, 'BLOCKED');
    return finish('BLOCKED', 'Runbook status: ' + runbook.runbookStatus);
  }
  if (runbook.steps.length === 0) {
    tc.steps.push({ n: 0, verb: '-', target: null, value: null, expected: null, capture: null, select: null, status: 'BLOCKED', actual: 'No executable steps found in runbook', reattempt: null, screenshot: null, durationMs: 0 });
    return finish('BLOCKED', 'No executable steps found in runbook');
  }
  if (g.browserUnavailable) {
    markRemaining(0, 'Not run: browser unavailable', 'BLOCKED');
    return finish('BLOCKED', 'Browser unavailable (session creation failed twice in a row)');
  }
  if (!runbook.steps[runbook.steps.length - 1].isVerifyAll) tc.notes.push('Runbook does not end with a "Verify all" step');

  // ---- session
  let ctx = null;
  let session = null;
  try {
    const got = await g.mgr.acquire();
    session = got.session;
    ctx = makeCtx(session, runbook, g.targetUrl);
    let page = session.page;
    if (got.reused) {
      const open = session.context.pages().filter((p) => !p.isClosed());
      page = open.length ? open[0] : await session.context.newPage();
    }
    ctx.page = page;
    attachPageOnce(ctx, page);
    g.mgr.createFailures = 0;
  } catch (e) {
    g.mgr.createFailures += 1;
    if (g.mgr.createFailures >= 2) g.browserUnavailable = true;
    markRemaining(0, 'Not run: browser session could not be created', 'BLOCKED');
    return finish('BLOCKED', 'Session creation failed: ' + short(e));
  }

  let failed = false;
  let blocked = false;
  const dataRows = runbook.dataRows;
  const isNamed = (n) => dataRows.some((r) => r.selection === 'named' && r.steps.includes(n));

  try {
    for (let idx = 0; idx < runbook.steps.length; idx++) {
      const step = runbook.steps[idx];
      const t0 = Date.now();

      // static blocks
      let staticReason = null;
      if (step.errors.length) staticReason = 'Runbook grammar: ' + step.errors.join('; ');
      else if (step.labelToConfirm) staticReason = 'Target label is "TO CONFIRM" in the runbook; not guessed';
      else if (step.select && !P.parseSelectRule(step.select).supported) staticReason = 'Select rule not machine-evaluable: "' + step.select + '"';
      if (!staticReason) {
        const names = P.listPlaceholderNames([step.value, step.target && step.target.name, step.target && step.target.url].join(' '));
        const missing = names.secrets.find((n) => !process.env[n]);
        if (missing) staticReason = 'Secret variable ' + missing + ' is not set';
      }
      if (staticReason) {
        tc.steps.push(stepRecord(step, 'BLOCKED', staticReason));
        markRemaining(idx + 1, 'Not run: step ' + step.n + ' is blocked');
        blocked = true; break;
      }

      ctx.urlBeforeStep[step.n] = ctx.page.url();
      ctx.lastChosen = null;
      let rec;

      if (step.isVerifyAll) {
        const checks = [];
        let anyFail = false; let anyBlocked = false;
        for (const c of step.checks) {
          let r;
          try { r = await pollExpected(ctx, c.expected, EXPECT_TIMEOUT); }
          catch (e) { r = { pass: false, unverifiable: e instanceof Blocked, actual: e instanceof Blocked ? scrub(e.message) : 'Check error: ' + short(e), usedVars: [] }; }
          for (const v of r.usedVars || []) if (ctx.vars[v]) ctx.comparisons.push({ name: v, step: step.n, matched: !!r.pass });
          const status = r.unverifiable ? 'BLOCKED' : r.pass ? 'PASS' : 'FAIL';
          if (status === 'FAIL') anyFail = true;
          if (status === 'BLOCKED') anyBlocked = true;
          checks.push({ letter: c.letter, text: c.text, ac: c.ac, expected: c.expected, status, actual: r.actual, dataMismatch: !r.pass && (r.usedVars || []).length > 0 });
        }
        tc.verifyAll = { step: step.n, checks };
        const st = anyFail ? 'FAIL' : anyBlocked ? 'BLOCKED' : 'PASS';
        rec = stepRecord(step, st, checks.map((c) => c.letter + ') ' + c.status).join(', '), { durationMs: Date.now() - t0 });
        if (anyFail) {
          rec.screenshot = await shot(ctx, tcId, step.n, g.outDir);
          checks.filter((c) => c.status === 'FAIL').forEach((c) => tc.bugs.push({
            step: step.n, check: c.letter, expected: c.expected, actual: c.actual,
            severity: c.dataMismatch ? 'High' : 'Medium', screenshot: rec.screenshot, dataMismatch: c.dataMismatch
          }));
          failed = true;
        }
        if (anyBlocked && !anyFail) blocked = true;
        tc.steps.push(rec);
        if (anyFail || anyBlocked) markRemaining(idx + 1, 'Not run: step ' + step.n + ' ended the run');
        if (anyFail || anyBlocked) break;
        continue;
      }

      let res = await attemptStep(ctx, step);
      let reattempt = null;
      if (res.disconnect) {
        tc.steps.push(stepRecord(step, 'BLOCKED', 'Browser disconnected', { durationMs: Date.now() - t0 }));
        markRemaining(idx + 1, 'Not run: browser disconnected', 'BLOCKED');
        blocked = true; tc.blockedReason = 'Browser disconnected'; break;
      }
      if (res.status === 'FAIL' && step.verb !== 'Verify') {
        // controlled re-attempt, once
        reattempt = { used: true, mode: 'repeat', outcome: null };
        if (res.noEffect && step.verb !== 'Navigate to') {
          reattempt.mode = 'reload-and-replay';
          try {
            await ctx.page.reload({ waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
            for (let j = ctx.anchorIdx + 1; j < idx; j++) {
              const prev = runbook.steps[j];
              if (INTERACTIVE.has(prev.verb)) await performAction(ctx, prev).catch(() => {});
            }
          } catch (e) { /* attempt anyway */ }
        }
        const res2 = await attemptStep(ctx, step);
        if (res2.disconnect) {
          tc.steps.push(stepRecord(step, 'BLOCKED', 'Browser disconnected', { durationMs: Date.now() - t0 }));
          markRemaining(idx + 1, 'Not run: browser disconnected', 'BLOCKED');
          blocked = true; tc.blockedReason = 'Browser disconnected'; break;
        }
        reattempt.outcome = res2.status === 'PASS' ? 'passed on re-attempt (transient)' : 'still failing';
        res = res2;
      }

      rec = stepRecord(step, res.status, res.actual, { durationMs: Date.now() - t0 });
      if (reattempt) { rec.reattempt = reattempt; tc.reattempts.push({ step: step.n, mode: reattempt.mode, outcome: reattempt.outcome }); }
      if (res.status === 'PASS' && reattempt) { rec.status = 'WARN'; rec.actual += ' | passed on re-attempt (transient)'; }

      if (res.status === 'FAIL') {
        rec.screenshot = await shot(ctx, tcId, step.n, g.outDir);
        // alternate item fallback (Add to Bag / Add to Cart only)
        const isAdd = step.verb === 'Click' && /add to (bag|cart|basket)/i.test((step.target && step.target.name) || '');
        let recovered = false;
        if (isAdd && !isNamed(step.n)) {
          const selIdx = (() => { for (let j = idx - 1; j >= 0; j--) if (runbook.steps[j].select) return j; return -1; })();
          const sel = selIdx >= 0 ? runbook.steps[selIdx] : null;
          if (sel && !isNamed(sel.n)) {
            const original = ctx.itemsTried.filter((i) => i.step === sel.n).slice(-1)[0] || null;
            if (original) original.outcome = 'Add to Bag failed';
            for (let k = 1; k <= 2 && !recovered; k++) {
              ctx.altOverride[sel.n] = k;
              let ok = true;
              try {
                await ctx.page.goto(ctx.urlBeforeStep[sel.n], { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
                for (let j = selIdx; j <= idx && ok; j++) {
                  const r = await attemptStep(ctx, runbook.steps[j]);
                  if (r.status !== 'PASS') ok = false;
                }
              } catch (e) { ok = false; }
              const tried = ctx.itemsTried.filter((i) => i.step === sel.n).slice(-1)[0];
              if (tried && tried.outcome === 'selected') tried.outcome = ok ? 'worked' : 'Add to Bag failed';
              recovered = ok;
            }
            if (recovered) {
              const first = original ? original.name : 'first item';
              const worked = ctx.itemsTried.filter((i) => i.outcome === 'worked').slice(-1)[0];
              tc.bugs.push({
                step: step.n, expected: step.expected, actual: res.actual + ' (item: ' + first + ')', severity: 'Medium',
                screenshot: rec.screenshot, note: 'Add to Bag failed on first item; worked on alternate'
              });
              tc.alternateItemUsed = true;
              rec.status = 'WARN';
              rec.actual = 'Add to Bag failed on "' + first + '" - worked on "' + (worked ? worked.name : 'alternate item') + '"';
              tc.steps.push(rec);
              ctx.anchorIdx = idx;
              continue;
            }
          }
        }
        if (!recovered) {
          tc.bugs.push({
            step: step.n, expected: step.expected, actual: res.actual,
            severity: res.dataMismatch || res.actionError ? 'High' : 'Medium', screenshot: rec.screenshot, dataMismatch: !!res.dataMismatch
          });
          tc.steps.push(rec);
          markRemaining(idx + 1, 'Not run: step ' + step.n + ' failed');
          failed = true; break;
        }
      }
      if (res.status === 'BLOCKED') {
        tc.steps.push(rec);
        markRemaining(idx + 1, 'Not run: step ' + step.n + ' is blocked');
        blocked = true; break;
      }
      tc.steps.push(rec);
      // advance anchor when the URL changed or on navigation
      if (step.verb === 'Navigate to' || ctx.page.url() !== ctx.urlBeforeStep[step.n]) ctx.anchorIdx = idx;
    }
  } catch (e) {
    tc.notes.push('Runner error: ' + short(e));
    const done = tc.steps.length;
    if (done < runbook.steps.length) {
      tc.steps.push(stepRecord(runbook.steps[done], 'BLOCKED', 'Runner error: ' + short(e)));
      markRemaining(done + 1, 'Not run: runner error');
    }
    blocked = true; tc.blockedReason = 'Runner error: ' + short(e);
  } finally {
    try { if (ctx && ctx.pendingDialog) await ctx.pendingDialog.dismiss().catch(() => {}); } catch (e) { /* ignore */ }
  }


  const hasWarn = tc.reattempts.some((r) => /transient/.test(r.outcome || '')) || tc.alternateItemUsed;
  const result = failed ? 'FAIL' : blocked ? 'BLOCKED' : hasWarn ? 'WARN' : 'PASS';
  if (blocked && !tc.blockedReason) {
    const b = tc.steps.find((s) => s.status === 'BLOCKED');
    tc.blockedReason = b ? 'Step ' + b.n + ': ' + b.actual : null;
  }
  tc.captured = Object.keys(ctx.vars).map((k) => ({
    name: k, kind: ctx.vars[k].kind, value: ctx.vars[k].value, setAtStep: ctx.vars[k].setAt,
    comparisons: ctx.comparisons.filter((c) => c.name === k).map((c) => ({ step: c.step, matched: c.matched }))
  }));
  tc.itemsTried = ctx.itemsTried;
  tc.notes.push(...Array.from(new Set(ctx.notes)));
  const disconnected = /Browser disconnected/.test(tc.blockedReason || '');
  await g.mgr.release(disconnected);
  return finish(result, tc.blockedReason);
}

// ------------------------------------------------------------------ main
function collectRunbooks() {
  const out = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === '--runbook' && process.argv[i + 1]) out.push(process.argv[i + 1]);
    if (process.argv[i] === '--runbooks' && process.argv[i + 1]) out.push(...process.argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean));
  }
  return out;
}

async function main() {
  const outDir = path.resolve(arg('out', process.cwd()));
  const jiraKey = arg('jira', process.env.JIRA_ISSUE_KEY || 'UNKNOWN');
  const targetUrl = process.env.TARGET_URL || '';
  const shared = process.argv.includes('--shared-session');
  registerSecret(process.env.BASIC_AUTH_PASSWORD);
  const notStarted = (reason) => { console.log(JSON.stringify({ status: 'NOT_STARTED', reason })); process.exit(2); };

  const files = collectRunbooks().map((f) => path.resolve(f));
  if (files.length === 0) notStarted('No runbook files given (use --runbook <file.md> one or more times, or --runbooks a.md,b.md)');
  const dirs = files.filter((f) => fs.existsSync(f) && fs.statSync(f).isDirectory());
  if (dirs.length) notStarted('A directory was given instead of a runbook file; list the .md files explicitly');
  if (!targetUrl) notStarted('TARGET_URL is missing');
  for (const n of ['BASIC_AUTH_USERNAME', 'BASIC_AUTH_PASSWORD']) if (!process.env[n]) notStarted(n + ' is missing');
  try { const u = new URL(targetUrl); if (u.username || u.password) throw new Error('x'); } catch (e) { notStarted('TARGET_URL is invalid or contains credentials'); }
  if (new Set(files).size !== files.length) notStarted('The same runbook file was listed more than once');

  fs.mkdirSync(path.join(outDir, 'screenshots'), { recursive: true });
  const runStarted = new Date();
  const g = { outDir, targetUrl, shared, usedIds: new Set(), mgr: makeSessionManager(shared), browserUnavailable: false, total: files.length, index: 0 };
  const testCases = [];
  try {
    for (let i = 0; i < files.length; i++) {
      g.index = i + 1;
      let tc;
      try { tc = await runOne(files[i], g); }
      catch (e) {
        tc = { tcId: path.basename(files[i]).replace(/\.md$/i, ''), title: path.basename(files[i]), file: path.relative(process.cwd(), files[i]), result: 'BLOCKED', blockedReason: 'Runner error: ' + short(e), steps: [{ n: 0, verb: '-', target: null, value: null, expected: null, capture: null, select: null, status: 'BLOCKED', actual: 'Runner error: ' + short(e), reattempt: null, screenshot: null, durationMs: 0 }], verifyAll: null, captured: [], itemsTried: [], reattempts: [], alternateItemUsed: false, bugs: [], notes: [], startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), durationMs: 0 };
        await g.mgr.release(true);
      }
      testCases.push(tc);
    }
  } finally {
    await g.mgr.release(true);
  }
  const summary = { total: testCases.length, PASS: 0, FAIL: 0, WARN: 0, BLOCKED: 0 };
  testCases.forEach((t) => { summary[t.result] += 1; });
  const evidence = {
    schemaVersion: 2, jiraKey, browser: 'chromium', mode: 'headless', sharedSession: shared,
    startedAt: runStarted.toISOString(), endedAt: new Date().toISOString(), durationMs: Date.now() - runStarted.getTime(),
    summary, testCases,
    limitations: [
      'Expected results are matched by text/role/URL/count rules on rendered page text; content exposed only as images/canvas is not verified.',
      'Headless Chromium only.'
    ]
  };
  fs.writeFileSync(path.join(outDir, 'execution_evidence.json'), JSON.stringify(deepScrub(evidence), null, 2));
  console.log(JSON.stringify(deepScrub({
    status: 'DONE', evidence: 'execution_evidence.json', summary,
    testCases: testCases.map((t) => ({ tcId: t.tcId, result: t.result, blockedReason: t.blockedReason }))
  })));
}

main().catch((e) => {
  console.log(JSON.stringify({ status: 'CRASHED', reason: short(e) }));
  process.exit(1);
});
