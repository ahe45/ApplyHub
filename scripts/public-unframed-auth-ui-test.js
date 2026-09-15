const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const fs = require('node:fs');
const path = require('node:path');

async function run() {
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  try {
    const page = await browser.newPage(), errors = [];
    const artifacts = path.resolve(__dirname, '../.tmp-unframed-auth-check');
    fs.mkdirSync(artifacts, { recursive: true });
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith('/api/public/members/recovery/')) return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(pathname.endsWith('/request') ? { recoveryId: 'test-recovery', message: '인증번호를 발송했습니다.' } : { ok: true }) });
      if (request.method() !== 'GET') return request.abort();
      return request.continue();
    });
    const check = async selector => {
      assert.deepEqual(await page.$eval(selector, el => {
        const s = getComputedStyle(el);
        return { border: s.borderWidth, shadow: s.boxShadow, padding: s.padding, background: s.backgroundColor, radius: s.borderRadius };
      }), { border: '0px', shadow: 'none', padding: '0px', background: 'rgba(0, 0, 0, 0)', radius: '0px' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert(await page.$eval(selector, el => Math.abs(el.getBoundingClientRect().width - Math.min(520, innerWidth - 24)) < 2));
    };
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => localStorage.setItem('applyhub.theme', value), theme);
      for (const width of [320, 390, 1440]) {
        await page.setViewport({ width, height: 844 });
        await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
        await check('.common-login-stage > .login-panel-card');
        if (width === 390) await page.screenshot({ path: path.join(artifacts, `${theme}-login.png`), fullPage: true });
        await page.goto('http://localhost:3000/account-recovery?mode=password', { waitUntil: 'networkidle2' });
        await check('#accountRecoveryRoot > article');
        assert.equal(await page.$eval('#recoveryMessage', el => getComputedStyle(el).display), 'none');
        await page.type('[name=name]', '테스트');
        await page.type('[name=email]', 'test@example.test');
        if (width === 390) await page.screenshot({ path: path.join(artifacts, `${theme}-recovery.png`), fullPage: true });
        await page.click('#recoverySubmit');
        await page.waitForSelector('#recoveryProof:not([hidden])');
        await check('#accountRecoveryRoot > article');
        await page.type('[name=code]', '123456');
        await page.type('[name=password]', 'test1234');
        await page.type('[name=passwordConfirm]', 'test1234');
        await page.click('#recoverySubmit');
        await page.waitForSelector('#recoverySuccess:not([hidden])');
        await check('#accountRecoveryRoot > article');
        console.log(`PASS: ${theme} ${width}px unframed login/recovery and recovery stages (mocked)`);
      }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
