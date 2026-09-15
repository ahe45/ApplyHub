(function (globalScope, factory) {
  const uploadWorkflowUtils =
    globalScope.AdmitCardUploadWorkflowUtils ||
    (typeof require === "function" ? require("../upload-workflows/workflow-utils") : null);
  const uploadTargetWorkflow =
    globalScope.AdmitCardApplicantUploadTargetWorkflow ||
    (typeof require === "function" ? require("./admin-upload-target-workflow") : null);
  const moduleApi = factory(uploadWorkflowUtils, uploadTargetWorkflow);

  if (typeof module === "object" && module.exports) {
    module.exports = moduleApi;
    return;
  }

  globalScope.AdmitCardApplicantAdminUploadWorkflow = moduleApi;
})(typeof globalThis !== "undefined" ? globalThis : this, (uploadWorkflowUtils, uploadTargetWorkflow) => {
  if (!uploadWorkflowUtils) {
    throw new Error("AdmitCardUploadWorkflowUtils is required before loading admin-upload-workflow.js");
  }

  if (!uploadTargetWorkflow?.createApplicantUploadTargetController) {
    throw new Error("AdmitCardApplicantUploadTargetWorkflow.createApplicantUploadTargetController is required before loading admin-upload-workflow.js");
  }

  const { createApplicantUploadTargetController } = uploadTargetWorkflow;
  const APPLICANT_IMPORT_EXISTING_DATA_POLICY_OPTIONS = Object.freeze([
    Object.freeze({
      value: "insert-only",
      label: "신규만 반영",
      description: "기존 데이터 수정건과 동일 데이터는 건너뜁니다.",
    }),
    Object.freeze({
      value: "insert-update",
      label: "신규 + 수정 반영",
      description: "동일 데이터는 건너뛰고 신규와 수정건만 반영합니다.",
    }),
    Object.freeze({
      value: "all",
      label: "전체 반영",
      description: "동일 데이터까지 포함해 업로드 파일 전체를 다시 반영합니다.",
    }),
  ]);
  const DEFAULT_APPLICANT_IMPORT_EXISTING_DATA_POLICY = "insert-update";
  const APPLICANT_RECRUITMENT_UPLOAD_PREVIEW_DEFAULT_MESSAGE =
    "XLSX 파일을 선택하면 실제 저장 전에 예상 신규/수정 건수를 전체 파일 기준으로 확인할 수 있습니다.";

  function createApplicantAdminUploadWorkflowController({
    arrayBufferToBase64,
    apiRequest,

    getApplicantUnitUploadFileInput,
    getApplicantUnitUploadFileName,
    getApplicantUnitUploadPreviewMount,
    handleAuthenticationFailure,
    readFileAsArrayBuffer,
    refreshApplicantBootstrap,
    requestCloseModal,
    showToast,
  }) {
    let applicantRecruitmentUploadExistingDataPolicy = DEFAULT_APPLICANT_IMPORT_EXISTING_DATA_POLICY;

    function normalizeApplicantUploadExistingDataPolicy(value = "") {
      return uploadWorkflowUtils.normalizeUploadExistingDataPolicy(
        value,
        APPLICANT_IMPORT_EXISTING_DATA_POLICY_OPTIONS,
        DEFAULT_APPLICANT_IMPORT_EXISTING_DATA_POLICY,
      );
    }

    function getApplicantImportExistingDataPolicyLabel(value = "") {
      return uploadWorkflowUtils.getUploadExistingDataPolicyLabel(
        value,
        APPLICANT_IMPORT_EXISTING_DATA_POLICY_OPTIONS,
        DEFAULT_APPLICANT_IMPORT_EXISTING_DATA_POLICY,
        "신규 + 수정 반영",
      );
    }

    function getApplicantSelectedImportCount(summary = null, existingDataPolicy = "") {
      const normalizedPolicy = normalizeApplicantUploadExistingDataPolicy(existingDataPolicy);

      return uploadWorkflowUtils.getSpreadsheetImportSelectedCount(summary, normalizedPolicy);
    }

    function buildApplicantImportExistingDataPolicyMarkup({ target = "", summary = null, selectedPolicy = "" } = {}) {
      const normalizedTarget = String(target || "").trim();
      const normalizedPolicy = normalizeApplicantUploadExistingDataPolicy(selectedPolicy);
      const normalizedSummary = summary && typeof summary === "object" ? summary : null;
      const selectedCount = getApplicantSelectedImportCount(normalizedSummary, normalizedPolicy);
      const selectedCountLabel = normalizedSummary
        ? `${selectedCount}건 반영 예정`
        : "파일 선택 후 처리 건수 표시";

      return uploadWorkflowUtils.buildUploadExistingDataPolicyMarkup({
        title: "기존 데이터 처리 방식",
        name: `${normalizedTarget}UploadExistingDataPolicy`,
        dataAttributeName: "applicant-upload-existing-policy",
        dataAttributeValue: normalizedTarget,
        options: APPLICANT_IMPORT_EXISTING_DATA_POLICY_OPTIONS,
        selectedPolicy: normalizedPolicy,
        selectedCount,
        selectedCountLabel,
        defaultPolicy: DEFAULT_APPLICANT_IMPORT_EXISTING_DATA_POLICY,
      });
    }

    function buildApplicantUploadConfirmationMessage(title = "", previewSummary = null, existingDataPolicy = "") {
      const summary = previewSummary && typeof previewSummary === "object" ? previewSummary : {};
      const normalizedPolicy = normalizeApplicantUploadExistingDataPolicy(existingDataPolicy);

      return [
        title,
        "",
        `업로드 행: ${Number(summary.totalRows || 0)}건`,
        `신규 등록 예정: ${Number(summary.insertCount || 0)}건`,
        `기존 데이터 수정 예정: ${Number(summary.updateCount || 0)}건`,
        `동일 데이터: ${Number(summary.unchangedCount || 0)}건`,
        `기존 데이터 처리 방식: ${getApplicantImportExistingDataPolicyLabel(normalizedPolicy)}`,
        `현재 설정 기준 반영 예정: ${getApplicantSelectedImportCount(summary, normalizedPolicy)}건`,
      ].join("\n");
    }

    function buildApplicantRecruitmentUploadSummaryCards(summary = {}, existingDataPolicy = "") {
      return [
        { value: `${Number(summary.currentTotalCount || 0)}건`, label: "현재 저장 데이터", tone: "neutral" },
        { value: `${Number(summary.totalRows || 0)}건`, label: "업로드 행", tone: "" },
        { value: `${Number(summary.insertCount || 0)}건`, label: "신규 등록 예정", tone: "insert" },
        { value: `${Number(summary.updateCount || 0)}건`, label: "기존 데이터 수정 예정", tone: "update" },
        { value: `${Number(summary.unchangedCount || 0)}건`, label: "동일 데이터", tone: "neutral" },
        {
          value: `${getApplicantSelectedImportCount(summary, existingDataPolicy)}건`,
          label: "현재 설정 기준 반영 예정",
          tone: "",
        },
      ];
    }

    const recruitmentUnitUploadTarget = createApplicantUploadTargetController({
      apiRequest,
      arrayBufferToBase64,
      buildPolicyMarkup: buildApplicantImportExistingDataPolicyMarkup,
      buildUploadConfirmationMessage: buildApplicantUploadConfirmationMessage,
      executeButtonId: "applicantUnitUploadExecuteButton",
      fileNameFallback: "전형 관리 업로드 파일",
      getExistingDataPolicy: () => applicantRecruitmentUploadExistingDataPolicy,
      getFileInput: getApplicantUnitUploadFileInput,
      getFileNameLabel: getApplicantUnitUploadFileName,
      getPreviewMount: getApplicantUnitUploadPreviewMount,
      getSelectedImportCount: getApplicantSelectedImportCount,
      handleAuthenticationFailure,
      importEndpoint: "/api/applicant-recruitment-units/import",
      loadingPreviewMessage: "XLSX 파일을 검사하고 전형 관리 변경 내역을 계산하고 있습니다.",
      noRowsMessage: "선택한 기존 데이터 처리 방식에 따라 반영할 전형 관리 데이터가 없습니다.",
      policyMountId: "applicantUnitUploadPolicyMount",
      policyTarget: "recruitment",
      previewDefaultMessage: APPLICANT_RECRUITMENT_UPLOAD_PREVIEW_DEFAULT_MESSAGE,
      previewEndpoint: "/api/applicant-recruitment-units/import/preview",
      previewErrorMessage: "전형 관리 미리보기를 생성하지 못했습니다.",
      readFileAsArrayBuffer,
      refreshApplicantBootstrap,
      requestCloseModal,
      successMessage: "전형 관리 데이터를 업로드했습니다.",
      summaryCardsBuilder: buildApplicantRecruitmentUploadSummaryCards,
      uploadConfirmationTitle: "다음 내용으로 전형 관리 데이터를 업로드하시겠습니까?",
      uploadErrorMessage: "전형 관리 데이터를 업로드하지 못했습니다.",
      uploadModalId: "applicantUnitUploadModal",
      showToast,
    });

    function updateApplicantRecruitmentUnitUploadExistingDataPolicy(value = "") {
      applicantRecruitmentUploadExistingDataPolicy = normalizeApplicantUploadExistingDataPolicy(value);
      recruitmentUnitUploadTarget.syncPreview();
    }

    return Object.freeze({

      clearApplicantRecruitmentUnitUploadFiles: recruitmentUnitUploadTarget.clearFiles,

      previewApplicantRecruitmentUnitUploadFile: recruitmentUnitUploadTarget.previewFile,

      syncApplicantRecruitmentUnitUploadPreview: recruitmentUnitUploadTarget.syncPreview,

      updateApplicantRecruitmentUnitUploadExistingDataPolicy,

      uploadApplicantRecruitmentUnitFile: recruitmentUnitUploadTarget.uploadFile,
    });
  }

  return Object.freeze({
    createApplicantAdminUploadWorkflowController,
  });
});
