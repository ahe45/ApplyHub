(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./table-border-actions"));
    return;
  }

  globalScope.ExamListTemplateEditorTableActions = factory(globalScope.ExamListTemplateEditorTableBorderActions);
})(typeof globalThis !== "undefined" ? globalThis : this, (tableBorderActionsModule) => {
  const tableSizingModule = globalThis.ExamListTemplateEditorTableSizing;
  const tableStructureModule = globalThis.ExamListTemplateEditorTableStructure;

  if (!tableBorderActionsModule?.createTemplateEditorTableBorderActionController) {
    throw new Error("client/features/template-editor/table-border-actions.js must be loaded before table-actions.js.");
  }

  if (!tableSizingModule?.createTemplateEditorTableSizingController) {
    throw new Error("client/features/template-editor/table-sizing.js must be loaded before table-actions.js.");
  }

  if (!tableStructureModule?.createTemplateEditorTableStructureController) {
    throw new Error("client/features/template-editor/table-structure.js must be loaded before table-actions.js.");
  }

  const { createTemplateEditorTableBorderActionController } = tableBorderActionsModule;
  const { createTemplateEditorTableSizingController } = tableSizingModule;
  const { createTemplateEditorTableStructureController } = tableStructureModule;
  const candidateBlockTableHostSelector = "[data-candidate-block-instance], [data-candidate-block-column-name]";
  const tableDimensionPreservingActions = new Set([
    "merge-selection",
    "merge-right",
    "merge-down",
    "split-cell",
  ]);

  function parseTemplateEditorPixelLength(value, fallback = 0) {
    const parsedValue = Number.parseFloat(String(value || "").replace("px", ""));

    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  function getPositiveTableDimension(candidates = []) {
    const values = candidates
      .filter((candidate) => Number.isFinite(candidate) && candidate > 0)
      .map((candidate) => Math.round(candidate));

    return Math.max(1, values.length ? Math.max(...values) : 0);
  }

  function getTableColumnStyleTotal(columns = []) {
    return columns.reduce(
      (totalWidth, columnElement) => totalWidth + Math.max(0, parseTemplateEditorPixelLength(columnElement?.style?.width, 0)),
      0,
    );
  }

  function getTableRowStyleTotal(table) {
    return Array.from(table?.rows || []).reduce(
      (totalHeight, rowElement) => totalHeight + Math.max(0, parseTemplateEditorPixelLength(rowElement?.style?.height, 0)),
      0,
    );
  }

  function getCandidateBlockVisualScale(blockElement, axis) {
    if (!(blockElement instanceof HTMLElement)) {
      return 1;
    }

    const rect = blockElement.getBoundingClientRect();
    const isHeightAxis = axis === "height";
    const logicalSize =
      parseTemplateEditorPixelLength(
        isHeightAxis
          ? blockElement.dataset?.candidateBlockLogicalHeight
          : blockElement.dataset?.candidateBlockLogicalWidth,
        0,
      ) ||
      (isHeightAxis ? blockElement.offsetHeight : blockElement.offsetWidth) ||
      (isHeightAxis ? blockElement.clientHeight : blockElement.clientWidth) ||
      (isHeightAxis ? rect.height : rect.width);
    const visualSize = isHeightAxis ? rect.height : rect.width;

    return logicalSize > 0 && visualSize > 0 ? Math.max(0.01, visualSize / logicalSize) : 1;
  }

  function getUnscaledCandidateBlockTableRectDimension(tableRect, blockElement, axis) {
    const visualSize = axis === "height" ? tableRect?.height : tableRect?.width;
    const visualScale = getCandidateBlockVisualScale(blockElement, axis);
    const logicalSize = visualSize / visualScale;

    return Number.isFinite(logicalSize) && logicalSize > 0 ? logicalSize : 0;
  }

  function isBlankTemplateTableSibling(node, table = null) {
    if (node.nodeType === Node.TEXT_NODE) {
      return !String(node.textContent || "").replace(/\u00a0/g, " ").trim();
    }

    if (!(node instanceof HTMLElement)) {
      return false;
    }

    if (node.matches("br")) {
      return true;
    }

    if (table instanceof HTMLElement && node.contains(table)) {
      const clone = node.cloneNode(true);
      clone.querySelectorAll("table").forEach((tableElement) => tableElement.remove());

      return !String(clone.textContent || "").replace(/\u00a0/g, " ").trim();
    }

    if (!/^(P|DIV)$/i.test(String(node.tagName || ""))) {
      return false;
    }

    const text = String(node.textContent || "").replace(/\u00a0/g, " ").trim();
    const hasOnlyLineBreaks = Array.from(node.childNodes || []).every((childNode) =>
      childNode.nodeType === Node.TEXT_NODE
        ? !String(childNode.textContent || "").replace(/\u00a0/g, " ").trim()
        : childNode.nodeType === Node.ELEMENT_NODE && String(childNode.tagName || "").toLowerCase() === "br",
    );

    return !text && hasOnlyLineBreaks;
  }

  function isOnlyMeaningfulCandidateBlockTable(table, blockElement) {
    return Array.from(blockElement?.childNodes || []).every((node) => node === table || isBlankTemplateTableSibling(node, table));
  }

  function getCandidateBlockFallbackTableHeight(table, blockElement) {
    const configuredHeight = parseTemplateEditorPixelLength(table?.style?.height, 0);
    const rowCount = Math.max(1, Array.from(table?.rows || []).length);

    if (
      !(blockElement instanceof HTMLElement) ||
      configuredHeight > rowCount * 4
    ) {
      return 0;
    }

    return (
      blockElement.clientHeight ||
      blockElement.offsetHeight ||
      parseTemplateEditorPixelLength(blockElement.dataset?.candidateBlockLogicalHeight, 0)
    );
  }

  function distributePreservedTableSizes(currentSizes = [], targetSize = 0) {
    const safeCount = Math.max(1, currentSizes.length);
    const safeTarget = Math.max(safeCount, Math.round(Number(targetSize) || 0));
    const baseSizes = currentSizes.map((size) => Math.max(1, Math.round(Number(size) || 0)));
    const currentTotal = baseSizes.reduce((sizeSum, size) => sizeSum + size, 0);

    if (!(currentTotal > 0)) {
      const baseSize = Math.floor(safeTarget / safeCount);
      let remainder = safeTarget - baseSize * safeCount;

      return Array.from({ length: safeCount }, () => {
        const nextSize = baseSize + (remainder > 0 ? 1 : 0);

        remainder -= 1;
        return Math.max(1, nextSize);
      });
    }

    const scale = safeTarget / currentTotal;
    let usedSize = 0;

    return baseSizes.map((size, index) => {
      const remainingCount = safeCount - index - 1;
      const maxSize = safeTarget - usedSize - remainingCount;
      const nextSize = index === safeCount - 1
        ? safeTarget - usedSize
        : Math.min(maxSize, Math.max(1, Math.round(size * scale)));

      usedSize += nextSize;
      return Math.max(1, nextSize);
    });
  }

  function fitCandidateBlockCellVerticalSpace(cellElement, cellHeight, rowSpan = 1) {
    if (!(cellElement instanceof HTMLElement) || !(cellHeight > 0)) {
      return;
    }

    const effectiveRowHeight = cellHeight / Math.max(1, Math.round(Number(rowSpan) || 1));

    if (effectiveRowHeight <= 40) {
      const computedStyle = window.getComputedStyle(cellElement);
      const paddingLeft = cellElement.style.paddingLeft || computedStyle.paddingLeft || "0px";
      const paddingRight = cellElement.style.paddingRight || computedStyle.paddingRight || "0px";

      cellElement.style.padding = `0px ${paddingRight} 0px ${paddingLeft}`;
      cellElement.style.overflow = "hidden";
    }
  }

  function createTemplateEditorTableActionController({
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
  }) {
    const tableSizingController = createTemplateEditorTableSizingController({
      TEMPLATE_EDITOR_TABLE_MIN_SIZE,
      buildTemplateTableCellMap,
      ensureTemplateEditorTableColGroup,
      focusTemplateEditorCell,
      getTemplateEditorClampedColumnGroupWidth,
      getTemplateEditorActiveTableSelection,
      getTemplateEditorCellShadingInput,
      getTemplateEditorCellWidthInput,
      getTemplateEditorRowHeightInput,
      getTemplateEditorSelectedCell,
      getTemplateEditorSizeScopeInput,
      getTemplateEditorTableLogicalColumnWidth,
      getTemplateEditorTableLogicalRowHeight,
      normalizeTemplateEditorColorValue,
      restoreTemplateEditorSelection,
      setTemplateEditorStatus,
      setTemplateEditorTableLogicalColumnWidth,
      setTemplateEditorTableLogicalColumnWidths,
      setTemplateEditorTableLogicalRowHeight,
      syncTemplateEditorContent,
      updateTemplateTableControls,
    });
    const tableStructureController = createTemplateEditorTableStructureController({
      buildTemplateTableCellMap,
      createTemplateTableCell,
      getTemplateEditorActiveTableSelection,
      getTemplateEditorSelectedCell,
      ensureTemplateEditorTableColGroup,
      normalizeTemplateEditorTableAppearance,
      setTemplateEditorStatus,
    });
    const {
      appendMergedTemplateCellContent,
      deleteTemplateTableColumn,
      deleteTemplateTableRow,
      insertTemplateCellAtAbsoluteColumn,
      insertTemplateTableColumn,
      insertTemplateTableRow,
      isTemplateTableCellEmpty,
      mergeTemplateTableCell,
      mergeTemplateTableSelection,
      splitTemplateTableCell,
    } = tableStructureController;
    const {
      applyTemplateEditorCellShading,
      applyTemplateTableSize,
      equalizeTemplateTableColumnWidths,
      equalizeTemplateTableRowHeights,
      getTemplateEditorMedianValue,
    } = tableSizingController;

    const tableBorderActionController = createTemplateEditorTableBorderActionController({
      TEMPLATE_EDITOR_TABLE_MIN_SIZE,
      buildTemplateTableCellMap,
      getTemplateEditorActiveTableSelection,
      getTemplateEditorBorderColorInput,
      getTemplateEditorBorderStyleInput,
      getTemplateEditorBorderTargetInput,
      getTemplateEditorBorderWidthInput,
      getTemplateEditorCellPaddingBottomInput,
      getTemplateEditorCellPaddingLeftInput,
      getTemplateEditorCellPaddingRightInput,
      getTemplateEditorCellPaddingTopInput,
      getTemplateEditorSelectedCell,
      normalizeTemplateEditorColorValue,
      setTemplateEditorStatus,
    });
    const {
      applyTemplateEditorCellBorder,
      applyTemplateEditorCellPadding,
      getTemplateEditorTableTargetCells,
    } = tableBorderActionController;

    function stabilizeTemplateEditorTableRowsForCells(cells = []) {
      const rowIndexesByTable = new Map();

      cells.forEach((cell) => {
        const table = cell?.closest?.("table") || null;

        if (!(table instanceof HTMLTableElement)) {
          return;
        }

        const { entries } = buildTemplateTableCellMap(table);
        const entry = entries.get(cell);

        if (!entry) {
          return;
        }

        const rowIndexes = rowIndexesByTable.get(table) || new Set();

        for (let offset = 0; offset < Math.max(1, entry.rowSpan || 1); offset += 1) {
          rowIndexes.add(entry.rowIndex + offset);
        }

        rowIndexesByTable.set(table, rowIndexes);
      });

      rowIndexesByTable.forEach((rowIndexes, table) => {
        const minimumRowHeight = table.closest?.(candidateBlockTableHostSelector) ? 1 : TEMPLATE_EDITOR_TABLE_MIN_SIZE;

        rowIndexes.forEach((rowIndex) => {
          setTemplateEditorTableLogicalRowHeight(
            table,
            rowIndex,
            Math.max(minimumRowHeight, getTemplateEditorTableLogicalRowHeight(table, rowIndex)),
          );
        });
      });
    }

    function createCandidateBlockTableDimensionSnapshot(action) {
      if (!tableDimensionPreservingActions.has(action)) {
        return null;
      }

      const selectedCell = getTemplateEditorSelectedCell();
      const tableSelection = getTemplateEditorActiveTableSelection();
      const table = selectedCell?.closest?.("table") || tableSelection?.table || null;
      const candidateBlockElement = table?.closest?.(candidateBlockTableHostSelector) || null;

      if (!(table instanceof HTMLTableElement) || !(candidateBlockElement instanceof HTMLElement)) {
        return null;
      }

      const { columns } = ensureTemplateEditorTableColGroup(table);
      const tableRect = table.getBoundingClientRect();
      const styleWidth = parseTemplateEditorPixelLength(table.style.width, 0);
      const columnWidth = getTableColumnStyleTotal(columns);
      const rectWidth = getUnscaledCandidateBlockTableRectDimension(tableRect, candidateBlockElement, "width");
      const styleHeight = parseTemplateEditorPixelLength(table.style.height, 0);
      const rowHeight = getTableRowStyleTotal(table);
      const rectHeight = getUnscaledCandidateBlockTableRectDimension(tableRect, candidateBlockElement, "height");
      const width = getPositiveTableDimension([
        styleWidth,
        columnWidth,
        table.offsetWidth,
        rectWidth,
      ]);
      const height = getPositiveTableDimension([
        getCandidateBlockFallbackTableHeight(table, candidateBlockElement),
        styleHeight,
        rowHeight,
        table.offsetHeight,
        rectHeight,
      ]);

      return {
        columnWidth: Math.round(columnWidth || 0),
        height,
        rectHeight: Math.round(rectHeight || 0),
        rectWidth: Math.round(rectWidth || 0),
        rowHeight: Math.round(rowHeight || 0),
        styleHeight: Math.round(styleHeight || 0),
        styleWidth: Math.round(styleWidth || 0),
        table,
        width,
      };
    }

    function restoreCandidateBlockTableDimensions(snapshot) {
      const table = snapshot?.table;

      if (!(table instanceof HTMLTableElement) || !table.isConnected) {
        return false;
      }

      const blockElement = table.closest?.(candidateBlockTableHostSelector) || null;

      if (!(blockElement instanceof HTMLElement)) {
        return false;
      }

      const { columns } = ensureTemplateEditorTableColGroup(table);
      const targetColumnWidth = Math.max(1, Math.round(snapshot.columnWidth || snapshot.width || 0));
      const targetStyleWidth = Math.max(1, Math.round(snapshot.styleWidth || targetColumnWidth));
      const targetRowHeight = Math.max(
        1,
        Math.round(snapshot.rowHeight || snapshot.height || 0),
        Math.round(getCandidateBlockFallbackTableHeight(table, blockElement) || 0),
      );
      const targetStyleHeight = Math.max(1, Math.round(snapshot.styleHeight || targetRowHeight));

      if (columns.length > 0 && targetColumnWidth > 0) {
        const fallbackColumnWidth = Math.max(1, Math.round((table.offsetWidth || targetColumnWidth) / columns.length));
        const currentWidths = columns.map((columnElement) =>
          Math.max(1, parseTemplateEditorPixelLength(columnElement.style.width, fallbackColumnWidth)),
        );
        const nextWidths = distributePreservedTableSizes(currentWidths, targetColumnWidth);

        columns.forEach((columnElement, columnIndex) => {
          columnElement.style.width = `${nextWidths[columnIndex] || 1}px`;
        });

        buildTemplateTableCellMap(table).entries.forEach((entry, cellElement) => {
          const cellWidth = nextWidths
            .slice(entry.colIndex, entry.colIndex + entry.colSpan)
            .reduce((widthSum, width) => widthSum + Math.max(0, width || 0), 0);

          if (cellWidth > 0) {
            cellElement.style.width = `${cellWidth}px`;
          }
        });
      }

      const rows = Array.from(table.rows || []);

      if (rows.length > 0 && targetRowHeight > 0) {
        const fallbackRowHeight = Math.max(1, Math.round((table.offsetHeight || targetRowHeight) / rows.length));
        const currentHeights = rows.map((rowElement) =>
          Math.max(1, parseTemplateEditorPixelLength(rowElement.style.height, fallbackRowHeight)),
        );
        const nextHeights = distributePreservedTableSizes(currentHeights, targetRowHeight);

        rows.forEach((rowElement, rowIndex) => {
          rowElement.style.height = `${nextHeights[rowIndex] || 1}px`;
        });

        buildTemplateTableCellMap(table).entries.forEach((entry, cellElement) => {
          const cellHeight = nextHeights
            .slice(entry.rowIndex, entry.rowIndex + entry.rowSpan)
            .reduce((heightSum, height) => heightSum + Math.max(0, height || 0), 0);

          if (cellHeight > 0) {
            cellElement.style.height = `${cellHeight}px`;
            cellElement.style.minHeight = "0";
            fitCandidateBlockCellVerticalSpace(cellElement, cellHeight, entry.rowSpan);
          }
        });
      }

      table.dataset.candidateBlockTable = "true";
      table.style.width = `${targetStyleWidth}px`;
      table.style.height = `${targetStyleHeight}px`;
      table.style.maxWidth = "100%";
      table.style.maxHeight = "100%";
      table.style.minWidth = "0";
      table.style.minHeight = "0";
      table.style.margin = "0";
      table.style.tableLayout = "fixed";
      table.style.borderCollapse = "collapse";
      table.style.boxSizing = "border-box";
      blockElement.classList.add("has-candidate-block-table");
      return true;
    }

    function applyTemplateEditorCellVerticalAlign(verticalAlign = "top") {
      const targetCells = getTemplateEditorTableTargetCells();

      if (targetCells.length === 0) {
        setTemplateEditorStatus("표 안의 셀을 선택한 뒤 배치를 설정하세요.", "warning");
        return null;
      }

      const normalizedVerticalAlign = ["top", "middle", "bottom"].includes(String(verticalAlign || "").trim())
        ? String(verticalAlign || "").trim()
        : "top";

      targetCells.forEach((cell) => {
        cell.style.verticalAlign = normalizedVerticalAlign;
      });

      return targetCells[0] || null;
    }

    function handleTemplateTableAction(action, options = {}) {
      const { colorValue = "" } = options;
      const shouldPreserveToolbarFocus = options.preserveToolbarFocus === true;
      const toolbarFocusElement =
        shouldPreserveToolbarFocus && typeof document !== "undefined" ? document.activeElement : null;
      const toolbarFocusSelection =
        toolbarFocusElement?.matches?.(".template-toolbar-cell-padding-input") &&
        typeof toolbarFocusElement.selectionStart === "number"
          ? {
              start: toolbarFocusElement.selectionStart,
              end: toolbarFocusElement.selectionEnd,
            }
          : null;
      restoreTemplateEditorSelection();

      let focusCell = null;
      const preservedTableDimensions = createCandidateBlockTableDimensionSnapshot(action);

      if (action === "insert-row-before") {
        focusCell = insertTemplateTableRow("before");
      }

      if (action === "insert-row-after") {
        focusCell = insertTemplateTableRow("after");
      }

      if (action === "insert-column-before") {
        focusCell = insertTemplateTableColumn("before");
      }

      if (action === "insert-column-after") {
        focusCell = insertTemplateTableColumn("after");
      }

      if (action === "delete-row") {
        focusCell = deleteTemplateTableRow();
      }

      if (action === "delete-column") {
        focusCell = deleteTemplateTableColumn();
      }

      if (action === "merge-selection") {
        focusCell = mergeTemplateTableSelection();
      }

      if (action === "equalize-column-widths") {
        focusCell = equalizeTemplateTableColumnWidths();
      }

      if (action === "equalize-row-heights") {
        focusCell = equalizeTemplateTableRowHeights();
      }

      if (action === "apply-cell-shading") {
        applyTemplateEditorCellShading(colorValue);
        return true;
      }

      if (action === "apply-cell-border") {
        focusCell = applyTemplateEditorCellBorder(options);
      }

      if (action === "apply-cell-padding") {
        const paddedCells = getTemplateEditorTableTargetCells();

        focusCell = applyTemplateEditorCellPadding(options);
        stabilizeTemplateEditorTableRowsForCells(paddedCells);
      }

      if (action === "cell-vertical-align-top") {
        focusCell = applyTemplateEditorCellVerticalAlign("top");
      }

      if (action === "cell-vertical-align-middle") {
        focusCell = applyTemplateEditorCellVerticalAlign("middle");
      }

      if (action === "cell-vertical-align-bottom") {
        focusCell = applyTemplateEditorCellVerticalAlign("bottom");
      }

      if (action === "merge-right") {
        focusCell = mergeTemplateTableCell("right");
      }

      if (action === "merge-down") {
        focusCell = mergeTemplateTableCell("down");
      }

      if (action === "split-cell") {
        focusCell = splitTemplateTableCell(options);
      }

      if (!focusCell) {
        return false;
      }

      if (!shouldPreserveToolbarFocus) {
        focusTemplateEditorCell(focusCell);
      }
      restoreCandidateBlockTableDimensions(preservedTableDimensions);
      syncTemplateEditorContent();
      updateTemplateTableControls();

      if (shouldPreserveToolbarFocus && toolbarFocusElement?.isConnected) {
        toolbarFocusElement.focus?.({ preventScroll: true });

        if (toolbarFocusSelection && typeof toolbarFocusElement.setSelectionRange === "function") {
          toolbarFocusElement.setSelectionRange(toolbarFocusSelection.start, toolbarFocusSelection.end);
        }
      }

      return true;
    }

    return Object.freeze({
      appendMergedTemplateCellContent,
      applyTemplateTableSize,
      getTemplateEditorMedianValue,
      handleTemplateTableAction,
      insertTemplateCellAtAbsoluteColumn,
      isTemplateTableCellEmpty,
    });
  }

  return Object.freeze({
    createTemplateEditorTableActionController,
  });
});

})();
