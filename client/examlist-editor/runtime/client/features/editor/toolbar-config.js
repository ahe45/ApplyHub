(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListEditorToolbarConfig = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const EDITOR_TOOLBAR_FONT_OPTIONS = Object.freeze([
    Object.freeze({ label: "기본", value: "'Noto Sans KR', sans-serif" }),
    Object.freeze({ label: "맑은 고딕", value: "'Malgun Gothic', sans-serif" }),
    Object.freeze({ label: "굴림체", value: "'GulimChe', 'Gulim', sans-serif" }),
    Object.freeze({ label: "나눔고딕", value: "'Nanum Gothic', sans-serif" }),
    Object.freeze({ label: "나눔명조", value: "'Nanum Myeongjo', serif" }),
    Object.freeze({ label: "바탕", value: "'Batang', serif" }),
  ]);

  const EDITOR_TOOLBAR_FONT_SIZE_OPTIONS = Object.freeze([
    ...Array.from({ length: 28 }, (_value, index) => index + 1),
    30,
    32,
    36,
    40,
    48,
    56,
    64,
    72,
  ]);

  const EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR = "#000000";
  const EDITOR_TOOLBAR_TEXT_COLOR_PRESETS = Object.freeze([
    Object.freeze({ label: "기본 검정", value: "#000000" }),
    Object.freeze({ label: "차콜", value: "#334155" }),
    Object.freeze({ label: "파랑", value: "#1d4ed8" }),
    Object.freeze({ label: "청록", value: "#0f766e" }),
    Object.freeze({ label: "초록", value: "#15803d" }),
    Object.freeze({ label: "마젠타", value: "#ff00ff" }),
    Object.freeze({ label: "주황", value: "#c2410c" }),
    Object.freeze({ label: "빨강", value: "#b91c1c" }),
    Object.freeze({ label: "보라", value: "#7c3aed" }),
    Object.freeze({ label: "흰색", value: "#ffffff" }),
  ]);
  const EDITOR_TOOLBAR_SHADING_COLOR_PRESETS = Object.freeze([
    Object.freeze({ label: "노랑", value: "#fff59d" }),
    Object.freeze({ label: "하늘", value: "#bfdbfe" }),
    Object.freeze({ label: "민트", value: "#bbf7d0" }),
    Object.freeze({ label: "분홍", value: "#fbcfe8" }),
    Object.freeze({ label: "연보라", value: "#ddd6fe" }),
    Object.freeze({ label: "살구", value: "#fed7aa" }),
    Object.freeze({ label: "회색", value: "#e2e8f0" }),
    Object.freeze({ label: "연청록", value: "#ccfbf1" }),
    Object.freeze({ label: "연빨강", value: "#fecaca" }),
    Object.freeze({ label: "색 없음", value: "transparent", noColor: true }),
  ]);

  const EDITOR_TOOLBAR_ICON_MARKUP = Object.freeze({
    unorderedList: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="6" cy="7" r="1.25" fill="currentColor" stroke="none"></circle>
        <circle cx="6" cy="12" r="1.25" fill="currentColor" stroke="none"></circle>
        <circle cx="6" cy="17" r="1.25" fill="currentColor" stroke="none"></circle>
        <path d="M10 7h10"></path>
        <path d="M10 12h10"></path>
        <path d="M10 17h10"></path>
      </svg>
    `,
    justifyLeft: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7h12"></path>
        <path d="M4 11h16"></path>
        <path d="M4 15h12"></path>
        <path d="M4 19h16"></path>
      </svg>
    `,
    justifyCenter: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 7h12"></path>
        <path d="M4 11h16"></path>
        <path d="M6 15h12"></path>
        <path d="M4 19h16"></path>
      </svg>
    `,
    justifyRight: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 7h12"></path>
        <path d="M4 11h16"></path>
        <path d="M8 15h12"></path>
        <path d="M4 19h16"></path>
      </svg>
    `,
    justifyFull: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7h16"></path>
        <path d="M4 11h16"></path>
        <path d="M4 15h16"></path>
        <path d="M4 19h16"></path>
      </svg>
    `,
    insertRowBefore: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="5" y="7" width="14" height="12" rx="1.5"></rect>
        <path d="M5 13h14"></path>
        <path d="M12 3v4"></path>
        <path d="M10 5h4"></path>
      </svg>
    `,
    insertRowAfter: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="5" y="5" width="14" height="12" rx="1.5"></rect>
        <path d="M5 11h14"></path>
        <path d="M12 17v4"></path>
        <path d="M10 19h4"></path>
      </svg>
    `,
    insertColumnBefore: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="7" y="5" width="12" height="14" rx="1.5"></rect>
        <path d="M13 5v14"></path>
        <path d="M3 12h4"></path>
        <path d="M5 10v4"></path>
      </svg>
    `,
    insertColumnAfter: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="5" y="5" width="12" height="14" rx="1.5"></rect>
        <path d="M11 5v14"></path>
        <path d="M17 12h4"></path>
        <path d="M19 10v4"></path>
      </svg>
    `,
    deleteRow: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="5" y="5" width="14" height="14" rx="1.5"></rect>
        <path d="M5 10h14"></path>
        <path d="M9 3h6"></path>
      </svg>
    `,
    deleteColumn: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="5" y="5" width="14" height="14" rx="1.5"></rect>
        <path d="M10 5v14"></path>
        <path d="M17 9v6"></path>
      </svg>
    `,
    mergeSelection: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="3.5" width="17" height="17" rx="2.5"></rect>
        <path d="M3.5 8.5h17"></path>
        <path d="M3.5 15.5h17"></path>
        <path d="M12 3.5v5"></path>
        <path d="M12 15.5v5"></path>
        <path d="M8 12h8"></path>
        <path d="m9.5 10.5-2.5 1.5 2.5 1.5"></path>
        <path d="m14.5 10.5 2.5 1.5-2.5 1.5"></path>
      </svg>
    `,
    splitCell: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="1.5"></rect>
        <path d="M12 5v14"></path>
        <path d="M4 12h16"></path>
        <path d="m9.5 9.5 2.5 2.5-2.5 2.5"></path>
        <path d="m14.5 9.5-2.5 2.5 2.5 2.5"></path>
      </svg>
    `,
    equalizeColumnWidths: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="6" width="16" height="12" rx="1.5"></rect>
        <path d="M10 6v12"></path>
        <path d="M14 6v12"></path>
        <path d="M3 12h4"></path>
        <path d="M17 12h4"></path>
      </svg>
    `,
    equalizeRowHeights: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="6" y="4" width="12" height="16" rx="1.5"></rect>
        <path d="M6 10h12"></path>
        <path d="M6 14h12"></path>
        <path d="M12 3v4"></path>
        <path d="M12 17v4"></path>
      </svg>
    `,
    cellVerticalAlignTop: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="5" y="4.5" width="14" height="15" rx="1.5"></rect>
        <path d="M8 8h8"></path>
        <path d="M8 4.5h8"></path>
      </svg>
    `,
    cellVerticalAlignMiddle: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="5" y="4.5" width="14" height="15" rx="1.5"></rect>
        <path d="M8 12h8"></path>
        <path d="M8 9.5h8"></path>
        <path d="M8 14.5h8"></path>
      </svg>
    `,
    cellVerticalAlignBottom: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="5" y="4.5" width="14" height="15" rx="1.5"></rect>
        <path d="M8 16h8"></path>
        <path d="M8 19.5h8"></path>
      </svg>
    `,
    insertTable: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="1.5"></rect>
        <path d="M4 10h16"></path>
        <path d="M10 5v14"></path>
        <path d="M16 5v14"></path>
      </svg>
    `,
    openImage: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="2"></rect>
        <circle cx="9" cy="10" r="1.5"></circle>
        <path d="m8 16 3-3 2 2 3-4 2 5"></path>
      </svg>
    `,
    barcode: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 6v12"></path>
        <path d="M8 6v12"></path>
        <path d="M11 8v8"></path>
        <path d="M13 6v12"></path>
        <path d="M16 8v8"></path>
        <path d="M19 6v12"></path>
      </svg>
    `,
    qrcode: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="5" height="5" rx="0.8"></rect>
        <rect x="15" y="4" width="5" height="5" rx="0.8"></rect>
        <rect x="4" y="15" width="5" height="5" rx="0.8"></rect>
        <path d="M13 13h2"></path>
        <path d="M15 13v2"></path>
        <path d="M17 15h3"></path>
        <path d="M13 17h4"></path>
        <path d="M18 18h2"></path>
        <path d="M14 19h1"></path>
      </svg>
    `,
    rule: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 12h16"></path>
      </svg>
    `,
    link: `
      <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M10 14 8.5 15.5a3 3 0 0 1-4.2-4.2L7.8 7.8a3 3 0 0 1 4.2 0"></path>
        <path d="M14 10 15.5 8.5a3 3 0 1 1 4.2 4.2l-3.5 3.5a3 3 0 0 1-4.2 0"></path>
        <path d="m8.5 15.5 7-7"></path>
      </svg>
    `,
  });

  return Object.freeze({
    EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR,
    EDITOR_TOOLBAR_FONT_OPTIONS,
    EDITOR_TOOLBAR_FONT_SIZE_OPTIONS,
    EDITOR_TOOLBAR_ICON_MARKUP,
    EDITOR_TOOLBAR_SHADING_COLOR_PRESETS,
    EDITOR_TOOLBAR_TEXT_COLOR_PRESETS,
  });
});

})();
