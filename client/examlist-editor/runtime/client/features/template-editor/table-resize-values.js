(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableResizeValues = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const cellOnlyColumnResizeModule = globalThis.ExamListTemplateEditorTableCellOnlyColumnResize;
  const cellOnlyRowResizeModule = globalThis.ExamListTemplateEditorTableCellOnlyRowResize;

  if (!cellOnlyColumnResizeModule?.createTemplateEditorTableCellOnlyColumnResizeController) {
    throw new Error("client/features/template-editor/table-cell-only-column-resize.js must be loaded before table-resize-values.js.");
  }

  if (!cellOnlyRowResizeModule?.createTemplateEditorTableCellOnlyRowResizeController) {
    throw new Error("client/features/template-editor/table-cell-only-row-resize.js must be loaded before table-resize-values.js.");
  }

  function createTemplateEditorTableResizeValueController({
    TEMPLATE_EDITOR_CELL_ONLY_RESIZE_EPSILON,
    TEMPLATE_EDITOR_TABLE_MIN_SIZE,
    buildTemplateTableCellMap,
    setTemplateEditorTableLogicalColumnWidth,
    setTemplateEditorTableLogicalColumnWidths,
    setTemplateEditorTableLogicalRowHeight,
  }) {
    const cellOnlyColumnResize = cellOnlyColumnResizeModule.createTemplateEditorTableCellOnlyColumnResizeController({
      TEMPLATE_EDITOR_CELL_ONLY_RESIZE_EPSILON,
      TEMPLATE_EDITOR_TABLE_MIN_SIZE,
      buildTemplateTableCellMap,
    });
    const cellOnlyRowResize = cellOnlyRowResizeModule.createTemplateEditorTableCellOnlyRowResizeController({
      TEMPLATE_EDITOR_TABLE_MIN_SIZE,
      buildTemplateTableCellMap,
    });
    const {
      applyTemplateEditorCellOnlyColumnResizeValue,
      createTemplateEditorCellOnlyColumnLayout,
      finalizeTemplateEditorCellOnlyColumnResizeSession,
      mergeTemplateEditorRedundantColumnBoundaries,
    } = cellOnlyColumnResize;
    const {
      applyTemplateEditorCellOnlyRowResizeValue,
      createTemplateEditorCellOnlyRowLayout,
    } = cellOnlyRowResize;

    function applyTemplateEditorCellOnlyResizeValue(resizeSession, nextSize, boundaryDelta = 0) {
      const cell = resizeSession.cell;

      if (!cell?.isConnected) {
        return resizeSession.lastSize;
      }

      const safeSize = Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, Math.round(nextSize));

      if (resizeSession.kind === "column") {
        return applyTemplateEditorCellOnlyColumnResizeValue(resizeSession, boundaryDelta);
      }

      return applyTemplateEditorCellOnlyRowResizeValue(resizeSession, boundaryDelta) || safeSize;
    }

    function applyTemplateEditorTableResizeValue(resizeSession, nextSize, boundaryDelta = 0) {
      if (resizeSession.cellOnly) {
        return applyTemplateEditorCellOnlyResizeValue(resizeSession, nextSize, boundaryDelta);
      }

      if (resizeSession.kind === "column") {
        if (Number.isInteger(resizeSession.nextLineIndex) && resizeSession.nextStartSize >= TEMPLATE_EDITOR_TABLE_MIN_SIZE) {
          const minDelta = TEMPLATE_EDITOR_TABLE_MIN_SIZE - resizeSession.startSize;
          const maxDelta = resizeSession.nextStartSize - TEMPLATE_EDITOR_TABLE_MIN_SIZE;
          const safeDelta = Math.max(minDelta, Math.min(maxDelta, Math.round(nextSize - resizeSession.startSize)));
          const targetSize = Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, Math.round(resizeSession.startSize + safeDelta));
          const nextColumnSize = Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, Math.round(resizeSession.nextStartSize - safeDelta));

          if (typeof setTemplateEditorTableLogicalColumnWidths === "function") {
            setTemplateEditorTableLogicalColumnWidths(resizeSession.table, [
              { columnIndex: resizeSession.lineIndex, width: targetSize },
              { columnIndex: resizeSession.nextLineIndex, width: nextColumnSize },
            ]);
            return targetSize;
          }

          setTemplateEditorTableLogicalColumnWidth(resizeSession.table, resizeSession.lineIndex, targetSize);
          setTemplateEditorTableLogicalColumnWidth(resizeSession.table, resizeSession.nextLineIndex, nextColumnSize);
          return targetSize;
        }

        setTemplateEditorTableLogicalColumnWidth(resizeSession.table, resizeSession.lineIndex, nextSize);
        return nextSize;
      }

      if (Number.isInteger(resizeSession.nextLineIndex)) {
        const minimum = Math.min(TEMPLATE_EDITOR_TABLE_MIN_SIZE, resizeSession.startSize, resizeSession.nextStartSize);
        const delta = Math.max(minimum - resizeSession.startSize,
          Math.min(resizeSession.nextStartSize - minimum, Math.round(nextSize - resizeSession.startSize)));
        const targetSize = resizeSession.startSize + delta;
        setTemplateEditorTableLogicalRowHeight(resizeSession.table, resizeSession.lineIndex, targetSize, {
          rowIndex: resizeSession.nextLineIndex,
          height: resizeSession.nextStartSize - delta,
        });
        return targetSize;
      }

      setTemplateEditorTableLogicalRowHeight(resizeSession.table, resizeSession.lineIndex, nextSize);
      return nextSize;
    }

    function finalizeTemplateEditorTableResizeSession(resizeSession) {
      if (resizeSession.cellOnly && resizeSession.kind === "column") {
        finalizeTemplateEditorCellOnlyColumnResizeSession(resizeSession);
        mergeTemplateEditorRedundantColumnBoundaries(resizeSession.table);
      }
    }

    return Object.freeze({
      applyTemplateEditorTableResizeValue,
      createTemplateEditorCellOnlyColumnLayout,
      createTemplateEditorCellOnlyRowLayout,
      finalizeTemplateEditorTableResizeSession,
    });
  }

  return Object.freeze({
    createTemplateEditorTableResizeValueController,
  });
});

})();
