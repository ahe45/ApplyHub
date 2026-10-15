(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorToolbarRendering = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorToolbarRenderingController({
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
  }) {
    function refreshToolbarElements() {
      Object.assign(toolbarElements, {
        blockType: getElementById(toolbarIds.blockType),
        borderColor: getElementById(toolbarIds.borderColor),
        borderStyle: getElementById(toolbarIds.borderStyle),
        borderTarget: getElementById(toolbarIds.borderTarget),
        borderWidth: getElementById(toolbarIds.borderWidth),
        cellPaddingBottom: getElementById(toolbarIds.cellPaddingBottom),
        cellPaddingLeft: getElementById(toolbarIds.cellPaddingLeft),
        cellPaddingRight: getElementById(toolbarIds.cellPaddingRight),
        cellPaddingTop: getElementById(toolbarIds.cellPaddingTop),
        cellSplitCount: getElementById(toolbarIds.cellSplitCount),
        cellSplitPanel: getElementById(toolbarIds.cellSplitPanel),
        cellShading: getElementById(toolbarIds.cellShading),
        cellWidth: getElementById(toolbarIds.cellWidth),
        fontFamily: getElementById(toolbarIds.fontFamily),
        fontSize: getElementById(toolbarIds.fontSize),
        imageInput: getElementById(toolbarIds.imageInput),
        rowHeight: getElementById(toolbarIds.rowHeight),
        sizeScope: getElementById(toolbarIds.sizeScope),
        tableColumns: getElementById(toolbarIds.tableColumns),
        tableInsertPanel: getElementById(toolbarIds.tableInsertPanel),
        tableRows: getElementById(toolbarIds.tableRows),
        textColor: getElementById(toolbarIds.textColor),
        textShading: getElementById(toolbarIds.textShading),
      });
    }

    function renderToolbar() {
      shell.toolbarHost.innerHTML = toolbar.renderEditorToolbarInner({
        commandAttr: "data-template-command",
        tableActionAttr: "data-template-table-action",
        insertAttr: "data-template-insert",
        openImageAttr: "data-template-open-image",
        tableInsertLocation: "insert-group",
        tableLayout: "notice",
        fontFamilyId: toolbarIds.fontFamily,
        fontFamilyValue: TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
        fontSizeId: toolbarIds.fontSize,
        fontSizeValue: TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
        textColorId: toolbarIds.textColor,
        textColorValue: toolbar.EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR || "#000000",
        textShadingId: toolbarIds.textShading,
        cellShadingId: toolbarIds.cellShading,
        tableInsertPanelId: toolbarIds.tableInsertPanel,
        tableRowsId: toolbarIds.tableRows,
        tableColumnsId: toolbarIds.tableColumns,
        cellSplitPanelId: toolbarIds.cellSplitPanel,
        cellSplitCountId: toolbarIds.cellSplitCount,
        cellSplitAxisName: toolbarIds.cellSplitAxisName,
        cellSplitAxisRowId: toolbarIds.cellSplitAxisRow,
        cellSplitAxisColumnId: toolbarIds.cellSplitAxisColumn,
        borderTargetId: toolbarIds.borderTarget,
        borderStyleId: toolbarIds.borderStyle,
        borderWidthId: toolbarIds.borderWidth,
        borderColorId: toolbarIds.borderColor,
        cellPaddingTopId: toolbarIds.cellPaddingTop,
        cellPaddingRightId: toolbarIds.cellPaddingRight,
        cellPaddingBottomId: toolbarIds.cellPaddingBottom,
        cellPaddingLeftId: toolbarIds.cellPaddingLeft,
        cellWidthId: toolbarIds.cellWidth,
        rowHeightId: toolbarIds.rowHeight,
        sizeScopeId: toolbarIds.sizeScope,
        imageInputId: toolbarIds.imageInput,
        imageInsertPanelId: toolbarIds.imageInsertPanel,
      });
      refreshToolbarElements();
    }

    function renderTagPanel() {
      if (!shell.tagHost) {
        return;
      }

      shell.tagHost.innerHTML = tagDefinitions
        .map((definition) => {
          const editorToken = String(definition.editorToken || definition.token || "").trim();

          if (!editorToken) {
            return "";
          }

          return `<button class="template-tag-button" data-template-tag="${escapeAttribute(editorToken)}" type="button">${escapeHtml(
            editorToken,
          )}</button>`;
        })
        .join("");
    }

    function renderPagePropertiesPanel() {
      if (!shell.pagePropertiesHost) {
        return;
      }

      shell.pagePropertiesHost.innerHTML = pageSettings.renderTemplatePagePropertiesPanel({
        ids: {
          size: toolbarIds.pageSize,
          orientationName: toolbarIds.pageOrientationName,
          orientationPortrait: toolbarIds.pageOrientationPortrait,
          orientationLandscape: toolbarIds.pageOrientationLandscape,
          marginTop: toolbarIds.pageMarginTop,
          marginRight: toolbarIds.pageMarginRight,
          marginBottom: toolbarIds.pageMarginBottom,
          marginLeft: toolbarIds.pageMarginLeft,
        },
      });
    }

    return Object.freeze({
      renderPagePropertiesPanel,
      renderTagPanel,
      renderToolbar,
    });
  }

  return Object.freeze({
    createTemplateEditorToolbarRenderingController,
  });
});

})();
