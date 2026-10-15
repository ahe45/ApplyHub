(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorSelection = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const selectionHistoryModule = globalThis.ExamListTemplateEditorSelectionHistory;
  const selectionStateModule = globalThis.ExamListTemplateEditorSelectionState;
  const tokenContentModule = globalThis.ExamListTemplateEditorTokenContent;

  if (!selectionHistoryModule?.createTemplateEditorSelectionHistoryController) {
    throw new Error("client/features/template-editor/selection-history.js must be loaded before client/features/template-editor/selection.js.");
  }

  if (!selectionStateModule?.createTemplateEditorSelectionStateController) {
    throw new Error("client/features/template-editor/selection-state.js must be loaded before client/features/template-editor/selection.js.");
  }

  if (!tokenContentModule?.createTemplateEditorTokenContentController) {
    throw new Error("client/features/template-editor/token-content.js must be loaded before client/features/template-editor/selection.js.");
  }

  const { createTemplateEditorSelectionHistoryController } = selectionHistoryModule;
  const { createTemplateEditorSelectionStateController } = selectionStateModule;
  const { createTemplateEditorTokenContentController } = tokenContentModule;

  function createTemplateEditorSelectionController({
    TEMPLATE_EDITOR_HISTORY_LIMIT,
    clearTemplateEditorImageSelection,
    clearTemplateEditorTableSelection,
    decorateTemplateEditorImages,
    focusTemplateEditorCell,
    getTemplateEditorActiveTableSelection,
    getTemplateEditorModal,
    getTemplateEditorSelectedCell,
    getTemplateEditorStatusElement,
    getTemplateEditorTagDisplay,
    getTemplateEditorSurface,
    normalizeTemplateEditorFontNodes,
    normalizeTemplateEditorTables,
    releaseTemplateEditorTableResizeSession,
    releaseTemplateEditorTableSelectionSession,
    state,
    templateTagDefinitions,
    updateTemplateEditorFormattingControls,
    updateTemplateEditorImageSelectionOverlay,
    updateTemplateTableControls,
  }) {
    const tokenContentController = createTemplateEditorTokenContentController({
      decorateTemplateEditorImages,
      getTemplateEditorTagDisplay,
      getTemplateEditorSurface,
      normalizeTemplateEditorFontNodes,
      normalizeTemplateEditorTables,
      templateTagDefinitions,
    });
    const {
      buildTemplateTokenHtml,
      escapeAttribute,
      escapeHtml,
      escapeRegExp,
      getTemplateEditorSerializedHtml,
      getTemplateEditorTagText,
      normalizeTemplateTag,
      normalizeTemplateTagNodes,
      prepareTemplateEditorContent,
      stripTemplateEditorTransientState,
    } = tokenContentController;

    let initializeTemplateEditorHistory = () => {};
    let redoTemplateEditorHistory = () => {};
    let syncTemplateEditorContent = () => {};
    let undoTemplateEditorHistory = () => {};
    const selectionStateController = createTemplateEditorSelectionStateController({
      focusTemplateEditorCell,
      getTemplateEditorActiveTableSelection,
      getTemplateEditorModal,
      getTemplateEditorSelectedCell,
      getTemplateEditorStatusElement,
      getTemplateEditorSurface,
      state,
      syncTemplateEditorContent: (...args) => syncTemplateEditorContent(...args),
      updateTemplateEditorFormattingControls,
    });
    const {
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
    } = selectionStateController;

    const selectionHistoryController = createTemplateEditorSelectionHistoryController({
      TEMPLATE_EDITOR_HISTORY_LIMIT,
      clearTemplateEditorImageSelection,
      clearTemplateEditorTableSelection,
      createTemplateEditorSelectionSnapshot,
      decorateTemplateEditorImages,
      getTemplateEditorActiveTableSelection,
      getTemplateEditorSerializedHtml,
      getTemplateEditorSurface,
      normalizeTemplateEditorFontNodes,
      normalizeTemplateEditorTables,
      normalizeTemplateTagNodes,
      placeCaretAtTemplateEditorEnd,
      releaseTemplateEditorTableResizeSession,
      releaseTemplateEditorTableSelectionSession,
      restoreTemplateEditorSelectionSnapshot,
      saveTemplateEditorSelection,
      setTemplateEditorStatus,
      state,
      updateTemplateEditorActiveCell,
      updateTemplateEditorFormattingControls,
      updateTemplateEditorImageSelectionOverlay,
      updateTemplateTableControls,
    });
    ({
      initializeTemplateEditorHistory,
      redoTemplateEditorHistory,
      syncTemplateEditorContent,
      undoTemplateEditorHistory,
    } = selectionHistoryController);

    return Object.freeze({
      buildTemplateTokenHtml,
      clearTemplateEditorActiveCell,
      escapeAttribute,
      escapeHtml,
      escapeRegExp,
      getClosestTemplateEditorElement,
      getTemplateEditorSelectionNode,
      getTemplateEditorSerializedHtml,
      getTemplateEditorTagText,
      handleTemplateEditorTokenDeletion,
      initializeTemplateEditorHistory,
      normalizeTemplateTag,
      normalizeTemplateTagNodes,
      prepareTemplateEditorContent,
      redoTemplateEditorHistory,
      restoreTemplateEditorSelection,
      saveTemplateEditorSelection,
      setTemplateEditorStatus,
      stripTemplateEditorTransientState,
      syncTemplateEditorContent,
      undoTemplateEditorHistory,
      updateTemplateEditorActiveCell,
    });
  }

  return Object.freeze({
    createTemplateEditorSelectionController,
  });
});

})();
