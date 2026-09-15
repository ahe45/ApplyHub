(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardGridRuntime = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const gridRenderingModule = globalThis.AdmitCardGridRendering;
  const gridStateModule = globalThis.AdmitCardGridState;
  const gridTableUiModule = globalThis.AdmitCardGridTableUi;

  if (!gridRenderingModule?.createGridRenderingController) {
    throw new Error("client/features/grids/rendering.js must be loaded before client/features/grids/runtime.js.");
  }

  if (!gridStateModule?.createGridStateController) {
    throw new Error("client/features/grids/state.js must be loaded before client/features/grids/runtime.js.");
  }

  if (!gridTableUiModule?.createGridTableUiController) {
    throw new Error("client/features/grids/table-ui.js must be loaded before client/features/grids/runtime.js.");
  }

  const { createGridRenderingController } = gridRenderingModule;
  const { createGridStateController } = gridStateModule;
  const { createGridTableUiController } = gridTableUiModule;

  function createGridRuntimeController({

    applicantHistoryGridColumns,
    applicantRecruitmentGridColumns,
    applicantScheduleGridColumns,
    accountGridColumns,
    admitCardLookupGridColumns,
    createTableState,
    escapeAttribute,
    escapeHtml,

    getApplicantStatusLabel,
    getAccountGridRows,
    getExamineeGridRows,
    getPrintHistoryRows,
    getSelectedAdmitCardExamineeCount,
    headerFilterFields,
    lookupSelectKeys,
    normalizeGridSortRules,

    printHistoryGridColumns,
    renderAccountRoleOptions,
    renderView,

    startApplicantRecruitmentUnitEdit,
    startApplicantScheduleEdit,
    state,
  }) {
    let gridStateController = null;

    const gridRenderingController = createGridRenderingController({
      escapeAttribute,
      escapeHtml,
      getExamineeGridRows,
      getPrintHistoryRows,
      getTableState: (...args) => gridStateController?.getTableState(...args),
      headerFilterFields,
      lookupSelectKeys,
      renderView,
      state,
    });
    const gridStateMethods = createGridStateController({

      applicantHistoryGridColumns,
      applicantRecruitmentGridColumns,
      applicantScheduleGridColumns,
      accountGridColumns,
      admitCardLookupGridColumns,
      createTableState,

      getApplicantStatusLabel,
      getAccountGridRows,
      getExamineeGridRows,
      getFilteredLookupRows: (...args) => gridRenderingController.getFilteredLookupRows(...args),
      getHeaderFilteredRows: (...args) => gridRenderingController.getHeaderFilteredRows(...args),
      getPrintHistoryRows,
      normalizeGridSortRules,

      printHistoryGridColumns,

      startApplicantRecruitmentUnitEdit,
      startApplicantScheduleEdit,
      state,
    });
    const gridTableUiController = createGridTableUiController({
      escapeAttribute,
      escapeHtml,
      filterGridFilterOptionValues: (...args) => gridStateMethods.filterGridFilterOptionValues(...args),
      getActiveGridFilters: (...args) => gridStateMethods.getActiveGridFilters(...args),
      getActiveGridSortRules: (...args) => gridStateMethods.getActiveGridSortRules(...args),
      getGridColumns: (...args) => gridStateMethods.getGridColumns(...args),
      getGridFilterOptionValues: (...args) => gridStateMethods.getGridFilterOptionValues(...args),
      getGridFilterSelectionState: (...args) => gridStateMethods.getGridFilterSelectionState(...args),
      getGridPage: (...args) => gridStateMethods.getGridPage(...args),
      getGridRowId: (...args) => gridStateMethods.getGridRowId(...args),
      getGridRows: (...args) => gridStateMethods.getGridRows(...args),
      getGridSelectableRowIds: (...args) => gridStateMethods.getGridSelectableRowIds(...args),
      getGridSelectionState: (...args) => gridStateMethods.getGridSelectionState(...args),
      getSelectedAdmitCardExamineeCount,
      getTableState: (...args) => gridStateMethods.getTableState(...args),
      getTotalPages: (...args) => gridStateMethods.getTotalPages(...args),
      getVisiblePageNumbers: (...args) => gridStateMethods.getVisiblePageNumbers(...args),
      hasGridFilter: (...args) => gridStateMethods.hasGridFilter(...args),
      isGridRowClickable: (...args) => gridStateMethods.isGridRowClickable(...args),
      isGridRowHighlighted: (...args) => gridStateMethods.isGridRowHighlighted(...args),
      isGridRowSelected: (...args) => gridStateMethods.isGridRowSelected(...args),
      renderAccountRoleOptions,
      state,
    });

    gridStateController = gridStateMethods;

    return Object.freeze({
      ...gridRenderingController,
      ...gridStateMethods,
      ...gridTableUiController,
    });
  }

  return Object.freeze({
    createGridRuntimeController,
  });
});
