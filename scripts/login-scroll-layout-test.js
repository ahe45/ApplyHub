const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const fs = require('node:fs');
const path = require('node:path');

async function run() {
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const artifacts = path.resolve(__dirname, '../.tmp-login-scroll-check');
    fs.mkdirSync(artifacts, { recursive: true });
    for (const theme of ['light', 'dark']) {
    await page.evaluateOnNewDocument(value => {
      if (location.protocol === 'http:' || location.protocol === 'https:') localStorage.setItem('applyhub.theme', value);
    }, theme);
    for (const [width, height] of [[390, 844], [390, 700], [360, 640], [320, 568], [390, 400], [1440, 900]]) {
      await page.setViewport({ width, height, isMobile: width < 768, hasTouch: width < 768 });
      await page.goto((process.env.LOGIN_TEST_URL || 'http://localhost:3000') + '/login', { waitUntil: 'networkidle2' });
      await page.waitForSelector('#loginForm');
      await page.evaluate(() => document.fonts.ready);
      const layout = await page.evaluate(() => {
        const selectors = ['html', 'body', '.app-shell', '.page-shell', '.content-area', '.common-login-stage', '.login-shell-copyright'];
        return Object.fromEntries(selectors.map(selector => {
          const el = document.querySelector(selector);
          if (!el) return [selector, null];
          const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
          return [selector, { top: rect.top, bottom: rect.bottom, height: rect.height, scroll: el.scrollHeight, client: el.clientHeight, minHeight: style.minHeight, padding: style.padding, rows: style.gridTemplateRows, overflow: style.overflow }];
        }));
      });
      if (process.argv.includes('--inspect')) console.log(JSON.stringify({ theme, width, height, layout }));
      if (!process.argv.includes('--inspect')) {
        assert(layout.html.scroll <= height + 1, 'No outer document scroll');
        const content = layout['.content-area'], stage = layout['.common-login-stage'];
        const padding = await page.$eval('.content-area', el => parseFloat(getComputedStyle(el).paddingTop) + parseFloat(getComputedStyle(el).paddingBottom));
        assert(content.scroll <= Math.max(content.client, stage.height + padding) + 1, 'Only content and safe padding contribute to scrolling');
        if (stage.height + padding <= height) assert(content.scroll <= content.client + 1, 'Fitting content must not scroll');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.$eval('.content-area', el => { el.scrollTop = el.scrollHeight; });
        assert(await page.$eval('.login-shell-copyright', el => el.getBoundingClientRect().bottom <= innerHeight + 1), 'Footer remains reachable when scrolling is needed');
        await page.$eval('.content-area', el => { el.scrollTop = 0; });
        // Browser chrome/keyboard height changes must not leave the old viewport height behind.
        await page.setViewport({ width, height: height + 120, isMobile: width < 768, hasTouch: width < 768 });
        assert(await page.$eval('.app-shell', el => Math.abs(el.getBoundingClientRect().height - innerHeight) < 1));
        await page.setViewport({ width, height, isMobile: width < 768, hasTouch: width < 768 });
        if (width === 390 && height === 700) await page.screenshot({ path: path.join(artifacts, `${theme}.png`), fullPage: true });
        console.log(`PASS: ${theme} ${width}x${height}: no extra scrolling; overflow and viewport resizing remain usable`);
      }
    }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
