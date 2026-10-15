(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalScope);
    return;
  }

  globalScope.ExamListEditorTableUtils = factory(globalScope);
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  const tableCellUtils = globalScope.ExamListEditorTableCellUtils;
  const tableSizingUtils = globalScope.ExamListEditorTableSizingUtils;
  const tableNormalizationUtils = globalScope.ExamListEditorTableNormalizationUtils;

  if (!tableCellUtils || !tableSizingUtils || !tableNormalizationUtils) {
    throw new Error("table cell, sizing, and normalization utils must be loaded before client/features/editor/table-utils.js.");
  }

  return Object.freeze({
    TEMPLATE_EDITOR_TABLE_MIN_SIZE: tableCellUtils.TEMPLATE_EDITOR_TABLE_MIN_SIZE,
    applyTemplateTableCellPresentation: tableCellUtils.applyTemplateTableCellPresentation,
    buildTemplateTableCellMap: tableCellUtils.buildTemplateTableCellMap,
    ensureTemplateEditorTableColGroup: tableSizingUtils.ensureTemplateEditorTableColGroup,
    getTemplateEditorMeasuredColumnWidth: tableCellUtils.getTemplateEditorMeasuredColumnWidth,
    getTemplateEditorTableColumnCount: tableCellUtils.getTemplateEditorTableColumnCount,
    normalizeTemplateEditorTableAppearance: tableNormalizationUtils.normalizeTemplateEditorTableAppearance,
    normalizeTemplateEditorTables: tableNormalizationUtils.normalizeTemplateEditorTables,
    parseTemplateEditorPixelStyle: tableCellUtils.parseTemplateEditorPixelStyle,
    syncTemplateEditorTableWidth: tableSizingUtils.syncTemplateEditorTableWidth,
  });
});

})();
