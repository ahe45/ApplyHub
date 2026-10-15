(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorToolbarColorInteractions = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function normalizeTemplateToolbarHexColorValue(rawValue) {
    const trimmedValue = String(rawValue || "").trim();

    if (!trimmedValue) {
      return "";
    }

    const prefixedValue = trimmedValue.startsWith("#") ? trimmedValue : `#${trimmedValue}`;

    if (/^#[0-9a-f]{6}$/i.test(prefixedValue)) {
      return prefixedValue.toLowerCase();
    }

    const shortHexMatch = prefixedValue.match(/^#([0-9a-f]{3})$/i);

    if (shortHexMatch) {
      return `#${shortHexMatch[1]
        .split("")
        .map((value) => value.repeat(2))
        .join("")
        .toLowerCase()}`;
    }

    return "";
  }

  function createTemplateEditorToolbarColorInteractionController({
    applyTemplateEditorCommand,
    getElementById,
    handleTemplateTableAction,
    toolbar,
    toolbarIds,
  }) {
    function isTemplateToolbarNoColorValue(value = "") {
      const normalizedValue = String(value || "").trim().toLowerCase().replace(/\s+/g, "");

      return normalizedValue === "transparent" || normalizedValue === "none" || normalizedValue === "rgba(0,0,0,0)";
    }

    function applyToolbarColorTrigger(triggerElement) {
      const colorInputId = triggerElement?.dataset?.editorColorInput || "";
      const colorCommand = triggerElement?.dataset?.editorColorCommand || "";
      const colorTableAction = triggerElement?.dataset?.editorColorTableAction || "";
      const colorInputElement = getElementById(colorInputId);
      const colorValue =
        triggerElement?.dataset?.editorColorNone === "true"
          ? "transparent"
          : triggerElement?.dataset?.editorColorPreset || colorInputElement?.value || "";
      const fallbackValue =
        typeof toolbar.getEditorToolbarColorFallback === "function"
          ? toolbar.getEditorToolbarColorFallback(colorCommand, colorTableAction)
          : colorTableAction === "apply-cell-border"
            ? "#000000"
            : "#ffffff";

      if (colorInputElement && colorValue && !isTemplateToolbarNoColorValue(colorValue)) {
        colorInputElement.value = colorValue;
      }

      if (colorInputElement && colorValue) {
        toolbar.syncEditorToolbarColorControls({ colorInputElement, colorValue, fallbackValue });
      }

      if (colorCommand) {
        applyTemplateEditorCommand(colorCommand, colorValue);
      }

      if (colorTableAction) {
        if (colorTableAction === "apply-cell-border" && colorInputId === toolbarIds.borderColor) {
          if (colorInputElement?.dataset) {
            colorInputElement.dataset.editorBorderUserValue = "true";
          }

          return;
        }

        handleTemplateTableAction(colorTableAction, { colorValue });
      }
    }

    function applyToolbarHexColorInput(hexInputElement, { commit = false } = {}) {
      if (!(hexInputElement instanceof HTMLInputElement)) {
        return false;
      }

      const normalizedColorValue = normalizeTemplateToolbarHexColorValue(hexInputElement.value);
      const colorInputId = hexInputElement.dataset.editorColorInput || "";
      const colorInputElement = getElementById(colorInputId);

      if (!normalizedColorValue) {
        if (commit && colorInputElement) {
          hexInputElement.value = colorInputElement.value || "";
        }

        return false;
      }

      if (colorInputElement) {
        colorInputElement.value = normalizedColorValue;
      }

      hexInputElement.value = normalizedColorValue;
      applyToolbarColorTrigger(hexInputElement);
      return true;
    }

    return Object.freeze({
      applyToolbarColorTrigger,
      applyToolbarHexColorInput,
    });
  }

  return Object.freeze({
    createTemplateEditorToolbarColorInteractionController,
    normalizeTemplateToolbarHexColorValue,
  });
});

})();
