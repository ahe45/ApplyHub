(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorRuntimeWiring = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const DEFAULT_HISTORY_LIMIT = 120;
  const DEFAULT_IMAGE_MIN_SIZE = 5;
  const TABLE_EDGE_THRESHOLD = 8;
  const TABLE_SELECTION_DRAG_THRESHOLD = 6;

  function resolveTemplateEditorRuntimeModules(globalScope) {
    const core = globalScope.ExamListTemplateEditorRuntimeCore;
    if (!core) {
      throw new Error("client/template-editor-runtime/template-editor-runtime-core.js must be loaded before template-editor-runtime.js.");
    }

    const runtimeContext = globalScope.ExamListTemplateEditorRuntimeContext;
    const runtimeApi = globalScope.ExamListTemplateEditorRuntimeApi;
    const runtimeHelpers = globalScope.ExamListTemplateEditorRuntimeHelpers;
    if (!runtimeContext || !runtimeApi || !runtimeHelpers) {
      throw new Error("template-editor-runtime context, API, and helper modules must be loaded before template-editor-runtime.js.");
    }

    return Object.freeze({
      core,
      runtimeApi,
      runtimeContext,
      runtimeHelpers,
    });
  }

  function createTemplateEditorRuntimeHandlerRegistry(defaultHandlers) {
    const handlerNames = Object.keys(defaultHandlers);
    const handlers = {};

    handlerNames.forEach((handlerName) => {
      handlers[handlerName] = defaultHandlers[handlerName];
    });

    handlers.assign = (controller = {}) => {
      handlerNames.forEach((handlerName) => {
        if (typeof controller[handlerName] === "function") {
          handlers[handlerName] = controller[handlerName];
        }
      });

      return handlers;
    };

    return Object.seal(handlers);
  }

  function createTemplateEditorRuntimeHandlerCaller(handlers) {
    return (handlerName) =>
      (...args) =>
        handlers[handlerName](...args);
  }

  function createTemplateEditorRuntimeToolbarElementAccessors(toolbarElements) {
    const getElement = (key) => () => toolbarElements[key] || null;

    return Object.freeze({
      getBlockTypeElement: getElement("blockType"),
      getBorderColorElement: getElement("borderColor"),
      getBorderStyleElement: getElement("borderStyle"),
      getBorderTargetElement: getElement("borderTarget"),
      getBorderWidthElement: getElement("borderWidth"),
      getCellPaddingBottomElement: getElement("cellPaddingBottom"),
      getCellPaddingLeftElement: getElement("cellPaddingLeft"),
      getCellPaddingRightElement: getElement("cellPaddingRight"),
      getCellPaddingTopElement: getElement("cellPaddingTop"),
      getCellShadingElement: getElement("cellShading"),
      getCellSplitCountElement: getElement("cellSplitCount"),
      getCellSplitPanelElement: getElement("cellSplitPanel"),
      getCellWidthElement: getElement("cellWidth"),
      getFontFamilyElement: getElement("fontFamily"),
      getFontSizeElement: getElement("fontSize"),
      getRowHeightElement: getElement("rowHeight"),
      getSizeScopeElement: getElement("sizeScope"),
      getTableColumnsElement: getElement("tableColumns"),
      getTableInsertPanelElement: getElement("tableInsertPanel"),
      getTableRowsElement: getElement("tableRows"),
      getTextColorElement: getElement("textColor"),
      getTextShadingElement: getElement("textShading"),
    });
  }

  return Object.freeze({
    DEFAULT_HISTORY_LIMIT,
    DEFAULT_IMAGE_MIN_SIZE,
    TABLE_EDGE_THRESHOLD,
    TABLE_SELECTION_DRAG_THRESHOLD,
    createTemplateEditorRuntimeHandlerCaller,
    createTemplateEditorRuntimeHandlerRegistry,
    createTemplateEditorRuntimeToolbarElementAccessors,
    resolveTemplateEditorRuntimeModules,
  });
});

})();
