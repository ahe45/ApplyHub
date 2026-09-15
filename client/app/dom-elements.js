(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardDomElements = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createDomElementRegistry(doc = document) {
    function getTemplateEditorToolbarElements() {
      return {
        templateEditorBlockType: doc.getElementById("templateEditorBlockType"),
        templateEditorBorderColor: doc.getElementById("templateEditorBorderColor"),
        templateEditorBorderStyle: doc.getElementById("templateEditorBorderStyle"),
        templateEditorBorderTarget: doc.getElementById("templateEditorBorderTarget"),
        templateEditorBorderWidth: doc.getElementById("templateEditorBorderWidth"),
        templateEditorCellSplitCount: doc.getElementById("templateEditorCellSplitCount"),
        templateEditorCellSplitPanel: doc.getElementById("templateEditorCellSplitPanel"),
        templateEditorCellShading: doc.getElementById("templateEditorCellShading"),
        templateEditorCellWidth: doc.getElementById("templateEditorCellWidth"),
        templateEditorFontFamily: doc.getElementById("templateEditorFontFamily"),
        templateEditorFontSize: doc.getElementById("templateEditorFontSize"),
        templateEditorImageInput: doc.getElementById("templateEditorImageInput"),
        templateEditorRowHeight: doc.getElementById("templateEditorRowHeight"),
        templateEditorSizeScope: doc.getElementById("templateEditorSizeScope"),
        templateEditorTableColumns: doc.getElementById("templateEditorTableColumns"),
        templateEditorTableInsertPanel: doc.getElementById("templateEditorTableInsertPanel"),
        templateEditorTableRows: doc.getElementById("templateEditorTableRows"),
        templateEditorTextColor: doc.getElementById("templateEditorTextColor"),
        templateEditorTextShading: doc.getElementById("templateEditorTextShading"),
      };
    }

    return Object.freeze({
      accountCreateDescription: doc.getElementById("accountCreateDescription"),
      accountCreateError: doc.getElementById("accountCreateError"),
      accountCreateForm: doc.getElementById("accountCreateForm"),
      accountCreateId: doc.getElementById("accountCreateId"),
      accountCreateModal: doc.getElementById("accountCreateModal"),
      accountCreateName: doc.getElementById("accountCreateName"),
      accountCreateRole: doc.getElementById("accountCreateRole"),

      applicantScheduleModal: doc.getElementById("applicantScheduleModal"),
      applicantSubmissionDownloadModal: doc.getElementById("applicantSubmissionDownloadModal"),
      applicantSubmissionDetailBody: doc.getElementById("applicantSubmissionDetailBody"),
      applicantSubmissionDetailMeta: doc.getElementById("applicantSubmissionDetailMeta"),
      applicantSubmissionDetailModal: doc.getElementById("applicantSubmissionDetailModal"),

      applicantRecruitmentUnitModal: doc.getElementById("applicantRecruitmentUnitModal"),
      applicantUnitUploadFileInput: doc.getElementById("applicantUnitUploadFileInput"),
      applicantUnitUploadFileName: doc.getElementById("applicantUnitUploadFileName"),
      applicantUnitUploadPreviewMount: doc.getElementById("applicantUnitUploadPreviewMount"),
      applicantUnitUploadModal: doc.getElementById("applicantUnitUploadModal"),
      appShell: doc.getElementById("appShell"),
      autoLogoutCountdown: doc.getElementById("autoLogoutCountdown"),
      autoLogoutCountdownValue: doc.getElementById("autoLogoutCountdownValue"),
      batchPrintDownloadForm: doc.getElementById("batchPrintDownloadForm"),
      batchPrintDownloadModal: doc.getElementById("batchPrintDownloadModal"),
      batchPrintDownloadModeCombinedPdf: doc.getElementById("batchPrintDownloadModeCombinedPdf"),
      batchPrintDownloadModeZip: doc.getElementById("batchPrintDownloadModeZip"),
      batchPrintDownloadSelectionMeta: doc.getElementById("batchPrintDownloadSelectionMeta"),
      batchPrintDownloadSubmit: doc.getElementById("batchPrintDownloadSubmit"),
      brandHome: doc.getElementById("brandHome"),
      currentUserId: doc.getElementById("currentUserId"),
      currentUserRole: doc.getElementById("currentUserRole"),

      getTemplateEditorToolbarElements,
      logoutButton: doc.getElementById("logoutButton"),
      menuToggle: doc.getElementById("menuToggle"),
      pageShell: doc.getElementById("pageShell"),
      pageTitle: doc.getElementById("pageTitle"),
      passwordSetupConfirm: doc.getElementById("passwordSetupConfirm"),
      passwordSetupDescription: doc.getElementById("passwordSetupDescription"),
      passwordSetupError: doc.getElementById("passwordSetupError"),
      passwordSetupForm: doc.getElementById("passwordSetupForm"),
      passwordSetupModal: doc.getElementById("passwordSetupModal"),
      passwordSetupNext: doc.getElementById("passwordSetupNext"),
      pdfGenerationMessage: doc.getElementById("pdfGenerationMessage"),
      pdfGenerationOverlay: doc.getElementById("pdfGenerationOverlay"),
      pdfGenerationCancelButton: doc.getElementById("pdfGenerationCancelButton"),
      pdfGenerationProgress: doc.getElementById("pdfGenerationProgress"),
      pdfGenerationProgressBar: doc.getElementById("pdfGenerationProgressBar"),
      pdfGenerationProgressFill: doc.getElementById("pdfGenerationProgressFill"),
      pdfGenerationProgressLabel: doc.getElementById("pdfGenerationProgressLabel"),
      pdfGenerationProgressValue: doc.getElementById("pdfGenerationProgressValue"),
      registeredExamineeCount: doc.getElementById("registeredExamineeCount"),
      sidebar: doc.getElementById("sidebar"),
      systemAuditLogModal: doc.getElementById("systemAuditLogModal"),
      systemAuditLogModalBody: doc.getElementById("systemAuditLogModalBody"),
      templateEditorDescription: doc.getElementById("templateEditorDescription"),
      templateEditorModal: doc.getElementById("templateEditorModal"),
      templateEditorName: doc.getElementById("templateEditorName"),
      templateEditorStatus: doc.getElementById("templateEditorStatus"),
      templateEditorSurface: doc.getElementById("templateEditorSurface"),
      templateEditorTitle: doc.getElementById("templateEditorTitle"),
      templatePreviewMeta: doc.getElementById("templatePreviewMeta"),
      templatePreviewModal: doc.getElementById("templatePreviewModal"),
      templatePreviewStage: doc.getElementById("templatePreviewStage"),
      templatePreviewTitle: doc.getElementById("templatePreviewTitle"),
      toastRoot: doc.getElementById("toastRoot"),
      todayPrintCount: doc.getElementById("todayPrintCount"),
      topbar: doc.getElementById("topbar"),
      totalPrintCount: doc.getElementById("totalPrintCount"),


      viewRoot: doc.getElementById("viewRoot"),
    });
  }

  return Object.freeze({
    createDomElementRegistry,
  });
});
