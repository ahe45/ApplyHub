(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardGridState = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const gridFilteringModule = globalThis.AdmitCardGridFiltering;
  const gridSelectionModule = globalThis.AdmitCardGridSelection;
  const gridTableSettingsModule = globalThis.AdmitCardGridTableSettings;

  if (!gridFilteringModule?.createGridFilteringController) {
    throw new Error("client/features/grids/filtering.js must be loaded before client/features/grids/state.js.");
  }

  if (!gridSelectionModule?.createGridSelectionController) {
    throw new Error("client/features/grids/selection.js must be loaded before client/features/grids/state.js.");
  }

  if (!gridTableSettingsModule?.createGridTableSettingsController) {
    throw new Error("client/features/grids/table-settings.js must be loaded before client/features/grids/state.js.");
  }

  const { createGridFilteringController } = gridFilteringModule;
  const { createGridSelectionController } = gridSelectionModule;
  const { createGridTableSettingsController } = gridTableSettingsModule;

  function createGridStateController(deps) {
    const {

      applicantHistoryGridColumns,
      applicantRecruitmentGridColumns,
      applicantScheduleGridColumns,
      accountGridColumns,
      admitCardLookupGridColumns,
      createTableState,

      getApplicantStatusLabel,
      getAccountGridRows,
      getExamineeGridRows,
      getFilteredLookupRows,
      getHeaderFilteredRows,
      normalizeGridSortRules,

      getPrintHistoryRows,
      printHistoryGridColumns,

      startApplicantRecruitmentUnitEdit,
      startApplicantScheduleEdit,
      state,
    } = deps;

    const gridTableSettingsController = createGridTableSettingsController({
      createTableState,
      normalizeGridSortRules,
      state,
    });
    const {
      clampPage,
      closeAllPageSizeMenus,
      getGridPage,
      getTableState,
      getTotalPages,
      getVisiblePageNumbers,
    } = gridTableSettingsController;

    const gridFilteringController = createGridFilteringController({

      applicantHistoryGridColumns,
      applicantRecruitmentGridColumns,
      applicantScheduleGridColumns,
      accountGridColumns,
      admitCardLookupGridColumns,
      closeAllPageSizeMenus,

      getApplicantStatusLabel,
      getAccountGridRows,
      getExamineeGridRows,
      getFilteredLookupRows,
      getHeaderFilteredRows,
      getPrintHistoryRows,
      getTableState,
      printHistoryGridColumns,
      state,
    });
    const {
      applyGridFilters,
      applyGridSort,
      clearAllGridFilters,
      clearGridFilter,
      closeAllGridFilterMenus,
      closeGridFilterMenu,
      compareGridValues,
      filterGridFilterOptionValues,
      getActiveGridFilters,
      getActiveGridSortRules,
      getBaseGridRows,
      getGridColumns,
      getGridFilterComparableValue,
      getGridFilterOptionValues,
      getGridFilterSelectionState,
      getGridFilterValues,
      getGridRows,
      getPrintHistorySummaryExamineeRows,
      getSortedDistinctValues,
      hasGridFilter,
      matchesGridTableFilters,
      normalizeGridFilterSearchTerm,
      removeGridFilterValue,
      setGridFilterValues,
      toggleGridFilterMenu,
      toggleGridFilterValue,
      toggleGridSort,
    } = gridFilteringController;

    const gridSelectionController = createGridSelectionController({
      getGridRows,
      getTableState,

      startApplicantRecruitmentUnitEdit,
      startApplicantScheduleEdit,
      state,
    });
    const {
      getGridRowId,
      getGridSelectableRowIds,
      getGridSelectedRowIds,
      getGridSelectionAnchorRowId,
      getGridSelectionState,
      handleAdmitCardLookupRowSelection,
      handleSelectableGridRowSelection,
      handleGridRowClickSelection,
      isGridRowClickable,
      isGridRowHighlighted,
      isGridRowSelected,
      setGridSelectedRowIds,
      toggleGridRowSelection,
      toggleGridSelectAll,
    } = gridSelectionController;

    return Object.freeze({
      applyGridFilters,
      applyGridSort,
      clampPage,
      clearAllGridFilters,
      clearGridFilter,
      closeAllGridFilterMenus,
      closeAllPageSizeMenus,
      closeGridFilterMenu,
      compareGridValues,
      filterGridFilterOptionValues,
      getActiveGridFilters,
      getActiveGridSortRules,
      getBaseGridRows,
      getGridColumns,
      getGridFilterComparableValue,
      getGridFilterOptionValues,
      getGridFilterSelectionState,
      getGridFilterValues,
      getGridPage,
      getGridRowId,
      getGridRows,
      getGridSelectableRowIds,
      getGridSelectedRowIds,
      getGridSelectionAnchorRowId,
      getGridSelectionState,
      getPrintHistorySummaryExamineeRows,
      getSortedDistinctValues,
      getTableState,
      getTotalPages,
      getVisiblePageNumbers,
      handleAdmitCardLookupRowSelection,
      handleSelectableGridRowSelection,
      handleGridRowClickSelection,
      hasGridFilter,
      isGridRowClickable,
      isGridRowHighlighted,
      isGridRowSelected,
      matchesGridTableFilters,
      normalizeGridFilterSearchTerm,
      removeGridFilterValue,
      setGridFilterValues,
      setGridSelectedRowIds,
      toggleGridFilterMenu,
      toggleGridFilterValue,
      toggleGridRowSelection,
      toggleGridSelectAll,
      toggleGridSort,
    });
  }

  return Object.freeze({
    createGridStateController,
  });
});
