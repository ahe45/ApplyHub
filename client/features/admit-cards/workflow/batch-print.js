(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardWorkflowBatchPrint = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const BATCH_PRINT_OUTPUT_MODES = Object.freeze({
    COMBINED_PDF: "combined-pdf",
    PDF_ZIP: "pdf-zip",
  });
  const BATCH_PRINT_CANCELLED_ERROR_CODE = "BATCH_JOB_CANCELLED";
  const BATCH_PRINT_CANCELLED_MESSAGE = "수험표 파일 생성을 취소했습니다.";

  function createAdmitCardBatchPrintHelpers({
    BATCH_PRINT_JOB_TIMEOUT_MS,
    BATCH_PRINT_STATUS_POLL_INTERVAL_MS,
    apiRequest,
    apiRequestForBlobWithProgress,
    closeModal,
    getBatchPrintDownloadElements,
    getSelectedAdmitCardExaminees,
    handleAuthenticationFailure,
    normalizeExamineeNoList,
    normalizeProgressValue,
    recordExamineePrint,
    renderView,
    runWithPdfGenerationLock,
    setPdfGenerationState,
    showToast,
    state,
    wait,
  }) {
    let activeBatchPrintJobId = "";
    let activeBatchPrintDownloadAbort = null;
    let isBatchPrintDownloadActive = false;
    let hasPendingBatchPrintCancellation = false;
    let latestBatchPrintOverlayState = {
      message: "",
      progressMode: "hidden",
      progressValue: 0,
      progressLabel: "",
    };

    function createBatchPrintCancelledError(message = BATCH_PRINT_CANCELLED_MESSAGE) {
      const error = new Error(String(message || BATCH_PRINT_CANCELLED_MESSAGE));

      error.code = BATCH_PRINT_CANCELLED_ERROR_CODE;
      return error;
    }

    function isBatchPrintCancelledError(error) {
      const normalizedCode = String(error?.code || "").trim();
      const normalizedMessage = String(error?.message || "").trim();

      return (
        normalizedCode === BATCH_PRINT_CANCELLED_ERROR_CODE ||
        normalizedMessage === BATCH_PRINT_CANCELLED_MESSAGE ||
        normalizedMessage === "요청이 중단되었습니다."
      );
    }

    function normalizeBatchPrintCount(value) {
      const normalizedValue = Math.round(Number(value));

      if (!Number.isFinite(normalizedValue)) {
        return 0;
      }

      return Math.max(0, normalizedValue);
    }

    function normalizeBatchPrintOutputMode(value) {
      return String(value || "").trim() === BATCH_PRINT_OUTPUT_MODES.PDF_ZIP
        ? BATCH_PRINT_OUTPUT_MODES.PDF_ZIP
        : BATCH_PRINT_OUTPUT_MODES.COMBINED_PDF;
    }

    function normalizeBatchPrintCountUnit(value) {
      const normalizedValue = String(value || "").trim().toLowerCase();

      if (normalizedValue === "page") {
        return "page";
      }

      if (normalizedValue === "file") {
        return "file";
      }

      return "examinee";
    }

    function getSelectedBatchPrintExamineeNos() {
      const selectedExaminees = getSelectedAdmitCardExaminees();
      return normalizeExamineeNoList(
        selectedExaminees.map((examinee) => examinee.examineeNo),
      );
    }

    function getBatchPrintDownloadElementState() {
      return typeof getBatchPrintDownloadElements === "function" ? getBatchPrintDownloadElements() || {} : {};
    }

    function resetBatchPrintOverlayStateCache() {
      latestBatchPrintOverlayState = {
        message: "",
        progressMode: "hidden",
        progressValue: 0,
        progressLabel: "",
      };
    }

    function clearActiveBatchPrintRunState() {
      activeBatchPrintJobId = "";
      activeBatchPrintDownloadAbort = null;
      isBatchPrintDownloadActive = false;
      hasPendingBatchPrintCancellation = false;
      resetBatchPrintOverlayStateCache();
    }

    function getBatchPrintCancelState() {
      const isCancelling = Boolean(state.batchPrint?.isCancelling);

      return {
        isCancelable: Boolean(state.batchPrint?.isLoading),
        isCanceling: isCancelling,
        cancelLabel: isCancelling ? "취소 요청 중..." : "작업 취소",
      };
    }

    function setBatchPrintOverlayState({
      isActive = true,
      message = latestBatchPrintOverlayState.message,
      progressMode = latestBatchPrintOverlayState.progressMode,
      progressValue = latestBatchPrintOverlayState.progressValue,
      progressLabel = latestBatchPrintOverlayState.progressLabel,
    } = {}) {
      latestBatchPrintOverlayState = {
        message: String(message || ""),
        progressMode: String(progressMode || "hidden"),
        progressValue: normalizeProgressValue(progressValue),
        progressLabel: String(progressLabel || ""),
      };

      setPdfGenerationState({
        isActive,
        message: latestBatchPrintOverlayState.message,
        progressMode: latestBatchPrintOverlayState.progressMode,
        progressValue: latestBatchPrintOverlayState.progressValue,
        progressLabel: latestBatchPrintOverlayState.progressLabel,
        ...getBatchPrintCancelState(),
      });
    }

    function triggerBlobDownload(blob, fileName) {
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = downloadUrl;
      anchor.download = String(fileName || "").trim() || "admit-cards.pdf";
      anchor.dataset.allowBusyOverlayClick = "true";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    }

    function syncBatchPrintDownloadModal() {
      const {
        selectionMetaElement,
        combinedPdfOption,
        pdfZipOption,
        submitButton,
      } = getBatchPrintDownloadElementState();
      const examineeCount = getSelectedBatchPrintExamineeNos().length;
      const normalizedOutputMode = normalizeBatchPrintOutputMode(state.batchPrint?.outputMode);
      const isLoading = Boolean(state.batchPrint?.isLoading);

      if (selectionMetaElement) {
        selectionMetaElement.textContent =
          examineeCount > 0
            ? `선택한 ${examineeCount}명의 수험표 다운로드 방식을 선택하세요.`
            : "선택된 수험생이 없습니다.";
      }

      if (combinedPdfOption) {
        combinedPdfOption.checked = normalizedOutputMode === BATCH_PRINT_OUTPUT_MODES.COMBINED_PDF;
      }

      if (pdfZipOption) {
        pdfZipOption.checked = normalizedOutputMode === BATCH_PRINT_OUTPUT_MODES.PDF_ZIP;
      }

      if (submitButton) {
        submitButton.disabled = isLoading || examineeCount === 0;
        submitButton.textContent = isLoading
          ? "파일 생성 중..."
          : normalizedOutputMode === BATCH_PRINT_OUTPUT_MODES.PDF_ZIP
            ? `ZIP 다운로드 (${examineeCount}명)`
            : `PDF 다운로드 (${examineeCount}명)`;
      }
    }

    function getBatchPrintProgressState(completedCount, totalCount) {
      const normalizedCompleted = normalizeBatchPrintCount(completedCount);
      const normalizedTotal = normalizeBatchPrintCount(totalCount);
      const total = normalizedTotal > 0 ? normalizedTotal : normalizedCompleted;
      const completed = total > 0 ? Math.min(total, normalizedCompleted) : 0;

      return {
        completed,
        total,
        percent: total > 0 ? normalizeProgressValue((completed / total) * 100) : 0,
      };
    }

    function buildBatchPrintProgressLabel(completedCount, totalCount, {
      countUnit = "examinee",
      completedPageCount = 0,
      totalPageCount = 0,
    } = {}) {
      const normalizedCountUnit = normalizeBatchPrintCountUnit(countUnit);

      if (normalizedCountUnit === "page") {
        const completedPages = normalizeBatchPrintCount(completedPageCount || completedCount);
        const totalPages = normalizeBatchPrintCount(totalPageCount || totalCount);

        if (totalPages > 0) {
          return `${completedPages}/${totalPages}페이지 생성 완료`;
        }

        return `${completedPages}페이지 생성 완료`;
      }

      if (normalizedCountUnit === "file") {
        const { completed, total } = getBatchPrintProgressState(completedCount, totalCount);
        return `${completed}/${total}개 PDF 생성 완료`;
      }

      const { completed, total } = getBatchPrintProgressState(completedCount, totalCount);

      return `${completed}/${total}명 처리 완료`;
    }

    function getBatchPrintProgressValue(jobPayload = {}) {
      if (normalizeBatchPrintCountUnit(jobPayload.countUnit) === "page") {
        const completedPages = normalizeBatchPrintCount(jobPayload.completedPageCount || jobPayload.completedCount);
        const totalPages = normalizeBatchPrintCount(jobPayload.totalPageCount || jobPayload.totalCount);

        if (totalPages > 0) {
          return normalizeProgressValue((Math.min(totalPages, completedPages) / totalPages) * 100);
        }
      }

      return getBatchPrintProgressState(jobPayload.completedCount, jobPayload.totalCount).percent;
    }

    function buildBatchPrintPhaseMessage(phase, totalCount, {
      outputMode = BATCH_PRINT_OUTPUT_MODES.COMBINED_PDF,
      countUnit = "examinee",
      examineeTotalCount = 0,
    } = {}) {
      const normalizedOutputMode = normalizeBatchPrintOutputMode(outputMode);
      const normalizedTotal = normalizeBatchPrintCount(totalCount);
      const normalizedCountUnit = normalizeBatchPrintCountUnit(countUnit);
      const normalizedExamineeTotal =
        normalizeBatchPrintCount(examineeTotalCount) || (normalizedCountUnit === "examinee" ? normalizedTotal : 0);

      if (normalizedOutputMode === BATCH_PRINT_OUTPUT_MODES.PDF_ZIP) {
        switch (String(phase || "")) {
          case "preparing":
            return `선택한 ${normalizedExamineeTotal}명의 개별 PDF 생성을 준비하고 있습니다.`;
          case "cancelling":
            return `개별 수험표 PDF 생성 작업을 취소하고 있습니다.`;
          case "finalizing":
            return `${normalizedTotal}개의 PDF 파일을 ZIP으로 묶고 있습니다.`;
          case "ready":
            return `${normalizedExamineeTotal}명의 개별 PDF ZIP 파일을 준비했습니다.`;
          case "rendering":
          default:
            return `선택한 ${normalizedExamineeTotal}명의 개별 수험표 PDF를 생성하고 있습니다.`;
        }
      }

      switch (String(phase || "")) {
        case "preparing":
          return `선택한 ${normalizedExamineeTotal}명의 출력 대상을 준비하고 있습니다.`;
        case "cancelling":
          return `통합 PDF 생성 작업을 취소하고 있습니다.`;
        case "finalizing":
          return `${normalizedTotal}페이지 분량의 통합 PDF를 생성하고 있습니다.`;
        case "ready":
          return `${normalizedTotal}페이지 분량의 통합 PDF를 준비했습니다.`;
        case "rendering":
        default:
          return `선택한 ${normalizedExamineeTotal}명의 수험표를 생성하고 있습니다.`;
      }
    }

    function syncBatchPrintOverlayFromJob(jobPayload = {}) {
      const normalizedCountUnit = normalizeBatchPrintCountUnit(jobPayload.countUnit);
      const progressCount =
        normalizedCountUnit === "page"
          ? normalizeBatchPrintCount(jobPayload.completedPageCount || jobPayload.completedCount)
          : normalizeBatchPrintCount(jobPayload.completedCount);
      const totalCount =
        normalizedCountUnit === "page"
          ? normalizeBatchPrintCount(jobPayload.totalPageCount || jobPayload.totalCount)
          : normalizeBatchPrintCount(jobPayload.totalCount);

      setBatchPrintOverlayState({
        isActive: true,
        message: buildBatchPrintPhaseMessage(jobPayload.phase, totalCount, jobPayload),
        progressMode: "determinate",
        progressValue: getBatchPrintProgressValue(jobPayload),
        progressLabel: buildBatchPrintProgressLabel(progressCount, totalCount, jobPayload),
      });
    }

    async function requestBatchPrintJobCancellation(jobId) {
      const normalizedJobId = String(jobId || "").trim();

      if (!normalizedJobId) {
        return false;
      }

      try {
        await apiRequest(`/api/admit-cards/jobs/${encodeURIComponent(normalizedJobId)}`, {
          method: "DELETE",
        });
        return true;
      } catch (error) {
        if (String(error?.code || "").trim() === "BATCH_JOB_NOT_RUNNING" || isBatchPrintCancelledError(error)) {
          return true;
        }

        throw error;
      }
    }

    async function waitForBatchAdmitCardJobCompletion(jobId) {
      const normalizedJobId = String(jobId || "").trim();
      const startedAt = Date.now();

      if (!normalizedJobId) {
        throw new Error("배치 출력 작업 ID가 올바르지 않습니다.");
      }

      while (true) {
        const jobPayload = await apiRequest(`/api/admit-cards/jobs/${encodeURIComponent(normalizedJobId)}`);

        syncBatchPrintOverlayFromJob(jobPayload);

        if (jobPayload.status === "completed") {
          return jobPayload;
        }

        if (jobPayload.status === "cancelled") {
          throw createBatchPrintCancelledError(jobPayload.error || BATCH_PRINT_CANCELLED_MESSAGE);
        }

        if (jobPayload.status === "failed") {
          const error = new Error(jobPayload.error || "수험표 파일을 생성할 수 없습니다.");
          error.code = jobPayload.errorCode || "";
          throw error;
        }

        if (Date.now() - startedAt >= BATCH_PRINT_JOB_TIMEOUT_MS) {
          throw new Error("수험표 파일 생성 시간이 너무 오래 걸리고 있습니다. 잠시 후 다시 시도하세요.");
        }

        await wait(BATCH_PRINT_STATUS_POLL_INTERVAL_MS);
      }
    }

    function prepareBatchPrintDownloadModal() {
      const examineeNos = getSelectedBatchPrintExamineeNos();

      if (examineeNos.length === 0) {
        showToast("일괄 다운로드할 수험생을 먼저 선택하세요.", "error");
        return false;
      }

      state.batchPrint.outputMode = normalizeBatchPrintOutputMode(state.batchPrint?.outputMode);
      syncBatchPrintDownloadModal();
      return true;
    }

    function updateBatchPrintOutputMode(outputMode) {
      state.batchPrint.outputMode = normalizeBatchPrintOutputMode(outputMode);
      syncBatchPrintDownloadModal();
    }

    async function cancelBatchPrintJob() {
      if (!state.batchPrint?.isLoading) {
        return false;
      }

      if (state.batchPrint.isCancelling) {
        return true;
      }

      state.batchPrint.isCancelling = true;
      hasPendingBatchPrintCancellation = true;
      renderView();
      syncBatchPrintDownloadModal();

      setBatchPrintOverlayState({
        isActive: true,
        message: isBatchPrintDownloadActive
          ? "수험표 파일 다운로드를 취소하고 있습니다."
          : buildBatchPrintPhaseMessage("cancelling", getSelectedBatchPrintExamineeNos().length, {
              outputMode: state.batchPrint?.outputMode,
              countUnit: state.batchPrint?.outputMode === BATCH_PRINT_OUTPUT_MODES.PDF_ZIP ? "file" : "examinee",
              examineeTotalCount: getSelectedBatchPrintExamineeNos().length,
            }),
      });

      try {
        if (isBatchPrintDownloadActive && typeof activeBatchPrintDownloadAbort === "function") {
          activeBatchPrintDownloadAbort();
          return true;
        }

        if (activeBatchPrintJobId) {
          await requestBatchPrintJobCancellation(activeBatchPrintJobId);
        }

        return true;
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return false;
        }

        state.batchPrint.isCancelling = false;
        hasPendingBatchPrintCancellation = false;
        renderView();
        syncBatchPrintDownloadModal();
        setBatchPrintOverlayState();
        showToast(error.message, "error", 4200);
        return false;
      }
    }

    async function batchPrintSelectedExaminees(outputMode = state.batchPrint?.outputMode) {
      const examineeNos = getSelectedBatchPrintExamineeNos();
      const normalizedOutputMode = normalizeBatchPrintOutputMode(outputMode);

      if (examineeNos.length === 0) {
        showToast("일괄 다운로드할 수험생을 먼저 선택하세요.", "error");
        return false;
      }

      clearActiveBatchPrintRunState();
      state.batchPrint.isLoading = true;
      state.batchPrint.isCancelling = false;
      state.batchPrint.outputMode = normalizedOutputMode;
      renderView();
      syncBatchPrintDownloadModal();

      const outputLabel = normalizedOutputMode === BATCH_PRINT_OUTPUT_MODES.PDF_ZIP ? "개별 PDF ZIP" : "통합 PDF";
      const initialProgressLabel = buildBatchPrintProgressLabel(0, examineeNos.length, {
        countUnit: normalizedOutputMode === BATCH_PRINT_OUTPUT_MODES.PDF_ZIP ? "file" : "examinee",
      });
      const preparationMessage = buildBatchPrintPhaseMessage("preparing", examineeNos.length, {
        outputMode: normalizedOutputMode,
        countUnit: normalizedOutputMode === BATCH_PRINT_OUTPUT_MODES.PDF_ZIP ? "file" : "examinee",
        examineeTotalCount: examineeNos.length,
      });
      const downloadMessage = `${outputLabel} 파일을 다운로드하고 있습니다.`;
      let downloadSucceeded = false;

      latestBatchPrintOverlayState = {
        message: preparationMessage,
        progressMode: "determinate",
        progressValue: 0,
        progressLabel: initialProgressLabel,
      };

      await runWithPdfGenerationLock(
        preparationMessage,
        async () => {
          try {
            const batchJob = await apiRequest("/api/admit-cards/jobs", {
              method: "POST",
              body: JSON.stringify({ examineeNos, outputMode: normalizedOutputMode }),
            });

            activeBatchPrintJobId = String(batchJob?.jobId || "").trim();

            if (hasPendingBatchPrintCancellation && activeBatchPrintJobId) {
              await requestBatchPrintJobCancellation(activeBatchPrintJobId);
            }

            const completedJob = await waitForBatchAdmitCardJobCompletion(activeBatchPrintJobId);

            if (hasPendingBatchPrintCancellation || state.batchPrint?.isCancelling) {
              throw createBatchPrintCancelledError();
            }

            const completedProgressLabel = buildBatchPrintProgressLabel(
              completedJob.countUnit === "page" ? completedJob.completedPageCount : completedJob.completedCount,
              completedJob.countUnit === "page" ? completedJob.totalPageCount : completedJob.totalCount,
              completedJob,
            );

            setBatchPrintOverlayState({
              isActive: true,
              message: downloadMessage,
              progressMode: "determinate",
              progressValue: 100,
              progressLabel: completedProgressLabel,
            });

            isBatchPrintDownloadActive = true;

            const { blob } = await apiRequestForBlobWithProgress(
              `/api/admit-cards/jobs/${encodeURIComponent(activeBatchPrintJobId)}/file`,
              {
                credentials: "same-origin",
              },
              {
                onRequest: ({ abort }) => {
                  activeBatchPrintDownloadAbort = typeof abort === "function" ? abort : null;

                  if (hasPendingBatchPrintCancellation || state.batchPrint?.isCancelling) {
                    activeBatchPrintDownloadAbort?.();
                  }
                },
                onResponseStart: () => {
                  setBatchPrintOverlayState({
                    isActive: true,
                    message: downloadMessage,
                    progressMode: "determinate",
                    progressValue: 100,
                    progressLabel: completedProgressLabel,
                  });
                },
              },
            );

            isBatchPrintDownloadActive = false;
            activeBatchPrintDownloadAbort = null;

            if (hasPendingBatchPrintCancellation || state.batchPrint?.isCancelling) {
              throw createBatchPrintCancelledError();
            }

            triggerBlobDownload(
              blob,
              completedJob.fileName || (normalizedOutputMode === BATCH_PRINT_OUTPUT_MODES.PDF_ZIP ? "admit-card-pdfs.zip" : "admit-cards.pdf"),
            );
            await recordExamineePrint(examineeNos);
            downloadSucceeded = true;
            showToast(`${examineeNos.length}명의 수험표 ${outputLabel} 파일을 다운로드했습니다.`);
          } catch (error) {
            if (handleAuthenticationFailure(error)) {
              return;
            }

            if (isBatchPrintCancelledError(error)) {
              showToast(BATCH_PRINT_CANCELLED_MESSAGE);
              return;
            }

            showToast(error.message, "error", 4200);
          } finally {
            isBatchPrintDownloadActive = false;
            activeBatchPrintDownloadAbort = null;
          }
        },
        {
          progressMode: "determinate",
          progressValue: 0,
          progressLabel: initialProgressLabel,
          isCancelable: true,
          isCanceling: false,
          cancelLabel: "작업 취소",
        },
      );

      clearActiveBatchPrintRunState();
      state.batchPrint.isLoading = false;
      state.batchPrint.isCancelling = false;
      renderView();
      syncBatchPrintDownloadModal();
      return downloadSucceeded;
    }

    async function submitBatchPrintDownloadSelection() {
      if (!prepareBatchPrintDownloadModal()) {
        return false;
      }

      closeModal?.("batchPrintDownloadModal");
      return batchPrintSelectedExaminees(state.batchPrint?.outputMode);
    }

    return Object.freeze({
      batchPrintSelectedExaminees,
      buildBatchPrintPhaseMessage,
      buildBatchPrintProgressLabel,
      cancelBatchPrintJob,
      prepareBatchPrintDownloadModal,
      submitBatchPrintDownloadSelection,
      updateBatchPrintOutputMode,
    });
  }

  return Object.freeze({
    BATCH_PRINT_OUTPUT_MODES,
    createAdmitCardBatchPrintHelpers,
  });
});
