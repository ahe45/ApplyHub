export const generatedObjectDefaults = Object.freeze({
  barcode: Object.freeze({
    altSuffix: "Code128 바코드",
    className: "template-generated-object-barcode",
    height: 72,
    label: "수험번호 바코드",
    labelSuffix: "바코드",
    width: 240,
  }),
  qrcode: Object.freeze({
    altSuffix: "QR코드",
    className: "template-generated-object-qrcode",
    height: 112,
    label: "수험번호 QR코드",
    labelSuffix: "QR코드",
    width: 112,
  }),
});

export const generatedObjectPreviewValues = Object.freeze({
  "document.kyungheeCover": "건축학과(5년제)\n: 3005200001 ~ 3005200004",
  "candidate.admissionRoundName": "수시",
  "candidate.admissionTypeCode": "SU",
  "candidate.admissionTypeName": "학생부종합전형",
  "candidate.admissionYear": "2026학년도",
  "candidate.designatedSort": "1",
  "candidate.applicationNo": "SU",
  "candidate.birthDate": "2007.03.15",
  "candidate.buildingCode": "BLD01",
  "candidate.buildingName": "본관",
  "candidate.campusCode": "SEOUL",
  "candidate.campusName": "서울캠퍼스",
  "candidate.departmentCode": "NUR",
  "candidate.departmentName": "간호학부",
  "candidate.examDate": "2026-10-21",
  "candidate.examName": "수시",
  "candidate.examEndTime": "10:00",
  "candidate.examNo": "123100001",
  "candidate.examStartTime": "09:00",
  "candidate.groupName": "A조",
  "candidate.majorCode": "NUR01",
  "candidate.majorName": "간호학과",
  "candidate.name": "홍길동",
  "candidate.opt1": "옵션1",
  "candidate.opt2": "옵션2",
  "candidate.opt3": "옵션3",
  "candidate.opt4": "옵션4",
  "candidate.opt5": "옵션5",
  "candidate.opt6": "옵션6",
  "candidate.opt7": "옵션7",
  "candidate.opt8": "옵션8",
  "candidate.opt9": "옵션9",
  "candidate.opt10": "옵션10",
  "candidate.periodCode": "P1",
  "candidate.periodName": "1교시",
  "candidate.photo": "사진",
  "candidate.roomId": "101",
  "candidate.roomCode": "R101",
  "candidate.roomName": "101호",
  "candidate.seriesCode": "NAT",
  "candidate.seriesName": "자연",
  "candidate.temporaryNo": "A001",
  "room.assignedCount": "24",
  "room.otherRoom": "",
  "row.indexInPage": "1",
  "school.academicYear": "2026학년도",
  "school.code": "SEOUL01",
  "school.name": "한국대학교",
});

export const code128GeneratedObjectSourceKeys = new Set([
  "school.code",
  "candidate.campusCode",
  "candidate.admissionTypeCode",
  "candidate.seriesCode",
  "candidate.departmentCode",
  "candidate.majorCode",
  "candidate.examDate",
  "candidate.examStartTime",
  "candidate.examEndTime",
  "candidate.periodCode",
  "candidate.buildingCode",
  "candidate.roomCode",
  "room.assignedCount",
  "candidate.examNo",
  "candidate.temporaryNo",
  "candidate.birthDate",
  "row.indexInPage",
]);

