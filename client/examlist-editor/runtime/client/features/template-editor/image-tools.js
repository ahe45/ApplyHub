(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorImageTools = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const imageSelectionModule = globalThis.ExamListTemplateEditorImageSelection;
  const imageSessionModule = globalThis.ExamListTemplateEditorImageSession;

  if (!imageSelectionModule?.createTemplateEditorImageSelectionController) {
    throw new Error("client/features/template-editor/image-selection.js must be loaded before image-tools.js.");
  }

  if (!imageSessionModule?.createTemplateEditorImageSessionController) {
    throw new Error("client/features/template-editor/image-session.js must be loaded before image-tools.js.");
  }

  const { createTemplateEditorImageSelectionController } = imageSelectionModule;
  const { createTemplateEditorImageSessionController } = imageSessionModule;

  function createTemplateEditorImageController({
    TEMPLATE_EDITOR_IMAGE_MIN_SIZE,
    clearTemplateEditorActiveCell,
    decorateTemplateGeneratedObjectImage,
    getTemplateEditorDocumentElement,
    getTemplateEditorImageOverlayContainer,
    getTemplateEditorModal,
    getTemplateEditorSurface,
    getTemplatePreviewExaminee,
    parseTemplateEditorPixelStyle,
    state,
    syncTemplateEditorContent,
  }) {
    let handleTemplateEditorImageResizeStart = () => {};
    let nudgeSelectedTemplateEditorImage = () => false;
    let releaseTemplateEditorImageMoveSession = () => {};
    let releaseTemplateEditorImageResizeSession = () => {};
    let startTemplateEditorImageMoveSession = () => {};

    const templateEditorImageSelectionController = createTemplateEditorImageSelectionController({
      clearTemplateEditorActiveCell,
      decorateTemplateGeneratedObjectImage,
      getHandleTemplateEditorImageResizeStart: () => handleTemplateEditorImageResizeStart,
      getTemplateEditorImageOverlayContainer,
      getTemplateEditorModal,
      getTemplateEditorSurface,
      getTemplatePreviewExaminee,
      releaseTemplateEditorImageMoveSession: (...args) => releaseTemplateEditorImageMoveSession(...args),
      releaseTemplateEditorImageResizeSession: (...args) => releaseTemplateEditorImageResizeSession(...args),
      state,
    });
    const {
      clearTemplateEditorImageSelection,
      clearTemplateEditorImageHoverState,
      decorateTemplateEditorImages,
      ensureTemplateEditorImageOverlay,
      getTemplateEditorImageOverlay,
      getTemplateEditorImageTarget,
      selectTemplateEditorImage,
      updateTemplateEditorImageHoverState,
      updateTemplateEditorImageSelectionOverlay,
    } = templateEditorImageSelectionController;

    const templateEditorImageSessionController = createTemplateEditorImageSessionController({
      TEMPLATE_EDITOR_IMAGE_MIN_SIZE,
      getSelectedTemplateEditorImage: () => state.templateEditor.selectedImageElement,
      getTemplateEditorDocumentElement,
      getTemplateEditorImageOverlay,
      getTemplateEditorSurface,
      parseTemplateEditorPixelStyle,
      selectTemplateEditorImage,
      state,
      syncTemplateEditorContent,
      updateTemplateEditorImageSelectionOverlay,
    });

    ({
      handleTemplateEditorImageResizeStart,
      nudgeSelectedTemplateEditorImage,
      releaseTemplateEditorImageMoveSession,
      releaseTemplateEditorImageResizeSession,
      startTemplateEditorImageMoveSession,
    } = templateEditorImageSessionController);

    return Object.freeze({
      clearTemplateEditorImageSelection,
      clearTemplateEditorImageHoverState,
      decorateTemplateEditorImages,
      ensureTemplateEditorImageOverlay,
      getTemplateEditorImageTarget,
      handleTemplateEditorImageResizeStart,
      nudgeSelectedTemplateEditorImage,
      releaseTemplateEditorImageMoveSession,
      releaseTemplateEditorImageResizeSession,
      selectTemplateEditorImage,
      startTemplateEditorImageMoveSession,
      updateTemplateEditorImageHoverState,
      updateTemplateEditorImageSelectionOverlay,
    });
  }

  return Object.freeze({
    createTemplateEditorImageController,
  });
});

})();
