import { getObjectAlignmentCanvasMetrics, getObjectAlignmentPositioningElement, getObjectTableCellElement } from "./object-alignment-metrics.js";

const alignments = new Set(["left", "center-x", "right", "top", "center-y", "bottom"]);
const pixel = (value) => Number.parseFloat(value) || 0;

export function alignObjectsInsideCells(elements, surfaceElement, command) {
  const alignment = String(command).replace(/^(align|canvas)-/, "");
  if (!alignments.has(alignment)) return false;

  // Measure before taking any images out of text flow, so multiple selections
  // and merged cells retain their original table dimensions.
  const items = elements.map(element => {
    const cell = getObjectTableCellElement(element, surfaceElement);
    // A table column can have fractional width, while offsetWidth is rounded.
    // Read zoom from the editing surface to avoid shrinking on repeated aligns.
    const scale = getObjectAlignmentCanvasMetrics(getObjectAlignmentPositioningElement(element, surfaceElement));
    const metrics = { rect: cell.getBoundingClientRect(), width: cell.clientWidth, height: cell.clientHeight,
      scaleX: scale.scaleX, scaleY: scale.scaleY };
    const style = getComputedStyle(cell);
    const imageStyle = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const extraWidth = imageStyle.boxSizing === "border-box" ? 0 : pixel(imageStyle.paddingLeft) + pixel(imageStyle.paddingRight) + pixel(imageStyle.borderLeftWidth) + pixel(imageStyle.borderRightWidth);
    const extraHeight = imageStyle.boxSizing === "border-box" ? 0 : pixel(imageStyle.paddingTop) + pixel(imageStyle.paddingBottom) + pixel(imageStyle.borderTopWidth) + pixel(imageStyle.borderBottomWidth);
    const width = pixel(imageStyle.width) || rect.width / metrics.scaleX;
    const height = pixel(imageStyle.height) || rect.height / metrics.scaleY;
    const alreadyPositioned = element.parentElement === cell && imageStyle.position === "absolute";
    return { element, cell, metrics, width: width + extraWidth, height: height + extraHeight,
      cssWidth: width, cssHeight: height,
      left: alreadyPositioned ? pixel(imageStyle.left) : (rect.left - metrics.rect.left) / metrics.scaleX - cell.clientLeft,
      top: alreadyPositioned ? pixel(imageStyle.top) : (rect.top - metrics.rect.top) / metrics.scaleY - cell.clientTop,
      paddingLeft: pixel(style.paddingLeft), paddingRight: pixel(style.paddingRight),
      paddingTop: pixel(style.paddingTop), paddingBottom: pixel(style.paddingBottom),
      cellHeight: style.height,
    };
  });
  const rows = new Map();
  items.forEach(({ cell }) => {
    for (const row of cell.closest("table").rows) rows.set(row, getComputedStyle(row).height);
  });
  rows.forEach((height, row) => { row.style.height = height; });

  items.forEach(item => {
    const { cell, element, metrics, width, height } = item;
    cell.style.height = item.cellHeight;
    if (getComputedStyle(cell).position === "static") cell.style.position = "relative";
    const minX = item.paddingLeft;
    const minY = item.paddingTop;
    const maxX = Math.max(minX, metrics.width - item.paddingRight - width);
    const maxY = Math.max(minY, metrics.height - item.paddingBottom - height);
    let left = Math.max(minX, Math.min(maxX, item.left));
    let top = Math.max(minY, Math.min(maxY, item.top));
    if (alignment === "left") left = minX;
    if (alignment === "center-x") left = (minX + maxX) / 2;
    if (alignment === "right") left = maxX;
    if (alignment === "top") top = minY;
    if (alignment === "center-y") top = (minY + maxY) / 2;
    if (alignment === "bottom") top = maxY;
    Object.assign(element.style, { position: "absolute", width: `${item.cssWidth}px`, height: `${item.cssHeight}px`,
      left: `${left}px`, top: `${top}px`, margin: "0", zIndex: "2" });
    element.classList.add("is-floating-object");
    if (element.parentElement !== cell) cell.append(element);
  });
  return true;
}
