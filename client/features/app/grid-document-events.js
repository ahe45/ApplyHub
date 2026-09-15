(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory({
      actionsModule: require("./grid-document-events/actions"),
      inputsModule: require("./grid-document-events/inputs"),
      priorityModule: require("./grid-document-events/priority"),
    });
    return;
  }

  globalScope.AdmitCardGridDocumentEvents = factory({
    actionsModule: globalScope.AdmitCardGridDocumentActions,
    inputsModule: globalScope.AdmitCardGridDocumentInputs,
    priorityModule: globalScope.AdmitCardGridDocumentPriority,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, ({
  actionsModule,
  inputsModule,
  priorityModule,
}) => {

  if (!priorityModule?.createGridPriorityClickHandler) {
    throw new Error("client/features/app/grid-document-events/priority.js must be loaded before grid-document-events.js.");
  }

  if (!actionsModule?.createGridActionClickHandler) {
    throw new Error("client/features/app/grid-document-events/actions.js must be loaded before grid-document-events.js.");
  }

  if (!inputsModule?.createGridInputHandlers) {
    throw new Error("client/features/app/grid-document-events/inputs.js must be loaded before grid-document-events.js.");
  }

  const { createGridPriorityClickHandler } = priorityModule;
  const { createGridActionClickHandler } = actionsModule;
  const { createGridInputHandlers } = inputsModule;

  function createGridDocumentEventHandlers({
    batchPrintSelectedExaminees,
    clearAllGridFilters,
    clearGridFilter,
    clearHeaderFilters,
    clampPage,
    closeAllGridFilterMenus,
    closeAllHeaderCombos,
    closeAllPageSizeMenus,
    closeGridFilterMenu,
    createLookupFilters,

    downloadPrintHistoryGridWorkbook,
    filterGridFilterOptionValues,
    getGridFilterOptionValues,
    getGridFilterSelectionState,
    getGridPage,
    getGridRows,
    getHeaderComboElement,
    getTableState,
    getTotalPages,
    handleGridRowClickSelection,
    handleSelectableGridRowSelection,
    headerFilterFields,
    loadBootstrapData,
    lookupSelectFields,
    lookupTextFields,
    persistHeaderFilters,
    printExamineeAdmitCard,
    refreshAdmitCardLookupGrid,
    refreshGridFilterMenu,
    reconcileHeaderFilters,
    reconcileLookupFilters,
    removeGridFilterValue,
    renderView,
    rerenderGridInteraction,
    rerenderLookupViewInteraction,
    resetGridPages,
    setGridFilterValues,
    setHeaderComboOpen,
    state,
    toggleGridFilterMenu,
    toggleGridFilterValue,
    toggleGridRowSelection,
    toggleGridSelectAll,
    toggleGridSort,
    updateLookupTextFilter,

  }) {
    const handlePriorityClick = createGridPriorityClickHandler({
      clearHeaderFilters,
      closeAllHeaderCombos,
      getHeaderComboElement,
      setHeaderComboOpen,
    });

    const handleGridActionClick = createGridActionClickHandler({
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

    });

    const gridInputHandlers = createGridInputHandlers({
      createLookupFilters,
      filterGridFilterOptionValues,
      getGridFilterOptionValues,
      getGridFilterSelectionState,
      getTableState,
      handleSelectableGridRowSelection,
      headerFilterFields,
      lookupSelectFields,
      lookupTextFields,
      persistHeaderFilters,
      reconcileHeaderFilters,
      reconcileLookupFilters,
      refreshAdmitCardLookupGrid,
      refreshGridFilterMenu,
      renderView,
      rerenderGridInteraction,
      rerenderLookupViewInteraction,
      resetGridPages,
      setGridFilterValues,
      state,
      toggleGridRowSelection,
      toggleGridSelectAll,
      updateLookupTextFilter,
    });
    const {
      handleChange,
      handleCompositionEnd,
      handleCompositionStart,
      handleInput,
    } = gridInputHandlers;

    function handleTrailingClick(event) {
      const target = event.target instanceof Element ? event.target : null;
      const filterMenu = target?.closest(".table-filter-menu") || null;

      if (filterMenu) {
        return true;
      }

      closeAllHeaderCombos();
      const didCloseMenus = closeAllPageSizeMenus();
      const didCloseFilterMenus = closeAllGridFilterMenus();

      if (didCloseMenus || didCloseFilterMenus) {
        rerenderGridInteraction("admitCardLookupGrid");
      }

      return false;
    }

    function handleEscape() {
      return closeAllPageSizeMenus() || closeAllGridFilterMenus();
    }

    return Object.freeze({
      handleChange,
      handleCompositionEnd,
      handleCompositionStart,
      handleEscape,
      handleGridActionClick,
      handleInput,
      handlePriorityClick,
      handleTrailingClick,
    });
  }

  return Object.freeze({
    createGridDocumentEventHandlers,
  });
});
