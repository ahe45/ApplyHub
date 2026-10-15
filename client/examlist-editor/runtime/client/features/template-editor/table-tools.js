(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableTools = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const tableActionModule = globalThis.ExamListTemplateEditorTableActions;
  const tableCellStateModule = globalThis.ExamListTemplateEditorTableToolsCellState;
  const tableInteractionModule = globalThis.ExamListTemplateEditorTableInteraction;
  const tableLogicalSizingModule = globalThis.ExamListTemplateEditorTableToolsLogicalSizing;

  if (!tableActionModule?.createTemplateEditorTableActionController) {
    throw new Error("client/features/template-editor/table-actions.js must be loaded before table-tools.js.");
  }

  if (!tableCellStateModule?.createTemplateEditorTableCellStateController) {
    throw new Error("client/features/template-editor/table-tools-cell-state.js must be loaded before table-tools.js.");
  }

  if (!tableInteractionModule?.createTemplateEditorTableInteractionController) {
    throw new Error("client/features/template-editor/table-interaction.js must be loaded before table-tools.js.");
  }

  if (!tableLogicalSizingModule?.createTemplateEditorTableLogicalSizingController) {
    throw new Error("client/features/template-editor/table-tools-logical-sizing.js must be loaded before table-tools.js.");
  }

  const { createTemplateEditorTableActionController } = tableActionModule;
  const { createTemplateEditorTableCellStateController } = tableCellStateModule;
  const { createTemplateEditorTableInteractionController } = tableInteractionModule;
  const { createTemplateEditorTableLogicalSizingController } = tableLogicalSizingModule;

  function createTemplateEditorTableController({
    TEMPLATE_EDITOR_DEFAULT_TABLE_HEADER_BACKGROUND,
    TEMPLATE_EDITOR_TABLE_EDGE_THRESHOLD,
    TEMPLATE_EDITOR_TABLE_MIN_SIZE,
    TEMPLATE_EDITOR_TABLE_SELECTION_DRAG_THRESHOLD,
    applyTemplateTableCellPresentation,
    buildTemplateTableCellMap,
    clearTemplateEditorImageSelection,
    ensureTemplateEditorTableColGroup,
    getClosestTemplateEditorElement,
    getTemplateEditorDocumentElement,
    getTemplateEditorSelectionNode,
    getTemplateEditorSurface,
    getTemplateEditorModal,
    getTemplateEditorBorderColorInput,
    getTemplateEditorBorderStyleInput,
    getTemplateEditorBorderTargetInput,
    getTemplateEditorBorderWidthInput,
    getTemplateEditorCellPaddingBottomInput,
    getTemplateEditorCellPaddingLeftInput,
    getTemplateEditorCellPaddingRightInput,
    getTemplateEditorCellPaddingTopInput,
    getTemplateEditorCellShadingInput,
    getTemplateEditorCellWidthInput,
    getTemplateEditorRowHeightInput,
    getTemplateEditorSizeScopeInput,
    getTemplateEditorMeasuredColumnWidth,
    normalizeTemplateEditorColorValue,
    normalizeTemplateEditorTableAppearance,
    parseTemplateEditorPixelStyle,
    placeCaretAtEnd,
    restoreTemplateEditorSelection,
    setTemplateEditorStatus,
    state,
    syncTemplateEditorContent,
    syncTemplateEditorTableWidth,
    updateTemplateEditorActiveCell,
    updateTemplateEditorFormattingControls,
    updateTemplateTableControls,
  }) {
    const {
      createTemplateTableCell,
      focusTemplateEditorCell,
      getTemplateEditorCellShadingValue,
      getTemplateEditorPixelValue,
    } = createTemplateEditorTableCellStateController({
      TEMPLATE_EDITOR_DEFAULT_TABLE_HEADER_BACKGROUND,
      applyTemplateTableCellPresentation,
      getTemplateEditorSurface,
      normalizeTemplateEditorColorValue,
      placeCaretAtEnd,
      state,
      updateTemplateEditorActiveCell,
      updateTemplateEditorFormattingControls,
    });
    const {
      getTemplateEditorClampedColumnGroupWidth,
      getTemplateEditorTableLogicalColumnWidth,
      getTemplateEditorTableLogicalRowHeight,
      setTemplateEditorTableLogicalColumnWidth,
      setTemplateEditorTableLogicalColumnWidths,
      setTemplateEditorTableLogicalRowHeight,
    } = createTemplateEditorTableLogicalSizingController({
      TEMPLATE_EDITOR_TABLE_MIN_SIZE,
      buildTemplateTableCellMap,
      ensureTemplateEditorTableColGroup,
      getTemplateEditorDocumentElement,
      getTemplateEditorMeasuredColumnWidth,
      getTemplateEditorSurface,
      parseTemplateEditorPixelStyle,
      syncTemplateEditorTableWidth,
    });

    const tableInteractionController = createTemplateEditorTableInteractionController({
      TEMPLATE_EDITOR_TABLE_EDGE_THRESHOLD,
      TEMPLATE_EDITOR_TABLE_MIN_SIZE,
      TEMPLATE_EDITOR_TABLE_SELECTION_DRAG_THRESHOLD,
      buildTemplateTableCellMap,
      clearTemplateEditorImageSelection,
      focusTemplateEditorCell,
      getClosestTemplateEditorElement,
      getTemplateEditorModal,
      getTemplateEditorSelectionNode,
      getTemplateEditorSurface,
      getTemplateEditorTableLogicalColumnWidth,
      getTemplateEditorTableLogicalRowHeight,
      setTemplateEditorTableLogicalColumnWidth,
      setTemplateEditorTableLogicalColumnWidths,
      setTemplateEditorTableLogicalRowHeight,
      state,
      syncTemplateEditorContent,
      updateTemplateTableControls,
    });

    const {
      clearTemplateEditorTableHoverState,
      clearTemplateEditorTableSelection,
      getTemplateEditorActiveTableSelection,
      getTemplateEditorSelectedCell,
      getTemplateEditorSelectedTable,
      handleTemplateEditorTablePointerDown,
      releaseTemplateEditorTableResizeSession,
      releaseTemplateEditorTableSelectionSession,
      updateTemplateEditorTableHoverState,
    } = tableInteractionController;
    const tableActionController = createTemplateEditorTableActionController({
      TEMPLATE_EDITOR_TABLE_MIN_SIZE,
      buildTemplateTableCellMap,
      createTemplateTableCell,
      ensureTemplateEditorTableColGroup,
      focusTemplateEditorCell,
      getTemplateEditorClampedColumnGroupWidth,
      getTemplateEditorActiveTableSelection,
      getTemplateEditorBorderColorInput,
      getTemplateEditorBorderStyleInput,
      getTemplateEditorBorderTargetInput,
      getTemplateEditorBorderWidthInput,
      getTemplateEditorCellPaddingBottomInput,
      getTemplateEditorCellPaddingLeftInput,
      getTemplateEditorCellPaddingRightInput,
      getTemplateEditorCellPaddingTopInput,
      getTemplateEditorCellShadingInput,
      getTemplateEditorCellWidthInput,
      getTemplateEditorRowHeightInput,
      getTemplateEditorSelectedCell,
      getTemplateEditorSizeScopeInput,
      getTemplateEditorTableLogicalColumnWidth,
      getTemplateEditorTableLogicalRowHeight,
      normalizeTemplateEditorColorValue,
      normalizeTemplateEditorTableAppearance,
      restoreTemplateEditorSelection,
      setTemplateEditorStatus,
      setTemplateEditorTableLogicalColumnWidth,
      setTemplateEditorTableLogicalColumnWidths,
      setTemplateEditorTableLogicalRowHeight,
      syncTemplateEditorContent,
      updateTemplateTableControls,
    });

    const {
      appendMergedTemplateCellContent,
      applyTemplateTableSize,
      getTemplateEditorMedianValue,
      handleTemplateTableAction,
      insertTemplateCellAtAbsoluteColumn,
      isTemplateTableCellEmpty,
    } = tableActionController;

    return Object.freeze({
      appendMergedTemplateCellContent,
      applyTemplateTableSize,
      clearTemplateEditorTableHoverState,
      clearTemplateEditorTableSelection,
      createTemplateTableCell,
      focusTemplateEditorCell,
      getTemplateEditorActiveTableSelection,
      getTemplateEditorCellShadingValue,
      getTemplateEditorMedianValue,
      getTemplateEditorPixelValue,
      getTemplateEditorSelectedCell,
      getTemplateEditorSelectedTable,
      getTemplateEditorTableLogicalColumnWidth,
      getTemplateEditorTableLogicalRowHeight,
      handleTemplateEditorTablePointerDown,
      handleTemplateTableAction,
      isTemplateTableCellEmpty,
      insertTemplateCellAtAbsoluteColumn,
      releaseTemplateEditorTableResizeSession,
      releaseTemplateEditorTableSelectionSession,
      setTemplateEditorTableLogicalColumnWidths,
      setTemplateEditorTableLogicalRowHeight,
      updateTemplateEditorTableHoverState,
    });
  }

  return Object.freeze({
    createTemplateEditorTableController,
  });
});

})();
