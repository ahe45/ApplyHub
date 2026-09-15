const assert = require('node:assert/strict');
const { normalizeSignupSettings } = require('../server/modules/applications/membership');
const { validateAnswers } = require('../server/modules/applications/signup-questions');
const { formatApplicantBirthDate } = require('../client/features/applicant-public/rendering-helpers');
const { applicationAnswerTypeOptions, answerTypeOptions, getMemberBirthDate } = require('../shared/domain/applicant-form');
assert(!applicationAnswerTypeOptions.some(option => ['birthdate', 'email', 'password', 'name'].includes(option.key)));
assert(answerTypeOptions.some(option => option.key === 'birthdate'));
assert.equal(getMemberBirthDate({ profile: { birth: '2000-01-02' } }), '2000-01-02');
assert.equal(getMemberBirthDate({ profile: { custom_birth: '2001-03-04' } }, [{ key: 'custom_birth', inputType: 'birthdate' }]), '2001-03-04');
assert.equal(getMemberBirthDate({ profile: {} }), '');
assert.equal(formatApplicantBirthDate('2000-02-09'), '2000년 02월 09일');
assert.equal(formatApplicantBirthDate('2000-02-29'), '2000년 02월 29일');
for (const invalid of ['', null, '2001-02-29', 'not-a-date', '2000-13-01']) assert.equal(formatApplicantBirthDate(invalid), '-');
const base = normalizeSignupSettings({ birth: 'optional', phone: 'hidden', extraFields: [{ key: 'school', label: '출신학교', required: true }] });
const migrated = normalizeSignupSettings({ emailVerification: false, questions: [{ key: 'loginId', label: '기존 ID', inputType: 'text' }, ...base.questions] });
assert.equal(migrated.emailVerification, true);
assert(!migrated.questions.some(q => q.key === 'loginId'));
assert.deepEqual(migrated.questions, base.questions);
const reordered = normalizeSignupSettings({ questions: [...base.questions].reverse() });
assert.deepEqual(reordered.questions.slice(0, 3).map(q => q.key), ['email', 'password', 'name']);
assert.deepEqual(reordered.questions.slice(3).map(q => q.key), ['school', 'birth']);
assert.deepEqual(reordered.questions.slice(0, 3), base.questions.slice(0, 3), 'Fixing order must preserve core field settings');
assert.equal(base.questions.find(q => q.key === 'school').inputType, 'text');
assert.equal(base.questions.find(q => q.key === 'birth').required, false);
assert(!base.questions.some(q => q.key === 'phone'));
assert.throws(() => normalizeSignupSettings({ questions: base.questions.filter(q => q.key !== 'email') }), /삭제할 수 없습니다/);
const locked = normalizeSignupSettings({ questions: base.questions.map(q => ({ ...q, required: false })) });
assert(locked.questions.filter(q => ['loginId', 'password', 'name', 'email'].includes(q.key)).every(q => q.required));
assert.throws(() => normalizeSignupSettings({ questions: [...base.questions, base.questions[0]] }), /중복/);
const questions = [
  { key: 'choice', inputType: 'select', options: ['일반', '기타'], customOptionLabel: '기타', label: '학교', required: true },
  { key: 'country', inputType: 'nationality', label: '국적' },
  { key: 'birth', inputType: 'birthdate', label: '생년월일' },
  { key: 'phone', inputType: 'phone', label: '연락처' },
  { key: 'time', inputType: 'time', label: '시간' },
  { key: 'file', inputType: 'file', label: '서류' },
  { key: 'photo', inputType: 'photo', label: '사진' },
];
const pdf = { fileName: '../증명서.pdf', base64: Buffer.from('%PDF-1.7\nfixture').toString('base64') };
const png = { fileName: '사진.png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==' };
const answers = { choice: '기타: 대안학교', country: 'KR', birth: '2000-02-29', phone: '010-1234-5678', time: '09:30', file: pdf, photo: png };
const result = validateAnswers(questions, answers);
assert.equal(result.phone, '01012345678');
assert.throws(() => validateAnswers(questions, { ...answers, phone: '1'.repeat(21) }), /연락처/);
assert.equal(result.file.mimeType, 'application/pdf');
assert(!result.file.fileName.includes('/'));
assert.equal(result.photo.mimeType, 'image/png');
for (const [key, value] of [['birth', '2001-02-29'], ['birth', '2999-01-01'], ['country', 'not-country'], ['time', '25:00'], ['phone', 'abc'], ['choice', '없는 값'], ['choice', ''], ['choice', '기타: '], ['photo', pdf], ['file', { base64: Buffer.from('<script>bad</script>').toString('base64') }]]) {
  assert.throws(() => validateAnswers(questions, { ...answers, [key]: value }), error => error.fieldKey === `profile.${key}`, `${key} must reject malformed answer with its field key`);
}
assert.throws(() => validateAnswers(questions, { ...answers, file: { base64: Buffer.alloc(6 * 1024 * 1024).toString('base64') } }), /파일/);
console.log('PASS: legacy migration, core protection, question types, answer validation and file limits');
