(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalScope);
    return;
  }

  globalScope.ExamListEditorTableSizingUtils = factory(globalScope);
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  const tableCellUtils = globalScope.ExamListEditorTableCellUtils;

  if (!tableCellUtils) {
    throw new Error("client/features/editor/table-cell-utils.js must be loaded before client/features/editor/table-sizing-utils.js.");
  }

  const {
    TEMPLATE_EDITOR_TABLE_MIN_SIZE,
    buildTemplateTableCellMap,
    getTemplateEditorMeasuredColumnWidth,
    getTemplateEditorTableColumnCount,
    parseTemplateEditorPixelStyle,
  } = tableCellUtils;

  function ensureTemplateEditorTableColGroup(table) {
    const cellMap = buildTemplateTableCellMap(table);
    const columnCount = getTemplateEditorTableColumnCount(cellMap.matrix);
    let colGroup = Array.from(table.children).find((child) => child.tagName === "COLGROUP") || null;

    if (!colGroup) {
      colGroup = document.createElement("colgroup");
      table.insertBefore(colGroup, table.firstElementChild);
    }

    while (colGroup.children.length < columnCount) {
      colGroup.appendChild(document.createElement("col"));
    }

    while (colGroup.children.length > columnCount) {
      colGroup.lastElementChild?.remove();
    }

    const columns = Array.from(colGroup.children);
    const measuredTableWidth = Math.round(table.getBoundingClientRect().width);
    const configuredWidths = columns.map((columnElement) => parseTemplateEditorPixelStyle(columnElement.style.width, 0));
    const configuredTotalWidth = configuredWidths.reduce((widthSum, columnWidth) => widthSum + Math.max(0, columnWidth), 0);
    const hasConfiguredColumnWidths = configuredWidths.every((columnWidth) => columnWidth >= TEMPLATE_EDITOR_TABLE_MIN_SIZE);
    const hasFlexibleTableWidth = !String(table.style.width || "").trim().endsWith("px");
    const shouldHydrateStaleColumnWidths =
      columnCount > 0 &&
      hasConfiguredColumnWidths &&
      hasFlexibleTableWidth &&
      measuredTableWidth > configuredTotalWidth + Math.max(8, columnCount * 2);
    const measuredColumnWidths = shouldHydrateStaleColumnWidths
      ? Array.from({ length: columnCount }, (_, columnIndex) => getTemplateEditorMeasuredColumnWidth(cellMap, columnIndex))
      : [];

    if (shouldHydrateStaleColumnWidths) {
      const measuredTotalWidth = measuredColumnWidths.reduce((widthSum, columnWidth) => widthSum + columnWidth, 0);
      const scale = measuredTotalWidth > 0 ? measuredTableWidth / measuredTotalWidth : 1;
      let remainingWidth = measuredTableWidth;

      measuredColumnWidths.forEach((columnWidth, columnIndex) => {
        const isLastColumn = columnIndex === measuredColumnWidths.length - 1;
        const nextWidth = isLastColumn
          ? Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, remainingWidth)
          : Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, Math.round(columnWidth * scale));

        columns[columnIndex].style.width = `${nextWidth}px`;
        remainingWidth -= nextWidth;
      });
    }

    columns.forEach((columnElement, columnIndex) => {
      const currentWidth = parseTemplateEditorPixelStyle(columnElement.style.width, 0);

      if (!currentWidth) {
        columnElement.style.width = `${getTemplateEditorMeasuredColumnWidth(cellMap, columnIndex)}px`;
      }
    });

    return {
      columns,
      cellMap,
    };
  }

  function syncTemplateEditorTableWidth(table, columns = []) {
    const targetColumns = columns.length > 0 ? columns : ensureTemplateEditorTableColGroup(table).columns;
    const minimumColumnWidth = getCandidateBlockTableHost(table) ? 1 : TEMPLATE_EDITOR_TABLE_MIN_SIZE;
    const totalWidth = targetColumns.reduce((widthSum, columnElement) => {
      const columnWidth = parseTemplateEditorPixelStyle(columnElement.style.width, minimumColumnWidth);
      return widthSum + Math.max(minimumColumnWidth, columnWidth);
    }, 0);

    table.style.width = `${totalWidth}px`;
    table.style.maxWidth = getCandidateBlockTableHost(table) ? "100%" : "none";
  }

  function getTemplateEditorElementContentSize(element) {
    if (!(element instanceof HTMLElement)) {
      return {
        height: 0,
        width: 0,
      };
    }

    const computedStyle = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const horizontalPadding =
      parseTemplateEditorPixelStyle(computedStyle.paddingLeft, 0) +
      parseTemplateEditorPixelStyle(computedStyle.paddingRight, 0);
    const verticalPadding =
      parseTemplateEditorPixelStyle(computedStyle.paddingTop, 0) +
      parseTemplateEditorPixelStyle(computedStyle.paddingBottom, 0);

    return {
      height: Math.max(0, Math.floor((element.clientHeight || rect.height || 0) - verticalPadding)),
      width: Math.max(0, Math.floor((element.clientWidth || rect.width || 0) - horizontalPadding)),
    };
  }

  function shouldDistributeTemplateEditorTableSizeEvenly(currentSizes) {
    return (
      currentSizes.length > 0 &&
      Math.max(...currentSizes) - Math.min(...currentSizes) <= 1
    );
  }

  function distributeTemplateEditorEvenTableSizes(targetSize, itemCount, minimumSize = 1) {
    const safeItemCount = Math.max(1, Math.round(Number(itemCount) || 0));
    const safeTargetSize = Math.max(safeItemCount, Math.round(Number(targetSize) || 0));
    const safeMinimumSize = Math.max(
      1,
      Math.min(Math.round(minimumSize) || 1, Math.floor(safeTargetSize / safeItemCount) || 1),
    );
    const baseSize = Math.max(safeMinimumSize, Math.floor(safeTargetSize / safeItemCount));
    let remainder = safeTargetSize - baseSize * safeItemCount;

    return Array.from({ length: safeItemCount }, () => {
      const nextSize = baseSize + (remainder > 0 ? 1 : 0);

      remainder -= 1;
      return Math.max(safeMinimumSize, nextSize);
    });
  }

  function scaleTemplateEditorTableColumns(table, columns, targetWidth, minimumColumnWidth = 1) {
    if (!columns.length || !(targetWidth > 0)) {
      return;
    }

    const cellMap = buildTemplateTableCellMap(table);
    const safeMinimumColumnWidth = Math.max(1, Math.round(minimumColumnWidth) || 1);
    const currentWidths = columns.map((columnElement, columnIndex) =>
      Math.max(
        safeMinimumColumnWidth,
        parseTemplateEditorPixelStyle(
          columnElement.style.width,
          getTemplateEditorMeasuredColumnWidth(cellMap, columnIndex),
        ),
      ),
    );
    const currentTotalWidth = currentWidths.reduce((widthSum, width) => widthSum + width, 0);

    if (!(currentTotalWidth > 0)) {
      return;
    }

    let usedWidth = 0;
    const nextWidths = shouldDistributeTemplateEditorTableSizeEvenly(currentWidths)
      ? distributeTemplateEditorEvenTableSizes(targetWidth, columns.length, safeMinimumColumnWidth)
      : [];

    columns.forEach((columnElement, columnIndex) => {
      const scale = targetWidth / currentTotalWidth;
      const nextWidth = nextWidths[columnIndex] ||
        (columnIndex === columns.length - 1
          ? Math.max(safeMinimumColumnWidth, Math.round(targetWidth - usedWidth))
          : Math.max(safeMinimumColumnWidth, Math.round(currentWidths[columnIndex] * scale)));

      usedWidth += nextWidth;
      nextWidths[columnIndex] = nextWidth;
      columnElement.style.width = `${nextWidth}px`;
    });

    cellMap.entries.forEach((entry, cellElement) => {
      const cellWidth = nextWidths
        .slice(entry.colIndex, entry.colIndex + entry.colSpan)
        .reduce((widthSum, width) => widthSum + Math.max(0, width || 0), 0);

      if (cellWidth > 0) {
        cellElement.style.width = `${cellWidth}px`;
      }
    });
  }

  const candidateBlockTableHostSelector = "[data-candidate-block-instance], [data-candidate-block-column-name]";

  function getCandidateBlockTableHost(table) {
    const blockElement = table?.closest?.(candidateBlockTableHostSelector) || null;

    return blockElement instanceof HTMLElement ? blockElement : null;
  }

  function getCandidateBlockTableHostSize(blockElement) {
    return getTemplateEditorElementContentSize(blockElement);
  }

  function isTemplateEditorPixelLength(value = "") {
    return /^-?\d+(?:\.\d+)?px$/i.test(String(value || "").trim());
  }

  function getTemplateEditorTableRenderedSize(table) {
    const rect = table?.getBoundingClientRect?.();

    return {
      height: Math.max(0, Math.round(rect?.height || 0)),
      width: Math.max(0, Math.round(rect?.width || 0)),
    };
  }

  function getTemplateEditorTableColumnTotalWidth(columns = []) {
    return columns.reduce(
      (widthSum, columnElement) =>
        widthSum + Math.max(1, parseTemplateEditorPixelStyle(columnElement?.style?.width, TEMPLATE_EDITOR_TABLE_MIN_SIZE)),
      0,
    );
  }

  function getTemplateEditorTableRowHeights(table) {
    return Array.from(table?.rows || []).map((rowElement) =>
      Math.max(1, parseTemplateEditorPixelStyle(rowElement.style.height, Math.round(rowElement.getBoundingClientRect?.().height || 0))),
    );
  }

  function getTemplateEditorCandidateBlockTableMaxSize(table, blockElement) {
    const { height, width } = getCandidateBlockTableHostSize(blockElement);
    const columnBorderInset = getCandidateBlockCollapsedBorderAdjustment(table, "column");
    const rowBorderInset = getCandidateBlockCollapsedBorderAdjustment(table, "row");
    const safeColumnInset = columnBorderInset > 0 ? Math.ceil(columnBorderInset) : 0;
    const safeRowInset = rowBorderInset > 0 ? Math.ceil(rowBorderInset) : 0;

    return {
      height: Math.max(1, height - safeRowInset),
      width: Math.max(1, width - safeColumnInset),
    };
  }

  function getCandidateBlockCollapsedBorderAdjustment(table, axis) {
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

  function clampTemplateEditorTableToDocumentWidth(table, columns) {
    const documentElement = table?.closest?.(".template-doc") || null;

    if (
      !(table instanceof HTMLTableElement) ||
      !(documentElement instanceof HTMLElement) ||
      getCandidateBlockTableHost(table) ||
      String(table.style.position || "").trim().toLowerCase() === "absolute"
    ) {
      return false;
    }

    const { width: rawDocumentWidth } = getTemplateEditorElementContentSize(documentElement);
    const borderInset = Math.ceil(getCandidateBlockCollapsedBorderAdjustment(table, "column"));
    const documentWidth = Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, rawDocumentWidth - Math.max(0, borderInset));

    if (!(rawDocumentWidth > 0)) {
      return false;
    }

    const tableRect = table.getBoundingClientRect();
    const configuredWidth = parseTemplateEditorPixelStyle(table.style.width, 0);
    const renderedWidth = Math.ceil(tableRect.width || 0);
    const effectiveWidth = configuredWidth > 0 ? configuredWidth : renderedWidth;

    if (Math.max(effectiveWidth, renderedWidth) <= documentWidth) {
      return false;
    }

    scaleTemplateEditorTableColumns(table, columns, documentWidth);
    table.style.width = `${documentWidth}px`;
    table.style.maxWidth = "100%";
    return true;
  }

  function scaleCandidateBlockTableRows(table, targetHeight) {
    const rows = Array.from(table.rows || []);

    if (!rows.length || !(targetHeight > 0)) {
      return;
    }

    const currentHeights = rows.map((rowElement) =>
      Math.max(1, parseTemplateEditorPixelStyle(rowElement.style.height, rowElement.getBoundingClientRect?.().height || 0)),
    );
    const currentTotalHeight = currentHeights.reduce((heightSum, height) => heightSum + height, 0);

    if (!(currentTotalHeight > 0)) {
      return;
    }

    let usedHeight = 0;
    const nextHeights = shouldDistributeTemplateEditorTableSizeEvenly(currentHeights)
      ? distributeTemplateEditorEvenTableSizes(targetHeight, rows.length, 1)
      : [];

    rows.forEach((rowElement, rowIndex) => {
      const scale = targetHeight / currentTotalHeight;
      const nextHeight = nextHeights[rowIndex] ||
        (rowIndex === rows.length - 1
          ? Math.max(1, Math.round(targetHeight - usedHeight))
          : Math.max(1, Math.round(currentHeights[rowIndex] * scale)));

      usedHeight += nextHeight;
      nextHeights[rowIndex] = nextHeight;
      rowElement.style.height = `${nextHeight}px`;
    });

    buildTemplateTableCellMap(table).entries.forEach((entry, cellElement) => {
      const cellHeight = nextHeights
        .slice(entry.rowIndex, entry.rowIndex + entry.rowSpan)
        .reduce((heightSum, height) => heightSum + Math.max(0, height || 0), 0);

      if (cellHeight > 0) {
        cellElement.style.height = `${cellHeight}px`;
        cellElement.style.minHeight = `${cellHeight}px`;
      }
    });
  }

  function normalizeCandidateBlockTableAppearance(table, columns) {
    const blockElement = getCandidateBlockTableHost(table);

    if (!blockElement) {
      return false;
    }

    blockElement.classList.add("has-candidate-block-table");
    table.dataset.candidateBlockTable = "true";
    table.style.maxWidth = "100%";
    table.style.maxHeight = "100%";
    table.style.minWidth = "0";
    table.style.minHeight = "0";
    table.style.margin = "0";
    table.style.tableLayout = "fixed";
    table.style.borderCollapse = "collapse";
    table.style.boxSizing = "border-box";

    // HTML preparation also runs on detached clones, which have no layout.
    // Preserve authored dimensions until the host can be measured on the canvas.
    const hostSize = getCandidateBlockTableHostSize(blockElement);
    if (!(hostSize.width > 0) || !(hostSize.height > 0)) {
      return true;
    }

    const maxSize = getTemplateEditorCandidateBlockTableMaxSize(table, blockElement);
    const renderedSize = getTemplateEditorTableRenderedSize(table);
    const configuredWidth = parseTemplateEditorPixelStyle(table.style.width, 0);
    const currentColumnTotalWidth = getTemplateEditorTableColumnTotalWidth(columns);
    const requestedWidth = isTemplateEditorPixelLength(table.style.width)
      ? configuredWidth
      : Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, renderedSize.width || currentColumnTotalWidth || maxSize.width);
    const tableTargetWidth = Math.min(maxSize.width, Math.max(1, requestedWidth));

    if (columns.length && Math.round(currentColumnTotalWidth) !== Math.round(tableTargetWidth)) {
      scaleTemplateEditorTableColumns(table, columns, tableTargetWidth);
    }
    table.style.width = `${Math.round(tableTargetWidth)}px`;

    const rowHeights = getTemplateEditorTableRowHeights(table);
    const currentRowTotalHeight = rowHeights.reduce((heightSum, height) => heightSum + Math.max(0, height || 0), 0);
    const configuredHeight = parseTemplateEditorPixelStyle(table.style.height, 0);
    const hasUsableConfiguredHeight =
      isTemplateEditorPixelLength(table.style.height) &&
      configuredHeight > Math.max(1, rowHeights.length) * 4;
    const requestedHeight = hasUsableConfiguredHeight
      ? configuredHeight
      : Math.max(1, currentRowTotalHeight || renderedSize.height || maxSize.height);
    const tableTargetHeight = Math.min(maxSize.height, Math.max(1, requestedHeight));

    if (rowHeights.length && Math.round(currentRowTotalHeight) !== Math.round(tableTargetHeight)) {
      scaleCandidateBlockTableRows(table, tableTargetHeight);
    }
    table.style.height = `${Math.round(tableTargetHeight)}px`;
    return true;
  }

  return Object.freeze({
    clampTemplateEditorTableToDocumentWidth,
    ensureTemplateEditorTableColGroup,
    normalizeCandidateBlockTableAppearance,
    syncTemplateEditorTableWidth,
  });
});

})();
