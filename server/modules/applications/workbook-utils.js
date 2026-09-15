function extractExcelCellValue(value) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  if (typeof value === "object") {
    if (typeof value.text === "string") {
      return value.text;
    }

    if (Array.isArray(value.richText)) {
      return value.richText.map((segment) => segment?.text || "").join("");
    }

    if (value.result != null) {
      return extractExcelCellValue(value.result);
    }

    if (value.hyperlink) {
      return String(value.text || value.hyperlink || "");
    }
  }

  return "";
}

function getExcelCellText(cell) {
  return extractExcelCellValue(cell?.value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function applyWorkbookHeaderStyle(worksheet) {
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF4F7FB" },
  };
}

function buildWorkbookTextColumns(columns = []) {
  return (Array.isArray(columns) ? columns : []).map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
    style: { numFmt: "@" },
  }));
}

function setWorkbookTextColumns(worksheet, columns = []) {
  worksheet.columns = buildWorkbookTextColumns(columns);
}

function applyWorkbookTextFormat(worksheet, options = {}) {
  if (!worksheet) {
    return;
  }

  const requestedColumnCount = Number(options.columnCount || 0);
  const columnCount =
    Number.isFinite(requestedColumnCount) && requestedColumnCount > 0
      ? Math.floor(requestedColumnCount)
      : Number(worksheet?.columnCount || 0);

  for (let rowIndex = 1; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
      worksheet.getRow(rowIndex).getCell(columnIndex).numFmt = "@";
    }
  }
}

module.exports = {
  applyWorkbookHeaderStyle,
  applyWorkbookTextFormat,
  buildWorkbookTextColumns,
  extractExcelCellValue,
  getExcelCellText,
  setWorkbookTextColumns,
};
