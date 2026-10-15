(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableSizingScope = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorTableSizingScopeController({
    buildTemplateTableCellMap,
    getTemplateEditorActiveTableSelection,
  }) {
    function getTemplateEditorSizeScopeCells(selectedCell, scope) {
      const table = selectedCell?.closest("table");

      if (!table || !selectedCell) {
        return [];
      }

      if (scope === "cell") {
        return [selectedCell];
      }

      const { matrix, entries } = buildTemplateTableCellMap(table);
      const selectedEntry = entries.get(selectedCell);

      if (!selectedEntry) {
        return [selectedCell];
      }

      const targetCells = new Set();

      if (scope === "row") {
        (matrix[selectedEntry.rowIndex] || []).forEach((cell) => {
          if (cell) {
            targetCells.add(cell);
          }
        });
      }

      if (scope === "column") {
        matrix.forEach((row) => {
          const cell = row?.[selectedEntry.colIndex];

          if (cell) {
            targetCells.add(cell);
          }
        });
      }

      if (scope === "table") {
        entries.forEach((entry) => {
          targetCells.add(entry.cell);
        });
      }

      return Array.from(targetCells);
    }

    function getTemplateEditorSizeScopeColumnIndexes(selectedCell, scope) {
      const table = selectedCell?.closest("table");

      if (!table || !selectedCell) {
        return [];
      }

      const { matrix, entries } = buildTemplateTableCellMap(table);
      const selectedEntry = entries.get(selectedCell);

      if (!selectedEntry) {
        return [];
      }

      const columnIndexes = new Set();
      const addColumnRange = (startIndex, span) => {
        for (let columnIndex = startIndex; columnIndex < startIndex + span; columnIndex += 1) {
          columnIndexes.add(columnIndex);
        }
      };

      if (scope === "cell" || scope === "column") {
        addColumnRange(selectedEntry.colIndex, selectedEntry.colSpan);
      }

      if (scope === "row") {
        (matrix[selectedEntry.rowIndex] || []).forEach((cell, columnIndex) => {
          if (cell) {
            columnIndexes.add(columnIndex);
          }
        });
      }

      if (scope === "table") {
        const columnCount = matrix.reduce((maxCount, row) => Math.max(maxCount, Array.isArray(row) ? row.length : 0), 0);

        for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
          columnIndexes.add(columnIndex);
        }
      }

      return Array.from(columnIndexes).sort((leftIndex, rightIndex) => leftIndex - rightIndex);
    }

    function getTemplateEditorEqualizeColumnIndexes(table, selectedCell) {
      const tableSelection = getTemplateEditorActiveTableSelection();

      if (tableSelection?.table === table) {
        return Array.from(
          { length: tableSelection.endColIndex - tableSelection.startColIndex + 1 },
          (_, index) => tableSelection.startColIndex + index,
        );
      }

      const { matrix, entries } = buildTemplateTableCellMap(table);
      const selectedEntry = entries.get(selectedCell);

      if (!selectedEntry) {
        return [];
      }

      return (matrix[selectedEntry.rowIndex] || [])
        .map((cell, columnIndex) => (cell ? columnIndex : null))
        .filter((columnIndex) => columnIndex !== null);
    }

    function getTemplateEditorEqualizeRowIndexes(table, selectedCell) {
      const tableSelection = getTemplateEditorActiveTableSelection();

      if (tableSelection?.table === table) {
        return Array.from(
          { length: tableSelection.endRowIndex - tableSelection.startRowIndex + 1 },
          (_, index) => tableSelection.startRowIndex + index,
        );
      }

      const { matrix, entries } = buildTemplateTableCellMap(table);
      const selectedEntry = entries.get(selectedCell);

      if (!selectedEntry) {
        return [];
      }

      return matrix
        .map((row, rowIndex) => (row?.[selectedEntry.colIndex] ? rowIndex : null))
        .filter((rowIndex) => rowIndex !== null);
    }

    function getTemplateEditorShadingTargetCells(selectedCell) {
      const tableSelection = getTemplateEditorActiveTableSelection();

      if (tableSelection?.selectedCells?.length) {
        return tableSelection.selectedCells;
      }

      return selectedCell ? [selectedCell] : [];
    }

    return Object.freeze({
      getTemplateEditorEqualizeColumnIndexes,
      getTemplateEditorEqualizeRowIndexes,
      getTemplateEditorShadingTargetCells,
      getTemplateEditorSizeScopeCells,
      getTemplateEditorSizeScopeColumnIndexes,
    });
  }

  return Object.freeze({
    createTemplateEditorTableSizingScopeController,
  });
});

})();
