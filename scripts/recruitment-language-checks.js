const assert = require('node:assert/strict');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { APPLICANT_UNIT_TEMPLATE_COLUMNS } = require('../server/modules/applications/config');

async function prepareRecruitmentLanguageChecks({ services, query }) {
  const service = services.applicantService;
  const getUnit = async id => (await service.getApplicantRecruitmentUnits()).find(unit => unit.id === id);
  const before = await query('SELECT id, track_name, admission_name, unit_name, major_name FROM app_unit ORDER BY id');
  await query('ALTER TABLE app_unit DROP COLUMN admission_name_en, DROP COLUMN unit_name_en, DROP COLUMN major_name_en');
  await services.initializeApplicationData();
  assert.deepEqual(await query('SELECT id, track_name, admission_name, unit_name, major_name FROM app_unit ORDER BY id'), before);
  let base = (await service.getApplicantRecruitmentUnits())[0];
  assert.equal(base.admissionNameEn, '');
  assert.equal(base.unitNameEn, '');
  assert.equal(base.majorNameEn, '');
  const english = { admissionNameEn: 'General admission', unitNameEn: 'Literature', majorNameEn: '' };
  await service.updateApplicantRecruitmentUnit(base.id, english);
  await service.updateApplicantRecruitmentUnit(base.id, { unitCode: base.unitCode });
  base = await getUnit(base.id);
  assert.equal(base.unitNameEn, english.unitNameEn, 'Partial updates preserve English');
  const expectedColumnOrder = [
    'id', 'track_name', 'admission_code', 'admission_name', 'admission_name_en',
    'series_code', 'series_name', 'unit_code', 'unit_name', 'unit_name_en',
    'major_code', 'major_name', 'major_name_en', 'sort_order', 'created_at', 'updated_at',
  ];
  const beforeReorder = await query('SELECT * FROM app_unit ORDER BY id');
  await query(`ALTER TABLE app_unit
    MODIFY COLUMN admission_name_en VARCHAR(200) NOT NULL DEFAULT '' AFTER updated_at,
    MODIFY COLUMN unit_name_en VARCHAR(200) NOT NULL DEFAULT '' AFTER admission_name_en,
    MODIFY COLUMN major_name_en VARCHAR(200) NOT NULL DEFAULT '' AFTER unit_name_en`);
  for (let pass = 0; pass < 2; pass += 1) {
    await services.initializeApplicationData();
    assert.deepEqual((await query('SHOW COLUMNS FROM app_unit')).map(column => column.Field), expectedColumnOrder);
    assert.deepEqual(await query('SELECT * FROM app_unit ORDER BY id'), beforeReorder, 'Reordering preserves all stored values');
  }
  for (const key of Object.keys(english)) {
    await assert.rejects(() => service.updateApplicantRecruitmentUnit(base.id, { [key]: 'x'.repeat(201) }), error => error.statusCode === 400);
  }
  const legacy = new ExcelJS.Workbook();
  const sheet = legacy.addWorksheet('전형');
  const columns = APPLICANT_UNIT_TEMPLATE_COLUMNS.filter(column => !column.optional);
  sheet.addRow(columns.map(column => column.aliases?.[0] || column.header));
  sheet.addRow(columns.map(column => base[column.key]));
  const fileContentBase64 = Buffer.from(await legacy.xlsx.writeBuffer()).toString('base64');
  assert.equal((await service.previewApplicantRecruitmentUnitImport({ fileContentBase64 })).unchangedCount, 1);
  await service.importApplicantRecruitmentUnits({ fileContentBase64, existingDataPolicy: 'all' });
  assert.equal((await getUnit(base.id)).unitNameEn, english.unitNameEn, 'Legacy uploads preserve English');
  const changed = { ...base, unitNameEn: 'Literature revised' };
  assert.equal((await service.previewApplicantRecruitmentUnitImport({ rows: [changed] })).updateCount, 1, 'English-only changes are detected');
  await service.importApplicantRecruitmentUnits({ rows: [changed] });
  assert.equal((await getUnit(base.id)).unitNameEn, changed.unitNameEn);
  await service.updateApplicantRecruitmentUnit(base.id, { unitNameEn: '' });
  assert.equal((await getUnit(base.id)).unitNameEn, '');
  await service.updateApplicantRecruitmentUnit(base.id, english);
  const exported = new ExcelJS.Workbook();
  await exported.xlsx.load(await service.buildApplicantRecruitmentUnitExportBuffer(await service.getApplicantRecruitmentUnits()));
  const headers = exported.worksheets[0].getRow(1).values;
  assert.deepEqual(headers.slice(1), [
    '모집시기', '전형코드', '전형명(한글)', '전형명(영어)', '계열코드', '계열',
    '모집단위코드', '모집단위명(한글)', '모집단위명(영어)', '전공코드', '전공명(한글)', '전공명(영어)',
  ]);
  assert(headers.includes('전형명(영어)') && headers.includes('모집단위명(영어)') && headers.includes('전공명(영어)'));
  assert.equal(exported.worksheets[0].getRow(2).getCell(headers.indexOf('모집단위명(영어)')).text, 'Literature');
  const special = { trackName: '영어 테스트', admissionCode: 'E1', admissionName: '특별전형', admissionNameEn: 'International admission', seriesCode: 'E2', seriesName: '인문', unitCode: 'E3', unitName: '문학', unitNameEn: 'School of Literature', majorCode: 'E4', majorName: '국문학', majorNameEn: 'Korean Literature' };
  await service.createApplicantRecruitmentUnit(special);
  const unit = (await service.getApplicantRecruitmentUnits()).find(row => row.admissionCode === special.admissionCode);
  for (const key of ['admissionNameEn', 'unitNameEn', 'majorNameEn']) assert.equal(unit[key], special[key]);
  await query('INSERT INTO app_schedule (track_name, admission_code, admission_name, applicant_schedule_start_at, applicant_schedule_end_at) VALUES (?, ?, ?, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 1 DAY))', [unit.trackName, unit.admissionCode, unit.admissionName]);
  console.log('PASS: recruitment English names, migration, partial updates, validation and legacy/new workbook compatibility');
  return unit;
}

