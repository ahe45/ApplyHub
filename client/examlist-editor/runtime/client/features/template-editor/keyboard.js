(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorKeyboard = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorKeyboardController({
    applyTemplateEditorFontSize,
    applyToolbarHexColorInput,
    buildTemplateTableCellMap,
    clearTemplateEditorImageSelection,
    clearTemplateEditorTableObjectSelection,
    clearTemplateEditorTableSelection,
    focusTemplateEditorCell,
    getTemplateEditorCellSplitConfig,
    getTemplateEditorActiveTableSelection,
    getTemplateEditorSelectedCell,
    getTemplateEditorSurface,
    handleTemplateEditorInsert,
    handleTemplateEditorTokenDeletion,
    handleTemplateTableAction,
    isTemplateEditorTableObjectElement,
    nudgeSelectedTemplateEditorImage = () => false,
    nudgeSelectedTemplateEditorTableObject = () => false,
    ownerDocument,
    ownerWindow,
    releaseTemplateEditorImageMoveSession,
    releaseTemplateEditorImageResizeSession,
    releaseTemplateEditorTableObjectMoveSession,
    releaseTemplateEditorTableObjectResizeSession,
    releaseTemplateEditorTableResizeSession,
    releaseTemplateEditorTableSelectionSession,
    redoTemplateEditorHistory,
    replaceTemplateEditorTableWithCaretHost,
    setTemplateEditorCellSplitPanelVisibility,
    shell,
    state,
    syncTemplateEditorContent,
    toolbar,
    toolbarElements,
    undoTemplateEditorHistory,
      updateTemplateEditorTableObjectOverlay,
    }) {
    const templateEditorObjectNudgeKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

    function getTemplateEditorObjectNudgeDelta(key) {
      if (key === "ArrowUp") {
        return { x: 0, y: -1 };
      }

      if (key === "ArrowDown") {
        return { x: 0, y: 1 };
      }

      if (key === "ArrowLeft") {
        return { x: -1, y: 0 };
      }

      if (key === "ArrowRight") {
        return { x: 1, y: 0 };
      }

      return null;
    }

    function isTemplateEditorObjectNudgeControlTarget(target) {
      const targetElement = target instanceof ownerWindow.Element ? target : null;

      if (!targetElement) {
        return false;
      }

      return Boolean(
        targetElement.closest?.("input, textarea, select") ||
          shell.toolbarHost?.contains?.(targetElement) ||
          shell.tagHost?.contains?.(targetElement) ||
          shell.pagePropertiesHost?.contains?.(targetElement)
      );
    }

    function handleTemplateEditorObjectKeyboardNudge(event) {
      if (
        !templateEditorObjectNudgeKeys.has(event.key) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isTemplateEditorObjectNudgeControlTarget(event.target)
      ) {
        return false;
      }

      const delta = getTemplateEditorObjectNudgeDelta(event.key);

      if (!delta) {
        return false;
      }

      const didHandle =
        nudgeSelectedTemplateEditorImage(delta.x, delta.y) ||
        nudgeSelectedTemplateEditorTableObject(delta.x, delta.y);

      if (!didHandle) {
        return false;
      }

      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    function markTemplateEditorNativeHistoryInputHandled(inputType) {
      state.templateEditor.suppressedNativeHistoryInputType = inputType;
      ownerWindow.setTimeout(() => {
        if (state.templateEditor.suppressedNativeHistoryInputType === inputType) {
          delete state.templateEditor.suppressedNativeHistoryInputType;
        }
      }, 0);
    }

    function applyTemplateEditorKeyboardHistory(action) {
      if (action === "redo") {
        markTemplateEditorNativeHistoryInputHandled("historyRedo");
        redoTemplateEditorHistory();
        return;
      }

      markTemplateEditorNativeHistoryInputHandled("historyUndo");
      undoTemplateEditorHistory();
    }

    function resolveTemplateEditorTableNavigationCell(matrix, rowIndex, colIndex, axis) {
      const targetRow = matrix[rowIndex] || [];
      const directCell = targetRow[colIndex] || null;

      if (directCell) {
        return directCell;
      }

      if (axis === "row") {
        for (let offset = 1; offset <= targetRow.length; offset += 1) {
          const leftCell = targetRow[colIndex - offset] || null;
          const rightCell = targetRow[colIndex + offset] || null;

          if (leftCell) {
            return leftCell;
          }

          if (rightCell) {
            return rightCell;
          }
        }
      }

      return null;
    }

    function getTemplateEditorCellCenter(rect) {
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }

    function getTemplateEditorRectOverlap(startA, endA, startB, endB) {
      return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
    }

    function resolveTemplateEditorTableNavigationCellByGeometry(tableElement, selectedCell, key) {
      const selectedRect = selectedCell?.getBoundingClientRect?.();

      if (!tableElement || !selectedRect || selectedRect.width < 1 || selectedRect.height < 1) {
        return null;
      }

      const selectedCenter = getTemplateEditorCellCenter(selectedRect);
      const tolerance = 1;
      const candidates = Array.from(tableElement.querySelectorAll("td, th"))
        .filter((cellElement) => cellElement !== selectedCell)
        .map((cellElement) => {
          const rect = cellElement.getBoundingClientRect();

          if (rect.width < 1 || rect.height < 1) {
            return null;
          }

          const center = getTemplateEditorCellCenter(rect);
          let primaryDistance = 0;
          let overlap = 0;
          let secondaryDistance = 0;

          if (key === "ArrowUp") {
            if (rect.bottom > selectedRect.top + tolerance) {
              return null;
            }

            primaryDistance = selectedRect.top - rect.bottom;
            overlap = getTemplateEditorRectOverlap(selectedRect.left, selectedRect.right, rect.left, rect.right);
            secondaryDistance = Math.abs(center.x - selectedCenter.x);
          } else if (key === "ArrowDown") {
            if (rect.top < selectedRect.bottom - tolerance) {
              return null;
            }

            primaryDistance = rect.top - selectedRect.bottom;
            overlap = getTemplateEditorRectOverlap(selectedRect.left, selectedRect.right, rect.left, rect.right);
            secondaryDistance = Math.abs(center.x - selectedCenter.x);
          } else if (key === "ArrowLeft") {
            if (rect.right > selectedRect.left + tolerance) {
              return null;
            }

            primaryDistance = selectedRect.left - rect.right;
            overlap = getTemplateEditorRectOverlap(selectedRect.top, selectedRect.bottom, rect.top, rect.bottom);
            secondaryDistance = Math.abs(center.y - selectedCenter.y);
          } else if (key === "ArrowRight") {
            if (rect.left < selectedRect.right - tolerance) {
              return null;
            }

            primaryDistance = rect.left - selectedRect.right;
            overlap = getTemplateEditorRectOverlap(selectedRect.top, selectedRect.bottom, rect.top, rect.bottom);
            secondaryDistance = Math.abs(center.y - selectedCenter.y);
          } else {
            return null;
          }

          return {
            cellElement,
            overlap,
            primaryDistance,
            secondaryDistance,
          };
        })
        .filter(Boolean);

      candidates.sort((leftCandidate, rightCandidate) => {
        const leftOverlapPriority = leftCandidate.overlap > 0 ? 0 : 1;
        const rightOverlapPriority = rightCandidate.overlap > 0 ? 0 : 1;

        return leftOverlapPriority - rightOverlapPriority ||
          leftCandidate.primaryDistance - rightCandidate.primaryDistance ||
          rightCandidate.overlap - leftCandidate.overlap ||
          leftCandidate.secondaryDistance - rightCandidate.secondaryDistance;
      });

      return candidates[0]?.cellElement || null;
    }

    function isTemplateEditorCellRangeTarget(cell) {
      const selection = ownerWindow.getSelection?.();

      if (!cell || !selection?.rangeCount) {
        return false;
      }

      const range = selection.getRangeAt(0);
      const startElement =
        range.startContainer instanceof Element ? range.startContainer : range.startContainer?.parentElement || null;
      const endElement = range.endContainer instanceof Element ? range.endContainer : range.endContainer?.parentElement || null;

      return Boolean(startElement && endElement && cell.contains(startElement) && cell.contains(endElement));
    }

    function isTemplateEditorRangeInsideCell(cell, range) {
      if (!cell || !range) {
        return false;
      }

      const startElement =
        range.startContainer instanceof ownerWindow.Element
          ? range.startContainer
          : range.startContainer?.parentElement || null;
      const endElement =
        range.endContainer instanceof ownerWindow.Element
          ? range.endContainer
          : range.endContainer?.parentElement || null;

      return Boolean(startElement && endElement && cell.contains(startElement) && cell.contains(endElement));
    }

    function isTemplateEditorSameRangeStart(leftRange, rightRange) {
      return Boolean(
        leftRange &&
          rightRange &&
          leftRange.startContainer === rightRange.startContainer &&
          leftRange.startOffset === rightRange.startOffset
      );
    }

    function getTemplateEditorNativeArrowMovement(key) {
      if (key === "ArrowLeft") {
        return { direction: "backward", granularity: "character" };
      }

      if (key === "ArrowRight") {
        return { direction: "forward", granularity: "character" };
      }

      if (key === "ArrowUp") {
        return { direction: "backward", granularity: "line" };
      }

      if (key === "ArrowDown") {
        return { direction: "forward", granularity: "line" };
      }

      return null;
    }

    function restoreTemplateEditorSelectionRanges(selection, ranges) {
      selection.removeAllRanges();
      ranges.forEach((range) => {
        try {
          selection.addRange(range);
        } catch (error) {
          // Ignore stale ranges; keydown handling can safely fall back to table navigation.
        }
      });

      if (ranges[0]) {
        state.templateEditor.savedRange = ranges[0].cloneRange();
      }
    }

    function canMoveTemplateEditorCaretNativelyWithinCell(cell, key, range) {
      const selection = ownerWindow.getSelection?.();
      const movement = getTemplateEditorNativeArrowMovement(key);

      if (
        !cell ||
        !range?.collapsed ||
        !selection?.rangeCount ||
        typeof selection.modify !== "function" ||
        !movement ||
        !isTemplateEditorRangeInsideCell(cell, range)
      ) {
        return false;
      }

      const originalRanges = Array.from({ length: selection.rangeCount }, (_, index) =>
        selection.getRangeAt(index).cloneRange()
      );
      const originalRange = range.cloneRange();

      try {
        selection.modify("move", movement.direction, movement.granularity);

        if (!selection.rangeCount) {
          return false;
        }

        const movedRange = selection.getRangeAt(0);

        return Boolean(
          movedRange.collapsed &&
            !isTemplateEditorSameRangeStart(originalRange, movedRange) &&
            isTemplateEditorRangeInsideCell(cell, movedRange)
        );
      } catch (error) {
        return false;
      } finally {
        restoreTemplateEditorSelectionRanges(selection, originalRanges);
      }
    }

    function hasTemplateEditorCellEditableContent(cell) {
      if (!cell) {
        return false;
      }

      if (String(cell.textContent || "").replace(/\u00a0/g, " ").trim()) {
        return true;
      }

      return Boolean(cell.querySelector("img, table, hr, [data-template-tag-value], .template-token, .template-generated-object"));
    }

    function shouldUseNativeTableCellArrowNavigation(cell, key) {
      const tableSelection = state.templateEditor.tableSelection;

      if (tableSelection?.selectedCells?.length) {
        return false;
      }

      const selection = ownerWindow.getSelection?.();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

      if (!range || !isTemplateEditorCellRangeTarget(cell) || !hasTemplateEditorCellEditableContent(cell)) {
        return false;
      }

      if (!range.collapsed) {
        return true;
      }

      return canMoveTemplateEditorCaretNativelyWithinCell(cell, key, range);
    }

    function handleTemplateEditorTableArrowNavigation(event) {
      const navigationKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

      if (!navigationKeys.has(event.key)) {
        return false;
      }

      const selectedCell = getTemplateEditorSelectedCell();
      const selectedTable = selectedCell?.closest("table") || null;

      if (!selectedCell || !selectedTable || !shell.surfaceElement.contains(selectedCell)) {
        return false;
      }

      if (shouldUseNativeTableCellArrowNavigation(selectedCell, event.key)) {
        return false;
      }

      const { matrix, entries } = buildTemplateTableCellMap(selectedTable);
      const selectedEntry = entries.get(selectedCell);

      if (!selectedEntry) {
        return false;
      }

      const geometryTargetCell = resolveTemplateEditorTableNavigationCellByGeometry(
        selectedTable,
        selectedCell,
        event.key,
      );
      const targetCoordinates =
        event.key === "ArrowUp"
          ? { rowIndex: selectedEntry.rowIndex - 1, colIndex: selectedEntry.colIndex, axis: "row" }
          : event.key === "ArrowDown"
            ? { rowIndex: selectedEntry.rowIndex + selectedEntry.rowSpan, colIndex: selectedEntry.colIndex, axis: "row" }
            : event.key === "ArrowLeft"
              ? { rowIndex: selectedEntry.rowIndex, colIndex: selectedEntry.colIndex - 1, axis: "column" }
              : { rowIndex: selectedEntry.rowIndex, colIndex: selectedEntry.colIndex + selectedEntry.colSpan, axis: "column" };

      if (targetCoordinates.rowIndex < 0 || targetCoordinates.colIndex < 0) {
        return false;
      }

      const targetCell = geometryTargetCell || resolveTemplateEditorTableNavigationCell(
        matrix,
        targetCoordinates.rowIndex,
        targetCoordinates.colIndex,
        targetCoordinates.axis,
      );

      if (!targetCell || targetCell === selectedCell) {
        return false;
      }

      event.preventDefault();
      clearTemplateEditorTableSelection();
      focusTemplateEditorCell(targetCell);
      return true;
    }

    function getProtectedTemplateDocumentElement() {
      return shell.surfaceElement?.querySelector?.(".template-doc") || null;
    }

    function hasMeaningfulTemplateDocumentContent(documentElement) {
      if (!documentElement) {
        return false;
      }

      if (String(documentElement.textContent || "").trim()) {
        return true;
      }

      return Boolean(documentElement.querySelector("img, table, hr, [data-template-tag-value], .template-generated-object"));
    }

    function ensureProtectedTemplateDocumentElement() {
      let documentElement = getProtectedTemplateDocumentElement();

      if (!documentElement) {
        documentElement = ownerDocument.createElement("div");
        documentElement.className = "template-doc";

        while (shell.surfaceElement.firstChild) {
          documentElement.append(shell.surfaceElement.firstChild);
        }

        shell.surfaceElement.append(documentElement);
        deps.pageSettings?.normalizeTemplatePageDocumentSettings?.(documentElement);
      }

      if (hasMeaningfulTemplateDocumentContent(documentElement)) {
        return documentElement;
      }

      let host = Array.from(documentElement.children).find((child) => /^(P|DIV)$/i.test(String(child.tagName || "")));

      if (!host) {
        host = ownerDocument.createElement("p");
        documentElement.insertBefore(host, documentElement.firstChild);
      }

      if (!String(host.textContent || "").trim() && !host.querySelector("br, img, table, hr, [data-template-tag-value]")) {
        host.append(ownerDocument.createElement("br"));
      }

      const selection = ownerWindow.getSelection?.();

      if (selection) {
        const range = ownerDocument.createRange();

        range.setStart(host, 0);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        state.templateEditor.savedRange = range.cloneRange();
      }

      return documentElement;
    }

    function protectEmptyTemplateDocumentBoundary(event) {
      if (event.key !== "Backspace" && event.key !== "Delete") {
        return false;
      }

      const documentElement = getProtectedTemplateDocumentElement();

      if (hasMeaningfulTemplateDocumentContent(documentElement)) {
        return false;
      }

      // A blank document may still contain several authored lines. Only guard
      // its final caret host; otherwise preserve the selection for native
      // Backspace/Delete, including selecting and clearing all blank lines.
      const blockSelector = "p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre";
      const leafBlocks = Array.from(documentElement?.querySelectorAll(blockSelector) || [])
        .filter((element) => !element.querySelector(blockSelector));
      if (leafBlocks.length > 1 || documentElement?.querySelectorAll("br").length > 1) {
        return false;
      }

      event.preventDefault();
      ensureProtectedTemplateDocumentElement();
      syncTemplateEditorContent({ preserveSelection: true, focusEditor: true });
      return true;
    }

    function deleteSelectedTemplateEditorImage(event) {
      if (event.key !== "Backspace" && event.key !== "Delete") {
        return false;
      }

      const selectedImage = state.templateEditor.selectedImageElement;

      if (!selectedImage || !shell.surfaceElement.contains(selectedImage)) {
        return false;
      }

      const target = event.target instanceof Element ? event.target : null;

      if (!shell.surfaceElement.contains(target) && target?.closest?.("input, textarea, select, button")) {
        return false;
      }

      event.preventDefault();
      releaseTemplateEditorImageMoveSession({ sync: false });
      releaseTemplateEditorImageResizeSession({ sync: false });
      selectedImage.remove();
      clearTemplateEditorImageSelection();
      syncTemplateEditorContent({ preserveSelection: true, focusEditor: true });
      return true;
    }

    function clearSelectedTemplateEditorCellContents(event) {
      if (event.isComposing || (event.key !== "Backspace" && event.key !== "Delete")) {
        return false;
      }

      const surface = getTemplateEditorSurface?.() || shell.surfaceElement;
      const selection = getTemplateEditorActiveTableSelection?.();
      const target = event.target instanceof ownerWindow.Element ? event.target : null;
      if (!surface || !selection?.selectedCells?.length || target?.closest("input, textarea, select, button")) {
        return false;
      }
      if (!shell.surfaceElement.contains(ownerDocument.activeElement)) {
        return false;
      }
      const cells = Array.from(new Set(selection.selectedCells)).filter(
        (cell) => surface.contains(cell) && cell.closest("table") === selection.table,
      );
      if (!cells.length) {
        return false;
      }

      event.preventDefault();
      event.stopPropagation();
      clearTemplateEditorTableObjectSelection();
      releaseTemplateEditorTableSelectionSession({ keepSelection: true });
      cells.forEach((cell) => cell.replaceChildren(ownerDocument.createElement("br")));

      // Replace any stale text/object range with a caret inside the retained table.
      const range = ownerDocument.createRange();
      range.selectNodeContents(cells[0]);
      range.collapse(true);
      surface.focus({ preventScroll: true });
      const nativeSelection = ownerWindow.getSelection();
      nativeSelection.removeAllRanges();
      nativeSelection.addRange(range);
      state.templateEditor.savedRange = range.cloneRange();
      syncTemplateEditorContent({ preserveSelection: true, normalizeTables: false });
      return true;
    }

    function deleteSelectedTemplateEditorTable(event) {
      if (event.key !== "Backspace" && event.key !== "Delete") {
        return false;
      }

      const selectedTable = state.templateEditor.selectedTableElement;

      if (!isTemplateEditorTableObjectElement(selectedTable)) {
        if (selectedTable) {
          clearTemplateEditorTableObjectSelection();
        }
        return false;
      }

      const target = event.target instanceof Element ? event.target : null;

      if (!shell.surfaceElement.contains(target) && target?.closest?.("input, textarea, select, button")) {
        return false;
      }

      const isCandidateBlockTable = Boolean(selectedTable.closest?.("[data-candidate-block-instance]"));

      event.preventDefault();
      event.stopPropagation();
      releaseTemplateEditorTableResizeSession({ sync: false });
      releaseTemplateEditorTableSelectionSession({ keepSelection: false });
      clearTemplateEditorTableSelection();
      clearTemplateEditorTableObjectSelection({ updateOverlay: false });
      replaceTemplateEditorTableWithCaretHost(selectedTable);
      updateTemplateEditorTableObjectOverlay();
      syncTemplateEditorContent({ preserveSelection: true, focusEditor: true, allowOverflow: isCandidateBlockTable });
      return true;
    }

    function handleTemplateEditorPlainTextEnter(event, isSurfaceTarget, isModifierPressed) {
      if (
        event.key !== "Enter" ||
        !isSurfaceTarget ||
        isModifierPressed ||
        event.altKey
      ) {
        return false;
      }

      const selection = ownerWindow.getSelection?.();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

      if (!range || !shell.surfaceElement.contains(range.commonAncestorContainer)) {
        return false;
      }

      const baseElement =
        range.commonAncestorContainer instanceof ownerWindow.Element
          ? range.commonAncestorContainer
          : range.commonAncestorContainer?.parentElement || null;

      if (
        baseElement?.closest?.(
          "td, th, [data-candidate-block-grid], [data-candidate-block-instance], [contenteditable='false'], .template-token[data-template-tag-value]",
        )
      ) {
        return false;
      }

      event.preventDefault();

      const didInsertLineBreak = typeof ownerDocument.execCommand === "function"
        ? ownerDocument.execCommand("insertLineBreak", false, null)
        : false;

      if (!didInsertLineBreak) {
        const lineBreak = ownerDocument.createElement("br");

        range.deleteContents();
        range.insertNode(lineBreak);
        range.setStartAfter(lineBreak);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      syncTemplateEditorContent({ preserveSelection: true, focusEditor: true });
      return true;
    }

    function handleKeydown(event) {
      if (event.isComposing || state.templateEditor.isComposing) return;
      const isSurfaceTarget = event.target === shell.surfaceElement || shell.surfaceElement.contains(event.target);
      const isModifierPressed = event.ctrlKey || event.metaKey;
      const normalizedKey = String(event.key || "").toLowerCase();

      if (event.key === "Escape" && toolbar.closeAllEditorToolbarBorderSelectMenus?.()) {
        event.preventDefault();
        return;
      }

      if (isSurfaceTarget && isModifierPressed && !event.altKey) {
        if (normalizedKey === "z" && event.shiftKey) {
          event.preventDefault();
          applyTemplateEditorKeyboardHistory("redo");
          return;
        }

        if (normalizedKey === "z") {
          event.preventDefault();
          applyTemplateEditorKeyboardHistory("undo");
          return;
        }

        if (normalizedKey === "y") {
          event.preventDefault();
          applyTemplateEditorKeyboardHistory("redo");
          return;
        }
      }

      if (isSurfaceTarget && !isModifierPressed && handleTemplateEditorObjectKeyboardNudge(event)) {
        return;
      }

      if (isSurfaceTarget && !isModifierPressed && !event.altKey && !event.shiftKey && handleTemplateEditorTableArrowNavigation(event)) {
        return;
      }

      if (handleTemplateEditorPlainTextEnter(event, isSurfaceTarget, isModifierPressed)) {
        return;
      }

      if (!isModifierPressed && !event.altKey && clearSelectedTemplateEditorCellContents(event)) {
        return;
      }

      if (!isModifierPressed && deleteSelectedTemplateEditorTable(event)) {
        return;
      }

      if (!isModifierPressed && deleteSelectedTemplateEditorImage(event)) {
        return;
      }

      if (isSurfaceTarget && !isModifierPressed && (event.key === "Backspace" || event.key === "Delete")) {
        if (protectEmptyTemplateDocumentBoundary(event)) {
          return;
        }

        handleTemplateEditorTokenDeletion(event);
      }

      if (
        event.key === "Enter" &&
        (event.target === toolbarElements.tableRows || event.target === toolbarElements.tableColumns) &&
        !toolbarElements.tableInsertPanel?.classList.contains("hidden")
      ) {
        event.preventDefault();
        handleTemplateEditorInsert("table-confirm");
      }

      if (
        event.key === "Enter" &&
        event.target === toolbarElements.cellSplitCount &&
        !toolbarElements.cellSplitPanel?.classList.contains("hidden")
      ) {
        event.preventDefault();
        const cellSplitConfig = getTemplateEditorCellSplitConfig?.();

        if (cellSplitConfig && handleTemplateTableAction("split-cell", cellSplitConfig)) {
          setTemplateEditorCellSplitPanelVisibility(false);
        }
      }

      if (event.key === "Enter" && event.target === toolbarElements.fontSize) {
        event.preventDefault();
        applyTemplateEditorFontSize(event.target.value);
      }

      if (event.key === "Enter" && event.target?.matches?.("[data-editor-color-hex-input]")) {
        event.preventDefault();

        if (applyToolbarHexColorInput(event.target, { commit: true })) {
          toolbar.closeAllEditorToolbarColorPanels();
        }
      }
    }

    return Object.freeze({
      handleKeydown,
    });
  }

  return Object.freeze({
    createTemplateEditorKeyboardController,
  });
});

})();
