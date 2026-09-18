const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { validateAnswers } = require('../server/modules/applications/signup-questions');

async function runChoiceSettingsChecks({ services, members, query, base, call, memberCookie, submissionId }) {
  const options = ['오전반', '오후반', '기타'];
  const optionsEn = { 오전반: 'Morning <class>', 오후반: 'Afternoon class', 기타: 'Other' };
  const multiple = { key: 'choices', label: '희망 시간', labelEn: 'Preferred times', inputType: 'multiselect', options, optionsEn, required: true, customOptionLabel: '기타' };
  const settings = await members.getSettings();
  await members.saveSettings({ ...settings, terms: [], questions: [...settings.questions.filter(q => ['email', 'password', 'name'].includes(q.key)), multiple, { ...multiple, key: 'single', inputType: 'select', required: false }] });
  const questions = (await members.getSettings()).questions;
  assert.deepEqual(questions.find(q => q.key === 'choices').optionsEn, optionsEn);
  assert.deepEqual(validateAnswers(questions, { choices: ['오전반', '오후반', '오전반'], single: '오전반' }).choices, ['오전반', '오후반']);
  for (const choices of [[], '오전반', ['위조값'], ['기타: '], ['기타']]) assert.throws(() => validateAnswers(questions, { choices }));
  assert.deepEqual(validateAnswers(questions, { choices: ['오전반', '기타: 주말'] }).choices, ['오전반', '기타: 주말']);

  const service = services.applicantService;
  const legacyFields = await query('SELECT * FROM app_form ORDER BY id');
  const [inputColumn] = await query("SHOW COLUMNS FROM app_form LIKE 'input_type'");
  await query(`ALTER TABLE app_form MODIFY input_type ${inputColumn.Type.replace(",'multiselect'", '')} NOT NULL DEFAULT 'text'`);
  await services.initializeApplicationData();
  assert((await query("SHOW COLUMNS FROM app_form LIKE 'input_type'"))[0].Type.includes("'multiselect'"));
  assert.deepEqual(await query('SELECT * FROM app_form ORDER BY id'), legacyFields, 'Type migration preserves existing question settings');
  for (const scope of ['application', 'documents']) {
    await service.createApplicantFormField({ formScope: scope, fieldKey: `choices-${scope}`, questionText: '희망 시간', questionTextEn: 'Preferred times', inputType: 'multiselect', options, optionsEn, customOptionLabel: '기타', allowCustomOption: true, required: true });
  }
  const field = (await service.getApplicantFormFields()).find(f => f.fieldKey === 'choices-application');
  await service.updateApplicantFormField(field.id, { questionDescription: '수정 후 번역 유지' });
  assert.deepEqual((await service.getApplicantFormFields()).find(f => f.id === field.id).optionsEn, optionsEn);
  const beforeMigration = await query('SELECT * FROM app_form ORDER BY id');
  await services.initializeApplicationData();
  assert.deepEqual(await query('SELECT * FROM app_form ORDER BY id'), beforeMigration);
  const saveDocuments = choices => call('/api/public/members/documents', { answers: { 'choices-documents': choices, 'document-note': '확인' } }, memberCookie);
  for (const choices of [[], '오전반', ['위조값'], ['기타: ']]) assert.equal((await saveDocuments(choices)).status, 400);
  assert.equal((await saveDocuments(['오전반', '기타: 주말'])).status, 200);
  assert.deepEqual((await service.getApplicantSubmissionById(submissionId)).answerMap['choices-documents'], ['오전반', '기타: 주말']);
  assert.deepEqual(JSON.parse((await query("SELECT answer_data FROM app_subm WHERE id = ? AND field_key = 'choices-documents'", [submissionId]))[0].answer_data), ['오전반', '기타: 주말']);
  console.log('PASS: choice settings persistence, schema, required/invalid selection validation, JSON arrays and reload');

  const artifacts = path.resolve('.tmp-choice-settings'); fs.mkdirSync(artifacts, { recursive: true });
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const errors = [];
  const attach = async cookie => {
    const context = await browser.createBrowserContext();
    if (cookie) { const at = cookie.indexOf('='); await context.setCookie({ name: cookie.slice(0, at), value: cookie.slice(at + 1), url: base }); }
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); await page.setViewport({ width: 1440, height: 1000 }); return page;
  };
  const go = (page, route) => page.goto(base + route, { waitUntil: 'networkidle0' });
  const language = async (page, locale) => { await page.click(`[data-language=${locale}]`); await page.waitForFunction(lang => document.documentElement.lang === lang, {}, locale); };
  try {
    await query('UPDATE accounts SET password_temporary = 0');
    const { initialPassword } = await services.systemService.getSystemSettings();
    const login = await call('/api/auth/login', { id: 'admin', password: initialPassword }); assert.equal(login.status, 200);
    const admin = await attach(login.cookie);
    await go(admin, '/applicant-question-template-management?tab=signup');
    await admin.waitForSelector('[data-signup-field-select=choices]'); await admin.click('[data-signup-field-select=choices]');
    const types = await admin.$$eval('[data-signup-field-input=inputType] option', els => els.map(el => [el.value, el.textContent.trim()]));
    assert(types.some(([key, label]) => key === 'select' && label === '단일 선택'));
    assert(types.some(([key, label]) => key === 'multiselect' && label === '복수 선택'));
    assert(!types.some(([key]) => ['photo', 'file'].includes(key)));
    await admin.type('[data-signup-field-input=optionDraft]', '주말반');
    await admin.type('[data-signup-field-input=optionDraftEn]', 'Weekend class');
    await admin.click('[data-signup-field-option-add]');
    const editChoice = async (scope, index, ko, en) => {
      for (const [key, value] of [['optionKorean', ko], ['optionEnglish', en]]) {
        await admin.$eval(`[data-${scope}-field-input="${key}:${index}"]`, (el, text) => { el.value = text; el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
      }
    };
    const lastSignupIndex = (await admin.$$('[data-signup-field-input^="optionKorean:"]')).length - 1;
    await editChoice('signup', lastSignupIndex, '주말수업', 'Weekend program');
    assert(await admin.$eval('.applicant-option-editor-item .applicant-option-language-fields', el => {
      const [ko, en] = el.querySelectorAll('input'); const a = ko.getBoundingClientRect(), b = en.getBoundingClientRect();
      return Math.abs(a.top - b.top) < 2 && b.left > a.left;
    }));
    await admin.click('[data-signup-field-form] button[type=submit]');
    await admin.waitForFunction(() => document.querySelector('[data-signup-status]')?.textContent.includes('저장했습니다'));
    assert.equal((await members.getSettings()).questions.find(q => q.key === 'choices').optionsEn.주말수업, 'Weekend program');
    await admin.reload({ waitUntil: 'networkidle0' }); await admin.click('[data-signup-field-select=choices]');
    await admin.screenshot({ path: path.join(artifacts, 'bilingual-choice-editor.png'), fullPage: true });
    await go(admin, '/applicant-question-template-management?tab=application');
    await admin.click('.form-template-thumbnail-open');
    await admin.waitForSelector(`[data-applicant-field-select="${field.id}"]`); await admin.click(`[data-applicant-field-select="${field.id}"]`);
    assert.equal(await admin.$eval('[data-applicant-field-input=inputType]', el => el.value), 'multiselect');
    assert.equal(await admin.$eval('[data-applicant-field-input="optionEnglish:0"]', el => el.value), optionsEn.오전반);
    await admin.type('[data-applicant-field-input=optionDraft]', '야간반'); await admin.type('[data-applicant-field-input=optionDraftEn]', 'Evening class');
    await admin.click('[data-applicant-field-option-add]');
    const lastApplicationIndex = (await admin.$$('[data-applicant-field-input^="optionKorean:"]')).length - 1;
    await editChoice('applicant', lastApplicationIndex, '야간수업', 'Evening program');
    await Promise.all([admin.waitForResponse(r => r.url().endsWith(`/api/applicant-form-fields/${field.id}`) && r.request().method() === 'PUT'), admin.click('[data-applicant-field-form] button[type=submit]')]);
    assert.equal((await service.getApplicantFormFields()).find(f => f.id === field.id).optionsEn.야간수업, 'Evening program');

    await admin.reload({ waitUntil: 'networkidle0' }); await admin.click(`[data-applicant-field-select="${field.id}"]`);
    assert.equal(await admin.$eval(`[data-applicant-field-input="optionKorean:${lastApplicationIndex}"]`, el => el.value), '야간수업');
    assert.equal(await admin.$eval(`[data-applicant-field-input="optionEnglish:${lastApplicationIndex}"]`, el => el.value), 'Evening program');
    await admin.screenshot({ path: path.join(artifacts, 'editable-choice-cards.png'), fullPage: true });
    const visitor = await attach(); await go(visitor, '/login'); await visitor.click('.common-login-signup');
    await visitor.waitForSelector('[data-applicant-form=member-terms] button[type=submit]');
    await visitor.click('[data-applicant-form=member-terms] button[type=submit]');
    await visitor.waitForSelector('[data-choice-prefix=member]');
    const group = '[data-choice-group=choices]';
    await visitor.click(`${group} [value="오전반"]`); await visitor.click(`${group} [value="오후반"]`);
    await visitor.select('[data-member-select=single]', '오전반'); await language(visitor, 'en');
    assert.equal(await visitor.$eval('[data-member-select=single] option:checked', el => el.textContent), optionsEn.오전반);
    assert((await visitor.$eval(group, el => el.textContent)).includes(optionsEn.오전반));
    assert.equal(await visitor.$(`${group} class`), null);
    await language(visitor, 'ko');
    assert.deepEqual(await visitor.$$eval(`${group} input:checked`, els => els.map(el => el.value)), ['오전반', '오후반']);
    for (const width of [320, 390]) { await visitor.setViewport({ width, height: 844 }); assert(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
    await visitor.screenshot({ path: path.join(artifacts, 'multiple-choice-mobile.png'), fullPage: true });

    const member = await attach(memberCookie); await go(member, '/applicant'); await member.click('[data-applicant-action=member-documents]');
    const docGroup = '[data-choice-group=choices-documents]'; await member.waitForSelector(docGroup);
    assert.deepEqual(await member.$$eval(`${docGroup} input:checked`, els => els.map(el => el.value)), ['오전반', '기타']);
    assert.equal(await member.$eval(`${docGroup} [data-choice-custom-input]`, el => el.value), '주말');
    await member.click(`${docGroup} [value="기타"]`); await member.click(`${docGroup} [value="오후반"]`); await language(member, 'en');
    assert((await member.$eval(docGroup, el => el.textContent)).includes('Afternoon class'));
    await Promise.all([member.waitForResponse(r => r.url().endsWith('/api/public/members/documents') && r.request().method() === 'POST'), member.click('[data-applicant-form=member-documents] button[type=submit]')]);
    assert.deepEqual((await service.getApplicantSubmissionById(submissionId)).answerMap['choices-documents'], ['오전반', '오후반']);
    assert.deepEqual(errors, []);
    console.log('PASS: bilingual option editors, signup upload types removed, multi-select language switching, mobile layout and saved selections');
  } finally { await browser.close(); }
}
module.exports = { runChoiceSettingsChecks };
