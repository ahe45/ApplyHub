const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
async function run() {
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  try {
    const page = await browser.newPage();
    let member = true, failLogout = false, logouts = 0;
    const schoolName = '아주 긴 학교명 <테스트> 국제예술과학대학교';
    const logo = 'data:image/png;base64,' + fs.readFileSync(path.resolve(__dirname, '../client/assets/logo.png')).toString('base64');
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      const respond = (body, status = 200) => request.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.pathname === '/api/public/school-branding') return respond({ schoolName, logoImageUrl: logo });
      if (url.pathname === '/api/public/members/session') return respond({ member: member ? { id: 1, name: '테스트', email: 'test@example.com' } : null });
      if (url.pathname === '/api/public/members/settings') return respond({ questions: [], terms: [] });
      if (url.pathname === '/api/auth/logout') { logouts++; return respond(failLogout ? { error: '테스트 오류' } : { ok: true }, failLogout ? 500 : 200); }
      if (request.method() !== 'GET') return request.abort();
      request.continue();
    });
    const base = process.env.THEME_TEST_URL || 'http://localhost:3000';
    const artifacts = path.resolve(__dirname, '../.tmp-school-header-check'); fs.mkdirSync(artifacts, { recursive: true });
    for (const signedIn of [false, true]) {
      member = signedIn;
      for (const mode of ['light', 'dark']) {
        for (const width of [320, 390, 1440]) {
          await page.setViewport({ width, height: 950, isMobile: width < 500, hasTouch: width < 500 });
          for (const route of ['/applicant/signup', '/account-recovery']) {
            await page.goto(base + route, { waitUntil: 'networkidle2' });
            await page.evaluate(mode => { document.documentElement.dataset.theme = mode; }, mode);
            await page.waitForFunction(name => document.querySelector('.public-school-brand strong')?.textContent === name, {}, schoolName);
            assert.equal(await page.$eval('.public-school-home', el => new URL(el.href).pathname), signedIn ? '/applicant' : '/login');
            assert.equal(Boolean(await page.$('.public-school-logout')), signedIn);
            assert(await page.$eval('.public-school-header', el => {
              const home = el.querySelector('.public-school-home').getBoundingClientRect();
              const brand = el.querySelector('.public-school-brand').getBoundingClientRect();
              const right = el.lastElementChild.getBoundingClientRect();
              const rect = el.getBoundingClientRect();
              return home.width >= 44 && home.height >= 44 && home.right <= brand.left && brand.right <= right.left
                && Math.abs((brand.left + brand.right - rect.left - rect.right) / 2) < 1 && home.top === rect.top;
            }), `${mode} ${width} ${route}: three-column aligned header`);
            assert(await page.$eval('.public-school-brand img', el => el.complete && el.naturalWidth > 0));
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
            if (width === 390 && route.includes('signup')) await page.screenshot({ path: path.join(artifacts, `${mode}-${signedIn ? 'member' : 'guest'}.png`), fullPage: true });
          }
        }
      }
    }
    failLogout = true;
    await page.click('.public-school-logout');
    await page.waitForFunction(() => !document.querySelector('.public-school-header-error').hidden);
    assert.equal(logouts, 1);
    assert.equal(await page.$eval('.public-school-logout', el => el.disabled), false);
    failLogout = false;
    await Promise.all([page.waitForNavigation(), page.click('.public-school-logout')]);
    assert.equal(new URL(page.url()).pathname, '/login');
    assert.equal(logouts, 2);
    assert.deepEqual(errors, []);
    console.log('PASS: school name/logo, guest/member header, long-name alignment, mobile/desktop, both themes and logout success/failure (mocked)');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
