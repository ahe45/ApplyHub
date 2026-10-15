import {
  getObjectAlignmentCanvasMetrics,
  getObjectAlignmentDocumentElement,
  getObjectAlignmentOverlayContainer,
  getObjectAlignmentPositioningElement,
  getObjectCandidateBlockModalElement,
  getObjectElementSize,
  getObjectTableCellElement,
  getSelectedObjectAlignmentElements,
  isObjectAlignmentElement,
  isObjectAlignmentTableElement,
  prepareObjectAlignmentItems,
  setObjectAlignmentItemPosition,
  syncObjectAlignmentMutation,
  syncObjectAlignmentTableFlow,
} from "./object-alignment-runtime.js";
import { applyObjectTableSize } from "./object-size-controls.js";
import { templateEditorObjectMinimumSize } from "./object-toolbar-constants.js";

const objectResizeCorners = Object.freeze([
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
  "top-left",
  "top",
  "top-right",
  "right",
]);

const objectResizeDirections = Object.freeze({
  "bottom": Object.freeze({ x: 0, y: 1 }),
  "bottom-left": Object.freeze({ x: -1, y: 1 }),
  "bottom-right": Object.freeze({ x: 1, y: 1 }),
  "left": Object.freeze({ x: -1, y: 0 }),
  "right": Object.freeze({ x: 1, y: 0 }),
  "top": Object.freeze({ x: 0, y: -1 }),
  "top-left": Object.freeze({ x: -1, y: -1 }),
  "top-right": Object.freeze({ x: 1, y: -1 }),
});

function normalizeObjectResizeCorner(value) {
  const corner = String(value || "").trim();

  return objectResizeDirections[corner] ? corner : "bottom-right";
}

function isObjectSelectionOverlayElement(element, surfaceElement) {
  if (!isObjectAlignmentElement(element, surfaceElement)) {
    return false;
  }

  const cellElement = getObjectTableCellElement(element, surfaceElement);

  return !cellElement || Boolean(getObjectCandidateBlockModalElement(element, surfaceElement));
}

function getSelectedObjectSelectionOverlayElements(surfaceElement) {
  return getSelectedObjectAlignmentElements(surfaceElement).filter((element) =>
    isObjectSelectionOverlayElement(element, surfaceElement),
  );
}

function createObjectSelectionOverlay(ownerDocument) {
  const overlayElement = ownerDocument.createElement("div");

  overlayElement.className = "examlist-object-selection";
  overlayElement.dataset.examlistObjectSelectionOverlay = "true";
  overlayElement.setAttribute("aria-hidden", "true");
  overlayElement.setAttribute("contenteditable", "false");

  objectResizeCorners.forEach((corner) => {
    const handleElement = ownerDocument.createElement("button");

    handleElement.className = "examlist-object-resize-handle";
    handleElement.dataset.examlistObjectResizeHandle = "true";
    handleElement.dataset.examlistObjectResizeCorner = corner;
    handleElement.type = "button";
    handleElement.tabIndex = -1;
    handleElement.title = "개체 크기 조절";
    handleElement.setAttribute("aria-label", "개체 크기 조절");
    handleElement.setAttribute("contenteditable", "false");
    overlayElement.append(handleElement);
  });

  return overlayElement;
}

function getOverlayContainerBox(containerElement) {
  const rect = containerElement.getBoundingClientRect();
  const logicalWidth = containerElement.offsetWidth || containerElement.clientWidth || rect.width || 0;
  const logicalHeight = containerElement.offsetHeight || containerElement.clientHeight || rect.height || 0;
  const scaleX = logicalWidth > 0 && rect.width > 0 ? rect.width / logicalWidth : 1;
  const scaleY = logicalHeight > 0 && rect.height > 0 ? rect.height / logicalHeight : 1;

  return {
    originLeft: rect.left + (containerElement.clientLeft || 0) * Math.max(scaleX || 1, 0.01),
    originTop: rect.top + (containerElement.clientTop || 0) * Math.max(scaleY || 1, 0.01),
    scaleX: Math.max(scaleX || 1, 0.01),
    scaleY: Math.max(scaleY || 1, 0.01),
  };
}

function syncOverlayToElement(overlayElement, containerElement, objectElement) {
  const objectRect = objectElement.getBoundingClientRect();
  const containerBox = getOverlayContainerBox(containerElement);

  if (objectRect.width < 1 || objectRect.height < 1) {
    overlayElement.classList.add("hidden");
    return;
  }

  overlayElement.style.left = `${Math.round((objectRect.left - containerBox.originLeft) / containerBox.scaleX)}px`;
  overlayElement.style.top = `${Math.round((objectRect.top - containerBox.originTop) / containerBox.scaleY)}px`;
  overlayElement.style.width = `${Math.round(objectRect.width / containerBox.scaleX)}px`;
  overlayElement.style.height = `${Math.round(objectRect.height / containerBox.scaleY)}px`;
  overlayElement.classList.remove("hidden");
}

