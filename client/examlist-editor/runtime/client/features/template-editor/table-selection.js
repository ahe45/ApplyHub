(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableSelection = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorTableSelectionController({
    TEMPLATE_EDITOR_TABLE_SELECTION_DRAG_THRESHOLD,
    buildTemplateTableCellMap,
    clearTemplateEditorTableHoverState,
    getClosestTemplateEditorElement,
    getTemplateEditorSelectionNode,
    getTemplateEditorSurface,
    state,
    updateTemplateTableControls,
  }) {
    function getTemplateEditorTableCellTarget(target) {
      const templateEditorSurface = getTemplateEditorSurface();
      const baseElement =
        target instanceof Element ? target : target?.parentElement instanceof Element ? target.parentElement : null;
      const cell = baseElement?.closest("td, th") || null;

      if (!cell || !templateEditorSurface?.contains(cell)) {
        return null;
      }

      return cell;
    }

    function getTemplateEditorActiveTableSelection() {
      const templateEditorSurface = getTemplateEditorSurface();
      const selection = state.templateEditor.tableSelection;

      if (!selection?.anchorCell || !templateEditorSurface?.contains(selection.anchorCell)) {
        return null;
      }

      return selection;
    }

    function getTemplateEditorSelectedCell() {
      const tableSelection = getTemplateEditorActiveTableSelection();

      if (tableSelection?.anchorCell) {
        return tableSelection.anchorCell;
      }

      const selectionCell = getClosestTemplateEditorElement(getTemplateEditorSelectionNode(), "td, th");

      if (selectionCell) {
        return selectionCell;
      }

      const stateActiveCell = state.templateEditor.activeCellElement;
      const templateEditorSurface = getTemplateEditorSurface();

      if (stateActiveCell instanceof Element && templateEditorSurface?.contains(stateActiveCell)) {
        return stateActiveCell;
      }

      const activeCell = getTemplateEditorSurface()?.querySelector(".is-active-cell");

      return activeCell instanceof Element ? activeCell : null;
    }

    function getTemplateEditorSelectedTable() {
      const selectedCell = getTemplateEditorSelectedCell();

      if (selectedCell) {
        return selectedCell.closest("table");
      }

      return getClosestTemplateEditorElement(getTemplateEditorSelectionNode(), "table");
    }

    function getTemplateEditorTableSelectionRange(anchorCell, focusCell) {
      const table = anchorCell?.closest("table");

      if (!table || table !== focusCell?.closest("table")) {
        return null;
      }

      const { matrix, entries } = buildTemplateTableCellMap(table);
      const anchorEntry = entries.get(anchorCell);
      const focusEntry = entries.get(focusCell);

      if (!anchorEntry || !focusEntry) {
        return null;
      }

      let startRowIndex = Math.min(anchorEntry.rowIndex, focusEntry.rowIndex);
      let endRowIndex = Math.max(
        anchorEntry.rowIndex + anchorEntry.rowSpan - 1,
        focusEntry.rowIndex + focusEntry.rowSpan - 1,
      );
      let startColIndex = Math.min(anchorEntry.colIndex, focusEntry.colIndex);
      let endColIndex = Math.max(
        anchorEntry.colIndex + anchorEntry.colSpan - 1,
        focusEntry.colIndex + focusEntry.colSpan - 1,
      );

      let didExpand = true;

      while (didExpand) {
        didExpand = false;

        for (let rowIndex = startRowIndex; rowIndex <= endRowIndex; rowIndex += 1) {
          for (let colIndex = startColIndex; colIndex <= endColIndex; colIndex += 1) {
            const cell = matrix[rowIndex]?.[colIndex];
            const entry = cell ? entries.get(cell) : null;

            if (!entry) {
              continue;
            }

            const entryEndRowIndex = entry.rowIndex + entry.rowSpan - 1;
            const entryEndColIndex = entry.colIndex + entry.colSpan - 1;

            if (entry.rowIndex < startRowIndex) {
              startRowIndex = entry.rowIndex;
              didExpand = true;
            }

            if (entryEndRowIndex > endRowIndex) {
              endRowIndex = entryEndRowIndex;
              didExpand = true;
            }

            if (entry.colIndex < startColIndex) {
              startColIndex = entry.colIndex;
              didExpand = true;
            }

            if (entryEndColIndex > endColIndex) {
              endColIndex = entryEndColIndex;
              didExpand = true;
            }
          }
        }
      }

      const selectedCells = [];
      const selectedCellSet = new Set();

      for (let rowIndex = startRowIndex; rowIndex <= endRowIndex; rowIndex += 1) {
        for (let colIndex = startColIndex; colIndex <= endColIndex; colIndex += 1) {
          const cell = matrix[rowIndex]?.[colIndex];

          if (cell && !selectedCellSet.has(cell)) {
            selectedCellSet.add(cell);
            selectedCells.push(cell);
          }
        }
      }

      selectedCells.sort((leftCell, rightCell) => {
        const leftEntry = entries.get(leftCell);
        const rightEntry = entries.get(rightCell);

        if (!leftEntry || !rightEntry) {
          return 0;
        }

        return leftEntry.rowIndex - rightEntry.rowIndex || leftEntry.colIndex - rightEntry.colIndex;
      });

      return {
        table,
        anchorCell,
        focusCell,
        selectedCells,
        startRowIndex,
        endRowIndex,
        startColIndex,
        endColIndex,
      };
    }

    function clearTemplateEditorTableSelection() {
      const templateEditorSurface = getTemplateEditorSurface();

      if (templateEditorSurface) {
        templateEditorSurface
          .querySelectorAll(".is-selected-cell")
          .forEach((cell) => cell.classList.remove("is-selected-cell"));
      }

      state.templateEditor.tableSelection = null;
    }

    function applyTemplateEditorTableSelection(anchorCell, focusCell) {
      const nextSelection = getTemplateEditorTableSelectionRange(anchorCell, focusCell);

      clearTemplateEditorTableSelection();

      if (!nextSelection) {
        return null;
      }

      nextSelection.selectedCells.forEach((cell) => cell.classList.add("is-selected-cell"));
      state.templateEditor.tableSelection = nextSelection;
      updateTemplateTableControls();
      return nextSelection;
    }

    function handleTemplateEditorTableSelectionMove(event) {
      const selectionSession = state.templateEditor.tableSelectionSession;

      if (!selectionSession || selectionSession.pointerId !== event.pointerId) {
        return;
      }

      const focusCell = getTemplateEditorTableCellTarget(document.elementFromPoint(event.clientX, event.clientY));
      const pointerDistance = Math.hypot(event.clientX - selectionSession.startX, event.clientY - selectionSession.startY);

      if (
        !selectionSession.isRangeSelecting &&
        (!focusCell || focusCell === selectionSession.anchorCell ||
          focusCell.closest("table") !== selectionSession.table || pointerDistance < TEMPLATE_EDITOR_TABLE_SELECTION_DRAG_THRESHOLD)
      ) {
        // Let native text selection continue within the starting cell. Switch
        // to rectangular cell selection only after crossing into another cell.
        return;
      }

      if (!focusCell || focusCell.closest("table") !== selectionSession.table) {
        return;
      }

      event.preventDefault();

      if (!selectionSession.isRangeSelecting) {
        selectionSession.isRangeSelecting = true;
        getTemplateEditorSurface()?.classList.add("is-table-selecting");
      }

      selectionSession.focusCell = focusCell;
      window.getSelection()?.removeAllRanges();
      applyTemplateEditorTableSelection(selectionSession.anchorCell, focusCell);
    }

    function releaseTemplateEditorTableSelectionSession({ keepSelection = false } = {}) {
      window.removeEventListener("pointermove", handleTemplateEditorTableSelectionMove, true);
      window.removeEventListener("pointerup", handleTemplateEditorTableSelectionEnd, true);
      window.removeEventListener("pointercancel", handleTemplateEditorTableSelectionEnd, true);
      state.templateEditor.tableSelectionSession = null;
      getTemplateEditorSurface()?.classList.remove("is-table-selecting");
      clearTemplateEditorTableHoverState();

      if (!keepSelection) {
        clearTemplateEditorTableSelection();
      }
    }

    function handleTemplateEditorTableSelectionEnd(event) {
      const selectionSession = state.templateEditor.tableSelectionSession;

      if (!selectionSession || selectionSession.pointerId !== event.pointerId) {
        return;
      }

      if (selectionSession.isRangeSelecting) {
        event.preventDefault();
      }

      releaseTemplateEditorTableSelectionSession({
        keepSelection: selectionSession.isRangeSelecting,
      });
    }

    function startTemplateEditorTableSelectionSession(anchorCell, event) {
      clearTemplateEditorTableSelection();
      clearTemplateEditorTableHoverState();
      state.templateEditor.tableSelectionSession = {
        pointerId: event.pointerId,
        table: anchorCell.closest("table"),
        anchorCell,
        focusCell: anchorCell,
        startX: event.clientX,
        startY: event.clientY,
        isRangeSelecting: false,
      };

      window.addEventListener("pointermove", handleTemplateEditorTableSelectionMove, true);
      window.addEventListener("pointerup", handleTemplateEditorTableSelectionEnd, true);
      window.addEventListener("pointercancel", handleTemplateEditorTableSelectionEnd, true);
    }

    return Object.freeze({
      clearTemplateEditorTableSelection,
      getTemplateEditorActiveTableSelection,
      getTemplateEditorSelectedCell,
      getTemplateEditorSelectedTable,
      getTemplateEditorTableCellTarget,
      releaseTemplateEditorTableSelectionSession,
      startTemplateEditorTableSelectionSession,
    });
  }

  return Object.freeze({
    createTemplateEditorTableSelectionController,
  });
});

})();
