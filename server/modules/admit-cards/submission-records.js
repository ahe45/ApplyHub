const { normalizeExamineeRecord } = require('./record');
const { createExamineeWorkbookService } = require('./workbook');
// Ticket records come directly from submitted applications.
function createSubmissionTicketDataService({ createHttpError, query, getApplicantService }) {
  const { buildPrintHistoryExportBuffer } = createExamineeWorkbookService({createHttpError});
  async function getExaminees() {
    const service = getApplicantService();
    const submissions = await service.getApplicantSubmissions();
    return Promise.all(submissions.map(async submission => normalizeExamineeRecord(
      await service.buildApplicantAdmitCardRecordFromSubmission(submission, {includePhoto: false}),
    )));
  }
  async function getExamineesByNos(values = []) {
    const numbers = [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
    if (!numbers.length) return [];
    const service = getApplicantService();
    const records = new Map();
    for (let offset = 0; offset < numbers.length; offset += 200) {
      const chunk = numbers.slice(offset, offset + 200);
      const matches = await query('SELECT id FROM app_meta WHERE examinee_no IN (' + chunk.map(() => '?').join(',') + ')', chunk);
      const submissions = await service.getApplicantSubmissionsByIds(matches.map(row => row.id));
      for (const submission of submissions) {
        const number = String(submission.examineeNo || '');
        if (records.has(number)) throw createHttpError(409, '접수 이력에 중복된 수험번호가 있습니다.');
        records.set(number, normalizeExamineeRecord(await service.buildApplicantAdmitCardRecordFromSubmission(submission)));
      }
    }
    return numbers.map(number => {
      if (!records.has(number)) throw createHttpError(404, '해당 수험번호의 접수 이력을 찾을 수 없습니다.');
      return records.get(number);
    });
  }
  async function getExamineeByNo(number) {
    const [record] = await getExamineesByNos([number]);
    if (!record) throw createHttpError(400, '수험번호가 필요합니다.');
    return record;
  }
  async function getPrintHistory() {
    const rows = await query("SELECT id AS historyId, examinee_no AS examineeNo, DATE_FORMAT(printed_at, '%Y-%m-%d %H:%i:%s') AS printedAt FROM print_log ORDER BY printed_at DESC, id DESC");
    const records = new Map((await getExaminees()).map(row => [row.examineeNo, row]));
    return rows.map(row => normalizeExamineeRecord({...records.get(row.examineeNo), ...row}));
  }
  return Object.freeze({getExaminees, getExamineeByNo, getExamineesByNos, getPrintHistory, buildPrintHistoryExportBuffer});
}
module.exports = {createSubmissionTicketDataService};
