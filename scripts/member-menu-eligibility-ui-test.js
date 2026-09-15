const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

async function run() {
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  try {
    const page = await browser.newPage(), errors = [];
    let completed = false, ticketState = 'open', documentState = 'open', failContext = false, conflict = false, submissions = 0;
    const member = { id: 1, name: '테스트', email: 'test@example.com', profile: {} };
    const submission = { id: 1, name: member.name, email: member.email, status: 'submitted', answerItems: [], answerMap: {}, selectionAnswers: { track: '수시', admission: '일반', series: '인문', unit: '문학' } };
    const windowFor = state => {
      const now = Date.now();
      if (state === 'unset') return { startAt: null, endAt: null };
      if (state === 'before') return { startAt: now + 60000, endAt: now + 120000 };
      if (state === 'ended') return { startAt: now - 120000, endAt: now - 60000 };
      if (state === 'ending') return { startAt: now - 60000, endAt: now + 2000 };
      if (state === 'starting') return { startAt: now + 2000, endAt: now + 60000 };
      return { startAt: now - 60000, endAt: now + 60000 };
    };
    page.on('pageerror', error => errors.push(error.message));
    await page.evaluateOnNewDocument(() => { const now = Date.now.bind(Date); window.testAdvance = 0; Date.now = () => now() + window.testAdvance; });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      const respond = (body, status = 200) => request.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.pathname === '/api/public/applications' && request.method() === 'POST') {
        submissions++; completed = true;
        return respond(conflict ? { error: '이미 접수가 완료되었습니다.', code: 'APPLICANT_ALREADY_SUBMITTED' } : submission, conflict ? 409 : 200);
      }
      if (request.isNavigationRequest() && url.pathname.startsWith('/applicant')) return request.respond({ status: 200, contentType: 'text/html', body: fs.readFileSync(path.resolve(__dirname, '../applicant.html'), 'utf8') });
      if (url.pathname === '/api/public/members/session') return respond({ member });
      if (url.pathname === '/api/public/members/settings') return respond({ questions: [], terms: [] });
      if (url.pathname === '/api/public/members/application') return respond(failContext ? { error: '일시적 오류' } : { accessToken: 'test', submission: completed ? submission : null, serverTime: Date.now(), menuWindows: { ticket: windowFor(ticketState), documents: windowFor(documentState) } }, failContext ? 503 : 200);
      if (url.pathname === '/api/public/applicant-form') return respond({
        fields: [{ fieldKey: 'name', questionText: '이름', inputType: 'text', systemFieldKey: 'name', required: true }], settings: {},
        recruitmentUnits: [{ id: 1, trackName: '수시', admissionName: '일반', seriesName: '인문', unitName: '문학', majorName: '' }],
        schedules: [{ trackName: '수시', admissionName: '일반', applicantScheduleStartAt: '2020-01-01T00:00', applicantScheduleEndAt: '2099-12-31T23:59', admitCardLookupScheduleStartAt: '2020-01-01T00:00', admitCardLookupScheduleEndAt: '2099-12-31T23:59', documentSubmissionScheduleStartAt: '2020-01-01T00:00', documentSubmissionScheduleEndAt: '2099-12-31T23:59' }],
      });
      if (request.method() !== 'GET') return request.abort();
      return request.continue();
    });
    const artifacts = path.resolve(__dirname, '../.tmp-member-menu-check'); fs.mkdirSync(artifacts, { recursive: true });
    const selector = key => `[data-applicant-action="member-${key}"]`;
    const read = () => page.$$eval('.applicant-member-tile', buttons => buttons.map(button => ({ label: button.querySelector('strong').textContent, disabled: button.disabled })));
    const go = async route => { await page.goto('http://localhost:3000' + route, { waitUntil: 'networkidle2' }); await page.waitForSelector('.applicant-member-tile'); };
    for (const theme of process.argv.includes('--flow-only') ? [] : ['light', 'dark']) for (const width of [320, 390, 1440]) {
      await page.setViewport({ width, height: 844 });
      for (const scenario of [[false, 'open', 'open'], [true, 'open', 'open'], [true, 'before', 'open'], [true, 'open', 'ended'], [true, 'unset', 'unset']]) {
        [completed, ticketState, documentState] = scenario;
        await go('/applicant');
        await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
        assert.deepEqual(await read(), [
          { label: completed ? '접수완료' : '원서접수', disabled: completed },
          { label: '서류 제출', disabled: !completed || documentState !== 'open' },
          { label: '접수결과 조회', disabled: !completed },
          { label: '수험표 조회', disabled: !completed || ticketState !== 'open' },
        ]);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        if (width === 390 && ticketState === 'open' && documentState === 'open') await page.screenshot({ path: path.join(artifacts, `${theme}-${completed ? 'complete' : 'before'}.png`), fullPage: true });
      }
      console.log(`PASS: ${theme} ${width}px: submission state and independent schedule windows`);
    }
    ticketState = 'open'; documentState = 'open';
    for (const shouldConflict of [false, true]) {
      completed = false; conflict = shouldConflict;
      await go('/applicant');
      await page.click(selector('apply'));
      await page.waitForSelector('#applicationSelection-track');
      for (const key of ['track', 'admission', 'series', 'unit', 'major']) {
        const select = `#applicationSelection-${key}`;
        if (await page.$(select)) {
          const value = await page.$eval(select, el => [...el.options].find(option => option.value)?.value);
          if (value) await page.select(select, value);
        }
      }
      await page.click('[data-applicant-action="continue-application"]');
      await page.waitForSelector('[data-applicant-form="application"]');
      await page.click('[data-applicant-form="application"] button[type="submit"]');
      if (!shouldConflict) {
        await page.waitForSelector('[data-applicant-action="confirm-result"]');
        await page.click('[data-applicant-action="confirm-result"]');
      }
      await page.waitForSelector('.applicant-member-menu');
      assert.deepEqual(await read(), [{ label: '접수완료', disabled: true }, { label: '서류 제출', disabled: false }, { label: '접수결과 조회', disabled: false }, { label: '수험표 조회', disabled: false }]);
    }
    assert.equal(submissions, 2, 'Successful and duplicate-submit responses both update the menu');
    completed = true;
    await go('/applicant/form');
    assert.equal(await page.$('[data-applicant-form="application"]'), null, 'Direct application URL cannot reopen completed entry');
    assert(await page.$eval(selector('apply'), button => button.disabled));
    ticketState = 'ending'; documentState = 'starting';
    await go('/applicant');
    await page.evaluate(() => { window.testAdvance = 4000; });
    await page.waitForFunction(() => document.querySelector('[data-applicant-action="member-ticket"]').disabled && !document.querySelector('[data-applicant-action="member-documents"]').disabled);
    // Refreshing after a tab returns catches changes made by another tab/admin.
    completed = false;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(() => !document.querySelector('[data-applicant-action="member-apply"]').disabled);
    failContext = true;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(() => [...document.querySelectorAll('.applicant-member-tile')].every(button => button.disabled));
    assert.deepEqual(errors, []);
    console.log('PASS: direct URL protection, live schedule boundaries, context refresh and fail-closed state');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
