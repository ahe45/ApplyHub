(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorRuntimeApi = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorRuntimePublicApi({
    applyTemplateEditorCommand,
    clearTemplateEditorActiveCell,
    clearTemplateEditorImageHoverState,
    clearTemplateEditorImageSelection,
    clearTemplateEditorTableHoverState,
    clearTemplateEditorTableObjectHoverState,
    clearTemplateEditorTableObjectSelection,
    clearTemplateEditorTableSelection,
    getHtml,
    handleTemplateEditorImageResizeStart,
    insertTemplateHtml,
    insertTemplateImage,
    insertTemplateImageSource,
    insertTemplateTag,
    ownerWindow,
    redoTemplateEditorHistory,
    releaseTemplateEditorImageMoveSession,
    releaseTemplateEditorImageResizeSession,
    releaseTemplateEditorTableObjectMoveSession,
    releaseTemplateEditorTableObjectResizeSession,
    releaseTemplateEditorTableResizeSession,
    releaseTemplateEditorTableSelectionSession,
    render,
    renderInto,
    renderPagePropertiesPanel,
    renderTagPanel,
    renderToolbar,
    setHtml,
    state,
    syncTemplateEditorContent,
    unbindEvents,
    undoTemplateEditorHistory,
    updateTemplateEditorFormattingControls,
    updateTemplateEditorImageSelectionOverlay,
    updateTemplateEditorTableObjectOverlay,
    updateTemplateTableControls,
  }) {
    function clearObjectSelection() {
      clearTemplateEditorImageHoverState();
      clearTemplateEditorImageSelection();
      clearTemplateEditorTableHoverState();
      clearTemplateEditorTableObjectHoverState({ updateOverlay: false });
      clearTemplateEditorTableObjectSelection();
      clearTemplateEditorTableSelection();
      clearTemplateEditorActiveCell();
      ownerWindow.getSelection?.()?.removeAllRanges();
      state.templateEditor.savedRange = null;
      updateTemplateEditorFormattingControls();
      updateTemplateTableControls();
    }

    function releaseInteractions() {
      releaseTemplateEditorImageMoveSession({ sync: false });
      releaseTemplateEditorImageResizeSession({ sync: false });
      releaseTemplateEditorTableResizeSession({ sync: false });
      releaseTemplateEditorTableObjectMoveSession({ sync: false });
      releaseTemplateEditorTableObjectResizeSession({ sync: false });
      releaseTemplateEditorTableSelectionSession({ keepSelection: false });
    }

    function setInteractionDisabled(disabled) {
      const nextDisabled = Boolean(disabled);
      if (Boolean(state.templateEditor.interactionDisabled) === nextDisabled) {
        return;
      }
      state.templateEditor.interactionDisabled = nextDisabled;
      if (nextDisabled) {
        state.templateEditor.isComposing = false;
        releaseInteractions();
        clearObjectSelection();
        state.templateEditor.savedSelectionSnapshot = null;
      }
    }

    const whenInteractive = (action) => (...args) => {
      if (state.templateEditor.interactionDisabled) {
        return false;
      }
      return action(...args);
    };

    function destroy() {
      unbindEvents();
      clearTemplateEditorImageSelection();
      clearTemplateEditorTableSelection();
      clearTemplateEditorTableHoverState();
      clearTemplateEditorTableObjectSelection({ updateOverlay: false });
      clearTemplateEditorTableObjectHoverState({ updateOverlay: false });
      releaseInteractions();
    }

    return Object.freeze({
      applyCommand: whenInteractive(applyTemplateEditorCommand),
      clearObjectSelection,
      clearTableObjectHoverState: clearTemplateEditorTableObjectHoverState,
      clearTableObjectSelection: clearTemplateEditorTableObjectSelection,
      destroy,
      getHtml,
      handleImageResizeStart: whenInteractive(handleTemplateEditorImageResizeStart),
      insertHtml: whenInteractive(insertTemplateHtml),
      insertImage: whenInteractive(insertTemplateImage),
      insertImageSource: whenInteractive(insertTemplateImageSource),
      insertTag: whenInteractive(insertTemplateTag),
      redo: whenInteractive(redoTemplateEditorHistory),
      render,
      renderInto,
      renderPagePropertiesPanel,
      renderTagPanel,
      renderToolbar,
      setHtml,
      setInteractionDisabled,
      state,
      sync: syncTemplateEditorContent,
      updateImageSelectionOverlay: updateTemplateEditorImageSelectionOverlay,
      updateTableObjectOverlay: updateTemplateEditorTableObjectOverlay,
      undo: whenInteractive(undoTemplateEditorHistory),
    });
  }

  return Object.freeze({
    createTemplateEditorRuntimePublicApi,
  });
});

})();
