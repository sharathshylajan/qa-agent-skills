---
name: ui-execution-report
description: Validate execution_evidence.json from a UI test run (one or many test cases) and generate exactly one self-contained, secret-free HTML report named QA_03_Execution_Report_<JIRA_ISSUE_KEY>.html with run summary, scorecard, results table, per-test-case step detail, captured data, items tried, re-attempts, bug findings, blocked test cases and recommendations. Use after ui-test-execution has written execution_evidence.json, whenever a UI test execution report is requested, even if test cases failed, were blocked, or the run is partial. Never write the HTML by hand and never use it to create any other report format.
---

# UI Execution Report

Turns the evidence from `ui-test-execution` into one HTML report covering every test case that was executed. The generator is deterministic: it validates the evidence first and refuses to write a report from evidence that is inconsistent, from another run, or that contains protected data.

## Run

```bash
node <skill-dir>/scripts/generate_report.cjs \
  --evidence execution_evidence.json --out . \
  --runtime-json '<the final JSON object printed by playwright-linux-runtime>'
```

- `JIRA_ISSUE_KEY` is read from the environment (or `--jira`). The output is exactly `QA_03_Execution_Report_<KEY>.html` in `--out` (the current execution workspace). No extra directory is created.
- `--runtime-json` is optional. Only these fields are accepted and shown: `status, browser, mode, authenticated, navigationSuccessful, attemptsUsed, httpStatus, finalUrlHost`. Anything else is dropped. If omitted, the report says the runtime summary was not provided.
- stdout is one JSON line: `status:"REPORT_GENERATED"` (exit 0), or `status:"REPORT_NOT_GENERATED"` with `reason` and `details` (exit 2) when validation fails.

If the generator exits 2, do not write a report yourself and do not edit the evidence to make it pass. Tell the user the reason and stop. A run with failed, blocked or partial test cases is valid and does produce a report.

## What is validated

- Evidence JSON is valid, `schemaVersion` is 2, and `jiraKey` matches the current run.
- Test case ids are unique, and `summary` equals the actual counts, with PASS+FAIL+WARN+BLOCKED equal to the total number of test cases (every listed test case reached a final status).
- Each test case result agrees with its steps: PASS needs every step PASS and no recovery; FAIL needs a failed step; WARN needs a WARN step, a recorded re-attempt or alternate item, and no FAIL/BLOCKED; BLOCKED needs a reason and no FAIL.
- Steps are in order, statuses are valid, no PASS step claims it was not run, and screenshots appear only on failed steps (or the WARN step that recovered via an alternate item).
- Protected data: any protected environment value (names matching PASS/TOKEN/SECRET/API_KEY), Authorization or encoded Basic text, credential-bearing URLs and cookie data cause refusal. The finished HTML is checked again before it is written.

## Report contents

Run metadata (base URL host(s), headless Chromium, total test cases, session mode, start/end, duration); scorecard (total, passed, failed, warned, blocked); runtime preparation; color-coded results table for all test cases with links to detail; per-test-case detail (step table with actual observations, final verification checks with AC, notes; non-passing cases are expanded); captured data with later comparisons; items tried; re-attempts; bug findings; blocked test cases with reasons; recommendations derived from the evidence. Screenshot file names appear only for failed steps.

## After generating

Confirm the single `.html` file exists and is readable (the generator already checks), then reply with the path and the summary counts. Do not create HTML, Markdown or PDF variants and do not copy screenshots into the report.
