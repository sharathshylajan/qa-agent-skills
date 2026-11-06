'use strict';
/**
 * Pure (browser-free) helpers: runbook parsing, placeholder resolution,
 * Expected-result parsing, Select-rule evaluation. Unit-testable offline.
 */

const VERBS = [
  'Navigate to', 'Click', 'Type', 'Clear', 'Select', 'Check', 'Uncheck', 'Hover over',
  'Scroll to', 'Press key', 'Wait for text', 'Verify', 'Switch to', 'Accept dialog', 'Dismiss dialog'
];
const ROLES = ['link', 'button', 'textbox', 'checkbox', 'combobox', 'menuitem', 'tab', 'heading', 'text', 'dialog', 'page'];
const ROLE_RE = ROLES.filter((r) => r !== 'page').join('|');

class Blocked extends Error {
  constructor(message) { super(message); this.name = 'Blocked'; }
}

function normQuotes(s) {
  return String(s == null ? '' : s).replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"').replace(/[\u2018\u2019]/g, "'");
}
function stripMd(s) {
  return normQuotes(s).replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
}
function stripOuterQuotes(s) {
  const t = String(s == null ? '' : s).trim();
  const m = t.match(/^"(.*)"$/s);
  return m ? m[1] : t;
}
function normText(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------- amounts
const AMOUNT_RE = /(?:[$\u20AC\u00A3\u00A5\u20B9]|USD|EUR|GBP|INR|Rs\.?)\s?\d[\d,]*(?:\.\d+)?/gi;
function findAmounts(text) {
  return (String(text || '').match(AMOUNT_RE) || []).map(parseAmount).filter((n) => Number.isFinite(n));
}
function parseAmount(s) {
  const m = String(s).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}
function firstAmount(text) {
  const m = String(text || '').match(new RegExp(AMOUNT_RE.source, 'i'));
  return m ? { text: m[0].trim(), num: parseAmount(m[0]) } : null;
}
function containsAmount(text, num) {
  return findAmounts(text).some((n) => Math.abs(n - num) < 0.005);
}

// ---------------------------------------------------------------- runbook
const SECTION_NAMES = [
  'overview', 'environment', 'accounts', 'test data', 'preconditions', 'steps',
  'ac traceability', 'final checks', 'captured values', 'overall result', 'to confirm'
];

function sectionKey(line) {
  const t = stripMd(line);
  let m = t.match(/^#{1,6}\s*(?:\d+[.)]?\s*)?(.*)$/);
  let name = m ? m[1] : null;
  if (!name) {
    m = t.match(/^(?:\d+[.)]?\s+)(.*)$/);
    if (m) name = m[1];
  }
  if (!name) return null;
  const low = name.toLowerCase();
  for (const s of SECTION_NAMES) {
    if (low === s || low.startsWith(s + ' ') || low.startsWith(s + ':') || low.startsWith(s + '/')) return s;
  }
  return null;
}

function splitSections(lines) {
  const sections = {};
  let current = '_head';
  sections[current] = [];
  for (const line of lines) {
    const raw = line.trim();
    const isHeadingLike = /^#{1,6}\s/.test(raw) || /^\**\d+[.)]?\**\s+[A-Za-z]/.test(raw);
    const key = isHeadingLike ? sectionKey(raw) : null;
    if (key) { current = key; sections[current] = sections[current] || []; continue; }
    sections[current].push(line);
  }
  return sections;
}

function parseTable(lines) {
  const rows = lines.map((l) => l.trim()).filter((l) => l.startsWith('|'));
  if (rows.length < 2) return [];
  const cells = (l) => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => stripMd(c));
  const header = cells(rows[0]).map((h) => h.toLowerCase());
  const out = [];
  for (const r of rows.slice(1)) {
    if (/^\|?\s*:?-{2,}/.test(r.replace(/\s/g, ''))) continue;
    if (/^[|\s:-]+$/.test(r)) continue;
    const c = cells(r);
    const o = {};
    header.forEach((h, i) => { o[h] = c[i] || ''; });
    out.push(o);
  }
  return out;
}

function splitFields(body) {
  return body.split(/\s+\|\s+/).map((s) => s.trim());
}

function parseTarget(verb, raw) {
  const t = stripMd(raw || '');
  if (verb === 'Navigate to') return { raw: t, url: stripOuterQuotes(t) };
  if (/^page$/i.test(t)) return { raw: t, role: 'page', name: null };
  const m = t.match(new RegExp('^(' + ROLES.join('|') + ')\\s+"(.*)"$', 'i'));
  if (m) return { raw: t, role: m[1].toLowerCase(), name: m[2] };
  return { raw: t, role: null, name: null, error: 'Target must be <role> "<exact text>" or page' };
}

