(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableSizingValues = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorTableSizingValueController({ TEMPLATE_EDITOR_TABLE_MIN_SIZE }) {
    function getTemplateEditorMedianValue(values) {
      if (!Array.isArray(values) || values.length === 0) {
        return TEMPLATE_EDITOR_TABLE_MIN_SIZE;
      }

      const sortedValues = [...values]
        .filter((value) => Number.isFinite(value))
        .sort((leftValue, rightValue) => leftValue - rightValue);

      if (sortedValues.length === 0) {
        return TEMPLATE_EDITOR_TABLE_MIN_SIZE;
      }

      const middleIndex = Math.floor(sortedValues.length / 2);

      if (sortedValues.length % 2 === 1) {
        return Math.round(sortedValues[middleIndex]);
      }

      return Math.round((sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2);
    }

    function distributeTemplateEditorTotalSize(totalSize, targetCount, minimumSize = TEMPLATE_EDITOR_TABLE_MIN_SIZE) {
      const safeCount = Math.max(1, Number(targetCount) || 1);
      const safeTotalSize = Math.max(minimumSize * safeCount, Math.round(Number(totalSize) || 0));
      const baseSize = Math.floor(safeTotalSize / safeCount);
      const remainder = safeTotalSize - baseSize * safeCount;

      return Array.from({ length: safeCount }, (_, index) => baseSize + (index < remainder ? 1 : 0));
    }

    return Object.freeze({
      distributeTemplateEditorTotalSize,
      getTemplateEditorMedianValue,
    });
  }

  return Object.freeze({
    createTemplateEditorTableSizingValueController,
  });
});

})();
