(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardGridFilterState = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createGridFilterStateHelpers({
    closeAllPageSizeMenus,
    getBaseGridRows,
    getGridColumns,
    getSortedDistinctValues,
    getTableState,
    state,
  }) {
    function normalizeGridFilterSearchTerm(value) {
      return String(value ?? "").trim().toLocaleLowerCase("ko");
    }

    function filterGridFilterOptionValues(optionValues, searchTerm = "") {
      const normalizedSearchTerm = normalizeGridFilterSearchTerm(searchTerm);

      if (!normalizedSearchTerm) {
        return optionValues;
      }

      return optionValues.filter((value) =>
        String(value ?? "")
          .toLocaleLowerCase("ko")
          .includes(normalizedSearchTerm),
      );
    }

    function getGridFilterComparableValue(row, key) {
      if (key === "hasPhoto") {
        return row?.hasPhoto ? "등록" : "미등록";
      }

      return String(row?.[key] ?? "");
    }

    function applyGridFilters(rows, gridKey) {
      const tableState = getTableState(gridKey);
      const filterEntries = Object.entries(tableState.filters || {}).filter(([, values]) => Array.isArray(values));

      if (filterEntries.length === 0) {
        return rows;
      }

      return rows.filter((row) =>
        filterEntries.every(([key, values]) => values.includes(getGridFilterComparableValue(row, key))),
      );
    }

    function getGridFilterValues(gridKey, columnKey) {
      const tableState = getTableState(gridKey);
      return Array.isArray(tableState.filters[columnKey]) ? tableState.filters[columnKey] : [];
    }

    function getGridFilterSelectionState(gridKey, columnKey, optionValues = getGridFilterOptionValues(gridKey, columnKey)) {
      const tableState = getTableState(gridKey);
      const availableValues = optionValues.filter((value, index) => optionValues.indexOf(value) === index);
      const hasExplicitFilter = Object.prototype.hasOwnProperty.call(tableState.filters || {}, columnKey);
      const explicitValues = getGridFilterValues(gridKey, columnKey).filter((value) => availableValues.includes(value));
      const selectedValues = hasExplicitFilter ? explicitValues : availableValues;

      return {
        availableValues,
        selectedValues,
        selectedValueSet: new Set(selectedValues),
        hasExplicitFilter,
      };
    }

    function toggleGridFilterMenu(gridKey, columnKey) {
      const tableState = getTableState(gridKey);
      const shouldOpen = tableState.filterMenuKey !== columnKey;

      closeAllGridFilterMenus(gridKey, shouldOpen ? columnKey : "");
      closeAllPageSizeMenus();
      tableState.filterMenuKey = shouldOpen ? columnKey : "";
      tableState.filterMenuSearch = "";
    }

    function closeGridFilterMenu(gridKey, columnKey = "") {
      const tableState = getTableState(gridKey);

      if (!columnKey || tableState.filterMenuKey === columnKey) {
        tableState.filterMenuKey = "";
        tableState.filterMenuSearch = "";
      }
    }

    function closeAllGridFilterMenus(exceptGridKey = "", exceptColumnKey = "") {
      let changed = false;

      Object.entries(state.tableSettings).forEach(([gridKey, tableState]) => {
        const shouldKeepOpen = gridKey === exceptGridKey && tableState.filterMenuKey === exceptColumnKey;

        if (!shouldKeepOpen && tableState.filterMenuKey) {
          tableState.filterMenuKey = "";
          tableState.filterMenuSearch = "";
          changed = true;
        }
      });

      return changed;
    }

    function setGridFilterValues(gridKey, columnKey, values, optionValues = getGridFilterOptionValues(gridKey, columnKey)) {
      const tableState = getTableState(gridKey);
      const normalizedOptionValues = getSortedDistinctValues(optionValues);
      const nextValues = getSortedDistinctValues(values).filter((value) => normalizedOptionValues.includes(value));

      if (nextValues.length === normalizedOptionValues.length) {
        delete tableState.filters[columnKey];
      } else {
        tableState.filters[columnKey] = nextValues;
      }

      tableState.page = 1;
      closeAllPageSizeMenus();
    }

    function toggleGridFilterValue(gridKey, columnKey, value) {
      const optionValues = getGridFilterOptionValues(gridKey, columnKey);
      const selectionState = getGridFilterSelectionState(gridKey, columnKey, optionValues);
      const selectedValueSet = new Set(selectionState.selectedValues);

      if (selectedValueSet.has(value)) {
        selectedValueSet.delete(value);
      } else {
        selectedValueSet.add(value);
      }

      setGridFilterValues(gridKey, columnKey, Array.from(selectedValueSet), optionValues);
    }

    function clearGridFilter(gridKey, columnKey) {
      const tableState = getTableState(gridKey);
      delete tableState.filters[columnKey];
      tableState.page = 1;
      closeAllPageSizeMenus();
    }

    function clearAllGridFilters(gridKey) {
      const tableState = getTableState(gridKey);
      tableState.filters = {};
      tableState.filterMenuKey = "";
      tableState.filterMenuSearch = "";
      tableState.page = 1;
      closeAllPageSizeMenus();
    }

    function removeGridFilterValue(gridKey, columnKey, value) {
      const optionValues = getGridFilterOptionValues(gridKey, columnKey);
      const selectionState = getGridFilterSelectionState(gridKey, columnKey, optionValues);
      const nextValues = selectionState.selectedValues.filter((entry) => entry !== value);

      setGridFilterValues(gridKey, columnKey, nextValues, optionValues);
    }

    function hasGridFilter(gridKey, columnKey) {
      return Object.prototype.hasOwnProperty.call(getTableState(gridKey).filters || {}, columnKey);
    }

    function matchesGridTableFilters(row, filters, excludedKey = "") {
      return Object.entries(filters || {}).every(([key, values]) => {
        if (key === excludedKey || !Array.isArray(values)) {
          return true;
        }

        return values.includes(getGridFilterComparableValue(row, key));
      });
    }

    function getGridFilterOptionValues(gridKey, targetKey) {
      const remote = globalThis.AdmitCardRemoteGrids?.filterOptions(gridKey, targetKey);
      if (remote) return remote;
      const tableState = getTableState(gridKey);

      return getSortedDistinctValues(
        getBaseGridRows(gridKey)
          .filter((row) => matchesGridTableFilters(row, tableState.filters, targetKey))
          .map((row) => getGridFilterComparableValue(row, targetKey)),
      );
    }

    function getActiveGridFilters(gridKey) {
      const columnsByKey = Object.fromEntries(getGridColumns(gridKey).map((column) => [column.key, column]));
      const tableState = getTableState(gridKey);

      return Object.entries(tableState.filters || []).flatMap(([key, values]) => {
        if (!Array.isArray(values) || values.length === 0 || !columnsByKey[key]) {
          return [];
        }

        return values.map((value) => ({
          key,
          label: columnsByKey[key].label,
          value,
        }));
      });
    }

    return Object.freeze({
      applyGridFilters,
      clearAllGridFilters,
      clearGridFilter,
      closeAllGridFilterMenus,
      closeGridFilterMenu,
      filterGridFilterOptionValues,
      getActiveGridFilters,
      getGridFilterComparableValue,
      getGridFilterOptionValues,
      getGridFilterSelectionState,
      getGridFilterValues,
      hasGridFilter,
      matchesGridTableFilters,
      normalizeGridFilterSearchTerm,
      removeGridFilterValue,
      setGridFilterValues,
      toggleGridFilterMenu,
      toggleGridFilterValue,
    });
  }

  return Object.freeze({
    createGridFilterStateHelpers,
  });
});