function parseStepBody(n, body) {
  const step = {
    n, raw: body, verb: null, target: null, value: null, expected: null, capture: null, select: null,
    labelToConfirm: false, isVerifyAll: false, checks: [], errors: []
  };
  const parts = splitFields(body);
  let verbTok = parts[0] || '';
  const verbHit = VERBS.find((v) => verbTok.toLowerCase() === v.toLowerCase());
  if (/^verify all$/i.test(verbTok)) { step.verb = 'Verify'; step.isVerifyAll = true; }
  else if (verbHit) step.verb = verbHit;
  else { step.errors.push('Unknown verb "' + verbTok + '"'); return step; }

  const rest = parts.slice(1);
  const tagRe = /^(Expected|Capture|Select|Label)\s*:\s*(.*)$/i;
  const plain = [];
  for (const p of rest) {
    const m = p.match(tagRe);
    if (!m) { plain.push(p); continue; }
    const tag = m[1].toLowerCase();
    const val = m[2].trim();
    if (tag === 'expected') step.expected = val;
    else if (tag === 'select') step.select = val;
    else if (tag === 'label') { if (/to confirm/i.test(val)) step.labelToConfirm = true; }
    else if (tag === 'capture') {
      const cm = val.match(/^\{([A-Za-z0-9_]+)\}\s*=\s*(.*)$/);
      if (cm) step.capture = { name: cm[1], what: cm[2].trim() };
      else step.errors.push('Capture must be {VAR}=<what>');
    }
  }
  step.target = parseTarget(step.verb, plain[0]);
  if (step.target.error) step.errors.push(step.target.error);
  const v = plain[1];
  step.value = v === undefined || v === '-' ? null : stripOuterQuotes(stripMd(v));
  if (/label:\s*to confirm/i.test(body)) step.labelToConfirm = true;
  if (step.verb !== 'Verify' && !step.expected) step.errors.push('Missing "Expected:" field');
  if (step.verb === 'Verify' && !step.isVerifyAll && /\ball\b/i.test(plain[0] || '')) step.isVerifyAll = true;

  const needsRole = ['Click', 'Hover over', 'Type', 'Clear', 'Select', 'Check', 'Uncheck', 'Scroll to'];
  if (needsRole.includes(step.verb) && (!step.target.role || step.target.role === 'page')) {
    step.errors.push(step.verb + ' needs an element target <role> "<text>"');
  }
  if (['Type', 'Select', 'Press key'].includes(step.verb) && step.value === null) {
    step.errors.push(step.verb + ' needs a value');
  }
  return step;
}

function parseCheckLine(letter, body) {
  const parts = splitFields(stripMd(body));
  const chk = { letter, text: parts[0] || '', expected: null, ac: null };
  for (const p of parts.slice(1)) {
    const m = p.match(/^Expected\s*:\s*(.*)$/i);
    if (m) chk.expected = m[1].trim();
    else if (/^AC[\w-]*/i.test(p)) chk.ac = p.trim();
  }
  if (!chk.expected) chk.expected = chk.text;
  return chk;
}

