(function (scope, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else scope.AdmitCardApplicantArchive = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const commonTokens = ['수험번호', '접수번호', '이름', '모집시기', '전형', '모집단위'];
  const fileTokens = [...commonTokens, '서류명', '파일명'];
  const defaults = Object.freeze({ groupByApplicant: false, documents: true, photos: true,
    folderPattern: '{수험번호}', documentPattern: '{수험번호}_{서류명}', photoPattern: '{수험번호}' });

  function validatePattern(pattern, folder = false) {
    if (typeof pattern !== 'string' || !pattern.trim() || pattern.length > 160) throw new Error('이름 규칙은 1~160자로 입력하세요.');
    const allowed = folder ? commonTokens : fileTokens;
    const rest = pattern.replace(/\{([^{}]+)\}/g, (_, token) => {
      if (!allowed.includes(token)) throw new Error(`사용할 수 없는 항목입니다: {${token}}`);
      return '';
    });
    if (/[{}]/.test(rest)) throw new Error('이름 규칙의 중괄호를 확인하세요.');
    if (/[<>:"/\\|?*\x00-\x1f]/.test(rest)) throw new Error('이름 규칙에 파일명으로 사용할 수 없는 문자가 있습니다.');
    return pattern.trim();
  }

  function normalizeOptions(value = {}) {
    const options = { ...defaults, ...value };
    for (const key of ['groupByApplicant', 'documents', 'photos']) {
      if (typeof options[key] !== 'boolean') throw new Error('다운로드 선택값이 올바르지 않습니다.');
    }
    if (!options.documents && !options.photos) throw new Error('제출서류 또는 수험생사진을 선택하세요.');
    for (const [enabled, key, folder] of [[options.groupByApplicant, 'folderPattern', true], [options.documents, 'documentPattern', false], [options.photos, 'photoPattern', false]]) {
      options[key] = enabled ? validatePattern(options[key], folder) : defaults[key];
    }
    return options;
  }

  function cleanName(value, fallback = '파일') {
    let name = String(value || '').normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '_').replace(/[. ]+$/g, '').trim();
    name = Array.from(name).slice(0, 90).join('').replace(/[. ]+$/g, '');
    if (!name || /^\.+$/.test(name)) name = fallback;
    if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name)) name = '_' + name;
    return name;
  }

  function formatName(pattern, submission = {}, file = {}) {
    const fileName = String(file.fileName || '').split(/[\\/]/).pop();
    const values = {
      수험번호: submission.promotedExamineeNo || `접수-${String(submission.id || '').padStart(6, '0')}`,
      접수번호: String(submission.id || ''), 이름: submission.name || '이름없음',
      모집시기: submission.track || '', 전형: submission.admission || '', 모집단위: submission.unit || '',
      서류명: file.label || '서류', 파일명: fileName.replace(/\.[^.]+$/, '') || '파일',
    };
    return cleanName(pattern.replace(/\{([^{}]+)\}/g, (_, token) => values[token] ?? ''));
  }

  return Object.freeze({ commonTokens, fileTokens, defaults, validatePattern, normalizeOptions, cleanName, formatName });
});
