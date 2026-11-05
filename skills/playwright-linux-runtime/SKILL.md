---
name: playwright-linux-runtime
description: prepare and verify a fresh linux workspace for browser-based testing with node.js playwright, playwright-managed headless chromium, http basic authentication, bounded recovery, and secret-safe diagnostics. use whenever an accessibility, functional, broken-link, visual, or other ui-testing agent must install or launch playwright/chromium in an ephemeral slingshot studio workspace, open a protected target url, or recover from browser installation and startup failures. do not use for the domain-specific test logic itself.
---

# Playwright Linux Runtime

Use the bundled scripts as the deterministic browser bootstrap layer. Keep accessibility, functional, broken-link, and visual assertions in the calling agent.

## Required inputs

Require these environment variables:

- `TARGET_URL`: application URL without embedded credentials.
- `BASIC_AUTH_USERNAME`: HTTP Basic Authentication username.
- `BASIC_AUTH_PASSWORD`: HTTP Basic Authentication password.

Optional variables:

- `PLAYWRIGHT_SETUP_MAX_ATTEMPTS`: default `5`; never permit more than `5`.
- `PLAYWRIGHT_NAVIGATION_TIMEOUT_MS`: default `60000`.
- `PLAYWRIGHT_PACKAGE_VERSION`: default `latest`; pin this in controlled environments.
- `PLAYWRIGHT_BROWSERS_PATH`: default `.cache/ms-playwright` in the current workspace.
- `PLAYWRIGHT_ALLOW_INSECURE_TLS`: default `false`; set `true` only for an approved non-production test certificate.
- `PLAYWRIGHT_KEEP_OPEN`: default `false`; set `true` only when the calling process imports the runtime module and owns cleanup.

Never place credentials in `TARGET_URL`, commands, logs, reports, screenshots, or generated source literals. If a credential-bearing URL is supplied, stop and request separated secret variables.

## Workflow

1. Run `bash scripts/bootstrap_playwright.sh` from the skill directory or provide the absolute path.
2. Read the final JSON object from stdout.
3. Continue only when `status` is `SUCCESS`, `authenticated` is `true`, and `navigationSuccessful` is `true`.
4. For a test implemented in the same Node.js process, import `scripts/authenticated_browser.cjs` and call `createAuthenticatedSession()` after bootstrap succeeds.
5. Execute domain-specific testing in the calling agent.
6. Always call the returned `close()` function in a `finally` block.

The bootstrap script is designed for a fresh Slingshot workspace. It creates a minimal npm project when required, installs the Playwright package, installs Playwright-managed Chromium, checks Linux browser dependencies, launches headless Chromium, configures Basic Auth through `browser.newContext({ httpCredentials })`, verifies navigation, and stops after at most five total attempts.

## Mandatory behavior

- Treat the five-attempt counter as global across package installation, browser installation, launch, authentication, and navigation.
- Do not reset the counter for a new recovery action.
- Do not reinstall a component that has already passed verification.
- Do not install branded Google Chrome. Use Playwright-managed Chromium.
- Do not use a credential-bearing URL.
- Do not add `--no-sandbox` unless the observed launch error indicates a sandbox restriction.
- Do not retry invalid credentials, HTTP `401`, HTTP `403`, invalid host/DNS, missing required variables, or deterministic permission failures.
- Do not claim success from an installation command alone. Verify an authenticated browser navigation.
- Limit failed command output to a short sanitized tail.
- Never expose environment variable values.

## Calling-agent contract

The calling agent must keep only this compact instruction in its prompt:

```text
Before any browser-based validation, invoke the playwright-linux-runtime skill.
Provide TARGET_URL, BASIC_AUTH_USERNAME, and BASIC_AUTH_PASSWORD as protected runtime environment variables.
Continue only when the skill returns status=SUCCESS, authenticated=true, and navigationSuccessful=true.
Do not independently install Playwright, Chromium, Chrome, or Linux browser dependencies.
Keep HTTP Basic Authentication separate from any application/customer login.
Run the domain-specific test only after runtime preparation succeeds, and always close the browser session in a finally block.
```

## Output contract

Success JSON:

```json
{
  "status": "SUCCESS",
  "browser": "chromium",
  "mode": "headless",
  "authenticated": true,
  "navigationSuccessful": true,
  "attemptsUsed": 1,
  "httpStatus": 200,
  "finalUrlHost": "qa.example.com"
}
```

Failure JSON:

```json
{
  "status": "FAILED",
  "attemptsUsed": 5,
  "failedStage": "browser-launch",
  "errorCategory": "missing-linux-dependency",
  "rootCause": "sanitized concise evidence",
  "recommendedFix": "grant package-install privileges or use a compatible base image"
}
```

## Files

- `scripts/bootstrap_playwright.sh`: fresh-workspace installation, bounded recovery, and verification entrypoint.
- `scripts/verify_browser.cjs`: standalone authenticated-navigation verification.
- `scripts/authenticated_browser.cjs`: reusable Node.js browser/session module for domain agents.
- `references/integration.md`: examples for accessibility and functional agents.
- `references/troubleshooting.md`: failure categories and operator fixes.
