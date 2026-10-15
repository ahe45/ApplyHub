(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListEditorToolbarBorderMarkup = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const EDITOR_TOOLBAR_BORDER_TARGET_OPTIONS = Object.freeze([
    Object.freeze({ label: "모든 테두리", value: "all" }),
    Object.freeze({ label: "바깥쪽 테두리", value: "outside" }),
    Object.freeze({ label: "안쪽 테두리", value: "inside" }),
    Object.freeze({ label: "위쪽 테두리", value: "top" }),
    Object.freeze({ label: "오른쪽 테두리", value: "right" }),
    Object.freeze({ label: "아래쪽 테두리", value: "bottom" }),
    Object.freeze({ label: "왼쪽 테두리", value: "left" }),
  ]);

  const EDITOR_TOOLBAR_BORDER_STYLE_OPTIONS = Object.freeze([
    Object.freeze({ label: "실선", value: "solid" }),
    Object.freeze({ label: "파선", value: "dashed" }),
    Object.freeze({ label: "점선", value: "dotted" }),
    Object.freeze({ label: "이중선", value: "double" }),
    Object.freeze({ label: "선 없음", value: "none" }),
  ]);
  const EDITOR_TOOLBAR_BORDER_WIDTH_OPTIONS = Object.freeze(["0", "0.5", "1", "1.5", "2", "2.5", "3"]);
  const EDITOR_TOOLBAR_CELL_PADDING_OPTIONS = Object.freeze(Array.from({ length: 11 }, (_value, index) => String(index)));

  function createEditorToolbarBorderMarkup({
    EDITOR_TOOLBAR_TEXT_COLOR_PRESETS,
    escapeEditorToolbarAttribute,
    escapeEditorToolbarHtml,
    renderEditorToolbarAttribute,
    renderEditorToolbarColorPickerSection,
  }) {
    function renderEditorToolbarBorderTargetIcon(target = "all") {
      const activeByTarget = {
        all: `
          <rect class="template-toolbar-border-icon-active" x="5" y="5" width="14" height="14" rx="1.5"></rect>
          <path class="template-toolbar-border-icon-active" d="M5 12h14"></path>
          <path class="template-toolbar-border-icon-active" d="M12 5v14"></path>
        `,
        outside: '<rect class="template-toolbar-border-icon-active" x="5" y="5" width="14" height="14" rx="1.5"></rect>',
        inside: `
          <path class="template-toolbar-border-icon-active" d="M5 12h14"></path>
          <path class="template-toolbar-border-icon-active" d="M12 5v14"></path>
        `,
        top: '<path class="template-toolbar-border-icon-active" d="M5 5h14"></path>',
        right: '<path class="template-toolbar-border-icon-active" d="M19 5v14"></path>',
        bottom: '<path class="template-toolbar-border-icon-active" d="M5 19h14"></path>',
        left: '<path class="template-toolbar-border-icon-active" d="M5 5v14"></path>',
      };

      return `
        <svg class="template-toolbar-dropdown-icon template-toolbar-border-target-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect class="template-toolbar-border-icon-muted" x="5" y="5" width="14" height="14" rx="1.5"></rect>
          <path class="template-toolbar-border-icon-muted" d="M5 12h14"></path>
          <path class="template-toolbar-border-icon-muted" d="M12 5v14"></path>
          ${activeByTarget[target] || activeByTarget.all}
        </svg>
      `;
    }

    function renderEditorToolbarBorderStyleIcon(style = "solid") {
      const iconMarkupByStyle = {
        solid: '<path class="template-toolbar-border-icon-active" d="M5 12h14"></path>',
        dashed: '<path class="template-toolbar-border-icon-active" d="M5 12h14" stroke-dasharray="4 3"></path>',
        dotted: '<path class="template-toolbar-border-icon-active" d="M5 12h14" stroke-linecap="round" stroke-dasharray="1 4"></path>',
        double: `
          <path class="template-toolbar-border-icon-active" d="M5 10h14"></path>
          <path class="template-toolbar-border-icon-active" d="M5 14h14"></path>
        `,
        none: `
          <path class="template-toolbar-border-icon-muted" d="M5 12h14"></path>
          <path class="template-toolbar-border-icon-active" d="M7 17 17 7"></path>
        `,
      };

      return `
        <svg class="template-toolbar-dropdown-icon template-toolbar-border-style-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          ${iconMarkupByStyle[style] || iconMarkupByStyle.solid}
        </svg>
      `;
    }

    function renderEditorToolbarBorderDropdown({
      id = "",
      ariaLabel = "",
      options = [],
      renderIcon = () => "",
      selectWrapClassName = "",
      selectedValue = "",
    } = {}) {
      const normalizedSelectedValue = String(selectedValue || options[0]?.value || "").trim();
      const selectedOption = options.find((option) => option.value === normalizedSelectedValue) || options[0] || null;
      const menuId = `${id}Menu`;
      const optionMarkup = options.map((option) => {
        const isActive = option.value === selectedOption?.value;

        return `
          <button
            class="template-toolbar-icon-select-option${isActive ? " active" : ""}"
            data-editor-border-select-option="${escapeEditorToolbarAttribute(option.value)}"
            type="button"
            role="option"
            aria-selected="${isActive ? "true" : "false"}"
          >
            <span class="template-toolbar-icon-select-option-icon" data-editor-border-select-option-icon aria-hidden="true">
              ${renderIcon(option.value)}
            </span>
            <span class="template-toolbar-icon-select-option-label">${escapeEditorToolbarHtml(option.label)}</span>
          </button>
        `;
      }).join("");

      return `
        <span class="template-toolbar-select-wrap template-toolbar-icon-select ${selectWrapClassName}" data-editor-border-select="${escapeEditorToolbarAttribute(id)}">
          <select class="template-toolbar-select template-toolbar-border-select template-toolbar-border-native-select" id="${escapeEditorToolbarAttribute(id)}" aria-label="${escapeEditorToolbarAttribute(ariaLabel)}" tabindex="-1">
            ${options.map((option) => `
              <option value="${escapeEditorToolbarAttribute(option.value)}"${option.value === selectedOption?.value ? " selected" : ""}>${escapeEditorToolbarHtml(option.label)}</option>
            `).join("")}
          </select>
          <button
            class="template-toolbar-icon-select-button"
            data-editor-border-select-toggle="${escapeEditorToolbarAttribute(id)}"
            type="button"
            aria-label="${escapeEditorToolbarAttribute(ariaLabel)}"
            aria-haspopup="listbox"
            aria-expanded="false"
            aria-controls="${escapeEditorToolbarAttribute(menuId)}"
          >
            <span class="template-toolbar-icon-select-current-icon" data-editor-border-select-current-icon aria-hidden="true">
              ${selectedOption ? renderIcon(selectedOption.value) : ""}
            </span>
            <span class="template-toolbar-icon-select-label" data-editor-border-select-label>${escapeEditorToolbarHtml(selectedOption?.label || "")}</span>
            <span class="template-toolbar-icon-select-caret" aria-hidden="true"></span>
          </button>
          <div class="template-toolbar-icon-select-menu hidden" id="${escapeEditorToolbarAttribute(menuId)}" data-editor-border-select-menu-for="${escapeEditorToolbarAttribute(id)}" role="listbox" aria-label="${escapeEditorToolbarAttribute(ariaLabel)}">
            ${optionMarkup}
          </div>
        </span>
      `;
    }

    function renderEditorToolbarBorderWidthOptions(selectedValue = "1") {
      const activeValue = EDITOR_TOOLBAR_BORDER_WIDTH_OPTIONS.includes(String(selectedValue))
        ? String(selectedValue)
        : "1";

      return EDITOR_TOOLBAR_BORDER_WIDTH_OPTIONS.map((optionValue) => {
        const isActive = optionValue === activeValue;

        return `
          <button
            class="template-toolbar-combo-option${isActive ? " active" : ""}"
            data-editor-border-width-option="${escapeEditorToolbarAttribute(optionValue)}"
            type="button"
            role="option"
            aria-selected="${isActive ? "true" : "false"}"
          >
            ${escapeEditorToolbarHtml(optionValue)}
          </button>
        `;
      }).join("");
    }

    function renderEditorToolbarBorderWidthDropdown(borderWidthId = "") {
      const menuId = `${borderWidthId}Menu`;

      return `
        <div class="template-toolbar-border-width-combo" data-editor-border-width-combo="${escapeEditorToolbarAttribute(borderWidthId)}">
          <input class="template-toolbar-border-width-input template-toolbar-border-width" id="${escapeEditorToolbarAttribute(borderWidthId)}" type="hidden" value="1" aria-hidden="true" tabindex="-1" />
          <button
            class="template-toolbar-combo-value template-toolbar-border-width-value"
            data-editor-border-width-toggle="${escapeEditorToolbarAttribute(borderWidthId)}"
            type="button"
            aria-label="테두리 굵기 목록 열기"
            aria-expanded="false"
            aria-controls="${escapeEditorToolbarAttribute(menuId)}"
          >
            <span data-editor-border-width-current>1</span>
            <span class="template-toolbar-border-width-unit" aria-hidden="true">pt</span>
            <span class="template-toolbar-combo-caret" aria-hidden="true"></span>
          </button>
          <div class="template-toolbar-combo-menu template-toolbar-border-width-menu hidden" id="${escapeEditorToolbarAttribute(menuId)}" data-editor-border-width-menu-for="${escapeEditorToolbarAttribute(borderWidthId)}" role="listbox" aria-label="테두리 굵기 목록">
            ${renderEditorToolbarBorderWidthOptions("1")}
          </div>
        </div>
      `;
    }

    function renderEditorToolbarBorderSection({
      tableActionAttr = "",
      borderTargetId = "",
      borderStyleId = "",
      borderWidthId = "",
      borderColorId = "",
    } = {}) {
      if (!borderTargetId || !borderStyleId || !borderWidthId || !borderColorId) {
        return "";
      }

      return `
        <div class="template-toolbar-section template-toolbar-border-section">
          <span class="template-toolbar-section-label">테두리</span>
          <div class="template-toolbar-border-controls">
            <div class="template-toolbar-border-field template-toolbar-border-field-target">
              <span class="template-toolbar-border-field-label">적용 위치</span>
              ${renderEditorToolbarBorderDropdown({
                id: borderTargetId,
                ariaLabel: "테두리 적용 위치",
                options: EDITOR_TOOLBAR_BORDER_TARGET_OPTIONS,
                renderIcon: renderEditorToolbarBorderTargetIcon,
                selectWrapClassName: "template-toolbar-select-wrap-border-target",
                selectedValue: "all",
              })}
            </div>
            <div class="template-toolbar-border-field template-toolbar-border-field-style">
              <span class="template-toolbar-border-field-label">선 종류</span>
              ${renderEditorToolbarBorderDropdown({
                id: borderStyleId,
                ariaLabel: "테두리 선 스타일",
                options: EDITOR_TOOLBAR_BORDER_STYLE_OPTIONS,
                renderIcon: renderEditorToolbarBorderStyleIcon,
                selectWrapClassName: "template-toolbar-select-wrap-border-style",
                selectedValue: "solid",
              })}
            </div>
            <div class="template-toolbar-border-width-field">
              <span class="template-toolbar-border-field-label">굵기</span>
              <span class="template-toolbar-border-width-control">
                ${renderEditorToolbarBorderWidthDropdown(borderWidthId)}
              </span>
            </div>
            <div class="template-toolbar-border-field template-toolbar-border-field-color">
              <span class="template-toolbar-border-field-label">색상</span>
              ${renderEditorToolbarColorPickerSection({
                sectionLabel: "색상",
                inputId: borderColorId,
                inputValue: "#000000",
                presetColors: EDITOR_TOOLBAR_TEXT_COLOR_PRESETS,
                colorTableAction: "apply-cell-border",
                fallbackValue: "#000000",
                sectionClassName: "template-toolbar-section-border-color",
                pickerClassName: "template-toolbar-color-picker-compact template-toolbar-color-picker-align-end",
                triggerLabel: "색상",
              })}
            </div>
            <button class="template-tool-button template-toolbar-border-apply" ${renderEditorToolbarAttribute(tableActionAttr, "apply-cell-border")} type="button">적용</button>
          </div>
        </div>
      `;
    }

    function renderEditorToolbarCellPaddingField({
      id = "",
      label = "",
      value = "2",
      ariaLabel = "",
    } = {}) {
      const normalizedValue = EDITOR_TOOLBAR_CELL_PADDING_OPTIONS.includes(String(value)) ? String(value) : "2";
      const menuId = `${id}Menu`;

      return `
        <div class="template-toolbar-cell-padding-field">
          <span class="template-toolbar-cell-padding-field-label" id="${escapeEditorToolbarAttribute(id)}Label">${escapeEditorToolbarHtml(label)}</span>
          <span class="template-toolbar-cell-padding-control">
            <span class="template-toolbar-cell-padding-combo" data-editor-cell-padding-combo="${escapeEditorToolbarAttribute(id)}">
              <input class="template-toolbar-cell-padding-input" id="${escapeEditorToolbarAttribute(id)}" type="hidden" value="${escapeEditorToolbarAttribute(normalizedValue)}" aria-hidden="true" tabindex="-1" />
              <button
                class="template-toolbar-combo-value template-toolbar-cell-padding-value"
                data-editor-cell-padding-toggle="${escapeEditorToolbarAttribute(id)}"
                type="button"
                aria-label="${escapeEditorToolbarAttribute(ariaLabel)} 목록 열기"
                aria-expanded="false"
                aria-controls="${escapeEditorToolbarAttribute(menuId)}"
              >
                <span data-editor-cell-padding-current>${escapeEditorToolbarHtml(normalizedValue)}</span>
                <span class="template-toolbar-cell-padding-unit" aria-hidden="true">px</span>
                <span class="template-toolbar-combo-caret" aria-hidden="true"></span>
              </button>
              <div class="template-toolbar-combo-menu template-toolbar-cell-padding-menu hidden" id="${escapeEditorToolbarAttribute(menuId)}" data-editor-cell-padding-menu-for="${escapeEditorToolbarAttribute(id)}" role="listbox" aria-label="${escapeEditorToolbarAttribute(ariaLabel)} 목록">
                ${EDITOR_TOOLBAR_CELL_PADDING_OPTIONS.map((optionValue) => {
                  const isActive = optionValue === normalizedValue;

                  return `
                    <button
                      class="template-toolbar-combo-option${isActive ? " active" : ""}"
                      data-editor-cell-padding-option="${escapeEditorToolbarAttribute(optionValue)}"
                      type="button"
                      role="option"
                      aria-selected="${isActive ? "true" : "false"}"
                    >
                      ${escapeEditorToolbarHtml(optionValue)}
                    </button>
                  `;
                }).join("")}
              </div>
            </span>
          </span>
        </div>
      `;
    }

    function renderEditorToolbarCellPaddingSection({
      tableActionAttr = "",
      cellPaddingTopId = "",
      cellPaddingRightId = "",
      cellPaddingBottomId = "",
      cellPaddingLeftId = "",
    } = {}) {
      if (!cellPaddingTopId || !cellPaddingRightId || !cellPaddingBottomId || !cellPaddingLeftId) {
        return "";
      }

      return `
        <div class="template-toolbar-section template-toolbar-cell-padding-section">
          <span class="template-toolbar-section-label">셀 여백</span>
          <div class="template-toolbar-cell-padding-controls">
            <div class="template-toolbar-cell-padding-grid">
              ${renderEditorToolbarCellPaddingField({
                id: cellPaddingTopId,
                label: "위",
                value: "2",
                ariaLabel: "셀 위쪽 내부 여백",
              })}
              ${renderEditorToolbarCellPaddingField({
                id: cellPaddingBottomId,
                label: "아래",
                value: "2",
                ariaLabel: "셀 아래쪽 내부 여백",
              })}
              ${renderEditorToolbarCellPaddingField({
                id: cellPaddingLeftId,
                label: "좌",
                value: "2",
                ariaLabel: "셀 왼쪽 내부 여백",
              })}
              ${renderEditorToolbarCellPaddingField({
                id: cellPaddingRightId,
                label: "우",
                value: "2",
                ariaLabel: "셀 오른쪽 내부 여백",
              })}
            </div>
          </div>
        </div>
      `;
    }

    return Object.freeze({
      renderEditorToolbarBorderSection,
      renderEditorToolbarCellPaddingSection,
    });
  }

  return Object.freeze({
    createEditorToolbarBorderMarkup,
  });
});

})();
