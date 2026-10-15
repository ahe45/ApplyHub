import { flattenTemplateTags } from "./data-tags-definitions.js";
import {
  dateFormatType,
  getDataTagFormatType,
  timeFormatType,
} from "./data-tag-format-types.js";
import { formatDataTagValue } from "./data-tag-value-formatting.js";

const maxDataTagFormatLength = 60;

const dataTagFormatPresets = Object.freeze({
  [dateFormatType]: Object.freeze([
    Object.freeze({ label: "기본값", preview: "2026-03-28", value: "" }),
    Object.freeze({ label: "yyyy-mm-dd", preview: "2026-03-28", value: "YYYY-MM-DD" }),
    Object.freeze({ label: "yyyy.mm.dd", preview: "2026.03.28", value: "YYYY.MM.DD" }),
    Object.freeze({ label: "yyyy/mm/dd", preview: "2026/03/28", value: "YYYY/MM/DD" }),
    Object.freeze({ label: "yyyy.mm.dd (요일)", preview: "2026.03.28 (토)", value: "YYYY.MM.DD (ddd)" }),
    Object.freeze({ label: "yyyy.mm.dd 요일", preview: "2026.03.28 토요일", value: "YYYY.MM.DD dddd" }),
    Object.freeze({ label: "mm월 dd일", preview: "03월 28일", value: "MM월 DD일" }),
    Object.freeze({ label: "m월 d일", preview: "3월 28일", value: "M월 D일" }),
    Object.freeze({ label: "mm.dd", preview: "03.28", value: "MM.DD" }),
    Object.freeze({ label: "m/d", preview: "3/28", value: "M/D" }),
    Object.freeze({ label: "yy.mm.dd", preview: "26.03.28", value: "YY.MM.DD" }),
    Object.freeze({ label: "yy/mm/dd", preview: "26/03/28", value: "YY/MM/DD" }),
    Object.freeze({ label: "yyyy년 mm월 dd일", preview: "2026년 03월 28일", value: "YYYY년 MM월 DD일" }),
    Object.freeze({ label: "yyyy년 m월 d일", preview: "2026년 3월 28일", value: "YYYY년 M월 D일" }),
    Object.freeze({ label: "yy년 m월 d일", preview: "26년 3월 28일", value: "YY년 M월 D일" }),
    Object.freeze({ label: "yyyy년 mm월 dd일 (요일)", preview: "2026년 03월 28일 (토)", value: "YYYY년 MM월 DD일 (ddd)" }),
    Object.freeze({ label: "yyyy년 m월 d일 요일", preview: "2026년 3월 28일 토요일", value: "YYYY년 M월 D일 dddd" }),
    Object.freeze({ label: "m월 d일 (요일)", preview: "3월 28일 (토)", value: "M월 D일 (ddd)" }),
    Object.freeze({ label: "m월 d일 요일", preview: "3월 28일 토요일", value: "M월 D일 dddd" }),
    Object.freeze({ label: "요일, yyyy년 m월 d일", preview: "토요일, 2026년 3월 28일", value: "dddd, YYYY년 M월 D일" }),
  ]),
  [timeFormatType]: Object.freeze([
    Object.freeze({ label: "기본값", preview: "08:40", value: "" }),
    Object.freeze({ label: "hh:mm", preview: "08:40", value: "HH:mm" }),
    Object.freeze({ label: "h:mm", preview: "8:40", value: "H:mm" }),
    Object.freeze({ label: "hh시 mm분", preview: "08시 40분", value: "HH시 mm분" }),
    Object.freeze({ label: "h시 mm분", preview: "8시 40분", value: "H시 mm분" }),
    Object.freeze({ label: "hh시", preview: "08시", value: "HH시" }),
    Object.freeze({ label: "h시", preview: "8시", value: "H시" }),
    Object.freeze({ label: "오전/오후 h:mm", preview: "오전 8:40", value: "A h:mm" }),
    Object.freeze({ label: "오전/오후 hh:mm", preview: "오전 08:40", value: "A hh:mm" }),
    Object.freeze({ label: "오전/오후 h시 mm분", preview: "오전 8시 40분", value: "A h시 mm분" }),
    Object.freeze({ label: "오전/오후 hh시 mm분", preview: "오전 08시 40분", value: "A hh시 mm분" }),
    Object.freeze({ label: "hh:mm 오전/오후", preview: "08:40 오전", value: "hh:mm A" }),
    Object.freeze({ label: "hh.mm", preview: "08.40", value: "HH.mm" }),
  ]),
});

const dataTagFormatTokenGuides = Object.freeze({
  [dateFormatType]: Object.freeze([
    Object.freeze({ description: "4자리 연도", example: "2026", token: "YYYY" }),
    Object.freeze({ description: "2자리 연도", example: "26", token: "YY" }),
    Object.freeze({ description: "2자리 월", example: "03", token: "MM" }),
    Object.freeze({ description: "월", example: "3", token: "M" }),
    Object.freeze({ description: "2자리 일", example: "08", token: "DD" }),
    Object.freeze({ description: "일", example: "8", token: "D" }),
    Object.freeze({ description: "짧은 요일", example: "토", token: "ddd" }),
    Object.freeze({ description: "긴 요일", example: "토요일", token: "dddd" }),
  ]),
  [timeFormatType]: Object.freeze([
    Object.freeze({ description: "24시간 2자리 시", example: "08", token: "HH" }),
    Object.freeze({ description: "24시간 시", example: "8", token: "H" }),
    Object.freeze({ description: "12시간 2자리 시", example: "08", token: "hh" }),
    Object.freeze({ description: "12시간 시", example: "8", token: "h" }),
    Object.freeze({ description: "2자리 분", example: "40", token: "mm" }),
    Object.freeze({ description: "오전/오후", example: "오전", token: "A" }),
  ]),
});

