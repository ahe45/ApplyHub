(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardTemplateEditorLifecycleModalFlow = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateLifecycleModalFlowController({
    EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR,
    TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
    TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
    apiRequest,
    clearTemplateEditorImageSelection,
    createTemplateEditorState,
    decorateTemplateEditorImages,
    findTemplateCard,
    getTemplateEditorFontFamilyElement,
    getTemplateEditorFontSizeElement,
    getTemplateEditorModal,
    getTemplateEditorSerializedHtml,
    getTemplateEditorSurface,
    getTemplateEditorTableColumnsInput,
    getTemplateEditorTableRowsInput,
    getTemplateEditorTitleElement,
    getTemplatePreviewExaminee,
    getTemplatePreviewMetaElement,
    getTemplatePreviewStageElement,
    getTemplatePreviewTitleElement,
    initializeTemplateEditorHistory,
    applyTemplatePageSettingsToRenderedSheet,
    closeModal,
    openModal,
    placeCaretAtEnd,
    prepareTemplateEditorContent,
    refreshTemplateEditorToolbarElements,
    renderEditorToolbarInner,
    renderTemplateWithExaminee,
    renderView,
    setTemplateEditorCellSplitPanelVisibility,
    setTemplateEditorStatus,
    setTemplateEditorTableInsertPanelVisibility,
    state,
    syncEditorToolbarFontSizeControls,
    syncTemplatePageSettingsFromDocument,
    syncTemplateEditorContent,
    updateTemplateCard,
    updateTemplateEditorActiveCell,
    updateTemplateEditorFormattingControls,
    updateTemplateTableControls,
  }) {
    function renderTemplateEditorToolbar() {
      const toolbarHost = document.getElementById("templateEditorToolbarHost");

      if (!toolbarHost || typeof renderEditorToolbarInner !== "function") {
        return;
      }

      toolbarHost.innerHTML = renderEditorToolbarInner({
        commandAttr: "data-template-command",
        tableActionAttr: "data-template-table-action",
        insertAttr: "data-template-insert",
        openImageAttr: "data-template-open-image",
        tableInsertLocation: "table-add-section",
        tableLayout: "notice",
        fontFamilyId: "templateEditorFontFamily",
        fontFamilyValue: TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
        fontSizeId: "templateEditorFontSize",
        fontSizeValue: TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
        textColorId: "templateEditorTextColor",
        textColorValue: typeof EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR === "string" ? EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR : "#152033",
        textShadingId: "templateEditorTextShading",
        cellShadingId: "templateEditorCellShading",
        tableInsertPanelId: "templateEditorTableInsertPanel",
        tableRowsId: "templateEditorTableRows",
        tableColumnsId: "templateEditorTableColumns",
        cellSplitPanelId: "templateEditorCellSplitPanel",
        cellSplitCountId: "templateEditorCellSplitCount",
        cellSplitAxisName: "templateEditorCellSplitAxis",
        cellSplitAxisRowId: "templateEditorCellSplitAxisRow",
        cellSplitAxisColumnId: "templateEditorCellSplitAxisColumn",
        borderTargetId: "templateEditorBorderTarget",
        borderStyleId: "templateEditorBorderStyle",
        borderWidthId: "templateEditorBorderWidth",
        borderColorId: "templateEditorBorderColor",
        imageInputId: "templateEditorImageInput",
      });

      refreshTemplateEditorToolbarElements?.();
    }

    function openTemplateEditor(templateId) {
      const templateCard = findTemplateCard(templateId);
      if (globalThis.ApplyHubExamListEditor) {
        if (templateCard) window.location.assign(`/templates/${encodeURIComponent(templateId)}/edit`);
        return;
      }
      const templateEditorModal = getTemplateEditorModal();
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateCard || !templateEditorModal || !templateEditorSurface) {
        return;
      }

      if (globalThis.ApplyHubExamListEditor) {
        return globalThis.ApplyHubExamListEditor.open({
          state, card: templateCard, openModal, closeModal, apiRequest, updateTemplateCard, renderView,
          getPreviewData: getTemplatePreviewExaminee, openPreview: openTemplatePreview,
        });
      }

      const editorMarkup = prepareTemplateEditorContent(templateCard.contentHtml);

      state.templateEditor = {
        ...createTemplateEditorState(),
        activeTemplateId: templateId,
        name: templateCard.name || "",
        description: templateCard.description || "",
        version: templateCard.version || "초안 버전 v1.0",
        draftHtml: editorMarkup,
        lastValidHtml: editorMarkup,
        statusMessage: "A4 세로 영역 안에서 편집 중입니다.",
        statusType: "",
      };

      const templateEditorFontFamily = getTemplateEditorFontFamilyElement();
      const templateEditorFontSize = getTemplateEditorFontSizeElement();
      const templateEditorTableRows = getTemplateEditorTableRowsInput();
      const templateEditorTableColumns = getTemplateEditorTableColumnsInput();
      const templateEditorBorderColor = document.getElementById("templateEditorBorderColor");
      const templateEditorBorderStyle = document.getElementById("templateEditorBorderStyle");
      const templateEditorBorderTarget = document.getElementById("templateEditorBorderTarget");
      const templateEditorBorderWidth = document.getElementById("templateEditorBorderWidth");
      const templateEditorCellSplitCount = document.getElementById("templateEditorCellSplitCount");
      const templateEditorCellSplitAxisColumn = document.getElementById("templateEditorCellSplitAxisColumn");
      const templateEditorTitle = getTemplateEditorTitleElement();

      if (templateEditorFontFamily) {
        templateEditorFontFamily.value = TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY;
      }

      if (templateEditorFontSize) {
        syncEditorToolbarFontSizeControls({
          fontSizeElement: templateEditorFontSize,
          fontSize: TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
          defaultFontSize: TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
        });
      }

      if (templateEditorTableRows) {
        templateEditorTableRows.value = "3";
      }

      if (templateEditorTableColumns) {
        templateEditorTableColumns.value = "2";
      }

      if (templateEditorBorderTarget) {
        templateEditorBorderTarget.value = "all";
      }

      if (templateEditorBorderStyle) {
        templateEditorBorderStyle.value = "solid";
      }

      if (templateEditorBorderWidth) {
        templateEditorBorderWidth.value = "1";
      }

      if (templateEditorBorderColor) {
        templateEditorBorderColor.value = "#000000";
      }

      if (templateEditorCellSplitCount) {
        templateEditorCellSplitCount.value = "2";
      }

      if (templateEditorCellSplitAxisColumn instanceof HTMLInputElement) {
        templateEditorCellSplitAxisColumn.checked = true;
      }

      if (templateEditorTitle) {
        templateEditorTitle.textContent = "수험표 양식 편집기";
      }

      templateEditorSurface.innerHTML = editorMarkup;
      const didSyncPageSettings = Boolean(syncTemplatePageSettingsFromDocument?.());
      decorateTemplateEditorImages(templateEditorSurface);
      clearTemplateEditorImageSelection();
      setTemplateEditorCellSplitPanelVisibility(false);
      setTemplateEditorTableInsertPanelVisibility(false);
      if (!didSyncPageSettings) {
        setTemplateEditorStatus(state.templateEditor.statusMessage);
      }
      openModal("templateEditorModal");
      placeCaretAtEnd(templateEditorSurface);
      initializeTemplateEditorHistory();
      updateTemplateEditorActiveCell();
      updateTemplateEditorFormattingControls();
      updateTemplateTableControls();
    }

    async function openTemplatePreview(templateId, sourceHtml = "") {
      const templateCard = findTemplateCard(templateId);
      let examinee = getTemplatePreviewExaminee();
      const templatePreviewStage = getTemplatePreviewStageElement();
      const previewName =
        state.templateEditor.activeTemplateId === templateId && String(state.templateEditor.name || "").trim()
          ? state.templateEditor.name.trim()
          : templateCard?.name || "";

      if (!templateCard || !templatePreviewStage) {
        return;
      }

      let renderedHtml;
      if (templateCard) {
        try {
          const preview = await apiRequest(`/api/templates/${encodeURIComponent(templateId)}/preview`, { method: 'POST', body: JSON.stringify({ contentHtml: sourceHtml }) });
          renderedHtml = preview.renderedHtml;
          examinee = { name: preview.previewSource.kind === 'submission' ? preview.previewSource.name : '접수 데이터 없음', examineeNo: preview.previewSource.examineeNo || '' };
        } catch (error) { window.alert(error.message); return; }
      } else renderedHtml = renderTemplateWithExaminee(sourceHtml || templateCard.contentHtml, examinee);

      state.templatePreview = {
        activeTemplateId: templateId,
        renderedHtml,
        examineeLabel: `${examinee.name} (${examinee.examineeNo})`,
        examineeNo: examinee.examineeNo,
      };

      const templatePreviewTitle = getTemplatePreviewTitleElement();
      const templatePreviewMeta = getTemplatePreviewMetaElement();

      if (templatePreviewTitle) {
        templatePreviewTitle.textContent = previewName;
      }

      if (templatePreviewMeta) {
        templatePreviewMeta.textContent = `${examinee.name} (${examinee.examineeNo}) 데이터 적용`;
      }

      templatePreviewStage.innerHTML = `<article class="template-render-sheet">${renderedHtml}</article>`;
      applyTemplatePageSettingsToRenderedSheet?.(templatePreviewStage.querySelector(".template-render-sheet"));
      openModal("templatePreviewModal");
      await globalThis.ApplyHubTemplateDocument?.prepare(templatePreviewStage);
    }

    function previewTemplateEditorDraft() {
      if (!state.templateEditor.activeTemplateId || !getTemplateEditorSurface()) {
        return;
      }

      syncTemplateEditorContent();
      openTemplatePreview(state.templateEditor.activeTemplateId, state.templateEditor.draftHtml || getTemplateEditorSerializedHtml());
    }

    function saveTemplateEditor() {
      return (async () => {
        if (!state.templateEditor.activeTemplateId || !getTemplateEditorSurface()) {
          return;
        }

        try {
          const name = String(state.templateEditor.name || "").trim();
          const description = String(state.templateEditor.description || "").trim();

          if (!name) {
            setTemplateEditorStatus("양식 제목을 입력한 뒤 저장하세요.", "warning");
            return;
          }

          state.templateEditor.name = name;
          state.templateEditor.description = description;
          syncTemplateEditorContent();

          if (state.templateEditor.hasOverflow) {
            setTemplateEditorStatus("현재 페이지 영역을 초과한 상태에서는 저장할 수 없습니다. 저장 전 내용 길이를 줄이세요.", "warning");
            return;
          }

          const updatedTemplate = await apiRequest(`/api/templates/${encodeURIComponent(state.templateEditor.activeTemplateId)}`, {
            method: "PUT",
            body: JSON.stringify({
              name: state.templateEditor.name,
              description: state.templateEditor.description,
              version: state.templateEditor.version || "초안 버전 v1.0",
              contentHtml: state.templateEditor.draftHtml,
            }),
          });

          state.bootstrap.error = "";
          updateTemplateCard(state.templateEditor.activeTemplateId, updatedTemplate);
          closeModal("templateEditorModal");
          renderView();
        } catch (error) {
          setTemplateEditorStatus(error.message, "warning");
        }
      })();
    }

    globalThis.ApplyHubExamListEditor?.configure({ state, apiRequest, updateTemplateCard, renderView, getPreviewData: getTemplatePreviewExaminee, openPreview: openTemplatePreview });
    return Object.freeze({
      openTemplateEditor,
      openTemplatePreview,
      previewTemplateEditorDraft,
      renderTemplateEditorToolbar,
      saveTemplateEditor,
    });
  }

  return Object.freeze({
    createTemplateLifecycleModalFlowController,
  });
});
