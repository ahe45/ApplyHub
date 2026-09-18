const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

async function runFormTemplateChecks({ services, query, base, call, memberCookie, submissionId }) {
  const service = services.applicantService;
  const originals = await service.getApplicantFormFields();
  const templates = await service.getApplicantFormTemplates();
  const appDefault = templates.find(item => item.formScope === 'application');
  const docDefault = templates.find(item => item.formScope === 'documents');
  assert.equal(templates.length, 2);
  assert(originals.every(field => field.templateId === (field.formScope === 'documents' ? docDefault.id : appDefault.id)));
  await services.initializeApplicationData();
  assert.deepEqual(await service.getApplicantFormFields(), originals, 'Repeated migration preserves all existing questions');
  await query('UPDATE accounts SET password_temporary = 0');
  const { initialPassword } = await services.systemService.getSystemSettings();
  const login = await call('/api/auth/login', { id: 'admin', password: initialPassword });
  assert.equal(login.status, 200);
  const api = (suffix, payload, method = 'POST') => call('/api/applicant-form-templates' + suffix, payload, login.cookie, method);
  assert.equal((await call('/api/applicant-form-templates', {}, memberCookie, 'GET')).status, 401);
  assert.equal((await api('/' + appDefault.id, {}, 'DELETE')).status, 409);
  assert.equal((await api('', { name: '', formScope: 'application' })).status, 400);
  const newApp = (await api('', { name: '외국인 원서접수', formScope: 'application' })).body.id;
  const newDoc = (await api('', { name: '외국인 서류제출', formScope: 'documents', copyFromId: docDefault.id })).body.id;
  assert(newApp && newDoc);
  assert.equal((await api('', { name: '외국인 원서접수', formScope: 'application' })).status, 409);
  assert.equal((await api('', { name: '잘못된 복사', formScope: 'application', copyFromId: newDoc })).status, 400);
  let copiedDocs = await service.getApplicantFormFields({ templateId: newDoc });
  assert.equal(copiedDocs.length, originals.filter(field => field.formScope === 'documents').length);
  assert(copiedDocs.every(field => !originals.some(original => original.fieldKey === field.fieldKey)));
  for (const field of copiedDocs) await service.deleteApplicantFormField(field.id);
  await service.createApplicantFormField({ templateId: newDoc, formScope: 'documents', fieldKey: 'foreign-proof', questionText: '외국인 증빙', questionTextEn: 'International certificate', inputType: 'file', required: true, allowedExtensions: 'txt' });
  await service.createApplicantFormField({ templateId: newApp, fieldKey: 'foreign-reason', questionText: '지원동기', questionTextEn: 'Motivation', inputType: 'text', required: true });
  // The same system field may appear in distinct templates, but only once in each.
  await service.createApplicantFormField({ templateId: newApp, questionText: '이름 연결', systemFieldKey: 'name', inputType: 'text' });
  await assert.rejects(() => service.createApplicantFormField({ templateId: newApp, questionText: '중복 이름', systemFieldKey: 'name', inputType: 'text' }), error => error.errorCode === 'APPLICANT_SYSTEM_FIELD_DUPLICATED');
  await assert.rejects(() => service.createApplicantFormField({ templateId: newDoc, questionText: '잘못된 구분', inputType: 'text' }), error => error.errorCode === 'FORM_TEMPLATE_INVALID');
  const initialSchedule = (await service.getApplicantSchedules())[0];
  await assert.rejects(() => service.saveApplicantSchedule({ ...initialSchedule, applicationTemplateId: newDoc }), error => error.errorCode === 'FORM_TEMPLATE_INVALID');
  await query("INSERT INTO app_unit (track_name, admission_code, admission_name, series_code, series_name, unit_code, unit_name) VALUES ('수시','2','외국인','2','인문','3','문학')");
  const secondSchedule = (await service.getApplicantSchedules()).find(item => item.admissionCode === '2');
  await service.saveApplicantSchedules({ schedules: [{ ...secondSchedule, applicantScheduleStartAt: initialSchedule.applicantScheduleStartAt, applicantScheduleEndAt: initialSchedule.applicantScheduleEndAt, applicationTemplateId: newApp, documentTemplateId: newDoc }] });
  const first = (await service.getApplicantSchedules()).find(item => item.admissionCode === '1');
  assert.equal(first.applicationTemplateId, appDefault.id);
  assert.equal(first.documentTemplateId, docDefault.id);
  const member = { name: '템플릿 지원자', email: 'template-new@example.test', birthDate: '2000-01-01' };
  const added = await query("INSERT INTO applicant_members (login_id,password_hash,name,email,email_verified,profile_json,consent_json) SELECT ?,password_hash,?,?,1,'{}','{}' FROM applicant_members LIMIT 1", [member.email, member.name, member.email]);
  member.id = Number(added.insertId);
  const context = await service.getMemberApplicationContext(member);
  const submissionPayload = { accessToken: context.accessToken, selectionAnswers: { track: '수시', admission: '외국인', series: '인문', unit: '문학', major: '' }, answers: {} };
  await assert.rejects(() => service.saveApplicantSubmission(submissionPayload), error => error.fieldKey === 'foreign-reason');
  await assert.rejects(() => service.saveApplicantSubmission({ ...submissionPayload, answers: { 'foreign-reason': '동기', document: 'wrong template' } }), error => error.errorCode === 'APPLICATION_ANSWER_SCOPE_INVALID');
  const submitted = await service.saveApplicantSubmission({ ...submissionPayload, answers: { 'foreign-reason': '전공을 공부하고 싶습니다.' } });
  assert.equal(submitted.answerMap['foreign-reason'], '전공을 공부하고 싶습니다.');
  assert.equal(submitted.answerMap['rule-document'], undefined);
  assert.deepEqual((await service.documentStatusService.detail(submitted.id)).documents.map(field => field.fieldKey), ['foreign-proof']);
  const listed = await service.documentStatusService.list();
  assert(!listed.rows.find(row => row.id === submissionId).documents.some(field => field.fieldKey === 'foreign-proof'));
  const foreignField = (await service.getApplicantFormFields({ templateId: newDoc }))[0];
  await assert.rejects(() => service.documentStatusService.save(submissionId, { documents: [{ fieldId: foreignField.id, status: 'submitted' }] }, 'admin'), /현재 서류제출/);
  assert.equal((await api('/' + newApp, {}, 'DELETE')).status, 409);
  assert.equal((await api('/' + newDoc, {}, 'DELETE')).status, 409);
  const removableDoc = (await api('', { name: '삭제 전형 서류 템플릿', formScope: 'documents', copyFromId: docDefault.id })).body.id;
  const removableApp = (await api('', { name: '삭제 전형 원서 템플릿', formScope: 'application', copyFromId: appDefault.id })).body.id;
  const orphanUnits = [];
  for (const code of ['91', '92']) {
    const addedUnit = await query("INSERT INTO app_unit (track_name, admission_code, admission_name, series_code, series_name, unit_code, unit_name) VALUES ('수시','99','삭제 테스트','1','인문',?,?)", [code, '삭제 모집단위 ' + code]);
    orphanUnits.push(addedUnit.insertId);
  }
  const removableSchedule = (await service.getApplicantSchedules()).find(item => item.admissionCode === '99');
  await service.saveApplicantSchedule({ ...removableSchedule, applicationTemplateId: removableApp, documentTemplateId: removableDoc });
  assert.equal((await api('/' + removableDoc, {}, 'DELETE')).status, 409, 'An active admission protects its template');
  await service.deleteApplicantRecruitmentUnit(orphanUnits[0]);
  assert.deepEqual((await query('SELECT application_template_id, document_template_id FROM app_schedule WHERE admission_code = ?', ['99']))[0], { application_template_id: removableApp, document_template_id: removableDoc });
  assert.equal((await api('/' + removableDoc, {}, 'DELETE')).status, 409, 'Another unit in the same admission still protects its template');
  await service.deleteApplicantRecruitmentUnit(orphanUnits[1]);
  assert.deepEqual((await query('SELECT application_template_id, document_template_id FROM app_schedule WHERE admission_code = ?', ['99']))[0], { application_template_id: null, document_template_id: null }, 'Deleting the last unit immediately detaches both schedule templates');
  assert((await service.getApplicantFormTemplates()).some(item => item.id === removableDoc), 'Admission deletion preserves the reusable template');
  assert((await service.getApplicantFormTemplates()).some(item => item.id === removableApp));
  assert.equal((await api('/' + removableDoc, {}, 'DELETE')).status, 200, 'Deleted admissions no longer block deleting unused templates');
  assert.equal((await api('/' + removableApp, {}, 'DELETE')).status, 200);
  assert.equal((await query('SELECT document_template_id FROM app_schedule WHERE admission_code = ?', ['99']))[0].document_template_id, null);
  assert.equal((await service.getApplicantFormFields({ templateId: removableDoc })).length, 0);
  await query('DELETE FROM app_schedule WHERE admission_code = ?', ['99']);
  console.log('PASS: active admissions remain protected and deleted admission template references are detached');
  console.log('PASS: template migration, create/copy, scope validation, isolated application validation and document status');

  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const artifacts = path.resolve('.tmp-form-templates'); fs.mkdirSync(artifacts, { recursive: true });
  const errors = [];
  async function pageWithCookie(cookie) {
    const ctx = await browser.createBrowserContext();
    if (cookie) { const at = cookie.indexOf('='); await ctx.setCookie({ name: cookie.slice(0, at), value: cookie.slice(at + 1), url: base }); }
    const page = await ctx.newPage(); page.on('pageerror', error => errors.push(error.stack || error.message));
    await page.setViewport({ width: 1440, height: 1000 }); return page;
  }
  const go = (page, url) => page.goto(base + url, { waitUntil: 'networkidle0' });
  try {
    const admin = await pageWithCookie(login.cookie);
    // Different templates share ordinal columns while retaining their own field IDs and names.
    const temporaryDocumentKeys = [];
    try {
      for (const [templateId, count] of [[docDefault.id, 3], [newDoc, 4]]) {
        const existing = (await service.getApplicantFormFields({ templateId })).filter(field => field.inputType === 'file');
        for (let index = existing.length; index < count; index++) {
          const fieldKey = `ordinal-${templateId}-${index}`;
          temporaryDocumentKeys.push(fieldKey);
          await service.createApplicantFormField({ templateId, formScope: 'documents', fieldKey, questionText: `전형 ${templateId} 증빙 ${index + 1}`, inputType: 'file', required: false });
        }
      }
      const mixed = await service.documentStatusService.list();
      assert.deepEqual(mixed.documents, Array.from({ length: 4 }, (_, index) => ({ index, label: `서류${index + 1}` })));
      const standard = mixed.rows.find(row => row.id === submissionId);
      const foreign = mixed.rows.find(row => row.id === submitted.id);
      assert.equal(standard.documents.length, 3);
      assert.equal(foreign.documents.length, 4);
      assert.equal((await service.documentStatusService.list({ admission: standard.admission })).documents.length, 3);
      assert.equal((await service.documentStatusService.list({ admission: foreign.admission })).documents.length, 4);
      await go(admin, '/applicant-documents');
      await admin.waitForSelector('[data-document-column="3"]');
      assert.deepEqual(await admin.$$eval('[data-document-column]', cells => cells.map(cell => cell.textContent)), ['서류1', '서류2', '서류3', '서류4']);
      const standardButton = `[data-document-status-row="${standard.id}"][data-document-status-id="${standard.documents[0].fieldId}"]`;
      const foreignButton = `[data-document-status-row="${foreign.id}"][data-document-status-id="${foreign.documents[0].fieldId}"]`;
      assert.equal(await admin.$eval(standardButton, el => el.closest('tr').querySelectorAll('td')[12].textContent), '—');
      assert.equal(await admin.$eval(foreignButton, el => el.closest('tr').querySelectorAll('[data-document-status-id]').length), 4);
      for (const [button, document] of [[standardButton, standard.documents[0]], [foreignButton, foreign.documents[0]]]) {
        await admin.click(button);
        await admin.waitForSelector('#documentStatusPopover:popover-open');
        assert.equal(await admin.$eval('.document-status-popover-title', el => el.textContent), document.questionText);
        await admin.keyboard.press('Escape');
      }
      await admin.click(foreignButton);
      const [response] = await Promise.all([
        admin.waitForResponse(res => res.url().endsWith('/api/applicant-document-status/' + foreign.id) && res.request().method() === 'PUT'),
        admin.click('[data-document-status-option=incomplete]'),
      ]);
      assert.deepEqual(JSON.parse(response.request().postData()).documents, [{ fieldId: foreign.documents[0].fieldId, status: 'incomplete' }]);
      await admin.waitForFunction(selector => document.querySelector(selector)?.textContent === '미비', {}, foreignButton);
      assert.deepEqual((await service.documentStatusService.detail(standard.id)).documents, standard.documents);
      await admin.screenshot({ path: path.join(artifacts, 'document-ordinal-columns.png') });
      console.log('PASS: three- and four-document templates share four ordinal columns, per-row names and isolated status updates');
    } finally {
      for (const field of await service.getApplicantFormFields()) {
        if (temporaryDocumentKeys.includes(field.fieldKey)) await service.deleteApplicantFormField(field.id);
      }
    }
    async function copyFormFromButton(sourceId, selector, expectedName) {
      const schedulesBefore = await service.getApplicantSchedules();
      const sourceFields = await service.getApplicantFormFields({ templateId: sourceId });
      const [response] = await Promise.all([
        admin.waitForResponse(res => res.url().endsWith('/api/applicant-form-templates') && res.request().method() === 'POST'),
        admin.click(selector),
      ]);
      assert.equal(response.status(), 201);
      const result = await response.json();
      const cardSelector = '[data-form-template-card="' + result.id + '"]';
      await admin.waitForSelector(cardSelector);
      assert.equal(await admin.$('[data-form-template-form]'), null, 'Copy creates immediately without a name form');
      assert.equal(await admin.$('[data-form-template-editing]'), null, 'Copy stays in the thumbnail gallery');
      assert.equal(await admin.$eval(cardSelector + ' h3', el => el.textContent), expectedName);
      assert((await admin.$eval(cardSelector, el => el.textContent)).includes('적용된 전형 없음'));
      assert.equal(await admin.$eval(cardSelector + ' .badge', el => el.textContent), '사용 안 함');
      const copiedFields = await service.getApplicantFormFields({ templateId: result.id });
      const contentOnly = fields => fields.map(({ id, templateId, fieldKey, createdAt, updatedAt, ...content }) => content);
      assert.deepEqual(contentOnly(copiedFields), contentOnly(sourceFields));
      assert(copiedFields.every(field => !sourceFields.some(source => source.fieldKey === field.fieldKey)));
      assert.deepEqual(await service.getApplicantSchedules(), schedulesBefore, 'Copy does not change any admission assignments');
      return result.id;
    }
    await go(admin, '/templates');
    const cardMetrics = card => { const preview = card.querySelector('.template-preview'); const style = getComputedStyle(card); return { width: card.getBoundingClientRect().width, padding: style.padding, gap: style.gap, radius: style.borderRadius, previewWidth: preview.getBoundingClientRect().width, previewHeight: preview.getBoundingClientRect().height }; };
    const ticketMetrics = await admin.$eval('.template-card', cardMetrics);
    assert(await admin.$eval('.template-card-copy-button', el => el.nextElementSibling?.classList.contains('template-card-delete-button')));
    const ticketId = await admin.$eval('[data-template-copy]', el => el.dataset.templateCopy);
    const [originalTicket] = await query('SELECT * FROM templates WHERE id = ?', [ticketId]);
    const [copyResponse] = await Promise.all([
      admin.waitForResponse(response => response.url().endsWith('/api/templates') && response.request().method() === 'POST'),
      admin.click('[data-template-copy="' + ticketId + '"]'),
    ]);
    assert.equal(copyResponse.status(), 201);
    const copiedTicket = await copyResponse.json();
    assert.notEqual(copiedTicket.id, ticketId);
    assert.equal(copiedTicket.name, originalTicket.name + ' 복사');
    assert.equal(copiedTicket.contentHtml, originalTicket.content_html);
    assert.equal(copiedTicket.description, originalTicket.description);
    assert.equal(copiedTicket.version, originalTicket.version_label);
    assert.equal(copiedTicket.status, 'unused');
    assert.deepEqual((await query('SELECT * FROM templates WHERE id = ?', [ticketId]))[0], originalTicket);
    await admin.waitForSelector('[data-template-id="' + copiedTicket.id + '"]');
    await admin.screenshot({ path: path.join(artifacts, 'ticket-template-copy.png'), fullPage: true });
    await go(admin, '/applicant-question-template-management?tab=application');
    assert.deepEqual(await admin.$eval('.form-template-card', cardMetrics), ticketMetrics, 'Both template libraries share card and preview dimensions');
    assert.deepEqual(await admin.$$eval('.form-template-card:first-child .template-card-actions > *', buttons => buttons.map(button => button.textContent.trim())), ['미리보기', '수정']);
    assert(await admin.$eval('.form-template-card [data-form-template-action=copy]', el => el.nextElementSibling?.classList.contains('template-card-delete-button')));
    assert(await admin.$('.form-template-card .template-card-header-tools .template-card-delete-button'));
    assert(await admin.$eval('.form-template-card .template-card-header-tools .badge', el => el.textContent === '사용중'));
    await admin.click('[data-form-template-card="' + newApp + '"] [data-form-template-action=rename]');
    assert(await admin.$('[data-form-template-card="' + newApp + '"] .template-card-meta-editor-name'));
    await admin.$eval('[data-form-template-name]', el => { el.value = '외국인 원서접수 수정'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await admin.click('[data-form-template-form] button[type=submit]');
    await admin.waitForFunction(() => document.querySelector('.form-template-card .template-card-heading h3') && !document.querySelector('[data-form-template-form]'));
    assert.equal((await service.getApplicantFormTemplates()).find(item => item.id === newApp).name, '외국인 원서접수 수정');
    await admin.waitForSelector('[data-form-template-card]');
    assert.equal(await admin.$('.applicant-field-list'), null, 'Question editor opens only after choosing a card');
    const thumbnail = await (await admin.$('[data-form-template-card="' + newApp + '"] iframe')).contentFrame();
    await thumbnail.waitForSelector('[data-applicant-field-key=foreign-reason]');
    assert.equal(await thumbnail.$('[data-applicant-field-key=rule-document]'), null);
    assert.equal(await thumbnail.evaluate(() => document.documentElement.classList.contains('applicant-template-thumbnail')), true);
    await admin.screenshot({ path: path.join(artifacts, 'template-gallery.png'), fullPage: true });
    await admin.click('[data-form-template-card="' + newApp + '"] .form-template-thumbnail-open');
    assert((await admin.$eval('.applicant-field-list', el => el.textContent)).includes('지원동기'));
    assert(!(await admin.$eval('.applicant-field-list', el => el.textContent)).includes('규칙서류'));
    await admin.click('[data-form-template-list]');
    await admin.click('[data-form-template-action=create]');
    await admin.type('[data-form-template-name]', '화면에서 만든 양식');
    await admin.click('[data-form-template-form] button[type=submit]');
    await admin.waitForFunction(() => document.querySelector('.form-template-edit-heading h3')?.textContent === '화면에서 만든 양식');
    const uiId = Number(await admin.$eval('[data-form-template-editing]', el => el.dataset.formTemplateEditing));
    await admin.click('[data-applicant-field-add]');
    await admin.type('[data-applicant-field-input=questionText]', '새 양식 질문');
    await admin.type('[data-applicant-field-input=questionTextEn]', 'New template question');
    await admin.click('[data-applicant-field-form] button[type=submit]');
    await admin.waitForFunction(() => document.querySelector('.applicant-field-list')?.textContent.includes('새 양식 질문'));
    assert.equal((await service.getApplicantFormFields({ templateId: uiId })).length, 1);
    await admin.click('[data-form-template-list]');
    const uiCopyId = await copyFormFromButton(uiId, '[data-form-template-card="' + uiId + '"] [data-form-template-action=copy]', '화면에서 만든 양식 복사');
    await admin.screenshot({ path: path.join(artifacts, 'templates.png'), fullPage: true });
    await admin.click('[data-form-template-card="' + uiCopyId + '"] [data-form-template-action=delete]');
    await admin.waitForSelector('.form-template-delete-dialog[open]');
    assert(await admin.$eval('.form-template-delete-dialog', el => el.getBoundingClientRect().width <= 460));
    assert.equal(await admin.$('[data-form-template-form]'), null);
    assert.equal(await admin.$eval('.form-template-delete-dialog strong', el => el.textContent), '화면에서 만든 양식 복사');
    assert.equal(await admin.evaluate(() => document.activeElement.textContent), '취소');
    await admin.screenshot({ path: path.join(artifacts, 'template-delete-dialog.png') });
    await admin.click('.form-template-delete-actions [value=cancel]');
    assert((await service.getApplicantFormTemplates()).some(item => item.id === uiCopyId));
    await admin.click('[data-form-template-card="' + uiCopyId + '"] [data-form-template-action=delete]');
    await admin.keyboard.press('Escape');
    await admin.waitForFunction(() => !document.querySelector('.form-template-delete-dialog'));
    assert((await service.getApplicantFormTemplates()).some(item => item.id === uiCopyId));
    await admin.click('[data-form-template-card="' + uiCopyId + '"] [data-form-template-action=delete]');
    await admin.click('.form-template-delete-actions [value=delete]');
    await admin.waitForFunction(id => !document.querySelector('[data-form-template-card="' + id + '"]'), {}, uiCopyId);
    assert(!(await service.getApplicantFormTemplates()).some(item => item.id === uiCopyId));
    await admin.$eval('[data-form-template-card="' + uiId + '"]', el => el.scrollIntoView({ block: 'center' }));
    const refreshedFrame = await (await admin.$('[data-form-template-card="' + uiId + '"] iframe')).contentFrame();
    await refreshedFrame.waitForFunction(() => document.body?.textContent.includes('새 양식 질문'), { polling: 100 });
    await admin.click('[data-question-scope=documents]');
    await admin.waitForSelector('[data-form-template-card="' + newDoc + '"]');
    await copyFormFromButton(newDoc, '[data-form-template-card="' + newDoc + '"] [data-form-template-action=copy]', '외국인 서류제출 복사');
    assert(await admin.$eval('[data-form-template-card] [data-form-template-action=copy]', el => el.nextElementSibling?.classList.contains('template-card-delete-button')));
    const docFrame = await (await admin.$('[data-form-template-card="' + newDoc + '"] iframe')).contentFrame();
    await docFrame.waitForSelector('[data-applicant-field-key=foreign-proof]');
    assert.equal(await docFrame.$('[data-applicant-field-key=foreign-reason]'), null);
    await admin.screenshot({ path: path.join(artifacts, 'document-template-gallery.png'), fullPage: true });
    await admin.focus('[data-form-template-card="' + newDoc + '"] .form-template-thumbnail-open');
    await admin.keyboard.press('Enter');
    assert((await admin.$eval('.applicant-field-list', el => el.textContent)).includes('외국인 증빙'));
    await copyFormFromButton(newDoc, '[data-form-template-action=copy]', '외국인 서류제출 복사 2');
    await admin.setViewport({ width: 1280, height: 900 });
    assert(await admin.$$eval('.form-template-card', cards => cards.every(card => card.getBoundingClientRect().right <= innerWidth + 1)));
    const galleryFrame = await (await admin.$('[data-form-template-card="' + newDoc + '"] iframe')).contentFrame();
    await galleryFrame.waitForSelector('[data-applicant-field-key=foreign-proof]');
    assert(await galleryFrame.$eval('.applicant-public-step', el => el.getBoundingClientRect().top < 40), 'Short forms start at the top of the thumbnail');
    await admin.screenshot({ path: path.join(artifacts, 'template-gallery-1280.png'), fullPage: true });
    await admin.setViewport({ width: 1440, height: 1000 });
    await go(admin, '/applicant-schedules');
    await admin.click('tr[data-grid-row-clickable=true]');
    await admin.waitForSelector('#applicantScheduleModal:not(.hidden)');
    await admin.select('[data-applicant-schedule-input=applicationTemplateId]', String(uiId));
    await admin.select('[data-applicant-schedule-input=documentTemplateId]', String(newDoc));
    await admin.screenshot({ path: path.join(artifacts, 'schedule.png') });
    await admin.click('#applicantScheduleModalSaveButton');
    await admin.waitForSelector('#applicantScheduleModal.hidden');
    const changed = (await service.getApplicantSchedules()).find(item => item.admissionCode === '1');
    assert.equal(changed.applicationTemplateId, uiId);
    assert.equal(changed.documentTemplateId, newDoc);
    // Changing only dates retains the selected templates.
    await service.saveApplicantSchedule({ trackName: changed.trackName, admissionCode: changed.admissionCode, admissionName: changed.admissionName, documentReviewScheduleStartAt: changed.applicantScheduleStartAt, documentReviewScheduleEndAt: changed.applicantScheduleEndAt });
    const memberPage = await pageWithCookie(memberCookie);
    await go(memberPage, '/applicant/documents');
    await memberPage.waitForSelector('[data-applicant-form=member-documents]');
    assert((await memberPage.$eval('[data-applicant-form=member-documents]', el => el.textContent)).includes('외국인 증빙'));
    assert(!(await memberPage.$eval('[data-applicant-form=member-documents]', el => el.textContent)).includes('졸업증명서'));
    await memberPage.screenshot({ path: path.join(artifacts, 'member-documents.png'), fullPage: true });
    const oldAnswers = await query('SELECT field_key,answer_data FROM app_subm WHERE id=? ORDER BY field_key', [submissionId]);
    const wrong = await call('/api/public/members/documents', { answers: { document: {} } }, memberCookie);
    assert.equal(wrong.status, 400);
    const uploaded = await call('/api/public/members/documents', { answers: { 'foreign-proof': { fileName: 'proof.txt', mimeType: 'text/plain', base64: Buffer.from('proof').toString('base64') } } }, memberCookie);
    assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body));
    const status = await call('/api/public/members/document-status', null, memberCookie, 'GET');
    assert.equal(status.status, 200); assert.deepEqual(status.body.documents.map(item => item.fieldKey), ['foreign-proof']);
    assert.equal(status.body.documents[0].status, 'submitted');
    const afterAnswers = await query('SELECT field_key,answer_data FROM app_subm WHERE id=? ORDER BY field_key', [submissionId]);
    assert.deepEqual(afterAnswers.filter(item => item.field_key !== 'foreign-proof'), oldAnswers, 'Existing answers survive template changes');
    await go(admin, '/applicant-schedules');
    await admin.click('[data-grid-select-all]'); await admin.click('[data-applicant-schedule-bulk-edit]');
    await admin.waitForSelector('#applicantScheduleModal:not(.hidden)');
    assert.equal(await admin.$eval('[data-applicant-schedule-input=applicationTemplateId]', el => el.value), '');
    await admin.click('#applicantScheduleModalSaveButton'); await admin.waitForSelector('#applicantScheduleModal.hidden');
    assert.deepEqual((await service.getApplicantSchedules()).map(item => item.applicationTemplateId), [uiId, newApp]);
    await query("INSERT INTO applicant_members (login_id,password_hash,name,email,email_verified,profile_json,consent_json) SELECT 'template-ui@example.test',password_hash,'화면 지원자','template-ui@example.test',1,'{}','{}' FROM applicant_members LIMIT 1");
    const uiMemberLogin = await call('/api/public/members/login', { loginId: 'template-ui@example.test', password: 'MemberTest_12345' });
    assert.equal(uiMemberLogin.status, 200);
    const applicant = await pageWithCookie(uiMemberLogin.cookie);
    await go(applicant, '/applicant/apply');
    for (const [key, value] of Object.entries({ track: '수시', admission: '일반', series: '인문', unit: '문학' })) await applicant.select('#applicationSelection-' + key, value);
    await applicant.click('[data-applicant-action=continue-application]');
    await applicant.waitForFunction(() => document.querySelector('[data-applicant-form=application]')?.textContent.includes('새 양식 질문'));
    assert(!await applicant.$('[data-applicant-field-key=foreign-reason]'));
    await applicant.click('[data-applicant-action=back-form]');
    for (const [key, value] of Object.entries({ admission: '외국인', series: '인문', unit: '문학' })) await applicant.select('#applicationSelection-' + key, value);
    await applicant.click('[data-applicant-action=continue-application]');
    await applicant.waitForSelector('[data-applicant-field-key=foreign-reason]');
    assert(!(await applicant.$eval('[data-applicant-form=application]', el => el.textContent)).includes('새 양식 질문'));
    await applicant.type('[data-applicant-field-key=foreign-reason]', '다른 전형의 질문은 제출하지 않습니다.');
    const [applicationResponse] = await Promise.all([
      applicant.waitForResponse(response => response.url().endsWith('/api/public/applications') && response.request().method() === 'POST'),
      applicant.click('[data-applicant-form=application] button[type=submit]'),
    ]);
    assert.equal(applicationResponse.status(), 200, await applicationResponse.text());
    const preview = await pageWithCookie('');
    await go(preview, `/applicant/form?preview=1&templateId=${uiId}`);
    await preview.waitForFunction(() => document.body.textContent.includes('새 양식 질문'));
    assert(!await preview.$('[data-applicant-field-key=foreign-reason]'));
    assert.deepEqual(errors, []);
    console.log('PASS: admin template creation/edit/copy/delete, schedule selection, mixed bulk preservation, public template preview and document submission');
  } finally { await browser.close(); }

  const backup = await services.systemService.buildSystemBackupArchive({ includeDatabase: true, includedAssetKeys: [] });
  const expectedTemplates = await service.getApplicantFormTemplates();
  const expectedSchedules = await query('SELECT application_template_id,document_template_id FROM app_schedule ORDER BY id');
  await services.systemService.restoreSystemBackupArchive(backup.archiveBuffer, { selectedRestoreItemKeys: ['database'] });
  assert.deepEqual(await service.getApplicantFormTemplates(), expectedTemplates);
  assert.deepEqual(await query('SELECT application_template_id,document_template_id FROM app_schedule ORDER BY id'), expectedSchedules);
  const zip = new (require('adm-zip'))(backup.archiveBuffer);
  zip.deleteFile('tables/app_form_template.json');
  const manifest = JSON.parse(zip.readAsText('manifest.json'));
  manifest.tables = manifest.tables.filter(table => table.tableName !== 'app_form_template');
  zip.updateFile('manifest.json', Buffer.from(JSON.stringify(manifest)));
  for (const [table, columns] of [['app_form', ['template_id']], ['app_schedule', ['application_template_id', 'document_template_id']]]) {
    const rows = JSON.parse(zip.readAsText('tables/' + table + '.json'));
    for (const row of rows) for (const column of columns) delete row[column];
    zip.updateFile('tables/' + table + '.json', Buffer.from(JSON.stringify(rows)));
  }
  await services.systemService.restoreSystemBackupArchive(zip.toBuffer(), { selectedRestoreItemKeys: ['database'] });
  assert.equal((await service.getApplicantFormTemplates()).length, 2);
  assert((await service.getApplicantFormFields()).every(field => field.templateId === (field.formScope === 'documents' ? 2 : 1)));
  console.log('PASS: template assignments survive backup/restore and older backups restore with default templates');
}

module.exports = { runFormTemplateChecks };
