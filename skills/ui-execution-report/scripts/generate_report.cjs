#!/usr/bin/env node
'use strict';
/**
 * Validates execution_evidence.json (schema v2, one or more test cases) and writes exactly
 * QA_03_Execution_Report_<KEY>.html
 * Usage: node generate_report.cjs [--evidence execution_evidence.json] [--out .] [--jira KEY]
 *                                 [--runtime-json '<json from playwright-linux-runtime>']
 * Exit codes: 0 report written | 2 evidence invalid/inconsistent/unsafe (no report written)
 */
const fs = require('fs');
const path = require('path');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function die(reason, details) {
  console.log(JSON.stringify({ status: 'REPORT_NOT_GENERATED', reason, details: details || [] }));
  process.exit(2);
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const evidencePath = path.resolve(arg('evidence', 'execution_evidence.json'));
const outDir = path.resolve(arg('out', process.cwd()));
if (!fs.existsSync(evidencePath)) die('Evidence file not found', [evidencePath]);

let ev;
let raw;
try { raw = fs.readFileSync(evidencePath, 'utf8'); ev = JSON.parse(raw); } catch (e) { die('Evidence file is not valid JSON'); }

const jiraKey = arg('jira', process.env.JIRA_ISSUE_KEY || ev.jiraKey || '');
if (!/^[A-Za-z0-9._-]+$/.test(jiraKey)) die('Jira key missing or not filename-safe');

// ------------------------------------------------------------------ validation
const problems = [];
const RESULTS = ['PASS', 'FAIL', 'WARN', 'BLOCKED'];
const STATUSES = ['PASS', 'FAIL', 'WARN', 'BLOCKED', 'NOT RUN'];
if (ev.schemaVersion !== 2) problems.push('Unsupported or missing schemaVersion (expected 2)');
if (ev.jiraKey && ev.jiraKey !== jiraKey) problems.push('Evidence jiraKey (' + ev.jiraKey + ') does not match ' + jiraKey + ': evidence is not from this run');
const tcs = Array.isArray(ev.testCases) ? ev.testCases : [];
if (tcs.length === 0) problems.push('No test cases recorded');

const seenIds = new Set();
for (const tc of tcs) {
  const w = 'TC ' + tc.tcId + ': ';
  if (!tc.tcId) { problems.push('A test case has no id'); continue; }
  if (seenIds.has(tc.tcId)) problems.push(w + 'duplicate test case id');
  seenIds.add(tc.tcId);
  if (!RESULTS.includes(tc.result)) problems.push(w + 'invalid result');
  if (!Array.isArray(tc.steps) || tc.steps.length === 0) { problems.push(w + 'no steps recorded'); continue; }
  tc.steps.forEach((s, i) => {
    if (!STATUSES.includes(s.status)) problems.push(w + 'step ' + s.n + ' has invalid status');
    if (s.screenshot && s.status !== 'FAIL' && !(s.status === 'WARN' && /Add to (Bag|Cart|Basket) failed/i.test(s.actual || '')))
      problems.push(w + 'step ' + s.n + ' has a screenshot but is not a failed step');
    if (s.status === 'PASS' && /^Not run/i.test(s.actual || '')) problems.push(w + 'step ' + s.n + ' is PASS but its evidence says it was not run');
    if (i > 0 && s.n < tc.steps[i - 1].n) problems.push(w + 'steps are out of order at step ' + s.n);
  });
  const has = (st) => tc.steps.some((s) => s.status === st);
  const recovery = (tc.reattempts || []).some((r) => /transient/.test(r.outcome || '')) || tc.alternateItemUsed;
  if (tc.result === 'PASS' && tc.steps.some((s) => s.status !== 'PASS')) problems.push(w + 'result PASS but not every step passed');
  if (tc.result === 'PASS' && recovery) problems.push(w + 'result PASS but a re-attempt/alternate item was needed (should be WARN)');
  if (tc.result === 'FAIL' && !has('FAIL')) problems.push(w + 'result FAIL but no step failed');
  if (tc.result === 'WARN' && (has('FAIL') || has('BLOCKED'))) problems.push(w + 'result WARN but a step failed or is blocked');
  if (tc.result === 'WARN' && !has('WARN')) problems.push(w + 'result WARN but no step is marked WARN');
  if (tc.result === 'WARN' && !recovery) problems.push(w + 'result WARN but no re-attempt/alternate item is recorded');
  if (tc.result === 'BLOCKED' && !tc.blockedReason && !has('BLOCKED')) problems.push(w + 'result BLOCKED without a reason');
  if (tc.result === 'BLOCKED' && has('FAIL')) problems.push(w + 'result BLOCKED but a step failed (should be FAIL)');
}
// run completeness: PASS + FAIL + WARN + BLOCKED must equal the total
const counted = { PASS: 0, FAIL: 0, WARN: 0, BLOCKED: 0 };
tcs.forEach((t) => { if (counted[t.result] !== undefined) counted[t.result] += 1; });
const sumCounted = counted.PASS + counted.FAIL + counted.WARN + counted.BLOCKED;
if (!ev.summary || ev.summary.total !== tcs.length) problems.push('Summary total does not match the number of test cases');
else for (const k of RESULTS) if (ev.summary[k] !== counted[k]) problems.push('Summary count for ' + k + ' does not match the test cases');
if (sumCounted !== tcs.length) problems.push('PASS+FAIL+WARN+BLOCKED does not equal the total number of test cases');

// ------------------------------------------------------------------ secret safety
const secretNames = Object.keys(process.env).filter((k) => /PASS(WORD)?|TOKEN|SECRET|API_?KEY/i.test(k));
const secrets = secretNames.map((k) => process.env[k]).filter((v) => v && String(v).length >= 4);
const leaks = [];
for (const v of secrets) if (raw.includes(v)) leaks.push('A protected environment value appears in the evidence');
if (/Authorization\s*[:=]/i.test(raw)) leaks.push('Authorization header text present');
if (/\bBasic\s+[A-Za-z0-9+/]{16,}={0,2}/.test(raw)) leaks.push('Encoded Basic credential present');
if (/https?:\/\/[^/@\s"]+:[^/@\s"]+@/.test(raw)) leaks.push('Credential-bearing URL present');
if (/Set-Cookie|\bcookie\s*[:=]\s*\S{8,}/i.test(raw)) leaks.push('Cookie data present');
if (leaks.length) die('Evidence contains protected data; report not generated', Array.from(new Set(leaks)));
if (problems.length) die('Evidence is inconsistent', problems);

// ------------------------------------------------------------------ optional runtime summary
let runtime = null;
const rtArg = arg('runtime-json', '');
if (rtArg) {
  try {
    const r = JSON.parse(rtArg);
    runtime = {};
    ['status', 'browser', 'mode', 'authenticated', 'navigationSuccessful', 'attemptsUsed', 'httpStatus', 'finalUrlHost']
      .forEach((k) => { if (r[k] !== undefined) runtime[k] = r[k]; });
  } catch (e) { runtime = null; }
}

// ------------------------------------------------------------------ helpers
const dur = (ms) => (ms >= 1000 ? (ms / 1000).toFixed(1) + ' s' : (ms || 0) + ' ms');
const utc = (iso) => (iso ? new Date(iso).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC') : 'n/a');
const badge = (st, big) => '<span class="b ' + (big ? 'big ' : '') + String(st).replace(/\s/g, '').toLowerCase() + '">' + esc(st) + '</span>';
const kv = (k, v) => '<div class="kv">' + esc(k) + '<b>' + esc(v) + '</b></div>';
const none = (t) => '<p class="none">' + esc(t) + '</p>';
const table = (heads, rows, rowClass) => rows.length === 0 ? '' :
  '<div class="tw"><table><thead><tr>' + heads.map((h) => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
  rows.map((r, i) => '<tr class="' + (rowClass ? rowClass(i) : '') + '">' + r.map((c) => '<td>' + c + '</td>').join('') + '</tr>').join('') +
  '</tbody></table></div>';
const stepCounts = (tc) => {
  const c = { PASS: 0, FAIL: 0, WARN: 0, BLOCKED: 0, 'NOT RUN': 0 };
  tc.steps.forEach((s) => { c[s.status] += 1; });
  return c;
};
const anchor = (id) => 'tc-' + String(id).replace(/[^A-Za-z0-9_-]/g, '_');

function recommendationsFor(tc) {
  const r = [];
  for (const s of tc.steps.filter((x) => x.status === 'FAIL')) r.push('Investigate step ' + s.n + ' (' + s.verb + '): ' + String(s.actual || '').split(' | ')[0] + '. Review ' + (s.screenshot || 'the failure evidence') + ' and re-run once fixed.');
  const checks = tc.verifyAll ? tc.verifyAll.checks : [];
  for (const c of checks.filter((x) => x.status === 'FAIL')) r.push('Acceptance check ' + c.letter + (c.ac ? ' (' + c.ac + ')' : '') + ' failed: ' + String(c.actual || '').split(' | ')[0] + '.');
  if ((tc.bugs || []).some((b) => b.dataMismatch)) r.push('A captured value did not match on a later page. Treat as a data-consistency defect (price/name/quantity propagation).');
  if (tc.alternateItemUsed) r.push('Add to Bag failed on the first selected item but worked on an alternate. Investigate that item (stock state, variant, or script error).');
  if ((tc.reattempts || []).some((x) => /transient/.test(x.outcome || ''))) r.push('A step passed only on re-attempt. Review page load timing or third-party scripts for flakiness.');
  const reason = tc.blockedReason || '';
  if (/401|403|authentication/i.test(reason)) r.push('Navigation was rejected by authentication. Confirm the Basic Auth secrets are valid for this environment (not retried).');
  if (/does not match TARGET_URL/i.test(reason)) r.push('The runbook targets a different environment than TARGET_URL. Use the {BASE_URL} placeholder or regenerate the runbook.');
  if (tc.steps.some((s) => s.status === 'BLOCKED' && /TO CONFIRM/i.test(s.actual || ''))) r.push('A target label is still "TO CONFIRM". Add the exact label to the acceptance criteria or test data and regenerate the runbook.');
  if (tc.steps.some((s) => s.status === 'BLOCKED' && /machine-checkable|not machine-evaluable|grammar/i.test(s.actual || ''))) r.push('A step could not be machine-evaluated. Rewrite its Expected/Select field with quoted text, a URL fragment, or a count.');
  if (tc.steps.some((s) => s.status === 'BLOCKED' && /Ambiguous/i.test(s.actual || ''))) r.push('A target matched several elements. Make the label unique or add a Select rule.');
  if (/not found/i.test(reason) && /Runbook file/i.test(reason)) r.push('The runbook file was not found. Check the path you passed to the executor.');
  if (/Browser disconnected|Session creation failed|Browser unavailable|Runner error/i.test(reason)) r.push('The browser or runner failed. Re-run; if it repeats, check workspace resources and the runtime preparation output.');
  return r.map((x) => tc.tcId + ': ' + x);
}

// ------------------------------------------------------------------ sections
const total = tcs.length;
const hosts = Array.from(new Set(tcs.map((t) => t.baseUrlHost).filter(Boolean)));
const sc = ev.summary;

const resultRows = tcs.map((tc) => {
  const c = stepCounts(tc);
  const firstBad = tc.steps.find((s) => s.status === 'FAIL') || tc.steps.find((s) => s.status === 'BLOCKED');
  return [
    '<a href="#' + anchor(tc.tcId) + '">' + esc(tc.tcId) + '</a>', esc(tc.title || ''), badge(tc.result),
    c.PASS + ' pass, ' + c.FAIL + ' fail, ' + c.WARN + ' warn, ' + c.BLOCKED + ' blocked, ' + c['NOT RUN'] + ' not run',
    esc(dur(tc.durationMs)), firstBad ? 'Step ' + esc(firstBad.n) + ': ' + esc(String(firstBad.actual || '').split(' | ')[0].slice(0, 140)) : '-'
  ];
});

function tcDetail(tc) {
  const stepRows = tc.steps.map((s) => [
    esc(s.n), esc(s.verb) + (s.target ? '<br><code>' + esc(s.target) + '</code>' : ''), esc(s.expected || '-'),
    esc(s.actual || '-') + (s.reattempt ? '<br><small>Re-attempt: ' + esc(s.reattempt.mode) + ' &rarr; ' + esc(s.reattempt.outcome) + '</small>' : ''),
    badge(s.status), s.screenshot ? '<code>' + esc(s.screenshot) + '</code>' : '-', esc(dur(s.durationMs))
  ]);
  const checks = tc.verifyAll ? tc.verifyAll.checks : [];
  const checkRows = checks.map((c) => [esc(c.letter), esc(c.text), esc(c.ac || '-'), esc(c.expected), esc(c.actual), badge(c.status)]);
  const notes = (tc.notes || []).length ? '<p class="meta">Notes: ' + (tc.notes || []).map(esc).join('; ') + '</p>' : '';
  return '<details id="' + anchor(tc.tcId) + '"' + (tc.result === 'PASS' ? '' : ' open') + '><summary>' + esc(tc.tcId) + ' &mdash; ' + esc(tc.title || '') + ' ' + badge(tc.result) + '</summary>' +
    '<div class="meta">' + esc(tc.file || '') + ' &middot; ' + esc(tc.baseUrlHost || 'n/a') + ' &middot; ' + esc(utc(tc.startedAt)) + ' &middot; ' + esc(dur(tc.durationMs)) + '</div>' +
    (tc.blockedReason ? '<p>Reason: ' + esc(tc.blockedReason) + '</p>' : '') + notes +
    '<div class="card">' + table(['#', 'Action', 'Expected', 'Actual observed', 'Status', 'Failure screenshot', 'Time'], stepRows, (i) => (tc.steps[i].status === 'FAIL' ? 'row-fail' : tc.steps[i].status === 'BLOCKED' ? 'row-blocked' : '')) + '</div>' +
    (checks.length ? '<div class="card"><b>Final verification</b>' + table(['Check', 'Description', 'AC', 'Expected', 'Actual', 'Status'], checkRows, (i) => (checks[i].status === 'FAIL' ? 'row-fail' : '')) + '</div>' : '') +
    '</details>';
}

const capRows = [];
const itemRows = [];
const reRows = [];
const bugRows = [];
const blockedRows = [];
for (const tc of tcs) {
  for (const c of tc.captured || []) {
    capRows.push([esc(tc.tcId), '<code>{' + esc(c.name) + '}</code>', esc(c.kind), esc(c.value), 'Step ' + esc(c.setAtStep),
      (c.comparisons || []).length ? c.comparisons.map((x) => 'Step ' + esc(x.step) + ': ' + (x.matched ? badge('PASS') + ' matched' : badge('FAIL') + ' mismatch')).join('<br>') : '<span class="none">not compared</span>']);
  }
  for (const i of tc.itemsTried || []) itemRows.push([esc(tc.tcId), 'Step ' + esc(i.step), esc(i.name), i.price === null || i.price === undefined ? '-' : esc(i.price), esc(i.outcome)]);
  for (const r of tc.reattempts || []) reRows.push([esc(tc.tcId), 'Step ' + esc(r.step), esc(r.mode), esc(r.outcome)]);
  for (const b of tc.bugs || []) bugRows.push([esc(tc.tcId), 'Step ' + esc(b.step) + (b.check ? ' (' + esc(b.check) + ')' : ''), esc(b.expected || '-'), esc(b.actual || '-'),
    esc(b.severity || '-') + (b.dataMismatch ? ' &middot; data mismatch' : ''), b.screenshot ? '<code>' + esc(b.screenshot) + '</code>' : '-']);
  if (tc.result === 'BLOCKED') blockedRows.push([esc(tc.tcId), esc(tc.blockedReason || (tc.steps.find((s) => s.status === 'BLOCKED') || {}).actual || '-'),
    tc.steps.filter((s) => s.status === 'BLOCKED').map((s) => 'Step ' + esc(s.n)).join(', ') || '-']);
}

let recs = [];
tcs.forEach((tc) => { recs = recs.concat(recommendationsFor(tc)); });
if (counted.PASS === total) recs.push('No defects observed in this run. These runbooks do not cover scenarios beyond the steps they list.');
recs.push('Scope: ' + total + ' runbook(s) executed in headless Chromium. Expected results are verified against rendered page text, roles, URLs and counts only.');

const css = `
:root{--bg:#f6f7f9;--card:#fff;--ink:#1c2230;--mute:#5d6676;--line:#e2e5ea;--pass:#1b7f4d;--passbg:#e3f5ea;--fail:#b3261e;--failbg:#fde8e6;--warn:#8a5a00;--warnbg:#fff2d6;--blk:#3d4a63;--blkbg:#e6eaf2;--nr:#6b7280;--nrbg:#eef0f3;--link:#1d4ed8}
@media (prefers-color-scheme:dark){:root{--bg:#12151b;--card:#1a1f28;--ink:#e8ebf1;--mute:#9aa3b2;--line:#2b3240;--pass:#6fd3a0;--passbg:#14301f;--fail:#ff9d94;--failbg:#3a1a18;--warn:#f2c46d;--warnbg:#3a2d10;--blk:#aab6d0;--blkbg:#222a3a;--nr:#9aa3b2;--nrbg:#232934;--link:#8ab4ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}a{color:var(--link)}
.wrap{max-width:1150px;margin:0 auto;padding:24px 16px 56px}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 10px}
.meta{color:var(--mute);font-size:13px}.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:8px 0 12px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.kv{font-size:12px;color:var(--mute)}.kv b{display:block;color:var(--ink);font-size:14px;font-weight:600;word-break:break-word}
.score{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:10px}.score div{border-radius:8px;padding:10px;text-align:center;font-size:12px}.score b{display:block;font-size:22px}
.s-total{background:var(--nrbg);color:var(--ink)}.s-pass{background:var(--passbg);color:var(--pass)}.s-fail{background:var(--failbg);color:var(--fail)}.s-warn{background:var(--warnbg);color:var(--warn)}.s-blocked{background:var(--blkbg);color:var(--blk)}
.b{display:inline-block;padding:2px 9px;border-radius:99px;font-size:12px;font-weight:600;white-space:nowrap}.b.pass{background:var(--passbg);color:var(--pass)}.b.fail{background:var(--failbg);color:var(--fail)}.b.warn{background:var(--warnbg);color:var(--warn)}.b.blocked{background:var(--blkbg);color:var(--blk)}.b.notrun{background:var(--nrbg);color:var(--nr)}
.tw{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:640px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top;font-size:13px}th{color:var(--mute);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.03em}
tr.row-fail td{background:var(--failbg)}tr.row-blocked td{background:var(--blkbg)}code{font:12px ui-monospace,Menlo,Consolas,monospace;background:var(--nrbg);padding:1px 5px;border-radius:4px;word-break:break-word}
details{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin:10px 0}summary{cursor:pointer;font-weight:600;font-size:14px}
ul{margin:6px 0 0 18px;padding:0}li{margin:4px 0}.none{color:var(--mute);font-style:italic}.foot{margin-top:28px;color:var(--mute);font-size:12px}
@media(max-width:640px){.score{grid-template-columns:repeat(2,1fr)}}`;

const section = (title, inner) => '<h2>' + esc(title) + '</h2><div class="card">' + inner + '</div>';
const runtimeHtml = runtime
  ? '<div class="grid">' + Object.keys(runtime).map((k) => kv(k, runtime[k])).join('') + '</div>'
  : none('Runtime preparation summary was not provided to the report generator.');

const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>UI Test Execution Report ' + esc(jiraKey) + '</title><style>' + css + '</style></head><body><div class="wrap">' +
  '<h1>UI Test Execution Report &mdash; ' + esc(jiraKey) + '</h1>' +
  '<div class="meta">' + total + ' test case' + (total === 1 ? '' : 's') + ' executed</div>' +
  '<h2>Run</h2><div class="card"><div class="grid">' +
  kv('Base URL host' + (hosts.length > 1 ? 's' : ''), hosts.join(', ') || 'n/a') + kv('Browser', 'Chromium (' + (ev.mode || 'headless') + ')') +
  kv('Total test cases', total) + kv('Session mode', ev.sharedSession ? 'Shared session' : 'New session per test case') +
  kv('Started', utc(ev.startedAt)) + kv('Ended', utc(ev.endedAt)) + kv('Duration', dur(ev.durationMs)) + '</div>' +
  '<div class="score"><div class="s-total"><b>' + sc.total + '</b>Total</div><div class="s-pass"><b>' + sc.PASS + '</b>Passed</div>' +
  '<div class="s-fail"><b>' + sc.FAIL + '</b>Failed</div><div class="s-warn"><b>' + sc.WARN + '</b>Warned</div>' +
  '<div class="s-blocked"><b>' + sc.BLOCKED + '</b>Blocked</div></div></div>' +
  section('Runtime preparation', runtimeHtml) +
  '<h2>Results</h2><div class="card">' + table(['Test case', 'Title', 'Result', 'Steps', 'Time', 'First failure / block'], resultRows, (i) => (tcs[i].result === 'FAIL' ? 'row-fail' : tcs[i].result === 'BLOCKED' ? 'row-blocked' : '')) + '</div>' +
  '<h2>Test case detail</h2>' + tcs.map(tcDetail).join('') +
  section('Captured data', capRows.length ? table(['TC', 'Variable', 'Kind', 'Value', 'Captured at', 'Later comparisons'], capRows) : none('No values were captured.')) +
  section('Items tried (alternate item fallback)', itemRows.length ? table(['TC', 'Selected at', 'Item', 'Price', 'Outcome'], itemRows) : none('No rule-based item selection happened.')) +
  section('Re-attempts (transient)', reRows.length ? table(['TC', 'Step', 'Mode', 'Outcome'], reRows) : none('None.')) +
  section('Bug findings', bugRows.length ? table(['TC', 'Where', 'Expected', 'Actual', 'Severity', 'Screenshot'], bugRows) : none('No defects recorded.')) +
  section('Blocked test cases', blockedRows.length ? table(['TC', 'Reason', 'Blocked steps'], blockedRows) : none('None.')) +
  section('Recommendations', '<ul>' + recs.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>') +
  '<div class="foot">Generated from execution_evidence.json. Contains sanitized current-run evidence only: no credentials, tokens, cookies or environment values.</div>' +
  '</div></body></html>';

for (const v of secrets) if (html.includes(v)) die('Generated report would contain a protected value; not written');

fs.mkdirSync(outDir, { recursive: true });
const reportName = 'QA_03_Execution_Report_' + jiraKey + '.html';
const reportPath = path.join(outDir, reportName);
fs.writeFileSync(reportPath, html);
try {
  const back = fs.readFileSync(reportPath, 'utf8');
  if (back.length < 500 || !back.includes('UI Test Execution Report')) throw new Error('unreadable');
} catch (e) { die('Report was written but could not be verified'); }

console.log(JSON.stringify({ status: 'REPORT_GENERATED', report: reportName, summary: sc }));
