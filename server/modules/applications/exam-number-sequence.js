const { createHash } = require('node:crypto');

async function ensureExamNumberSchema(query) {
  const indexes = await query('SHOW INDEX FROM app_meta');
  if (!indexes.some(row => row.Key_name === 'uniq_app_meta_examinee_no')) {
    const duplicates = await query("SELECT examinee_no FROM app_meta WHERE examinee_no IS NOT NULL AND TRIM(examinee_no) <> '' GROUP BY examinee_no HAVING COUNT(*) > 1 LIMIT 1");
    if (duplicates.length) {
      throw new Error('중복된 수험번호가 있어 번호 유일성 제약을 적용할 수 없습니다. app_meta의 중복 번호를 확인하세요. 기존 데이터는 삭제하지 않았습니다.');
    }
    await query("UPDATE app_meta SET examinee_no = NULL WHERE TRIM(examinee_no) = ''");
    await query('ALTER TABLE app_meta ADD UNIQUE KEY uniq_app_meta_examinee_no (examinee_no)');
  }
  await query(`CREATE TABLE IF NOT EXISTS app_exam_sequence (
    group_key CHAR(64) NOT NULL PRIMARY KEY,
    next_value BIGINT UNSIGNED NOT NULL,
    initialized TINYINT NOT NULL DEFAULT 0
  )`);
}

const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// One locked counter per rendered number shape, shared by every server process.
async function allocateExamNumber(connection, { parts, minDigits = 1, maxDigits = 16, start = 1, build, createHttpError }) {
  const key = createHash('sha256').update(JSON.stringify([parts, minDigits, maxDigits])).digest('hex');
  await connection.query('INSERT INTO app_exam_sequence (group_key, next_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE group_key = VALUES(group_key)', [key, start]);
  const [[counter]] = await connection.query('SELECT next_value, initialized FROM app_exam_sequence WHERE group_key = ? FOR UPDATE', [key]);
  let next = Math.max(start, Number(counter.next_value));
  const expression = '^' + parts.map(escapeRegex).join(`[0-9]{${minDigits},${maxDigits}}`) + '$';
  async function advancePastExisting() {
    // Executed once for an existing number group, not once per historical number.
    const [[row]] = await connection.query(`SELECT MAX(CAST(SUBSTRING(examinee_no, ?, (CHAR_LENGTH(examinee_no) - ?) / ?) AS UNSIGNED)) AS last_value
      FROM app_meta WHERE examinee_no REGEXP ?`, [parts[0].length + 1, parts.join('').length, parts.length - 1, expression]);
    const last = Number(row.last_value || 0);
    if (!Number.isSafeInteger(last)) throw createHttpError(409, '기존 수험번호 순번이 지원 범위를 초과합니다.');
    next = Math.max(next, last + 1);
  }
  if (!counter.initialized) await advancePastExisting();
  for (let attempt = 0; attempt < 20; attempt++) {
    if (!Number.isSafeInteger(next)) throw createHttpError(409, '수험번호 순번 범위를 초과했습니다.');
    const candidate = build(next);
    if (candidate.length > 30) throw createHttpError(400, '수험번호는 30자 이하여야 합니다.');
    const [existing] = await connection.query('SELECT id FROM app_meta WHERE examinee_no = ? LIMIT 1', [candidate]);
    if (!existing.length) {
      await connection.query('UPDATE app_exam_sequence SET next_value = ?, initialized = 1 WHERE group_key = ?', [next + 1, key]);
      return candidate;
    }
    next++;
    await advancePastExisting();
  }
  throw createHttpError(409, '수험번호 규칙이 기존 번호와 충돌합니다. 번호 규칙을 확인하세요.');
}

module.exports = { ensureExamNumberSchema, allocateExamNumber };
