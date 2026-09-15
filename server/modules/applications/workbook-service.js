const ExcelJS = require("exceljs");
const {

  APPLICANT_UNIT_TEMPLATE_COLUMNS,
} = require("./config");

const {
  applyWorkbookHeaderStyle,
  applyWorkbookTextFormat,
  getExcelCellText,
  setWorkbookTextColumns,
} = require("./workbook-utils");

function createWorkbookHttpErrorFactory(createHttpError) {
  if (typeof createHttpError === "function") {
    return createHttpError;
  }

  return (status, message, code) => {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
  };
}

function createApplicantWorkbookService(options = {}) {
  const createHttpError = createWorkbookHttpErrorFactory(options.createHttpError);

  async function buildApplicantRecruitmentUnitTemplateWorkbookBuffer() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("전형관리", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    setWorkbookTextColumns(worksheet, APPLICANT_UNIT_TEMPLATE_COLUMNS);
    applyWorkbookHeaderStyle(worksheet);
    worksheet.addRow(
      APPLICANT_UNIT_TEMPLATE_COLUMNS.reduce((row, column) => {
        row[column.key] = column.sample;
        return row;
      }, {}),
    );
    applyWorkbookTextFormat(worksheet, { columnCount: APPLICANT_UNIT_TEMPLATE_COLUMNS.length });

    return workbook.xlsx.writeBuffer();
  }

  async function buildApplicantRecruitmentUnitExportWorkbookBuffer(rows = []) {
    const exportRows = (Array.isArray(rows) ? rows : []).filter((row) =>
      APPLICANT_UNIT_TEMPLATE_COLUMNS.some((column) => String(row?.[column.key] || "").trim() !== ""),
    );

    if (exportRows.length === 0) {
      throw createHttpError(400, "다운로드할 전형 관리 데이터가 없습니다.");
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("전형관리", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    setWorkbookTextColumns(worksheet, APPLICANT_UNIT_TEMPLATE_COLUMNS);
    applyWorkbookHeaderStyle(worksheet);
    worksheet.addRows(
      exportRows.map((row) =>
        APPLICANT_UNIT_TEMPLATE_COLUMNS.reduce((record, column) => {
          record[column.key] = String(row?.[column.key] || "").trim();
          return record;
        }, {}),
      ),
    );
    applyWorkbookTextFormat(worksheet, { columnCount: APPLICANT_UNIT_TEMPLATE_COLUMNS.length });

    return workbook.xlsx.writeBuffer();
  }

  async function buildApplicantSubmissionExportWorkbookBuffer(rows = []) {
    const exportRows = (Array.isArray(rows) ? rows : []).filter((row) => {
      const answerValues = Array.isArray(row?.answerValues) ? row.answerValues : [];
      return row?.id || row?.name || row?.email || answerValues.length > 0;
    });

    if (exportRows.length === 0) {
      throw createHttpError(400, "다운로드할 접수 이력 데이터가 없습니다.");
    }

    const maxAnswerCount = exportRows.reduce(
      (maximum, row) => Math.max(maximum, Array.isArray(row.answerValues) ? row.answerValues.length : 0),
      0,
    );
    const fixedColumns = [
      { header: "접수번호", key: "id", width: 14 },
      { header: "이름", key: "name", width: 20 },
      { header: "이메일", key: "email", width: 28 },
      { header: "상태", key: "statusLabel", width: 12 },
      { header: "수험번호", key: "promotedExamineeNo", width: 18 },
      { header: "접수일시", key: "createdAt", width: 22 },
      { header: "최종수정", key: "updatedAt", width: 22 },
    ];
    const answerColumns = Array.from({ length: maxAnswerCount }, (_, index) => ({
      header: `질문${index + 1}`,
      key: `answer${index + 1}`,
      width: 24,
    }));
    const worksheetColumns = [...fixedColumns, ...answerColumns];
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("접수이력", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    setWorkbookTextColumns(worksheet, worksheetColumns);
    applyWorkbookHeaderStyle(worksheet);
    worksheet.addRows(
      exportRows.map((row) => {
        const record = {
          id: row.id,
          name: row.name,
          email: row.email,
          statusLabel: row.statusLabel,
          promotedExamineeNo: row.promotedExamineeNo,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };

        const answerValues = Array.isArray(row.answerValues) ? row.answerValues : [];

        answerColumns.forEach((column, index) => {
          record[column.key] = String(answerValues[index] || "").trim();
        });

        return record;
      }),
    );
    applyWorkbookTextFormat(worksheet, { columnCount: worksheetColumns.length });

    return workbook.xlsx.writeBuffer();
  }

  async function parseApplicantRecruitmentUnitWorkbookRows(fileContentBase64) {
    if (!fileContentBase64) {
      throw createHttpError(400, "XLSX 파일 데이터가 없습니다.");
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(fileContentBase64, "base64"));

    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw createHttpError(400, "XLSX 파일에서 시트를 찾을 수 없습니다.");
    }

    const headerRow = worksheet.getRow(1);
    const columnIndexes = APPLICANT_UNIT_TEMPLATE_COLUMNS.reduce((indexes, column) => {
      const matchedColumnIndex =
        headerRow.actualCellCount === 0
          ? -1
          : Array.from({ length: Math.max(worksheet.columnCount, APPLICANT_UNIT_TEMPLATE_COLUMNS.length) }, (_, offset) => offset + 1).find(
              (columnIndex) => getExcelCellText(headerRow.getCell(columnIndex)) === column.header,
            ) ?? -1;

      if (matchedColumnIndex === -1) {
        throw createHttpError(400, `XLSX 헤더에 '${column.header}' 컬럼이 없습니다.`);
      }

      indexes[column.key] = matchedColumnIndex;
      return indexes;
    }, {});

    const units = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const unit = {};
      let hasAnyValue = false;

      APPLICANT_UNIT_TEMPLATE_COLUMNS.forEach((column) => {
        const value = getExcelCellText(row.getCell(columnIndexes[column.key]));
        unit[column.key] = value;
        hasAnyValue = hasAnyValue || value !== "";
      });

      if (hasAnyValue) {
        unit.rowNumber = rowNumber;
        units.push(unit);
      }
    }

    if (units.length === 0) {
      throw createHttpError(400, "XLSX에는 헤더와 최소 1개 이상의 데이터 행이 필요합니다.");
    }

    return units;
  }

  return Object.freeze({

    buildApplicantRecruitmentUnitExportWorkbookBuffer,
    buildApplicantRecruitmentUnitTemplateWorkbookBuffer,
    buildApplicantSubmissionExportWorkbookBuffer,

    parseApplicantRecruitmentUnitWorkbookRows,
  });
}

module.exports = {
  createApplicantWorkbookService,
};
