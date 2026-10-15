(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorSelectionTokens = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorSelectionTokenController({
    getTemplateEditorSurface,
    setTemplateEditorCollapsedSelection,
    state,
    syncTemplateEditorContent,
  }) {
    function isTemplateEditorWhitespaceTextNode(node) {
      return node?.nodeType === Node.TEXT_NODE && !String(node.textContent || "").trim();
    }

    function isTemplateEditorTokenElement(node) {
      return node instanceof HTMLElement && node.matches(".template-token[data-template-tag-value]");
    }

    function isTemplateEditorTokenTraversalBoundary(node) {
      if (!(node instanceof Element)) return false;
      if (node.matches("br, hr")) return true;
      const display = node.ownerDocument.defaultView.getComputedStyle(node).display;
      return display !== "inline" && display !== "contents";
    }

    function getTemplateEditorSelectionToken() {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface) {
        return null;
      }

      const selection = window.getSelection();
      const range =
        selection && selection.rangeCount > 0 && templateEditorSurface.contains(selection.anchorNode)
          ? selection.getRangeAt(0)
          : state.templateEditor.savedRange;

      if (!range || !range.collapsed) {
        return null;
      }

      const startNode = range.startContainer;

      if (!startNode || !templateEditorSurface.contains(startNode)) {
        return null;
      }

      if (isTemplateEditorTokenElement(startNode)) {
        return startNode;
      }

      const tokenElement =
        startNode.nodeType === Node.ELEMENT_NODE
          ? startNode.closest?.(".template-token[data-template-tag-value]") || null
          : startNode.parentElement?.closest(".template-token[data-template-tag-value]") || null;

      return tokenElement && templateEditorSurface.contains(tokenElement) ? tokenElement : null;
    }

    function getTemplateEditorAdjacentNode(parentNode, startIndex, direction) {
      if (!parentNode?.childNodes) {
        return null;
      }

      const step = direction === "backward" ? -1 : 1;
      let currentIndex = startIndex;

      while (currentIndex >= 0 && currentIndex < parentNode.childNodes.length) {
        const siblingNode = parentNode.childNodes[currentIndex];

        if (!isTemplateEditorWhitespaceTextNode(siblingNode)) {
          return siblingNode;
        }

        currentIndex += step;
      }

      return null;
    }

    function getTemplateEditorBoundaryNode(node, direction, matches) {
      let currentNode = node || null;

      while (currentNode) {
        if (isTemplateEditorWhitespaceTextNode(currentNode)) {
          return null;
        }

        if (matches(currentNode)) {
          return currentNode;
        }

        if (isTemplateEditorTokenElement(currentNode)) {
          return null;
        }

        // A token in another paragraph/cell is not adjacent to the caret.
        // Leave the intervening line break to native editing before deleting it.
        if (isTemplateEditorTokenTraversalBoundary(currentNode)) {
          return null;
        }

        if (!(currentNode instanceof Element) || currentNode.childNodes.length === 0) {
          return null;
        }

        currentNode =
          direction === "backward"
            ? getTemplateEditorAdjacentNode(currentNode, currentNode.childNodes.length - 1, "backward")
            : getTemplateEditorAdjacentNode(currentNode, 0, "forward");
      }

      return null;
    }

    function getTemplateEditorAdjacentNodeMatching(direction, matches, rangeOverride = null) {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface) {
        return null;
      }

      const selection = window.getSelection();
      const range = rangeOverride || (
        selection && selection.rangeCount > 0 && templateEditorSurface.contains(selection.anchorNode)
          ? selection.getRangeAt(0)
          : state.templateEditor.savedRange);

      if (!range || !range.collapsed) {
        return null;
      }

      let currentNode = range.startContainer;
      let currentOffset = range.startOffset;

      while (currentNode) {
        if (currentNode.nodeType === Node.TEXT_NODE) {
          const textLength = currentNode.textContent?.length || 0;
          const isBoundary = direction === "backward" ? currentOffset === 0 : currentOffset === textLength;

          if (!isBoundary) {
            return null;
          }
        }

        const adjacentNode =
          currentNode.nodeType === Node.TEXT_NODE
            ? getTemplateEditorAdjacentNode(
                currentNode.parentNode,
                Array.prototype.indexOf.call(currentNode.parentNode?.childNodes || [], currentNode) + (direction === "backward" ? -1 : 1),
                direction,
              )
            : getTemplateEditorAdjacentNode(
                currentNode,
                direction === "backward" ? currentOffset - 1 : currentOffset,
                direction,
              );

        const adjacentToken = getTemplateEditorBoundaryNode(adjacentNode, direction, matches);

        if (adjacentToken) {
          return adjacentToken;
        }

        if (adjacentNode) {
          return null;
        }

        if (currentNode === templateEditorSurface || isTemplateEditorTokenTraversalBoundary(currentNode)) {
          return null;
        }

        const parentNode = currentNode.parentNode;

        if (!parentNode || !templateEditorSurface.contains(parentNode)) {
          return null;
        }

        const currentIndex = Array.prototype.indexOf.call(parentNode.childNodes, currentNode);
        currentOffset = direction === "backward" ? currentIndex : currentIndex + 1;
        currentNode = parentNode;
      }

      return null;
    }

    function removeTemplateEditorAdjacentToken(direction) {
      const templateEditorSurface = getTemplateEditorSurface();
      const targetToken = getTemplateEditorSelectionToken() || getTemplateEditorAdjacentNodeMatching(direction, isTemplateEditorTokenElement);

      if (!templateEditorSurface || !targetToken) {
        return false;
      }

      const selection = window.getSelection();
      const activeRange =
        selection && selection.rangeCount > 0 && templateEditorSurface.contains(selection.anchorNode)
          ? selection.getRangeAt(0).cloneRange()
          : state.templateEditor.savedRange?.cloneRange();
      const fallbackParent = targetToken.parentNode;
      const fallbackOffset = fallbackParent ? Array.prototype.indexOf.call(fallbackParent.childNodes, targetToken) : 0;

      targetToken.remove();

      if (activeRange && activeRange.startContainer && activeRange.startContainer.isConnected) {
        setTemplateEditorCollapsedSelection(activeRange.startContainer, activeRange.startOffset);
      } else if (fallbackParent) {
        setTemplateEditorCollapsedSelection(fallbackParent, fallbackOffset);
      }

      if (typeof syncTemplateEditorContent === "function") {
        syncTemplateEditorContent({ preserveSelection: true, focusEditor: true });
      }
      return true;
    }

    function removeEmptyLineAdjacentToTemplateToken(direction) {
      const surface = getTemplateEditorSurface();
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      if (!range?.collapsed || !surface?.contains(range.startContainer)) return false;
      const element = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
      const line = element?.closest("p, div");
      if (!line || line === surface || line.matches(".template-doc, [data-template-object-caret-host]") ||
          line.textContent.replace(/\u200B/g, "").trim() || line.querySelectorAll("br").length > 1 ||
          line.querySelector("img, table, hr, [contenteditable='false'], [data-template-tag-value]")) return false;
      const parent = line.parentNode;
      const index = Array.prototype.indexOf.call(parent.childNodes, line);
      const backward = direction === "backward";
      const adjacent = getTemplateEditorAdjacentNode(parent, index + (backward ? -1 : 1), direction);
      let token = getTemplateEditorBoundaryNode(adjacent, direction, isTemplateEditorTokenElement);
      if (!token && adjacent instanceof Element && adjacent.matches("p, div")) {
        const adjacentRange = line.ownerDocument.createRange();
        adjacentRange.selectNodeContents(adjacent);
        adjacentRange.collapse(!backward);
        token = getTemplateEditorAdjacentNodeMatching(direction, isTemplateEditorTokenElement, adjacentRange);
      }
      if (!token) return false;
      // Native merging may retain a placeholder BR or delete a preceding
      // noneditable tag. Remove just the empty paragraph as a single edit.
      line.remove();
      setTemplateEditorCollapsedSelection(token.parentNode, Array.prototype.indexOf.call(token.parentNode.childNodes, token) + (backward ? 1 : 0));
      syncTemplateEditorContent({ preserveSelection: true, focusEditor: true });
      return true;
    }

    function handleTemplateEditorTokenDeletion(event) {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface) {
        return false;
      }

      const key = String(event.key || "");
      const direction = key === "Backspace" ? "backward" : key === "Delete" ? "forward" : "";

      if (!direction) {
        return false;
      }

      if (removeEmptyLineAdjacentToTemplateToken(direction)) {
        event.preventDefault();
        return true;
      }
      {
        const lineBreak = getTemplateEditorAdjacentNodeMatching(direction, (node) => node instanceof Element && node.matches("br"));
        if (lineBreak) {
          const afterBreak = lineBreak.ownerDocument.createRange();
          if (direction === "backward") afterBreak.setStartBefore(lineBreak);
          else afterBreak.setStartAfter(lineBreak);
          afterBreak.collapse(true);
          if (getTemplateEditorAdjacentNodeMatching(direction, isTemplateEditorTokenElement, afterBreak)) {
            // Chromium may delete a noneditable token together with the BR.
            // Remove only the break and preserve the existing caret and token.
            lineBreak.remove();
            syncTemplateEditorContent({ preserveSelection: true, focusEditor: true });
            event.preventDefault();
            return true;
          }
        }
      }

      const didRemove = removeTemplateEditorAdjacentToken(direction);

      if (!didRemove) {
        return false;
      }

      event.preventDefault();
      return true;
    }

    return Object.freeze({
      handleTemplateEditorTokenDeletion,
    });
  }

  return Object.freeze({
    createTemplateEditorSelectionTokenController,
  });
});

})();
