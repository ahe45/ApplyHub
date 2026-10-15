export const dateFormatType = "date";
export const timeFormatType = "time";

const dateTagKeys = new Set([
  "candidate.examDate",
  "candidate.birthDate",
]);

const timeTagKeys = new Set([
  "candidate.examStartTime",
  "candidate.examEndTime",
]);

export function getDataTagFormatType(definitionOrKey = {}) {
  const key = typeof definitionOrKey === "string"
    ? String(definitionOrKey || "").trim()
    : String(definitionOrKey?.key || definitionOrKey?.dataKey || definitionOrKey?.token || "").trim();
  const type = typeof definitionOrKey === "string" ? "" : String(definitionOrKey?.type || "").trim().toLowerCase();

  if (dateTagKeys.has(key) || type === dateFormatType) {
    return dateFormatType;
  }

  if (timeTagKeys.has(key) || type === timeFormatType) {
    return timeFormatType;
  }

  return "";
}

export function isDataTagFormatSupported(definitionOrKey = {}) {
  return Boolean(getDataTagFormatType(definitionOrKey));
}
