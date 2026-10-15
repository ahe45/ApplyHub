(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableBorderSelection = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorTableBorderSelectionController({
    buildTemplateTableCellMap,
    getTemplateEditorActiveTableSelection,
    getTemplateEditorSelectedCell,
  }) {
    function getTemplateEditorTableTargetCells() {
      const tableSelection = getTemplateEditorActiveTableSelection();

      if (tableSelection?.selectedCells?.length) {
        return Array.from(new Set(tableSelection.selectedCells.filter(Boolean)));
      }

      const selectedCell = getTemplateEditorSelectedCell();
      return selectedCell ? [selectedCell] : [];
    }

    function buildSelectedTableCellCoordinateSet(tableSelection, targetCells) {
      const table = tableSelection?.table || targetCells[0]?.closest("table") || null;

      if (!table) {
        return { entries: new Map(), matrix: [], selectedCoordinates: new Set() };
      }

      const { entries, matrix } = buildTemplateTableCellMap(table);
      const selectedCoordinates = new Set();

      targetCells.forEach((cell) => {
        const entry = entries.get(cell);

        if (!entry) {
          return;
        }

        for (let rowIndex = entry.rowIndex; rowIndex < entry.rowIndex + entry.rowSpan; rowIndex += 1) {
          for (let colIndex = entry.colIndex; colIndex < entry.colIndex + entry.colSpan; colIndex += 1) {
            selectedCoordinates.add(`${rowIndex}:${colIndex}`);
          }
        }
      });

      return { entries, matrix, selectedCoordinates };
    }

    function shouldApplyTemplateEditorSelectionBorderSide(entry, side, selectedCoordinates, mode) {
      if (!entry) {
        return false;
      }

      const hasNeighbor = (rowIndex, colIndex) => selectedCoordinates.has(`${rowIndex}:${colIndex}`);

      if (side === "top" || side === "bottom") {
        const borderRowIndex = side === "top" ? entry.rowIndex - 1 : entry.rowIndex + entry.rowSpan;

        for (let colIndex = entry.colIndex; colIndex < entry.colIndex + entry.colSpan; colIndex += 1) {
          const neighborSelected = hasNeighbor(borderRowIndex, colIndex);

          if ((mode === "outside" && !neighborSelected) || (mode === "inside" && neighborSelected)) {
            return true;
          }
        }
      }

      if (side === "left" || side === "right") {
        const borderColIndex = side === "left" ? entry.colIndex - 1 : entry.colIndex + entry.colSpan;

        for (let rowIndex = entry.rowIndex; rowIndex < entry.rowIndex + entry.rowSpan; rowIndex += 1) {
          const neighborSelected = hasNeighbor(rowIndex, borderColIndex);

          if ((mode === "outside" && !neighborSelected) || (mode === "inside" && neighborSelected)) {
            return true;
          }
        }
      }

      return false;
    }

    return Object.freeze({
      buildSelectedTableCellCoordinateSet,
      getTemplateEditorTableTargetCells,
      shouldApplyTemplateEditorSelectionBorderSide,
    });
  }

  return Object.freeze({
    createTemplateEditorTableBorderSelectionController,
  });
});

})();
