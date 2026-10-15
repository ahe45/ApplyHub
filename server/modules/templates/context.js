const { dynamicDefinition, getTagValue } = require('../../../shared/domain/template-data');

function createTemplateContextService({ createHttpError, getApplicantService, getSignupSettings, getTemplate, templateTagDefinitions }) {
  async function getEditorContext(templateId) {
    const template = await getTemplate(templateId);
    if (!template) throw createHttpError(404, '양식을 찾을 수 없습니다.', 'TEMPLATE_NOT_FOUND');
    const service = getApplicantService();
    const schedules = (await service.getApplicantSchedules()).filter(row => row.admitCardTemplateId === templateId);
    const schedule = schedules[0];
    const [signup, templates] = await Promise.all([getSignupSettings(), service.getApplicantFormTemplates()]);
    const applicationTemplateIds = schedules.length
      ? [...new Set(schedules.map(row => row.applicationTemplateId))]
      : templates.filter(row => row.formScope === 'application').map(row => row.id);
    const fields = [...new Map((await Promise.all(applicationTemplateIds.map(templateId => service.getApplicantFormFields({ activeOnly: true, formScope: 'application', templateId })))).flat().map(field => [field.fieldKey, field])).values()];
    const tags = [
      ...templateTagDefinitions.filter(tag => tag.examineeKey).map(tag => ({ ...tag, group: 'system' })),
      ...signup.questions.filter(question => question.inputType !== 'password').map(question => dynamicDefinition(`@{회원가입:${question.key}}`, question.label, question.inputType)),
      ...fields.map(field => dynamicDefinition(`@{원서접수:${field.fieldKey}}`, field.questionText, field.inputType)),
    ].filter(Boolean);
    let submission;
    let previewSchedule = schedule;
    for (const candidate of schedules) {
      const submissions = await service.submissionQuery.list({ kind: 'ticket', track: candidate.trackName, admission: candidate.admissionName, page: 1, pageSize: 1 }, { details: true, includeOptions: false });
      if (submissions.rows[0]) { submission = submissions.rows[0]; previewSchedule = candidate; break; }
    }
    const record = submission ? await service.buildApplicantAdmitCardRecordFromSubmission(submission, { includePhoto: false }) : {
      name: '', examineeNo: '', birth: '', track: schedule?.trackName || '', admission: schedule?.admissionName || '', signupAnswers: {}, applicationAnswers: {},
    };
    record.currentDate = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    // Limit examples to the configured fields of this admission's application form.
    record.applicationAnswers = Object.fromEntries(fields.map(field => [field.fieldKey, record.applicationAnswers?.[field.fieldKey] || '']));
    const definitions = tags.map(tag => ({ ...tag, example: getTagValue(record, tag) }));
    return { template, schedule: previewSchedule || null, schedules: schedules.map(row => ({ id: row.id, trackName: row.trackName, admissionName: row.admissionName })), tags: definitions,
      previewRecord: record, previewSource: submission ? { kind: 'submission', submissionId: submission.id, name: submission.name, examineeNo: submission.examineeNo } : { kind: 'empty' } };
  }
  return { getEditorContext };
}
module.exports = { createTemplateContextService };
