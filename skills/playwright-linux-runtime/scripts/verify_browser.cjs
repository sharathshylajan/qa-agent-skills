const { createAuthenticatedSession } = require('./authenticated_browser.cjs');

(async () => {
  let session;
  try {
    session = await createAuthenticatedSession();
    const response = await session.page.goto(session.targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: Number(process.env.PLAYWRIGHT_NAVIGATION_TIMEOUT_MS || 60000)
    });
    const status = response ? response.status() : null;
    if (status === 401 || status === 403) throw new Error(`HTTP_${status}`);
    if (status && status >= 400) throw new Error(`HTTP_${status}`);
    const finalUrl = new URL(session.page.url());
    const expected = new URL(session.targetUrl);
    if (finalUrl.host !== expected.host) throw new Error(`UNEXPECTED_HOST:${finalUrl.host}`);
    const html = await session.page.content();
    if (!html || html.length < 20) throw new Error('EMPTY_OR_UNUSABLE_HTML');
    console.log(JSON.stringify({
      status: 'SUCCESS', browser: 'chromium', mode: 'headless',
      authenticated: true, navigationSuccessful: true,
      attemptsUsed: Number(process.env.PLAYWRIGHT_CURRENT_ATTEMPT || 1),
      httpStatus: status, finalUrlHost: finalUrl.host
    }));
  } catch (error) {
    const message = String(error && error.message ? error.message : error)
      .replace(/https?:\/\/[^/@\s]+:[^/@\s]+@/g, 'https://***:***@');
    console.error(message);
    process.exitCode = 1;
  } finally {
    if (session && process.env.PLAYWRIGHT_KEEP_OPEN !== 'true') await session.close();
  }
})();
