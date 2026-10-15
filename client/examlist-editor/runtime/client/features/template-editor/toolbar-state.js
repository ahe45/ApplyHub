(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorToolbarState = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const TEMPLATE_EDITOR_CSS_PIXELS_PER_POINT = 96 / 72;

  function formatTemplateEditorToolbarPointValue(value) {
    const roundedValue = Math.round(value * 10) / 10;
    return Number.isInteger(roundedValue) ? String(roundedValue) : roundedValue.toFixed(1).replace(/\.0$/, "");
  }

  function parseTemplateEditorToolbarPointValue(rawValue, fallbackValue = "") {
    const trimmedValue = String(rawValue || "").trim();

    if (!trimmedValue) {
      return fallbackValue;
    }

    const numericValue = Number.parseFloat(trimmedValue);

    if (!Number.isFinite(numericValue)) {
      return fallbackValue;
    }

    if (/pt$/i.test(trimmedValue)) {
      return formatTemplateEditorToolbarPointValue(Math.max(0, numericValue));
    }

    return formatTemplateEditorToolbarPointValue(Math.max(0, numericValue / TEMPLATE_EDITOR_CSS_PIXELS_PER_POINT));
  }

  function createTemplateEditorToolbarStateController({
    TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
    TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
    getTemplateEditorActiveTableSelection,
    getTemplateEditorBorderColorElement,
    getTemplateEditorBorderStyleElement,
    getTemplateEditorBorderTargetElement,
    getTemplateEditorBorderWidthElement,
    getTemplateEditorCellPaddingBottomElement,
    getTemplateEditorCellPaddingLeftElement,
    getTemplateEditorCellPaddingRightElement,
    getTemplateEditorCellPaddingTopElement,
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
    syncEditorToolbarBorderWidthControl,
    syncEditorToolbarCellPaddingControl,
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

    function closeTemplateTableToolbarPanels(tableGroupElement) {
      tableGroupElement
        ?.querySelectorAll?.(".template-toolbar-table-insert-popover.open")
        .forEach((popoverElement) => {
          popoverElement.classList.remove("open");
          popoverElement.querySelector(".template-toolbar-table-insert-toggle")?.setAttribute("aria-expanded", "false");
          popoverElement.querySelector(".template-table-insert-panel")?.classList.add("hidden");
        });

      tableGroupElement
        ?.querySelectorAll?.(".template-toolbar-color-picker.open")
        .forEach((pickerElement) => {
          pickerElement.classList.remove("open");
          pickerElement.querySelector(".template-toolbar-color-trigger")?.setAttribute("aria-expanded", "false");
          pickerElement.querySelector(".template-toolbar-color-panel")?.classList.add("hidden");
        });

      tableGroupElement
        ?.querySelectorAll?.(".template-toolbar-icon-select.open")
        .forEach((selectElement) => {
          selectElement.classList.remove("open");
          selectElement.querySelector(".template-toolbar-icon-select-button")?.setAttribute("aria-expanded", "false");
          selectElement.querySelector(".template-toolbar-icon-select-menu")?.classList.add("hidden");
        });

      tableGroupElement
        ?.querySelectorAll?.(".template-toolbar-border-width-combo.open")
        .forEach((comboElement) => {
          comboElement.classList.remove("open", "open-up", "open-down");
          comboElement.querySelector("[data-editor-border-width-toggle]")?.setAttribute("aria-expanded", "false");
          comboElement.querySelector(".template-toolbar-combo-menu")?.classList.add("hidden");
        });

      tableGroupElement
        ?.querySelectorAll?.(".template-toolbar-cell-padding-combo.open")
        .forEach((comboElement) => {
          comboElement.classList.remove("open", "open-up", "open-down");
          comboElement.querySelector("[data-editor-cell-padding-toggle]")?.setAttribute("aria-expanded", "false");
          comboElement.querySelector(".template-toolbar-combo-menu")?.classList.add("hidden");
        });
    }

    function getTemplateEditorCellPaddingElements() {
      return [
        getTemplateEditorCellPaddingTopElement?.(),
        getTemplateEditorCellPaddingRightElement?.(),
        getTemplateEditorCellPaddingBottomElement?.(),
        getTemplateEditorCellPaddingLeftElement?.(),
      ].filter(Boolean);
    }

    function setTemplateEditorCellPaddingControlsDisabled(isDisabled) {
      getTemplateEditorCellPaddingElements().forEach((inputElement) => {
        const controlElement = inputElement.closest?.(".template-toolbar-cell-padding-control") || null;
        const comboElement = inputElement.closest?.(".template-toolbar-cell-padding-combo") || null;
        const toggleElement = comboElement?.querySelector?.("[data-editor-cell-padding-toggle]") || null;

        if (isDisabled) {
          inputElement.value = "";
          syncEditorToolbarCellPaddingControl?.(inputElement, "");
        }

        inputElement.disabled = isDisabled;
        if (toggleElement) {
          toggleElement.disabled = isDisabled;
          toggleElement.setAttribute("aria-disabled", isDisabled ? "true" : "false");
        }
        controlElement?.classList.toggle("is-disabled", isDisabled);
        controlElement?.classList.toggle("is-empty", isDisabled && !String(inputElement.value || "").trim());
        controlElement?.setAttribute("aria-disabled", isDisabled ? "true" : "false");
      });
    }

    function setTemplateTableToolbarDisabled(isDisabled) {
      const tableGroupElement = getTemplateEditorModal()?.querySelector?.("[data-editor-table-toolbar-group]");

      if (!tableGroupElement) {
        return;
      }

      tableGroupElement.classList.toggle("is-disabled", isDisabled);
      tableGroupElement.setAttribute("aria-disabled", isDisabled ? "true" : "false");

      tableGroupElement.querySelectorAll("button, input, select, textarea").forEach((controlElement) => {
        if ("disabled" in controlElement) {
          controlElement.disabled = isDisabled;
        }

        controlElement.setAttribute("aria-disabled", isDisabled ? "true" : "false");
      });
      setTemplateEditorCellPaddingControlsDisabled(isDisabled);

      if (isDisabled) {
        closeTemplateTableToolbarPanels(tableGroupElement);
      }
    }

    function getTemplateEditorBorderControlSide(borderTargetElement) {
      const targetValue = String(borderTargetElement?.value || "").trim();
      return ["top", "right", "bottom", "left"].includes(targetValue) ? targetValue : "top";
    }

    function getTemplateEditorBorderStyleProperty(side, suffix) {
      return `border${side[0].toUpperCase()}${side.slice(1)}${suffix}`;
    }

    function getTemplateEditorCellPaddingValue(selectedCell, propertyName) {
      if (!selectedCell) {
        return "";
      }

      const computedStyle = window.getComputedStyle(selectedCell);
      const value = Number.parseFloat(computedStyle[propertyName]);
      return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : "";
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
      const selectedCell = getTemplateEditorSelectedCell();
      const tableFormattingCells = getTemplateEditorFormattingTargetCells();
      const selectionElement =
        selectionNode instanceof Element ? selectionNode : selectionNode?.parentElement || null;
      const shouldUseSelectedCellAsTextContext =
        !selectionNode ||
        selectionNode === selectedCell ||
        selectionElement === selectedCell;
      const contextElement = tableFormattingCells[0] || (shouldUseSelectedCellAsTextContext ? selectedCell : null);

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

      if (templateEditorFontSize) {
        templateEditorFontSize.dataset.templateEditorCurrentFontSize = `${templateEditorFontSize.value}pt`;
      }
    }

    function updateTemplateTableControls() {
      const templateEditorModal = getTemplateEditorModal();
      const templateEditorSurface = getTemplateEditorSurface();
      const templateEditorBorderColor = getTemplateEditorBorderColorElement?.();
      const templateEditorBorderStyle = getTemplateEditorBorderStyleElement?.();
      const templateEditorBorderTarget = getTemplateEditorBorderTargetElement?.();
      const templateEditorBorderWidth = getTemplateEditorBorderWidthElement?.();
      const templateEditorCellPaddingBottom = getTemplateEditorCellPaddingBottomElement?.();
      const templateEditorCellPaddingLeft = getTemplateEditorCellPaddingLeftElement?.();
      const templateEditorCellPaddingRight = getTemplateEditorCellPaddingRightElement?.();
      const templateEditorCellPaddingTop = getTemplateEditorCellPaddingTopElement?.();
      const templateEditorCellWidth = getTemplateEditorCellWidthElement();
      const templateEditorRowHeight = getTemplateEditorRowHeightElement();
      const templateEditorCellShading = getTemplateEditorCellShadingElement();
      const activeElement = document.activeElement instanceof Element ? document.activeElement : null;
      const selectedCell = getTemplateEditorSelectedCell();
      const hasActiveTableCell = Boolean(selectedCell && templateEditorSurface?.contains(selectedCell));

      if (templateEditorModal && !templateEditorModal.classList.contains("hidden")) {
        setTemplateTableToolbarDisabled(!hasActiveTableCell);
      }

      const isActiveBorderDropdown =
        Boolean(activeElement?.closest(".template-toolbar-icon-select, .template-toolbar-border-width-combo, .template-toolbar-cell-padding-combo")) ||
        Boolean(templateEditorModal?.querySelector(".template-toolbar-icon-select.open, .template-toolbar-border-width-combo.open, .template-toolbar-cell-padding-combo.open"));
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
        document.activeElement === templateEditorCellPaddingBottom ||
        document.activeElement === templateEditorCellPaddingLeft ||
        document.activeElement === templateEditorCellPaddingRight ||
        document.activeElement === templateEditorCellPaddingTop ||
        isActiveBorderDropdown ||
        hasDirtyBorderControl ||
        document.activeElement === templateEditorCellWidth ||
        document.activeElement === templateEditorRowHeight ||
        document.activeElement === templateEditorCellShading
      ) {
        return;
      }

      const cells = getTemplateEditorActiveTableSelection()?.selectedCells?.length
        ? getTemplateEditorActiveTableSelection().selectedCells : selectedCell ? [selectedCell] : [];
      const commonValue = read => {
        const values = cells.map(read);
        return values.length && values.every(value => value === values[0]) ? values[0] : values.length ? "mixed" : "";
      };
      [[templateEditorCellWidth, "width"], [templateEditorRowHeight, "height"]].forEach(([input, dimension]) => {
        if (!input || document.activeElement === input) return;
        const value = commonValue(cell => getTemplateEditorPixelValue(cell, dimension));
        input.value = value === "mixed" ? "" : value;
        input.placeholder = value === "mixed" ? "혼합" : "";
      });

      if (templateEditorCellShading) {
        syncEditorToolbarColorControls({
          colorInputElement: templateEditorCellShading,
          colorValue: getTemplateEditorCellShadingValue(selectedCell),
          fallbackValue: "#ffffff",
        });
      }

      if (templateEditorCellPaddingTop) {
        const value = commonValue(cell => getTemplateEditorCellPaddingValue(cell, "paddingTop"));
        if (typeof syncEditorToolbarCellPaddingControl === "function") {
          syncEditorToolbarCellPaddingControl(templateEditorCellPaddingTop, value);
        } else {
          templateEditorCellPaddingTop.value = value;
        }
      }

      if (templateEditorCellPaddingRight) {
        const value = commonValue(cell => getTemplateEditorCellPaddingValue(cell, "paddingRight"));
        if (typeof syncEditorToolbarCellPaddingControl === "function") {
          syncEditorToolbarCellPaddingControl(templateEditorCellPaddingRight, value);
        } else {
          templateEditorCellPaddingRight.value = value;
        }
      }

      if (templateEditorCellPaddingBottom) {
        const value = commonValue(cell => getTemplateEditorCellPaddingValue(cell, "paddingBottom"));
        if (typeof syncEditorToolbarCellPaddingControl === "function") {
          syncEditorToolbarCellPaddingControl(templateEditorCellPaddingBottom, value);
        } else {
          templateEditorCellPaddingBottom.value = value;
        }
      }

      if (templateEditorCellPaddingLeft) {
        const value = commonValue(cell => getTemplateEditorCellPaddingValue(cell, "paddingLeft"));
        if (typeof syncEditorToolbarCellPaddingControl === "function") {
          syncEditorToolbarCellPaddingControl(templateEditorCellPaddingLeft, value);
        } else {
          templateEditorCellPaddingLeft.value = value;
        }
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
        const normalizedBorderWidth = Number.isFinite(borderWidth) ? Math.max(0, Math.min(3, Math.round(borderWidth * 2) / 2)) : 1;
        if (typeof syncEditorToolbarBorderWidthControl === "function") {
          syncEditorToolbarBorderWidthControl(templateEditorBorderWidth, normalizedBorderWidth);
        } else {
          templateEditorBorderWidth.value = String(normalizedBorderWidth);
        }
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

})();
