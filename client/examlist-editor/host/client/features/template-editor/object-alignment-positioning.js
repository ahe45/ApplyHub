import {
  clampObjectAlignmentValue,
  parseObjectAlignmentPixelValue,
  roundObjectAlignmentValue,
  syncObjectAlignmentTableFlow,
} from "./object-alignment-metrics.js";

function measureObjectAlignmentItem(element, documentElement, canvasMetrics) {
  if (!(element instanceof HTMLElement) || !(documentElement instanceof HTMLElement)) {
    return null;
  }

  const objectRect = element.getBoundingClientRect();
  const width = Math.max(
    1,
    roundObjectAlignmentValue(objectRect.width / canvasMetrics.scaleX) ||
      parseObjectAlignmentPixelValue(element.style.width, element.offsetWidth || 1),
  );
  const height = Math.max(
    1,
    roundObjectAlignmentValue(objectRect.height / canvasMetrics.scaleY) ||
      parseObjectAlignmentPixelValue(element.style.height, element.offsetHeight || 1),
  );
  const isAbsoluteChild = element.parentElement === documentElement && element.style.position === "absolute";
  const left = isAbsoluteChild
    ? clampObjectAlignmentValue(
        parseObjectAlignmentPixelValue(element.style.left, element.offsetLeft),
        canvasMetrics.width - width,
      )
    : clampObjectAlignmentValue(
        (objectRect.left - canvasMetrics.rect.left) / canvasMetrics.scaleX,
        canvasMetrics.width - width,
      );
  const top = isAbsoluteChild
    ? clampObjectAlignmentValue(
        parseObjectAlignmentPixelValue(element.style.top, element.offsetTop),
        canvasMetrics.height - height,
      )
    : clampObjectAlignmentValue(
        (objectRect.top - canvasMetrics.rect.top) / canvasMetrics.scaleY,
        canvasMetrics.height - height,
      );

  return {
    documentElement,
    element,
    height,
    isAbsoluteChild,
    left,
    top,
    width,
  };
}

function applyObjectAlignmentItemMetrics(metrics) {
  if (!metrics) {
    return null;
  }

  const {
    documentElement,
    element,
    height,
    isAbsoluteChild,
    left,
    top,
    width,
  } = metrics;

  if (!isAbsoluteChild) {
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    element.style.position = "absolute";
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
    element.style.margin = "0";
    element.style.zIndex = "2";
    if (element.parentElement !== documentElement) {
      let host = element.parentElement;
      while (host?.parentElement && host.parentElement !== documentElement) host = host.parentElement;
      documentElement.insertBefore(element, host?.parentElement === documentElement ? host.nextSibling : null);
    }
  }

  element.classList.add("is-floating-object");

  return {
    documentElement,
    element,
    height,
    left,
    top,
    width,
  };
}

export function prepareObjectAlignmentItem(element, documentElement, canvasMetrics) {
  return applyObjectAlignmentItemMetrics(measureObjectAlignmentItem(element, documentElement, canvasMetrics));
}

export function prepareObjectAlignmentItems(elements, documentElement, canvasMetrics) {
  return Array.from(elements || [])
    .map((element) => measureObjectAlignmentItem(element, documentElement, canvasMetrics))
    .filter(Boolean)
    .map((metrics) => applyObjectAlignmentItemMetrics(metrics))
    .filter(Boolean);
}

export function setObjectAlignmentItemPosition(item, left, top, canvasMetrics, options = {}) {
  const previousTop = item.top;
  const nextLeft = clampObjectAlignmentValue(left, canvasMetrics.width - item.width);
  const nextTop = clampObjectAlignmentValue(top, canvasMetrics.height - item.height);

  item.left = nextLeft;
  item.top = nextTop;
  item.element.style.left = `${nextLeft}px`;
  item.element.style.top = `${nextTop}px`;

  if (options.syncFlow !== false) {
    syncObjectAlignmentTableFlow(item.element, item.documentElement, {
      height: item.height,
      movementY: Number.isFinite(Number(options.movementY)) ? Number(options.movementY) : nextTop - previousTop,
      reorderByPosition: options.reorderByPosition,
      top: nextTop,
    });
  }
}

