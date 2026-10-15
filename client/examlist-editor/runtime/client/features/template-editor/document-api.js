(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorDocumentApi = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorDocumentApiController({
    clearTemplateEditorImageSelection,
    clearTemplateEditorTableObjectHoverState,
    clearTemplateEditorTableObjectSelection,
    clearTemplateEditorTableSelection,
    decorateTemplateEditorImages,
    getApi,
    getPreviewData,
    getTemplateEditorSerializedHtml,
    getTemplatePreviewExaminee,
    initializeTemplateEditorHistory,
    normalizeTemplateEditorTables,
    onChange,
    onSetHtml,
    ownerDocument,
    pageSettings,
    placeCaretAtEnd,
    prepareTemplateEditorContent,
    renderTemplateWithExaminee,
    resolveElement,
    setLastNotifiedHtml,
    shell,
    state,
    syncTemplateEditorContent,
    syncTemplatePageSettingsFromDocument,
    updateTemplateEditorActiveCell,
    updateTemplateEditorFormattingControls,
    updateTemplateTableControls,
  }) {
    function setHtml(html = "", { resetHistory = true, notify = false } = {}) {
      const preparedHtml = prepareTemplateEditorContent(html);

      state.templateEditor.draftHtml = preparedHtml;
      state.templateEditor.lastValidHtml = preparedHtml;
      shell.surfaceElement.innerHTML = preparedHtml;
      syncTemplatePageSettingsFromDocument();
      normalizeTemplateEditorTables?.(shell.surfaceElement);
      decorateTemplateEditorImages(shell.surfaceElement);
      clearTemplateEditorImageSelection();
      clearTemplateEditorTableSelection();
      clearTemplateEditorTableObjectSelection({ updateOverlay: false });
      clearTemplateEditorTableObjectHoverState({ updateOverlay: false });
      placeCaretAtEnd(shell.surfaceElement);

      if (resetHistory) {
        initializeTemplateEditorHistory();
      }

      updateTemplateEditorActiveCell();
      updateTemplateEditorFormattingControls();
      updateTemplateTableControls();

      const serializedHtml = getTemplateEditorSerializedHtml();

      state.templateEditor.draftHtml = serializedHtml;
      state.templateEditor.lastValidHtml = serializedHtml;
      setLastNotifiedHtml(serializedHtml);
      onSetHtml?.(serializedHtml, getApi(), { notify, resetHistory });

      if (notify) {
        onChange?.(serializedHtml, getApi());
      }
    }

    function getHtml() {
      syncTemplateEditorContent();
      return state.templateEditor.draftHtml || getTemplateEditorSerializedHtml();
    }

    function render(data = getPreviewData(), html = getHtml()) {
      return renderTemplateWithExaminee(html, {
        ...getTemplatePreviewExaminee(),
        ...(data && typeof data === "object" ? data : {}),
      });
    }

    function renderInto(target, data = getPreviewData(), html = getHtml()) {
      const targetElement = resolveElement(target, ownerDocument);

      if (!targetElement) {
        return "";
      }

      const renderedHtml = render(data, html);

      targetElement.innerHTML = '<article class="template-render-sheet">' + renderedHtml + '</article>';
      pageSettings.applyTemplatePageSettingsToRenderedSheet(targetElement.querySelector(".template-render-sheet"));
      return renderedHtml;
    }

    return Object.freeze({
      getHtml,
      render,
      renderInto,
      setHtml,
    });
  }

  return Object.freeze({
    createTemplateEditorDocumentApiController,
  });
});

})();
