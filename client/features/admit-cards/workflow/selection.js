(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardWorkflowSelection = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createAdmitCardSelectionHelpers({
    getGridRowId,
    getGridRows,
    getGridSelectedRowIds,
  }) {
    function getSelectedAdmitCardExaminees() {
      if (
        typeof getGridRows !== "function" ||
        typeof getGridRowId !== "function" ||
        typeof getGridSelectedRowIds !== "function"
      ) {
        return [];
      }

      const selectedRowIds = new Set(getGridSelectedRowIds("admitCardLookupGrid"));

      return (globalThis.AdmitCardRemoteGrids?.references("admitCardLookupGrid") || getGridRows("admitCardLookupGrid")).filter((row) =>
        selectedRowIds.has(getGridRowId("admitCardLookupGrid", row)),
      );
    }

    function getSelectedAdmitCardExamineeCount() {
      return getSelectedAdmitCardExaminees().length;
    }

    return Object.freeze({
      getSelectedAdmitCardExamineeCount,
      getSelectedAdmitCardExaminees,
    });
  }

  return Object.freeze({
    createAdmitCardSelectionHelpers,
  });
});
