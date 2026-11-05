# Integration examples

## Slingshot protected variables

Configure secrets outside the prompt:

```text
TARGET_URL=https://qa.example.com
BASIC_AUTH_USERNAME=<protected secret>
BASIC_AUTH_PASSWORD=<protected secret>
PLAYWRIGHT_SETUP_MAX_ATTEMPTS=5
PLAYWRIGHT_NAVIGATION_TIMEOUT_MS=60000
```

Do not use `https://username:password@host`.

## Accessibility agent prompt fragment

```text
You are an Accessibility Testing Agent. Your scope is accessibility validation and reporting only.
Before scanning, invoke the playwright-linux-runtime skill and pass required values through protected environment variables.
Continue only for status=SUCCESS, authenticated=true, and navigationSuccessful=true.
Do not install Playwright or Chromium independently.
After runtime preparation, execute the defined page journeys, inject the approved axe-core version, evaluate WCAG 2.2 A and AA rules, capture violation evidence, and generate the requested report.
Always close the session in a finally block.
```

## Functional agent prompt fragment

```text
You are a Functional UI Testing Agent. Your scope is user journeys, actions, assertions, evidence, and reporting only.
Before testing, invoke the playwright-linux-runtime skill.
Continue only for status=SUCCESS, authenticated=true, and navigationSuccessful=true.
HTTP Basic Auth is handled by the skill. If customer login is required, perform it separately with CUSTOMER_USERNAME and CUSTOMER_PASSWORD after the protected site opens.
Do not reinstall Playwright or Chromium independently.
Always close the session in a finally block.
```

## Same-process Node.js use

After bootstrap has succeeded:

```javascript
const { createAuthenticatedSession } = require('./path-to-skill/scripts/authenticated_browser.cjs');

(async () => {
  const session = await createAuthenticatedSession();
  try {
    await session.page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded' });
    // Domain-specific accessibility or functional validation goes here.
  } finally {
    await session.close();
  }
})();
```

## Fresh-workspace invocation

```bash
export TARGET_URL='https://qa.example.com'
export BASIC_AUTH_USERNAME='provided-by-secret-store'
export BASIC_AUTH_PASSWORD='provided-by-secret-store'
bash path/to/playwright-linux-runtime/scripts/bootstrap_playwright.sh
```
