(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardModalController = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createModalController({
    TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
    TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,

    clearApplicantRecruitmentUnitUploadFiles,

    clearTemplateEditorActiveCell,
    clearTemplateEditorImageSelection,
    clearTemplateEditorTableHoverState,
    clearTemplateEditorTableSelection,

    createTemplateEditorState,
    createTemplatePreviewState,
    getAccountCreateModal,

    getApplicantScheduleModal,
    getApplicantSubmissionDownloadModal,
    getApplicantSubmissionDetailModal,
    getApplicantRecruitmentUnitModal,
    getApplicantUnitUploadModal,
    getBatchPrintDownloadModal,
    getSystemAuditLogModal,

    getTemplateEditorDescription,
    getTemplateEditorFontFamily,
    getTemplateEditorFontSize,
    getTemplateEditorModal,
    getTemplateEditorName,
    getTemplateEditorTableColumns,
    getTemplateEditorTableRows,
    getTemplatePreviewModal,
    getTemplatePreviewStage,

    prepareAccountCreateModal,

    releaseTemplateEditorTableResizeSession,
    releaseTemplateEditorTableSelectionSession,
    resetAccountCreateFormState,

    resetApplicantScheduleEditor,
    resetApplicantRecruitmentUnitEditor,
    resetApplicantSubmissionDetail,

    setTemplateEditorTableInsertPanelVisibility,
    state,
    syncEditorToolbarFontSizeControls,
  }) {
    function openModal(modalId) {
      const modal = document.getElementById(modalId);

      if (!modal) {
        return;
      }

      if (modalId === "accountCreateModal") {
        prepareAccountCreateModal();
      }

      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
    }

    async function requestCloseModal(modalId) {
      const normalizedModalId = String(modalId || "").trim();

      if (!normalizedModalId) {
        return false;
      }

      closeModal(normalizedModalId);
      return true;
    }

    function closeModal(modalId) {
      const modal = document.getElementById(modalId);

      if (!modal) {
        return;
      }

      if (modalId === "templateEditorModal") {
        clearTemplateEditorImageSelection();
        releaseTemplateEditorTableResizeSession({ sync: false });
        releaseTemplateEditorTableSelectionSession({ keepSelection: false });
        clearTemplateEditorTableSelection();
        clearTemplateEditorTableHoverState();
        state.templateEditor = createTemplateEditorState();
        clearTemplateEditorActiveCell();

        const templateEditorName = getTemplateEditorName();
        const templateEditorDescription = getTemplateEditorDescription();
        const templateEditorFontFamily = getTemplateEditorFontFamily();
        const templateEditorFontSize = getTemplateEditorFontSize();
        const templateEditorTableRows = getTemplateEditorTableRows();
        const templateEditorTableColumns = getTemplateEditorTableColumns();

        if (templateEditorName) {
          templateEditorName.value = "";
        }

        if (templateEditorDescription) {
          templateEditorDescription.value = "";
        }

        if (templateEditorFontFamily) {
          templateEditorFontFamily.value = TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY;
        }

        if (templateEditorFontSize) {
          syncEditorToolbarFontSizeControls({
            fontSizeElement: templateEditorFontSize,
            fontSize: TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
            defaultFontSize: TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
          });
        }

        if (templateEditorTableRows) {
          templateEditorTableRows.value = "3";
        }

        if (templateEditorTableColumns) {
          templateEditorTableColumns.value = "2";
        }

        setTemplateEditorTableInsertPanelVisibility(false);
      }

      if (modalId === "templatePreviewModal") {
        state.templatePreview = createTemplatePreviewState();
        const templatePreviewStage = getTemplatePreviewStage();

        if (templatePreviewStage) {
          templatePreviewStage.innerHTML = "";
        }
      }

      if (modalId === "applicantUnitUploadModal") {
        clearApplicantRecruitmentUnitUploadFiles?.();
      }

      if (modalId === "accountCreateModal") {
        resetAccountCreateFormState();
      }

      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");

      if (modalId === "applicantSubmissionDetailModal") {
        resetApplicantSubmissionDetail?.({ render: true });
      }

      if (modalId === "applicantScheduleModal") {
        resetApplicantScheduleEditor?.({ render: true });
      }

      if (modalId === "applicantRecruitmentUnitModal") {
        resetApplicantRecruitmentUnitEditor?.({ render: true });
      }

    }

    function closeAllModals() {
      [

        getApplicantScheduleModal(),
        getApplicantSubmissionDownloadModal(),
        getApplicantSubmissionDetailModal(),

        getApplicantRecruitmentUnitModal(),
        getApplicantUnitUploadModal(),
        getBatchPrintDownloadModal?.(),
        getSystemAuditLogModal?.(),
        getAccountCreateModal(),
        getTemplatePreviewModal(),
        getTemplateEditorModal(),
      ].forEach((modal) => {
        if (!modal) {
          return;
        }

        closeModal(modal.id);
      });
    }

    async function requestCloseAllModals() {
      const modalList = [

        getApplicantScheduleModal(),
        getApplicantSubmissionDownloadModal(),
        getApplicantSubmissionDetailModal(),

        getApplicantRecruitmentUnitModal(),
        getApplicantUnitUploadModal(),
        getBatchPrintDownloadModal?.(),
        getSystemAuditLogModal?.(),
        getAccountCreateModal(),
        getTemplatePreviewModal(),
        getTemplateEditorModal(),
      ];

      for (const modal of modalList) {
        if (!modal || modal.classList.contains("hidden")) {
          continue;
        }

        const didClose = await requestCloseModal(modal.id);

        if (!didClose) {
          return false;
        }
      }

      return true;
    }

    return Object.freeze({
      closeAllModals,
      closeModal,
      openModal,
      requestCloseAllModals,
      requestCloseModal,
    });
  }

  return Object.freeze({
    createModalController,
  });
});
