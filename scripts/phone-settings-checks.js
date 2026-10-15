const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const config = require('../shared/domain/applicant-form');

async function runPhoneSettingsChecks({ services, members, query, base, call, getDeliveredCode }) {
  const service = services.applicantService;
  assert.equal(config.phoneCountryCodes.KR, '82');
  assert.equal(config.phoneCountryCodes.MN, '976');
  assert.equal(config.normalizePhoneValue('010-1234-5678'), '01012345678');
  assert.equal(config.normalizePhoneValue('+976 99112233'), '+976 99112233');
  assert.equal(config.normalizePhoneValue('', { required: false }), '');
  for (const value of ['+999 1234', '+976 ', '+976 abc', '+976 ' + '1'.repeat(21)]) assert.throws(() => config.normalizePhoneValue(value));
  const settings = await members.getSettings();
  const questions = [false, true].map(showCountryCode => ({ key: showCountryCode ? 'phone-world' : 'phone-local', label: showCountryCode ? '해외 전화번호' : '국내 전화번호', inputType: 'phone', showCountryCode, required: true }));
  await members.saveSettings({ ...settings, terms: [], questions: [...settings.questions.filter(q => ['email', 'password', 'name'].includes(q.key)), ...questions] });
  for (const q of questions) await service.createApplicantFormField({ ...q, fieldKey: q.key, questionText: q.label });
  const fields = await service.getApplicantFormFields();
  const world = fields.find(field => field.fieldKey === 'phone-world');
  assert.equal(world.showCountryCode, true);
  await service.updateApplicantFormField(world.id, { questionDescription: '국가코드 유지' });
  assert.equal((await service.getApplicantFormFields()).find(field => field.id === world.id).showCountryCode, true);
  const email = 'phone@example.test', password = 'PhoneTest1234';
  const proof = await call('/api/public/members/email-code', { email });
  assert.equal(proof.status, 200);
  assert.equal((await call('/api/public/members/verify-email', { email, verificationId: proof.body.verificationId, code: getDeliveredCode() })).status, 200);
  const profile = { 'phone-local': '01012345678', 'phone-world': '+976 99112233' };
  const registered = await call('/api/public/members/register', { email, password, passwordConfirm: password, name: '전화번호 회원', verificationId: proof.body.verificationId, profile });
  assert.equal(registered.status, 200, JSON.stringify(registered.body));
  assert.deepEqual(registered.body.member.profile, profile);
  await service.createApplicantRecruitmentUnit({ trackName: '수시', admissionCode: 'P1', admissionName: '전화번호 전형', seriesCode: 'P2', seriesName: '인문', unitCode: 'P3', unitName: '문학' });
  await service.saveApplicantSchedule({ trackName: '수시', admissionCode: 'P1', admissionName: '전화번호 전형', applicantScheduleEnabled: true, applicantScheduleStartAt: '2020-01-01T00:00', applicantScheduleEndAt: '2099-12-31T23:59' });
  const application = { selectionAnswers: { track: '수시', admission: '전화번호 전형', series: '인문', unit: '문학', major: '' }, answers: { ...profile, birth: '2000-01-01' } };
  const rejected = await call('/api/public/applications', { ...application, answers: { ...application.answers, 'phone-world': '+999 1234' } }, registered.cookie);
  assert.equal(rejected.status, 400, JSON.stringify(rejected.body));
  const submitted = await call('/api/public/applications', application, registered.cookie);
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
  assert.equal((await service.getApplicantSubmissionById(submitted.body.id)).answerMap['phone-world'], '+976 99112233');

  await query('UPDATE accounts SET password_temporary=0');
  const { initialPassword } = await services.systemService.getSystemSettings();
  const login = await call('/api/auth/login', { id: 'admin', password: initialPassword });
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const errors = [];
  try {
    const context = await browser.createBrowserContext();
    const at = login.cookie.indexOf('=');
    await context.setCookie({ name: login.cookie.slice(0, at), value: login.cookie.slice(at + 1), url: base });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    for (const scope of ['signup', 'application']) {
      const prefix = scope === 'signup' ? 'signup' : 'applicant';
      await page.goto(base + '/applicant-question-template-management?tab=' + scope, { waitUntil: 'networkidle0' });
      if (scope === 'application') await page.click('.form-template-thumbnail-open');
      const id = scope === 'signup' ? 'phone-world' : world.id;
      await page.click(`[data-${prefix}-field-select="${id}"]`);
      const toggle = `[data-${prefix}-field-input=showCountryCode]`;
      assert(await page.$eval(toggle, n => n.checked));
      for (const expected of [false, true]) {
        await page.click(toggle);
        const saved = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().includes(scope === 'signup' ? '/api/applicant-signup-settings' : '/api/applicant-form-fields/'));
        await page.click(`[data-${prefix}-field-form] button[type=submit]`);
        assert.equal((await saved).status(), 200);
        await page.waitForFunction((selector, checked) => document.querySelector(selector)?.checked === checked, {}, toggle, expected);
        const stored = scope === 'signup' ? (await members.getSettings()).questions.find(q => q.key === id) : (await service.getApplicantFormFields()).find(f => f.id === id);
        assert.equal(stored.showCountryCode, expected);
      }
      await page.reload({ waitUntil: 'networkidle0' });
      if (scope === 'application') await page.click('.form-template-thumbnail-open');
      await page.click(`[data-${prefix}-field-select="${id}"]`);
      assert(await page.$eval(toggle, n => n.checked));
      await page.select(`[data-${prefix}-field-input=inputType]`, 'text');
      assert.equal(await page.$(toggle), null, 'Only phone questions offer the country-code setting');
    }
    for (const prefix of ['member', 'applicant']) {
      const publicPage = await browser.newPage();
      publicPage.on('pageerror', error => errors.push(error.message));
      await publicPage.setViewport({ width: 390, height: 844 });
      await publicPage.goto(base + (prefix === 'member' ? '/applicant/signup?preview=1' : '/applicant/form?preview=1'), { waitUntil: 'networkidle0' });
      if (prefix === 'member') await publicPage.click('[data-applicant-form=member-terms] button[type=submit]');
      const group = '[data-phone-field-key=phone-world]';
      await publicPage.waitForSelector(group, { visible: true });
      assert.equal(await publicPage.$('[data-phone-field-key=phone-local]'), null, 'Hidden mode keeps a single phone input');
      await publicPage.select(group + ' [data-phone-country]', 'MN');
      await publicPage.$eval(group + ' [data-phone-number]', n => { n.value = ''; n.dispatchEvent(new Event('input', { bubbles: true })); });
      assert.equal(await publicPage.$eval(group + ' [data-phone-value]', n => n.value), '', 'Country code alone is not an answer');
      await publicPage.type(group + ' [data-phone-number]', '99112233');
      assert.equal(await publicPage.$eval(group + ' [data-phone-value]', n => n.value), '+976 99112233');
      await publicPage.select(group + ' [data-phone-country]', 'KR');
      assert.equal(await publicPage.$eval(group + ' [data-phone-value]', n => n.value), '+82 99112233');
      assert(await publicPage.$eval(group, n => n.scrollWidth <= n.clientWidth + 1), 'Phone controls fit mobile width');
      await publicPage.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: phone country-code settings, persistence, signup validation, public controls and mobile layout');
  } finally { await browser.close(); }
}
module.exports = { runPhoneSettingsChecks };
