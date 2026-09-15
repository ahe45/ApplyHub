(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardWorkflowRuntime = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createWorkflowRuntimeController({
    BATCH_PRINT_JOB_TIMEOUT_MS,
    BATCH_PRINT_STATUS_POLL_INTERVAL_MS,
    apiRequest,
    apiRequestForBlobWithProgress,
    buildApiUrl,

    closeModal,
    createAdmitCardWorkflowController,
    createBusyOverlayController,

    createPdfGenerationState,
    getBatchPrintDownloadElements,
    getDocumentBody,
    getExamineeGridRows,
    getGridRowId,
    getGridRows,
    getGridSelectedRowIds,
    getPdfGenerationElements,

    handleAuthenticationFailure,
    loadBootstrapData,

    renderView,
    showToast,
    state,
    wait,
  }) {
    const busyOverlayController = createBusyOverlayController({
      createPdfGenerationState,
      getDocumentBody,
      getPdfGenerationElements,
      state,
      wait,
    });
    const {
      buildBusyOverlayMessage,
      buildPdfGenerationMessage,
      isBusyOverlayActive,
      isPdfGenerationActive,
      normalizeProgressValue,
      resetPdfGenerationState,
      runWithPdfGenerationLock,
      setPdfGenerationState,
      syncAppBusyState,
      syncPdfGenerationOverlay,
    } = busyOverlayController;

    const admitCardWorkflowController = createAdmitCardWorkflowController({
      BATCH_PRINT_JOB_TIMEOUT_MS,
      BATCH_PRINT_STATUS_POLL_INTERVAL_MS,
      apiRequest,
      apiRequestForBlobWithProgress,
      buildApiUrl,
      closeModal,
      getBatchPrintDownloadElements,
      getExamineeGridRows,
      getGridRowId,
      getGridRows,
      getGridSelectedRowIds,
      handleAuthenticationFailure,
      loadBootstrapData,
      normalizeProgressValue,
      renderView,
      runWithPdfGenerationLock,
      setPdfGenerationState,
      state,
      wait,
    });
    const {
      batchPrintSelectedExaminees,
      cancelBatchPrintJob,
      fetchExamineeAdmitCardPdfUrl,
      getSelectedAdmitCardExamineeCount,
      getSelectedAdmitCardExaminees,
      normalizeExamineeNoList,
      openPdfWindow,
      prepareBatchPrintDownloadModal,
      printExamineeAdmitCard,
      printPdfUrl,
      recordExamineePrint,
      submitBatchPrintDownloadSelection,
      updateBatchPrintOutputMode,
    } = admitCardWorkflowController;

    return Object.freeze({
      batchPrintSelectedExaminees,
      buildBusyOverlayMessage,
      buildPdfGenerationMessage,
      fetchExamineeAdmitCardPdfUrl,
      getSelectedAdmitCardExamineeCount,
      getSelectedAdmitCardExaminees,
      isBusyOverlayActive,
      isPdfGenerationActive,
      normalizeExamineeNoList,
      normalizeProgressValue,
      openPdfWindow,
      cancelBatchPrintJob,

      prepareBatchPrintDownloadModal,

      printExamineeAdmitCard,
      printPdfUrl,

      recordExamineePrint,
      resetPdfGenerationState,
      runWithPdfGenerationLock,

      setPdfGenerationState,
      submitBatchPrintDownloadSelection,
      syncAppBusyState,
      syncPdfGenerationOverlay,
      updateBatchPrintOutputMode,

    });
  }

  return Object.freeze({
    createWorkflowRuntimeController,
  });
});