export const generatedObjectSourceAliases = Object.freeze({
  "candidate.admissionYear": Object.freeze(["candidate.admissionYear", "admissionYear"]),
  "candidate.designatedSort": Object.freeze(["candidate.designatedSort", "designatedSort"]),
  "candidate.examNo": Object.freeze(["candidate.examNo", "examNo", "examineeNo"]),
  "candidate.temporaryNo": Object.freeze(["candidate.temporaryNo", "temporaryNo"]),
  "candidate.name": Object.freeze(["candidate.name", "name"]),
  "candidate.birthDate": Object.freeze(["candidate.birthDate", "birth"]),
  "candidate.examStartTime": Object.freeze(["candidate.examStartTime", "time", "session"]),
  "candidate.examEndTime": Object.freeze(["candidate.examEndTime", "endTime", "examEndTime"]),
  "candidate.admissionRoundName": Object.freeze(["candidate.admissionRoundName", "candidate.examName", "exam", "track"]),
  "candidate.examName": Object.freeze(["candidate.examName", "candidate.admissionRoundName", "exam", "track"]),
  "candidate.campusName": Object.freeze(["candidate.campusName", "campus"]),
  "candidate.campusCode": Object.freeze(["candidate.campusCode", "campusCode"]),
  "candidate.admissionTypeName": Object.freeze(["candidate.admissionTypeName", "admission"]),
  "candidate.admissionTypeCode": Object.freeze(["candidate.admissionTypeCode", "candidate.applicationNo", "admissionCode"]),
  "candidate.applicationNo": Object.freeze(["candidate.applicationNo", "candidate.admissionTypeCode", "admissionCode"]),
  "candidate.seriesName": Object.freeze(["candidate.seriesName", "series"]),
  "candidate.seriesCode": Object.freeze(["candidate.seriesCode", "seriesCode"]),
  "candidate.departmentName": Object.freeze(["candidate.departmentName", "unit"]),
  "candidate.departmentCode": Object.freeze(["candidate.departmentCode", "unitCode"]),
  "candidate.majorName": Object.freeze(["candidate.majorName", "major"]),
  "candidate.majorCode": Object.freeze(["candidate.majorCode", "majorCode"]),
  "candidate.buildingName": Object.freeze(["candidate.buildingName", "building"]),
  "candidate.buildingCode": Object.freeze(["candidate.buildingCode", "buildingCode"]),
  "candidate.roomName": Object.freeze(["candidate.roomName", "room"]),
  "candidate.roomCode": Object.freeze(["candidate.roomCode", "candidate.roomId", "roomCode"]),
  "candidate.roomId": Object.freeze(["candidate.roomId", "candidate.roomCode", "roomCode"]),
  "room.assignedCount": Object.freeze(["room.assignedCount", "assignedCount", "room.count"]),
  "room.otherRoom": Object.freeze(["room.otherRoom", "otherRoom"]),
  "candidate.periodName": Object.freeze(["candidate.periodName", "period"]),
  "candidate.periodCode": Object.freeze(["candidate.periodCode", "periodCode"]),
  "candidate.photo": Object.freeze(["candidate.photo", "photo", "photoUrl", "photoFileId"]),
  "candidate.opt1": Object.freeze(["candidate.opt1", "opt1"]),
  "candidate.opt2": Object.freeze(["candidate.opt2", "opt2"]),
  "candidate.opt3": Object.freeze(["candidate.opt3", "opt3"]),
  "candidate.opt4": Object.freeze(["candidate.opt4", "opt4"]),
  "candidate.opt5": Object.freeze(["candidate.opt5", "opt5"]),
  "candidate.opt6": Object.freeze(["candidate.opt6", "opt6"]),
  "candidate.opt7": Object.freeze(["candidate.opt7", "opt7"]),
  "candidate.opt8": Object.freeze(["candidate.opt8", "opt8"]),
  "candidate.opt9": Object.freeze(["candidate.opt9", "opt9"]),
  "candidate.opt10": Object.freeze(["candidate.opt10", "opt10"]),
  "candidate.groupName": Object.freeze(["candidate.groupName", "group"]),
});

export function normalizeGeneratedObjectType(value) {
  const normalizedType = String(value || "").trim().toLowerCase();

  return normalizedType === "qrcode" || normalizedType === "barcode" ? normalizedType : "barcode";
}

export function resolveGeneratedObjectType(value) {
  const normalizedType = String(value || "").trim().toLowerCase();

  return normalizedType === "qrcode" || normalizedType === "barcode" ? normalizedType : "";
}

export function normalizeGeneratedObjectSourceKey(value) {
  return String(value || "").trim() || "candidate.examNo";
}

export function isCode128GeneratedObjectSourceKey(value) {
  return code128GeneratedObjectSourceKeys.has(normalizeGeneratedObjectSourceKey(value));
}

export function filterGeneratedObjectSourceOptionsForType(options = [], objectType = "barcode") {
  const sourceOptions = Array.isArray(options) ? options : [];

  if (normalizeGeneratedObjectType(objectType) !== "barcode") {
    return sourceOptions;
  }

  return sourceOptions.filter((option) => isCode128GeneratedObjectSourceKey(option?.key || option?.dataKey || option?.token));
}

export function getGeneratedObjectConfig(objectType) {
  const resolvedType = resolveGeneratedObjectType(objectType);

  return resolvedType ? generatedObjectDefaults[resolvedType] : null;
}
