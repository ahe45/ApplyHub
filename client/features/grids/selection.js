(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardGridSelection = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createGridSelectionController({
    getGridRows,
    getTableState,

    startApplicantRecruitmentUnitEdit,
    startApplicantScheduleEdit,
    state,
  }) {
    function normalizeGridRowId(rowId) {
      return String(rowId || "").trim();
    }

    function getGridRowId(gridKey, row) {
      if (gridKey === "accountManagementGrid") {
        return row.id || "";
      }

      if (gridKey === "printHistoryGrid") {
        return String(row.historyId || `${row.examineeNo}-${row.printedAt}`);
      }

      if (gridKey === "applicantScheduleGrid") {
        return String(row.scheduleKey || row.id || "");
      }

      if (gridKey === "applicantHistoryGrid" || gridKey === "applicantRecruitmentGrid") {
        return String(row.id || "");
      }
      return row.examineeNo || `${row.name}-${row.birth}-${row.date}`;
    }

    function getGridSelectableRowIds(gridKey) {
      if (globalThis.AdmitCardRemoteGrids?.supported(gridKey)) return globalThis.AdmitCardRemoteGrids.references(gridKey).map(row => getGridRowId(gridKey,row));
      return getGridRows(gridKey).map((row) => getGridRowId(gridKey, row));
    }

    function getGridSelectedRowIds(gridKey) {
      const tableState = getTableState(gridKey);
      return Array.isArray(tableState.selectedRowIds) ? tableState.selectedRowIds : [];
    }

    function getGridSelectedRowIdSet(gridKey) {
      return new Set(
        getGridSelectedRowIds(gridKey)
          .map((rowId) => normalizeGridRowId(rowId))
          .filter(Boolean),
      );
    }

    function getGridSelectionAnchorRowId(gridKey) {
      return normalizeGridRowId(getTableState(gridKey).selectionAnchorRowId);
    }

    function setGridSelectedRowIds(gridKey, rowIds, anchorRowId = "") {
      const tableState = getTableState(gridKey);
      const nextRowIds = [];
      const seenRowIds = new Set();

      if (Array.isArray(rowIds)) {
        rowIds.forEach((rowId) => {
          const normalizedRowId = normalizeGridRowId(rowId);

          if (!normalizedRowId || seenRowIds.has(normalizedRowId)) {
            return;
          }

          seenRowIds.add(normalizedRowId);
          nextRowIds.push(normalizedRowId);
        });
      }

      tableState.selectedRowIds = nextRowIds;
      tableState.selectionAnchorRowId =
        nextRowIds.length > 0 ? normalizeGridRowId(anchorRowId || nextRowIds[nextRowIds.length - 1] || "") : "";
    }

    function isGridRowSelected(gridKey, rowId) {
      return getGridSelectedRowIdSet(gridKey).has(normalizeGridRowId(rowId));
    }

    function usesSelectableGridRowSelection(gridKey) {
      return gridKey === "admitCardLookupGrid" || gridKey === "applicantHistoryGrid";
    }

    function isGridRowClickable(gridKey) {
      return (
        usesSelectableGridRowSelection(gridKey) ||
        gridKey === "applicantRecruitmentGrid" ||
        gridKey === "applicantScheduleGrid"
      );
    }

    function isGridRowHighlighted(gridKey, row, rowId = getGridRowId(gridKey, row)) {

      if (gridKey === "admitCardLookupGrid") {
        return isGridRowSelected(gridKey, rowId);
      }

      if (gridKey === "applicantHistoryGrid") {
        return (
          isGridRowSelected(gridKey, rowId) ||
          Number(state.applicantManager?.expandedSubmissionId || 0) === Number(row?.id || rowId || 0)
        );
      }

      if (gridKey === "applicantRecruitmentGrid") {
        return Number(state.applicantManager?.recruitmentUnitEditor?.editingId || 0) === Number(row?.id || rowId || 0);
      }

      if (gridKey === "applicantScheduleGrid") {
        return (
          isGridRowSelected(gridKey, rowId) ||
          String(state.applicantManager?.scheduleEditor?.scheduleKey || "").trim() === String(row?.scheduleKey || rowId || "").trim()
        );
      }

      return false;
    }

    function getGridSelectionState(gridKey, selectableRowIds) {
      const selectedRowIdSet = getGridSelectedRowIdSet(gridKey);
      const selectedVisibleCount = selectableRowIds.filter((rowId) => selectedRowIdSet.has(normalizeGridRowId(rowId))).length;
      const totalVisibleCount = selectableRowIds.length;

      return {
        allSelected: totalVisibleCount > 0 && selectedVisibleCount === totalVisibleCount,
        isIndeterminate: selectedVisibleCount > 0 && selectedVisibleCount < totalVisibleCount,
      };
    }

    function toggleGridSelectAll(gridKey) {
      const selectableRowIds = getGridSelectableRowIds(gridKey);
      const selectionState = getGridSelectionState(gridKey, selectableRowIds);
      const selectedRowIdSet = getGridSelectedRowIdSet(gridKey);

      if (selectionState.allSelected) {
        selectableRowIds.forEach((rowId) => selectedRowIdSet.delete(normalizeGridRowId(rowId)));
      } else {
        selectableRowIds.forEach((rowId) => selectedRowIdSet.add(normalizeGridRowId(rowId)));
      }

      setGridSelectedRowIds(
        gridKey,
        Array.from(selectedRowIdSet),
        selectionState.allSelected ? "" : selectableRowIds[0] || getGridSelectionAnchorRowId(gridKey),
      );
    }

    function toggleGridRowSelection(gridKey, rowId) {
      const normalizedRowId = normalizeGridRowId(rowId);

      if (!normalizedRowId) {
        return;
      }

      const selectedRowIdSet = getGridSelectedRowIdSet(gridKey);

      if (selectedRowIdSet.has(normalizedRowId)) {
        selectedRowIdSet.delete(normalizedRowId);
      } else {
        selectedRowIdSet.add(normalizedRowId);
      }

      setGridSelectedRowIds(gridKey, Array.from(selectedRowIdSet), normalizedRowId);
    }

    function handleSelectableGridRowSelection(gridKey, rowId, { shiftKey = false, ctrlKey = false, metaKey = false } = {}) {
      const normalizedGridKey = String(gridKey || "").trim();
      const normalizedRowId = String(rowId || "").trim();

      if (!normalizedRowId) {
        return;
      }

      if (!usesSelectableGridRowSelection(normalizedGridKey)) {
        toggleGridRowSelection(normalizedGridKey, normalizedRowId);
        return;
      }

      const selectableRowIds = getGridSelectableRowIds(normalizedGridKey);
      const targetIndex = selectableRowIds.indexOf(normalizedRowId);

      if (targetIndex < 0) {
        return;
      }

      const useRangeSelection = shiftKey && selectableRowIds.length > 0;
      const useToggleSelection = ctrlKey || metaKey;

      if (useRangeSelection) {
        const anchorRowId = getGridSelectionAnchorRowId(normalizedGridKey) || normalizedRowId;
        const anchorIndex = selectableRowIds.indexOf(anchorRowId);
        const rangeStartIndex = Math.min(anchorIndex >= 0 ? anchorIndex : targetIndex, targetIndex);
        const rangeEndIndex = Math.max(anchorIndex >= 0 ? anchorIndex : targetIndex, targetIndex);
        const rangeRowIds = selectableRowIds.slice(rangeStartIndex, rangeEndIndex + 1);

        if (useToggleSelection) {
          const selectedRowIdSet = new Set(getGridSelectedRowIds(normalizedGridKey));
          rangeRowIds.forEach((entryRowId) => selectedRowIdSet.add(entryRowId));
          setGridSelectedRowIds(normalizedGridKey, Array.from(selectedRowIdSet), normalizedRowId);
          return;
        }

        setGridSelectedRowIds(normalizedGridKey, rangeRowIds, normalizedRowId);
        return;
      }

      if (useToggleSelection) {
        toggleGridRowSelection(normalizedGridKey, normalizedRowId);
        return;
      }

      if (isGridRowSelected(normalizedGridKey, normalizedRowId)) {
        toggleGridRowSelection(normalizedGridKey, normalizedRowId);
        return;
      }

      setGridSelectedRowIds(normalizedGridKey, [normalizedRowId], normalizedRowId);
    }

    function handleAdmitCardLookupRowSelection(rowId, { shiftKey = false, ctrlKey = false, metaKey = false } = {}) {
      handleSelectableGridRowSelection("admitCardLookupGrid", rowId, { shiftKey, ctrlKey, metaKey });
    }

    function handleGridRowClickSelection(gridKey, rowId, options = {}) {

      if (usesSelectableGridRowSelection(gridKey)) {
        handleSelectableGridRowSelection(gridKey, rowId, options);
        return true;
      }

      if (gridKey === "applicantRecruitmentGrid") {
        startApplicantRecruitmentUnitEdit(rowId);
        return false;
      }

      if (gridKey === "applicantScheduleGrid") {
        startApplicantScheduleEdit(rowId);
        return false;
      }

      return false;
    }

    return Object.freeze({
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
    });
  }

  return Object.freeze({
    createGridSelectionController,
  });
});
