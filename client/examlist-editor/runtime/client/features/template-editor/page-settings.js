(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./page-settings-core"));
    return;
  }

  globalScope.ExamListTemplateEditorPageSettings = factory(globalScope.ExamListTemplateEditorPageSettingsCore);
})(typeof globalThis !== "undefined" ? globalThis : this, (pageSettingsCore) => {
  if (!pageSettingsCore?.normalizeTemplatePageSettings) {
    throw new Error("client/features/template-editor/page-settings-core.js must be loaded before page-settings.js.");
  }

  const {
    DEFAULT_PAGE_MARGIN_MM,
    DEFAULT_PAGE_ORIENTATION,
    DEFAULT_PAGE_SIZE,
    MILLIMETER_TO_PIXEL,
    TEMPLATE_PAGE_ORIENTATION_OPTIONS,
    TEMPLATE_PAGE_SIZE_OPTIONS,
    applyTemplatePageSettingsToRenderedSheet,
    applyTemplatePageSettingsToSurface,
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
  } = pageSettingsCore;

  function renderTemplatePagePropertiesPanel({
    ids = {},
    title = "페이지 속성",
  } = {}) {
    const resolvedIds = {
      size: ids.size || "templateEditorPageSize",
      orientationName: ids.orientationName || "templateEditorPageOrientation",
      orientationPortrait: ids.orientationPortrait || "templateEditorPageOrientationPortrait",
      orientationLandscape: ids.orientationLandscape || "templateEditorPageOrientationLandscape",
      marginTop: ids.marginTop || "templateEditorPageMarginTop",
      marginRight: ids.marginRight || "templateEditorPageMarginRight",
      marginBottom: ids.marginBottom || "templateEditorPageMarginBottom",
      marginLeft: ids.marginLeft || "templateEditorPageMarginLeft",
    };

    return `
      <p class="template-page-properties-title">${escapeTemplatePageHtml(title)}</p>
      <label class="template-page-property-field" for="${escapeTemplatePageAttribute(resolvedIds.size)}">
        <span>용지 크기</span>
        <select class="template-page-property-control" id="${escapeTemplatePageAttribute(resolvedIds.size)}" data-template-page-setting="size">
          ${TEMPLATE_PAGE_SIZE_OPTIONS.map((option) => `
            <option value="${escapeTemplatePageAttribute(option.value)}"${option.value === DEFAULT_PAGE_SIZE ? " selected" : ""}>${escapeTemplatePageHtml(option.label)}</option>
          `).join("")}
        </select>
      </label>
      <fieldset class="template-page-property-field template-page-property-fieldset">
        <legend>방향</legend>
        <div class="template-page-orientation-options">
          <label for="${escapeTemplatePageAttribute(resolvedIds.orientationPortrait)}">
            <input
              class="sr-only"
              id="${escapeTemplatePageAttribute(resolvedIds.orientationPortrait)}"
              name="${escapeTemplatePageAttribute(resolvedIds.orientationName)}"
              data-template-page-setting="orientation"
              type="radio"
              value="portrait"
              checked
            />
            <span>세로</span>
          </label>
          <label for="${escapeTemplatePageAttribute(resolvedIds.orientationLandscape)}">
            <input
              class="sr-only"
              id="${escapeTemplatePageAttribute(resolvedIds.orientationLandscape)}"
              name="${escapeTemplatePageAttribute(resolvedIds.orientationName)}"
              data-template-page-setting="orientation"
              type="radio"
              value="landscape"
            />
            <span>가로</span>
          </label>
        </div>
      </fieldset>
      <div class="template-page-property-field">
        <span>여백</span>
        <div class="template-page-margin-grid">
          <label for="${escapeTemplatePageAttribute(resolvedIds.marginTop)}">
            <span>위</span>
            <span class="template-page-property-unit-control">
              <input class="template-page-property-control" id="${escapeTemplatePageAttribute(resolvedIds.marginTop)}" data-template-page-setting="marginTop" type="number" min="0" max="80" step="1" value="${escapeTemplatePageAttribute(DEFAULT_PAGE_MARGIN_MM)}" />
              <span class="template-page-property-control-unit" aria-hidden="true">mm</span>
            </span>
          </label>
          <label for="${escapeTemplatePageAttribute(resolvedIds.marginRight)}">
            <span>오른쪽</span>
            <span class="template-page-property-unit-control">
              <input class="template-page-property-control" id="${escapeTemplatePageAttribute(resolvedIds.marginRight)}" data-template-page-setting="marginRight" type="number" min="0" max="80" step="1" value="${escapeTemplatePageAttribute(DEFAULT_PAGE_MARGIN_MM)}" />
              <span class="template-page-property-control-unit" aria-hidden="true">mm</span>
            </span>
          </label>
          <label for="${escapeTemplatePageAttribute(resolvedIds.marginBottom)}">
            <span>아래</span>
            <span class="template-page-property-unit-control">
              <input class="template-page-property-control" id="${escapeTemplatePageAttribute(resolvedIds.marginBottom)}" data-template-page-setting="marginBottom" type="number" min="0" max="80" step="1" value="${escapeTemplatePageAttribute(DEFAULT_PAGE_MARGIN_MM)}" />
              <span class="template-page-property-control-unit" aria-hidden="true">mm</span>
            </span>
          </label>
          <label for="${escapeTemplatePageAttribute(resolvedIds.marginLeft)}">
            <span>왼쪽</span>
            <span class="template-page-property-unit-control">
              <input class="template-page-property-control" id="${escapeTemplatePageAttribute(resolvedIds.marginLeft)}" data-template-page-setting="marginLeft" type="number" min="0" max="80" step="1" value="${escapeTemplatePageAttribute(DEFAULT_PAGE_MARGIN_MM)}" />
              <span class="template-page-property-control-unit" aria-hidden="true">mm</span>
            </span>
          </label>
        </div>
      </div>
    `;
  }

  function createTemplatePagePropertiesController({
    getPagePropertiesElement,
    getTemplateEditorSurface,
    setTemplateEditorStatus,
    syncTemplateEditorContent,
    updateTemplateEditorImageSelectionOverlay,
  }) {
    function getPagePropertiesRoot() {
      return getPagePropertiesElement?.() || null;
    }

    function getPagePropertyControl(settingName) {
      return getPagePropertiesRoot()?.querySelector(`[data-template-page-setting="${settingName}"]`) || null;
    }

    function getPageOrientationControl(orientation) {
      return getPagePropertiesRoot()?.querySelector(
        `[data-template-page-setting="orientation"][value="${orientation}"]`,
      ) || null;
    }

    function preservePagePropertyControlFocus(controlElement, update) {
      const ownerDocument = controlElement?.ownerDocument || null;
      const wasFocused = ownerDocument?.activeElement === controlElement;
      const settingName = String(controlElement?.dataset?.templatePageSetting || "");
      const result = update();

      if (!wasFocused || !settingName) {
        return result;
      }

      const nextControl = controlElement.isConnected
        ? controlElement
        : getPagePropertyControl(settingName);

      if (nextControl && ownerDocument.activeElement !== nextControl && !nextControl.disabled) {
        nextControl.focus?.({ preventScroll: true });
      }

      return result;
    }

    function syncTemplatePageControls(settings = getDefaultTemplatePageSettings()) {
      const normalizedSettings = normalizeTemplatePageSettings(settings);
      const sizeControl = getPagePropertyControl("size");
      const marginTopControl = getPagePropertyControl("marginTop");
      const marginRightControl = getPagePropertyControl("marginRight");
      const marginBottomControl = getPagePropertyControl("marginBottom");
      const marginLeftControl = getPagePropertyControl("marginLeft");
      const orientationControl = getPageOrientationControl(normalizedSettings.orientation);

      if (sizeControl) {
        sizeControl.value = normalizedSettings.size;
      }

      if (orientationControl instanceof HTMLInputElement) {
        orientationControl.checked = true;
      }

      if (marginTopControl) {
        marginTopControl.value = String(normalizedSettings.marginTop);
      }

      if (marginRightControl) {
        marginRightControl.value = String(normalizedSettings.marginRight);
      }

      if (marginBottomControl) {
        marginBottomControl.value = String(normalizedSettings.marginBottom);
      }

      if (marginLeftControl) {
        marginLeftControl.value = String(normalizedSettings.marginLeft);
      }
    }

    function getTemplatePageSettingsFromControls() {
      const rootElement = getPagePropertiesRoot();
      const checkedOrientation = rootElement?.querySelector('[data-template-page-setting="orientation"]:checked') || null;

      return normalizeTemplatePageSettings({
        size: getPagePropertyControl("size")?.value,
        orientation: checkedOrientation?.value,
        marginTop: getPagePropertyControl("marginTop")?.value,
        marginRight: getPagePropertyControl("marginRight")?.value,
        marginBottom: getPagePropertyControl("marginBottom")?.value,
        marginLeft: getPagePropertyControl("marginLeft")?.value,
      });
    }

    function syncTemplatePageSettingsFromDocument() {
      const surfaceElement = getTemplateEditorSurface?.();
      const settings = syncTemplatePageSettingsFromDocumentToSurface(surfaceElement);

      syncTemplatePageControls(settings);
      setTemplateEditorStatus?.(getTemplatePageStatusMessage(settings, false));
      return settings;
    }

    function applyTemplatePageSettingsFromControls({ sync = true } = {}) {
      const surfaceElement = getTemplateEditorSurface?.();
      const documentElement = getTemplatePageDocumentElement(surfaceElement);

      if (!surfaceElement || !documentElement) {
        return false;
      }

      const settings = writeTemplatePageSettingsToDocument(documentElement, getTemplatePageSettingsFromControls());

      syncTemplatePageControls(settings);
      applyTemplatePageSettingsToSurface(surfaceElement, settings);
      updateTemplateEditorImageSelectionOverlay?.();

      if (sync) {
        syncTemplateEditorContent?.({ preserveSelection: true });
      } else {
        setTemplateEditorStatus?.(getTemplatePageStatusMessage(settings, false));
      }

      return true;
    }

    function handleTemplatePageSettingChange(event) {
      const target = event?.target instanceof Element ? event.target : null;
      const controlElement = target?.closest("[data-template-page-setting]") || null;

      if (!controlElement) {
        return false;
      }

      return preservePagePropertyControlFocus(
        controlElement,
        () => applyTemplatePageSettingsFromControls(),
      );
    }

    return Object.freeze({
      applyTemplatePageSettingsFromControls,
      handleTemplatePageSettingChange,
      syncTemplatePageControls,
      syncTemplatePageSettingsFromDocument,
    });
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
    createTemplatePagePropertiesController,
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
    renderTemplatePagePropertiesPanel,
    syncTemplatePageSettingsFromDocumentToSurface,
    writeTemplatePageSettingsToDocument,
  });
});

})();
