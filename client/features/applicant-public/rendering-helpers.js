(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardApplicantPublicRenderingHelpers = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function formatApplicantBirthDate(value) {
    const text = String(value || '').trim();
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    const timestamp = Date.parse(`${text}T00:00:00Z`);
    if (!parts || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== text) return '-';
    return `${parts[1]}년 ${parts[2]}월 ${parts[3]}일`;
  }

  function getDateDayCount(year, month) {
    return Number(year) > 0 && Number(month) >= 1 && Number(month) <= 12 ? new Date(Number(year), Number(month), 0).getDate() : 31;
  }
  function getDateYearOptions(inputType, selectedYear = '') {
    const current = new Date().getFullYear();
    let start = current - (inputType === 'birthdate' ? 120 : 10), end = current + (inputType === 'birthdate' ? 0 : 20);
    if (Number.isInteger(Number(selectedYear)) && Number(selectedYear) > 0) { start = Math.min(start, Number(selectedYear)); end = Math.max(end, Number(selectedYear)); }
    const years = Array.from({ length: end - start + 1 }, (_, index) => String(start + index));
    return inputType === 'birthdate' ? years.reverse() : years;
  }
  function renderDateOptions(values, selected, label) {
    return `<option value="">${escapeHtml(label)}</option>` + values.map(value => `<option value="${escapeAttribute(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('');
  }
  function renderDateSelectControls({ fieldKey, inputType, parts = {}, prefix = 'applicant', label = '', required = false, disabled = false }) {
    const values = { year: getDateYearOptions(inputType, parts.year), month: Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')), day: Array.from({ length: getDateDayCount(parts.year, parts.month) }, (_, i) => String(i + 1).padStart(2, '0')) };
    return `<div class="applicant-public-date-select-grid">${['year', 'month', 'day'].map(part => `<select id="${prefix === 'applicant' ? 'field' : 'member-date'}-${escapeAttribute(fieldKey)}-${part}" data-${prefix}-date-field-key="${escapeAttribute(fieldKey)}" data-${prefix}-date-part="${part}" aria-label="${escapeAttribute(label)} ${({ year: '연도', month: '월', day: '일' })[part]}" ${required ? 'required' : ''} ${disabled ? 'disabled' : ''}>${renderDateOptions(values[part], parts[part], ({year: '연', month: '월', day: '일'})[part])}</select>`).join('')}</div>`;
  }
  function renderNationalityOptions(options, fieldKey, selected, prefix = 'applicant', valueKey = 'label') {
    if (!options.length) return '<div class="applicant-public-nationality-empty">검색 결과가 없습니다.</div>';
    return `<div class="applicant-public-nationality-options">${options.map(option => `<button type="button" class="applicant-public-nationality-option ${selected === option[valueKey] ? 'is-selected' : ''}" data-${prefix}-nationality-field-key="${escapeAttribute(fieldKey)}" data-${prefix}-nationality-value="${escapeAttribute(option[valueKey])}"><strong>${escapeHtml(option.label)}</strong><span>${escapeHtml([option.englishLabel, option.code].filter(Boolean).join(' · '))}</span></button>`).join('')}</div>`;
  }

  function getApplicantHomeActionIconMarkup(iconKey = "") {
    if (iconKey === "apply") {
      return `
        <svg class="button-icon applicant-public-home-action-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="5" y="4" width="14" height="16" rx="2"></rect>
          <path d="M9 4h6"></path>
          <path d="M9 9h6"></path>
          <path d="M12 12v5"></path>
          <path d="M9.5 14.5h5"></path>
        </svg>
      `;
    }

    if (iconKey === "summary") {
      return `
        <svg class="button-icon applicant-public-home-action-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="5" y="4" width="14" height="16" rx="2"></rect>
          <path d="M9 9h6"></path>
          <path d="M9 13h3"></path>
          <path d="m10 16 1.8 1.8 3.2-3.3"></path>
        </svg>
      `;
    }

    if (iconKey === "scan") {
      return `
        <svg class="button-icon applicant-public-home-action-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 7V5.8A1.8 1.8 0 0 1 7.8 4H9"></path>
          <path d="M15 4h1.2A1.8 1.8 0 0 1 18 5.8V7"></path>
          <path d="M18 17v1.2a1.8 1.8 0 0 1-1.8 1.8H15"></path>
          <path d="M9 20H7.8A1.8 1.8 0 0 1 6 18.2V17"></path>
          <rect x="8" y="7" width="8" height="10" rx="1.2"></rect>
          <path d="M10 10h4"></path>
          <path d="M10 13h4"></path>
        </svg>
      `;
    }

    return `
      <svg class="button-icon applicant-public-home-action-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 9a2 2 0 0 0 0 4v2.5A1.5 1.5 0 0 0 6.5 17h11a1.5 1.5 0 0 0 1.5-1.5V13a2 2 0 0 0 0-4V8.5A1.5 1.5 0 0 0 17.5 7h-11A1.5 1.5 0 0 0 5 8.5z"></path>
        <path d="M12 7v10"></path>
        <path d="M9 10h6"></path>
      </svg>
    `;
  }

  function renderApplicantHomeActionButtonLabel(label = "", iconKey = "") {
    return `${getApplicantHomeActionIconMarkup(iconKey)}<span>${escapeHtml(label)}</span>`;
  }

  function renderCompactNotice({ html = '', cardClassName = '', contentClassName = '', contentId = '', contentAttributes = '', editing = false } = {}) {
    const text = String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const decoder = typeof document === 'object' ? document.createElement('textarea') : null;
    if (decoder) decoder.innerHTML = text;
    const preview = decoder ? decoder.value : text;
    return `<article class="login-hero-card login-notice-card ${escapeAttribute(cardClassName)}">
      <details class="public-glass-notice" ${editing ? 'open' : ''}>
        <summary><div class="login-notice-head"><h2>Notice</h2><span class="public-glass-notice-more">전체보기</span><span class="public-glass-notice-less">접기</span></div><p class="public-glass-notice-preview">${escapeHtml(preview || '공지사항을 확인해 주세요.')}</p></summary>
        <div ${contentId ? `id="${escapeAttribute(contentId)}"` : ''} class="login-notice-content ${escapeAttribute(contentClassName)}" ${contentAttributes}>${html}</div>
      </details>
    </article>`;
  }

  return Object.freeze({
    escapeAttribute,
    escapeHtml,
    formatApplicantBirthDate,
    getDateDayCount,
    getDateYearOptions,
    renderDateOptions,
    renderDateSelectControls,
    renderNationalityOptions,
    getApplicantHomeActionIconMarkup,
    renderApplicantHomeActionButtonLabel,
    renderCompactNotice,
  });
});
