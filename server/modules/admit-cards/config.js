const examineeFields = require("../../../shared/domain/examinee-fields");
const { normalizeExamineeRecord } = require("./record");

const printHistoryExportColumns = Object.freeze([
  ...examineeFields.createWorkbookTextColumns(),
  Object.freeze({ header: "출력시각", key: "printedAt", width: 22, text: true }),
]);

const printHistorySummaryExportColumns = Object.freeze([
  ...examineeFields.createWorkbookTextColumns(),
  Object.freeze({ header: "출력횟수", key: "printCount", width: 12, text: false }),
]);

function normalizePrintHistoryExportRow(record = {}) {
  const normalizedRecord = normalizeExamineeRecord(record);

  return {
    track: normalizedRecord.track,
    admission: normalizedRecord.admission,
    admissionCode: normalizedRecord.admissionCode,
    series: normalizedRecord.series,
    seriesCode: normalizedRecord.seriesCode,
    unit: normalizedRecord.unit,
    unitCode: normalizedRecord.unitCode,
    major: normalizedRecord.major,
    majorCode: normalizedRecord.majorCode,
    examineeNo: normalizedRecord.examineeNo,
    name: String(record.name ?? "").trim(),
    birth: String(record.birth ?? "").trim(),
    printedAt: String(record.printedAt ?? "").trim(),
  };
}

module.exports = {

  normalizePrintHistoryExportRow,

  printHistoryExportColumns,
  printHistorySummaryExportColumns,
};