const dataTagFormatTokens = Object.freeze({
  [dateFormatType]: Object.freeze(["dddd", "ddd", "YYYY", "YY", "MM", "M", "DD", "D"]),
  [timeFormatType]: Object.freeze(["HH", "H", "hh", "h", "mm", "A"]),
});

const unsafeFormatPatternCharacters = /[<>{}|"'`\\\r\n]/;
const asciiLetterPattern = /[A-Za-z]/;
const datePreviewWeekdaysShort = Object.freeze(["일", "월", "화", "수", "목", "금", "토"]);
const datePreviewWeekdaysLong = Object.freeze(["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]);

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getFormatTokenPattern(formatType = "") {
  const tokens = dataTagFormatTokens[String(formatType || "").trim()] || [];

  return tokens.length ? new RegExp(tokens.map(escapeRegExp).join("|"), "g") : null;
}

function getDataTagFormatValidationMessage(formatType = "", formatValue = "") {
  const normalizedFormatType = String(formatType || "").trim();
  const normalizedFormatValue = String(formatValue || "").trim();
  const tokenPattern = getFormatTokenPattern(normalizedFormatType);

  if (!normalizedFormatValue) {
    return "";
  }

  if (!tokenPattern) {
    return "지원하지 않는 데이터 형식입니다.";
  }

  if (normalizedFormatValue.length > maxDataTagFormatLength) {
    return `데이터 형식은 ${maxDataTagFormatLength}자 이내로 입력하세요.`;
  }

  if (unsafeFormatPatternCharacters.test(normalizedFormatValue)) {
    return "데이터 형식에 사용할 수 없는 문자가 포함되어 있습니다.";
  }

  if (!tokenPattern.test(normalizedFormatValue)) {
    return "데이터 형식에는 하나 이상의 토큰이 필요합니다.";
  }

  tokenPattern.lastIndex = 0;
  const literalText = normalizedFormatValue.replace(tokenPattern, "");

  if (asciiLetterPattern.test(literalText)) {
    return "지원하지 않는 토큰이 포함되어 있습니다. 아래 토큰 가이드를 확인하세요.";
  }

  return "";
}

function replaceDatePreviewTokens(pattern) {
  const previewDate = new Date(2026, 2, 28);
  const month = previewDate.getMonth() + 1;
  const day = previewDate.getDate();
  const replacements = {
    D: String(day),
    DD: String(day).padStart(2, "0"),
    M: String(month),
    MM: String(month).padStart(2, "0"),
    YY: "26",
    YYYY: "2026",
    ddd: datePreviewWeekdaysShort[previewDate.getDay()],
    dddd: datePreviewWeekdaysLong[previewDate.getDay()],
  };

  return String(pattern || "YYYY.MM.DD").replace(/dddd|ddd|YYYY|YY|MM|M|DD|D/g, (token) => replacements[token] || token);
}

function replaceTimePreviewTokens(pattern) {
  const hours = 8;
  const minutes = 40;
  const twelveHour = hours % 12 || 12;
  const replacements = {
    A: hours < 12 ? "오전" : "오후",
    H: String(hours),
    HH: String(hours).padStart(2, "0"),
    h: String(twelveHour),
    hh: String(twelveHour).padStart(2, "0"),
    mm: String(minutes).padStart(2, "0"),
  };

  return String(pattern || "HH:mm").replace(/HH|H|hh|h|mm|A/g, (token) => replacements[token] || token);
}

export function getDataTagFormatOptions(formatType = "") {
  return dataTagFormatPresets[String(formatType || "").trim()] || Object.freeze([]);
}

export function getDataTagFormatTokenGuides(formatType = "") {
  return dataTagFormatTokenGuides[String(formatType || "").trim()] || Object.freeze([]);
}

export { getDataTagFormatType };

export function isDataTagFormatValid(formatType = "", formatValue = "") {
  return !getDataTagFormatValidationMessage(formatType, formatValue);
}

export function normalizeDataTagFormat(formatType = "", formatValue = "") {
  const normalizedFormatValue = String(formatValue || "").trim();

  return isDataTagFormatValid(formatType, normalizedFormatValue) ? normalizedFormatValue : "";
}

export function getDataTagFormatInputError(formatType = "", formatValue = "") {
  return getDataTagFormatValidationMessage(formatType, formatValue);
}

export function renderDataTagFormatPreview(formatType = "", formatValue = "") {
  const normalizedFormatType = String(formatType || "").trim();
  const normalizedFormatValue = String(formatValue || "").trim();

  if (getDataTagFormatValidationMessage(normalizedFormatType, normalizedFormatValue)) {
    return "";
  }

  if (normalizedFormatType === dateFormatType) {
    return formatDataTagValue(dateFormatType, "2026-03-28", normalizedFormatValue || "YYYY-MM-DD");
  }

  if (normalizedFormatType === timeFormatType) {
    return formatDataTagValue(timeFormatType, "08:40", normalizedFormatValue || "HH:mm");
  }

  return "";
}

export function findDataTagDefinitionByKey(dataTags, tagKey = "") {
  const normalizedKey = String(tagKey || "").trim();

  if (!normalizedKey) {
    return null;
  }

  return flattenTemplateTags(dataTags).find((definition) => String(definition?.key || "").trim() === normalizedKey) || null;
}
