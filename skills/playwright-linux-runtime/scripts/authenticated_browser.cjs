const path = require('path');
const playwrightPath = require.resolve('playwright', { paths: [process.cwd(), path.dirname(__dirname)] });
const { chromium } = require(playwrightPath);

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`MISSING_ENV:${name}`);
  return value;
}

async function createAuthenticatedSession() {
  const targetUrl = required('TARGET_URL');
  const username = required('BASIC_AUTH_USERNAME');
  const password = required('BASIC_AUTH_PASSWORD');
  const parsed = new URL(targetUrl);
  if (parsed.username || parsed.password) throw new Error('CREDENTIAL_BEARING_URL');

  const launchArgs = [];
  if (process.env.PLAYWRIGHT_USE_NO_SANDBOX === 'true') {
    launchArgs.push('--no-sandbox', '--disable-setuid-sandbox');
  }
  if (process.env.PLAYWRIGHT_DISABLE_DEV_SHM_USAGE === 'true') {
    launchArgs.push('--disable-dev-shm-usage');
  }

  const browser = await chromium.launch({ headless: true, args: launchArgs });
  const context = await browser.newContext({
    httpCredentials: { username, password },
    ignoreHTTPSErrors: process.env.PLAYWRIGHT_ALLOW_INSECURE_TLS === 'true'
  });
  const page = await context.newPage();
  const timeout = Math.max(1000, Number(process.env.PLAYWRIGHT_NAVIGATION_TIMEOUT_MS || 60000));
  page.setDefaultTimeout(timeout);
  page.setDefaultNavigationTimeout(timeout);

  const close = async () => {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  };

  return { browser, context, page, targetUrl, close };
}

module.exports = { createAuthenticatedSession };
