import {
  candidateBlockGridMinimumHeight,
  candidateBlockGridMinimumRowHeight,
  candidateBlockGridMinimumWidth,
  pointValueToCssPixel,
} from "./candidate-block-grid-config.js";
import { getCandidateBlockGridTableMinimumSize } from "./candidate-block-grid-table-normalizer.js";
import { getObjectCandidateBlockVisualScale } from "./object-alignment-runtime.js";
import { templateEditorObjectMinimumSize } from "./object-toolbar-constants.js";
import {
  parseObjectSizePixelValue,
} from "./object-size-values.js";

export function getCandidateBlockModalContentSize(modalSurfaceElement) {
  if (!(modalSurfaceElement instanceof HTMLElement)) {
    return null;
  }

  const modalRect = modalSurfaceElement.getBoundingClientRect();
  const visualScale = getObjectCandidateBlockVisualScale(modalSurfaceElement);
  const scaleX = Math.max(visualScale.x || 1, 0.01);
  const scaleY = Math.max(visualScale.y || 1, 0.01);
  const width =
    parseObjectSizePixelValue(modalSurfaceElement.dataset?.candidateBlockLogicalContentWidth, 0) ||
    parseObjectSizePixelValue(modalSurfaceElement.dataset?.candidateBlockLogicalWidth, 0) ||
    modalSurfaceElement.clientWidth ||
    modalSurfaceElement.offsetWidth ||
    (modalRect.width > 0 ? modalRect.width / scaleX : 0);
  const height =
    parseObjectSizePixelValue(modalSurfaceElement.dataset?.candidateBlockLogicalContentHeight, 0) ||
    parseObjectSizePixelValue(modalSurfaceElement.dataset?.candidateBlockLogicalHeight, 0) ||
    modalSurfaceElement.clientHeight ||
    modalSurfaceElement.offsetHeight ||
    (modalRect.height > 0 ? modalRect.height / scaleY : 0);

  return {
    height: Math.max(templateEditorObjectMinimumSize, Math.floor(height || templateEditorObjectMinimumSize)),
    width: Math.max(templateEditorObjectMinimumSize, Math.floor(width || templateEditorObjectMinimumSize)),
  };
}

export function getCandidateBlockGridMinimumSize(gridElement) {
  const tableMinimumSize = getCandidateBlockGridTableMinimumSize(gridElement);
  const gridStyle = window.getComputedStyle(gridElement);
  const rowCount = Math.max(1, Math.round(Number(gridElement?.dataset?.candidateBlockRows) || 1));
  const hasColumnNameRow = gridElement?.dataset?.candidateBlockColumnNameRowEnabled === "true";
  const columnNameRowHeight = hasColumnNameRow
    ? parseObjectSizePixelValue(String(gridStyle.gridTemplateRows || "").split(/\s+/)[0], 0)
    : 0;
  const rowGap = hasColumnNameRow
    ? pointValueToCssPixel(Number(gridElement?.dataset?.candidateBlockGapYPt) || 0)
    : parseObjectSizePixelValue(gridStyle.rowGap || gridStyle.gap, 0);
  const rowMinimumHeight = Math.ceil(
    rowCount * candidateBlockGridMinimumRowHeight +
      columnNameRowHeight +
      Math.max(0, rowCount - 1) * rowGap,
  );

  return {
    height: Math.max(candidateBlockGridMinimumHeight, rowMinimumHeight, Math.floor(tableMinimumSize.height || 0)),
    width: Math.max(candidateBlockGridMinimumWidth, Math.floor(tableMinimumSize.width || 0)),
  };
}

export function getObjectTableCollapsedBorderAdjustment(tableElement) {
  if (!(tableElement instanceof HTMLTableElement)) {
    return 0;
  }

  const tableStyle = window.getComputedStyle(tableElement);

  if (String(tableStyle.borderCollapse || "").trim().toLowerCase() !== "collapse") {
    return 0;
  }

  const rows = Array.from(tableElement.rows || []);
  const leftCell = rows.map((rowElement) => rowElement.cells?.[0]).find(Boolean);
  const rightCell = rows
    .map((rowElement) => rowElement.cells?.[Math.max(0, (rowElement.cells?.length || 1) - 1)])
    .find(Boolean);
  const leftStyle = leftCell ? window.getComputedStyle(leftCell) : null;
  const rightStyle = rightCell ? window.getComputedStyle(rightCell) : null;

  return Math.max(
    parseObjectSizePixelValue(tableStyle.borderLeftWidth),
    parseObjectSizePixelValue(tableStyle.borderRightWidth),
    parseObjectSizePixelValue(leftStyle?.borderLeftWidth),
    parseObjectSizePixelValue(rightStyle?.borderRightWidth),
  );
}

export function getObjectTableRenderedTargetWidth(_tableElement, targetWidth) {
  return Math.max(
    templateEditorObjectMinimumSize,
    Math.round(targetWidth),
  );
}

export function getObjectTableColumnWidths(tableElement, columns, cellMap, tableUtils) {
  const visualScale = getObjectCandidateBlockVisualScale(tableElement);
  const scaleX = Math.max(visualScale.x || 1, 0.01);

  return columns.map((columnElement, columnIndex) =>
    Math.max(
      templateEditorObjectMinimumSize,
      parseObjectSizePixelValue(
        columnElement.style.width,
        Math.round(
          tableUtils?.getTemplateEditorMeasuredColumnWidth?.(cellMap, columnIndex) ||
            (columnElement.getBoundingClientRect?.().width || 0) / scaleX ||
            0,
        ),
      ),
    ),
  );
}

export function getObjectTableRowHeights(tableElement) {
  const visualScale = getObjectCandidateBlockVisualScale(tableElement);
  const scaleY = Math.max(visualScale.y || 1, 0.01);

  return Array.from(tableElement?.rows || []).map((rowElement) =>
    Math.max(
      templateEditorObjectMinimumSize,
      parseObjectSizePixelValue(
        rowElement.style.height,
        Math.round(((rowElement.getBoundingClientRect?.().height || 0) / scaleY) || 0),
      ),
    ),
  );
}
