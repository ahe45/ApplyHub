const assert = require('node:assert/strict');
const { createTemplateRenderingService } = require('../server/modules/templates/rendering');
const { templateRenderTagDefinitions } = require('../shared/app-config');

async function verifyTicketTagLinks({ services, members, query, submission, signup }) {
  const renderer = createTemplateRenderingService({
    createHttpError: services.createHttpError,
    escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    formatDateAsYmd: () => '2026-10-14',
    templateTagDefinitions: templateRenderTagDefinitions,
  });
  const content = '<p>@{생년월일}</p><span data-template-tag-value="@{생년월일}"><b>#생년월일</b></span>';
  async function check(expected) {
    const single = await services.applicantService.getApplicantSubmissionById(submission.id);
    const batch = (await services.applicantService.getApplicantSubmissionsByIds([submission.id]))[0];
    const all = (await services.applicantService.getApplicantSubmissions()).find(row => row.id === submission.id);
    for (const row of [single, batch, all]) {
      assert.equal(row.birth, expected);
      assert.equal(row.memberProfileJson, undefined, 'Member profile is not exposed in application responses');
      const record = await services.applicantService.buildApplicantAdmitCardRecordFromSubmission(row, { includePhoto: false });
      assert.equal(record.birth, expected);
      const html = await renderer.renderTemplateWithExaminee(content, record);
      assert.equal(html.split(expected).length - 1, 2, 'Plain and styled birth tags resolve');
      assert(!html.includes('#생년월일'));
    }
    assert.equal((await services.systemService.getBootstrapPayload()).examinees[0].birth, expected, 'Preview data uses the same birth value');
  }
  // Old application answers must not override the linked signup answer.
  await query("UPDATE app_subm SET answer_data = '1900-01-01' WHERE id = ? AND field_key = 'birth'", [submission.id]);
  await check(signup.profile.birth);
  // Current application templates do not need a duplicate birth question.
  await query("DELETE FROM app_subm WHERE id = ? AND field_key = 'birth'", [submission.id]);
  await query("DELETE FROM app_form WHERE system_field_key = 'birth' OR input_type = 'birthdate'");
  await check(signup.profile.birth);
  const settings = await members.getSettings();
  await members.saveSettings({ ...settings, questions: settings.questions.map(question => question.inputType === 'birthdate' ? { ...question, key: 'custom_birth' } : question) });
  await query('UPDATE applicant_members SET profile_json = ? WHERE id = ?', [JSON.stringify({ custom_birth: '2002-04-05' }), submission.memberId]);
  await check('2002-04-05');
  // Legacy applications without a linked member keep their stored birth answer.
  await query('UPDATE app_meta SET member_id = NULL WHERE id = ?', [submission.id]);
  const nameField = (await services.applicantService.getApplicantFormFields()).find(field => field.systemFieldKey === 'name');
  await query("UPDATE app_form SET system_field_key = 'birth' WHERE id = ?", [nameField.id]);
  await query("UPDATE app_subm SET answer_data = '1999-06-07' WHERE id = ? AND field_key = ?", [submission.id, nameField.fieldKey]);
  await check('1999-06-07');
  console.log('PASS: linked signup birth, custom signup keys, missing application birth field, legacy fallback, preview and rendered tags');
}
module.exports = { verifyTicketTagLinks };
