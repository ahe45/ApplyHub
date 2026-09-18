const { isChoiceInputType, normalizeChoiceTranslations, validateMultiSelectAnswer } = require('../../../shared/domain/applicant-form');
const { answerTypeOptions, nationalityOptions } = require('../../../shared/domain/applicant-form');
const { normalizeFileUploadSettings, isAllowedUploadExtension, formatUploadFileBaseName } = require('../../../shared/domain/applicant-form');
const coreQuestions = [
  { key: 'email', label: '이메일', inputType: 'email' },
  { key: 'password', label: '비밀번호', inputType: 'password' },
  { key: 'name', label: '이름', inputType: 'text' },
];
const coreKeys = new Set(coreQuestions.map(q => q.key));
function normalizeQuestions(value, legacy) {
  const source = (Array.isArray(value.questions) ? value.questions : [
    ...coreQuestions.map(q => ({ ...q, required: true })),
    ...['birth', 'phone'].filter(key => legacy[key] !== 'hidden').map(key => ({ key, label: key === 'birth' ? '생년월일' : '연락처', inputType: key === 'birth' ? 'birthdate' : 'phone', required: legacy[key] === 'required' })),
    ...legacy.extraFields,
  ]).filter(q => q.key !== 'loginId');
  if (source.length > 50) throw new Error('질문은 최대 50개까지 등록할 수 있습니다.');
  const questions = source.map(q => {
    const key = String(q.key || '');
    if (!/^[a-zA-Z0-9_-]{1,60}$/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('질문 식별자가 올바르지 않습니다.');
    const core = coreQuestions.find(item => item.key === key);
    const inputType = String(q.inputType || 'text');
    if (core ? inputType !== core.inputType : ![...answerTypeOptions.map(t => t.key), 'textarea', 'time'].includes(inputType)) throw new Error('지원하지 않는 답변 종류입니다.');
    const label = String(q.label || q.questionText || '').trim().slice(0, 100);
    if (!label) throw new Error('질문 제목을 입력하세요.');
    const options = [...new Set((Array.isArray(q.options) ? q.options : []).map(v => String(v).trim().slice(0, 200)).filter(Boolean))];
    if (options.length > 100 || (isChoiceInputType(inputType) && !options.length)) throw new Error('선택지를 1~100개 등록하세요.');
    const customOptionLabel = String(q.customOptionLabel || '').trim();
    if (customOptionLabel && !options.includes(customOptionLabel)) throw new Error('직접 입력 항목을 선택지에 추가하세요.');
    return { key, label, labelEn: String(q.labelEn || q.questionTextEn || '').trim().slice(0, 100),
      description: String(q.description || q.questionDescription || '').slice(0, 1000),
      descriptionEn: String(q.descriptionEn || q.questionDescriptionEn || '').trim().slice(0, 1000), inputType,
      ...(inputType === 'file' ? normalizeFileUploadSettings(q, 'signup') : {}),
      optionsEn: isChoiceInputType(inputType) ? normalizeChoiceTranslations(options, q.optionsEn) : {},
      required: core ? true : q.required === true, options: isChoiceInputType(inputType) ? options : [], customOptionLabel: isChoiceInputType(inputType) ? customOptionLabel : '' };
  });
  if (new Set(questions.map(q => q.key)).size !== questions.length) throw new Error('질문 식별자가 중복됩니다.');
  for (const core of coreQuestions) if (!questions.some(q => q.key === core.key)) throw new Error('비밀번호·이름·이메일은 삭제할 수 없습니다.');
  // Core fields always occupy the first three positions; custom fields retain their order.
  return [...coreQuestions.map(core => questions.find(q => q.key === core.key)), ...questions.filter(q => !coreKeys.has(q.key))];
}
function validateAnswers(questions, payload, context = {}) {
  const profile = {};
  let totalBytes = 0;
  for (const q of questions.filter(q => !coreKeys.has(q.key))) {
    try {
    const raw = payload[q.key];
    if (['photo', 'file'].includes(q.inputType)) {
      if (!raw?.base64) { if (q.required) throw new Error(`${q.label} 파일을 업로드하세요.`); continue; }
      if (typeof raw.base64 !== 'string' || raw.base64.length > 7 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw.base64)) throw new Error('파일 형식이 올바르지 않습니다.');
      const bytes = Buffer.from(raw.base64, 'base64');
      totalBytes += bytes.length;
      if (bytes.length > 5 * 1024 * 1024 || totalBytes > 8 * 1024 * 1024) throw new Error('파일당 5MB, 전체 8MB 이하로 업로드하세요.');
      const detectedMime = bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? 'image/jpeg' : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : bytes.subarray(0, 5).toString() === '%PDF-' ? 'application/pdf' : '';
      const allowed = q.allowedExtensions?.length ? q.allowedExtensions : ['pdf', 'jpg', 'jpeg', 'png'];
      const original = String(raw.fileName || '첨부파일').split(/[\\/]/).pop();
      const extension = original.match(/\.([^.]+)$/)?.[1]?.toLowerCase() || '';
      if (q.inputType === 'file' && !isAllowedUploadExtension(original, allowed)) throw new Error(`${q.label}: ${allowed.join(', ')} 파일만 업로드할 수 있습니다.`);
      if ((q.inputType === 'photo' && !detectedMime.startsWith('image/')) || (q.inputType === 'file' && ['pdf', 'jpg', 'jpeg', 'png'].includes(extension) && detectedMime !== ({ pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' })[extension])) throw new Error('사진은 JPG·PNG, 서류는 확장자에 맞는 실제 파일을 사용하세요.');
      const fileName = q.inputType === 'file' && q.fileNamePattern
        ? `${formatUploadFileBaseName(q.fileNamePattern, { ID: context.loginId, '질문제목': q.label, '원본파일명': original.replace(/\.[^.]+$/, '') })}.${extension}`
        : original.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 180);
      profile[q.key] = { base64: bytes.toString('base64'), mimeType: detectedMime || 'application/octet-stream', fileName };
      continue;
    }
    if (q.inputType === 'multiselect') { profile[q.key] = validateMultiSelectAnswer(q, raw, q.label); continue; }
    const rawText = String(raw ?? '').trim();
    const value = q.inputType === 'phone' ? rawText.replace(/\D+/g, '') : rawText;
    if (q.required && !value) throw new Error(`${q.label} 항목을 입력하세요.`);
    if (value.length > (q.inputType === 'textarea' ? 10000 : 500)) throw new Error(`${q.label} 답변이 너무 깁니다.`);
    if (value && ['date', 'birthdate'].includes(q.inputType) && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value || (q.inputType === 'birthdate' && Date.parse(value) > Date.now()))) throw new Error('올바른 날짜를 입력하세요.');
    if (q.inputType === 'phone' && rawText && (!value || !/^\d{1,20}$/.test(value))) throw new Error('연락처는 20자리 이하의 숫자로 입력하세요.');
    if (value && q.inputType === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('올바른 시간을 입력하세요.');
    if (value && q.inputType === 'nationality' && !nationalityOptions.some(n => n.code === value)) throw new Error('국적 목록에서 선택하세요.');
    if (value && q.inputType === 'select' && !q.options.includes(value) && !(q.customOptionLabel && value.startsWith(q.customOptionLabel + ': ') && value.slice(q.customOptionLabel.length + 2).trim())) throw new Error(`${q.label} 선택지를 확인하세요.`);
    profile[q.key] = value;
    } catch (error) { error.fieldKey = `profile.${q.key}`; throw error; }
  }
  return profile;
}
module.exports = { normalizeQuestions, validateAnswers, coreKeys };
