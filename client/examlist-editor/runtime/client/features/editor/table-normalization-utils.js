(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalScope);
    return;
  }

  globalScope.ExamListEditorTableNormalizationUtils = factory(globalScope);
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  const tableCellUtils = globalScope.ExamListEditorTableCellUtils;
  const tableSizingUtils = globalScope.ExamListEditorTableSizingUtils;

  if (!tableCellUtils || !tableSizingUtils) {
    throw new Error("table cell and sizing utils must be loaded before client/features/editor/table-normalization-utils.js.");
  }

  const {
    TEMPLATE_EDITOR_TABLE_MIN_SIZE,
    applyTemplateTableCellPresentation,
    buildTemplateTableCellMap,
    parseTemplateEditorPixelStyle,
  } = tableCellUtils;
  const {
    clampTemplateEditorTableToDocumentWidth,
    ensureTemplateEditorTableColGroup,
    normalizeCandidateBlockTableAppearance,
  } = tableSizingUtils;
  const candidateBlockTableHostSelector = "[data-candidate-block-instance], [data-candidate-block-column-name]";

  function isTemplateEditorPixelLength(value = "") {
    return /^-?\d+(?:\.\d+)?px$/i.test(String(value || "").trim());
  }

  function distributeTemplateEditorConfiguredTableRows(targetHeight, rowCount, minimumHeight) {
    const safeRowCount = Math.max(1, Math.round(Number(rowCount) || 0));
    const safeTargetHeight = Math.max(safeRowCount * minimumHeight, Math.round(Number(targetHeight) || 0));
    const baseHeight = Math.max(minimumHeight, Math.floor(safeTargetHeight / safeRowCount));
    let remainder = safeTargetHeight - baseHeight * safeRowCount;

    return Array.from({ length: safeRowCount }, () => {
      const nextHeight = baseHeight + (remainder > 0 ? 1 : 0);

      remainder -= 1;
      return Math.max(minimumHeight, nextHeight);
    });
  }

  function getTemplateEditorConfiguredTableRowHeights(table) {
    const minimumRowHeight =
      table.closest?.(candidateBlockTableHostSelector) || table.dataset?.templateCellOnlyRowLayout === "true"
        ? 1
        : TEMPLATE_EDITOR_TABLE_MIN_SIZE;

    return Array.from(table.rows || []).map((rowElement) =>
      Math.max(
        minimumRowHeight,
        parseTemplateEditorPixelStyle(rowElement.style.height, Math.round(rowElement.getBoundingClientRect?.().height || 0)),
      ),
    );
  }

  function getTemplateEditorConfiguredTableRowTotalHeight(table) {
    return getTemplateEditorConfiguredTableRowHeights(table).reduce((heightSum, height) => heightSum + Math.max(0, height || 0), 0);
  }

  function syncTemplateEditorConfiguredTableRowGroupHeights(table, rowHeights) {
    const rowIndexByElement = new Map(Array.from(table.rows || []).map((rowElement, rowIndex) => [rowElement, rowIndex]));
    const rowGroups = [
      table.tHead,
      ...Array.from(table.tBodies || []),
      table.tFoot,
    ].filter(Boolean);

    rowGroups.forEach((rowGroupElement) => {
      const rowGroupHeight = Array.from(rowGroupElement.rows || []).reduce((heightSum, rowElement) => {
        const rowIndex = rowIndexByElement.get(rowElement);

        return heightSum + Math.max(0, rowHeights[rowIndex] || 0);
      }, 0);

      if (rowGroupHeight > 0) {
        rowGroupElement.style.height = `${rowGroupHeight}px`;
      }
    });
  }

  function normalizeTemplateEditorConfiguredTableHeight(table) {
    const rows = Array.from(table?.rows || []);
    const configuredHeight = parseTemplateEditorPixelStyle(table?.style?.height, 0);

    if (!rows.length || !isTemplateEditorPixelLength(table?.style?.height) || !(configuredHeight > 0)) {
      return false;
    }

    const minimumRowHeight =
      table.closest?.(candidateBlockTableHostSelector) || table.dataset?.templateCellOnlyRowLayout === "true"
        ? 1
        : TEMPLATE_EDITOR_TABLE_MIN_SIZE;
    const currentTotalHeight = getTemplateEditorConfiguredTableRowTotalHeight(table);

    if (Math.abs(currentTotalHeight - configuredHeight) <= 1) {
      return false;
    }

    const rowHeights = distributeTemplateEditorConfiguredTableRows(configuredHeight, rows.length, minimumRowHeight);

    rows.forEach((rowElement, rowIndex) => {
      rowElement.style.height = `${rowHeights[rowIndex] || minimumRowHeight}px`;
    });
    buildTemplateTableCellMap(table).entries.forEach((entry, cellElement) => {
      const cellHeight = rowHeights
        .slice(entry.rowIndex, entry.rowIndex + entry.rowSpan)
        .reduce((heightSum, height) => heightSum + Math.max(0, height || 0), 0);

      if (cellHeight > 0) {
        cellElement.style.height = `${cellHeight}px`;
        cellElement.style.minHeight = table.closest?.(candidateBlockTableHostSelector) ? "0" : `${cellHeight}px`;
      }
    });
    syncTemplateEditorConfiguredTableRowGroupHeights(table, rowHeights);
    table.style.height = `${rowHeights.reduce((heightSum, height) => heightSum + Math.max(0, height || 0), 0)}px`;
    return true;
  }

  function normalizeTemplateEditorTableAppearance(table) {
    if (!(table instanceof HTMLTableElement)) {
      return;
    }

    if (!String(table.style.width || "").trim()) {
      table.style.width = "100%";
    }

    table.style.borderCollapse = "collapse";
    table.style.tableLayout = "fixed";

    Array.from(table.rows).forEach((row) => {
      Array.from(row.cells).forEach((cell) => {
        applyTemplateTableCellPresentation(cell, cell);
      });
    });

    const { columns } = ensureTemplateEditorTableColGroup(table);
    if (!normalizeCandidateBlockTableAppearance(table, columns)) {
      clampTemplateEditorTableToDocumentWidth(table, columns);
      normalizeTemplateEditorConfiguredTableHeight(table);
    }
  }

  function normalizeTemplateEditorTables(rootElement) {
    if (!rootElement?.querySelectorAll) {
      return;
    }

    rootElement.querySelectorAll("table").forEach((table) => {
      normalizeTemplateEditorTableAppearance(table);
    });
  }

  return Object.freeze({
    normalizeTemplateEditorTableAppearance,
    normalizeTemplateEditorTables,
  });
});

})();
