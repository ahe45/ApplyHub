(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListEditorFormattingState = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const CSS_PIXELS_PER_POINT = 96 / 72;

  function getEditorToolbarPointFontSize(computedFontSize = "", fallbackValue = 11) {
    const parsedFontSize = Number.parseFloat(computedFontSize);

    if (!Number.isFinite(parsedFontSize)) {
      return fallbackValue;
    }

    return Math.round(parsedFontSize / CSS_PIXELS_PER_POINT);
  }

  function createEditorToolbarFormattingStateController({
    EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR,
    EDITOR_TOOLBAR_FONT_OPTIONS,
    normalizeEditorToolbarColorValue,
    syncEditorToolbarColorControls,
    syncEditorToolbarFontFamilyControls,
    syncEditorToolbarFontSizeControls,
  }) {
    function isEditorToolbarTransparentColor(rawValue) {
      const normalizedValue = String(rawValue || "").trim().toLowerCase().replace(/\s+/g, "");
      return !normalizedValue || normalizedValue === "transparent" || normalizedValue === "rgba(0,0,0,0)";
    }

    function getEditorToolbarTextColor(contextElement = null, fallbackValue = EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR) {
      const baseElement = contextElement?.nodeType === Node.ELEMENT_NODE ? contextElement : contextElement?.parentElement || null;

      if (!baseElement) {
        return fallbackValue;
      }

      return normalizeEditorToolbarColorValue(baseElement.style.color || window.getComputedStyle(baseElement).color, fallbackValue);
    }

    function getEditorToolbarPrimaryFontFamily(fontFamilyValue = "") {
      return String(fontFamilyValue || "")
        .split(",")[0]
        .replace(/["']/g, "")
        .trim()
        .toLowerCase();
    }

    function resolveEditorToolbarFontFamilyValue(fontFamilyValue = "", defaultFontFamily = EDITOR_TOOLBAR_FONT_OPTIONS[0].value) {
      const normalizedFontFamily = String(fontFamilyValue || "").trim().toLowerCase();
      const primaryFontFamily = getEditorToolbarPrimaryFontFamily(fontFamilyValue);

      for (const option of EDITOR_TOOLBAR_FONT_OPTIONS) {
        const optionPrimaryFontFamily = getEditorToolbarPrimaryFontFamily(option.value);

        if (
          optionPrimaryFontFamily &&
          (primaryFontFamily === optionPrimaryFontFamily || normalizedFontFamily.includes(optionPrimaryFontFamily))
        ) {
          return option.value;
        }
      }

      return defaultFontFamily;
    }

    function parseEditorToolbarFontWeight(fontWeightValue = "") {
      const normalizedFontWeight = String(fontWeightValue || "").trim().toLowerCase();

      if (normalizedFontWeight === "bold") {
        return 700;
      }

      const numericFontWeight = Number(normalizedFontWeight);
      return Number.isFinite(numericFontWeight) ? numericFontWeight : 400;
    }

    function resolveEditorToolbarTextAlign(textAlignValue = "") {
      const normalizedTextAlign = String(textAlignValue || "").trim().toLowerCase();

      if (normalizedTextAlign.includes("justify")) {
        return "justifyFull";
      }

      if (normalizedTextAlign.includes("center")) {
        return "justifyCenter";
      }

      if (normalizedTextAlign.includes("right") || normalizedTextAlign.includes("end")) {
        return "justifyRight";
      }

      return "justifyLeft";
    }

    function getEditorToolbarSelectionContextElement(rootElement = null, selectionNode = null, preferredElement = null) {
      if (!rootElement) {
        return null;
      }

      const preferredBaseElement =
        preferredElement?.nodeType === Node.ELEMENT_NODE ? preferredElement : preferredElement?.parentElement || null;

      if (preferredBaseElement && rootElement.contains(preferredBaseElement)) {
        return preferredBaseElement;
      }

      const selectionBaseElement =
        selectionNode?.nodeType === Node.ELEMENT_NODE ? selectionNode : selectionNode?.parentElement || null;

      if (selectionBaseElement && rootElement.contains(selectionBaseElement)) {
        return selectionBaseElement;
      }

      return null;
    }

    function getEditorToolbarTextHighlightColor(contextElement = null, rootElement = null, fallbackValue = "#fff59d") {
      let currentElement =
        contextElement?.nodeType === Node.ELEMENT_NODE ? contextElement : contextElement?.parentElement || null;

      while (currentElement && rootElement?.contains(currentElement)) {
        const tagName = String(currentElement.tagName || "").toUpperCase();

        if (!["TD", "TH", "TR", "TABLE", "TBODY", "THEAD", "TFOOT", "COLGROUP", "COL"].includes(tagName)) {
          const inlineBackgroundColor = String(currentElement.style.backgroundColor || "").trim().toLowerCase().replace(/\s+/g, "");

          if (inlineBackgroundColor === "transparent" || inlineBackgroundColor === "rgba(0,0,0,0)") {
            return "transparent";
          }

          const rawBackgroundColor = currentElement.style.backgroundColor || window.getComputedStyle(currentElement).backgroundColor;

          if (!isEditorToolbarTransparentColor(rawBackgroundColor)) {
            return normalizeEditorToolbarColorValue(rawBackgroundColor, fallbackValue);
          }
        }

        if (currentElement === rootElement) {
          break;
        }

        currentElement = currentElement.parentElement;
      }

      return fallbackValue;
    }

    function setEditorToolbarCommandButtonState(toolbarElement = null, attributeName = "", attributeValue = "", isActive = false) {
      if (!toolbarElement || !attributeName || !attributeValue) {
        return;
      }

      const buttonElement = toolbarElement.querySelector(`button[${attributeName}="${attributeValue}"]`);

      if (!buttonElement) {
        return;
      }

      buttonElement.classList.toggle("is-active", Boolean(isActive));
      buttonElement.setAttribute("aria-pressed", isActive ? "true" : "false");
    }

    function updateEditorToolbarFormattingState({
      rootElement = null,
      toolbarElement = null,
      commandAttributeName = "",
      fontFamilyElement = null,
      fontSizeElement = null,
      textColorElement = null,
      textShadingElement = null,
      selectionNode = null,
      contextElement = null,
      defaultFontFamily = EDITOR_TOOLBAR_FONT_OPTIONS[0].value,
      defaultFontSize = 11,
      defaultTextColor = EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR,
      defaultTextShading = "#fff59d",
    } = {}) {
      if (!rootElement) {
        return false;
      }

      const resolvedContextElement = getEditorToolbarSelectionContextElement(rootElement, selectionNode, contextElement);

      if (!resolvedContextElement) {
        return false;
      }

      const formattingElement =
        resolvedContextElement.nodeType === Node.ELEMENT_NODE ? resolvedContextElement : resolvedContextElement.parentElement || null;

      if (!formattingElement) {
        return false;
      }

      const computedStyle = window.getComputedStyle(formattingElement);
      const resolvedFontFamily = resolveEditorToolbarFontFamilyValue(computedStyle.fontFamily, defaultFontFamily);
      const resolvedFontSize = getEditorToolbarPointFontSize(computedStyle.fontSize, defaultFontSize);
      const resolvedTextColor = getEditorToolbarTextColor(formattingElement, textColorElement?.value || defaultTextColor);
      const resolvedHighlightColor = getEditorToolbarTextHighlightColor(
        formattingElement,
        rootElement,
        textShadingElement?.value || defaultTextShading,
      );
      const isBold = parseEditorToolbarFontWeight(computedStyle.fontWeight) >= 600;
      const isItalic = String(computedStyle.fontStyle || "").toLowerCase().includes("italic");
      const textDecorationValue = `${computedStyle.textDecorationLine || ""} ${computedStyle.textDecoration || ""}`.toLowerCase();
      const isUnderline = textDecorationValue.includes("underline");
      const closestList = formattingElement.closest("ul");
      const hasUnorderedList = Boolean(
        (closestList && rootElement.contains(closestList)) ||
        (/^(TD|TH)$/i.test(String(formattingElement.tagName || "")) && formattingElement.querySelector("ul")),
      );
      const activeAlignmentCommand = resolveEditorToolbarTextAlign(computedStyle.textAlign);
      const resolvedToolbarElement = toolbarElement || fontFamilyElement?.closest(".editor-toolbar") || fontSizeElement?.closest(".editor-toolbar");

      if (fontFamilyElement) {
        if (typeof syncEditorToolbarFontFamilyControls === "function") {
          syncEditorToolbarFontFamilyControls(fontFamilyElement, resolvedFontFamily);
        } else {
          fontFamilyElement.value = resolvedFontFamily;
        }
      }

      if (fontSizeElement) {
        syncEditorToolbarFontSizeControls({
          fontSizeElement,
          fontSize: resolvedFontSize,
          defaultFontSize,
        });
      }

      if (textColorElement) {
        syncEditorToolbarColorControls({
          colorInputElement: textColorElement,
          colorValue: resolvedTextColor,
          fallbackValue: defaultTextColor,
        });
      }

      if (textShadingElement) {
        syncEditorToolbarColorControls({
          colorInputElement: textShadingElement,
          colorValue: resolvedHighlightColor,
          fallbackValue: defaultTextShading,
        });
      }

      if (!resolvedToolbarElement || !commandAttributeName) {
        return true;
      }

      setEditorToolbarCommandButtonState(resolvedToolbarElement, commandAttributeName, "bold", isBold);
      setEditorToolbarCommandButtonState(resolvedToolbarElement, commandAttributeName, "italic", isItalic);
      setEditorToolbarCommandButtonState(resolvedToolbarElement, commandAttributeName, "underline", isUnderline);
      setEditorToolbarCommandButtonState(resolvedToolbarElement, commandAttributeName, "insertUnorderedList", hasUnorderedList);
      setEditorToolbarCommandButtonState(
        resolvedToolbarElement,
        commandAttributeName,
        "justifyLeft",
        activeAlignmentCommand === "justifyLeft",
      );
      setEditorToolbarCommandButtonState(
        resolvedToolbarElement,
        commandAttributeName,
        "justifyCenter",
        activeAlignmentCommand === "justifyCenter",
      );
      setEditorToolbarCommandButtonState(
        resolvedToolbarElement,
        commandAttributeName,
        "justifyRight",
        activeAlignmentCommand === "justifyRight",
      );
      setEditorToolbarCommandButtonState(
        resolvedToolbarElement,
        commandAttributeName,
        "justifyFull",
        activeAlignmentCommand === "justifyFull",
      );

      return true;
    }

    return Object.freeze({
      updateEditorToolbarFormattingState,
    });
  }

  return Object.freeze({
    createEditorToolbarFormattingStateController,
  });
});

})();