function getObjectResizeMaximumSize(item, direction, canvasMetrics) {
  const maxWidth = direction.x < 0
    ? item.left + item.width
    : direction.x > 0
      ? canvasMetrics.width - item.left
      : item.width;
  const maxHeight = direction.y < 0
    ? item.top + item.height
    : direction.y > 0
      ? canvasMetrics.height - item.top
      : item.height;

  return {
    height: Math.max(templateEditorObjectMinimumSize, Math.round(maxHeight) || templateEditorObjectMinimumSize),
    width: Math.max(templateEditorObjectMinimumSize, Math.round(maxWidth) || templateEditorObjectMinimumSize),
  };
}

function applyObjectResizeItemSize(item, surfaceElement, canvasMetrics, session, targetSize) {
  const hasWidth = session.direction.x !== 0 && Number.isFinite(targetSize.width);
  const hasHeight = session.direction.y !== 0 && Number.isFinite(targetSize.height);
  const previousLeft = item.left;
  const previousTop = item.top;
  const previousWidth = item.width;
  const previousHeight = item.height;

  if (isObjectAlignmentTableElement(item.element, surfaceElement)) {
    applyObjectTableSize(item.element, {
      height: hasHeight ? targetSize.height : null,
      width: hasWidth ? targetSize.width : null,
    });
  } else {
    const nextWidth = hasWidth ? targetSize.width : item.startWidth;
    const nextHeight = hasHeight ? targetSize.height : item.startHeight;

    item.element.style.width = `${Math.max(templateEditorObjectMinimumSize, Math.round(nextWidth))}px`;
    item.element.style.height = `${Math.max(templateEditorObjectMinimumSize, Math.round(nextHeight))}px`;
  }

  const actualSize = getObjectElementSize(item.element, surfaceElement);

  item.width = hasWidth ? actualSize.width : item.startWidth;
  item.height = hasHeight ? actualSize.height : item.startHeight;

  const nextLeft = hasWidth && session.direction.x < 0
    ? item.startLeft + item.startWidth - item.width
    : item.startLeft;
  const nextTop = hasHeight && session.direction.y < 0
    ? item.startTop + item.startHeight - item.height
    : item.startTop;

  setObjectAlignmentItemPosition(item, nextLeft, nextTop, canvasMetrics, { syncFlow: false });
  syncObjectAlignmentTableFlow(item.element, surfaceElement, {
    height: item.height,
    top: item.top,
  });

  return (
    previousLeft !== item.left ||
      previousTop !== item.top ||
      previousWidth !== item.width ||
      previousHeight !== item.height
  );
}

