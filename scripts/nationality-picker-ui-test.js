const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { findApplicantNationalityOption } = require('../shared/domain/applicant-form');

async function run() {
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    for (const mobile of [false, true]) {
      const page = await browser.newPage(), errors = [];
      await page.setViewport({ width: mobile ? 390 : 1440, height: 900, isMobile: mobile, hasTouch: mobile });
      page.on('pageerror', error => errors.push(error.message));
      await page.setRequestInterception(true);
      page.on('request', request => {
        const url = new URL(request.url());
        const respond = body => request.respond({ contentType: 'application/json', body: JSON.stringify(body) });
        if (url.hostname !== 'localhost') return request.abort();
        if (request.isNavigationRequest()) return request.respond({ contentType: 'text/html', body: fs.readFileSync(path.resolve(__dirname, '../applicant.html'), 'utf8') });
        if (url.pathname === '/api/public/applicant-form') return respond({ fields: [{ fieldKey: 'country', questionText: '국적', inputType: 'nationality' }], settings: {}, schedules: [], recruitmentUnits: [] });
        if (url.pathname === '/api/public/members/session') return respond({ member: null });
        if (url.pathname === '/api/public/members/settings') return respond({ terms: [], questions: [{ key: 'country', label: '국적', inputType: 'nationality' }] });
        if (request.method() !== 'GET') return request.abort();
        return request.continue();
      });
      for (const signup of [false, true]) {
        await page.goto(`http://localhost:3000/applicant/${signup ? 'signup' : 'form'}?preview=1`, { waitUntil: 'networkidle2' });
        if (signup) {
          await page.waitForSelector('[data-applicant-form=member-terms] button[type=submit]');
          await page.click('[data-applicant-form=member-terms] button[type=submit]');
        }
        const prefix = signup ? 'member' : 'applicant';
        const input = signup ? '[data-member-nationality-search=country]' : '#field-country';
        const picker = signup ? '[data-member-nationality-picker=country]' : '[data-applicant-nationality-picker-for=country]';
        await page.waitForSelector(input);
        for (const [code, query, keyboard] of [['KR', '대한', false], ['US', '미국', !mobile]]) {
          await page.$eval(input, element => { element.value = ''; element.dispatchEvent(new Event('input', { bubbles: true })); });
          await page.type(input, query);
          const country = findApplicantNationalityOption(code);
          const option = `[data-${prefix}-nationality-value="${signup ? code : country.label}"]`;
          await page.waitForSelector(`${picker}.is-open ${option}`);
          if (keyboard) { await page.focus(option); await page.keyboard.press('Enter'); }
          else if (mobile) await page.tap(option);
          else await page.click(option);
          assert.equal(await page.$eval(input, element => element.value), country.label);
          assert.equal(await page.$eval(picker, element => element.classList.contains('is-open')), false, `${prefix} ${mobile ? 'touch' : keyboard ? 'keyboard' : 'mouse'} selection closes the popup`);
          assert.equal(await page.$eval(input, element => document.activeElement === element), true, 'Focus returns to the input without reopening results');
          if (signup) assert.equal(await page.$eval(input, element => element.parentElement.querySelector('input[type=hidden]').value), code);
        }
        console.log(`PASS: ${signup ? 'signup' : 'application'} ${mobile ? 'mobile touch' : 'mouse/keyboard'} selection, retained value and repeated search`);
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
