export const templateEditorTableObjectBorderHitSlop = 8;
export const candidateBlockFocusTableObjectOuterHitSlop = 24;
export const candidateBlockGridMinimumRowHeight = 20;
export const candidateBlockGridMinimumHeight = candidateBlockGridMinimumRowHeight;
export const candidateBlockGridMinimumWidth = 120;
export const candidateBlockGridColumnNameRowDefaultHeightPt = 20;
export const candidateBlockGridColumnNameRowMinimumHeightPt = 4;
export const candidateBlockGridColumnNameRowMaximumHeightPt = 240;
const cssPixelsPerPoint = 96 / 72;
export const candidateBlockGridDefaults = Object.freeze({
  blockTemplateHtml: "<p><br></p>",
  columnNameRow: Object.freeze({
    enabled: false,
    heightPt: candidateBlockGridColumnNameRowDefaultHeightPt,
    templateHtml: "<p><br></p>",
  }),
  columns: 2,
  enabled: false,
  emptyBlockLayer: Object.freeze({
    enabled: false,
    templateHtml: "<p><br></p>",
  }),
  fillEmptyBlocks: true,
  gapXPt: 4,
  gapYPt: 4,
  rows: 10,
  sortDirection: "asc",
  sortKey: "examineeNo",
  variant: "photo",
  xPt: 0,
  yPt: 0,
});
export const objectResizeCorners = Object.freeze(["bottom-right", "bottom", "bottom-left", "left", "top-left", "top", "top-right", "right"]);
export const candidateBlockGridSortOptions = Object.freeze([
  Object.freeze({ key: "designatedSort", label: "지정정렬" }),
  Object.freeze({ key: "track", label: "모집시기" }),
  Object.freeze({ key: "admission", label: "전형명" }),
  Object.freeze({ key: "admissionCode", label: "전형코드" }),
  Object.freeze({ key: "series", label: "계열명" }),
  Object.freeze({ key: "seriesCode", label: "계열코드" }),
  Object.freeze({ key: "unit", label: "모집단위명" }),
  Object.freeze({ key: "unitCode", label: "모집단위코드" }),
  Object.freeze({ key: "major", label: "전공명" }),
  Object.freeze({ key: "majorCode", label: "전공코드" }),
  Object.freeze({ key: "date", label: "시험날짜" }),
  Object.freeze({ key: "time", label: "시작시간" }),
  Object.freeze({ key: "endTime", label: "종료시간" }),
  Object.freeze({ key: "period", label: "교시명" }),
  Object.freeze({ key: "periodCode", label: "교시코드" }),
  Object.freeze({ key: "building", label: "고사건물명" }),
  Object.freeze({ key: "buildingCode", label: "고사건물코드" }),
  Object.freeze({ key: "room", label: "고사실명" }),
  Object.freeze({ key: "roomCode", label: "고사실코드" }),
  Object.freeze({ key: "examineeNo", label: "수험번호" }),
  Object.freeze({ key: "temporaryNo", label: "가번호" }),
  Object.freeze({ key: "name", label: "이름" }),
  Object.freeze({ key: "birth", label: "생년월일" }),
  Object.freeze({ key: "group", label: "조" }),
  Object.freeze({ key: "opt1", label: "OPT1" }),
  Object.freeze({ key: "opt2", label: "OPT2" }),
  Object.freeze({ key: "opt3", label: "OPT3" }),
  Object.freeze({ key: "opt4", label: "OPT4" }),
  Object.freeze({ key: "opt5", label: "OPT5" }),
  Object.freeze({ key: "opt6", label: "OPT6" }),
  Object.freeze({ key: "opt7", label: "OPT7" }),
  Object.freeze({ key: "opt8", label: "OPT8" }),
  Object.freeze({ key: "opt9", label: "OPT9" }),
  Object.freeze({ key: "opt10", label: "OPT10" }),
]);
const candidateBlockGridSortKeys = new Set(candidateBlockGridSortOptions.map((option) => option.key));
const candidateBlockGridSortKeyAliases = Object.freeze({
  "candidate.admissionRoundName": "track",
  "candidate.admissionTypeCode": "admissionCode",
  "candidate.admissionTypeName": "admission",
  "candidate.birthDate": "birth",
  "candidate.buildingCode": "buildingCode",
  "candidate.buildingName": "building",
  "candidate.date": "date",
  "candidate.departmentCode": "unitCode",
  "candidate.departmentName": "unit",
  "candidate.designatedSort": "designatedSort",
  "candidate.examDate": "date",
  "candidate.examName": "track",
  "candidate.examNo": "examineeNo",
  "candidate.examStartTime": "time",
  "candidate.examEndTime": "endTime",
  "candidate.groupName": "group",
  "candidate.majorCode": "majorCode",
  "candidate.majorName": "major",
  "candidate.name": "name",
  "candidate.opt1": "opt1",
  "candidate.opt2": "opt2",
  "candidate.opt3": "opt3",
  "candidate.opt4": "opt4",
  "candidate.opt5": "opt5",
  "candidate.opt6": "opt6",
  "candidate.opt7": "opt7",
  "candidate.opt8": "opt8",
  "candidate.opt9": "opt9",
  "candidate.opt10": "opt10",
  "candidate.periodCode": "periodCode",
  "candidate.periodName": "period",
  "candidate.roomCode": "roomCode",
  "candidate.roomName": "room",
  "candidate.seriesCode": "seriesCode",
  "candidate.seriesName": "series",
  "candidate.temporaryNo": "temporaryNo",
});


