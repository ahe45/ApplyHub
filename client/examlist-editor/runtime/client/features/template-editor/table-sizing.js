(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableSizing = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const tableSizingScopeModule = globalThis.ExamListTemplateEditorTableSizingScope;
  const tableSizingValuesModule = globalThis.ExamListTemplateEditorTableSizingValues;

  if (!tableSizingScopeModule?.createTemplateEditorTableSizingScopeController) {
    throw new Error("client/features/template-editor/table-sizing-scope.js must be loaded before table-sizing.js.");
  }

  if (!tableSizingValuesModule?.createTemplateEditorTableSizingValueController) {
    throw new Error("client/features/template-editor/table-sizing-values.js must be loaded before table-sizing.js.");
  }

  const { createTemplateEditorTableSizingScopeController } = tableSizingScopeModule;
  const { createTemplateEditorTableSizingValueController } = tableSizingValuesModule;

  function createTemplateEditorTableSizingController({
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
  }) {
    const {
      getTemplateEditorEqualizeColumnIndexes,
      getTemplateEditorEqualizeRowIndexes,
      getTemplateEditorShadingTargetCells,
      getTemplateEditorSizeScopeCells,
      getTemplateEditorSizeScopeColumnIndexes,
    } = createTemplateEditorTableSizingScopeController({
      buildTemplateTableCellMap,
      getTemplateEditorActiveTableSelection,
    });
    const {
      distributeTemplateEditorTotalSize,
      getTemplateEditorMedianValue,
    } = createTemplateEditorTableSizingValueController({
      TEMPLATE_EDITOR_TABLE_MIN_SIZE,
    });

    function applyTemplateEditorTableCellWidth(cell, width) {
      const table = cell?.closest("table");

      if (!table || !cell) {
        return false;
      }

      const { entries } = buildTemplateTableCellMap(table);
      const entry = entries.get(cell);

      if (!entry) {
        return false;
      }

      const { columns } = ensureTemplateEditorTableColGroup(table);
      const targetColumnIndexes = Array.from({ length: entry.colSpan }, (_, offset) => entry.colIndex + offset);
      const safeWidth = getTemplateEditorClampedColumnGroupWidth(table, columns, targetColumnIndexes, width);
      const baseWidth = Math.floor(safeWidth / entry.colSpan);
      const remainder = safeWidth - baseWidth * entry.colSpan;

      for (let offset = 0; offset < entry.colSpan; offset += 1) {
        const nextWidth = baseWidth + (offset === entry.colSpan - 1 ? remainder : 0);
        setTemplateEditorTableLogicalColumnWidth(table, entry.colIndex + offset, nextWidth);
      }

      cell.style.width = `${safeWidth}px`;
      return true;
    }

    function equalizeTemplateTableColumnWidths() {
      const selectedCell = getTemplateEditorSelectedCell();

      if (!selectedCell) {
        setTemplateEditorStatus("표 안의 셀을 선택한 뒤 열 너비를 맞추세요.", "warning");
        return null;
      }

      const table = selectedCell.closest("table");
      const targetColumnIndexes = getTemplateEditorEqualizeColumnIndexes(table, selectedCell);

      if (targetColumnIndexes.length === 0) {
        setTemplateEditorStatus("같은 너비로 맞출 열을 찾을 수 없습니다.", "warning");
        return selectedCell;
      }

      const currentWidths = targetColumnIndexes.map((columnIndex) =>
        getTemplateEditorTableLogicalColumnWidth(table, columnIndex),
      );
      const equalizedWidths = distributeTemplateEditorTotalSize(
        currentWidths.reduce((totalWidth, width) => totalWidth + (Number(width) || TEMPLATE_EDITOR_TABLE_MIN_SIZE), 0),
        targetColumnIndexes.length,
      );

      // Apply the redistribution atomically: growing one column first can hit
      // the table width limit before the neighbouring column has shrunk.
      setTemplateEditorTableLogicalColumnWidths(table,
        targetColumnIndexes.map((columnIndex, index) => ({ columnIndex, width: equalizedWidths[index] })),
      );

      return selectedCell;
    }

    function getEqualizeRowHeights(table) {
      const scale = table.offsetHeight > 0 ? table.getBoundingClientRect().height / table.offsetHeight : 1;
      return Array.from(table.rows, row => Math.max(1, row.getBoundingClientRect().height / (scale || 1)));
    }

    function applyTemplateEditorEqualizedRowHeights(table, rowHeightEntries = []) {
      if (!table?.rows?.length || !Array.isArray(rowHeightEntries) || rowHeightEntries.length === 0) {
        return false;
      }

      const minimumRowHeight = 1;
      const normalizedEntries = rowHeightEntries
        .map((entry) => ({
          height: Math.max(minimumRowHeight, Math.round(Number(entry?.height) || minimumRowHeight)),
          rowIndex: Math.round(Number(entry?.rowIndex)),
        }))
        .filter((entry) => Number.isInteger(entry.rowIndex) && entry.rowIndex >= 0 && entry.rowIndex < table.rows.length);

      if (normalizedEntries.length === 0) {
        return false;
      }

      // Snapshot every row before writing: browser table layout can redistribute
      // the remaining height as soon as a single row changes.
      const rowHeights = getEqualizeRowHeights(table);
      normalizedEntries.forEach(({ rowIndex, height }) => { rowHeights[rowIndex] = height; });
      const { entries } = buildTemplateTableCellMap(table);
      const rows = Array.from(table.rows);
      rows.forEach((row, index) => { row.style.height = rowHeights[index] + "px"; });
      entries.forEach((entry, cell) => {
        cell.style.height = rowHeights.slice(entry.rowIndex, entry.rowIndex + entry.rowSpan)
          .reduce((sum, height) => sum + height, 0) + "px";
      });
      [table.tHead, ...Array.from(table.tBodies), table.tFoot].filter(Boolean).forEach((group) => {
        group.style.height = Array.from(group.rows)
          .reduce((sum, row) => sum + rowHeights[rows.indexOf(row)], 0) + "px";
      });
      // Keep the existing outer height, including collapsed borders and any
      // percentage sizing; only redistribute the rows inside it.

      return true;
    }

    function equalizeTemplateTableRowHeights() {
      const selectedCell = getTemplateEditorSelectedCell();

      if (!selectedCell) {
        setTemplateEditorStatus("표 안의 셀을 선택한 뒤 행 높이를 맞추세요.", "warning");
        return null;
      }

      const table = selectedCell.closest("table");
      const targetRowIndexes = getTemplateEditorEqualizeRowIndexes(table, selectedCell);

      if (targetRowIndexes.length === 0) {
        setTemplateEditorStatus("같은 높이로 맞출 행을 찾을 수 없습니다.", "warning");
        return selectedCell;
      }

      const allRowHeights = getEqualizeRowHeights(table);
      const currentHeights = targetRowIndexes.map((rowIndex) => allRowHeights[rowIndex]);
      const targetTotalHeight = currentHeights.reduce((sum, height) => sum + height, 0);
      const equalizedHeights = distributeTemplateEditorTotalSize(
        targetTotalHeight,
        targetRowIndexes.length,
        1,
      );

      applyTemplateEditorEqualizedRowHeights(
        table,
        targetRowIndexes.map((rowIndex, index) => ({
          height: equalizedHeights[index],
          rowIndex,
        })),
      );

      return selectedCell;
    }

    function applyTemplateEditorCellShading(colorValue = "") {
      const selectedCell = getTemplateEditorSelectedCell() || getTemplateEditorActiveTableSelection()?.anchorCell || null;

      if (!selectedCell) {
        setTemplateEditorStatus("표 안의 셀을 선택한 뒤 음영을 적용하세요.", "warning");
        return null;
      }

      const rawShadingValue = String(colorValue || getTemplateEditorCellShadingInput()?.value || "").trim();
      const normalizedRawShadingValue = rawShadingValue.toLowerCase().replace(/\s+/g, "");
      const shadingValue =
        normalizedRawShadingValue === "transparent" ||
        normalizedRawShadingValue === "none" ||
        normalizedRawShadingValue === "rgba(0,0,0,0)"
          ? "transparent"
          : normalizeTemplateEditorColorValue(rawShadingValue, "#ffffff");
      const targetCells = getTemplateEditorShadingTargetCells(selectedCell);

      if (targetCells.length === 0) {
        setTemplateEditorStatus("음영을 적용할 셀을 찾을 수 없습니다.", "warning");
        return selectedCell;
      }

      targetCells.forEach((cell) => {
        cell.style.backgroundColor = shadingValue;
      });

      syncTemplateEditorContent();
      updateTemplateTableControls();
      return selectedCell;
    }

    function applyTemplateTableSize(options = {}) {
      const toolbarFocus = options.preserveToolbarFocus ? document.activeElement : null;
      restoreTemplateEditorSelection();

      const selectedCell = getTemplateEditorSelectedCell();

      if (!selectedCell) {
        setTemplateEditorStatus("표 안의 셀을 선택한 뒤 크기를 조정하세요.", "warning");
        return;
      }

      const targetCells = getTemplateEditorActiveTableSelection()?.selectedCells?.length
        ? Array.from(getTemplateEditorActiveTableSelection().selectedCells) : [selectedCell];

      if (targetCells.length === 0) {
        setTemplateEditorStatus("적용할 셀을 찾을 수 없습니다.", "warning");
        return;
      }

      const widthInput = options.dimension === "height" ? "" : String(getTemplateEditorCellWidthInput()?.value || "").trim();
      const heightInput = options.dimension === "width" ? "" : String(getTemplateEditorRowHeightInput()?.value || "").trim();
      const widthValue = widthInput ? Number(widthInput) : null;
      const heightValue = heightInput ? Number(heightInput) : null;

      if (widthValue === null && heightValue === null) {
        setTemplateEditorStatus("셀 가로 또는 세로 값을 입력하세요.", "warning");
        return;
      }

      if ([widthValue, heightValue].some(value => value !== null && (!Number.isFinite(value) || value < TEMPLATE_EDITOR_TABLE_MIN_SIZE))) {
        setTemplateEditorStatus(`셀 크기는 ${TEMPLATE_EDITOR_TABLE_MIN_SIZE}px 이상으로 입력하세요.`, "warning");
        return;
      }

      if (widthValue !== null) {
        if (!Number.isFinite(widthValue) || widthValue < TEMPLATE_EDITOR_TABLE_MIN_SIZE) {
          setTemplateEditorStatus(`셀 가로 길이는 ${TEMPLATE_EDITOR_TABLE_MIN_SIZE}px 이상으로 입력하세요.`, "warning");
          return;
        }

        const table = selectedCell.closest("table");
        const { entries } = buildTemplateTableCellMap(table);
        const widths = new Map();
        targetCells.forEach(cell => {
          const entry = entries.get(cell);
          if (!entry) return;
          const base = Math.floor(widthValue / entry.colSpan);
          for (let index = 0; index < entry.colSpan; index += 1) {
            widths.set(entry.colIndex + index, base + (index === entry.colSpan - 1 ? widthValue - base * entry.colSpan : 0));
          }
        });
        const { columns } = ensureTemplateEditorTableColGroup(table);
        const indexes = Array.from(widths.keys());
        const total = Array.from(widths.values()).reduce((sum, width) => sum + width, 0);
        const safeTotal = getTemplateEditorClampedColumnGroupWidth(table, columns, indexes, total);
        let used = 0;
        setTemplateEditorTableLogicalColumnWidths(table, indexes.map((columnIndex, index) => {
          const width = index === indexes.length - 1 ? safeTotal - used : Math.round(widths.get(columnIndex) * safeTotal / total);
          used += width;
          return { columnIndex, width };
        }));
      }

      if (heightValue !== null) {
        if (!Number.isFinite(heightValue) || heightValue < TEMPLATE_EDITOR_TABLE_MIN_SIZE) {
          setTemplateEditorStatus(`셀 세로 길이는 ${TEMPLATE_EDITOR_TABLE_MIN_SIZE}px 이상으로 입력하세요.`, "warning");
          return;
        }

        const rowIndexesByTable = new Map();

        targetCells.forEach((cell) => {
          const table = cell.closest?.("table") || null;
          const rowElement = cell.parentElement;
          const rowIndex = table && rowElement ? Array.from(table.rows || []).indexOf(rowElement) : -1;

          if (table && rowIndex >= 0) {
            const rowIndexes = rowIndexesByTable.get(table) || new Map();
            const span = Math.max(1, Math.min(cell.rowSpan || 1, table.rows.length - rowIndex));
            const baseHeight = Math.floor(heightValue / span);
            for (let index = 0; index < span; index += 1) {
              rowIndexes.set(rowIndex + index, baseHeight + (index === span - 1 ? heightValue - baseHeight * span : 0));
            }
            rowIndexesByTable.set(table, rowIndexes);
            return;
          }

          cell.style.height = `${heightValue}px`;
          if (rowElement) {
            rowElement.style.height = `${heightValue}px`;
          }
        });

        rowIndexesByTable.forEach((rowIndexes, table) => {
          rowIndexes.forEach((height, rowIndex) => {
            setTemplateEditorTableLogicalRowHeight(table, rowIndex, height);
          });
        });
      }

      if (!options.preserveToolbarFocus) focusTemplateEditorCell(selectedCell);
      syncTemplateEditorContent();
      updateTemplateTableControls();
      toolbarFocus?.focus?.({ preventScroll: true });
    }

    return Object.freeze({
      applyTemplateEditorCellShading,
      applyTemplateTableSize,
      equalizeTemplateTableColumnWidths,
      equalizeTemplateTableRowHeights,
      getTemplateEditorMedianValue,
    });
  }

  return Object.freeze({
    createTemplateEditorTableSizingController,
  });
});

})();
