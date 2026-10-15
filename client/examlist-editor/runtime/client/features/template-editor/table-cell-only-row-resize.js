(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableCellOnlyRowResize = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorTableCellOnlyRowResizeController({
    TEMPLATE_EDITOR_TABLE_MIN_SIZE,
    buildTemplateTableCellMap,
  }) {
    function parseTemplateEditorResizePixelValue(value, fallback = 0) {
      const parsedValue = Number.parseFloat(String(value || "").replace("px", ""));

      return Number.isFinite(parsedValue) ? parsedValue : fallback;
    }

    function normalizeTemplateEditorCellOnlyColumnHeights(heights, totalHeight) {
      const normalizedHeights = heights.map((height) => Math.max(1, Math.round(height)));
      const currentTotalHeight = normalizedHeights.reduce((heightSum, height) => heightSum + height, 0);
      const heightDelta = Math.round(totalHeight) - currentTotalHeight;

      if (normalizedHeights.length > 0 && heightDelta !== 0) {
        normalizedHeights[normalizedHeights.length - 1] = Math.max(1, normalizedHeights[normalizedHeights.length - 1] + heightDelta);
      }

      return normalizedHeights;
    }

    function getTemplateEditorCellOnlyColumnBoundaries(heights, totalHeight) {
      const boundaries = [0];
      let currentPosition = 0;

      heights.forEach((height, index) => {
        currentPosition += Math.max(1, Math.round(height));
        boundaries.push(index === heights.length - 1 ? Math.round(totalHeight) : currentPosition);
      });

      return boundaries;
    }

    function getTemplateEditorCellOnlyColumnCells(matrix, columnIndex) {
      const cells = [];
      const seenCells = new Set();

      matrix.forEach((row) => {
        const cell = row?.[columnIndex] || null;

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

    function getTemplateEditorCellOnlyCellHeight(cell, measurementScale = 1) {
      const configuredHeight = parseTemplateEditorResizePixelValue(cell?.style?.height, 0);

      if (configuredHeight > 0) {
        return configuredHeight;
      }

      const measuredHeight = Math.round((cell?.getBoundingClientRect?.().height || 0) / Math.max(measurementScale, 0.01));

      return Number.isFinite(measuredHeight) && measuredHeight > 0 ? measuredHeight : TEMPLATE_EDITOR_TABLE_MIN_SIZE;
    }

    function createTemplateEditorCellOnlyRowLayout(table, columnIndex, lineIndex) {
      const rows = Array.from(table?.rows || []);
      const rowParent = rows[0]?.parentElement || null;
      const { matrix, entries } = buildTemplateTableCellMap(table);
      const topCell = matrix[lineIndex]?.[columnIndex] || null;
      const bottomCell = matrix[lineIndex + 1]?.[columnIndex] || null;
      const targetCells = getTemplateEditorCellOnlyColumnCells(matrix, columnIndex);
      const boundaryCellIndex = targetCells.indexOf(topCell);
      const columnCount = matrix.reduce((maxColumnCount, row) => Math.max(maxColumnCount, row?.length || 0), 0);

      if (
        !table ||
        !rows.length ||
        !rowParent ||
        rows.some((row) => row.parentElement !== rowParent) ||
        !topCell ||
        !bottomCell ||
        boundaryCellIndex < 0 ||
        targetCells[boundaryCellIndex + 1] !== bottomCell ||
        columnCount <= 0
      ) {
        return null;
      }

      const tableRect = table.getBoundingClientRect();
      const configuredTableHeight = parseTemplateEditorResizePixelValue(table.style.height, 0);
      const hasConfiguredPixelTableHeight = String(table.style.height || "").trim().endsWith("px");
      const measuredTargetColumnHeight = targetCells.reduce(
        (heightSum, cell) => heightSum + Math.max(0, Math.round(cell.getBoundingClientRect().height || 0)),
        0,
      );
      const measurementScale = getTemplateEditorCellOnlyMeasurementScale(
        measuredTargetColumnHeight,
        hasConfiguredPixelTableHeight ? configuredTableHeight : 0,
        table,
      );
      const tableHeight = Math.max(
        TEMPLATE_EDITOR_TABLE_MIN_SIZE * targetCells.length,
        Math.round(
          (hasConfiguredPixelTableHeight && configuredTableHeight) ||
            (tableRect.height / measurementScale) ||
            (measuredTargetColumnHeight / measurementScale) ||
            0,
        ),
      );
      const columnLayouts = Array.from({ length: columnCount }, (_item, layoutColumnIndex) => {
        const cells = getTemplateEditorCellOnlyColumnCells(matrix, layoutColumnIndex);

        if (!cells.length) {
          return null;
        }

        const measuredHeights = cells.map((cell) => Math.max(1, Math.round(getTemplateEditorCellOnlyCellHeight(cell, measurementScale))));
        const heights = normalizeTemplateEditorCellOnlyColumnHeights(measuredHeights, tableHeight);

        return {
          cells,
          columnIndex: layoutColumnIndex,
          heights,
        };
      }).filter(Boolean);
      const targetColumnLayout = columnLayouts.find((columnLayout) => columnLayout.columnIndex === columnIndex) || null;

      if (!targetColumnLayout || targetColumnLayout.cells[boundaryCellIndex] !== topCell) {
        return null;
      }

      return {
        boundaryCellIndex,
        columnIndex,
        columnLayouts,
        rowParent,
        tableHeight,
        cellEntries: Array.from(entries.values()).map((entry) => ({
          cell: entry.cell,
          colIndex: entry.colIndex,
          colSpan: entry.colSpan,
        })),
      };
    }

    function applyTemplateEditorCellOnlyRowLayout(table, layout, targetColumnHeights) {
      const columnBoundaries = layout.columnLayouts.map((columnLayout) =>
        getTemplateEditorCellOnlyColumnBoundaries(
          columnLayout.columnIndex === layout.columnIndex ? targetColumnHeights : columnLayout.heights,
          layout.tableHeight,
        ),
      );
      const positions = Array.from(
        new Set(
          columnBoundaries
            .flat()
            .map((position) => Math.max(0, Math.min(layout.tableHeight, Math.round(position))))),
      ).sort((topPosition, bottomPosition) => topPosition - bottomPosition);

      if (positions[0] !== 0) {
        positions.unshift(0);
      }

      if (positions[positions.length - 1] !== layout.tableHeight) {
        positions.push(layout.tableHeight);
      }

      const segmentHeights = [];

      for (let index = 0; index < positions.length - 1; index += 1) {
        segmentHeights.push(Math.max(1, positions[index + 1] - positions[index]));
      }

      const columnLayoutByIndex = new Map(layout.columnLayouts.map((columnLayout, index) => [columnLayout.columnIndex, {
        boundaries: columnBoundaries[index],
        columnLayout,
      }]));
      const rows = segmentHeights.map((height) => {
        const row = document.createElement("tr");

        row.style.height = `${Math.max(1, Math.round(height))}px`;
        return row;
      });
      const placements = [];
      const positionedCells = new Set();

      layout.cellEntries.forEach((entry) => {
        if (!entry.cell || positionedCells.has(entry.cell)) {
          return;
        }

        const targetLayoutCandidate = columnLayoutByIndex.get(layout.columnIndex) || null;
        const preferredLayoutCandidate = targetLayoutCandidate?.columnLayout.cells.includes(entry.cell)
          ? targetLayoutCandidate
          : columnLayoutByIndex.get(entry.colIndex) || null;
        const layoutCandidate = preferredLayoutCandidate || null;
        let columnLayout = layoutCandidate?.columnLayout || null;
        let boundaries = layoutCandidate?.boundaries || null;
        let cellIndex = columnLayout?.cells.indexOf(entry.cell) ?? -1;

        if (cellIndex < 0) {
          for (const [candidateColumnIndex, candidate] of columnLayoutByIndex.entries()) {
            const candidateIndex = candidate.columnLayout.cells.indexOf(entry.cell);

            if (candidateColumnIndex >= entry.colIndex && candidateIndex >= 0) {
              columnLayout = candidate.columnLayout;
              boundaries = candidate.boundaries;
              cellIndex = candidateIndex;
              break;
            }
          }
        }

        const startPosition = boundaries?.[cellIndex];
        const endPosition = boundaries?.[cellIndex + 1];
        const startRowIndex = positions.indexOf(startPosition);
        const endRowIndex = positions.indexOf(endPosition);

        if (!columnLayout || !boundaries || cellIndex < 0 || startRowIndex < 0 || endRowIndex <= startRowIndex) {
          return;
        }

        const cellHeight = Math.max(1, Math.round(endPosition - startPosition));

        entry.cell.rowSpan = Math.max(1, endRowIndex - startRowIndex);
        entry.cell.colSpan = Math.max(1, Math.round(entry.colSpan || 1));
        entry.cell.style.height = `${cellHeight}px`;
        entry.cell.style.minHeight = `${cellHeight}px`;
        placements.push({
          cell: entry.cell,
          colIndex: entry.colIndex,
          rowIndex: startRowIndex,
        });
        positionedCells.add(entry.cell);
      });

      placements
        .sort((leftPlacement, rightPlacement) =>
          leftPlacement.rowIndex === rightPlacement.rowIndex
            ? leftPlacement.colIndex - rightPlacement.colIndex
            : leftPlacement.rowIndex - rightPlacement.rowIndex,
        )
        .forEach((placement) => {
          rows[placement.rowIndex]?.appendChild(placement.cell);
        });

      if (!rows.length || rows.some((row) => row.cells.length === 0)) {
        return;
      }

      layout.rowParent.replaceChildren(...rows);
      table.dataset.templateCellOnlyRowLayout = "true";
      table.style.height = `${layout.tableHeight}px`;
    }

    function getTemplateEditorCellOnlyRowLayoutHeights(layout, boundaryDelta) {
      const targetColumnLayout = layout?.columnLayouts?.find((columnLayout) => columnLayout.columnIndex === layout.columnIndex) || null;

      if (!targetColumnLayout) {
        return [];
      }

      const heights = [...targetColumnLayout.heights];
      const boundaryCellIndex = layout.boundaryCellIndex;
      const requestedDelta = Math.round(boundaryDelta);

      if (!requestedDelta) {
        return heights;
      }

      if (requestedDelta > 0) {
        const availableHeight = heights
          .slice(boundaryCellIndex + 1)
          .reduce((heightSum, height) => heightSum + Math.max(0, height - TEMPLATE_EDITOR_TABLE_MIN_SIZE), 0);
        let remainingDelta = Math.min(requestedDelta, availableHeight);
        const appliedDelta = remainingDelta;

        heights[boundaryCellIndex] += appliedDelta;

        for (let index = boundaryCellIndex + 1; index < heights.length && remainingDelta > 0; index += 1) {
          const consumedHeight = Math.min(Math.max(0, heights[index] - TEMPLATE_EDITOR_TABLE_MIN_SIZE), remainingDelta);

          heights[index] -= consumedHeight;
          remainingDelta -= consumedHeight;
        }
      } else {
        const requestedShrinkHeight = Math.abs(requestedDelta);
        const availableHeight = heights
          .slice(0, boundaryCellIndex + 1)
          .reduce((heightSum, height) => heightSum + Math.max(0, height - TEMPLATE_EDITOR_TABLE_MIN_SIZE), 0);
        let remainingDelta = Math.min(requestedShrinkHeight, availableHeight);
        const appliedDelta = remainingDelta;

        heights[boundaryCellIndex + 1] += appliedDelta;

        for (let index = boundaryCellIndex; index >= 0 && remainingDelta > 0; index -= 1) {
          const consumedHeight = Math.min(Math.max(0, heights[index] - TEMPLATE_EDITOR_TABLE_MIN_SIZE), remainingDelta);

          heights[index] -= consumedHeight;
          remainingDelta -= consumedHeight;
        }
      }

      return normalizeTemplateEditorCellOnlyColumnHeights(heights, layout.tableHeight);
    }

    function getTemplateEditorCellOnlyRowMeasuredHeight(resizeSession) {
      const focusScale = Math.max(Number(resizeSession?.focusScale) || 1, 0.01);

      return Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, Math.round(resizeSession.cell.getBoundingClientRect().height / focusScale));
    }

    function applyTemplateEditorCellOnlyRowResizeValue(resizeSession, boundaryDelta) {
      if (!resizeSession.cellOnlyRowLayout) {
        return resizeSession.lastSize;
      }

      const nextHeights = getTemplateEditorCellOnlyRowLayoutHeights(resizeSession.cellOnlyRowLayout, boundaryDelta);

      if (nextHeights.length) {
        applyTemplateEditorCellOnlyRowLayout(resizeSession.table, resizeSession.cellOnlyRowLayout, nextHeights);
      }

      return getTemplateEditorCellOnlyRowMeasuredHeight(resizeSession);
    }

    return Object.freeze({
      applyTemplateEditorCellOnlyRowResizeValue,
      createTemplateEditorCellOnlyRowLayout,
    });
  }

  return Object.freeze({
    createTemplateEditorTableCellOnlyRowResizeController,
  });
});

})();
