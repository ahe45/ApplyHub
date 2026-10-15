(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalScope);
    return;
  }

  globalScope.AdmitCardEditorTableUtils = factory(globalScope);
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  const editorContentModule = globalScope.AdmitCardEditorContentShared;

  if (!editorContentModule) {
    throw new Error("client/features/editor/content-shared.js must be loaded before client/features/editor/table-utils.js.");
  }

  const {
    TEMPLATE_EDITOR_DEFAULT_TABLE_BORDER,
    TEMPLATE_EDITOR_DEFAULT_TABLE_CELL_PADDING,
    TEMPLATE_EDITOR_DEFAULT_TABLE_HEADER_BACKGROUND,
    normalizeTemplateEditorColorValue,
  } = editorContentModule;

  const TEMPLATE_EDITOR_TABLE_MIN_SIZE = 24;

  function parseTemplateEditorPixelStyle(value, fallback = 0) {
    const parsedValue = Number.parseFloat(String(value || "").replace("px", ""));
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  function getTemplateTableCellBorderPresentation(sourceCell = null) {
    const sourceStyle = sourceCell?.style || null;
    const computedStyle = sourceCell ? window.getComputedStyle(sourceCell) : null;
    const borderValue = String(sourceStyle?.border || computedStyle?.border || TEMPLATE_EDITOR_DEFAULT_TABLE_BORDER).trim();

    return Object.freeze({
      border: borderValue || TEMPLATE_EDITOR_DEFAULT_TABLE_BORDER,
      borderTop: String(sourceStyle?.borderTop || computedStyle?.borderTop || "").trim(),
      borderRight: String(sourceStyle?.borderRight || computedStyle?.borderRight || "").trim(),
      borderBottom: String(sourceStyle?.borderBottom || computedStyle?.borderBottom || "").trim(),
      borderLeft: String(sourceStyle?.borderLeft || computedStyle?.borderLeft || "").trim(),
    });
  }

  function applyTemplateTableCellPresentation(cell, sourceCell = null) {
    const computedStyle = sourceCell ? window.getComputedStyle(sourceCell) : null;
    const borderPresentation = getTemplateTableCellBorderPresentation(sourceCell);
    const nextPadding = sourceCell?.style.padding || computedStyle?.padding || TEMPLATE_EDITOR_DEFAULT_TABLE_CELL_PADDING;
    const nextTextAlign = sourceCell?.style.textAlign || computedStyle?.textAlign || "left";
    const nextVerticalAlign = sourceCell?.style.verticalAlign || computedStyle?.verticalAlign || "top";
    const nextBackgroundColor =
      sourceCell?.style.backgroundColor ||
      (cell.tagName === "TH" ? TEMPLATE_EDITOR_DEFAULT_TABLE_HEADER_BACKGROUND : "");

    cell.style.border = borderPresentation.border;
    cell.style.borderTop = borderPresentation.borderTop || borderPresentation.border;
    cell.style.borderRight = borderPresentation.borderRight || borderPresentation.border;
    cell.style.borderBottom = borderPresentation.borderBottom || borderPresentation.border;
    cell.style.borderLeft = borderPresentation.borderLeft || borderPresentation.border;
    cell.style.padding = nextPadding;
    cell.style.textAlign = nextTextAlign;
    cell.style.verticalAlign = nextVerticalAlign;

    if (nextBackgroundColor) {
      cell.style.backgroundColor = String(nextBackgroundColor).trim().toLowerCase() === 'transparent' ? 'transparent' : normalizeTemplateEditorColorValue(
        nextBackgroundColor,
        cell.tagName === "TH" ? TEMPLATE_EDITOR_DEFAULT_TABLE_HEADER_BACKGROUND : "#ffffff",
      );
    } else {
      cell.style.removeProperty("background-color");
    }
  }

  function buildTemplateTableCellMap(table) {
    const matrix = [];
    const entries = new Map();

    Array.from(table.rows).forEach((row, rowIndex) => {
      let columnIndex = 0;
      matrix[rowIndex] = matrix[rowIndex] || [];

      Array.from(row.cells).forEach((cell) => {
        while (matrix[rowIndex][columnIndex]) {
          columnIndex += 1;
        }

        const rowSpan = Math.max(Number(cell.rowSpan) || 1, 1);
        const colSpan = Math.max(Number(cell.colSpan) || 1, 1);
        const entry = {
          cell,
          row,
          rowIndex,
          colIndex: columnIndex,
          rowSpan,
          colSpan,
        };

        entries.set(cell, entry);

        for (let nextRowIndex = rowIndex; nextRowIndex < rowIndex + rowSpan; nextRowIndex += 1) {
          matrix[nextRowIndex] = matrix[nextRowIndex] || [];

          for (let nextColIndex = columnIndex; nextColIndex < columnIndex + colSpan; nextColIndex += 1) {
            matrix[nextRowIndex][nextColIndex] = cell;
          }
        }

        columnIndex += colSpan;
      });
    });

    return {
      matrix,
      entries,
    };
  }

  function getTemplateEditorTableColumnCount(matrix) {
    return matrix.reduce((maxColumnCount, row) => Math.max(maxColumnCount, row?.length || 0), 0);
  }

  function getTemplateEditorMeasuredColumnWidth(cellMap, columnIndex) {
    const { matrix, entries } = cellMap;

    for (const row of matrix) {
      const cell = row?.[columnIndex];
      const entry = cell ? entries.get(cell) : null;

      if (!entry) {
        continue;
      }

      const measuredWidth = Math.round(cell.getBoundingClientRect().width / entry.colSpan);

      if (Number.isFinite(measuredWidth) && measuredWidth > 0) {
        return Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, measuredWidth);
      }
    }

    return TEMPLATE_EDITOR_TABLE_MIN_SIZE;
  }

  function ensureTemplateEditorTableColGroup(table) {
    const cellMap = buildTemplateTableCellMap(table);
    const columnCount = getTemplateEditorTableColumnCount(cellMap.matrix);
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

    const columns = Array.from(colGroup.children);

    columns.forEach((columnElement, columnIndex) => {
      const currentWidth = parseTemplateEditorPixelStyle(columnElement.style.width, 0);

      if (!currentWidth || currentWidth < TEMPLATE_EDITOR_TABLE_MIN_SIZE) {
        columnElement.style.width = `${getTemplateEditorMeasuredColumnWidth(cellMap, columnIndex)}px`;
      }
    });

    return {
      columns,
      cellMap,
    };
  }

  function syncTemplateEditorTableWidth(table, columns = []) {
    const targetColumns = columns.length > 0 ? columns : ensureTemplateEditorTableColGroup(table).columns;
    const totalWidth = targetColumns.reduce((widthSum, columnElement) => {
      const columnWidth = parseTemplateEditorPixelStyle(columnElement.style.width, TEMPLATE_EDITOR_TABLE_MIN_SIZE);
      return widthSum + Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, columnWidth);
    }, 0);

    table.style.width = `${totalWidth}px`;
    table.style.maxWidth = "none";
  }

  function normalizeTemplateEditorTableAppearance(table) {
    if (!(table instanceof HTMLTableElement)) {
      return;
    }

    if (!String(table.style.width || "").trim()) {
      table.style.width = "100%";
    }

    table.style.borderCollapse = "collapse";
    table.style.tableLayout = "fixed";

    Array.from(table.rows).forEach((row) => {
      Array.from(row.cells).forEach((cell) => {
        applyTemplateTableCellPresentation(cell, cell);
      });
    });

    ensureTemplateEditorTableColGroup(table);
  }

  function normalizeTemplateEditorTables(rootElement) {
    if (!rootElement?.querySelectorAll) {
      return;
    }

    rootElement.querySelectorAll("table").forEach((table) => {
      normalizeTemplateEditorTableAppearance(table);
    });
  }

  return Object.freeze({
    TEMPLATE_EDITOR_TABLE_MIN_SIZE,
    applyTemplateTableCellPresentation,
    buildTemplateTableCellMap,
    ensureTemplateEditorTableColGroup,
    getTemplateEditorMeasuredColumnWidth,
    getTemplateEditorTableColumnCount,
    normalizeTemplateEditorTableAppearance,
    normalizeTemplateEditorTables,
    parseTemplateEditorPixelStyle,
    syncTemplateEditorTableWidth,
  });
});
