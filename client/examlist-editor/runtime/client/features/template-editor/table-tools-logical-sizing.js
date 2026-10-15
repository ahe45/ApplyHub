(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableToolsLogicalSizing = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const candidateBlockTableHostSelector = "[data-candidate-block-instance], [data-candidate-block-column-name]";

  function createTemplateEditorTableLogicalSizingController({
    TEMPLATE_EDITOR_TABLE_MIN_SIZE,
    buildTemplateTableCellMap,
    ensureTemplateEditorTableColGroup,
    getTemplateEditorDocumentElement,
    getTemplateEditorMeasuredColumnWidth,
    getTemplateEditorSurface,
    parseTemplateEditorPixelStyle,
    syncTemplateEditorTableWidth,
  }) {
    function getTemplateEditorElementContentSize(element) {
      if (!(element instanceof HTMLElement)) {
        return {
          height: 0,
          width: 0,
        };
      }

      const computedStyle = window.getComputedStyle(element);
      const horizontalPadding =
        parseTemplateEditorPixelStyle(computedStyle.paddingLeft, 0) + parseTemplateEditorPixelStyle(computedStyle.paddingRight, 0);
      const verticalPadding =
        parseTemplateEditorPixelStyle(computedStyle.paddingTop, 0) + parseTemplateEditorPixelStyle(computedStyle.paddingBottom, 0);
      const rect = element.getBoundingClientRect();

      return {
        height: Math.max(0, Math.floor((element.clientHeight || rect.height || 0) - verticalPadding)),
        width: Math.max(0, Math.floor((element.clientWidth || rect.width || 0) - horizontalPadding)),
      };
    }

    function getTemplateEditorCandidateBlockHost(table) {
      const blockElement = table?.closest?.(candidateBlockTableHostSelector) || null;

      return blockElement instanceof HTMLElement ? blockElement : null;
    }

    function getTemplateEditorTableRenderedRowHeight(rowElement, minimumRowHeight = 1) {
      const table = rowElement?.closest?.("table");
      const scale = table?.offsetHeight > 0 ? table.getBoundingClientRect().height / table.offsetHeight : 1;
      const renderedHeight = Math.round((rowElement?.getBoundingClientRect?.().height || 0) / (scale || 1));

      return Math.max(minimumRowHeight, renderedHeight || minimumRowHeight);
    }

    function getTemplateEditorTableConfiguredRowHeight(rowElement, minimumRowHeight = 1) {
      const configuredHeight = parseTemplateEditorPixelStyle(rowElement?.style?.height, 0);

      if (configuredHeight > 0) {
        return configuredHeight;
      }

      return getTemplateEditorTableRenderedRowHeight(rowElement, minimumRowHeight);
    }

    function shouldUseRenderedTableRowHeights(table, configuredHeights, tolerancePx = 2) {
      if (!(table instanceof HTMLTableElement) || !configuredHeights.length) {
        return false;
      }

      const configuredTotalHeight = configuredHeights.reduce((heightSum, height) => heightSum + Math.max(0, height || 0), 0);
      const renderedTableHeight = table.offsetHeight;

      return renderedTableHeight > configuredTotalHeight + tolerancePx;
    }

    function getTemplateEditorTableRowHeights(table, minimumRowHeight = getTemplateEditorTableMinimumRowHeight(table)) {
      const rows = Array.from(table?.rows || []);
      const configuredHeights = rows.map((rowElement) =>
        Math.max(minimumRowHeight, Math.round(getTemplateEditorTableConfiguredRowHeight(rowElement, minimumRowHeight))),
      );

      if (shouldUseRenderedTableRowHeights(table, configuredHeights)) {
        return rows.map((rowElement) => getTemplateEditorTableRenderedRowHeight(rowElement, minimumRowHeight));
      }

      return configuredHeights;
    }

    function getTemplateEditorTableMinimumRowHeight(table) {
      return getTemplateEditorCandidateBlockHost(table) ? 1 : TEMPLATE_EDITOR_TABLE_MIN_SIZE;
    }

    function getTemplateEditorTableCollapsedBorderAdjustment(table, axis) {
      if (!(table instanceof HTMLTableElement)) {
        return 0;
      }

      const tableStyle = window.getComputedStyle(table);

      if (String(tableStyle.borderCollapse || "").trim().toLowerCase() !== "collapse") {
        return 0;
      }

      if (axis === "column") {
        const rows = Array.from(table.rows || []);
        const leftCell = rows.map((rowElement) => rowElement.cells?.[0]).find(Boolean);
        const rightCell = rows
          .map((rowElement) => rowElement.cells?.[Math.max(0, (rowElement.cells?.length || 1) - 1)])
          .find(Boolean);
        const leftStyle = leftCell ? window.getComputedStyle(leftCell) : null;
        const rightStyle = rightCell ? window.getComputedStyle(rightCell) : null;

        return Math.max(
          parseTemplateEditorPixelStyle(tableStyle.borderLeftWidth, 0),
          parseTemplateEditorPixelStyle(tableStyle.borderRightWidth, 0),
          parseTemplateEditorPixelStyle(leftStyle?.borderLeftWidth, 0),
          parseTemplateEditorPixelStyle(rightStyle?.borderRightWidth, 0),
        );
      }

      const firstRow = table.rows?.[0] || null;
      const lastRow = table.rows?.[Math.max(0, (table.rows?.length || 1) - 1)] || null;
      const firstCellStyle = firstRow?.cells?.[0] ? window.getComputedStyle(firstRow.cells[0]) : null;
      const lastCellStyle = lastRow?.cells?.[0] ? window.getComputedStyle(lastRow.cells[0]) : null;

      return Math.max(
        parseTemplateEditorPixelStyle(tableStyle.borderTopWidth, 0),
        parseTemplateEditorPixelStyle(tableStyle.borderBottomWidth, 0),
        parseTemplateEditorPixelStyle(firstCellStyle?.borderTopWidth, 0),
        parseTemplateEditorPixelStyle(lastCellStyle?.borderBottomWidth, 0),
      );
    }

    function getTemplateEditorTableWidthLimit(table, rawWidth) {
      const safeWidth = Math.floor(Number(rawWidth) || 0);
      const borderInset = Math.ceil(getTemplateEditorTableCollapsedBorderAdjustment(table, "column"));

      if (!(safeWidth > 0)) {
        return 0;
      }

      return Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, safeWidth - Math.max(0, borderInset));
    }

    function syncTemplateEditorTableLogicalHeight(table, minimumRowHeight = getTemplateEditorTableMinimumRowHeight(table)) {
      if (!(table instanceof HTMLTableElement) || !table.rows?.length) {
        return false;
      }

      const maxTableHeight = getTemplateEditorTableMaxHeight(table);
      const totalHeight = getTemplateEditorTableRowHeights(table, minimumRowHeight)
        .reduce((heightSum, rowHeight) => heightSum + Math.max(minimumRowHeight, Math.round(rowHeight)), 0);

      if (!(totalHeight > 0)) {
        return false;
      }

      table.style.height = `${Math.min(maxTableHeight, Math.max(minimumRowHeight, Math.round(totalHeight)))}px`;

      if (getTemplateEditorCandidateBlockHost(table)) {
        table.style.maxHeight = "100%";
      }

      return true;
    }

    function getTemplateEditorTableMaxHeight(table) {
      const blockElement = getTemplateEditorCandidateBlockHost(table);

      if (!blockElement) {
        return Number.MAX_SAFE_INTEGER;
      }

      const { height } = getTemplateEditorElementContentSize(blockElement);

      return height > 0 ? Math.max(1, height - 1) : Number.MAX_SAFE_INTEGER;
    }

    function getTemplateEditorTableMaxWidth(table) {
      const blockElement = getTemplateEditorCandidateBlockHost(table);

      if (blockElement) {
        const { width } = getTemplateEditorElementContentSize(blockElement);

        if (width > 0) {
          return Math.max(1, width - 1);
        }
      }

      const templateEditorSurface = getTemplateEditorSurface();
      const documentElement = table?.closest(".template-doc") || getTemplateEditorDocumentElement();

      if (documentElement) {
        const documentWidth = getTemplateEditorTableWidthLimit(table, documentElement.clientWidth);

        if (documentWidth > 0) {
          return Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, documentWidth);
        }
      }

      if (templateEditorSurface) {
        const surfaceStyle = window.getComputedStyle(templateEditorSurface);
        const horizontalPadding =
          parseTemplateEditorPixelStyle(surfaceStyle.paddingLeft, 0) + parseTemplateEditorPixelStyle(surfaceStyle.paddingRight, 0);
        const availableWidth = getTemplateEditorTableWidthLimit(table, templateEditorSurface.clientWidth - horizontalPadding);

        if (availableWidth > 0) {
          return Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, availableWidth);
        }
      }

      return Number.MAX_SAFE_INTEGER;
    }

    function getTemplateEditorClampedColumnGroupWidth(table, columns, columnIndexes, requestedTotalWidth) {
      const normalizedIndexes = Array.from(
        new Set((columnIndexes || []).filter((index) => Number.isInteger(index) && index >= 0)),
      ).sort((leftIndex, rightIndex) => leftIndex - rightIndex);

      if (normalizedIndexes.length === 0) {
        return Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, Math.round(requestedTotalWidth));
      }

      const minTotalWidth = TEMPLATE_EDITOR_TABLE_MIN_SIZE * normalizedIndexes.length;
      const safeRequestedWidth = Math.max(minTotalWidth, Math.round(requestedTotalWidth));
      const currentWidths = columns.map((columnElement) =>
        Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, parseTemplateEditorPixelStyle(columnElement.style.width, TEMPLATE_EDITOR_TABLE_MIN_SIZE)),
      );
      const currentTableWidth = currentWidths.reduce((widthSum, columnWidth) => widthSum + columnWidth, 0);
      const currentTargetWidth = normalizedIndexes.reduce(
        (widthSum, columnIndex) => widthSum + (currentWidths[columnIndex] || TEMPLATE_EDITOR_TABLE_MIN_SIZE),
        0,
      );
      const tableMaxWidth = getTemplateEditorTableMaxWidth(table);

      if (safeRequestedWidth <= currentTargetWidth) {
        return safeRequestedWidth;
      }

      const maxExpandableWidth =
        currentTableWidth > tableMaxWidth ? currentTargetWidth : currentTargetWidth + Math.max(0, tableMaxWidth - currentTableWidth);

      return Math.min(safeRequestedWidth, Math.max(minTotalWidth, maxExpandableWidth));
    }

    function getTemplateEditorTableLogicalColumnWidth(table, columnIndex) {
      const { columns, cellMap } = ensureTemplateEditorTableColGroup(table);
      const columnElement = columns[columnIndex];
      const configuredWidth = parseTemplateEditorPixelStyle(columnElement?.style.width, 0);

      if (configuredWidth >= TEMPLATE_EDITOR_TABLE_MIN_SIZE) {
        return configuredWidth;
      }

      return getTemplateEditorMeasuredColumnWidth(cellMap, columnIndex);
    }

    function setTemplateEditorTableLogicalColumnWidth(table, columnIndex, width) {
      const { columns } = ensureTemplateEditorTableColGroup(table);
      const columnElement = columns[columnIndex];

      if (!columnElement) {
        return false;
      }

      const safeWidth = getTemplateEditorClampedColumnGroupWidth(table, columns, [columnIndex], width);
      columnElement.style.width = `${safeWidth}px`;
      syncTemplateEditorTableWidth(table, columns);
      return true;
    }

    function setTemplateEditorTableLogicalColumnWidths(table, columnWidthEntries = []) {
      const { columns } = ensureTemplateEditorTableColGroup(table);
      const normalizedEntries = (Array.isArray(columnWidthEntries) ? columnWidthEntries : [])
        .map((entry) => ({
          columnIndex: Math.round(Number(entry?.columnIndex)),
          width: Math.round(Number(entry?.width)),
        }))
        .filter(
          (entry) =>
            Number.isInteger(entry.columnIndex) &&
            entry.columnIndex >= 0 &&
            entry.columnIndex < columns.length &&
            Number.isFinite(entry.width),
        );

      if (!normalizedEntries.length) {
        return false;
      }

      normalizedEntries.forEach(({ columnIndex, width }) => {
        columns[columnIndex].style.width = `${Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, Math.round(width))}px`;
      });
      syncTemplateEditorTableWidth(table, columns);
      return true;
    }

    function getTemplateEditorTableLogicalRowHeight(table, rowIndex) {
      const targetRow = table?.rows?.[rowIndex];
      const minimumRowHeight = getTemplateEditorTableMinimumRowHeight(table);

      if (!targetRow) {
        return minimumRowHeight;
      }

      return getTemplateEditorTableRowHeights(table, minimumRowHeight)[rowIndex] || minimumRowHeight;
    }

    function setTemplateEditorTableLogicalRowHeight(table, rowIndex, height, adjacentRow = null) {
      const targetRow = table?.rows?.[rowIndex];

      if (!targetRow) {
        return false;
      }

      const minimumRowHeight = getTemplateEditorTableMinimumRowHeight(table);
      const requestedHeight = Math.max(minimumRowHeight, Math.round(height));
      const maxTableHeight = getTemplateEditorTableMaxHeight(table);
      const rowHeights = getTemplateEditorTableRowHeights(table, minimumRowHeight);
      const preserveTableHeight = adjacentRow && Number.isInteger(adjacentRow.rowIndex) &&
        adjacentRow.rowIndex === rowIndex + 1 && table.rows[adjacentRow.rowIndex] &&
        Number.isFinite(adjacentRow.height);
      let safeRequestedHeight = requestedHeight;
      if (preserveTableHeight) {
        // CSS heights are lower bounds: text and padding can require more than
        // the editor's 24px minimum. Measure the intrinsic rows before dividing
        // the pair so a too-small request cannot expand the whole table.
        const probe = table.cloneNode(true);
        probe.style.width = `${table.offsetWidth}px`;
        probe.style.height = "0px";
        probe.style.minHeight = "0";
        probe.style.visibility = "hidden";
        probe.style.pointerEvents = "none";
        probe.style.position = "absolute";
        Array.from(probe.rows).forEach(row => { row.style.height = "0px"; });
        probe.querySelectorAll("thead,tbody,tfoot,td,th").forEach(element => {
          element.style.height = "0px";
          element.style.minHeight = "0";
        });
        table.parentElement.appendChild(probe);
        let rowMinimums;
        try {
          const probeScale = probe.offsetHeight > 0 ? probe.getBoundingClientRect().height / probe.offsetHeight : 1;
          rowMinimums = Array.from(probe.rows, row =>
            Math.max(minimumRowHeight, Math.ceil(row.getBoundingClientRect().height / (probeScale || 1))));
        } finally {
          probe.remove();
        }
        const pairHeight = requestedHeight + Math.round(adjacentRow.height);
        const targetMinimum = rowMinimums[rowIndex];
        const adjacentMinimum = rowMinimums[adjacentRow.rowIndex];
        safeRequestedHeight = Math.max(targetMinimum, Math.min(requestedHeight, pairHeight - adjacentMinimum));
        rowHeights[adjacentRow.rowIndex] = Math.max(adjacentMinimum, pairHeight - safeRequestedHeight);
      }
      const otherRowsHeight = rowHeights.reduce((heightSum, rowHeight, currentRowIndex) => {
        if (currentRowIndex === rowIndex) {
          return heightSum;
        }

        return heightSum + Math.max(minimumRowHeight, Math.round(rowHeight));
      }, 0);
      const maxRowHeight = Math.max(minimumRowHeight, maxTableHeight - otherRowsHeight);
      const safeHeight = preserveTableHeight ? safeRequestedHeight : Math.min(requestedHeight, maxRowHeight);
      const { entries } = buildTemplateTableCellMap(table);

      rowHeights[rowIndex] = safeHeight;

      Array.from(table.rows || []).forEach((rowElement, currentRowIndex) => {
        rowElement.style.height = `${rowHeights[currentRowIndex] || minimumRowHeight}px`;
      });
      entries.forEach((entry, cell) => {
        const cellHeight = rowHeights
          .slice(entry.rowIndex, entry.rowIndex + entry.rowSpan)
          .reduce((heightSum, rowHeight) => heightSum + Math.max(0, rowHeight || 0), 0);

        if (cellHeight > 0) {
          cell.style.height = `${cellHeight}px`;
          cell.style.minHeight = "0";
        }
      });

      const totalHeight = rowHeights.reduce(
        (heightSum, rowHeight) => heightSum + Math.max(minimumRowHeight, Math.round(rowHeight || 0)),
        0,
      );

      // Fixed row-group heights must follow numeric edits as well as dragging;
      // otherwise the browser redistributes the old total across all rows.
      const rows = Array.from(table.rows);
      [table.tHead, ...Array.from(table.tBodies), table.tFoot].filter(Boolean).forEach((group) => {
        group.style.height = `${Array.from(group.rows).reduce((sum, row) => sum + rowHeights[rows.indexOf(row)], 0)}px`;
      });
      if (!preserveTableHeight && totalHeight > 0) {
        table.style.height = `${Math.min(maxTableHeight, totalHeight)}px`;
      } else if (!preserveTableHeight) {
        syncTemplateEditorTableLogicalHeight(table, minimumRowHeight);
      }

      if (getTemplateEditorCandidateBlockHost(table)) {
        table.style.maxHeight = "100%";
      }

      return true;
    }

    return Object.freeze({
      getTemplateEditorClampedColumnGroupWidth,
      getTemplateEditorTableLogicalColumnWidth,
      getTemplateEditorTableLogicalRowHeight,
      setTemplateEditorTableLogicalColumnWidth,
      setTemplateEditorTableLogicalColumnWidths,
      setTemplateEditorTableLogicalRowHeight,
    });
  }

  return Object.freeze({
    createTemplateEditorTableLogicalSizingController,
  });
});

})();
