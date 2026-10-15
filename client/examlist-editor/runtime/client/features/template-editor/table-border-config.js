(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableBorderConfig = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function normalizeTemplateEditorBorderTarget(rawValue = "") {
    const normalizedValue = String(rawValue || "").trim();
    return ["all", "outside", "inside", "top", "right", "bottom", "left"].includes(normalizedValue)
      ? normalizedValue
      : "all";
  }

  function normalizeTemplateEditorBorderStyle(rawValue = "") {
    const normalizedValue = String(rawValue || "").trim();
    return ["solid", "dashed", "dotted", "double", "none"].includes(normalizedValue) ? normalizedValue : "solid";
  }

  function normalizeTemplateEditorBorderWidth(rawValue = 1) {
    const normalizedValue = String(rawValue ?? "").trim();
    const width = Number(normalizedValue === "" ? 1 : normalizedValue);
    const roundedWidth = Math.round(width * 2) / 2;

    return Number.isFinite(roundedWidth) ? Math.max(0, Math.min(3, roundedWidth)) : 1;
  }

  function createTemplateEditorTableBorderConfigController({
    getTemplateEditorBorderColorInput,
    getTemplateEditorBorderStyleInput,
    getTemplateEditorBorderTargetInput,
    getTemplateEditorBorderWidthInput,
    normalizeTemplateEditorColorValue,
  }) {
    function getTemplateEditorBorderConfig(options = {}) {
      const target = normalizeTemplateEditorBorderTarget(options.target || getTemplateEditorBorderTargetInput?.()?.value || "all");
      const style = normalizeTemplateEditorBorderStyle(options.style || getTemplateEditorBorderStyleInput?.()?.value || "solid");
      const rawWidth = normalizeTemplateEditorBorderWidth(options.width ?? getTemplateEditorBorderWidthInput?.()?.value ?? 1);
      const shouldRemoveBorder = rawWidth === 0 || style === "none";
      const width = !shouldRemoveBorder && style === "double" ? rawWidth + 2 : rawWidth;
      const color = normalizeTemplateEditorColorValue(
        options.colorValue || options.color || getTemplateEditorBorderColorInput?.()?.value || "#000000",
        "#000000",
      );

      return Object.freeze({
        color,
        target,
        style: shouldRemoveBorder ? "none" : style,
        width,
      });
    }

    function clearTemplateEditorBorderControlDirtyState() {
      [
        getTemplateEditorBorderColorInput?.(),
        getTemplateEditorBorderStyleInput?.(),
        getTemplateEditorBorderTargetInput?.(),
        getTemplateEditorBorderWidthInput?.(),
      ].forEach((element) => {
        if (element?.dataset) {
          delete element.dataset.editorBorderUserValue;
        }
      });
    }

    function getTemplateEditorBorderCssValue(config) {
      if (config.style === "none" || config.width <= 0) {
        return "none";
      }

      return `${config.width}px ${config.style} ${config.color}`;
    }

    return Object.freeze({
      clearTemplateEditorBorderControlDirtyState,
      getTemplateEditorBorderConfig,
      getTemplateEditorBorderCssValue,
    });
  }

  return Object.freeze({
    createTemplateEditorTableBorderConfigController,
  });
});

})();
