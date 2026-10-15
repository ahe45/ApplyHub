(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListEditorToolbarColorUi = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createEditorToolbarColorUiController({
    closeAllEditorToolbarBorderSelectMenus,
    closeAllEditorToolbarFontFamilyMenus,
    closeAllEditorToolbarFontSizeMenus,
    closeAllEditorToolbarTableInsertPanels,
    normalizeEditorToolbarColorValue,
    updateEditorToolbarFloatingPanelPlacement,
  }) {
    function isEditorToolbarNoColorValue(value = "") {
      const normalizedValue = String(value || "").trim().toLowerCase().replace(/\s+/g, "");

      return normalizedValue === "transparent" || normalizedValue === "none" || normalizedValue === "rgba(0,0,0,0)";
    }

    function getEditorToolbarColorPickerElements(colorInputId = "") {
      const normalizedColorInputId = String(colorInputId || "").trim();
      const inputElement = normalizedColorInputId ? document.getElementById(normalizedColorInputId) : null;
      const pickerElement =
        inputElement?.closest(".template-toolbar-color-picker") ||
        (normalizedColorInputId
          ? document.querySelector(`.template-toolbar-color-picker[data-editor-color-picker="${normalizedColorInputId}"]`)
          : null);
      const toggleElement = pickerElement?.querySelector("[data-editor-color-toggle]") || null;
      const panelElement = pickerElement?.querySelector(".template-toolbar-color-panel") || null;

      return { inputElement, pickerElement, toggleElement, panelElement };
    }

    function syncEditorToolbarColorControls({
      colorInputElement = null,
      colorValue = "",
      fallbackValue = "#ffffff",
    } = {}) {
      const inputElement =
        colorInputElement instanceof HTMLInputElement
          ? colorInputElement
          : typeof colorInputElement === "string" && colorInputElement
            ? document.getElementById(colorInputElement)
            : null;

      if (!inputElement) {
        return fallbackValue;
      }

      const isNoColor = isEditorToolbarNoColorValue(colorValue);
      const normalizedColorValue = isNoColor
        ? "transparent"
        : normalizeEditorToolbarColorValue(colorValue || inputElement.value || "", fallbackValue);

      if (isNoColor) {
        inputElement.dataset.editorColorNone = "true";
      } else {
        delete inputElement.dataset.editorColorNone;
        inputElement.value = normalizedColorValue;
      }

      const pickerElement = inputElement.closest(".template-toolbar-color-picker");

      if (!pickerElement) {
        return normalizedColorValue;
      }

      pickerElement.style.setProperty("--editor-toolbar-current-color", normalizedColorValue);
      pickerElement.classList.toggle("is-no-color", isNoColor);

      pickerElement.querySelectorAll("[data-editor-color-hex-input]").forEach((hexInputElement) => {
        hexInputElement.value = isNoColor ? "" : normalizedColorValue;
      });

      pickerElement.querySelectorAll("[data-editor-color-preset]").forEach((buttonElement) => {
        const isNoColorPreset = buttonElement.dataset.editorColorNone === "true";
        const presetValue = isNoColorPreset
          ? "transparent"
          : normalizeEditorToolbarColorValue(buttonElement.dataset.editorColorPreset || "", fallbackValue);
        const isActive = isNoColor ? isNoColorPreset : presetValue === normalizedColorValue;

        buttonElement.classList.toggle("active", isActive);
        buttonElement.setAttribute("aria-pressed", isActive ? "true" : "false");
      });

      return normalizedColorValue;
    }

    function closeAllEditorToolbarColorPanels(exceptColorInputId = "") {
      let closedAnyPanel = false;

      Array.from(document.querySelectorAll(".template-toolbar-color-picker")).forEach((pickerElement) => {
        const inputElement = pickerElement.querySelector(".template-toolbar-color");
        const toggleElement = pickerElement.querySelector("[data-editor-color-toggle]");
        const panelElement = pickerElement.querySelector(".template-toolbar-color-panel");
        const shouldKeepOpen =
          exceptColorInputId &&
          inputElement?.id === exceptColorInputId &&
          panelElement &&
          !panelElement.classList.contains("hidden");

        if (!panelElement || shouldKeepOpen || panelElement.classList.contains("hidden")) {
          return;
        }

        panelElement.classList.add("hidden");
        pickerElement.classList.remove("open", "open-up", "open-down");
        toggleElement?.setAttribute("aria-expanded", "false");
        closedAnyPanel = true;
      });

      return closedAnyPanel;
    }

    function setEditorToolbarColorPanelVisibility(colorInputId = "", nextVisible = false) {
      const { inputElement, pickerElement, toggleElement, panelElement } = getEditorToolbarColorPickerElements(colorInputId);

      if (!inputElement || !panelElement) {
        return false;
      }

      if (nextVisible) {
        closeAllEditorToolbarColorPanels(colorInputId);
        closeAllEditorToolbarTableInsertPanels();
        closeAllEditorToolbarFontFamilyMenus();
        closeAllEditorToolbarFontSizeMenus();
        closeAllEditorToolbarBorderSelectMenus();
      }

      panelElement.classList.toggle("hidden", !nextVisible);
      pickerElement.classList.toggle("open", nextVisible);
      toggleElement?.setAttribute("aria-expanded", nextVisible ? "true" : "false");

      if (nextVisible) {
        updateEditorToolbarFloatingPanelPlacement(pickerElement, panelElement, 8);
      } else {
        pickerElement.classList.remove("open-up", "open-down");
      }

      return true;
    }

    return Object.freeze({
      closeAllEditorToolbarColorPanels,
      getEditorToolbarColorPickerElements,
      setEditorToolbarColorPanelVisibility,
      syncEditorToolbarColorControls,
    });
  }

  return Object.freeze({
    createEditorToolbarColorUiController,
  });
});

})();
