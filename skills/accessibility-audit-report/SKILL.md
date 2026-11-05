---
name: accessibility-audit-report
description: Validate sanitized current-run accessibility plan and evidence and generate exactly one consolidated Jira-keyed Markdown audit report with executive summary, browser and authentication evidence, page results, axe findings, supplemental review, coverage, scoring, blockers, and limitations. Never run browsers, rerun axe, modify Jira, generate HTML, or invent evidence.
---
# Accessibility Audit Report
Use only current-run `accessibility_execution_plan.json` and `accessibility_audit_evidence.json`. Validate readability, sanitization, counts, scanned-page definition, severity/node totals, score, coverage, and actual timings. Never estimate or invent evidence.
## Output
Generate exactly `{jira_issue_key}_Accessibility_Audit_Report.md` in `REPORT_OUTPUT_DIRECTORY`. No HTML or additional report. Do not modify Jira.
## Required sections
1. Executive Summary: Jira key/summary; overall status; health score/grade/status; pages requested/eligible/scanned; blocked/excluded; coverage statement; actual findings; technical blockers separate from violations.
2. Browser Environment: `playwright-linux-runtime`, Linux, Playwright-managed headless Chromium, only evidenced setup/install/dependency/recovery attempts, safe versions, failure classification, sanitized error. Never mention MCP or infer unavailable details.
3. Authentication by Origin: declared/observed, discrepancy, type, strategy, setup/credential attempts, status, HTTP result, failure. Success wording: `HTTP Basic Authentication configured through the playwright-linux-runtime Skill using Playwright BrowserContext httpCredentials.`
4. Page Results: requested URL/source/validation/origin/auth, final URL/title/status, navigation/axe attempts and durations, severities, affected elements, page score/grade/status/blocker.
5. Confirmed Findings: only actual axe violations with ID/name, impact, tags, nodes, target, evidence, user impact, remediation. Never convert blockers/incomplete items.
6. Supplemental Review: inventory, keyboard, tree, reflow, manual-review candidates, checks not performed.
7. Coverage Table columns: Page/state, Navigation attempts/time, Axe attempts/time, Critical, Serious, Moderate, Minor, Unknown, Score, Status; include all excluded/blocked/auth/browser/safety gaps.
8. Limitations: axe does not establish WCAG conformance; gaps remain; automation does not replace manual testing; screen reader, native 200% zoom, extra states, cross-page journeys not tested unless evidenced.
## Status and security
Overall `Pass|Partial Pass|Needs Remediation|High Risk|Blocked`; never Pass with zero scanned pages. Zero scans: null score/grade and `No accessibility findings could be determined because no eligible application page completed an axe scan.` Use specific auth/browser blocked wording from evidence. Never claim WCAG conformance.
Never include username, password, Authorization, Proxy-Authorization, encoded values, BrowserContext credentials, cookies, tokens, session IDs, runtime secrets, customer/payment data, or unsanitized logs. If exposed, redact and state only: `Credential material was exposed in execution logs. Credential rotation is required outside this audit.` Verify the exact file exists, is readable, and sanitized.
