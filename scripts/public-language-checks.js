const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

async function runPublicLanguageChecks({ services, members, query, base, call, memberCookie, submissionId }) {
  const artifacts = path.resolve('.tmp-public-language-check');
  fs.mkdirSync(artifacts, { recursive: true });
  const recruitmentChecks = require('./recruitment-language-checks');
  const bilingualRecruitmentUnit = await recruitmentChecks.prepareRecruitmentLanguageChecks({ services, query });
  const messages = require('../client/app/public-messages');
  for (const [key, value] of Object.entries(messages)) {
    assert.equal(/[가-힣]/.test(value), false, `English catalog: ${key}`);
    assert.deepEqual([...key.matchAll(/\{\d+\}/g)].map(m => m[0]).sort(), [...value.matchAll(/\{\d+\}/g)].map(m => m[0]).sort(), `Placeholders: ${key}`);
  }
  await services.systemService.updateSuperAdminSettings({ ...(await services.systemService.getSuperAdminSettings()), schoolName: '로그인' });
  for (const scope of ['login', 'applicant']) await services.systemService.updateLoginNoticeHtml({ scope, html: '<p>접수하기</p><p>직접 작성한 안내입니다.</p>' });
  await members.saveSettings({ birth: 'hidden', phone: 'hidden',
    terms: [{ id: 'original-terms', title: '로그인', text: '접수하기', enabled: true, required: true }],
    extraFields: [
      { key: 'original', label: '접수하기', description: '비밀번호', inputType: 'select', options: ['로그인', '회원가입'], required: false },
      { key: 'country', label: '국적 선택 질문', inputType: 'nationality', required: false },
      { key: 'attachment', label: '첨부파일 질문', inputType: 'file', required: false },
      { key: 'bilingual', label: '선호하는 이름', labelEn: 'Preferred name', description: '사용할 이름을 입력하세요.', descriptionEn: 'Enter the name you use. <Example>', inputType: 'text', required: false },
    ],
  });
  // Deliberately collide with dictionary keys to prove that data is not translated.
  const signupSettings = await members.getSettings();
  await members.saveSettings({ ...signupSettings, questions: signupSettings.questions.map(q => q.key === 'email'
    ? { ...q, description: '이메일을 입력하세요.', descriptionEn: 'Please enter your email address.' }
    : q.key === 'password' ? { ...q, description: '', descriptionEn: 'Choose a password.' } : q) });
  await services.applicantService.createApplicantFormField({ fieldKey: 'language-text', questionText: '로그인', inputType: 'text', required: false });
  for (const formScope of ['application', 'documents']) {
    await services.applicantService.createApplicantFormField({ formScope, fieldKey: `bilingual-${formScope}`, questionText: `${formScope} 한국어 질문`, questionTextEn: `${formScope} English question`, questionDescription: '한국어 설명', questionDescriptionEn: 'English instructions', inputType: 'text', required: false });
    const field = (await services.applicantService.getApplicantFormFields({ formScope })).find(f => f.fieldKey === `bilingual-${formScope}`);
    assert.equal(field.questionTextEn, `${formScope} English question`);
    await services.applicantService.updateApplicantFormField(field.id, { required: false });
    assert.equal((await services.applicantService.getApplicantFormFields()).find(f => f.id === field.id).questionDescriptionEn, 'English instructions', 'Partial updates preserve translations');
    await services.applicantService.updateApplicantFormField(field.id, { questionTextEn: '', questionDescriptionEn: '' });
    assert.equal((await services.applicantService.getApplicantFormFields()).find(f => f.id === field.id).questionTextEn, '', 'English text can be cleared');
    await services.applicantService.updateApplicantFormField(field.id, { questionTextEn: `${formScope} English question`, questionDescriptionEn: 'English instructions' });
  }
  await query("INSERT INTO app_subm (id, applicant_name, email, field_key, answer_data) SELECT id, applicant_name, email, 'bilingual-application', ? FROM app_subm WHERE id = ? LIMIT 1", ['내가 작성한 답변', submissionId]);
  await query("INSERT INTO app_subm (id, applicant_name, email, field_key, answer_data) SELECT id, applicant_name, email, 'language-text', ? FROM app_subm WHERE id = ? LIMIT 1", ['접수하기', submissionId]);
  const originalRows = await query('SELECT field_key, answer_data FROM app_subm WHERE id = ? ORDER BY field_key', [submissionId]);
  const browser = await puppeteer.launch({ headless: true, userDataDir: fs.mkdtempSync(path.join(artifacts, 'browser-')), executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  const errors = [];
  const attach = async context => { const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); await page.setViewport({ width: 390, height: 844 }); return page; };
  const go = (page, pathname) => page.goto(base + pathname, { waitUntil: 'networkidle0' });
  const language = async (page, value) => { await page.bringToFront(); await page.click(`[data-language="${value}"]`); await page.waitForFunction(locale => document.documentElement.lang === locale, { polling: 50 }, value); };
  async function audit(page, label) {
    const remaining = await page.evaluate(() => {
      const found = new Set();
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walk.nextNode())) {
        const el = node.parentElement;
        if (el.closest('script, style, textarea, [translate="no"], [data-i18n-user-content], [data-i18n-en]') || !el.getClientRects().length) continue;
        if (/[가-힣]/.test(node.data)) found.add(node.data.trim());
      }
      return [...found];
    });
    assert.deepEqual(remaining, [], `${label}: untranslated system text`);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: no horizontal overflow`);
  }
  async function setCookie(context, cookie) {
    const [name, ...value] = cookie.split('=');
    await context.setCookie({ name, value: value.join('='), url: base });
  }
  try {
    const visitor = await browser.createBrowserContext();
    const page = await attach(visitor);
    await go(page, '/login');
    await page.waitForSelector('#loginAccountId:not([disabled])');
    assert.equal(await page.$eval('html', el => el.lang), 'ko');
    await page.type('#loginAccountId', 'original@example.test');
    await page.type('#loginPassword', '비밀번호');
    await language(page, 'en');
    assert.equal(await page.$eval('#loginAccountId', el => el.value), 'original@example.test');
    assert.equal(await page.$eval('#loginPassword', el => el.value), '비밀번호');
    assert.equal(await page.$eval('#loginAccountId', el => el.placeholder), 'Enter your email');
    assert.equal(await page.$eval('.login-stage-brand-copy strong', el => el.textContent), '로그인');
    assert.equal(await page.$eval('.login-notice-content', el => el.textContent), '접수하기직접 작성한 안내입니다.');
    assert.equal(await page.$eval('.login-form h3', el => el.textContent), 'Sign in');
    await audit(page, 'English login');
    await page.click('#loginForm button[type=submit]');
    await page.waitForFunction(() => document.getElementById('loginError').textContent.includes('Incorrect'));
    await language(page, 'ko');
    assert((await page.$eval('#loginError', el => el.textContent)).includes('올바르지'));
    await language(page, 'en');
    for (const width of [320, 390, 1440]) {
      await page.setViewport({ width, height: 900 });
      await audit(page, `login ${width}`);
    }
    await page.setViewport({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(artifacts, 'login-en.png'), fullPage: true });
    await page.reload({ waitUntil: 'networkidle0' });
    assert.equal(await page.$eval('html', el => el.lang), 'en', 'Preference persists after reload');
    await page.click('.common-login-signup');
    await page.waitForSelector('[data-applicant-form="member-terms"]');
    await audit(page, 'Signup terms');
    assert.equal(await page.$eval('.applicant-member-terms-text', el => el.textContent), '접수하기');
    await page.click('[data-member-term-view]');
    assert.equal(await page.$eval('#member-term-dialog-title', el => el.textContent), '로그인');
    assert.equal(await page.$eval('[data-member-term-content]', el => el.textContent), '접수하기');
    await page.click('[data-member-term-close]');
    await page.click('[data-member-term]');
    await language(page, 'ko');
    assert(await page.$eval('[data-member-term]', el => el.checked));
    await language(page, 'en');
    await page.click('[data-applicant-form="member-terms"] button[type=submit]');
    await page.waitForSelector('[name=email]', { visible: true });
    assert.equal(await page.$eval('[name=email]', el => el.closest('.applicant-public-field').querySelector('small.muted').textContent), 'Please enter your email address. · Use your verified email to sign in.');
    assert.equal(await page.$eval('[name=password]', el => el.closest('.applicant-public-field').querySelector('small.muted').textContent), 'Choose a password. · 4–20 characters');
    await page.type('[name=name]', '로그인');
    assert.equal(await page.$eval('[name="profile.bilingual"]', el => el.getAttribute('aria-label')), 'Preferred name');
    assert((await page.$eval('[name="profile.bilingual"]', el => el.closest('.applicant-public-field').textContent)).includes('Enter the name you use. <Example>'));
    assert.equal(await page.$('[name="profile.bilingual"] example'), null, 'Authored HTML is plain text');
    await page.type('[name="profile.bilingual"]', '그대로 유지할 답변');
    await page.select('[data-member-select=original]', '회원가입');
    await audit(page, 'Signup details');
    assert.deepEqual(await page.$$eval('[data-member-select=original] option', options => options.map(o => [o.value, o.textContent])), [['', 'Select'], ['로그인', '로그인'], ['회원가입', '회원가입']]);
    await page.type('[data-member-nationality-search=country]', 'Korea');
    await page.waitForSelector('[data-member-nationality-value=KR]');
    const koreaEnglish = await page.evaluate(() => AdmitCardApplicantFormConfig.findApplicantNationalityOption('KR').englishLabel);
    assert.equal(await page.$eval('[data-member-nationality-value=KR] strong', el => el.textContent), koreaEnglish);
    await page.click('[data-member-nationality-value=KR]');
    assert.equal(await page.$eval('[data-member-nationality-search=country]', el => el.value), `대한민국 · ${koreaEnglish} · KR`);
    const filePath = path.join(artifacts, '로그인.pdf');
    fs.writeFileSync(filePath, '%PDF-1.4\nfixture');
    await (await page.$('[data-member-file=attachment]')).uploadFile(filePath);
    await page.waitForSelector('[data-member-upload-preview=attachment] [translate=no]');
    assert.equal(await page.$eval('[data-member-upload-preview=attachment] [translate=no]', el => el.textContent), '로그인.pdf');
    const formBefore = await page.$eval('[data-applicant-form=member-register]', form => [...new FormData(form)].filter(([,v]) => typeof v === 'string'));
    await language(page, 'ko');
    assert.equal(await page.$eval('[name="profile.bilingual"]', el => el.getAttribute('aria-label')), '선호하는 이름');
    assert((await page.$eval('[name="profile.bilingual"]', el => el.closest('.applicant-public-field').textContent)).includes('사용할 이름을 입력하세요.'));
    assert.equal(await page.$eval('[data-member-nationality-search=country]', el => el.value), `대한민국 · ${koreaEnglish} · KR`);
    await language(page, 'en');
    assert.deepEqual(await page.$eval('[data-applicant-form=member-register]', form => [...new FormData(form)].filter(([,v]) => typeof v === 'string')), formBefore, 'Language changes preserve all form values');
    await audit(page, 'Signup with file');
    await page.screenshot({ path: path.join(artifacts, 'signup-en.png'), fullPage: true });
    await go(page, '/account-recovery');
    await audit(page, 'Password recovery');
    assert.equal(await page.title(), 'Reset password | Application Portal');
    // A second tab receives the same origin preference through the storage event.
    const secondTab = await attach(visitor);
    await go(secondTab, '/login');
    await language(page, 'ko');
    await secondTab.waitForFunction(() => document.documentElement.lang === 'ko', { polling: 50 });
    await language(page, 'en');
    await secondTab.waitForFunction(() => document.documentElement.lang === 'en', { polling: 50 });
    await secondTab.close();
    console.log('PASS: login, registration, recovery, persistence, cross-tab sync and original user content');

    const applicant = await browser.createBrowserContext();
    await setCookie(applicant, memberCookie);
    const memberPage = await attach(applicant);
    await memberPage.evaluateOnNewDocument(() => localStorage.setItem('applyhub.public-language', 'en'));
    await go(memberPage, '/applicant');
    await memberPage.waitForSelector('[data-applicant-action=member-summary]');
    await audit(memberPage, 'Applicant home');
    assert.equal(await memberPage.$eval('[data-applicant-action=member-apply] strong', el => el.textContent), 'Application submitted');
    await memberPage.screenshot({ path: path.join(artifacts, 'home-en.png'), fullPage: true });
    await memberPage.click('[data-applicant-action=member-summary]');
    await memberPage.waitForSelector('.applicant-public-summary-grid');
    await audit(memberPage, 'Application results');
    assert((await memberPage.$eval('.applicant-public-summary-grid', el => el.textContent)).includes('application English question'));
    assert((await memberPage.$eval('.applicant-public-summary-grid', el => el.textContent)).includes('내가 작성한 답변'));
    assert((await memberPage.$$eval('.applicant-public-summary-item [translate=no]', nodes => nodes.map(n => n.textContent))).includes('로그인'));
    assert((await memberPage.$$eval('.applicant-public-summary-item [translate=no]', nodes => nodes.map(n => n.textContent))).includes('접수하기'));
    await go(memberPage, '/applicant/form?preview=1');
    await memberPage.waitForSelector('.applicant-public-application-panel');
    await audit(memberPage, 'Application form preview');
    assert.equal(await memberPage.$eval('label[for=field-bilingual-application] [data-i18n-ko]', el => el.textContent), 'application English question');
    await language(memberPage, 'ko');
    assert.equal(await memberPage.$eval('label[for=field-bilingual-application] [data-i18n-ko]', el => el.textContent), 'application 한국어 질문');
    await language(memberPage, 'en');
    // Temporarily unlink this disposable test fixture to exercise a first application.
    const [{ memberId }] = await query('SELECT member_id AS memberId FROM app_meta WHERE id = ?', [submissionId]);
    await query('UPDATE app_meta SET member_id = NULL WHERE id = ?', [submissionId]);
    await go(memberPage, '/applicant');
    await memberPage.click('[data-applicant-action=member-apply]');
    await memberPage.waitForSelector('#applicationSelection-track');
    await audit(memberPage, 'Application selections');
    for (const [key, value] of [['track', '수시'], ['admission', '일반'], ['series', '인문'], ['unit', '문학']]) await memberPage.select('#applicationSelection-' + key, value);
    await memberPage.click('[data-applicant-action=continue-application]');
    await memberPage.waitForSelector('#applicationBirth');
    assert.equal(await memberPage.$eval('#applicationBirth', el => el.value), '2001-02-03', 'System date formatting follows the public language');
    await language(memberPage, 'ko');
    assert.equal(await memberPage.$eval('#applicationBirth', el => el.value), '2001년 02월 03일');
    await language(memberPage, 'en');
    await audit(memberPage, 'Application form');
    await query('UPDATE app_meta SET member_id = ? WHERE id = ?', [memberId, submissionId]);
    await go(memberPage, '/applicant/documents');
    await memberPage.waitForSelector('[data-applicant-form=member-documents]');
    await audit(memberPage, 'Document submission');
    assert.equal(await memberPage.$eval('label[for=field-bilingual-documents] [data-i18n-ko]', el => el.textContent), 'documents English question');
    await memberPage.type('#field-bilingual-documents', '직접 작성한 서류 답변');
    await language(memberPage, 'ko');
    assert.equal(await memberPage.$eval('label[for=field-bilingual-documents] [data-i18n-ko]', el => el.textContent), 'documents 한국어 질문');
    await language(memberPage, 'en');
    assert.equal(await memberPage.$eval('#field-bilingual-documents', el => el.value), '직접 작성한 서류 답변');
    await go(memberPage, '/applicant/ticket');
    await memberPage.waitForSelector('.applicant-public-ticket-slab');
    await audit(memberPage, 'Ticket viewing');
    assert.deepEqual(await query('SELECT field_key, answer_data FROM app_subm WHERE id = ? ORDER BY field_key', [submissionId]), originalRows, 'Viewing in English never modifies stored answers');
    console.log('PASS: applicant home, results, documents and ticket interface; saved data is unchanged');

    const staff = await browser.createBrowserContext();
    await query('UPDATE accounts SET password_temporary = 0');
    const { initialPassword } = await services.systemService.getSystemSettings();
    const login = await call('/api/auth/login', { id: 'admin', password: initialPassword });
    assert.equal(login.status, 200);
    const adminPage = await attach(staff);
    await adminPage.evaluateOnNewDocument(() => localStorage.setItem('applyhub.public-language', 'en'));
    await go(adminPage, '/login');
    await adminPage.waitForSelector('#loginAccountId:not([disabled])');
    await adminPage.type('#loginAccountId', 'admin');
    await adminPage.type('#loginPassword', initialPassword);
    await Promise.all([
      adminPage.waitForNavigation({ waitUntil: 'networkidle0' }),
      adminPage.click('#loginForm button[type=submit]'),
    ]);
    await adminPage.waitForFunction(() => {
      const shell = document.getElementById('appShell');
      return shell && !shell.classList.contains('auth-locked');
    });
    assert.equal(await adminPage.$eval('html', el => el.lang), 'ko', 'Signing in as staff restores the Korean interface');
    assert.equal(await adminPage.$eval('.brand h1', el => el.textContent), '원서접수시스템', 'Hidden staff content was never translated on the login screen');
    await go(adminPage, '/applicant-schedules');
    assert.equal(await adminPage.$eval('html', el => el.lang), 'ko');
    assert((await adminPage.title()).includes('일정 관리'));
    assert.equal(await adminPage.$('applyhub-language-toggle'), null);
    assert.equal(await adminPage.$eval('[data-view=applicantScheduleManagement]', el => el.textContent.trim()), '일정 관리');
    await require('./notice-language-checks').runNoticeLanguageChecks({ services, call, adminPage, page, memberPage, go, language, artifacts });
    await recruitmentChecks.runRecruitmentLanguageUiChecks({ services, query, call, adminPage, memberPage, go, language, artifacts, submissionId, unit: bilingualRecruitmentUnit });
    // Save through the actual shared editor, reload, and verify both languages remain.
    const fill = (selector, value) => adminPage.$eval(selector, (el, text) => { el.value = text; el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    for (const formScope of ['application', 'documents', 'signup']) {
      await go(adminPage, '/applicant-question-template-management?tab=' + formScope);
      if (formScope !== 'signup') await adminPage.click('.form-template-thumbnail-open');
      const signup = formScope === 'signup', prefix = signup ? 'signup' : 'applicant';
      const field = signup ? { id: 'bilingual' } : (await services.applicantService.getApplicantFormFields({ formScope })).find(f => f.fieldKey === `bilingual-${formScope}`);
      const card = `[data-${prefix}-field-select="${field.id}"]`;
      await adminPage.waitForSelector(card);
      await adminPage.click(card);
      const titleInput = `[data-${prefix}-field-input=questionTextEn]`, descInput = `[data-${prefix}-field-input=questionDescriptionEn]`;
      assert.equal(await adminPage.$eval(titleInput, el => el.value), signup ? 'Preferred name' : `${formScope} English question`);
      await fill(titleInput, `${formScope} updated English title`);
      await fill(descInput, `${formScope} updated English description`);
      await Promise.all([adminPage.waitForResponse(r => r.request().method() === 'PUT' && r.url().includes(signup ? '/api/applicant-signup-settings' : `/api/applicant-form-fields/${field.id}`)), adminPage.click(`[data-${prefix}-field-form] button[type=submit]`)]);
      await adminPage.reload({ waitUntil: 'networkidle0' });
      if (!signup) await adminPage.click('.form-template-thumbnail-open');
      await adminPage.waitForSelector(card);
      await adminPage.click(card);
      assert.equal(await adminPage.$eval(titleInput, el => el.value), `${formScope} updated English title`);
      assert.equal(await adminPage.$eval(descInput, el => el.value), `${formScope} updated English description`);
      assert.equal(await adminPage.$eval(`[data-${prefix}-field-input=questionText]`, el => el.value), signup ? '선호하는 이름' : `${formScope} 한국어 질문`);
      await adminPage.screenshot({ path: path.join(artifacts, `${formScope}-bilingual-editor.png`), fullPage: true });
    }
    console.log('PASS: bilingual signup, application and document questions; editor persistence, fallback and answer preservation');
    const blockedStorage = await browser.createBrowserContext();
    const privatePage = await attach(blockedStorage);
    await privatePage.evaluateOnNewDocument(() => {
      const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
      Storage.prototype.getItem = function(key) { if (key === 'applyhub.public-language') throw new Error('Storage blocked'); return get.call(this, key); };
      Storage.prototype.setItem = function(key, value) { if (key === 'applyhub.public-language') throw new Error('Storage blocked'); return set.call(this, key, value); };
    });
    await go(privatePage, '/login');
    await language(privatePage, 'en');
    assert.equal(await privatePage.$eval('.login-form h3', el => el.textContent), 'Sign in');
    assert.deepEqual(errors, []);
    console.log('PASS: administrator screens stay Korean; language control works without browser storage');
  } finally { await browser.close(); }
}
module.exports = { runPublicLanguageChecks };
