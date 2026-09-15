const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const base = process.env.THEME_TEST_URL || 'http://localhost:3000';
const key = 'applyhub.theme';
const palette = {
  dark: { scheme: 'dark', panel: 'rgb(32, 52, 70)', field: 'rgb(15, 31, 46)' },
  light: { scheme: 'light', panel: 'rgb(255, 255, 255)', field: 'rgb(244, 248, 255)' },
};
async function run() {
  const browser = await puppeteer.launch({ headless: true,
    executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  const artifacts = path.resolve(__dirname, '../.tmp-theme-check');
  fs.mkdirSync(artifacts, { recursive: true });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(e.message));
    const toggle = '.common-login-stage .theme-toggle:not(:disabled), .applicant-public-body .theme-toggle:not(:disabled)';
    const go = async route => {
      await page.goto(base + route, { waitUntil: 'networkidle2' });
      await page.waitForSelector(route === '/login' ? toggle : '#applicantPageRoot > *, #accountRecoveryRoot > article', { visible: true });
    };
    await go('/login');
    assert.equal(await page.$eval('html', el => el.dataset.theme), 'light', 'first visit defaults to light');
    assert.equal(await page.$eval('body', el => getComputedStyle(el).colorScheme), 'light');
    await page.click('.common-login-stage .theme-toggle');
    await go('/login');
    assert.equal(await page.$eval('html', el => el.dataset.theme), 'dark', 'saved dark preference survives reload');
    // The startup script precedes all styles on every HTML entry point.
    for (const route of ['/login', '/applicant/signup', '/account-recovery']) {
      const markup = await (await page.goto(base + route)).text();
      assert(markup.indexOf('/client/app/theme.js') < markup.indexOf('rel="stylesheet"'));
    }
    for (const width of process.env.THEME_LIFECYCLE_ONLY ? [] : [320, 390, 1440]) {
      await page.setViewport({ width, height: 1000 });
      await go('/login');
      for (const theme of ['light', 'dark']) {
        // Opposite OS preference must not override an explicit selection.
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme === 'dark' ? 'light' : 'dark' }]);
        if (await page.$eval('html', el => el.dataset.theme) !== theme) {
          await page.$eval('.common-login-stage .theme-toggle', el => el.focus());
          await page.keyboard.press('Enter');
        }
        await page.type('#loginAccountId', 'preview@example.com');
        await page.click('.common-login-stage .theme-toggle');
        await page.click('.common-login-stage .theme-toggle');
        assert.equal(await page.evaluate(key => localStorage.getItem(key), key), theme);
        assert.equal(await page.$eval('#loginAccountId', el => el.value), 'preview@example.com', 'toggle preserves entered form');
        await page.reload({ waitUntil: 'networkidle2' });
        for (const route of ['/login', '/applicant?preview=1', '/applicant/signup', '/account-recovery', '/applicant/form?preview=1', '/applicant/ticket?preview=1']) {
          await go(route);
          assert.equal(await page.$eval('html', el => el.dataset.theme), theme, `${route}: persisted theme`);
          assert.equal(await page.$eval('body', el => getComputedStyle(el).colorScheme), theme);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${route}: overflow at ${width}`);
          if (route === '/login') {
            const shell = await page.$eval('.common-login-stage', el => {
              const s = getComputedStyle(el); return { width: el.getBoundingClientRect().width, padding: s.padding, border: s.borderTopWidth, background: s.backgroundImage, shadow: s.boxShadow };
            });
            assert.equal(shell.padding, '12px');
            assert.equal(shell.border, '1px');
            assert.equal(shell.background, 'none');
            assert.equal(shell.shadow, 'none');
            assert(Math.abs(shell.width - Math.min(520, width)) < 2, 'login frame meets the viewport edges on mobile');
            const button = await page.$eval(toggle, el => ({ label: el.getAttribute('aria-label'), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }));
            assert.equal(button.label, `${theme === 'dark' ? '라이트' : '다크'} 모드로 전환`);
            assert(button.width >= 44 && button.height >= 44);
            assert.equal(await page.$eval(toggle, el => el.textContent.trim()), '', 'theme control is icon-only');
            assert.equal(button.width, 44);
            assert(await page.$('.public-glass-intro'), 'login branding remains');
            assert.equal(await page.$eval('.login-panel-card', el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
            assert.equal(await page.$eval('#loginPassword', el => getComputedStyle(el).backgroundColor), palette[theme].field);
            const background = await page.$eval('.login-submit-button', el => getComputedStyle(el).backgroundImage);
            assert(background.includes(theme === 'light' ? '37, 99, 235' : '50, 107, 196'), 'mode-specific primary button');
          } else {
            assert.equal(await page.$('.public-glass-page-header, .public-glass-intro, applyhub-theme-toggle'), null, `${route}: no outer header or theme control`);
            const frame = await page.$eval('.applicant-public-frame', el => {
              const style = getComputedStyle(el), rect = el.getBoundingClientRect();
              return { padding: style.padding, border: style.borderTopWidth, background: style.backgroundImage, shadow: style.boxShadow, width: rect.width };
            });
            assert.deepEqual({ ...frame, width: 0 }, { padding: '12px', border: '1px', background: 'none', shadow: 'none', width: 0 });
            assert(Math.abs(frame.width - Math.min(520, width)) < 2, `${route}: frame fills public viewport with internal safe margins`);
          }
          if (width === 390) await page.screenshot({ path: path.join(artifacts, `${theme}-${route.split('?')[0].replaceAll('/', '-')}.png`), fullPage: true });
        }
        await go('/login');
        console.log(`PASS: ${theme} public routes, persistence, controls at ${width}px`);
      }
    }
    await go('/login');
    const peer = await browser.newPage();
    await peer.goto(base + '/account-recovery', { waitUntil: 'networkidle2' });
    await page.bringToFront();
    await page.click('.common-login-stage .theme-toggle');
    await peer.bringToFront();
    await peer.waitForFunction(() => document.documentElement.dataset.theme === 'light', { polling: 50 });
    assert.equal(await peer.$('.theme-toggle'), null, 'recovery inherits theme without a visible toggle');
    await page.bringToFront();
    await page.click('.common-login-stage .theme-toggle');
    await peer.waitForFunction(() => document.documentElement.dataset.theme === 'dark', { polling: 50 });
    await page.evaluate(key => localStorage.removeItem(key), key);
    await peer.waitForFunction(() => document.documentElement.dataset.theme === 'light', { polling: 50 });
    await peer.close();
    console.log('PASS: cross-tab sync and preference removal');
    await page.evaluate(key => localStorage.setItem(key, 'invalid'), key);
    await go('/login');
    assert.equal(await page.$eval('html', el => el.dataset.theme), 'light');
    const blocked = await browser.newPage();
    blocked.on('pageerror', e => errors.push(e.message));
    await blocked.evaluateOnNewDocument(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
    await blocked.goto(base + '/login', { waitUntil: 'networkidle2' });
    assert.equal(await blocked.$eval('html', el => el.dataset.theme), 'light');
    await blocked.click('.common-login-stage .theme-toggle');
    assert.equal(await blocked.$eval('html', el => el.dataset.theme), 'dark');
    await blocked.close();
    assert.deepEqual(errors, []);
    console.log('PASS: cross-tab sync, invalid preferences, blocked storage, no browser errors');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
