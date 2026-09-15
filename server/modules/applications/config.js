const applicantFormConfig = require("../../../shared/domain/applicant-form");

const {
  defaultApplicantExamNoPattern,
  defaultApplicantExamNoSequenceStart,
  findApplicantNationalityOption,
  getApplicantStatusLabel: getSharedApplicantStatusLabel,
  protectedApplicantSystemFields,
} = applicantFormConfig;

const APPLICANT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APPLICANT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const APPLICANT_TIME_PATTERN = /^\d{2}:\d{2}$/;
const APPLICANT_SCHEDULE_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const APPLICANT_PHONE_PATTERN = /^\d+$/;
const APPLICANT_CODE_PATTERN = /^[A-Z0-9_-]+$/;
const APPLICANT_EXAM_NO_TOKEN_PATTERN = /\{(?:YYYY|YY|MM|DD|SEQ(?::\d{1,2})?|ADMISSION_CODE|SERIES_CODE|UNIT_CODE)\}/g;
const APPLICANT_EXAM_NO_CODE_TOKEN_PATTERN = /\{(?:ADMISSION_CODE|SERIES_CODE|UNIT_CODE)\}/;
const APPLICANT_FORM_INPUT_TYPES = Object.freeze(["text", "textarea", "select", "date", "birthdate", "time", "photo", "file", "phone", "nationality"]);
const APPLICANT_UPLOAD_INPUT_TYPES = Object.freeze(["photo", "file"]);
const APPLICANT_DEFAULT_RECRUITMENT_EXAM_NO_PATTERN = "{ADMISSION_CODE}{SERIES_CODE}{UNIT_CODE}-{SEQ:4}";
const APPLICANT_EXAM_NO_COMPONENT_TYPES = Object.freeze(["admissionCode", "seriesCode", "unitCode", "nationalityCode", "sequence"]);
const APPLICANT_DEFAULT_EXAM_NO_DIGIT_COUNT = 10;
const APPLICANT_MAX_EXAM_NO_DIGIT_COUNT = 30;
const APPLICANT_DEFAULT_EXAM_NO_COMPONENTS = Object.freeze(["admissionCode", "seriesCode", "unitCode", "sequence", ""]);
const APPLICANT_PUBLIC_ACCESS_TYPES = Object.freeze({
  lookup: "lookup",
  verified: "verified",
});
const APPLICANT_PUBLIC_LOOKUP_TARGETS = Object.freeze({
  result: "result",
  ticket: "ticket",
});
const APPLICANT_EMAIL_DELIVERY_STATUSES = Object.freeze({
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
});


const DEFAULT_APPLICANT_FORM_FIELD_SEEDS = Object.freeze([
  Object.freeze({ fieldKey: "applicant-name", questionText: "이름", inputType: "text", systemFieldKey: "name", required: true }),
  Object.freeze({ fieldKey: "track", questionText: "모집시기", inputType: "text", systemFieldKey: "track", required: true }),
  Object.freeze({ fieldKey: "admission", questionText: "전형", inputType: "text", systemFieldKey: "admission", required: true }),
  Object.freeze({ fieldKey: "series", questionText: "계열", inputType: "text", systemFieldKey: "series", required: true }),
  Object.freeze({ fieldKey: "unit", questionText: "모집단위", inputType: "text", systemFieldKey: "unit", required: true }),
  Object.freeze({ fieldKey: "major", questionText: "전공", inputType: "text", systemFieldKey: "major", required: false }),
  Object.freeze({ fieldKey: "birth", questionText: "생년월일", inputType: "birthdate", systemFieldKey: "birth", required: true }),
  Object.freeze({ fieldKey: "photo", questionText: "수험생 사진", inputType: "photo", systemFieldKey: "photo", required: false }),
]);
const APPLICANT_UNIT_TEMPLATE_COLUMNS = Object.freeze([
  Object.freeze({ key: "trackName", header: "모집시기", width: 18, sample: "수시" }),
  Object.freeze({ key: "admissionCode", header: "전형코드", width: 16, sample: "SU" }),
  Object.freeze({ key: "admissionName", header: "전형", width: 18, sample: "수시" }),
  Object.freeze({ key: "seriesCode", header: "계열코드", width: 16, sample: "EN" }),
  Object.freeze({ key: "seriesName", header: "계열", width: 18, sample: "공학계열" }),
  Object.freeze({ key: "unitCode", header: "모집단위코드", width: 18, sample: "CSE" }),
  Object.freeze({ key: "unitName", header: "모집단위", width: 24, sample: "컴퓨터공학부" }),
  Object.freeze({ key: "majorCode", header: "전공코드", width: 16, sample: "SE" }),
  Object.freeze({ key: "majorName", header: "전공", width: 24, sample: "소프트웨어전공" }),
]);

const STORED_TICKET_OVERRIDE_KEYS = Object.freeze([
  "admissionCode",
  "seriesCode",
  "unitCode",
  "majorCode",
]);
const APPLICANT_IMPORT_PREVIEW_ROW_LIMIT = 8;
const APPLICANT_RECRUITMENT_IMPORT_COMPARE_FIELDS = Object.freeze([
  "trackName",
  "admissionCode",
  "admissionName",
  "seriesCode",
  "seriesName",
  "unitCode",
  "unitName",
  "majorCode",
  "majorName",
]);

