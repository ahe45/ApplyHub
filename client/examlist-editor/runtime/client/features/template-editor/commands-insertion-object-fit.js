(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorCommandInsertionObjectFit = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const CSS_PIXELS_PER_POINT = 96 / 72;
  const CANDIDATE_BLOCK_TABLE_FIT_TOLERANCE = 1;
  const CANDIDATE_BLOCK_TABLE_MIN_FONT_SIZE_PT = 5;
  const CANDIDATE_BLOCK_TABLE_MIN_PADDING_PT = 0;
  const CANDIDATE_BLOCK_TABLE_DEFAULT_FONT_SIZE_PT = 11;
  const CANDIDATE_BLOCK_TABLE_DEFAULT_LINE_SPACING_PT = 1;
  const CANDIDATE_BLOCK_TABLE_DEFAULT_LINE_HEIGHT = `calc(1em + ${CANDIDATE_BLOCK_TABLE_DEFAULT_LINE_SPACING_PT}pt)`;
  const CANDIDATE_BLOCK_TABLE_MIN_AVAILABLE_SIZE = 1;
  const CANDIDATE_BLOCK_TABLE_DEFAULT_PADDING_PT = Object.freeze({
    bottom: 8,
    left: 10,
    right: 10,
    top: 8,
  });
  const CANDIDATE_BLOCK_TABLE_INSERTION_IGNORED_CONTENT_SELECTOR = [
    ".template-editor-image-selection",
    ".template-editor-image-resize-handle",
    ".examlist-object-selection",
    ".examlist-object-resize-handle",
    ".template-editor-table-selection",
    ".template-editor-table-handle",
    ".template-editor-table-move-handle",
    ".template-editor-table-select-handle",
    "[data-candidate-block-grid-resize-handle]",
    "[data-candidate-block-grid-move-handle]",
  ].join(",");
  const objectMinimumSize = 5;

  function formatTemplateEditorPointValue(value) {
    const roundedValue = Math.round(value * 10) / 10;
    return Number.isInteger(roundedValue) ? String(roundedValue) : roundedValue.toFixed(1).replace(/\.0$/, "");
  }

  function parseTemplateEditorCssLengthToPoints(value, fallbackValue = 0) {
    const normalizedValue = String(value || "").trim();

    if (!normalizedValue) {
      return fallbackValue;
    }

    const [, numericPart = "", unit = ""] = normalizedValue.match(/(-?\d+(?:\.\d+)?)(pt|px)?/i) || [];
    const numericValue = Number(numericPart);

    if (!Number.isFinite(numericValue)) {
      return fallbackValue;
    }

    return unit.toLowerCase() === "px" ? numericValue / CSS_PIXELS_PER_POINT : numericValue;
  }

  function parseTemplateEditorPixelValue(value, fallbackValue = 0) {
    const numericValue = Number.parseFloat(String(value || ""));

    return Number.isFinite(numericValue) ? numericValue : fallbackValue;
  }

  function parseTemplateEditorCssPaddingToPoints(value, fallbackPadding = CANDIDATE_BLOCK_TABLE_DEFAULT_PADDING_PT) {
    const normalizedValue = String(value || "").trim();
    const lengthValues = normalizedValue
      .split(/\s+/)
      .map((part) => parseTemplateEditorCssLengthToPoints(part, Number.NaN))
      .filter((partValue) => Number.isFinite(partValue));

    if (lengthValues.length === 0) {
      return { ...fallbackPadding };
    }

    if (lengthValues.length === 1) {
      return {
        bottom: lengthValues[0],
        left: lengthValues[0],
        right: lengthValues[0],
        top: lengthValues[0],
      };
    }

    if (lengthValues.length === 2) {
      return {
        bottom: lengthValues[0],
        left: lengthValues[1],
        right: lengthValues[1],
        top: lengthValues[0],
      };
    }

    if (lengthValues.length === 3) {
      return {
        bottom: lengthValues[2],
        left: lengthValues[1],
        right: lengthValues[1],
        top: lengthValues[0],
      };
    }

    return {
      bottom: lengthValues[2],
      left: lengthValues[3],
      right: lengthValues[1],
      top: lengthValues[0],
    };
  }

  function parseTemplateEditorLineHeightToPoints(value, fontSizePt = CANDIDATE_BLOCK_TABLE_DEFAULT_FONT_SIZE_PT) {
    const normalizedValue = String(value || "").trim();
    const safeFontSizePt = Number.isFinite(Number(fontSizePt)) && Number(fontSizePt) > 0
      ? Number(fontSizePt)
      : CANDIDATE_BLOCK_TABLE_DEFAULT_FONT_SIZE_PT;

    if (!normalizedValue || normalizedValue.toLowerCase() === "normal") {
      return safeFontSizePt + CANDIDATE_BLOCK_TABLE_DEFAULT_LINE_SPACING_PT;
    }

    const calcMatch = normalizedValue.match(/^calc\(\s*1em\s*\+\s*(-?\d+(?:\.\d+)?)pt\s*\)$/i);

    if (calcMatch) {
      return safeFontSizePt + Math.max(0, Number(calcMatch[1]) || 0);
    }

    if (/^-?\d+(?:\.\d+)?$/.test(normalizedValue)) {
      return Math.max(0, safeFontSizePt * (Number(normalizedValue) || 1));
    }

    const lengthValue = parseTemplateEditorCssLengthToPoints(normalizedValue, Number.NaN);

    return Number.isFinite(lengthValue) && lengthValue > 0
      ? lengthValue
      : safeFontSizePt + CANDIDATE_BLOCK_TABLE_DEFAULT_LINE_SPACING_PT;
  }

  function getTemplateEditorCandidateBlockContentSize(blockElement) {
    if (!(blockElement instanceof HTMLElement)) {
      return {
        height: 0,
        width: 0,
      };
    }

    const computedStyle = window.getComputedStyle(blockElement);
    const rect = blockElement.getBoundingClientRect();
    const logicalContentWidth = parseTemplateEditorPixelValue(blockElement.dataset?.candidateBlockLogicalContentWidth || "", 0);
    const logicalContentHeight = parseTemplateEditorPixelValue(blockElement.dataset?.candidateBlockLogicalContentHeight || "", 0);

    if (logicalContentWidth > 0 || logicalContentHeight > 0) {
      return {
        height: Math.max(0, Math.floor(logicalContentHeight || blockElement.clientHeight || rect.height || 0)),
        width: Math.max(0, Math.floor(logicalContentWidth || blockElement.clientWidth || rect.width || 0)),
      };
    }

    const horizontalPadding =
      Number.parseFloat(computedStyle.paddingLeft) +
      Number.parseFloat(computedStyle.paddingRight);
    const verticalPadding =
      Number.parseFloat(computedStyle.paddingTop) +
      Number.parseFloat(computedStyle.paddingBottom);
    const rawWidth = blockElement.clientWidth || rect.width || 0;
    const rawHeight = blockElement.clientHeight || rect.height || 0;

    return {
      height: Math.max(0, Math.floor(rawHeight - (Number.isFinite(verticalPadding) ? verticalPadding : 0))),
      width: Math.max(0, Math.floor(rawWidth - (Number.isFinite(horizontalPadding) ? horizontalPadding : 0))),
    };
  }

  function getTemplateEditorCandidateBlockVisualScale(blockElement) {
    if (!(blockElement instanceof HTMLElement)) {
      return { x: 1, y: 1 };
    }

    const blockRect = blockElement.getBoundingClientRect();
    const logicalWidth =
      parseTemplateEditorPixelValue(blockElement.dataset?.candidateBlockLogicalWidth || "", 0) ||
      blockElement.offsetWidth ||
      blockElement.clientWidth ||
      blockRect.width ||
      0;
    const logicalHeight =
      parseTemplateEditorPixelValue(blockElement.dataset?.candidateBlockLogicalHeight || "", 0) ||
      blockElement.offsetHeight ||
      blockElement.clientHeight ||
      blockRect.height ||
      0;

    return {
      x: logicalWidth > 0 && blockRect.width > 0 ? blockRect.width / logicalWidth : 1,
      y: logicalHeight > 0 && blockRect.height > 0 ? blockRect.height / logicalHeight : 1,
    };
  }

  function getTemplateEditorCandidateBlockContentVisualRect(blockElement) {
    const blockRect = blockElement.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(blockElement);
    const visualScale = getTemplateEditorCandidateBlockVisualScale(blockElement);
    const scaleX = Math.max(visualScale.x || 1, 0.01);
    const scaleY = Math.max(visualScale.y || 1, 0.01);
    const paddingLeft = parseTemplateEditorPixelValue(computedStyle.paddingLeft, 0) * scaleX;
    const paddingRight = parseTemplateEditorPixelValue(computedStyle.paddingRight, 0) * scaleX;
    const paddingTop = parseTemplateEditorPixelValue(computedStyle.paddingTop, 0) * scaleY;
    const paddingBottom = parseTemplateEditorPixelValue(computedStyle.paddingBottom, 0) * scaleY;

    return {
      bottom: blockRect.bottom - paddingBottom,
      left: blockRect.left + paddingLeft,
      right: blockRect.right - paddingRight,
      scaleX,
      scaleY,
      top: blockRect.top + paddingTop,
    };
  }

  function getTemplateEditorTableColumnCount(tableElement) {
    return Array.from(tableElement?.rows || []).reduce((maxColumnCount, rowElement) => {
      const rowColumnCount = Array.from(rowElement.cells || []).reduce(
        (columnCount, cellElement) => columnCount + Math.max(1, Number(cellElement.colSpan) || 1),
        0,
      );

    return Math.max(maxColumnCount, rowColumnCount);
  }, 0);
  }

  function buildTemplateEditorTableCellEntries(tableElement) {
    const entries = new Map();

    Array.from(tableElement?.rows || []).forEach((rowElement, rowIndex) => {
      let columnIndex = 0;

      Array.from(rowElement.cells || []).forEach((cellElement) => {
        while (
          Array.from(entries.values()).some((entry) =>
            rowIndex >= entry.rowIndex &&
              rowIndex < entry.rowIndex + entry.rowSpan &&
              columnIndex >= entry.colIndex &&
              columnIndex < entry.colIndex + entry.colSpan,
          )
        ) {
          columnIndex += 1;
        }

        const colSpan = Math.max(1, Number(cellElement.colSpan) || 1);
        const rowSpan = Math.max(1, Number(cellElement.rowSpan) || 1);

        entries.set(cellElement, {
          colIndex: columnIndex,
          colSpan,
          rowIndex,
          rowSpan,
        });
        columnIndex += colSpan;
      });
    });

    return entries;
  }

  function distributeTemplateEditorEvenPixelSizes(targetSize, itemCount) {
    const safeItemCount = Math.max(1, Math.round(Number(itemCount) || 0));
    const safeTargetSize = Math.max(safeItemCount, Math.round(Number(targetSize) || 0));
    const baseSize = Math.floor(safeTargetSize / safeItemCount);
    let remainder = safeTargetSize - baseSize * safeItemCount;

    return Array.from({ length: safeItemCount }, () => {
      const nextSize = baseSize + (remainder > 0 ? 1 : 0);

      remainder -= 1;
      return Math.max(1, nextSize);
    });
  }

  function ensureTemplateEditorCandidateBlockTableColGroup(tableElement, columnCount) {
    let colGroup = Array.from(tableElement.children || []).find((child) => child.tagName === "COLGROUP") || null;

    if (!colGroup) {
      colGroup = document.createElement("colgroup");
      tableElement.insertBefore(colGroup, tableElement.firstElementChild);
    }

    while (colGroup.children.length < columnCount) {
      colGroup.appendChild(document.createElement("col"));
    }

    while (colGroup.children.length > columnCount) {
      colGroup.lastElementChild?.remove();
    }

    return Array.from(colGroup.children || []);
  }

  function getTemplateEditorCandidateBlockTableCellStyle(tableElement) {
    const firstCell = tableElement?.querySelector?.("th, td") || null;
    const fallbackPadding = CANDIDATE_BLOCK_TABLE_DEFAULT_PADDING_PT;

    if (!firstCell) {
      return {
        borderBottom: 1,
        borderLeft: 1,
        borderRight: 1,
        borderTop: 1,
        fontSize: CANDIDATE_BLOCK_TABLE_DEFAULT_FONT_SIZE_PT,
        lineHeight: CANDIDATE_BLOCK_TABLE_DEFAULT_FONT_SIZE_PT + CANDIDATE_BLOCK_TABLE_DEFAULT_LINE_SPACING_PT,
        paddingBottom: fallbackPadding.bottom,
        paddingLeft: fallbackPadding.left,
        paddingRight: fallbackPadding.right,
        paddingTop: fallbackPadding.top,
      };
    }

    const borderValue = firstCell.style.border || "";
    const paddingValue = parseTemplateEditorCssPaddingToPoints(firstCell.style.padding, fallbackPadding);
    const fontSize = parseTemplateEditorCssLengthToPoints(firstCell.style.fontSize, CANDIDATE_BLOCK_TABLE_DEFAULT_FONT_SIZE_PT);

    return {
      borderBottom: parseTemplateEditorCssLengthToPoints(firstCell.style.borderBottomWidth || borderValue, 1),
      borderLeft: parseTemplateEditorCssLengthToPoints(firstCell.style.borderLeftWidth || borderValue, 1),
      borderRight: parseTemplateEditorCssLengthToPoints(firstCell.style.borderRightWidth || borderValue, 1),
      borderTop: parseTemplateEditorCssLengthToPoints(firstCell.style.borderTopWidth || borderValue, 1),
      fontSize,
      lineHeight: parseTemplateEditorLineHeightToPoints(firstCell.style.lineHeight, fontSize),
      paddingBottom: parseTemplateEditorCssLengthToPoints(firstCell.style.paddingBottom, paddingValue.bottom),
      paddingLeft: parseTemplateEditorCssLengthToPoints(firstCell.style.paddingLeft, paddingValue.left),
      paddingRight: parseTemplateEditorCssLengthToPoints(firstCell.style.paddingRight, paddingValue.right),
      paddingTop: parseTemplateEditorCssLengthToPoints(firstCell.style.paddingTop, paddingValue.top),
    };
  }

  function getTemplateEditorCandidateBlockCollapsedBorderAdjustment(tableElement, axis) {
    if (!(tableElement instanceof HTMLTableElement)) {
      return 0;
    }

    const tableStyle = window.getComputedStyle(tableElement);

    if (String(tableStyle.borderCollapse || "").trim().toLowerCase() !== "collapse") {
      return 0;
    }

    if (axis === "column") {
      const rows = Array.from(tableElement.rows || []);
      const leftCell = rows.map((rowElement) => rowElement.cells?.[0]).find(Boolean);
      const rightCell = rows
        .map((rowElement) => rowElement.cells?.[Math.max(0, (rowElement.cells?.length || 1) - 1)])
        .find(Boolean);
      const leftStyle = leftCell ? window.getComputedStyle(leftCell) : null;
      const rightStyle = rightCell ? window.getComputedStyle(rightCell) : null;

      return Math.max(
        parseTemplateEditorCssLengthToPoints(tableStyle.borderLeftWidth, 0),
        parseTemplateEditorCssLengthToPoints(tableStyle.borderRightWidth, 0),
        parseTemplateEditorCssLengthToPoints(leftStyle?.borderLeftWidth, 0),
        parseTemplateEditorCssLengthToPoints(rightStyle?.borderRightWidth, 0),
      );
    }

    const firstRow = tableElement.rows?.[0] || null;
    const lastRow = tableElement.rows?.[Math.max(0, (tableElement.rows?.length || 1) - 1)] || null;
    const firstCellStyle = firstRow?.cells?.[0] ? window.getComputedStyle(firstRow.cells[0]) : null;
    const lastCellStyle = lastRow?.cells?.[0] ? window.getComputedStyle(lastRow.cells[0]) : null;

    return Math.max(
      parseTemplateEditorCssLengthToPoints(tableStyle.borderTopWidth, 0),
      parseTemplateEditorCssLengthToPoints(tableStyle.borderBottomWidth, 0),
      parseTemplateEditorCssLengthToPoints(firstCellStyle?.borderTopWidth, 0),
      parseTemplateEditorCssLengthToPoints(lastCellStyle?.borderBottomWidth, 0),
    );
  }

  function getTemplateEditorCandidateBlockTableFitMetrics(tableElement, blockElement, availableSize = null) {
    const blockSize = availableSize || getTemplateEditorCandidateBlockContentSize(blockElement);
    const rowCount = Math.max(0, Array.from(tableElement?.rows || []).length);
    const columnCount = getTemplateEditorTableColumnCount(tableElement);
    const cellStyle = getTemplateEditorCandidateBlockTableCellStyle(tableElement);
    const collapsedBorderHeight = getTemplateEditorCandidateBlockCollapsedBorderAdjustment(tableElement, "row");
    const collapsedBorderWidth = getTemplateEditorCandidateBlockCollapsedBorderAdjustment(tableElement, "column");
    const safeBorderHeight = collapsedBorderHeight > 0 ? collapsedBorderHeight + 3 / CSS_PIXELS_PER_POINT : 0;
    const safeBorderWidth = collapsedBorderWidth > 0 ? collapsedBorderWidth + 1 / CSS_PIXELS_PER_POINT : 0;

    return {
      ...cellStyle,
      blockHeightPt: Math.max(0, blockSize.height / CSS_PIXELS_PER_POINT - safeBorderHeight),
      blockWidthPt: Math.max(0, blockSize.width / CSS_PIXELS_PER_POINT - safeBorderWidth),
      columnCount,
      rowCount,
    };
  }

  function getTemplateEditorCandidateBlockTableRequiredSize(metrics) {
    const columnCount = Math.max(1, metrics.columnCount || 0);
    const rowCount = Math.max(1, metrics.rowCount || 0);
    const columnRequiredWidth =
      metrics.paddingLeft +
      metrics.paddingRight +
      Math.max(0, (metrics.borderLeft + metrics.borderRight) / 2);
    const rowRequiredHeight =
      metrics.paddingTop +
      metrics.paddingBottom +
      metrics.lineHeight +
      Math.max(0, (metrics.borderTop + metrics.borderBottom) / 2);

    return {
      height: rowRequiredHeight * rowCount,
      width: columnRequiredWidth * columnCount,
    };
  }

  function canTemplateEditorCandidateBlockTableFit(metrics) {
    if (!(metrics.blockWidthPt > 0) || !(metrics.blockHeightPt > 0) || metrics.rowCount <= 0 || metrics.columnCount <= 0) {
      return false;
    }

    const requiredSize = getTemplateEditorCandidateBlockTableRequiredSize(metrics);

    return (
      requiredSize.width <= metrics.blockWidthPt + CANDIDATE_BLOCK_TABLE_FIT_TOLERANCE &&
      requiredSize.height <= metrics.blockHeightPt + CANDIDATE_BLOCK_TABLE_FIT_TOLERANCE
    );
  }

  function applyTemplateEditorCandidateBlockTableStyle(tableElement, { fontSize, paddingBottom, paddingLeft, paddingRight, paddingTop }) {
    const formattedFontSize = formatTemplateEditorPointValue(fontSize);
    const formattedPaddingBottom = formatTemplateEditorPointValue(paddingBottom);
    const formattedPaddingLeft = formatTemplateEditorPointValue(paddingLeft);
    const formattedPaddingRight = formatTemplateEditorPointValue(paddingRight);
    const formattedPaddingTop = formatTemplateEditorPointValue(paddingTop);

    tableElement.querySelectorAll("th, td").forEach((cellElement) => {
      cellElement.style.boxSizing = "border-box";
      cellElement.style.fontSize = `${formattedFontSize}pt`;
      if (!String(cellElement.style.lineHeight || "").trim()) {
        cellElement.style.lineHeight = CANDIDATE_BLOCK_TABLE_DEFAULT_LINE_HEIGHT;
      }
      cellElement.style.paddingBottom = `${formattedPaddingBottom}pt`;
      cellElement.style.paddingLeft = `${formattedPaddingLeft}pt`;
      cellElement.style.paddingRight = `${formattedPaddingRight}pt`;
      cellElement.style.paddingTop = `${formattedPaddingTop}pt`;
    });
  }

  function getTemplateEditorCandidateBlockAdjustedTableStyle(metrics, { useMinimums = false } = {}) {
    if (useMinimums) {
      return {
        fontSize: CANDIDATE_BLOCK_TABLE_MIN_FONT_SIZE_PT,
        paddingBottom: CANDIDATE_BLOCK_TABLE_MIN_PADDING_PT,
        paddingLeft: CANDIDATE_BLOCK_TABLE_MIN_PADDING_PT,
        paddingRight: CANDIDATE_BLOCK_TABLE_MIN_PADDING_PT,
        paddingTop: CANDIDATE_BLOCK_TABLE_MIN_PADDING_PT,
      };
    }

    const columnCount = Math.max(1, metrics.columnCount || 0);
    const rowCount = Math.max(1, metrics.rowCount || 0);
    const availableColumnWidth = Math.max(
      0,
      metrics.blockWidthPt / columnCount - Math.max(0, (metrics.borderLeft + metrics.borderRight) / 2),
    );
    const availableRowHeight = Math.max(
      0,
      metrics.blockHeightPt / rowCount - Math.max(0, (metrics.borderTop + metrics.borderBottom) / 2),
    );
    const horizontalPaddingTotal = Math.max(0.01, metrics.paddingLeft + metrics.paddingRight);
    const verticalTotal = Math.max(
      0.01,
      metrics.paddingTop +
        metrics.paddingBottom +
        metrics.lineHeight,
    );
    const horizontalScale = Math.min(1, availableColumnWidth / horizontalPaddingTotal);
    const verticalScale = Math.min(1, availableRowHeight / verticalTotal);

    return {
      fontSize: Math.max(CANDIDATE_BLOCK_TABLE_MIN_FONT_SIZE_PT, metrics.fontSize * verticalScale),
      paddingBottom: Math.max(CANDIDATE_BLOCK_TABLE_MIN_PADDING_PT, metrics.paddingBottom * verticalScale),
      paddingLeft: Math.max(CANDIDATE_BLOCK_TABLE_MIN_PADDING_PT, metrics.paddingLeft * horizontalScale),
      paddingRight: Math.max(CANDIDATE_BLOCK_TABLE_MIN_PADDING_PT, metrics.paddingRight * horizontalScale),
      paddingTop: Math.max(CANDIDATE_BLOCK_TABLE_MIN_PADDING_PT, metrics.paddingTop * verticalScale),
    };
  }

  function getTemplateEditorInsertionCell(range, templateEditorSurface) {
    const startElement =
      range?.startContainer?.nodeType === Node.ELEMENT_NODE
        ? range.startContainer
        : range?.startContainer?.parentElement || null;
    const cellElement = startElement?.closest?.("td, th") || null;

    return cellElement && templateEditorSurface?.contains(cellElement) ? cellElement : null;
  }

  function getTemplateEditorInsertionCandidateBlock(range, templateEditorSurface) {
    const startElement =
      range?.startContainer?.nodeType === Node.ELEMENT_NODE
        ? range.startContainer
        : range?.startContainer?.parentElement || null;
    const blockElement = startElement?.closest?.("[data-candidate-block-instance]") || null;

    return blockElement && templateEditorSurface?.contains(blockElement) ? blockElement : null;
  }

  function isBlankTemplateEditorBlockElement(element) {
    if (!(element instanceof HTMLElement) || !/^(P|DIV)$/i.test(String(element.tagName || ""))) {
      return false;
    }

    const text = String(element.textContent || "").replace(/\u00a0/g, " ").trim();
    const hasOnlyLineBreaks = Array.from(element.childNodes).every((node) =>
      node.nodeType === Node.TEXT_NODE
        ? !String(node.textContent || "").replace(/\u00a0/g, " ").trim()
        : node.nodeType === Node.ELEMENT_NODE && String(node.tagName || "").toLowerCase() === "br",
    );

    return !text && hasOnlyLineBreaks;
  }

  function getTemplateEditorBlankInsertionBlock(range, blockElement) {
    const startElement =
      range?.startContainer?.nodeType === Node.ELEMENT_NODE
        ? range.startContainer
        : range?.startContainer?.parentElement || null;
    const hostElement = startElement?.closest?.("p, div") || null;

    if (!(hostElement instanceof HTMLElement) || !blockElement?.contains?.(hostElement)) {
      return null;
    }

    if (isBlankTemplateEditorBlockElement(hostElement)) {
      return hostElement;
    }

    const onlyChild = blockElement.children?.length === 1 ? blockElement.firstElementChild : null;

    if (hostElement === blockElement && isBlankTemplateEditorBlockElement(onlyChild)) {
      return onlyChild;
    }

    return null;
  }

  function getTemplateEditorMeaningfulContentRects(node, ignoredElement = null) {
    if (!node || node === ignoredElement) {
      return [];
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = String(node.textContent || "").replace(/\u00a0/g, " ").trim();

      if (!text) {
        return [];
      }

      const range = document.createRange();

      try {
        range.selectNodeContents(node);
        return Array.from(range.getClientRects?.() || []).filter((rect) => rect.width > 0 || rect.height > 0);
      } finally {
        range.detach?.();
      }
    }

    if (!(node instanceof HTMLElement)) {
      return [];
    }

    if (
      node.matches(CANDIDATE_BLOCK_TABLE_INSERTION_IGNORED_CONTENT_SELECTOR) ||
      node.closest(CANDIDATE_BLOCK_TABLE_INSERTION_IGNORED_CONTENT_SELECTOR) ||
      isBlankTemplateEditorBlockElement(node)
    ) {
      return [];
    }

    const rect = node.getBoundingClientRect();

    if (rect.width > 0 || rect.height > 0) {
      return [rect];
    }

    return Array.from(node.childNodes || []).flatMap((childNode) =>
      getTemplateEditorMeaningfulContentRects(childNode, ignoredElement),
    );
  }

  function getTemplateEditorCandidateBlockOccupiedContentHeight(blockElement, { ignoredElement = null } = {}) {
    if (!(blockElement instanceof HTMLElement) || !blockElement.isConnected) {
      return 0;
    }

    const contentRect = getTemplateEditorCandidateBlockContentVisualRect(blockElement);
    const visualBottoms = Array.from(blockElement.childNodes || [])
      .flatMap((node) => getTemplateEditorMeaningfulContentRects(node, ignoredElement))
      .map((rect) => Math.min(contentRect.bottom, Math.max(contentRect.top, rect.bottom)))
      .filter((bottom) => Number.isFinite(bottom) && bottom > contentRect.top);

    if (!visualBottoms.length) {
      return 0;
    }

    return Math.max(0, Math.ceil((Math.max(...visualBottoms) - contentRect.top) / contentRect.scaleY));
  }

  function getTemplateEditorCandidateBlockTableAvailableSize(blockElement, { insertionRange = null } = {}) {
    const blockSize = getTemplateEditorCandidateBlockContentSize(blockElement);

    if (!(blockSize.width > 0) || !(blockSize.height > 0)) {
      return blockSize;
    }

    const blankInsertionBlock = getTemplateEditorBlankInsertionBlock(insertionRange, blockElement);
    const occupiedHeight = getTemplateEditorCandidateBlockOccupiedContentHeight(
      blockElement,
      { ignoredElement: blankInsertionBlock },
    );

    return {
      height: Math.max(CANDIDATE_BLOCK_TABLE_MIN_AVAILABLE_SIZE, Math.floor(blockSize.height - occupiedHeight)),
      width: Math.max(CANDIDATE_BLOCK_TABLE_MIN_AVAILABLE_SIZE, Math.floor(blockSize.width)),
    };
  }

  function applyTemplateEditorCandidateBlockTableBaseStyles(tableElement, blockElement = null, availableSize = null) {
    tableElement.dataset.candidateBlockTable = "true";
    tableElement.style.maxWidth = "100%";
    tableElement.style.maxHeight = "100%";
    tableElement.style.minWidth = "0";
    tableElement.style.minHeight = "0";
    tableElement.style.margin = "0";
    tableElement.style.tableLayout = "fixed";
    tableElement.style.borderCollapse = "collapse";
    tableElement.style.boxSizing = "border-box";
    tableElement.querySelectorAll("th, td").forEach((cellElement) => {
      cellElement.style.padding = "0px";
      if (!String(cellElement.style.lineHeight || "").trim()) {
        cellElement.style.lineHeight = CANDIDATE_BLOCK_TABLE_DEFAULT_LINE_HEIGHT;
      }
    });

    const blockSize = availableSize || getTemplateEditorCandidateBlockContentSize(blockElement);
    const rawWidth = String(tableElement.style.width || "").trim();
    const rawHeight = String(tableElement.style.height || "").trim();

    if (blockSize.width > 0 && (!rawWidth || rawWidth.endsWith("%"))) {
      tableElement.style.width = `${Math.max(1, Math.round(blockSize.width))}px`;
    }

    if (rawHeight.endsWith("%")) {
      tableElement.style.removeProperty("height");
    }
  }

  function applyTemplateEditorCandidateBlockEvenTableGrid(tableElement, blockElement, { availableSize = null } = {}) {
    const rowElements = Array.from(tableElement?.rows || []);
    const columnCount = getTemplateEditorTableColumnCount(tableElement);

    if (!(tableElement instanceof HTMLTableElement) || rowElements.length <= 0 || columnCount <= 0) {
      return;
    }

    const metrics = getTemplateEditorCandidateBlockTableFitMetrics(tableElement, blockElement);
    const requiredSize = getTemplateEditorCandidateBlockTableRequiredSize(metrics);
    const blockSize = availableSize || getTemplateEditorCandidateBlockContentSize(blockElement);
    const configuredWidth = parseTemplateEditorCssLengthToPoints(tableElement.style.width, 0) * CSS_PIXELS_PER_POINT;
    const configuredHeight = parseTemplateEditorCssLengthToPoints(tableElement.style.height, 0) * CSS_PIXELS_PER_POINT;
    const collapsedBorderWidth =
      getTemplateEditorCandidateBlockCollapsedBorderAdjustment(tableElement, "column") * CSS_PIXELS_PER_POINT;
    const collapsedBorderHeight =
      getTemplateEditorCandidateBlockCollapsedBorderAdjustment(tableElement, "row") * CSS_PIXELS_PER_POINT;
    const safeCollapsedBorderWidth = collapsedBorderWidth > 0 ? Math.ceil(collapsedBorderWidth) : 0;
    const safeCollapsedBorderHeight = 0;
    const maxTableWidth = Math.max(
      columnCount,
      Math.round((blockSize.width || requiredSize.width * CSS_PIXELS_PER_POINT) - safeCollapsedBorderWidth),
    );
    const maxTableHeight = Math.max(
      rowElements.length,
      Math.round((blockSize.height || requiredSize.height * CSS_PIXELS_PER_POINT) - safeCollapsedBorderHeight),
    );
    const targetWidth = Math.min(maxTableWidth, Math.max(columnCount, Math.round(configuredWidth || maxTableWidth)));
    const targetHeight = Math.min(maxTableHeight, Math.max(rowElements.length, Math.round(configuredHeight || maxTableHeight)));
    const columnWidths = distributeTemplateEditorEvenPixelSizes(targetWidth, columnCount);
    const rowHeights = distributeTemplateEditorEvenPixelSizes(targetHeight, rowElements.length);
    const columnElements = ensureTemplateEditorCandidateBlockTableColGroup(tableElement, columnCount);
    const totalColumnWidth = columnWidths.reduce((sum, width) => sum + Math.max(0, width || 0), 0);
    const totalRowHeight = rowHeights.reduce((sum, height) => sum + Math.max(0, height || 0), 0);

    columnElements.forEach((columnElement, index) => {
      columnElement.style.width = `${columnWidths[index] || 1}px`;
    });

    rowElements.forEach((rowElement, index) => {
      rowElement.style.height = `${rowHeights[index] || 1}px`;
    });

    buildTemplateEditorTableCellEntries(tableElement).forEach((entry, cellElement) => {
      const cellWidth = columnWidths
        .slice(entry.colIndex, entry.colIndex + entry.colSpan)
        .reduce((sum, width) => sum + Math.max(0, width || 0), 0);
      const cellHeight = rowHeights
        .slice(entry.rowIndex, entry.rowIndex + entry.rowSpan)
        .reduce((sum, height) => sum + Math.max(0, height || 0), 0);

      cellElement.style.boxSizing = "border-box";

      if (cellWidth > 0) {
        cellElement.style.width = `${cellWidth}px`;
      }

      if (cellHeight > 0) {
        cellElement.style.height = `${cellHeight}px`;
        cellElement.style.minHeight = "0";
      }
    });

    if (totalColumnWidth > 0) {
      tableElement.style.width = `${totalColumnWidth}px`;
    }

    if (totalRowHeight > 0) {
      tableElement.style.height = `${totalRowHeight}px`;
    }
  }

  function finishTemplateEditorCandidateBlockTableFit(tableElement, blockElement, { availableSize = null } = {}) {
    applyTemplateEditorCandidateBlockEvenTableGrid(tableElement, blockElement, { availableSize });
    return true;
  }

  function fitTemplateEditorTableToCandidateBlock(tableElement, blockElement, { availableSize = null, setStatus } = {}) {
    applyTemplateEditorCandidateBlockTableBaseStyles(tableElement, blockElement, availableSize);

    let metrics = getTemplateEditorCandidateBlockTableFitMetrics(tableElement, blockElement, availableSize);

    if (canTemplateEditorCandidateBlockTableFit(metrics)) {
      return finishTemplateEditorCandidateBlockTableFit(tableElement, blockElement, { availableSize });
    }

    applyTemplateEditorCandidateBlockTableStyle(
      tableElement,
      getTemplateEditorCandidateBlockAdjustedTableStyle(metrics),
    );
    metrics = getTemplateEditorCandidateBlockTableFitMetrics(tableElement, blockElement, availableSize);

    if (canTemplateEditorCandidateBlockTableFit(metrics)) {
      return finishTemplateEditorCandidateBlockTableFit(tableElement, blockElement, { availableSize });
    }

    applyTemplateEditorCandidateBlockTableStyle(
      tableElement,
      getTemplateEditorCandidateBlockAdjustedTableStyle(metrics, { useMinimums: true }),
    );
    metrics = getTemplateEditorCandidateBlockTableFitMetrics(tableElement, blockElement, availableSize);

    if (canTemplateEditorCandidateBlockTableFit(metrics)) {
      return finishTemplateEditorCandidateBlockTableFit(tableElement, blockElement, { availableSize });
    }

    setStatus?.(
      "데이터 블록 크기 안에 들어가도록 표를 생성할 수 없습니다. 행/열 수를 줄이거나 데이터 블록 크기를 키워주세요.",
      "warning",
    );
    return false;
  }

  function fitTemplateEditorTablesToCandidateBlock(fragment, blockElement, { insertionRange = null, preservePresentation = false, setStatus } = {}) {
    if (!blockElement || !fragment?.querySelectorAll) {
      return true;
    }

    const tableElements = Array.from(fragment.querySelectorAll("table"));

    if (!tableElements.length) {
      return true;
    }

    const availableSize = getTemplateEditorCandidateBlockTableAvailableSize(blockElement, { insertionRange });
    if (preservePresentation) {
      // Pasting preserves authored proportions, padding and text styles. Do not
      // silently turn a copied table into an evenly distributed/minimum-size grid.
      const fits = tableElements.filter(table => !table.parentElement?.closest("table")).every(table => {
        const width = parseTemplateEditorCssLengthToPoints(table.style.width, 0) * CSS_PIXELS_PER_POINT;
        const height = parseTemplateEditorCssLengthToPoints(table.style.height, 0) * CSS_PIXELS_PER_POINT;
        return width <= availableSize.width && height <= availableSize.height;
      });
      if (!fits) setStatus?.("표를 붙여넣을 공간이 부족합니다. 데이터 블록 크기를 키워주세요.", "warning");
      return fits;
    }
    const didFitAllTables = tableElements.every((tableElement) =>
      fitTemplateEditorTableToCandidateBlock(tableElement, blockElement, { availableSize, setStatus }),
    );

    if (!didFitAllTables) {
      return false;
    }

    Array.from(fragment.childNodes || []).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && !String(node.textContent || "").replace(/\u00a0/g, " ").trim()) {
        node.remove();
        return;
      }

      if (isBlankTemplateEditorBlockElement(node)) {
        node.remove();
      }
    });

    return true;
  }

  function getTemplateEditorRangeRect(range) {
    if (!range) {
      return null;
    }

    const isUsableRect = (rect) =>
      rect &&
      Number.isFinite(rect.left) &&
      Number.isFinite(rect.right) &&
      (rect.left !== 0 || rect.right !== 0 || rect.top !== 0 || rect.bottom !== 0 || rect.width > 0 || rect.height > 0);
    const firstClientRect = Array.from(range.getClientRects?.() || []).find((rect) =>
      isUsableRect(rect),
    );

    if (firstClientRect) {
      return firstClientRect;
    }

    const boundingRect = range.getBoundingClientRect?.();

    return isUsableRect(boundingRect) ? boundingRect : null;
  }

  function getTemplateEditorCellObjectSize(cellElement, range = null) {
    const computedStyle = window.getComputedStyle(cellElement);
    const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(computedStyle.paddingRight) || 0;
    const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0;
    const borderLeft = Number.parseFloat(computedStyle.borderLeftWidth) || 0;
    const borderRight = Number.parseFloat(computedStyle.borderRightWidth) || 0;
    const borderTop = Number.parseFloat(computedStyle.borderTopWidth) || 0;
    const borderBottom = Number.parseFloat(computedStyle.borderBottomWidth) || 0;
    const paddingX =
      paddingLeft +
      paddingRight;
    const paddingY =
      paddingTop +
      paddingBottom;
    const borderX =
      borderLeft +
      borderRight;
    const borderY =
      borderTop +
      borderBottom;
    const cellRect = cellElement.getBoundingClientRect();
    const candidateBlockElement = cellElement.closest("[data-candidate-block-instance]");
    const visualScale = getTemplateEditorCandidateBlockVisualScale(candidateBlockElement);
    const scaleX = Math.max(visualScale.x || 1, 0.01);
    const scaleY = Math.max(visualScale.y || 1, 0.01);
    const logicalRectWidth = cellRect.width / scaleX;
    const logicalRectHeight = cellRect.height / scaleY;
    const widthCandidates = [
      cellElement.clientWidth - paddingX,
      logicalRectWidth - paddingX - borderX,
      logicalRectWidth,
    ];
    const heightCandidates = [
      cellElement.clientHeight - paddingY,
      logicalRectHeight - paddingY - borderY,
      logicalRectHeight,
    ];
    const resolveSize = (candidates) => {
      const value = candidates.find((candidate) => Number.isFinite(candidate) && candidate > 0);

      return Math.max(objectMinimumSize, Math.floor(value || objectMinimumSize));
    };
    const contentWidth = resolveSize(widthCandidates);
    const contentHeight = resolveSize(heightCandidates);
    const contentLeft = cellRect.left + (borderLeft + paddingLeft) * scaleX;
    const contentRight = Math.max(contentLeft, contentLeft + contentWidth * scaleX);
    const rangeRect = getTemplateEditorRangeRect(range);
    const caretLeft = rangeRect && Number.isFinite(rangeRect.left)
      ? Math.min(Math.max(rangeRect.left, contentLeft), contentRight)
      : contentLeft;
    const remainingWidth = rangeRect ? Math.floor((contentRight - caretLeft) / scaleX) : contentWidth;

    return {
      height: contentHeight,
      width: Math.max(objectMinimumSize, Math.min(contentWidth, remainingWidth > 0 ? remainingWidth : objectMinimumSize)),
    };
  }

  function removeBlankTemplateEditorObjectCompanions(fragment) {
    Array.from(fragment.childNodes || []).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && !String(node.textContent || "").replace(/\u00a0/g, " ").trim()) {
        node.remove();
      }
    });

    fragment.querySelectorAll?.("p, div").forEach((element) => {
      const text = String(element.textContent || "").replace(/\u00a0/g, " ").trim();
      const hasOnlyLineBreaks = Array.from(element.childNodes).every((node) =>
        node.nodeType === Node.TEXT_NODE
          ? !String(node.textContent || "").replace(/\u00a0/g, " ").trim()
          : node.nodeType === Node.ELEMENT_NODE && String(node.tagName || "").toLowerCase() === "br",
      );

      if (!text && hasOnlyLineBreaks) {
        element.remove();
      }
    });
  }

  function fitTemplateEditorImagesToInsertionCell(fragment, cellElement, range = null) {
    if (!cellElement || !fragment?.querySelectorAll) {
      return;
    }

    const imageElements = Array.from(fragment.querySelectorAll("img"));

    if (!imageElements.length) {
      return;
    }

    const { height, width } = getTemplateEditorCellObjectSize(cellElement, range);

    imageElements.forEach((imageElement) => {
      imageElement.style.width = `${width}px`;
      imageElement.style.height = `${height}px`;
      imageElement.style.maxWidth = "100%";
      imageElement.style.maxHeight = `${height}px`;
      imageElement.style.display = "inline-block";
      imageElement.style.margin = "0";
      imageElement.style.verticalAlign = "top";

      if (!String(imageElement.style.objectFit || "").trim()) {
        imageElement.style.objectFit = imageElement.classList.contains("template-generated-object")
          ? "fill"
          : "contain";
      }
    });
    removeBlankTemplateEditorObjectCompanions(fragment);
  }

  function getTemplateEditorImageStyleSize(imageElement) {
    const width = parseTemplateEditorCssLengthToPoints(imageElement?.style?.width, Number.NaN) * CSS_PIXELS_PER_POINT;
    const height = parseTemplateEditorCssLengthToPoints(imageElement?.style?.height, Number.NaN) * CSS_PIXELS_PER_POINT;

    return {
      height: Number.isFinite(height) && height > 0 ? height : 0,
      width: Number.isFinite(width) && width > 0 ? width : 0,
    };
  }

  function fitTemplateEditorImagesToCandidateBlock(fragment, blockElement) {
    if (!blockElement || !fragment?.querySelectorAll) {
      return;
    }

    const imageElements = Array.from(fragment.querySelectorAll("img"));

    if (!imageElements.length) {
      return;
    }

    const blockSize = getTemplateEditorCandidateBlockContentSize(blockElement);

    if (!(blockSize.width > 0) || !(blockSize.height > 0)) {
      return;
    }

    imageElements.forEach((imageElement) => {
      const currentSize = getTemplateEditorImageStyleSize(imageElement);
      const sourceWidth = currentSize.width || blockSize.width;
      const sourceHeight = currentSize.height || blockSize.height;
      const fitScale = Math.min(1, blockSize.width / sourceWidth, blockSize.height / sourceHeight);
      const nextWidth = Math.max(objectMinimumSize, Math.floor(sourceWidth * fitScale));
      const nextHeight = Math.max(objectMinimumSize, Math.floor(sourceHeight * fitScale));

      imageElement.style.width = `${nextWidth}px`;
      imageElement.style.height = `${nextHeight}px`;
      imageElement.style.maxWidth = "100%";
      imageElement.style.maxHeight = "100%";
      imageElement.style.display = "inline-block";
      imageElement.style.margin = "0";
      imageElement.style.verticalAlign = "top";

      if (!String(imageElement.style.objectFit || "").trim()) {
        imageElement.style.objectFit = imageElement.classList.contains("template-generated-object")
          ? "fill"
          : "contain";
      }
    });
  }

  return Object.freeze({
    fitTemplateEditorImagesToCandidateBlock,
    fitTemplateEditorImagesToInsertionCell,
    fitTemplateEditorTablesToCandidateBlock,
    getTemplateEditorBlankInsertionBlock,
    getTemplateEditorCellObjectSize,
    getTemplateEditorInsertionCandidateBlock,
    getTemplateEditorInsertionCell,
    getTemplateEditorRangeRect,
    isBlankTemplateEditorBlockElement,
    removeBlankTemplateEditorObjectCompanions,
  });
});

})();