function parseRunbook(text) {
  const lines = String(text).split(/\r?\n/);
  const sections = splitSections(lines);
  const head = lines.slice(0, 40).join('\n');
  const rawTitle = stripMd((lines.find((l) => l.trim()) || '').replace(/^#+\s*/, ''));
  const titleParts = rawTitle.split('|').map((x) => x.trim()).filter(Boolean);
  const title = titleParts.length > 1 ? titleParts[titleParts.length - 1] : rawTitle;
  const tcMatch = head.match(/\b(TC-(?:HP|NEG|BVA|EDGE)-\d+)\b/i);
  const tcId = tcMatch ? tcMatch[1].toUpperCase() : 'TC-HP-01';
  const urlRe = (label) => new RegExp(label + '\\s*[:|]?\\s*\\**\\s*`?(https?:\\/\\/[^\\s|*`]+)', 'i');
  const envText = (sections.environment || []).join('\n') + '\n' + (sections.overview || []).join('\n') + '\n' + head;
  const baseUrl = (envText.match(urlRe('Base URL')) || [])[1] || null;
  const startUrl = (envText.match(urlRe('Start URL')) || [])[1] || null;
  const overviewText = (sections.overview || []).join('\n');
  const st = overviewText.match(/status\s*[:|]?\s*\**\s*(READY|BLOCKED[^\n|]*)/i);
  const runbookStatus = st ? stripMd(st[1]) : 'READY';

  const dataRows = parseTable(sections['test data'] || []).map((r) => {
    const sel = (r.selection || '').toLowerCase();
    const isAny = sel.startsWith('any');
    const ruleM = (r.selection || '').match(/\((.*)\)/);
    const stepsUsed = (r['used in step'] || '').match(/\d+/g) || [];
    return {
      item: r.item || '', value: r['exact value'] || '', selection: isAny ? 'any' : 'named',
      rule: ruleM ? ruleM[1] : null, steps: stepsUsed.map(Number)
    };
  });

  const stepLines = sections.steps || lines;
  const steps = [];
  const stepRe = /^\s*(?:[-*]\s*)?\**\s*(\d+)[.)]\**\s+(.+)$/;
  const checkRe = /^\s*(?:[-*]\s*)?\**\(?([a-z])[.)]\)?\**\s+(.+)$/;
  let lastVerifyAll = null;
  for (const line of stepLines) {
    const sm = line.match(stepRe);
    if (sm) {
      const step = parseStepBody(Number(sm[1]), stripMd(sm[2]));
      steps.push(step);
      lastVerifyAll = step.isVerifyAll ? step : null;
      continue;
    }
    if (lastVerifyAll) {
      const cm = line.match(checkRe);
      if (cm) lastVerifyAll.checks.push(parseCheckLine(cm[1].toLowerCase(), cm[2]));
    }
  }
  // Duplicate / out-of-order step numbers are a runbook defect.
  const seen = new Set();
  for (const s of steps) {
    if (seen.has(s.n)) s.errors.push('Duplicate step number ' + s.n);
    seen.add(s.n);
  }
  const va = steps.find((s) => s.isVerifyAll);
  if (va && va.checks.length === 0) va.errors.push('"Verify all" has no lettered checks');
  return { title, tcId, baseUrl, startUrl, runbookStatus, dataRows, steps };
}

// ---------------------------------------------------------------- placeholders
/**
 * Resolve {BASE_URL}, {SECRET:NAME}, {VAR}. Throws Blocked when something is missing.
 * Returns { text, usedVars:[name], usedSecrets:[value] }.
 */
function resolvePlaceholders(str, env, vars, targetUrl) {
  const usedVars = [];
  const usedSecrets = [];
  const text = String(str == null ? '' : str).replace(/\{(BASE_URL|SECRET:[A-Za-z0-9_]+|[A-Za-z0-9_]+)\}/g, (m, key) => {
    if (key === 'BASE_URL') return String(targetUrl || '').replace(/\/+$/, '');
    if (key.startsWith('SECRET:')) {
      const name = key.slice(7);
      const val = env[name];
      if (val === undefined || val === '') throw new Blocked('Secret variable ' + name + ' is not set');
      usedSecrets.push(val);
      return val;
    }
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      usedVars.push(key);
      return String(vars[key].value);
    }
    throw new Blocked('Variable {' + key + '} has not been captured');
  });
  return { text, usedVars, usedSecrets };
}

function listPlaceholderNames(str) {
  const out = { secrets: [], vars: [] };
  String(str || '').replace(/\{(BASE_URL|SECRET:[A-Za-z0-9_]+|[A-Za-z0-9_]+)\}/g, (m, key) => {
    if (key === 'BASE_URL') return m;
    if (key.startsWith('SECRET:')) out.secrets.push(key.slice(7)); else out.vars.push(key);
    return m;
  });
  return out;
}

// ---------------------------------------------------------------- Expected
/**
 * Parse an Expected string into machine-checkable parts.
 * Polarity: one polarity per Expected (negation words outside quotes invert text/URL/visibility checks).
 */
