import { parseCandidateBlockPixelValue } from "./candidate-block-grid-pixels.js";

export const candidateBlockTableMinimumCellSize = 1;
const cssPixelsPerPoint = 96 / 72;
const candidateBlockTableDefaultLineSpacingPx = cssPixelsPerPoint;

export function buildCandidateBlockTableCellEntries(tableElement) {
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

      const rowSpan = Math.max(1, Number(cellElement.rowSpan) || 1);
      const colSpan = Math.max(1, Number(cellElement.colSpan) || 1);

      entries.set(cellElement, {
        cell: cellElement,
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

export function getCandidateBlockTableColumnCount(tableElement) {
  const entries = buildCandidateBlockTableCellEntries(tableElement);
  let columnCount = Array.from(tableElement?.querySelectorAll?.("colgroup col") || []).length;

  entries.forEach((entry) => {
    columnCount = Math.max(columnCount, entry.colIndex + entry.colSpan);
  });

  return Math.max(1, columnCount);
}

function getCandidateBlockStylePixelValue(style, propertyName, fallback = 0) {
  return parseCandidateBlockPixelValue(style?.getPropertyValue?.(propertyName) || style?.[propertyName] || "", fallback);
}

function getCandidateBlockLineHeightPixelValue(style, fontSize) {
  const rawLineHeight = String(style?.lineHeight || "").trim();
  const numericLineHeight = Number.parseFloat(rawLineHeight);

  if (!rawLineHeight || rawLineHeight === "normal") {
    return fontSize + candidateBlockTableDefaultLineSpacingPx;
  }

  if (Number.isFinite(numericLineHeight) && /^-?\d+(?:\.\d+)?$/.test(rawLineHeight)) {
    return fontSize * numericLineHeight;
  }

  return parseCandidateBlockPixelValue(rawLineHeight, fontSize + candidateBlockTableDefaultLineSpacingPx);
}

function getCandidateBlockCellMinimumSize(cellElement, axis) {
  if (!(cellElement instanceof HTMLElement)) {
    return candidateBlockTableMinimumCellSize;
  }

  const style = window.getComputedStyle(cellElement);

  if (axis === "column") {
    return Math.max(
      candidateBlockTableMinimumCellSize,
      Math.ceil(
        getCandidateBlockStylePixelValue(style, "border-left-width") +
          getCandidateBlockStylePixelValue(style, "border-right-width") +
          getCandidateBlockStylePixelValue(style, "padding-left") +
          getCandidateBlockStylePixelValue(style, "padding-right"),
      ),
    );
  }

  const fontSize = getCandidateBlockStylePixelValue(style, "font-size", 11);

  return Math.max(
    candidateBlockTableMinimumCellSize,
    Math.ceil(
      getCandidateBlockStylePixelValue(style, "border-top-width") +
        getCandidateBlockStylePixelValue(style, "border-bottom-width") +
        getCandidateBlockStylePixelValue(style, "padding-top") +
        getCandidateBlockStylePixelValue(style, "padding-bottom") +
        getCandidateBlockLineHeightPixelValue(style, fontSize),
    ),
  );
}

export function getCandidateBlockTableMinimumSegmentSize(tableElement, axis) {
  const entries = buildCandidateBlockTableCellEntries(tableElement);
  let minimumSize = candidateBlockTableMinimumCellSize;

  entries.forEach((entry, cellElement) => {
    const span = axis === "column" ? entry.colSpan : entry.rowSpan;
    const cellMinimumSize = getCandidateBlockCellMinimumSize(cellElement, axis);

    minimumSize = Math.max(minimumSize, Math.ceil(cellMinimumSize / Math.max(1, span || 1)));
  });

  return minimumSize;
}

export function getCandidateBlockElementChromeSize(blockElement) {
  if (!(blockElement instanceof HTMLElement)) {
    return { horizontal: 0, vertical: 0 };
  }

  const computedStyle = window.getComputedStyle(blockElement);

  return {
    horizontal:
      parseCandidateBlockPixelValue(computedStyle.borderLeftWidth) +
      parseCandidateBlockPixelValue(computedStyle.borderRightWidth) +
      parseCandidateBlockPixelValue(computedStyle.paddingLeft) +
      parseCandidateBlockPixelValue(computedStyle.paddingRight),
    vertical:
      parseCandidateBlockPixelValue(computedStyle.borderTopWidth) +
      parseCandidateBlockPixelValue(computedStyle.borderBottomWidth) +
      parseCandidateBlockPixelValue(computedStyle.paddingTop) +
      parseCandidateBlockPixelValue(computedStyle.paddingBottom),
  };
}

export function getCandidateBlockCollapsedBorderAdjustment(tableElement, axis) {
  if (!(tableElement instanceof HTMLElement)) {
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
      getCandidateBlockStylePixelValue(tableStyle, "border-left-width"),
      getCandidateBlockStylePixelValue(tableStyle, "border-right-width"),
      getCandidateBlockStylePixelValue(leftStyle, "border-left-width"),
      getCandidateBlockStylePixelValue(rightStyle, "border-right-width"),
    );
  }

  const firstRow = tableElement.rows?.[0] || null;
  const lastRow = tableElement.rows?.[Math.max(0, (tableElement.rows?.length || 1) - 1)] || null;
  const firstCell = firstRow?.cells?.[0] || null;
  const lastCell = lastRow?.cells?.[0] || null;
  const firstCellStyle = firstCell ? window.getComputedStyle(firstCell) : null;
  const lastCellStyle = lastCell ? window.getComputedStyle(lastCell) : null;

  return Math.max(
    getCandidateBlockStylePixelValue(tableStyle, "border-top-width"),
    getCandidateBlockStylePixelValue(tableStyle, "border-bottom-width"),
    getCandidateBlockStylePixelValue(firstCellStyle, "border-top-width"),
    getCandidateBlockStylePixelValue(lastCellStyle, "border-bottom-width"),
  );
}

function distributeCandidateBlockEvenTableSizes(targetSize, itemCount, minimumSize) {
  const baseSize = Math.max(minimumSize, Math.floor(targetSize / itemCount));
  let remainder = targetSize - baseSize * itemCount;

  return Array.from({ length: itemCount }, () => {
    const nextSize = baseSize + (remainder > 0 ? 1 : 0);

    remainder -= 1;
    return Math.max(minimumSize, nextSize);
  });
}

export function distributeCandidateBlockTableSizes(currentSizes, targetSize, minimumSize = candidateBlockTableMinimumCellSize) {
  const itemCount = currentSizes.length;

  if (!itemCount) {
    return [];
  }

  const safeTargetSize = Math.max(itemCount, Math.round(Number(targetSize) || 0));
  const safeMinimumSize = Math.max(
    1,
    Math.min(Math.round(minimumSize) || 1, Math.floor(safeTargetSize / itemCount) || 1),
  );
  const normalizedSizes = currentSizes.map((size) => Math.max(safeMinimumSize, Math.round(Number(size) || 0)));
  const isEvenDistributionSource =
    normalizedSizes.length > 0 &&
    Math.max(...normalizedSizes) - Math.min(...normalizedSizes) <= 1;

  if (isEvenDistributionSource) {
    return distributeCandidateBlockEvenTableSizes(safeTargetSize, itemCount, safeMinimumSize);
  }

  const extraSizes = normalizedSizes.map((size) => Math.max(0, size - safeMinimumSize));
  const totalExtraSize = extraSizes.reduce((sum, size) => sum + size, 0);
  const targetExtraSize = safeTargetSize - safeMinimumSize * itemCount;
  let usedSize = 0;

  const distributedSizes = normalizedSizes.map((_size, index) => {
    const isLast = index === itemCount - 1;
    const nextSize = isLast
      ? safeTargetSize - usedSize
      : safeMinimumSize + Math.round(targetExtraSize * (totalExtraSize > 0 ? extraSizes[index] / totalExtraSize : 1 / itemCount));

    usedSize += nextSize;
    return Math.max(safeMinimumSize, nextSize);
  });
  let overflow = distributedSizes.reduce((sum, size) => sum + size, 0) - safeTargetSize;

  for (let index = distributedSizes.length - 1; index >= 0 && overflow > 0; index -= 1) {
    const reduction = Math.min(overflow, Math.max(0, distributedSizes[index] - safeMinimumSize));
    distributedSizes[index] -= reduction;
    overflow -= reduction;
  }

  const deficit = safeTargetSize - distributedSizes.reduce((sum, size) => sum + size, 0);

  if (deficit > 0) {
    distributedSizes[distributedSizes.length - 1] += deficit;
  }

  return distributedSizes;
}
