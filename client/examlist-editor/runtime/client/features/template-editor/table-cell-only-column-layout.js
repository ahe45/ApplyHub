(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableCellOnlyColumnLayout = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorTableCellOnlyColumnLayoutController({
    TEMPLATE_EDITOR_TABLE_MIN_SIZE,
    buildTemplateTableCellMap,
    getTemplateEditorResizeColumns,
    getTemplateEditorResizeColumnWidth,
    parseTemplateEditorResizePixelValue,
    setTemplateEditorResizeColumnWidth,
  }) {
    function normalizeTemplateEditorCellOnlyRowWidths(widths, totalWidth) {
      const normalizedWidths = widths.map((width) => Math.max(1, Math.round(width)));
      const currentTotalWidth = normalizedWidths.reduce((widthSum, width) => widthSum + width, 0);
      const widthDelta = Math.round(totalWidth) - currentTotalWidth;

      if (normalizedWidths.length > 0 && widthDelta !== 0) {
        normalizedWidths[normalizedWidths.length - 1] = Math.max(1, normalizedWidths[normalizedWidths.length - 1] + widthDelta);
      }

      return normalizedWidths;
    }

    function getTemplateEditorCellOnlyRowBoundaries(widths, totalWidth) {
      const boundaries = [0];
      let currentPosition = 0;

      widths.forEach((width, index) => {
        currentPosition += Math.max(1, Math.round(width));
        boundaries.push(index === widths.length - 1 ? Math.round(totalWidth) : currentPosition);
      });

      return boundaries;
    }

    function getTemplateEditorCellOnlyRowCells(matrix, rowIndex) {
      const cells = [];
      const seenCells = new Set();

      (matrix[rowIndex] || []).forEach((cell) => {
        if (!cell || seenCells.has(cell)) {
          return;
        }

        seenCells.add(cell);
        cells.push(cell);
      });

      return cells;
    }

    function getTemplateEditorCellOnlyMeasurementScale(measuredSize, configuredSize, table) {
      const focusBlock = table?.closest?.("[data-candidate-block-instance].is-candidate-block-focus-editor");
      if (focusBlock) {
        const style = window.getComputedStyle(focusBlock);
        const scale = Number.parseFloat(style.getPropertyValue("--examlist-candidate-block-focus-editor-scale") || style.getPropertyValue("--examlist-candidate-block-focus-scale"));
        if (Number.isFinite(scale) && scale > 0) return scale;
      }
      const measured = Number(measuredSize) || 0;
      const configured = Number(configuredSize) || 0;

      return configured > 0 && measured > configured * 1.2 ? measured / configured : 1;
    }

    function createTemplateEditorCellOnlyColumnLayout(table, rowIndex, lineIndex) {
      const rows = Array.from(table?.rows || []);
      const targetRow = rows[rowIndex] || null;
      const { matrix } = buildTemplateTableCellMap(table);
      const leftCell = matrix[rowIndex]?.[lineIndex] || null;
      const rightCell = matrix[rowIndex]?.[lineIndex + 1] || null;
      const targetCells = getTemplateEditorCellOnlyRowCells(matrix, rowIndex);
      const boundaryCellIndex = targetCells.indexOf(leftCell);

      if (!table || !targetRow || !leftCell || !rightCell || boundaryCellIndex < 0 || targetCells[boundaryCellIndex + 1] !== rightCell) {
        return null;
      }

      const tableRect = table.getBoundingClientRect();
      const configuredColumnWidth = getTemplateEditorResizeColumns(table).reduce(
        (widthSum, columnElement) => widthSum + Math.max(0, parseTemplateEditorResizePixelValue(columnElement.style.width, 0)),
        0,
      );
      const configuredTableWidth = parseTemplateEditorResizePixelValue(table.style.width, 0);
      const hasConfiguredPixelTableWidth = String(table.style.width || "").trim().endsWith("px");
      const measuredTargetRowWidth = targetCells.reduce(
        (widthSum, cell) => widthSum + Math.max(0, Math.round(cell.getBoundingClientRect().width || 0)),
        0,
      );
      const configuredReferenceWidth = (hasConfiguredPixelTableWidth && configuredTableWidth) || configuredColumnWidth || 0;
      const measurementScale = getTemplateEditorCellOnlyMeasurementScale(measuredTargetRowWidth, configuredReferenceWidth, table);
      const tableWidth = Math.max(
        TEMPLATE_EDITOR_TABLE_MIN_SIZE * targetCells.length,
        Math.round(
          (hasConfiguredPixelTableWidth && configuredTableWidth) ||
            (measuredTargetRowWidth / measurementScale) ||
            (tableRect.width / measurementScale) ||
            configuredColumnWidth ||
            0,
        ),
      );
      const rowLayouts = rows
        .map((row, layoutRowIndex) => {
          const cells = getTemplateEditorCellOnlyRowCells(matrix, layoutRowIndex);
          const measuredWidths = cells.map((cell) =>
            Math.max(1, Math.round((cell.getBoundingClientRect().width || 0) / measurementScale)),
          );

          if (!cells.length) {
            return null;
          }

          const widths = normalizeTemplateEditorCellOnlyRowWidths(measuredWidths, tableWidth);

          return {
            cells,
            row,
            widths,
          };
        })
        .filter(Boolean);

      if (!rowLayouts[rowIndex] || rowLayouts[rowIndex].cells[boundaryCellIndex] !== leftCell) {
        return null;
      }

      return {
        boundaryCellIndex,
        rowIndex,
        rowLayouts,
        tableWidth,
      };
    }

    function applyTemplateEditorCellOnlyColumnLayout(table, layout, targetRowWidths) {
      const rowBoundaries = layout.rowLayouts.map((rowLayout, rowIndex) =>
        getTemplateEditorCellOnlyRowBoundaries(rowIndex === layout.rowIndex ? targetRowWidths : rowLayout.widths, layout.tableWidth),
      );
      const positions = Array.from(
        new Set(
          rowBoundaries
            .flat()
            .map((position) => Math.max(0, Math.min(layout.tableWidth, Math.round(position)))),
        ),
      ).sort((leftPosition, rightPosition) => leftPosition - rightPosition);

      if (positions[0] !== 0) {
        positions.unshift(0);
      }

      if (positions[positions.length - 1] !== layout.tableWidth) {
        positions.push(layout.tableWidth);
      }

      let colGroup = Array.from(table.children).find((child) => child.tagName === "COLGROUP") || null;

      if (!colGroup) {
        colGroup = document.createElement("colgroup");
        table.insertBefore(colGroup, table.firstElementChild);
      }

      const segmentWidths = [];

      for (let index = 0; index < positions.length - 1; index += 1) {
        segmentWidths.push(Math.max(1, positions[index + 1] - positions[index]));
      }

      while (colGroup.children.length < segmentWidths.length) {
        colGroup.appendChild(document.createElement("col"));
      }

      while (colGroup.children.length > segmentWidths.length) {
        colGroup.lastElementChild?.remove();
      }

      Array.from(colGroup.children).forEach((columnElement, index) => {
        setTemplateEditorResizeColumnWidth(columnElement, segmentWidths[index]);
      });

      const cellAssignments = new Map();

      layout.rowLayouts.forEach((rowLayout, rowIndex) => {
        const boundaries = rowBoundaries[rowIndex];

        rowLayout.cells.forEach((cell, cellIndex) => {
          const startPosition = boundaries[cellIndex];
          const endPosition = boundaries[cellIndex + 1];
          const startIndex = positions.indexOf(startPosition);
          const endIndex = positions.indexOf(endPosition);

          if (startIndex >= 0 && endIndex > startIndex) {
            const previousAssignment = cellAssignments.get(cell) || null;

            if (!previousAssignment || rowIndex === layout.rowIndex || previousAssignment.rowIndex !== layout.rowIndex) {
              cellAssignments.set(cell, {
                cell,
                colSpan: Math.max(1, endIndex - startIndex),
                rowIndex,
                width: Math.max(1, endPosition - startPosition),
              });
            }
          }
        });
      });

      cellAssignments.forEach((assignment) => {
        assignment.cell.colSpan = assignment.colSpan;
        assignment.cell.style.width = `${assignment.width}px`;
      });

      table.style.width = `${layout.tableWidth}px`;
      table.style.maxWidth = "none";
    }

    function getTemplateEditorCellOnlyColumnLayoutWidths(layout, boundaryDelta) {
      const targetRowLayout = layout?.rowLayouts?.[layout.rowIndex] || null;

      if (!targetRowLayout) {
        return [];
      }

      const widths = [...targetRowLayout.widths];
      const boundaryCellIndex = layout.boundaryCellIndex;
      const requestedDelta = Math.round(boundaryDelta);

      if (!requestedDelta) {
        return widths;
      }

      if (requestedDelta > 0) {
        const availableWidth = widths
          .slice(boundaryCellIndex + 1)
          .reduce((widthSum, width) => widthSum + Math.max(0, width - TEMPLATE_EDITOR_TABLE_MIN_SIZE), 0);
        let remainingDelta = Math.min(requestedDelta, availableWidth);
        const appliedDelta = remainingDelta;

        widths[boundaryCellIndex] += appliedDelta;

        for (let index = boundaryCellIndex + 1; index < widths.length && remainingDelta > 0; index += 1) {
          const consumedWidth = Math.min(Math.max(0, widths[index] - TEMPLATE_EDITOR_TABLE_MIN_SIZE), remainingDelta);

          widths[index] -= consumedWidth;
          remainingDelta -= consumedWidth;
        }
      } else {
        const requestedShrinkWidth = Math.abs(requestedDelta);
        const availableWidth = widths
          .slice(0, boundaryCellIndex + 1)
          .reduce((widthSum, width) => widthSum + Math.max(0, width - TEMPLATE_EDITOR_TABLE_MIN_SIZE), 0);
        let remainingDelta = Math.min(requestedShrinkWidth, availableWidth);
        const appliedDelta = remainingDelta;

        widths[boundaryCellIndex + 1] += appliedDelta;

        for (let index = boundaryCellIndex; index >= 0 && remainingDelta > 0; index -= 1) {
          const consumedWidth = Math.min(Math.max(0, widths[index] - TEMPLATE_EDITOR_TABLE_MIN_SIZE), remainingDelta);

          widths[index] -= consumedWidth;
          remainingDelta -= consumedWidth;
        }
      }

      return normalizeTemplateEditorCellOnlyRowWidths(widths, layout.tableWidth);
    }

    return Object.freeze({
      applyTemplateEditorCellOnlyColumnLayout,
      createTemplateEditorCellOnlyColumnLayout,
      getTemplateEditorCellOnlyColumnLayoutWidths,
    });
  }

  return Object.freeze({
    createTemplateEditorTableCellOnlyColumnLayoutController,
  });
});

})();
