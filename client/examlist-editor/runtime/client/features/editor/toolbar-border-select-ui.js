(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListEditorToolbarBorderSelectUi = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createEditorToolbarBorderSelectUiController({
    closeAllEditorToolbarColorPanels,
    closeAllEditorToolbarFontFamilyMenus,
    closeAllEditorToolbarFontSizeMenus,
    closeAllEditorToolbarTableInsertPanels,
    updateEditorToolbarFloatingPanelPlacement,
  }) {
    function formatEditorToolbarBorderWidthValue(value = "1") {
      const numericValue = Number.parseFloat(String(value ?? "").trim() || "1");
      const normalizedValue = Number.isFinite(numericValue)
        ? Math.max(0, Math.min(3, Math.round(numericValue * 2) / 2))
        : 1;

      return Number.isInteger(normalizedValue) ? String(normalizedValue) : normalizedValue.toFixed(1);
    }

    function formatEditorToolbarCellPaddingValue(value = "") {
      const trimmedValue = String(value ?? "").trim();

      if (!trimmedValue) {
        return "";
      }

      const numericValue = Number.parseFloat(trimmedValue);

      if (!Number.isFinite(numericValue)) {
        return "";
      }

      return String(Math.max(0, Math.round(numericValue * 100) / 100));
    }

    function getEditorToolbarBorderSelectElements(inputId = "") {
      const normalizedInputId = String(inputId || "").trim();
      const selectElement = normalizedInputId ? document.getElementById(normalizedInputId) : null;
      const selectWrapper =
        selectElement?.closest(".template-toolbar-icon-select") ||
        (normalizedInputId ? document.querySelector(`.template-toolbar-icon-select[data-editor-border-select="${normalizedInputId}"]`) : null);
      const toggleElement = selectWrapper?.querySelector("[data-editor-border-select-toggle]") || null;
      const menuElement = selectWrapper?.querySelector(".template-toolbar-icon-select-menu") || null;

      return { menuElement, selectElement, selectWrapper, toggleElement };
    }

    function getEditorToolbarBorderWidthComboElements(inputId = "") {
      const normalizedInputId = String(inputId || "").trim();
      const inputElement = normalizedInputId ? document.getElementById(normalizedInputId) : null;
      const comboElement =
        inputElement?.closest(".template-toolbar-border-width-combo") ||
        (normalizedInputId
          ? document.querySelector(`.template-toolbar-border-width-combo[data-editor-border-width-combo="${normalizedInputId}"]`)
          : null);
      const toggleElement = comboElement?.querySelector("[data-editor-border-width-toggle]") || null;
      const menuElement = comboElement?.querySelector(".template-toolbar-combo-menu") || null;

      return { comboElement, inputElement, menuElement, toggleElement };
    }

    function getEditorToolbarCellPaddingComboElements(inputId = "") {
      const normalizedInputId = String(inputId || "").trim();
      const inputElement = normalizedInputId ? document.getElementById(normalizedInputId) : null;
      const comboElement =
        inputElement?.closest(".template-toolbar-cell-padding-combo") ||
        (normalizedInputId
          ? document.querySelector(`.template-toolbar-cell-padding-combo[data-editor-cell-padding-combo="${normalizedInputId}"]`)
          : null);
      const toggleElement = comboElement?.querySelector("[data-editor-cell-padding-toggle]") || null;
      const menuElement = comboElement?.querySelector(".template-toolbar-combo-menu") || null;

      return { comboElement, inputElement, menuElement, toggleElement };
    }

    function syncEditorToolbarBorderSelectControl(selectInput = null, value = "") {
      const selectElement =
        selectInput instanceof HTMLSelectElement
          ? selectInput
          : typeof selectInput === "string" && selectInput
            ? document.getElementById(selectInput)
            : null;

      if (!selectElement) {
        return "";
      }

      const { menuElement, selectWrapper } = getEditorToolbarBorderSelectElements(selectElement.id);
      const optionButtons = Array.from(menuElement?.querySelectorAll("[data-editor-border-select-option]") || []);
      const nextValue = String(value || selectElement.value || "").trim();

      if (nextValue) {
        selectElement.value = nextValue;
      }

      const activeButton =
        optionButtons.find((buttonElement) => buttonElement.dataset.editorBorderSelectOption === selectElement.value) ||
        optionButtons[0] ||
        null;

      if (!activeButton) {
        return selectElement.value;
      }

      selectElement.value = activeButton.dataset.editorBorderSelectOption || selectElement.value;

      const selectedLabelElement = selectWrapper?.querySelector("[data-editor-border-select-label]");
      const selectedIconElement = selectWrapper?.querySelector("[data-editor-border-select-current-icon]");
      const optionLabelElement = activeButton.querySelector(".template-toolbar-icon-select-option-label");
      const optionIconElement = activeButton.querySelector("[data-editor-border-select-option-icon]");

      if (selectedLabelElement) {
        selectedLabelElement.textContent = optionLabelElement?.textContent?.trim() || activeButton.textContent.trim();
      }

      if (selectedIconElement) {
        selectedIconElement.innerHTML = optionIconElement?.innerHTML || "";
      }

      optionButtons.forEach((buttonElement) => {
        const isActive = buttonElement === activeButton;

        buttonElement.classList.toggle("active", isActive);
        buttonElement.setAttribute("aria-selected", isActive ? "true" : "false");
      });

      return selectElement.value;
    }

    function syncEditorToolbarBorderWidthControl(input = null, value = "") {
      const inputElement =
        input instanceof HTMLInputElement
          ? input
          : typeof input === "string" && input
            ? document.getElementById(input)
            : null;

      if (!inputElement) {
        return "";
      }

      const normalizedValue = formatEditorToolbarBorderWidthValue(value || inputElement.value || "1");
      const { comboElement, menuElement } = getEditorToolbarBorderWidthComboElements(inputElement.id);
      const currentValueElement = comboElement?.querySelector("[data-editor-border-width-current]") || null;

      inputElement.value = normalizedValue;

      if (currentValueElement) {
        currentValueElement.textContent = normalizedValue;
      }

      Array.from(menuElement?.querySelectorAll("[data-editor-border-width-option]") || []).forEach((buttonElement) => {
        const isActive = buttonElement.dataset.editorBorderWidthOption === normalizedValue;

        buttonElement.classList.toggle("active", isActive);
        buttonElement.setAttribute("aria-selected", isActive ? "true" : "false");
      });

      return normalizedValue;
    }

    function syncEditorToolbarCellPaddingControl(input = null, value = "") {
      const inputElement =
        input instanceof HTMLInputElement
          ? input
          : typeof input === "string" && input
            ? document.getElementById(input)
            : null;

      if (!inputElement) {
        return "";
      }

      const isMixed = value === "mixed";
      const normalizedValue = isMixed ? "" : formatEditorToolbarCellPaddingValue(value);
      const { comboElement, menuElement } = getEditorToolbarCellPaddingComboElements(inputElement.id);
      const currentValueElement = comboElement?.querySelector("[data-editor-cell-padding-current]") || null;

      inputElement.value = normalizedValue;

      if (currentValueElement) {
        currentValueElement.textContent = isMixed ? "혼합" : normalizedValue || "-";
      }

      Array.from(menuElement?.querySelectorAll("[data-editor-cell-padding-option]") || []).forEach((buttonElement) => {
        const isActive = normalizedValue !== "" && buttonElement.dataset.editorCellPaddingOption === normalizedValue;

        buttonElement.classList.toggle("active", isActive);
        buttonElement.setAttribute("aria-selected", isActive ? "true" : "false");
      });

      return normalizedValue;
    }

    function closeAllEditorToolbarBorderIconSelectMenus(exceptInputId = "") {
      let closedAnyMenu = false;

      Array.from(document.querySelectorAll(".template-toolbar-icon-select")).forEach((selectWrapper) => {
        const selectElement = selectWrapper.querySelector(".template-toolbar-border-native-select");
        const toggleElement = selectWrapper.querySelector("[data-editor-border-select-toggle]");
        const menuElement = selectWrapper.querySelector(".template-toolbar-icon-select-menu");
        const shouldKeepOpen =
          exceptInputId &&
          selectElement?.id === exceptInputId &&
          menuElement &&
          !menuElement.classList.contains("hidden");

        if (!menuElement || shouldKeepOpen || menuElement.classList.contains("hidden")) {
          return;
        }

        menuElement.classList.add("hidden");
        selectWrapper.classList.remove("open", "open-up", "open-down");
        toggleElement?.setAttribute("aria-expanded", "false");
        closedAnyMenu = true;
      });

      return closedAnyMenu;
    }

    function closeAllEditorToolbarBorderWidthMenus(exceptInputId = "") {
      let closedAnyMenu = false;

      Array.from(document.querySelectorAll(".template-toolbar-border-width-combo")).forEach((comboElement) => {
        const inputElement = comboElement.querySelector(".template-toolbar-border-width-input");
        const toggleElement = comboElement.querySelector("[data-editor-border-width-toggle]");
        const menuElement = comboElement.querySelector(".template-toolbar-combo-menu");
        const shouldKeepOpen =
          exceptInputId &&
          inputElement?.id === exceptInputId &&
          menuElement &&
          !menuElement.classList.contains("hidden");

        if (!menuElement || shouldKeepOpen || menuElement.classList.contains("hidden")) {
          return;
        }

        menuElement.classList.add("hidden");
        comboElement.classList.remove("open", "open-up", "open-down");
        toggleElement?.setAttribute("aria-expanded", "false");
        closedAnyMenu = true;
      });

      return closedAnyMenu;
    }

    function closeAllEditorToolbarCellPaddingMenus(exceptInputId = "") {
      let closedAnyMenu = false;

      Array.from(document.querySelectorAll(".template-toolbar-cell-padding-combo")).forEach((comboElement) => {
        const inputElement = comboElement.querySelector(".template-toolbar-cell-padding-input");
        const toggleElement = comboElement.querySelector("[data-editor-cell-padding-toggle]");
        const menuElement = comboElement.querySelector(".template-toolbar-combo-menu");
        const shouldKeepOpen =
          exceptInputId &&
          inputElement?.id === exceptInputId &&
          menuElement &&
          !menuElement.classList.contains("hidden");

        if (!menuElement || shouldKeepOpen || menuElement.classList.contains("hidden")) {
          return;
        }

        menuElement.classList.add("hidden");
        comboElement.classList.remove("open", "open-up", "open-down");
        toggleElement?.setAttribute("aria-expanded", "false");
        closedAnyMenu = true;
      });

      return closedAnyMenu;
    }

    function closeAllEditorToolbarBorderSelectMenus(exceptInputId = "") {
      const closedIconMenus = closeAllEditorToolbarBorderIconSelectMenus(exceptInputId);
      const closedWidthMenus = closeAllEditorToolbarBorderWidthMenus(exceptInputId);
      const closedCellPaddingMenus = closeAllEditorToolbarCellPaddingMenus(exceptInputId);

      return closedIconMenus || closedWidthMenus || closedCellPaddingMenus;
    }

    function setEditorToolbarBorderSelectMenuVisibility(inputId = "", nextVisible = false) {
      const { menuElement, selectElement, selectWrapper, toggleElement } = getEditorToolbarBorderSelectElements(inputId);

      if (!selectElement || !menuElement || !selectWrapper) {
        return false;
      }

      if (nextVisible) {
        closeAllEditorToolbarBorderIconSelectMenus(inputId);
        closeAllEditorToolbarBorderWidthMenus();
        closeAllEditorToolbarCellPaddingMenus();
        closeAllEditorToolbarTableInsertPanels();
        closeAllEditorToolbarFontFamilyMenus();
        closeAllEditorToolbarFontSizeMenus();
        closeAllEditorToolbarColorPanels();
        syncEditorToolbarBorderSelectControl(selectElement);
      }

      menuElement.classList.toggle("hidden", !nextVisible);
      selectWrapper.classList.toggle("open", nextVisible);
      toggleElement?.setAttribute("aria-expanded", nextVisible ? "true" : "false");

      if (nextVisible) {
        updateEditorToolbarFloatingPanelPlacement(selectWrapper, menuElement, 6);
      } else {
        selectWrapper.classList.remove("open-up", "open-down");
      }

      return true;
    }

    function setEditorToolbarBorderWidthMenuVisibility(inputId = "", nextVisible = false) {
      const { comboElement, inputElement, menuElement, toggleElement } = getEditorToolbarBorderWidthComboElements(inputId);

      if (!inputElement || !menuElement || !comboElement) {
        return false;
      }

      if (nextVisible) {
        closeAllEditorToolbarBorderWidthMenus(inputId);
        closeAllEditorToolbarBorderIconSelectMenus();
        closeAllEditorToolbarCellPaddingMenus();
        closeAllEditorToolbarTableInsertPanels();
        closeAllEditorToolbarFontFamilyMenus();
        closeAllEditorToolbarFontSizeMenus();
        closeAllEditorToolbarColorPanels();
        syncEditorToolbarBorderWidthControl(inputElement);
      }

      menuElement.classList.toggle("hidden", !nextVisible);
      comboElement.classList.toggle("open", nextVisible);
      toggleElement?.setAttribute("aria-expanded", nextVisible ? "true" : "false");

      if (nextVisible) {
        updateEditorToolbarFloatingPanelPlacement(comboElement, menuElement, 6);
      } else {
        comboElement.classList.remove("open-up", "open-down");
      }

      return true;
    }

    function setEditorToolbarCellPaddingMenuVisibility(inputId = "", nextVisible = false) {
      const { comboElement, inputElement, menuElement, toggleElement } = getEditorToolbarCellPaddingComboElements(inputId);

      if (!inputElement || !menuElement || !comboElement) {
        return false;
      }

      if (nextVisible) {
        closeAllEditorToolbarCellPaddingMenus(inputId);
        closeAllEditorToolbarBorderWidthMenus();
        closeAllEditorToolbarBorderIconSelectMenus();
        closeAllEditorToolbarTableInsertPanels();
        closeAllEditorToolbarFontFamilyMenus();
        closeAllEditorToolbarFontSizeMenus();
        closeAllEditorToolbarColorPanels();
        syncEditorToolbarCellPaddingControl(inputElement);
      }

      menuElement.classList.toggle("hidden", !nextVisible);
      comboElement.classList.toggle("open", nextVisible);
      toggleElement?.setAttribute("aria-expanded", nextVisible ? "true" : "false");

      if (nextVisible) {
        updateEditorToolbarFloatingPanelPlacement(comboElement, menuElement, 6);
      } else {
        comboElement.classList.remove("open-up", "open-down");
      }

      return true;
    }

    function applyEditorToolbarBorderSelectOption(inputId = "", value = "") {
      const { selectElement } = getEditorToolbarBorderSelectElements(inputId);

      if (!selectElement) {
        return false;
      }

      syncEditorToolbarBorderSelectControl(selectElement, value);
      selectElement.dataset.editorBorderUserValue = "true";
      selectElement.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    function applyEditorToolbarBorderWidthOption(inputId = "", value = "") {
      const { inputElement } = getEditorToolbarBorderWidthComboElements(inputId);

      if (!inputElement) {
        return false;
      }

      syncEditorToolbarBorderWidthControl(inputElement, value);
      inputElement.dataset.editorBorderUserValue = "true";
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    function applyEditorToolbarCellPaddingOption(inputId = "", value = "") {
      const { inputElement } = getEditorToolbarCellPaddingComboElements(inputId);

      if (!inputElement) {
        return false;
      }

      syncEditorToolbarCellPaddingControl(inputElement, value);
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    return Object.freeze({
      applyEditorToolbarCellPaddingOption,
      applyEditorToolbarBorderSelectOption,
      applyEditorToolbarBorderWidthOption,
      closeAllEditorToolbarCellPaddingMenus,
      closeAllEditorToolbarBorderSelectMenus,
      closeAllEditorToolbarBorderWidthMenus,
      getEditorToolbarCellPaddingComboElements,
      getEditorToolbarBorderSelectElements,
      getEditorToolbarBorderWidthComboElements,
      setEditorToolbarCellPaddingMenuVisibility,
      setEditorToolbarBorderSelectMenuVisibility,
      setEditorToolbarBorderWidthMenuVisibility,
      syncEditorToolbarCellPaddingControl,
      syncEditorToolbarBorderSelectControl,
      syncEditorToolbarBorderWidthControl,
    });
  }

  return Object.freeze({
    createEditorToolbarBorderSelectUiController,
  });
});

})();
