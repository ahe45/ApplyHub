const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SETTING_KEY = 'googleTranslationApiSettings';
function createTranslationSettingsService({ query, rootDir, env = process.env, createHttpError }) {
  const keyPath = path.join(rootDir, '.private', 'translation.key');
  function encryptionKey(create = false) {
    if (create && !fs.existsSync(keyPath)) {
      fs.mkdirSync(path.dirname(keyPath), { recursive: true, mode: 0o700 });
      try { fs.writeFileSync(keyPath, crypto.randomBytes(32), { flag: 'wx', mode: 0o600 }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    const key = fs.readFileSync(keyPath);
    if (key.length !== 32) throw new Error('Invalid encryption key');
    return key;
  }
  async function read() {
    const rows = await query('SELECT setting_value FROM system_set WHERE setting_key = ?', [SETTING_KEY]);
    if (!rows.length) return { source: 'environment' };
    try {
      const value = JSON.parse(rows[0].setting_value);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      return { encrypted: value.encrypted, source: 'system' };
    } catch { throw createHttpError(503, '번역 API 설정을 읽을 수 없습니다.', 'TRANSLATION_SETTINGS_INVALID'); }
  }
  function decrypt(settings) {
    if (settings.source === 'environment') return String(env.GOOGLE_TRANSLATE_API_KEY || '');
    if (!settings.encrypted) return '';
    try {
      const { iv, tag, data } = settings.encrypted;
      const cipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
      cipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([cipher.update(Buffer.from(data, 'base64')), cipher.final()]).toString('utf8');
    } catch { throw createHttpError(503, '저장된 API 키를 읽을 수 없습니다. 슈퍼관리자에서 키를 다시 입력해주세요.', 'TRANSLATION_KEY_UNAVAILABLE'); }
  }
  async function getApiKey() { return decrypt(await read()); }
  async function getSettings() {
    const settings = await read();
    let hasApiKey = false, keyNeedsReset = false;
    try { hasApiKey = Boolean(decrypt(settings)); } catch { keyNeedsReset = true; }
    return { provider: 'google', source: settings.source, hasApiKey, keyNeedsReset };
  }
  async function resolveApiKey(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof payload.apiKey !== 'string') throw createHttpError(400, 'Google API 키를 입력해주세요.', 'TRANSLATION_KEY_INVALID');
    const apiKey = payload.apiKey.trim();
    if (apiKey && !/^[A-Za-z0-9_-]{20,256}$/.test(apiKey)) throw createHttpError(400, 'API 키 형식을 확인해주세요. 공백이나 줄바꿈이 포함될 수 없습니다.', 'TRANSLATION_KEY_INVALID');
    const value = apiKey || await getApiKey();
    if (!value) throw createHttpError(400, 'Google API 키를 입력해주세요.', 'TRANSLATION_KEY_REQUIRED');
    return value;
  }
  async function updateSettings(payload) {
    const apiKey = await resolveApiKey(payload);
    let encrypted;
    try {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(true), iv);
      const data = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
      encrypted = { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
    } catch { throw createHttpError(500, 'API 키를 안전하게 저장하지 못했습니다. 서버 저장 권한을 확인해주세요.', 'TRANSLATION_SETTINGS_SAVE_FAILED'); }
    await query('INSERT INTO system_set (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [SETTING_KEY, JSON.stringify({ encrypted })]);
    return getSettings();
  }
  return { getApiKey, getSettings, updateSettings, resolveApiKey };
}
module.exports = { createTranslationSettingsService };
