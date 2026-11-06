---
name: ui-test-execution
description: Execute any number of UI test runbooks (.md files, one test case per file, steps like "Click | button "Add to Bag" | - | Expected: ...") in headless Playwright Chromium sessions that already have HTTP Basic Auth configured, using a bundled deterministic runner, and write one sanitized execution_evidence.json plus failure-only screenshots. Use whenever the user names one or more runbook/test-case .md files to run, validate, or re-run against a web app, after playwright-linux-runtime has returned SUCCESS. Use this skill even for "run these test cases", "execute TC-HP-01 and TC-NEG-02", or "validate the UI flow in this md". The user chooses which files and how many. Do not use it to design tests or for accessibility scans.
---

# UI Test Execution

Runs the runbook files the user lists, one test case per file, in the order given. A fixed runner does the work: the agent does not write Playwright code. All PASS / FAIL / WARN / BLOCKED judgements come from what the browser actually shows.

## Dependencies

1. `playwright-linux-runtime` must have returned `status=SUCCESS`, `authenticated=true`, `navigationSuccessful=true` first. This skill only calls its `createAuthenticatedSession()`; it never installs or launches Playwright/Chromium on its own.
2. Run from the workspace root where the runtime skill installed Playwright (same working directory).
3. The runner finds the runtime module via `RUNTIME_SKILL_DIR`, else `PLAYWRIGHT_RUNTIME_MODULE`, else the sibling folder `../playwright-linux-runtime`, else `./skills/playwright-linux-runtime`.

## Inputs

Protected environment variables (never printed): `TARGET_URL`, `BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD`, `JIRA_ISSUE_KEY`. Any `{SECRET:NAME}` in a runbook is read from the variable `NAME`; if unset, only that step is BLOCKED.

The runbook files come from the user: explicit paths, one test case per file. Never choose, add, skip, merge or reorder files yourself. A directory is not accepted; list the files.

## Run

```bash
node <skill-dir>/scripts/run_ui_tests.cjs \
  --runbook src/STORE-101/tc-hp-01.md --runbook src/STORE-101/tc-neg-01.md \
  --out .
# equivalent list form:  --runbooks a.md,b.md,c.md
# optional: --shared-session   (keep one browser session across the listed test cases)
```

- One run covers every listed file, sequentially, without stopping. Each test case is attempted independently: a failure or block in one never decides the outcome of another.
- Default is a NEW authenticated session per test case (cookies, storage, login and cart discarded). Use `--shared-session` only when the user says test cases depend on each other's state (for example "keep the cart from the previous TC"); each such test case is noted "shared session". Captured `{VAR}` values never carry between test cases.
- Per-test-case progress lines go to stderr as JSON. stdout ends with ONE JSON line: `{status:"DONE", evidence, summary:{total,PASS,FAIL,WARN,BLOCKED}, testCases:[{tcId,result,blockedReason}]}`.
- Exit code 2 with `status:"NOT_STARTED"` means an input is missing or invalid (no runbooks listed, a directory given, the same file twice, missing or credential-bearing `TARGET_URL`, missing Basic Auth variable). Report the reason (names only, never values) and stop.
- A runbook file that does not exist becomes a BLOCKED test case ("Runbook file not found"); the others still run. Duplicate TC ids are renamed `TC-X-2` and noted.

Run the runner once. Do not edit runbooks, add steps, change expected values, re-run to get a better result, or write your own scripts.

## What the runner does for each test case

**Pre-checks (no browser):** the runbook's Base URL host must equal the `TARGET_URL` host (else BLOCKED); a runbook whose own status is BLOCKED is not executed; `{BASE_URL}` is replaced by `TARGET_URL`.

**Per step:** find the element, act, then poll the Expected result for up to 15 seconds. PASS only if the Expected result is actually present.

**Blocked, never guessed:** step does not match the grammar; target is `Label: TO CONFIRM`; several visible elements match and there is no `Select:` rule; Expected is not machine-checkable; unsupported `Select:` rule; missing secret or captured variable; HTTP 401/403 on navigation (not retried); browser disconnect. A failed or blocked step ends that test case; its remaining steps are NOT RUN; the next test case starts.

**Transient handling:** a failed step gets ONE re-attempt. If the first try had no visible effect, the page is reloaded, the in-page steps since the last URL change are replayed, and the step is tried once more; otherwise it is repeated. Passing on re-attempt = step WARN (test case at best WARN). Failing twice = FAIL with one screenshot `<TC-ID>_step<N>_FAIL.png`. `Verify` steps are not re-attempted (their 15-second poll is the wait).

**Alternate item fallback** (Click on "Add to Bag/Cart/Basket" only): if it still fails and the item is not named (`Selection: any` in the data table and an earlier step has a `Select:` rule), the runner returns to the page before the selection step and tries the next candidate satisfying the same rule, at most 2. Success = WARN with the original failure recorded as a bug and every item tried listed. `Selection: named` items are never substituted.

