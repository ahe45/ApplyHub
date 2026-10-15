(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableBorderActions = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const tableBorderApplicationModule = globalThis.ExamListTemplateEditorTableBorderApplication;
  const tableBorderConfigModule = globalThis.ExamListTemplateEditorTableBorderConfig;
  const tableBorderGeometryModule = globalThis.ExamListTemplateEditorTableBorderGeometry;
  const tableBorderSelectionModule = globalThis.ExamListTemplateEditorTableBorderSelection;

  if (!tableBorderApplicationModule?.applyTemplateEditorCellSharedBorderSide) {
    throw new Error("client/features/template-editor/table-border-application.js must be loaded before table-border-actions.js.");
  }

  if (!tableBorderConfigModule?.createTemplateEditorTableBorderConfigController) {
    throw new Error("client/features/template-editor/table-border-config.js must be loaded before table-border-actions.js.");
  }

  if (!tableBorderGeometryModule?.createTemplateEditorTableBorderGeometryController) {
    throw new Error("client/features/template-editor/table-border-geometry.js must be loaded before table-border-actions.js.");
  }

  if (!tableBorderSelectionModule?.createTemplateEditorTableBorderSelectionController) {
    throw new Error("client/features/template-editor/table-border-selection.js must be loaded before table-border-actions.js.");
  }

  const { applyTemplateEditorCellSharedBorderSide } = tableBorderApplicationModule;
  const { createTemplateEditorTableBorderConfigController } = tableBorderConfigModule;
  const { createTemplateEditorTableBorderGeometryController } = tableBorderGeometryModule;
  const { createTemplateEditorTableBorderSelectionController } = tableBorderSelectionModule;
  const TEMPLATE_EDITOR_CELL_PADDING_MAX = 96;
  const TEMPLATE_EDITOR_CELL_PADDING_SIDES = Object.freeze([
    Object.freeze({ key: "top", propertyName: "paddingTop", label: "위쪽" }),
    Object.freeze({ key: "right", propertyName: "paddingRight", label: "오른쪽" }),
    Object.freeze({ key: "bottom", propertyName: "paddingBottom", label: "아래쪽" }),
    Object.freeze({ key: "left", propertyName: "paddingLeft", label: "왼쪽" }),
  ]);

  function formatTemplateEditorPointValue(value) {
    return String(Math.round(value * 100) / 100);
  }

  function createTemplateEditorTableBorderActionController({
    TEMPLATE_EDITOR_TABLE_MIN_SIZE,
    buildTemplateTableCellMap,
    getTemplateEditorActiveTableSelection,
    getTemplateEditorBorderColorInput,
    getTemplateEditorBorderStyleInput,
    getTemplateEditorBorderTargetInput,
    getTemplateEditorBorderWidthInput,
    getTemplateEditorCellPaddingBottomInput,
    getTemplateEditorCellPaddingLeftInput,
    getTemplateEditorCellPaddingRightInput,
    getTemplateEditorCellPaddingTopInput,
    getTemplateEditorSelectedCell,
    normalizeTemplateEditorColorValue,
    setTemplateEditorStatus,
  }) {
    const {
      createTemplateEditorBorderBoxSnapshot,
      createTemplateEditorTableGeometrySnapshot,
      restoreTemplateEditorBorderBoxSnapshot,
      restoreTemplateEditorCollapsedTableBorderModel,
      restoreTemplateEditorTableGeometrySnapshot,
      stabilizeTemplateEditorBorderTargetTables,
    } = createTemplateEditorTableBorderGeometryController({
      TEMPLATE_EDITOR_TABLE_MIN_SIZE,
      buildTemplateTableCellMap,
    });
    const {
      clearTemplateEditorBorderControlDirtyState,
      getTemplateEditorBorderConfig,
      getTemplateEditorBorderCssValue,
    } = createTemplateEditorTableBorderConfigController({
      getTemplateEditorBorderColorInput,
      getTemplateEditorBorderStyleInput,
      getTemplateEditorBorderTargetInput,
      getTemplateEditorBorderWidthInput,
      normalizeTemplateEditorColorValue,
    });
    const {
      buildSelectedTableCellCoordinateSet,
      getTemplateEditorTableTargetCells,
      shouldApplyTemplateEditorSelectionBorderSide,
    } = createTemplateEditorTableBorderSelectionController({
      buildTemplateTableCellMap,
      getTemplateEditorActiveTableSelection,
      getTemplateEditorSelectedCell,
    });

    function restoreTemplateEditorTableBorderSnapshots(targetCells, borderBoxSnapshot, tableGeometrySnapshot) {
      restoreTemplateEditorBorderBoxSnapshot(borderBoxSnapshot);
      restoreTemplateEditorTableGeometrySnapshot(tableGeometrySnapshot);
      clearTemplateEditorBorderControlDirtyState();
      return targetCells[0] || null;
    }

    function getTemplateEditorCellPaddingInput(side) {
      if (side === "top") {
        return getTemplateEditorCellPaddingTopInput?.() || null;
      }

      if (side === "right") {
        return getTemplateEditorCellPaddingRightInput?.() || null;
      }

      if (side === "bottom") {
        return getTemplateEditorCellPaddingBottomInput?.() || null;
      }

      if (side === "left") {
        return getTemplateEditorCellPaddingLeftInput?.() || null;
      }

      return null;
    }

    function readTemplateEditorCellPaddingValue(side, options = {}) {
      const optionValue = options[`padding${side[0].toUpperCase()}${side.slice(1)}`] ?? options[side];
      const rawValue = optionValue ?? getTemplateEditorCellPaddingInput(side)?.value ?? "";
      const trimmedValue = String(rawValue).trim();

      if (!trimmedValue) {
        return null;
      }

      const numericValue = Number(trimmedValue);

      if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > TEMPLATE_EDITOR_CELL_PADDING_MAX) {
        return Number.NaN;
      }

      return Math.round(numericValue * 100) / 100;
    }

    function applyTemplateEditorCellPadding(options = {}) {
      const targetCells = getTemplateEditorTableTargetCells();

      if (targetCells.length === 0) {
        setTemplateEditorStatus("표 안의 셀을 선택한 뒤 셀 여백을 적용하세요.", "warning");
        return null;
      }

      const paddingEntries = TEMPLATE_EDITOR_CELL_PADDING_SIDES.map((sideConfig) => ({
        ...sideConfig,
        value: readTemplateEditorCellPaddingValue(sideConfig.key, options),
      }));
      const invalidEntry = paddingEntries.find((entry) => Number.isNaN(entry.value));

      if (invalidEntry) {
        setTemplateEditorStatus(
          `셀 ${invalidEntry.label} 여백은 0px 이상 ${TEMPLATE_EDITOR_CELL_PADDING_MAX}px 이하로 입력하세요.`,
          "warning",
        );
        return null;
      }

      const activeEntries = paddingEntries.filter((entry) => entry.value !== null);

      if (activeEntries.length === 0) {
        setTemplateEditorStatus("적용할 셀 여백 값을 입력하세요.", "warning");
        return null;
      }

      targetCells.forEach((cell) => {
        activeEntries.forEach((entry) => {
          cell.style[entry.propertyName] = `${formatTemplateEditorPointValue(entry.value)}px`;
        });
      });

      return targetCells[0] || null;
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
      const borderValue = getTemplateEditorBorderCssValue(config);

      if (config.target === "all") {
        targetCells.forEach((cell) => {
          const entry = entries.get(cell);

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
        return restoreTemplateEditorTableBorderSnapshots(targetCells, borderBoxSnapshot, tableGeometrySnapshot);
      }

      if (sides.includes(config.target)) {
        targetCells.forEach((cell) => {
          const entry = entries.get(cell);

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
        return restoreTemplateEditorTableBorderSnapshots(targetCells, borderBoxSnapshot, tableGeometrySnapshot);
      }

      targetCells.forEach((cell) => {
        const entry = entries.get(cell);

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

      return restoreTemplateEditorTableBorderSnapshots(targetCells, borderBoxSnapshot, tableGeometrySnapshot);
    }

    return Object.freeze({
      applyTemplateEditorCellBorder,
      applyTemplateEditorCellPadding,
      getTemplateEditorTableTargetCells,
    });
  }

  return Object.freeze({
    createTemplateEditorTableBorderActionController,
  });
});

})();
