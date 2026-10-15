(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListEditorSharedCommands = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createSharedEditorCommandHelpers({
    EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR,
    EDITOR_TOOLBAR_FONT_OPTIONS,
    getEditorToolbarColorFallback,
    normalizeEditorToolbarColorValue,
    normalizeTemplateEditorFontNodes,
    normalizeTemplateEditorInlineFontSizeStyles,
    syncEditorToolbarFontFamilyControls,
    syncEditorToolbarFontSizeControls,
  }) {
    function isSharedEditorNoColorValue(value = "") {
      const normalizedValue = String(value || "").trim().toLowerCase().replace(/\s+/g, "");

      return normalizedValue === "transparent" || normalizedValue === "none" || normalizedValue === "rgba(0,0,0,0)";
    }

    function applySharedEditorCommand({
      rootElement = null,
      focusElement = null,
      restoreSelection = null,
      syncContent = null,
      onUndo = null,
      onRedo = null,
      applyTableSelectionCommand = null,
      command = "",
      value = "",
      enableStyleWithCss = false,
      fontFamilyElement = null,
      defaultFontFamily = EDITOR_TOOLBAR_FONT_OPTIONS[0].value,
      fontSizeElement = null,
      defaultFontSize = 11,
      setStatus = null,
      syncOptions = undefined,
      onFormatBlockApplied = null,
    }) {
      if (!rootElement || !command) {
        return;
      }

      if (command === "undo") {
        onUndo?.();
        return;
      }

      if (command === "redo") {
        onRedo?.();
        return;
      }

      if (applyTableSelectionCommand?.(command, value)) {
        return;
      }

      focusElement?.focus?.();
      restoreSelection?.();

      const shouldUseStyleWithCss =
        enableStyleWithCss ||
        command === "fontName" ||
        command === "fontSizePx" ||
        command === "hiliteColor" ||
        command === "foreColor";

      if (shouldUseStyleWithCss) {
        document.execCommand("styleWithCSS", false, true);
      }

      if (command === "fontSizePx") {
        const fontSize = Math.round(Number(value));

        if (!Number.isFinite(fontSize) || fontSize < 1 || fontSize > 72) {
          setStatus?.("글자 크기는 1pt 이상 72pt 이하로 입력하세요.", "warning");
          syncEditorToolbarFontSizeControls({
            fontSizeElement,
            fontSize: defaultFontSize,
            defaultFontSize,
          });
          return;
        }

        document.execCommand("fontSize", false, "7");
        normalizeTemplateEditorFontNodes(rootElement, { appliedFontSizePt: fontSize });
        normalizeTemplateEditorInlineFontSizeStyles(rootElement, fontSize);

        syncEditorToolbarFontSizeControls({
          fontSizeElement,
          fontSize,
          defaultFontSize,
        });
      } else {
        const commandValue =
          command === "fontName"
            ? String(value || defaultFontFamily).trim()
            : command === "hiliteColor" && isSharedEditorNoColorValue(value)
              ? "transparent"
            : command === "hiliteColor" || command === "foreColor"
              ? normalizeEditorToolbarColorValue(value || "", getEditorToolbarColorFallback(command))
              : command === "formatBlock" && value
                ? `<${value}>`
                : value;

        document.execCommand(command, false, commandValue);

        if (command === "fontName") {
          normalizeTemplateEditorFontNodes(rootElement);

          if (fontFamilyElement) {
            if (typeof syncEditorToolbarFontFamilyControls === "function") {
              syncEditorToolbarFontFamilyControls(fontFamilyElement, commandValue);
            } else {
              fontFamilyElement.value = commandValue;
            }
          }
        }

        if (command === "formatBlock" && value) {
          onFormatBlockApplied?.(value);
        }
      }

      syncContent?.(syncOptions);
    }

    function applySharedEditorFontFamily({
      rootElement = null,
      focusElement = null,
      restoreSelection = null,
      syncContent = null,
      applyTableSelectionFontFamily = null,
      rawFontFamily = "",
      fontFamilyElement = null,
      defaultFontFamily = EDITOR_TOOLBAR_FONT_OPTIONS[0].value,
      syncOptions = undefined,
    }) {
      if (!rootElement) {
        return;
      }

      const fontFamily = String(rawFontFamily || "").trim() || defaultFontFamily;

      if (applyTableSelectionFontFamily?.(fontFamily)) {
        if (fontFamilyElement) {
          if (typeof syncEditorToolbarFontFamilyControls === "function") {
            syncEditorToolbarFontFamilyControls(fontFamilyElement, fontFamily);
          } else {
            fontFamilyElement.value = fontFamily;
          }
        }
        return;
      }

      applySharedEditorCommand({
        rootElement,
        focusElement,
        restoreSelection,
        syncContent,
        command: "fontName",
        value: fontFamily,
        enableStyleWithCss: true,
        fontFamilyElement,
        defaultFontFamily,
        syncOptions,
      });
    }

    function applySharedEditorFontSize({
      rootElement = null,
      focusElement = null,
      restoreSelection = null,
      syncContent = null,
      applyTableSelectionFontSize = null,
      rawFontSize = "",
      fontSizeElement = null,
      defaultFontSize = 11,
      setStatus = null,
      syncOptions = undefined,
    }) {
      if (!rootElement) {
        return;
      }

      const fontSize = Math.round(Number(rawFontSize));

      if (!Number.isFinite(fontSize) || fontSize < 1 || fontSize > 72) {
        setStatus?.("글자 크기는 1pt 이상 72pt 이하로 입력하세요.", "warning");
        syncEditorToolbarFontSizeControls({
          fontSizeElement,
          fontSize: defaultFontSize,
          defaultFontSize,
        });
        return;
      }

      if (applyTableSelectionFontSize?.(fontSize)) {
        syncEditorToolbarFontSizeControls({
          fontSizeElement,
          fontSize,
          defaultFontSize,
        });
        return;
      }

      applySharedEditorCommand({
        rootElement,
        focusElement,
        restoreSelection,
        syncContent,
        command: "fontSizePx",
        value: fontSize,
        fontSizeElement,
        defaultFontSize,
        setStatus,
        syncOptions,
      });
    }

    return Object.freeze({
      applySharedEditorCommand,
      applySharedEditorFontFamily,
      applySharedEditorFontSize,
    });
  }

  return Object.freeze({
    createSharedEditorCommandHelpers,
  });
});

})();
