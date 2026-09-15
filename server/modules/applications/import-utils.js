const {

  APPLICANT_IMPORT_EXISTING_DATA_POLICIES,
  APPLICANT_RECRUITMENT_IMPORT_COMPARE_FIELDS,
} = require("./config");

function normalizeApplicantImportExistingDataPolicy(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (Object.values(APPLICANT_IMPORT_EXISTING_DATA_POLICIES).includes(normalizedValue)) {
    return normalizedValue;
  }

  return APPLICANT_IMPORT_EXISTING_DATA_POLICIES.INSERT_UPDATE;
}

function shouldProcessApplicantImportOperation(operation = "", existingDataPolicy = "") {
  const normalizedPolicy = normalizeApplicantImportExistingDataPolicy(existingDataPolicy);
  const normalizedOperation = String(operation || "").trim();

  if (normalizedPolicy === APPLICANT_IMPORT_EXISTING_DATA_POLICIES.ALL) {
    return true;
  }

  if (normalizedPolicy === APPLICANT_IMPORT_EXISTING_DATA_POLICIES.INSERT_ONLY) {
    return normalizedOperation === "insert";
  }

  return normalizedOperation === "insert" || normalizedOperation === "update";
}

function buildApplicantRecruitmentUnitImportKey(row = {}) {
  return [
    String(row?.trackName || "").trim(),
    String(row?.admissionCode || "").trim(),
    String(row?.seriesCode || "").trim(),
    String(row?.unitCode || "").trim(),
    String(row?.majorCode || "").trim(),
  ].join("\u241f");
}

function areApplicantRecruitmentUnitRowsEqual(leftRow = {}, rightRow = {}) {
  return APPLICANT_RECRUITMENT_IMPORT_COMPARE_FIELDS.every((fieldKey) => {
    return String(leftRow?.[fieldKey] || "").trim() === String(rightRow?.[fieldKey] || "").trim();
  });
}

function getApplicantRecruitmentImportRowLabel(row = {}, fallbackIndex = 0) {
  const normalizedRowNumber = Math.round(Number(row.rowNumber || row._rowNumber || 0));

  if (Number.isInteger(normalizedRowNumber) && normalizedRowNumber > 0) {
    return `업로드 ${normalizedRowNumber}행`;
  }

  const normalizedFallbackIndex = Math.round(Number(fallbackIndex));
  return `업로드 ${Number.isInteger(normalizedFallbackIndex) && normalizedFallbackIndex >= 0 ? normalizedFallbackIndex + 1 : "?"}행`;
}

function createApplicantImportHelpers({ normalizeApplicantRecruitmentUnitPayload = (row) => row } = {}) {
  function classifyApplicantRecruitmentUnitImportRows(normalizedRows = [], currentUnits = []) {
    const workingUnitMap = new Map(
      (Array.isArray(currentUnits) ? currentUnits : []).map((row) => {
        const normalizedRow = normalizeApplicantRecruitmentUnitPayload(row);
        return [buildApplicantRecruitmentUnitImportKey(normalizedRow), normalizedRow];
      }),
    );

    return (Array.isArray(normalizedRows) ? normalizedRows : []).map((row, index) => {
      const unitKey = buildApplicantRecruitmentUnitImportKey(row);
      const existingRow = workingUnitMap.get(unitKey) || null;
      const operation = existingRow ? (areApplicantRecruitmentUnitRowsEqual(row, existingRow) ? "unchanged" : "update") : "insert";

      workingUnitMap.set(unitKey, row);

      return {
        row,
        rowNumber: Number(row?.rowNumber || index + 2),
        operation,
      };
    });
  }

  return Object.freeze({
    classifyApplicantRecruitmentUnitImportRows,
  });
}

module.exports = {

  buildApplicantRecruitmentUnitImportKey,

  createApplicantImportHelpers,
  getApplicantRecruitmentImportRowLabel,
  normalizeApplicantImportExistingDataPolicy,
  shouldProcessApplicantImportOperation,

};
