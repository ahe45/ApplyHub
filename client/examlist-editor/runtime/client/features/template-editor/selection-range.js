(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorSelectionRange = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorSelectionRangeController({
    focusTemplateEditorCell,
    getTemplateEditorActiveTableSelection,
    getTemplateEditorModal,
    getTemplateEditorSurface,
    state,
    updateTemplateEditorActiveCell,
  }) {
    function getTemplateEditorNodePath(node) {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface || !node) {
        return null;
      }

      const path = [];
      let currentNode = node;

      while (currentNode && currentNode !== templateEditorSurface) {
        const parentNode = currentNode.parentNode;

        if (!parentNode) {
          return null;
        }

        path.unshift(Array.prototype.indexOf.call(parentNode.childNodes, currentNode));
        currentNode = parentNode;
      }

      return currentNode === templateEditorSurface ? path : null;
    }

    function resolveTemplateEditorNodePath(path) {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface || !Array.isArray(path)) {
        return null;
      }

      let currentNode = templateEditorSurface;

      for (const index of path) {
        currentNode = currentNode?.childNodes?.[index] || null;

        if (!currentNode) {
          return null;
        }
      }

      return currentNode;
    }

    function getTemplateEditorNodeMaxOffset(node) {
      if (!node) {
        return 0;
      }

      return node.nodeType === Node.TEXT_NODE ? node.textContent.length : node.childNodes.length;
    }

    function cloneTemplateEditorSelectionSnapshot(snapshot) {
      if (!snapshot) {
        return null;
      }

      return {
        startPath: Array.isArray(snapshot.startPath) ? [...snapshot.startPath] : [],
        startOffset: snapshot.startOffset,
        endPath: Array.isArray(snapshot.endPath) ? [...snapshot.endPath] : [],
        endOffset: snapshot.endOffset,
        collapsed: Boolean(snapshot.collapsed),
      };
    }

    function createTemplateEditorSelectionSnapshotFromRange(range) {
      if (!range) {
        return null;
      }

      const startPath = getTemplateEditorNodePath(range.startContainer);
      const endPath = getTemplateEditorNodePath(range.endContainer);

      if (!startPath || !endPath) {
        return null;
      }

      return {
        startPath,
        startOffset: range.startOffset,
        endPath,
        endOffset: range.endOffset,
        collapsed: range.collapsed,
      };
    }

    function setTemplateEditorCollapsedSelection(node, offset) {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface || !node) {
        return false;
      }

      const selection = window.getSelection();

      if (!selection) {
        return false;
      }

      const range = document.createRange();

      try {
        range.setStart(node, Math.min(offset, getTemplateEditorNodeMaxOffset(node)));
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        state.templateEditor.savedRange = range.cloneRange();
        state.templateEditor.savedSelectionSnapshot = createTemplateEditorSelectionSnapshotFromRange(range);
        return true;
      } catch (error) {
        return false;
      }
    }

    function saveTemplateEditorSelection() {
      const templateEditorSurface = getTemplateEditorSurface();
      const templateEditorModal = getTemplateEditorModal();

      if (!templateEditorSurface || templateEditorModal?.classList.contains("hidden")) {
        return;
      }

      if (state.templateEditor.tableSelectionSession?.isRangeSelecting || getTemplateEditorActiveTableSelection()) {
        return;
      }

      const selection = window.getSelection();

      if (!selection || selection.rangeCount === 0 || !templateEditorSurface.contains(selection.anchorNode)) {
        return;
      }

      const range = selection.getRangeAt(0);

      state.templateEditor.savedRange = range.cloneRange();
      state.templateEditor.savedSelectionSnapshot = createTemplateEditorSelectionSnapshotFromRange(range);
    }

    function placeCaretAtTemplateEditorEnd() {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface) {
        return;
      }

      const range = document.createRange();
      const selection = window.getSelection();

      if (!selection) {
        return;
      }

      range.selectNodeContents(templateEditorSurface);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      saveTemplateEditorSelection();
      updateTemplateEditorActiveCell();
    }

    function createTemplateEditorSelectionSnapshot() {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface) {
        return null;
      }

      const selection = window.getSelection();
      const range =
        selection && selection.rangeCount > 0 && templateEditorSurface.contains(selection.anchorNode)
          ? selection.getRangeAt(0)
          : state.templateEditor.savedRange;

      if (!range) {
        return null;
      }

      const snapshot = createTemplateEditorSelectionSnapshotFromRange(range);

      if (snapshot) {
        return snapshot;
      }

      return cloneTemplateEditorSelectionSnapshot(state.templateEditor.savedSelectionSnapshot);
    }

    function restoreTemplateEditorSelectionSnapshot(snapshot) {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface || !snapshot) {
        return false;
      }

      const startNode = resolveTemplateEditorNodePath(snapshot.startPath);
      const endNode = resolveTemplateEditorNodePath(snapshot.endPath);

      if (!startNode || !endNode) {
        return false;
      }

      const selection = window.getSelection();

      if (!selection) {
        return false;
      }

      const range = document.createRange();

      try {
        range.setStart(startNode, Math.min(snapshot.startOffset, getTemplateEditorNodeMaxOffset(startNode)));
        range.setEnd(endNode, Math.min(snapshot.endOffset, getTemplateEditorNodeMaxOffset(endNode)));
      } catch (error) {
        return false;
      }

      selection.removeAllRanges();
      selection.addRange(range);
      state.templateEditor.savedRange = range.cloneRange();
      state.templateEditor.savedSelectionSnapshot = cloneTemplateEditorSelectionSnapshot(snapshot);
      return true;
    }

    function restoreTemplateEditorSelection() {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface) {
        return;
      }

      const tableSelection = getTemplateEditorActiveTableSelection();

      if (tableSelection?.anchorCell) {
        focusTemplateEditorCell(tableSelection.anchorCell);
        return;
      }

      templateEditorSurface.focus();

      if (state.templateEditor.savedSelectionSnapshot && restoreTemplateEditorSelectionSnapshot(state.templateEditor.savedSelectionSnapshot)) {
        return;
      }

      if (!state.templateEditor.savedRange) {
        placeCaretAtTemplateEditorEnd();
        return;
      }

      const selection = window.getSelection();

      if (!selection) {
        return;
      }

      selection.removeAllRanges();

      try {
        selection.addRange(state.templateEditor.savedRange);
      } catch (error) {
        placeCaretAtTemplateEditorEnd();
      }
    }

    function getTemplateEditorSelectionNode() {
      const templateEditorSurface = getTemplateEditorSurface();
      const selection = window.getSelection();
      const activeNode = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).startContainer : null;
      const baseElement = activeNode?.nodeType === Node.ELEMENT_NODE ? activeNode : activeNode?.parentElement;

      if (baseElement && templateEditorSurface?.contains(baseElement)) {
        return activeNode;
      }

      const snapshotStartNode = resolveTemplateEditorNodePath(state.templateEditor.savedSelectionSnapshot?.startPath);

      if (snapshotStartNode && templateEditorSurface?.contains(snapshotStartNode)) {
        return snapshotStartNode;
      }

      return state.templateEditor.savedRange?.startContainer || null;
    }

    function getClosestTemplateEditorElement(node, selector) {
      const templateEditorSurface = getTemplateEditorSurface();
      const baseElement = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;

      if (!baseElement || !templateEditorSurface?.contains(baseElement)) {
        return null;
      }

      return baseElement.closest(selector);
    }

    return Object.freeze({
      createTemplateEditorSelectionSnapshot,
      getClosestTemplateEditorElement,
      getTemplateEditorSelectionNode,
      placeCaretAtTemplateEditorEnd,
      restoreTemplateEditorSelection,
      restoreTemplateEditorSelectionSnapshot,
      saveTemplateEditorSelection,
      setTemplateEditorCollapsedSelection,
    });
  }

  return Object.freeze({
    createTemplateEditorSelectionRangeController,
  });
});

})();
