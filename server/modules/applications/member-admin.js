const { getMemberBirthDate } = require('../../../shared/domain/applicant-form');

function createMemberAdminService({ query, getSettings, createHttpError }) {
  const parse = value => { try { return JSON.parse(value || '{}'); } catch { return {}; } };
  async function list({ search = '', status = '', page = 1 } = {}) {
    const keyword = String(search).trim().slice(0, 100).toLowerCase();
    const pageNumber = Math.max(1, Math.min(1000000, Math.floor(Number(page) || 1)));
    const where = ['1=1'], params = [];
    if (keyword) { where.push('(LOCATE(?, LOWER(m.name)) > 0 OR LOCATE(?, LOWER(m.email)) > 0)'); params.push(keyword, keyword); }
    if (status === 'submitted') where.push('a.id IS NOT NULL');
    if (status === 'unsubmitted') where.push('a.id IS NULL');
    const join = 'FROM applicant_members m LEFT JOIN app_meta a ON a.member_id = m.id';
    const [counts] = await query(`SELECT COUNT(*) AS total ${join} WHERE ${where.join(' AND ')}`, params);
    const settings = await getSettings();
    const birthKey = settings.questions.find(q => q.inputType === 'birthdate')?.key || 'birth';
    const phoneKey = settings.questions.find(q => q.inputType === 'phone')?.key || 'phone';
    const currentPage = Math.min(pageNumber, Math.max(1, Math.ceil(Number(counts.total) / 20)));
    const rows = await query(`SELECT m.id, m.name, m.email, m.email_verified AS emailVerified, m.created_at AS createdAt,
      COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(m.profile_json, '$.birth')), ''), JSON_UNQUOTE(JSON_EXTRACT(m.profile_json, ?))) AS birth,
      JSON_UNQUOTE(JSON_EXTRACT(m.profile_json, ?)) AS phone,
      a.id AS submissionId, a.examinee_no AS examineeNo
      ${join} WHERE ${where.join(' AND ')} ORDER BY m.id DESC LIMIT 20 OFFSET ?`,
    [`$.${JSON.stringify(birthKey)}`, `$.${JSON.stringify(phoneKey)}`, ...params, (currentPage - 1) * 20]);
    return { rows, total: Number(counts.total), page: currentPage, pageSize: 20 };
  }
  async function getRow(id) {
    const [row] = await query(`SELECT m.id, m.name, m.email, m.email_verified AS emailVerified, m.created_at AS createdAt,
      m.profile_json, m.consent_json, a.id AS submissionId, a.examinee_no AS examineeNo
      FROM applicant_members m LEFT JOIN app_meta a ON a.member_id = m.id WHERE m.id = ?`, [id]);
    if (!row) throw createHttpError(404, '회원을 찾을 수 없습니다.');
    return row;
  }
  async function detail(id) {
    const row = await getRow(id), settings = await getSettings(), profile = parse(row.profile_json);
    const answers = Object.entries(profile).map(([key, value]) => {
      const question = settings.questions.find(q => q.key === key);
      const label = question?.label || ({ birth: '생년월일', phone: '연락처', address: '주소' })[key] || '이전 가입 항목';
      if (value && typeof value === 'object') return { key, label, fileName: String(value.fileName || '첨부파일'), isFile: !!value.base64 };
      return { key, label, inputType: question?.inputType || (key === 'birth' ? 'birthdate' : 'text'), value: String(value ?? '') };
    });
    const consents = parse(row.consent_json);
    return { id: row.id, name: row.name, email: row.email, emailVerified: !!row.emailVerified, createdAt: row.createdAt,
      birth: getMemberBirthDate({ profile }, settings.questions), submissionId: row.submissionId, examineeNo: row.examineeNo,
      answers, terms: Array.isArray(consents.terms) ? consents.terms.map(t => ({ title: String(t.title || ''), text: String(t.text || ''), agreed: t.agreed === true, required: t.required === true })) : [],
    };
  }
  async function attachment(id, key) {
    const row = await getRow(id), profile = parse(row.profile_json);
    const file = Object.hasOwn(profile, key) ? profile[key] : null;
    if (!file || typeof file.base64 !== 'string') throw createHttpError(404, '첨부파일을 찾을 수 없습니다.');
    return { fileName: String(file.fileName || '첨부파일'), buffer: Buffer.from(file.base64, 'base64') };
  }
  return { list, detail, attachment };
}
module.exports = { createMemberAdminService };
