(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalScope);
    return;
  }
  globalScope.ExamListTemplateEditorRuntime = factory(globalScope);
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  const runtimeWiring = globalScope.ExamListTemplateEditorRuntimeWiring;
  if (!runtimeWiring) {
    throw new Error("client/template-editor-runtime/template-editor-runtime-wiring.js must be loaded before template-editor-runtime.js.");
  }
  const runtimeHandlerAccessorsModule = globalScope.ExamListTemplateEditorRuntimeHandlerAccessors;
  if (!runtimeHandlerAccessorsModule) {
    throw new Error("client/template-editor-runtime/template-editor-runtime-handler-accessors.js must be loaded before template-editor-runtime.js.");
  }
  const runtimeFactoryModule = globalScope.ExamListTemplateEditorRuntimeFactory;
  if (!runtimeFactoryModule) {
    throw new Error("client/template-editor-runtime/template-editor-runtime-factory.js must be loaded before template-editor-runtime.js.");
  }

  const {
    core,
    runtimeApi,
    runtimeContext,
    runtimeHelpers,
  } = runtimeWiring.resolveTemplateEditorRuntimeModules(globalScope);
  const {
    createTemplateEditorState,
    createTemplatePreviewState,
    normalizeTemplateTagDefinition,
    normalizeTemplateTagDefinitions,
  } = core;
  const { createTemplateEditorRuntimeFactory } = runtimeFactoryModule;
  const createTemplateEditor = createTemplateEditorRuntimeFactory({
    core,
    runtimeApi,
    runtimeContext,
    runtimeHandlerAccessorsModule,
    runtimeHelpers,
    runtimeWiring,
  });

  return Object.freeze({
    createTemplateEditor,
    createTemplateEditorState,
    createTemplatePreviewState,
    normalizeTemplateTagDefinition,
    normalizeTemplateTagDefinitions,
  });
});

})();
