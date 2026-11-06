---
name: ui-runbook-writer
description: Write exactly one machine-executable UI runbook file (happy-path-run.md) for one test case, in the step grammar that the ui-test-execution runner parses, and validate it with the bundled validator before finishing. Use whenever a runbook, happy-path-run.md or executable test case must be created from a user story, acceptance criteria or a Gherkin scenario, after the test cases are designed. Never use it to design test cases, to write Gherkin or HTML reports, or to execute anything in a browser.
---

# UI Runbook Writer

Writes ONE runbook file that `ui-test-execution` can run without guessing. The only code allowed is the bundled `scripts/validate_runbook.cjs`. No browser is opened, nothing is executed, nothing is claimed as verified.

## Inputs (from the calling prompt)

- Suite ID, Jira key, Base URL, Start URL
- The runbook test case: ID, label, priority, and its Gherkin Scenario
- AC covered and AC not covered by this test case
- Test data (non-secret values, each marked `named` or `any (<rule>)`)
- Accounts: role, username if given, password VARIABLE NAME only
- Preconditions, restrictions, and the test case status (READY or BLOCKED with reason)

If the Start URL or the Scenario is missing, say what is missing and stop. Do not invent data.

## Output

`happy-path-run.md` in `src/<jiraKey>/`, written with one Write call. Self-contained: never reference test-cases.md.

## File structure

Title line: `Suite | TC ID | label`, then these numbered sections as `## N. Name` headings, in order:

1. Overview: story key and summary | AC covered | AC not covered | goal (1 line) | status READY or BLOCKED (reason)
2. Environment: Base URL, Start URL, Chromium (headless), restrictions, "Basic Auth: handled by runtime, not a step"
3. Accounts: Role | User | Password variable | Source | Used in step. Or "No login required". Never a password value.
4. Test data: Item | Exact value | Selection | Used in step | Source. Selection is `named` (the runner never substitutes it) or `any (<rule>)`.
5. Preconditions: each marked Confirmed or To be confirmed by executor
6. Steps
7. AC traceability: each check letter of the Verify all step maps to an AC id
8. Captured values: {VAR} | set at step | used at step (or None)
9. Overall result: [ ] PASS [ ] FAIL [ ] BLOCKED | Executed by/date: ____
10. To confirm/unblock: every NOT PROVIDED or Label: TO CONFIRM item and what unblocks it

If the status is BLOCKED, still write the full file.

## Step grammar (section 6)

One step per line, fields separated by ` | ` in this fixed order:

```
N. <Verb> | <target> | <value or -> | Expected: <check> | Capture: {VAR}=<what> | Select: <rule>
```

`Capture` and `Select` are optional. Short bold group labels may sit between steps.

**Verbs (only these):** Navigate to, Click, Type, Clear, Select, Check, Uncheck, Hover over, Scroll to, Press key, Wait for text, Verify, Switch to, Accept dialog, Dismiss dialog.

**Target:** `<role> "<exact text>"` with roles link, button, textbox, checkbox, combobox, menuitem, tab, heading, text, dialog; or `page`. For Navigate to the target is the URL, written `{BASE_URL}` or `{BASE_URL}/path`. Never CSS, XPath, IDs or positions.

**Value:** a quoted literal, `{SECRET:NAME}` for secrets, `{VAR}` for an earlier captured value, or `-` when none applies.

**Rules**
1. Step 1 is Navigate to the Start URL. Login steps follow only if the scenario needs a login. No cookie, popup or Basic Auth steps.
2. One action per step. Hover menus: Hover over, then Click.
3. Use only exact labels, messages and URLs that were given. If the exact text is unknown, write the target as `<role> "Label: TO CONFIRM"` and record that step's purpose in section 10 (for example "Step 4: button that adds the selected product to the bag"). Never invent text. The runner marks such a step BLOCKED until the label is supplied.
4. When several elements could match, add a `Select:` rule. Supported phrases: `first`, `single price`, `in stock`, `nth N`, `containing "x"`, `without "x"`. Any other rule blocks the step.
5. Checkout and order: stop before placing an order unless payment is explicitly allowed.
6. The last step is `N. Verify all`, followed by lettered checks, one per line: `a) <description> | Expected: <check> | AC<n>`. Each check is verified and recorded separately.

## Writing Expected results

Every Expected must be one of the forms the runner can check. This is the rule that decides whether a step runs or is BLOCKED.

| Write | Checked as |
|---|---|
| `URL contains /bag`, `URL is {BASE_URL}/bag`, `URL starts with ...`, `URL ends with ...` | current URL |
| `title contains "Bag"` | page title |
| `heading "Bag" visible`, `button "Pay" enabled`, `checkbox "Gift" checked` | role and name state (visible, enabled, disabled, checked, unchecked) |
| `text "Added to bag" visible` or just `"Added to bag"` | text on the page |
| `count of button "Remove" is 2` | number of visible matches |
| `textbox "Email" has value "a@b.com"` | input value |
| `text "{PRICE}" visible` | numeric compare if {PRICE} was captured as a price |

- Negation words outside quotes (`not visible`, `no longer`, `hidden`) invert the check. Use one polarity per Expected; split mixed cases into separate lettered checks.
- Forbidden: sentences such as "page loads", "works", "branding visible", "displays correctly". The runner marks them BLOCKED.
- Quote only text that was given in the inputs. When the exact text is not given, use a form that needs no invented text: for Navigate to use `URL contains <host or path taken from the Start URL>`; for other steps use Label: TO CONFIRM.
- A logo or image can be checked only through its accessible name, for example `link "<name>" visible`, and only if that name was given.

## Capture

`Capture: {VAR}=<what>` goes on the step that reads the value. The first matching word in `<what>` picks the kind: price, amount or total (currency); quantity, count or number; url; name, title, label or heading (first line of text); value (input value); otherwise text. Click steps read the value BEFORE the click. Later steps compare using `{VAR}`.

## Secrets

Never write a password, token or key value into the file. Use `{SECRET:NAME}`. Usernames may be written if given. HTTP Basic Auth is handled by the runtime and never appears as an account, data item or step.

## Workflow

1. Write `happy-path-run.md` with the structure above.
2. Run `node <skill-dir>/scripts/validate_runbook.cjs src/<jiraKey>/happy-path-run.md`.
3. Read the one JSON line it prints. If `status` is `INVALID`, fix every listed error in the file (Edit, or Write again) and run the validator again.
4. Stop after at most 3 validator runs. If still INVALID, keep the file, report the remaining errors, and set the reply status to INVALID. Never change the validator or skip it.
5. Return: file path, step count, check count, validator status, and the number of Label: TO CONFIRM items.

## Known limits

- The validator mirrors the grammar and the Expected table above. It is not the runner's own parser, so a VALID file can still be BLOCKED at run time for a reason only the live page shows (for example several matching elements, or a label that differs from the page).
- Without a browser the writer cannot know real labels. Every unknown label is listed in section 10 and the run will block that step until the label is supplied.
