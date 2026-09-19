(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardWorkflowPrintHistory = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createAdmitCardPrintHistoryHelpers({
    apiRequest,
    loadBootstrapData,
    renderView,
    state,
  }) {
    function normalizeExamineeNoList(examineeNos) {
      const list = Array.isArray(examineeNos) ? examineeNos : [examineeNos];

      return Array.from(
        new Set(
          list
            .map((examineeNo) => String(examineeNo || "").trim())
            .filter(Boolean),
        ),
      );
    }

    async function recordExamineePrint(examineeNos) {
      const normalizedExamineeNos = normalizeExamineeNoList(examineeNos);

      if (normalizedExamineeNos.length === 0) {
        return;
      }

      try {
        await apiRequest("/api/print-history", {
          method: "POST",
          body: JSON.stringify(
            normalizedExamineeNos.length === 1
              ? { examineeNo: normalizedExamineeNos[0] }
              : { examineeNos: normalizedExamineeNos },
          ),
        });
        state.metrics.totalPrints += normalizedExamineeNos.length;
        state.metrics.todayPrints += normalizedExamineeNos.length;
        globalThis.AdmitCardRemoteGrids?.invalidate();
        renderView();
      } catch (error) {
        state.bootstrap.error = error.message;
        renderView();
      }
    }

    return Object.freeze({
      normalizeExamineeNoList,
      recordExamineePrint,
    });
  }

  return Object.freeze({
    createAdmitCardPrintHistoryHelpers,
  });
});
