(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalScope);
    return;
  }

  globalScope.ExamListTemplateEditorToolbarInteractions = factory(globalScope);
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  const toolbarRenderingModule = globalScope.ExamListTemplateEditorToolbarRendering;
  const toolbarColorInteractionsModule = globalScope.ExamListTemplateEditorToolbarColorInteractions;

  if (!toolbarRenderingModule?.createTemplateEditorToolbarRenderingController) {
    throw new Error("client/features/template-editor/toolbar-rendering.js must be loaded before toolbar-interactions.js.");
  }

  if (!toolbarColorInteractionsModule?.createTemplateEditorToolbarColorInteractionController) {
    throw new Error("client/features/template-editor/toolbar-color-interactions.js must be loaded before toolbar-interactions.js.");
  }

  const { createTemplateEditorToolbarRenderingController } = toolbarRenderingModule;
  const { createTemplateEditorToolbarColorInteractionController } = toolbarColorInteractionsModule;

  function createTemplateEditorToolbarInteractionController({
    TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
    TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
    applyTemplateEditorCommand,
    applyTemplateEditorFontFamily,
    applyTemplateEditorFontSize,
    applyTemplateTableSize,
    escapeAttribute,
    escapeHtml,
    getElementById,
    getTemplateEditorCellSplitConfig,
    getTemplateEditorModal,
    handleTemplateEditorInsert,
    handleTemplateTableAction,
    insertTemplateImageSource,
    insertTemplateTag,
    options,
    pageSettings,
    setTemplateEditorCellSplitPanelVisibility,
    setTemplateEditorStatus,
    shell,
    tagDefinitions,
    toolbar,
    toolbarElements,
    toolbarIds,
  }) {
    const {
      renderPagePropertiesPanel,
      renderTagPanel,
      renderToolbar,
    } = createTemplateEditorToolbarRenderingController({
      TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
      TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
      escapeAttribute,
      escapeHtml,
      getElementById,
      pageSettings,
      shell,
      tagDefinitions,
      toolbar,
      toolbarElements,
      toolbarIds,
    });
    const {
      applyToolbarColorTrigger,
      applyToolbarHexColorInput,
    } = createTemplateEditorToolbarColorInteractionController({
      applyTemplateEditorCommand,
      getElementById,
      handleTemplateTableAction,
      toolbar,
      toolbarIds,
    });

    function handleClick(event) {
      const target = event.target instanceof Element ? event.target : null;

      if (!target || !getTemplateEditorModal().contains(target)) {
        return;
      }

      if (target.closest("[data-editor-table-toolbar-group][aria-disabled='true']")) {
        event.preventDefault();
        return;
      }

      const fontSizeToggleTrigger = target.closest("[data-editor-font-size-toggle]");
      const fontSizeOptionTrigger = target.closest("[data-editor-font-size-option]");
      const fontFamilyToggleTrigger = target.closest("[data-editor-font-family-toggle]");
      const fontFamilyOptionTrigger = target.closest("[data-editor-font-family-option]");
      const borderSelectToggleTrigger = target.closest("[data-editor-border-select-toggle]");
      const borderSelectOptionTrigger = target.closest("[data-editor-border-select-option]");
      const borderWidthToggleTrigger = target.closest("[data-editor-border-width-toggle]");
      const borderWidthOptionTrigger = target.closest("[data-editor-border-width-option]");
      const cellPaddingToggleTrigger = target.closest("[data-editor-cell-padding-toggle]");
      const cellPaddingOptionTrigger = target.closest("[data-editor-cell-padding-option]");
      const colorToggleTrigger = target.closest("[data-editor-color-toggle]");
      const colorDirectTrigger = target.closest("[data-editor-color-direct]");
      const colorPresetTrigger = target.closest("[data-editor-color-preset]");
      const colorApplyTrigger = target.closest("[data-editor-color-apply]");
      const cellSplitStepTrigger = target.closest("[data-template-cell-split-step]");
      const cellSplitToggleTrigger = target.closest("[data-template-cell-split-toggle]");
      const cellSplitAxisTrigger = target.closest("[data-template-cell-split-axis-option]");
      const cellSplitConfirmTrigger = target.closest("[data-template-cell-split-confirm]");
      const commandTrigger = target.closest("[data-template-command]");
      const tableActionTrigger = target.closest("[data-template-table-action]");
      const tableSizeTrigger = target.closest("[data-template-table-size]");
      const insertTrigger = target.closest("[data-template-insert]");
      const tagTrigger = target.closest("[data-template-tag]");
      const openImageTrigger = target.closest("[data-template-open-image]");
      const imageInsertToggleTrigger = target.closest("[data-template-image-insert-toggle]");
      const schoolLogoTrigger = target.closest("[data-template-insert-school-logo]");

      if (fontFamilyToggleTrigger) {
        const inputId = fontFamilyToggleTrigger.dataset.editorFontFamilyToggle;
        const comboElement = fontFamilyToggleTrigger.closest(".template-toolbar-font-family-combo");
        const menuElement = comboElement?.querySelector(".template-toolbar-combo-menu");
        toolbar.setEditorToolbarFontFamilyMenuVisibility?.(inputId, menuElement?.classList.contains("hidden") ?? true);
        return;
      }

      if (fontFamilyOptionTrigger) {
        const comboMenu = fontFamilyOptionTrigger.closest(".template-toolbar-combo-menu");
        const inputId = comboMenu?.dataset.editorFontFamilyMenuFor || "";
        const fontFamily = fontFamilyOptionTrigger.dataset.editorFontFamilyOption || "";
        const inputElement = getElementById(inputId);

        if (inputElement) {
          inputElement.value = fontFamily;
          toolbar.syncEditorToolbarFontFamilyControls?.(inputElement, fontFamily);
        }

        if (inputId === toolbarIds.fontFamily) {
          applyTemplateEditorFontFamily(fontFamily);
        }

        toolbar.setEditorToolbarFontFamilyMenuVisibility?.(inputId, false);
        return;
      }

      if (fontSizeToggleTrigger) {
        const inputId = fontSizeToggleTrigger.dataset.editorFontSizeToggle;
        const comboElement = fontSizeToggleTrigger.closest(".template-toolbar-font-size-combo");
        const menuElement = comboElement?.querySelector(".template-toolbar-combo-menu");
        toolbar.setEditorToolbarFontSizeMenuVisibility(inputId, menuElement?.classList.contains("hidden") ?? true);
        return;
      }

      if (fontSizeOptionTrigger) {
        const comboMenu = fontSizeOptionTrigger.closest(".template-toolbar-combo-menu");
        const inputId = comboMenu?.dataset.editorFontSizeMenuFor || "";
        const fontSize = fontSizeOptionTrigger.dataset.editorFontSizeOption || "";
        const inputElement = getElementById(inputId);

        if (inputElement) {
          inputElement.value = fontSize;
        }

        if (inputId === toolbarIds.fontSize) {
          applyTemplateEditorFontSize(fontSize);
        }

        toolbar.setEditorToolbarFontSizeMenuVisibility(inputId, false);
        return;
      }

      if (borderSelectToggleTrigger) {
        const inputId = borderSelectToggleTrigger.dataset.editorBorderSelectToggle || "";
        const { menuElement } = toolbar.getEditorToolbarBorderSelectElements?.(inputId) || {};

        toolbar.setEditorToolbarBorderSelectMenuVisibility?.(inputId, menuElement?.classList.contains("hidden") ?? true);
        return;
      }

      if (borderSelectOptionTrigger) {
        const comboMenu = borderSelectOptionTrigger.closest(".template-toolbar-icon-select-menu");
        const inputId = comboMenu?.dataset.editorBorderSelectMenuFor || "";
        const value = borderSelectOptionTrigger.dataset.editorBorderSelectOption || "";

        if (inputId && value) {
          toolbar.applyEditorToolbarBorderSelectOption?.(inputId, value);
        }

        toolbar.setEditorToolbarBorderSelectMenuVisibility?.(inputId, false);
        return;
      }

      if (borderWidthToggleTrigger) {
        const inputId = borderWidthToggleTrigger.dataset.editorBorderWidthToggle || "";
        const { menuElement } = toolbar.getEditorToolbarBorderWidthComboElements?.(inputId) || {};

        toolbar.setEditorToolbarBorderWidthMenuVisibility?.(inputId, menuElement?.classList.contains("hidden") ?? true);
        return;
      }

      if (borderWidthOptionTrigger) {
        const comboMenu = borderWidthOptionTrigger.closest(".template-toolbar-combo-menu");
        const inputId = comboMenu?.dataset.editorBorderWidthMenuFor || "";
        const value = borderWidthOptionTrigger.dataset.editorBorderWidthOption || "";

        if (inputId && value) {
          toolbar.applyEditorToolbarBorderWidthOption?.(inputId, value);
        }

        toolbar.setEditorToolbarBorderWidthMenuVisibility?.(inputId, false);
        return;
      }

      if (cellPaddingToggleTrigger) {
        const inputId = cellPaddingToggleTrigger.dataset.editorCellPaddingToggle || "";
        const { menuElement } = toolbar.getEditorToolbarCellPaddingComboElements?.(inputId) || {};

        toolbar.setEditorToolbarCellPaddingMenuVisibility?.(inputId, menuElement?.classList.contains("hidden") ?? true);
        return;
      }

      if (cellPaddingOptionTrigger) {
        const comboMenu = cellPaddingOptionTrigger.closest(".template-toolbar-combo-menu");
        const inputId = comboMenu?.dataset.editorCellPaddingMenuFor || "";
        const value = cellPaddingOptionTrigger.dataset.editorCellPaddingOption || "";

        if (inputId && value !== "") {
          toolbar.applyEditorToolbarCellPaddingOption?.(inputId, value);
        }

        toolbar.setEditorToolbarCellPaddingMenuVisibility?.(inputId, false);
        return;
      }

      if (colorToggleTrigger) {
        const inputId = colorToggleTrigger.dataset.editorColorToggle || "";
        const { panelElement } = toolbar.getEditorToolbarColorPickerElements(inputId);
        toolbar.setEditorToolbarColorPanelVisibility(inputId, panelElement?.classList.contains("hidden") ?? true);
        return;
      }

      if (colorDirectTrigger) {
        const inputId = colorDirectTrigger.dataset.editorColorInput || "";
        const { inputElement } = toolbar.getEditorToolbarColorPickerElements(inputId);
        // Native color pickers focus their hidden input. Establish focus without
        // scrolling first so a transformed block editor stays inside its canvas.
        inputElement?.focus({ preventScroll: true });
        inputElement?.showPicker ? inputElement.showPicker() : inputElement?.click();
        return;
      }

      if (colorPresetTrigger || colorApplyTrigger) {
        applyToolbarColorTrigger(colorPresetTrigger || colorApplyTrigger);
        toolbar.closeAllEditorToolbarColorPanels();
        return;
      }

      if (cellSplitStepTrigger) {
        const nextStep = cellSplitStepTrigger.dataset.templateCellSplitStep;
        globalScope.ExamListEditorToolbarControls?.stepEditorToolbarNumberInput({
          inputElement: toolbarElements.cellSplitCount,
          direction: nextStep,
          minimum: 2,
        });
        globalScope.ExamListEditorToolbarControls?.focusEditorToolbarNumberInput(toolbarElements.cellSplitCount);
        return;
      }

      if (cellSplitToggleTrigger) {
        const nextOpen = toolbarElements.cellSplitPanel?.classList.contains("hidden") ?? true;
        setTemplateEditorCellSplitPanelVisibility(nextOpen);
        return;
      }

      if (cellSplitAxisTrigger) {
        event.preventDefault?.();

        const splitAxis = cellSplitAxisTrigger.dataset.templateCellSplitAxisOption === "row" ? "row" : "column";
        const panelElement = cellSplitAxisTrigger.closest(".template-toolbar-cell-split-panel") || toolbarElements.cellSplitPanel;
        const axisInput = panelElement?.querySelector?.(`input[type="radio"][value="${splitAxis}"]`);

        if (axisInput) {
          axisInput.checked = true;
        }
        return;
      }

      if (cellSplitConfirmTrigger) {
        const cellSplitConfig = getTemplateEditorCellSplitConfig?.();

        if (cellSplitConfig && handleTemplateTableAction("split-cell", cellSplitConfig)) {
          setTemplateEditorCellSplitPanelVisibility(false);
        }
        return;
      }

      if (commandTrigger) {
        applyTemplateEditorCommand(commandTrigger.dataset.templateCommand);
        return;
      }

      if (tableActionTrigger) {
        handleTemplateTableAction(tableActionTrigger.dataset.templateTableAction);
        return;
      }

      if (tableSizeTrigger) {
        applyTemplateTableSize();
        return;
      }

      if (insertTrigger) {
        handleTemplateEditorInsert(insertTrigger.dataset.templateInsert);
        return;
      }

      if (tagTrigger) {
        insertTemplateTag(tagTrigger.dataset.templateTag);
        return;
      }

      if (imageInsertToggleTrigger) {
        const panelId = imageInsertToggleTrigger.dataset.templateImageInsertToggle || "";
        const { panelElement } = toolbar.getEditorToolbarTableInsertPopoverElements?.(panelId) || {};

        toolbar.setEditorToolbarTableInsertPanelVisibility?.(panelId, panelElement?.classList.contains("hidden") ?? true);
        return;
      }

      if (schoolLogoTrigger) {
        const logoDataUrl =
          typeof options.getSchoolLogoDataUrl === "function"
            ? options.getSchoolLogoDataUrl()
            : options.schoolLogoDataUrl;

        toolbar.closeAllEditorToolbarTableInsertPanels?.();

        if (!String(logoDataUrl || "").trim()) {
          setTemplateEditorStatus("학교 설정에 등록된 로고가 없습니다.", "warning");
          return;
        }

        insertTemplateImageSource(logoDataUrl, "학교 로고");
        return;
      }

      if (openImageTrigger) {
        toolbar.closeAllEditorToolbarTableInsertPanels?.();
        toolbarElements.imageInput?.click();
      }
    }

    return Object.freeze({
      applyToolbarColorTrigger,
      applyToolbarHexColorInput,
      handleClick,
      renderPagePropertiesPanel,
      renderTagPanel,
      renderToolbar,
    });
  }

  return Object.freeze({
    createTemplateEditorToolbarInteractionController,
  });
});

})();
