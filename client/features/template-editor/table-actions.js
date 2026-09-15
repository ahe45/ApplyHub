(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardTemplateEditorTableActions = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const tableSizingModule = globalThis.AdmitCardTemplateEditorTableSizing;
  const tableStructureModule = globalThis.AdmitCardTemplateEditorTableStructure;

  if (!tableSizingModule?.createTemplateEditorTableSizingController) {
    throw new Error("client/features/template-editor/table-sizing.js must be loaded before table-actions.js.");
  }

  if (!tableStructureModule?.createTemplateEditorTableStructureController) {
    throw new Error("client/features/template-editor/table-structure.js must be loaded before table-actions.js.");
  }

  const { createTemplateEditorTableSizingController } = tableSizingModule;
  const { createTemplateEditorTableStructureController } = tableStructureModule;

  function createTemplateEditorTableActionController({
    TEMPLATE_EDITOR_TABLE_MIN_SIZE,
    buildTemplateTableCellMap,
    createTemplateTableCell,
    ensureTemplateEditorTableColGroup,
    focusTemplateEditorCell,
    getTemplateEditorClampedColumnGroupWidth,
    getTemplateEditorActiveTableSelection,
    getTemplateEditorBorderColorInput,
    getTemplateEditorBorderStyleInput,
    getTemplateEditorBorderTargetInput,
    getTemplateEditorBorderWidthInput,
    getTemplateEditorCellShadingInput,
    getTemplateEditorCellWidthInput,
    getTemplateEditorRowHeightInput,
    getTemplateEditorSelectedCell,
    getTemplateEditorSizeScopeInput,
    getTemplateEditorTableLogicalColumnWidth,
    getTemplateEditorTableLogicalRowHeight,
    normalizeTemplateEditorColorValue,
    normalizeTemplateEditorTableAppearance,
    restoreTemplateEditorSelection,
    setTemplateEditorStatus,
    setTemplateEditorTableLogicalColumnWidth,
    setTemplateEditorTableLogicalRowHeight,
    syncTemplateEditorContent,
    updateTemplateTableControls,
  }) {
    const tableSizingController = createTemplateEditorTableSizingController({
      TEMPLATE_EDITOR_TABLE_MIN_SIZE,
      buildTemplateTableCellMap,
      ensureTemplateEditorTableColGroup,
      focusTemplateEditorCell,
      getTemplateEditorClampedColumnGroupWidth,
      getTemplateEditorActiveTableSelection,
      getTemplateEditorCellShadingInput,
      getTemplateEditorCellWidthInput,
      getTemplateEditorRowHeightInput,
      getTemplateEditorSelectedCell,
      getTemplateEditorSizeScopeInput,
      getTemplateEditorTableLogicalColumnWidth,
      getTemplateEditorTableLogicalRowHeight,
      normalizeTemplateEditorColorValue,
      restoreTemplateEditorSelection,
      setTemplateEditorStatus,
      setTemplateEditorTableLogicalColumnWidth,
      setTemplateEditorTableLogicalRowHeight,
      syncTemplateEditorContent,
      updateTemplateTableControls,
    });
    const tableStructureController = createTemplateEditorTableStructureController({
      buildTemplateTableCellMap,
      createTemplateTableCell,
      getTemplateEditorActiveTableSelection,
      getTemplateEditorSelectedCell,
      ensureTemplateEditorTableColGroup,
      normalizeTemplateEditorTableAppearance,
      setTemplateEditorStatus,
    });
    const {
      appendMergedTemplateCellContent,
      deleteTemplateTableColumn,
      deleteTemplateTableRow,
      insertTemplateCellAtAbsoluteColumn,
      insertTemplateTableColumn,
      insertTemplateTableRow,
      isTemplateTableCellEmpty,
      mergeTemplateTableCell,
      mergeTemplateTableSelection,
      splitTemplateTableCell,
    } = tableStructureController;
    const {
      applyTemplateEditorCellShading,
      applyTemplateTableSize,
      equalizeTemplateTableColumnWidths,
      equalizeTemplateTableRowHeights,
      getTemplateEditorMedianValue,
    } = tableSizingController;

    function getTemplateEditorTableTargetCells() {
      const tableSelection = getTemplateEditorActiveTableSelection();

      if (tableSelection?.selectedCells?.length) {
        return Array.from(new Set(tableSelection.selectedCells.filter(Boolean)));
      }

      const selectedCell = getTemplateEditorSelectedCell();
      return selectedCell ? [selectedCell] : [];
    }

    function normalizeTemplateEditorBorderTarget(rawValue = "") {
      const normalizedValue = String(rawValue || "").trim();
      return ["all", "outside", "inside", "top", "right", "bottom", "left"].includes(normalizedValue)
        ? normalizedValue
        : "all";
    }

    function normalizeTemplateEditorBorderStyle(rawValue = "") {
      const normalizedValue = String(rawValue || "").trim();
      return ["solid", "dashed", "dotted", "double", "none"].includes(normalizedValue) ? normalizedValue : "solid";
    }

    function normalizeTemplateEditorBorderWidth(rawValue = 1) {
      const normalizedValue = String(rawValue ?? "").trim();
      const width = Math.round(Number(normalizedValue === "" ? 1 : normalizedValue));
      return Number.isFinite(width) ? Math.max(0, Math.min(12, width)) : 1;
    }

    function getTemplateEditorBorderConfig(options = {}) {
      const target = normalizeTemplateEditorBorderTarget(options.target || getTemplateEditorBorderTargetInput?.()?.value || "all");
      const style = normalizeTemplateEditorBorderStyle(options.style || getTemplateEditorBorderStyleInput?.()?.value || "solid");
      const rawWidth = normalizeTemplateEditorBorderWidth(options.width ?? getTemplateEditorBorderWidthInput?.()?.value ?? 1);
      const shouldRemoveBorder = rawWidth === 0 || style === "none";
      const width = !shouldRemoveBorder && style === "double" ? rawWidth + 2 : rawWidth;
      const color = normalizeTemplateEditorColorValue(
        options.colorValue || options.color || getTemplateEditorBorderColorInput?.()?.value || "#000000",
        "#000000",
      );

      return Object.freeze({
        color,
        target,
        style: shouldRemoveBorder ? "none" : style,
        width,
      });
    }

    function clearTemplateEditorBorderControlDirtyState() {
      [
        getTemplateEditorBorderColorInput?.(),
        getTemplateEditorBorderStyleInput?.(),
        getTemplateEditorBorderTargetInput?.(),
        getTemplateEditorBorderWidthInput?.(),
      ].forEach((element) => {
        if (element?.dataset) {
          delete element.dataset.editorBorderUserValue;
        }
      });
    }

    function getTemplateEditorBorderCssValue(config) {
      if (config.style === "none" || config.width <= 0) {
        return "none";
      }

      return `${config.width}px ${config.style} ${config.color}`;
    }

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

        columnElement.style.width = formatTemplateEditorPixelValue(
          measuredColumnWidths[columnIndex],
        );
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

          if (Math.abs(borderDelta) < 0.01) {
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

    function getTemplateEditorOppositeBorderSide(side) {
      return {
        top: "bottom",
        right: "left",
        bottom: "top",
        left: "right",
      }[side] || "";
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

    function applyTemplateEditorCellBorder(options = {}) {
      const tableSelection = getTemplateEditorActiveTableSelection();
      const targetCells = getTemplateEditorTableTargetCells();

      if (targetCells.length === 0) {
        setTemplateEditorStatus("표 안의 셀을 선택한 뒤 테두리를 적용하세요.", "warning");
        return null;
      }

      const config = getTemplateEditorBorderConfig(options);
      const sides = ["top", "right", "bottom", "left"];
      const { entries, matrix, selectedCoordinates } = buildSelectedTableCellCoordinateSet(tableSelection, targetCells);
      const selectedCellSet = new Set(targetCells);
      restoreTemplateEditorCollapsedTableBorderModel(targetCells);
      stabilizeTemplateEditorBorderTargetTables(targetCells);
      const tableGeometrySnapshot = createTemplateEditorTableGeometrySnapshot(targetCells);
      const borderBoxSnapshot = createTemplateEditorBorderBoxSnapshot(targetCells);

      if (config.target === "all") {
        targetCells.forEach((cell) => {
          const entry = entries.get(cell);
          const borderValue = getTemplateEditorBorderCssValue(config);

          sides.forEach((side) => {
            applyTemplateEditorCellSharedBorderSide(
              cell,
              entry,
              side,
              borderValue,
              matrix,
              {
                shouldUpdateNeighbor: config.style === "none" ? () => true : () => false,
              },
            );
          });
        });
        restoreTemplateEditorBorderBoxSnapshot(borderBoxSnapshot);
        restoreTemplateEditorTableGeometrySnapshot(tableGeometrySnapshot);
        clearTemplateEditorBorderControlDirtyState();
        return targetCells[0] || null;
      }

      if (sides.includes(config.target)) {
        targetCells.forEach((cell) => {
          const entry = entries.get(cell);
          const borderValue = getTemplateEditorBorderCssValue(config);

          applyTemplateEditorCellSharedBorderSide(
            cell,
            entry,
            config.target,
            borderValue,
            matrix,
            {
              shouldUpdateNeighbor: config.style === "none" ? () => true : () => false,
            },
          );
        });
        restoreTemplateEditorBorderBoxSnapshot(borderBoxSnapshot);
        restoreTemplateEditorTableGeometrySnapshot(tableGeometrySnapshot);
        clearTemplateEditorBorderControlDirtyState();
        return targetCells[0] || null;
      }

      targetCells.forEach((cell) => {
        const entry = entries.get(cell);
        const borderValue = getTemplateEditorBorderCssValue(config);

        sides.forEach((side) => {
          if (shouldApplyTemplateEditorSelectionBorderSide(entry, side, selectedCoordinates, config.target)) {
            applyTemplateEditorCellSharedBorderSide(
              cell,
              entry,
              side,
              borderValue,
              matrix,
              {
                shouldUpdateNeighbor:
                  config.style === "none" && config.target === "outside"
                    ? (neighborCell) => !selectedCellSet.has(neighborCell)
                    : config.style === "none"
                      ? (neighborCell) => selectedCellSet.has(neighborCell)
                      : () => false,
              },
            );
          }
        });
      });

      restoreTemplateEditorBorderBoxSnapshot(borderBoxSnapshot);
      restoreTemplateEditorTableGeometrySnapshot(tableGeometrySnapshot);
      clearTemplateEditorBorderControlDirtyState();
      return targetCells[0] || null;
    }

    function applyTemplateEditorCellVerticalAlign(verticalAlign = "top") {
      const targetCells = getTemplateEditorTableTargetCells();

      if (targetCells.length === 0) {
        setTemplateEditorStatus("표 안의 셀을 선택한 뒤 배치를 설정하세요.", "warning");
        return null;
      }

      const normalizedVerticalAlign = ["top", "middle", "bottom"].includes(String(verticalAlign || "").trim())
        ? String(verticalAlign || "").trim()
        : "top";

      targetCells.forEach((cell) => {
        cell.style.verticalAlign = normalizedVerticalAlign;
      });

      return targetCells[0] || null;
    }

    function handleTemplateTableAction(action, options = {}) {
      const { colorValue = "" } = options;
      restoreTemplateEditorSelection();

      let focusCell = null;

      if (action === "insert-row-before") {
        focusCell = insertTemplateTableRow("before");
      }

      if (action === "insert-row-after") {
        focusCell = insertTemplateTableRow("after");
      }

      if (action === "insert-column-before") {
        focusCell = insertTemplateTableColumn("before");
      }

      if (action === "insert-column-after") {
        focusCell = insertTemplateTableColumn("after");
      }

      if (action === "delete-row") {
        focusCell = deleteTemplateTableRow();
      }

      if (action === "delete-column") {
        focusCell = deleteTemplateTableColumn();
      }

      if (action === "merge-selection") {
        focusCell = mergeTemplateTableSelection();
      }

      if (action === "equalize-column-widths") {
        focusCell = equalizeTemplateTableColumnWidths();
      }

      if (action === "equalize-row-heights") {
        focusCell = equalizeTemplateTableRowHeights();
      }

      if (action === "apply-cell-shading") {
        applyTemplateEditorCellShading(colorValue);
        return true;
      }

      if (action === "apply-cell-border") {
        focusCell = applyTemplateEditorCellBorder(options);
      }

      if (action === "cell-vertical-align-top") {
        focusCell = applyTemplateEditorCellVerticalAlign("top");
      }

      if (action === "cell-vertical-align-middle") {
        focusCell = applyTemplateEditorCellVerticalAlign("middle");
      }

      if (action === "cell-vertical-align-bottom") {
        focusCell = applyTemplateEditorCellVerticalAlign("bottom");
      }

      if (action === "merge-right") {
        focusCell = mergeTemplateTableCell("right");
      }

      if (action === "merge-down") {
        focusCell = mergeTemplateTableCell("down");
      }

      if (action === "split-cell") {
        focusCell = splitTemplateTableCell(options);
      }

      if (!focusCell) {
        return false;
      }

      focusTemplateEditorCell(focusCell);
      syncTemplateEditorContent();
      updateTemplateTableControls();
      return true;
    }

    return Object.freeze({
      appendMergedTemplateCellContent,
      applyTemplateTableSize,
      getTemplateEditorMedianValue,
      handleTemplateTableAction,
      insertTemplateCellAtAbsoluteColumn,
      isTemplateTableCellEmpty,
    });
  }

  return Object.freeze({
    createTemplateEditorTableActionController,
  });
});
