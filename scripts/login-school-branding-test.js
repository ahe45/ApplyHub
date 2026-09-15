const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const fs = require('node:fs');
const path = require('node:path');

async function run() {
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  try {
    const page = await browser.newPage(), errors = [];
    const logo = 'data:image/png;base64,' + fs.readFileSync(path.resolve(__dirname, '../client/assets/logo.png')).toString('base64');
    let schoolName = '아주대학교';
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', async request => {
      const branding = { schoolName, logoImageUrl: schoolName ? logo : '' };
      if (request.isNavigationRequest() && new URL(request.url()).pathname === '/login') {
        const markup = await (await fetch(request.url())).text();
        return request.respond({ status: 200, contentType: 'text/html', body: markup.replace(/window\.AdmitCardInitialSuperAdminSettings = .*?;<\/script>/, () => `window.AdmitCardInitialSuperAdminSettings = ${JSON.stringify(branding).replaceAll('<', '\\u003c')};</script>`) });
      }
      if (new URL(request.url()).pathname === '/api/login-notice') return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ html: '<p>테스트 공지</p>', superAdminSettings: branding }) });
      return request.continue();
    });
    for (const name of ['아주대학교', '아주 긴 학교명 <테스트> 국제대학교 '.repeat(8), '']) {
      schoolName = name;
      for (const width of [320, 390, 1440]) {
        await page.setViewport({ width, height: 844 });
        await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
        const expected = name.trim() || '원서접수시스템';
        assert.deepEqual(await page.$eval('#loginAccountId', el => ({ type: el.type, inputMode: el.inputMode, autocapitalize: el.autocapitalize, spellcheck: el.spellcheck })), { type: 'text', inputMode: 'email', autocapitalize: 'none', spellcheck: false });
        assert(await page.$eval('#loginAccountId', el => { el.value = 'admin'; return el.checkValidity(); }), 'Email keyboard must still accept administrator IDs');
        assert.equal(await page.$eval('.login-stage-brand-copy strong', el => el.textContent), expected);
        assert.equal(await page.$eval('.login-stage-brand-copy strong', el => el.title), expected);
        assert((await page.$eval('.login-stage-brand-mark', el => el.getAttribute('src'))) === (name ? logo : '/client/assets/logo.png'), `school logo matches fixture at ${width}px; configured=${Boolean(name)}`);
        assert(await page.$eval('.login-stage-brand-mark', el => el.complete && el.naturalWidth > 0));
        for (let click = 0; click < 2; click++) {
          const theme = await page.$eval('html', el => el.dataset.theme);
          const button = await page.$eval('.common-login-stage .theme-toggle', el => ({ text: el.textContent.trim(), label: el.getAttribute('aria-label'), title: el.title, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, icons: [...el.querySelectorAll('svg')].filter(svg => getComputedStyle(svg).display !== 'none').length }));
          assert.deepEqual(button, { text: '', label: `${theme === 'dark' ? '라이트' : '다크'} 모드로 전환`, title: `${theme === 'dark' ? '라이트' : '다크'} 모드로 전환`, width: 44, height: 44, icons: 1 });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          await page.focus('.common-login-stage .theme-toggle');
          await page.keyboard.press('Enter');
          assert.notEqual(await page.$eval('html', el => el.dataset.theme), theme);
        }
      }
    }
    assert.deepEqual(errors, []);
    console.log('PASS: configured school name/logo, long names, fallback, mobile/desktop and icon-only accessible theme toggle');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
