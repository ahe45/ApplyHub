const assert = require('node:assert/strict');
const { normalizeSignupSettings } = require('../server/modules/applications/membership');
const { normalizeSignupTerms, activeSignupTerms, signupTermsVersion, buildSignupConsent } = require('../server/modules/applications/signup-terms');
const legacy = normalizeSignupSettings({ termsEnabled: true, termsTitle: '기존 약관', termsText: '원문' });
assert.deepEqual(legacy.terms, [{ id: 'legacy-terms', title: '기존 약관', text: '원문', required: true, enabled: true }]);
const settings = normalizeSignupSettings({ terms: [
  { id: 'required', title: '필수 약관', text: '필수 원문', required: true, enabled: true },
  { id: 'optional', title: '선택 약관', text: '선택 원문', required: false, enabled: true },
  { id: 'hidden', title: '비공개 약관', text: '비공개 원문', required: true, enabled: false },
] });
assert.equal(activeSignupTerms(settings).length, 2);
const termsVersion = signupTermsVersion(settings);
assert.throws(() => buildSignupConsent(settings, { termsVersion, termConsents: [] }), /필수 약관/);
assert.throws(() => buildSignupConsent(settings, { termsVersion, agreed: true }), /필수 약관/);
assert.throws(() => buildSignupConsent(settings, { termsVersion: 'stale', termConsents: [{ id: 'required', agreed: true }] }), /변경/);
assert.throws(() => buildSignupConsent(settings, { termsVersion, termConsents: [{ id: 'hidden', agreed: true }] }), /동의 정보/);
assert.throws(() => buildSignupConsent(settings, { termsVersion, termConsents: [{ id: 'required', agreed: true }, { id: 'required', agreed: true }] }), /동의 정보/);
const now = new Date('2026-09-14T00:00:00Z');
const consent = buildSignupConsent(settings, { termsVersion, termConsents: [{ id: 'required', agreed: true }] }, now);
assert.equal(consent.terms[0].text, '필수 원문');
assert.equal(consent.terms[0].agreedAt, now.toISOString());
assert.equal(consent.terms[1].agreed, false);
assert.equal(consent.terms[1].agreedAt, null);
assert.notEqual(signupTermsVersion({ terms: settings.terms.map(t => ({ ...t, text: t.text + ' 변경' })) }), termsVersion);
assert.equal(consent.terms[0].text, '필수 원문');
assert.throws(() => normalizeSignupTerms({ terms: [settings.terms[0], settings.terms[0]] }), /중복/);
assert.throws(() => normalizeSignupTerms({ terms: [{ id: 'x', title: '제목', text: '', enabled: true }] }), /내용/);
assert.throws(() => normalizeSignupTerms({ terms: Array.from({ length: 21 }, (_, i) => ({ id: String(i), title: '제목', text: '내용' })) }), /20개/);
assert.deepEqual(buildSignupConsent({ terms: [] }, {}).terms, []);
console.log('PASS: legacy terms migration, required/optional consent, hidden terms, version binding and retained snapshots');
