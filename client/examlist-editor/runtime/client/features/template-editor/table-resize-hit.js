(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableResizeHit = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorTableResizeHitController({
    TEMPLATE_EDITOR_TABLE_EDGE_THRESHOLD,
    buildTemplateTableCellMap,
  }) {
    function getTemplateEditorTableResizeHit(cell, event) {
      const table = cell?.closest("table");

      if (!table) {
        return null;
      }

      const { entries } = buildTemplateTableCellMap(table);
      const entry = entries.get(cell);

      if (!entry) {
        return null;
      }

      const cellRect = cell.getBoundingClientRect();
      const zoom = cell.offsetWidth > 0 ? cellRect.width / cell.offsetWidth : 1;
      const horizontalThreshold = Math.min(TEMPLATE_EDITOR_TABLE_EDGE_THRESHOLD * zoom, cellRect.width / 4);
      const verticalThreshold = Math.min(TEMPLATE_EDITOR_TABLE_EDGE_THRESHOLD * zoom, cellRect.height / 4);
      const deltaLeft = Math.abs(cellRect.left - event.clientX);
      const deltaTop = Math.abs(cellRect.top - event.clientY);
      const deltaRight = Math.abs(cellRect.right - event.clientX);
      const deltaBottom = Math.abs(cellRect.bottom - event.clientY);
      const hits = [];

      if (deltaLeft <= horizontalThreshold && entry.colIndex > 0) {
        hits.push({ distance: deltaLeft, edge: "left", kind: "column", lineIndex: entry.colIndex - 1 });
      }

      if (deltaRight <= horizontalThreshold) {
        hits.push({ distance: deltaRight, edge: "right", kind: "column", lineIndex: entry.colIndex + entry.colSpan - 1 });
      }

      if (deltaTop <= verticalThreshold && entry.rowIndex > 0) {
        hits.push({ distance: deltaTop, edge: "top", kind: "row", lineIndex: entry.rowIndex - 1 });
      }

      if (deltaBottom <= verticalThreshold) {
        hits.push({ distance: deltaBottom, edge: "bottom", kind: "row", lineIndex: entry.rowIndex + entry.rowSpan - 1 });
      }

      if (hits.length === 0) {
        return null;
      }

      hits.sort((leftHit, rightHit) => leftHit.distance - rightHit.distance);
      const targetHit = hits[0];

      return {
        edge: targetHit.edge,
        kind: targetHit.kind,
        table,
        cell,
        lineIndex: targetHit.lineIndex,
        rowIndex: entry.rowIndex,
        colIndex: entry.colIndex,
      };
    }

    function getTemplateEditorTableLineCells(table, kind, lineIndex) {
      const { matrix } = buildTemplateTableCellMap(table);
      const targetCells = new Set();

      if (kind === "column") {
        matrix.forEach((row) => {
          const cell = row?.[lineIndex];

          if (cell) {
            targetCells.add(cell);
          }
        });
      }

      if (kind === "row") {
        (matrix[lineIndex] || []).forEach((cell) => {
          if (cell) {
            targetCells.add(cell);
          }
        });
      }

      return Array.from(targetCells);
    }

    function getTemplateEditorTableColumnCount(table) {
      const { matrix } = buildTemplateTableCellMap(table);

      return matrix.reduce((columnCount, row) => Math.max(columnCount, row?.length || 0), 0);
    }

    return Object.freeze({
      getTemplateEditorTableColumnCount,
      getTemplateEditorTableLineCells,
      getTemplateEditorTableResizeHit,
    });
  }

  return Object.freeze({
    createTemplateEditorTableResizeHitController,
  });
});

})();
