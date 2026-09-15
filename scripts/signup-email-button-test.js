const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');

async function run() {
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  try {
    const page = await browser.newPage();
    let sends = 0, verifies = 0, fail = false, release;
    const releaseSend = async () => {
      const deadline = Date.now() + 5000;
      while (!release && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
      assert(release, 'send request must arrive'); release(); release = null;
    };
    await page.evaluateOnNewDocument(() => { const now = Date.now.bind(Date); window.testOffset = 0; Date.now = () => now() + window.testOffset; });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', async request => {
      const url = new URL(request.url());
      const respond = (body, status = 200) => request.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.pathname === '/api/public/members/settings') return respond({ terms: [], questions: [{ key: 'email', label: '이메일', inputType: 'email', required: true }], emailVerification: true });
      if (url.pathname === '/api/public/members/session') return respond({ member: null });
      if (url.pathname === '/api/public/members/verify-email') { verifies++; return respond({ ok: true }); }
      if (url.pathname === '/api/public/members/email-code') {
        sends++;
        await new Promise(resolve => { release = resolve; });
        return respond(fail ? { error: '테스트 발송 실패' } : { verificationId: 'test-only', debugCode: '123456' }, fail ? 500 : 200);
      }
      if (request.method() !== 'GET') return request.abort();
      request.continue();
    });
    const base = process.env.THEME_TEST_URL || 'http://localhost:3000';
    const button = '[data-applicant-action="member-send-code"]';
    const email = '[data-applicant-form="member-register"] [name=email]';
    const verify = '[data-applicant-action="member-verify-code"]';
    const setCode = value => page.$eval('#memberEmailCode', (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    const setEmail = value => page.$eval(email, (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    await page.goto(base + '/applicant/signup', { waitUntil: 'networkidle2' });
    await page.click('[data-applicant-form="member-terms"] button[type=submit]');
    assert(await page.$eval(button, el => el.disabled));
    assert(await page.$eval(verify, el => el.disabled));
    for (const value of ['', 'plain', 'a@', '@example.com', 'a@example', 'a b@example.com', 'a@@example.com', 'a@-example.com', 'a'.repeat(244) + '@example.com']) {
      await setEmail(value);
      assert(await page.$eval(button, el => el.disabled), `invalid email: ${value}`);
    }
    await page.$eval(button, el => { el.disabled = false; el.click(); });
    assert.equal(sends, 0, 'handler also rejects invalid email');
    for (const value of ['user@example.com', 'User.Name+tag@sub.example.co.kr']) {
      await setEmail(value);
      assert.equal(await page.$eval(button, el => el.disabled), false, value);
    }
    await page.click(button);
    await page.waitForFunction(selector => document.querySelector(selector).disabled, {}, button);
    await releaseSend();
    assert.equal(sends, 1);
    await page.waitForFunction(selector => document.querySelector(selector).textContent === '재발송까지 10초', {}, button);
    assert(await page.$eval(button, el => el.disabled));
    await page.$eval(button, el => { el.disabled = false; el.click(); });
    assert.equal(sends, 1, 'cooldown also blocks programmatic resend');
    await setCode('12345');
    assert(await page.$eval(verify, el => el.disabled));
    await page.$eval(verify, el => { el.disabled = false; el.click(); });
    assert.equal(verifies, 0, 'short code cannot bypass handler');
    await setCode('123456');
    assert.equal(await page.$eval(verify, el => el.disabled), false);
    await setCode('12345');
    assert(await page.$eval(verify, el => el.disabled), 'deleting a digit disables verification');
    await setCode('abc123456789');
    assert.equal(await page.$eval('#memberEmailCode', el => el.value), '123456');
    await page.click(verify);
    await page.waitForFunction(() => document.querySelector('[data-member-verified]').textContent.includes('완료'));
    assert.equal(verifies, 1);
    assert(await page.$eval(verify, el => el.disabled), 'completed verification stays disabled');
    await page.evaluate(() => { window.testOffset += 3000; });
    await page.waitForFunction(selector => /재발송까지 [1-7]초/.test(document.querySelector(selector).textContent), {}, button);
    await page.reload({ waitUntil: 'networkidle2' });
    await page.click('[data-applicant-form="member-terms"] button[type=submit]');
    await setEmail('user@example.com');
    assert(await page.$eval(button, el => el.disabled && el.textContent.includes('재발송까지')), 'reload retains cooldown');
    await page.evaluate(() => { window.testOffset = 11000; });
    await page.waitForFunction(selector => !document.querySelector(selector).disabled, {}, button);
    fail = true;
    await page.click(button);
    await releaseSend();
    await page.waitForFunction(selector => !document.querySelector(selector).disabled, {}, button);
    await setEmail('');
    assert(await page.$eval(button, el => el.disabled), 'clearing input disables immediately');
    await page.goto(base + '/applicant/signup?preview=1', { waitUntil: 'networkidle2' });
    await page.click('[data-applicant-form="member-terms"] button[type=submit]');
    await setEmail('user@example.com');
    assert(await page.$eval(button, el => el.disabled), 'preview never sends');
    assert.equal(sends, 2);
    assert.deepEqual(errors, []);
    console.log('PASS: email gating, 10-second countdown, reload, resend guard, 6-digit gating, numeric input, verification, failed-send recovery and preview; no real email sent');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
