export const templateEditorCanvasZoomDefault = 1;
export const templateEditorCanvasZoomMin = 0.25;
export const templateEditorCanvasZoomMax = 3;
export const templateEditorCanvasZoomStep = 0.1;
export const templateEditorCanvasZoomModeFit = "fit";
export const templateEditorCanvasZoomModeManual = "manual";

function roundTemplateEditorCanvasZoom(value) {
  return Math.round((Number(value) || templateEditorCanvasZoomDefault) * 100) / 100;
}

function parseCanvasZoomNumber(value, fallback = templateEditorCanvasZoomDefault) {
  const numericValue = Number.parseFloat(String(value ?? "").trim());

  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback;
}

function parseCssPixelValue(value, fallback = 0) {
  const numericValue = Number.parseFloat(String(value || "").replace("px", "").trim());

  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function getDocumentRef() {
  return typeof document !== "undefined" ? document : null;
}

function getWindowRef() {
  return typeof window !== "undefined" ? window : null;
}

function getRequestAnimationFrame() {
  const windowRef = getWindowRef();

  return typeof windowRef?.requestAnimationFrame === "function"
    ? windowRef.requestAnimationFrame.bind(windowRef)
    : (callback) => callback();
}

export function normalizeTemplateEditorCanvasZoom(value, fallback = templateEditorCanvasZoomDefault) {
  const parsedValue = parseCanvasZoomNumber(value, fallback);

  return roundTemplateEditorCanvasZoom(
    Math.min(templateEditorCanvasZoomMax, Math.max(templateEditorCanvasZoomMin, parsedValue)),
  );
}

export function normalizeTemplateEditorCanvasZoomMode(value = "") {
  return String(value || "").trim() === templateEditorCanvasZoomModeFit
    ? templateEditorCanvasZoomModeFit
    : templateEditorCanvasZoomModeManual;
}

export function getTemplateEditorCanvasZoom(editorState = {}) {
  return normalizeTemplateEditorCanvasZoom(editorState?.canvasZoom, templateEditorCanvasZoomDefault);
}

export function getTemplateEditorCanvasZoomMode(editorState = {}) {
  return normalizeTemplateEditorCanvasZoomMode(editorState?.canvasZoomMode);
}

export function getTemplateEditorCanvasZoomPercentLabel(value) {
  return `${Math.round(normalizeTemplateEditorCanvasZoom(value) * 100)}%`;
}

export function getTemplateEditorCanvasElement(rootElement = null) {
  const root = rootElement || getDocumentRef();

  if (root?.matches?.("[data-template-editor-canvas], .template-editor-page")) {
    return root;
  }

  return root?.querySelector?.("[data-template-editor-canvas]") ||
    root?.querySelector?.(".template-editor-page") ||
    null;
}

function getTemplateEditorCanvasScaleBox(canvasElement) {
  return canvasElement?.querySelector?.("[data-template-editor-canvas-scale-box], .editor-paper-scale-box") || null;
}

function getTemplateEditorCanvasSurface(canvasElement) {
  return canvasElement?.querySelector?.("[data-editor-document-surface], [data-template-editor-runtime-surface]") || null;
}

function readCanvasElementZoom(canvasElement, appState = null) {
  const cssZoom = parseCanvasZoomNumber(
    canvasElement?.style?.getPropertyValue?.("--template-editor-canvas-zoom"),
    0,
  );

  if (cssZoom > 0) {
    return normalizeTemplateEditorCanvasZoom(cssZoom);
  }

  const dataZoom = parseCanvasZoomNumber(canvasElement?.dataset?.templateEditorCanvasZoom, 0);

  if (dataZoom > 0) {
    return normalizeTemplateEditorCanvasZoom(dataZoom);
  }

  return getTemplateEditorCanvasZoom(appState?.templateEditor || {});
}

function writeTemplateEditorCanvasZoomState(appState, zoom, mode) {
  if (!appState?.templateEditor) {
    return;
  }

  appState.templateEditor.canvasZoom = normalizeTemplateEditorCanvasZoom(zoom);
  appState.templateEditor.canvasZoomMode = normalizeTemplateEditorCanvasZoomMode(mode);
}

function getTemplateEditorCanvasBaseSize(canvasElement) {
  const surfaceElement = getTemplateEditorCanvasSurface(canvasElement);
  const computedStyle = surfaceElement ? getComputedStyle(surfaceElement) : canvasElement ? getComputedStyle(canvasElement) : null;
  const width =
    Number(surfaceElement?.dataset?.templatePageWidthPx) ||
    parseCssPixelValue(computedStyle?.getPropertyValue?.("--template-editor-canvas-width")) ||
    surfaceElement?.clientWidth ||
    surfaceElement?.offsetWidth ||
    0;
  const height =
    Number(surfaceElement?.dataset?.templatePageHeightPx) ||
    parseCssPixelValue(computedStyle?.getPropertyValue?.("--template-editor-canvas-height")) ||
    surfaceElement?.clientHeight ||
    surfaceElement?.offsetHeight ||
    0;

  return {
    height: Math.max(0, height),
    width: Math.max(0, width),
  };
}

function getCanvasFocalPoint(canvasElement, focalPoint = null) {
  const rect = canvasElement?.getBoundingClientRect?.();

  if (!rect) {
    return null;
  }

  const clientX = Number.isFinite(focalPoint?.clientX)
    ? focalPoint.clientX
    : rect.left + Math.min(rect.width, canvasElement.clientWidth || rect.width) / 2;
  const clientY = Number.isFinite(focalPoint?.clientY)
    ? focalPoint.clientY
    : rect.top + Math.min(rect.height, canvasElement.clientHeight || rect.height) / 2;

  return {
    x: Math.max(0, clientX - rect.left),
    y: Math.max(0, clientY - rect.top),
  };
}

function createCanvasScrollAnchor(canvasElement, oldZoom, focalPoint = null) {
  const normalizedFocalPoint = getCanvasFocalPoint(canvasElement, focalPoint);

  if (!normalizedFocalPoint) {
    return null;
  }

  const scaleBoxElement = getTemplateEditorCanvasScaleBox(canvasElement);
  const scaleBoxLeft = scaleBoxElement?.offsetLeft || 0;
  const scaleBoxTop = scaleBoxElement?.offsetTop || 0;
  const safeOldZoom = Math.max(normalizeTemplateEditorCanvasZoom(oldZoom), 0.01);

  return {
    clientX: normalizedFocalPoint.x,
    clientY: normalizedFocalPoint.y,
    logicalX: (canvasElement.scrollLeft + normalizedFocalPoint.x - scaleBoxLeft) / safeOldZoom,
    logicalY: (canvasElement.scrollTop + normalizedFocalPoint.y - scaleBoxTop) / safeOldZoom,
  };
}

function restoreCanvasScrollAnchor(canvasElement, zoom, anchor) {
  if (!canvasElement || !anchor) {
    return;
  }

  const scaleBoxElement = getTemplateEditorCanvasScaleBox(canvasElement);
  const scaleBoxLeft = scaleBoxElement?.offsetLeft || 0;
  const scaleBoxTop = scaleBoxElement?.offsetTop || 0;
  const safeZoom = Math.max(normalizeTemplateEditorCanvasZoom(zoom), 0.01);

  canvasElement.scrollLeft = Math.max(0, anchor.logicalX * safeZoom + scaleBoxLeft - anchor.clientX);
  canvasElement.scrollTop = Math.max(0, anchor.logicalY * safeZoom + scaleBoxTop - anchor.clientY);
}

function updateTemplateEditorCanvasZoomControls(canvasElement, zoom, mode) {
  const label = getTemplateEditorCanvasZoomPercentLabel(zoom);
  const safeMode = normalizeTemplateEditorCanvasZoomMode(mode);

  canvasElement?.querySelectorAll?.("[data-template-editor-canvas-zoom-label]")?.forEach((labelElement) => {
    labelElement.textContent = label;
  });

  canvasElement?.querySelectorAll?.("[data-template-editor-canvas-zoom-direction]")?.forEach((buttonElement) => {
    const direction = Number(buttonElement.dataset.templateEditorCanvasZoomDirection) || 0;

    buttonElement.disabled = direction < 0
      ? zoom <= templateEditorCanvasZoomMin + 0.001
      : direction > 0
        ? zoom >= templateEditorCanvasZoomMax - 0.001
        : false;
  });

  canvasElement?.querySelectorAll?.("[data-action='fit-template-editor-canvas-zoom']")?.forEach((buttonElement) => {
    buttonElement.classList.toggle("is-active", safeMode === templateEditorCanvasZoomModeFit);
    buttonElement.setAttribute("aria-pressed", safeMode === templateEditorCanvasZoomModeFit ? "true" : "false");
  });

  canvasElement?.querySelectorAll?.("[data-action='reset-template-editor-canvas-zoom']")?.forEach((buttonElement) => {
    buttonElement.setAttribute("aria-label", `Reset canvas zoom (${label})`);
  });
}

function notifyTemplateEditorCanvasZoomChange(canvasElement, zoom, mode, onAfterApply = null) {
  const runAfterLayout = getRequestAnimationFrame();

  runAfterLayout(() => {
    const surfaceElement = getTemplateEditorCanvasSurface(canvasElement);
    const runtime = getWindowRef()?.ExamListTemplateEditorRuntime || null;
    const CustomEventConstructor = surfaceElement?.ownerDocument?.defaultView?.CustomEvent || getWindowRef()?.CustomEvent || null;

    runtime?.updateImageSelectionOverlay?.();
    runtime?.updateTableObjectOverlay?.();
    onAfterApply?.();
    if (surfaceElement && typeof CustomEventConstructor === "function") {
      surfaceElement.dispatchEvent(
        new CustomEventConstructor("template-editor-canvas-zoom-change", {
          bubbles: true,
          detail: {
            mode: normalizeTemplateEditorCanvasZoomMode(mode),
            zoom: normalizeTemplateEditorCanvasZoom(zoom),
          },
        }),
      );
    }
  });
}

export function calculateTemplateEditorCanvasFitZoom(canvasElement = getTemplateEditorCanvasElement()) {
  if (!canvasElement) {
    return templateEditorCanvasZoomDefault;
  }

  const baseSize = getTemplateEditorCanvasBaseSize(canvasElement);
  const availableWidth = Math.max(0, (canvasElement.clientWidth || 0) - 24);
  const availableHeight = Math.max(0, (canvasElement.clientHeight || 0) - 24);
  const widthZoom = baseSize.width > 0 && availableWidth > 0 ? availableWidth / baseSize.width : templateEditorCanvasZoomDefault;
  const heightZoom = baseSize.height > 0 && availableHeight > 0 ? availableHeight / baseSize.height : widthZoom;

  return normalizeTemplateEditorCanvasZoom(Math.min(widthZoom, heightZoom), templateEditorCanvasZoomDefault);
}

export function applyTemplateEditorCanvasZoom({
  appState,
  focalPoint = null,
  mode = templateEditorCanvasZoomModeManual,
  onAfterApply = null,
  rootElement = null,
  zoom,
} = {}) {
  const canvasElement = getTemplateEditorCanvasElement(rootElement);

  if (!canvasElement) {
    return false;
  }

  const resolvedMode = normalizeTemplateEditorCanvasZoomMode(mode);
  const nextZoom = resolvedMode === templateEditorCanvasZoomModeFit
    ? calculateTemplateEditorCanvasFitZoom(canvasElement)
    : normalizeTemplateEditorCanvasZoom(zoom);
  const oldZoom = readCanvasElementZoom(canvasElement, appState);
  const scrollAnchor = createCanvasScrollAnchor(canvasElement, oldZoom, focalPoint);
  const baseSize = getTemplateEditorCanvasBaseSize(canvasElement);

  writeTemplateEditorCanvasZoomState(appState, nextZoom, resolvedMode);
  canvasElement.style.setProperty("--template-editor-canvas-zoom", String(nextZoom));
  if (baseSize.width > 0) {
    canvasElement.style.setProperty("--template-editor-canvas-scaled-width", `${Math.round(baseSize.width * nextZoom * 100) / 100}px`);
  }
  if (baseSize.height > 0) {
    canvasElement.style.setProperty("--template-editor-canvas-scaled-height", `${Math.round(baseSize.height * nextZoom * 100) / 100}px`);
  }
  canvasElement.dataset.templateEditorCanvasZoom = String(nextZoom);
  canvasElement.dataset.templateEditorCanvasZoomMode = resolvedMode;
  restoreCanvasScrollAnchor(canvasElement, nextZoom, scrollAnchor);
  updateTemplateEditorCanvasZoomControls(canvasElement, nextZoom, resolvedMode);
  notifyTemplateEditorCanvasZoomChange(canvasElement, nextZoom, resolvedMode, onAfterApply);
  return true;
}

export function applyTemplateEditorCanvasZoomFromState({
  appState,
  onAfterApply = null,
  recomputeFit = false,
  rootElement = null,
} = {}) {
  const editorState = appState?.templateEditor || {};
  const mode = getTemplateEditorCanvasZoomMode(editorState);
  const zoom = recomputeFit && mode === templateEditorCanvasZoomModeFit
    ? calculateTemplateEditorCanvasFitZoom(getTemplateEditorCanvasElement(rootElement))
    : getTemplateEditorCanvasZoom(editorState);

  return applyTemplateEditorCanvasZoom({
    appState,
    mode,
    onAfterApply,
    rootElement,
    zoom,
  });
}

export function stepTemplateEditorCanvasZoom(appState, direction = 0, options = {}) {
  const canvasElement = getTemplateEditorCanvasElement(options.rootElement);

  if (!canvasElement) {
    return false;
  }

  const currentZoom = readCanvasElementZoom(canvasElement, appState);
  const stepDirection = Number(direction) < 0 ? -1 : 1;

  return applyTemplateEditorCanvasZoom({
    appState,
    focalPoint: options.focalPoint,
    mode: templateEditorCanvasZoomModeManual,
    onAfterApply: options.onAfterApply,
    rootElement: options.rootElement,
    zoom: currentZoom + templateEditorCanvasZoomStep * stepDirection,
  });
}

export function resetTemplateEditorCanvasZoom(appState, options = {}) {
  return applyTemplateEditorCanvasZoom({
    appState,
    focalPoint: options.focalPoint,
    mode: templateEditorCanvasZoomModeManual,
    onAfterApply: options.onAfterApply,
    rootElement: options.rootElement,
    zoom: templateEditorCanvasZoomDefault,
  });
}

export function fitTemplateEditorCanvasZoom(appState, options = {}) {
  return applyTemplateEditorCanvasZoom({
    appState,
    focalPoint: options.focalPoint,
    mode: templateEditorCanvasZoomModeFit,
    onAfterApply: options.onAfterApply,
    rootElement: options.rootElement,
  });
}

export function handleTemplateEditorCanvasZoomWheel(event, appState, options = {}) {
  if (!event?.ctrlKey && !event?.metaKey) {
    return false;
  }

  const target = event.target instanceof Element ? event.target : null;
  const canvasElement = target?.closest?.("[data-template-editor-canvas], .template-editor-page") || null;

  if (!canvasElement) {
    return false;
  }

  const direction = Number(event.deltaY) > 0 ? -1 : 1;

  event.preventDefault();
  return stepTemplateEditorCanvasZoom(appState, direction, {
    focalPoint: {
      clientX: event.clientX,
      clientY: event.clientY,
    },
    onAfterApply: options.onAfterApply,
    rootElement: canvasElement,
  });
}
