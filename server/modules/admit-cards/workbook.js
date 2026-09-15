const ExcelJS = require("exceljs");

const {

  normalizePrintHistoryExportRow,

  printHistoryExportColumns,
  printHistorySummaryExportColumns,
} = require("./config");

function createExamineeWorkbookService({ createHttpError }) {

  function applyWorkbookHeaderStyle(worksheet) {
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF4F7FB" },
    };
  }

  function buildWorkbookSheet(workbook, sheetName, columns, rows) {
    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    worksheet.columns = columns.map((column) => ({
      header: column.header,
      key: column.key,
      width: column.width,
      style: column.text ? { numFmt: "@" } : undefined,
    }));

    applyWorkbookHeaderStyle(worksheet);
    rows.forEach((row) => worksheet.addRow(row));

    for (let rowIndex = 1; rowIndex <= worksheet.rowCount; rowIndex += 1) {
      columns.forEach((column, columnIndex) => {
        if (!column.text) {
          return;
        }

        worksheet.getRow(rowIndex).getCell(columnIndex + 1).numFmt = "@";
      });
    }

    return worksheet;
  }

  function buildPrintHistorySummaryRows(rows, summaryExaminees = []) {
    const summaryMap = new Map();

    summaryExaminees.forEach((row) => {
      const examineeNo = String(row.examineeNo || "").trim();
      const summaryKey = examineeNo || `__empty_summary__${summaryMap.size}`;

      if (!summaryMap.has(summaryKey)) {
        summaryMap.set(summaryKey, {
          ...row,
          printCount: 0,
        });
      }
    });

    rows.forEach((row) => {
      const examineeNo = String(row.examineeNo || "").trim();
      const summaryKey = examineeNo || `__empty_history__${summaryMap.size}`;

      if (!summaryMap.has(summaryKey)) {
        summaryMap.set(summaryKey, {
          ...row,
          printCount: 0,
        });
      }

      summaryMap.get(summaryKey).printCount += 1;
    });

    return Array.from(summaryMap.values());
  }

  async function buildPrintHistoryExportBuffer(rows, summaryExaminees = []) {
    if ((!Array.isArray(rows) || rows.length === 0) && (!Array.isArray(summaryExaminees) || summaryExaminees.length === 0)) {
      throw createHttpError(400, "다운로드할 출력 이력 데이터가 없습니다.");
    }

    const normalizedRows = Array.isArray(rows) ? rows.map((row) => normalizePrintHistoryExportRow(row)) : [];
    const normalizedSummaryExaminees = Array.isArray(summaryExaminees)
      ? summaryExaminees.map((row) => normalizePrintHistoryExportRow(row))
      : [];
    const workbook = new ExcelJS.Workbook();

    buildWorkbookSheet(workbook, "출력이력", printHistoryExportColumns, normalizedRows);
    buildWorkbookSheet(
      workbook,
      "수험번호별 출력횟수",
      printHistorySummaryExportColumns,
      buildPrintHistorySummaryRows(normalizedRows, normalizedSummaryExaminees),
    );

    return workbook.xlsx.writeBuffer();
  }

  return Object.freeze({

    buildPrintHistoryExportBuffer,

  });
}

module.exports = {
  createExamineeWorkbookService,
};
