(function (globalScope, factory) {
  const uploadWorkflowUtils =
    globalScope.AdmitCardUploadWorkflowUtils ||
    (typeof require === "function" ? require("../upload-workflows/workflow-utils") : null);
  const moduleApi = factory(uploadWorkflowUtils, globalScope);

  if (typeof module === "object" && module.exports) {
    module.exports = moduleApi;
    return;
  }

  globalScope.AdmitCardApplicantUploadTargetWorkflow = moduleApi;
})(typeof globalThis !== "undefined" ? globalThis : this, (uploadWorkflowUtils, globalScope) => {
  if (!uploadWorkflowUtils) {
    throw new Error("AdmitCardUploadWorkflowUtils is required before loading admin-upload-target-workflow.js");
  }

  function createApplicantUploadPreviewState(defaultMessage = "") {
    return {
      fileName: "",
      fileSize: 0,
      isLoading: false,
      hasLoaded: false,
      message: String(defaultMessage || "").trim(),
      messageType: "",
      summary: null,
    };
  }

  function createApplicantUploadTargetController({
    apiRequest,
    arrayBufferToBase64,
    buildPolicyMarkup,
    buildUploadConfirmationMessage,
    clearSuccessMessage = "",
    executeButtonId = "",
    fileNameFallback = "업로드 파일",
    getExistingDataPolicy,
    getFileInput,
    getFileNameLabel,
    getPreviewMount,
    getSelectedImportCount,
    handleAuthenticationFailure,
    importEndpoint = "",
    invalidPreviewMessage = "현재는 XLSX 업로드만 미리보기할 수 있습니다.",
    invalidUploadMessage = "현재는 XLSX 업로드만 지원합니다.",
    loadingPreviewMessage = "XLSX 파일을 검사하고 있습니다.",
    missingFileMessage = "업로드할 XLSX 파일을 먼저 선택하세요.",
    noRowsMessage = "선택한 기존 데이터 처리 방식에 따라 반영할 데이터가 없습니다.",
    previewDefaultMessage = "",
    previewEndpoint = "",
    previewErrorMessage = "미리보기를 생성하지 못했습니다.",
    policyMountId = "",
    policyTarget = "",
    readFileAsArrayBuffer,
    refreshApplicantBootstrap,
    requestCloseModal,
    resetLabel = "선택된 데이터 파일이 없습니다.",
    showToast,
    successMessage = "",
    summaryCardsBuilder,
    uploadConfirmationTitle = "다음 내용으로 데이터를 업로드하시겠습니까?",
    uploadErrorMessage = "데이터를 업로드하지 못했습니다.",
    uploadModalId = "",
  }) {
    let previewRequestId = 0;
    let previewState = createApplicantUploadPreviewState(previewDefaultMessage);

    function getDocumentElementById(id = "") {
      return globalScope.document?.getElementById(String(id || "").trim()) || null;
    }

    function getCurrentSummary() {
      const inputElement = typeof getFileInput === "function" ? getFileInput() : null;
      const selectedFile = inputElement?.files?.[0] || null;
      const currentPreviewState = selectedFile
        ? (previewState || createApplicantUploadPreviewState(previewDefaultMessage))
        : createApplicantUploadPreviewState(previewDefaultMessage);

      return currentPreviewState.hasLoaded && currentPreviewState.summary && typeof currentPreviewState.summary === "object"
        ? currentPreviewState.summary
        : null;
    }

    function renderPreviewMarkup({ summaryCards = [] } = {}) {
      return uploadWorkflowUtils.renderUploadPreviewMarkup({
        previewState: previewState || createApplicantUploadPreviewState(previewDefaultMessage),
        defaultMessage: previewDefaultMessage,
        fileNameFallback,
        summaryCards,
        loadingMessage: "XLSX 파일을 검사하고 있습니다.",
        warningMessage: "XLSX 파일을 다시 확인하세요.",
      });
    }

    function syncExecuteButtonState() {
      const executeButton = getDocumentElementById(executeButtonId);
      const inputElement = typeof getFileInput === "function" ? getFileInput() : null;
      const selectedFile = inputElement?.files?.[0] || null;
      const currentPreviewState = previewState || createApplicantUploadPreviewState(previewDefaultMessage);
      const summary = currentPreviewState.summary && typeof currentPreviewState.summary === "object" ? currentPreviewState.summary : null;
      const shouldEnable =
        Boolean(selectedFile) &&
        currentPreviewState.isLoading !== true &&
        currentPreviewState.messageType !== "warning" &&
        currentPreviewState.hasLoaded === true &&
        Boolean(summary) &&
        getSelectedImportCount(summary, getExistingDataPolicy()) > 0;

      if (executeButton) {
        executeButton.disabled = !shouldEnable;
      }
    }

    function syncPolicy() {
      const policyMount = getDocumentElementById(policyMountId);

      if (!policyMount) {
        return;
      }

      policyMount.innerHTML = buildPolicyMarkup({
        target: policyTarget,
        summary: getCurrentSummary(),
        selectedPolicy: getExistingDataPolicy(),
      });
    }

    function syncPreview() {
      const previewMount = typeof getPreviewMount === "function" ? getPreviewMount() : null;

      syncPolicy();

      if (!previewMount) {
        syncExecuteButtonState();
        return;
      }

      const summary = previewState.summary || {};
      previewMount.innerHTML = renderPreviewMarkup({
        summaryCards: summaryCardsBuilder(summary, getExistingDataPolicy()),
      });
      syncExecuteButtonState();
    }

    function clearPreview(options = {}) {
      previewRequestId += 1;
      previewState = {
        ...createApplicantUploadPreviewState(previewDefaultMessage),
        message: String(options.message || previewDefaultMessage).trim(),
        messageType: String(options.messageType || "").trim(),
      };
      syncPreview();
    }

    function clearFiles() {
      const inputElement = typeof getFileInput === "function" ? getFileInput() : null;
      const labelElement = typeof getFileNameLabel === "function" ? getFileNameLabel() : null;

      if (inputElement) {
        inputElement.value = "";
      }

      if (labelElement) {
        labelElement.textContent = resetLabel;
      }

      clearPreview({
        message: clearSuccessMessage || previewDefaultMessage,
      });
    }

    async function previewFile() {
      const inputElement = typeof getFileInput === "function" ? getFileInput() : null;
      const file = inputElement?.files?.[0] || null;
      const nextPreviewRequestId = previewRequestId + 1;

      previewRequestId = nextPreviewRequestId;

      if (!file) {
        clearPreview();
        return false;
      }

      if (!String(file.name || "").toLowerCase().endsWith(".xlsx")) {
        clearPreview({
          message: invalidPreviewMessage,
          messageType: "warning",
        });
        return false;
      }

      previewState = {
        fileName: String(file.name || "").trim(),
        fileSize: Number(file.size || 0),
        isLoading: true,
        hasLoaded: false,
        message: loadingPreviewMessage,
        messageType: "",
        summary: null,
      };
      syncPreview();

      try {
        const fileBuffer = await readFileAsArrayBuffer(file);
        const latestFile = inputElement?.files?.[0] || null;

        if (
          previewRequestId !== nextPreviewRequestId ||
          !latestFile ||
          latestFile.name !== file.name ||
          Number(latestFile.size || 0) !== Number(file.size || 0)
        ) {
          return false;
        }

        const previewResult = await apiRequest(previewEndpoint, {
          method: "POST",
          body: JSON.stringify({
            fileName: file.name || "",
            fileContentBase64: arrayBufferToBase64(fileBuffer),
          }),
        });

        if (previewRequestId !== nextPreviewRequestId) {
          return false;
        }

        previewState = {
          fileName: String(previewResult?.fileName || file.name || "").trim(),
          fileSize: Number(file.size || 0),
          isLoading: false,
          hasLoaded: true,
          message: "",
          messageType: "",
          summary: previewResult && typeof previewResult === "object" ? previewResult : null,
        };
        syncPreview();
        return true;
      } catch (error) {
        if (previewRequestId !== nextPreviewRequestId) {
          return false;
        }

        if (handleAuthenticationFailure(error)) {
          return false;
        }

        previewState = {
          fileName: String(file.name || "").trim(),
          fileSize: Number(file.size || 0),
          isLoading: false,
          hasLoaded: false,
          message: error?.message || previewErrorMessage,
          messageType: "warning",
          summary: null,
        };
        syncPreview();
        return false;
      }
    }

    async function uploadFile() {
      const inputElement = typeof getFileInput === "function" ? getFileInput() : null;
      const file = inputElement?.files?.[0] || null;

      if (!file) {
        showToast(missingFileMessage, "error", 3200);
        return;
      }

      if (!file.name.toLowerCase().endsWith(".xlsx")) {
        showToast(invalidUploadMessage, "error", 3200);
        return;
      }

      try {
        if (!uploadWorkflowUtils.hasMatchingUploadPreview(previewState, file)) {
          const didPreview = await previewFile();

          if (!didPreview) {
            return;
          }
        }

        const previewSummary =
          previewState.summary && typeof previewState.summary === "object"
            ? previewState.summary
            : null;
        const existingDataPolicy = getExistingDataPolicy();
        const selectedCount = getSelectedImportCount(previewSummary, existingDataPolicy);

        if (!previewSummary) {
          showToast("업로드 미리보기를 먼저 확인하세요.", "error", 3200);
          return;
        }

        if (selectedCount <= 0) {
          showToast(noRowsMessage, "error", 3200);
          return;
        }

        if (
          !globalScope.confirm(
            buildUploadConfirmationMessage(uploadConfirmationTitle, previewSummary, existingDataPolicy),
          )
        ) {
          return;
        }

        const fileContentBase64 = arrayBufferToBase64(await readFileAsArrayBuffer(file));
        await apiRequest(importEndpoint, {
          method: "POST",
          body: JSON.stringify({
            fileName: file.name,
            fileContentBase64,
            existingDataPolicy,
          }),
        });
        clearFiles();
        await requestCloseModal?.(uploadModalId);
        await refreshApplicantBootstrap?.(successMessage);
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return;
        }

        showToast(error?.message || uploadErrorMessage, "error", 4200);
      }
    }

    return Object.freeze({
      clearFiles,
      previewFile,
      syncPreview,
      uploadFile,
    });
  }

  return Object.freeze({
    createApplicantUploadPreviewState,
    createApplicantUploadTargetController,
  });
});
