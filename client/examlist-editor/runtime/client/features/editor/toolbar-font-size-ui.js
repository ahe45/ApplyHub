(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListEditorToolbarFontSizeUi = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createEditorToolbarFontSizeUiController({
    closeAllEditorToolbarBorderSelectMenus,
    closeAllEditorToolbarColorPanels,
    closeAllEditorToolbarTableInsertPanels,
    isEditorToolbarPresetFontSize,
  }) {
    function getEditorToolbarFontSizeMenuElement(fontSizeElement = null) {
      return fontSizeElement?.closest(".template-toolbar-font-size-combo")?.querySelector(".template-toolbar-combo-menu") || null;
    }

    function getEditorToolbarFontFamilyMenuElement(fontFamilyElement = null) {
      return fontFamilyElement?.closest(".template-toolbar-font-family-combo")?.querySelector(".template-toolbar-combo-menu") || null;
    }

    function syncEditorToolbarFontFamilyControls(fontFamilyElement = null, rawFontFamily = "") {
      const comboElement = fontFamilyElement?.closest(".template-toolbar-font-family-combo") || null;
      const valueElement = comboElement?.querySelector("[data-editor-font-family-current]") || null;
      const fontFamily = String(rawFontFamily || "").trim();
      let activeLabel = "";

      if (fontFamilyElement) {
        fontFamilyElement.value = fontFamily;
      }

      Array.from(comboElement?.querySelectorAll("[data-editor-font-family-option]") || []).forEach((optionButton) => {
        const isActive = optionButton.dataset.editorFontFamilyOption === fontFamily;

        if (isActive) {
          activeLabel = optionButton.dataset.editorFontFamilyLabel || optionButton.textContent.trim();
        }

        optionButton.classList.toggle("active", isActive);
        optionButton.setAttribute("aria-selected", isActive ? "true" : "false");
      });

      if (valueElement) {
        valueElement.textContent = activeLabel || fontFamily;
      }
    }

    function syncEditorToolbarFontSizeValueText(fontSizeElement = null, rawFontSize = "") {
      const comboElement = fontSizeElement?.closest(".template-toolbar-font-size-combo") || null;
      const valueElement = comboElement?.querySelector("[data-editor-font-size-current]") || null;

      if (valueElement) {
        valueElement.textContent = String(rawFontSize);
      }
    }

    function syncEditorToolbarFontSizeMenuSelection(fontSizeElement = null, rawFontSize = "") {
      const menuElement = getEditorToolbarFontSizeMenuElement(fontSizeElement);

      if (!menuElement) {
        return;
      }

      const normalizedFontSize = Math.round(Number(rawFontSize));
      const activeValue =
        Number.isFinite(normalizedFontSize) && isEditorToolbarPresetFontSize(normalizedFontSize)
          ? String(normalizedFontSize)
          : "";

      Array.from(menuElement.querySelectorAll("[data-editor-font-size-option]")).forEach((optionButton) => {
        const isActive = optionButton.dataset.editorFontSizeOption === activeValue;

        optionButton.classList.toggle("active", isActive);
        optionButton.setAttribute("aria-selected", isActive ? "true" : "false");
      });
    }

    function scrollEditorToolbarActiveComboOptionIntoView(menuElement = null) {
      const activeOption = menuElement?.querySelector?.(".template-toolbar-combo-option.active") || null;
      const menuHeight = menuElement?.clientHeight || 0;
      const optionHeight = activeOption?.offsetHeight || 0;

      if (!menuElement || !activeOption || !menuHeight || !optionHeight) {
        return false;
      }

      const targetScrollTop = activeOption.offsetTop - (menuHeight - optionHeight) / 2;
      const maxScrollTop = Math.max(0, menuElement.scrollHeight - menuHeight);

      menuElement.scrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
      return true;
    }

    function syncEditorToolbarFontSizeControls({
      fontSizeElement = null,
      fontSize = "",
      defaultFontSize = 11,
    } = {}) {
      const normalizedFontSize = Math.round(Number(fontSize));
      const resolvedFontSize = Number.isFinite(normalizedFontSize) ? normalizedFontSize : defaultFontSize;

      if (fontSizeElement) {
        fontSizeElement.value = String(resolvedFontSize);
        fontSizeElement.dataset.templateEditorCurrentFontSize = `${resolvedFontSize}pt`;
      }

      syncEditorToolbarFontSizeValueText(fontSizeElement, resolvedFontSize);
      syncEditorToolbarFontSizeMenuSelection(fontSizeElement, resolvedFontSize);
    }

    function getEditorToolbarFontSizeComboElements(fontSizeInputId = "") {
      const inputElement = document.getElementById(String(fontSizeInputId || "").trim());
      const comboElement = inputElement?.closest(".template-toolbar-font-size-combo") || null;
      const toggleElement = comboElement?.querySelector("[data-editor-font-size-toggle]") || null;
      const menuElement = comboElement?.querySelector(".template-toolbar-combo-menu") || null;

      return { inputElement, comboElement, toggleElement, menuElement };
    }

    function closeAllEditorToolbarFontSizeMenus(exceptFontSizeInputId = "") {
      let closedAnyMenu = false;

      Array.from(document.querySelectorAll(".template-toolbar-font-size-combo")).forEach((comboElement) => {
        const inputElement = comboElement.querySelector(".template-toolbar-font-size-input");
        const toggleElement = comboElement.querySelector("[data-editor-font-size-toggle]");
        const menuElement = comboElement.querySelector(".template-toolbar-combo-menu");
        const shouldKeepOpen =
          exceptFontSizeInputId &&
          inputElement?.id === exceptFontSizeInputId &&
          menuElement &&
          !menuElement.classList.contains("hidden");

        if (!menuElement || shouldKeepOpen || menuElement.classList.contains("hidden")) {
          return;
        }

        menuElement.classList.add("hidden");
        comboElement.classList.remove("open");
        toggleElement?.setAttribute("aria-expanded", "false");
        closedAnyMenu = true;
      });

      return closedAnyMenu;
    }

    function getEditorToolbarFontFamilyComboElements(fontFamilyInputId = "") {
      const inputElement = document.getElementById(String(fontFamilyInputId || "").trim());
      const comboElement = inputElement?.closest(".template-toolbar-font-family-combo") || null;
      const toggleElement = comboElement?.querySelector("[data-editor-font-family-toggle]") || null;
      const menuElement = comboElement?.querySelector(".template-toolbar-combo-menu") || null;

      return { inputElement, comboElement, toggleElement, menuElement };
    }

    function closeAllEditorToolbarFontFamilyMenus(exceptFontFamilyInputId = "") {
      let closedAnyMenu = false;

      Array.from(document.querySelectorAll(".template-toolbar-font-family-combo")).forEach((comboElement) => {
        const inputElement = comboElement.querySelector(".template-toolbar-font-family-input");
        const toggleElement = comboElement.querySelector("[data-editor-font-family-toggle]");
        const menuElement = comboElement.querySelector(".template-toolbar-combo-menu");
        const shouldKeepOpen =
          exceptFontFamilyInputId &&
          inputElement?.id === exceptFontFamilyInputId &&
          menuElement &&
          !menuElement.classList.contains("hidden");

        if (!menuElement || shouldKeepOpen || menuElement.classList.contains("hidden")) {
          return;
        }

        menuElement.classList.add("hidden");
        comboElement.classList.remove("open");
        toggleElement?.setAttribute("aria-expanded", "false");
        closedAnyMenu = true;
      });

      return closedAnyMenu;
    }

    function setEditorToolbarFontSizeMenuVisibility(fontSizeInputId = "", nextVisible = false) {
      const { inputElement, comboElement, toggleElement, menuElement } = getEditorToolbarFontSizeComboElements(fontSizeInputId);

      if (!inputElement || !comboElement || !menuElement) {
        return false;
      }

      if (nextVisible) {
        closeAllEditorToolbarFontSizeMenus(fontSizeInputId);
        closeAllEditorToolbarFontFamilyMenus();
        syncEditorToolbarFontSizeMenuSelection(inputElement, inputElement.value);
        closeAllEditorToolbarTableInsertPanels();
        closeAllEditorToolbarColorPanels();
        closeAllEditorToolbarBorderSelectMenus();
      }

      menuElement.classList.toggle("hidden", !nextVisible);
      comboElement.classList.toggle("open", nextVisible);
      toggleElement?.setAttribute("aria-expanded", nextVisible ? "true" : "false");

      if (nextVisible) {
        scrollEditorToolbarActiveComboOptionIntoView(menuElement);
      }

      return true;
    }

    function setEditorToolbarFontFamilyMenuVisibility(fontFamilyInputId = "", nextVisible = false) {
      const { inputElement, comboElement, toggleElement, menuElement } = getEditorToolbarFontFamilyComboElements(fontFamilyInputId);

      if (!inputElement || !comboElement || !menuElement) {
        return false;
      }

      if (nextVisible) {
        closeAllEditorToolbarFontFamilyMenus(fontFamilyInputId);
        closeAllEditorToolbarFontSizeMenus();
        syncEditorToolbarFontFamilyControls(inputElement, inputElement.value);
        closeAllEditorToolbarTableInsertPanels();
        closeAllEditorToolbarColorPanels();
        closeAllEditorToolbarBorderSelectMenus();
      }

      menuElement.classList.toggle("hidden", !nextVisible);
      comboElement.classList.toggle("open", nextVisible);
      toggleElement?.setAttribute("aria-expanded", nextVisible ? "true" : "false");

      if (nextVisible) {
        scrollEditorToolbarActiveComboOptionIntoView(menuElement);
      }

      return true;
    }

    return Object.freeze({
      closeAllEditorToolbarFontFamilyMenus,
      closeAllEditorToolbarFontSizeMenus,
      getEditorToolbarFontFamilyComboElements,
      getEditorToolbarFontFamilyMenuElement,
      getEditorToolbarFontSizeComboElements,
      getEditorToolbarFontSizeMenuElement,
      setEditorToolbarFontFamilyMenuVisibility,
      setEditorToolbarFontSizeMenuVisibility,
      syncEditorToolbarFontFamilyControls,
      syncEditorToolbarFontSizeControls,
      syncEditorToolbarFontSizeMenuSelection,
    });
  }

  return Object.freeze({
    createEditorToolbarFontSizeUiController,
  });
});

})();
