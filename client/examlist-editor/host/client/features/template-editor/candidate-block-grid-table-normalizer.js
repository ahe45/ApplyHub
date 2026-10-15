import {
  normalizeCandidateBlockTemplateHtml,
  pointValueToCssPixel,
} from "./candidate-block-grid-config.js";
import { parseCandidateBlockPixelValue } from "./candidate-block-grid-pixels.js";
import {
  buildCandidateBlockTableCellEntries,
  candidateBlockTableMinimumCellSize,
  distributeCandidateBlockTableSizes,
  getCandidateBlockElementChromeSize,
  getCandidateBlockTableColumnCount,
  getCandidateBlockTableMinimumSegmentSize,
} from "./candidate-block-grid-table-layout.js";

const candidateBlockTableFitTolerance = 1;

function stripCandidateBlockTemplateRuntimeState(rootElement) {
  if (!rootElement?.querySelectorAll) {
    return;
  }

  rootElement
    .querySelectorAll(
      ".template-editor-image-selection, .template-editor-image-resize-handle, .examlist-object-selection, .examlist-object-resize-handle, .template-editor-table-selection, .template-editor-table-handle, .template-editor-table-move-handle, .template-editor-table-select-handle, [data-candidate-block-grid-resize-handle], [data-candidate-block-grid-move-handle]",
    )
    .forEach((element) => element.remove());

  const transientClassNames = [
    "template-editor-image-object",
    "is-selected-object",
    "is-moving-object",
    "is-floating-object",
    "is-selected-table-object",
    "is-active-cell",
    "is-selected-cell",
    "is-selected-candidate-block-grid",
    "is-resizing-candidate-block-grid",
    "is-moving-candidate-block-grid",
  ];
  const transientSelector = transientClassNames.map((className) => `.${className}`).join(", ");

  rootElement.querySelectorAll(transientSelector).forEach((element) => {
    transientClassNames.forEach((className) => element.classList.remove(className));

    if (!String(element.className || "").trim()) {
      element.removeAttribute("class");
    }
  });

  rootElement.querySelectorAll("img[draggable]").forEach((imageElement) => {
    imageElement.removeAttribute("draggable");
  });

  rootElement.querySelectorAll("img[contenteditable]").forEach((imageElement) => {
    imageElement.removeAttribute("contenteditable");
  });
}

function isBlankCandidateBlockCompanion(element) {
  if (!(element instanceof HTMLElement) || !/^(P|DIV)$/i.test(String(element.tagName || ""))) {
    return false;
  }

  const text = String(element.textContent || "").replace(/\u00a0/g, " ").trim();
  const hasOnlyLineBreaks = Array.from(element.childNodes || []).every((node) =>
    node.nodeType === Node.TEXT_NODE
      ? !String(node.textContent || "").replace(/\u00a0/g, " ").trim()
      : node.nodeType === Node.ELEMENT_NODE && String(node.tagName || "").toLowerCase() === "br",
  );

  return !text && hasOnlyLineBreaks;
}

function isRemovableCandidateBlockTableCompanion(element) {
  return (
    element instanceof HTMLElement &&
    /^(P|DIV)$/i.test(String(element.tagName || "")) &&
    !element.querySelector?.("table, img, hr, [data-template-tag-value], .template-token, .template-generated-object")
  );
}

function getCandidateBlockInnerSize(blockElement) {
  if (!(blockElement instanceof HTMLElement)) {
    return { height: 0, width: 0 };
  }

  const computedStyle = window.getComputedStyle(blockElement);
  const blockRect = blockElement.getBoundingClientRect();
  const logicalContentWidth = parseCandidateBlockPixelValue(blockElement.dataset?.candidateBlockLogicalContentWidth || "", 0);
  const logicalContentHeight = parseCandidateBlockPixelValue(blockElement.dataset?.candidateBlockLogicalContentHeight || "", 0);

  if (logicalContentWidth > 0 || logicalContentHeight > 0) {
    return {
      height: Math.max(0, Math.floor(logicalContentHeight || blockElement.clientHeight || blockElement.offsetHeight || blockRect.height || 0)),
      width: Math.max(0, Math.floor(logicalContentWidth || blockElement.clientWidth || blockElement.offsetWidth || blockRect.width || 0)),
    };
  }

  const logicalWidth = parseCandidateBlockPixelValue(blockElement.dataset?.candidateBlockLogicalWidth || "", 0);
  const logicalHeight = parseCandidateBlockPixelValue(blockElement.dataset?.candidateBlockLogicalHeight || "", 0);
  const horizontalPadding =
    parseCandidateBlockPixelValue(computedStyle.paddingLeft) +
    parseCandidateBlockPixelValue(computedStyle.paddingRight);
  const verticalPadding =
    parseCandidateBlockPixelValue(computedStyle.paddingTop) +
    parseCandidateBlockPixelValue(computedStyle.paddingBottom);
  const rawWidth = logicalWidth || blockElement.clientWidth || blockElement.offsetWidth || blockRect.width || 0;
  const rawHeight = logicalHeight || blockElement.clientHeight || blockElement.offsetHeight || blockRect.height || 0;

  return {
    height: Math.max(0, Math.floor(rawHeight - verticalPadding)),
    width: Math.max(0, Math.floor(rawWidth - horizontalPadding)),
  };
}