function parseExpected(expectedStr) {
  let work = stripMd(expectedStr || '');
  const noQuotes = work.replace(/"[^"]*"/g, ' ');
  const negate = /\b(not|no longer|disappears?|disappeared|absent|hidden|removed|gone|does not|doesn't)\b/i.test(noQuotes);
  const out = { negate, counts: [], valueChecks: [], urlChecks: [], titleChecks: [], roleChecks: [], textChecks: [] };

  const take = (re, fn) => {
    work = work.replace(re, (...args) => { fn(args); return ' '; });
  };
  take(new RegExp('\\bcount\\s+of\\s+(' + ROLE_RE + ')\\s+"([^"]+)"\\s*(?:is|=|equals|:)?\\s*(\\d+)', 'gi'),
    (a) => out.counts.push({ role: a[1].toLowerCase(), name: a[2], n: Number(a[3]) }));
  take(/\b(textbox|combobox)\s+"([^"]+)"\s+(?:has|with|shows?)\s+value\s+"([^"]*)"/gi,
    (a) => out.valueChecks.push({ role: a[1].toLowerCase(), name: a[2], value: a[3] }));
  take(/\b(?:page\s+)?title\s+(contains|includes|is|equals)\s+"([^"]+)"/gi,
    (a) => out.titleChecks.push({ op: /^(is|equals)$/i.test(a[1]) ? 'equals' : 'contains', value: a[2] }));
  take(/\burl\b\s*(?:path\s*)?(contains|includes|is|equals|starts with|ends with)?\s*(?:"([^"]+)"|(\S+))/gi,
    (a) => {
      const op = (a[1] || 'contains').toLowerCase();
      out.urlChecks.push({ op: op === 'includes' ? 'contains' : op === 'is' ? 'equals' : op, value: a[2] || a[3] });
    });
  take(new RegExp('\\b(' + ROLE_RE + ')\\s+"([^"]+)"(?:\\s+(?:is|are))?(?:\\s+(visible|enabled|disabled|checked|unchecked))?', 'gi'),
    (a) => out.roleChecks.push({ role: a[1].toLowerCase(), name: a[2], state: (a[3] || 'visible').toLowerCase() }));
  take(/"([^"]+)"/g, (a) => out.textChecks.push({ text: a[1] }));

  out.empty = !(out.counts.length || out.valueChecks.length || out.urlChecks.length ||
    out.titleChecks.length || out.roleChecks.length || out.textChecks.length);
  return out;
}

// ---------------------------------------------------------------- Select rules
/**
 * Supported (case-insensitive) phrases inside a Select rule:
 *   first | single price | in stock | nth N | containing "x" | without "x"
 * Other words are ignored as filler. A rule with none of these is unsupported.
 */
function parseSelectRule(rule) {
  const r = normQuotes(rule || '');
  const low = r.toLowerCase();
  const parsed = { first: false, singlePrice: false, inStock: false, nth: null, containing: [], without: [] };
  if (/\bfirst\b/.test(low)) parsed.first = true;
  if (/single[- ]price|one price|only one price/.test(low)) parsed.singlePrice = true;
  if (/in[- ]stock|available/.test(low)) parsed.inStock = true;
  const n = low.match(/\bnth[:\s]+(\d+)/);
  if (n) parsed.nth = Number(n[1]);
  for (const m of r.matchAll(/(?:containing|contains|with text)\s+"([^"]+)"/gi)) parsed.containing.push(m[1]);
  for (const m of r.matchAll(/(?:without|excluding|not containing)\s+"([^"]+)"/gi)) parsed.without.push(m[1]);
  parsed.supported = parsed.first || parsed.singlePrice || parsed.inStock || parsed.nth !== null ||
    parsed.containing.length > 0 || parsed.without.length > 0;
  return parsed;
}

/** cards: array of card text strings. Returns ordered candidate indexes satisfying the rule. */
function applyRule(cards, parsed) {
  const out = [];
  cards.forEach((txt, i) => {
    const t = String(txt || '');
    if (parsed.singlePrice && findAmounts(t).length !== 1) return;
    if (parsed.inStock && /out of stock|sold out|unavailable|notify me/i.test(t)) return;
    for (const c of parsed.containing) if (!t.toLowerCase().includes(c.toLowerCase())) return;
    for (const w of parsed.without) if (t.toLowerCase().includes(w.toLowerCase())) return;
    out.push(i);
  });
  if (parsed.nth !== null) return out[parsed.nth - 1] === undefined ? [] : [out[parsed.nth - 1]];
  return out;
}

function classifyCapture(what) {
  const w = String(what || '').toLowerCase();
  if (/price|amount|cost|total|subtotal/.test(w)) return 'price';
  if (/quantity|qty|count|number/.test(w)) return 'number';
  if (/\burl\b/.test(w)) return 'url';
  if (/\btitle\b.*page|page.*title/.test(w)) return 'title';
  if (/name|title|label|heading/.test(w)) return 'name';
  if (/value|input|entered/.test(w)) return 'value';
  return 'text';
}

function safeUrl(u) {
  try {
    const p = new URL(u);
    return p.host + p.pathname;
  } catch (e) { return String(u || '').split(/[?#]/)[0]; }
}

module.exports = {
  VERBS, ROLES, Blocked, normText, normQuotes, stripMd, stripOuterQuotes, findAmounts, firstAmount, parseAmount, containsAmount,
  parseRunbook, resolvePlaceholders, listPlaceholderNames, parseExpected, parseSelectRule, applyRule,
  classifyCapture, safeUrl
};
