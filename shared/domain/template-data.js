(function (scope, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else scope.ApplyHubTemplateData = api;
})(globalThis, () => {
  const objectSourceKeys = Object.freeze({
    'candidate.examNo': 'examineeNo', 'candidate.name': 'name', 'candidate.birthDate': 'birth',
    'candidate.admissionRoundName': 'track', 'candidate.admissionTypeName': 'admission',
    'candidate.seriesName': 'series', 'candidate.departmentName': 'unit', 'candidate.majorName': 'major',
  });
  const allowedKeys = new Set(['examineeNo', 'name', 'birth', 'track', 'admission', 'series', 'unit', 'major', 'currentDate']);
  function dynamicDefinition(raw, label = '', inputType = 'text') {
    const match = /^@\{(회원가입|원서접수):([a-zA-Z0-9_-]{1,64})\}$/.exec(String(raw || ''));
    if (!match || ['password', '__proto__', 'constructor', 'prototype'].includes(match[2])) return null;
    const group = match[1] === '회원가입' ? 'signup' : 'application';
    const key = `${group}.${match[2]}`;
    return { token: match[0], editorToken: `#${match[1]}:${match[2]}`, aliases: [`${match[1]}:${match[2]}`], label: label || match[2], key, examineeKey: key, dataKey: key, group, inputType,
      type: ['date', 'birthdate'].includes(inputType) ? 'date' : 'text' };
  }
  function getTagValue(record, definition) {
    const key = definition?.examineeKey || definition?.dataKey || definition?.key || '';
    const match = /^(signup|application)\.([a-zA-Z0-9_-]{1,64})$/.exec(key);
    if (match) return String(record?.[match[1] === 'signup' ? 'signupAnswers' : 'applicationAnswers']?.[match[2]] ?? '');
    return String(record?.[key] ?? '');
  }
  function textValue(value) {
    if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(', ');
    if (value && typeof value === 'object') return String(value.fileName || '');
    return String(value ?? '');
  }
  function getObjectValue(record, source = 'examineeNo') {
    const key = objectSourceKeys[source] || source;
    if (/^(signup|application)\./.test(key)) return getTagValue(record, { examineeKey: key }).trim() || '-';
    if (key === 'currentDate' && !record?.currentDate) return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    return allowedKeys.has(key) ? String(record?.[key] ?? '').trim() || '-' : '-';
  }
  function formatDate(value, format = '') {
    const text = String(value || '');
    if (!format || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const [year, month, day] = text.split('-');
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const tokens = { YYYY: year, YY: year.slice(2), MM: month, M: String(Number(month)), DD: day, D: String(Number(day)), ddd: weekdays[date.getUTCDay()], dddd: weekdays[date.getUTCDay()] + '요일' };
    return String(format).slice(0, 60).replace(/YYYY|dddd|ddd|YY|MM|DD|M|D/g, token => tokens[token]);
  }
  return Object.freeze({ getObjectValue, getTagValue, dynamicDefinition, textValue, formatDate });
});
