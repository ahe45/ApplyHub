(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalScope.AdmitCardApplicantFormConfig,
globalScope.AdmitCardApplicantAdminUploadWorkflow || (typeof require === "function" ? require("./admin-upload-workflow") : null),
globalScope.AdmitCardApplicantAdminDownloads || (typeof require === "function" ? require("./admin-downloads") : null),
globalScope.AdmitCardApplicantAdminManagementWorkflow || (typeof require === "function" ? require("./admin-management-workflow") : null),
globalScope.AdmitCardApplicantSubmissionWorkflow || (typeof require === "function" ? require("./admin-submissions-workflow") : null));
    return;
  }

  globalScope.AdmitCardApplicantAdmin = factory(globalScope.AdmitCardApplicantFormConfig,
globalScope.AdmitCardApplicantAdminUploadWorkflow,
globalScope.AdmitCardApplicantAdminDownloads,
globalScope.AdmitCardApplicantAdminManagementWorkflow,
globalScope.AdmitCardApplicantSubmissionWorkflow);
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  (
    applicantFormConfig,
    applicantAdminUploadWorkflow,
    applicantAdminDownloads,
    applicantAdminManagementWorkflow,
    applicantSubmissionWorkflow,
  ) => {
  if (!applicantAdminUploadWorkflow?.createApplicantAdminUploadWorkflowController) {
    throw new Error("AdmitCardApplicantAdminUploadWorkflow.createApplicantAdminUploadWorkflowController is required before loading admin.js");
  }

  if (!applicantAdminDownloads?.createApplicantAdminDownloadController) {
    throw new Error("AdmitCardApplicantAdminDownloads.createApplicantAdminDownloadController is required before loading admin.js");
  }

  if (!applicantAdminManagementWorkflow?.createApplicantAdminManagementController) {
    throw new Error("AdmitCardApplicantAdminManagementWorkflow.createApplicantAdminManagementController is required before loading admin.js");
  }

  if (!applicantSubmissionWorkflow?.createApplicantSubmissionWorkflowController) {
    throw new Error("AdmitCardApplicantSubmissionWorkflow.createApplicantSubmissionWorkflowController is required before loading admin.js");
  }

  const { createApplicantAdminUploadWorkflowController } = applicantAdminUploadWorkflow;
  const { createApplicantAdminDownloadController } = applicantAdminDownloads;

  const { createApplicantAdminManagementController } = applicantAdminManagementWorkflow;
  const { createApplicantSubmissionWorkflowController } = applicantSubmissionWorkflow;
  const defaultExamNoPattern = applicantFormConfig?.defaultApplicantExamNoPattern || "AD-{YY}{MM}{DD}-{SEQ:4}";
  const defaultExamNoSequenceStart = applicantFormConfig?.defaultApplicantExamNoSequenceStart || 1;
  const findApplicantScheduleRecord = applicantFormConfig?.findApplicantScheduleRecord || (() => null);
  const getApplicantSubmissionScheduleState =
    applicantFormConfig?.getApplicantSubmissionScheduleState ||
    (() => ({
      isConfigured: false,
      isOpen: false,
      reason: "not_configured",
      applicantScheduleStartAt: "",
      applicantScheduleEndAt: "",
    }));
  const buildApplicantScheduleContextLabel =
    applicantFormConfig?.buildApplicantScheduleContextLabel || ((value = {}) => String(value?.track || value?.trackName || "선택한 전형"));
  const buildApplicantScheduleRangeLabel = applicantFormConfig?.buildApplicantScheduleRangeLabel || (() => "");

  function createEmptyApplicantFieldEditor({ isActive = false, isDraft = false, formScope = 'application', templateId = null, inputType = 'text' } = {}) {
    return {
      isActive,
      isDraft,
      formScope,
      templateId,
      editingId: 0,
      questionText: "",
      questionDescription: "",
      inputType,
      systemFieldKey: "",
      options: [],
      optionDraft: "",
      optionDraftEn: "",
      optionsEn: {},
      allowCustomOption: false,
      customOptionLabel: "",
      required: false,
    };
  }

  function createEmptyApplicantRecruitmentUnitEditor({ isActive = false } = {}) {
    return {
      isActive,
      editingId: 0,
      trackName: "",
      admissionCode: "",
      admissionName: "",
      admissionNameEn: "",
      seriesCode: "",
      seriesName: "",
      unitCode: "",
      unitName: "",
      unitNameEn: "",
      majorCode: "",
      majorName: "",
      majorNameEn: "",
    };
  }

  function createEmptyApplicantScheduleEditor({ isActive = false } = {}) {
    return {
      isActive,
      isBulk: false,
      isSaving: false,
      editingId: 0,
      scheduleKey: "",
      targetScheduleKeys: [],
      trackName: "",
      admissionCode: "",
      admissionName: "",
      applicantScheduleEnabled: true,
      documentSubmissionScheduleEnabled: true,
      documentReviewScheduleEnabled: true,
      admitCardLookupScheduleEnabled: true,
      applicantScheduleStartAt: "",
      applicantScheduleEndAt: "",
      admitCardLookupScheduleStartAt: "",
      admitCardLookupScheduleEndAt: "",
      documentSubmissionScheduleStartAt: "",
      documentReviewScheduleStartAt: "",
      documentSubmissionScheduleEndAt: "",
      documentReviewScheduleEndAt: "",
    };
  }

  function createApplicantAdminController({
    arrayBufferToBase64,
    apiRequest,
    buildApiUrl,

    getApplicantUnitUploadFileInput,
    getApplicantUnitUploadFileName,
    getApplicantUnitUploadPreviewMount,
    handleAuthenticationFailure,
    loadBootstrapData,
    openModal,
    readFileAsArrayBuffer,
    renderView,
    requestCloseModal,
    showToast,
    state,
  }) {
    function setApplicantManagerTab(tab = "templates") {
      const normalizedTab = String(tab || "").trim();

      if (!["templates", "history", "form-settings"].includes(normalizedTab)) {
        return;
      }

      state.applicantManager.activeTab = normalizedTab;
      renderView();
    }

    function setApplicantSettingsSection(section = "recruitment-units") {
      const normalizedSection = String(section || "").trim();

      state.applicantManager.settingsSection = normalizedSection;
      renderView();
    }

    async function refreshApplicantBootstrap(successMessage = "") {
      const currentTab = state.applicantManager.activeTab || "form-settings";
      const currentSettingsSection = state.applicantManager.settingsSection || "recruitment-units";

      await loadBootstrapData({ showLoading: false });
      state.applicantManager.activeTab = currentTab;
      state.applicantManager.settingsSection = currentSettingsSection;

      if (successMessage) {
        showToast(successMessage);
      }
    }

    function openApplicantFieldPreview() {
      try {
        const isDocuments = new URLSearchParams(window.location.search).get('tab') === 'documents';
        const previewUrl = new URL(buildApiUrl(isDocuments ? '/applicant/documents' : '/applicant/form'));
        previewUrl.searchParams.set("preview", "1");
        const scope = isDocuments ? 'documents' : 'application';
        const selectedId = state.applicantManager.selectedFormTemplates?.[scope] || state.applicantManager.formTemplates?.find(item => item.formScope === scope && item.isDefault)?.id;
        if (selectedId) previewUrl.searchParams.set('templateId', String(selectedId));
        window.open(previewUrl.toString(), "_blank", "noopener,noreferrer");
      } catch (error) {
        showToast("미리보기 페이지를 열지 못했습니다.", "error", 3200);
      }
    }

    const applicantSubmissionWorkflowController = createApplicantSubmissionWorkflowController({
      arrayBufferToBase64,
      apiRequest,
      handleAuthenticationFailure,
      loadBootstrapData,
      openModal,
      readFileAsArrayBuffer,
      refreshApplicantBootstrap,
      renderView,
      requestCloseModal,
      showToast,
      state,
    });
    const {
      deleteApplicantSubmission,
      resetApplicantSubmissionDetail,
      toggleApplicantSubmissionDetail,
      uploadApplicantSubmissionPhoto,
    } = applicantSubmissionWorkflowController;

    const applicantAdminManagementController = createApplicantAdminManagementController({
      apiRequest,

      createEmptyApplicantFieldEditor,
      createEmptyApplicantRecruitmentUnitEditor,
      createEmptyApplicantScheduleEditor,
      defaultExamNoPattern,
      defaultExamNoSequenceStart,
      handleAuthenticationFailure,
      openModal,
      refreshApplicantBootstrap,
      renderView,
      requestCloseModal,
      showToast,
      state,
    });
    const {

      activateApplicantRecruitmentUnitCreation,
      activateApplicantFieldCreation,
      addApplicantFieldOption,

      deleteApplicantRecruitmentUnit,
      deleteApplicantField,
      moveApplicantField,
      removeApplicantFieldOption,
      reorderApplicantField,

      resetApplicantRecruitmentUnitEditor,
      resetApplicantScheduleEditor,
      resetApplicantFieldEditor,

      saveApplicantRecruitmentUnit,
      saveApplicantSchedule,
      saveApplicantFieldEditor,
      saveApplicantSettings,

      startApplicantRecruitmentUnitEdit,
      startApplicantScheduleBulkEdit,
      startApplicantScheduleEdit,
      startApplicantFieldEdit,

      updateApplicantScheduleEditorField,
      updateApplicantRecruitmentUnitEditorField,
      updateApplicantFieldEditorField,
      updateApplicantSettingsField,
    } = applicantAdminManagementController;

    const applicantAdminDownloadController = createApplicantAdminDownloadController({
      buildApiUrl,

      requestCloseModal,
      showToast,
      state,
    });
    const {

      downloadApplicantSubmissionPhotos,
      downloadApplicantSubmissions,
      downloadApplicantRecruitmentUnits,
      downloadApplicantRecruitmentUnitTemplate,
    } = applicantAdminDownloadController;

    const applicantAdminUploadWorkflowController = createApplicantAdminUploadWorkflowController({
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
    });
    const {

      clearApplicantRecruitmentUnitUploadFiles,

      previewApplicantRecruitmentUnitUploadFile,

      syncApplicantRecruitmentUnitUploadPreview,

      updateApplicantRecruitmentUnitUploadExistingDataPolicy,

      uploadApplicantRecruitmentUnitFile,
    } = applicantAdminUploadWorkflowController;

    syncApplicantRecruitmentUnitUploadPreview();

    return Object.freeze({

      activateApplicantRecruitmentUnitCreation,
      activateApplicantFieldCreation,
      addApplicantFieldOption,

      clearApplicantRecruitmentUnitUploadFiles,

      createEmptyApplicantRecruitmentUnitEditor,
      createEmptyApplicantScheduleEditor,
      createEmptyApplicantFieldEditor,

      deleteApplicantSubmission,
      deleteApplicantRecruitmentUnit,
      deleteApplicantField,

      downloadApplicantSubmissionPhotos,
      downloadApplicantSubmissions,
      downloadApplicantRecruitmentUnits,
      downloadApplicantRecruitmentUnitTemplate,
      moveApplicantField,

      openApplicantFieldPreview,

      previewApplicantRecruitmentUnitUploadFile,

      reorderApplicantField,

      resetApplicantRecruitmentUnitEditor,
      resetApplicantScheduleEditor,
      resetApplicantFieldEditor,
      resetApplicantSubmissionDetail,
      removeApplicantFieldOption,

      saveApplicantRecruitmentUnit,
      saveApplicantSchedule,
      saveApplicantFieldEditor,
      saveApplicantSettings,
      setApplicantSettingsSection,
      setApplicantManagerTab,

      startApplicantRecruitmentUnitEdit,
      startApplicantScheduleBulkEdit,
      startApplicantScheduleEdit,
      startApplicantFieldEdit,
      toggleApplicantSubmissionDetail,

      uploadApplicantRecruitmentUnitFile,
      uploadApplicantSubmissionPhoto,

      updateApplicantScheduleEditorField,
      updateApplicantRecruitmentUnitUploadExistingDataPolicy,
      updateApplicantRecruitmentUnitEditorField,
      updateApplicantFieldEditorField,
      updateApplicantSettingsField,
    });
  }

  return Object.freeze({
    createApplicantAdminController,

    createEmptyApplicantRecruitmentUnitEditor,
    createEmptyApplicantScheduleEditor,
    createEmptyApplicantFieldEditor,
  });
});