function scaleCandidateBlockTableColumns(tableElement, targetWidth) {
  const columnElements = Array.from(tableElement?.querySelectorAll?.("colgroup col") || []);

  if (!columnElements.length || !(targetWidth > 0)) {
    return;
  }

  const minimumColumnWidth = getCandidateBlockTableMinimumSegmentSize(tableElement, "column");
  const currentWidths = columnElements.map((columnElement) =>
    Math.max(minimumColumnWidth, parseCandidateBlockPixelValue(columnElement.style.width, 0)),
  );
  const nextWidths = distributeCandidateBlockTableSizes(currentWidths, targetWidth, minimumColumnWidth);

  if (!nextWidths.length) {
    return;
  }

  columnElements.forEach((columnElement, index) => {
    const nextWidth = nextWidths[index] || candidateBlockTableMinimumCellSize;
    columnElement.style.width = `${nextWidth}px`;
  });

  buildCandidateBlockTableCellEntries(tableElement).forEach((entry, cellElement) => {
    const cellWidth = nextWidths
      .slice(entry.colIndex, entry.colIndex + entry.colSpan)
      .reduce((sum, width) => sum + Math.max(0, width || 0), 0);

    if (cellWidth > 0) {
      cellElement.style.width = `${cellWidth}px`;
    }
  });
}

function scaleCandidateBlockTableRows(tableElement, targetHeight) {
  const rowElements = Array.from(tableElement?.rows || []);

  if (!rowElements.length || !(targetHeight > 0)) {
    return;
  }

  const minimumRowHeight = getCandidateBlockTableMinimumSegmentSize(tableElement, "row");
  const currentHeights = rowElements.map((rowElement) =>
    Math.max(minimumRowHeight, parseCandidateBlockPixelValue(rowElement.style.height, rowElement.getBoundingClientRect?.().height || 0)),
  );
  const nextHeights = distributeCandidateBlockTableSizes(currentHeights, targetHeight, minimumRowHeight);

  if (!nextHeights.length) {
    return;
  }

  rowElements.forEach((rowElement, index) => {
    const nextHeight = nextHeights[index] || candidateBlockTableMinimumCellSize;
    rowElement.style.height = `${nextHeight}px`;
  });

  buildCandidateBlockTableCellEntries(tableElement).forEach((entry, cellElement) => {
    const cellHeight = nextHeights
      .slice(entry.rowIndex, entry.rowIndex + entry.rowSpan)
      .reduce((sum, height) => sum + Math.max(0, height || 0), 0);

    if (cellHeight > 0) {
      cellElement.style.height = `${cellHeight}px`;
      cellElement.style.minHeight = "0";
    }
  });
  syncCandidateBlockTableRowGroupHeights(tableElement, nextHeights);
}

