(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory({
      loginNoticeCommandModule: require("./login-notice-commands"),
      loginNoticeSelectionModule: require("./login-notice-selection"),
    });
    return;
  }

  globalScope.AdmitCardLoginNoticeEditor = factory({
    loginNoticeCommandModule: globalScope.AdmitCardLoginNoticeCommands,
    loginNoticeSelectionModule: globalScope.AdmitCardLoginNoticeSelection,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, ({
  loginNoticeCommandModule,
  loginNoticeSelectionModule,
}) => {
  if (!loginNoticeCommandModule?.createLoginNoticeCommandController) {
    throw new Error("client/features/system/login-notice-commands.js must be loaded before login-notice-editor.js.");
  }

  if (!loginNoticeSelectionModule?.createLoginNoticeSelectionController) {
    throw new Error("client/features/system/login-notice-selection.js must be loaded before login-notice-editor.js.");
  }

  const { createLoginNoticeCommandController } = loginNoticeCommandModule;
  const { createLoginNoticeSelectionController } = loginNoticeSelectionModule;

  function createLoginNoticeEditorController({
    LOGIN_NOTICE_EDITOR_HISTORY_LIMIT,
    TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
    TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
    TEMPLATE_EDITOR_DEFAULT_TABLE_HEADER_BACKGROUND,
    apiRequest,
    appendMergedTemplateCellContent,
    applyLoginNoticePayload,
    applySharedEditorCommand,
    buildTemplateEditorTableMarkup,
    buildTemplateGeneratedObjectMarkup,
    buildTemplateTableCellMap,
    createTemplateTableCell,
    decorateTemplateGeneratedObjectImage,
    defaultTextColor = "#152033",
    ensureTemplateEditorTableColGroup,
    escapeAttribute,
    getLoginNoticeMarkup,
    getTemplateEditorMedianValue,
    getTemplateEditorTableLogicalColumnWidth,
    getTemplateEditorTableLogicalRowHeight,
    getTemplatePreviewExaminee = null,
    handleAuthenticationFailure,
    insertTemplateCellAtAbsoluteColumn,
    isTemplateTableCellEmpty,
    normalizeTemplateEditorColorValue,
    normalizeTemplateEditorFontNodes,
    normalizeTemplateEditorTables,
    normalizeTemplateEditorTableAppearance,
    renderView,
    setEditorToolbarTableInsertPanelVisibility,
    setTemplateEditorTableLogicalRowHeight,
    showToast,
    state,
    stripTemplateEditorTransientState,
    syncEditorToolbarColorControls,
    syncTemplateEditorTableWidth,
    updateEditorToolbarFormattingState,
  }) {
    function getLoginNoticeEditorElement() {
      return document.getElementById(state.noticeManagement.activeLanguage === "en" ? "loginNoticeEditorEn" : "loginNoticeEditor");
    }

    function getLoginNoticePreviewElement() {
      return document.getElementById("loginNoticePreviewContent");
    }

    function getLoginNoticeFontFamilyElement() {
      return document.getElementById("loginNoticeFontFamily");
    }

    function getLoginNoticeFontSizeElement() {
      return document.getElementById("loginNoticeFontSize");
    }

    function getLoginNoticeTextColorElement() {
      return document.getElementById("loginNoticeTextColor");
    }

    function getLoginNoticeTextShadingElement() {
      return document.getElementById("loginNoticeTextShading");
    }

    function getLoginNoticeTableInsertPanel() {
      return document.getElementById("loginNoticeTableInsertPanel");
    }

    function getLoginNoticeTableRowsElement() {
      return document.getElementById("loginNoticeTableRows");
    }

    function getLoginNoticeTableColumnsElement() {
      return document.getElementById("loginNoticeTableColumns");
    }

    function getLoginNoticeCellShadingElement() {
      return document.getElementById("loginNoticeCellShading");
    }

    function getLoginNoticeBorderColorElement() {
      return document.getElementById("loginNoticeBorderColor");
    }

    function getLoginNoticeBorderStyleElement() {
      return document.getElementById("loginNoticeBorderStyle");
    }

    function getLoginNoticeBorderTargetElement() {
      return document.getElementById("loginNoticeBorderTarget");
    }

    function getLoginNoticeBorderWidthElement() {
      return document.getElementById("loginNoticeBorderWidth");
    }

    function getLoginNoticeCellSplitPanel() {
      return document.getElementById("loginNoticeCellSplitPanel");
    }

    function getLoginNoticeCellSplitCountElement() {
      return document.getElementById("loginNoticeCellSplitCount");
    }

    function getLoginNoticeImageInputElement() {
      return document.getElementById("loginNoticeImageInput");
    }

    function getTemplateGeneratedObjectPreviewExamineeProvider() {
      return typeof getTemplatePreviewExaminee === "function" ? getTemplatePreviewExaminee : null;
    }

    function getLoginNoticeDefaultFontFamily() {
      return typeof TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY === "string"
        ? TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY
        : "'Noto Sans KR', sans-serif";
    }

    function getLoginNoticeDefaultFontSize() {
      return Number(TEMPLATE_EDITOR_DEFAULT_FONT_SIZE) || 14;
    }

    function getLoginNoticeEditorEmptyMarkup() {
      return "<p><br /></p>";
    }

    function isLoginNoticeMeaningfulHtml(rawHtml) {
      const container = document.createElement("div");

      container.innerHTML = String(rawHtml || "").trim();

      if (container.querySelector("img, table, hr, iframe, video, audio, ul li, ol li")) {
        return true;
      }

      return String(container.textContent || "")
        .replaceAll("\u200b", "")
        .trim() !== "";
    }

    const loginNoticeSelectionController = createLoginNoticeSelectionController({
      LOGIN_NOTICE_EDITOR_HISTORY_LIMIT,
      TEMPLATE_EDITOR_DEFAULT_TABLE_HEADER_BACKGROUND,
      decorateTemplateGeneratedObjectImage,
      getLoginNoticeCellShadingElement,
      getLoginNoticeDefaultFontFamily,
      getLoginNoticeDefaultFontSize,
      getLoginNoticeEditorElement,
      getLoginNoticeEditorEmptyMarkup,
      getLoginNoticeFontFamilyElement,
      getLoginNoticeFontSizeElement,
      getLoginNoticeMarkup,
      getLoginNoticePreviewElement,
      getLoginNoticeTextColorElement,
      getLoginNoticeTextShadingElement,
      getTemplateGeneratedObjectPreviewExamineeProvider,
      isLoginNoticeMeaningfulHtml,
      normalizeTemplateEditorFontNodes,
      normalizeTemplateEditorTables,
      state,
      stripTemplateEditorTransientState,
      syncEditorToolbarColorControls,
      updateEditorToolbarFormattingState,
    });

    const {
      buildLoginNoticeEditorMarkup,
      captureLoginNoticeEditorSelection,
      clearLoginNoticeSelectedImage,
      focusLoginNoticeEditorCell,
      getLoginNoticeSelectedCell,
      getLoginNoticeSelectedCells,
      getLoginNoticeSelectedImage,
      redoLoginNoticeEditorHistory,
      restoreLoginNoticeEditorSelection,
      selectLoginNoticeImage,
      setLoginNoticeEditorStatus,
      syncLoginNoticeEditorDraft,
      undoLoginNoticeEditorHistory,
      updateLoginNoticeEditorActiveCell,
      updateLoginNoticeFormattingControls,
    } = loginNoticeSelectionController;

    const loginNoticeCommandController = createLoginNoticeCommandController({
      apiRequest,
      appendMergedTemplateCellContent,
      applyLoginNoticePayload,
      applySharedEditorCommand,
      buildTemplateEditorTableMarkup,
      buildTemplateGeneratedObjectMarkup,
      buildTemplateTableCellMap,
      createTemplateTableCell,
      defaultTextColor,
      ensureTemplateEditorTableColGroup,
      escapeAttribute,
      focusLoginNoticeEditorCell,
      getLoginNoticeBorderColorElement,
      getLoginNoticeBorderStyleElement,
      getLoginNoticeBorderTargetElement,
      getLoginNoticeBorderWidthElement,
      getLoginNoticeCellShadingElement,
      getLoginNoticeCellSplitCountElement,
      getLoginNoticeCellSplitPanel,
      getLoginNoticeDefaultFontFamily,
      getLoginNoticeDefaultFontSize,
      getLoginNoticeEditorElement,
      getLoginNoticeFontFamilyElement,
      getLoginNoticeFontSizeElement,
      getLoginNoticeSelectedCell,
      getLoginNoticeSelectedCells,
      getLoginNoticeSelectedImage,
      getLoginNoticeTableColumnsElement,
      getLoginNoticeTableInsertPanel,
      getLoginNoticeTableRowsElement,
      getLoginNoticeTextColorElement,
      getLoginNoticeTextShadingElement,
      getTemplateGeneratedObjectPreviewExamineeProvider,
      getTemplateEditorMedianValue,
      getTemplateEditorTableLogicalColumnWidth,
      getTemplateEditorTableLogicalRowHeight,
      handleAuthenticationFailure,
      insertTemplateCellAtAbsoluteColumn,
      isTemplateTableCellEmpty,
      normalizeTemplateEditorColorValue,
      normalizeTemplateEditorTableAppearance,
      normalizeTemplateEditorTables,
      renderView,
      restoreLoginNoticeEditorSelection,
      setEditorToolbarTableInsertPanelVisibility,
      setLoginNoticeEditorStatus,
      setTemplateEditorTableLogicalRowHeight,
      showToast,
      state,
      syncLoginNoticeEditorDraft,
      syncTemplateEditorTableWidth,
      undoLoginNoticeEditorHistory,
      redoLoginNoticeEditorHistory,
    });

    const {
      applyLoginNoticeEditorCommand,
      getLoginNoticeCellSplitConfig,
      handleLoginNoticeAction,
      handleLoginNoticeInsert,
      handleLoginNoticeTableAction,
      insertLoginNoticeImage,
      saveLoginNoticeContent,
      setLoginNoticeCellSplitPanelVisibility,
      setLoginNoticeTableInsertPanelVisibility,
    } = loginNoticeCommandController;

    return Object.freeze({
      applyLoginNoticeEditorCommand,
      buildLoginNoticeEditorMarkup,
      captureLoginNoticeEditorSelection,
      clearLoginNoticeSelectedImage,
      getLoginNoticeCellSplitConfig,
      getLoginNoticeDefaultFontFamily,
      getLoginNoticeDefaultFontSize,
      getLoginNoticeEditorElement,
      getLoginNoticeImageInputElement,
      getLoginNoticeSelectedImage,
      handleLoginNoticeAction,
      handleLoginNoticeInsert,
      handleLoginNoticeTableAction,
      insertLoginNoticeImage,
      redoLoginNoticeEditorHistory,
      restoreLoginNoticeEditorSelection,
      saveLoginNoticeContent,
      selectLoginNoticeImage,
      setLoginNoticeCellSplitPanelVisibility,
      setLoginNoticeTableInsertPanelVisibility,
      syncLoginNoticeEditorDraft,
      undoLoginNoticeEditorHistory,
      updateLoginNoticeEditorActiveCell,
      updateLoginNoticeFormattingControls,
    });
  }

  return Object.freeze({
    createLoginNoticeEditorController,
  });
});
