(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableCellOnlyColumnTransfer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorTableCellOnlyColumnTransferController({
    TEMPLATE_EDITOR_TABLE_MIN_SIZE,
    buildTemplateTableCellMap,
    getTemplateEditorResizeColumnWidth,
    getTemplateEditorResizeColumns,
    setTemplateEditorResizeColumnWidth,
    syncTemplateEditorResizeTableWidth,
  }) {
    function getTemplateEditorEntryEndColumn(entry) {
      return entry ? entry.colIndex + entry.colSpan - 1 : -1;
    }

    function getTemplateEditorColumnBoundaryCells(table, rowIndex, boundaryColumnIndex) {
      const { matrix, entries } = buildTemplateTableCellMap(table);
      const leftCell = matrix[rowIndex]?.[boundaryColumnIndex] || null;
      const rightCell = matrix[rowIndex]?.[boundaryColumnIndex + 1] || null;
      const leftEntry = leftCell ? entries.get(leftCell) : null;
      const rightEntry = rightCell ? entries.get(rightCell) : null;

      if (
        !leftCell ||
        !rightCell ||
        leftCell === rightCell ||
        !leftEntry ||
        !rightEntry ||
        getTemplateEditorEntryEndColumn(leftEntry) !== boundaryColumnIndex ||
        rightEntry.colIndex !== boundaryColumnIndex + 1
      ) {
        return null;
      }

      return {
        entries,
        leftCell,
        leftEntry,
        rightCell,
        rightEntry,
      };
    }

    function prepareTemplateEditorCellOnlyColumnResizePlan(resizeSession, boundaryDelta) {
      if (resizeSession.cellOnlyPlan) {
        return resizeSession.cellOnlyPlan;
      }

      const direction = boundaryDelta > 0 ? 1 : boundaryDelta < 0 ? -1 : 0;

      if (!direction) {
        return null;
      }

      const columns = getTemplateEditorResizeColumns(resizeSession.table);
      const leftColumnIndex = resizeSession.lineIndex;
      const rightColumnIndex = leftColumnIndex + 1;

      if (!columns[leftColumnIndex] || !columns[rightColumnIndex]) {
        return null;
      }

      const boundary = getTemplateEditorColumnBoundaryCells(
        resizeSession.table,
        resizeSession.rowIndex,
        leftColumnIndex,
      );

      if (!boundary) {
        return null;
      }

      const sourceColumnIndex = direction > 0 ? rightColumnIndex : leftColumnIndex;
      const sourceColumn = columns[sourceColumnIndex];
      const sourceWidth = getTemplateEditorResizeColumnWidth(sourceColumn);
      const canTransferSourceColumn =
        direction > 0
          ? boundary.rightEntry.colSpan > 1 && sourceColumnIndex < getTemplateEditorEntryEndColumn(boundary.rightEntry)
          : boundary.leftEntry.colSpan > 1 && sourceColumnIndex > boundary.leftEntry.colIndex;
      const minRemainingWidth = canTransferSourceColumn ? 1 : TEMPLATE_EDITOR_TABLE_MIN_SIZE;

      if (sourceWidth <= minRemainingWidth) {
        return null;
      }

      const splitColumn = document.createElement("col");
      const sourceCoveringCells = [];

      setTemplateEditorResizeColumnWidth(splitColumn, 1);

      if (direction > 0) {
        sourceColumn.parentElement.insertBefore(splitColumn, sourceColumn);
        boundary.entries.forEach((entry) => {
          const coversSourceColumn =
            entry.colIndex <= sourceColumnIndex && getTemplateEditorEntryEndColumn(entry) >= sourceColumnIndex;

          if (coversSourceColumn && entry.cell !== boundary.rightCell) {
            entry.cell.colSpan = entry.colSpan + 1;
            sourceCoveringCells.push(entry.cell);
          }
        });
        boundary.leftCell.colSpan = boundary.leftEntry.colSpan + 1;
      } else {
        sourceColumn.after(splitColumn);
        boundary.entries.forEach((entry) => {
          const coversSourceColumn =
            entry.colIndex <= sourceColumnIndex && getTemplateEditorEntryEndColumn(entry) >= sourceColumnIndex;

          if (coversSourceColumn && entry.cell !== boundary.leftCell) {
            entry.cell.colSpan = entry.colSpan + 1;
            sourceCoveringCells.push(entry.cell);
          }
        });
        boundary.rightCell.colSpan = boundary.rightEntry.colSpan + 1;
      }

      resizeSession.cellOnlyPlan = {
        direction,
        leftCell: boundary.leftCell,
        rightCell: boundary.rightCell,
        sourceColumnIndex,
        movingColumn: splitColumn,
        remainingColumn: sourceColumn,
        sourceWidth,
        minRemainingWidth,
        maxDelta: sourceWidth - minRemainingWidth,
        canTransferSourceColumn,
        sourceCoveringCells,
      };

      return resizeSession.cellOnlyPlan;
    }

    function rollbackTemplateEditorCellOnlyColumnResizePlan(resizeSession, plan) {
      if (!plan?.movingColumn || !plan?.remainingColumn) {
        return false;
      }

      setTemplateEditorResizeColumnWidth(plan.remainingColumn, plan.sourceWidth);

      if (plan.direction > 0) {
        plan.leftCell.colSpan = Math.max(1, (Number(plan.leftCell?.colSpan) || 1) - 1);
      } else {
        plan.rightCell.colSpan = Math.max(1, (Number(plan.rightCell?.colSpan) || 1) - 1);
      }

      Array.from(new Set(plan.sourceCoveringCells || [])).forEach((cell) => {
        if (cell) {
          cell.colSpan = Math.max(1, (Number(cell.colSpan) || 1) - 1);
        }
      });
      plan.movingColumn.remove();
      resizeSession.cellOnlyPlan = null;
      syncTemplateEditorResizeTableWidth(resizeSession.table);
      return true;
    }

    function getTemplateEditorCellOnlyResizeRawDelta(direction, boundaryDelta) {
      const rawDelta = direction > 0 ? boundaryDelta : -boundaryDelta;

      return Math.max(0, Math.round(rawDelta));
    }

    function getTemplateEditorCellOnlyColumnMeasuredWidth(resizeSession) {
      const focusScale = Math.max(Number(resizeSession?.focusScale) || 1, 0.01);

      return Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, Math.round(resizeSession.cell.getBoundingClientRect().width / focusScale));
    }

    function mergeTemplateEditorTransferredColumnIntoNext(table, columnElement, columnIndex) {
      const nextColumn = columnElement?.nextElementSibling || null;

      if (!table || !columnElement || nextColumn?.tagName !== "COL") {
        return false;
      }

      const { entries } = buildTemplateTableCellMap(table);
      const affectedEntries = [];

      entries.forEach((entry) => {
        if (entry.colIndex <= columnIndex && getTemplateEditorEntryEndColumn(entry) >= columnIndex) {
          affectedEntries.push(entry);
        }
      });

      if (!affectedEntries.length || affectedEntries.some((entry) => entry.colSpan <= 1)) {
        return false;
      }

      const combinedWidth =
        getTemplateEditorResizeColumnWidth(columnElement) + getTemplateEditorResizeColumnWidth(nextColumn);

      setTemplateEditorResizeColumnWidth(nextColumn, combinedWidth);
      affectedEntries.forEach((entry) => {
        entry.cell.colSpan = Math.max(1, entry.colSpan - 1);
      });
      columnElement.remove();
      return true;
    }

    function transferTemplateEditorCellOnlySourceColumn(resizeSession, plan) {
      if (!plan?.canTransferSourceColumn) {
        return false;
      }

      const leftSpan = Math.max(1, Number(plan.leftCell?.colSpan) || 1);
      const rightSpan = Math.max(1, Number(plan.rightCell?.colSpan) || 1);

      if (
        (plan.direction > 0 && rightSpan <= 1) ||
        (plan.direction < 0 && leftSpan <= 1) ||
        !plan.leftCell ||
        !plan.rightCell ||
        !Number.isInteger(plan.sourceColumnIndex) ||
        plan.sourceColumnIndex <= 0
      ) {
        return false;
      }

      setTemplateEditorResizeColumnWidth(plan.movingColumn, plan.sourceWidth);
      if (plan.direction > 0) {
        plan.rightCell.colSpan = rightSpan - 1;
      } else {
        plan.leftCell.colSpan = leftSpan - 1;
      }
      Array.from(new Set(plan.sourceCoveringCells || [])).forEach((cell) => {
        if (cell) {
          cell.colSpan = Math.max(1, (Number(cell.colSpan) || 1) - 1);
        }
      });
      plan.remainingColumn?.remove();
      if (plan.direction < 0) {
        mergeTemplateEditorTransferredColumnIntoNext(resizeSession.table, plan.movingColumn, plan.sourceColumnIndex);
      }
      resizeSession.lineIndex = plan.direction > 0 ? plan.sourceColumnIndex : plan.sourceColumnIndex - 1;
      resizeSession.cellOnlyConsumedDelta = (resizeSession.cellOnlyConsumedDelta || 0) + plan.sourceWidth;
      resizeSession.cellOnlyPlan = null;
      syncTemplateEditorResizeTableWidth(resizeSession.table);
      return true;
    }

    function mergeTemplateEditorRedundantColumnBoundaries(table) {
      if (!table) {
        return false;
      }

      let didMerge = false;
      let guardCount = 0;

      while (guardCount < 100) {
        guardCount += 1;

        const columns = getTemplateEditorResizeColumns(table);
        const { matrix, entries } = buildTemplateTableCellMap(table);
        const columnCount = Math.min(
          columns.length,
          matrix.reduce((maxColumnCount, row) => Math.max(maxColumnCount, row?.length || 0), 0),
        );
        let redundantBoundaryIndex = -1;

        for (let columnIndex = 0; columnIndex < columnCount - 1; columnIndex += 1) {
          const hasVisibleBoundary = matrix.some((row) => row?.[columnIndex] && row?.[columnIndex + 1] && row[columnIndex] !== row[columnIndex + 1]);

          if (!hasVisibleBoundary && matrix.some((row) => row?.[columnIndex] && row?.[columnIndex + 1])) {
            redundantBoundaryIndex = columnIndex;
            break;
          }
        }

        if (redundantBoundaryIndex < 0) {
          break;
        }

        const leftColumn = columns[redundantBoundaryIndex];
        const rightColumn = columns[redundantBoundaryIndex + 1];

        if (!leftColumn || !rightColumn) {
          break;
        }

        const combinedWidth = getTemplateEditorResizeColumnWidth(leftColumn) + getTemplateEditorResizeColumnWidth(rightColumn);
        const adjustedCells = new Set();

        entries.forEach((entry) => {
          if (
            entry.colIndex <= redundantBoundaryIndex &&
            getTemplateEditorEntryEndColumn(entry) >= redundantBoundaryIndex + 1
          ) {
            adjustedCells.add(entry.cell);
          }
        });

        if ([...adjustedCells].some((cell) => (Number(cell?.colSpan) || 1) <= 1)) {
          break;
        }

        setTemplateEditorResizeColumnWidth(rightColumn, combinedWidth);
        adjustedCells.forEach((cell) => {
          cell.colSpan = Math.max(1, (Number(cell.colSpan) || 1) - 1);
        });
        leftColumn.remove();
        didMerge = true;
      }

      if (didMerge) {
        syncTemplateEditorResizeTableWidth(table);
      }

      return didMerge;
    }

    return Object.freeze({
      getTemplateEditorCellOnlyColumnMeasuredWidth,
      getTemplateEditorCellOnlyResizeRawDelta,
      getTemplateEditorColumnBoundaryCells,
      getTemplateEditorEntryEndColumn,
      mergeTemplateEditorRedundantColumnBoundaries,
      mergeTemplateEditorTransferredColumnIntoNext,
      prepareTemplateEditorCellOnlyColumnResizePlan,
      rollbackTemplateEditorCellOnlyColumnResizePlan,
      transferTemplateEditorCellOnlySourceColumn,
    });
  }

  return Object.freeze({
    createTemplateEditorTableCellOnlyColumnTransferController,
  });
});

})();
