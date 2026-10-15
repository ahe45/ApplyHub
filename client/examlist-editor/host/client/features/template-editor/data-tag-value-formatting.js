import {
  dateFormatType,
  getDataTagFormatType,
  timeFormatType,
} from "./data-tag-format-types.js";

const canonicalExamDateTagKeys = new Set(["candidate.examDate"]);
const canonicalExamTimeTagKeys = new Set([
  "candidate.examStartTime",
  "candidate.examEndTime",
]);
const canonicalDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const canonicalTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const weekdaysShort = Object.freeze(["일", "월", "화", "수", "목", "금", "토"]);
const weekdaysLong = Object.freeze(["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]);

function getDefinitionKey(definitionOrKey = {}) {
  return typeof definitionOrKey === "string"
    ? String(definitionOrKey || "").trim()
    : String(definitionOrKey?.key || definitionOrKey?.dataKey || definitionOrKey?.token || "").trim();
}

function isValidCanonicalDate(value = "") {
  const normalizedValue = String(value || "").trim();
  const matchedDate = normalizedValue.match(canonicalDatePattern);

  if (!matchedDate) {
    return false;
  }

  const year = Number(matchedDate[1]);
  const month = Number(matchedDate[2]);
  const day = Number(matchedDate[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    year >= 1000 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseCanonicalDate(value = "") {
  const normalizedValue = String(value || "").trim();
  const matchedDate = normalizedValue.match(canonicalDatePattern);

  if (!matchedDate || !isValidCanonicalDate(normalizedValue)) {
    return null;
  }

  return new Date(
    Number(matchedDate[1]),
    Number(matchedDate[2]) - 1,
    Number(matchedDate[3]),
  );
}

function parseCanonicalTime(value = "") {
  const normalizedValue = String(value || "").trim();

  if (!canonicalTimePattern.test(normalizedValue)) {
    return null;
  }

  const [hours, minutes] = normalizedValue.split(":").map((part) => Number(part));

  return { hours, minutes };
}

function replaceDateFormatTokens(value = "", formatValue = "") {
  const dateValue = parseCanonicalDate(value);

  if (!dateValue) {
    return String(value ?? "");
  }

  const month = dateValue.getMonth() + 1;
  const day = dateValue.getDate();
  const replacements = {
    D: String(day),
    DD: String(day).padStart(2, "0"),
    M: String(month),
    MM: String(month).padStart(2, "0"),
    YY: String(dateValue.getFullYear()).slice(-2),
    YYYY: String(dateValue.getFullYear()),
    ddd: weekdaysShort[dateValue.getDay()],
    dddd: weekdaysLong[dateValue.getDay()],
  };

  return String(formatValue || "YYYY-MM-DD").replace(/dddd|ddd|YYYY|YY|MM|M|DD|D/g, (token) =>
    replacements[token] || token
  );
}

function replaceTimeFormatTokens(value = "", formatValue = "") {
  const timeValue = parseCanonicalTime(value);

  if (!timeValue) {
    return String(value ?? "");
  }

  const twelveHour = timeValue.hours % 12 || 12;
  const replacements = {
    A: timeValue.hours < 12 ? "오전" : "오후",
    H: String(timeValue.hours),
    HH: String(timeValue.hours).padStart(2, "0"),
    h: String(twelveHour),
    hh: String(twelveHour).padStart(2, "0"),
    mm: String(timeValue.minutes).padStart(2, "0"),
  };

  return String(formatValue || "HH:mm").replace(/HH|H|hh|h|mm|A/g, (token) =>
    replacements[token] || token
  );
}

export function getDataTagSampleValueConstraint(definitionOrKey = {}) {
  const key = getDefinitionKey(definitionOrKey);

  if (canonicalExamDateTagKeys.has(key)) {
    return Object.freeze({
      errorMessage: "yyyy-mm-dd 형식으로 입력하세요.",
      formatLabel: "yyyy-mm-dd",
      inputMode: "numeric",
      maxLength: 10,
      placeholder: "2026-11-28",
      type: dateFormatType,
    });
  }

  if (canonicalExamTimeTagKeys.has(key)) {
    return Object.freeze({
      errorMessage: "hh:mm 형식으로 입력하세요.",
      formatLabel: "hh:mm",
      inputMode: "numeric",
      maxLength: 5,
      placeholder: key === "candidate.examEndTime" ? "11:00" : "09:00",
      type: timeFormatType,
    });
  }

  return null;
}

export function getDataTagSampleValueError(definitionOrKey = {}, value = "") {
  const constraint = getDataTagSampleValueConstraint(definitionOrKey);
  const normalizedValue = String(value ?? "").trim();

  if (!constraint || !normalizedValue) {
    return "";
  }

  if (constraint.type === dateFormatType) {
    return isValidCanonicalDate(normalizedValue) ? "" : constraint.errorMessage;
  }

  if (constraint.type === timeFormatType) {
    return canonicalTimePattern.test(normalizedValue) ? "" : constraint.errorMessage;
  }

  return "";
}

export function normalizeDataTagSampleValue(definitionOrKey = {}, value = "") {
  const constraint = getDataTagSampleValueConstraint(definitionOrKey);

  return constraint ? String(value ?? "").trim() : String(value ?? "");
}

export function buildDataTagSampleValueErrors(tagDefinitions = [], sampleValues = {}) {
  const sourceValues = sampleValues && typeof sampleValues === "object" && !Array.isArray(sampleValues)
    ? sampleValues
    : {};

  return (Array.isArray(tagDefinitions) ? tagDefinitions : []).reduce((errors, definition) => {
    const key = getDefinitionKey(definition);
    const errorMessage = getDataTagSampleValueError(definition, sourceValues[key]);

    if (key && errorMessage) {
      errors[key] = errorMessage;
    }

    return errors;
  }, {});
}

export function hasDataTagSampleValueErrors(errors = {}) {
  return Object.values(errors || {}).some((errorMessage) => Boolean(String(errorMessage || "").trim()));
}

export function formatDataTagValue(formatType = "", value = "", formatValue = "") {
  const normalizedFormatType = String(formatType || "").trim();
  const normalizedFormatValue = String(formatValue || "").trim();

  if (!normalizedFormatValue) {
    return String(value ?? "");
  }

  if (normalizedFormatType === dateFormatType) {
    return replaceDateFormatTokens(value, normalizedFormatValue);
  }

  if (normalizedFormatType === timeFormatType) {
    return replaceTimeFormatTokens(value, normalizedFormatValue);
  }

  return String(value ?? "");
}

export function formatDataTagSampleValue(definitionOrKey = {}, value = "", formatValue = "", explicitFormatType = "") {
  const formatType = String(explicitFormatType || "").trim() || getDataTagFormatType(definitionOrKey);

  return formatDataTagValue(formatType, value, formatValue);
}
