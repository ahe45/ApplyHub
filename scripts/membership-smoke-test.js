const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const mysql = require("mysql2/promise");
const puppeteer = require("puppeteer-core");
const { getDbConfig } = require("../db");
const { createApplicationServices } = require("../server/app/services");
const { createApplicantMembershipService } = require("../server/modules/applications/membership");
const { createApiRouteDependencies } = require("../server/app/api-route-dependencies");
const { createApiRoutes } = require("../server/http/api-routes");
const { dispatchRoute } = require("../server/http/router");
const { createPageRequestHandlers } = require("../server/http/page-handler");
const responseHelpers = require("../server/http/response");
const bodyHelpers = require("../server/http/body");
const { buildContentDisposition } = require("../server/http/content-disposition");
const config = require("../shared/app-config");

async function run() {
  const developmentMode = process.argv.includes('--development-code');
  const database = `admitcard_membership_test_${Date.now()}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "admitcard-member-test-"));
  const admin = await mysql.createConnection(getDbConfig(false));
  let pool, server, browser;
  try {
    await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4`);
    pool = mysql.createPool({ ...getDbConfig(), database });
    const query = async (sql, params = []) => (await pool.query(sql, params))[0];
    const services = createApplicationServices({ fs, path, query, getPool: () => pool, rootDir: root, env: { ...process.env, DB_NAME: database } });
    await services.initializeApplicationData();
    // Simulate an existing database before separate document questions were introduced.
    const legacyFields = await query('SELECT id, field_key, question_text, input_type FROM app_form ORDER BY id');
    await query('ALTER TABLE app_form DROP COLUMN form_scope');
    await services.initializeApplicationData();
    assert.deepEqual(await query('SELECT id, field_key, question_text, input_type FROM app_form ORDER BY id'), legacyFields);
    assert((await query('SELECT form_scope FROM app_form')).every(field => field.form_scope === 'application'));
    let deliveredCode = "";
    const members = createApplicantMembershipService({ query, getPool: () => pool, createHttpError: services.createHttpError,
      env: { NODE_ENV: developmentMode ? 'development' : 'production', APPLICANT_SIGNUP_CODE_PREVIEW: 'true' },
      sendEmail: async ({ codeValue }) => { deliveredCode = codeValue; } });
    await query('ALTER TABLE applicant_members MODIFY login_id VARCHAR(40) NOT NULL');
    await members.initialize();
    assert.equal((await query("SHOW COLUMNS FROM applicant_members LIKE 'login_id'"))[0].Type, 'varchar(255)', 'Legacy schema supports email identifiers');
    const deps = createApiRouteDependencies({ ...services, membershipService: members, query, ...responseHelpers, ...bodyHelpers, buildContentDisposition });
    const routes = createApiRoutes(deps);
    const pages = createPageRequestHandlers({ fs, path, root: path.resolve(__dirname, ".."), ...config, ...services });
    let nextDocumentGate = null;
    server = http.createServer(async (request, response) => {
      try {
        const url = new URL(request.url, `http://${request.headers.host}`);
        if (nextDocumentGate && request.headers['sec-fetch-dest'] === 'document') {
          const gate = nextDocumentGate;
          nextDocumentGate = null;
          gate.requested();
          await gate.ready;
        }
        if (url.pathname.startsWith("/api/")) {
          if (!await dispatchRoute(routes, { request, response, requestUrl: url }, { authenticate: services.getAuthenticatedAccountFromRequest })) responseHelpers.sendJson(response, 404, {});
        } else if (!await pages.handlePageRequest(request, response, url.pathname)) pages.serveStaticFile(response, url.pathname);
      } catch (error) { responseHelpers.sendJson(response, error.statusCode || 500, { error: error.message, code: error.errorCode || '', ...(error.fieldKey ? { fieldKey: error.fieldKey } : {}) }); }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (url, data, cookie = "", method = "POST") => {
      const response = await fetch(base + url, { method, headers: { "Content-Type": "application/json", Cookie: cookie }, ...(method !== "GET" ? { body: JSON.stringify(data || {}) } : {}) });
      const text = await response.text();
      return { status: response.status, body: (() => { try { return JSON.parse(text); } catch { return text; } })(), cookie: response.headers.get("set-cookie")?.split(";")[0] || "" };
    };
    const memberPath = "/api/public/members/";
    const password = "MemberTest_12345";
    await members.saveSettings({ birth: "required", phone: "optional", termsEnabled: true, termsTitle: "테스트 약관", termsText: "테스트 약관 내용", extraFields: [{ key: "address", label: "주소", required: true }] });
    const settings = await members.publicSettings();
    const signup = { password, passwordConfirm: password, name: "회원 테스트", email: "member01@example.test", profile: { birth: "2001-02-03", address: "서울" }, agreed: true, termsVersion: settings.termsVersion };
    let result = await call(memberPath + "register", signup);
    assert.equal(result.status, 400, "Registration must require verified email");
    result = await call(memberPath + "email-code", { email: signup.email });
    assert.equal(result.status, 200, JSON.stringify(result));
    if (developmentMode) {
      assert.match(result.body.debugCode, /^\d{6}$/);
      assert.equal(deliveredCode, '', 'Development signup must not contact SMTP');
      deliveredCode = result.body.debugCode;
    } else assert.equal(result.body.debugCode, undefined, 'Production must never expose the code even with the preview flag');
    signup.verificationId = result.body.verificationId;
    assert.equal((await call(memberPath + "verify-email", { email: signup.email, verificationId: signup.verificationId, code: "bad" })).status, 400);
    assert.equal((await call(memberPath + "verify-email", { email: signup.email, verificationId: signup.verificationId, code: deliveredCode })).status, 200);
    assert.equal((await call(memberPath + 'register', { ...signup, email: 'different@example.test' })).status, 400, 'A proof only verifies its own email');
    assert.equal((await call(memberPath + "register", { ...signup, agreed: false })).status, 400);
    const legacy = await query("INSERT INTO app_meta () VALUES ()");
    await query("INSERT INTO app_subm (id,applicant_name,email,field_key,answer_data) VALUES (?,?,?,?,?)", [legacy.insertId, signup.name, signup.email, "applicant-name", JSON.stringify(signup.name)]);
    // This trigger exists only in the disposable test database.
    await query("CREATE TRIGGER membership_smoke_reject_session BEFORE INSERT ON applicant_member_sessions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Test session insert failure'");
    try {
      const failedSignup = await call(memberPath + 'register', signup);
      assert.equal(failedSignup.status, 500);
      assert.equal(failedSignup.cookie, '', 'Failed auto-login must not send a session cookie');
      assert.equal((await query('SELECT id FROM applicant_members WHERE email = ?', [signup.email])).length, 0, 'Session failure rolls back account creation');
      assert.equal((await query('SELECT verified FROM applicant_member_verifications WHERE id = ?', [signup.verificationId]))[0].verified, 1, 'Session failure retains verification for retry');
      assert.equal((await query('SELECT member_id FROM app_meta WHERE id = ?', [legacy.insertId]))[0].member_id, null);
    } finally { await query('DROP TRIGGER membership_smoke_reject_session'); }
    result = await call(memberPath + "register", signup);
    assert.equal(result.status, 200, JSON.stringify(result));
    assert.equal(result.body.accountType, 'applicant');
    assert.equal(result.body.redirectTo, '/applicant');
    assert.equal(result.body.member.email, signup.email);
    assert(result.cookie.startsWith('admitcard.member='));
    assert.equal((await call(memberPath + 'session', null, result.cookie, 'GET')).body.member.email, signup.email, 'Registration immediately creates a usable member session');
    assert.equal((await call('/api/applicant-signup-settings', null, result.cookie, 'GET')).status, 401, 'Auto-login never grants staff access');
    assert.notEqual((await call(memberPath + "register", signup)).status, 200, "Proof cannot be reused");
    assert.equal((await query('SELECT login_id FROM applicant_members WHERE email = ?', [signup.email]))[0].login_id, signup.email);
    await query('UPDATE applicant_members SET login_id = ? WHERE email = ?', ['legacy-member01', signup.email]);
    await members.initialize();
    assert.equal((await query('SELECT login_id FROM applicant_members WHERE email = ?', [signup.email]))[0].login_id, 'legacy-member01', 'Legacy stored IDs and member data are not overwritten');
    assert.equal((await call(memberPath + 'login', { loginId: 'legacy-member01', password })).status, 401);
    assert.equal((await call(memberPath + "login", { loginId: signup.email, password: "wrong" })).status, 401);
    const login = await call(memberPath + "login", { loginId: signup.email, password });
    assert.equal(login.status, 200, JSON.stringify(login));
    assert.equal((await call('/api/auth/login', { id: signup.email, password: 'wrong' })).status, 401);
    assert.equal((await call('/api/auth/login', { id: 'admin', password: 'wrong' })).status, 401);
    assert.equal((await call(memberPath + 'login', { loginId: 'member01', password })).status, 401, 'Separate member IDs no longer log in');
    await assert.rejects(() => services.authService.createAccount({ id: signup.email, name: '중복', role: '관리자' }), /이미 사용 중/);
    assert.equal((await call(memberPath + "application", null, login.cookie, "GET")).body.submission.id, legacy.insertId, "Verified members should recover their own legacy submission");
    assert.equal((await call('/api/public/applications', {}, login.cookie)).status, 409, 'Linked legacy submission also counts as completed');
    // Remove only this disposable legacy fixture before testing a first-time application.
    await services.applicantService.deleteApplicantSubmission(legacy.insertId);
    assert(login.cookie);
    assert.equal((await call(memberPath + "session", null, login.cookie, "GET")).body.member.loginId, signup.email);
    assert.equal((await call("/api/applicant-signup-settings", {}, login.cookie, "GET")).status, 401, "Applicant cookie must not authorize admin APIs");
    assert.equal((await call("/api/public/applications", {})).status, 401);
    assert.equal((await call("/api/public/applications/lookup", {})).status, 401);
    assert.equal((await call("/.env", null, "", "GET")).status, 404);
    assert.equal((await call("/db/schema.sql", null, "", "GET")).status, 404);
    assert.equal((await call("/uploads/file/private.txt", null, "", "GET")).status, 404);
    console.log("PASS: verification, terms, registration, login, session and authorization");
    await assert.rejects(() => services.applicantService.createApplicantFormField({ questionText: '중복 생년월일', inputType: 'birthdate' }), /회원가입/);

    await query("INSERT INTO app_unit (track_name, admission_code, admission_name, series_code, series_name, unit_code, unit_name) VALUES ('수시','1','일반','2','인문','3','문학')");
    await query("INSERT INTO app_schedule (track_name, admission_code, admission_name, applicant_schedule_start_at, applicant_schedule_end_at, admit_card_lookup_schedule_start_at, admit_card_lookup_schedule_end_at) VALUES ('수시','1','일반',DATE_SUB(NOW(), INTERVAL 1 DAY),DATE_ADD(NOW(), INTERVAL 1 DAY),DATE_SUB(NOW(), INTERVAL 1 DAY),DATE_ADD(NOW(), INTERVAL 1 DAY))");
    await query("UPDATE app_form SET required = 0 WHERE system_field_key <> 'name'");
    await services.applicantService.createApplicantFormField({ formScope: 'documents', fieldKey: "document", questionText: "졸업증명서", inputType: "file", required: false });
    await services.applicantService.createApplicantFormField({ formScope: 'documents', fieldKey: 'document-note', questionText: '제출 확인사항', inputType: 'text', required: true });
    const application = { selectionAnswers: { track: "수시", admission: "일반", series: "인문", unit: "문학", major: "" }, answers: { "applicant-name": signup.name, birth: "1900-01-01" } };
    await services.applicantService.createApplicantFormField({ fieldKey: 'rule-document', questionText: '규칙서류', inputType: 'file', required: false, fileNamePattern: '{수험번호}_증빙_{원본파일명}', allowedExtensions: '.txt, TXT' });
    let ruleField = (await services.applicantService.getApplicantFormFields()).find(f => f.fieldKey === 'rule-document');
    const publicForm = await services.applicantService.getApplicantPublicForm();
    assert(publicForm.fields.some(field => field.fieldKey === 'rule-document'));
    assert(!publicForm.fields.some(field => field.fieldKey === 'document'));
    assert.deepEqual(publicForm.documentFields.map(field => field.fieldKey), ['document', 'document-note']);
    await assert.rejects(() => services.applicantService.updateApplicantFormField(ruleField.id, { formScope: 'documents' }), error => error.errorCode === 'APPLICANT_FIELD_SCOPE_INVALID');
    assert.deepEqual(ruleField.allowedExtensions, ['txt']);
    assert.equal(ruleField.fileNamePattern, '{수험번호}_증빙_{원본파일명}');
    const ruleUpload = { base64: Buffer.from('rule content').toString('base64'), fileName: 'sample.TXT', mimeType: 'text/plain' };
    await services.applicantService.createApplicantFormField({ fieldKey: 'application-document', questionText: '졸업증명서', inputType: 'file', required: false });
    application.answers['application-document'] = { ...ruleUpload, fileName: 'original.txt' };
    assert.equal((await call('/api/public/applications', { ...application, answers: { ...application.answers, 'rule-document': { ...ruleUpload, fileName: 'sample.pdf' } } }, login.cookie)).status, 400);
    application.answers['rule-document'] = ruleUpload;
    const staleApplicationContext = (await call(memberPath + 'application', null, login.cookie, 'GET')).body;
    const concurrentApplications = await Promise.all([call('/api/public/applications', application, login.cookie), call('/api/public/applications', application, login.cookie)]);
    assert.deepEqual(concurrentApplications.map(response => response.status).sort(), [200, 409], 'Concurrent submissions save only once');
    result = concurrentApplications.find(response => response.status === 200);
    assert.equal(result.status, 200, JSON.stringify(result));
    const submission = result.body;
    assert(submission.id);
    const beforeRetry = await query('SELECT * FROM app_subm WHERE id = ? ORDER BY field_key', [submission.id]);
    const retry = await call('/api/public/applications', { ...application, submissionId: submission.id }, login.cookie);
    assert.equal(retry.status, 409);
    assert.equal(retry.body.code, 'APPLICANT_ALREADY_SUBMITTED');
    await assert.rejects(() => services.applicantService.saveApplicantSubmission({ ...application, accessToken: staleApplicationContext.accessToken }), error => error.errorCode === 'APPLICANT_ALREADY_SUBMITTED', 'Old access tokens cannot overwrite a completed application');
    assert.deepEqual(await query('SELECT * FROM app_subm WHERE id = ? ORDER BY field_key', [submission.id]), beforeRetry, 'Repeated requests leave all saved answers unchanged');
    const completedContext = (await call(memberPath + 'application', null, login.cookie, 'GET')).body;
    assert(completedContext.menuWindows.ticket.startAt <= completedContext.serverTime && completedContext.menuWindows.ticket.endAt >= completedContext.serverTime);
    assert.deepEqual(completedContext.menuWindows.documents, { startAt: null, endAt: null });
    assert.equal(submission.answerMap.birth, signup.profile.birth, 'Member birthdate overrides client-supplied dates in submitted answers');
    const ruleFileName = submission.answerMap['rule-document'].fileName;
    assert.match(ruleFileName, /_증빙_sample_[a-f0-9]{16}\.TXT$/);
    assert.equal(fs.readFileSync(path.join(root, 'uploads/file', ruleFileName), 'utf8'), 'rule content');
    const downloaded = await services.applicantService.getApplicantSubmissionFile(submission.id, 'rule-document');
    assert.equal(downloaded.fileName, ruleFileName);
    assert.equal(downloaded.fileBlob.toString(), 'rule content');
    await services.applicantService.createApplicantFormField({ formScope: 'documents', fieldKey: "late-document", questionText: "추가서류", inputType: "file", required: false, allowedExtensions: 'txt' });
    const upload = { base64: Buffer.from("test document content").toString("base64"), fileName: "original.txt", mimeType: "text/plain" };
    assert.equal((await call(memberPath + "documents", { answers: { document: upload } }, login.cookie)).status, 409, "Unconfigured document period must stay closed even during reception");
    const scheduleTarget = (await services.applicantService.getApplicantSchedules())[0];
    const documentDates = {
      documentSubmissionScheduleStartAt: scheduleTarget.applicantScheduleStartAt,
      documentSubmissionScheduleEndAt: scheduleTarget.applicantScheduleEndAt,
    };
    await assert.rejects(() => services.applicantService.saveApplicantSchedule({ ...scheduleTarget, ...documentDates, documentSubmissionScheduleEndAt: "" }), /모두 입력/);
    await assert.rejects(() => services.applicantService.saveApplicantSchedule({ ...scheduleTarget, documentSubmissionScheduleStartAt: documentDates.documentSubmissionScheduleEndAt, documentSubmissionScheduleEndAt: documentDates.documentSubmissionScheduleStartAt }), /늦을 수 없습니다/);
    const savedSchedules = await services.applicantService.saveApplicantSchedule({ ...scheduleTarget, ...documentDates });
    assert.equal(savedSchedules[0].documentSubmissionScheduleStartAt, documentDates.documentSubmissionScheduleStartAt);
    assert.equal(savedSchedules[0].applicantScheduleEndAt, scheduleTarget.applicantScheduleEndAt);
    assert.equal((await call(memberPath + 'documents', { answers: { 'rule-document': { ...ruleUpload, fileName: 'sample.pdf' } } }, login.cookie)).status, 400);
    const scopeRejected = await call(memberPath + 'documents', { answers: { 'rule-document': ruleUpload } }, login.cookie);
    assert.equal(scopeRejected.status, 400);
    assert.equal(scopeRejected.body.code, 'DOCUMENT_ANSWER_SCOPE_INVALID');
    const requiredDocument = await call(memberPath + 'documents', { answers: { document: upload } }, login.cookie);
    assert.equal(requiredDocument.status, 400);
    assert.equal(requiredDocument.body.fieldKey, 'document-note');
    assert.equal((await call(memberPath + 'documents', { answers: { 'document-note': '확인했습니다', 'late-document': { ...ruleUpload, fileName: 'sample.pdf' } } }, login.cookie)).status, 400);
    assert.equal((await call(memberPath + 'documents', { answers: { 'document-note': '확인했습니다', 'late-document': ruleUpload } }, login.cookie)).status, 200);
    const afterDocuments = await services.applicantService.getApplicantSubmissionById(submission.id);
    assert.equal(afterDocuments.answerMap['document-note'], '확인했습니다');
    assert.equal(afterDocuments.answerMap['rule-document'].fileName, ruleFileName, 'Document saving preserves application uploads');
    await services.applicantService.updateApplicantFormField(ruleField.id, { fileNamePattern: '서류_{수험번호}', allowedExtensions: 'pdf' });
    ruleField = (await services.applicantService.getApplicantFormFields()).find(f => f.fieldKey === 'rule-document');
    assert.equal(ruleField.fileNamePattern, '서류_{수험번호}');
    assert.deepEqual(ruleField.allowedExtensions, ['pdf']);
    assert(fs.existsSync(path.join(root, 'uploads/file', ruleFileName)), 'Changing settings preserves old uploads');
    await services.applicantService.saveApplicantSchedules({ schedules: [{ ...scheduleTarget, ...documentDates }] });
    assert.equal((await services.applicantService.getApplicantSchedules())[0].documentSubmissionScheduleEndAt, documentDates.documentSubmissionScheduleEndAt);
    result = await call(memberPath + "documents", { answers: { document: upload } }, login.cookie);
    assert.equal(result.status, 200, JSON.stringify(result));
    assert.match(result.body.answerMap.document.fileName, /_졸업증명서_[a-f0-9]{16}\.txt$/);
    assert(fs.existsSync(path.join(root, 'uploads', 'file', result.body.answerMap.document.fileName)));
    const originalApplicationFile = await services.applicantService.getApplicantSubmissionFile(submission.id, 'application-document');
    assert.equal(originalApplicationFile.fileBlob.toString(), 'rule content', 'Same-title document upload cannot overwrite an application file');
    result = await call(memberPath + "documents", { answers: { "late-document": upload } }, login.cookie);
    assert.equal(result.status, 200, JSON.stringify(result));
    assert((await query("SELECT field_key FROM app_subm WHERE id = ? AND field_key = 'late-document'", [submission.id])).length);
    if (process.argv.includes('--archive')) {
      await require('./applicant-archive-test').verifyApplicantArchive({ services, call, base, memberCookie: login.cookie, submissionId: submission.id });
      return;
    }
    if (process.argv.includes('--submission-tickets')) {
      await require('./submission-ticket-test').verifySubmissionTickets({ services, call, base, query, submissionId: submission.id, memberCookie: login.cookie });
      return;
    }
    await members.saveSettings({ emailVerification: false, birth: "hidden", phone: "hidden" });
    assert.equal((await members.getSettings()).emailVerification, true, 'Email verification cannot be disabled');
    async function verifiedRegistration(data) {
      const proof = await members.sendCode({ email: data.email }, 'test-' + data.email);
      await members.verifyCode({ email: data.email, verificationId: proof.verificationId, code: proof.debugCode || deliveredCode }, 'test-' + data.email);
      return members.register({ ...data, verificationId: proof.verificationId }, 'test-' + data.email);
    }
    let credentialCase = 0;
    for (const email of ['abc', 'user@', 'user name@example.test']) {
      await assert.rejects(() => members.register({ email, password: '1234', passwordConfirm: '1234', name: '규칙 테스트' }, `credential-${credentialCase++}`), /올바른 이메일/);
    }
    for (const value of ['123', 'a'.repeat(21)]) {
      await assert.rejects(() => members.register({ loginId: 'validid', password: value, passwordConfirm: value, name: '규칙 테스트', email: `invalid${credentialCase}@example.test` }, `credential-${credentialCase++}`), /비밀번호는 4~20자/);
    }
    for (const value of ['1234', '!'.repeat(20)]) {
      const email = `${'a'.repeat(50)}${credentialCase++}@example.test`;
      await verifiedRegistration({ password: value, passwordConfirm: value, name: '길이 경계 테스트', email });
      assert.equal((await call('/api/auth/login', { id: email.toUpperCase(), password: value })).status, 200);
    }
    const second = { name: "다른 회원", email: "member02@example.test", password, passwordConfirm: password };
    assert.equal((await verifiedRegistration(second)).ok, true);
    const secondLogin = await call(memberPath + "login", second);
    assert.equal((await call(memberPath + "application", null, secondLogin.cookie, "GET")).body.submission, null);
    const secondApplication = await call('/api/public/applications', { ...application, answers: { 'applicant-name': second.name } }, secondLogin.cookie);
    assert.equal(secondApplication.status, 200, 'A different account can submit independently');
    await services.applicantService.deleteApplicantSubmission(secondApplication.body.id);
    assert.equal((await call(`/api/public/applications/${submission.id}/admit-card.pdf`, null, secondLogin.cookie, "GET")).status, 403);
    assert.equal((await call(memberPath + "documents", { submissionId: submission.id, answers: { document: upload } }, secondLogin.cookie)).status, 409);
    await call(memberPath + "logout", {}, secondLogin.cookie);
    assert.equal((await call(memberPath + "session", null, secondLogin.cookie, "GET")).body.member, null);
    await query('UPDATE applicant_members SET email_verified = 0, login_id = ? WHERE email = ?', ['legacy-member02', second.email]);
    assert.equal((await call(memberPath + 'login', second)).status, 403, 'Unverified legacy members must verify email');
    const legacyProof = await members.requestRecovery({ purpose: 'password', name: second.name, email: second.email }, 'legacy-recovery');
    assert.equal(legacyProof.debugCode, undefined, 'Recovery never exposes codes in development');
    await members.completeRecovery({ purpose: 'password', recoveryId: legacyProof.recoveryId, code: deliveredCode, password, passwordConfirm: password }, 'legacy-recovery');
    assert.equal((await call(memberPath + 'login', second)).status, 200, 'Email verification through reset enables legacy email login');
    await query("UPDATE app_schedule SET applicant_schedule_end_at = DATE_SUB(NOW(), INTERVAL 1 HOUR)");
    assert.equal((await call(memberPath + "documents", { answers: { document: upload } }, login.cookie)).status, 200, "Documents can be submitted after reception closes");
    await query("UPDATE app_schedule SET document_submission_schedule_start_at = DATE_ADD(NOW(), INTERVAL 1 HOUR)");
    assert.equal((await call(memberPath + "documents", { answers: { document: upload } }, login.cookie)).status, 409, "Before document period");
    await query("UPDATE app_schedule SET document_submission_schedule_start_at = DATE_SUB(NOW(), INTERVAL 1 DAY), document_submission_schedule_end_at = DATE_SUB(NOW(), INTERVAL 1 HOUR)");
    assert.equal((await call(memberPath + "documents", { answers: { document: upload } }, login.cookie)).status, 409, "After document period");
    await query("UPDATE app_schedule SET document_submission_schedule_end_at = DATE_ADD(NOW(), INTERVAL 1 DAY)");
    await query("UPDATE app_schedule SET applicant_schedule_end_at = DATE_ADD(NOW(), INTERVAL 1 DAY)");
    console.log("PASS: member application ownership, document persistence, deadlines and logout");
    if (process.argv.includes('--application-core')) {
      await query("INSERT INTO app_schedule (track_name, admission_code, admission_name, admit_card_lookup_schedule_start_at, admit_card_lookup_schedule_end_at, document_submission_schedule_start_at, document_submission_schedule_end_at) VALUES ('다른모집','9','별도전형',DATE_SUB(NOW(), INTERVAL 1 DAY),DATE_ADD(NOW(), INTERVAL 1 DAY),DATE_SUB(NOW(), INTERVAL 1 DAY),DATE_ADD(NOW(), INTERVAL 1 DAY))");
      await query("INSERT INTO system_set (setting_key, setting_value) VALUES ('admitCardDataSource','submission') ON DUPLICATE KEY UPDATE setting_value='submission'");
      for (const [start, end, code] of [
        ['DATE_ADD(NOW(), INTERVAL 1 HOUR)', 'DATE_ADD(NOW(), INTERVAL 1 DAY)', 'APPLICANT_ADMIT_CARD_LOOKUP_SCHEDULE_NOT_STARTED'],
        ['DATE_SUB(NOW(), INTERVAL 1 DAY)', 'DATE_SUB(NOW(), INTERVAL 1 HOUR)', 'APPLICANT_ADMIT_CARD_LOOKUP_SCHEDULE_ENDED'],
        ['NULL', 'NULL', 'APPLICANT_ADMIT_CARD_LOOKUP_SCHEDULE_NOT_CONFIGURED'],
      ]) {
        await query(`UPDATE app_schedule SET admit_card_lookup_schedule_start_at=${start}, admit_card_lookup_schedule_end_at=${end}, document_submission_schedule_start_at=${start}, document_submission_schedule_end_at=${end} WHERE track_name='수시' AND admission_code='1'`);
        const context = (await call(memberPath + 'application', null, login.cookie, 'GET')).body;
        for (const window of Object.values(context.menuWindows)) assert(window.startAt === null || context.serverTime < window.startAt || context.serverTime > window.endAt, 'Only the submitted recruitment schedule applies');
        const pdf = await call(`/api/public/applications/${submission.id}/admit-card.pdf`, null, login.cookie, 'GET');
        assert.equal(pdf.status, 409); assert.equal(pdf.body.code, code);
        assert.equal((await call(memberPath + 'documents', { answers: { document: upload } }, login.cookie)).status, 409);
        assert.equal(context.submission.id, submission.id, 'Results remain available outside print/document periods');
      }
      console.log('PASS: concurrent/replayed application denial, independent accounts, own-schedule windows and direct PDF/document enforcement');
      return;
    }

    browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
    const page = await browser.newPage();
    async function submitLoginWithoutFlash() {
      // Hold the next document so the old login page remains observable after success.
      let releaseNavigation;
      const navigationGate = new Promise(resolve => { releaseNavigation = resolve; });
      let navigationRequested;
      const requested = new Promise(resolve => { navigationRequested = resolve; });
      nextDocumentGate = { requested: navigationRequested, ready: navigationGate };
      try {
        await page.evaluate(() => {
          const bounds = () => {
            const stage = document.querySelector('.common-login-stage');
            const rect = stage?.getBoundingClientRect();
            if (!rect) return {};
            // Clicking an off-screen submit button scrolls the content-area (not always window).
            let x = rect.x, y = rect.y;
            for (let parent = stage.parentElement; parent; parent = parent.parentElement) {
              x += parent.scrollLeft;
              y += parent.scrollTop;
            }
            return { x, y, width: rect.width, height: rect.height };
          };
          const before = bounds();
          document.addEventListener('submit', () => {
            queueMicrotask(() => {
              const submittingForm = document.querySelector('#loginForm');
              const result = { samples: 0, stable: true };
              const sample = () => {
                const form = document.querySelector('#loginForm');
                const rect = bounds();
                result.samples++;
                const checks = {
                  sameForm: form === submittingForm,
                  disabled: form?.querySelector('button[type=submit]').disabled,
                  locked: document.querySelector('.app-shell').classList.contains('auth-locked'),
                  hiddenChrome: ['.sidebar', '.topbar'].every(selector => getComputedStyle(document.querySelector(selector)).display === 'none'),
                  stableLayout: ['x', 'y', 'width', 'height'].every(key => Math.abs(rect[key] - before[key]) < 1),
                };
                if (!Object.values(checks).every(Boolean) && !result.firstFailure) result.firstFailure = { checks, before, rect };
                result.stable = result.stable && Object.values(checks).every(Boolean);
                sessionStorage.setItem('auth-transition-test', JSON.stringify(result));
              };
              sample();
              new MutationObserver(sample).observe(document.body, { subtree: true, childList: true, attributes: true });
              window.addEventListener('pagehide', sample, { once: true });
            });
          }, { once: true });
        });
        const navigated = page.waitForNavigation({ waitUntil: 'domcontentloaded' });
        await page.click('#loginForm button[type=submit]');
        let timeout;
        try {
          await Promise.race([requested, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Login did not navigate')), 10000); })]);
        } finally { clearTimeout(timeout); }
        await new Promise(resolve => setTimeout(resolve, 150));
        releaseNavigation();
        await navigated;
        const transition = await page.evaluate(() => JSON.parse(sessionStorage.getItem('auth-transition-test')));
        assert(transition.samples >= 2, 'Observe the submitting form through page unload');
        assert.equal(transition.stable, true, 'Login must remain stable and disabled until navigation completes: ' + JSON.stringify(transition.firstFailure));
        console.log('PASS: login form and layout stay stable during delayed navigation');
      } finally {
        releaseNavigation();
        nextDocumentGate = null;
      }
    }
    async function verifySignupEmailInBrowser() {
      const response = page.waitForResponse(r => r.url().endsWith('/members/email-code'));
      await page.click('[data-applicant-action=member-send-code]');
      const proof = await (await response).json();
      await page.type('[name=code]', proof.debugCode || deliveredCode);
      await page.click('[data-applicant-action=member-verify-code]');
      await page.waitForFunction(() => document.querySelector('[data-member-verified]')?.textContent.includes('인증 완료'));
    }
    async function checkMobileLayout(screen) {
      for (const width of [320, 390, 1440]) {
        await page.setViewport({ width, height: 844 });
        const layout = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          frame: document.querySelector('.applicant-public-frame, .common-login-stage').getBoundingClientRect().width,
          columns: [...document.querySelectorAll('.applicant-member-form-grid, .applicant-public-home, .applicant-public-summary-grid')].filter(el => el.getClientRects().length).map(el => getComputedStyle(el).gridTemplateColumns.split(' ').length),
        }));
        const overflowingElements = layout.overflow ? await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map(el => ({ tag: el.tagName, class: el.className, width: el.getBoundingClientRect().width }))) : [];
        assert.equal(layout.overflow, false, `${screen}: horizontal overflow at ${width}: ${JSON.stringify(overflowingElements)}`);
        assert(layout.frame <= 521, `${screen}: desktop must retain mobile page width`);
        assert(layout.columns.every(count => count === 1), `${screen}: use single-column layout`);
      }
    }
    async function assertFeedbackBelow(selector, expected, isError = false) {
      await page.waitForFunction((selector, expected) => {
        const field = document.querySelector(selector)?.closest('.applicant-public-field, .login-field');
        return field?.querySelector('[data-field-feedback]')?.textContent.includes(expected);
      }, {}, selector, expected);
      assert(await page.$eval(selector, (input, isError) => {
        const field = input.closest('.applicant-public-field, .login-field');
        const status = field.querySelector('[data-field-feedback]');
        return status.getBoundingClientRect().top >= input.getBoundingClientRect().bottom && status.classList.contains('is-error') === isError && input.getAttribute('aria-describedby').split(' ').includes(status.id);
      }, isError), 'Field feedback appears below the control and is associated for screen readers');
    }
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(base + "/applicant", { waitUntil: "networkidle2" });
    await page.waitForSelector("#loginForm");
    assert.equal(new URL(page.url()).pathname, '/login');
    await checkMobileLayout('login');
    await page.click(".common-login-signup");
    await page.waitForSelector("[data-applicant-form='member-terms']", { visible: true });
    assert.equal(await page.$eval('[data-member-step=details]', el => el.hidden), true);
    await checkMobileLayout('signup terms disabled');
    await page.click('[data-applicant-form=member-terms] button[type=submit]');
    await page.waitForSelector("[data-applicant-form='member-register']", { visible: true });
    assert.equal(await page.$('[name=loginId]'), null);
    assert.equal(await page.$eval('[name=email]', el => el.maxLength), 255);
    assert.equal(await page.$eval('[name=password]', el => el.minLength), 4);
    assert.equal(await page.$eval('[name=passwordConfirm]', el => el.maxLength), 20);
    await checkMobileLayout('signup');
    const signupViewport = page.viewport();
    for (const width of [320, 390, 1440]) {
      await page.setViewport({ width, height: 844 });
      assert(await page.$$eval('.applicant-member-input-action', rows => rows.length === 2 && rows.every(row => {
        const input = row.querySelector('input').getBoundingClientRect(), button = row.querySelector('button').getBoundingClientRect();
        return Math.abs(input.top - button.top) < 1 && Math.abs(input.height - button.height) < 1 && input.right <= button.left && button.right <= innerWidth;
      })), 'Email/code action buttons stay aligned to the right of their inputs on mobile and desktop');
    }
    await page.setViewport(signupViewport);
    assert.equal(await page.$("[name='profile.birth']"), null);
    assert(await page.$("[data-applicant-action='member-send-code']"));
    await page.type("[name=name]", "브라우저 회원");
    await page.type("[name=password]", password);
    await page.type("[name=passwordConfirm]", password);
    await page.type("[name=email]", "browser01@example.test");
    await verifySignupEmailInBrowser();
    await page.click("[data-applicant-form='member-register'] button[type=submit]");
    await page.waitForSelector('.applicant-member-tile');
    assert.equal(new URL(page.url()).pathname, '/applicant');
    assert.equal(await page.evaluate(() => fetch('/api/public/members/session').then(r => r.json()).then(s => s.member.email)), 'browser01@example.test');
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('.applicant-member-tile');
    await page.click('.public-school-logout');
    await page.waitForSelector("#loginAccountId:not([disabled])");
    await page.type("#loginAccountId", signup.email);
    await page.type("#loginPassword", password);
    await submitLoginWithoutFlash();
    await page.waitForSelector(".applicant-member-tile");
    await checkMobileLayout('member home');
    assert.equal(await page.$$eval(".applicant-member-tile", (tiles) => tiles.length), 4);
    assert.equal(await page.$eval(".applicant-member-menu", (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length), 2);
    const artifacts = path.resolve(__dirname, "../.tmp-membership-check");
    fs.mkdirSync(artifacts, { recursive: true });
    await page.screenshot({ path: path.join(artifacts, "member-home.png"), fullPage: true });
    await page.click("[data-applicant-action='member-summary']");
    await page.waitForFunction(() => location.pathname === "/applicant/lookup/result");
    await checkMobileLayout('application result');
    await page.goto(base + "/applicant/documents", { waitUntil: "networkidle2" });
    await page.waitForSelector("[data-applicant-form='member-documents']");
    assert.equal(await page.$('#field-rule-document'), null, 'Application uploads never appear in document submission');
    assert.equal(await page.$eval('#field-document-note', el => el.value), '확인했습니다');
    await page.$eval('#field-document-note', el => { el.value = '브라우저에서 서류 확인'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    const documentSave = page.waitForResponse(r => r.url().endsWith('/api/public/members/documents') && r.request().method() === 'POST');
    await page.click('[data-applicant-form=member-documents] button[type=submit]');
    assert.equal((await documentSave).status(), 200);
    await page.waitForFunction(() => document.body.innerText.includes('서류를 제출했습니다.'));
    await page.reload({ waitUntil: 'networkidle2' });
    assert.equal(await page.$eval('#field-document-note', el => el.value), '브라우저에서 서류 확인');
    await query("UPDATE app_schedule SET applicant_schedule_end_at = DATE_SUB(NOW(), INTERVAL 1 HOUR)");
    await page.reload({ waitUntil: "networkidle2" });
    assert.equal(await page.$eval("[data-applicant-form='member-documents'] button[type=submit]", el => el.disabled), false, "Document UI must ignore closed reception period");
    assert(await page.$eval("[data-applicant-form='member-documents'] input[type=file]", el => !el.disabled));
    assert((await page.$eval('body', el => el.innerText)).includes('서류 제출 기간:'));
    await page.screenshot({ path: path.join(artifacts, "document-schedule-open.png"), fullPage: true });
    await query("UPDATE app_schedule SET document_submission_schedule_end_at = DATE_SUB(NOW(), INTERVAL 1 HOUR)");
    await page.reload({ waitUntil: "networkidle2" });
    assert.equal(await page.$eval('[data-applicant-action="member-documents"]', el => el.disabled), true);
    assert((await page.$eval('body', el => el.innerText)).includes('이용 기간이 종료되었습니다.'));
    await query("UPDATE app_schedule SET applicant_schedule_end_at = DATE_ADD(NOW(), INTERVAL 1 DAY), document_submission_schedule_end_at = DATE_ADD(NOW(), INTERVAL 1 DAY)");
    await checkMobileLayout('documents');
    await page.goto(base + "/applicant/ticket", { waitUntil: "networkidle2" });
    await page.waitForSelector('.applicant-public-ticket-slab');
    await checkMobileLayout('ticket');
    await page.goto(base + "/applicant", { waitUntil: "networkidle2" });
    await page.waitForSelector(".applicant-member-tile");
    await page.setViewport({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(artifacts, "member-mobile.png"), fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.click('.public-school-logout');
    await page.waitForSelector("#loginForm");
    await page.goto(base + "/applicant/documents", { waitUntil: "networkidle2" });
    await page.waitForSelector("#loginAccountId:not([disabled])");
    await page.type("#loginAccountId", "browser01@example.test");
    await page.type("#loginPassword", password);
    await page.click("#loginForm button[type=submit]");
    await page.waitForSelector("[data-applicant-action='member-apply']");
    await page.click("[data-applicant-action='member-apply']");
    await page.waitForFunction(() => ["/applicant/apply", "/applicant/form"].includes(location.pathname));
    await checkMobileLayout('application entry');
    assert.equal(await page.$("#applicationPassword"), null, "Members should not be asked for a second password");
    await page.goto(base + "/applicant/form?preview=1", { waitUntil: "networkidle2" });
    await page.waitForSelector('.applicant-public-application-panel');
    assert.equal(await page.$eval('#applicationBirth', el => el.value), '-');
    await checkMobileLayout('application form');
    const adminLogin = await call("/api/auth/login", { id: "admin", password: "1111" });
    const adminSetup = await call("/api/auth/password/setup", { password: "AdminSmoke1234", passwordConfirm: "AdminSmoke1234" }, adminLogin.cookie);
    assert.equal(adminSetup.status, 200, JSON.stringify(adminSetup));
    await page.goto(base + '/applicant', { waitUntil: 'networkidle2' });
    await page.click('.public-school-logout');
    await page.waitForSelector('#loginAccountId:not([disabled])');
    await page.type('#loginAccountId', 'admin');
    await page.type('#loginPassword', 'AdminSmoke1234');
    await submitLoginWithoutFlash();
    await page.waitForFunction(() => !['/login', '/applicant'].includes(location.pathname));
    assert.equal(await page.evaluate(async () => (await (await fetch('/api/public/members/session')).json()).member), null, 'Staff login must clear the previous member session');
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(base + '/applicant-members', { waitUntil: 'networkidle2' });
    await page.waitForSelector('[data-member-list-detail]');
    assert(await page.$('[data-view=applicantMembers]'), 'Member list has its own navigation menu');
    await page.type('[data-member-list-search] [name=search]', 'member01@example.test');
    await page.click('[data-member-list-search] button[type=submit]');
    await page.waitForFunction(() => document.querySelectorAll('[data-member-list-detail]').length === 1 && document.querySelector('.member-list-table').textContent.includes('member01@example.test'));
    await page.click('[data-member-list-detail]');
    await page.waitForSelector('#memberDetailPanel');
    assert((await page.$eval('#memberDetailPanel', el => el.textContent)).includes('약관 동의'));
    await page.screenshot({ path: path.join(artifacts, 'member-list.png'), fullPage: true });
    await page.click('#memberDetailPanel [data-applicant-submission-toggle]');
    await page.waitForSelector('#applicantSubmissionDetailModal:not(.hidden)');
    await page.click('[data-member-profile-link]');
    await page.waitForSelector('#memberDetailPanel');
    assert(new URL(page.url()).searchParams.has('member'), 'Application details link directly back to member information');
    await page.goto(base + '/system-data-deletion', { waitUntil: 'networkidle2' });
    await page.waitForSelector('[data-system-data-delete=applicant-members]');
    assert((await page.$eval('[data-system-data-delete=applicant-members]', button => button.closest('.system-data-delete-card').textContent)).includes('접수 이력은 보존'));
    await page.screenshot({ path: path.join(artifacts, 'member-data-deletion.png'), fullPage: true });
    await page.goto(base + '/system-backup-restore', { waitUntil: 'networkidle2' });
    await page.waitForSelector('#systemBackupRestoreFileInput');
    assert((await page.$eval('#viewRoot', el => el.textContent)).includes('회원 계정·가입 답변·회원 첨부파일·약관 동의'));
    await page.screenshot({ path: path.join(artifacts, 'member-backup-restore.png'), fullPage: true });
    await page.goto(base + '/applicant-question-template-management', { waitUntil: 'networkidle2' });
    await page.click(`[data-applicant-field-select="${ruleField.id}"]`);
    assert.equal(await page.$eval('[data-applicant-field-input=fileNamePattern]', el => el.value), '서류_{수험번호}');
    assert.equal(await page.$eval('[data-applicant-field-input=allowedExtensions]', el => el.value), 'pdf');
    await page.$eval('[data-applicant-field-input=fileNamePattern]', el => { el.value = '{질문제목}_{수험번호}'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.$eval('[data-applicant-field-input=fileNamePattern]', el => el.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: path.join(artifacts, 'application-file-settings.png'), fullPage: true });
    await Promise.all([page.waitForResponse(r => r.url().endsWith(`/api/applicant-form-fields/${ruleField.id}`) && r.request().method() === 'PUT'), page.click('[data-applicant-field-form] button[type=submit]')]);
    assert.equal((await services.applicantService.getApplicantFormFields()).find(f => f.id === ruleField.id).fileNamePattern, '{질문제목}_{수험번호}');
    await page.goto(base + "/applicant-schedules", { waitUntil: "networkidle2" });
    await page.waitForSelector("tr[data-grid-row-clickable='true']");
    assert((await page.$eval('body', el => el.innerText)).includes('서류 제출 시작'));
    await page.click("tr[data-grid-row-clickable='true']");
    await page.waitForSelector('#applicantScheduleModal:not(.hidden)');
    assert.equal(await page.$eval('#documentSubmissionScheduleStartAt', el => el.value), documentDates.documentSubmissionScheduleStartAt);
    const editedDocumentEnd = documentDates.documentSubmissionScheduleEndAt.slice(0, 11) + '23:59';
    await page.$eval('#documentSubmissionScheduleEndAt', (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); }, editedDocumentEnd);
    await page.screenshot({ path: path.join(artifacts, 'schedule-editor.png'), fullPage: true });
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/applicant-schedules') && r.request().method() === 'PUT'), page.click('#applicantScheduleModalSaveButton')]);
    await page.waitForSelector('#applicantScheduleModal.hidden', { visible: false });
    assert.equal((await services.applicantService.getApplicantSchedules())[0].documentSubmissionScheduleEndAt, editedDocumentEnd);
    await query("INSERT INTO app_unit (track_name, admission_code, admission_name, series_code, series_name, unit_code, unit_name) VALUES ('정시','9','별도전형','8','자연','7','수학')");
    await page.reload({ waitUntil: 'networkidle2' });
    await page.click('[data-grid-select-all]');
    await page.click('[data-applicant-schedule-bulk-edit]');
    await page.waitForSelector('#applicantScheduleModal:not(.hidden)');
    for (const [key, value] of Object.entries(documentDates)) {
      await page.$eval(`[data-applicant-schedule-input="${key}"]`, (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    }
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/applicant-schedules/bulk') && r.request().method() === 'PUT'), page.click('#applicantScheduleModalSaveButton')]);
    await page.waitForSelector('#applicantScheduleModal.hidden', { visible: false });
    const bulkSchedules = await services.applicantService.getApplicantSchedules();
    assert.equal(bulkSchedules.length, 2);
    assert(bulkSchedules.every(s => s.documentSubmissionScheduleEndAt === documentDates.documentSubmissionScheduleEndAt));
    await query("UPDATE app_schedule SET document_submission_schedule_start_at = NULL, document_submission_schedule_end_at = NULL WHERE admission_code = '1'");
    assert.equal((await call(memberPath + 'documents', { answers: { document: upload } }, login.cookie)).status, 409, 'An open schedule for another admission must not grant access');
    console.log('PASS: individual and bulk document schedule editors, persistence and admission isolation');
    await page.goto(base + "/applicant-signup-settings", { waitUntil: "networkidle2" });
    await page.waitForSelector("[data-signup-field-add]");
    assert.equal(new URL(page.url()).pathname, '/applicant-question-template-management');
    assert.equal(await page.$('[data-view=applicantSignupSettings]'), null, 'Separate signup menu must be removed');
    assert.equal(await page.$eval('[data-question-scope=signup]', el => el.getAttribute('aria-selected')), 'true');
    assert.equal(await page.$('#headerTrack'), null, 'Topbar filters are removed from signup settings');
    const tabGaps = {};
    for (const tab of ['application', 'documents', 'signup', 'terms']) {
      await page.click(`[data-question-scope="${tab}"]`);
      await page.waitForSelector('#question-management-panel .applicant-settings-fields-panel');
      tabGaps[tab] = await page.evaluate(() => document.querySelector('#question-management-panel .applicant-settings-fields-panel').getBoundingClientRect().top - document.querySelector('.question-management-tabs').getBoundingClientRect().bottom);
      if (tab === 'application' || tab === 'documents') assert.equal(await page.$eval('.applicant-settings-fields-panel .section-header h3', el => el.textContent), tab === 'documents' ? '서류제출' : '원서접수');
      else assert.equal(await page.$eval('[data-signup-status]', el => el.getClientRects().length), 0, 'Empty status messages must not reserve space below tabs');
    }
    assert(Math.abs(tabGaps.signup - tabGaps.application) < 2 && Math.abs(tabGaps.terms - tabGaps.application) < 2, JSON.stringify(tabGaps));
    assert(Math.abs(tabGaps.documents - tabGaps.application) < 2, JSON.stringify(tabGaps));
    await page.click('[data-question-scope=documents]');
    assert.equal(await page.$(`[data-applicant-field-select="${ruleField.id}"]`), null);
    const applicationOrder = (await services.applicantService.getApplicantFormFields({ formScope: 'application' })).map(field => [field.id, field.sortOrder]);
    await page.click('[data-applicant-field-add]');
    assert.equal(await page.$('[data-applicant-field-input=inputType]'), null, 'Document questions do not offer an answer type selector');
    assert.equal(await page.$('#applicant-answer-type-help'), null);
    await page.type('[data-applicant-field-input=questionText]', '서류 전용 질문');
    await page.type('[data-applicant-field-input=allowedExtensions]', 'pdf, png');
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/applicant-form-fields') && r.request().method() === 'POST'), page.click('[data-applicant-field-form] button[type=submit]')]);
    await page.waitForFunction(() => document.querySelector('[data-applicant-field-input=questionText]')?.disabled);
    const documentQuestion = (await services.applicantService.getApplicantFormFields({ formScope: 'documents' })).find(field => field.questionText === '서류 전용 질문');
    assert(documentQuestion);
    assert.equal(documentQuestion.inputType, 'file', 'New document questions are always file uploads');
    assert.deepEqual(documentQuestion.allowedExtensions, ['pdf', 'png']);
    await page.click(`[data-applicant-field-select="${documentQuestion.id}"]`);
    assert.equal(await page.$('[data-applicant-field-input=inputType]'), null, 'Editing a document question keeps its upload type fixed');
    await page.$eval('[data-applicant-field-input=questionText]', el => { el.value = '서류 전용 질문 수정'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await Promise.all([page.waitForResponse(r => r.url().endsWith(`/api/applicant-form-fields/${documentQuestion.id}`) && r.request().method() === 'PUT'), page.click('[data-applicant-field-form] button[type=submit]')]);
    await page.waitForFunction(() => document.querySelector('[data-applicant-field-input=questionText]')?.disabled);
    await Promise.all([page.waitForResponse(r => r.url().includes(`/api/applicant-form-fields/${documentQuestion.id}/move`)), page.click(`[data-applicant-field-move="${documentQuestion.id}"][data-applicant-field-direction=up]`)]);
    await page.waitForFunction(id => {
      const cards = [...document.querySelectorAll('[data-applicant-field-select]')];
      return cards.findIndex(card => card.dataset.applicantFieldSelect === String(id)) === cards.length - 2;
    }, {}, documentQuestion.id);
    assert.deepEqual((await services.applicantService.getApplicantFormFields({ formScope: 'application' })).map(field => [field.id, field.sortOrder]), applicationOrder, 'Document reordering preserves application order');
    await page.click('[data-question-scope=application]');
    assert.equal(await page.$(`[data-applicant-field-select="${documentQuestion.id}"]`), null);
    assert(await page.$(`[data-applicant-field-select="${ruleField.id}"]`));
    const documentPreview = await browser.newPage();
    await documentPreview.goto(base + '/applicant/documents?preview=1', { waitUntil: 'networkidle2' });
    await documentPreview.waitForSelector('#field-document-note');
    assert.equal(new URL(documentPreview.url()).pathname, '/applicant/documents');
    assert.equal(await documentPreview.$('#field-rule-document'), null);
    assert(await documentPreview.$(`#field-${documentQuestion.fieldKey}`));
    await documentPreview.type('#field-document-note', '미리보기 확인');
    let previewSaveCount = 0;
    documentPreview.on('request', request => { if (request.url().endsWith('/api/public/members/documents')) previewSaveCount++; });
    await documentPreview.click('[data-applicant-form=member-documents] button[type=submit]');
    await documentPreview.waitForFunction(() => document.body.innerText.includes('미리보기에서는 서류를 저장하지 않습니다.'));
    assert.equal(previewSaveCount, 0);
    await documentPreview.close();
    await services.applicantService.deleteApplicantFormField(documentQuestion.id);
    assert(!(await services.applicantService.getApplicantPublicForm()).documentFields.some(field => field.id === documentQuestion.id));
    console.log('PASS: document question tabs, independent CRUD/order and applicant answer persistence');
    if (process.argv.includes('--document-settings')) { assert.deepEqual(errors, []); return; }
    await page.click('[data-question-scope=signup]');
    async function saveQuestion() {
      await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/applicant-signup-settings') && r.request().method() === 'PUT'), page.click('[data-signup-field-form] button[type=submit]')]);
      await page.waitForSelector('[data-signup-field-add]:not(:disabled)');
    }
    await page.click('[data-signup-field-select=email]');
    assert.equal(await page.$('[data-signup-field-input=inputType]'), null, 'Fixed signup fields do not expose an answer type selector');
    assert(await page.$eval('[data-signup-field-input=required]', el => el.disabled && el.checked));
    assert(await page.$eval('[data-signup-field-delete=email]', el => el.disabled));
    assert.deepEqual(await page.$$eval('[data-signup-field-select]', cards => cards.slice(0, 3).map(card => card.dataset.signupFieldSelect)), ['email', 'password', 'name']);
    for (const key of ['email', 'password', 'name']) {
      assert(await page.$eval(`[data-signup-field-select="${key}"]`, card => !card.draggable && !card.hasAttribute('data-signup-field-draggable')));
      assert(await page.$$eval(`[data-signup-field-move="${key}"]`, buttons => buttons.length === 2 && buttons.every(button => button.disabled)));
      await page.click(`[data-signup-field-select="${key}"]`);
      assert.equal(await page.$('[data-signup-field-input=inputType]'), null);
    }
    await page.click('[data-signup-field-add]');
    const commonAnswerOptions = await page.$$eval('[data-signup-field-input=inputType] option', options => options.map(option => ({ key: option.value, label: option.textContent.trim() })));
    assert.deepEqual(commonAnswerOptions.map(option => option.key), ['text', 'phone', 'nationality', 'select', 'date', 'birthdate', 'photo', 'file']);
    await page.click('[data-question-scope=application]');
    await page.click('[data-applicant-field-add]');
    const applicationAnswerOptions = commonAnswerOptions.filter(option => option.key !== 'birthdate');
    assert.deepEqual(await page.$$eval('[data-applicant-field-input=inputType] option', options => options.map(option => ({ key: option.value, label: option.textContent.trim() }))), applicationAnswerOptions);
    const sharedHints = {};
    for (const { key } of applicationAnswerOptions) {
      await page.select('[data-applicant-field-input=inputType]', key);
      sharedHints[key] = await page.$eval('#applicant-answer-type-help', el => el.textContent.trim());
    }
    await page.click('[data-applicant-field-reset]');
    await page.click('[data-question-scope=signup]');
    for (const { key } of applicationAnswerOptions) {
      await page.select('[data-signup-field-input=inputType]', key);
      assert.equal(await page.$eval('#applicant-answer-type-help', el => el.textContent.trim()), sharedHints[key]);
    }
    await page.type('[data-signup-field-input=questionText]', '생년월일');
    await page.select('[data-signup-field-input=inputType]', 'birthdate');
    await page.click('[data-signup-field-input=required]');
    await saveQuestion();
    assert.equal((await page.$$('[data-question-scope]')).length, 4);
    assert.deepEqual(await page.$$eval('[data-question-scope]', tabs => tabs.map(tab => tab.textContent.trim())), ['원서접수', '서류제출', '회원가입', '약관관리']);
    await page.click('[data-question-scope=terms]');
    assert(await page.$('#signup-terms-editor .applicant-settings-fields-panel'));
    assert(await page.$('#signup-terms-editor .applicant-settings-side .applicant-field-editor-panel.is-disabled'));
    assert(await page.$eval('[data-term-input=title]', el => el.disabled));
    await page.click('[data-term-add]');
    assert(await page.$('#signup-terms-editor .applicant-field-card.is-editing[aria-current=true]'));
    await page.type('[data-term-input=title]', '회원가입 약관');
    await page.type('[data-term-input=text]', '관리자 화면에서 설정한 약관');
    await page.click('[data-question-scope=signup]');
    await page.click('[data-signup-field-add]');
    await page.type('[data-signup-field-input=questionText]', '출신학교');
    await page.type('[data-signup-field-input=questionDescription]', '학교명을 선택하세요.');
    await page.select('[data-signup-field-input=inputType]', 'select');
    await page.type('[data-signup-field-input=optionDraft]', '일반고');
    await page.click('[data-signup-field-option-add]');
    await page.type('[data-signup-field-input=optionDraft]', '기타');
    await page.click('[data-signup-field-input=allowCustomOption]');
    await page.click('[data-signup-field-option-add]');
    await page.click('[data-signup-field-input=required]');
    await page.click('[data-question-scope=application]');
    await page.waitForSelector('[data-applicant-field-add]');
    assert.equal(await page.$('#headerTrack'), null, 'Topbar filters are removed from application settings');
    assert.equal(await page.$('[data-signup-settings-form]'), null);
    await page.click('[data-question-scope=signup]');
    await page.waitForSelector('[data-signup-field-input=questionText]');
    assert.equal(await page.$eval('[data-signup-field-input=questionText]', el => el.value), '출신학교', 'Tab switching must retain unsaved signup questions');
    await saveQuestion();
    await page.click('[data-question-scope=terms]');
    assert.equal(await page.$eval('[data-term-input=text]', el => el.value), '관리자 화면에서 설정한 약관', 'Term draft survives tab switching and question save');
    assert.equal(await page.$('#headerTrack'), null, 'Topbar filters are removed from terms settings');
    async function saveTerm() {
      await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/applicant-signup-settings') && r.request().method() === 'PUT'), page.click('[data-term-form] button[type=submit]')]);
      await page.waitForSelector('[data-term-add]:not(:disabled)');
      await page.waitForSelector('[data-term-input=title]:disabled');
    }
    await saveTerm();
    const requiredTerm = (await members.getSettings()).terms[0];
    await page.click('[data-term-add]');
    await page.type('[data-term-input=title]', '선택 안내');
    await page.type('[data-term-input=text]', '선택 동의 내용');
    await page.click('[data-term-input=required]');
    await saveTerm();
    const optionalTerm = (await members.getSettings()).terms[1];
    await page.click('[data-term-add]');
    await page.type('[data-term-input=title]', '미사용 약관');
    await page.click('[data-term-input=enabled]');
    await saveTerm();
    const hiddenTerm = (await members.getSettings()).terms[2];
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/applicant-signup-settings') && r.request().method() === 'PUT'), page.click(`[data-term-move="${optionalTerm.id}"][data-direction="-1"]`)]);
    await page.waitForFunction(id => document.querySelector('[data-term-select]')?.dataset.termSelect === id, {}, optionalTerm.id);
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/applicant-signup-settings') && r.request().method() === 'PUT'), page.click(`[data-term-move="${requiredTerm.id}"][data-direction="-1"]`)]);
    await page.waitForFunction(id => document.querySelector('[data-term-select]')?.dataset.termSelect === id, {}, requiredTerm.id);
    await page.reload({ waitUntil: 'networkidle2' });
    assert.equal(await page.$eval('[data-question-scope=terms]', el => el.getAttribute('aria-selected')), 'true');
    await page.click(`[data-term-select="${optionalTerm.id}"]`);
    assert.equal(await page.$eval('[data-term-input=required]', el => el.checked), false);
    assert(await page.$(`#signup-terms-editor .applicant-field-card.is-editing[data-term-select="${optionalTerm.id}"]`));
    await page.click('[data-term-cancel]');
    await page.focus(`[data-term-select="${optionalTerm.id}"]`);
    await page.keyboard.press('Enter');
    assert.equal(await page.$eval('[data-term-input=title]', el => el.value), optionalTerm.title);
    const moveByDrag = async (sourceId, targetId) => {
      const response = page.waitForResponse(r => r.url().endsWith('/api/applicant-signup-settings') && r.request().method() === 'PUT');
      await page.evaluate((sourceId, targetId) => {
        const source = document.querySelector(`[data-term-draggable="${sourceId}"]`), target = document.querySelector(`[data-term-draggable="${targetId}"]`);
        const dataTransfer = new DataTransfer(), rect = target.getBoundingClientRect();
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer, clientY: rect.top + 1 }));
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer, clientY: rect.top + 1 }));
        source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));
      }, sourceId, targetId);
      assert.equal((await response).status(), 200);
      await page.waitForFunction(id => document.querySelector('[data-term-select]')?.dataset.termSelect === id, {}, sourceId);
    };
    await moveByDrag(optionalTerm.id, requiredTerm.id);
    await moveByDrag(requiredTerm.id, optionalTerm.id);
    assert.equal((await members.getSettings()).terms[0].id, requiredTerm.id);
    assert.equal(await page.$eval('[data-term-input=title]', el => el.value), optionalTerm.title, 'Reordering retains the selected term draft');
    await page.screenshot({ path: path.join(artifacts, 'terms-management.png'), fullPage: true });
    await page.click(`[data-term-select="${hiddenTerm.id}"]`);
    await page.type('[data-term-input=text]', '미사용 약관 수정 확인');
    await saveTerm();
    assert.equal((await members.getSettings()).terms.find(t => t.id === hiddenTerm.id).text, '미사용 약관 수정 확인');
    page.once('dialog', dialog => dialog.accept());
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/applicant-signup-settings') && r.request().method() === 'PUT'), page.click(`[data-term-delete="${hiddenTerm.id}"]`)]);
    await page.waitForFunction(id => !document.querySelector(`[data-term-select="${id}"]`), {}, hiddenTerm.id);
    assert.equal((await members.getSettings()).terms.length, 2);
    assert.equal((await members.publicSettings()).terms.length, 2, 'Unused terms must not reach the public form');
    await page.click('[data-question-scope=signup]');
    await page.evaluate(() => { document.querySelectorAll('*').forEach(el => { if (el.scrollTop) el.scrollTop = 0; }); window.scrollTo(0, 0); });
    await page.screenshot({ path: path.join(artifacts, "signup-settings.png"), fullPage: true });
    const questionSettings = await members.getSettings();
    const schoolQuestion = questionSettings.questions.find(q => q.label === '출신학교');
    assert.equal(schoolQuestion.inputType, 'select');
    assert.equal(schoolQuestion.customOptionLabel, '기타');
    const orderBefore = questionSettings.questions.map(q => q.key);
    const firstCustom = questionSettings.questions[3].key;
    assert(await page.$eval(`[data-signup-field-move="${firstCustom}"][data-signup-field-direction=up]`, button => button.disabled), 'Custom questions cannot move above fixed core fields');
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/applicant-signup-settings') && r.request().method() === 'PUT'), page.click(`[data-signup-field-move="${schoolQuestion.key}"][data-signup-field-direction=up]`)]);
    assert.notDeepEqual((await members.getSettings()).questions.map(q => q.key), orderBefore);
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector(`[data-signup-field-select="${schoolQuestion.key}"]`);
    assert((await page.content()).includes('출신학교'), 'Saved questions and selected tab must survive reload');
    await page.click('[data-signup-field-add]');
    await page.type('[data-signup-field-input=questionText]', '삭제 테스트');
    await saveQuestion();
    const deletedKey = (await members.getSettings()).questions.find(q => q.label === '삭제 테스트').key;
    page.once('dialog', dialog => dialog.accept());
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/applicant-signup-settings') && r.request().method() === 'PUT'), page.click(`[data-signup-field-delete="${deletedKey}"]`)]);
    assert(!(await members.getSettings()).questions.some(q => q.key === deletedKey));
    await page.click('[data-signup-field-add]');
    await page.type('[data-signup-field-input=questionText]', '회원 첨부 규칙');
    await page.select('[data-signup-field-input=inputType]', 'file');
    await page.type('[data-signup-field-input=fileNamePattern]', '{ID}_{질문제목}');
    await page.type('[data-signup-field-input=allowedExtensions]', '.pdf, txt');
    await page.screenshot({ path: path.join(artifacts, 'signup-file-settings.png'), fullPage: true });
    await saveQuestion();
    const signupRule = (await members.getSettings()).questions.find(q => q.label === '회원 첨부 규칙');
    assert.deepEqual(signupRule.allowedExtensions, ['pdf', 'txt']);
    assert.equal(signupRule.fileNamePattern, '{ID}_{질문제목}');
    await page.click(`[data-signup-field-select="${signupRule.key}"]`);
    assert.equal(await page.$eval('[data-signup-field-input=allowedExtensions]', el => el.value), 'pdf, txt');
    const previewPage = await browser.newPage();
    await previewPage.goto(base + '/applicant/signup?preview=1', { waitUntil: 'networkidle2' });
    await previewPage.waitForSelector('[data-applicant-form=member-terms]', { visible: true });
    await previewPage.click(`[data-member-term="${requiredTerm.id}"]`);
    await previewPage.click('[data-applicant-form=member-terms] button[type=submit]');
    await previewPage.waitForSelector('[data-applicant-form=member-register]', { visible: true });
    assert(await previewPage.$eval('[data-applicant-form=member-register] button[type=submit]', el => el.disabled));
    await previewPage.close();
    await page.goto(base + '/login-notice', { waitUntil: 'networkidle2' });
    await page.waitForSelector('[data-notice-scope=login]');
    assert((await page.content()).includes('공통 로그인 공지'));
    await page.evaluate(() => {
      const editor = document.querySelector('#loginNoticeEditor');
      editor.innerHTML = '<p>공통 로그인 안내 테스트</p>';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await Promise.all([
      page.waitForResponse(response => response.url().includes('/api/login-notice') && response.request().method() === 'PUT'),
      page.click('[data-notice-action=save]'),
    ]);
    await page.click('[data-notice-scope=applicant]');
    await page.waitForSelector('.applicant-member-tile');
    assert.equal((await page.$$('.applicant-member-tile')).length, 4);
    await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST' }));
    await page.goto(base + '/login', { waitUntil: 'networkidle2' });
    assert((await page.content()).includes('공통 로그인 안내 테스트'));
    await checkMobileLayout('common login with saved notice');
    await page.screenshot({ path: path.join(artifacts, 'common-login.png'), fullPage: true });
    const finalSettings = await members.getSettings();
    const popupTerms = finalSettings.terms.map(term => term.id === optionalTerm.id ? { ...term, text: Array.from({ length: 50 }, (_, index) => `${index + 1}. 선택 안내의 전체 약관 내용입니다.\n줄바꿈과 <안내> 문구를 그대로 표시합니다.`).join('\n\n') } : term);
    await members.saveSettings({ ...finalSettings, terms: popupTerms, questions: [...finalSettings.questions,
      { key: 'test_file', label: '첨부서류', inputType: 'file', required: true },
      { key: 'test_photo', label: '사진', inputType: 'photo', required: true },
      { key: 'test_country', label: '국적', inputType: 'nationality', required: true },
      { key: 'test_phone', label: '연락처', inputType: 'phone', required: true },
    ] });
    await page.click('.common-login-signup');
    await page.waitForSelector('[data-applicant-form=member-terms]', { visible: true });
    await page.click('[data-applicant-form=member-terms] button[type=submit]');
    assert.equal(await page.$$eval('[data-member-term]', els => els.length), 2);
    assert.equal(await page.$eval('[data-member-step=details]', el => el.hidden), true, 'Consent is required before the information step');
    await checkMobileLayout('signup terms');
    await page.setViewport({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(artifacts, 'signup-terms.png'), fullPage: true });
    await page.click(`[data-member-term="${requiredTerm.id}"]`);
    assert.equal((await page.$$('[data-member-term-view]')).length, 2);
    for (const term of popupTerms) {
      await page.click(`[data-member-term-view="${term.id}"]`);
      await page.waitForSelector('#member-term-dialog[open]', { visible: true });
      assert.equal(await page.$eval('#member-term-dialog-title', el => el.textContent), term.title);
      assert.equal(await page.$eval('[data-member-term-content]', el => el.textContent), term.text);
      assert(await page.$eval('[data-member-term-close]', el => el === document.activeElement));
      if (term.id === optionalTerm.id) {
        for (const width of [320, 390]) {
          await page.setViewport({ width, height: 844 });
          assert(await page.$eval('#member-term-dialog', el => { const rect = el.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight; }), 'Term popup fits the mobile viewport');
          assert(await page.$eval('[data-member-term-content]', el => el.scrollHeight > el.clientHeight && el.scrollWidth <= el.clientWidth), 'Long terms scroll vertically without horizontal overflow');
        }
        await page.$eval('[data-member-term-content]', el => { el.scrollTop = el.scrollHeight; });
        await page.screenshot({ path: path.join(artifacts, 'signup-long-term-dialog.png'), fullPage: true });
      }
      await page.keyboard.press('Escape');
      await page.waitForSelector('#member-term-dialog:not([open])');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.memberTermView), term.id, 'Closing returns focus to the term button');
    }
    await page.click(`[data-member-term-view="${requiredTerm.id}"]`);
    await page.screenshot({ path: path.join(artifacts, 'signup-term-dialog.png'), fullPage: true });
    await page.click('[data-member-term-close]');
    await page.click(`[data-member-term-view="${optionalTerm.id}"]`);
    assert.equal(await page.$eval('[data-member-term-content]', el => el.scrollTop), 0, 'Reopening starts at the beginning of the terms');
    await page.mouse.click(2, 2);
    await page.waitForSelector('#member-term-dialog:not([open])');
    assert(await page.$eval(`[data-member-term="${requiredTerm.id}"]`, el => el.checked), 'Reading terms preserves existing consent');
    assert.equal(await page.$eval(`[data-member-term="${optionalTerm.id}"]`, el => el.checked), false, 'Reading does not auto-consent');
    assert.equal(await page.$eval('[data-member-step=details]', el => el.hidden), true, 'Reading does not submit the agreement form');
    await page.click('[data-applicant-form=member-terms] button[type=submit]');
    await page.waitForSelector('[data-member-date-part=year]', { visible: true });
    assert(await page.$('.applicant-public-badge.is-optional'), 'Optional signup questions have a badge too');
    for (const width of [320, 390, 1440]) {
      await page.setViewport({ width, height: 844 });
      assert(await page.$eval('.applicant-member-birthdate', field => {
        const boxes = [...field.querySelectorAll('select')].map(select => select.getBoundingClientRect());
        return boxes.length === 3 && boxes.every(box => Math.abs(box.top - boxes[0].top) < 1) && boxes[0].right <= boxes[1].left && boxes[1].right <= boxes[2].left && boxes[2].right <= innerWidth;
      }), 'Signup birthdate selectors remain in one horizontal row at every viewport width');
    }
    await page.setViewport({ width: 390, height: 844 });
    assert.equal(await page.$eval(`[data-member-file="${signupRule.key}"]`, el => el.accept), '.pdf,.txt');
    await page.select(`[name="profile.${schoolQuestion.key}"]`, '기타');
    await page.waitForSelector(`[data-member-custom="${schoolQuestion.key}"]:not([hidden])`);
    assert(await page.$eval(`[data-member-custom="${schoolQuestion.key}"]`, el => el.required));
    assert(await page.$(`[data-member-term="${requiredTerm.id}"]`));
    assert(await page.$("[name=extraLabel]") === null);
    assert((await page.evaluate(() => document.body.innerText)).includes("출신학교"));
    await page.screenshot({ path: path.join(artifacts, "signup.png"), fullPage: true });
    await checkMobileLayout('signup with typed questions and uploads');
    await page.type('[name=name]', '다양한 질문 회원');
    await page.type('[name=password]', password);
    await page.type('[name=passwordConfirm]', password);
    await page.type('[name=email]', 'typedmember@example.test');
    await verifySignupEmailInBrowser();
    await page.type(`[data-member-custom="${schoolQuestion.key}"]`, '대안학교');
    await page.type('[data-member-nationality-search=test_country]', '대한');
    assert.equal(await page.$eval('[data-member-nationality-search=test_country]', el => el.checkValidity()), false, 'Nationality must be chosen from the search results');
    await page.click('[data-member-nationality-value=KR]');
    assert.equal(await page.$eval('[name="profile.test_country"]', el => el.value), 'KR');
    await page.type('[name="profile.test_phone"]', '010-1234-5678abc');
    assert.equal(await page.$eval('[name="profile.test_phone"]', el => el.value), '01012345678');
    const birthKey = (await members.getSettings()).questions.find(q => q.inputType === 'birthdate').key;
    await page.select(`[data-member-date-field-key="${birthKey}"][data-member-date-part=year]`, '2000');
    await page.select(`[data-member-date-field-key="${birthKey}"][data-member-date-part=month]`, '02');
    await page.select(`[data-member-date-field-key="${birthKey}"][data-member-date-part=day]`, '29');
    await page.select(`[data-member-date-field-key="${birthKey}"][data-member-date-part=year]`, '2001');
    assert.equal(await page.$eval(`[data-member-date-value="${birthKey}"]`, el => el.value), '', 'Changing to a non-leap year clears an invalid day');
    await page.select(`[data-member-date-field-key="${birthKey}"][data-member-date-part=year]`, '2000');
    await page.select(`[data-member-date-field-key="${birthKey}"][data-member-date-part=month]`, '01');
    await page.select(`[data-member-date-field-key="${birthKey}"][data-member-date-part=day]`, '01');
    await page.evaluate(() => {
      const pdf = new File(['%PDF-1.7\nfixture'], '증명서.pdf', { type: 'application/pdf' });
      const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
      const photo = new File([bytes], '사진.png', { type: 'image/png' });
      for (const [key, file] of [['test_file', pdf], ['test_photo', photo]]) {
        const input = document.querySelector(`[data-member-file="${key}"]`); const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await page.waitForSelector('[data-member-upload-preview=test_photo] img');
    await page.$eval(`[data-member-file="${signupRule.key}"]`, input => {
      const transfer = new DataTransfer(); transfer.items.add(new File(['hello'], '원본.txt', { type: 'text/plain' }));
      input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.click('[data-applicant-action=member-terms-back]');
    await page.waitForSelector('[data-member-step=terms]:not([hidden])');
    await page.click(`[name="term-consent-${requiredTerm.id}"][value="disagree"]`);
    await page.click('[data-applicant-form=member-terms] button[type=submit]');
    assert.equal(await page.$eval('[data-member-step=details]', el => el.hidden), true, 'Unchecking consent on the previous step prevents continuation');
    await page.click(`[data-member-term="${requiredTerm.id}"]`);
    await page.click('[data-applicant-form=member-terms] button[type=submit]');
    assert.equal(await page.$eval('[name=email]', el => el.value), 'typedmember@example.test');
    assert.equal(await page.$eval('[data-member-file=test_file]', el => el.files.length), 1, 'Back navigation retains uploaded files');
    await query('UPDATE app_schedule SET applicant_schedule_start_at = DATE_SUB(NOW(), INTERVAL 1 DAY), applicant_schedule_end_at = DATE_ADD(NOW(), INTERVAL 1 DAY)');
    await page.click('[data-applicant-form=member-register] button[type=submit]');
    await page.waitForSelector('.applicant-member-tile');
    assert.equal(new URL(page.url()).pathname, '/applicant');
    assert.equal(await page.evaluate(() => fetch('/api/public/members/session').then(r => r.json()).then(s => s.member.email)), 'typedmember@example.test');
    await services.applicantService.createApplicantFormField({ fieldKey: 'feedback-required', questionText: '추가 확인사항', inputType: 'text', required: true });
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('.applicant-member-tile');
    await page.click('[data-applicant-action=member-apply]');
    await page.waitForFunction(() => ['/applicant/apply', '/applicant/form'].includes(location.pathname));
    for (const key of ['track', 'admission', 'series', 'unit', 'major']) {
      const selector = `#applicationSelection-${key}`;
      if (await page.$(selector)) {
        const value = await page.$eval(selector, el => [...el.options].find(option => option.value)?.value);
        if (value) await page.select(selector, value);
      }
    }
    if (await page.$('[data-applicant-action=continue-application]')) await page.click('[data-applicant-action=continue-application]');
    await page.waitForSelector('#applicationBirth');
    assert.equal(await page.$eval('#field-feedback-required', input => input.closest('.applicant-public-field').querySelector('.applicant-public-badge').textContent), '필수');
    assert.equal(await page.$('#field-document'), null, 'Document questions are excluded from application forms');
    assert.equal(await page.$eval('#field-rule-document', input => input.closest('.applicant-public-field').querySelector('.applicant-public-badge').textContent), '선택');
    await page.click('[data-applicant-form=application] button[type=submit]');
    await assertFeedbackBelow('#field-feedback-required', '필수 항목', true);
    await page.type('#field-feedback-required', '가'.repeat(260));
    const fieldErrorResponse = page.waitForResponse(r => r.url().endsWith('/api/public/applications') && r.request().method() === 'POST');
    await page.click('[data-applicant-form=application] button[type=submit]');
    const fieldErrorResult = await (await fieldErrorResponse).json();
    assert.equal(fieldErrorResult.fieldKey, 'feedback-required', 'Server identifies the exact invalid application question');
    await assertFeedbackBelow('#field-feedback-required', fieldErrorResult.error, true);
    assert.equal(await page.$eval('#field-feedback-required', input => input.value.length), 260, 'Server validation retains the application answer');
    await page.setViewport({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(artifacts, 'application-inline-feedback.png'), fullPage: true });
    await query("UPDATE app_form SET required = 0 WHERE field_key = 'feedback-required'");
    assert.equal(await page.$eval('#applicationBirth', el => el.value), '2000년 01월 01일', 'Birth comes from the configured signup birthdate question');
    assert(await page.$eval('#applicationBirth', el => el.readOnly));
    const birthFields = (await services.applicantService.getApplicantFormFields()).filter(field => field.systemFieldKey === 'birth' || field.inputType === 'birthdate');
    for (const field of birthFields) assert.equal(await page.$(`[data-applicant-date-field-key="${field.fieldKey}"]`), null, 'Member birthdate is not requested again in the application');
    assert(await page.$eval('#applicationEmail', el => el.closest('.applicant-public-field').nextElementSibling.querySelector('#applicationBirth') !== null), 'Birth appears immediately after the email');
    await checkMobileLayout('application with member birthdate');
    await page.screenshot({ path: path.join(artifacts, 'application-member-birthdate.png'), fullPage: true });
    const typedLogin = await call('/api/auth/login', { id: 'typedmember@example.test', password });
    assert.equal(typedLogin.status, 200, JSON.stringify(typedLogin));
    assert.equal(typedLogin.body.member.birthDate, '2000-01-01');
    const typedApplication = await call('/api/public/applications', { selectionAnswers: application.selectionAnswers, answers: { birth: '1900-01-01' } }, typedLogin.cookie);
    assert.equal(typedApplication.status, 200, JSON.stringify(typedApplication));
    assert.equal(typedApplication.body.answerMap.birth, '2000-01-01', 'Custom signup birthdate questions are also linked by the server');
    assert.equal(typedLogin.body.member.profile[schoolQuestion.key], '기타: 대안학교');
    assert.equal(typedLogin.body.member.profile.test_country, 'KR');
    assert.equal(typedLogin.body.member.profile.test_phone, '01012345678');
    assert.equal(typedLogin.body.member.profile.test_file.fileName, '증명서.pdf');
    assert.equal(typedLogin.body.member.profile.test_photo.mimeType, 'image/png');
    assert.equal(typedLogin.body.member.profile[signupRule.key].fileName, 'typedmember@example.test_회원 첨부 규칙.txt');
    const consentSnapshot = JSON.parse((await query('SELECT consent_json FROM applicant_members WHERE email = ?', ['typedmember@example.test']))[0].consent_json);
    assert.equal(consentSnapshot.terms.find(t => t.id === requiredTerm.id).agreed, true);
    assert.equal(consentSnapshot.terms.find(t => t.id === optionalTerm.id).agreed, false);
    assert.equal(consentSnapshot.terms.find(t => t.id === requiredTerm.id).text, '관리자 화면에서 설정한 약관');
    const beforeDelete = await members.getSettings();
    await members.saveSettings({ ...beforeDelete, questions: beforeDelete.questions.filter(q => q.key !== schoolQuestion.key),
      terms: beforeDelete.terms.filter(t => t.id !== optionalTerm.id).map(t => ({ ...t, text: '변경된 약관 내용' })) });
    const retainedConsent = JSON.parse((await query('SELECT consent_json FROM applicant_members WHERE email = ?', ['typedmember@example.test']))[0].consent_json);
    assert.deepEqual(retainedConsent, consentSnapshot, 'Editing or deleting terms must preserve historical consent and content');
    const retained = await call(memberPath + 'session', null, typedLogin.cookie, 'GET');
    assert.equal(retained.body.member.profile[schoolQuestion.key], '기타: 대안학교', 'Deleting a question must retain existing member answers');
    // ID finding is removed; old links lead to password reset.
    await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST' }));
    await page.goto(base + '/login', { waitUntil: 'networkidle2' });
    assert.equal(await page.$('a[href="/account-recovery?mode=id"]'), null);
    assert.equal((await call(memberPath + 'recovery/request', { purpose: 'id', name: signup.name, email: signup.email })).status, 400);
    await page.goto(base + '/account-recovery?mode=id', { waitUntil: 'networkidle2' });
    assert.equal(new URL(page.url()).searchParams.get('mode'), 'password');
    assert.equal(await page.$('[name=loginId]'), null);
    await page.goto(base + '/account-recovery?mode=password', { waitUntil: 'networkidle2' });
    await page.type('[name=name]', '다양한 질문 회원');
    await page.type('[name=email]', 'typedmember@example.test');
    const resetResponse = page.waitForResponse(r => r.url().endsWith('/recovery/request'));
    await page.click('#recoverySubmit');
    const resetProof = await (await resetResponse).json();
    await page.waitForSelector('#recoveryProof:not([hidden])');
    const resetCode = deliveredCode;
    for (const invalid of ['123', 'x'.repeat(21)]) {
      assert.equal((await call(memberPath + 'recovery/complete', { purpose: 'password', recoveryId: resetProof.recoveryId, code: resetCode, password: invalid, passwordConfirm: invalid })).status, 400);
    }
    assert.equal((await call(memberPath + 'recovery/complete', { purpose: 'id', recoveryId: resetProof.recoveryId, code: resetCode })).status, 400, 'Proof purpose cannot be changed');
    await page.type('[name=code]', resetCode);
    await page.type('[name=password]', '5678');
    await page.type('[name=passwordConfirm]', '5678');
    await page.screenshot({ path: path.join(artifacts, 'password-recovery.png'), fullPage: true });
    await page.click('#recoverySubmit');
    await page.waitForSelector('#recoverySuccess:not([hidden])');
    assert.equal((await call(memberPath + 'session', null, typedLogin.cookie, 'GET')).body.member, null, 'Password reset revokes all old sessions');
    assert.equal((await call('/api/auth/login', { id: 'typedmember@example.test', password })).status, 401);
    assert.equal((await call('/api/auth/login', { id: 'typedmember@example.test', password: '5678' })).status, 200);
    assert.equal((await call(memberPath + 'recovery/request', { purpose: 'password', loginId: 'typedmember', name: '다양한 질문 회원', email: 'typedmember@example.test' })).status, 429, 'Resends are throttled');
    const unknownProof = await call(memberPath + 'recovery/request', { purpose: 'password', loginId: 'admin', name: '관리자', email: 'unknown@example.test' });
    assert.equal(unknownProof.status, 200);
    assert.equal((await call(memberPath + 'recovery/complete', { purpose: 'password', recoveryId: unknownProof.body.recoveryId, code: deliveredCode, password: 'ChangedAdmin_5678', passwordConfirm: 'ChangedAdmin_5678' })).status, 400, 'Member recovery cannot reset staff accounts');
    assert.equal((await call('/api/auth/login', { id: 'admin', password: 'AdminSmoke1234' })).status, 200);
    const expiring = await call(memberPath + 'recovery/request', { purpose: 'password', name: '브라우저 회원', email: 'browser01@example.test' });
    const expiringCode = deliveredCode;
    await query('UPDATE applicant_member_recovery SET expires_at = DATE_SUB(NOW(), INTERVAL 1 SECOND) WHERE id = ?', [expiring.body.recoveryId]);
    assert.equal((await call(memberPath + 'recovery/complete', { purpose: 'password', recoveryId: expiring.body.recoveryId, code: expiringCode, password: '5678', passwordConfirm: '5678' })).status, 400);
    const lockedProof = await call(memberPath + 'recovery/request', { purpose: 'password', name: '없는 회원', email: 'locked@example.test' });
    for (let attempt = 0; attempt < 5; attempt++) assert.equal((await call(memberPath + 'recovery/complete', { purpose: 'password', recoveryId: lockedProof.body.recoveryId, code: 'bad', password: '5678', passwordConfirm: '5678' })).status, 400);
    assert.equal((await query('SELECT attempts FROM applicant_member_recovery WHERE id = ?', [lockedProof.body.recoveryId]))[0].attempts, 5);
    assert.equal((await call(memberPath + 'recovery/complete', { purpose: 'password', recoveryId: lockedProof.body.recoveryId, code: deliveredCode, password: '5678', passwordConfirm: '5678' })).status, 400);
    console.log('PASS: email identity, removed ID recovery, password reset, session revocation, expiry, purpose binding, replay prevention, attempt limits and staff protection');
    const codeSettings = await members.getSettings();
    await members.saveSettings({ ...codeSettings, emailVerification: true, terms: [], questions: codeSettings.questions.filter(q => ['loginId', 'password', 'name', 'email'].includes(q.key)) });
    await page.goto(base + '/applicant/signup', { waitUntil: 'networkidle2' });
    await page.click('[data-applicant-form=member-terms] button[type=submit]');
    await page.waitForSelector('[name=email]', { visible: true });
    await page.type('[name=email]', 'screen-code@example.test');
    assert.equal(await page.$$eval('[data-member-step=details] .applicant-public-badge.is-required', badges => badges.length), 5, 'Email, code, password, confirmation and name use required badges');
    const codeResponse = page.waitForResponse(r => r.url().endsWith('/members/email-code'));
    await page.click('[data-applicant-action=member-send-code]');
    const codeResult = await (await codeResponse).json();
    await assertFeedbackBelow('[name=email]', developmentMode ? '개발용 인증번호' : '인증번호를 발송');
    if (developmentMode) {
      await page.waitForSelector('[data-member-code-preview]:not([hidden])');
      assert((await page.$eval('[data-member-code-preview]', el => el.textContent)).includes(codeResult.debugCode));
      await page.setViewport({ width: 390, height: 844 });
      await page.screenshot({ path: path.join(artifacts, 'signup-development-code.png'), fullPage: true });
    } else {
      assert.equal(codeResult.debugCode, undefined);
      assert.equal(await page.$eval('[data-member-code-preview]', el => el.hidden), true);
    }
    const correctCode = developmentMode ? codeResult.debugCode : deliveredCode;
    await page.type('[name=code]', 'abcdef');
    assert(await page.$eval('[data-applicant-action=member-verify-code]', button => button.disabled), 'Invalid code keeps verification disabled');
    await page.$eval('[name=code]', input => { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.type('[name=code]', correctCode === '111111' ? '222222' : '111111');
    const wrongCodeResponse = page.waitForResponse(r => r.url().endsWith('/members/verify-email'));
    await page.click('[data-applicant-action=member-verify-code]');
    const wrongCode = await (await wrongCodeResponse).json();
    await assertFeedbackBelow('[name=code]', wrongCode.error, true);
    await page.$eval('[name=code]', input => { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.type('[name=code]', correctCode);
    await page.click('[data-applicant-action=member-verify-code]');
    await page.waitForFunction(() => document.querySelector('[data-member-verified]')?.textContent.includes('인증 완료'));
    assert.equal(await page.$eval('[data-member-code-preview]', el => el.hidden), true, 'Hide the development code after verification');
    await assertFeedbackBelow('[name=email]', '인증한 이메일');
    assert(await page.$eval('[data-member-verified]', el => el.getBoundingClientRect().top >= document.querySelector('[name=code]').getBoundingClientRect().bottom));
    assert.equal(await page.$eval('[data-member-message]', el => el.textContent), '', 'Field statuses are not duplicated at the top of the page');
    await page.type('[name=password]', '1234');
    await page.type('[name=passwordConfirm]', '1235');
    await assertFeedbackBelow('[name=passwordConfirm]', '일치하지', true);
    await page.$eval('[name=passwordConfirm]', input => { input.value = '1234'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    await assertFeedbackBelow('[name=passwordConfirm]', '일치합니다');
    await page.click('[data-applicant-form=member-register] button[type=submit]');
    await assertFeedbackBelow('[name=name]', '필수 항목', true);
    assert.equal(await page.$eval('[name=password]', el => el.value), '1234', 'Inline validation retains entered values');
    await page.setViewport({ width: 320, height: 844 });
    await page.screenshot({ path: path.join(artifacts, 'signup-inline-feedback.png'), fullPage: true });
    await page.type('[name=email]', 'x');
    assert.equal(await page.$eval('[data-member-verified]', el => el.textContent), '');
    console.log(`PASS: ${developmentMode ? 'development code display without SMTP' : 'production code non-disclosure'}, browser verification and email change reset`);
    const managerLogin = await call('/api/auth/login', { id: 'admin', password: 'AdminSmoke1234' });
    const managerCookie = managerLogin.cookie;
    assert.equal((await call('/api/applicant-members', null, '', 'GET')).status, 401);
    const memberAgain = await call('/api/auth/login', { id: 'typedmember@example.test', password: '5678' });
    assert.equal(memberAgain.status, 200);
    assert.equal((await call('/api/public/members/session', null, memberAgain.cookie, 'GET')).body.member.email, 'typedmember@example.test');
    assert.equal((await call('/api/applicant-members', null, memberAgain.cookie, 'GET')).status, 401, 'Member login cannot read the admin member list');
    const list = await call('/api/applicant-members?search=typedmember%40example.test', null, managerCookie, 'GET');
    assert.equal(list.status, 200, JSON.stringify(list));
    assert.equal(list.body.total, 1);
    const memberId = list.body.rows[0].id;
    const memberDetail = await call(`/api/applicant-members/${memberId}`, null, managerCookie, 'GET');
    assert.equal(memberDetail.status, 200);
    assert.equal(memberDetail.body.email, 'typedmember@example.test');
    assert(memberDetail.body.answers.some(a => a.key === 'test_file' && a.isFile));
    for (const forbidden of ['password_hash', 'base64', 'code_hash', 'token_hash']) assert(!JSON.stringify(memberDetail.body).includes(forbidden), 'Admin detail returns no secrets or inline file payload');
    const attachment = await fetch(base + `/api/applicant-members/${memberId}/files/test_file`, { headers: { Cookie: managerCookie } });
    assert.equal(attachment.status, 200);
    assert(attachment.headers.get('content-disposition').startsWith('attachment;'));
    assert((await attachment.text()).startsWith('%PDF-'));
    const notApplied = await call('/api/applicant-members?status=unsubmitted', null, managerCookie, 'GET');
    assert(notApplied.body.rows.every(m => !m.submissionId));
    const applied = await call('/api/applicant-members?status=submitted', null, managerCookie, 'GET');
    assert(applied.body.rows.every(m => m.submissionId));
    assert.equal((await call('/api/applicant-members/999999999', null, managerCookie, 'GET')).status, 404);
    await query("INSERT INTO accounts (login_id, display_name, role, password_value, password_temporary) SELECT 'member-list-operator', '회원 조회 권한 테스트', '운영자', password_value, 0 FROM accounts WHERE login_id = 'admin'");
    const operatorLogin = await call('/api/auth/login', { id: 'member-list-operator', password: 'AdminSmoke1234' });
    assert.equal(operatorLogin.status, 200);
    for (const resource of ['/api/applicant-members', `/api/applicant-members/${memberId}`, `/api/applicant-members/${memberId}/files/test_file`]) assert.equal((await call(resource, null, operatorLogin.cookie, 'GET')).status, 403, 'Operators cannot access member personal data');
    assert.equal((await call('/api/system-data/applicant-members', { currentPassword: 'AdminSmoke1234' }, operatorLogin.cookie, 'DELETE')).status, 403);
    for (let index = 0; index < 22; index++) await query("INSERT INTO applicant_members (login_id, email, name, password_hash, email_verified, profile_json, consent_json) SELECT ?, ?, ?, password_hash, 1, '{}', '{}' FROM applicant_members WHERE id = ?", [`paging${index}@example.test`, `paging${index}@example.test`, `페이지 회원 ${index}`, memberId]);
    const firstMemberPage = await call('/api/applicant-members?search=paging&page=1', null, managerCookie, 'GET');
    const secondMemberPage = await call('/api/applicant-members?search=paging&page=2', null, managerCookie, 'GET');
    assert.equal(firstMemberPage.body.total, 22);
    assert.equal(firstMemberPage.body.rows.length, 20);
    assert.equal(secondMemberPage.body.rows.length, 2);
    assert(!firstMemberPage.body.rows.some(row => secondMemberPage.body.rows.some(other => other.id === row.id)));

    const savedMembers = await query('SELECT * FROM applicant_members ORDER BY id');
    const savedLinks = await query('SELECT id, member_id FROM app_meta ORDER BY id');
    const settingsBeforeDelete = await members.getSettings();
    const backup = await services.systemService.buildSystemBackupArchive({ includeDatabase: true, includedAssetKeys: [] });
    const zip = new (require('adm-zip'))(backup.archiveBuffer);
    assert(zip.getEntry('tables/applicant_members.json'));
    assert.equal(zip.getEntry('tables/applicant_member_sessions.json'), null);
    assert.equal(zip.getEntry('tables/applicant_member_verifications.json'), null);
    assert.equal(zip.getEntry('tables/applicant_member_recovery.json'), null);
    assert.equal((await call('/api/system-data/applicant-members', { currentPassword: 'wrong' }, managerCookie, 'DELETE')).status, 401, 'Member deletion requires the current administrator password');
    assert.equal((await query('SELECT COUNT(*) AS count FROM applicant_members'))[0].count, savedMembers.length);
    const deleted = await call('/api/system-data/applicant-members', { currentPassword: 'AdminSmoke1234' }, managerCookie, 'DELETE');
    assert.equal(deleted.status, 200, JSON.stringify(deleted));
    assert.equal(deleted.body.deletedMembers, savedMembers.length);
    assert.equal((await query('SELECT COUNT(*) AS count FROM applicant_members'))[0].count, 0);
    assert.equal((await query('SELECT COUNT(*) AS count FROM app_meta'))[0].count, savedLinks.length, 'Deleting accounts preserves applications');
    assert((await query('SELECT member_id FROM app_meta')).every(row => row.member_id === null));
    assert.equal((await call('/api/public/members/session', null, memberAgain.cookie, 'GET')).body.member, null);
    assert.deepEqual(await members.getSettings(), settingsBeforeDelete, 'Member deletion preserves signup configuration');
    const validation = await services.systemService.validateSystemBackupArchive(backup.archiveBuffer);
    assert.equal(validation.memberCount, savedMembers.length);
    assert.equal(validation.currentMemberCount, 0);
    const restored = await services.systemService.restoreSystemBackupArchive(backup.archiveBuffer, { selectedRestoreItemKeys: ['database'] });
    assert.equal(restored.restoredMembers, savedMembers.length);
    assert.deepEqual(await query('SELECT * FROM applicant_members ORDER BY id'), savedMembers, 'Restore retains profiles, files, consent and password hashes');
    assert.deepEqual(await query('SELECT id, member_id FROM app_meta ORDER BY id'), savedLinks, 'Restore retains member-application links');
    assert.equal((await call('/api/public/members/session', null, memberAgain.cookie, 'GET')).body.member, null, 'Restore never revives old login sessions');
    assert.equal((await call('/api/auth/login', { id: 'typedmember@example.test', password: '5678' })).status, 200);
    const memberCountBeforeHistoryDelete = savedMembers.length;
    await services.systemService.deleteSystemData('applicant-history');
    assert.equal((await query('SELECT COUNT(*) AS count FROM applicant_members'))[0].count, memberCountBeforeHistoryDelete, 'Deleting applications preserves member accounts');
    const allDeleted = await services.systemService.deleteSystemData('all');
    assert.equal(allDeleted.deletedMembers, savedMembers.length);
    console.log('PASS: member admin list/detail, search and status filters, authorization, private downloads, member deletion and backup/restore round trip');
    assert.deepEqual(errors, []);
    console.log("PASS: browser signup, login, 2x2 menu, lookup, documents, mobile, logout, application entry and admin configuration");
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (pool) await pool.end();
    if (/^admitcard_membership_test_\d+$/.test(database)) await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await admin.end();
    if (path.dirname(root) === os.tmpdir() && path.basename(root).startsWith("admitcard-member-test-")) fs.rmSync(root, { recursive: true, force: true });
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
