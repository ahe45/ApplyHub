(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorRuntimeHelpers = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorRuntimeDefaultHandlers() {
    return Object.freeze({
      appendMergedTemplateCellContent: () => {},
      applyTemplateTableSize: () => {},
      clearTemplateEditorImageHoverState: () => {},
      clearTemplateEditorImageSelection: () => {},
      clearTemplateEditorTableHoverState: () => {},
      clearTemplateEditorTableObjectHoverState: () => {},
      clearTemplateEditorTableObjectSelection: () => {},
      clearTemplateEditorTableSelection: () => {},
      createTemplateTableCell: () => null,
      decorateTemplateEditorImages: () => {},
      focusTemplateEditorCell: () => {},
      getTemplateEditorActiveTableSelection: () => null,
      getTemplateEditorCellShadingValue: () => "",
      getTemplateEditorFormattingTargetCells: () => [],
      getTemplateEditorImageTarget: () => null,
      getTemplateEditorMedianValue: () => "",
      getTemplateEditorPixelValue: () => "",
      getTemplateEditorSelectedCell: () => null,
      getTemplateEditorSelectedTable: () => null,
      getTemplateEditorTableLogicalColumnWidth: () => "",
      getTemplateEditorTableLogicalRowHeight: () => "",
      handleTemplateEditorTableObjectPointerDown: () => false,
      handleTemplateEditorImageResizeStart: () => {},
      handleTemplateEditorTablePointerDown: () => false,
      handleTemplatePageSettingChange: () => false,
      handleTemplateTableAction: () => {},
      insertTemplateCellAtAbsoluteColumn: () => {},
      isTemplateEditorTableObjectElement: () => false,
      isTemplateTableCellEmpty: () => true,
      nudgeSelectedTemplateEditorImage: () => false,
      nudgeSelectedTemplateEditorTableObject: () => false,
      releaseTemplateEditorImageMoveSession: () => {},
      releaseTemplateEditorImageResizeSession: () => {},
      releaseTemplateEditorTableObjectMoveSession: () => {},
      releaseTemplateEditorTableObjectResizeSession: () => {},
      releaseTemplateEditorTableResizeSession: () => {},
      releaseTemplateEditorTableSelectionSession: () => {},
      replaceTemplateEditorTableWithCaretHost: () => null,
      selectTemplateEditorImage: () => {},
      setTemplateEditorTableLogicalRowHeight: () => {},
      startTemplateEditorImageMoveSession: () => {},
      syncTemplatePageSettingsFromDocument: () => {},
      updateTemplateEditorFormattingControls: () => {},
      updateTemplateEditorImageHoverState: () => {},
      updateTemplateEditorImageSelectionOverlay: () => {},
      updateTemplateEditorTableHoverState: () => {},
      updateTemplateEditorTableObjectHoverState: () => {},
      updateTemplateEditorTableObjectOverlay: () => {},
      updateTemplateTableControls: () => {},
    });
  }

  function createTemplateGeneratedObjectRuntimeController({ buildApiUrl, deps, options = {} }) {
    return typeof deps.generatedObjects.createTemplateGeneratedObjectController === "function"
      ? deps.generatedObjects.createTemplateGeneratedObjectController({
          buildApiUrl,
          getObjectValue: options.getGeneratedObjectValue,
          objectSourceKey: options.generatedObjectSourceKey || "examineeNo",
        })
      : deps.generatedObjects;
  }

  function createTemplateEditorRuntimeDomAccessors({ ownerDocument, shell }) {
    const getTemplateEditorModal = () =>
      shell.rootElement || shell.surfaceElement.closest(".template-editor-runtime") || ownerDocument.body;
    const getTemplateEditorSurface = () => {
      const activeSurface = shell.surfaceElement.querySelector?.("[data-template-editor-runtime-active-surface='true']") || null;

      return activeSurface instanceof HTMLElement ? activeSurface : shell.surfaceElement;
    };
    const getTemplateEditorStatusElement = () => shell.statusElement;

    function setFallbackStatus(message = "", type = "") {
      if (!shell.statusElement) {
        return;
      }

      shell.statusElement.textContent = String(message || "");
      shell.statusElement.classList.toggle("warning", type === "warning");
    }

    return Object.freeze({
      getTemplateEditorModal,
      getTemplateEditorStatusElement,
      getTemplateEditorSurface,
      setFallbackStatus,
    });
  }

  function createTemplateEditorRuntimeChangeNotifier({ getApi, getSerializedHtml, onChange, state }) {
    let lastNotifiedHtml = "";

    function notifyChange() {
      const nextHtml = state.templateEditor.draftHtml || getSerializedHtml();

      if (nextHtml === lastNotifiedHtml) {
        return;
      }

      lastNotifiedHtml = nextHtml;
      onChange?.(nextHtml, getApi());
    }

    function setLastNotifiedHtml(nextHtml) {
      lastNotifiedHtml = nextHtml;
    }

    return Object.freeze({
      notifyChange,
      setLastNotifiedHtml,
    });
  }

  function initializeTemplateEditorRuntime({
    bindEvents,
    initialHtml = "",
    renderPagePropertiesPanel,
    renderTagPanel,
    renderToolbar,
    setFallbackStatus,
    setHtml,
    state,
  }) {
    renderToolbar();
    renderTagPanel();
    renderPagePropertiesPanel();
    setHtml(initialHtml, { resetHistory: true, notify: false });
    bindEvents();
    setFallbackStatus(state.templateEditor.statusMessage, state.templateEditor.statusType);
  }

  return Object.freeze({
    createTemplateEditorRuntimeChangeNotifier,
    createTemplateEditorRuntimeDefaultHandlers,
    createTemplateEditorRuntimeDomAccessors,
    createTemplateGeneratedObjectRuntimeController,
    initializeTemplateEditorRuntime,
  });
});

})();
