import { templateEditorObjectMinimumSize } from "./object-toolbar-constants.js";

export function parseObjectAlignmentPixelValue(value, fallback = 0) {
  const numericValue = Number.parseFloat(String(value || "").trim());

  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function roundObjectAlignmentValue(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function clampObjectAlignmentValue(value, maximum) {
  const rawMaximum = Math.max(0, Number(maximum) || 0);
  // Fractional table borders and browser sub-pixel layout can leave a false
  // movement range even when an object fills the document width or height.
  const safeMaximum = rawMaximum <= 1 ? 0 : rawMaximum;

  return Math.min(safeMaximum, Math.max(0, roundObjectAlignmentValue(value)));
}

export function getObjectAlignmentDocumentElement(surfaceElement) {
  return surfaceElement?.querySelector?.(".template-doc") || surfaceElement || null;
}

export function getObjectAlignmentPositioningElement(element, surfaceElement) {
  const modalElement = getObjectCandidateBlockModalElement(element, surfaceElement);

  return modalElement || getObjectAlignmentDocumentElement(surfaceElement);
}

export function getObjectAlignmentOverlayContainer(element, surfaceElement) {
  const modalElement = getObjectCandidateBlockModalElement(element, surfaceElement);

  if (modalElement) {
    return modalElement.closest?.("[data-candidate-block-focus-layer]") ||
      modalElement.closest?.(".examlist-candidate-block-modal-editor-viewport") ||
      modalElement.parentElement ||
      modalElement;
  }

  return getObjectAlignmentDocumentElement(surfaceElement);
}

export function isObjectEditorReadOnly(surfaceElement) {
  return surfaceElement?.getAttribute?.("contenteditable") === "false" || surfaceElement?.classList?.contains("readonly");
}

function getObjectFinitePixelValue(value) {
  const numericValue = Number.parseFloat(String(value || "").trim());

  return Number.isFinite(numericValue) ? numericValue : 0;
}

function getObjectExplicitPixelValue(value) {
  const normalizedValue = String(value || "").trim();

  if (!/^-?\d+(?:\.\d+)?px$/i.test(normalizedValue)) {
    return 0;
  }

  const numericValue = Number.parseFloat(normalizedValue);

  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function getObjectCandidateBlockModalElement(element, surfaceElement) {
  const modalElement = element?.closest?.("[data-candidate-block-modal-editor-surface]") || null;

  return modalElement instanceof HTMLElement && surfaceElement?.contains?.(modalElement)
    ? modalElement
    : null;
}

export function getObjectCandidateBlockVisualScale(element) {
  const blockElement = element?.closest?.("[data-candidate-block-instance].is-candidate-block-focus-editor") || null;

  if (!(blockElement instanceof HTMLElement)) {
    return { x: 1, y: 1 };
  }

  const blockRect = blockElement.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(blockElement);
  const cssScale = getObjectFinitePixelValue(
    computedStyle.getPropertyValue("--examlist-candidate-block-focus-editor-scale") ||
      computedStyle.getPropertyValue("--examlist-candidate-block-focus-scale"),
  );
  const logicalWidth =
    getObjectFinitePixelValue(blockElement.dataset?.candidateBlockLogicalWidth) ||
    blockElement.offsetWidth ||
    blockElement.clientWidth ||
    (cssScale > 0 ? blockRect.width / cssScale : 0) ||
    blockRect.width ||
    0;
  const logicalHeight =
    getObjectFinitePixelValue(blockElement.dataset?.candidateBlockLogicalHeight) ||
    blockElement.offsetHeight ||
    blockElement.clientHeight ||
    (cssScale > 0 ? blockRect.height / cssScale : 0) ||
    blockRect.height ||
    0;

  return {
    x: Math.max(logicalWidth > 0 && blockRect.width > 0 ? blockRect.width / logicalWidth : cssScale || 1, 0.01),
    y: Math.max(logicalHeight > 0 && blockRect.height > 0 ? blockRect.height / logicalHeight : cssScale || 1, 0.01),
  };
}

export function getObjectAlignmentCanvasMetrics(documentElement) {
  const rect = documentElement.getBoundingClientRect();
  const width = documentElement.clientWidth || rect.width || 0;
  const height = documentElement.clientHeight || rect.height || 0;
  // getBoundingClientRect includes the rendered border box while clientWidth /
  // clientHeight describe the inner editing area. Dividing those values makes
  // the document border look like a canvas transform and creates a 1-2px false
  // movement range for full-width objects. offsetWidth/offsetHeight represent
  // the matching logical border box, so their ratio isolates the real zoom.
  const borderBoxWidth = documentElement.offsetWidth || width;
  const borderBoxHeight = documentElement.offsetHeight || height;
  const scaleX = borderBoxWidth > 0 && rect.width > 0 ? rect.width / borderBoxWidth : 1;
  const scaleY = borderBoxHeight > 0 && rect.height > 0 ? rect.height / borderBoxHeight : 1;

  return {
    height,
    rect,
    scaleX: Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1,
    scaleY: Number.isFinite(scaleY) && scaleY > 0 ? scaleY : 1,
    width,
  };
}

export function getObjectAlignmentImageElements(surfaceElement) {
  if (!surfaceElement?.querySelectorAll) {
    return [];
  }

  return Array.from(
    new Set([
      ...surfaceElement.querySelectorAll("img.template-editor-image-object"),
      ...surfaceElement.querySelectorAll("img.template-generated-object"),
      ...surfaceElement.querySelectorAll("img.is-selected-object"),
    ]),
  ).filter((element) => element instanceof HTMLImageElement && surfaceElement.contains(element));
}

export function isObjectAlignmentTableElement(element, surfaceElement) {
  const isDocumentTable = Boolean(
    element?.closest?.(".template-doc") &&
      !element.closest?.("[data-candidate-block-instance]"),
  );
  const isCandidateBlockModalTable = Boolean(getObjectCandidateBlockModalElement(element, surfaceElement));

  return Boolean(
    element instanceof HTMLTableElement &&
      surfaceElement?.contains?.(element) &&
      (isDocumentTable || isCandidateBlockModalTable) &&
      !element.closest?.("td, th"),
  );
}

export function getObjectAlignmentTableElements(surfaceElement) {
  if (!surfaceElement?.querySelectorAll) {
    return [];
  }

  return Array.from(
    new Set([
      ...surfaceElement.querySelectorAll(".template-doc table"),
      ...surfaceElement.querySelectorAll("[data-candidate-block-modal-editor-surface] table"),
      ...surfaceElement.querySelectorAll("table.is-selected-table-object"),
      ...surfaceElement.querySelectorAll("table.is-selected-object"),
    ]),
  ).filter((element) => isObjectAlignmentTableElement(element, surfaceElement));
}

export function isObjectAlignmentElement(element, surfaceElement) {
  return (
    (element instanceof HTMLImageElement && getObjectAlignmentImageElements(surfaceElement).includes(element)) ||
    isObjectAlignmentTableElement(element, surfaceElement)
  );
}

export function getObjectAlignmentElements(surfaceElement) {
  return Array.from(
    new Set([
      ...getObjectAlignmentImageElements(surfaceElement),
      ...getObjectAlignmentTableElements(surfaceElement),
    ]),
  );
}

export function getSelectedObjectAlignmentElements(surfaceElement) {
  if (!surfaceElement?.querySelectorAll) {
    return [];
  }

  return getObjectAlignmentElements(surfaceElement).filter((element) =>
    element.classList.contains("is-selected-object") ||
      element.classList.contains("is-selected-table-object"),
  );
}

function getObjectAlignmentTableBorderEventTarget(event, surfaceElement) {
  if (!surfaceElement?.querySelectorAll || !event) {
    return null;
  }

  const eventX = Number(event.clientX);
  const eventY = Number(event.clientY);

  if (!Number.isFinite(eventX) || !Number.isFinite(eventY)) {
    return null;
  }

  const hitSlop = 8;
  let closestTableElement = null;
  let closestDistance = Infinity;

  getObjectAlignmentTableElements(surfaceElement).forEach((tableElement) => {
    const rect = tableElement.getBoundingClientRect();

    if (rect.width < 1 || rect.height < 1) {
      return;
    }

    const distances = [];

    if (
      eventX < rect.left &&
      eventX >= rect.left - hitSlop &&
      eventY >= rect.top - hitSlop &&
      eventY <= rect.bottom + hitSlop
    ) {
      distances.push(rect.left - eventX);
    }

    if (
      eventX > rect.right &&
      eventX <= rect.right + hitSlop &&
      eventY >= rect.top - hitSlop &&
      eventY <= rect.bottom + hitSlop
    ) {
      distances.push(eventX - rect.right);
    }

    if (
      eventY < rect.top &&
      eventY >= rect.top - hitSlop &&
      eventX >= rect.left - hitSlop &&
      eventX <= rect.right + hitSlop
    ) {
      distances.push(rect.top - eventY);
    }

    if (
      eventY > rect.bottom &&
      eventY <= rect.bottom + hitSlop &&
      eventX >= rect.left - hitSlop &&
      eventX <= rect.right + hitSlop
    ) {
      distances.push(eventY - rect.bottom);
    }

    if (!distances.length) {
      if (getObjectCandidateBlockModalElement(tableElement, surfaceElement)) {
        const insideHitSlop = Math.min(hitSlop, Math.max(2, Math.min(rect.width, rect.height) / 4));

        if (eventX >= rect.left && eventX <= rect.right && eventY >= rect.top && eventY <= rect.bottom) {
          const insideEdgeDistance = Math.min(
            eventX - rect.left,
            rect.right - eventX,
            eventY - rect.top,
            rect.bottom - eventY,
          );

          if (insideEdgeDistance <= insideHitSlop) {
            distances.push(insideEdgeDistance);
          }
        }
      }
    }

    if (!distances.length) {
      return;
    }

    const distance = Math.min(...distances);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestTableElement = tableElement;
    }
  });

  return closestTableElement;
}

export function getObjectAlignmentEventTarget(target, surfaceElement, event = null) {
  const baseElement = target instanceof Element
    ? target
    : target?.parentElement instanceof Element
      ? target.parentElement
      : null;

  if (!baseElement || !surfaceElement?.contains?.(baseElement)) {
    return null;
  }

  const tableOverlayElement = baseElement.closest(".template-editor-table-selection");
  const overlayTableElement = tableOverlayElement?.__templateEditorTableElement || null;

  if (isObjectAlignmentTableElement(overlayTableElement, surfaceElement)) {
    return overlayTableElement;
  }

  const imageElement = baseElement.closest("img.template-editor-image-object, img.template-generated-object");

  if (imageElement instanceof HTMLImageElement && getObjectAlignmentImageElements(surfaceElement).includes(imageElement)) {
    return imageElement;
  }

  return getObjectAlignmentTableBorderEventTarget(event, surfaceElement);
}

export function getObjectTableCellElement(element, surfaceElement) {
  const cellElement = element?.closest?.("td, th") || null;

  return cellElement instanceof HTMLElement && surfaceElement?.contains?.(cellElement)
    ? cellElement
    : null;
}

export function getObjectTableCellContentSize(element, surfaceElement, minimumSize = templateEditorObjectMinimumSize) {
  const cellElement = getObjectTableCellElement(element, surfaceElement);

  if (!(cellElement instanceof HTMLElement)) {
    return null;
  }

  const computedStyle = window.getComputedStyle(cellElement);
  const cellRect = cellElement.getBoundingClientRect();
  const visualScale = getObjectCandidateBlockVisualScale(cellElement);
  const scaleX = Math.max(visualScale.x || 1, 0.01);
  const scaleY = Math.max(visualScale.y || 1, 0.01);
  const paddingLeft = getObjectFinitePixelValue(computedStyle.paddingLeft);
  const paddingRight = getObjectFinitePixelValue(computedStyle.paddingRight);
  const paddingTop = getObjectFinitePixelValue(computedStyle.paddingTop);
  const paddingBottom = getObjectFinitePixelValue(computedStyle.paddingBottom);
  const borderLeft = getObjectFinitePixelValue(computedStyle.borderLeftWidth);
  const borderRight = getObjectFinitePixelValue(computedStyle.borderRightWidth);
  const borderTop = getObjectFinitePixelValue(computedStyle.borderTopWidth);
  const borderBottom = getObjectFinitePixelValue(computedStyle.borderBottomWidth);
  const width = Math.max(
    minimumSize,
    Math.floor(
      Math.max(
        cellElement.clientWidth - paddingLeft - paddingRight,
        cellRect.width / scaleX - paddingLeft - paddingRight - borderLeft - borderRight,
        0,
      ),
    ),
  );
  const height = Math.max(
    minimumSize,
    Math.floor(
      Math.max(
        cellElement.clientHeight - paddingTop - paddingBottom,
        cellRect.height / scaleY - paddingTop - paddingBottom - borderTop - borderBottom,
        0,
      ),
    ),
  );

  return {
    height,
    width,
  };
}

export function getObjectElementSize(element, surfaceElement) {
  const documentElement = getObjectAlignmentDocumentElement(surfaceElement);

  if (!(element instanceof HTMLElement) || !(documentElement instanceof HTMLElement)) {
    return {
      height: 0,
      width: 0,
    };
  }

  const canvasMetrics = getObjectAlignmentCanvasMetrics(documentElement);
  const candidateBlockScale = getObjectCandidateBlockVisualScale(element);
  const scaleX = getObjectCandidateBlockModalElement(element, surfaceElement) ? candidateBlockScale.x : canvasMetrics.scaleX;
  const scaleY = getObjectCandidateBlockModalElement(element, surfaceElement) ? candidateBlockScale.y : canvasMetrics.scaleY;
  const objectRect = element.getBoundingClientRect();
  const inlineWidth = element instanceof HTMLTableElement ? getObjectExplicitPixelValue(element.style.width) : 0;
  const inlineHeight = element instanceof HTMLTableElement ? getObjectExplicitPixelValue(element.style.height) : 0;
  const width = inlineWidth ||
    roundObjectAlignmentValue(objectRect.width / Math.max(scaleX || 1, 0.01)) ||
    parseObjectAlignmentPixelValue(element.style.width, element.offsetWidth || 0);
  const height = inlineHeight ||
    roundObjectAlignmentValue(objectRect.height / Math.max(scaleY || 1, 0.01)) ||
    parseObjectAlignmentPixelValue(element.style.height, element.offsetHeight || 0);

  return {
    height: Math.max(templateEditorObjectMinimumSize, Math.round(height || templateEditorObjectMinimumSize)),
    width: Math.max(templateEditorObjectMinimumSize, Math.round(width || templateEditorObjectMinimumSize)),
  };
}

export function syncObjectAlignmentTableFlow(element, surfaceElement, geometry = {}) {
  if (!element?.matches?.("table, img, [data-candidate-block-grid]") || String(element.style.position || "") !== "absolute") {
    return null;
  }

  const documentElement = getObjectAlignmentDocumentElement(surfaceElement);
  const flowReflow = window.ExamListTemplateEditorObjectFlowReflow;

  if (!(documentElement instanceof HTMLElement) || typeof flowReflow?.reflowTemplateEditorObjectRows !== "function") {
    return null;
  }

  const size = getObjectElementSize(element, surfaceElement);
  const top = Number.isFinite(Number(geometry.top))
    ? Number(geometry.top)
    : parseObjectAlignmentPixelValue(element.style.top, element.offsetTop || 0);

  return flowReflow.reflowTemplateEditorObjectRows(element, {
    activeHeight: Number.isFinite(Number(geometry.height)) ? Number(geometry.height) : size.height,
    activeTop: top,
    documentElement,
    minimumHeight: templateEditorObjectMinimumSize,
    movementY: Number.isFinite(Number(geometry.movementY)) ? Number(geometry.movementY) : 0,
    reorderByPosition: geometry.reorderByPosition ?? Math.abs(Number(geometry.movementY) || 0) > 0.5,
    strictGeometry: Number.isFinite(Number(geometry.height)) && Number.isFinite(Number(geometry.top)),
  });
}
