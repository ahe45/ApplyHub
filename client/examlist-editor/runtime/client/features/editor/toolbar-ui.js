(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalScope);
    return;
  }

  globalScope.ExamListEditorToolbarUi = factory(globalScope);
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  const floatingPanel = globalScope.ExamListEditorToolbarFloatingPanel;
  const colorUi = globalScope.ExamListEditorToolbarColorUi;
  const tableInsertUi = globalScope.ExamListEditorToolbarTableInsertUi;
  const fontSizeUi = globalScope.ExamListEditorToolbarFontSizeUi;
  const borderSelectUi = globalScope.ExamListEditorToolbarBorderSelectUi;

  if (!floatingPanel || !colorUi || !tableInsertUi || !fontSizeUi || !borderSelectUi) {
    throw new Error("editor toolbar UI submodules must be loaded before toolbar-ui.js.");
  }

  function createEditorToolbarUiController(deps) {
    let colorController = null;
    let tableInsertController = null;
    let fontSizeController = null;
    let borderSelectController = null;
    const { updateEditorToolbarFloatingPanelPlacement } = floatingPanel;
    const closeAllEditorToolbarColorPanels = (...args) => colorController?.closeAllEditorToolbarColorPanels(...args) || false;
    const closeAllEditorToolbarTableInsertPanels = (...args) =>
      tableInsertController?.closeAllEditorToolbarTableInsertPanels(...args) || false;
    const closeAllEditorToolbarFontSizeMenus = (...args) => fontSizeController?.closeAllEditorToolbarFontSizeMenus(...args) || false;
    const closeAllEditorToolbarFontFamilyMenus = (...args) =>
      fontSizeController?.closeAllEditorToolbarFontFamilyMenus(...args) || false;
    const closeAllEditorToolbarBorderSelectMenus = (...args) =>
      borderSelectController?.closeAllEditorToolbarBorderSelectMenus(...args) || false;

    colorController = colorUi.createEditorToolbarColorUiController({
      closeAllEditorToolbarBorderSelectMenus,
      closeAllEditorToolbarFontFamilyMenus,
      closeAllEditorToolbarFontSizeMenus,
      closeAllEditorToolbarTableInsertPanels,
      normalizeEditorToolbarColorValue: deps.normalizeEditorToolbarColorValue,
      updateEditorToolbarFloatingPanelPlacement,
    });
    tableInsertController = tableInsertUi.createEditorToolbarTableInsertUiController({
      closeAllEditorToolbarBorderSelectMenus,
      closeAllEditorToolbarColorPanels,
      closeAllEditorToolbarFontFamilyMenus,
      closeAllEditorToolbarFontSizeMenus,
    });
    fontSizeController = fontSizeUi.createEditorToolbarFontSizeUiController({
      closeAllEditorToolbarBorderSelectMenus,
      closeAllEditorToolbarColorPanels,
      closeAllEditorToolbarTableInsertPanels,
      isEditorToolbarPresetFontSize: deps.isEditorToolbarPresetFontSize,
    });
    borderSelectController = borderSelectUi.createEditorToolbarBorderSelectUiController({
      closeAllEditorToolbarColorPanels,
      closeAllEditorToolbarFontFamilyMenus,
      closeAllEditorToolbarFontSizeMenus,
      closeAllEditorToolbarTableInsertPanels,
      updateEditorToolbarFloatingPanelPlacement,
    });

    return Object.freeze({
      ...colorController,
      ...tableInsertController,
      ...fontSizeController,
      ...borderSelectController,
    });
  }

  return Object.freeze({
    createEditorToolbarUiController,
  });
});

})();
