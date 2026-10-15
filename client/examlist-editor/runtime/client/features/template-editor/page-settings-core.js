(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorPageSettingsCore = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const MILLIMETER_TO_PIXEL = 96 / 25.4;
  const DEFAULT_PAGE_SIZE = "A4";
  const DEFAULT_PAGE_ORIENTATION = "portrait";
  const DEFAULT_PAGE_MARGIN_MM = 12;

  const TEMPLATE_PAGE_SIZE_OPTIONS = Object.freeze([
    Object.freeze({ label: "A3", value: "A3", cssName: "A3", widthMm: 297, heightMm: 420 }),
    Object.freeze({ label: "A4", value: "A4", cssName: "A4", widthMm: 210, heightMm: 297 }),
    Object.freeze({ label: "A5", value: "A5", cssName: "A5", widthMm: 148, heightMm: 210 }),
    Object.freeze({ label: "B5", value: "B5", cssName: "B5", widthMm: 182, heightMm: 257 }),
    Object.freeze({ label: "Letter", value: "LETTER", cssName: "Letter", widthMm: 215.9, heightMm: 279.4 }),
    Object.freeze({ label: "Legal", value: "LEGAL", cssName: "Legal", widthMm: 215.9, heightMm: 355.6 }),
  ]);

  const TEMPLATE_PAGE_ORIENTATION_OPTIONS = Object.freeze([
    Object.freeze({ label: "세로", value: "portrait" }),
    Object.freeze({ label: "가로", value: "landscape" }),
  ]);

  function escapeTemplatePageHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function escapeTemplatePageAttribute(value) {
    return escapeTemplatePageHtml(value)
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function decodeTemplatePageAttribute(value = "") {
    return String(value || "")
      .replaceAll("&quot;", '"')
      .replaceAll("&#39;", "'")
      .replaceAll("&gt;", ">")
      .replaceAll("&lt;", "<")
      .replaceAll("&amp;", "&");
  }

  function getTemplatePageSizeOption(rawValue = DEFAULT_PAGE_SIZE) {
    const normalizedValue = String(rawValue || "").trim().toUpperCase();
    return TEMPLATE_PAGE_SIZE_OPTIONS.find((option) => option.value === normalizedValue) || TEMPLATE_PAGE_SIZE_OPTIONS[1];
  }

  function normalizeTemplatePageOrientation(rawValue = DEFAULT_PAGE_ORIENTATION) {
    const normalizedValue = String(rawValue || "").trim().toLowerCase();
    return normalizedValue === "landscape" ? "landscape" : "portrait";
  }

  function normalizeTemplatePageMarginValue(rawValue = DEFAULT_PAGE_MARGIN_MM) {
    const normalizedValue = String(rawValue ?? "").trim();
    const parsedValue = Number(normalizedValue === "" ? DEFAULT_PAGE_MARGIN_MM : normalizedValue);

    if (!Number.isFinite(parsedValue)) {
      return DEFAULT_PAGE_MARGIN_MM;
    }

    return Math.max(0, Math.min(80, Math.round(parsedValue * 10) / 10));
  }

  function normalizeTemplatePageSettings(rawSettings = {}) {
    const sourceSettings = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
    const sizeOption = getTemplatePageSizeOption(sourceSettings.size);
    const orientation = normalizeTemplatePageOrientation(sourceSettings.orientation);

    return Object.freeze({
      size: sizeOption.value,
      orientation,
      marginTop: normalizeTemplatePageMarginValue(sourceSettings.marginTop),
      marginRight: normalizeTemplatePageMarginValue(sourceSettings.marginRight),
      marginBottom: normalizeTemplatePageMarginValue(sourceSettings.marginBottom),
      marginLeft: normalizeTemplatePageMarginValue(sourceSettings.marginLeft),
    });
  }

  function getDefaultTemplatePageSettings() {
    return normalizeTemplatePageSettings({
      size: DEFAULT_PAGE_SIZE,
      orientation: DEFAULT_PAGE_ORIENTATION,
      marginTop: DEFAULT_PAGE_MARGIN_MM,
      marginRight: DEFAULT_PAGE_MARGIN_MM,
      marginBottom: DEFAULT_PAGE_MARGIN_MM,
      marginLeft: DEFAULT_PAGE_MARGIN_MM,
    });
  }

  function getTemplatePageDimensions(settings = getDefaultTemplatePageSettings()) {
    const normalizedSettings = normalizeTemplatePageSettings(settings);
    const sizeOption = getTemplatePageSizeOption(normalizedSettings.size);
    const portraitWidth = Math.round(sizeOption.widthMm * MILLIMETER_TO_PIXEL);
    const portraitHeight = Math.round(sizeOption.heightMm * MILLIMETER_TO_PIXEL);

    if (normalizedSettings.orientation === "landscape") {
      return Object.freeze({
        width: portraitHeight,
        height: portraitWidth,
      });
    }

    return Object.freeze({
      width: portraitWidth,
      height: portraitHeight,
    });
  }

  function getTemplatePageMarginPixels(settings = getDefaultTemplatePageSettings()) {
    const normalizedSettings = normalizeTemplatePageSettings(settings);

    return Object.freeze({
      top: Math.round(normalizedSettings.marginTop * MILLIMETER_TO_PIXEL),
      right: Math.round(normalizedSettings.marginRight * MILLIMETER_TO_PIXEL),
      bottom: Math.round(normalizedSettings.marginBottom * MILLIMETER_TO_PIXEL),
      left: Math.round(normalizedSettings.marginLeft * MILLIMETER_TO_PIXEL),
    });
  }

  function getTemplatePageDocumentElement(rootElement) {
    if (!rootElement?.querySelector) {
      return null;
    }

    if (rootElement.classList?.contains("template-doc")) {
      return rootElement;
    }

    return rootElement.querySelector(".template-doc");
  }

  function getTemplatePageSettingsFromDocument(documentElement) {
    if (!documentElement) {
      return getDefaultTemplatePageSettings();
    }

    return normalizeTemplatePageSettings({
      size: documentElement.dataset.templatePageSize,
      orientation: documentElement.dataset.templatePageOrientation,
      marginTop: documentElement.dataset.templatePageMarginTop,
      marginRight: documentElement.dataset.templatePageMarginRight,
      marginBottom: documentElement.dataset.templatePageMarginBottom,
      marginLeft: documentElement.dataset.templatePageMarginLeft,
    });
  }

  function getTemplatePageSettingsFromSurface(surfaceElement) {
    return getTemplatePageSettingsFromDocument(getTemplatePageDocumentElement(surfaceElement));
  }

  function writeTemplatePageSettingsToDocument(documentElement, rawSettings = {}) {
    if (!documentElement) {
      return getDefaultTemplatePageSettings();
    }

    const settings = normalizeTemplatePageSettings(rawSettings);

    documentElement.dataset.templatePageSize = settings.size;
    documentElement.dataset.templatePageOrientation = settings.orientation;
    documentElement.dataset.templatePageMarginTop = String(settings.marginTop);
    documentElement.dataset.templatePageMarginRight = String(settings.marginRight);
    documentElement.dataset.templatePageMarginBottom = String(settings.marginBottom);
    documentElement.dataset.templatePageMarginLeft = String(settings.marginLeft);
    return settings;
  }

  function normalizeTemplatePageDocumentSettings(documentElement) {
    return writeTemplatePageSettingsToDocument(documentElement, getTemplatePageSettingsFromDocument(documentElement));
  }

  function applyTemplatePageBoxStyle(element, settings, { fixedHeight = false } = {}) {
    if (!element?.style) {
      return getDefaultTemplatePageSettings();
    }

    const normalizedSettings = normalizeTemplatePageSettings(settings);
    const dimensions = getTemplatePageDimensions(normalizedSettings);
    const margins = getTemplatePageMarginPixels(normalizedSettings);

    element.style.width = `${dimensions.width}px`;
    element.style.minHeight = `${dimensions.height}px`;
    element.style.padding = `${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px`;
    element.style.setProperty("--template-editor-canvas-width", `${dimensions.width}px`);
    element.style.setProperty("--template-editor-canvas-height", `${dimensions.height}px`);
    element.dataset.templatePageSize = normalizedSettings.size;
    element.dataset.templatePageOrientation = normalizedSettings.orientation;
    element.dataset.templatePageHeightPx = String(dimensions.height);
    element.dataset.templatePageWidthPx = String(dimensions.width);

    const pageElement = element.closest?.(".template-editor-page") || null;
    const layoutElement = element.closest?.(".template-editor-modal-body, .template-editor-runtime-shell") || null;
    const modalSheetElement = layoutElement?.closest?.(".template-editor-modal-sheet") || null;
    const canvasZoom = Math.max(
      Number.parseFloat(String(pageElement?.style?.getPropertyValue?.("--template-editor-canvas-zoom") || "1")) || 1,
      0.01,
    );
    const scaledWidth = `${Math.round(dimensions.width * canvasZoom * 100) / 100}px`;
    const scaledHeight = `${Math.round(dimensions.height * canvasZoom * 100) / 100}px`;

    if (pageElement?.style) {
      pageElement.style.setProperty("--template-editor-canvas-width", `${dimensions.width}px`);
      pageElement.style.setProperty("--template-editor-canvas-height", `${dimensions.height}px`);
      pageElement.style.setProperty("--template-editor-canvas-scaled-width", scaledWidth);
      pageElement.style.setProperty("--template-editor-canvas-scaled-height", scaledHeight);
      pageElement.dataset.templatePageOrientation = normalizedSettings.orientation;
    }

    if (layoutElement?.style) {
      layoutElement.style.setProperty("--template-editor-canvas-width", `${dimensions.width}px`);
      layoutElement.style.setProperty("--template-editor-canvas-height", `${dimensions.height}px`);
      layoutElement.dataset.templatePageOrientation = normalizedSettings.orientation;
    }

    if (modalSheetElement?.style) {
      modalSheetElement.style.setProperty("--template-editor-canvas-width", `${dimensions.width}px`);
      modalSheetElement.style.setProperty("--template-editor-canvas-height", `${dimensions.height}px`);
      modalSheetElement.dataset.templatePageOrientation = normalizedSettings.orientation;
    }

    if (fixedHeight) {
      element.style.height = `${dimensions.height}px`;
    } else {
      element.style.removeProperty("height");
    }

    return normalizedSettings;
  }

  function applyTemplatePageSettingsToSurface(surfaceElement, settings = getDefaultTemplatePageSettings()) {
    return applyTemplatePageBoxStyle(surfaceElement, settings, { fixedHeight: true });
  }

  function applyTemplatePageSettingsToRenderedSheet(sheetElement, settings = null) {
    const resolvedSettings = settings || getTemplatePageSettingsFromDocument(getTemplatePageDocumentElement(sheetElement));
    return applyTemplatePageBoxStyle(sheetElement, resolvedSettings, { fixedHeight: false });
  }

  function syncTemplatePageSettingsFromDocumentToSurface(surfaceElement) {
    if (surfaceElement?.matches?.("[data-candidate-block-modal-editor-surface]")) {
      return getDefaultTemplatePageSettings();
    }

    const documentElement = getTemplatePageDocumentElement(surfaceElement);
    const settings = normalizeTemplatePageDocumentSettings(documentElement);

    applyTemplatePageSettingsToSurface(surfaceElement, settings);
    return settings;
  }

  function getTemplatePageSettingsLabel(settings = getDefaultTemplatePageSettings()) {
    const normalizedSettings = normalizeTemplatePageSettings(settings);
    const sizeOption = getTemplatePageSizeOption(normalizedSettings.size);
    const orientationOption = TEMPLATE_PAGE_ORIENTATION_OPTIONS.find((option) => option.value === normalizedSettings.orientation);

    return `${sizeOption.label} ${orientationOption?.label || "세로"}`;
  }

  function getTemplatePageStatusMessage(settings = getDefaultTemplatePageSettings(), hasOverflow = false) {
    const pageLabel = getTemplatePageSettingsLabel(settings);
    return hasOverflow
      ? `${pageLabel} 영역을 초과했습니다. 편집은 가능하지만 저장 전 내용 길이를 줄여야 합니다.`
      : `${pageLabel} 영역 안에서 편집 중입니다.`;
  }

  function getTemplatePagePrintCss(settings = getDefaultTemplatePageSettings()) {
    const normalizedSettings = normalizeTemplatePageSettings(settings);
    const sizeOption = getTemplatePageSizeOption(normalizedSettings.size);
    return `@page { size: ${sizeOption.cssName} ${normalizedSettings.orientation}; margin: 0; }`;
  }

  function getTemplatePageRenderStyle(settings = getDefaultTemplatePageSettings()) {
    const normalizedSettings = normalizeTemplatePageSettings(settings);
    const dimensions = getTemplatePageDimensions(normalizedSettings);
    const margins = getTemplatePageMarginPixels(normalizedSettings);

    return [
      `width: ${dimensions.width}px`,
      `min-height: ${dimensions.height}px`,
      `padding: ${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px`,
    ].join("; ");
  }

  function getTemplatePageRenderAttributes(settings = getDefaultTemplatePageSettings()) {
    const normalizedSettings = normalizeTemplatePageSettings(settings);
    const dimensions = getTemplatePageDimensions(normalizedSettings);

    return [
      `style="${escapeTemplatePageAttribute(getTemplatePageRenderStyle(normalizedSettings))}"`,
      `data-template-page-size="${escapeTemplatePageAttribute(normalizedSettings.size)}"`,
      `data-template-page-orientation="${escapeTemplatePageAttribute(normalizedSettings.orientation)}"`,
      `data-template-page-width-px="${escapeTemplatePageAttribute(dimensions.width)}"`,
      `data-template-page-height-px="${escapeTemplatePageAttribute(dimensions.height)}"`,
    ].join(" ");
  }

  function getAttributeValueFromTag(tagMarkup = "", attributeName = "") {
    const escapedName = String(attributeName || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matcher = new RegExp(`\\s${escapedName}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
    const [, , doubleQuoted = "", singleQuoted = "", unquoted = ""] = String(tagMarkup || "").match(matcher) || [];
    return decodeTemplatePageAttribute(doubleQuoted || singleQuoted || unquoted || "");
  }

  function getTemplatePageSettingsFromHtml(markup = "") {
    const tagMatcher = /<[^>]+>/g;
    const sourceMarkup = String(markup || "");
    let tagMatch = tagMatcher.exec(sourceMarkup);

    while (tagMatch) {
      const tagMarkup = tagMatch[0];
      const className = getAttributeValueFromTag(tagMarkup, "class");
      const classNames = className.split(/\s+/).filter(Boolean);

      if (classNames.includes("template-doc")) {
        return normalizeTemplatePageSettings({
          size: getAttributeValueFromTag(tagMarkup, "data-template-page-size"),
          orientation: getAttributeValueFromTag(tagMarkup, "data-template-page-orientation"),
          marginTop: getAttributeValueFromTag(tagMarkup, "data-template-page-margin-top"),
          marginRight: getAttributeValueFromTag(tagMarkup, "data-template-page-margin-right"),
          marginBottom: getAttributeValueFromTag(tagMarkup, "data-template-page-margin-bottom"),
          marginLeft: getAttributeValueFromTag(tagMarkup, "data-template-page-margin-left"),
        });
      }

      tagMatch = tagMatcher.exec(sourceMarkup);
    }

    return getDefaultTemplatePageSettings();
  }

  return Object.freeze({
    DEFAULT_PAGE_MARGIN_MM,
    DEFAULT_PAGE_ORIENTATION,
    DEFAULT_PAGE_SIZE,
    MILLIMETER_TO_PIXEL,
    TEMPLATE_PAGE_ORIENTATION_OPTIONS,
    TEMPLATE_PAGE_SIZE_OPTIONS,
    applyTemplatePageSettingsToRenderedSheet,
    applyTemplatePageSettingsToSurface,
    decodeTemplatePageAttribute,
    escapeTemplatePageAttribute,
    escapeTemplatePageHtml,
    getDefaultTemplatePageSettings,
    getTemplatePageDimensions,
    getTemplatePageDocumentElement,
    getTemplatePageMarginPixels,
    getTemplatePagePrintCss,
    getTemplatePageRenderAttributes,
    getTemplatePageRenderStyle,
    getTemplatePageSettingsFromDocument,
    getTemplatePageSettingsFromHtml,
    getTemplatePageSettingsFromSurface,
    getTemplatePageSettingsLabel,
    getTemplatePageStatusMessage,
    normalizeTemplatePageDocumentSettings,
    normalizeTemplatePageMarginValue,
    normalizeTemplatePageOrientation,
    normalizeTemplatePageSettings,
    syncTemplatePageSettingsFromDocumentToSurface,
    writeTemplatePageSettingsToDocument,
  });
});

})();
