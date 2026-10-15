const { randomUUID } = require("crypto");

const { createTemplateRenderingService } = require("./rendering");
const { createTemplateContextService } = require('./context');

function createTemplateService({
  createHttpError,
  escapeHtml,
  formatDateAsYmd,
  getPool,
  query,
  templateTagDefinitions,
  getApplicantService,
  getSignupSettings,
}) {
  const selectTemplate = `SELECT t.id, t.name, t.description, t.version_label AS version,
    IF(EXISTS(SELECT 1 FROM app_schedule WHERE admit_card_template_id = t.id), 'used', 'unused') AS status,
    t.content_html AS contentHtml FROM templates t`;
  const templateRenderingService = createTemplateRenderingService({
    createHttpError,
    escapeHtml,
    formatDateAsYmd,
    templateTagDefinitions,
  });
  const { buildTemplateGeneratedObjectSvg, createTemplateExamineeRenderer, renderTemplateWithExaminee } =
    templateRenderingService;

  function normalizeTemplatePayload(payload, existingTemplate = {}) {
    const name = String(payload.name ?? existingTemplate.name ?? "").trim();
    const description = String(payload.description ?? existingTemplate.description ?? "").trim();
    const version = String(payload.version ?? existingTemplate.version ?? "").trim();
    const status = payload.status ?? existingTemplate.status ?? "unused";
    const contentHtml = String(payload.contentHtml ?? existingTemplate.contentHtml ?? "")
      .replace(/<span\b[^>]*\sdata-template-tag-value=(["'])[^"']*\1[^>]*>/gi, tag => tag
        .replace(/\sdata-template-tag-example=(["'])[^"']*\1/gi, '')
        .replace(/\stitle=(["'])[^"']*\1/gi, ''));

    if (!name) {
      throw createHttpError(400, "양식 이름이 필요합니다.");
    }

    if (!version) {
      throw createHttpError(400, "양식 버전이 필요합니다.");
    }

    if (!["used", "unused"].includes(status)) {
      throw createHttpError(400, "양식 상태는 used 또는 unused 여야 합니다.");
    }

    if (!contentHtml.trim()) {
      throw createHttpError(400, "양식 HTML 내용이 비어 있습니다.");
    }

    return {
      id: existingTemplate.id || `template-${randomUUID()}`,
      name,
      description,
      version,
      status,
      contentHtml,
    };
  }

  async function getTemplates() {
    return query(`${selectTemplate} ORDER BY t.created_at ASC, t.updated_at ASC`);
  }

  async function getTemplatesById(templateId) {
    return query(
      `${selectTemplate} WHERE t.id = ?`,
      [templateId],
    );
  }

  async function createTemplate(payload) {
    const template = normalizeTemplatePayload(payload);

    await query(
      `
        INSERT INTO templates (id, name, description, version_label, status, content_html)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [template.id, template.name, template.description, template.version, template.status, template.contentHtml],
    );

    return (await getTemplatesById(template.id))[0];
  }

  async function updateTemplate(templateId, payload) {
    const [existingTemplate] = await getTemplatesById(templateId);

    if (!existingTemplate) {
      throw createHttpError(404, "수정할 양식을 찾을 수 없습니다.");
    }

    const template = normalizeTemplatePayload(payload, existingTemplate);
    await query(
      `
        UPDATE templates
        SET
          name = ?,
          description = ?,
          version_label = ?,
          status = ?,
          content_html = ?
        WHERE id = ?
      `,
      [template.name, template.description, template.version, template.status, template.contentHtml, templateId],
    );

    return (await getTemplatesById(templateId))[0];
  }

  async function activateTemplate() {
    throw createHttpError(409, '전형 상세설정의 적용 템플릿에서 수험표 양식을 선택하세요.', 'TEMPLATE_SELECT_IN_ADMISSION_SETTINGS');
  }

  async function deleteTemplate(templateId) {
    const [existingTemplate] = await getTemplatesById(templateId);

    if (!existingTemplate) {
      throw createHttpError(404, "삭제할 양식을 찾을 수 없습니다.");
    }

    if (existingTemplate.status === "used") {
      throw createHttpError(409, "사용 중인 양식은 삭제할 수 없습니다.");
    }

    await query(`DELETE FROM templates WHERE id = ?`, [templateId]);
    return { id: templateId };
  }

  async function getActiveTemplate(record = {}) {
    const schedules = await getApplicantService().getApplicantSchedules();
    const schedule = schedules.find(s => s.trackName === String(record.track || '') && s.admissionName === String(record.admission || '') && (!record.admissionCode || s.admissionCode === record.admissionCode));
    const [template] = schedule?.admitCardTemplateId ? await getTemplatesById(schedule.admitCardTemplateId) : [];

    if (!template) {
      throw createHttpError(404, "전형 상세설정에서 수험표 양식을 선택하세요.");
    }

    return template;
  }

  const context = createTemplateContextService({ createHttpError, getApplicantService, getSignupSettings, templateTagDefinitions,
    getTemplate: async id => (await getTemplatesById(id))[0] });
  async function previewTemplate(templateId, html = '') {
    const data = await context.getEditorContext(templateId);
    const renderedHtml = await renderTemplateWithExaminee(html || data.template.contentHtml, { ...data.previewRecord, templateTags: data.tags, useTemplatePreviewPhoto: true });
    return { renderedHtml, previewSource: data.previewSource, schedule: data.schedule };
  }

  return Object.freeze({
    activateTemplate,
    buildTemplateGeneratedObjectSvg,
    createTemplateExamineeRenderer,
    createTemplate,
    deleteTemplate,
    getActiveTemplate,
    getTemplates,
    getEditorContext: context.getEditorContext,
    previewTemplate,
    normalizeTemplatePayload,
    renderTemplateWithExaminee,
    updateTemplate,
  });
}

module.exports = {
  createTemplateService,
};