const APPLICANT_IMPORT_EXISTING_DATA_POLICIES = Object.freeze({
  INSERT_ONLY: "insert-only",
  INSERT_UPDATE: "insert-update",
  ALL: "all",
});
const APPLICANT_RECRUITMENT_UNIT_PAIR_FIELDS = Object.freeze([
  Object.freeze({ codeKey: "admissionCode", nameKey: "admissionName", codeLabel: "전형코드", nameLabel: "전형" }),
  Object.freeze({ codeKey: "seriesCode", nameKey: "seriesName", codeLabel: "계열코드", nameLabel: "계열" }),
  Object.freeze({ codeKey: "unitCode", nameKey: "unitName", codeLabel: "모집단위코드", nameLabel: "모집단위" }),
  Object.freeze({ codeKey: "majorCode", nameKey: "majorName", codeLabel: "전공코드", nameLabel: "전공" }),
]);
const APPLICANT_RECRUITMENT_SELECTION_FIELDS = Object.freeze([
  Object.freeze({ key: "track", fieldKey: "__applicant_selection_track", questionText: "모집시기", systemFieldKey: "track", unitKey: "trackName" }),
  Object.freeze({ key: "admission", fieldKey: "__applicant_selection_admission", questionText: "전형", systemFieldKey: "admission", unitKey: "admissionName" }),
  Object.freeze({ key: "series", fieldKey: "__applicant_selection_series", questionText: "계열", systemFieldKey: "series", unitKey: "seriesName" }),
  Object.freeze({ key: "unit", fieldKey: "__applicant_selection_unit", questionText: "모집단위", systemFieldKey: "unit", unitKey: "unitName" }),
  Object.freeze({ key: "major", fieldKey: "__applicant_selection_major", questionText: "전공", systemFieldKey: "major", unitKey: "majorName" }),
]);
const APPLICANT_RECRUITMENT_SELECTION_FIELD_KEY_MAP = Object.freeze(
  APPLICANT_RECRUITMENT_SELECTION_FIELDS.reduce((fieldMap, definition) => {
    fieldMap[definition.fieldKey] = definition;
    return fieldMap;
  }, {}),
);
const APPLICANT_RECRUITMENT_SELECTION_SYSTEM_FIELD_MAP = Object.freeze(
  APPLICANT_RECRUITMENT_SELECTION_FIELDS.reduce((fieldMap, definition) => {
    fieldMap[definition.systemFieldKey] = definition;
    return fieldMap;
  }, {}),
);

function isApplicantUploadInputType(inputType = "") {
  return APPLICANT_UPLOAD_INPUT_TYPES.includes(String(inputType || "").trim());
}

module.exports = {


  APPLICANT_CODE_PATTERN,
  APPLICANT_DATE_PATTERN,
  APPLICANT_DEFAULT_EXAM_NO_COMPONENTS,
  APPLICANT_DEFAULT_EXAM_NO_DIGIT_COUNT,
  APPLICANT_DEFAULT_RECRUITMENT_EXAM_NO_PATTERN,
  APPLICANT_EMAIL_DELIVERY_STATUSES,
  APPLICANT_EMAIL_PATTERN,
  APPLICANT_EXAM_NO_CODE_TOKEN_PATTERN,
  APPLICANT_EXAM_NO_COMPONENT_TYPES,
  APPLICANT_EXAM_NO_TOKEN_PATTERN,
  APPLICANT_FORM_INPUT_TYPES,
  APPLICANT_IMPORT_EXISTING_DATA_POLICIES,
  APPLICANT_IMPORT_PREVIEW_ROW_LIMIT,
  APPLICANT_MAX_EXAM_NO_DIGIT_COUNT,
  APPLICANT_PHONE_PATTERN,

  STORED_TICKET_OVERRIDE_KEYS,

  APPLICANT_PUBLIC_ACCESS_TYPES,
  APPLICANT_PUBLIC_LOOKUP_TARGETS,
  APPLICANT_RECRUITMENT_IMPORT_COMPARE_FIELDS,
  APPLICANT_RECRUITMENT_SELECTION_FIELDS,
  APPLICANT_RECRUITMENT_SELECTION_FIELD_KEY_MAP,
  APPLICANT_RECRUITMENT_SELECTION_SYSTEM_FIELD_MAP,
  APPLICANT_RECRUITMENT_UNIT_PAIR_FIELDS,
  APPLICANT_SCHEDULE_DATE_TIME_PATTERN,
  APPLICANT_TIME_PATTERN,
  APPLICANT_UNIT_TEMPLATE_COLUMNS,
  DEFAULT_APPLICANT_FORM_FIELD_SEEDS,

  defaultApplicantExamNoPattern,
  defaultApplicantExamNoSequenceStart,
  findApplicantNationalityOption,
  getSharedApplicantStatusLabel,
  isApplicantUploadInputType,
  protectedApplicantSystemFields,
};
