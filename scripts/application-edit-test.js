const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');

async function verifyApplicationEdit({ services, query, base, call, submissionId, memberCookie }) {
  const applicants = services.applicantService;
  await applicants.createApplicantFormField({ fieldKey: 'edit-note', questionText: '수정 확인', inputType: 'text', required: true });
  await applicants.createApplicantFormField({ fieldKey: 'edit-date', questionText: '선택 날짜', inputType: 'date', dateParts: ['year', 'month'], required: false });
  const original = await applicants.getApplicantSubmissionById(submissionId);
  const fields = (await applicants.getApplicantPublicForm()).fields;
  const payload = {
    submissionId,
    selectionAnswers: { track: '수시', admission: '일반', series: '인문', unit: '문학', major: '' },
    answers: Object.fromEntries(fields.map(field => [field.fieldKey, ['file', 'photo'].includes(field.inputType) ? {} : original.answerMap[field.fieldKey] || ''])),
  };
  payload.answers['edit-note'] = '처음 입력한 내용';
  payload.answers['edit-date'] = '2001-02';
  const edit = (value = payload, cookie = memberCookie) => call('/api/public/applications', value, cookie, 'PUT');
  assert.equal((await edit(payload, '')).status, 401);
  assert.equal((await edit()).body.code, 'APPLICANT_SUBMISSION_EDIT_DISABLED');
  assert.equal((await applicants.getApplicantPublicForm()).systemSettings.applicantSubmissionEditEnabled, false);

  const adminLogin = await call('/api/auth/login', { id: 'admin', password: '1111' });
  const setup = await call('/api/auth/password/setup', { password: 'EditTest12345', passwordConfirm: 'EditTest12345' }, adminLogin.cookie);
  assert.equal(setup.status, 200);
  const adminCookie = setup.cookie || adminLogin.cookie;
  const settings = (await call('/api/system-settings', null, adminCookie, 'GET')).body;
  assert.equal(settings.applicantSubmissionEditEnabled, false);
  assert.equal((await call('/api/system-settings', { ...settings, applicantSubmissionEditEnabled: true }, memberCookie, 'PUT')).status, 401);
  const setEnabled = enabled => call('/api/system-settings', { ...settings, applicantSubmissionEditEnabled: enabled }, adminCookie, 'PUT');

  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const errors = [];
  try {
    const staffContext = await browser.createBrowserContext();
    const memberContext = await browser.createBrowserContext();
    for (const [context, cookie] of [[staffContext, adminCookie], [memberContext, memberCookie]]) {
      const i = cookie.indexOf('=');
      await context.setCookie({ name: cookie.slice(0, i), value: cookie.slice(i + 1), url: base });
    }
    const staffPage = await staffContext.newPage();
    staffPage.on('pageerror', error => errors.push(error.message));
    await staffPage.goto(base + '/system-settings', { waitUntil: 'networkidle2' });
    await staffPage.waitForSelector('#systemSettingsApplicantSubmissionEditEnabled');
    assert.equal(await staffPage.$eval('#systemSettingsApplicantSubmissionEditEnabled', el => el.value), 'false');
    const page = await memberContext.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const editButton = '[data-applicant-action="edit-application"]';
    await page.goto(base + '/applicant', { waitUntil: 'networkidle2' });
    await page.click('[data-applicant-action="member-summary"]');
    await page.waitForSelector(editButton);
    assert.equal(await page.$eval(editButton, el => el.disabled), true);
    const summaryUrl = page.url();

    await staffPage.select('#systemSettingsApplicantSubmissionEditEnabled', 'true');
    await staffPage.waitForFunction(() => !document.querySelector('[data-system-settings-action="save"]').disabled);
    const savedSettings = staffPage.waitForResponse(response => response.url().endsWith('/api/system-settings') && response.request().method() === 'PUT');
    await staffPage.click('[data-system-settings-action="save"]');
    assert.equal((await savedSettings).status(), 200);
    await staffPage.reload({ waitUntil: 'networkidle2' });
    assert.equal(await staffPage.$eval('#systemSettingsApplicantSubmissionEditEnabled', el => el.value), 'true');
    assert.equal((await applicants.getApplicantPublicForm()).systemSettings.applicantSubmissionEditEnabled, true);

    assert.equal((await edit({ ...payload, submissionId: submissionId + 100 })).body.code, 'APPLICANT_SUBMISSION_FORBIDDEN');
    assert.equal((await call('/api/public/applications', payload, memberCookie)).status, 409, 'Create still rejects duplicate submissions while edits are enabled');
    const saved = await edit();
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.id, original.id);
    assert.equal(saved.body.examineeNo, original.examineeNo);
    assert.equal(saved.body.createdAt, original.createdAt);
    assert.equal(saved.body.status, original.status);
    assert.equal(saved.body.answerMap['edit-note'], payload.answers['edit-note']);
    for (const key of ['rule-document', 'application-document', 'document', 'late-document', 'document-note']) {
      assert.deepEqual(saved.body.answerMap[key], original.answerMap[key], `${key} must survive editing`);
    }
    const file = await applicants.getApplicantSubmissionFile(submissionId, 'rule-document');
    assert.equal(file.fileBlob.toString(), 'rule content');
    assert.equal((await query('SELECT id FROM app_meta WHERE member_id = ?', [original.memberId])).length, 1);

    await page.goto(summaryUrl, { waitUntil: 'networkidle2' });
    await page.waitForFunction(selector => document.querySelector(selector)?.disabled === false, {}, editButton);
    await page.click(editButton);
    await page.waitForSelector('#field-edit-note');
    assert.equal(await page.$eval('#field-edit-note', el => el.value), '처음 입력한 내용');
    assert.equal(await page.$eval('[data-applicant-field-key="edit-date"]', el => el.value), '2001-02');
    assert((await page.$eval('body', el => el.textContent)).includes(original.answerMap['rule-document'].fileName));
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('#field-edit-note');
    assert.equal(await page.$eval('#field-edit-note', el => el.value), '처음 입력한 내용', 'Reload restores the existing submission in edit mode');
    await page.$eval('#field-edit-note', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.type('#field-edit-note', '화면에서 수정한 내용');
    const updatedResponse = page.waitForResponse(response => response.url().endsWith('/api/public/applications') && response.request().method() === 'PUT');
    await page.click('[data-applicant-form="application"] button[type="submit"]');
    const updated = await updatedResponse;
    assert.equal(updated.status(), 200, await updated.text());
    await page.waitForSelector(editButton);
    assert((await page.$eval('body', el => el.textContent)).includes('화면에서 수정한 내용'));
    assert.equal((await applicants.getApplicantSubmissionById(submissionId)).answerMap['edit-note'], '화면에서 수정한 내용');

    await page.click(editButton);
    await page.waitForSelector('#field-edit-note');
    assert.equal((await setEnabled(false)).status, 200);
    const blockedResponse = page.waitForResponse(response => response.url().endsWith('/api/public/applications') && response.request().method() === 'PUT');
    await page.click('[data-applicant-form="application"] button[type="submit"]');
    assert.equal((await blockedResponse).status(), 403, 'Disabling edits after the form opens blocks saving');
    assert.equal((await applicants.getApplicantSubmissionById(submissionId)).answerMap['edit-note'], '화면에서 수정한 내용');
    await page.goto(summaryUrl, { waitUntil: 'networkidle2' });
    assert.equal(await page.$eval(editButton, el => el.disabled), true);
    await setEnabled(true);
    await query('UPDATE app_schedule SET applicant_schedule_end_at = DATE_SUB(NOW(), INTERVAL 1 HOUR)');
    assert.equal((await edit()).body.code, 'APPLICANT_SUBMISSION_SCHEDULE_ENDED');
    await page.goto(summaryUrl, { waitUntil: 'networkidle2' });
    assert.equal(await page.$eval(editButton, el => el.disabled), true, 'Closed schedules keep edits disabled');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
  console.log('PASS: edit settings UI and persistence, authorization, existing answers, browser edit and reload, stable IDs, retained documents/files, duplicate prevention, disabled edits and deadlines');
}

module.exports = { verifyApplicationEdit };
