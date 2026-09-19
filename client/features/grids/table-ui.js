(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardGridTableUi = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const gridFilterMenuModule = globalThis.AdmitCardGridFilterMenu;
  const gridTableCellsModule = globalThis.AdmitCardGridTableCells;
  const gridTableControlsModule = globalThis.AdmitCardGridTableControls;

  if (!gridFilterMenuModule?.createGridFilterMenuController) {
    throw new Error("client/features/grids/filter-menu.js must be loaded before client/features/grids/table-ui.js.");
  }

  if (!gridTableCellsModule?.createGridTableCellsController) {
    throw new Error("client/features/grids/table-cells.js must be loaded before client/features/grids/table-ui.js.");
  }

  if (!gridTableControlsModule?.createGridTableControlController) {
    throw new Error("client/features/grids/table-controls.js must be loaded before client/features/grids/table-ui.js.");
  }

  const { createGridFilterMenuController } = gridFilterMenuModule;
  const { createGridTableCellsController } = gridTableCellsModule;
  const { createGridTableControlController } = gridTableControlsModule;

  function createGridTableUiController(deps) {
    const {
      escapeAttribute,
      escapeHtml,
      filterGridFilterOptionValues,
      getActiveGridFilters,
      getActiveGridSortRules,
      getGridColumns,
      getGridFilterOptionValues,
      getGridFilterSelectionState,
      getGridPage,
      getGridRowId,
      getGridRows,
      getGridSelectableRowIds,
      getGridSelectionState,
      getSelectedAdmitCardExamineeCount,
      getTableState,
      getTotalPages,
      getVisiblePageNumbers,
      hasGridFilter,
      isGridRowClickable,
      isGridRowHighlighted,
      renderAccountRoleOptions,
      state,
    } = deps;

    const gridFilterMenuController = createGridFilterMenuController({
      escapeAttribute,
      escapeHtml,
      filterGridFilterOptionValues,
      getActiveGridSortRules,
      getGridColumns,
      getGridFilterOptionValues,
      getGridFilterSelectionState,
      getTableState,
      hasGridFilter,
    });
    const {
      refreshGridFilterMenu,
      renderActiveGridFilterMenu,
      renderTableHeaderCell,
      syncGridFilterMenuIndicators,
      syncOpenGridFilterMenuPosition,
    } = gridFilterMenuController;

    const gridTableCellsController = createGridTableCellsController({
      escapeAttribute,
      escapeHtml,
      renderAccountRoleOptions,
      state,
    });
    const { renderTableCell } = gridTableCellsController;
    const gridTableControlController = createGridTableControlController({
      escapeAttribute,
      escapeHtml,
      getActiveGridFilters,
      getGridRowId,
      getSelectedAdmitCardExamineeCount,
      isGridRowSelected: deps.isGridRowSelected,
      state,
    });
    const {
      renderBatchPrintButton,
      renderGridHeaderActions,
      renderGridPagination,
      renderLeadingGridCells,
      renderLeadingGridHeaders,
      renderTableFilterStrip,

    } = gridTableControlController;

    function renderExamineeResultTable({
      title,
      description = "",
      gridKey,
      showPrintColumn,
      headerActionsMarkup = "",
      headerLeadingMarkup = "",
      showSectionHeader = true,
      selectable = true,
      showRowNumber = false,
      checkboxFirst = false,
      emptyMessage = "데이터가 없습니다.",
    }) {
      const columns = getGridColumns(gridKey);
      const rows = getGridRows(gridKey);
      const tableState = getTableState(gridKey);
      const remote = globalThis.AdmitCardRemoteGrids?.meta(gridKey);
      const totalRows = remote ? remote.total : rows.length;
      const totalPages = getTotalPages(totalRows, tableState.pageSize);
      const currentPage = getGridPage(gridKey, totalPages);
      const pageSize = Number(tableState.pageSize || 0);
      const startIndex = pageSize > 0 ? (currentPage - 1) * pageSize : 0;
      const visibleRows = remote ? rows : pageSize > 0 ? rows.slice(startIndex, startIndex + pageSize) : rows;
      const selectableRowIds = selectable ? getGridSelectableRowIds(gridKey) : [];
      const selectionState = getGridSelectionState(gridKey, selectableRowIds);
      const visiblePageNumbers = getVisiblePageNumbers(totalPages, currentPage);
      const startRowNumber = totalRows === 0 ? 0 : startIndex + 1;
      const endRowNumber = totalRows === 0 ? 0 : startIndex + visibleRows.length;
      const totalColumnCount = (showRowNumber ? 1 : 0) + (selectable ? 1 : 0) + columns.length + (showPrintColumn ? 1 : 0);
      const cardClasses = ["table-card", "result-grid-card"];
      const tbodyClassNames = ["table-body", visibleRows.length === 0 ? "is-empty" : ""].filter(Boolean).join(" ");
      const tableWrapClassNames = ["table-wrap", visibleRows.length === 0 ? "is-empty" : ""].filter(Boolean).join(" ");

      if (showPrintColumn) {
        cardClasses.push("has-print-column");
      }

      if (visibleRows.length === 0) {
        cardClasses.push("is-empty-grid");
      }

      if (["applicantHistoryGrid", "applicantRecruitmentGrid", "applicantScheduleGrid"].includes(gridKey)) {
        cardClasses.push("applicant-admin-grid-card");
      }

      if (gridKey === "admitCardLookupGrid") {
        cardClasses.push("admit-card-lookup-table");
      }

      if (gridKey === "printHistoryGrid") {
        cardClasses.push("print-history-table");
      }

      if (gridKey === "accountManagementGrid") {
        cardClasses.push("account-management-table");
      }

      const resolvedHeaderLeadingMarkup =
        typeof headerLeadingMarkup === "string" && headerLeadingMarkup.trim()
          ? headerLeadingMarkup
          : title
            ? `
                <div class="menu-section-copy">
                  <h3>${title}</h3>
                  ${description ? `<p>${escapeHtml(description)}</p>` : ""}
                </div>
              `
            : "<div></div>";

      return `
        <article class="${cardClasses.join(" ")}">
          ${
            showSectionHeader
              ? `
                <div class="section-header">
                  ${resolvedHeaderLeadingMarkup}
                  <div class="inline-actions table-header-actions">
                    ${headerActionsMarkup}
                  </div>
                </div>
              `
              : ""
          }
          ${renderTableFilterStrip(gridKey)}
          <div class="${tableWrapClassNames}">
            <table>
              <thead>
                <tr>
                  ${renderLeadingGridHeaders({ gridKey, selectable, showRowNumber, checkboxFirst, selectionState })}
                  ${columns.map((column) => renderTableHeaderCell(gridKey, column)).join("")}
                  ${showPrintColumn ? "<th>인쇄</th>" : ""}
                </tr>
              </thead>
              <tbody class="${tbodyClassNames}">
                ${
                  visibleRows.length === 0
                    ? `<tr class="table-empty-row">
                        <td class="table-empty-cell" colspan="${totalColumnCount}">${emptyMessage}</td>
                      </tr>`
                    : visibleRows
                        .map((row, rowIndex) => {
                          const rowId = getGridRowId(gridKey, row);
                          const rowClickable = isGridRowClickable(gridKey);
                          const rowHighlighted = isGridRowHighlighted(gridKey, row, rowId);
                          const rowClassNames = [
                            rowClickable ? "is-clickable" : "",
                            rowHighlighted ? "is-selected" : "",
                          ]
                            .filter(Boolean)
                            .join(" ");

                          return `
                            <tr
                              class="${rowClassNames}"
                              ${rowClickable ? `data-grid-row-clickable="true" data-grid-key="${gridKey}" data-grid-row-id="${escapeAttribute(rowId)}"` : ""}
                              ${rowClickable ? `aria-selected="${rowHighlighted ? "true" : "false"}"` : ""}
                            >
                              ${renderLeadingGridCells({
                                gridKey,
                                selectable,
                                showRowNumber,
                                checkboxFirst,
                                rowIndex: startIndex + rowIndex + 1,
                                row,
                              })}
                              ${columns.map((column) => renderTableCell(gridKey, column, row)).join("")}
                              ${
                                showPrintColumn
                                  ? `<td>
                                      <button
                                        class="row-action"
                                        data-print-examinee="${escapeAttribute(row.examineeNo)}"
                                        type="button"
                                        aria-label="${escapeAttribute(row.name)} 수험표 인쇄"
                                      >
                                        <svg class="row-action-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                          <path d="M7 8V4.5h10V8"></path>
                                          <path d="M6 18H5a2 2 0 0 1-2-2v-5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v5a2 2 0 0 1-2 2h-1"></path>
                                          <path d="M7 14h10v5.5H7z"></path>
                                          <path d="M16 11.5h2"></path>
                                        </svg>
                                      </button>
                                    </td>`
                                  : ""
                              }
                            </tr>
                          `;
                        })
                        .join("")
                }
              </tbody>
            </table>
          </div>
          ${renderGridPagination({ currentPage, endRowNumber, gridKey, startRowNumber, tableState, totalPages, totalRows, visiblePageNumbers })}
        </article>
        ${renderActiveGridFilterMenu(gridKey)}
      `;
    }

    function syncGridSelectionIndicators() {
      gridTableControlController.syncGridSelectionIndicators(syncGridFilterMenuIndicators);
    }

    return Object.freeze({
      refreshGridFilterMenu,
      renderBatchPrintButton,
      renderExamineeResultTable,
      renderGridHeaderActions,

      syncGridSelectionIndicators,
      syncOpenGridFilterMenuPosition,
    });
  }

  return Object.freeze({
    createGridTableUiController,
  });
});
