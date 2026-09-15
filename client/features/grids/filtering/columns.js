(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardGridFilterColumns = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createGridColumnHelpers({

    applicantHistoryGridColumns,
    applicantRecruitmentGridColumns,
    applicantScheduleGridColumns,
    accountGridColumns,
    admitCardLookupGridColumns,

    printHistoryGridColumns,
  }) {
    function getGridColumns(gridKey) {
      let baseColumns = [];

      if (gridKey === "printHistoryGrid") {
        baseColumns = printHistoryGridColumns;
      } else if (gridKey === "accountManagementGrid") {
        baseColumns = accountGridColumns;
      } else if (gridKey === "applicantHistoryGrid") {
        baseColumns = applicantHistoryGridColumns;
      } else if (gridKey === "applicantRecruitmentGrid") {
        baseColumns = applicantRecruitmentGridColumns;
      } else if (gridKey === "applicantScheduleGrid") {
        baseColumns = applicantScheduleGridColumns;
      } else if (gridKey === "admitCardLookupGrid") {
        baseColumns = admitCardLookupGridColumns;
      }

      const allowFilters =
        gridKey === "printHistoryGrid" ||
        gridKey === "accountManagementGrid" ||
        gridKey === "applicantHistoryGrid" ||
        gridKey === "applicantRecruitmentGrid" ||
        gridKey === "applicantScheduleGrid";

      return baseColumns.map((column) => ({
        ...column,
        filterable: allowFilters ? column.filterable : false,
      }));
    }

    return Object.freeze({
      getGridColumns,
    });
  }

  return Object.freeze({
    createGridColumnHelpers,
  });
});