function syncCandidateBlockTableRowGroupHeights(tableElement, rowHeights) {
  if (!(tableElement instanceof HTMLElement) || !Array.isArray(rowHeights)) {
    return;
  }

  const rowIndexByElement = new Map(Array.from(tableElement.rows || []).map((rowElement, rowIndex) => [rowElement, rowIndex]));
  const rowGroups = [
    tableElement.tHead,
    ...Array.from(tableElement.tBodies || []),
    tableElement.tFoot,
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

function fitCandidateBlockTableCellVerticalPadding(tableElement) {
  const rowElements = Array.from(tableElement?.rows || []);

  if (!rowElements.length) {
    return;
  }

  const rowHeights = rowElements.map((rowElement) =>
    Math.max(1, parseCandidateBlockPixelValue(rowElement.style.height, rowElement.getBoundingClientRect?.().height || 0)),
  );

  if (!rowHeights.some((height) => height <= 40)) {
    return;
  }

  buildCandidateBlockTableCellEntries(tableElement).forEach((entry, cellElement) => {
    const coveredRowHeights = rowHeights.slice(entry.rowIndex, entry.rowIndex + entry.rowSpan);
    const coveredHeight = coveredRowHeights.reduce((heightSum, height) => heightSum + Math.max(0, height || 0), 0);
    const effectiveRowHeight = coveredHeight / Math.max(1, entry.rowSpan || coveredRowHeights.length || 1);

    if (effectiveRowHeight > 40) {
      return;
    }

    const computedStyle = window.getComputedStyle(cellElement);
    const paddingLeft = cellElement.style.paddingLeft || computedStyle.paddingLeft || "0px";
    const paddingRight = cellElement.style.paddingRight || computedStyle.paddingRight || "0px";

    cellElement.style.padding = `0px ${paddingRight} 0px ${paddingLeft}`;
    cellElement.style.overflow = "hidden";
  });
}

function isCandidateBlockPixelLength(value = "") {
  return /^-?\d+(?:\.\d+)?px$/i.test(String(value || "").trim());
}

function getCandidateBlockTableRenderedSize(tableElement) {
  const rect = tableElement?.getBoundingClientRect?.();

  return {
    height: Math.max(0, Math.round(rect?.height || 0)),
    width: Math.max(0, Math.round(rect?.width || 0)),
  };
}

function getCandidateBlockVisualScale(blockElement) {
  if (!(blockElement instanceof HTMLElement)) {
    return { x: 1, y: 1 };
  }

  const blockRect = blockElement.getBoundingClientRect();
  const logicalWidth =
    parseCandidateBlockPixelValue(blockElement.dataset?.candidateBlockLogicalWidth || "", 0) ||
    blockElement.offsetWidth ||
    blockElement.clientWidth ||
    blockRect.width ||
    0;
  const logicalHeight =
    parseCandidateBlockPixelValue(blockElement.dataset?.candidateBlockLogicalHeight || "", 0) ||
    blockElement.offsetHeight ||
    blockElement.clientHeight ||
    blockRect.height ||
    0;

  return {
    x: logicalWidth > 0 && blockRect.width > 0 ? blockRect.width / logicalWidth : 1,
    y: logicalHeight > 0 && blockRect.height > 0 ? blockRect.height / logicalHeight : 1,
  };
}

function hasCandidateBlockLogicalSize(blockElement) {
  if (!(blockElement instanceof HTMLElement)) {
    return false;
  }

  return (
    parseCandidateBlockPixelValue(blockElement.dataset?.candidateBlockLogicalContentWidth || "", 0) > 0 ||
    parseCandidateBlockPixelValue(blockElement.dataset?.candidateBlockLogicalContentHeight || "", 0) > 0 ||
    parseCandidateBlockPixelValue(blockElement.dataset?.candidateBlockLogicalWidth || "", 0) > 0 ||
    parseCandidateBlockPixelValue(blockElement.dataset?.candidateBlockLogicalHeight || "", 0) > 0
  );
}

function getCandidateBlockTableColumnTotalWidth(tableElement) {
  return Array.from(tableElement?.querySelectorAll?.("colgroup col") || []).reduce(
    (widthSum, columnElement) =>
      widthSum + Math.max(1, parseCandidateBlockPixelValue(columnElement.style.width, candidateBlockTableMinimumCellSize)),
    0,
  );
}

function getCandidateBlockTableRowTotalHeight(tableElement) {
  return Array.from(tableElement?.rows || []).reduce(
    (heightSum, rowElement) =>
      heightSum +
      Math.max(
        1,
        parseCandidateBlockPixelValue(rowElement.style.height, Math.round(rowElement.getBoundingClientRect?.().height || 0)),
      ),
    0,
  );
}

function fitCandidateBlockTableRowsToRenderedHeight(tableElement, targetHeight, maxHeight, blockElement) {
  let nextTargetHeight = Math.max(1, Math.round(targetHeight) || 0);
  const rowCount = Math.max(1, Array.from(tableElement?.rows || []).length);
  const requiredVisualGap = 0;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const currentRowTotalHeight = getCandidateBlockTableRowTotalHeight(tableElement);

    if (attempt > 0 || Math.round(currentRowTotalHeight) !== Math.round(nextTargetHeight)) {
      scaleCandidateBlockTableRows(tableElement, nextTargetHeight);
    }

    tableElement.style.height = `${Math.round(nextTargetHeight)}px`;

    const tableRect = tableElement.getBoundingClientRect();
    const blockRect = blockElement?.getBoundingClientRect?.();
    const visualScale = getCandidateBlockVisualScale(blockElement);
    const visualBottomGap = blockRect ? blockRect.bottom - tableRect.bottom : requiredVisualGap;
    const overflow = (requiredVisualGap - visualBottomGap) / Math.max(visualScale.y || 1, 0.01);

    if (overflow <= 0) {
      return nextTargetHeight;
    }

    const reducedHeight = Math.max(rowCount, Math.ceil(Math.min(maxHeight, nextTargetHeight) - overflow));

    if (reducedHeight >= nextTargetHeight) {
      return nextTargetHeight;
    }

    nextTargetHeight = reducedHeight;
  }

  return nextTargetHeight;
}

function doesCandidateBlockTableFitBlock(tableElement, blockElement) {
  const tableRect = tableElement?.getBoundingClientRect?.();
  const blockRect = blockElement?.getBoundingClientRect?.();

  return Boolean(
    tableRect &&
      blockRect &&
      tableRect.right <= blockRect.right + candidateBlockTableFitTolerance &&
      tableRect.bottom <= blockRect.bottom + candidateBlockTableFitTolerance,
  );
}

function doesCandidateBlockTableFitWidth(tableElement, blockElement) {
  const tableRect = tableElement?.getBoundingClientRect?.();
  const blockRect = blockElement?.getBoundingClientRect?.();

  return Boolean(tableRect && blockRect && tableRect.right <= blockRect.right + candidateBlockTableFitTolerance);
}

function normalizeCandidateBlockTableElement(tableElement, blockElement = null) {
  if (!(tableElement instanceof HTMLElement)) {
    return;
  }

  tableElement.dataset.candidateBlockTable = "true";
  tableElement.style.maxWidth = "100%";
  tableElement.style.maxHeight = "100%";
  tableElement.style.minWidth = "0";
  tableElement.style.minHeight = "0";
  tableElement.style.margin = "0";
  tableElement.style.tableLayout = "fixed";
  tableElement.style.borderCollapse = "collapse";
  tableElement.style.boxSizing = "border-box";

  if (blockElement instanceof HTMLElement && (blockElement.isConnected || hasCandidateBlockLogicalSize(blockElement))) {
    const { height, width } = getCandidateBlockInnerSize(blockElement);
    const renderedSize = getCandidateBlockTableRenderedSize(tableElement);
    const maxWidth = Math.max(1, width);
    const maxHeight = Math.max(1, height);
    const configuredWidth = parseCandidateBlockPixelValue(tableElement.style.width, 0);
    const configuredHeight = parseCandidateBlockPixelValue(tableElement.style.height, 0);
    const safeConfiguredWidth = Math.min(maxWidth, Math.max(0, configuredWidth));
    const safeConfiguredHeight = Math.min(maxHeight, Math.max(0, configuredHeight));
    const currentColumnTotalWidth = getCandidateBlockTableColumnTotalWidth(tableElement);
    const currentRowTotalHeight = getCandidateBlockTableRowTotalHeight(tableElement);
    const hasUsableConfiguredWidth =
      isCandidateBlockPixelLength(tableElement.style.width) &&
      safeConfiguredWidth > 0;
    const requestedWidth = hasUsableConfiguredWidth
      ? safeConfiguredWidth
      : Math.max(candidateBlockTableMinimumCellSize, renderedSize.width || currentColumnTotalWidth || maxWidth);
    const rowCount = Math.max(1, Array.from(tableElement.rows || []).length);
    const hasUsableConfiguredHeight =
      isCandidateBlockPixelLength(tableElement.style.height) &&
      safeConfiguredHeight > rowCount * 4;
    const requestedHeight = hasUsableConfiguredHeight
      ? safeConfiguredHeight
      : Math.max(candidateBlockTableMinimumCellSize, currentRowTotalHeight || renderedSize.height || maxHeight);
    let tableTargetWidth = Math.min(maxWidth, Math.max(1, requestedWidth));
    const tableTargetHeight = Math.min(maxHeight, Math.max(1, requestedHeight));

    if (hasUsableConfiguredWidth) {
      tableElement.style.width = `${Math.round(safeConfiguredWidth)}px`;

      if (doesCandidateBlockTableFitWidth(tableElement, blockElement)) {
        tableTargetWidth = Math.max(1, safeConfiguredWidth);
      }
    }

    if (Math.round(currentColumnTotalWidth) !== Math.round(tableTargetWidth)) {
      scaleCandidateBlockTableColumns(tableElement, tableTargetWidth);
    }

    tableElement.style.width = `${Math.round(tableTargetWidth)}px`;
    fitCandidateBlockTableCellVerticalPadding(tableElement);

    let fittedTableTargetHeight = 0;

    if (hasUsableConfiguredHeight) {
      if (Math.round(currentRowTotalHeight) !== Math.round(safeConfiguredHeight)) {
        scaleCandidateBlockTableRows(tableElement, safeConfiguredHeight);
        fitCandidateBlockTableCellVerticalPadding(tableElement);
      }

      tableElement.style.height = `${Math.round(safeConfiguredHeight)}px`;

      if (doesCandidateBlockTableFitBlock(tableElement, blockElement)) {
        fittedTableTargetHeight = safeConfiguredHeight;
      }
    }

    if (!(fittedTableTargetHeight > 0)) {
      fittedTableTargetHeight = fitCandidateBlockTableRowsToRenderedHeight(
        tableElement,
        tableTargetHeight,
        maxHeight,
        blockElement,
      );
    }

    if (Math.round(getCandidateBlockTableRowTotalHeight(tableElement)) !== Math.round(fittedTableTargetHeight)) {
      scaleCandidateBlockTableRows(tableElement, fittedTableTargetHeight);
      fitCandidateBlockTableCellVerticalPadding(tableElement);
    }

    tableElement.style.height = `${Math.round(fittedTableTargetHeight)}px`;
  }
}

function isCandidateBlockTableRoot(element) {
  return element instanceof HTMLElement && Boolean(
    element.matches?.("[data-candidate-block-instance], [data-candidate-block-column-name]"),
  );
}

function getCandidateBlockTableRootElements(rootElement) {
  if (isCandidateBlockTableRoot(rootElement)) {
    return [rootElement];
  }

  return Array.from(
    rootElement.querySelectorAll?.("[data-candidate-block-instance], [data-candidate-block-column-name]") || [],
  );
}

function removeCandidateBlockTableCompanionsForFullHeightTable(tableRoot, blockElement, candidateTables) {
  if (!(tableRoot instanceof HTMLElement) || !(blockElement instanceof HTMLElement) || !candidateTables.length) {
    return false;
  }

  const { height } = getCandidateBlockInnerSize(blockElement);

  if (!(height > 0)) {
    return false;
  }

  const hasFullHeightTableRequest = candidateTables.some((tableElement) => {
    const configuredHeight = parseCandidateBlockPixelValue(tableElement.style.height, 0);

    return tableElement.parentElement === tableRoot && configuredHeight >= height - candidateBlockTableFitTolerance;
  });

  if (!hasFullHeightTableRequest) {
    return false;
  }

  let didRemove = false;

  Array.from(tableRoot.children || []).forEach((childElement) => {
    if (childElement.matches?.("table")) {
      return;
    }

    if (isRemovableCandidateBlockTableCompanion(childElement)) {
      childElement.remove();
      didRemove = true;
    }
  });

  return didRemove;
}

export function normalizeCandidateBlockTables(rootElement) {
  if (!rootElement?.querySelectorAll) {
    return;
  }

  const blockElements = getCandidateBlockTableRootElements(rootElement);
  const shouldNormalizeTemplateFragment =
    !blockElements.length && rootElement.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
  const tableRoots = blockElements.length ? blockElements : shouldNormalizeTemplateFragment ? [rootElement] : [];

  tableRoots.forEach((tableRoot) => {
    const blockElement = isCandidateBlockTableRoot(tableRoot) ? tableRoot : null;
    const canUnwrapTableContainer = Boolean(blockElement) || tableRoot.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
    let candidateTables = Array.from(tableRoot.querySelectorAll("table"));

    if (blockElement) {
      blockElement.classList.toggle("has-candidate-block-table", candidateTables.length > 0);
    }

    candidateTables.forEach((tableElement) => {
      const parentElement = tableElement.parentElement;

      if (
        canUnwrapTableContainer &&
        parentElement instanceof HTMLElement &&
        parentElement !== tableRoot &&
        /^(P|DIV)$/i.test(String(parentElement.tagName || "")) &&
        parentElement.closest?.("[data-candidate-block-instance], [data-candidate-block-column-name]") === blockElement &&
        !String(parentElement.textContent || "").replace(/\u00a0/g, " ").trim() &&
        parentElement.querySelectorAll("table").length === 1
      ) {
        parentElement.replaceWith(tableElement);
      }
    });

    candidateTables = Array.from(tableRoot.querySelectorAll("table"));

    if (removeCandidateBlockTableCompanionsForFullHeightTable(tableRoot, blockElement, candidateTables)) {
      candidateTables = Array.from(tableRoot.querySelectorAll("table"));
    }

    if (candidateTables.length) {
      Array.from(tableRoot.childNodes || []).forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && !String(node.textContent || "").replace(/\u00a0/g, " ").trim()) {
          node.remove();
          return;
        }

        if (node.nodeType === Node.ELEMENT_NODE && String(node.tagName || "").toLowerCase() === "br") {
          node.remove();
          return;
        }

        if (isBlankCandidateBlockCompanion(node)) {
          node.remove();
        }
      });
    }

    candidateTables.forEach((tableElement) => {
      normalizeCandidateBlockTableElement(
        tableElement,
        blockElement || tableElement.closest?.("[data-candidate-block-instance], [data-candidate-block-column-name]") || null,
      );
    });

    tableRoot.querySelectorAll("table ~ p, table ~ div").forEach((element) => {
      if (isBlankCandidateBlockCompanion(element)) {
        element.remove();
      }
    });
  });
}

