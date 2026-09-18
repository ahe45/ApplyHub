const { randomBytes, randomInt, createHash, timingSafeEqual } = require('node:crypto');
const digest = value => createHash('sha256').update(value).digest('hex');
function createMemberRecovery({ query, getPool, fail, throttle, normalizeEmail, passwordHash, sendEmail }) {
  async function initialize() {
    await query(`CREATE TABLE IF NOT EXISTS applicant_member_recovery (
      id CHAR(48) PRIMARY KEY, member_id BIGINT UNSIGNED NULL, email VARCHAR(255) NOT NULL,
      purpose VARCHAR(16) NOT NULL, code_hash CHAR(64) NOT NULL, attempts INT NOT NULL DEFAULT 0,
      expires_at DATETIME NOT NULL, KEY (member_id), KEY (expires_at)
    )`);
  }
  function purpose(value) {
    if (value !== 'password') fail(400, '이메일로 로그인할 수 있습니다. 비밀번호 재설정을 이용하세요.');
    return value;
  }
  async function request(payload, ip) {
    const mode = purpose(payload.purpose), email = normalizeEmail(payload.email);
    const name = String(payload.name || '').trim();
    if (!name || name.length > 100) fail(400, '가입한 이름과 이메일을 입력하세요.');
    throttle(`recovery-ip:${ip}`, 10);
    throttle(`recovery-mail:${email}`, 1, 60000);
    const [member] = await query('SELECT id FROM applicant_members WHERE name = ? AND email = ?', [name, email]);
    const id = randomBytes(24).toString('hex'), code = String(randomInt(100000, 1000000));
    // Send the same verification message even when details do not match, so this
    // endpoint (including delivery failures) does not disclose account existence.
    await sendEmail({ applicantName: '이용자', email, codeValue: code, expiresAt: new Date(Date.now() + 600000), purposeLabel: '비밀번호 재설정', language: payload.language === 'en' ? 'en' : 'ko' });
    await query('DELETE FROM applicant_member_recovery WHERE email = ? OR expires_at <= NOW()', [email]);
    await query('INSERT INTO applicant_member_recovery (id, member_id, email, purpose, code_hash, expires_at) VALUES (?,?,?,?,?,DATE_ADD(NOW(), INTERVAL 10 MINUTE))', [id, member?.id || null, email, mode, digest(id + code)]);
    return { recoveryId: id, expiresInSeconds: 600, message: '인증번호를 발송했습니다. 가입 정보가 일치해야 계정을 찾을 수 있습니다.' };
  }
  async function complete(payload, ip) {
    throttle(`recovery-verify:${ip}`, 30);
    const mode = purpose(payload.purpose), id = String(payload.recoveryId || ''), code = String(payload.code || '');
    if (!/^[a-f0-9]{48}$/.test(id) || code.length > 20) fail(400, '인증 정보를 확인하세요.');
    let hash;
    if (mode === 'password') {
      const password = String(payload.password || '');
      if (password.length < 4 || password.length > 20 || password !== payload.passwordConfirm) fail(400, '새 비밀번호를 4~20자로 입력하고 확인 값을 일치시켜 주세요.');
      hash = await passwordHash(password);
    }
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [[proof]] = await connection.query('SELECT * FROM applicant_member_recovery WHERE id = ? AND expires_at > NOW() FOR UPDATE', [id]);
      if (!proof || proof.attempts >= 5) fail(400, '인증번호가 만료되었거나 사용할 수 없습니다. 다시 요청하세요.');
      await connection.query('UPDATE applicant_member_recovery SET attempts = attempts + 1 WHERE id = ?', [id]);
      const matches = timingSafeEqual(Buffer.from(proof.code_hash, 'hex'), Buffer.from(digest(id + code), 'hex'));
      if (!matches || proof.purpose !== mode || !proof.member_id) {
        await connection.commit();
        fail(400, '가입 정보 또는 인증번호가 일치하지 않습니다.');
      }
      const [[member]] = await connection.query('SELECT id, login_id FROM applicant_members WHERE id = ? AND email = ? FOR UPDATE', [proof.member_id, proof.email]);
      if (!member) fail(400, '계정 정보를 확인할 수 없습니다. 다시 요청하세요.');
      if (mode === 'password') {
        await connection.query('UPDATE applicant_members SET password_hash = ?, email_verified = 1 WHERE id = ?', [hash, member.id]);
        await connection.query('DELETE FROM applicant_member_sessions WHERE member_id = ?', [member.id]);
        await connection.query('DELETE FROM applicant_member_recovery WHERE member_id = ?', [member.id]);
      } else await connection.query('DELETE FROM applicant_member_recovery WHERE id = ?', [id]);
      await connection.commit();
      return { ok: true };
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  return { initialize, request, complete };
}
module.exports = { createMemberRecovery };
