const { createHash } = require('node:crypto');

function normalizeSignupTerms(settings = {}) {
  if (settings.terms !== undefined && !Array.isArray(settings.terms)) throw new Error('약관 목록 형식이 올바르지 않습니다.');
  const source = settings.terms ?? (settings.termsEnabled || String(settings.termsText || '').trim()
    ? [{ id: 'legacy-terms', title: settings.termsTitle || '회원가입 약관', text: settings.termsText || '', required: true, enabled: settings.termsEnabled === true }] : []);
  if (source.length > 20) throw new Error('약관은 최대 20개까지 등록할 수 있습니다.');
  const terms = source.map(term => {
    const id = String(term?.id || ''), title = String(term?.title || '').trim(), text = String(term?.text || '').trim();
    const enabled = term?.enabled !== false;
    if (!/^[a-zA-Z0-9_-]{1,60}$/.test(id)) throw new Error('약관 식별자가 올바르지 않습니다.');
    if (!title || title.length > 100) throw new Error('약관 제목을 100자 이내로 입력하세요.');
    if (text.length > 30000 || (enabled && !text)) throw new Error('사용할 약관 내용을 30,000자 이내로 입력하세요.');
    return { id, title, text, required: term?.required !== false, enabled };
  });
  if (new Set(terms.map(t => t.id)).size !== terms.length) throw new Error('약관 식별자가 중복됩니다.');
  return terms;
}

function activeSignupTerms(settings) { return (settings.terms || []).filter(t => t.enabled); }
function signupTermsVersion(settings) {
  return createHash('sha256').update(JSON.stringify(activeSignupTerms(settings))).digest('hex');
}
function buildSignupConsent(settings, payload, now = new Date()) {
  const terms = activeSignupTerms(settings);
  if (terms.length && payload.termsVersion !== signupTermsVersion(settings)) throw new Error('약관이 변경되었습니다. 화면을 새로고침하고 다시 동의해 주세요.');
  // Support the previous single-term request only for the migrated legacy term.
  const consents = payload.termConsents ?? (terms.length === 1 && terms[0].id === 'legacy-terms' ? [{ id: 'legacy-terms', agreed: payload.agreed === true }] : []);
  if (!Array.isArray(consents) || consents.length > 20) throw new Error('약관 동의 정보를 확인하세요.');
  const ids = consents.map(c => c?.id);
  if (new Set(ids).size !== ids.length || ids.some(id => !terms.some(t => t.id === id))) throw new Error('약관 동의 정보를 확인하세요.');
  const agreedIds = new Set(consents.filter(c => c.agreed === true).map(c => c.id));
  const missing = terms.find(t => t.required && !agreedIds.has(t.id));
  if (missing) throw new Error(`${missing.title} 약관에 동의해 주세요. (필수)`);
  return { version: signupTermsVersion(settings), submittedAt: now.toISOString(), terms: terms.map(term => ({
    id: term.id, title: term.title, text: term.text, required: term.required,
    agreed: agreedIds.has(term.id), agreedAt: agreedIds.has(term.id) ? now.toISOString() : null,
  })) };
}
module.exports = { normalizeSignupTerms, activeSignupTerms, signupTermsVersion, buildSignupConsent };
