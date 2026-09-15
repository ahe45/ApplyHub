(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardTemplateEditorToolbarState = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorToolbarStateController({
    TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
    TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
    getTemplateEditorActiveTableSelection,
    getTemplateEditorBorderColorElement,
    getTemplateEditorBorderStyleElement,
    getTemplateEditorBorderTargetElement,
    getTemplateEditorBorderWidthElement,
    getTemplateEditorCellShadingElement,
    getTemplateEditorCellShadingValue,
    getTemplateEditorCellWidthElement,
    getTemplateEditorFontFamilyElement,
    getTemplateEditorFontSizeElement,
    getTemplateEditorModal,
    getTemplateEditorPixelValue,
    getTemplateEditorRowHeightElement,
    getTemplateEditorSelectedCell,
    getTemplateEditorSelectionNode,
    getTemplateEditorSurface,
    getTemplateEditorTextColorElement,
    getTemplateEditorTextShadingElement,
    syncEditorToolbarBorderSelectControl,
    syncEditorToolbarColorControls,
    updateEditorToolbarFormattingState,
  }) {
    function syncTemplateTableVerticalAlignButtons(selectedCell) {
      const templateEditorModal = getTemplateEditorModal();

      if (!templateEditorModal) {
        return;
      }

      const activeValue = selectedCell
        ? (() => {
            const computedValue = String(selectedCell.style.verticalAlign || window.getComputedStyle(selectedCell).verticalAlign || "")
              .trim()
              .toLowerCase();
            return computedValue === "bottom" ? "bottom" : computedValue === "middle" ? "middle" : "top";
          })()
        : "";

      templateEditorModal
        .querySelectorAll("[data-template-table-action^='cell-vertical-align-']")
        .forEach((buttonElement) => {
          const buttonValue = String(buttonElement.dataset.templateTableAction || "").replace("cell-vertical-align-", "");
          const isActive = activeValue !== "" && buttonValue === activeValue;

          buttonElement.classList.toggle("is-active", isActive);
          buttonElement.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    }

    function getTemplateEditorFormattingTargetCells() {
      const tableSelection = getTemplateEditorActiveTableSelection();
      const templateEditorSurface = getTemplateEditorSurface();

      if (!tableSelection?.selectedCells?.length || !templateEditorSurface) {
        return [];
      }

      return tableSelection.selectedCells.filter((cell) => templateEditorSurface.contains(cell));
    }

    function getTemplateEditorBorderControlSide(borderTargetElement) {
      const targetValue = String(borderTargetElement?.value || "").trim();
      return ["top", "right", "bottom", "left"].includes(targetValue) ? targetValue : "top";
    }

    function getTemplateEditorBorderStyleProperty(side, suffix) {
      return `border${side[0].toUpperCase()}${side.slice(1)}${suffix}`;
    }

    function updateTemplateEditorFormattingControls() {
      const templateEditorSurface = getTemplateEditorSurface();
      const templateEditorModal = getTemplateEditorModal();
      const templateEditorFontFamily = getTemplateEditorFontFamilyElement();
      const templateEditorFontSize = getTemplateEditorFontSizeElement();
      const templateEditorTextColor = getTemplateEditorTextColorElement();
      const templateEditorTextShading = getTemplateEditorTextShadingElement();

      if (
        !templateEditorSurface ||
        !templateEditorModal ||
        templateEditorModal.classList.contains("hidden") ||
        document.activeElement === templateEditorFontFamily ||
        document.activeElement === templateEditorFontSize ||
        document.activeElement === templateEditorTextColor ||
        document.activeElement === templateEditorTextShading
      ) {
        return;
      }

      const selectionNode = getTemplateEditorSelectionNode();
      const contextElement = getTemplateEditorFormattingTargetCells()[0] || getTemplateEditorSelectedCell();

      updateEditorToolbarFormattingState({
        rootElement: templateEditorSurface,
        commandAttributeName: "data-template-command",
        fontFamilyElement: templateEditorFontFamily,
        fontSizeElement: templateEditorFontSize,
        textColorElement: templateEditorTextColor,
        textShadingElement: templateEditorTextShading,
        selectionNode,
        contextElement,
        defaultFontFamily: TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
        defaultFontSize: TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
      });
    }

    function updateTemplateTableControls() {
      const templateEditorModal = getTemplateEditorModal();
      const templateEditorBorderColor = getTemplateEditorBorderColorElement?.();
      const templateEditorBorderStyle = getTemplateEditorBorderStyleElement?.();
      const templateEditorBorderTarget = getTemplateEditorBorderTargetElement?.();
      const templateEditorBorderWidth = getTemplateEditorBorderWidthElement?.();
      const templateEditorCellWidth = getTemplateEditorCellWidthElement();
      const templateEditorRowHeight = getTemplateEditorRowHeightElement();
      const templateEditorCellShading = getTemplateEditorCellShadingElement();
      const activeElement = document.activeElement instanceof Element ? document.activeElement : null;
      const isActiveBorderDropdown =
        Boolean(activeElement?.closest(".template-toolbar-icon-select")) ||
        Boolean(templateEditorModal?.querySelector(".template-toolbar-icon-select.open"));
      const hasDirtyBorderControl = [
        templateEditorBorderColor,
        templateEditorBorderStyle,
        templateEditorBorderTarget,
        templateEditorBorderWidth,
      ].some((element) => element?.dataset?.editorBorderUserValue === "true");

      if (
        !templateEditorModal ||
        templateEditorModal.classList.contains("hidden") ||
        document.activeElement === templateEditorBorderColor ||
        document.activeElement === templateEditorBorderStyle ||
        document.activeElement === templateEditorBorderTarget ||
        document.activeElement === templateEditorBorderWidth ||
        isActiveBorderDropdown ||
        hasDirtyBorderControl ||
        document.activeElement === templateEditorCellWidth ||
        document.activeElement === templateEditorRowHeight ||
        document.activeElement === templateEditorCellShading
      ) {
        return;
      }

      const selectedCell = getTemplateEditorSelectedCell();

      if (templateEditorCellWidth) {
        templateEditorCellWidth.value = getTemplateEditorPixelValue(selectedCell, "width");
      }

      if (templateEditorRowHeight) {
        templateEditorRowHeight.value = getTemplateEditorPixelValue(selectedCell, "height");
      }

      if (templateEditorCellShading) {
        syncEditorToolbarColorControls({
          colorInputElement: templateEditorCellShading,
          colorValue: getTemplateEditorCellShadingValue(selectedCell),
          fallbackValue: "#ffffff",
        });
      }

      const borderControlSide = getTemplateEditorBorderControlSide(templateEditorBorderTarget);

      if (templateEditorBorderWidth && selectedCell) {
        const computedStyle = window.getComputedStyle(selectedCell);
        const widthProperty = getTemplateEditorBorderStyleProperty(borderControlSide, "Width");
        const styleProperty = getTemplateEditorBorderStyleProperty(borderControlSide, "Style");
        const borderStyle = String(selectedCell.style[styleProperty] || computedStyle[styleProperty] || "solid");
        const actualBorderWidth = Number.parseFloat(selectedCell.style[widthProperty] || computedStyle[widthProperty] || "1");
        const borderWidth = borderStyle === "double" && Number.isFinite(actualBorderWidth)
          ? Math.max(1, actualBorderWidth - 2)
          : actualBorderWidth;
        templateEditorBorderWidth.value = String(Number.isFinite(borderWidth) ? Math.max(0, Math.round(borderWidth)) : 1);
      }

      if (templateEditorBorderStyle && selectedCell) {
        const styleProperty = getTemplateEditorBorderStyleProperty(borderControlSide, "Style");
        const borderStyle = String(selectedCell.style[styleProperty] || window.getComputedStyle(selectedCell)[styleProperty] || "solid");
        templateEditorBorderStyle.value = ["solid", "dashed", "dotted", "double", "none"].includes(borderStyle) ? borderStyle : "solid";
        syncEditorToolbarBorderSelectControl?.(templateEditorBorderStyle);
      }

      if (templateEditorBorderColor && selectedCell) {
        const colorProperty = getTemplateEditorBorderStyleProperty(borderControlSide, "Color");
        syncEditorToolbarColorControls({
          colorInputElement: templateEditorBorderColor,
          colorValue: selectedCell.style[colorProperty] || window.getComputedStyle(selectedCell)[colorProperty],
          fallbackValue: "#000000",
        });
      }

      if (templateEditorBorderTarget && !templateEditorBorderTarget.value) {
        templateEditorBorderTarget.value = "all";
      }

      syncEditorToolbarBorderSelectControl?.(templateEditorBorderTarget);
      syncTemplateTableVerticalAlignButtons(selectedCell);
    }

    return Object.freeze({
      getTemplateEditorFormattingTargetCells,
      updateTemplateEditorFormattingControls,
      updateTemplateTableControls,
    });
  }

  return Object.freeze({
    createTemplateEditorToolbarStateController,
  });
});
