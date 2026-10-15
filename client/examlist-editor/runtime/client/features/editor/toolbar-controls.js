(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListEditorToolbarControls = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function focusEditorToolbarNumberInput(inputElement = null) {
    if (!(inputElement instanceof HTMLInputElement)) {
      return false;
    }

    inputElement.focus();
    inputElement.select();
    return true;
  }

  function setEditorToolbarManagedPanelVisibility({
    panelId = "",
    isVisible = false,
    getPanelElement = null,
    setEditorToolbarTableInsertPanelVisibility = null,
  } = {}) {
    if (typeof setEditorToolbarTableInsertPanelVisibility === "function" && String(panelId || "").trim()) {
      setEditorToolbarTableInsertPanelVisibility(panelId, Boolean(isVisible));
      return true;
    }

    const panelElement = typeof getPanelElement === "function" ? getPanelElement() : null;

    if (!panelElement) {
      return false;
    }

    panelElement.classList.toggle("hidden", !isVisible);
    return true;
  }

  function getEditorToolbarTableInsertConfig({
    rowInputElement = null,
    columnInputElement = null,
    setStatus = null,
  } = {}) {
    const rowCount = Math.round(Number(rowInputElement?.value || 0));
    const columnCount = Math.round(Number(columnInputElement?.value || 0));

    if (!Number.isFinite(rowCount) || rowCount < 1 || rowCount > 20) {
      setStatus?.("표 행 수는 1개 이상 20개 이하로 입력하세요.", "warning");
      rowInputElement?.focus();
      rowInputElement?.select?.();
      return null;
    }

    if (!Number.isFinite(columnCount) || columnCount < 1 || columnCount > 8) {
      setStatus?.("표 열 수는 1개 이상 8개 이하로 입력하세요.", "warning");
      columnInputElement?.focus();
      columnInputElement?.select?.();
      return null;
    }

    return Object.freeze({
      rowCount,
      columnCount,
    });
  }

  function getEditorToolbarCellSplitConfig({
    countInputElement = null,
    axisName = "",
    axisFallbackId = "",
    setStatus = null,
  } = {}) {
    const selectedAxis =
      (axisName ? document.querySelector(`input[name="${String(axisName).trim()}"]:checked`) : null) ||
      (axisFallbackId ? document.getElementById(String(axisFallbackId).trim()) : null);
    const splitCount = Math.round(Number(countInputElement?.value || 0));
    const splitAxis = selectedAxis instanceof HTMLInputElement ? selectedAxis.value : "column";

    if (!Number.isFinite(splitCount) || splitCount < 2) {
      setStatus?.("셀 분할 개수는 2 이상으로 입력하세요.", "warning");
      focusEditorToolbarNumberInput(countInputElement);
      return null;
    }

    return Object.freeze({
      axis: splitAxis === "row" ? "row" : "column",
      count: splitCount,
    });
  }

  function stepEditorToolbarNumberInput({
    inputElement = null,
    direction = "up",
    minimum = 0,
    maximum = Number.MAX_SAFE_INTEGER,
  } = {}) {
    if (!(inputElement instanceof HTMLInputElement)) {
      return null;
    }

    const stepValue = Math.max(Number(inputElement.step) || 1, 1);
    const currentValue = Math.round(Number(inputElement.value || minimum));
    const normalizedCurrentValue = Number.isFinite(currentValue) ? currentValue : minimum;
    const nextValue =
      String(direction || "").trim().toLowerCase() === "down"
        ? normalizedCurrentValue - stepValue
        : normalizedCurrentValue + stepValue;
    const safeValue = Math.max(minimum, Math.min(maximum, nextValue));

    inputElement.value = String(safeValue);
    inputElement.dispatchEvent(new Event("input", { bubbles: true }));
    return safeValue;
  }

  return Object.freeze({
    focusEditorToolbarNumberInput,
    getEditorToolbarCellSplitConfig,
    getEditorToolbarTableInsertConfig,
    setEditorToolbarManagedPanelVisibility,
    stepEditorToolbarNumberInput,
  });
});

})();
