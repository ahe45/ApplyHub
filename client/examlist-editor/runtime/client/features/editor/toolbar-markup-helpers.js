(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./toolbar-color-markup"), require("./toolbar-border-markup"));
    return;
  }

  globalScope.ExamListEditorToolbarMarkupHelpers = factory(
    globalScope.ExamListEditorToolbarColorMarkup,
    globalScope.ExamListEditorToolbarBorderMarkup,
  );
})(typeof globalThis !== "undefined" ? globalThis : this, (toolbarColorMarkupModule, toolbarBorderMarkupModule) => {
  if (!toolbarColorMarkupModule?.createEditorToolbarColorMarkup) {
    throw new Error("client/features/editor/toolbar-color-markup.js must be loaded before toolbar-markup-helpers.js.");
  }

  if (!toolbarBorderMarkupModule?.createEditorToolbarBorderMarkup) {
    throw new Error("client/features/editor/toolbar-border-markup.js must be loaded before toolbar-markup-helpers.js.");
  }

  const { createEditorToolbarColorMarkup } = toolbarColorMarkupModule;
  const { createEditorToolbarBorderMarkup } = toolbarBorderMarkupModule;

  function createEditorToolbarMarkupHelpers({
    EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR,
    EDITOR_TOOLBAR_FONT_OPTIONS,
    EDITOR_TOOLBAR_FONT_SIZE_OPTIONS,
    EDITOR_TOOLBAR_ICON_MARKUP,
    EDITOR_TOOLBAR_TEXT_COLOR_PRESETS,
    isEditorToolbarPresetFontSize,
    normalizeEditorToolbarColorValue,
  }) {
    function escapeEditorToolbarHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    }

    function escapeEditorToolbarAttribute(value) {
      return escapeEditorToolbarHtml(value)
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function renderEditorToolbarAttribute(attributeName, attributeValue) {
      if (!attributeName) {
        return "";
      }

      return ` ${attributeName}="${escapeEditorToolbarAttribute(attributeValue)}"`;
    }
    const {
      renderEditorToolbarColorPickerSection,
      renderEditorToolbarColorPresetButtons,
    } = createEditorToolbarColorMarkup({
      escapeEditorToolbarAttribute,
      escapeEditorToolbarHtml,
      normalizeEditorToolbarColorValue,
      renderEditorToolbarAttribute,
    });
    const {
      renderEditorToolbarBorderSection,
      renderEditorToolbarCellPaddingSection,
    } = createEditorToolbarBorderMarkup({
      EDITOR_TOOLBAR_TEXT_COLOR_PRESETS,
      escapeEditorToolbarAttribute,
      escapeEditorToolbarHtml,
      renderEditorToolbarAttribute,
      renderEditorToolbarColorPickerSection,
    });

    function renderEditorToolbarIconButton({
      attributeName = "",
      attributeValue = "",
      label = "",
      title = label,
      iconMarkup = "",
      extraClassName = "",
    }) {
      const className = ["template-tool-button", "icon-only", extraClassName].filter(Boolean).join(" ");

      return `
        <button class="${className}"${renderEditorToolbarAttribute(attributeName, attributeValue)} type="button" aria-label="${escapeEditorToolbarAttribute(label)}" title="${escapeEditorToolbarAttribute(title)}">
          ${iconMarkup}
          <span class="sr-only">${escapeEditorToolbarHtml(label)}</span>
        </button>
      `;
    }

    function renderEditorToolbarLabeledControl({ controlMarkup = "" } = {}) {
      if (!controlMarkup) {
        return "";
      }

      return `
        <div class="examlist-object-insert-item">
          ${controlMarkup}
        </div>
      `;
    }

    function renderEditorToolbarTextButton({
      attributeName = "",
      attributeValue = "",
      label = "",
      title = label,
      textContent = "",
    }) {
      return `
        <button class="template-tool-button type-emphasis icon-only"${renderEditorToolbarAttribute(attributeName, attributeValue)} type="button" aria-label="${escapeEditorToolbarAttribute(label)}" title="${escapeEditorToolbarAttribute(title)}">
          <span aria-hidden="true">${escapeEditorToolbarHtml(textContent)}</span>
          <span class="sr-only">${escapeEditorToolbarHtml(label)}</span>
        </button>
      `;
    }

    function renderEditorToolbarFontOptions(selectedValue = "") {
      const normalizedSelectedValue = String(selectedValue || "").trim();

      return EDITOR_TOOLBAR_FONT_OPTIONS.map((option) => `
        <option value="${escapeEditorToolbarAttribute(option.value)}"${option.value === normalizedSelectedValue ? " selected" : ""}>${escapeEditorToolbarHtml(option.label)}</option>
      `).join("");
    }

    function getEditorToolbarFontFamilyLabel(value = "") {
      const normalizedValue = String(value || "").trim();
      const matchingOption = EDITOR_TOOLBAR_FONT_OPTIONS.find((option) => option.value === normalizedValue);

      return matchingOption?.label || EDITOR_TOOLBAR_FONT_OPTIONS[0]?.label || "";
    }

    function renderEditorToolbarFontFamilyOptionButtons(selectedValue = "") {
      const normalizedSelectedValue = String(selectedValue || "").trim();

      return EDITOR_TOOLBAR_FONT_OPTIONS.map((option) => {
        const isActive = option.value === normalizedSelectedValue;

        return `
          <button
            class="template-toolbar-combo-option${isActive ? " active" : ""}"
            data-editor-font-family-option="${escapeEditorToolbarAttribute(option.value)}"
            data-editor-font-family-label="${escapeEditorToolbarAttribute(option.label)}"
            type="button"
            role="option"
            aria-selected="${isActive ? "true" : "false"}"
          >
            ${escapeEditorToolbarHtml(option.label)}
          </button>
        `;
      }).join("");
    }

    function renderEditorToolbarFontSizeOptionButtons(selectedValue = 11) {
      const normalizedSelectedValue = Math.round(Number(selectedValue));
      const activeValue = Number.isFinite(normalizedSelectedValue) && isEditorToolbarPresetFontSize(normalizedSelectedValue)
        ? String(normalizedSelectedValue)
        : "";

      return EDITOR_TOOLBAR_FONT_SIZE_OPTIONS.map((fontSize) => {
        const fontSizeValue = String(fontSize);
        const isActive = fontSizeValue === activeValue;

        return `
          <button
            class="template-toolbar-combo-option${isActive ? " active" : ""}"
            data-editor-font-size-option="${escapeEditorToolbarAttribute(fontSizeValue)}"
            type="button"
            role="option"
            aria-selected="${isActive ? "true" : "false"}"
          >
            ${escapeEditorToolbarHtml(fontSizeValue)}pt
          </button>
        `;
      }).join("");
    }

    function renderEditorToolbarTableInsertPopover({
      insertAttr = "",
      panelId = "",
      rowsId = "",
      columnsId = "",
    } = {}) {
      return `
        <div
          class="template-toolbar-table-insert-popover"
          data-editor-table-insert-popover="${escapeEditorToolbarAttribute(panelId)}"
        >
          <button
            class="template-tool-button icon-only template-toolbar-table-insert-toggle"
            ${renderEditorToolbarAttribute(insertAttr, "table")}
            ${renderEditorToolbarAttribute("data-editor-table-insert-toggle", panelId)}
            type="button"
            aria-label="표 삽입"
            title="표 삽입"
            aria-expanded="false"
            aria-controls="${escapeEditorToolbarAttribute(panelId)}"
          >
            ${EDITOR_TOOLBAR_ICON_MARKUP.insertTable}
            <span class="sr-only">표 삽입</span>
          </button>
          <div
            class="template-table-insert-panel hidden"
            id="${escapeEditorToolbarAttribute(panelId)}"
            role="group"
            aria-label="표 삽입 설정"
          >
            <label class="template-toolbar-subfield" for="${escapeEditorToolbarAttribute(rowsId)}">
              <span>행</span>
              <input class="template-toolbar-number" id="${escapeEditorToolbarAttribute(rowsId)}" type="number" min="1" max="20" step="1" value="3" />
            </label>
            <label class="template-toolbar-subfield" for="${escapeEditorToolbarAttribute(columnsId)}">
              <span>열</span>
              <input class="template-toolbar-number" id="${escapeEditorToolbarAttribute(columnsId)}" type="number" min="1" max="8" step="1" value="2" />
            </label>
            <button class="template-tool-button"${renderEditorToolbarAttribute(insertAttr, "table-confirm")} type="button">표 추가</button>
          </div>
        </div>
      `;
    }

    function renderEditorToolbarCellSplitPopover({
      panelId = "",
      countId = "",
      axisName = "",
      axisRowId = "",
      axisColumnId = "",
    } = {}) {
      return `
        <div
          class="template-toolbar-table-insert-popover template-toolbar-cell-split-popover"
          data-editor-table-insert-popover="${escapeEditorToolbarAttribute(panelId)}"
        >
          <button
            class="template-tool-button icon-only template-toolbar-table-insert-toggle template-toolbar-cell-split-toggle"
            ${renderEditorToolbarAttribute("data-template-cell-split-toggle", panelId)}
            ${renderEditorToolbarAttribute("data-editor-table-insert-toggle", panelId)}
            type="button"
            aria-label="셀 분할"
            title="셀 분할"
            aria-expanded="false"
            aria-controls="${escapeEditorToolbarAttribute(panelId)}"
          >
            ${EDITOR_TOOLBAR_ICON_MARKUP.splitCell}
            <span class="sr-only">셀 분할</span>
          </button>
          <div
            class="template-table-insert-panel template-toolbar-cell-split-panel hidden"
            id="${escapeEditorToolbarAttribute(panelId)}"
            role="group"
            aria-label="셀 분할 설정"
          >
            <fieldset class="template-toolbar-subfield template-toolbar-subfield-wide template-toolbar-choice-field">
              <legend>편집</legend>
              <div class="template-toolbar-choice-group" role="radiogroup" aria-label="셀 분할 방향">
                <label
                  class="template-toolbar-choice-option"
                  for="${escapeEditorToolbarAttribute(axisRowId)}"
                  data-template-cell-split-axis-option="row"
                >
                  <input
                    class="sr-only"
                    id="${escapeEditorToolbarAttribute(axisRowId)}"
                    name="${escapeEditorToolbarAttribute(axisName)}"
                    type="radio"
                    value="row"
                  />
                  <span>행</span>
                </label>
                <label
                  class="template-toolbar-choice-option"
                  for="${escapeEditorToolbarAttribute(axisColumnId)}"
                  data-template-cell-split-axis-option="column"
                >
                  <input
                    class="sr-only"
                    id="${escapeEditorToolbarAttribute(axisColumnId)}"
                    name="${escapeEditorToolbarAttribute(axisName)}"
                    type="radio"
                    value="column"
                    checked
                  />
                  <span>열</span>
                </label>
              </div>
            </fieldset>
            <label class="template-toolbar-subfield template-toolbar-subfield-wide" for="${escapeEditorToolbarAttribute(countId)}">
              <span>칸</span>
              <span class="template-toolbar-number-stepper">
                <input class="template-toolbar-number template-toolbar-number-stepper-input" id="${escapeEditorToolbarAttribute(countId)}" type="number" min="2" step="1" value="2" />
                <span class="template-toolbar-number-stepper-controls">
                  <button class="template-toolbar-number-stepper-button" data-template-cell-split-step="up" type="button" aria-label="분할 칸 수 증가" title="증가">
                    <span aria-hidden="true">▲</span>
                  </button>
                  <button class="template-toolbar-number-stepper-button" data-template-cell-split-step="down" type="button" aria-label="분할 칸 수 감소" title="감소">
                    <span aria-hidden="true">▼</span>
                  </button>
                </span>
              </span>
            </label>
            <button class="template-tool-button" data-template-cell-split-confirm="true" type="button">셀 분할</button>
          </div>
        </div>
      `;
    }

    function renderEditorToolbarImageInsertPopover({
      panelId = "",
      openImageAttr = "",
    } = {}) {
      return `
        <div
          class="template-toolbar-table-insert-popover examlist-image-insert-popover"
          data-editor-table-insert-popover="${escapeEditorToolbarAttribute(panelId)}"
        >
          <button
            class="template-tool-button icon-only template-toolbar-table-insert-toggle examlist-object-insert-button"
            ${renderEditorToolbarAttribute("data-template-image-insert-toggle", panelId)}
            ${renderEditorToolbarAttribute("data-editor-table-insert-toggle", panelId)}
            type="button"
            aria-label="이미지 삽입"
            title="이미지 삽입"
            aria-expanded="false"
            aria-controls="${escapeEditorToolbarAttribute(panelId)}"
          >
            ${EDITOR_TOOLBAR_ICON_MARKUP.openImage}
            <span class="sr-only">이미지 삽입</span>
          </button>
          <div
            class="template-table-insert-panel examlist-image-insert-panel hidden"
            id="${escapeEditorToolbarAttribute(panelId)}"
            role="group"
            aria-label="이미지 삽입 방식"
          >
            <button class="template-tool-button" ${renderEditorToolbarAttribute(openImageAttr, "true")} type="button">파일 선택</button>
            <button class="template-tool-button" data-template-insert-school-logo="true" type="button">학교 로고</button>
          </div>
        </div>
      `;
    }

    return Object.freeze({
      escapeEditorToolbarAttribute,
      escapeEditorToolbarHtml,
      renderEditorToolbarAttribute,
      renderEditorToolbarBorderSection,
      renderEditorToolbarCellPaddingSection,
      renderEditorToolbarCellSplitPopover,
      renderEditorToolbarColorPickerSection,
      renderEditorToolbarFontOptions,
      getEditorToolbarFontFamilyLabel,
      renderEditorToolbarFontFamilyOptionButtons,
      renderEditorToolbarFontSizeOptionButtons,
      renderEditorToolbarIconButton,
      renderEditorToolbarImageInsertPopover,
      renderEditorToolbarLabeledControl,
      renderEditorToolbarTableInsertPopover,
      renderEditorToolbarTextButton,
    });
  }

  return Object.freeze({
    createEditorToolbarMarkupHelpers,
  });
});

})();
