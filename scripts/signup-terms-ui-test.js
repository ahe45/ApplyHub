const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const puppeteer = require('puppeteer-core');

async function run() {
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const terms = [
      { id: 'required', title: '유플러스시스템 이용약관 동의 및 개인정보 처리에 관한 긴 제목 확인', text: '필수 약관 전문\n' + '약관 내용입니다. '.repeat(100), required: true },
      { id: 'optional', title: '선택 약관', text: '선택 약관 전문', required: false },
      { id: 'required-2', title: '두 번째 필수 약관', text: '필수 약관 내용', required: true },
    ];
    let activeTerms = terms;
    const next = '[data-applicant-form="member-terms"] button[type=submit]';
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      const respond = body => request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.pathname === '/api/public/members/settings') return respond({ terms: activeTerms, termsVersion: 'test', termsEnabled: activeTerms.length > 0, questions: [], emailVerification: false });
      if (url.pathname === '/api/public/members/session') return respond({ member: null });
      if (request.method() !== 'GET') return request.abort();
      return request.continue();
    });
    const base = process.env.THEME_TEST_URL || 'http://localhost:3000';
    const artifacts = path.resolve(__dirname, '../.tmp-terms-switch-check');
    fs.mkdirSync(artifacts, { recursive: true });
    await page.goto(base + '/applicant/signup');
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => localStorage.setItem('applyhub.theme', theme), theme);
      for (const width of [320, 390, 1440]) {
        await page.setViewport({ width, height: 1000 });
        await page.reload({ waitUntil: 'networkidle2' });
        await page.waitForSelector('[data-member-term]');
        assert.deepEqual(await page.$eval('.applicant-member-signup', el => {
          const style = getComputedStyle(el);
          return { padding: style.padding, border: style.borderWidth, shadow: style.boxShadow, background: style.backgroundColor };
        }), { padding: '0px', border: '0px', shadow: 'none', background: 'rgba(0, 0, 0, 0)' });
        assert(await page.$eval('.public-school-home', home => home.querySelector('svg') && !home.textContent.trim() && home.getAttribute('aria-label') === '처음으로'), 'home button lives in shared school header');
        assert.equal(await page.$('.applicant-public-application-header button'), null, 'no duplicate panel home button');
        assert.equal(await page.$('[data-applicant-form="member-terms"] [data-applicant-action="member-home"]'), null);
        const required = '[data-member-term="required"]';
        assert(await page.$eval(required, el => !el.checked && el.type === 'radio'));
        assert.equal(await page.$$eval('.applicant-member-consent-options input:checked', els => els.length), 0, 'all terms initially unselected');
        if (width === 390) await page.screenshot({ path: path.join(artifacts, `${theme}-unselected.png`), fullPage: true });
        assert(await page.$eval(next, el => el.disabled), 'initially disabled with unaccepted required terms');
        await page.$eval('[data-applicant-form="member-terms"]', el => el.requestSubmit());
        await page.click('[data-applicant-form="member-terms"] button[type=submit]');
        assert.equal(await page.$eval('[data-member-step="terms"]', el => el.hidden), false, 'required consent blocks progression');
        assert(await page.$$eval('.applicant-member-consent-options', groups => groups.every(group => {
          const labels = [...group.querySelectorAll('label > span')];
          return labels.map(el => el.textContent).join('/') === '동의/미동의' && labels.every(el => el.getBoundingClientRect().width > 0);
        })), 'both choices stay visible');
        assert(await page.$$eval('[data-member-term-view]', buttons => buttons.every(el => !el.textContent.trim() && el.querySelector('svg') && el.getAttribute('aria-label').includes('전문보기'))));
        assert(await page.$$eval('.applicant-member-terms-consent', rows => rows.every(row => {
          const view = row.querySelector('[data-member-term-view]').getBoundingClientRect();
          const options = row.querySelector('.applicant-member-consent-options').getBoundingClientRect();
          return view.right <= options.left && Math.abs((view.top + view.bottom - options.top - options.bottom) / 2) < 1;
        })), 'full text icon sits left of consent choices on same row');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${theme} ${width}: overflow`);
        await page.focus(required);
        await page.keyboard.press('Space');
        assert(await page.$eval(required, el => el.checked));
        assert(await page.$eval(next, el => el.disabled), 'one required consent is not enough');
        await page.click('[data-member-term="required-2"]');
        assert.equal(await page.$eval(next, el => el.disabled), false, 'all required accepted, optional may remain unselected');
        assert.equal(await page.$$eval('[name="term-consent-optional"]:checked', els => els.length), 0);
        await page.click(next);
        assert(await page.$eval('[data-member-step="terms"]', el => el.hidden), 'unselected optional allows progression');
        assert.equal(await page.$eval('[data-applicant-form="member-register"]', el => getComputedStyle(el).marginTop), '0px');
        await page.click('[data-applicant-action="member-terms-back"]');
        assert.equal(await page.$$eval('[name="term-consent-optional"]:checked', els => els.length), 0, 'unselected optional stays unselected on return');
        await page.click('[data-member-term="optional"]');
        assert.equal(await page.$eval(next, el => el.disabled), false);
        await page.click('[name="term-consent-optional"][value="disagree"]');
        assert.equal(await page.$eval(next, el => el.disabled), false);
        await page.focus(required);
        assert.equal(await page.$eval('[data-applicant-form="member-terms"]', el => el.checkValidity()), true, 'optional term need not be checked');
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.$eval(required, el => el.checked), false, 'arrow keys select disagreement');
        assert(await page.$eval(next, el => el.disabled), 'revoking required consent immediately disables next');
        await page.keyboard.press('ArrowLeft');
        assert(await page.$eval(required, el => el.checked));
        assert(await page.$eval('.applicant-member-consent-options', el => el.querySelectorAll('input:checked').length === 1));
        await page.click('[data-member-term-view="required"]');
        assert.equal(await page.$eval('[data-member-term-content]', el => el.textContent), terms[0].text);
        assert(await page.$eval('#member-term-dialog', el => el.open));
        await page.keyboard.press('Escape');
        assert.equal(await page.$eval('#member-term-dialog', el => el.open), false);
        await page.click('[data-applicant-form="member-terms"] button[type=submit]');
        assert(await page.$eval('[data-member-step="terms"]', el => el.hidden));
        await page.click('[data-applicant-action="member-terms-back"]');
        assert(await page.$eval(required, el => el.checked), 'back navigation retains consent');
        assert.equal(await page.$eval(next, el => el.disabled), false);
        if (width === 390) await page.screenshot({ path: path.join(artifacts, `${theme}.png`), fullPage: true });
        await page.click('[name="term-consent-required"][value="disagree"]');
        assert.equal(await page.$eval(required, el => el.checked), false);
        assert(await page.$eval(next, el => el.disabled));
        await page.click('[data-applicant-form="member-terms"] button[type=submit]');
        assert.equal(await page.$eval('[data-member-step="terms"]', el => el.hidden), false);
        await page.click('[data-applicant-action="member-terms-all"]');
        assert(await page.$$eval('[data-member-term]', inputs => inputs.every(el => el.checked)), 'all consent includes optional terms');
        assert.equal(await page.$eval(next, el => el.disabled), false);
        await page.click('[data-applicant-action="member-terms-all"]');
        assert(await page.$$eval('[data-member-term]', inputs => inputs.every(el => el.checked)), 'repeated all consent does not clear choices');
        assert.equal(await page.$eval('[data-member-step="terms"]', el => el.hidden), false, 'all consent does not advance automatically');
        if (width === 390) await page.screenshot({ path: path.join(artifacts, `${theme}-all-consent.png`), fullPage: true });
        await page.click('[name="term-consent-required"][value="disagree"]');
        assert(await page.$eval(next, el => el.disabled), 'individual required refusal still disables next after all consent');
      }
    }
    for (const subset of [terms.filter(term => !term.required), []]) {
      activeTerms = subset;
      await page.reload({ waitUntil: 'networkidle2' });
      await page.waitForSelector(next);
      assert.equal(await page.$$eval('.applicant-member-consent-options input:checked', els => els.length), 0);
      assert.equal(await page.$eval(next, el => el.disabled), false, 'optional-only or no terms enables next immediately');
      await page.click(next);
      assert(await page.$eval('[data-member-step="terms"]', el => el.hidden));
    }
    await Promise.all([page.waitForNavigation(), page.click('.public-school-home')]);
    assert.equal(new URL(page.url()).pathname, '/login', 'home returns unsigned-up visitor to login');
    assert.deepEqual(errors, []);
    console.log('PASS: simultaneous consent choices, exclusive selection, keyboard navigation, required/optional validation, retained consent, icon dialogs, mobile/desktop and both themes');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