function syncObjectAlignmentItemsFlow(items, options = {}) {
  const sortedItems = [...items]
    .sort((leftItem, rightItem) => leftItem.top - rightItem.top || leftItem.left - rightItem.left);

  sortedItems.forEach((item) => {
    syncObjectAlignmentTableFlow(item.element, item.documentElement, {
      height: item.height,
      movementY: 0,
      reorderByPosition: options.reorderByPosition === true,
      top: item.top,
    });
  });

  if (options.reorderByPosition === true) {
    sortedItems.forEach((item) => {
      syncObjectAlignmentTableFlow(item.element, item.documentElement, {
        height: item.height,
        movementY: 0,
        top: item.top,
      });
    });
  }
}

function getObjectAlignmentBounds(items) {
  const left = Math.min(...items.map((item) => item.left));
  const top = Math.min(...items.map((item) => item.top));
  const right = Math.max(...items.map((item) => item.left + item.width));
  const bottom = Math.max(...items.map((item) => item.top + item.height));

  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  };
}

export function alignObjectsToCanvas(items, command, canvasMetrics) {
  items.forEach((item) => {
    let nextLeft = item.left;
    let nextTop = item.top;

    if (command === "canvas-left") {
      nextLeft = 0;
    } else if (command === "canvas-center-x") {
      nextLeft = (canvasMetrics.width - item.width) / 2;
    } else if (command === "canvas-right") {
      nextLeft = canvasMetrics.width - item.width;
    } else if (command === "canvas-top") {
      nextTop = 0;
    } else if (command === "canvas-center-y") {
      nextTop = (canvasMetrics.height - item.height) / 2;
    } else if (command === "canvas-bottom") {
      nextTop = canvasMetrics.height - item.height;
    }

    setObjectAlignmentItemPosition(item, nextLeft, nextTop, canvasMetrics);
  });
}

export function alignObjectsToSelection(items, command, canvasMetrics) {
  const bounds = getObjectAlignmentBounds(items);

  items.forEach((item) => {
    let nextLeft = item.left;
    let nextTop = item.top;

    if (command === "selection-left") {
      nextLeft = bounds.left;
    } else if (command === "selection-center-x") {
      nextLeft = bounds.left + bounds.width / 2 - item.width / 2;
    } else if (command === "selection-right") {
      nextLeft = bounds.right - item.width;
    } else if (command === "selection-top") {
      nextTop = bounds.top;
    } else if (command === "selection-center-y") {
      nextTop = bounds.top + bounds.height / 2 - item.height / 2;
    } else if (command === "selection-bottom") {
      nextTop = bounds.bottom - item.height;
    }

    setObjectAlignmentItemPosition(item, nextLeft, nextTop, canvasMetrics);
  });
}

export function distributeObjectAlignmentItems(items, axis, canvasMetrics) {
  const sortedItems = [...items].sort((leftItem, rightItem) =>
    axis === "x"
      ? leftItem.left - rightItem.left || leftItem.top - rightItem.top
      : leftItem.top - rightItem.top || leftItem.left - rightItem.left,
  );
  const bounds = getObjectAlignmentBounds(sortedItems);
  const totalSize = sortedItems.reduce((sum, item) => sum + (axis === "x" ? item.width : item.height), 0);
  const gap = (axis === "x" ? bounds.width : bounds.height) - totalSize;
  let cursor = axis === "x" ? bounds.left : bounds.top;
  const itemGap = Math.max(0, gap / Math.max(1, sortedItems.length - 1));

  sortedItems.forEach((item) => {
    if (axis === "x") {
      setObjectAlignmentItemPosition(item, cursor, item.top, canvasMetrics, { syncFlow: false });
      cursor += item.width + itemGap;
    } else {
      setObjectAlignmentItemPosition(item, item.left, cursor, canvasMetrics, { syncFlow: false });
      cursor += item.height + itemGap;
    }
  });
  syncObjectAlignmentItemsFlow(sortedItems, { reorderByPosition: true });
}

export function resolveObjectAlignmentCommand(command, selectedCount) {
  const normalizedCommand = String(command || "");

  if (!normalizedCommand.startsWith("align-")) {
    return normalizedCommand;
  }

  const alignmentName = normalizedCommand.replace(/^align-/, "");

  return selectedCount > 1 ? `selection-${alignmentName}` : `canvas-${alignmentName}`;
}