export function bindObjectMultiSelectionOverlays({ editor, surfaceElement }) {
  if (!editor || !surfaceElement) {
    return null;
  }

  const overlaysByElement = new Map();
  let resizeSession = null;
  let updateFrame = 0;

  const getOverlayContainer = (objectElement = null) =>
    objectElement
      ? getObjectAlignmentOverlayContainer(objectElement, surfaceElement)
      : getObjectAlignmentDocumentElement(surfaceElement);

  const removeOverlay = (overlayElement) => {
    overlayElement?.remove();
  };

  const clearOverlays = () => {
    overlaysByElement.forEach(removeOverlay);
    overlaysByElement.clear();
  };

  const ensureOverlay = (objectElement, containerElement) => {
    let overlayElement = overlaysByElement.get(objectElement);

    if (!overlayElement) {
      overlayElement = createObjectSelectionOverlay(containerElement.ownerDocument || document);
      overlayElement.__examlistObjectElement = objectElement;
      overlaysByElement.set(objectElement, overlayElement);
    }

    if (!containerElement.contains(overlayElement)) {
      containerElement.append(overlayElement);
    }

    overlayElement.__examlistObjectElement = objectElement;
    overlayElement.classList.toggle(
      "is-cell-contained-object",
      Boolean(getObjectTableCellElement(objectElement, surfaceElement)),
    );
    return overlayElement;
  };

  const updateOverlays = () => {
    updateFrame = 0;

    if (resizeSession) {
      resizeSession.items.forEach((item) => {
        const overlayElement = overlaysByElement.get(item.element);
        const containerElement = getOverlayContainer(item.element);

        if (overlayElement && containerElement instanceof HTMLElement) {
          syncOverlayToElement(overlayElement, containerElement, item.element);
        }
      });
      return;
    }

    const selectedElements = getSelectedObjectSelectionOverlayElements(surfaceElement);

    if (selectedElements.length < 2) {
      clearOverlays();
      return;
    }

    const selectedSet = new Set(selectedElements);
    const hasCellContainedSelection = selectedElements.some((element) => getObjectTableCellElement(element, surfaceElement));

    overlaysByElement.forEach((overlayElement, objectElement) => {
      if (!selectedSet.has(objectElement) || !objectElement.isConnected) {
        removeOverlay(overlayElement);
        overlaysByElement.delete(objectElement);
      }
    });

    selectedElements.forEach((objectElement) => {
      const containerElement = getOverlayContainer(objectElement);

      if (!(containerElement instanceof HTMLElement)) {
        return;
      }

      const overlayElement = ensureOverlay(objectElement, containerElement);

      overlayElement.classList.toggle("is-group-resize-disabled", hasCellContainedSelection);
      syncOverlayToElement(overlayElement, containerElement, objectElement);
    });
  };

  const scheduleUpdate = () => {
    if (updateFrame) {
      return;
    }

    updateFrame = window.requestAnimationFrame(updateOverlays);
  };

  const startResizeSession = (event, handleElement) => {
    if (event.button !== 0) {
      return false;
    }

    const overlayElement = handleElement.closest("[data-examlist-object-selection-overlay]");
    const activeElement = overlayElement?.__examlistObjectElement || null;
    const selectedElements = getSelectedObjectSelectionOverlayElements(surfaceElement);

    if (
      !(activeElement instanceof HTMLElement) ||
      !selectedElements.includes(activeElement) ||
      selectedElements.length < 2 ||
      selectedElements.some((element) => getObjectTableCellElement(element, surfaceElement))
    ) {
      return false;
    }

    const documentElement = getObjectAlignmentPositioningElement(activeElement, surfaceElement);

    if (!(documentElement instanceof HTMLElement)) {
      return false;
    }

    const resizeElements = selectedElements.filter(
      (selectedElement) => getObjectAlignmentPositioningElement(selectedElement, surfaceElement) === documentElement,
    );

    if (resizeElements.length < 2) {
      return false;
    }

    const canvasMetrics = getObjectAlignmentCanvasMetrics(documentElement);
    const items = prepareObjectAlignmentItems(resizeElements, documentElement, canvasMetrics)
      .map((item) => ({
        ...item,
        startHeight: item.height,
        startLeft: item.left,
        startTop: item.top,
        startWidth: item.width,
      }));
    const activeItem = items.find((item) => item.element === activeElement) || items[0] || null;

    if (!activeItem) {
      return false;
    }

    const corner = normalizeObjectResizeCorner(handleElement.dataset.examlistObjectResizeCorner);
    const direction = objectResizeDirections[corner];

    items.forEach((item) => {
      const maximumSize = getObjectResizeMaximumSize(item, direction, canvasMetrics);

      item.maxHeight = maximumSize.height;
      item.maxWidth = maximumSize.width;
    });

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    resizeSession = {
      canvasMetrics,
      corner,
      didChange: false,
      direction,
      items,
      lastHeightDelta: 0,
      lastWidthDelta: 0,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };

    surfaceElement.classList.add("is-object-group-resizing", `is-object-group-resizing-${corner}`);
    overlaysByElement.forEach((selectionOverlay) => {
      selectionOverlay.classList.add("is-resizing");
    });

    try {
      handleElement.setPointerCapture?.(event.pointerId);
    } catch (_error) {
      // Synthetic pointer events used in smoke checks may not have an active capture target.
    }

    window.addEventListener("pointermove", handleResizeMove, true);
    window.addEventListener("pointerup", handleResizeEnd, true);
    window.addEventListener("pointercancel", handleResizeEnd, true);
    scheduleUpdate();
    return true;
  };

  const getResizeDelta = (event, session) => {
    const deltaX = (event.clientX - session.startX) / Math.max(session.canvasMetrics.scaleX || 1, 0.01);
    const deltaY = (event.clientY - session.startY) / Math.max(session.canvasMetrics.scaleY || 1, 0.01);

    return {
      height: session.direction.y === 0 ? null : Math.round(deltaY * session.direction.y),
      width: session.direction.x === 0 ? null : Math.round(deltaX * session.direction.x),
    };
  };

  const getResizeTargetSize = (item, session, resizeDelta) => {
    const hasWidth = Number.isFinite(resizeDelta.width);
    const hasHeight = Number.isFinite(resizeDelta.height);

    return {
      height: hasHeight
        ? Math.min(
            Math.max(templateEditorObjectMinimumSize, Math.round(item.maxHeight) || templateEditorObjectMinimumSize),
            Math.max(templateEditorObjectMinimumSize, Math.round(item.startHeight + resizeDelta.height)),
          )
        : null,
      width: hasWidth
        ? Math.min(
            Math.max(templateEditorObjectMinimumSize, Math.round(item.maxWidth) || templateEditorObjectMinimumSize),
            Math.max(templateEditorObjectMinimumSize, Math.round(item.startWidth + resizeDelta.width)),
          )
        : null,
    };
  };

  function handleResizeMove(event) {
    const session = resizeSession;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const resizeDelta = getResizeDelta(event, session);
    const nextWidthDelta = Number.isFinite(resizeDelta.width) ? resizeDelta.width : 0;
    const nextHeightDelta = Number.isFinite(resizeDelta.height) ? resizeDelta.height : 0;

    if (nextWidthDelta === session.lastWidthDelta && nextHeightDelta === session.lastHeightDelta) {
      return;
    }

    session.lastWidthDelta = nextWidthDelta;
    session.lastHeightDelta = nextHeightDelta;

    let didApplyChange = false;

    session.items.forEach((item) => {
      didApplyChange = applyObjectResizeItemSize(
        item,
        surfaceElement,
        session.canvasMetrics,
        session,
        getResizeTargetSize(item, session, resizeDelta),
      ) || didApplyChange;
    });

    if (didApplyChange) {
      session.didChange = true;
      scheduleUpdate();
    }
  }

  function handleResizeEnd(event) {
    const session = resizeSession;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    releaseResizeSession();
  }

  function releaseResizeSession() {
    const session = resizeSession;

    if (!session) {
      return;
    }

    window.removeEventListener("pointermove", handleResizeMove, true);
    window.removeEventListener("pointerup", handleResizeEnd, true);
    window.removeEventListener("pointercancel", handleResizeEnd, true);
    resizeSession = null;
    surfaceElement.classList.remove(
      "is-object-group-resizing",
      "is-object-group-resizing-top-left",
      "is-object-group-resizing-top",
      "is-object-group-resizing-top-right",
      "is-object-group-resizing-right",
      "is-object-group-resizing-bottom",
      "is-object-group-resizing-bottom-left",
      "is-object-group-resizing-bottom-right",
      "is-object-group-resizing-left",
    );
    overlaysByElement.forEach((selectionOverlay) => {
      selectionOverlay.classList.remove("is-resizing");
    });

    if (session.didChange) {
      const changedElements = session.items.map((item) => item.element);
      const modalSurfaceElements = Array.from(
        new Set(changedElements.map((element) => getObjectCandidateBlockModalElement(element, surfaceElement)).filter(Boolean)),
      );

      modalSurfaceElements.forEach((modalSurfaceElement) => {
        modalSurfaceElement.dispatchEvent(new Event("input", { bubbles: true }));
      });

      if (
        modalSurfaceElements.length &&
        typeof window.ExamListCandidateBlockModalEditor?.syncActiveEditor === "function"
      ) {
        window.ExamListCandidateBlockModalEditor.syncActiveEditor({ markDirty: true });
      }

      syncObjectAlignmentMutation(editor, surfaceElement, changedElements);
    }

    scheduleUpdate();
  }

  function handlePointerDown(event) {
    const target = event.target instanceof Element ? event.target : null;
    const handleElement = target?.closest?.("[data-examlist-object-resize-handle], .examlist-object-resize-handle") || null;

    if (!handleElement || !surfaceElement.contains(handleElement)) {
      return;
    }

    startResizeSession(event, handleElement);
  }

  surfaceElement.addEventListener("pointerdown", handlePointerDown, true);
  surfaceElement.addEventListener("input", scheduleUpdate);
  surfaceElement.addEventListener("keyup", scheduleUpdate);
  surfaceElement.addEventListener("scroll", scheduleUpdate);
  surfaceElement.addEventListener("template-editor-canvas-zoom-change", scheduleUpdate);
  document.addEventListener("selectionchange", scheduleUpdate);
  window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("scroll", scheduleUpdate, true);
  scheduleUpdate();

  return {
    dispose() {
      if (updateFrame) {
        window.cancelAnimationFrame(updateFrame);
        updateFrame = 0;
      }

      releaseResizeSession();
      if (updateFrame) {
        window.cancelAnimationFrame(updateFrame);
        updateFrame = 0;
      }

      clearOverlays();
      surfaceElement.removeEventListener("pointerdown", handlePointerDown, true);
      surfaceElement.removeEventListener("input", scheduleUpdate);
      surfaceElement.removeEventListener("keyup", scheduleUpdate);
      surfaceElement.removeEventListener("scroll", scheduleUpdate);
      surfaceElement.removeEventListener("template-editor-canvas-zoom-change", scheduleUpdate);
      document.removeEventListener("selectionchange", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
    },
    scheduleUpdate,
  };
}
