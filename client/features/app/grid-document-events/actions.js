(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardGridDocumentActions = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createGridActionClickHandler({
    batchPrintSelectedExaminees,
    clearAllGridFilters,
    clearGridFilter,
    clampPage,
    closeAllGridFilterMenus,
    closeAllPageSizeMenus,
    closeGridFilterMenu,
    createLookupFilters,

    downloadPrintHistoryGridWorkbook,
    getGridPage,
    getGridRows,
    getTableState,
    getTotalPages,
    handleGridRowClickSelection,
    loadBootstrapData,
    printExamineeAdmitCard,
    removeGridFilterValue,
    rerenderGridInteraction,
    rerenderLookupViewInteraction,
    state,
    toggleGridFilterMenu,
    toggleGridFilterValue,
    toggleGridSort,

  }) {
    return async function handleGridActionClick(event) {
      const target = event.target instanceof Element ? event.target : null;

      const downloadPrintHistoryTrigger = target?.closest("[data-download-print-history]") || null;

      const batchPrintTrigger = target?.closest("[data-batch-print]") || null;
      const examineePrintTrigger = target?.closest("[data-print-examinee]") || null;
      const gridRowTrigger = target?.closest("[data-grid-row-clickable]") || null;
      const pageSizeTrigger = target?.closest("[data-page-size-trigger]") || null;
      const pageSizeOption = target?.closest("[data-page-size-option]") || null;
      const pageTrigger = target?.closest("[data-grid-page], [data-grid-nav]") || null;
      const sortTrigger = target?.closest("[data-grid-sort]") || null;
      const filterTrigger = target?.closest("[data-grid-filter]") || null;
      const filterOptionTrigger = target?.closest("[data-grid-filter-option]") || null;
      const filterClearTrigger = target?.closest("[data-grid-filter-clear]") || null;
      const filterCloseTrigger = target?.closest("[data-grid-filter-close]") || null;
      const filterChipTrigger = target?.closest("[data-grid-filter-chip]") || null;
      const filterClearAllTrigger = target?.closest("[data-grid-filter-clear-all]") || null;
      const lookupResetTrigger = target?.closest("[data-reset-lookup]") || null;
      const refreshTrigger = target?.closest("[data-refresh-grid]") || null;



      if (downloadPrintHistoryTrigger) {
        await downloadPrintHistoryGridWorkbook();
        return true;
      }



      if (batchPrintTrigger) {
        await batchPrintSelectedExaminees();
        return true;
      }

      if (examineePrintTrigger) {
        await printExamineeAdmitCard(examineePrintTrigger.dataset.printExaminee);
        return true;
      }

      if (gridRowTrigger) {
        closeAllPageSizeMenus();
        closeAllGridFilterMenus();

        if (
          handleGridRowClickSelection(gridRowTrigger.dataset.gridKey, gridRowTrigger.dataset.gridRowId, {
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
          })
        ) {
          rerenderGridInteraction(gridRowTrigger.dataset.gridKey);
        }

        return true;
      }

      if (pageSizeTrigger) {
        const tableState = getTableState(pageSizeTrigger.dataset.gridKey);
        const nextOpen = !tableState.pageSizeMenuOpen;

        closeAllPageSizeMenus(nextOpen ? pageSizeTrigger.dataset.gridKey : "");
        closeAllGridFilterMenus();
        tableState.pageSizeMenuOpen = nextOpen;
        rerenderGridInteraction(pageSizeTrigger.dataset.gridKey);
        return true;
      }

      if (pageSizeOption) {
        const tableState = getTableState(pageSizeOption.dataset.gridKey);
        const nextPageSize = Number(pageSizeOption.dataset.pageSizeOption);
        tableState.pageSize = Number.isFinite(nextPageSize) ? nextPageSize : 10;
        tableState.page = 1;
        tableState.pageSizeMenuOpen = false;
        closeAllPageSizeMenus(pageSizeOption.dataset.gridKey);
        closeAllGridFilterMenus();
        rerenderGridInteraction(pageSizeOption.dataset.gridKey);
        return true;
      }

      if (pageTrigger) {
        const tableState = getTableState(pageTrigger.dataset.gridKey);
        const totalPages = getTotalPages(getGridRows(pageTrigger.dataset.gridKey).length, tableState.pageSize);
        const currentPage = getGridPage(pageTrigger.dataset.gridKey, totalPages);

        if (pageTrigger.dataset.gridNav === "prev") {
          tableState.page = Math.max(1, currentPage - 1);
        }

        if (pageTrigger.dataset.gridNav === "next") {
          tableState.page = Math.min(totalPages, currentPage + 1);
        }

        if (pageTrigger.dataset.gridPage) {
          tableState.page = clampPage(pageTrigger.dataset.gridPage, totalPages);
        }

        tableState.pageSizeMenuOpen = false;
        closeAllGridFilterMenus();
        rerenderGridInteraction(pageTrigger.dataset.gridKey);
        return true;
      }

      if (sortTrigger) {
        toggleGridSort(sortTrigger.dataset.gridKey, sortTrigger.dataset.gridSort);
        rerenderGridInteraction(sortTrigger.dataset.gridKey);
        return true;
      }

      if (filterTrigger) {
        toggleGridFilterMenu(filterTrigger.dataset.gridKey, filterTrigger.dataset.gridFilter);
        rerenderGridInteraction(filterTrigger.dataset.gridKey);
        return true;
      }

      if (filterOptionTrigger) {
        toggleGridFilterValue(
          filterOptionTrigger.dataset.gridKey,
          filterOptionTrigger.dataset.gridFilterOption,
          filterOptionTrigger.dataset.gridFilterValue,
        );
        rerenderGridInteraction(filterOptionTrigger.dataset.gridKey);
        return true;
      }

      if (filterClearTrigger) {
        clearGridFilter(filterClearTrigger.dataset.gridKey, filterClearTrigger.dataset.gridFilterClear);
        rerenderGridInteraction(filterClearTrigger.dataset.gridKey);
        return true;
      }

      if (filterCloseTrigger) {
        closeGridFilterMenu(filterCloseTrigger.dataset.gridKey, filterCloseTrigger.dataset.gridFilterClose);
        rerenderGridInteraction(filterCloseTrigger.dataset.gridKey);
        return true;
      }

      if (filterChipTrigger) {
        removeGridFilterValue(
          filterChipTrigger.dataset.gridKey,
          filterChipTrigger.dataset.gridFilterChip,
          filterChipTrigger.dataset.gridFilterValue,
        );
        rerenderGridInteraction(filterChipTrigger.dataset.gridKey);
        return true;
      }

      if (filterClearAllTrigger) {
        clearAllGridFilters(filterClearAllTrigger.dataset.gridKey);
        rerenderGridInteraction(filterClearAllTrigger.dataset.gridKey);
        return true;
      }

      if (lookupResetTrigger) {
        state.lookupFilters = createLookupFilters();
        getTableState("admitCardLookupGrid").page = 1;
        rerenderLookupViewInteraction();
        return true;
      }

      if (refreshTrigger) {
        const tableState = getTableState(refreshTrigger.dataset.refreshGrid);
        tableState.page = 1;
        tableState.pageSizeMenuOpen = false;
        await loadBootstrapData({ showLoading: false });
        return true;
      }

      return false;
    };
  }

  return Object.freeze({
    createGridActionClickHandler,
  });
});
