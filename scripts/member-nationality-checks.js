const assert = require('node:assert/strict');

async function runMemberNationalityChecks({ services, members, query, call, memberCookie, signup }) {
  const applicants = services.applicantService;
  const settings = await members.getSettings();
  await members.saveSettings({ ...settings, questions: [...settings.questions,
    { key: 'signup-country-42', label: '국적', inputType: 'nationality', required: true },
  ] });
  await applicants.updateApplicantSettings({ components: ['nationalityCode', 'sequence', '', '', ''], digitCount: 8 });
  const application = {
    selectionAnswers: { track: '수시', admission: '일반', series: '인문', unit: '문학', major: '' },
    answers: { 'applicant-name': signup.name },
  };
  async function setProfile(profile) {
    await query('UPDATE applicant_members SET profile_json = ? WHERE email = ?', [JSON.stringify(profile), signup.email]);
  }
  async function submitAndCheck(expectedCode, payload = application) {
    const before = (await query('SELECT profile_json FROM applicant_members WHERE email = ?', [signup.email]))[0].profile_json;
    const result = await call('/api/public/applications', payload, memberCookie);
    assert.equal(result.status, 200, JSON.stringify(result));
    assert.match(result.body.examineeNo, new RegExp(`^${expectedCode}\\d{6}$`));
    const context = await call('/api/public/members/application', null, memberCookie, 'GET');
    assert.equal(context.body.submission.examineeNo, result.body.examineeNo, 'The generated number persists on reload');
    assert.equal((await query('SELECT profile_json FROM applicant_members WHERE email = ?', [signup.email]))[0].profile_json, before, 'Submission leaves signup answers unchanged');
    await applicants.deleteApplicantSubmission(result.body.id);
  }
  await setProfile({ ...signup.profile, address: 'US', 'signup-country-42': 'CN' });
  await submitAndCheck('CN');
  await setProfile({ ...signup.profile, 'signup-country-42': '대한민국' });
  await submitAndCheck('KR');
  await setProfile({ ...signup.profile, nationality: 'CA' });
  await submitAndCheck('CA');

  await setProfile({ ...signup.profile, address: 'US', 'signup-country-42': '' });
  const before = (await query('SELECT COUNT(*) AS count FROM app_meta'))[0].count;
  const missing = await call('/api/public/applications', { ...application, nationality: 'US', memberId: 999 }, memberCookie);
  assert.equal(missing.status, 400);
  assert.equal(missing.body.code, 'APPLICANT_EXAM_NO_NATIONALITY_CODE_REQUIRED');
  assert.equal((await query('SELECT COUNT(*) AS count FROM app_meta'))[0].count, before, 'A missing nationality rolls back the submission');

  await setProfile({ ...signup.profile, 'signup-country-42': 'CN' });
  await applicants.createApplicantFormField({ fieldKey: 'application-nationality', questionText: '원서 국적', inputType: 'nationality', required: false });
  await submitAndCheck('FR', { ...application, answers: { ...application.answers, 'application-nationality': 'FR' } });
  await submitAndCheck('CN');
  console.log('PASS: signup nationality with custom keys, country names and legacy codes; persisted exam numbers; missing-country rollback; application answer priority and optional-field fallback');
}

module.exports = { runMemberNationalityChecks };
