const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const fs = require('node:fs');
const path = require('node:path');

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });
  try {
    const page = await browser.newPage();
    // This reference audit deliberately checks the dark palette, not the default.
    await page.evaluateOnNewDocument(() => localStorage.setItem('applyhub.theme', 'dark'));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = process.env.NOTICE_TEST_URL || 'http://localhost:3000';
    const artifacts = path.resolve(__dirname, '../.tmp-quiet-glass-check/public');
    fs.mkdirSync(artifacts, { recursive: true });
    for (const width of [320, 390, 1440]) {
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: width === 1440 ? 'dark' : 'light' }]);
      await page.setViewport({ width, height: 1000 });
      for (const route of ['/login', '/applicant?preview=1']) {
        await page.goto(base + route, { waitUntil: 'networkidle2' });
        await page.waitForSelector('.login-notice-head h2');
        const notice = await page.evaluate(() => {
          const head = document.querySelector('.login-notice-head');
          const card = head.closest('.login-notice-card');
          const title = head.querySelector('h2');
          return {
            text: title.textContent.trim(),
            children: head.querySelectorAll('h2').length,
            fontSize: getComputedStyle(title).fontSize,
            gap: getComputedStyle(card).rowGap,
            content: Boolean(card.querySelector('.login-notice-content').textContent.trim()),
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
          };
        });
        assert.deepEqual(notice, { text: 'Notice', children: 1, fontSize: '12px', gap: '0px', content: true, overflow: false });
        assert.equal(await page.$eval('.public-glass-notice', el => el.open), false);
        await page.click('.public-glass-notice summary');
        assert.equal(await page.$eval('.public-glass-notice', el => el.open), true);
        assert(await page.$eval('.login-notice-content', el => el.getBoundingClientRect().height > 0));
        await page.click('.public-glass-notice summary');
        assert.equal(await page.$('.public-glass-heading, .page-kicker, .applicant-public-form-section-kicker'), null);
        if (route === '/login') assert.equal(await page.$eval('.public-glass-intro', el => getComputedStyle(el).paddingBottom), '18px');
        else assert.equal(await page.$('.public-glass-intro, .public-glass-page-header'), null);
        assert(await page.$eval('.common-login-stage, .applicant-public-frame', el => Math.abs(el.getBoundingClientRect().width - Math.min(520, innerWidth - 24)) < 2));
        const glass = await page.$eval('.common-login-stage, .applicant-public-frame', el => {
          const style = getComputedStyle(el);
          return { background: style.backgroundImage, border: style.borderTopWidth, padding: style.padding, shadow: style.boxShadow };
        });
        assert.deepEqual(glass, { background: 'none', border: '0px', padding: '0px', shadow: 'none' });
        if (route === '/login') {
          assert.equal(await page.$eval('.login-panel-card', el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
          assert.equal(await page.$eval('#loginPassword', el => getComputedStyle(el).backgroundColor), 'rgb(15, 31, 46)');
          assert.equal(await page.$eval('body', el => getComputedStyle(el).colorScheme), 'dark');
          assert(await page.$eval('.login-submit-button', el => getComputedStyle(el).backgroundImage.includes('50, 107, 196')));
          assert.equal(await page.$eval('.login-panel-card', el => getComputedStyle(el).padding), '0px');
          assert.equal(await page.$eval('.login-stage-form h3', el => getComputedStyle(el).fontSize), '18px');
          assert.equal(await page.$eval('#loginPassword', el => el.getBoundingClientRect().height), 48);
        }
        assert((await page.title()).includes('원서접수시스템'));
        if (route === '/login') {
          const branding = await page.evaluate(() => fetch('/api/public/school-branding').then(response => response.json()));
          assert.equal(await page.$eval('.public-glass-intro strong', el => el.textContent), branding.schoolName || '원서접수시스템');
        }
        if (width === 390) await page.screenshot({ path: path.join(artifacts, route.startsWith('/login') ? 'login.png' : 'applicant-preview.png'), fullPage: true });
        console.log(`PASS: compact Notice on ${route} at ${width}px`);
      }
      for (const route of ['/applicant/signup', '/account-recovery', '/applicant/form?preview=1', '/applicant/ticket?preview=1']) {
        await page.goto(base + route, { waitUntil: 'networkidle2' });
        assert((await page.title()).includes('원서접수시스템'));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${route} at ${width}px`);
        assert.equal(await page.$('.page-kicker, .applicant-public-form-section-kicker'), null);
        if (width === 390) await page.screenshot({ path: path.join(artifacts, route.includes('signup') ? 'signup.png' : route.includes('recovery') ? 'recovery.png' : route.includes('form') ? 'form.png' : 'ticket.png'), fullPage: true });
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
