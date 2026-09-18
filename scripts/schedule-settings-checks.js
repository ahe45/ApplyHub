const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const formConfig = require('../shared/domain/applicant-form');

async function runScheduleSettingsChecks({ services, query, base, call, memberCookie, submissionId }) {
  const service = services.applicantService;
  const enabledKeys = ['applicantScheduleEnabled', 'documentSubmissionScheduleEnabled', 'admitCardLookupScheduleEnabled'];
  const dateKeys = enabledKeys.flatMap(key => [key.replace('Enabled', 'StartAt'), key.replace('Enabled', 'EndAt')]);
  const original = (await service.getApplicantSchedules())[0];
  const originalDates = Object.fromEntries(dateKeys.map(key => [key, original[key]]));
  await query('ALTER TABLE app_schedule DROP COLUMN applicant_schedule_enabled, DROP COLUMN document_submission_schedule_enabled, DROP COLUMN admit_card_lookup_schedule_enabled');
  await services.initializeApplicationData();
  let schedule = (await service.getApplicantSchedules())[0];
  assert(enabledKeys.every(key => schedule[key] === true));
  assert.deepEqual(Object.fromEntries(dateKeys.map(key => [key, schedule[key]])), originalDates);
  await service.saveApplicantSchedule({ trackName: original.trackName, admissionCode: original.admissionCode, admissionName: original.admissionName, documentSubmissionScheduleEnabled: false });
  await service.saveApplicantSchedule({ trackName: original.trackName, admissionCode: original.admissionCode, admissionName: original.admissionName, admitCardLookupScheduleEnabled: false });
  schedule = (await service.getApplicantSchedules())[0];
  assert.equal(schedule.documentSubmissionScheduleEnabled, false, 'Partial saves retain other switches');
  assert.deepEqual(Object.fromEntries(dateKeys.map(key => [key, schedule[key]])), originalDates, 'Turning off preserves dates');
  assert.equal((await call('/api/public/members/documents', { answers: { 'document-note': '확인' } }, memberCookie)).status, 409);
  assert.equal((await call(`/api/public/applications/${submissionId}/admit-card.pdf`, null, memberCookie, 'GET')).status, 409);
  await assert.rejects(() => service.saveApplicantSchedule({ ...original, applicantScheduleEnabled: 'false' }), /사용 여부/);
  await service.saveApplicantSchedule({ ...original, applicantScheduleEnabled: false, documentSubmissionScheduleEnabled: false, admitCardLookupScheduleEnabled: false });
  assert.equal(formConfig.getApplicantSubmissionScheduleState((await service.getApplicantSchedules())[0]).isOpen, false);
  assert.equal(formConfig.getApplicantAggregateScheduleState(await service.getApplicantSchedules()).enabled, false);
  const [meta] = await query('SELECT member_id FROM app_meta WHERE id = ?', [submissionId]);
  await query('UPDATE app_meta SET member_id = NULL WHERE id = ?', [submissionId]);
  try {
    const context = await call('/api/public/members/application', null, memberCookie, 'GET');
    assert.deepEqual(context.body.menuVisibility, { apply: false, documents: false, 'document-status': true, ticket: false });
    const result = await call('/api/public/applications', { selectionAnswers: { track: original.trackName, admission: original.admissionName, series: '인문', unit: '문학' }, answers: {} }, memberCookie);
    assert.equal(result.status, 409);
    assert(result.body.code?.includes('SCHEDULE'), JSON.stringify(result.body));
  } finally { await query('UPDATE app_meta SET member_id = ? WHERE id = ?', [meta.member_id, submissionId]); }
  await query("INSERT INTO app_unit (track_name, admission_code, admission_name, series_code, series_name, unit_code, unit_name) VALUES ('정시','9','별도전형','8','자연','7','수학')");
  await service.saveApplicantSchedule({ ...original, trackName: '정시', admissionCode: '9', admissionName: '별도전형', applicantScheduleStartAt: '2030-01-01T09:00', applicantScheduleEndAt: '2030-01-31T18:00' });
  const context = (await call('/api/public/members/application', null, memberCookie, 'GET')).body;
  assert.deepEqual(context.menuVisibility, { apply: false, documents: false, 'document-status': true, ticket: false }, 'Other active admissions cannot enable completed applicants’ menus');
  assert.deepEqual(context.menuWindows.apply, {
    startAt: formConfig.getApplicantScheduleTimestamp(original.applicantScheduleStartAt),
    endAt: formConfig.getApplicantScheduleTimestamp(original.applicantScheduleEndAt, { inclusiveEndMinute: true }),
  }, 'Completed applicants see their own admission dates');
  await query('UPDATE app_meta SET member_id = NULL WHERE id = ?', [submissionId]);
  try {
    const before = (await call('/api/public/members/application', null, memberCookie, 'GET')).body;
    assert.equal(before.menuWindows.apply.startAt, formConfig.getApplicantScheduleTimestamp('2030-01-01T09:00'), 'Before applying, only enabled schedules contribute to displayed dates');
    await service.saveApplicantSchedule({ trackName: original.trackName, admissionCode: original.admissionCode, admissionName: original.admissionName, applicantScheduleEnabled: true });
    const varied = (await call('/api/public/members/application', null, memberCookie, 'GET')).body;
    assert.deepEqual(varied.menuWindows.apply, { startAt: null, endAt: null, variesByAdmission: true }, 'Different admission periods are not merged into a misleading date range');
  } finally {
    await query('UPDATE app_meta SET member_id = ? WHERE id = ?', [meta.member_id, submissionId]);
    await service.saveApplicantSchedule({ trackName: original.trackName, admissionCode: original.admissionCode, admissionName: original.admissionName, applicantScheduleEnabled: false });
  }
  console.log('PASS: enabled-by-default migration, preserved dates, partial saves, disabled API access and admission isolation');

  const artifacts = path.resolve('.tmp-schedule-settings'); fs.mkdirSync(artifacts, { recursive: true });
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const errors = [];
  const pageWithCookie = async cookie => {
    const ctx = await browser.createBrowserContext(); const at = cookie.indexOf('=');
    await ctx.setCookie({ name: cookie.slice(0, at), value: cookie.slice(at + 1), url: base });
    const page = await ctx.newPage(); page.on('pageerror', error => errors.push(error.message)); await page.setViewport({ width: 1440, height: 1000 }); return page;
  };
  const go = (page, route) => page.goto(base + route, { waitUntil: 'networkidle0' });
  try {
    const member = await pageWithCookie(memberCookie); await go(member, '/applicant');
    await member.waitForSelector('[data-applicant-action=member-summary]');
    for (const key of ['apply', 'documents', 'ticket']) assert.equal(await member.$(`[data-applicant-action=member-${key}]`), null);
    await query('UPDATE accounts SET password_temporary = 0');
    const { initialPassword } = await services.systemService.getSystemSettings();
    const login = await call('/api/auth/login', { id: 'admin', password: initialPassword }); assert.equal(login.status, 200);
    const admin = await pageWithCookie(login.cookie); await go(admin, '/applicant-schedules');
    await admin.waitForSelector('tr[data-grid-row-clickable=true]'); await admin.click('tr[data-grid-row-clickable=true]');
    const modal = '#applicantScheduleModal'; await admin.waitForSelector(`${modal}:not(.hidden)`);
    for (const key of enabledKeys) {
      assert.equal(await admin.$eval(`[data-applicant-schedule-input=${key}]`, el => el.checked), false);
      const start = key.replace('Enabled', 'StartAt'); assert.equal(await admin.$eval(`[data-applicant-schedule-input=${start}]`, el => el.disabled), true);
      assert.equal(await admin.$eval(`[data-applicant-schedule-input=${start}]`, el => el.value), original[start]);
    }
    const checkLayout = async width => {
      await admin.setViewport({ width, height: 900 });
      assert(await admin.$eval(`${modal} .modal-sheet`, el => { const rect = el.getBoundingClientRect(); return rect.width <= 680 && rect.left >= 0 && rect.right <= innerWidth; }));
      assert(await admin.$$eval(`${modal} .applicant-schedule-period`, rows => rows.every(row => row.scrollWidth <= row.clientWidth + 1)));
      await admin.screenshot({ path: path.join(artifacts, `schedule-${width}.png`) });
    };
    await checkLayout(1440); await checkLayout(375); await checkLayout(320); await admin.setViewport({ width: 1440, height: 1000 });
    for (const key of enabledKeys) { await admin.focus(`[data-applicant-schedule-input=${key}]`); await admin.keyboard.press('Space'); }
    await Promise.all([admin.waitForResponse(r => r.url().endsWith('/api/applicant-schedules') && r.request().method() === 'PUT'), admin.click('#applicantScheduleModalSaveButton')]);
    await admin.waitForSelector(`${modal}.hidden`);
    assert(enabledKeys.every(key => (key in original)));
    schedule = (await service.getApplicantSchedules())[0]; assert(enabledKeys.every(key => schedule[key] === true));
    assert.deepEqual(Object.fromEntries(dateKeys.map(key => [key, schedule[key]])), originalDates);
    await member.reload({ waitUntil: 'networkidle0' });
    for (const key of ['apply', 'documents', 'ticket']) assert(await member.$(`[data-applicant-action=member-${key}]`));
    assert.equal(await member.$eval('[data-applicant-action=member-documents]', el => el.disabled), false);
    await service.saveApplicantSchedule({ ...schedule, documentSubmissionScheduleEnabled: false });
    await admin.reload({ waitUntil: 'networkidle0' }); await admin.click('[data-grid-select-all]'); await admin.click('[data-applicant-schedule-bulk-edit]');
    await admin.waitForSelector(`${modal}:not(.hidden)`);
    assert.equal(await admin.$eval('[data-applicant-schedule-input=documentSubmissionScheduleEnabled]', el => el.indeterminate), true);
    await Promise.all([admin.waitForResponse(r => r.url().endsWith('/api/applicant-schedules/bulk') && r.request().method() === 'PUT'), admin.click('#applicantScheduleModalSaveButton')]);
    await admin.waitForSelector(`${modal}.hidden`);
    let schedules = await service.getApplicantSchedules(); assert.deepEqual(schedules.map(s => s.documentSubmissionScheduleEnabled), [false, true]);
    await admin.reload({ waitUntil: 'networkidle0' }); await admin.click('[data-grid-select-all]'); await admin.click('[data-applicant-schedule-bulk-edit]');
    await admin.waitForSelector(`${modal}:not(.hidden)`);
    await admin.focus('[data-applicant-schedule-input=documentSubmissionScheduleEnabled]'); await admin.keyboard.press('Space');
    await Promise.all([admin.waitForResponse(r => r.url().endsWith('/api/applicant-schedules/bulk') && r.request().method() === 'PUT'), admin.click('#applicantScheduleModalSaveButton')]);
    await admin.waitForSelector(`${modal}.hidden`);
    schedules = await service.getApplicantSchedules(); assert(schedules.every(s => s.documentSubmissionScheduleEnabled));
    assert.deepEqual(errors, []);
    console.log('PASS: hidden/re-enabled user buttons, compact responsive modal, keyboard switches, persistence and mixed bulk settings');
  } finally { await browser.close(); }
}
module.exports = { runScheduleSettingsChecks };
