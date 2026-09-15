const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { PDFDocument } = require('pdf-lib');

async function run() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'applicant-upload-'));
  const pdf = await PDFDocument.create(); pdf.addPage([595, 842]);
  const pdfBytes = Buffer.from(await pdf.save());
  const pdfPath = path.join(directory, 'document.pdf'); fs.writeFileSync(pdfPath, pdfBytes);
  const imagePath = path.join(directory, 'document.png');
  fs.writeFileSync(imagePath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=', 'base64'));
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    for (const mobile of [false, true]) {
      const page = await browser.newPage(), errors = [];
      await page.setViewport({ width: mobile ? 320 : 1440, height: 900, isMobile: mobile, hasTouch: mobile });
      page.on('pageerror', error => errors.push(error.message));
      const member = { id: 1, name: '홍길동', email: 'upload@example.test', profile: {} };
      const submission = { id: 1, name: member.name, email: member.email, status: 'submitted', answerItems: [], answerMap: {}, selectionAnswers: { track: '수시', admission: '일반', series: '인문', unit: '문학' } };
      submission.answerItems = Object.entries(submission.selectionAnswers).map(([systemFieldKey, value]) => ({ systemFieldKey, value }));
      const fields = [
        { fieldKey: 'note', questionText: '확인사항', inputType: 'text' },
        { fieldKey: 'document', questionText: '첨부서류', inputType: 'file' },
        { fieldKey: 'image', questionText: '추가서류', inputType: 'file' },
      ];
      let savedAnswers;
      await page.setRequestInterception(true);
      page.on('request', request => {
        const url = new URL(request.url());
        const respond = body => request.respond({ contentType: 'application/json', body: JSON.stringify(body) });
        if (url.protocol === 'blob:') return request.continue();
        if (url.hostname !== 'localhost') return request.abort();
        if (request.isNavigationRequest() && url.pathname.startsWith('/applicant')) return request.respond({ contentType: 'text/html', body: fs.readFileSync(path.resolve(__dirname, '../applicant.html'), 'utf8') });
        if (url.pathname === '/api/public/members/session') return respond({ member });
        if (url.pathname === '/api/public/members/settings') return respond({ questions: [], terms: [] });
        if (url.pathname === '/api/public/members/application') return respond({ accessToken: 'test', submission, serverTime: Date.now(), menuWindows: { documents: { startAt: 1, endAt: 4102444800000 } } });
        if (url.pathname === '/api/public/applicant-form') return respond({ fields, documentFields: fields, settings: {}, schedules: [{ trackName: '수시', admissionName: '일반', applicantScheduleStartAt: '2020-01-01T00:00', applicantScheduleEndAt: '2099-12-31T23:59', documentSubmissionScheduleStartAt: '2020-01-01T00:00', documentSubmissionScheduleEndAt: '2099-12-31T23:59' }], recruitmentUnits: [{ id: 1, trackName: '수시', admissionName: '일반', seriesName: '인문', unitName: '문학', majorName: '' }] });
        if (url.pathname === '/api/public/members/documents' && request.method() === 'POST') {
          savedAnswers = JSON.parse(request.postData()).answers;
          return respond(submission);
        }
        if (request.method() !== 'GET') return request.abort();
        return request.continue();
      });
      for (const route of ['/applicant/form?preview=1', '/applicant/documents']) {
        await page.goto('http://localhost:3000' + route, { waitUntil: 'networkidle2' });
        await page.waitForSelector('#field-document');
        assert.equal(await page.$eval('#field-document', el => el.disabled), false, await page.$eval('body', el => el.innerText));
        await page.type('#field-note', '입력 유지 확인');
        for (const [key, filePath] of [['document', pdfPath], ['image', imagePath]]) {
          const [chooser] = await Promise.all([
            page.waitForFileChooser(),
            page.click(`[data-applicant-action="choose-upload-file"][data-applicant-upload-field-key="${key}"]`),
          ]);
          await chooser.accept([filePath]);
          await page.waitForFunction(name => document.body.innerText.includes(name), {}, path.basename(filePath));
        }
        assert.equal(await page.$eval('#field-note', el => el.value), '입력 유지 확인');
        const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({ tag: el.tagName, class: el.className, width: el.getBoundingClientRect().width })).slice(0, 15));
        assert.deepEqual(overflow, [], `${route}: no horizontal overflow`);
        await page.click('[data-applicant-action="open-uploaded-pdf-preview"]');
        await page.waitForSelector('[data-applicant-pdf-preview-close]');
        if (mobile) assert(await page.$eval('[data-applicant-pdf-preview-open]', el => el.textContent.includes('다운로드')));
        else assert(await page.$('.applicant-public-pdf-viewer iframe'));
        await page.keyboard.press('Escape');
        await page.waitForSelector('[data-applicant-pdf-preview-close]', { hidden: true });
        if (route.endsWith('/documents')) {
          await Promise.all([
            page.waitForResponse(response => response.url().endsWith('/members/documents')),
            page.click('[data-applicant-form="member-documents"] button[type="submit"]'),
          ]);
          assert.equal(savedAnswers.note, '입력 유지 확인');
          assert.equal(savedAnswers.document.fileName, 'document.pdf');
          assert.deepEqual(Buffer.from(savedAnswers.document.base64, 'base64'), pdfBytes);
          assert.deepEqual(Buffer.from(savedAnswers.image.base64, 'base64'), fs.readFileSync(imagePath));
        }
        console.log(`PASS: ${mobile ? 'mobile' : 'desktop'} ${route}: direct chooser, PDF/image upload, retained values and PDF preview`);
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    await browser.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
