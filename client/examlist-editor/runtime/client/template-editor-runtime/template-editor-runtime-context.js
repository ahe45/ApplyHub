(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalScope);
    return;
  }

  globalScope.ExamListTemplateEditorRuntimeContext = factory(globalScope);
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorRuntimeContext({ core, instanceId, options = {} }) {
    const {
      createShell,
      createTemplateEditorState,
      createTemplatePreviewState,
      createToolbarIds,
      formatDateAsYmd,
      getDefaultTagDefinitions,
      getDependencies,
      normalizeTemplateTagDefinitions,
      resolveElement,
    } = core;
    const deps = getDependencies();
    const documentRef = options.document || document;
    const rootElement = resolveElement(options.root, documentRef);
    const shell = createShell({
      rootElement,
      toolbarHost: resolveElement(options.toolbarHost, documentRef),
      surfaceElement: resolveElement(options.surface, documentRef),
      tagHost: resolveElement(options.tagHost, documentRef),
      pagePropertiesHost: resolveElement(options.pagePropertiesHost, documentRef),
      statusElement: resolveElement(options.statusElement, documentRef),
    });
    const ownerDocument = shell.surfaceElement.ownerDocument || documentRef;
    const ownerWindow = ownerDocument.defaultView || window;
    const instancePrefix = String(options.idPrefix || `templateEditorRuntime${instanceId}`);
    const toolbarIds = createToolbarIds(instancePrefix);
    const tagDefinitions = normalizeTemplateTagDefinitions(options.tags || getDefaultTagDefinitions());
    const buildApiUrl = typeof options.buildApiUrl === "function" ? options.buildApiUrl : (path) => String(path || "");
    const getTemplatePreviewDate =
      typeof options.getPreviewDate === "function" ? options.getPreviewDate : () => formatDateAsYmd(new Date());
    const getPreviewData = () => {
      const baseData =
        typeof options.getPreviewData === "function"
          ? options.getPreviewData()
          : options.previewData && typeof options.previewData === "object"
            ? options.previewData
            : {};
      return {
        currentDate: getTemplatePreviewDate(),
        ...baseData,
      };
    };
    const state = options.state || {
      templateEditor: createTemplateEditorState(),
      templatePreview: createTemplatePreviewState(),
    };

    if (!state.templateEditor) {
      state.templateEditor = createTemplateEditorState();
    }

    if (!state.templatePreview) {
      state.templatePreview = createTemplatePreviewState();
    }

    return Object.freeze({
      buildApiUrl,
      deps,
      documentRef,
      getPreviewData,
      getTemplatePreviewDate,
      ownerDocument,
      ownerWindow,
      shell,
      state,
      tagDefinitions,
      toolbarIds,
    });
  }

  return Object.freeze({
    createTemplateEditorRuntimeContext,
  });
});

})();
