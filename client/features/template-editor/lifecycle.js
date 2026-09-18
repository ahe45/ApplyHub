(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory({
      defaultContentModule: require("../../../shared/domain/default-template"),
      modalFlowModule: require("./lifecycle/modal-flow"),
      templateActionModule: require("./lifecycle/template-actions"),
    });
    return;
  }

  globalScope.AdmitCardTemplateEditorLifecycle = factory({
    defaultContentModule: globalScope.AdmitCardTemplateEditorDefaultContent,
    modalFlowModule: globalScope.AdmitCardTemplateEditorLifecycleModalFlow,
    templateActionModule: globalScope.AdmitCardTemplateEditorLifecycleActions,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, ({
  defaultContentModule,
  modalFlowModule,
  templateActionModule,
}) => {

  if (!defaultContentModule?.createDefaultTemplateContentBuilder) {
    throw new Error("shared/domain/default-template.js must be loaded before lifecycle.js.");
  }

  if (!templateActionModule?.createTemplateLifecycleActionController) {
    throw new Error("client/features/template-editor/lifecycle/template-actions.js must be loaded before lifecycle.js.");
  }

  if (!modalFlowModule?.createTemplateLifecycleModalFlowController) {
    throw new Error("client/features/template-editor/lifecycle/modal-flow.js must be loaded before lifecycle.js.");
  }

  const { createDefaultTemplateContentBuilder } = defaultContentModule;
  const { createTemplateLifecycleActionController } = templateActionModule;
  const { createTemplateLifecycleModalFlowController } = modalFlowModule;

  function createTemplateEditorLifecycleController({
    EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR,
    TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
    TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
    apiRequest,
    buildTemplateTokenHtml,
    clearTemplateEditorImageSelection,
    closeModal,
    createTemplateCardEditorState,
    createTemplateEditorState,
    decorateTemplateEditorImages,
    getTemplateCreationSeed,
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
    showToast,
    state,
    syncEditorToolbarFontSizeControls,
    syncTemplatePageSettingsFromDocument,
    syncTemplateEditorContent,
    updateTemplateEditorActiveCell,
    updateTemplateEditorFormattingControls,
    updateTemplateTableControls,
  }) {
    const getDefaultTemplateContent = createDefaultTemplateContentBuilder({
      buildTemplateTokenHtml,
    });

    function findTemplateCard(templateId) {
      return state.templateCards.find((card) => card.id === templateId);
    }

    const templateLifecycleActionController = createTemplateLifecycleActionController({
      apiRequest,
      closeModal,
      createTemplateCardEditorState,
      findTemplateCard,
      getTemplateCreationSeed,
      renderView,
      showToast,
      state,
    });
    const {
      addTemplateCard,
      applyTemplateCard,
      copyTemplateCard,
      deleteTemplateCard,
      updateTemplateCard,
    } = templateLifecycleActionController;

    const templateLifecycleModalFlowController = createTemplateLifecycleModalFlowController({
      EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR,
      TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
      TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
      apiRequest,
      clearTemplateEditorImageSelection,
      closeModal,
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
    });
    const {
      openTemplateEditor,
      openTemplatePreview,
      previewTemplateEditorDraft,
      renderTemplateEditorToolbar,
      saveTemplateEditor,
    } = templateLifecycleModalFlowController;

    return Object.freeze({
      addTemplateCard,
      applyTemplateCard,
      copyTemplateCard,
      deleteTemplateCard,
      findTemplateCard,
      getDefaultTemplateContent,
      openTemplateEditor,
      openTemplatePreview,
      previewTemplateEditorDraft,
      renderTemplateEditorToolbar,
      saveTemplateEditor,
      updateTemplateCard,
    });
  }

  return Object.freeze({
    createTemplateEditorLifecycleController,
  });
});
