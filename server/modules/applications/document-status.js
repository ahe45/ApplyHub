const STATUS_LABELS = Object.freeze({ submitted: '제출완료', missing: '미제출', incomplete: '미비' });

function createDocumentStatusService({ query, getPool, getFields, getFieldsForSubmission, getTemplateContext, getSubmission, getSubmissions, createHttpError }) {
  const filterKeys = ['track', 'admission', 'series', 'unit', 'major'];
  function documentsFor(submission, fields, statuses) {
    return fields.map(field => {
      const answer = submission.answerItems?.find(item => item.fieldKey === field.fieldKey)?.value;
      const hasFile = answer?.hasFile === true;
      const status = statuses.get(Number(field.id)) || (hasFile ? 'submitted' : 'missing');
      return { fieldId: field.id, fieldKey: field.fieldKey, questionText: field.questionText,
        questionTextEn: field.questionTextEn, required: field.required, hasFile,
        fileName: hasFile ? String(answer.fileName || '') : '', status, statusLabel: STATUS_LABELS[status] };
    });
  }
  async function detail(submissionId) {
    const submission = await getSubmission(submissionId);
    const fields = (await getFieldsForSubmission(submission)).filter(field => field.inputType === 'file');
    const saved = await query('SELECT field_id AS fieldId, status FROM app_document_status WHERE submission_id = ?', [submission.id]);
    const statuses = new Map(saved.map(row => [Number(row.fieldId), row.status]));
    return {
      id: submission.id, name: submission.name, email: submission.email, examineeNo: submission.examineeNo,
      documents: documentsFor(submission, fields, statuses),
    };
  }

  async function list(filters = {}) {
    const text = key => String(filters[key] || '').trim().slice(0, 100);
    const keyword = text('search').toLowerCase();
    const [submissions, configuredFields] = await Promise.all([getSubmissions(), getFields({ activeOnly: true, formScope: 'documents' })]);
    const allFields = configuredFields.filter(field => field.inputType === 'file');
    const matches = (row, excludedKey = '') => filterKeys.every(key => key === excludedKey || !text(key) || row[key] === text(key));
    const filterOptions = Object.fromEntries(filterKeys.map(key => [key,
      [...new Set(submissions.filter(row => matches(row, key)).map(row => row[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko', { numeric: true })),
    ]));
    const filtered = submissions.filter(row => matches(row)
      && (!text('examineeNo') || row.examineeNo.includes(text('examineeNo')))
      && (!text('examineeName') || row.name.includes(text('examineeName')))
      && (!keyword || [row.name, row.email, row.examineeNo].some(value => value.toLowerCase().includes(keyword))));
    const templateContext = await getTemplateContext();
    const relevantFields = new Map(await Promise.all(filtered.map(async submission => [submission.id, await getFieldsForSubmission(submission, allFields, templateContext)])));
    const documentCount = [...relevantFields.values()].reduce((maximum, fields) => Math.max(maximum, fields.length), 0);
    const total = filtered.length;
    const currentPage = Math.min(Math.max(1, Math.floor(Number(filters.page) || 1)), Math.max(1, Math.ceil(total / 20)));
    const visible = filtered.slice((currentPage - 1) * 20, currentPage * 20);
    const saved = visible.length ? await query(`SELECT submission_id AS submissionId, field_id AS fieldId, status FROM app_document_status WHERE submission_id IN (${visible.map(() => '?').join(',')})`, visible.map(row => row.id)) : [];
    const rows = visible.map(submission => ({
      id: submission.id, name: submission.name, email: submission.email, examineeNo: submission.examineeNo,
      ...Object.fromEntries(filterKeys.map(key => [key, submission[key]])),
      documents: documentsFor(submission, relevantFields.get(submission.id) || [], new Map(saved.filter(item => Number(item.submissionId) === submission.id).map(item => [Number(item.fieldId), item.status]))),
    }));
    return { rows, total, page: currentPage, pageSize: 20, filterOptions,
      documents: Array.from({ length: documentCount }, (_, index) => ({ index, label: `서류${index + 1}` })) };
  }

  async function save(submissionId, payload, accountId) {
    const changes = payload?.documents;
    if (!Array.isArray(changes) || !changes.length || changes.length > 500
      || changes.some(item => !Number.isSafeInteger(item?.fieldId) || !Object.hasOwn(STATUS_LABELS, item?.status))
      || new Set(changes.map(item => item.fieldId)).size !== changes.length) {
      throw createHttpError(400, '서류별 상태를 확인하세요.');
    }
    const applicableFields = await getFieldsForSubmission(await getSubmission(submissionId));
    const applicableIds = new Set(applicableFields.map(field => field.id));
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [submissions] = await connection.query('SELECT id FROM app_meta WHERE id = ? FOR UPDATE', [submissionId]);
      if (!submissions.length) throw createHttpError(404, '접수 이력을 찾을 수 없습니다.');
      const [fields] = await connection.query("SELECT id FROM app_form WHERE form_scope = 'documents' AND input_type = 'file' AND active = 1 FOR UPDATE");
      const allowed = new Set(fields.filter(field => applicableIds.has(Number(field.id))).map(field => Number(field.id)));
      if (changes.some(item => !allowed.has(item.fieldId))) throw createHttpError(400, '현재 서류제출에 설정된 서류 항목만 변경할 수 있습니다.');
      for (const item of changes) {
        await connection.query(`INSERT INTO app_document_status (submission_id, field_id, status, updated_by)
          VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP`,
        [submissionId, item.fieldId, item.status, accountId]);
      }
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
    return detail(submissionId);
  }
  return { list, detail, save };
}

module.exports = { createDocumentStatusService };
