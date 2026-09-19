const { createMemberFileStorage } = require('./member-files');
const { randomBytes, randomInt, createHash, scrypt, timingSafeEqual } = require("crypto");
const { promisify } = require("util");
const { normalizeQuestions, validateAnswers } = require('./signup-questions');
const { getMemberBirthDate } = require('../../../shared/domain/applicant-form');
const { createMemberRecovery } = require('./member-recovery');
const { normalizeSignupTerms, activeSignupTerms, signupTermsVersion, buildSignupConsent } = require('./signup-terms');
const deriveKey = promisify(scrypt);
const digest = (value) => createHash("sha256").update(String(value)).digest("hex");
const defaultSettings = {
  emailVerification: true,
  birth: "required",
  phone: "required",
  termsEnabled: false,
  termsTitle: "회원가입 약관",
  termsText: "",
  extraFields: [],
};

function normalizeSignupSettings(value = {}) {
  const mode = (key) => ["hidden", "optional", "required"].includes(value[key]) ? value[key] : defaultSettings[key];
  const extraFields = (Array.isArray(value.extraFields) ? value.extraFields : []).slice(0, 20).map((field, index) => ({
    key: /^[a-zA-Z0-9_-]{1,60}$/.test(field.key || "") ? field.key : `extra_${index + 1}`,
    label: String(field.label || "").trim().slice(0, 100),
    required: field.required === true,
    inputType: field.inputType || 'text',
    description: field.description || '',
    labelEn: field.labelEn || '',
    descriptionEn: field.descriptionEn || '',
    options: field.options || [],
    optionsEn: field.optionsEn || {},
    customOptionLabel: field.customOptionLabel || '',
  })).filter((field) => field.label);
  if (new Set(extraFields.map((field) => field.key)).size !== extraFields.length) throw new Error("추가 항목의 식별자가 중복됩니다.");
  if (extraFields.some((field) => ["birth", "phone", "__proto__", "constructor", "prototype"].includes(field.key))) throw new Error("추가 항목의 식별자는 기본 항목과 다르게 지정하세요.");
  const questions = normalizeQuestions(value, { birth: mode('birth'), phone: mode('phone'), extraFields });
  const questionMode = key => { const q = questions.find(q => q.key === key); return q ? (q.required ? 'required' : 'optional') : 'hidden'; };
  const terms = normalizeSignupTerms(value);
  const firstTerm = terms.find(t => t.enabled) || terms[0];
  return {
    emailVerification: true,
    birth: questionMode('birth'), phone: questionMode('phone'),
    terms,
    termsEnabled: terms.some(t => t.enabled),
    termsTitle: firstTerm?.title || defaultSettings.termsTitle,
    termsText: firstTerm?.text || '',
    questions,
    extraFields: questions.filter(q => !['loginId', 'password', 'name', 'email', 'birth', 'phone'].includes(q.key)),
  };
}