export function clampInteger(value, fallback, minimum, maximum) {
  const numericValue = Math.round(Number(value));

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, numericValue));
}

export function clampPointValue(value, fallback, minimum, maximum) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(numericValue * 100) / 100));
}

export function pointValueToCssPixel(value) {
  return Math.round(clampPointValue(value, 0, 0, 1000) * cssPixelsPerPoint * 100) / 100;
}

export function cssPixelToPointValue(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.round((numericValue / cssPixelsPerPoint) * 100) / 100);
}

export function normalizeCandidateBlockColumnNameRowHeightPt(value, fallback = candidateBlockGridColumnNameRowDefaultHeightPt) {
  return clampPointValue(
    value,
    fallback,
    candidateBlockGridColumnNameRowMinimumHeightPt,
    candidateBlockGridColumnNameRowMaximumHeightPt,
  );
}

export function normalizeCandidateBlockColumnNameRowHeightPx(value, fallback = pointValueToCssPixel(candidateBlockGridColumnNameRowDefaultHeightPt)) {
  const numericValue = Number(value);
  const fallbackValue = Number(fallback);
  const minimumPx = Math.ceil(pointValueToCssPixel(candidateBlockGridColumnNameRowMinimumHeightPt));
  const maximumPx = Math.floor(pointValueToCssPixel(candidateBlockGridColumnNameRowMaximumHeightPt));
  const roundedValue = Number.isFinite(numericValue)
    ? Math.round(numericValue)
    : Math.round(Number.isFinite(fallbackValue) ? fallbackValue : pointValueToCssPixel(candidateBlockGridColumnNameRowDefaultHeightPt));

  return Math.min(maximumPx, Math.max(minimumPx, roundedValue));
}

export function cssPixelToCandidateBlockColumnNameRowHeightPt(value, fallback = candidateBlockGridColumnNameRowDefaultHeightPt) {
  const fallbackPt = normalizeCandidateBlockColumnNameRowHeightPt(fallback);
  const fallbackPx = pointValueToCssPixel(fallbackPt);
  const normalizedPx = normalizeCandidateBlockColumnNameRowHeightPx(value, fallbackPx);

  return normalizeCandidateBlockColumnNameRowHeightPt(cssPixelToPointValue(normalizedPx), fallbackPt);
}

export function normalizeCandidateBlockGridSortKey(value) {
  const rawValue = String(value || "").trim();
  const aliasedValue = candidateBlockGridSortKeyAliases[rawValue] || rawValue;

  return candidateBlockGridSortKeys.has(aliasedValue) ? aliasedValue : candidateBlockGridDefaults.sortKey;
}

export function normalizeCandidateBlockGridSortDirection(value) {
  return String(value || "").trim().toLowerCase() === "desc" ? "desc" : candidateBlockGridDefaults.sortDirection;
}

