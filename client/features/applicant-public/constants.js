(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardApplicantPublicConstants = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const APPLICANT_PREVIEW_STATE_STORAGE_KEY = "admitcard.applicant-public-state.v1.preview";
  const APPLICANT_ROUTE_PATHS = Object.freeze({
    home: "/applicant",
    signup: "/applicant/signup",
    documents: "/applicant/documents",
    verify: "/applicant/verify",
    apply: "/applicant/apply",
    form: "/applicant/form",
    result: "/applicant/result",
    lookup: "/applicant/lookup",
    "lookup-summary": "/applicant/lookup/result",
    "lookup-ticket": "/applicant/ticket",
  });
  const APPLICANT_PAGE_TITLES = Object.freeze({
    home: "수험생 접수",
    signup: "회원가입",
    documents: "서류 제출",
    verify: "이메일 인증",
    apply: "원서접수",
    form: "원서접수",
    result: "접수 결과",
    lookup: "본인 확인",
    "lookup-summary": "접수결과 조회",
    "lookup-ticket": "수험표 조회",
  });
  const DEFAULT_LOGIN_BRAND_MARK_PATH = "/client/assets/logo.png";
  const DEFAULT_LOGIN_BACKGROUND_PATH = "/client/assets/bg.png";
  const APPLICANT_LOOKUP_TARGETS = Object.freeze({
    result: "result",
    ticket: "ticket",
  });
  const APPLICANT_CUSTOM_SELECT_VALUE = "__applicant_custom__";
  const APPLICANT_HISTORY_STATE_MARKER = "__admitCardApplicantPublic";
  const APPLICANT_RECRUITMENT_SELECTION_FIELDS = Object.freeze([
    Object.freeze({ key: "track", unitKey: "trackName", label: "모집시기" }),
    Object.freeze({ key: "admission", unitKey: "admissionName", label: "전형" }),
    Object.freeze({ key: "series", unitKey: "seriesName", label: "계열" }),
    Object.freeze({ key: "unit", unitKey: "unitName", label: "모집단위" }),
    Object.freeze({ key: "major", unitKey: "majorName", label: "전공" }),
  ]);
  const APPLICANT_SUMMARY_PRIORITY_SYSTEM_FIELDS = Object.freeze(["track", "admission", "series", "unit", "major"]);

  function createApplicantPublicRuntimeConstants({ isPreviewMode = false } = {}) {
    return Object.freeze({
      APPLICANT_PREVIEW_SEARCH: isPreviewMode ? "?preview=1" : "",
      APPLICANT_PUBLIC_STATE_STORAGE_KEY: `admitcard.applicant-public-state.v1${isPreviewMode ? ".preview" : ""}`,
    });
  }

  return Object.freeze({
    APPLICANT_CUSTOM_SELECT_VALUE,
    APPLICANT_HISTORY_STATE_MARKER,
    APPLICANT_LOOKUP_TARGETS,
    APPLICANT_PAGE_TITLES,
    APPLICANT_PREVIEW_STATE_STORAGE_KEY,
    APPLICANT_RECRUITMENT_SELECTION_FIELDS,
    APPLICANT_ROUTE_PATHS,
    APPLICANT_SUMMARY_PRIORITY_SYSTEM_FIELDS,
    DEFAULT_LOGIN_BACKGROUND_PATH,
    DEFAULT_LOGIN_BRAND_MARK_PATH,
    createApplicantPublicRuntimeConstants,
  });
});
