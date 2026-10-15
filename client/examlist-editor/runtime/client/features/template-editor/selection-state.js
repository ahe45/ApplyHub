(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorSelectionState = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const selectionRangeModule = globalThis.ExamListTemplateEditorSelectionRange;
  const selectionTokenModule = globalThis.ExamListTemplateEditorSelectionTokens;

  if (!selectionRangeModule?.createTemplateEditorSelectionRangeController) {
    throw new Error("client/features/template-editor/selection-range.js must be loaded before client/features/template-editor/selection-state.js.");
  }

  if (!selectionTokenModule?.createTemplateEditorSelectionTokenController) {
    throw new Error("client/features/template-editor/selection-tokens.js must be loaded before client/features/template-editor/selection-state.js.");
  }

  const { createTemplateEditorSelectionRangeController } = selectionRangeModule;
  const { createTemplateEditorSelectionTokenController } = selectionTokenModule;

  function createTemplateEditorSelectionStateController({
    focusTemplateEditorCell,
    getTemplateEditorActiveTableSelection,
    getTemplateEditorModal,
    getTemplateEditorSelectedCell,
    getTemplateEditorStatusElement,
    getTemplateEditorSurface,
    state,
    syncTemplateEditorContent,
    updateTemplateEditorFormattingControls,
  }) {
    function setTemplateEditorStatus(message, type = "") {
      state.templateEditor.statusMessage = message;
      state.templateEditor.statusType = type;

      const templateEditorSurface = getTemplateEditorSurface?.();
      const CustomEventConstructor =
        templateEditorSurface?.ownerDocument?.defaultView?.CustomEvent || globalThis.CustomEvent;

      if (templateEditorSurface && typeof CustomEventConstructor === "function") {
        templateEditorSurface.dispatchEvent(
          new CustomEventConstructor("template-editor-status", {
            bubbles: true,
            detail: {
              message,
              type,
            },
          }),
        );
      }

      const templateEditorStatus = getTemplateEditorStatusElement();

      if (!templateEditorStatus) {
        return;
      }

      templateEditorStatus.textContent = message;
      templateEditorStatus.classList.toggle("warning", type === "warning");
    }

    function clearTemplateEditorActiveCell() {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface) {
        return;
      }

      templateEditorSurface
        .querySelectorAll(".is-active-cell")
        .forEach((cell) => cell.classList.remove("is-active-cell"));
      state.templateEditor.activeCellElement = null;
    }

    function updateTemplateEditorActiveCell() {
      const templateEditorSurface = getTemplateEditorSurface();
      const templateEditorModal = getTemplateEditorModal();

      if (!templateEditorSurface || !templateEditorModal || templateEditorModal.classList.contains("hidden")) {
        return;
      }

      clearTemplateEditorActiveCell();

      if (
        state.templateEditor.selectedImageElement &&
        templateEditorSurface.contains(state.templateEditor.selectedImageElement)
      ) {
        return;
      }

      if (getTemplateEditorActiveTableSelection()) {
        return;
      }

      const activeCell = getTemplateEditorSelectedCell();

      if (activeCell) {
        activeCell.classList.add("is-active-cell");
        state.templateEditor.activeCellElement = activeCell;
      }
    }

    const selectionRangeController = createTemplateEditorSelectionRangeController({
      focusTemplateEditorCell,
      getTemplateEditorActiveTableSelection,
      getTemplateEditorModal,
      getTemplateEditorSurface,
      state,
      updateTemplateEditorActiveCell,
    });
    const {
      createTemplateEditorSelectionSnapshot,
      getClosestTemplateEditorElement,
      getTemplateEditorSelectionNode,
      placeCaretAtTemplateEditorEnd,
      restoreTemplateEditorSelection,
      restoreTemplateEditorSelectionSnapshot,
      saveTemplateEditorSelection,
      setTemplateEditorCollapsedSelection,
    } = selectionRangeController;
    const selectionTokenController = createTemplateEditorSelectionTokenController({
      getTemplateEditorSurface,
      setTemplateEditorCollapsedSelection,
      state,
      syncTemplateEditorContent,
    });
    const { handleTemplateEditorTokenDeletion } = selectionTokenController;

    return Object.freeze({
      clearTemplateEditorActiveCell,
      createTemplateEditorSelectionSnapshot,
      getClosestTemplateEditorElement,
      getTemplateEditorSelectionNode,
      handleTemplateEditorTokenDeletion,
      placeCaretAtTemplateEditorEnd,
      restoreTemplateEditorSelection,
      restoreTemplateEditorSelectionSnapshot,
      saveTemplateEditorSelection,
      setTemplateEditorStatus,
      updateTemplateEditorActiveCell,
    });
  }

  return Object.freeze({
    createTemplateEditorSelectionStateController,
  });
});

})();