export function normalizeCandidateBlockTemplateHtml(value) {
  const normalizedValue = String(value || "").trim();

  if (isSmokeCandidateBlockTemplateHtml(normalizedValue)) {
    return candidateBlockGridDefaults.blockTemplateHtml;
  }

  return normalizedValue || candidateBlockGridDefaults.blockTemplateHtml;
}

function normalizeCandidateBlockOptionalTemplateSettings(value, defaults = {}) {
  const source = value && typeof value === "object" ? value : {};
  const fallback = defaults && typeof defaults === "object" ? defaults : {};

  return {
    enabled: source.enabled === true || String(source.enabled || "").trim() === "true",
    templateHtml: normalizeCandidateBlockTemplateHtml(source.templateHtml ?? source.blockTemplateHtml ?? fallback.templateHtml),
  };
}

function normalizeCandidateBlockColumnNameRowSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const normalizedBase = normalizeCandidateBlockOptionalTemplateSettings(
    source,
    candidateBlockGridDefaults.columnNameRow,
  );

  return {
    ...normalizedBase,
    heightPt: normalizeCandidateBlockColumnNameRowHeightPt(
      source.heightPt ?? source.height,
      candidateBlockGridDefaults.columnNameRow.heightPt,
    ),
  };
}

function isSmokeCandidateBlockTemplateHtml(value) {
  const normalizedText = String(value || "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalizedText === "공통 블록";
}

export function normalizeCandidateBlockGridConfig(value) {
  const source = value && typeof value === "object" ? value : {};

  return {
    blockTemplateHtml: normalizeCandidateBlockTemplateHtml(source.blockTemplateHtml),
    columnNameRow: normalizeCandidateBlockColumnNameRowSettings(source.columnNameRow ?? source.fieldNameRow),
    columns: clampInteger(source.columns, candidateBlockGridDefaults.columns, 1, 4),
    enabled: source.enabled === true || String(source.enabled || "").trim() === "true",
    emptyBlockLayer: normalizeCandidateBlockOptionalTemplateSettings(
      source.emptyBlockLayer ?? source.emptyValueLayer,
      candidateBlockGridDefaults.emptyBlockLayer,
    ),
    fillEmptyBlocks: source.fillEmptyBlocks === false || String(source.fillEmptyBlocks || "").trim() === "false"
      ? false
      : candidateBlockGridDefaults.fillEmptyBlocks,
    gapXPt: clampPointValue(source.gapXPt ?? source.gapX, candidateBlockGridDefaults.gapXPt, 0, 48),
    gapYPt: clampPointValue(source.gapYPt ?? source.gapY, candidateBlockGridDefaults.gapYPt, 0, 48),
    rows: clampInteger(source.rows, candidateBlockGridDefaults.rows, 1, 30),
    sortDirection: normalizeCandidateBlockGridSortDirection(source.sortDirection ?? source.sort?.direction),
    sortKey: normalizeCandidateBlockGridSortKey(source.sortKey ?? source.sortField ?? source.sort?.field),
    variant: "photo",
    heightPt: clampPointValue(source.heightPt, 0, 0, 2000),
    widthPt: clampPointValue(source.widthPt, 0, 0, 2000),
    xPt: clampPointValue(source.xPt ?? source.x, candidateBlockGridDefaults.xPt, 0, 2000),
    yPt: clampPointValue(source.yPt ?? source.y, candidateBlockGridDefaults.yPt, 0, 2000),
  };
}

export function getCandidateBlockGridConfig(page) {
  return normalizeCandidateBlockGridConfig(page?.settings?.candidateBlockGrid);
}

export function isCandidateBlockGridContentPage(page) {
  return String(page?.type || "").trim().toLowerCase() === "content";
}

export function canUseCandidateBlockGrid(page) {
  return isCandidateBlockGridContentPage(page);
}

export function isPhotoCandidateBlockGridPage(page) {
  const config = getCandidateBlockGridConfig(page);

  return canUseCandidateBlockGrid(page) && config.enabled;
}

export function getCandidateBlockGridTotal(config) {
  const normalizedConfig = normalizeCandidateBlockGridConfig(config);

  return Math.max(1, normalizedConfig.rows * normalizedConfig.columns);
}
