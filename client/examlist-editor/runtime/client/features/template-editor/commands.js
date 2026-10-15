(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory({
      insertionModule: require("./commands-insertion"),
      toolbarControlsModule: require("../editor/toolbar-controls"),
    });
    return;
  }

  globalScope.ExamListTemplateEditorCommands = factory({
    insertionModule: globalScope.ExamListTemplateEditorCommandInsertion,
    toolbarControlsModule: globalScope.ExamListEditorToolbarControls,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, ({ insertionModule, toolbarControlsModule }) => {
  if (!insertionModule?.createTemplateEditorInsertionController) {
    throw new Error("client/features/template-editor/commands-insertion.js must be loaded before commands.js.");
  }

  if (!toolbarControlsModule) {
    throw new Error("client/features/editor/toolbar-controls.js must be loaded before commands.js.");
  }

  const { createTemplateEditorInsertionController } = insertionModule;
  const {
    getEditorToolbarCellSplitConfig,
    getEditorToolbarTableInsertConfig,
    setEditorToolbarManagedPanelVisibility,
  } = toolbarControlsModule;

  function createTemplateEditorCommandController({
    buildTemplateEditorTableMarkup,
    buildTemplateGeneratedObjectMarkup,
    buildTemplateTokenHtml,
    escapeAttribute,
    getTemplateEditorCellSplitCountInput,
    getTemplateEditorCellSplitPanel,
    getTemplateEditorSurface,
    getTemplateEditorTableColumnsInput,
    getTemplateEditorTableInsertPanel,
    getTemplateEditorTableRowsInput,
    getTemplatePreviewExaminee,
    placeCaretAtEnd,
    restoreTemplateEditorSelection,
    setEditorToolbarTableInsertPanelVisibility,
    setTemplateEditorStatus,
    state,
    syncTemplateEditorContent,
  }) {
    function setTemplateEditorTableInsertPanelVisibility(isVisible) {
      const tableInsertPanel = getTemplateEditorTableInsertPanel?.();

      setEditorToolbarManagedPanelVisibility({
        panelId: tableInsertPanel?.id || "templateEditorTableInsertPanel",
        isVisible,
        getPanelElement: () => tableInsertPanel || getTemplateEditorTableInsertPanel?.(),
        setEditorToolbarTableInsertPanelVisibility,
      });
    }

    function setTemplateEditorCellSplitPanelVisibility(isVisible) {
      const cellSplitPanel = getTemplateEditorCellSplitPanel?.();

      setEditorToolbarManagedPanelVisibility({
        panelId: cellSplitPanel?.id || "templateEditorCellSplitPanel",
        isVisible,
        getPanelElement: () => cellSplitPanel || getTemplateEditorCellSplitPanel?.(),
        setEditorToolbarTableInsertPanelVisibility,
      });
    }

    function getTemplateEditorTableInsertConfig() {
      return getEditorToolbarTableInsertConfig({
        rowInputElement: getTemplateEditorTableRowsInput(),
        columnInputElement: getTemplateEditorTableColumnsInput(),
        setStatus: setTemplateEditorStatus,
      });
    }

    function getTemplateEditorCellSplitConfig() {
      const cellSplitPanel = getTemplateEditorCellSplitPanel?.();
      const checkedAxis = cellSplitPanel?.querySelector?.('input[type="radio"][name]:checked') || null;
      const fallbackAxis = cellSplitPanel?.querySelector?.('input[type="radio"][value="column"]') || null;

      return getEditorToolbarCellSplitConfig({
        countInputElement: getTemplateEditorCellSplitCountInput(),
        axisName: checkedAxis?.name || fallbackAxis?.name || "templateEditorCellSplitAxis",
        axisFallbackId: fallbackAxis?.id || "templateEditorCellSplitAxisColumn",
        setStatus: setTemplateEditorStatus,
      });
    }

    const {
      insertTemplateHtml,
      insertTemplateImage,
      insertTemplateImageSource,
      insertTemplateTag,
    } = createTemplateEditorInsertionController({
      buildTemplateTokenHtml,
      escapeAttribute,
      getTemplateEditorSurface,
      placeCaretAtEnd,
      restoreTemplateEditorSelection,
      setTemplateEditorStatus,
      state,
      syncTemplateEditorContent,
    });

    function handleTemplateEditorInsert(insertType) {
      const templateEditorTableRows = getTemplateEditorTableRowsInput();

      if (insertType === "table") {
        setTemplateEditorTableInsertPanelVisibility(true);

        templateEditorTableRows?.focus();
        templateEditorTableRows?.select();
        return;
      }

      if (insertType === "table-confirm") {
        const tableInsertConfig = getTemplateEditorTableInsertConfig();

        if (!tableInsertConfig) {
          return;
        }

        window.setTimeout(() => {
          const didInsertTable = insertTemplateHtml(
            buildTemplateEditorTableMarkup(tableInsertConfig.rowCount, tableInsertConfig.columnCount),
          );

          if (didInsertTable !== false) {
            setTemplateEditorTableInsertPanelVisibility(false);
          }
        }, 0);
        return;
      }

      if (insertType === "rule") {
        insertTemplateHtml("<hr /><p></p>");
        setTemplateEditorTableInsertPanelVisibility(false);
        return;
      }

      if (insertType === "barcode" || insertType === "qrcode") {
        insertTemplateHtml(buildTemplateGeneratedObjectMarkup(insertType, { getPreviewExaminee: getTemplatePreviewExaminee }));
        setTemplateEditorTableInsertPanelVisibility(false);
      }
    }

    return Object.freeze({
      getTemplateEditorCellSplitConfig,
      getTemplateEditorTableInsertConfig,
      handleTemplateEditorInsert,
      insertTemplateHtml,
      insertTemplateImage,
      insertTemplateImageSource,
      insertTemplateTag,
      setTemplateEditorCellSplitPanelVisibility,
      setTemplateEditorTableInsertPanelVisibility,
    });
  }

  return Object.freeze({
    createTemplateEditorCommandController,
  });
});

})();
