function createFormTemplateService({ query, getPool, createHttpError, randomUUID }) {
  async function list() {
    const rows = await query(`SELECT id, form_scope AS formScope, name, is_default AS isDefault
      FROM app_form_template ORDER BY form_scope, is_default DESC, id`);
    return rows.map(row => ({ ...row, id: Number(row.id), isDefault: Boolean(row.isDefault) }));
  }

  async function resolve(formScope, templateId) {
    const templates = await list();
    const template = templateId == null || templateId === ''
      ? templates.find(item => item.formScope === formScope && item.isDefault)
      : templates.find(item => item.formScope === formScope && item.id === Number(templateId));
    if (!template) throw createHttpError(400, '해당 구분의 템플릿을 선택하세요.', 'FORM_TEMPLATE_INVALID');
    return template.id;
  }

  async function save(payload = {}, id = null) {
    const templates = await list();
    const existing = id ? templates.find(item => item.id === Number(id)) : null;
    if (id && !existing) throw createHttpError(404, '템플릿을 찾을 수 없습니다.');
    const formScope = existing?.formScope || payload.formScope;
    const name = String(payload.name || '').trim();
    if (!['application', 'documents'].includes(formScope) || !name || name.length > 100) {
      throw createHttpError(400, '템플릿 이름을 100자 이내로 입력하세요.');
    }
    if (templates.some(item => item.formScope === formScope && item.id !== existing?.id && item.name === name)) {
      throw createHttpError(409, '같은 이름의 템플릿이 있습니다.');
    }
    const sourceId = !existing && payload.copyFromId ? await resolve(formScope, payload.copyFromId) : null;
    const connection = await getPool().getConnection();
    let templateId = existing?.id;
    try {
      await connection.beginTransaction();
      if (existing) await connection.query('UPDATE app_form_template SET name = ? WHERE id = ?', [name, existing.id]);
      else {
        const [result] = await connection.query('INSERT INTO app_form_template (form_scope, name) VALUES (?, ?)', [formScope, name]);
        templateId = Number(result.insertId);
        if (sourceId) {
          const [fields] = await connection.query(`SELECT * FROM app_form WHERE form_scope = ?
            AND COALESCE(template_id, (SELECT id FROM app_form_template WHERE form_scope = ? AND is_default = 1)) = ?`, [formScope, formScope, sourceId]);
          for (const field of fields) {
            await connection.query(`INSERT INTO app_form (template_id, form_scope, field_key, question_text, question_description,
              question_text_en, question_description_en, input_type, system_field_key, options_json, required, active, sort_order)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [templateId, formScope, `field-${randomUUID()}`, field.question_text, field.question_description,
              field.question_text_en, field.question_description_en, field.input_type, field.system_field_key,
              field.options_json, field.required, field.active, field.sort_order]);
          }
        }
      }
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
    return { id: templateId, templates: await list() };
  }

  async function remove(id) {
    const template = (await list()).find(item => item.id === Number(id));
    if (!template) throw createHttpError(404, '템플릿을 찾을 수 없습니다.');
    if (template.isDefault) throw createHttpError(409, '기본 템플릿은 삭제할 수 없습니다.');
    const [used] = await query(`SELECT
      (SELECT COUNT(*) FROM app_schedule WHERE application_template_id = ? OR document_template_id = ?) +
      (SELECT COUNT(*) FROM app_subm s JOIN app_form f ON f.field_key = s.field_key WHERE f.template_id = ?) +
      (SELECT COUNT(*) FROM app_document_status ds JOIN app_form f ON f.id = ds.field_id WHERE f.template_id = ?) AS count`, [id, id, id, id]);
    if (Number(used.count)) throw createHttpError(409, '일정 또는 접수 이력에서 사용 중인 템플릿은 삭제할 수 없습니다.');
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('DELETE FROM app_form WHERE template_id = ?', [id]);
      await connection.query('DELETE FROM app_form_template WHERE id = ?', [id]);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
    return { templates: await list() };
  }
  return { list, resolve, save, remove };
}

module.exports = { createFormTemplateService };
