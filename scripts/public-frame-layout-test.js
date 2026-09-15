const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { PDFDocument } = require('pdf-lib');

async function run() {
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const artifacts = path.resolve(__dirname, '../.tmp-public-frame-check');
  fs.mkdirSync(artifacts, { recursive: true });
  try {
    const page = await browser.newPage(), errors = [];
    const pdf = await PDFDocument.create(); pdf.addPage([595, 842]);
    const pdfBytes = Buffer.from(await pdf.save());
    let route = '', completed = true;
    const member = { id: 1, name: '홍길동', email: 'preview@example.test', profile: {} };
    const selection = { track: '수시', admission: '일반', series: '인문', unit: '문학', major: '' };
    const submission = { id: 1, name: member.name, email: member.email, status: 'promoted', promotedExamineeNo: '20260001', selectionAnswers: selection,
      answerMap: { school: '테스트고등학교' }, answerItems: [{ fieldKey: 'school', questionText: '출신학교', inputType: 'text', value: '테스트고등학교' }] };
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      const respond = data => request.respond({ contentType: 'application/json', body: JSON.stringify(data) });
      if (url.hostname !== 'localhost') return request.abort();
      if (request.isNavigationRequest() && url.pathname.startsWith('/applicant')) return request.respond({ contentType: 'text/html', body: fs.readFileSync(path.resolve(__dirname, '../applicant.html'), 'utf8') });
      if (url.pathname === '/api/public/members/session') return respond({ member: route === '/applicant/signup' ? null : member });
      if (url.pathname === '/api/public/members/settings') return respond({ questions: [], terms: [] });
      if (url.pathname === '/api/public/members/application') return respond({ accessToken: 'preview', submission: completed ? submission : null, serverTime: Date.now(), menuWindows: { ticket: { startAt: 1, endAt: 4102444800000 }, documents: { startAt: 1, endAt: 4102444800000 } } });
      if (url.pathname.endsWith('/admit-card.pdf')) return request.respond({ contentType: 'application/pdf', body: pdfBytes });
      if (url.pathname === '/api/public/applicant-form') return respond({ fields: [{ fieldKey: 'school', questionText: '출신학교', inputType: 'text', required: true }],
        documentFields: [{ fieldKey: 'document', questionText: '졸업증명서', inputType: 'file', required: false }], settings: {}, noticeHtml: '<p>접수 기간과 제출 서류를 확인해 주세요.</p>',
        recruitmentUnits: [{ id: 1, trackName: '수시', admissionName: '일반', seriesName: '인문', unitName: '문학', majorName: '' }],
        schedules: [{ trackName: '수시', admissionName: '일반', applicantScheduleStartAt: '2020-01-01T00:00', applicantScheduleEndAt: '2099-12-31T23:59', admitCardLookupScheduleStartAt: '2020-01-01T00:00', admitCardLookupScheduleEndAt: '2099-12-31T23:59', documentSubmissionScheduleStartAt: '2020-01-01T00:00', documentSubmissionScheduleEndAt: '2099-12-31T23:59' }] });
      if (request.method() !== 'GET') return request.abort();
      return request.continue();
    });
    const cases = [
      ['/login', '#loginAccountId'], ['/applicant', '.applicant-member-tile'], ['/applicant/signup', '[data-applicant-form=member-terms]'],
      ['/account-recovery', '#accountRecoveryRoot > article'], ['/applicant/form?preview=1', '#field-school'],
      ['/applicant/apply', '#applicationSelection-track'],
      ['/applicant/lookup/result', '.applicant-public-summary-grid'], ['/applicant/documents', '#field-document'], ['/applicant/ticket', 'ticket-pdf-viewer canvas'],
    ];
    for (const width of [320, 390, 1440]) for (const theme of ['light', 'dark']) {
      await page.setViewport({ width, height: 844 });
      for (const [nextRoute, ready] of cases) {
        if (process.argv.includes('--focus-only') && !['/applicant/apply', '/applicant/form?preview=1'].includes(nextRoute)) continue;
        route = nextRoute; completed = !route.includes('/form') && !route.includes('/apply');
        await page.goto('http://localhost:3000' + route, { waitUntil: 'networkidle2' });
        await page.waitForSelector(ready).catch(async error => { throw new Error(`${route}: ${error.message}; ${await page.$eval('body', el => el.innerText.slice(0, 600))}`); });
        await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
        if (['/applicant/apply', '/applicant/form?preview=1'].includes(route)) {
          await page.$eval(ready, input => input.focus({ preventScroll: true }));
          const clipped = await page.$eval(ready, input => {
            const bounds = input.getBoundingClientRect(), style = getComputedStyle(input);
            const outset = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
            const ancestors = [];
            for (let parent = input.parentElement; parent; parent = parent.parentElement) {
              const clipping = getComputedStyle(parent).overflowX;
              const rect = parent.getBoundingClientRect();
              if (['hidden', 'clip', 'auto', 'scroll'].includes(clipping) && (bounds.left - outset < rect.left || bounds.right + outset > rect.right)) ancestors.push(parent.className);
            }
            return ancestors;
          });
          assert.deepEqual(clipped, [], `${width} ${theme} ${route}: focus outline must not be clipped by page containers`);
        }
        const geometry = await page.evaluate(() => {
          const frame = document.querySelector('.applicant-public-frame, .app-shell.auth-locked .common-login-stage');
          const bounds = frame.getBoundingClientRect(), style = getComputedStyle(frame);
          const visibleChildren = [...(frame.querySelector('#applicantPageRoot, #accountRecoveryRoot') || frame).children].filter(el => getComputedStyle(el).position !== 'fixed' && el.getBoundingClientRect().height > 0);
          const contentTop = Math.min(...visibleChildren.map(el => el.getBoundingClientRect().top)), contentBottom = Math.max(...visibleChildren.map(el => el.getBoundingClientRect().bottom));
          const scroll = document.querySelector('.app-shell.auth-locked .content-area') || document.documentElement;
          return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, border: style.borderTopWidth, scrollHeight: scroll.scrollHeight,
            overflow: document.documentElement.scrollWidth > innerWidth, center: (contentTop + contentBottom) / 2,
            panels: [...document.querySelectorAll('.applicant-public-step > .applicant-public-slab')].map(el => ({ padding: getComputedStyle(el).padding, border: getComputedStyle(el).borderTopWidth })) };
        });
        assert.equal(geometry.overflow, false, `${width} ${route}: no horizontal scrolling`);
        assert.equal(geometry.width, Math.min(width, 520));
        assert.equal(geometry.x, (width - geometry.width) / 2);
        assert.equal(geometry.y, 0);
        assert.equal(geometry.border, '1px');
        assert(geometry.height >= 844);
        assert(geometry.panels.every(panel => panel.padding === '0px' && panel.border === '0px'), `${route}: page content has no nested frame`);
        if (geometry.height === 844) {
          assert.equal(geometry.scrollHeight, 844, `${route}: no empty scroll space`);
          assert(Math.abs(geometry.center - 422) < 3, `${route}: short content stays vertically centered (${geometry.center})`);
        }
        if (width === 390 || (width === 1440 && ['/login', '/applicant/documents'].includes(route))) {
          await page.screenshot({ path: path.join(artifacts, `${theme}-${width}-${route.replace(/[^a-z0-9]+/gi, '-')}.png`), fullPage: true });
        }
      }
      console.log(`PASS: ${theme} ${width}px ${process.argv.includes('--focus-only') ? 'application selection and form focus outlines' : 'login, home, signup, recovery, application, results, documents and PDF'}`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