**Verify all:** every lettered check is evaluated and recorded separately even when one fails; one screenshot if any fails. Skipped (NOT RUN) when an earlier step failed.

**Browser loss:** if a session cannot be created, that test case is BLOCKED; after two consecutive failures the remaining test cases are BLOCKED ("Browser unavailable"). A disconnect mid-test blocks that test case and the next one gets a fresh session.

**Housekeeping:** cookie/consent/promo banners are cleared best-effort and noted; dialogs via `Accept dialog` / `Dismiss dialog` steps; `Switch to` changes tabs.

## Runbook step grammar

```
N. <Verb> | <target> | <value or -> | Expected: <check> | Capture: {VAR}=<what> | Select: <rule>
```

Verbs: Navigate to, Click, Type, Clear, Select, Check, Uncheck, Hover over, Scroll to, Press key, Wait for text, Verify, Switch to, Accept dialog, Dismiss dialog. The last step is `Verify all` followed by lettered checks: `a) <description> | Expected: <check> | AC1`.

Targets: `<role> "<exact text>"` with roles link, button, textbox, checkbox, combobox, menuitem, tab, heading, text, dialog; or `page`; for Navigate to, the URL (`{BASE_URL}/path`). Elements are found by role and accessible name or label (exact first, then substring). Never by position, CSS or XPath.

Values: quoted literal, `{SECRET:NAME}`, or `{VAR}`; `-` for none.

### Expected: what can be checked

| Write | Checked as |
|---|---|
| `URL contains /bag`, `URL is {BASE_URL}/bag`, `URL starts with`, `ends with` | current URL |
| `title contains "Bag"` | page title |
| `heading "Bag" visible`, `button "Pay" enabled`, `checkbox "Gift" checked` | role + name state (visible, enabled, disabled, checked, unchecked) |
| `text "Added to bag" visible` or just `"Added to bag"` | text in rendered page (whitespace-normalized; falls back to case-insensitive and says so) |
| `count of button "Remove" is 2` | number of visible matches |
| `textbox "Email" has value "a@b.com"` | input value |
| `text "{PRICE}" visible` | if {PRICE} was captured as a price: numeric compare ($78 = $78.00) |

Negation words outside quotes (`not visible`, `no longer`, `disappears`, `hidden`) invert text/URL/visibility checks; one polarity per Expected, so use separate lettered checks for mixed cases. An Expected with no quoted text, URL, count or role (for example "page works") is BLOCKED as not machine-checkable.

### Capture kinds

`Capture: {VAR}=<what>`: the first matching word in `<what>` picks the kind: price/amount/total (currency amount), quantity/count/number, url, name/title/label/heading (first line of text), value (input value), otherwise text. Click steps read the value BEFORE the click. A later `{VAR}` that fails to match is a data-consistency FAIL and a BUG.

### Select rules

Supported phrases (other words are filler): `first`, `single price`, `in stock`, `nth N`, `containing "x"`, `without "x"`. A rule with none of these blocks the step. For steps with a rule the name matches as a substring and candidates are filtered and ordered by the rule.

## Evidence file

`execution_evidence.json`, written once after every test case has a final status (schemaVersion 2): `jiraKey, browser, mode, sharedSession, startedAt, endedAt, durationMs, summary{total,PASS,FAIL,WARN,BLOCKED}, testCases[], limitations[]`. Each test case: `tcId, title, file, baseUrlHost, result, blockedReason, steps[], verifyAll{checks[]}, captured[], itemsTried[], reattempts[], alternateItemUsed, bugs[], notes[]`.

Step status: PASS, WARN (needed re-attempt or alternate item), FAIL, BLOCKED, NOT RUN. Test case result: FAIL if any step failed; else BLOCKED if any blocked; else WARN if recovery was needed; else PASS. The run is complete when PASS+FAIL+WARN+BLOCKED equals the number of listed test cases.

Every string is scrubbed of the Basic Auth password and any resolved secret. URLs are stored as host + path only. Passwords are never written: Type steps record the `{SECRET:NAME}` template. Screenshots go in `screenshots/` and exist only for failed steps.

## Known limits

- Expected results are verified from rendered text, roles, URLs and counts; content shown only as an image or canvas is not verified.
- Replaying in-page steps during a re-attempt could repeat a server-side action done earlier in the same page state. If a count check fails right after a re-attempt, review that step.
- Verified against a local Basic-Auth test store covering: multiple runbooks in one run, PASS/FAIL/BLOCKED mixes, a missing file, duplicate ids, session isolation versus `--shared-session`, role-based click, rule-based item selection, price capture and numeric compare, alternate item fallback, transient re-attempt, named-item no-substitution, failing checks, 401, host mismatch, and browser-unavailable. Typing with secrets, dropdown selection, dialogs, tab switching and hover use the same code paths but were not exercised.
