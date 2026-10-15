import { generatedObjectPreviewValues } from "./generated-objects-config.js";

export const hiddenTemplateTagKeys = new Set(["school.academicYear", "candidate.designatedSort"]);

export const dataTagAccordionGroups = Object.freeze([
  Object.freeze({
    icon: "school",
    id: "school",
    keys: Object.freeze(["school.name", "school.code", "candidate.campusName", "candidate.campusCode"]),
    label: "학교 정보",
  }),
  Object.freeze({
    icon: "book",
    id: "exam",
    keys: Object.freeze([
      "candidate.admissionYear",
      "candidate.admissionRoundName",
      "candidate.admissionTypeName",
      "candidate.admissionTypeCode",
      "candidate.seriesName",
      "candidate.seriesCode",
      "candidate.departmentName",
      "candidate.departmentCode",
      "candidate.majorName",
      "candidate.majorCode",
    ]),
    label: "시험 정보",
  }),
  Object.freeze({
    icon: "calendar",
    id: "schedule",
    keys: Object.freeze([
      "candidate.examDate",
      "candidate.examStartTime",
      "candidate.examEndTime",
      "candidate.periodName",
      "candidate.periodCode",
    ]),
    label: "시험 일정",
  }),
  Object.freeze({
    icon: "building",
    id: "site",
    keys: Object.freeze([
      "candidate.buildingName",
      "candidate.buildingCode",
      "candidate.roomName",
      "candidate.roomCode",
      "room.assignedCount",
      "room.otherRoom",
    ]),
    label: "고사장 정보",
  }),
  Object.freeze({
    icon: "user",
    id: "candidate",
    keys: Object.freeze([
      "candidate.examNo",
      "candidate.name",
      "candidate.birthDate",
      "candidate.temporaryNo",
      "candidate.groupName",
      "candidate.photo",
    ]),
    label: "수험생 정보",
  }),
  Object.freeze({
    icon: "more",
    id: "etc",
    keys: Object.freeze([
      "row.indexInPage",
      "document.kyungheeCover",
      "candidate.opt1",
      "candidate.opt2",
      "candidate.opt3",
      "candidate.opt4",
      "candidate.opt5",
      "candidate.opt6",
      "candidate.opt7",
      "candidate.opt8",
      "candidate.opt9",
      "candidate.opt10",
    ]),
    label: "기타",
  }),
]);

const dataTagIconMarkup = Object.freeze({
  book:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5V5.8A2.8 2.8 0 0 1 6.8 3H20v15H6.8A2.8 2.8 0 0 0 4 20.8Z"></path><path d="M8 7h8M8 11h6"></path></svg>',
  building:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V7l8-4 8 4v14"></path><path d="M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01"></path></svg>',
  calendar:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"></path></svg>',
  more:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12h.01M12 12h.01M17 12h.01"></path></svg>',
  school:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 4l9 6.5"></path><path d="M5 10v10h14V10M9 20v-6h6v6"></path><path d="M12 4v16"></path></svg>',
  user:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"></path><path d="M4 21a8 8 0 0 1 16 0"></path></svg>',
});

