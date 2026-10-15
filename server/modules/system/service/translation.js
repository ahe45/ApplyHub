const { definitions } = require('../../../../shared/domain/languages');

const KEEP = /@\{[^{}]+\}|\{\{[^{}]+\}\}|\$\{[^{}]+\}|\{[^{}\r\n]+\}|https?:\/\/[^\s<>"']+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|%(?:\d+\$)?[sdif]/g;
function decodeTranslationText(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return text.replace(/&(?:amp|lt|gt|quot|apos|#(?:x[\da-f]+|\d+));/gi, entity => {
    const name = entity.slice(1, -1).toLowerCase();
    if (named[name]) return named[name];
    const point = name.startsWith('#x') ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : entity;
  });
}
function createTranslationService({ env = process.env, fetchImpl = globalThis.fetch, now = Date.now, query, settings } = {}) {
  const fail = (statusCode, message, errorCode) => Object.assign(new Error(message), { statusCode, errorCode });
  const requests = new Map();
  let running = 0;
  const dailyUsage = new Map();
  const dailyLimit = 15000;
  async function reserveCharacters(count) {
    if (!count) return;
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now()));
    if (query) {
      const key = `googleTranslationCharacters:${day}`;
      await query('INSERT IGNORE INTO system_set (setting_key, setting_value) VALUES (?, ?)', [key, '0']);
      // Reserve before sending; retain reservations on failures because delivery may be uncertain.
      const result = await query('UPDATE system_set SET setting_value = CAST(setting_value AS UNSIGNED) + ? WHERE setting_key = ? AND CAST(setting_value AS UNSIGNED) + ? <= ?', [count, key, count, dailyLimit]);
      if (result.affectedRows === 1) return;
    } else {
      const used = dailyUsage.get(day) || 0;
      if (used + count <= dailyLimit) { dailyUsage.clear(); dailyUsage.set(day, used + count); return; }
    }
    throw fail(429, '무료 범위로 운영하기 위한 하루 번역 한도(15,000자)에 도달했습니다. 내용을 줄이거나 다음 날 다시 시도하세요. 영어·몽골어 번역량은 각각 합산됩니다.', 'TRANSLATION_DAILY_LIMIT');
  }
  async function translate(payload, accountId, signal, keyOverride) {
    if (!Array.isArray(payload?.languages)) throw fail(400, '번역할 언어를 선택하세요.', 'TRANSLATION_LANGUAGE_INVALID');
    const languages = [...new Set(payload?.languages || [])];
    if (!languages.length || languages.length > 4 || languages.some(code => code === 'ko' || !definitions.some(l => l.code === code))) throw fail(400, '번역할 언어를 선택하세요.', 'TRANSLATION_LANGUAGE_INVALID');
    const entries = payload?.entries;
    if (!Array.isArray(entries) || !entries.length || entries.length > 200) throw fail(400, '번역할 한국어 내용을 입력하세요.', 'TRANSLATION_INPUT_INVALID');
    const ids = new Set(); let length = 0;
    const protectedEntries = entries.map(entry => {
      if (!entry || !/^f\d{1,4}$/.test(entry.id) || ids.has(entry.id) || typeof entry.text !== 'string' || !entry.text.trim() || entry.text.length > 30000) throw fail(400, '번역할 내용의 형식이나 길이를 확인하세요.', 'TRANSLATION_INPUT_INVALID');
      ids.add(entry.id); length += entry.text.length;
      const parts = []; let offset = 0;
      for (const match of entry.text.matchAll(KEEP)) {
        parts.push({ text: entry.text.slice(offset, match.index) }, { literal: match[0] });
        offset = match.index + match[0].length;
      }
      parts.push({ text: entry.text.slice(offset) });
      return { id: entry.id, parts };
    });
    if (length > 32000) throw fail(400, '한 번에 번역할 수 있는 내용은 32,000자까지입니다.', 'TRANSLATION_INPUT_TOO_LONG');
    const apiKey = keyOverride ?? (settings ? await settings.getApiKey() : env.GOOGLE_TRANSLATE_API_KEY);
    if (!apiKey) throw fail(503, '슈퍼관리자 메뉴에서 Google 번역 API 키를 설정해주세요.', 'TRANSLATION_NOT_CONFIGURED');
    const time = now();
    for (const [id, times] of requests) if (!times.some(t => time - t < 60000)) requests.delete(id);
    const recent = (requests.get(accountId) || []).filter(t => time - t < 60000);
    if (recent.length >= 12 || running >= 4) throw fail(429, '번역 요청이 많습니다. 잠시 후 다시 시도하세요.', 'TRANSLATION_BUSY');
    requests.set(accountId, [...recent, time]); running++;
    try {
      // Keep tags, URLs and whitespace locally so the provider cannot alter them.
      const segments = [];
      const plans = protectedEntries.map(entry => ({ id: entry.id, parts: entry.parts.flatMap(source => {
        if (source.literal !== undefined) return [source];
        const part = source.text;
        const parts = [];
        for (let offset = 0; offset < part.length;) {
          let end = Math.min(part.length, offset + 5000);
          if (end < part.length && /[\uD800-\uDBFF]/.test(part[end - 1])) end--;
          const chunk = part.slice(offset, end); offset = end;
          if (!chunk.trim()) { parts.push({ literal: chunk }); continue; }
          const [, before, text, after] = chunk.match(/^(\s*)([\s\S]*?)(\s*)$/);
          parts.push({ literal: before }, { index: segments.length }, { literal: after });
          segments.push(text);
        }
        return parts;
      }) }));
      await reserveCharacters(segments.reduce((sum, text) => sum + Array.from(text).length, 0) * languages.length);
      const translations = {};
      for (const code of languages) {
        const target = code;
        const results = [];
        for (let offset = 0; offset < segments.length;) {
          const batch = []; let size = 0;
          while (offset < segments.length && batch.length < 128 && size + segments[offset].length <= 5000) {
            size += segments[offset].length; batch.push(segments[offset++]);
          }
          const response = await fetchImpl('https://translation.googleapis.com/language/translate/v2', {
            method: 'POST', headers: { 'X-goog-api-key': apiKey, 'Content-Type': 'application/json' },
            signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(90000)]) : AbortSignal.timeout(90000),
            body: JSON.stringify({ q: batch, source: 'ko', target, format: 'text', model: 'nmt' }),
          });
          if (!response.ok) {
            let issue; try { issue = (await response.json()).error; } catch {}
            const reasons = issue?.errors?.map(item => item.reason) || [];
            if (reasons.some(reason => ['dailyLimitExceeded', 'quotaExceeded'].includes(reason))) throw fail(503, 'Google Cloud 번역 사용 한도에 도달했습니다. 사용량과 할당량 설정을 확인해주세요.', 'TRANSLATION_QUOTA');
            if (response.status === 429) throw fail(503, '번역 서비스의 요청이 많습니다. 잠시 후 다시 시도하세요.', 'TRANSLATION_RATE_LIMIT');
            if (reasons.includes('userRateLimitExceeded')) throw fail(503, '번역 서비스의 요청이 많습니다. 잠시 후 다시 시도하세요.', 'TRANSLATION_RATE_LIMIT');
            if (response.status === 400 || response.status === 401 || response.status === 403) throw fail(503, 'Google 번역 API 키, API 사용 설정 및 결제 연결을 확인해주세요.', 'TRANSLATION_AUTH');
            throw fail(502, '번역 서비스를 이용할 수 없습니다. 잠시 후 다시 시도하세요.', 'TRANSLATION_PROVIDER_ERROR');
          }
          const data = (await response.json())?.data?.translations;
          if (!Array.isArray(data) || data.length !== batch.length) throw fail(502, '번역 결과가 올바르지 않습니다. 다시 시도하세요.', 'TRANSLATION_RESULT_INVALID');
          for (const item of data) {
            const value = item?.translatedText;
            if (typeof value !== 'string' || !value.trim() || value.length > 60000) throw fail(502, '번역 결과가 올바르지 않습니다. 다시 시도하세요.', 'TRANSLATION_RESULT_INVALID');
            results.push(decodeTranslationText(value));
          }
        }
        translations[code] = Object.fromEntries(plans.map(plan => [plan.id, plan.parts.map(part => part.literal ?? results[part.index]).join('')]));
      }
      return { translations };
    } catch (error) {
      if (error.statusCode) throw error;
      throw fail(502, '번역 서비스 연결이 지연되거나 중단되었습니다. 다시 시도하세요.', 'TRANSLATION_CONNECTION');
    } finally { running--; }
  }
  async function checkSettings(payload, accountId, signal) {
    const apiKey = await settings.resolveApiKey(payload);
    await translate({ languages: ['en', 'mn'], entries: [{ id: 'f0', text: '접수 안내' }] }, accountId, signal, apiKey);
    return { message: 'Google 번역 연결에 성공했습니다. 영어·몽골어 번역을 확인했습니다.' };
  }
  return { translate, getSettings: () => settings.getSettings(), updateSettings: payload => settings.updateSettings(payload), checkSettings, getStoredApiKey: () => settings.getApiKey() };
}
module.exports = { createTranslationService };
