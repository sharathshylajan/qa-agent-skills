---
name: accessibility-scan-evidence
description: Execute an authorized baseline accessibility audit from accessibility_execution_plan.json using the existing playwright-linux-runtime skill, axe-core, keyboard observation, accessibility-tree review, reflow checks, evidence preservation, scoring, and sanitized structured output. Use after scope planning and before report generation.
---
# Accessibility Scan Evidence
## Dependencies
Use the existing `playwright-linux-runtime` skill exclusively for fresh Linux setup, Playwright/Chromium installation, headless launch, BrowserContext `httpCredentials`, initial navigation verification, five-attempt setup recovery, session creation, and cleanup. Never install or launch independently.
## Limits
Setup attempts 5 owned by runtime Skill; navigation 3 per URL; session recovery 3; axe 3 per unchanged state; global `page.goto` ceiling 12; extra interaction states 0; keyboard 30 Tab and 10 Shift+Tab; tree observations 25; reflow observations 20; screenshots disabled. Retry only transient failures and stop after success. Never retry deterministic 401/403, credential rejection, invalid URL, CAPTCHA/bot challenge, unauthorized target, DNS/TLS/permission/application failure.
## Workflow
1. Validate `accessibility_execution_plan.json`; if blocked, write blocked evidence without browser execution.
2. Invoke `playwright-linux-runtime` with protected `TARGET_URL`, `BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD`; continue only for `status=SUCCESS`, `authenticated=true`, `navigationSuccessful=true`.
3. Use only its `createAuthenticatedSession()` and always `session.close()` in `finally`. Reuse a healthy session within the same exact origin. Separate origins require separate authorization decisions.
4. Navigate with `domcontentloaded` and bounded readiness checks. Validate requested/final URL, HTTP status, title, body, meaningful intended content, page identity, and absence of auth challenge, denial, CAPTCHA, bot/browser/gateway/maintenance error, or blank page.
5. Run one baseline axe scan per unchanged eligible page state with `wcag2a`, `wcag2aa`, `wcag21aa`. Capture violations, passes, incomplete, inapplicable, version when available, actual timings, sanitized URL/title/tags. Retry only transient execution failure.
6. For violations capture ID, impact, help, help URL, tags, affected nodes, targets, concise evidence, failure summary. Never promote incomplete items.
7. Collect informational inventory: headings, links, buttons, forms/fields, images, landmarks, tables, frames/iframes, cross-origin iframes, visible interactive elements.
8. Perform non-destructive keyboard observations, accessibility-tree review, and desktop 1440x900 plus reflow 320x800 checks within limits. Do not claim screen-reader testing. Native 200% zoom is not tested unless genuinely performed.
9. Do not open all menus/dialogs, purchase, pay, create customer data, perform destructive actions, or cross-page journeys.
## Authentication
Credentials only from protected runtime variables. Preserve password exactly. Never build, inspect, log, or report Authorization/Basic values; never use request interception or credential-bearing URLs. Public 401 is `AUTH_CHALLENGE_DETECTED`; if approved credentials exist, dispose public session and invoke runtime Skill once with them. One correctly configured pair returning deterministic 401 is `CREDENTIAL_REJECTED`; stop. Application login is separate and only when Jira explicitly requires it with separate approved credentials.
## Scanned page and score
A page is scanned only with complete valid axe baseline output. Score per unique rule per page/state: Critical 15, Serious 8, Moderate 4, Minor 1, Unknown/null 2. `score=max(0,100-penalty)`; grades A 90-100, B 80-89, C 70-79, D 50-69, F 0-49. Status `COMPLETE|PARTIAL|BLOCKED|NOT SCORED`. Zero scanned pages means null score/grade and no accessibility conclusion.
## Output
Write exactly `accessibility_audit_evidence.json` with Jira metadata, runtime evidence, coverage, per-page navigation/auth/axe evidence, findings, inventory, supplemental observations, score/status, actual timings, sanitized blockers, and limitations. Never include credentials, auth headers, encoded values, cookies, tokens, session IDs, customer/payment data, secrets, or unsanitized logs.
