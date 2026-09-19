(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardGridRendering = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createGridRenderingController(deps) {
    const {
      accountGridColumns,
      createTableState,
      escapeAttribute,
      escapeHtml,

      getAccountGridRows,
      getExamineeGridRows,
      getPrintHistoryRows,
      getSelectedAdmitCardExamineeCount,
      getTableState,
      headerFilterFields,
      lookupSelectKeys,
      normalizeGridSortRules,

      printHistoryGridColumns,
      renderAccountRoleOptions,
      renderAdmitCardLookup,
      renderAdmitCardLookupGridSection,
      renderView,
      admitCardLookupGridColumns,
      state,
    } = deps;

    let headerComboMeasureContext = null;

    function getHeaderOptionValues(targetKey) {
      const remote = globalThis.AdmitCardRemoteGrids?.headerOptions(targetKey);
      if (remote) return remote;
      return getOrderedValues(getHeaderFilteredRows(getExamineeGridRows(), targetKey).map((row) => row[targetKey]));
    }

    function matchesHeaderFilters(row, excludedKey = "") {
      return Object.entries(state.headerFilters).every(([key, value]) => {
        if (!value || key === excludedKey) {
          return true;
        }

        return row[key] === value;
      });
    }

    function getHeaderFilteredRows(rows, excludedKey = "") {
      return rows.filter((row) => matchesHeaderFilters(row, excludedKey));
    }

    function reconcileHeaderFilters() {
      let changed = false;

      do {
        changed = false;

        Object.keys(state.headerFilters).forEach((key) => {
          const currentValue = state.headerFilters[key];

          if (currentValue && !getHeaderOptionValues(key).includes(currentValue)) {
            state.headerFilters[key] = "";
            changed = true;
          }
        });
      } while (changed);
    }

    function syncHeaderSelectOptions() {
      headerFilterFields.forEach(({ id, key }) => {
        const selectElement = document.getElementById(id);

        if (!selectElement) {
          return;
        }

        syncSelectElementOptions(selectElement, getHeaderOptionValues(key), state.headerFilters[key]);
        syncHeaderCombo(selectElement);
      });
    }

    function getLookupOptionMap() {
      return lookupSelectKeys.reduce((optionMap, key) => {
        optionMap[key] = getLookupOptionValues(key);
        return optionMap;
      }, {});
    }

    function getLookupOptionValues(targetKey) {
      const remote = globalThis.AdmitCardRemoteGrids?.headerOptions(targetKey);
      if (remote) return remote;
      const selectFilters = getLookupSelectFilters();

      return getOrderedValues(
        getHeaderFilteredRows(getExamineeGridRows())
          .filter((row) => matchesLookupFilters(row, selectFilters, targetKey))
          .map((row) => row[targetKey]),
      );
    }

    function getFilteredLookupRows() {
      return getHeaderFilteredRows(getExamineeGridRows()).filter((row) => matchesLookupFilters(row, state.lookupFilters));
    }

    function getLookupSelectFilters() {
      return lookupSelectKeys.reduce((filters, key) => {
        filters[key] = state.lookupFilters[key];
        return filters;
      }, {});
    }

    function matchesLookupFilters(row, filters, excludedKey = "") {
      return Object.entries(filters).every(([key, value]) => {
        if (!value || key === excludedKey) {
          return true;
        }

        if (key === "examineeNo") {
          return row.examineeNo.includes(value.trim());
        }

        if (key === "examineeName") {
          return row.name.includes(value.trim());
        }

        return row[key] === value;
      });
    }

    function reconcileLookupFilters() {
      let changed = false;

      do {
        changed = false;

        lookupSelectKeys.forEach((key) => {
          const currentValue = state.lookupFilters[key];

          if (currentValue && !getLookupOptionValues(key).includes(currentValue)) {
            state.lookupFilters[key] = "";
            changed = true;
          }
        });
      } while (changed);
    }

    function updateLookupTextFilter(key, value) {
      state.lookupFilters[key] = value;
      reconcileLookupFilters();
      getTableState("admitCardLookupGrid").page = 1;
    }

    function rerenderWithFocus(activeElement) {
      const selectionStart =
        typeof activeElement.selectionStart === "number" ? activeElement.selectionStart : null;
      const selectionEnd = typeof activeElement.selectionEnd === "number" ? activeElement.selectionEnd : null;
      const targetId = activeElement.id;

      renderView();

      if (!targetId) {
        return;
      }

      const nextElement = document.getElementById(targetId);

      if (!nextElement) {
        return;
      }

      nextElement.focus();

      if (selectionStart !== null && selectionEnd !== null) {
        nextElement.setSelectionRange(selectionStart, selectionEnd);
      }
    }

    function buildOptionMarkup(values, selectedValue = "") {
      const normalizedSelectedValue = selectedValue && values.includes(selectedValue) ? selectedValue : "";

      return [`<option value="" ${normalizedSelectedValue === "" ? "selected" : ""}>전체</option>`]
        .concat(
          values.map(
            (value) =>
              `<option value="${escapeAttribute(value)}" ${normalizedSelectedValue === value ? "selected" : ""}>${escapeHtml(value)}</option>`,
          ),
        )
        .join("");
    }

    function getHeaderComboMeasureContext() {
      if (headerComboMeasureContext) {
        return headerComboMeasureContext;
      }

      const canvas = document.createElement("canvas");
      headerComboMeasureContext = canvas.getContext("2d");
      return headerComboMeasureContext;
    }

    function measureHeaderComboMenuWidth(selectElement) {
      const measureContext = getHeaderComboMeasureContext();

      if (!measureContext || !(selectElement instanceof HTMLElement)) {
        return 150;
      }

      const referenceElement =
        selectElement.closest(".header-chip")?.querySelector(".header-chip-combo-trigger") || selectElement;
      const computedStyle = window.getComputedStyle(referenceElement);

      measureContext.font = [
        computedStyle.fontStyle,
        computedStyle.fontVariant,
        computedStyle.fontWeight,
        computedStyle.fontSize,
        computedStyle.fontFamily,
      ]
        .filter(Boolean)
        .join(" ");
      const optionWidths = Array.from(selectElement.options).map((option) =>
        measureContext.measureText(String(option.textContent || "").trim()).width,
      );

      return Math.max(150, Math.min(420, Math.ceil((optionWidths.length > 0 ? Math.max(...optionWidths) : 0) + 42)));
    }

    function getHeaderComboElement(selectId = "") {
      return document.getElementById(selectId)?.closest(".header-chip")?.querySelector(".header-chip-combo") || null;
    }

    function setHeaderComboOpen(selectId = "", isOpen = false) {
      const comboElement = getHeaderComboElement(selectId);

      if (!comboElement) {
        return false;
      }

      comboElement.classList.toggle("is-open", Boolean(isOpen));
      comboElement.querySelector("[data-header-combo-trigger]")?.setAttribute("aria-expanded", isOpen ? "true" : "false");
      comboElement.querySelector(".header-chip-combo-menu")?.classList.toggle("hidden", !isOpen);
      return true;
    }

    function closeAllHeaderCombos(exceptSelectId = "") {
      let didClose = false;

      document.querySelectorAll(".header-chip-combo.is-open").forEach((comboElement) => {
        const selectId = String(comboElement.dataset.headerComboFor || "").trim();

        if (exceptSelectId && selectId === exceptSelectId) {
          return;
        }

        comboElement.classList.remove("is-open");
        comboElement.querySelector("[data-header-combo-trigger]")?.setAttribute("aria-expanded", "false");
        comboElement.querySelector(".header-chip-combo-menu")?.classList.add("hidden");
        didClose = true;
      });

      return didClose;
    }

    function buildHeaderComboOptionMarkup(selectElement) {
      return Array.from(selectElement.options)
        .map((option) => {
          const optionText = String(option.textContent || "").trim();

          return `
            <button
              class="header-chip-combo-option ${option.selected ? "active" : ""}"
              data-header-combo-option="${escapeAttribute(selectElement.id)}"
              data-header-combo-value="${escapeAttribute(option.value)}"
              type="button"
            >
              <span>${escapeHtml(optionText)}</span>
            </button>
          `;
        })
        .join("");
    }

    function syncHeaderCombo(selectElement) {
      if (!(selectElement instanceof HTMLSelectElement)) {
        return;
      }

      const headerChipElement = selectElement.closest(".header-chip");

      if (!headerChipElement) {
        return;
      }

      let comboElement = headerChipElement.querySelector(".header-chip-combo");

      if (!comboElement) {
        comboElement = document.createElement("div");
        comboElement.className = "header-chip-combo";
        headerChipElement.append(comboElement);
      }

      const selectedOption =
        selectElement.selectedOptions?.[0] ||
        selectElement.options[selectElement.selectedIndex] ||
        selectElement.options[0] ||
        null;
      const menuWidth = measureHeaderComboMenuWidth(selectElement);
      const isOpen = comboElement.classList.contains("is-open");

      comboElement.dataset.headerComboFor = selectElement.id;
      comboElement.innerHTML = `
        <button
          class="header-chip-combo-trigger"
          data-header-combo-trigger="${escapeAttribute(selectElement.id)}"
          type="button"
          aria-expanded="${isOpen ? "true" : "false"}"
        >
          <span class="header-chip-combo-label">${escapeHtml(selectedOption?.textContent || "전체")}</span>
          <span class="header-chip-combo-caret" aria-hidden="true"></span>
        </button>
        <div class="header-chip-combo-menu ${isOpen ? "" : "hidden"}" style="width: ${menuWidth}px;">
          ${buildHeaderComboOptionMarkup(selectElement)}
        </div>
      `;
      selectElement.setAttribute("tabindex", "-1");
      selectElement.setAttribute("aria-hidden", "true");
    }

    function syncSelectElementOptions(selectElement, values, selectedValue = "") {
      selectElement.innerHTML = buildOptionMarkup(values, selectedValue);
    }

    function getOrderedValues(values) {
      return Array.from(new Set(values));
    }

    function decorateSelectFields() {
      document.querySelectorAll(".field").forEach((field) => {
        field.classList.toggle("select-field", Boolean(field.querySelector(":scope > select")));
      });
    }

    return Object.freeze({
      buildOptionMarkup,
      closeAllHeaderCombos,
      decorateSelectFields,
      getFilteredLookupRows,
      getHeaderComboElement,
      getHeaderFilteredRows,
      getLookupOptionMap,
      reconcileHeaderFilters,
      reconcileLookupFilters,
      rerenderWithFocus,
      setHeaderComboOpen,
      syncHeaderSelectOptions,
      updateLookupTextFilter,
    });
  }

  return Object.freeze({
    createGridRenderingController,
  });
});
