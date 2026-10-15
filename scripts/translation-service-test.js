const assert = require('node:assert/strict');
const { createTranslationService } = require('../server/modules/system/service/translation');
const mockTranslationFetch = async (url, options) => {
  assert.equal(url, 'https://translation.googleapis.com/language/translate/v2');
  assert.ok(options.headers['X-goog-api-key']);
  const body = JSON.parse(options.body);
  assert.equal(body.source, 'ko');
  assert.equal(body.model, 'nmt');
  assert.equal(body.format, 'text');
  assert.ok(body.q.length <= 128);
  assert.ok(body.q.reduce((total, text) => total + text.length, 0) <= 5000);
  return { ok: true, json: async () => ({ data: { translations: body.q.map(text => ({ translatedText: body.target.toUpperCase() + ': ' + text })) } }) };
};
async function run() {
  const env = { GOOGLE_TRANSLATE_API_KEY: 'test-only' };
  const service = createTranslationService({ env, fetchImpl: mockTranslationFetch });
  const payload = { languages: ['en', 'mn'], entries: [{ id: 'f0', text: '안녕하세요 @{회원가입:이름} {{name}} {수험번호} ${name} https://example.test/a?x=1&y=2 test@example.test %s' }] };
  const result = await service.translate(payload, 'test');
  assert.equal(result.translations.en.f0, 'EN: ' + payload.entries[0].text);
  assert.equal(result.translations.mn.f0, 'MN: ' + payload.entries[0].text);
  for (const bad of [{ ...payload, languages: 'en' }, { ...payload, languages: ['ko'] }, { ...payload, entries: [{ id: '__proto__', text: 'test' }] }, { ...payload, entries: [{ id: 'f0', text: 'test' }, { id: 'f0', text: 'another' }] }, { ...payload, entries: [{ id: 'f0', text: 'x'.repeat(30001) }] }]) await assert.rejects(() => service.translate(bad, 'test'), e => e.statusCode === 400);
  for (const [status, code, expected] of [[403, 'dailyLimitExceeded', 'TRANSLATION_QUOTA'], [401, 'authError', 'TRANSLATION_AUTH'], [429, 'rateLimitExceeded', 'TRANSLATION_RATE_LIMIT'], [500, 'backendError', 'TRANSLATION_PROVIDER_ERROR']]) {
    const failed = createTranslationService({ env, fetchImpl: async () => ({ ok: false, status, json: async () => ({ error: { code: status, errors: [{ reason: code }] } }) }) });
    await assert.rejects(() => failed.translate(payload, 'test'), e => e.errorCode === expected);
  }
  const invalid = createTranslationService({ env, fetchImpl: async () => ({ ok: true, json: async () => [] }) });
  await assert.rejects(() => invalid.translate(payload, 'test'), e => e.errorCode === 'TRANSLATION_RESULT_INVALID');
  const missing = createTranslationService({ env: {}, fetchImpl: () => { throw Error('Must not contact provider'); } });
  await assert.rejects(() => missing.translate(payload, 'test'), e => e.errorCode === 'TRANSLATION_NOT_CONFIGURED');
  await service.translate({ languages: ['en', 'mn'], entries: [{ id: 'f0', text: '한'.repeat(3000) }] }, 'large');
  const encoded = createTranslationService({ env, fetchImpl: async () => ({ ok: true, json: async () => ({ data: { translations: [{ translatedText: 'Applicant&#39;s &amp; &lt;notice&gt; &#x1F600;' }] } }) }) });
  assert.equal((await encoded.translate({ languages: ['en'], entries: [{ id: 'f0', text: '안내' }] }, 'encoded')).translations.en.f0, "Applicant's & <notice> 😀");
  let calls = 0; let time = Date.UTC(2026, 9, 15, 12);
  const budget = createTranslationService({ env, now: () => time, fetchImpl: async (...args) => { calls++; return mockTranslationFetch(...args); } });
  await budget.translate({ languages: ['en', 'mn'], entries: [{ id: 'f0', text: '한'.repeat(5000) }] }, 'budget1');
  await assert.rejects(() => budget.translate({ languages: ['en', 'mn'], entries: [{ id: 'f0', text: '한'.repeat(3000) }] }, 'budget2'), e => e.errorCode === 'TRANSLATION_DAILY_LIMIT');
  assert.equal(calls, 2, 'Limit rejects the whole request before any provider call');
  time += 86400000;
  await budget.translate({ languages: ['en', 'mn'], entries: [{ id: 'f0', text: '한'.repeat(3000) }] }, 'budget2');
  await service.translate({ languages: ['en'], entries: Array.from({ length: 200 }, (_, i) => ({ id: 'f' + i, text: '안내' })) }, 'batch-count');
  for (let i = 0; i < 11; i++) await service.translate(payload, 'test');
  await assert.rejects(() => service.translate(payload, 'test'), e => e.statusCode === 429);
  console.log('PASS: Google request mapping, batching, protected tags/URLs, validation, quota errors and throttling');
}
if (require.main === module) run().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { mockTranslationFetch };
