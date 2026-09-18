const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const config = require('../shared/domain/applicant-form');

async function runDocumentStatusChecks({ services, query, base, call, memberCookie, submissionId }) {
  const service = services.applicantService;
  const memberPath = '/api/public/members/document-status';
  const adminPath = `/api/applicant-document-status/${submissionId}`;
  const getMember = () => call(memberPath, null, memberCookie, 'GET');
  let schedule = (await service.getApplicantSchedules())[0];
  assert.equal((await getMember()).status, 409);
  const before = { ...schedule };
  await query('ALTER TABLE app_schedule DROP COLUMN document_review_schedule_start_at, DROP COLUMN document_review_schedule_end_at, DROP COLUMN document_review_schedule_enabled');
  await services.initializeApplicationData();
  schedule = (await service.getApplicantSchedules())[0];
  assert.equal(schedule.documentReviewScheduleEnabled, true);
  assert.equal(schedule.documentSubmissionScheduleStartAt, before.documentSubmissionScheduleStartAt);
  await assert.rejects(() => service.saveApplicantSchedule({ ...schedule, documentReviewScheduleStartAt: schedule.applicantScheduleStartAt }), /모두 입력/);
  await assert.rejects(() => service.saveApplicantSchedule({ ...schedule, documentReviewScheduleStartAt: schedule.applicantScheduleEndAt, documentReviewScheduleEndAt: schedule.applicantScheduleStartAt }), /늦을 수 없습니다/);
  schedule = { ...schedule, documentReviewScheduleStartAt: schedule.applicantScheduleStartAt, documentReviewScheduleEndAt: schedule.applicantScheduleEndAt };
  await service.saveApplicantSchedules({ schedules: [schedule] });
  assert.equal((await service.getApplicantSchedules())[0].documentReviewScheduleStartAt, schedule.documentReviewScheduleStartAt);
  assert.equal(config.getApplicantDocumentReviewScheduleState(schedule, new Date(schedule.documentReviewScheduleStartAt)).isOpen, true);
  assert.equal(config.getApplicantDocumentReviewScheduleState(schedule, new Date(new Date(schedule.documentReviewScheduleEndAt).getTime() + 59999)).isOpen, true);
  assert.equal(config.getApplicantDocumentReviewScheduleState(schedule, new Date(new Date(schedule.documentReviewScheduleEndAt).getTime() + 60000)).isOpen, false);
  await service.createApplicantFormField({ formScope: 'documents', fieldKey: 'missing-document', questionText: '성적증명서', questionTextEn: 'Academic transcript', inputType: 'file', required: false });
  let result = await getMember(); assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.documents.length, 3, 'Only active document file fields are included');
  const fields = Object.fromEntries(result.body.documents.map(item => [item.fieldKey, item]));
  assert.equal(fields.document.status, 'submitted');
  assert.equal(fields['missing-document'].status, 'missing');
  assert.equal((await call(memberPath, null, '', 'GET')).status, 401);
  assert.equal((await call(adminPath, null, memberCookie, 'GET')).status, 401);
  await query('UPDATE accounts SET password_temporary = 0');
  const { initialPassword } = await services.systemService.getSystemSettings();
  const login = await call('/api/auth/login', { id: 'admin', password: initialPassword });
  assert.equal(login.status, 200);
  const save = documents => call(adminPath, { documents }, login.cookie, 'PUT');
  assert.equal((await save([{ fieldId: fields.document.fieldId, status: 'incomplete' }])).status, 200);
  assert.equal((await getMember()).body.documents.find(item => item.fieldKey === 'document').statusLabel, '미비');
  assert.equal((await save([{ fieldId: fields.document.fieldId, status: 'wrong' }])).status, 400);
  assert.equal((await save([{ fieldId: 9999999, status: 'missing' }])).status, 400);
  const outside = (await service.getApplicantFormFields()).find(field => field.fieldKey === 'application-document');
  assert.equal((await save([{ fieldId: outside.id, status: 'missing' }])).status, 400);
  // Updating unrelated answers must not discard the administrator's assessment.
  assert.equal((await call('/api/public/members/documents', { answers: { 'document-note': '수정' } }, memberCookie)).status, 200);
  assert.equal((await getMember()).body.documents.find(item => item.fieldKey === 'document').status, 'incomplete');
  const upload = { fileName: 'replacement.txt', mimeType: 'text/plain', base64: Buffer.from('replacement').toString('base64') };
  assert.equal((await call('/api/public/members/documents', { answers: { document: upload } }, memberCookie)).status, 200);
  assert.equal((await getMember()).body.documents.find(item => item.fieldKey === 'document').status, 'submitted');
  const [meta] = await query('SELECT member_id FROM app_meta WHERE id = ?', [submissionId]);
  await query('UPDATE app_meta SET member_id = NULL WHERE id = ?', [submissionId]);
  try { assert.equal((await getMember()).status, 409, 'Unlinked members cannot read another application'); }
  finally { await query('UPDATE app_meta SET member_id = ? WHERE id = ?', [meta.member_id, submissionId]); }
  await service.saveApplicantSchedule({ ...schedule, documentReviewScheduleEnabled: false });
  assert.equal((await getMember()).status, 409);
  assert.equal((await call('/api/public/members/application', null, memberCookie, 'GET')).body.menuVisibility['document-status'], false);
  await service.saveApplicantSchedule({ ...schedule, documentReviewScheduleEndAt: schedule.documentReviewScheduleStartAt });
  assert.equal((await getMember()).status, 409);
  await service.saveApplicantSchedule(schedule);
  const accountId = 'document-status-reader';
  assert.equal((await call('/api/accounts', { id: accountId, name: '조회용', role: '조회용' }, login.cookie)).status, 201);
  await query('UPDATE accounts SET password_temporary = 0 WHERE login_id = ?', [accountId]);
  const reader = await call('/api/auth/login', { id: accountId, password: initialPassword });
  assert.equal(reader.status, 200);
  assert.equal((await call(adminPath, null, reader.cookie, 'GET')).status, 403);
  assert.equal((await call(adminPath, { documents: [{ fieldId: fields.document.fieldId, status: 'missing' }] }, reader.cookie, 'PUT')).status, 403);
  const listPath = '/api/applicant-document-status';
  const list = async filters => call(`${listPath}?${new URLSearchParams(filters)}`, null, login.cookie, 'GET');
  assert.equal((await call(listPath, null, reader.cookie, 'GET')).status, 403);
  const listed = await list({});
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.documents.map(item => item.label), ['서류1', '서류2', '서류3']);
  const listedRow = listed.body.rows.find(row => row.id === submissionId);
  assert.equal(listedRow.documents.find(item => item.fieldKey === 'missing-document').questionText, '성적증명서');
  assert.equal(listedRow.documents.find(item => item.fieldKey === 'document').status, 'submitted');
  assert.equal(listedRow.documents.find(item => item.fieldKey === 'missing-document').status, 'missing');
  await save([{ fieldId: fields.document.fieldId, status: 'incomplete' }]);
  assert.equal((await list({})).body.rows.find(row => row.id === submissionId).documents.find(item => item.fieldKey === 'document').status, 'incomplete');
  for (const key of ['track', 'admission', 'series', 'unit', 'major']) {
    if (listedRow[key]) assert((await list({ [key]: listedRow[key] })).body.rows.some(row => row.id === submissionId));
    assert.equal((await list({ [key]: '없는 항목' })).body.total, 0);
  }
  assert((await list({ examineeNo: listedRow.examineeNo.slice(-3), examineeName: listedRow.name.slice(0, 2) })).body.rows.some(row => row.id === submissionId));
  const temporaryIds = [];
  try {
    for (let index = 0; index < 21; index++) {
      const inserted = await query('INSERT INTO app_meta (examinee_no) VALUES (?)', [`DOC${index}`]);
      temporaryIds.push(inserted.insertId);
      await query('INSERT INTO app_subm (id,applicant_name,email,field_key,answer_data) SELECT ?,?,?,field_key,answer_data FROM app_subm WHERE id=?', [inserted.insertId, `검색대상${index}`, `doc${index}@example.test`, submissionId]);
    }
    const firstPage = (await list({ examineeName: '검색대상' })).body;
    const secondPage = (await list({ examineeName: '검색대상', page: 2 })).body;
    assert.equal(firstPage.total, 21); assert.equal(firstPage.rows.length, 20); assert.equal(secondPage.rows.length, 1);
    assert(!firstPage.rows.some(row => row.id === secondPage.rows[0].id));
    assert.deepEqual(secondPage.documents, firstPage.documents);
  } finally {
    for (const id of temporaryIds) { await query('DELETE FROM app_subm WHERE id=?', [id]); await query('DELETE FROM app_meta WHERE id=?', [id]); }
  }
  console.log('PASS: document grid columns, statuses, recruitment filters, partial searches, pagination and list permissions');
  console.log('PASS: migration, schedule boundaries, document scope, status persistence, replacement uploads and access controls');

  const artifacts = path.resolve('.tmp-document-status'); fs.mkdirSync(artifacts, { recursive: true });
  await service.documentStatusService.save(submissionId, { documents: [{ fieldId: fields.document.fieldId, status: 'submitted' }] }, 'admin');
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const errors = [];
  const pageWithCookie = async cookie => {
    const context = await browser.createBrowserContext(); const at = cookie.indexOf('=');
    await context.setCookie({ name: cookie.slice(0, at), value: cookie.slice(at + 1), url: base });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); await page.setViewport({ width: 1440, height: 1000 }); return page;
  };
  const go = (page, route) => page.goto(base + route, { waitUntil: 'networkidle0' });
  try {
    const admin = await pageWithCookie(login.cookie);
    await go(admin, '/applicant-documents');
    await admin.waitForSelector(`[data-document-detail="${submissionId}"]`);
    assert.equal((await admin.$$('select[data-document-filter]')).length, 5);
    assert.equal((await admin.$$('input[data-document-filter]')).length, 2);
    assert.deepEqual(await admin.$$eval('.document-management-grid th[data-document-column]', cells => cells.map(cell => cell.textContent)), ['서류1', '서류2', '서류3']);
    await admin.type('#documentFilter-examineeName', '없는사람');
    await admin.waitForFunction(() => document.querySelector('.document-management-grid .table-empty-cell')?.textContent.includes('조회된 접수자가 없습니다.'));
    await admin.click('[data-document-reset]');
    await admin.waitForSelector(`[data-document-detail="${submissionId}"]:not([disabled])`);
    await admin.select('#documentFilter-track', listedRow.track);
    await admin.waitForFunction(value => document.querySelector('#documentFilter-admission option')?.parentElement.textContent.includes(value), {}, listedRow.admission);
    await admin.waitForSelector(`[data-document-detail="${submissionId}"]:not([disabled])`);
    await admin.screenshot({ path: path.join(artifacts, 'grid-desktop.png'), fullPage: true });
    assert(await admin.$eval('.document-management-grid .table-wrap', wrap => wrap.scrollWidth > wrap.clientWidth && wrap.getBoundingClientRect().right <= innerWidth));
    await admin.$eval('.document-management-grid .table-wrap', wrap => { wrap.scrollLeft = wrap.scrollWidth; });
    await admin.screenshot({ path: path.join(artifacts, 'grid-document-columns.png'), fullPage: true });
    await admin.setViewport({ width: 390, height: 900 });
    assert(await admin.$eval('.document-management-grid .table-wrap', wrap => wrap.getBoundingClientRect().right <= innerWidth + 1));
    await admin.screenshot({ path: path.join(artifacts, 'grid-mobile.png'), fullPage: true });
    await admin.setViewport({ width: 1440, height: 1000 });
    assert(await admin.$eval('[data-view=applicantHistory]', el => el.nextElementSibling.dataset.view === 'applicantDocumentManagement'));
    const badge = `[data-document-status-row="${submissionId}"][data-document-status-id="${fields.document.fieldId}"]`;
    const beforeChange = (await service.documentStatusService.detail(submissionId)).documents;
    await admin.click(badge);
    await admin.waitForSelector('#documentStatusPopover:popover-open');
    assert.equal(await admin.$('#documentManagementDetail'), null, 'Status editing does not open an applicant detail panel');
    assert.deepEqual(await admin.$$eval('[data-document-status-option] .document-status-cell', items => items.map(item => item.textContent)), ['제출완료', '미제출', '미비']);
    assert(await admin.$eval('#documentStatusPopover', el => { const rect = el.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight; }));
    await admin.screenshot({ path: path.join(artifacts, 'status-popover.png') });
    await admin.keyboard.press('Escape');
    await admin.waitForFunction(() => !document.querySelector('#documentStatusPopover'));
    assert.equal(await admin.$eval(badge, el => el === document.activeElement), true);
    await admin.click(badge);
    await admin.click('.menu-section-copy h3');
    await admin.waitForFunction(() => !document.querySelector('#documentStatusPopover'));
    assert.deepEqual((await service.documentStatusService.detail(submissionId)).documents, beforeChange);
    await admin.click(badge);
    const scrollBefore = await admin.$eval('.document-management-grid .table-wrap', el => el.scrollLeft);
    const [savedResponse] = await Promise.all([admin.waitForResponse(r => r.url().endsWith(adminPath) && r.request().method() === 'PUT'), admin.click('[data-document-status-option=incomplete]')]);
    assert.deepEqual(JSON.parse(savedResponse.request().postData()).documents, [{ fieldId: fields.document.fieldId, status: 'incomplete' }]);
    await admin.waitForFunction(() => document.body.textContent.includes('서류 제출 상태를 저장했습니다.'));
    assert.equal(await admin.$eval(badge, button => button.textContent), '미비');
    assert.equal(await admin.$eval('.document-management-grid .table-wrap', el => el.scrollLeft), scrollBefore);
    assert.deepEqual((await service.documentStatusService.detail(submissionId)).documents.filter(item => item.fieldId !== fields.document.fieldId), beforeChange.filter(item => item.fieldId !== fields.document.fieldId));
    await admin.reload({ waitUntil: 'networkidle0' });
    await admin.waitForFunction(selector => document.querySelector(selector)?.textContent === '미비', {}, badge);
    const manageButton = `[data-document-detail="${submissionId}"]`;
    await admin.click(manageButton);
    await admin.waitForSelector('dialog#documentManagementDetail[open]');
    assert.equal(await admin.$$eval('#documentManagementDetail .document-management-item', items => items.length), 3);
    assert(await admin.$('#documentManagementDetail a[download]'));
    assert.equal(await admin.$('#documentManagementDetail select'), null);
    assert(await admin.$eval('#documentManagementDetail', el => el.matches(':modal') && el.getBoundingClientRect().width <= 680));
    await admin.screenshot({ path: path.join(artifacts, 'document-detail-modal.png') });
    await admin.keyboard.press('Escape');
    await admin.waitForFunction(() => !document.querySelector('#documentManagementDetail'));
    assert(await admin.$eval(manageButton, el => el === document.activeElement));
    await admin.click(manageButton);
    await admin.waitForSelector('dialog#documentManagementDetail[open]');
    await admin.setViewport({ width: 390, height: 650 });
    assert(await admin.$eval('#documentManagementDetail', el => { const rect = el.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight; }));
    await admin.screenshot({ path: path.join(artifacts, 'document-detail-modal-mobile.png') });
    await admin.click('#documentManagementDetail .document-management-dialog-footer [data-document-close]');
    await admin.waitForFunction(() => !document.querySelector('#documentManagementDetail'));
    await admin.setViewport({ width: 1440, height: 1000 });
    await admin.screenshot({ path: path.join(artifacts, 'admin-desktop.png'), fullPage: true });
    const member = await pageWithCookie(memberCookie);
    await go(member, '/applicant');
    await member.waitForSelector('[data-applicant-action=member-document-status]:not([disabled])');
    await member.click('[data-applicant-action=member-document-status]');
    await member.waitForSelector('.applicant-document-status-badge.is-incomplete');
    assert.equal(await member.$$('.applicant-document-status-row').then(items => items.length), 3);
    assert.equal(await member.$('select[data-document-status-field]'), null);
    await member.screenshot({ path: path.join(artifacts, 'member-desktop.png'), fullPage: true });
    await member.click('[data-language="en"]');
    await member.waitForFunction(() => document.documentElement.lang === 'en');
    assert.equal(await member.$eval('.applicant-document-status-badge.is-incomplete', el => el.textContent), 'Incomplete');
    assert((await member.$eval('.applicant-document-status-list', el => el.textContent)).includes('Academic transcript'));
    await member.screenshot({ path: path.join(artifacts, 'member-english.png'), fullPage: true });
    await member.click('[data-language="ko"]');
    await member.reload({ waitUntil: 'networkidle0' });
    await member.waitForSelector('.applicant-document-status-badge.is-incomplete');
    for (const width of [375, 320]) {
      await member.setViewport({ width, height: 900 });
      assert(await member.$eval('.applicant-document-status-list', el => el.scrollWidth <= el.clientWidth + 1));
      await member.screenshot({ path: path.join(artifacts, `member-${width}.png`), fullPage: true });
    }
    await service.saveApplicantSchedule({ ...schedule, documentReviewScheduleEnabled: false });
    await go(member, '/applicant');
    assert.equal(await member.$('[data-applicant-action=member-document-status]'), null);
    await go(member, '/applicant/document-status');
    assert.equal(await member.$('.applicant-document-status-row'), null);
    await service.saveApplicantSchedule(schedule);
    await go(admin, '/applicant-schedules');
    await admin.waitForSelector('tr[data-grid-row-clickable=true]'); await admin.click('tr[data-grid-row-clickable=true]');
    await admin.waitForSelector('#applicantScheduleModal:not(.hidden)');
    assert.equal(await admin.$eval('[data-applicant-schedule-input=documentReviewScheduleStartAt]', el => el.value), schedule.documentReviewScheduleStartAt);
    for (const width of [1440, 375]) {
      await admin.setViewport({ width, height: 1000 });
      assert(await admin.$$eval('#applicantScheduleModal .applicant-schedule-period', rows => rows.length === 4 && rows.every(row => row.scrollWidth <= row.clientWidth + 1)));
      await admin.screenshot({ path: path.join(artifacts, `schedule-${width}.png`) });
    }
    assert.deepEqual(errors, []);
    console.log('PASS: administrator saves, member status page, direct navigation, hidden menus and responsive schedule modal');
  } finally { await browser.close(); }

  const backup = await services.systemService.buildSystemBackupArchive({ includeDatabase: true, includedAssetKeys: [] });
  const savedStatuses = await query('SELECT * FROM app_document_status ORDER BY submission_id, field_id');
  assert(savedStatuses.length);
  await query('DELETE FROM app_document_status');
  await services.systemService.restoreSystemBackupArchive(backup.archiveBuffer, { selectedRestoreItemKeys: ['database'] });
  assert.deepEqual(await query('SELECT * FROM app_document_status ORDER BY submission_id, field_id'), savedStatuses);
  const zip = new (require('adm-zip'))(backup.archiveBuffer);
  zip.deleteFile('tables/app_document_status.json');
  const manifest = JSON.parse(zip.readAsText('manifest.json'));
  manifest.tables = manifest.tables.filter(table => table.tableName !== 'app_document_status');
  zip.updateFile('manifest.json', Buffer.from(JSON.stringify(manifest)));
  await services.systemService.restoreSystemBackupArchive(zip.toBuffer(), { selectedRestoreItemKeys: ['database'] });
  assert.equal((await query('SELECT COUNT(*) AS count FROM app_document_status'))[0].count, 0);
  assert.equal((await service.documentStatusService.detail(submissionId)).documents.find(item => item.fieldKey === 'document').status, 'submitted');
  await service.documentStatusService.save(submissionId, { documents: [{ fieldId: fields.document.fieldId, status: 'incomplete' }] }, 'admin');
  await service.deleteApplicantSubmission(submissionId);
  assert.equal((await query('SELECT COUNT(*) AS count FROM app_document_status'))[0].count, 0, 'Deleting an application deletes its review statuses');
  console.log('PASS: status backup/restore, old backup compatibility and deletion cleanup');
}

module.exports = { runDocumentStatusChecks };
