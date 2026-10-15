(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListEditorToolbarColorMarkup = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createEditorToolbarColorMarkup({
    escapeEditorToolbarAttribute,
    escapeEditorToolbarHtml,
    normalizeEditorToolbarColorValue,
    renderEditorToolbarAttribute,
  }) {
    function isEditorToolbarNoColorValue(value = "") {
      const normalizedValue = String(value || "").trim().toLowerCase().replace(/\s+/g, "");

      return normalizedValue === "transparent" || normalizedValue === "none" || normalizedValue === "rgba(0,0,0,0)";
    }

    function renderEditorToolbarColorPresetButtons({
      inputId = "",
      inputValue = "#ffffff",
      presetColors = [],
      colorCommand = "",
      colorTableAction = "",
      fallbackValue = "#ffffff",
    }) {
      const selectedNoColor = isEditorToolbarNoColorValue(inputValue);
      const normalizedSelectedValue = selectedNoColor ? "transparent" : normalizeEditorToolbarColorValue(inputValue, fallbackValue);

      return presetColors
        .map((preset) => {
          const isNoColor = Boolean(preset.noColor) || isEditorToolbarNoColorValue(preset.value);
          const normalizedPresetValue = isNoColor ? "transparent" : normalizeEditorToolbarColorValue(preset.value, fallbackValue);
          const isActive = isNoColor ? selectedNoColor : normalizedPresetValue === normalizedSelectedValue;
          const swatchClassName = `template-toolbar-color-swatch${isNoColor ? " is-no-color" : ""}${isActive ? " active" : ""}`;

          return `
            <button
              class="${swatchClassName}"
              data-editor-color-input="${escapeEditorToolbarAttribute(inputId)}"
              data-editor-color-preset="${escapeEditorToolbarAttribute(normalizedPresetValue)}"
              ${isNoColor ? 'data-editor-color-none="true"' : ""}
              ${colorCommand ? renderEditorToolbarAttribute("data-editor-color-command", colorCommand) : ""}
              ${colorTableAction ? renderEditorToolbarAttribute("data-editor-color-table-action", colorTableAction) : ""}
              type="button"
              aria-label="${escapeEditorToolbarAttribute(preset.label)}"
              aria-pressed="${isActive ? "true" : "false"}"
              title="${escapeEditorToolbarAttribute(preset.label)}"
              style="--editor-toolbar-swatch-color: ${escapeEditorToolbarAttribute(isNoColor ? "#ffffff" : normalizedPresetValue)};"
            >
              <span class="sr-only">${escapeEditorToolbarHtml(preset.label)}</span>
            </button>
          `;
        })
        .join("");
    }

    function renderEditorToolbarColorPickerSection({
      sectionLabel = "색상",
      inputId = "",
      inputValue = "#ffffff",
      presetColors = [],
      colorCommand = "",
      colorTableAction = "",
      fallbackValue = "#ffffff",
      sectionClassName = "",
      pickerClassName = "",
      triggerLabel = "선택",
    } = {}) {
      const panelId = `${inputId}Panel`;
      const inputNoColor = isEditorToolbarNoColorValue(inputValue);
      const normalizedInputValue = inputNoColor ? "transparent" : normalizeEditorToolbarColorValue(inputValue, fallbackValue);
      const colorInputValue = inputNoColor ? normalizeEditorToolbarColorValue(fallbackValue, "#ffffff") : normalizedInputValue;
      const sectionClassNames = ["template-toolbar-section", sectionClassName].filter(Boolean).join(" ");
      const pickerClassNames = ["template-toolbar-color-picker", inputNoColor ? "is-no-color" : "", pickerClassName].filter(Boolean).join(" ");

      return `
        <div class="${escapeEditorToolbarAttribute(sectionClassNames)}">
          <span class="template-toolbar-section-label">${escapeEditorToolbarHtml(sectionLabel)}</span>
          <div class="template-toolbar-group-controls">
            <div
              class="${escapeEditorToolbarAttribute(pickerClassNames)}"
              data-editor-color-picker="${escapeEditorToolbarAttribute(inputId)}"
              style="--editor-toolbar-current-color: ${escapeEditorToolbarAttribute(normalizedInputValue)};"
            >
              <button
                class="template-toolbar-color-trigger"
                data-editor-color-toggle="${escapeEditorToolbarAttribute(inputId)}"
                type="button"
                aria-expanded="false"
                aria-controls="${escapeEditorToolbarAttribute(panelId)}"
              >
                <span class="template-toolbar-color-trigger-swatch" aria-hidden="true"></span>
                <span class="template-toolbar-color-trigger-label">${escapeEditorToolbarHtml(triggerLabel)}</span>
                <span class="template-toolbar-color-trigger-caret" aria-hidden="true"></span>
              </button>
              <div class="template-toolbar-color-panel hidden" id="${escapeEditorToolbarAttribute(panelId)}">
                <div class="template-toolbar-color-presets" role="group" aria-label="${escapeEditorToolbarAttribute(`${sectionLabel} 프리셋`)}">
                  ${renderEditorToolbarColorPresetButtons({
                    inputId,
                    inputValue: normalizedInputValue,
                    presetColors,
                    colorCommand,
                    colorTableAction,
                    fallbackValue,
                  })}
                </div>
                <div class="template-toolbar-color-panel-actions">
                  <button
                    class="template-toolbar-color-direct-button"
                    data-editor-color-direct="true"
                    data-editor-color-input="${escapeEditorToolbarAttribute(inputId)}"
                    ${colorCommand ? renderEditorToolbarAttribute("data-editor-color-command", colorCommand) : ""}
                    ${colorTableAction ? renderEditorToolbarAttribute("data-editor-color-table-action", colorTableAction) : ""}
                    type="button"
                  >
                    <span class="template-toolbar-color-direct-swatch" aria-hidden="true"></span>
                    <span>직접 선택</span>
                  </button>
                </div>
                <input
                  class="template-toolbar-color template-toolbar-color-input-hidden"
                  id="${escapeEditorToolbarAttribute(inputId)}"
                  ${colorCommand ? renderEditorToolbarAttribute("data-editor-color-command", colorCommand) : ""}
                  ${colorTableAction ? renderEditorToolbarAttribute("data-editor-color-table-action", colorTableAction) : ""}
                  type="color"
                  value="${escapeEditorToolbarAttribute(colorInputValue)}"
                  tabindex="-1"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        </div>
      `;
    }

    return Object.freeze({
      renderEditorToolbarColorPickerSection,
      renderEditorToolbarColorPresetButtons,
    });
  }

  return Object.freeze({
    createEditorToolbarColorMarkup,
  });
});

})();
