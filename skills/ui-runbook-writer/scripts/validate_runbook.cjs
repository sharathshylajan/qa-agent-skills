#!/usr/bin/env node
const fs = require('fs');
const path = process.argv[2];
const out = {status:'INVALID', errors:[], stepCount:0, checkCount:0, dynamicTargetCount:0, toConfirmCount:0};
if (!path || !fs.existsSync(path)) {
  out.errors.push('Runbook file not found');
  console.log(JSON.stringify(out));
  process.exit(1);
}
const s = fs.readFileSync(path,'utf8');
const required = ['Overview','Environment','Accounts','Test data','Preconditions','Steps','AC traceability','Captured values','Overall result','To confirm/unblock'];
for (let i=0;i<required.length;i++) if (!new RegExp(`^##\\s+${i+1}\\.\\s+${required[i]}\\s*$`,'mi').test(s)) out.errors.push(`Missing section ${i+1}. ${required[i]}`);
const stepLines = s.split(/\r?\n/).filter(x=>/^\d+\.\s+/.test(x));
out.stepCount = stepLines.length;
out.checkCount = s.split(/\r?\n/).filter(x=>/^[a-z]\)\s+.+\|\s*Expected:\s*.+\|\s*AC\S+/i.test(x)).length;
out.dynamicTargetCount = (s.match(/"Any"/g)||[]).length;
out.toConfirmCount = (s.match(/Label:\s*TO CONFIRM/g)||[]).length;
if (!stepLines.length) out.errors.push('No numbered steps found');
if (stepLines.length && !/^1\.\s+Navigate to\s*\|/.test(stepLines[0])) out.errors.push('Step 1 must be Navigate to');
const verbs = ['Navigate to','Click','Type','Clear','Select','Check','Uncheck','Hover over','Scroll to','Press key','Wait for text','Verify','Switch to','Accept dialog','Dismiss dialog'];
const selects = [/^first$/,/^first visible$/,/^first enabled$/,/^first with submenu$/,/^first in stock$/,/^single price$/,/^in stock$/,/^nth \d+$/,/^containing ".+"$/,/^without ".+"$/,/^first containing ".+"$/,/^first without ".+"$/];
for (const line of stepLines) {
  const m=line.match(/^\d+\.\s+([^|]+)\|/);
  if (!m || !verbs.includes(m[1].trim())) out.errors.push(`Unsupported verb: ${line}`);
  const sm=line.match(/\|\s*Select:\s*(.+?)\s*$/);
  if (sm && !selects.some(r=>r.test(sm[1].trim()))) out.errors.push(`Unsupported Select rule: ${sm[1].trim()}`);
  if (!/\|\s*Expected:\s*\S/.test(line)) out.errors.push(`Missing Expected: ${line}`);
  if (/(css|xpath|#[A-Za-z]|\.[A-Za-z][A-Za-z0-9_-]*)/i.test(line)) out.errors.push(`Potential forbidden selector: ${line}`);
}
if (!/\d+\.\s+Verify all\s*$/mi.test(s)) out.errors.push('Final Verify all marker is missing');
if (/page loads|works|displays correctly/i.test(s)) out.errors.push('Vague Expected result found');
out.status = out.errors.length ? 'INVALID' : 'VALID';
console.log(JSON.stringify(out));
process.exit(out.errors.length ? 1 : 0);
