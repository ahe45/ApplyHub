(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory({
      loginNoticeLinkUtilsModule: require("./login-notice-link-utils"),
      loginNoticeTableActionModule: require("./login-notice-table-actions"),
      toolbarControlsModule: require("../editor/toolbar-controls"),
    });
    return;
  }

  globalScope.AdmitCardLoginNoticeCommands = factory({
    loginNoticeLinkUtilsModule: globalScope.AdmitCardLoginNoticeLinkUtils,
    loginNoticeTableActionModule: globalScope.AdmitCardLoginNoticeTableActions,
    toolbarControlsModule: globalScope.AdmitCardEditorToolbarControls,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, ({
  loginNoticeLinkUtilsModule,
  loginNoticeTableActionModule,
  toolbarControlsModule,
}) => {
  if (!toolbarControlsModule) {
    throw new Error("client/features/editor/toolbar-controls.js must be loaded before login-notice-commands.js.");
  }

  if (!loginNoticeTableActionModule?.createLoginNoticeTableActionController) {
    throw new Error("client/features/system/login-notice-table-actions.js must be loaded before login-notice-commands.js.");
  }

  const {
    getEditorToolbarCellSplitConfig,
    getEditorToolbarTableInsertConfig,
    setEditorToolbarManagedPanelVisibility,
  } = toolbarControlsModule;
  const {
    decorateLoginNoticeLinks,
    getLoginNoticeClosestLink,
    normalizeLoginNoticeLinkUrl,
    upsertLoginNoticeImageLink,
  } = loginNoticeLinkUtilsModule || {};
  const { createLoginNoticeTableActionController } = loginNoticeTableActionModule;

  function createLoginNoticeCommandController({
    apiRequest,
    appendMergedTemplateCellContent,
    applyLoginNoticePayload,
    applySharedEditorCommand,
    buildTemplateEditorTableMarkup,
    buildTemplateGeneratedObjectMarkup,
    buildTemplateTableCellMap,
    createTemplateTableCell,
    defaultTextColor = "#152033",
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
  }) {
    function getActiveNoticeScope() {
      return state.noticeManagement?.activeScope === "applicant" ? "applicant" : "login";
    }

    function getActiveNoticeScopeLabel() {
      return getActiveNoticeScope() === "applicant" ? "접수화면" : "로그인화면";
    }

    const loginNoticeTableActionController = createLoginNoticeTableActionController({
      appendMergedTemplateCellContent,
      buildTemplateTableCellMap,
      createTemplateTableCell,
      ensureTemplateEditorTableColGroup,
      focusLoginNoticeEditorCell,
      getLoginNoticeBorderColorElement,
      getLoginNoticeBorderStyleElement,
      getLoginNoticeBorderTargetElement,
      getLoginNoticeBorderWidthElement,
      getLoginNoticeCellShadingElement,
      getLoginNoticeEditorElement,
      getLoginNoticeSelectedCell,
      getLoginNoticeSelectedCells,
      getLoginNoticeTableColumnsElement,
      getLoginNoticeTableRowsElement,
      getTemplateEditorMedianValue,
      getTemplateEditorTableLogicalColumnWidth,
      getTemplateEditorTableLogicalRowHeight,
      insertTemplateCellAtAbsoluteColumn,
      isTemplateTableCellEmpty,
      normalizeTemplateEditorColorValue,
      normalizeTemplateEditorTableAppearance,
      restoreLoginNoticeEditorSelection,
      setEditorToolbarTableInsertPanelVisibility,
      setLoginNoticeEditorStatus,
      setTemplateEditorTableLogicalRowHeight,
      syncLoginNoticeEditorDraft,
      syncTemplateEditorTableWidth,
    });
    const { handleLoginNoticeTableAction } = loginNoticeTableActionController;

    function decorateLoginNoticeDocumentLinks(rootElement) {
      if (typeof decorateLoginNoticeLinks === "function") {
        decorateLoginNoticeLinks(rootElement);
      }
    }

    function setLoginNoticeTableInsertPanelVisibility(isVisible) {
      setEditorToolbarManagedPanelVisibility({
        panelId: "loginNoticeTableInsertPanel",
        isVisible,
        getPanelElement: getLoginNoticeTableInsertPanel,
        setEditorToolbarTableInsertPanelVisibility,
      });
    }

    function setLoginNoticeCellSplitPanelVisibility(isVisible) {
      setEditorToolbarManagedPanelVisibility({
        panelId: "loginNoticeCellSplitPanel",
        isVisible,
        getPanelElement: getLoginNoticeCellSplitPanel,
        setEditorToolbarTableInsertPanelVisibility,
      });
    }

    function getLoginNoticeTableInsertConfig() {
      return getEditorToolbarTableInsertConfig({
        rowInputElement: getLoginNoticeTableRowsElement(),
        columnInputElement: getLoginNoticeTableColumnsElement(),
        setStatus: setLoginNoticeEditorStatus,
      });
    }

    function getLoginNoticeCellSplitConfig() {
      return getEditorToolbarCellSplitConfig({
        countInputElement: getLoginNoticeCellSplitCountElement(),
        axisName: "loginNoticeCellSplitAxis",
        axisFallbackId: "loginNoticeCellSplitAxisColumn",
        setStatus: setLoginNoticeEditorStatus,
      });
    }

    function insertLoginNoticeHtml(markup) {
      const noticeEditor = getLoginNoticeEditorElement();
      const documentElement = getLoginNoticeEditorElement();

      if (!noticeEditor || !documentElement) {
        return;
      }

      noticeEditor.focus();
      restoreLoginNoticeEditorSelection();
      document.execCommand("styleWithCSS", false, true);
      document.execCommand("insertHTML", false, markup);

      if (markup.includes("<table")) {
        normalizeTemplateEditorTables(documentElement);
      }

      decorateLoginNoticeDocumentLinks(documentElement);
      syncLoginNoticeEditorDraft();
    }

    function insertLoginNoticeImage(file) {
      if (!file) {
        return;
      }

      const fileReader = new FileReader();

      fileReader.addEventListener("load", () => {
        insertLoginNoticeHtml(`<img src="${fileReader.result}" alt="${escapeAttribute(file.name)}" />`);
      });

      fileReader.readAsDataURL(file);
    }

    function applyLoginNoticeEditorCommand(command, value = "") {
      const noticeEditor = getLoginNoticeEditorElement();

      if (!noticeEditor) {
        return;
      }

      const normalizedValue =
        command === "hiliteColor" && !String(value || "").trim()
          ? getLoginNoticeTextShadingElement()?.value || "#fff59d"
          : command === "foreColor" && !String(value || "").trim()
            ? getLoginNoticeTextColorElement()?.value || defaultTextColor
            : value;
      const isHistoryCommand = command === "undo" || command === "redo";

      applySharedEditorCommand({
        rootElement: noticeEditor,
        focusElement: noticeEditor,
        restoreSelection: restoreLoginNoticeEditorSelection,
        syncContent: () => {},
        onUndo: undoLoginNoticeEditorHistory,
        onRedo: redoLoginNoticeEditorHistory,
        command,
        value: normalizedValue,
        enableStyleWithCss: true,
        fontFamilyElement: getLoginNoticeFontFamilyElement(),
        defaultFontFamily: getLoginNoticeDefaultFontFamily(),
        fontSizeElement: getLoginNoticeFontSizeElement(),
        defaultFontSize: getLoginNoticeDefaultFontSize(),
        setStatus: setLoginNoticeEditorStatus,
      });

      if (isHistoryCommand) {
        return;
      }

      decorateLoginNoticeDocumentLinks(noticeEditor);
      syncLoginNoticeEditorDraft();
    }

    function getLoginNoticeSelectionRange() {
      const noticeEditor = getLoginNoticeEditorElement();
      const selection = window.getSelection();
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const commonAncestor =
        range?.commonAncestorContainer?.nodeType === Node.ELEMENT_NODE
          ? range.commonAncestorContainer
          : range?.commonAncestorContainer?.parentElement || null;

      if (!noticeEditor || !range || range.collapsed || !commonAncestor || !noticeEditor.contains(commonAncestor)) {
        return null;
      }

      return range;
    }

    function getLoginNoticeSelectedLinkElement() {
      const noticeEditor = getLoginNoticeEditorElement();
      const selectedImage = getLoginNoticeSelectedImage?.() || null;
      const selection = window.getSelection();
      const selectionNode = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).commonAncestorContainer : null;

      if (!noticeEditor) {
        return null;
      }

      if (selectedImage) {
        return getLoginNoticeClosestLink?.(selectedImage, noticeEditor) || null;
      }

      return getLoginNoticeClosestLink?.(selectionNode, noticeEditor) || null;
    }

    function applyLoginNoticeLink(linkUrl = "") {
      const noticeEditor = getLoginNoticeEditorElement();
      const selectedImage = getLoginNoticeSelectedImage?.() || null;

      if (!noticeEditor) {
        return false;
      }

      noticeEditor.focus();
      restoreLoginNoticeEditorSelection();

      if (selectedImage) {
        const didWrapImage = upsertLoginNoticeImageLink?.({
          imageElement: selectedImage,
          href: linkUrl,
          rootElement: noticeEditor,
        });

        if (!didWrapImage) {
          return false;
        }

        decorateLoginNoticeDocumentLinks(noticeEditor);
        syncLoginNoticeEditorDraft();
        return true;
      }

      if (getLoginNoticeSelectionRange()) {
        applySharedEditorCommand({
          rootElement: noticeEditor,
          focusElement: noticeEditor,
          restoreSelection: restoreLoginNoticeEditorSelection,
          syncContent: () => {},
          onUndo: undoLoginNoticeEditorHistory,
          onRedo: redoLoginNoticeEditorHistory,
          command: "createLink",
          value: linkUrl,
          fontFamilyElement: getLoginNoticeFontFamilyElement(),
          defaultFontFamily: getLoginNoticeDefaultFontFamily(),
          fontSizeElement: getLoginNoticeFontSizeElement(),
          defaultFontSize: getLoginNoticeDefaultFontSize(),
          setStatus: setLoginNoticeEditorStatus,
        });
        decorateLoginNoticeDocumentLinks(noticeEditor);
        syncLoginNoticeEditorDraft();
        return true;
      }

      return false;
    }

    async function saveLoginNoticeContent() {
      syncLoginNoticeEditorDraft();
      const activeScope = getActiveNoticeScope();
      const activeScopeLabel = getActiveNoticeScopeLabel();
      const language = state.noticeManagement.activeLanguage === "en" ? "en" : "ko";
      const submittedHtml = state.loginNotice.draftHtml;

      try {
        const payload = await apiRequest("/api/login-notice", {
          method: "PUT",
          body: JSON.stringify({
            scope: activeScope,
            language,
            html: submittedHtml,
          }),
        });

        applyLoginNoticePayload(payload.html ?? submittedHtml, {
          scope: activeScope,
          language,
        });
        renderView();
        showToast(`${activeScopeLabel} ${language === "en" ? "영어" : "한국어"} 공지사항을 저장했습니다.`);
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return;
        }

        setLoginNoticeEditorStatus(error.message, "warning");
      }
    }

    async function handleLoginNoticeAction(action) {
      if (action === "link") {
        const noticeEditor = getLoginNoticeEditorElement();
        const selectedImage = getLoginNoticeSelectedImage?.() || null;

        if (!noticeEditor) {
          return;
        }

        noticeEditor.focus();
        restoreLoginNoticeEditorSelection();

        const hasTextSelection = Boolean(getLoginNoticeSelectionRange());

        if (!hasTextSelection && !selectedImage) {
          setLoginNoticeEditorStatus("링크를 적용할 텍스트나 이미지를 먼저 선택하세요.", "warning");
          return;
        }

        const existingLinkElement = getLoginNoticeSelectedLinkElement();
        const promptDefaultValue = String(existingLinkElement?.getAttribute("href") || "https://").trim() || "https://";
        const url = window.prompt("링크 주소를 입력하세요.", promptDefaultValue);

        if (url === null) {
          return;
        }

        const normalizedUrl = normalizeLoginNoticeLinkUrl?.(url) || "";

        if (!normalizedUrl) {
          setLoginNoticeEditorStatus("링크 주소는 https://, http:// 또는 /경로 형식으로 입력하세요.", "warning");
          return;
        }

        if (!applyLoginNoticeLink(normalizedUrl)) {
          setLoginNoticeEditorStatus("링크를 적용할 대상을 찾지 못했습니다. 다시 선택한 뒤 시도하세요.", "warning");
        }
        return;
      }

      if (action === "save") {
        await saveLoginNoticeContent();
      }
    }

    function handleLoginNoticeInsert(insertType) {
      if (insertType === "table") {
        const tableInsertPanel = getLoginNoticeTableInsertPanel();
        const shouldOpen = tableInsertPanel?.classList.contains("hidden") ?? true;

        setLoginNoticeTableInsertPanelVisibility(shouldOpen);
        if (shouldOpen) {
          getLoginNoticeTableRowsElement()?.focus();
          getLoginNoticeTableRowsElement()?.select();
        }
        return;
      }

      if (insertType === "table-confirm") {
        const tableConfig = getLoginNoticeTableInsertConfig();

        if (!tableConfig) {
          return;
        }

        insertLoginNoticeHtml(buildTemplateEditorTableMarkup(tableConfig.rowCount, tableConfig.columnCount));
        setLoginNoticeTableInsertPanelVisibility(false);
        return;
      }

      if (insertType === "barcode" || insertType === "qrcode") {
        insertLoginNoticeHtml(
          buildTemplateGeneratedObjectMarkup(insertType, {
            getPreviewExaminee: getTemplateGeneratedObjectPreviewExamineeProvider(),
          }),
        );
        setLoginNoticeTableInsertPanelVisibility(false);
        return;
      }

      if (insertType === "rule") {
        insertLoginNoticeHtml("<hr /><p></p>");
        setLoginNoticeTableInsertPanelVisibility(false);
      }
    }

    return Object.freeze({
      applyLoginNoticeEditorCommand,
      getLoginNoticeCellSplitConfig,
      handleLoginNoticeAction,
      handleLoginNoticeInsert,
      handleLoginNoticeTableAction,
      insertLoginNoticeImage,
      saveLoginNoticeContent,
      setLoginNoticeCellSplitPanelVisibility,
      setLoginNoticeTableInsertPanelVisibility,
    });
  }

  return Object.freeze({
    createLoginNoticeCommandController,
  });
});
