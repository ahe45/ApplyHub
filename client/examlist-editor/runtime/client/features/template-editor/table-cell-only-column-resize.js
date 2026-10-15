(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalScope);
    return;
  }

  globalScope.ExamListTemplateEditorTableCellOnlyColumnResize = factory(globalScope);
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  const layoutModule = globalScope.ExamListTemplateEditorTableCellOnlyColumnLayout;
  const transferModule = globalScope.ExamListTemplateEditorTableCellOnlyColumnTransfer;

  if (!layoutModule || !transferModule) {
    throw new Error("table cell-only column layout and transfer modules must be loaded before table-cell-only-column-resize.js.");
  }

  function createTemplateEditorTableCellOnlyColumnResizeController({
    TEMPLATE_EDITOR_CELL_ONLY_RESIZE_EPSILON,
    TEMPLATE_EDITOR_TABLE_MIN_SIZE,
    buildTemplateTableCellMap,
  }) {
    function parseTemplateEditorResizePixelValue(value, fallback = 0) {
      const parsedValue = Number.parseFloat(String(value || "").replace("px", ""));

      return Number.isFinite(parsedValue) ? parsedValue : fallback;
    }

    function getTemplateEditorResizeColumns(table) {
      const colGroup = Array.from(table?.children || []).find((child) => child.tagName === "COLGROUP") || null;

      return colGroup ? Array.from(colGroup.children).filter((column) => column.tagName === "COL") : [];
    }

    function getTemplateEditorResizeColumnWidth(columnElement) {
      const configuredWidth = parseTemplateEditorResizePixelValue(columnElement?.style?.width, 0);

      if (configuredWidth > 0) {
        return configuredWidth;
      }

      const measuredWidth = Math.round(columnElement?.getBoundingClientRect?.().width || 0);

      return Number.isFinite(measuredWidth) && measuredWidth > 0 ? measuredWidth : TEMPLATE_EDITOR_TABLE_MIN_SIZE;
    }

    function setTemplateEditorResizeColumnWidth(columnElement, width) {
      if (!columnElement) {
        return;
      }

      columnElement.style.width = `${Math.max(1, Math.round(width))}px`;
    }

    function syncTemplateEditorResizeTableWidth(table) {
      const columns = getTemplateEditorResizeColumns(table);
      const totalWidth = columns.reduce(
        (widthSum, columnElement) => widthSum + Math.max(1, getTemplateEditorResizeColumnWidth(columnElement)),
        0,
      );

      if (totalWidth > 0) {
        table.style.width = `${Math.round(totalWidth)}px`;
        table.style.maxWidth = "none";
      }
    }

    const {
      applyTemplateEditorCellOnlyColumnLayout,
      createTemplateEditorCellOnlyColumnLayout,
      getTemplateEditorCellOnlyColumnLayoutWidths,
    } = layoutModule.createTemplateEditorTableCellOnlyColumnLayoutController({
      TEMPLATE_EDITOR_TABLE_MIN_SIZE,
      buildTemplateTableCellMap,
      getTemplateEditorResizeColumns,
      getTemplateEditorResizeColumnWidth,
      parseTemplateEditorResizePixelValue,
      setTemplateEditorResizeColumnWidth,
    });
    const {
      getTemplateEditorCellOnlyColumnMeasuredWidth,
      getTemplateEditorCellOnlyResizeRawDelta,
      mergeTemplateEditorRedundantColumnBoundaries,
      prepareTemplateEditorCellOnlyColumnResizePlan,
      rollbackTemplateEditorCellOnlyColumnResizePlan,
      transferTemplateEditorCellOnlySourceColumn,
    } = transferModule.createTemplateEditorTableCellOnlyColumnTransferController({
      TEMPLATE_EDITOR_TABLE_MIN_SIZE,
      buildTemplateTableCellMap,
      getTemplateEditorResizeColumnWidth,
      getTemplateEditorResizeColumns,
      setTemplateEditorResizeColumnWidth,
      syncTemplateEditorResizeTableWidth,
    });

    function applyTemplateEditorCellOnlyColumnResizeValue(resizeSession, boundaryDelta) {
      if (resizeSession.cellOnlyColumnLayout) {
        const nextWidths = getTemplateEditorCellOnlyColumnLayoutWidths(resizeSession.cellOnlyColumnLayout, boundaryDelta);

        if (nextWidths.length) {
          applyTemplateEditorCellOnlyColumnLayout(resizeSession.table, resizeSession.cellOnlyColumnLayout, nextWidths);
        }

        return getTemplateEditorCellOnlyColumnMeasuredWidth(resizeSession);
      }

      const plan = prepareTemplateEditorCellOnlyColumnResizePlan(resizeSession, boundaryDelta);

      if (!plan) {
        // Cell-only resizing must not fall back to logical column resizing, because that changes the table width.
        return resizeSession.lastSize;
      }

      const totalRawDelta = getTemplateEditorCellOnlyResizeRawDelta(plan.direction, boundaryDelta);
      const rawDelta = Math.max(0, totalRawDelta - Math.round(resizeSession.cellOnlyConsumedDelta || 0));

      if (rawDelta <= 0) {
        return getTemplateEditorCellOnlyColumnMeasuredWidth(resizeSession);
      }

      if (
        plan.canTransferSourceColumn &&
        rawDelta >= Math.max(1, Math.round(plan.sourceWidth) - TEMPLATE_EDITOR_CELL_ONLY_RESIZE_EPSILON)
      ) {
        if (!transferTemplateEditorCellOnlySourceColumn(resizeSession, plan)) {
          return getTemplateEditorCellOnlyColumnMeasuredWidth(resizeSession);
        }

        if (totalRawDelta > Math.round(resizeSession.cellOnlyConsumedDelta || 0)) {
          return applyTemplateEditorCellOnlyColumnResizeValue(resizeSession, boundaryDelta);
        }

        return getTemplateEditorCellOnlyColumnMeasuredWidth(resizeSession);
      }

      const splitWidth = Math.max(1, Math.min(plan.maxDelta, Math.round(rawDelta)));
      const remainingWidth = Math.max(plan.minRemainingWidth, plan.sourceWidth - splitWidth);

      setTemplateEditorResizeColumnWidth(plan.movingColumn, splitWidth);
      setTemplateEditorResizeColumnWidth(plan.remainingColumn, remainingWidth);
      syncTemplateEditorResizeTableWidth(resizeSession.table);

      return getTemplateEditorCellOnlyColumnMeasuredWidth(resizeSession);
    }

    function finalizeTemplateEditorCellOnlyColumnResizeSession(resizeSession) {
      const plan = resizeSession?.cellOnlyPlan;

      if (!plan) {
        return;
      }

      const movingWidth = getTemplateEditorResizeColumnWidth(plan.movingColumn);
      const remainingWidth = getTemplateEditorResizeColumnWidth(plan.remainingColumn);

      if (
        plan.canTransferSourceColumn &&
        remainingWidth <= TEMPLATE_EDITOR_CELL_ONLY_RESIZE_EPSILON &&
        transferTemplateEditorCellOnlySourceColumn(resizeSession, plan)
      ) {
        return;
      }

      if (movingWidth <= TEMPLATE_EDITOR_CELL_ONLY_RESIZE_EPSILON) {
        rollbackTemplateEditorCellOnlyColumnResizePlan(resizeSession, plan);
      }
    }

    return Object.freeze({
      applyTemplateEditorCellOnlyColumnResizeValue,
      createTemplateEditorCellOnlyColumnLayout,
      finalizeTemplateEditorCellOnlyColumnResizeSession,
      mergeTemplateEditorRedundantColumnBoundaries,
    });
  }

  return Object.freeze({
    createTemplateEditorTableCellOnlyColumnResizeController,
  });
});

})();
