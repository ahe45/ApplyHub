(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableBorderGeometry = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorTableBorderGeometryController({
    TEMPLATE_EDITOR_TABLE_MIN_SIZE,
    buildTemplateTableCellMap,
  }) {
    function getTemplateEditorBorderTargetTables(targetCells) {
      return Array.from(new Set(targetCells.map((cell) => cell?.closest("table")).filter(Boolean)));
    }

    function restoreTemplateEditorCollapsedTableBorderModel(targetCells) {
      getTemplateEditorBorderTargetTables(targetCells).forEach((table) => {
        table.style.borderCollapse = "collapse";
        table.style.removeProperty("border-spacing");
        table.style.removeProperty("border");
      });
    }

    function formatTemplateEditorPixelValue(value) {
      const normalizedValue = Number(value);

      if (!Number.isFinite(normalizedValue)) {
        return "0px";
      }

      return `${Math.max(0, Math.round(normalizedValue * 100) / 100)}px`;
    }

    function parseTemplateEditorCssPixelValue(value, fallback = 0) {
      const parsedValue = Number.parseFloat(String(value || "").replace("px", ""));
      return Number.isFinite(parsedValue) ? parsedValue : fallback;
    }

    function parseTemplateEditorInlinePixelValue(value, fallback = 0) {
      const normalizedValue = String(value || "").trim();

      if (!/^-?\d+(?:\.\d+)?px$/i.test(normalizedValue)) {
        return fallback;
      }

      return parseTemplateEditorCssPixelValue(normalizedValue, fallback);
    }

    function getTemplateEditorMeasuredColumnWidth(cellMap, columnIndex) {
      const { matrix, entries } = cellMap;

      for (const row of matrix) {
        const cell = row?.[columnIndex];
        const entry = cell ? entries.get(cell) : null;

        if (!entry) {
          continue;
        }

        const measuredWidth = cell.getBoundingClientRect().width / entry.colSpan;

        if (Number.isFinite(measuredWidth) && measuredWidth > 0) {
          return Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, measuredWidth);
        }
      }

      return TEMPLATE_EDITOR_TABLE_MIN_SIZE;
    }

    function stabilizeTemplateEditorTableColumns(table) {
      if (!(table instanceof HTMLTableElement)) {
        return;
      }

      const cellMap = buildTemplateTableCellMap(table);
      const columnCount = cellMap.matrix.reduce(
        (maxColumnCount, row) => Math.max(maxColumnCount, Array.isArray(row) ? row.length : 0),
        0,
      );

      if (columnCount <= 0) {
        return;
      }

      const measuredColumnWidths = Array.from({ length: columnCount }, (_, columnIndex) =>
        getTemplateEditorMeasuredColumnWidth(cellMap, columnIndex),
      );
      let colGroup = Array.from(table.children).find((child) => child.tagName === "COLGROUP") || null;

      if (!colGroup) {
        colGroup = document.createElement("colgroup");
        table.insertBefore(colGroup, table.firstElementChild);
      }

      while (colGroup.children.length < columnCount) {
        colGroup.appendChild(document.createElement("col"));
      }

      while (colGroup.children.length > columnCount) {
        colGroup.lastElementChild?.remove();
      }

      Array.from(colGroup.children).forEach((columnElement, columnIndex) => {
        const configuredWidth = parseTemplateEditorInlinePixelValue(columnElement.style.width, 0);

        if (configuredWidth >= TEMPLATE_EDITOR_TABLE_MIN_SIZE) {
          return;
        }

        columnElement.style.width = formatTemplateEditorPixelValue(measuredColumnWidths[columnIndex]);
      });
    }

    function stabilizeTemplateEditorTableRows(table) {
      if (!(table instanceof HTMLTableElement)) {
        return;
      }

      Array.from(table.rows || []).forEach((row) => {
        const measuredHeight = row.getBoundingClientRect().height;

        if (Number.isFinite(measuredHeight) && measuredHeight > 0) {
          row.style.height = formatTemplateEditorPixelValue(measuredHeight);
        }
      });
    }

    function stabilizeTemplateEditorBorderTargetTables(targetCells) {
      getTemplateEditorBorderTargetTables(targetCells).forEach((table) => {
        stabilizeTemplateEditorTableColumns(table);
        stabilizeTemplateEditorTableRows(table);
      });
    }

    function getTemplateEditorBorderCompensationCells(targetCells) {
      const compensationCells = new Set();
      const targetTables = Array.from(new Set(targetCells.map((cell) => cell?.closest("table")).filter(Boolean)));

      targetTables.forEach((table) => {
        buildTemplateTableCellMap(table).entries.forEach((entry) => {
          compensationCells.add(entry.cell);
        });
      });

      targetCells.forEach((cell) => {
        if (cell) {
          compensationCells.add(cell);
        }
      });

      return Array.from(compensationCells);
    }

    function getTemplateEditorBorderSideStyleProperties(side) {
      const normalizedSide = side[0].toUpperCase() + side.slice(1);

      return Object.freeze({
        borderWidth: `border${normalizedSide}Width`,
        padding: `padding${normalizedSide}`,
      });
    }

    function createTemplateEditorBorderBoxSnapshot(targetCells) {
      return getTemplateEditorBorderCompensationCells(targetCells).map((cell) => {
        const computedStyle = window.getComputedStyle(cell);
        const tableBorderCollapse = String(
          window.getComputedStyle(cell.closest("table") || cell).borderCollapse || "",
        ).trim();
        const collapsedBorderFactor = tableBorderCollapse === "collapse" ? 0.5 : 1;
        const sides = {};

        ["top", "right", "bottom", "left"].forEach((side) => {
          const properties = getTemplateEditorBorderSideStyleProperties(side);

          sides[side] = Object.freeze({
            borderWidth: parseTemplateEditorCssPixelValue(computedStyle[properties.borderWidth], 0),
            padding: parseTemplateEditorCssPixelValue(computedStyle[properties.padding], 0),
          });
        });

        return Object.freeze({
          cell,
          collapsedBorderFactor,
          sides: Object.freeze(sides),
        });
      });
    }

    function restoreTemplateEditorBorderBoxSnapshot(snapshot) {
      snapshot.forEach(({ cell, collapsedBorderFactor, sides }) => {
        if (!cell?.isConnected) {
          return;
        }

        const computedStyle = window.getComputedStyle(cell);

        ["top", "right", "bottom", "left"].forEach((side) => {
          const previousSide = sides[side];
          const properties = getTemplateEditorBorderSideStyleProperties(side);
          const nextBorderWidth = parseTemplateEditorCssPixelValue(computedStyle[properties.borderWidth], 0);
          const borderDelta = (nextBorderWidth - previousSide.borderWidth) * collapsedBorderFactor;

          if (borderDelta <= 0.01) {
            return;
          }

          cell.style[properties.padding] = formatTemplateEditorPixelValue(previousSide.padding - borderDelta);
        });
      });
    }

    function getTemplateEditorTableSnapshotWidth(table) {
      const inlineWidth = parseTemplateEditorInlinePixelValue(table?.style?.width, 0);

      if (inlineWidth > 0) {
        return inlineWidth;
      }

      const computedWidth = parseTemplateEditorCssPixelValue(window.getComputedStyle(table).width, 0);

      if (computedWidth > 0) {
        return computedWidth;
      }

      const tableRect = table.getBoundingClientRect();
      return tableRect.width;
    }

    function createTemplateEditorTableGeometrySnapshot(targetCells) {
      return getTemplateEditorBorderTargetTables(targetCells).map((table) => {
        const rows = Array.from(table.rows || []).map((row) => {
          const rowRect = row.getBoundingClientRect();

          return Object.freeze({
            row,
            height: rowRect.height,
          });
        });
        const cells = Array.from(buildTemplateTableCellMap(table).entries.values()).map(({ cell }) => {
          const cellRect = cell.getBoundingClientRect();

          return Object.freeze({
            cell,
            height: cellRect.height,
            width: cellRect.width,
          });
        });

        return Object.freeze({
          table,
          width: getTemplateEditorTableSnapshotWidth(table),
          rows: Object.freeze(rows),
          cells: Object.freeze(cells),
        });
      });
    }

    function reduceTemplateEditorCellPaddingForOverflow(cell, firstSide, secondSide, overflow) {
      if (!cell?.isConnected || !Number.isFinite(overflow) || overflow <= 0.01) {
        return;
      }

      const computedStyle = window.getComputedStyle(cell);
      const firstProperty = `padding${firstSide}`;
      const secondProperty = `padding${secondSide}`;
      const firstPadding = parseTemplateEditorCssPixelValue(computedStyle[firstProperty], 0);
      const firstReduction = Math.min(firstPadding, overflow);

      if (firstReduction > 0.01) {
        cell.style[firstProperty] = formatTemplateEditorPixelValue(firstPadding - firstReduction);
      }

      const remainingOverflow = overflow - firstReduction;

      if (remainingOverflow <= 0.01) {
        return;
      }

      const secondPadding = parseTemplateEditorCssPixelValue(computedStyle[secondProperty], 0);
      const secondReduction = Math.min(secondPadding, remainingOverflow);

      if (secondReduction > 0.01) {
        cell.style[secondProperty] = formatTemplateEditorPixelValue(secondPadding - secondReduction);
      }
    }

    function restoreTemplateEditorTableGeometrySnapshot(snapshot) {
      snapshot.forEach(({ table, width, rows, cells }) => {
        if (!table?.isConnected) {
          return;
        }

        if (Number.isFinite(width) && width > 0) {
          table.style.width = formatTemplateEditorPixelValue(width);
        }

        rows.forEach(({ row, height }) => {
          if (row?.isConnected && Number.isFinite(height) && height > 0) {
            row.style.height = formatTemplateEditorPixelValue(height);
          }
        });

        cells.forEach(({ cell, height, width: cellWidth }) => {
          if (!cell?.isConnected) {
            return;
          }

          const currentRect = cell.getBoundingClientRect();
          reduceTemplateEditorCellPaddingForOverflow(cell, "Bottom", "Top", currentRect.height - height);
          reduceTemplateEditorCellPaddingForOverflow(cell, "Right", "Left", currentRect.width - cellWidth);
        });

        rows.forEach(({ row, height }) => {
          if (row?.isConnected && Number.isFinite(height) && height > 0) {
            row.style.height = formatTemplateEditorPixelValue(height);
          }
        });
      });
    }

    return Object.freeze({
      createTemplateEditorBorderBoxSnapshot,
      createTemplateEditorTableGeometrySnapshot,
      restoreTemplateEditorBorderBoxSnapshot,
      restoreTemplateEditorCollapsedTableBorderModel,
      restoreTemplateEditorTableGeometrySnapshot,
      stabilizeTemplateEditorBorderTargetTables,
    });
  }

  return Object.freeze({
    createTemplateEditorTableBorderGeometryController,
  });
});

})();
