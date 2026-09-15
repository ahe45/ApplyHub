const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');
const { createApplicantVerificationEmailSender, getVerificationSmtpOptions } = require('../../applications/verification-mailer');

const SETTING_KEY = 'verificationEmailSettings';
function createEmailSettingsService({ query, rootDir, env = process.env, createHttpError, mailer = nodemailer, getSchoolName = async () => '' }) {
  const keyPath = path.join(rootDir, '.private', 'smtp.key');
  let cachedSender, cachedFingerprint;
  function key(create = false) {
    if (create && !fs.existsSync(keyPath)) {
      fs.mkdirSync(path.dirname(keyPath), {recursive: true, mode: 0o700});
      try { fs.writeFileSync(keyPath, crypto.randomBytes(32), {flag: 'wx', mode: 0o600}); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    const value = fs.readFileSync(keyPath);
    if (value.length !== 32) throw new Error('Invalid key');
    return value;
  }
  function encrypt(password) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key(true), iv);
    const data = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
    return {iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64')};
  }
  function decrypt(value) {
    try {
      const cipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(value.iv, 'base64'));
      cipher.setAuthTag(Buffer.from(value.tag, 'base64'));
      return Buffer.concat([cipher.update(Buffer.from(value.data, 'base64')), cipher.final()]).toString('utf8');
    } catch {
      throw createHttpError(503, '저장된 메일 비밀번호를 읽을 수 없습니다. 시스템 설정에서 비밀번호를 다시 입력해 주세요.', 'EMAIL_PASSWORD_UNAVAILABLE');
    }
  }
  async function read() {
    const rows = await query('SELECT setting_value FROM system_set WHERE setting_key = ?', [SETTING_KEY]);
    if (rows.length) {
      try { return {...JSON.parse(rows[0].setting_value), source: 'system'}; }
      catch { throw createHttpError(503, '이메일 설정을 읽을 수 없습니다.', 'EMAIL_SETTINGS_INVALID'); }
    }
    return {host: env.SMTP_HOST || '', port: Number(env.SMTP_PORT || 465),
      security: (env.SMTP_SECURE == null || env.SMTP_SECURE === '' ? Number(env.SMTP_PORT || 465) === 465 : String(env.SMTP_SECURE) === 'true') ? 'tls' : 'starttls',
      user: env.SMTP_USER || '', from: env.SMTP_FROM || '', fromName: env.SMTP_FROM_NAME || '원서접수시스템', source: 'environment'};
  }
  function passwordOf(settings) {
    return settings.source === 'environment' ? String(env.SMTP_PASS || '') : (settings.passwordEncrypted ? decrypt(settings.passwordEncrypted) : '');
  }
  function publicSettings(settings) {
    let hasPassword = false, passwordNeedsReset = false;
    try { hasPassword = Boolean(passwordOf(settings)); } catch { passwordNeedsReset = true; }
    const {host, port, security, user, from, fromName, source} = settings;
    return {host, port, security, user, from, fromName, source, hasPassword, passwordNeedsReset};
  }
  async function getEmailSettings() { return publicSettings(await read()); }
  async function normalize(payload = {}) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw createHttpError(400, '메일 설정의 입력 값을 확인하세요.', 'EMAIL_SETTINGS_INVALID');
    const settings = {};
    for (const field of ['host', 'user', 'from', 'fromName']) {
      if (typeof payload[field] !== 'string' || payload[field].length > 255 || /[\r\n\0]/.test(payload[field])) {
        throw createHttpError(400, '메일 설정의 입력 값을 확인하세요.', 'EMAIL_SETTINGS_INVALID');
      }
      settings[field] = payload[field].trim();
    }
    settings.port = Number(payload.port);
    settings.security = payload.security;
    if (!settings.host || /[\s/:?#@]/.test(settings.host) || !Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65535 || !['tls', 'starttls'].includes(settings.security)) {
      throw createHttpError(400, '메일 서버 주소, 포트, 보안 방식을 확인하세요.', 'EMAIL_SETTINGS_INVALID');
    }
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(settings.from) || !settings.fromName || !settings.user) {
      throw createHttpError(400, '계정, 발신 이메일과 발신자 이름을 입력하세요.', 'EMAIL_SETTINGS_INVALID');
    }
    if (payload.password != null && (typeof payload.password !== 'string' || payload.password.length > 4096)) {
      throw createHttpError(400, '메일 비밀번호를 확인하세요.', 'EMAIL_SETTINGS_INVALID');
    }
    settings.password = payload.password || passwordOf(await read());
    if (!settings.password) throw createHttpError(400, '메일 비밀번호를 입력하세요.', 'EMAIL_PASSWORD_REQUIRED');
    return settings;
  }
  function asEnv(settings, password) {
    return {...env, SMTP_HOST: settings.host, SMTP_PORT: String(settings.port), SMTP_SECURE: String(settings.security === 'tls'),
      SMTP_USER: settings.user, SMTP_PASS: password, SMTP_FROM: settings.from, SMTP_FROM_NAME: settings.fromName,
      SMTP_TLS_REJECT_UNAUTHORIZED: 'true'};
  }
  async function updateEmailSettings(payload) {
    const {password, ...settings} = await normalize(payload);
    let passwordEncrypted;
    try { passwordEncrypted = encrypt(password); }
    catch { throw createHttpError(500, '메일 비밀번호를 안전하게 저장하지 못했습니다. 서버 저장 권한을 확인하세요.', 'EMAIL_SETTINGS_SAVE_FAILED'); }
    await query('INSERT INTO system_set (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
      [SETTING_KEY, JSON.stringify({...settings, passwordEncrypted})]);
    cachedSender = null;
    cachedFingerprint = null;
    return publicSettings({...settings, passwordEncrypted, source: 'system'});
  }
  async function checkEmailSettings(payload) {
    const settings = payload == null ? await read() : await normalize(payload);
    const options = getVerificationSmtpOptions(asEnv(settings, settings.password ?? passwordOf(settings)));
    if (!options) throw createHttpError(400, '메일 발송 설정을 먼저 입력하세요.', 'EMAIL_SETTINGS_INVALID');
    const transport = mailer.createTransport(options);
    try { await transport.verify(); return {message: '메일 서버 연결 및 계정 인증에 성공했습니다. 발신 주소의 발송 권한은 실제 발송 시 확인됩니다.'}; }
    catch (error) {
      const message = error.code === 'EAUTH' ? '메일 서버가 계정 인증을 거절했습니다. 계정과 비밀번호, 메일 서비스의 SMTP 사용 설정을 확인하세요.'
        : '메일 서버에 연결하지 못했습니다. 서버 주소, 포트, 보안 방식과 네트워크를 확인하세요.';
      throw createHttpError(502, message, error.code === 'EAUTH' ? 'EMAIL_SMTP_AUTH_FAILED' : 'EMAIL_SMTP_CONNECTION_FAILED');
    } finally { transport.close(); }
  }
  async function sendVerificationEmail(message) {
    const settings = await read();
    const effectiveEnv = asEnv(settings, passwordOf(settings));
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify(effectiveEnv)).digest('hex');
    if (!cachedSender || fingerprint !== cachedFingerprint) {
      cachedSender = createApplicantVerificationEmailSender({createHttpError, env: effectiveEnv, mailer});
      cachedFingerprint = fingerprint;
    }
    return cachedSender({...message, schoolName: await getSchoolName()});
  }
  return {getEmailSettings, updateEmailSettings, checkEmailSettings, sendVerificationEmail};
}
module.exports = {createEmailSettingsService};
