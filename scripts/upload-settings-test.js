const assert = require('node:assert/strict');
const { normalizeFileUploadSettings, isAllowedUploadExtension } = require('../shared/domain/applicant-form');
const { createApplicantAttachmentStorage } = require('../server/modules/applications/attachment-storage');
const { validateAnswers } = require('../server/modules/applications/signup-questions');
const config = normalizeFileUploadSettings({ fileNamePattern: '{수험번호}_증빙_{원본파일명}', allowedExtensions: '.PDF, jpg, PDF, .PNG' });
assert.deepEqual(config.allowedExtensions, ['pdf', 'jpg', 'png']);
for (const fileNamePattern of ['../file', '{없는항목}', '{ID}', '{수험번호', 'a'.repeat(121)]) {
  assert.throws(() => normalizeFileUploadSettings({ fileNamePattern }));
}
assert.throws(() => normalizeFileUploadSettings({ allowedExtensions: '*.pdf' }));
assert(isAllowedUploadExtension('test.PDF', ['pdf']));
assert(!isAllowedUploadExtension('test.pdf.exe', ['pdf']));
assert(!isAllowedUploadExtension('test', ['pdf']));
const storage = createApplicantAttachmentStorage();
const upload = { base64: Buffer.from('%PDF-1.7\nfixture').toString('base64'), fileName: '../original.PDF', mimeType: 'application/pdf' };
assert.equal(storage.buildStoredApplicantFileRecord('1234', '증명서', 'proof', upload).fileName, '1234_증명서.PDF');
const record = storage.buildStoredApplicantFileRecord('1234', '증명서', 'proof', upload, config);
assert.match(record.fileName, /^1234_증빙_original_[a-f0-9]{16}\.PDF$/);
assert.equal(storage.buildStoredApplicantFileRecord('1234', '증명서', 'proof', upload, config).fileName, record.fileName);
assert.notEqual(storage.buildStoredApplicantFileRecord('1234', '증명서', 'other', upload, config).fileName, record.fileName);
assert.notEqual(storage.buildStoredApplicantFileRecord('5678', '증명서', 'proof', upload, config).fileName, record.fileName);
assert.throws(() => storage.buildStoredApplicantFileRecord('1234', '증명서', 'proof', { ...upload, fileName: 'fake.pdf.exe' }, config));
const question = { key: 'proof', label: '증명서', inputType: 'file', ...normalizeFileUploadSettings({ fileNamePattern: '{ID}_{질문제목}', allowedExtensions: 'pdf,txt' }, 'signup') };
assert.equal(validateAnswers([question], { proof: upload }, { loginId: 'member01' }).proof.fileName, 'member01_증명서.pdf');
assert.equal(validateAnswers([question], { proof: { fileName: 'readme.txt', base64: Buffer.from('hello').toString('base64') } }, { loginId: 'member01' }).proof.fileName, 'member01_증명서.txt');
assert.throws(() => validateAnswers([question], { proof: { ...upload, fileName: 'image.png' } }, { loginId: 'member01' }));
console.log('PASS: upload settings normalization, template safety, extension checks, collision protection and signup filenames');
