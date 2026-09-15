const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const AdmZip = require('adm-zip');
const naming = require('../shared/domain/applicant-archive');

async function verifyApplicantArchive({ services, call, base, memberCookie, submissionId }) {
  const root = '/api/applicant-submissions/archive-jobs';
  const adminLogin = await call('/api/auth/login', { id: 'admin', password: '1111' });
  const adminSetup = await call('/api/auth/password/setup', { password: 'ArchiveTest1234', passwordConfirm: 'ArchiveTest1234' }, adminLogin.cookie);
  assert.equal(adminSetup.status, 200);
  const cookie = adminSetup.cookie || adminLogin.cookie;
  const create = async options => {
    const response = await call(root, { ...naming.defaults, scope: 'all', ...options }, cookie);
    assert.equal(response.status, 202, JSON.stringify(response));
    return response.body.id;
  };
  const ready = async id => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const response = await call(`${root}/${id}`, null, cookie, 'GET');
      assert.equal(response.status, 200);
      if (response.body.status === 'ready' || response.body.status === 'failed') return response.body;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error('Archive preparation timed out');
  };
  const download = async id => {
    const response = await fetch(base + `${root}/${id}/download`, { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/zip');
    return new AdmZip(Buffer.from(await response.arrayBuffer())).getEntries().filter(entry => !entry.isDirectory);
  };
  for (const credential of ['', memberCookie]) {
    assert.equal((await call(root, { ...naming.defaults, scope: 'all' }, credential)).status, 401);
  }
  for (const invalid of [{ documents: false, photos: false }, { groupByApplicant: true, folderPattern: '../{이름}' }, { documentPattern: '{없는항목}' }, { scope: 'selected', submissionIds: [] }]) {
    assert.equal((await call(root, { ...naming.defaults, scope: 'all', ...invalid }, cookie)).status, 400);
  }
  assert.equal(naming.cleanName('CON'), '_CON');
  assert(!naming.formatName('{이름}', { name: '../../경로\\탈출' }).includes('/'));
  const original = await services.applicantService.getApplicantSubmissionById(submissionId);
  const documentAnswers = original.answerItems.filter(answer => answer.inputType === 'file' && answer.value?.hasFile);
  assert(documentAnswers.length >= 3, 'Exercise both application and document attachments');
  const existingDocuments = [];
  for (const answer of documentAnswers) {
    try { existingDocuments.push(await services.applicantService.getApplicantSubmissionFile(submissionId, answer.fieldKey)); }
    catch (error) { assert.equal(error.statusCode, 404); }
  }
  const id = await create({ photos: false, groupByApplicant: true, documentPattern: '같은이름', scope: 'selected', submissionIds: [submissionId, submissionId] });
  const finished = await ready(id);
  assert.equal(finished.status, 'ready', finished.message);
  assert.equal(finished.total, 1);
  const files = await download(id);
  assert.equal(files.length, existingDocuments.length);
  assert.equal(finished.missing, documentAnswers.length - existingDocuments.length);
  assert.equal(new Set(files.map(file => file.entryName.toLowerCase())).size, files.length);
  const folder = naming.formatName(naming.defaults.folderPattern, original);
  assert(files.every(file => file.entryName.startsWith(folder + '/같은이름')));
  assert(files.every(file => file.getData().toString().includes('content')));
  assert.equal((await call(`${root}/${id}`, null, memberCookie, 'GET')).status, 401);
  assert.throws(() => services.applicantService.attachmentArchiveJobs.status(id, 'another-admin'), /없거나 만료/);

  // Use an actual stored applicant photo, then verify each file category independently.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=', 'base64');
  await services.applicantService.updateApplicantSubmissionPhoto(submissionId, { fileName: 'portrait.png', mimeType: 'image/png', base64: png.toString('base64') });
  const photoId = await create({ scope: 'selected', submissionIds: [submissionId], documents: false, groupByApplicant: false, photoPattern: '{접수번호}_{이름}_사진' });
  assert.equal((await ready(photoId)).status, 'ready');
  const photos = await download(photoId);
  assert.equal(photos.length, 1);
  assert(!photos[0].entryName.includes('/'));
  assert.match(photos[0].entryName, /_사진\.png$/);
  assert.deepEqual(photos[0].getData(), png);
  const combinedId = await create({ scope: 'filtered', submissionIds: [submissionId], groupByApplicant: false });
  assert.equal((await ready(combinedId)).status, 'ready');
  const combined = await download(combinedId);
  assert.equal(combined.length, existingDocuments.length + 1);
  assert(combined.every(file => !file.entryName.includes('/')));
  assert(combined.some(file => file.entryName.includes('졸업증명서')));
  const emptyId = await create({ scope: 'selected', submissionIds: [999999999], documents: false });
  assert.equal((await ready(emptyId)).status, 'failed');
  assert.equal((await fetch(base + `${root}/${emptyId}/download`, { headers: { cookie } })).status, 409);
  console.log('PASS: archive API authorization, categories, actual file bytes, folders, naming, collisions and empty results');

  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    const page = await browser.newPage(), errors = [];
    const artifacts = path.resolve(__dirname, '../.tmp-archive-check'); fs.mkdirSync(artifacts, { recursive: true });
    const downloadDirectory = path.join(artifacts, 'downloads'); fs.mkdirSync(downloadDirectory, { recursive: true });
    const downloadSession = await browser.target().createCDPSession();
    await downloadSession.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: downloadDirectory, eventsEnabled: true });
    const browserDownloads = [], completedDownloads = new Set();
    downloadSession.on('Browser.downloadWillBegin', event => browserDownloads.push(event));
    downloadSession.on('Browser.downloadProgress', event => { if (event.state === 'completed') completedDownloads.add(event.guid); });
    let holdArchiveProgress = true, failStatusOnce = false;
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (request.method() === 'GET' && /\/archive-jobs\/[a-f0-9-]+$/.test(url.pathname)) {
        if (holdArchiveProgress) return request.respond({ contentType: 'application/json', body: JSON.stringify({ id: url.pathname.split('/').pop(), status: 'building', total: 2, completed: 1, files: 2 }) });
        if (failStatusOnce) { failStatusOnce = false; return request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '일시적인 연결 오류' }) }); }
      }
      return request.continue();
    });
    page.on('pageerror', error => errors.push(error.message));
    const separator = cookie.indexOf('=');
    await browser.setCookie({ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), url: base });
    await page.goto(base + '/applicant-history', { waitUntil: 'networkidle2' });
    const menuButton = '[data-open-modal="applicantSubmissionDownloadModal"]';
    const menu = '#applicantSubmissionDownloadModal';
    await page.waitForSelector(menuButton, { timeout: 10000 });
    assert.equal(await page.$('[data-applicant-archive-open]'), null, 'Only the common download button remains');
    assert.equal(await page.$$eval(menuButton, buttons => buttons.length), 1);
    await page.click(menuButton);
    assert.deepEqual(await page.$$eval(`${menu} .applicant-submission-download-actions button`, buttons => buttons.map(button => button.textContent.trim())), ['접수 이력 데이터', '수험생 사진', '제출 서류']);
    await page.screenshot({ path: path.join(artifacts, 'download-choices.png') });
    await page.click(`${menu} [data-download-applicant-submission-data]`);
    for (let attempt = 0; !browserDownloads.length || !completedDownloads.has(browserDownloads[0].guid); attempt++) {
      assert(attempt < 100, 'Excel should download directly'); await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.match(browserDownloads[0].suggestedFilename, /\.xlsx$/);
    assert(new AdmZip(fs.readFileSync(path.join(downloadDirectory, browserDownloads[0].guid))).getEntry('xl/workbook.xml'));
    assert.equal(await page.$('.applicant-archive-dialog[open]'), null, 'Excel requires no settings dialog');
    browserDownloads.length = 0; completedDownloads.clear();
    await page.click(menuButton);
    await page.click(`${menu} [data-applicant-archive-kind=documents]`);
    await page.waitForSelector('.applicant-archive-dialog[open]');
    const dialog = '.applicant-archive-dialog';
    assert.equal(await page.$eval(`${dialog} [name=groupByApplicant]`, el => el.checked), false);
    assert.equal(await page.$eval(`${dialog} [data-pattern=folderPattern]`, el => el.hidden), true);
    assert.equal(await page.$(`${dialog} footer [data-archive-close]`), null);
    assert.equal(await page.$eval(`${dialog} [data-archive-start]`, el => el.textContent), '다운로드');
    assert.equal(await page.$eval(`${dialog} h2`, el => el.textContent), '제출 서류 다운로드');
    assert.equal(await page.$$eval(`${dialog} [role=switch]`, switches => switches.length), 1);
    assert.equal(await page.$(`${dialog} [name=photoPattern]`), null);
    assert(await page.$$eval(`${dialog} .archive-switch-row`, rows => rows.every(row => row.querySelector('.archive-switch').getBoundingClientRect().left > row.firstElementChild.getBoundingClientRect().right)));
    assert.equal(await page.$$eval(`${dialog} [data-archive-editor=folderPattern] [data-archive-chip]`, chips => chips.length), 1);
    assert.deepEqual(await page.$$eval(`${dialog} input[type=hidden]`, inputs => inputs.map(input => input.value)), ['{수험번호}', '{수험번호}_{서류명}']);
    assert.equal(await page.$(`${dialog} .archive-pattern svg`), null);
    assert(await page.$$eval(`${dialog} [data-archive-chip]`, chips => chips.every(chip => chip.textContent === chip.dataset.archiveChip)));
    const editor = `${dialog} [data-archive-editor=documentPattern]`;
    await page.focus(editor);
    await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
    await page.keyboard.type('prefix_');
    await page.click(`${dialog} [data-pattern=documentPattern] .archive-tag-panel > summary`);
    assert.equal(await page.$(`${dialog} input[type=search]`), null);
    assert.equal(await page.$$eval(`${dialog} [data-pattern=documentPattern] [data-archive-token]:not([hidden])`, buttons => buttons.length), 8);
    await page.click(`${dialog} [data-target=documentPattern][data-archive-token="이름"]`);
    assert.equal(await page.$eval(`${dialog} [name=documentPattern]`, el => el.value), 'prefix_{이름}');
    assert.equal(await page.$$eval(`${editor} [data-archive-chip]`, chips => chips.length), 1);
    await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control');
    assert.equal(await page.$eval(`${dialog} [name=documentPattern]`, el => el.value), 'prefix_', 'Native undo removes the inserted tag');
    await page.click(`${dialog} [data-target=documentPattern][data-archive-token="이름"]`);
    await page.keyboard.type('_');
    assert.equal(await page.$eval(`${dialog} [name=documentPattern]`, el => el.value), 'prefix_{이름}_', 'Typing continues after a tag');
    await page.$eval(editor, el => {
      const transfer = new DataTransfer(); transfer.setData('text/plain', '{접수번호}'); transfer.setData('text/html', '<img src=x onerror=alert(1)>');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
    });
    assert.equal(await page.$eval(`${dialog} [name=documentPattern]`, el => el.value), 'prefix_{이름}_{접수번호}');
    assert.equal(await page.$(`${editor} img`), null);
    await page.click(`${dialog} [data-pattern=documentPattern] .archive-tag-panel > summary`);
    assert.equal(await page.$(`${dialog} [name=scope]`), null);
    await page.click(`${dialog} [name=groupByApplicant]`);
    assert.equal(await page.$eval(`${dialog} [data-pattern=folderPattern]`, el => el.hidden), false);
    await page.click(`${dialog} [name=groupByApplicant]`);
    assert.equal(await page.$eval(`${dialog} [data-pattern=folderPattern]`, el => el.hidden), true);
    await page.$eval(`${dialog} [name=documentPattern]`, el => { el.value = '{접수번호}_{서류명}'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.$(`${dialog} [data-archive-preview]`), null);
    const [response] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/archive-jobs') && response.request().method() === 'POST'),
      page.click(`${dialog} [data-archive-start]`),
    ]);
    const body = JSON.parse(response.request().postData());
    assert.equal(body.photos, false);
    assert.equal(body.documents, true);
    assert.equal(body.scope, 'filtered');
    assert.deepEqual(body.submissionIds, [submissionId]);
    assert.equal(body.groupByApplicant, false);
    assert.equal(body.documentPattern, '{접수번호}_{서류명}');
    assert.equal(await page.$eval(editor, el => el.getAttribute('aria-disabled')), 'true', 'Name editing is disabled while the ZIP is prepared');
    await page.waitForSelector('.archive-progress-overlay[open]');
    await page.waitForFunction(() => document.querySelector('.archive-progress-overlay [role=progressbar]')?.getAttribute('aria-valuenow') === '50');
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('.archive-progress-overlay', el => el.open), true, 'Escape cannot dismiss an active operation');
    assert.equal(browserDownloads.length, 0, 'Download must wait for completion');
    for (const width of [390, 1280]) {
      await page.setViewport({ width, height: 900 });
      assert(await page.$eval('.archive-progress-overlay', el => el.getBoundingClientRect().left >= 0 && el.scrollWidth <= el.clientWidth + 1));
      await page.screenshot({ path: path.join(artifacts, `progress-${width}.png`) });
    }
    holdArchiveProgress = false; failStatusOnce = true;
    await page.waitForSelector(`${dialog} [data-archive-retry]:not([hidden])`);
    assert.equal(await page.$eval('.archive-progress-overlay', el => el.open), false, 'Connection errors release the blocking overlay');
    await page.click(`${dialog} [data-archive-retry]`);
    await page.waitForSelector(`${dialog} [data-archive-download]:not([hidden])`);
    const uiId = (await response.json()).id;
    for (let attempt = 0; !browserDownloads.length || !completedDownloads.has(browserDownloads[0].guid); attempt++) {
      assert(attempt < 100, 'Automatic browser download must finish');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(browserDownloads.length, 1, 'Completion starts exactly one automatic download');
    assert(browserDownloads[0].url.endsWith(`/archive-jobs/${uiId}/download`));
    assert.equal(await page.$eval('.archive-progress-overlay', el => el.open), false);
    const uiFiles = new AdmZip(fs.readFileSync(path.join(downloadDirectory, browserDownloads[0].guid))).getEntries().filter(entry => !entry.isDirectory);
    assert.equal(uiFiles.length, existingDocuments.length);
    assert(uiFiles.every(file => !file.entryName.includes('/') && !file.entryName.endsWith('.png')));
    for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
      await page.setViewport({ width, height: 900 });
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      assert(await page.$eval(dialog, el => el.scrollWidth <= el.clientWidth + 1));
      await page.screenshot({ path: path.join(artifacts, `${theme}-${width}.png`) });
    }
    await page.click(`${dialog} [data-pattern=documentPattern] .archive-tag-panel > summary`);
    assert.equal(await page.$eval(`${dialog} [data-archive-download]`, el => el.hidden), false, 'Opening the tag list does not invalidate a prepared ZIP');
    await page.setViewport({ width: 1280, height: 1400 });
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; document.querySelector('.applicant-archive-dialog').scrollTop = 0; });
    await page.screenshot({ path: path.join(artifacts, 'data-tag-panel.png') });
    await page.click(`${dialog} [name=groupByApplicant]`);
    assert.equal(await page.$eval(`${dialog} [data-archive-download]`, el => el.hidden), true, 'Changed options invalidate the previous ZIP link');
    await page.$eval(`${dialog} [name=folderPattern]`, input => { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click(`${dialog} [data-archive-start]`);
    assert.match(await page.$eval(`${dialog} [data-archive-status]`, el => el.textContent), /이름 규칙/);
    assert.equal(await page.$eval('.archive-progress-overlay', el => el.open), false, 'Invalid selection never opens a blocking overlay');
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval(dialog, el => el.open), false);
    await page.click(menuButton);
    await page.click(`${menu} [data-applicant-archive-kind=photos]`);
    await page.waitForSelector(`${dialog}[open] [name=photoPattern]`);
    assert.equal(await page.$eval(`${dialog} h2`, el => el.textContent), '수험생 사진 다운로드');
    assert.equal(await page.$$eval(`${dialog} [data-archive-editor]`, editors => editors.length), 1);
    assert.equal(await page.$(`${dialog} [role=switch]`), null);
    assert.equal(await page.$(`${dialog} [name=documentPattern]`), null);
    assert.equal(await page.$(`${dialog} [name=scope]`), null);
    await page.$eval(`${dialog} [name=photoPattern]`, input => { input.value = '{접수번호}'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.setViewport({ width: 1280, height: 900 });
    await page.screenshot({ path: path.join(artifacts, 'photo-settings.png') });
    const [photoResponse] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/archive-jobs') && response.request().method() === 'POST'),
      page.click(`${dialog} [data-archive-start]`),
    ]);
    const photoOptions = JSON.parse(photoResponse.request().postData());
    assert.equal(photoOptions.photos, true); assert.equal(photoOptions.documents, false); assert.equal(photoOptions.groupByApplicant, false);
    for (let attempt = 0; browserDownloads.length < 2 || !completedDownloads.has(browserDownloads[1].guid); attempt++) {
      assert(attempt < 100, 'Photos should download automatically'); await new Promise(resolve => setTimeout(resolve, 50));
    }
    const photoEntries = new AdmZip(fs.readFileSync(path.join(downloadDirectory, browserDownloads[1].guid))).getEntries().filter(entry => !entry.isDirectory);
    assert.equal(photoEntries.length, 1); assert.equal(photoEntries[0].entryName, `${submissionId}.png`); assert.deepEqual(photoEntries[0].getData(), png);
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    console.log('PASS: single download menu, direct Excel, separate document/photo settings, tag editing, progress recovery and automatic downloads with matching files');
  } finally { await browser.close(); }
}
module.exports = { verifyApplicantArchive };
