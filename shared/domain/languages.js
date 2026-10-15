(function (scope, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else scope.ApplyHubLanguages = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const definitions = Object.freeze([
    Object.freeze({ code: 'ko', label: '한국어', name: '한국어' }),
    Object.freeze({ code: 'en', label: 'English', name: '영어' }),
    Object.freeze({ code: 'mn', label: 'Монгол', name: '몽골어' }),
  ]);
  return Object.freeze({ definitions, normalize: value => definitions.some(item => item.code === value) ? value : 'ko' });
});