export function getCandidateBlockGridTableMinimumSize(gridElement) {
  if (!(gridElement instanceof HTMLElement)) {
    return { height: 0, width: 0 };
  }

  const blockElements = Array.from(gridElement.querySelectorAll("[data-candidate-block-instance]"));
  let minimumBlockHeight = 0;
  let minimumBlockWidth = 0;

  blockElements.forEach((blockElement) => {
    const chromeSize = getCandidateBlockElementChromeSize(blockElement);

    blockElement.querySelectorAll("table").forEach((tableElement) => {
      const columnCount = getCandidateBlockTableColumnCount(tableElement);
      const rowCount = Math.max(1, Array.from(tableElement.rows || []).length);
      const minimumColumnWidth = getCandidateBlockTableMinimumSegmentSize(tableElement, "column");
      const minimumRowHeight = getCandidateBlockTableMinimumSegmentSize(tableElement, "row");

      minimumBlockWidth = Math.max(
        minimumBlockWidth,
        columnCount * minimumColumnWidth + chromeSize.horizontal,
      );
      minimumBlockHeight = Math.max(
        minimumBlockHeight,
        rowCount * minimumRowHeight + chromeSize.vertical,
      );
    });
  });

  if (!(minimumBlockWidth > 0) && !(minimumBlockHeight > 0)) {
    return { height: 0, width: 0 };
  }

  const gridStyle = window.getComputedStyle(gridElement);
  const gridColumnCount = Math.max(1, Math.round(Number(gridElement.dataset.candidateBlockColumns) || 1));
  const gridRowCount = Math.max(1, Math.round(Number(gridElement.dataset.candidateBlockRows) || 1));
  const hasColumnNameRow = gridElement.dataset?.candidateBlockColumnNameRowEnabled === "true";
  const columnGap = parseCandidateBlockPixelValue(gridStyle.columnGap);
  const rowGap = hasColumnNameRow
    ? pointValueToCssPixel(Number(gridElement.dataset?.candidateBlockGapYPt) || 0)
    : parseCandidateBlockPixelValue(gridStyle.rowGap);

  return {
    height: Math.floor(minimumBlockHeight * gridRowCount + Math.max(0, gridRowCount - 1) * rowGap),
    width: Math.floor(minimumBlockWidth * gridColumnCount + Math.max(0, gridColumnCount - 1) * columnGap),
  };
}

export function normalizeCandidateBlockTemplateHtmlFromElement(blockElement, fallbackHtml = "") {
  if (!(blockElement instanceof HTMLElement)) {
    return normalizeCandidateBlockTemplateHtml(fallbackHtml);
  }

  const template = document.createElement("template");

  template.innerHTML = blockElement.innerHTML;
  stripCandidateBlockTemplateRuntimeState(template.content);
  normalizeCandidateBlockTables(template.content);
  return normalizeCandidateBlockTemplateHtml(template.innerHTML || fallbackHtml);
}
