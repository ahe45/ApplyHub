const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { PDFDocument, rgb } = require('pdf-lib');
const { createApplicantRoutes } = require('../server/http/routes/applications');
const { buildContentDisposition } = require('../server/http/content-disposition');

async function run() {
  const pdf = await PDFDocument.create();
  for (let number = 1; number <= 2; number++) {
    const page = pdf.addPage([595, 842]);
    page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.85, 0.92, 1) });
    page.drawText(`ADMISSION TICKET 00123456 - PAGE ${number}`, { x: 30, y: 750, size: 18 });
  }
  const bytes = Buffer.from(await pdf.save());
  const routes = createApplicantRoutes({
    buildApplicantAdmitCardPdfForAccessToken: async (token, id) => {
      assert.equal(token, 'test-token'); assert.equal(id, '1');
      return { fileNameBase: 'ticket-00123456', pdfBuffer: bytes };
    },
    buildContentDisposition,
    sendBinary: (response, status, headers, body) => ({ status, headers, body }),
  });
  const pdfRoute = routes.find(route => route.pattern?.test('/api/public/applications/1/admit-card.pdf'));
  for (const download of ['', '&download=1']) {
    const response = await pdfRoute.handler({ params: { submissionId: '1' }, searchParams: new URLSearchParams('token=test-token' + download) });
    assert(response.headers['Content-Disposition'].startsWith(download ? 'attachment;' : 'inline;'));
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.deepEqual(response.body, bytes);
  }

  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    const page = await browser.newPage();
    const benchmark = process.argv.includes('--benchmark');
    if (benchmark) {
      const session = await page.createCDPSession();
      await session.send('Network.enable');
      await session.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 1024 * 1024, uploadThroughput: 1024 * 1024 });
      await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.evaluateOnNewDocument(() => {
        new MutationObserver((_, observer) => {
          if (document.querySelector('ticket-pdf-viewer canvas:not([hidden])')) {
            performance.mark('ticket-first-page'); observer.disconnect();
          }
        }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
      });
    }
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let failPdf = false, issued = true, pdfDelay = 0, pdfRequests = 0;
    const requestedPaths = new Set();
    const submission = { id: 1, status: 'promoted', examineeNo: '00123456', name: '테스트', email: 'test@example.com', track: '수시', admission: '일반', answerItems: [], answerMap: {}, selectionAnswers: { track: '수시', admission: '일반', series: '인문', unit: '문학' } };
    await page.setRequestInterception(true);
    page.on('request', async request => {
      const url = new URL(request.url());
      requestedPaths.add(url.pathname);
      const respond = body => request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      if (request.isNavigationRequest() && url.pathname.startsWith('/applicant')) return request.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.resolve(__dirname, '../applicant.html'), 'utf8') });
      if (url.pathname.endsWith('/admit-card.pdf')) {
        pdfRequests++;
        if (pdfDelay) await new Promise(resolve => setTimeout(resolve, pdfDelay));
        if (failPdf) return request.respond({ status: 503, body: 'Unavailable' });
        return request.respond(await pdfRoute.handler({ params: { submissionId: '1' }, searchParams: url.searchParams }));
      }
      if (url.pathname === '/api/public/members/session') return respond({ member: { id: 1, name: submission.name, email: submission.email, profile: {} } });
      if (url.pathname === '/api/public/members/settings') return respond({ questions: [], terms: [] });
      if (url.pathname === '/api/public/members/application') return respond({ accessToken: 'test-token', submission: { ...submission, ...(issued ? {} : { examineeNo: '', status: 'submitted' }) }, serverTime: Date.now(), menuWindows: { ticket: { startAt: 0, endAt: 4102444800000 } } });
      if (url.pathname === '/api/public/applicant-form') return respond({ fields: [], settings: {}, recruitmentUnits: [{ id: 1, trackName: '수시', admissionName: '일반', seriesName: '인문', unitName: '문학' }], schedules: [{ trackName: '수시', admissionName: '일반', admitCardLookupScheduleStartAt: '2020-01-01T00:00', admitCardLookupScheduleEndAt: '2099-12-31T23:59' }] });
      if (request.method() !== 'GET') return request.abort();
      return request.continue();
    });
    const base = process.env.THEME_TEST_URL || 'http://localhost:3000';
    const artifacts = path.resolve(__dirname, '../.tmp-ticket-pdf-check');
    fs.mkdirSync(artifacts, { recursive: true });
    const ready = () => page.waitForFunction(() => document.querySelector('ticket-pdf-viewer')?.getAttribute('aria-busy') === 'false' && document.querySelectorAll('ticket-pdf-viewer canvas:not([hidden])').length === 2);
    for (const theme of benchmark ? ['light'] : ['light', 'dark']) {
      for (const width of benchmark ? [390] : [320, 390, 1440]) {
        await page.setViewport({ width, height: 844, isMobile: width < 500, hasTouch: width < 500, deviceScaleFactor: width < 500 ? 3 : 1 });
        await page.goto(base + '/applicant/ticket', { waitUntil: 'networkidle2' });
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        await ready();
        if (benchmark) {
          console.log('BENCHMARK', JSON.stringify(await page.evaluate(() => ({
            firstPageMs: Math.round(performance.getEntriesByName('ticket-first-page')[0].startTime),
            resources: performance.getEntriesByType('resource').filter(item => /pdf(?:\.min)?\.mjs|admit-card\.pdf/.test(item.name)).map(item => ({ path: new URL(item.name).pathname, startMs: Math.round(item.startTime), durationMs: Math.round(item.duration), bytes: item.encodedBodySize })),
            canvasWidth: document.querySelector('ticket-pdf-viewer canvas').width,
          }))));
          return;
        }
        assert.equal(await page.$('ticket-pdf-viewer iframe, .applicant-public-ticket-slab [data-applicant-action="edit-application"], .applicant-ticket-number-row a'), null);
        assert((await page.$eval('.applicant-ticket-number-row', row => row.textContent)).includes('00123456'));
        assert(await page.$eval('.applicant-public-ticket-slab .applicant-public-actions', row => {
          const back = row.querySelector('[data-applicant-action="back-home"]').getBoundingClientRect(), download = row.querySelector('a').getBoundingClientRect();
          const viewer = document.querySelector('ticket-pdf-viewer').getBoundingClientRect();
          return Math.abs(back.left - row.getBoundingClientRect().left) < 1 && back.right <= download.left && Math.abs(back.top - download.top) < 1 && Math.abs(back.width - download.width) < 1 && back.top >= viewer.bottom;
        }));
        assert(await page.$$eval('ticket-pdf-viewer canvas', canvases => canvases.every(canvas => {
          const pixel = canvas.getContext('2d').getImageData(5, 5, 1, 1).data;
          return canvas.width > 0 && pixel[3] === 255 && pixel[0] < 250 && canvas.getBoundingClientRect().width <= innerWidth;
        })), 'PDF pages contain rendered pixels');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (width === 390) await page.screenshot({ path: path.join(artifacts, theme + '.png'), fullPage: true });
        await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true });
        await ready();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        console.log(`PASS: ${theme} ${width}px: two rendered pages, toolbar-free, back/download footer, rotation`);
      }
    }
    pdfDelay = 200;
    const beforeReplacement = pdfRequests;
    await page.evaluate(() => {
      const viewer = document.querySelector('ticket-pdf-viewer');
      const replacement = viewer.cloneNode(false);
      const url = new URL(viewer.getAttribute('src'), location.href);
      url.searchParams.set('render-test', 'replacement');
      replacement.setAttribute('src', url.href);
      viewer.replaceWith(replacement);
      replacement.replaceWith(replacement.cloneNode(false));
    });
    await ready();
    assert.equal(pdfRequests - beforeReplacement, 1, 'Immediate UI replacement shares one PDF request');
    pdfDelay = 0;
    const cdp = await page.createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: artifacts, eventsEnabled: true });
    const downloaded = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Download timed out')), 15000);
      cdp.on('Browser.downloadProgress', event => { if (event.state === 'completed') { clearTimeout(timer); resolve(); } });
    });
    await page.click('.applicant-ticket-download');
    await downloaded;
    assert.deepEqual(fs.readFileSync(path.join(artifacts, 'ticket-00123456.pdf')), bytes);
    failPdf = true;
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('ticket-pdf-viewer button');
    assert(await page.$('.applicant-ticket-download'), 'Download remains available after a preview error');
    failPdf = false;
    await page.click('ticket-pdf-viewer button');
    await ready();
    await page.evaluate(() => { const viewer = document.querySelector('ticket-pdf-viewer'); viewer.load(); viewer.remove(); });
    issued = false;
    await page.reload({ waitUntil: 'networkidle2' });
    await ready();
    assert(await page.$('.applicant-ticket-download'), 'Submitted applications do not require a separate promotion to view their PDF');
    assert.deepEqual(errors, []);
    console.log('PASS: original PDF download, attachment/inline headers, error/retry, teardown, submission-based ticket');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
