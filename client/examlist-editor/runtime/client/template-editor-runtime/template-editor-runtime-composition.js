(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorRuntimeComposition = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorRuntimeApiAndInitialize({
    apiHandlers,
    commandController,
    createTemplateEditorRuntimePublicApi,
    documentApiController,
    eventController,
    initialHtml,
    initializeTemplateEditorRuntime,
    runtimeActions,
    setFallbackStatus,
    state,
    toolbarInteractionController,
  }) {
    const { insertTemplateHtml, insertTemplateImage, insertTemplateImageSource, insertTemplateTag } = commandController;
    const { getHtml, render, renderInto, setHtml } = documentApiController;
    const { bindEvents, unbindEvents } = eventController;
    const { renderPagePropertiesPanel, renderTagPanel, renderToolbar } = toolbarInteractionController;
    const api = createTemplateEditorRuntimePublicApi({
      ...apiHandlers,
      ...runtimeActions,
      getHtml,
      insertTemplateHtml,
      insertTemplateImage,
      insertTemplateImageSource,
      insertTemplateTag,
      render,
      renderInto,
      renderPagePropertiesPanel,
      renderTagPanel,
      renderToolbar,
      setHtml,
      state,
      unbindEvents,
    });

    initializeTemplateEditorRuntime({
      bindEvents,
      initialHtml,
      renderPagePropertiesPanel,
      renderTagPanel,
      renderToolbar,
      setFallbackStatus,
      setHtml,
      state,
    });

    return api;
  }

  return Object.freeze({
    createTemplateEditorRuntimeApiAndInitialize,
  });
});

})();
