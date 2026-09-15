(function (globalScope, factory) {
  const workflowUtils = factory(globalScope.AdmitCardHtmlUtils);

  if (typeof module === "object" && module.exports) {
    module.exports = workflowUtils;
    return;
  }

  globalScope.AdmitCardUploadWorkflowUtils = workflowUtils;
})(typeof globalThis !== "undefined" ? globalThis : this, (htmlUtils) => {
  const escapeHtml = htmlUtils?.escapeHtml || ((value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;"));

  function normalizePreviewProgressValue(value = 0) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(numericValue)));
  }

  function normalizePreviewProgressMode(value = "") {
    const normalizedValue = String(value || "").trim().toLowerCase();

    return normalizedValue === "determinate" || normalizedValue === "indeterminate"
      ? normalizedValue
      : "hidden";
  }

  function buildPreviewProgressState(currentState = {}, patch = {}) {
    const nextProgressMode = normalizePreviewProgressMode(
      patch.progressMode ?? currentState.progressMode ?? "determinate",
    );

    return {
      ...currentState,
      ...patch,
      isLoading: true,
      hasLoaded: false,
      messageType: "",
      summary: null,
      progressMode: nextProgressMode,
      progressValue: normalizePreviewProgressValue(patch.progressValue ?? currentState.progressValue ?? 0),
      progressLabel: String(patch.progressLabel ?? currentState.progressLabel ?? "").trim(),
    };
  }

  function renderUploadPreviewProgressMarkup(previewState = {}, fallbackLabel = "미리보기 준비") {
    const progressMode = normalizePreviewProgressMode(previewState.progressMode);

    if (progressMode === "hidden") {
      return "";
    }

    const progressValue = normalizePreviewProgressValue(previewState.progressValue);
    const progressLabel = String(previewState.progressLabel || fallbackLabel || "미리보기 준비").trim();
    const progressText = progressMode === "determinate" ? `${progressValue}%` : "진행 중";
    const ariaValueNow = progressMode === "determinate" ? ` aria-valuenow="${progressValue}"` : "";

    return `
      <div
        class="upload-preview-progress is-${progressMode}"
        role="progressbar"
        aria-label="${escapeHtml(progressLabel)}"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuetext="${escapeHtml(progressText)}"${ariaValueNow}
      >
        <div class="upload-preview-progress-meta">
          <span>${escapeHtml(progressLabel)}</span>
          <span>${escapeHtml(progressText)}</span>
        </div>
        <div class="upload-preview-progress-track" aria-hidden="true">
          <span class="upload-preview-progress-fill" style="${progressMode === "determinate" ? `width: ${progressValue}%;` : ""}"></span>
        </div>
      </div>
    `;
  }

  function normalizeUploadExistingDataPolicy(value = "", options = [], defaultPolicy = "insert-update") {
    const normalizedValue = String(value || "").trim().toLowerCase();

    return (Array.isArray(options) ? options : []).some((option) => option?.value === normalizedValue)
      ? normalizedValue
      : defaultPolicy;
  }

  function getUploadExistingDataPolicyLabel(value = "", options = [], defaultPolicy = "insert-update", fallbackLabel = "") {
    const normalizedPolicy = normalizeUploadExistingDataPolicy(value, options, defaultPolicy);

    return (
      (Array.isArray(options) ? options : []).find((option) => option?.value === normalizedPolicy)?.label ||
      String(fallbackLabel || "").trim() ||
      normalizedPolicy
    );
  }

  function getSpreadsheetImportSelectedCount(summary = null, existingDataPolicy = "", { replaceUsesTotalRows = false } = {}) {
    const normalizedSummary = summary && typeof summary === "object" ? summary : {};
    const normalizedPolicy = String(existingDataPolicy || "").trim().toLowerCase();
    const insertCount = Number(normalizedSummary.insertCount || 0);
    const updateCount = Number(normalizedSummary.updateCount || 0);
    const unchangedCount = Number(normalizedSummary.unchangedCount || 0);

    if (normalizedPolicy === "replace" && replaceUsesTotalRows) {
      return Number(normalizedSummary.totalRows || 0);
    }

    if (normalizedPolicy === "insert-only") {
      return insertCount;
    }

    if (normalizedPolicy === "all") {
      return insertCount + updateCount + unchangedCount;
    }

    return insertCount + updateCount;
  }

  function buildUploadExistingDataPolicyMarkup({
    title = "기존 데이터 처리 방식",
    name = "uploadExistingDataPolicy",
    dataAttributeName = "",
    dataAttributeValue = "",
    options = [],
    selectedPolicy = "",
    selectedCount = 0,
    selectedCountLabel = "",
    defaultPolicy = "insert-update",
  } = {}) {
    const normalizedOptions = Array.isArray(options) ? options : [];
    const normalizedPolicy = normalizeUploadExistingDataPolicy(selectedPolicy, normalizedOptions, defaultPolicy);
    const dataAttributeMarkup =
      dataAttributeName
        ? ` data-${String(dataAttributeName).trim()}="${escapeHtml(dataAttributeValue || "true")}"`
        : "";

    return `
      <section class="upload-preview-policy">
        <div class="upload-preview-policy-head">
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(selectedCountLabel || `${Number(selectedCount || 0)}건 반영 예정`)}</span>
        </div>
        <div class="upload-preview-policy-options">
          ${normalizedOptions.map((option) => `
            <label class="upload-preview-policy-option ${option?.variant === "danger" ? "is-danger" : ""}">
              <input
                type="radio"
                name="${escapeHtml(name)}"
                value="${escapeHtml(option?.value || "")}"
                ${dataAttributeMarkup}
                ${normalizedPolicy === option?.value ? "checked" : ""}
              />
              <span class="upload-preview-policy-option-copy">
                <strong>${escapeHtml(option?.label || "")}</strong>
                <span>${escapeHtml(option?.description || "")}</span>
              </span>
            </label>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderUploadPreviewSummaryCardMarkup(cards = []) {
    return (Array.isArray(cards) ? cards : [])
      .map((card) => {
        const toneClass = String(card?.tone || "").trim();

        return `
          <article class="upload-preview-summary-card${toneClass ? ` is-${escapeHtml(toneClass)}` : ""}">
            <strong>${escapeHtml(String(card?.value || "0건"))}</strong>
            <span>${escapeHtml(String(card?.label || ""))}</span>
          </article>
        `;
      })
      .join("");
  }

  function renderUploadPreviewMarkup({
    previewState,
    defaultMessage = "",
    fileNameFallback = "선택된 파일",
    summaryCards = [],
    loadingTitle = "업로드 미리보기 생성 중",
    loadingMessage = "파일을 검사하고 있습니다.",
    warningTitle = "업로드 미리보기를 생성할 수 없습니다.",
    warningMessage = "파일을 다시 확인하세요.",
    emptyTitle = "업로드 미리보기",
    headTitle = "업로드 미리보기",
    caption = "파일 전체 기준",
    progressFallbackLabel = "미리보기 준비",
  } = {}) {
    const normalizedState = previewState && typeof previewState === "object"
      ? previewState
      : {};
    const summary = normalizedState.summary && typeof normalizedState.summary === "object" ? normalizedState.summary : null;

    if (normalizedState.isLoading) {
      return `
        <div class="upload-preview-state is-loading">
          <strong>${escapeHtml(loadingTitle)}</strong>
          <p>${escapeHtml(normalizedState.message || loadingMessage)}</p>
          ${renderUploadPreviewProgressMarkup(normalizedState, progressFallbackLabel)}
        </div>
      `;
    }

    if (normalizedState.messageType === "warning") {
      return `
        <div class="upload-preview-state is-warning">
          <strong>${escapeHtml(warningTitle)}</strong>
          <p>${escapeHtml(normalizedState.message || warningMessage)}</p>
        </div>
      `;
    }

    if (!normalizedState.hasLoaded || !summary) {
      return `
        <div class="upload-preview-empty">
          <strong>${escapeHtml(emptyTitle)}</strong>
          <p>${escapeHtml(normalizedState.message || defaultMessage)}</p>
        </div>
      `;
    }

    return `
      <div class="upload-preview-head">
        <div>
          <strong>${escapeHtml(headTitle)}</strong>
          <p>${escapeHtml(normalizedState.fileName || fileNameFallback)}</p>
        </div>
        <span class="upload-preview-caption">${escapeHtml(caption)}</span>
      </div>
      <div class="upload-preview-summary-grid">
        ${renderUploadPreviewSummaryCardMarkup(summaryCards)}
      </div>
    `;
  }

  function hasMatchingUploadPreview(previewState = null, file = null) {
    if (!previewState || !file) {
      return false;
    }

    return (
      previewState.hasLoaded === true &&
      String(previewState.fileName || "").trim() === String(file.name || "").trim() &&
      Number(previewState.fileSize || 0) === Number(file.size || 0) &&
      previewState.summary &&
      typeof previewState.summary === "object"
    );
  }

  return Object.freeze({
    buildPreviewProgressState,
    buildUploadExistingDataPolicyMarkup,
    getSpreadsheetImportSelectedCount,
    getUploadExistingDataPolicyLabel,
    hasMatchingUploadPreview,
    normalizePreviewProgressMode,
    normalizePreviewProgressValue,
    normalizeUploadExistingDataPolicy,
    renderUploadPreviewMarkup,
    renderUploadPreviewProgressMarkup,
    renderUploadPreviewSummaryCardMarkup,
  });
});
