(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalScope);
    return;
  }

  globalScope.ExamListTemplateEditorImageSession = factory(globalScope);
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  const moveModule = globalScope.ExamListTemplateEditorImageMoveSession;
  const positioningModule = globalScope.ExamListTemplateEditorImagePositioning;
  const resizeModule = globalScope.ExamListTemplateEditorImageResizeSession;

  if (!moveModule || !positioningModule || !resizeModule) {
    throw new Error("template editor image session submodules must be loaded before image-session.js.");
  }

  function createTemplateEditorImageSessionController({
    TEMPLATE_EDITOR_IMAGE_MIN_SIZE,
    getSelectedTemplateEditorImage,
    getTemplateEditorDocumentElement,
    getTemplateEditorImageOverlay,
    getTemplateEditorSurface,
    parseTemplateEditorPixelStyle,
    selectTemplateEditorImage,
    state,
    syncTemplateEditorContent,
    updateTemplateEditorImageSelectionOverlay,
  }) {
    const { prepareTemplateEditorImageForMove } = positioningModule.createTemplateEditorImagePositioningController({
      TEMPLATE_EDITOR_IMAGE_MIN_SIZE,
      getTemplateEditorDocumentElement,
      getTemplateEditorSurface,
      parseTemplateEditorPixelStyle,
    });
    const moveSession = moveModule.createTemplateEditorImageMoveSessionController({
      getTemplateEditorDocumentElement,
      getTemplateEditorSurface,
      prepareTemplateEditorImageForMove,
      selectTemplateEditorImage,
      state,
      syncTemplateEditorContent,
      updateTemplateEditorImageSelectionOverlay,
    });
    const resizeSession = resizeModule.createTemplateEditorImageResizeSessionController({
      TEMPLATE_EDITOR_IMAGE_MIN_SIZE,
      getSelectedTemplateEditorImage,
      getTemplateEditorDocumentElement,
      getTemplateEditorImageOverlay,
      getTemplateEditorSurface,
      parseTemplateEditorPixelStyle,
      prepareTemplateEditorImageForMove,
      selectTemplateEditorImage,
      state,
      syncTemplateEditorContent,
      updateTemplateEditorImageSelectionOverlay,
    });

    return Object.freeze({
      ...moveSession,
      ...resizeSession,
    });
  }

  return Object.freeze({
    createTemplateEditorImageSessionController,
  });
});

})();
