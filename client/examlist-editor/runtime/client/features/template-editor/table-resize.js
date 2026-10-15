(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableResize = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const TEMPLATE_EDITOR_CELL_ONLY_RESIZE_EPSILON = 2;
  const tableResizeHitModule = globalThis.ExamListTemplateEditorTableResizeHit;
  const tableResizeSessionModule = globalThis.ExamListTemplateEditorTableResizeSession;
  const tableResizeValuesModule = globalThis.ExamListTemplateEditorTableResizeValues;

  if (!tableResizeHitModule?.createTemplateEditorTableResizeHitController) {
    throw new Error("client/features/template-editor/table-resize-hit.js must be loaded before table-resize.js.");
  }

  if (!tableResizeValuesModule?.createTemplateEditorTableResizeValueController) {
    throw new Error("client/features/template-editor/table-resize-values.js must be loaded before table-resize.js.");
  }

  if (!tableResizeSessionModule?.createTemplateEditorTableResizeSessionController) {
    throw new Error("client/features/template-editor/table-resize-session.js must be loaded before table-resize.js.");
  }

  const { createTemplateEditorTableResizeHitController } = tableResizeHitModule;
  const { createTemplateEditorTableResizeSessionController } = tableResizeSessionModule;
  const { createTemplateEditorTableResizeValueController } = tableResizeValuesModule;

  function createTemplateEditorTableResizeController({
    TEMPLATE_EDITOR_TABLE_EDGE_THRESHOLD,
    TEMPLATE_EDITOR_TABLE_MIN_SIZE,
    buildTemplateTableCellMap,
    clearTemplateEditorTableSelection,
    focusTemplateEditorCell,
    getTemplateEditorModal,
    getTemplateEditorSurface,
    getTemplateEditorTableCellTarget,
    getTemplateEditorTableLogicalColumnWidth,
    getTemplateEditorTableLogicalRowHeight,
    getTemplateEditorSelectedCell,
    setTemplateEditorTableLogicalColumnWidth,
    setTemplateEditorTableLogicalColumnWidths,
    setTemplateEditorTableLogicalRowHeight,
    state,
    syncTemplateEditorContent,
    updateTemplateTableControls,
  }) {
    function clearTemplateEditorTableHoverState() {
      getTemplateEditorSurface()?.classList.remove("is-table-column-hover", "is-table-row-hover");
    }

    function isEditableCandidateBlockTableCell(cellElement) {
      const blockElement = cellElement?.closest?.("[data-candidate-block-instance]") || null;

      return !(blockElement instanceof HTMLElement) || blockElement.classList.contains("is-candidate-block-focus-editor");
    }

    function isCandidateBlockFocusTableObjectBorderPoint(tableElement, event) {
      const blockElement = tableElement?.closest?.("[data-candidate-block-instance]") || null;

      if (!(blockElement instanceof HTMLElement) || !blockElement.classList.contains("is-candidate-block-focus-editor")) {
        return false;
      }

      const tableRect = tableElement.getBoundingClientRect?.();
      const eventX = Number(event?.clientX);
      const eventY = Number(event?.clientY);

      if (
        !tableRect ||
        !Number.isFinite(eventX) ||
        !Number.isFinite(eventY) ||
        eventX < tableRect.left ||
        eventX > tableRect.right ||
        eventY < tableRect.top ||
        eventY > tableRect.bottom
      ) {
        return false;
      }

      const edgeDistance = Math.min(
        eventX - tableRect.left,
        tableRect.right - eventX,
        eventY - tableRect.top,
        tableRect.bottom - eventY,
      );

      return edgeDistance <= Math.max(2, TEMPLATE_EDITOR_TABLE_EDGE_THRESHOLD);
    }

    const {
      getTemplateEditorTableColumnCount,
      getTemplateEditorTableLineCells,
      getTemplateEditorTableResizeHit,
    } = createTemplateEditorTableResizeHitController({
      TEMPLATE_EDITOR_TABLE_EDGE_THRESHOLD,
      buildTemplateTableCellMap,
    });
    const {
      applyTemplateEditorTableResizeValue,
      createTemplateEditorCellOnlyColumnLayout,
      createTemplateEditorCellOnlyRowLayout,
      finalizeTemplateEditorTableResizeSession,
    } = createTemplateEditorTableResizeValueController({
      TEMPLATE_EDITOR_CELL_ONLY_RESIZE_EPSILON,
      TEMPLATE_EDITOR_TABLE_MIN_SIZE,
      buildTemplateTableCellMap,
      setTemplateEditorTableLogicalColumnWidth,
      setTemplateEditorTableLogicalColumnWidths,
      setTemplateEditorTableLogicalRowHeight,
    });
    const {
      releaseTemplateEditorTableResizeSession,
      startTemplateEditorTableResizeSession,
    } = createTemplateEditorTableResizeSessionController({
      TEMPLATE_EDITOR_TABLE_MIN_SIZE,
      applyTemplateEditorTableResizeValue,
      clearTemplateEditorTableHoverState,
      clearTemplateEditorTableSelection,
      createTemplateEditorCellOnlyColumnLayout,
      createTemplateEditorCellOnlyRowLayout,
      finalizeTemplateEditorTableResizeSession,
      focusTemplateEditorCell,
      getTemplateEditorSurface,
      getTemplateEditorTableColumnCount,
      getTemplateEditorTableLineCells,
      getTemplateEditorTableLogicalColumnWidth,
      getTemplateEditorTableLogicalRowHeight,
      getTemplateEditorSelectedCell,
      state,
      syncTemplateEditorContent,
      updateTemplateTableControls,
    });

    function updateTemplateEditorTableHoverState(event) {
      const templateEditorSurface = getTemplateEditorSurface();
      const templateEditorModal = getTemplateEditorModal();

      if (
        !templateEditorSurface ||
        templateEditorModal?.classList.contains("hidden") ||
        state.templateEditor.tableResizeSession ||
        state.templateEditor.tableSelectionSession ||
        state.templateEditor.imageMoveSession ||
        state.templateEditor.imageResizeSession
      ) {
        clearTemplateEditorTableHoverState();
        return;
      }

      const hoverCell = getTemplateEditorTableCellTarget(event.target);

      if (hoverCell && !isEditableCandidateBlockTableCell(hoverCell)) {
        clearTemplateEditorTableHoverState();
        return;
      }

      const resizeHit = hoverCell ? getTemplateEditorTableResizeHit(hoverCell, event) : null;
      const hoverTable = hoverCell?.closest?.("table") || null;

      if (resizeHit && isCandidateBlockFocusTableObjectBorderPoint(hoverTable, event)) {
        clearTemplateEditorTableHoverState();
        return;
      }

      templateEditorSurface.classList.toggle("is-table-column-hover", resizeHit?.kind === "column");
      templateEditorSurface.classList.toggle("is-table-row-hover", resizeHit?.kind === "row");
    }

    return Object.freeze({
      clearTemplateEditorTableHoverState,
      getTemplateEditorTableResizeHit,
      releaseTemplateEditorTableResizeSession,
      startTemplateEditorTableResizeSession,
      updateTemplateEditorTableHoverState,
    });
  }

  return Object.freeze({
    createTemplateEditorTableResizeController,
  });
});

})();
