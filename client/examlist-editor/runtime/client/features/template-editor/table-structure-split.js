(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableStructureSplit = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const TEMPLATE_EDITOR_LOCAL_TABLE_MIN_SIZE = 24;
  const countFormatter = new Intl.NumberFormat("ko-KR");

  function formatRuntimeCount(value) {
    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? countFormatter.format(Math.max(0, Math.trunc(numericValue))) : "0";
  }

  function createTemplateEditorTableSplitController({
    buildTemplateTableCellMap,
    ensureTemplateEditorTableColGroup,
    getTemplateEditorActiveTableSelection,
    getTemplateEditorSelectedCell,
    insertTemplateCellAtAbsoluteColumn,
    isTemplateTableCellEmpty,
    normalizeTemplateEditorTableAppearance,
    setTemplateEditorStatus,
  }) {
    function cloneEmptyTemplateTableCell(sourceCell) {
      const nextCell = sourceCell?.cloneNode(false) || document.createElement(sourceCell?.tagName?.toLowerCase?.() || "td");

      nextCell.innerHTML = "<br />";
      nextCell.rowSpan = 1;
      nextCell.colSpan = 1;
      return nextCell;
    }

    function buildTemplateCellSplitSegments(totalSpan, segmentCount) {
      const safeTotalSpan = Math.max(Math.round(Number(totalSpan) || 0), 1);
      const safeSegmentCount = Math.max(Math.round(Number(segmentCount) || 0), 1);
      const baseSpan = Math.floor(safeTotalSpan / safeSegmentCount);
      const remainder = safeTotalSpan % safeSegmentCount;

      return Array.from({ length: safeSegmentCount }, (_, index) => baseSpan + (index < remainder ? 1 : 0));
    }

    function fullySplitTemplateTableCell(selectedCell, selectedEntry, table) {
      const originalRowSpan = selectedEntry.rowSpan;
      const originalColSpan = selectedEntry.colSpan;

      selectedCell.rowSpan = 1;
      selectedCell.colSpan = 1;

      for (let rowOffset = 0; rowOffset < originalRowSpan; rowOffset += 1) {
        const row = table.rows[selectedEntry.rowIndex + rowOffset];

        for (let colOffset = 0; colOffset < originalColSpan; colOffset += 1) {
          if (rowOffset === 0 && colOffset === 0) {
            continue;
          }

          insertTemplateCellAtAbsoluteColumn(
            row,
            selectedEntry.colIndex + colOffset,
            cloneEmptyTemplateTableCell(selectedCell),
          );
        }
      }

      if (isTemplateTableCellEmpty(selectedCell)) {
        selectedCell.innerHTML = "<br />";
      }

      normalizeTemplateEditorTableAppearance(table);

      return selectedCell;
    }

    function parseTemplateTablePixelStyle(value, fallback = 0) {
      const parsedValue = Number.parseFloat(String(value || "").replace("px", ""));
      return Number.isFinite(parsedValue) ? parsedValue : fallback;
    }

    function getTemplateTableSplitColumnWidth(table, columnIndex) {
      const { columns, cellMap } = ensureTemplateEditorTableColGroup(table);
      const configuredWidth = parseTemplateTablePixelStyle(columns[columnIndex]?.style.width, 0);

      if (configuredWidth > 0) {
        return configuredWidth;
      }

      const { matrix, entries } = cellMap;

      for (const row of matrix) {
        const cell = row?.[columnIndex];
        const entry = cell ? entries.get(cell) : null;

        if (!entry) {
          continue;
        }

        const measuredWidth = Math.round(cell.getBoundingClientRect().width / entry.colSpan);

        if (Number.isFinite(measuredWidth) && measuredWidth > 0) {
          return measuredWidth;
        }
      }

      return TEMPLATE_EDITOR_LOCAL_TABLE_MIN_SIZE;
    }

    function buildTemplateTableEvenSizes(totalSize, count) {
      const safeCount = Math.max(Math.round(Number(count) || 0), 1);
      const safeTotal = Math.max(Math.round(Number(totalSize) || 0), safeCount);
      const baseSize = Math.floor(safeTotal / safeCount);
      const remainder = safeTotal - baseSize * safeCount;

      return Array.from({ length: safeCount }, (_item, index) => baseSize + (index === safeCount - 1 ? remainder : 0));
    }

    function syncTemplateSplitTableWidth(table, columns) {
      const totalWidth = columns.reduce((widthSum, columnElement) => {
        const columnWidth = parseTemplateTablePixelStyle(columnElement.style.width, TEMPLATE_EDITOR_LOCAL_TABLE_MIN_SIZE);
        return widthSum + Math.max(1, columnWidth);
      }, 0);

      table.style.width = `${Math.max(1, Math.round(totalWidth))}px`;
      table.style.maxWidth = "none";
    }

    function splitTemplateTableColGroupAtColumn(table, columnIndex, splitCount) {
      const { columns } = ensureTemplateEditorTableColGroup(table);
      const colGroup = columns[columnIndex]?.parentElement || null;

      if (!colGroup) {
        return [];
      }

      const originalWidth = getTemplateTableSplitColumnWidth(table, columnIndex);
      const columnWidths = buildTemplateTableEvenSizes(originalWidth, splitCount);

      columns[columnIndex].style.width = `${Math.max(1, columnWidths[0])}px`;

      for (let splitIndex = 1; splitIndex < columnWidths.length; splitIndex += 1) {
        const nextColumn = document.createElement("col");
        nextColumn.style.width = `${Math.max(1, columnWidths[splitIndex])}px`;
        colGroup.insertBefore(nextColumn, colGroup.children[columnIndex + splitIndex] || null);
      }

      syncTemplateSplitTableWidth(table, Array.from(colGroup.children));
      return columnWidths;
    }

    function getTemplateTableSplitRowHeight(row, cell) {
      const configuredRowHeight = parseTemplateTablePixelStyle(row?.style.height, 0);

      if (configuredRowHeight > 0) {
        return configuredRowHeight;
      }

      const configuredCellHeight = parseTemplateTablePixelStyle(cell?.style.height, 0);

      if (configuredCellHeight > 0) {
        return configuredCellHeight;
      }

      const measuredHeight = Math.round(cell?.getBoundingClientRect?.().height || row?.getBoundingClientRect?.().height || 0);

      return Number.isFinite(measuredHeight) && measuredHeight > 0 ? measuredHeight : TEMPLATE_EDITOR_LOCAL_TABLE_MIN_SIZE;
    }

    function getCandidateBlockVisualScale(blockElement, axis) {
      if (!(blockElement instanceof HTMLElement)) {
        return 1;
      }

      const rect = blockElement.getBoundingClientRect();
      const isHeightAxis = axis === "height";
      const logicalSize =
        parseTemplateTablePixelStyle(
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

    function getCandidateBlockLogicalTableHeight(table, blockElement) {
      const tableRect = table?.getBoundingClientRect?.();
      const visualHeight = tableRect?.height || 0;
      const visualScale = getCandidateBlockVisualScale(blockElement, "height");
      const logicalHeight = visualHeight / visualScale;

      return Number.isFinite(logicalHeight) && logicalHeight > 0 ? logicalHeight : 0;
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

    function getCandidateBlockPreservedTableHeight(table) {
      const blockElement = table?.closest?.("[data-candidate-block-instance]") || null;

      if (!(blockElement instanceof HTMLElement)) {
        return 0;
      }

      const rowStyleTotal = Array.from(table.rows || []).reduce(
        (totalHeight, rowElement) => totalHeight + Math.max(0, parseTemplateTablePixelStyle(rowElement.style.height, 0)),
        0,
      );
      const configuredHeight = parseTemplateTablePixelStyle(table.style.height, 0);
      const rowCount = Math.max(1, Array.from(table.rows || []).length);
      const blockHeight = configuredHeight <= rowCount * 4
        ? blockElement.clientHeight || blockElement.offsetHeight || parseTemplateTablePixelStyle(blockElement.dataset?.candidateBlockLogicalHeight, 0)
        : 0;

      if (configuredHeight > rowCount * 4) {
        return Math.max(1, Math.round(configuredHeight));
      }

      if (rowStyleTotal > 0) {
        return Math.max(1, Math.round(rowStyleTotal));
      }

      const candidates = [
        blockHeight,
        table.offsetHeight,
        getCandidateBlockLogicalTableHeight(table, blockElement),
      ]
        .filter((height) => Number.isFinite(height) && height > 0)
        .map((height) => Math.round(height));

      return Math.max(1, candidates.length ? Math.max(...candidates) : 0);
    }

    function distributeTemplateTablePreservedHeights(currentHeights = [], targetHeight = 0) {
      const safeCount = Math.max(1, currentHeights.length);
      const safeTargetHeight = Math.max(safeCount, Math.round(Number(targetHeight) || 0));
      const baseHeights = currentHeights.map((height) => Math.max(1, Math.round(Number(height) || 0)));
      const currentTotal = baseHeights.reduce((heightSum, height) => heightSum + height, 0);

      if (!(currentTotal > 0)) {
        const baseHeight = Math.floor(safeTargetHeight / safeCount);
        let remainder = safeTargetHeight - baseHeight * safeCount;

        return Array.from({ length: safeCount }, () => {
          const nextHeight = baseHeight + (remainder > 0 ? 1 : 0);

          remainder -= 1;
          return Math.max(1, nextHeight);
        });
      }

      const scale = safeTargetHeight / currentTotal;
      let usedHeight = 0;

      return baseHeights.map((height, index) => {
        const remainingCount = safeCount - index - 1;
        const maxHeight = safeTargetHeight - usedHeight - remainingCount;
        const nextHeight = index === safeCount - 1
          ? safeTargetHeight - usedHeight
          : Math.min(maxHeight, Math.max(1, Math.round(height * scale)));

        usedHeight += nextHeight;
        return Math.max(1, nextHeight);
      });
    }

    function getTemplateTableSplitSelectionCells(tableSelection) {
      const table = tableSelection?.table;

      if (!(table instanceof HTMLTableElement) || !Array.isArray(tableSelection?.selectedCells)) {
        return [];
      }

      const { entries } = buildTemplateTableCellMap(table);

      return Array.from(new Set(tableSelection.selectedCells))
        .map((cellElement) => ({
          cellElement,
          entry: cellElement?.isConnected && cellElement.closest?.("table") === table ? entries.get(cellElement) : null,
        }))
        .filter(({ entry }) => Boolean(entry))
        .sort((left, right) => left.entry.rowIndex - right.entry.rowIndex || left.entry.colIndex - right.entry.colIndex)
        .map(({ cellElement }) => cellElement);
    }

    function restoreCandidateBlockSplitTableHeight(table, targetHeight) {
      if (!table?.closest?.("[data-candidate-block-instance]") || !(targetHeight > 0)) {
        return;
      }

      const rows = Array.from(table.rows || []);

      if (!rows.length) {
        return;
      }

      const currentHeights = rows.map((rowElement) =>
        Math.max(1, parseTemplateTablePixelStyle(rowElement.style.height, rowElement.getBoundingClientRect?.().height || 0)),
      );
      const nextHeights = distributeTemplateTablePreservedHeights(currentHeights, targetHeight);

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
          if (cellHeight / Math.max(1, entry.rowSpan || 1) <= 40) {
            const computedStyle = window.getComputedStyle(cellElement);
            const paddingLeft = cellElement.style.paddingLeft || computedStyle.paddingLeft || "0px";
            const paddingRight = cellElement.style.paddingRight || computedStyle.paddingRight || "0px";

            cellElement.style.padding = `0px ${paddingRight} 0px ${paddingLeft}`;
            cellElement.style.overflow = "hidden";
          }
        }
      });

      table.style.height = `${Math.max(1, Math.round(targetHeight))}px`;
      table.style.maxHeight = "100%";
    }

    function applyTemplateTableRowHeight(row, height, { resetCellMinHeight = false } = {}) {
      if (!row) {
        return;
      }

      const safeHeight = Math.max(1, Math.round(Number(height) || 0));

      row.style.height = `${safeHeight}px`;
      Array.from(row.cells || []).forEach((cell) => {
        cell.style.height = `${safeHeight}px`;
        if (resetCellMinHeight) {
          cell.style.minHeight = "0";
        }
      });
    }

    function getTemplateTableMinimumSplitSize(table) {
      return table?.closest?.("[data-candidate-block-instance]")
        ? 1
        : TEMPLATE_EDITOR_LOCAL_TABLE_MIN_SIZE;
    }

    function resetCandidateBlockTableCellMinimumHeights(table) {
      if (!table?.closest?.("[data-candidate-block-instance]")) {
        return;
      }

      table.querySelectorAll("td, th").forEach((cellElement) => {
        cellElement.style.minHeight = "0";
      });
    }

    function splitTemplateTableCellByAddingColumns(selectedCell, selectedEntry, table, requestedCount) {
      const addedColumnCount = Math.max(Math.round(Number(requestedCount)) - 1, 1);
      const { matrix, entries } = buildTemplateTableCellMap(table);
      const selectedRowIndexes = new Set(
        Array.from({ length: selectedEntry.rowSpan }, (_item, rowOffset) => selectedEntry.rowIndex + rowOffset),
      );
      const adjustedCells = new Set([selectedCell]);

      const columnWidths = splitTemplateTableColGroupAtColumn(table, selectedEntry.colIndex, addedColumnCount + 1);

      if (columnWidths[0]) {
        selectedCell.style.width = `${Math.max(1, columnWidths[0])}px`;
      }

      for (let splitIndex = 1; splitIndex <= addedColumnCount; splitIndex += 1) {
        const nextCell = cloneEmptyTemplateTableCell(selectedCell);

        nextCell.rowSpan = selectedEntry.rowSpan;
        nextCell.colSpan = 1;
        if (columnWidths[splitIndex]) {
          nextCell.style.width = `${Math.max(1, columnWidths[splitIndex])}px`;
        }
        insertTemplateCellAtAbsoluteColumn(selectedCell.parentElement, selectedEntry.colIndex + splitIndex, nextCell);
      }

      matrix.forEach((rowCells, rowIndex) => {
        if (selectedRowIndexes.has(rowIndex)) {
          return;
        }

        const coveringCell = rowCells?.[selectedEntry.colIndex] || null;
        const coveringEntry = coveringCell ? entries.get(coveringCell) : null;

        if (!coveringEntry || adjustedCells.has(coveringCell)) {
          return;
        }

        coveringCell.colSpan = coveringEntry.colSpan + addedColumnCount;
        adjustedCells.add(coveringCell);
      });

      normalizeTemplateEditorTableAppearance(table);
      syncTemplateSplitTableWidth(table, Array.from(table.querySelectorAll("colgroup > col")));
      return selectedCell;
    }

    function splitTemplateTableCellByAddingRows(selectedCell, selectedEntry, table, requestedCount) {
      const addedRowCount = Math.max(Math.round(Number(requestedCount)) - 1, 1);
      const { matrix, entries } = buildTemplateTableCellMap(table);
      const adjustedCells = new Set([selectedCell]);
      const selectedRowCells = matrix[selectedEntry.rowIndex] || [];
      const selectedRow = table.rows[selectedEntry.rowIndex];
      const originalHeight = getTemplateTableSplitRowHeight(selectedRow, selectedCell);
      const isCandidateBlockTable = Boolean(table.closest?.("[data-candidate-block-instance]"));
      const preservedTableHeight = isCandidateBlockTable ? getCandidateBlockPreservedTableHeight(table) : 0;
      const minimumSplitSize = getTemplateTableMinimumSplitSize(table);
      const canSplitInside = originalHeight >= minimumSplitSize * (addedRowCount + 1);
      const nextRowHeight = canSplitInside
        ? Math.max(1, Math.round(originalHeight / (addedRowCount + 1)))
        : isCandidateBlockTable
          ? Math.max(1, Math.round(originalHeight / (addedRowCount + 1)))
          : originalHeight;

      selectedRowCells.forEach((cell) => {
        const entry = cell ? entries.get(cell) : null;

        if (!entry || cell === selectedCell || adjustedCells.has(cell)) {
          return;
        }

        cell.rowSpan = entry.rowSpan + addedRowCount;
        adjustedCells.add(cell);
      });

      applyTemplateTableRowHeight(selectedRow, nextRowHeight, { resetCellMinHeight: isCandidateBlockTable });

      let anchorRow = selectedRow;

      for (let splitIndex = 1; splitIndex <= addedRowCount; splitIndex += 1) {
        const nextRow = document.createElement("tr");
        const nextCell = cloneEmptyTemplateTableCell(selectedCell);

        nextCell.rowSpan = 1;
        nextCell.colSpan = selectedEntry.colSpan;
        nextCell.style.height = `${nextRowHeight}px`;
        if (isCandidateBlockTable) {
          nextCell.style.minHeight = "0";
        }
        nextRow.style.height = `${nextRowHeight}px`;
        anchorRow.after(nextRow);
        insertTemplateCellAtAbsoluteColumn(nextRow, selectedEntry.colIndex, nextCell);
        anchorRow = nextRow;
      }

      resetCandidateBlockTableCellMinimumHeights(table);
      normalizeTemplateEditorTableAppearance(table);
      restoreCandidateBlockSplitTableHeight(table, preservedTableHeight);
      return selectedCell;
    }

    function splitTemplateTableCellElement(selectedCell, { axis = "", count = 0 } = {}) {
      const table = selectedCell.closest("table");
      const { entries } = buildTemplateTableCellMap(table);
      const selectedEntry = entries.get(selectedCell);

      if (!selectedEntry) {
        setTemplateEditorStatus("선택한 셀 정보를 읽을 수 없습니다.", "warning");
        return null;
      }

      const normalizedAxis = String(axis || "").trim().toLowerCase();

      if (!normalizedAxis) {
        if (selectedEntry.rowSpan === 1 && selectedEntry.colSpan === 1) {
          setTemplateEditorStatus("현재 셀은 이미 분할된 상태입니다.", "warning");
          return selectedCell;
        }

        return fullySplitTemplateTableCell(selectedCell, selectedEntry, table);
      }

      const isRowSplit = normalizedAxis === "row";
      const spanLabel = isRowSplit ? "행" : "열";
      const availableSpan = isRowSplit ? selectedEntry.rowSpan : selectedEntry.colSpan;
      const requestedCount = Math.round(Number(count));

      if (!Number.isFinite(requestedCount) || requestedCount < 2) {
        setTemplateEditorStatus("셀 분할 개수는 2 이상이어야 합니다.", "warning");
        return null;
      }

      if (availableSpan < 2) {
        return isRowSplit
          ? splitTemplateTableCellByAddingRows(selectedCell, selectedEntry, table, requestedCount)
          : splitTemplateTableCellByAddingColumns(selectedCell, selectedEntry, table, requestedCount);
      }

      if (requestedCount > availableSpan) {
        setTemplateEditorStatus(`현재 셀은 ${spanLabel} 방향으로 최대 ${formatRuntimeCount(availableSpan)}개까지 분할할 수 있습니다.`, "warning");
        return null;
      }

      const segmentSpans = buildTemplateCellSplitSegments(availableSpan, requestedCount);

      if (isRowSplit) {
        const originalColSpan = selectedEntry.colSpan;
        let rowOffset = segmentSpans[0];

        selectedCell.rowSpan = segmentSpans[0];
        selectedCell.colSpan = originalColSpan;

        for (let segmentIndex = 1; segmentIndex < segmentSpans.length; segmentIndex += 1) {
          const targetRow = table.rows[selectedEntry.rowIndex + rowOffset];

          if (!targetRow) {
            setTemplateEditorStatus("셀 분할 중 행 구조를 계산할 수 없습니다.", "warning");
            return null;
          }

          const nextCell = cloneEmptyTemplateTableCell(selectedCell);
          nextCell.rowSpan = segmentSpans[segmentIndex];
          nextCell.colSpan = originalColSpan;
          insertTemplateCellAtAbsoluteColumn(targetRow, selectedEntry.colIndex, nextCell);
          rowOffset += segmentSpans[segmentIndex];
        }
      } else {
        const originalRowSpan = selectedEntry.rowSpan;
        let columnOffset = segmentSpans[0];

        selectedCell.rowSpan = originalRowSpan;
        selectedCell.colSpan = segmentSpans[0];

        for (let segmentIndex = 1; segmentIndex < segmentSpans.length; segmentIndex += 1) {
          const nextCell = cloneEmptyTemplateTableCell(selectedCell);
          nextCell.rowSpan = originalRowSpan;
          nextCell.colSpan = segmentSpans[segmentIndex];
          insertTemplateCellAtAbsoluteColumn(
            selectedCell.parentElement,
            selectedEntry.colIndex + columnOffset,
            nextCell,
          );
          columnOffset += segmentSpans[segmentIndex];
        }
      }

      if (isTemplateTableCellEmpty(selectedCell)) {
        selectedCell.innerHTML = "<br />";
      }

      normalizeTemplateEditorTableAppearance(table);

      return selectedCell;
    }

    function splitTemplateTableSelection(options = {}) {
      const tableSelection = getTemplateEditorActiveTableSelection?.();
      const selectedCells = getTemplateTableSplitSelectionCells(tableSelection);

      if (selectedCells.length < 2) {
        return null;
      }

      let focusCell = null;
      let splitCount = 0;
      const pendingCells = new Set(selectedCells);

      while (pendingCells.size > 0) {
        const nextCells = getTemplateTableSplitSelectionCells({
          ...tableSelection,
          selectedCells: Array.from(pendingCells),
        });
        const selectedCell = nextCells[0] || null;

        if (!selectedCell) {
          break;
        }

        pendingCells.delete(selectedCell);

        const splitCell = splitTemplateTableCellElement(selectedCell, options);

        if (!splitCell) {
          return focusCell || selectedCell;
        }

        focusCell = focusCell || splitCell;
        splitCount += 1;
      }

      return splitCount > 0 ? focusCell : null;
    }

    function splitTemplateTableCell(options = {}) {
      const tableSelection = getTemplateEditorActiveTableSelection?.();

      if (tableSelection?.selectedCells?.length > 1) {
        return splitTemplateTableSelection(options);
      }

      const selectedCell = getTemplateEditorSelectedCell();

      if (!selectedCell) {
        setTemplateEditorStatus("표 안의 셀을 선택한 뒤 분할하세요.", "warning");
        return null;
      }

      return splitTemplateTableCellElement(selectedCell, options);
    }

    return Object.freeze({
      splitTemplateTableCell,
    });
  }

  return Object.freeze({
    createTemplateEditorTableSplitController,
  });
});

})();