async function runRecruitmentLanguageUiChecks({ services, query, call, adminPage, memberPage, go, language, artifacts, submissionId, unit }) {
  const fields = ['admission', 'unit', 'major'];
  await go(adminPage, '/applicant-recruitment-management');
  const row = `[data-grid-key=applicantRecruitmentGrid][data-grid-row-id="${unit.id}"]`;
  await adminPage.waitForSelector(row);
  await adminPage.click(row);
  await adminPage.waitForSelector('#applicantRecruitmentUnitModal:not(.hidden)');
  const translations = { admission: 'International admission <2026>', unit: 'Literature & Languages', major: 'Korean Literature' };
  for (const key of fields) {
    const selector = `[data-applicant-recruitment-input=${key}NameEn]`;
    assert.equal(await adminPage.$eval(selector, el => el.value), unit[`${key}NameEn`]);
    await adminPage.$eval(selector, (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); }, translations[key]);
  }
  await adminPage.screenshot({ path: path.join(artifacts, 'recruitment-bilingual-editor.png'), fullPage: true });
  const [saved] = await Promise.all([
    adminPage.waitForResponse(response => response.url().endsWith(`/api/applicant-recruitment-units/${unit.id}`) && response.request().method() === 'PUT'),
    adminPage.click('#applicantRecruitmentUnitModalSaveButton'),
  ]);
  assert.equal(saved.status(), 200);
  await adminPage.waitForSelector('#applicantRecruitmentUnitModal.hidden');
  await adminPage.reload({ waitUntil: 'networkidle0' });
  await adminPage.waitForSelector(row);
  await adminPage.click(row);
  for (const key of fields) {
    assert.equal(await adminPage.$eval(`[data-applicant-recruitment-input=${key}NameEn]`, el => el.value), translations[key]);
    assert.equal(await adminPage.$eval(`[data-applicant-recruitment-input=${key}Name]`, el => el.value), unit[`${key}Name`]);
  }
  await adminPage.click('#applicantRecruitmentUnitModal [data-close-modal=true][type=button]');
  assert.equal((await call(`/api/applicant-recruitment-units/${unit.id}`, { majorNameEn: 'Unauthorized' }, '', 'PUT')).status, 401);
  const [{ memberId }] = await query('SELECT member_id AS memberId FROM app_meta WHERE id = ?', [submissionId]);
  const originalAnswers = await query('SELECT field_key, answer_data FROM app_subm WHERE id = ? ORDER BY field_key', [submissionId]);
  await query('UPDATE app_meta SET member_id = NULL WHERE id = ?', [submissionId]);
  try {
    await go(memberPage, '/applicant');
    await memberPage.click('[data-applicant-action=member-apply]');
    await memberPage.waitForSelector('#applicationSelection-track');
    await language(memberPage, 'en');
    for (const key of ['track', 'admission', 'series', 'unit', 'major']) {
      await memberPage.select(`#applicationSelection-${key}`, unit[`${key}Name`]);
      if (fields.includes(key)) assert.equal(await memberPage.$eval(`#applicationSelection-${key} option:checked`, el => el.textContent), translations[key]);
    }
    await language(memberPage, 'ko');
    for (const key of fields) assert.equal(await memberPage.$eval(`#applicationSelection-${key}`, el => el.value), unit[`${key}Name`]);
    await language(memberPage, 'en');
    await memberPage.click('[data-applicant-action=continue-application]');
    await memberPage.waitForSelector('.applicant-public-selection-summary-value');
    const summaries = await memberPage.$$eval('.applicant-public-selection-summary-value', els => els.map(el => [el.textContent, el.title]));
    for (const english of Object.values(translations)) assert(summaries.some(([text, title]) => text === english && title === english));
    await memberPage.screenshot({ path: path.join(artifacts, 'recruitment-english-selection.png'), fullPage: true });
    await language(memberPage, 'ko');
    const koreanSummary = await memberPage.$eval('.applicant-public-selection-summary', el => el.textContent);
    for (const key of fields) assert(koreanSummary.includes(unit[`${key}Name`]));
  } finally { await query('UPDATE app_meta SET member_id = ? WHERE id = ?', [memberId, submissionId]); }
  assert.deepEqual(await query('SELECT field_key, answer_data FROM app_subm WHERE id = ? ORDER BY field_key', [submissionId]), originalAnswers);
  await go(memberPage, '/applicant');
  await language(memberPage, 'en');
  await memberPage.click('[data-applicant-action=member-summary]');
  await memberPage.waitForSelector('.applicant-public-summary-grid');
  const resultText = await memberPage.$eval('.applicant-public-summary-grid', el => el.textContent);
  assert(resultText.includes('General admission') && resultText.includes('Literature'), 'Saved results display matching English names');
  console.log('PASS: recruitment bilingual editor persistence, contextual English options, original values and localized results');
}

module.exports = { prepareRecruitmentLanguageChecks, runRecruitmentLanguageUiChecks };
