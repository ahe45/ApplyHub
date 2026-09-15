(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardBusyOverlays = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createBusyOverlayController({
    createPdfGenerationState,
    getDocumentBody,
    getPdfGenerationElements,
    state,
  }) {
    function isPdfGenerationActive() {
      return Boolean(state.pdfGeneration?.isActive);
    }

    function isBusyOverlayActive() {
      return isPdfGenerationActive();
    }

    function buildBusyOverlayMessage(message = "") {
      const headline = String(message || "").trim();

      return headline
        ? `${headline}\n잠시만 기다려 주세요.`
        : "잠시만\n기다려 주세요.";
    }

    function buildPdfGenerationMessage(message = "") {
      return buildBusyOverlayMessage(message);
    }

    function normalizeProgressValue(value) {
      const normalizedValue = Math.round(Number(value));

      if (!Number.isFinite(normalizedValue)) {
        return 0;
      }

      return Math.max(0, Math.min(100, normalizedValue));
    }

    function syncAppBusyState() {
      const documentBody = typeof getDocumentBody === "function" ? getDocumentBody() : null;
      documentBody?.classList.toggle("app-busy", isBusyOverlayActive());
    }

    function syncPdfGenerationOverlay() {
      const {
        overlay,
        messageElement,
        progressElement,
        progressLabelElement,
        progressValueElement,
        progressBarElement,
        progressFillElement,
        cancelButtonElement,
      } = typeof getPdfGenerationElements === "function" ? getPdfGenerationElements() : {};
      const isActive = isPdfGenerationActive();
      const progressMode = state.pdfGeneration?.progressMode || "hidden";
      const hasProgress = isActive && progressMode !== "hidden";
      const progressValue = normalizeProgressValue(state.pdfGeneration?.progressValue);
      const isCancelable = isActive && state.pdfGeneration?.isCancelable === true;
      const isCanceling = Boolean(state.pdfGeneration?.isCanceling);

      if (overlay) {
        overlay.classList.toggle("hidden", !isActive);
        overlay.setAttribute("aria-hidden", isActive ? "false" : "true");
      }

      if (messageElement) {
        messageElement.textContent = state.pdfGeneration?.message || buildPdfGenerationMessage();
      }

      if (progressElement) {
        progressElement.classList.toggle("hidden", !hasProgress);
        progressElement.setAttribute("aria-hidden", hasProgress ? "false" : "true");
      }

      if (progressLabelElement) {
        progressLabelElement.textContent = state.pdfGeneration?.progressLabel || "파일 생성 진행률";
      }

      if (progressValueElement) {
        progressValueElement.textContent = progressMode === "determinate" ? `${progressValue}%` : "진행 중";
      }

      if (progressBarElement) {
        progressBarElement.classList.toggle("is-indeterminate", progressMode === "indeterminate");
      }

      if (progressFillElement) {
        progressFillElement.style.width = progressMode === "determinate" ? `${progressValue}%` : "";
      }

      if (cancelButtonElement) {
        cancelButtonElement.classList.toggle("hidden", !isCancelable);
        cancelButtonElement.disabled = !isCancelable || isCanceling;
        cancelButtonElement.textContent = state.pdfGeneration?.cancelLabel || (isCanceling ? "취소 요청 중..." : "작업 취소");
      }

      syncAppBusyState();
    }

    function setPdfGenerationState({
      isActive = state.pdfGeneration?.isActive,
      message = "",
      progressMode = state.pdfGeneration?.progressMode || "hidden",
      progressValue = state.pdfGeneration?.progressValue || 0,
      progressLabel = state.pdfGeneration?.progressLabel || "",
      isCancelable = state.pdfGeneration?.isCancelable === true,
      isCanceling = state.pdfGeneration?.isCanceling === true,
      cancelLabel = state.pdfGeneration?.cancelLabel || createPdfGenerationState().cancelLabel,
    } = {}) {
      const nextIsActive = Boolean(isActive);

      state.pdfGeneration = {
        ...createPdfGenerationState(),
        ...state.pdfGeneration,
        isActive: nextIsActive,
        message: nextIsActive ? buildPdfGenerationMessage(message) : "",
        progressMode: nextIsActive ? progressMode : "hidden",
        progressValue: nextIsActive ? normalizeProgressValue(progressValue) : 0,
        progressLabel: nextIsActive ? String(progressLabel || "") : "",
        isCancelable: nextIsActive ? Boolean(isCancelable) : false,
        isCanceling: nextIsActive ? Boolean(isCanceling) : false,
        cancelLabel: nextIsActive ? String(cancelLabel || createPdfGenerationState().cancelLabel) : createPdfGenerationState().cancelLabel,
      };
      syncPdfGenerationOverlay();
    }

    function resetPdfGenerationState() {
      state.pdfGeneration = createPdfGenerationState();
      syncPdfGenerationOverlay();
    }

    async function runWithPdfGenerationLock(message, task, options = {}) {
      if (isPdfGenerationActive()) {
        return null;
      }

      setPdfGenerationState({
        isActive: true,
        message,
        progressMode: options.progressMode || "hidden",
        progressValue: options.progressValue || 0,
        progressLabel: options.progressLabel || "",
        isCancelable: options.isCancelable === true,
        isCanceling: options.isCanceling === true,
        cancelLabel: options.cancelLabel || createPdfGenerationState().cancelLabel,
      });

      try {
        return await task();
      } finally {
        resetPdfGenerationState();
      }
    }

    return Object.freeze({
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
    });
  }

  return Object.freeze({
    createBusyOverlayController,
  });
});
