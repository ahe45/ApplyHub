const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const base = process.env.THEME_TEST_URL || 'http://localhost:3000';
const send = '[data-applicant-action="send-code"]';
const verify = '[data-applicant-form="verify-code"] button[type="submit"]';
async function run() {
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  try {
    const page = await browser.newPage();
    const errors = [];
    let sends = 0, failSend = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.evaluateOnNewDocument(() => { const now = Date.now.bind(Date); window.testTimeOffset = 0; Date.now = () => now() + window.testTimeOffset; });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (request.isNavigationRequest() && url.pathname === '/applicant/apply' && !url.search) {
        return request.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.resolve(__dirname, '../applicant.html'), 'utf8') });
      }
      const respond = (body, status = 200) => request.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
      // All verification writes are mocked: no email or user-data changes.
      if (url.pathname === '/api/public/applicant-form') return respond({
        fields: [{ fieldKey: 'name', questionText: '이름', label: '이름', inputType: 'text', systemFieldKey: 'name', required: true }],
        recruitmentUnits: [{ id: 1, trackName: '수시', admissionName: '일반', seriesName: '인문', unitName: '문학', majorName: '' }],
        schedules: [{ trackName: '수시', admissionName: '일반', applicantScheduleStartAt: '2020-01-01T00:00', applicantScheduleEndAt: '2099-12-31T23:59' }], settings: {},
      });
      if (url.pathname === '/api/public/email-verifications') {
        sends += 1;
        return respond(failSend ? { error: '발송 실패 테스트' } : { debugCode: '123456', expiresInSeconds: 300 }, failSend ? 503 : 200);
      }
      if (url.pathname === '/api/public/email-verifications/verify') return respond({ accessToken: 'test-token', submission: { name: '홍길동', email: 'preview@example.com' } });
      if (url.pathname === '/api/public/members/session') return respond({ member: { id: 1, name: '홍길동', email: 'preview@example.com', profile: {} } });
      if (url.pathname === '/api/public/members/settings') return respond({ questions: [], terms: [] });
      if (url.pathname === '/api/public/members/application') return respond({ accessToken: 'test-token', submission: null });
      if (request.method() !== 'GET') return respond({ error: 'Unexpected write blocked by test' }, 400);
      request.continue();
    });
    const artifacts = path.resolve(__dirname, '../.tmp-verification-check');
    fs.mkdirSync(artifacts, { recursive: true });
    for (const mode of ['light', 'dark']) {
      await page.goto(base + '/login');
      await page.evaluate(mode => localStorage.setItem('applyhub.theme', mode), mode);
      for (const width of [320, 360, 390, 430, 768, 1440]) {
        await page.setViewport({ width, height: 1000, isMobile: width <= 430, hasTouch: width <= 430 });
        let reference;
        for (const route of ['verify', 'apply', 'form']) {
          await page.goto(base + `/applicant/${route}${route === 'apply' ? '' : '?preview=1'}`, { waitUntil: 'networkidle2' });
          await page.waitForSelector('.applicant-public-slab h2', { timeout: 5000 }).catch(async error => {
            console.error({ route, url: page.url(), errors, messages: await page.$$eval('.applicant-public-message, .applicant-public-preview-note, .applicant-member-error', els => els.map(el => el.textContent)) });
            throw error;
          });
          assert.equal(await page.$eval('.applicant-public-slab h2', el => el.textContent), ({ verify: '이메일 인증', apply: '접수 신청', form: '접수 페이지' })[route]);
          assert.equal(await page.$('.public-glass-page-header, .public-glass-intro, applyhub-theme-toggle'), null, 'public subpages show their panel without an outer header');
          const layout = await page.$eval('.applicant-public-slab', el => {
            const style = getComputedStyle(el), title = el.querySelector('h2').getBoundingClientRect();
            const home = document.querySelector('.public-school-home');
            const rect = home.getBoundingClientRect();
            return { background: style.backgroundColor, border: style.borderTopWidth, radius: style.borderRadius, padding: style.padding,
              homeRight: rect.top < title.top,
              iconOnly: Boolean(home.querySelector('svg')) && !home.textContent.trim() && home.getAttribute('aria-label') === '처음으로',
              overflow: document.documentElement.scrollWidth > innerWidth + 1 };
          });
          assert(layout.homeRight && layout.iconOnly && !layout.overflow, `${mode} ${width}px ${route}: header`);
          const material = [layout.background, layout.border, layout.radius, layout.padding];
          if (route === 'verify') {
            reference = material;
            assert.equal(await page.$('.applicant-public-verification-panel > p'), null);
            assert.equal(await page.$$eval('.applicant-public-actions [data-applicant-action="back-home"]', els => els.length), 0);
          } else assert.deepEqual(material, reference, 'application pages share verification card');
          if (route === 'apply') {
            assert(await page.$eval('.applicant-public-step-navigation', el => {
              const buttons = [...el.querySelectorAll('button')];
              const [previous, next] = buttons.map(button => button.getBoundingClientRect());
              return buttons.length === 2 && Math.abs(previous.top - next.top) < 1
                && Math.abs(previous.width - next.width) < 1 && previous.right < next.left
                && previous.height >= 44 && next.height >= 44
                && buttons.every(button => button.scrollWidth <= button.clientWidth + 1);
            }), `${mode} ${width}px: previous/next remain equal-width and side-by-side`);
          }
          if (width === 390) await page.screenshot({ path: path.join(artifacts, `${mode}-${route}.png`), fullPage: true });
          if (route === 'apply' && width === 390) {
            await page.click('.applicant-public-step-navigation [data-applicant-action="back-home"]');
            await page.waitForFunction(() => location.pathname === '/applicant');
            assert.equal(await page.$$('.applicant-member-tile').then(items => items.length), 4, 'previous returns to signed-in member menu');
            assert.equal(await page.$('#verificationEmail'), null, 'previous never opens email verification');
            await page.click('[data-applicant-action="member-apply"]');
            await page.waitForFunction(() => location.pathname === '/applicant/apply');
            await page.click('[data-applicant-action="continue-application"]');
            await page.waitForFunction(() => location.pathname === '/applicant/form');
            assert.equal(await page.$eval('#applicationEmail', el => el.value), 'preview@example.com', 'member identity is restored when re-entering application');
          }
        }
      }
      console.log(`PASS: ${mode} verification/application layout on mobile and desktop`);
    }
    await page.goto(base + '/applicant/verify?preview=1', { waitUntil: 'networkidle2' });
    await page.type('#verificationName', '홍길동');
    await page.type('#verificationEmail', 'preview@example.com');
    assert(await page.$eval(verify, el => el.disabled));
    await page.click(send);
    await page.waitForFunction(selector => /재발송까지 \d+초/.test(document.querySelector(selector).textContent), {}, send);
    const firstCount = await page.$eval(send, el => Number(el.textContent.match(/\d+/)[0]));
    assert(firstCount > 0 && firstCount <= 10);
    await page.$eval(send, el => { el.disabled = false; el.click(); });
    assert.equal(sends, 1, 'handler also guards rapid resend');
    await page.reload({ waitUntil: 'networkidle2' });
    assert(await page.$eval(send, el => el.disabled && /재발송까지/.test(el.textContent)), 'reload preserves countdown');
    await page.type('#verificationCode', '12345');
    assert(await page.$eval(verify, el => el.disabled));
    await page.type('#verificationCode', '6');
    assert.equal(await page.$eval(verify, el => el.disabled), false);
    await page.keyboard.press('Backspace');
    assert(await page.$eval(verify, el => el.disabled));
    await page.$eval('#verificationCode', el => { el.value = 'abc123456789'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.$eval('#verificationCode', el => el.value), '123456');
    await page.evaluate(() => { window.testTimeOffset = 11000; });
    await page.waitForFunction(selector => !document.querySelector(selector).disabled, {}, send);
    failSend = true;
    await page.click(send);
    await page.waitForFunction(selector => !document.querySelector(selector).disabled, {}, send);
    assert.equal(sends, 2, 'failed sends may be retried');
    failSend = false;
    await page.click(send);
    await page.waitForFunction(selector => /재발송까지/.test(document.querySelector(selector).textContent), {}, send);
    await page.type('#verificationCode', '123456');
    await page.evaluate(() => { window.testTimeOffset = 320000; });
    await page.waitForFunction(selector => document.querySelector(selector).disabled, {}, verify);
    await page.click(send);
    await page.waitForFunction(selector => /재발송까지/.test(document.querySelector(selector).textContent), {}, send);
    await page.type('#verificationCode', '123456');
    await page.click(verify);
    await page.waitForFunction(() => location.pathname === '/applicant/form');
    assert(await page.$('.public-school-home'));
    await page.click('.public-school-home');
    await page.waitForFunction(() => location.pathname === '/applicant');
    assert.deepEqual(errors, []);
    console.log('PASS: matching cards, home icons, removed descriptions/back buttons, cooldown/reload/retry, six-digit gating, expiry, verification navigation');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
