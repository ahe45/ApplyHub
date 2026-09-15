(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardExamineePhotoUtils = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function buildExamineePhotoUrl(examinee, { buildApiUrl, previewPhotoPath = "" } = {}) {
    if (examinee?.useTemplatePreviewPhoto && previewPhotoPath) {
      return buildApiUrl(previewPhotoPath);
    }

    const examineeNo = String(examinee?.examineeNo || "").trim();

    if (!examinee?.submissionId || !examinee?.hasPhoto) {
      return "";
    }

    const versionQuery = examinee.photoVersion ? `?v=${encodeURIComponent(examinee.photoVersion)}` : "";
    return `${buildApiUrl(`/api/applicant-submissions/${encodeURIComponent(examinee.submissionId)}/photo`)}${versionQuery}`;
  }

  return Object.freeze({
    buildExamineePhotoUrl,
  });
});
