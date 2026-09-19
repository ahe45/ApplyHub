const { insertRows } = require('../database/bulk-write');
const STATUS_LABELS = Object.freeze({ submitted: '제출완료', missing: '미제출', incomplete: '미비' });

function createDocumentStatusService({ query, getPool, getFields, getFieldsForSubmission, getTemplateContext, getSubmission, getSubmissions, submissionQuery, createHttpError }) {
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
    const [result, configuredFields, templateContext, selections] = await Promise.all([
      submissionQuery.list(filters, { details: true }), getFields({ activeOnly: true, formScope: 'documents' }), getTemplateContext(), submissionQuery.selections(filters),
    ]);
    const allFields = configuredFields.filter(field => field.inputType === 'file');
    const { rows: visible, total, page: currentPage, filterOptions } = result;
    const relevantFields = new Map(await Promise.all(visible.map(async submission => [submission.id, await getFieldsForSubmission(submission, allFields, templateContext)])));
    let documentCount = 0;
    for (const selection of selections) documentCount = Math.max(documentCount, (await getFieldsForSubmission(selection, allFields, templateContext)).length);
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
      const [fields] = await connection.query("SELECT id FROM app_form WHERE form_scope = 'documents' AND input_type = 'file' AND active = 1 AND id IN (" + changes.map(() => '?').join(',') + ') ORDER BY id FOR UPDATE', changes.map(item => item.fieldId));
      const allowed = new Set(fields.filter(field => applicableIds.has(Number(field.id))).map(field => Number(field.id)));
      if (changes.some(item => !allowed.has(item.fieldId))) throw createHttpError(400, '현재 서류제출에 설정된 서류 항목만 변경할 수 있습니다.');
      await insertRows(connection, 'app_document_status', ['submission_id','field_id','status','updated_by'], changes.map(item => [submissionId,item.fieldId,item.status,accountId]),
        'ON DUPLICATE KEY UPDATE status=VALUES(status), updated_by=VALUES(updated_by), updated_at=CURRENT_TIMESTAMP');
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
    return detail(submissionId);
  }
  return { list, detail, save };
}

module.exports = { createDocumentStatusService };