export const dataTagFallbackDefinitions = Object.freeze({
  "document.kyungheeCover": Object.freeze({ example: generatedObjectPreviewValues["document.kyungheeCover"], label: "경희대 표지", type: "string" }),
  "school.name": Object.freeze({ example: generatedObjectPreviewValues["school.name"], label: "학교명", type: "string" }),
  "school.code": Object.freeze({ example: generatedObjectPreviewValues["school.code"], label: "학교코드", type: "string" }),
  "candidate.campusName": Object.freeze({ example: generatedObjectPreviewValues["candidate.campusName"], label: "캠퍼스명", type: "string" }),
  "candidate.campusCode": Object.freeze({ example: generatedObjectPreviewValues["candidate.campusCode"], label: "캠퍼스코드", type: "string" }),
  "candidate.admissionYear": Object.freeze({ example: generatedObjectPreviewValues["candidate.admissionYear"], label: "학년도", type: "string" }),
  "candidate.admissionRoundName": Object.freeze({ example: generatedObjectPreviewValues["candidate.admissionRoundName"], label: "모집시기", type: "string" }),
  "candidate.admissionTypeName": Object.freeze({ example: generatedObjectPreviewValues["candidate.admissionTypeName"], label: "전형명", type: "string" }),
  "candidate.admissionTypeCode": Object.freeze({ example: generatedObjectPreviewValues["candidate.admissionTypeCode"], label: "전형코드", type: "string" }),
  "candidate.seriesName": Object.freeze({ example: generatedObjectPreviewValues["candidate.seriesName"], label: "계열명", type: "string" }),
  "candidate.seriesCode": Object.freeze({ example: generatedObjectPreviewValues["candidate.seriesCode"], label: "계열코드", type: "string" }),
  "candidate.departmentName": Object.freeze({ example: generatedObjectPreviewValues["candidate.departmentName"], label: "모집단위명", type: "string" }),
  "candidate.departmentCode": Object.freeze({ example: generatedObjectPreviewValues["candidate.departmentCode"], label: "모집단위코드", type: "string" }),
  "candidate.majorName": Object.freeze({ example: generatedObjectPreviewValues["candidate.majorName"], label: "전공명", type: "string" }),
  "candidate.majorCode": Object.freeze({ example: generatedObjectPreviewValues["candidate.majorCode"], label: "전공코드", type: "string" }),
  "candidate.examDate": Object.freeze({ example: generatedObjectPreviewValues["candidate.examDate"], label: "시험날짜", type: "date" }),
  "candidate.examStartTime": Object.freeze({
    aliases: Object.freeze(["시험시간", "시간"]),
    example: generatedObjectPreviewValues["candidate.examStartTime"],
    label: "시작시간",
    type: "string",
  }),
  "candidate.examEndTime": Object.freeze({
    aliases: Object.freeze(["끝시간"]),
    example: generatedObjectPreviewValues["candidate.examEndTime"],
    label: "종료시간",
    type: "string",
  }),
  "candidate.periodName": Object.freeze({ example: generatedObjectPreviewValues["candidate.periodName"], label: "교시명", type: "string" }),
  "candidate.periodCode": Object.freeze({ example: generatedObjectPreviewValues["candidate.periodCode"], label: "교시코드", type: "string" }),
  "candidate.buildingName": Object.freeze({ example: generatedObjectPreviewValues["candidate.buildingName"], label: "고사건물명", type: "string" }),
  "candidate.buildingCode": Object.freeze({ example: generatedObjectPreviewValues["candidate.buildingCode"], label: "고사건물코드", type: "string" }),
  "candidate.roomName": Object.freeze({ example: generatedObjectPreviewValues["candidate.roomName"], label: "고사실명", type: "string" }),
  "candidate.roomCode": Object.freeze({ example: generatedObjectPreviewValues["candidate.roomCode"], label: "고사실코드", type: "string" }),
  "room.assignedCount": Object.freeze({
    aliases: Object.freeze(["고사실 배정인원", "배정 인원"]),
    example: generatedObjectPreviewValues["room.assignedCount"],
    label: "배정인원",
    type: "number",
  }),
  "room.otherRoom": Object.freeze({
    aliases: Object.freeze(["타 고사실", "타고사실"]),
    example: generatedObjectPreviewValues["room.otherRoom"],
    label: "타고사실",
    type: "string",
  }),
  "row.indexInPage": Object.freeze({
    aliases: Object.freeze(["번호", "데이터블록 순번", "블록 순번"]),
    example: generatedObjectPreviewValues["row.indexInPage"],
    label: "순번",
    type: "number",
  }),
  "candidate.examNo": Object.freeze({ example: generatedObjectPreviewValues["candidate.examNo"], label: "수험번호", type: "string" }),
  "candidate.name": Object.freeze({ example: generatedObjectPreviewValues["candidate.name"], label: "이름", type: "string" }),
  "candidate.birthDate": Object.freeze({ example: generatedObjectPreviewValues["candidate.birthDate"], label: "생년월일", type: "date" }),
  "candidate.temporaryNo": Object.freeze({ example: generatedObjectPreviewValues["candidate.temporaryNo"], label: "가번호", type: "string" }),
  "candidate.groupName": Object.freeze({ example: generatedObjectPreviewValues["candidate.groupName"], label: "조", type: "string" }),
  "candidate.photo": Object.freeze({ example: generatedObjectPreviewValues["candidate.photo"], label: "수험생 사진", type: "image" }),
  "candidate.opt1": Object.freeze({ example: generatedObjectPreviewValues["candidate.opt1"], label: "OPT1", type: "string" }),
  "candidate.opt2": Object.freeze({ example: generatedObjectPreviewValues["candidate.opt2"], label: "OPT2", type: "string" }),
  "candidate.opt3": Object.freeze({ example: generatedObjectPreviewValues["candidate.opt3"], label: "OPT3", type: "string" }),
  "candidate.opt4": Object.freeze({ example: generatedObjectPreviewValues["candidate.opt4"], label: "OPT4", type: "string" }),
  "candidate.opt5": Object.freeze({ example: generatedObjectPreviewValues["candidate.opt5"], label: "OPT5", type: "string" }),
  "candidate.opt6": Object.freeze({ example: generatedObjectPreviewValues["candidate.opt6"], label: "OPT6", type: "string" }),
  "candidate.opt7": Object.freeze({ example: generatedObjectPreviewValues["candidate.opt7"], label: "OPT7", type: "string" }),
  "candidate.opt8": Object.freeze({ example: generatedObjectPreviewValues["candidate.opt8"], label: "OPT8", type: "string" }),
  "candidate.opt9": Object.freeze({ example: generatedObjectPreviewValues["candidate.opt9"], label: "OPT9", type: "string" }),
  "candidate.opt10": Object.freeze({ example: generatedObjectPreviewValues["candidate.opt10"], label: "OPT10", type: "string" }),
});

export function renderDataTagIcon(iconKey = "more") {
  return dataTagIconMarkup[iconKey] || dataTagIconMarkup.more;
}

export function getDataTagGroupForKey(key = "") {
  const normalizedKey = String(key || "").trim();

  return dataTagAccordionGroups.find((group) => group.keys.includes(normalizedKey)) || null;
}

export function isVisibleTemplateTag(tag = {}) {
  const key = String(tag?.key || tag?.dataKey || tag?.token || "").trim();

  return Boolean(key) && !hiddenTemplateTagKeys.has(key);
}
