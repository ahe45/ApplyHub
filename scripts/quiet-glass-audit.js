const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { viewRouteDefinitions } = require('../shared/app-config');

// Called only by the isolated-database smoke test; never logs into the user's DB.
async function auditQuietGlass(page, navigateToView) {
  const artifacts = path.resolve(__dirname, '../.tmp-quiet-glass-check');
  fs.mkdirSync(artifacts, { recursive: true });
  const originalPath = new URL(page.url()).pathname;
  // Start the two-palette audit explicitly in dark mode, independent of default.
  if (await page.$eval('html', el => el.dataset.theme) !== 'dark') await page.click('#topbar .theme-toggle');
  for (const route of viewRouteDefinitions) {
    if (route.view !== 'dashboard' && !await page.$(`.nav-item[data-view="${route.view}"]`)) continue;
    await navigateToView(page, route.view, route.path);
    await page.evaluate(() => document.fonts.ready);
    const theme = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const legacy = [];
      const lightSurfaces = [];
      for (const el of document.querySelectorAll('#viewRoot *, .sidebar *, .topbar *')) {
        if (!el.getBoundingClientRect().width || el.closest('.template-editor-surface, .template-preview, .template-render-sheet, .paper, .login-notice-content, .toolbar-color-palette')) continue;
        const style = getComputedStyle(el);
        const bg = style.backgroundColor.match(/[\d.]+/g)?.map(Number) || [];
        if (!el.closest('[class*="swatch"], [class*="color-preview"], [class*="color-trigger"]') && bg.length >= 3 && (bg[3] ?? 1) > .85 && bg.slice(0, 3).every(channel => channel > 190)) lightSurfaces.push(el.className);
        if (/rgb\((45, 99, 245|36, 92, 219|75, 123, 248|37, 99, 235)\)/.test([style.color, style.backgroundColor, style.backgroundImage, style.borderColor].join(' '))) legacy.push(el.className);
      }
      return { background: body.backgroundImage, font: body.fontFamily, legacy, lightSurfaces, scheme: body.colorScheme,
        primary: body.getPropertyValue('--accent').trim(),
        loaded: Boolean(document.querySelector('link[href$="/quiet-glass.css"]')),
        retired: Boolean(document.querySelector('link[href*="public-bento"]')),
        overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    assert(theme.background.includes('39, 75, 101') && theme.background.includes('41, 50, 85'), `${route.path}: dark reference backdrop`);
    assert(theme.font.startsWith('"Noto Sans KR"'), `${route.path}: shared typography`);
    assert.equal(theme.primary, '#25546f');
    assert(theme.loaded && !theme.retired);
    assert.equal(await page.$('.public-glass-heading, .page-kicker, .applicant-public-form-section-kicker'), null, `${route.path}: no decorative introductions`);
    assert.deepEqual(theme.legacy, [], `${route.path}: retired primary palette`);
    assert.equal(theme.scheme, 'dark');
    assert.deepEqual(theme.lightSurfaces, [], `${route.path}: no light UI panels`);
    assert.equal(theme.overflow, false, `${route.path}: page overflow`);
    await page.screenshot({ path: path.join(artifacts, `${route.view}.png`), fullPage: true });
    await page.click('#topbar .theme-toggle');
    // Inspect settled colors, not intermediate navigation/button transitions.
    await page.evaluate(() => Promise.all(document.getAnimations()
      .filter(animation => animation instanceof CSSTransition)
      .map(animation => animation.finished.catch(() => {}))));
    const light = await page.evaluate(() => ({
      scheme: getComputedStyle(document.body).colorScheme,
      surface: getComputedStyle(document.body).getPropertyValue('--glass-surface').trim(),
      primary: getComputedStyle(document.body).getPropertyValue('--glass-primary').trim(),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      noticeScheme: document.querySelector('.login-notice-editor-surface') ? getComputedStyle(document.querySelector('.login-notice-editor-surface')).colorScheme : 'light',
    }));
    assert.equal(light.scheme, 'light', `${route.path}: light mode`);
    assert.equal(light.surface, '#ffffff');
    assert.equal(light.primary, '#2563eb');
    assert.equal(light.noticeScheme, 'light');
    assert.equal(light.overflow, false, `${route.path}: light overflow`);
    await page.screenshot({ path: path.join(artifacts, `${route.view}-light.png`), fullPage: true });
    await page.click('#topbar .theme-toggle');
    console.log(`PASS: Quiet Glass ${route.path}`);
  }
  for (const route of ['/dashboard', '/applicant-question-template-management']) {
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(new URL(route, page.url()).href, { waitUntil: 'networkidle2' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${route}: mobile overflow`);
    await page.click('#topbar .theme-toggle');
    assert.equal(await page.$eval('body', el => getComputedStyle(el).colorScheme), 'light');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${route}: light mobile overflow`);
    await page.click('#topbar .theme-toggle');
    await page.click('#menuToggle');
    assert.equal(await page.$eval('#sidebar', el => el.classList.contains('open')), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('#menuToggle', el => el.getAttribute('aria-expanded')), 'false');
    await page.screenshot({ path: path.join(artifacts, `${route.slice(1)}-mobile.png`), fullPage: true });
  }
  await page.setViewport({ width: 1440, height: 1200 });
  const original = viewRouteDefinitions.find(route => route.path === originalPath);
  if (original) await page.goto(new URL(original.path, page.url()).href, { waitUntil: 'networkidle2' });
}

module.exports = { auditQuietGlass };
