(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableInteraction = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const tableResizeModule = globalThis.ExamListTemplateEditorTableResize;
  const tableSelectionModule = globalThis.ExamListTemplateEditorTableSelection;

  if (!tableResizeModule?.createTemplateEditorTableResizeController) {
    throw new Error("client/features/template-editor/table-resize.js must be loaded before table-interaction.js.");
  }

  if (!tableSelectionModule?.createTemplateEditorTableSelectionController) {
    throw new Error("client/features/template-editor/table-selection.js must be loaded before table-interaction.js.");
  }

  const { createTemplateEditorTableResizeController } = tableResizeModule;
  const { createTemplateEditorTableSelectionController } = tableSelectionModule;

  function createTemplateEditorTableInteractionController({
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
  }) {
    let clearTemplateEditorTableSelection = () => {};
    let getTemplateEditorActiveTableSelection = () => null;
    let getTemplateEditorSelectedCell = () => null;
    let getTemplateEditorSelectedTable = () => null;
    let getTemplateEditorTableCellTarget = () => null;
    let releaseTemplateEditorTableSelectionSession = () => {};
    let startTemplateEditorTableSelectionSession = () => false;

    const tableResizeController = createTemplateEditorTableResizeController({
      TEMPLATE_EDITOR_TABLE_EDGE_THRESHOLD,
      TEMPLATE_EDITOR_TABLE_MIN_SIZE,
      buildTemplateTableCellMap,
      clearTemplateEditorTableSelection: (...args) => clearTemplateEditorTableSelection(...args),
      focusTemplateEditorCell,
      getTemplateEditorModal,
      getTemplateEditorSurface,
      getTemplateEditorTableCellTarget: (...args) => getTemplateEditorTableCellTarget(...args),
      getTemplateEditorTableLogicalColumnWidth,
      getTemplateEditorTableLogicalRowHeight,
      getTemplateEditorSelectedCell: (...args) => getTemplateEditorSelectedCell(...args),
      setTemplateEditorTableLogicalColumnWidth,
      setTemplateEditorTableLogicalColumnWidths,
      setTemplateEditorTableLogicalRowHeight,
      state,
      syncTemplateEditorContent,
      updateTemplateTableControls,
    });
    const tableSelectionController = createTemplateEditorTableSelectionController({
      TEMPLATE_EDITOR_TABLE_SELECTION_DRAG_THRESHOLD,
      buildTemplateTableCellMap,
      clearTemplateEditorTableHoverState: (...args) => tableResizeController.clearTemplateEditorTableHoverState(...args),
      getClosestTemplateEditorElement,
      getTemplateEditorSelectionNode,
      getTemplateEditorSurface,
      state,
      updateTemplateTableControls,
    });

    ({
      clearTemplateEditorTableSelection,
      getTemplateEditorActiveTableSelection,
      getTemplateEditorSelectedCell,
      getTemplateEditorSelectedTable,
      getTemplateEditorTableCellTarget,
      releaseTemplateEditorTableSelectionSession,
      startTemplateEditorTableSelectionSession,
    } = tableSelectionController);

    const {
      clearTemplateEditorTableHoverState,
      getTemplateEditorTableResizeHit,
      releaseTemplateEditorTableResizeSession,
      startTemplateEditorTableResizeSession,
      updateTemplateEditorTableHoverState,
    } = tableResizeController;

    function isEditableCandidateBlockTableCell(cellElement) {
      const blockElement = cellElement?.closest?.("[data-candidate-block-instance]") || null;

      return !(blockElement instanceof HTMLElement) || blockElement.classList.contains("is-candidate-block-focus-editor");
    }

    function handleTemplateEditorTablePointerDown(event) {
      const targetCell = getTemplateEditorTableCellTarget(event.target);

      if (!targetCell || !isEditableCandidateBlockTableCell(targetCell)) {
        return false;
      }

      clearTemplateEditorImageSelection();

      const resizeHit = getTemplateEditorTableResizeHit(targetCell, event);

      if (resizeHit) {
        event.preventDefault();
        return startTemplateEditorTableResizeSession(resizeHit, event);
      }

      startTemplateEditorTableSelectionSession(targetCell, event);
      return true;
    }

    return Object.freeze({
      clearTemplateEditorTableHoverState,
      clearTemplateEditorTableSelection,
      getTemplateEditorActiveTableSelection,
      getTemplateEditorSelectedCell,
      getTemplateEditorSelectedTable,
      handleTemplateEditorTablePointerDown,
      releaseTemplateEditorTableResizeSession,
      releaseTemplateEditorTableSelectionSession,
      updateTemplateEditorTableHoverState,
    });
  }

  return Object.freeze({
    createTemplateEditorTableInteractionController,
  });
});

})();
