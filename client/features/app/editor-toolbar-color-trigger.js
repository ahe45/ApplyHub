(function (globalScope, factory) {
  const moduleApi = factory(globalScope);

  if (typeof module === "object" && module.exports) {
    module.exports = moduleApi;
    return;
  }

  globalScope.AdmitCardEditorToolbarColorTrigger = moduleApi;
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  function createEditorToolbarColorTriggerHandler({
    applyLoginNoticeEditorCommand,
    applyTemplateEditorCommand,
    getEditorToolbarColorFallback,
    handleLoginNoticeTableAction,
    handleTemplateTableAction,
    syncEditorToolbarColorControls,
  }) {
    return function applyEditorToolbarColorTrigger(triggerElement) {
      if (!globalScope.Element || !(triggerElement instanceof globalScope.Element)) {
        return;
      }

      const inputId = String(triggerElement.dataset.editorColorInput || "").trim();
      const colorCommand = String(triggerElement.dataset.editorColorCommand || "").trim();
      const colorTableAction = String(triggerElement.dataset.editorColorTableAction || "").trim();
      const fallbackValue = getEditorToolbarColorFallback(colorCommand, colorTableAction);
      const inputElement =
        (inputId ? globalScope.document.getElementById(inputId) : null) ||
        triggerElement.closest(".template-toolbar-color-picker")?.querySelector(".template-toolbar-color") ||
        null;
      const rawColorValue = String(triggerElement.dataset.editorColorPreset || triggerElement.dataset.editorColorValue || inputElement?.value || "");
      const normalizedColorValue = syncEditorToolbarColorControls({
        colorInputElement: inputElement,
        colorValue: rawColorValue,
        fallbackValue,
      });
      const shouldDeferBorderColorApply =
        colorTableAction === "apply-cell-border" &&
        (inputElement?.id === "templateEditorBorderColor" || inputElement?.id === "loginNoticeBorderColor");

      if (colorCommand) {
        if (triggerElement.closest(".login-notice-editor-toolbar")) {
          applyLoginNoticeEditorCommand(colorCommand, normalizedColorValue);
        } else {
          applyTemplateEditorCommand(colorCommand, normalizedColorValue);
        }
        return;
      }

      if (!colorTableAction) {
        return;
      }

      if (shouldDeferBorderColorApply) {
        if (inputElement?.dataset) {
          inputElement.dataset.editorBorderUserValue = "true";
        }

        return;
      }

      if (triggerElement.closest(".login-notice-editor-toolbar")) {
        handleLoginNoticeTableAction(colorTableAction, { colorValue: normalizedColorValue });
      } else {
        handleTemplateTableAction(colorTableAction, { colorValue: normalizedColorValue });
      }
    };
  }

  return Object.freeze({
    createEditorToolbarColorTriggerHandler,
  });
});
