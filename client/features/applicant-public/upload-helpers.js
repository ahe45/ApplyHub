(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalScope);
    return;
  }

  globalScope.AdmitCardApplicantPublicUploadHelpers = factory(globalScope);
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  function isApplicantFileInstance(value) {
    return typeof globalScope.File === "function" && value instanceof globalScope.File;
  }

  function isApplicantBlobInstance(value) {
    return typeof globalScope.Blob === "function" && value instanceof globalScope.Blob;
  }

  function createApplicantPdfPreviewState(overrides = {}) {
    return {
      isOpen: false,
      fieldKey: "",
      title: "",
      fileName: "",
      file: null,
      objectUrl: "",
      viewerUrl: "",
      useInlineViewer: true,
      ...overrides,
    };
  }

  function isApplicantUploadField(field = {}) {
    const inputType = String(field?.inputType || "").trim();
    return inputType === "photo" || inputType === "file";
  }

  function buildApplicantUploadDraftValue(inputType = "", value = {}) {
    const normalizedInputType = String(inputType || "").trim();
    const normalizedValue = value && typeof value === "object" ? value : {};
    const file = normalizedValue?.file;

    if (normalizedInputType === "photo") {
      return {
        hasPhoto: normalizedValue?.hasPhoto === true || isApplicantFileInstance(file),
        fileName: String(normalizedValue?.fileName || file?.name || ""),
      };
    }

    return {
      hasFile: normalizedValue?.hasFile === true || isApplicantFileInstance(file),
      fileName: String(normalizedValue?.fileName || file?.name || ""),
    };
  }

  function getApplicantUploadFieldValueLabel(field = {}, fieldValue = {}) {
    const isPhotoField = field.inputType === "photo";

    if (isApplicantFileInstance(fieldValue?.file)) {
      return fieldValue.file.name;
    }

    if (isPhotoField) {
      return fieldValue?.hasPhoto ? fieldValue.fileName || "기존 사진이 등록되어 있습니다." : "선택된 파일이 없습니다.";
    }

    return fieldValue?.hasFile ? fieldValue.fileName || "기존 파일이 등록되어 있습니다." : "선택된 파일이 없습니다.";
  }

  function createApplicantPublicUploadHelpers() {
    function isApplicantPdfUploadValue(fieldValue = {}) {
      const fileName = String(fieldValue?.file?.name || fieldValue?.fileName || "").trim().toLowerCase();
      const mimeType = String(fieldValue?.file?.type || fieldValue?.mimeType || "").trim().toLowerCase();

      return (
        mimeType === "application/pdf" ||
        fileName.endsWith(".pdf")
      );
    }

    function canPreviewApplicantPdfUploadValue(fieldValue = {}) {
      if (!fieldValue || typeof fieldValue !== "object" || !isApplicantPdfUploadValue(fieldValue)) {
        return false;
      }

      return isApplicantFileInstance(fieldValue.file);
    }

    async function createApplicantPdfPreviewFile(fieldValue = {}) {
      if (isApplicantFileInstance(fieldValue?.file) && isApplicantPdfUploadValue(fieldValue)) {
        return fieldValue.file;
      }

      return null;
    }

    return Object.freeze({
      buildApplicantUploadDraftValue,
      canPreviewApplicantPdfUploadValue,
      createApplicantPdfPreviewFile,
      createApplicantPdfPreviewState,
      getApplicantUploadFieldValueLabel,
      isApplicantBlobInstance,
      isApplicantFileInstance,
      isApplicantMobilePdfPreviewEnvironment,
      isApplicantPdfUploadValue,
      isApplicantUploadField,
      readFileAsBase64,
      revokeApplicantPdfPreviewObjectUrl,
    });
  }

  function revokeApplicantPdfPreviewObjectUrl(objectUrl = "") {
    const normalizedObjectUrl = String(objectUrl || "").trim();
    const urlApi = globalScope.URL || globalScope.webkitURL;

    if (!normalizedObjectUrl.startsWith("blob:") || typeof urlApi?.revokeObjectURL !== "function") {
      return;
    }

    try {
      urlApi.revokeObjectURL(normalizedObjectUrl);
    } catch (error) {
      console.warn("Failed to revoke applicant PDF preview URL.", error);
    }
  }

  function isApplicantMobilePdfPreviewEnvironment() {
    const userAgent = String(globalScope.navigator?.userAgent || "").trim();

    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
      return true;
    }

    return globalScope.matchMedia?.("(pointer: coarse)")?.matches === true && Number(globalScope.innerWidth || 0) <= 1024;
  }

  async function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      if (typeof globalScope.FileReader !== "function") {
        reject(new Error("파일을 읽지 못했습니다."));
        return;
      }

      const reader = new globalScope.FileReader();

      reader.addEventListener("load", () => {
        const result = String(reader.result || "");
        const [, base64 = ""] = result.split(",");
        resolve(base64);
      });
      reader.addEventListener("error", () => {
        reject(new Error("파일을 읽지 못했습니다."));
      });
      reader.readAsDataURL(file);
    });
  }

  return Object.freeze({
    createApplicantPublicUploadHelpers,
  });
});