function createApplicantMembershipService({ query, getPool, createHttpError, sendEmail, rootDir = process.cwd(), env = {} }) {
  const memberFiles = createMemberFileStorage(rootDir);
  const showDevelopmentCode = String(env.NODE_ENV || '').trim().toLowerCase() === 'development'
    && String(env.APPLICANT_SIGNUP_CODE_PREVIEW || '').trim().toLowerCase() === 'true';
  const fail = (status, message, fieldKey = '') => {
    const error = createHttpError(status, message, "APPLICANT_MEMBER_ERROR");
    if (fieldKey) error.fieldKey = fieldKey;
    throw error;
  };
  const cookieName = "admitcard.member";
  const limits = new Map();
  function throttle(key, max = 10, duration = 600000) {
    const now = Date.now();
    for (const [k, v] of limits) if (v.expires <= now) limits.delete(k);
    const entry = limits.get(key) || { count: 0, expires: now + duration };
    if (++entry.count > max || limits.size > 10000) fail(429, "요청이 많습니다. 잠시 후 다시 시도하세요.");
    limits.set(key, entry);
  }
  async function initialize() {
    await recovery.initialize();
    await query(`CREATE TABLE IF NOT EXISTS applicant_members (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      login_id VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL, email VARCHAR(255) NOT NULL UNIQUE,
      email_verified TINYINT NOT NULL DEFAULT 0, profile_json MEDIUMTEXT NOT NULL,
      consent_json MEDIUMTEXT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const [loginColumn] = await query("SHOW COLUMNS FROM applicant_members LIKE 'login_id'");
    if (String(loginColumn?.Type || '').toLowerCase() === 'varchar(40)') {
      await query("ALTER TABLE applicant_members MODIFY login_id VARCHAR(255) NOT NULL");
    }
    await query(`CREATE TABLE IF NOT EXISTS applicant_member_sessions (
      token_hash CHAR(64) PRIMARY KEY, member_id BIGINT UNSIGNED NOT NULL,
      expires_at DATETIME NOT NULL, KEY (member_id), KEY (expires_at)
    )`);
    await query(`CREATE TABLE IF NOT EXISTS applicant_member_verifications (
      id CHAR(48) PRIMARY KEY, email VARCHAR(255) NOT NULL, code_hash CHAR(64) NOT NULL,
      attempts INT NOT NULL DEFAULT 0, verified TINYINT NOT NULL DEFAULT 0,
      expires_at DATETIME NOT NULL, KEY (email), KEY (expires_at)
    )`);
    const columns = await query("SHOW COLUMNS FROM app_meta LIKE 'member_id'");
    if (!columns.length) await query("ALTER TABLE app_meta ADD COLUMN member_id BIGINT UNSIGNED NULL, ADD UNIQUE KEY uniq_app_meta_member (member_id)");
    await memberFiles.migrate(query);
  }
  async function getSettings() {
    const [row] = await query("SELECT setting_value AS value FROM system_set WHERE setting_key = 'applicantSignupSettings'");
    return normalizeSignupSettings(row ? JSON.parse(row.value) : defaultSettings);
  }
  async function saveSettings(payload) {
    let settings;
    try { settings = normalizeSignupSettings(payload); } catch (error) { fail(400, error.message); }
    if (settings.termsEnabled && !settings.termsText) fail(400, "약관 동의를 사용하려면 약관 내용을 입력하세요.");
    await query("INSERT INTO system_set (setting_key, setting_value) VALUES ('applicantSignupSettings', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)", [JSON.stringify(settings)]);
    return settings;
  }
  function normalizeEmail(value) {
    const email = String(value || "").trim().toLowerCase();
    if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, "올바른 이메일을 입력하세요.");
    return email;
  }
  async function sendCode(payload, ip) {
    const email = normalizeEmail(payload.email);
    throttle(`mail-ip:${ip}`, 15);
    const [existing] = await query("SELECT email FROM applicant_members WHERE email = ? UNION ALL SELECT login_id AS email FROM accounts WHERE login_id = ? LIMIT 1", [email, email]);
    if (existing) fail(409, "이미 사용 중인 이메일입니다.", 'email');
    throttle(`mail:${email}`, 1, 10000);
    const id = randomBytes(24).toString("hex");
    const code = String(randomInt(100000, 1000000));
    if (!showDevelopmentCode) {
      await sendEmail({ applicantName: "회원가입 신청자", email, codeValue: code, expiresAt: new Date(Date.now() + 600000), language: payload.language === 'en' ? 'en' : 'ko' });
    }
    await query("DELETE FROM applicant_member_verifications WHERE email = ? OR expires_at <= NOW()", [email]);
    await query("INSERT INTO applicant_member_verifications (id,email,code_hash,expires_at) VALUES (?,?,?,DATE_ADD(NOW(), INTERVAL 10 MINUTE))", [id, email, digest(id + code)]);
    return { verificationId: id, expiresInSeconds: 600, ...(showDevelopmentCode ? { debugCode: code } : {}) };
  }
  async function verifyCode(payload, ip) {
    throttle(`verify:${ip}`, 30);
    const email = normalizeEmail(payload.email);
    const id = String(payload.verificationId || "");
    const result = await query("UPDATE applicant_member_verifications SET attempts = attempts + 1 WHERE id = ? AND email = ? AND attempts < 5 AND verified = 0 AND expires_at > NOW()", [id, email]);
    if (!result.affectedRows) fail(400, "인증번호가 만료되었거나 시도 횟수를 초과했습니다. 다시 요청하세요.");
    const result2 = await query("UPDATE applicant_member_verifications SET verified = 1 WHERE id = ? AND email = ? AND code_hash = ? AND expires_at > NOW()", [id, email, digest(id + String(payload.code || ""))]);
    if (!result2.affectedRows) fail(400, "인증번호가 일치하지 않습니다.");
    return { verified: true };
  }
  async function passwordHash(password, salt = randomBytes(16).toString("hex")) {
    return `scrypt$${salt}$${(await deriveKey(password, salt, 64)).toString("hex")}`;
  }
  const publicMember = (row, settings = {}) => {
    const member = { id: Number(row.id), loginId: row.email, name: row.name, email: row.email,
      emailVerified: Boolean(row.email_verified), profile: Object.fromEntries(Object.entries(JSON.parse(row.profile_json || "{}")).map(([key,value]) => [key, value && typeof value === 'object' && !Array.isArray(value) ? { fileName: value.fileName, mimeType: value.mimeType, size: value.size, hasFile: !!(value.storageKey || value.base64) } : value])) };
    return { ...member, birthDate: getMemberBirthDate(member, settings.questions) };
  };
  function cookie(request, response, token = "") {
    const secure = request.socket?.encrypted || String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
    response.setHeader("Set-Cookie", [...[].concat(response.getHeader("Set-Cookie") || []), `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? 43200 : 0}${secure ? "; Secure" : ""}`]);
  }
  function sessionToken(request) {
    return String(request.headers.cookie || "").split(";").map((v) => v.trim()).find((v) => v.startsWith(cookieName + "="))?.slice(cookieName.length + 1) || "";
  }
  async function session(request) {
    const token = sessionToken(request);
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const [row] = await query("SELECT m.id,m.name,m.email,m.email_verified,m.profile_json FROM applicant_members m JOIN applicant_member_sessions s ON s.member_id = m.id WHERE s.token_hash = ? AND s.expires_at > NOW() AND m.email_verified = 1", [digest(token)]);
    return row ? publicMember(row, await getSettings()) : null;
  }
  async function requireMember(request) {
    const member = await session(request);
    if (!member) fail(401, "지원자 로그인이 필요합니다.");
    return member;
  }
  async function register(payload, ip, { request, response } = {}) {
    throttle(`signup:${ip}`, 10);
    const settings = await getSettings();
    const password = String(payload.password || "");
    const name = String(payload.name || "").trim();
    const email = normalizeEmail(payload.email);
    const loginId = email;
    const [staff] = await query("SELECT login_id FROM accounts WHERE login_id = ?", [loginId]);
    if (staff) fail(409, "이미 사용 중인 이메일입니다.", 'email');
    if (password.length < 4 || password.length > 20) fail(400, "비밀번호는 4~20자로 입력하세요.", 'password');
    if (payload.passwordConfirm !== password) fail(400, "비밀번호 확인이 일치하지 않습니다.", 'passwordConfirm');
    if (!name || name.length > 100) fail(400, "이름을 100자 이내로 입력하세요.", 'name');
    let consent;
    try { consent = buildSignupConsent(settings, payload); }
    catch (error) { fail(400, error.message); }
    let profile;
    try { profile = validateAnswers(settings.questions, payload.profile || {}, { loginId }); }
    catch (error) { fail(400, error.message, error.fieldKey); }
    const hash = await passwordHash(password);
    const token = request && response ? randomBytes(32).toString('hex') : '';
    const storedFiles = await memberFiles.store(profile);
    profile = storedFiles.profile;
    let connection, committed = false;
    try {
      connection = await getPool().getConnection();
      await connection.beginTransaction();
      let verified = false;
      {
        const [proofs] = await connection.query("SELECT id FROM applicant_member_verifications WHERE id = ? AND email = ? AND verified = 1 AND expires_at > NOW() FOR UPDATE", [String(payload.verificationId || ""), email]);
        if (!proofs.length) fail(400, "이메일 인증을 완료하세요.", 'code');
        verified = true;
        await connection.query("DELETE FROM applicant_member_verifications WHERE id = ?", [proofs[0].id]);
      }
      const [created] = await connection.query("INSERT INTO applicant_members (login_id,password_hash,name,email,email_verified,profile_json,consent_json) VALUES (?,?,?,?,?,?,?)", [loginId, hash, name, email, verified ? 1 : 0, JSON.stringify(profile), JSON.stringify(consent)]);
      if (verified) {
        const [legacy] = await connection.query("SELECT m.id FROM app_meta m WHERE m.member_id IS NULL AND EXISTS (SELECT 1 FROM app_subm s WHERE s.id = m.id AND s.applicant_name = ? AND s.email = ?) ORDER BY m.id DESC LIMIT 1 FOR UPDATE", [name, email]);
        if (legacy.length) await connection.query("UPDATE app_meta SET member_id = ? WHERE id = ? AND member_id IS NULL", [created.insertId, legacy[0].id]);
      }
      if (token) {
        await connection.query('DELETE FROM applicant_member_sessions WHERE expires_at <= NOW() OR token_hash = ?', [digest(sessionToken(request))]);
        await connection.query('INSERT INTO applicant_member_sessions (token_hash,member_id,expires_at) VALUES (?,?,DATE_ADD(NOW(), INTERVAL 12 HOUR))', [digest(token), created.insertId]);
      }
      await connection.commit();
      committed = true;
      if (token) cookie(request, response, token);
      return { ok: true, ...(token ? { member: publicMember({ id: created.insertId, email, name, email_verified: 1, profile_json: JSON.stringify(profile) }, settings), accountType: 'applicant', redirectTo: '/applicant' } : {}) };
    } catch (error) {
      if (!committed) {
        if (connection) await connection.rollback();
        await storedFiles.rollback();
      }
      if (error.code === "ER_DUP_ENTRY") fail(409, "이미 사용 중인 이메일입니다.", 'email');
      throw error;
    } finally { connection?.release(); }
  }
  async function login(payload, request, response) {
    throttle(`login:${request.socket?.remoteAddress}`, 30);
    const id = String(payload.email || payload.loginId || "").trim().toLowerCase();
    throttle(`login-id:${id}`, 15);
    const password = String(payload.password || "");
    if (password.length > 100 || id.length > 255) fail(401, "이메일 또는 비밀번호가 올바르지 않습니다.");
    // Legacy login_id values remain intact; all member authentication uses email.
    const [row] = await query("SELECT * FROM applicant_members WHERE email = ?", [id]);
    const stored = row?.password_hash || `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;
    const computed = await passwordHash(password, stored.split("$")[1]);
    if (!row || computed.length !== stored.length || !timingSafeEqual(Buffer.from(computed), Buffer.from(stored))) fail(401, "이메일 또는 비밀번호가 올바르지 않습니다.");
    if (!row.email_verified) fail(403, "이메일 인증이 필요합니다. 비밀번호 재설정에서 이메일 인증을 완료해 주세요.");
    const token = randomBytes(32).toString("hex");
    await query("DELETE FROM applicant_member_sessions WHERE expires_at <= NOW() OR token_hash = ?", [digest(sessionToken(request))]);
    const inserted = await query("INSERT INTO applicant_member_sessions (token_hash,member_id,expires_at) SELECT ?,id,DATE_ADD(NOW(), INTERVAL 12 HOUR) FROM applicant_members WHERE id = ? AND password_hash = ? AND email_verified = 1", [digest(token), row.id, stored]);
    if (!inserted.affectedRows) fail(401, "비밀번호가 변경되었습니다. 다시 로그인하세요.");
    cookie(request, response, token);
    return { member: publicMember(row, await getSettings()) };
  }
  async function logout(request, response) {
    await query("DELETE FROM applicant_member_sessions WHERE token_hash = ?", [digest(sessionToken(request))]);
    cookie(request, response);
    return { ok: true };
  }
  async function publicSettings() {
    const settings = await getSettings();
    const terms = activeSignupTerms(settings);
    return { ...settings, terms, termsTitle: terms[0]?.title || '', termsText: terms[0]?.text || '', termsVersion: signupTermsVersion(settings) };
  }
  const recovery = createMemberRecovery({ query, getPool, fail, throttle, normalizeEmail, passwordHash, sendEmail });
  return { readMemberFile: memberFiles.read, initialize, getSettings, saveSettings, publicSettings, sendCode, verifyCode, register, login, logout, session, requireMember, requestRecovery: recovery.request, completeRecovery: recovery.complete };
}
module.exports = { createApplicantMembershipService, normalizeSignupSettings };
