---
name: ui-runbook-writer
description: write exactly one machine-executable ui runbook file (happy-path-run.md) for one test case, using deterministic labels when required and smart live-page discovery when the scenario permits any suitable item. validate the runbook with the bundled validator. use for runbooks created from user stories, acceptance criteria, or gherkin after test design. never use for test design, gherkin authoring, html reporting, or browser execution.
---

# UI Runbook Writer

Write one `happy-path-run.md` that the `ui-test-execution` runner can execute without requiring the user to provide every incidental UI label. Do not open a browser or claim execution.

## Inputs

Use the calling prompt's suite ID, Jira key, Base URL, Start URL, test case ID, label, priority, Gherkin Scenario, AC coverage, test data, accounts, preconditions, restrictions, and status.

If Start URL or Scenario is missing, report what is missing and stop. Do not invent business-critical data.

## Output

Write `src/<jiraKey>/happy-path-run.md` in one Write call. Keep it self-contained.

## Required sections

Use these numbered `## N. Name` headings in order:

1. Overview
2. Environment
3. Accounts
4. Test data
5. Preconditions
6. Steps
7. AC traceability
8. Captured values
9. Overall result
10. To confirm/unblock

Include the same fields supplied by the caller. Never include secret values. If status is BLOCKED, still write the complete file.

## Smart target policy

Classify each referenced UI item before writing a step.

### Exact target required

Use an exact accessible label when the scenario, AC, named test data, legal text, product identity, account role, or expected business outcome depends on that specific item.

If that exact label was not supplied, write `<role> "Label: TO CONFIRM"`, add it to section 10, and mark the runbook BLOCKED.

Examples: a named category, a particular product, `Sign in`, a specified filter, a required error message, or a specific checkout action.

### Any suitable target allowed

Do not ask the user for a label when the scenario is generic, such as “a category,” “any product,” “a result,” “one filter,” or “a second-level link.” Generate a dynamic target using `Select:` and let the executor inspect the live page.

Prefer deterministic discovery rules in this order:

1. `first with submenu`
2. `first enabled`
3. `first visible`
4. `first in stock`
5. `first containing "x"`
6. `first without "x"`
7. `nth N`

Record the discovered label with `Capture: {VAR}=label` when later steps or the report need it.

The executor must report the selected accessible label and selection rule. A dynamic step is BLOCKED only when no matching live element exists, the result is ambiguous after applying the rule, or the required relationship cannot be established.

Never use dynamic discovery to bypass an exact requirement.

## Step grammar

Write one action per line, fields separated by `|`:

`N. <Verb> | <target> | <value or -> | Expected: <check> | Capture: {VAR}=<what> | Select: <rule>`

`Capture` and `Select` are optional.

Allowed verbs: Navigate to, Click, Type, Clear, Select, Check, Uncheck, Hover over, Scroll to, Press key, Wait for text, Verify, Switch to, Accept dialog, Dismiss dialog.

Targets:

- Exact: `<role> "<exact text>"`
- Dynamic: `<role> "Any"`
- Scoped dynamic: `<role> "Any" in {CONTAINER}`
- Page: `page`
- Navigation: `{BASE_URL}` or `{BASE_URL}/path`

Allowed roles: link, button, textbox, checkbox, combobox, menuitem, tab, heading, text, dialog, navigation, region.

Do not use CSS, XPath, IDs, DOM positions, or visual coordinates.

### Supported selection rules

- `first`
- `first visible`
- `first enabled`
- `first with submenu`
- `first in stock`
- `single price`
- `in stock`
- `nth N`
- `containing "x"`
- `without "x"`
- `first containing "x"`
- `first without "x"`

`with submenu` means the matching element has an accessibility relationship or live interaction that exposes a menu, navigation, region, or visible descendant links after hover/click. The executor may use `aria-controls`, `aria-expanded`, accessible ownership, or the newly visible related container. It must not guess from styling alone.

### General rules

- Step 1 must navigate to Start URL.
- Add login steps only when required. Do not add cookie, popup, or Basic Auth steps.
- For hover menus, hover first, then verify the related container or interact with an item inside it.
- Use exact labels supplied by the input. Use dynamic targets only under the smart target policy.
- Stop before placing an order unless payment is explicitly allowed.
- The final step is `N. Verify all`, followed by lettered checks: `a) <description> | Expected: <check> | AC<n>`.

## Executable expected results

Supported forms:

- `URL contains /bag`, `URL is {BASE_URL}/bag`, `URL starts with ...`, `URL ends with ...`
- `title contains "Bag"`
- `heading "Bag" visible`, `button "Pay" enabled`, `checkbox "Gift" checked`
- `text "Added to bag" visible`
- `count of button "Remove" is 2`
- `count of link "Any" in {FLYOUT} is greater than 0`
- `count of <role> "Any" is at least N`
- `textbox "Email" has value "a@b.com"`
- `text "{PRICE}" visible`
- `{CONTAINER} visible`
- `{VAR} is not empty`

Negation outside quotes reverses the check. Use one polarity per Expected. Do not use vague checks such as “page loads,” “works,” or “displays correctly.”

## Dynamic containers and capture

Capture a discovered element on the action that identifies it:

- `Capture: {CATEGORY}=label`
- `Capture: {FLYOUT}=related container`
- `Capture: {PRODUCT}=name`

Supported capture kinds: price, amount, total, quantity, count, number, url, name, title, label, heading, value, text, related container.

A `related container` capture must resolve through accessibility metadata or the uniquely newly visible container caused by the preceding action. If it cannot be resolved uniquely, block the step and state why.

### Example: generic desktop flyout

```text
1. Navigate to | {BASE_URL} | - | Expected: URL contains <host-from-start-url>
2. Hover over | menuitem "Any" | - | Expected: {FLYOUT} visible | Capture: {CATEGORY}=label | Select: first with submenu
3. Verify | region "Any" | - | Expected: {FLYOUT} visible | Capture: {FLYOUT}=related container | Select: first visible
4. Verify all
a) selected category captured | Expected: {CATEGORY} is not empty | AC1
b) flyout visible | Expected: {FLYOUT} visible | AC1
c) second-level categories present | Expected: count of link "Any" in {FLYOUT} is greater than 0 | AC1
```

The writer may adjust `region` to `navigation` or `dialog` if the input specifies that semantic role. Do not invent a label.

## Secrets

Use `{SECRET:NAME}`. Never write passwords, tokens, or keys. Basic Auth is handled by runtime and never appears as a step.

## Validator workflow

1. Write the runbook.
2. Run `node <skill-dir>/scripts/validate_runbook.cjs src/<jiraKey>/happy-path-run.md`.
3. Read its single JSON line.
4. If INVALID, fix every error and rerun, up to three total runs.
5. Never modify or skip the validator.
6. Return file path, step count, check count, validator status, dynamic-target count, and `Label: TO CONFIRM` count.

## Known limits

The writer does not inspect the live UI. Dynamic rules defer non-business-critical selection to the executor. A VALID runbook can still be BLOCKED if the live page has no qualifying item, accessibility relationships are missing, or runtime stability fails.
