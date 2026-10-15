(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableBorderApplication = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function clearTemplateEditorLegacyDoubleBorderArtifacts(cell, side = "") {
    if (!cell?.style) {
      return;
    }

    const targetSides = side ? [side] : ["top", "right", "bottom", "left"];

    targetSides.forEach((targetSide) => {
      cell.removeAttribute(`data-template-double-border-${targetSide}`);
      cell.removeAttribute(`data-template-double-border-native-${targetSide}`);
    });

    Array.from(cell.children || [])
      .filter((child) => {
        if (!child?.hasAttribute?.("data-template-double-border-overlay")) {
          return false;
        }

        return !side || child.getAttribute("data-template-double-border-overlay") === side;
      })
      .forEach((child) => child.remove());

    if (!cell.querySelector?.("[data-template-double-border-overlay]")) {
      cell.style.removeProperty("background-image");
      cell.style.removeProperty("background-size");
      cell.style.removeProperty("background-position");
      cell.style.removeProperty("background-repeat");
      cell.style.removeProperty("background-origin");
      cell.style.removeProperty("background-clip");
      cell.style.removeProperty("box-shadow");

      if (cell.dataset?.templateDoubleBorderPositioned === "true") {
        cell.style.removeProperty("position");
        delete cell.dataset.templateDoubleBorderPositioned;
      }
    }
  }

  function applyTemplateEditorCellBorderSide(cell, side, borderValue) {
    if (!cell?.style) {
      return;
    }

    const propertyName = `border${side[0].toUpperCase()}${side.slice(1)}`;
    clearTemplateEditorLegacyDoubleBorderArtifacts(cell, side);
    cell.style[propertyName] = borderValue;
  }

  function getTemplateEditorOppositeBorderSide(side) {
    return {
      top: "bottom",
      right: "left",
      bottom: "top",
      left: "right",
    }[side] || "";
  }

  function getTemplateEditorBorderNeighborCells(entry, side, matrix) {
    if (!entry || !Array.isArray(matrix)) {
      return [];
    }

    const neighborCells = [];
    const neighborCellSet = new Set();
    const addNeighborCell = (rowIndex, colIndex) => {
      const neighborCell = matrix[rowIndex]?.[colIndex] || null;

      if (neighborCell && !neighborCellSet.has(neighborCell)) {
        neighborCellSet.add(neighborCell);
        neighborCells.push(neighborCell);
      }
    };

    if (side === "top" || side === "bottom") {
      const borderRowIndex = side === "top" ? entry.rowIndex - 1 : entry.rowIndex + entry.rowSpan;

      for (let colIndex = entry.colIndex; colIndex < entry.colIndex + entry.colSpan; colIndex += 1) {
        addNeighborCell(borderRowIndex, colIndex);
      }
    }

    if (side === "left" || side === "right") {
      const borderColIndex = side === "left" ? entry.colIndex - 1 : entry.colIndex + entry.colSpan;

      for (let rowIndex = entry.rowIndex; rowIndex < entry.rowIndex + entry.rowSpan; rowIndex += 1) {
        addNeighborCell(rowIndex, borderColIndex);
      }
    }

    return neighborCells;
  }

  function applyTemplateEditorCellSharedBorderSide(
    cell,
    entry,
    side,
    borderValue,
    matrix,
    options = {},
  ) {
    const {
      shouldUpdateNeighbor = () => true,
    } = options;

    applyTemplateEditorCellBorderSide(cell, side, borderValue);

    const oppositeSide = getTemplateEditorOppositeBorderSide(side);

    if (!oppositeSide) {
      return;
    }

    getTemplateEditorBorderNeighborCells(entry, side, matrix)
      .filter((neighborCell) => shouldUpdateNeighbor(neighborCell, oppositeSide))
      .forEach((neighborCell) => applyTemplateEditorCellBorderSide(neighborCell, oppositeSide, borderValue));
  }

  return Object.freeze({
    applyTemplateEditorCellSharedBorderSide,
  });
});

})();
