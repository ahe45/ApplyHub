(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListEditorToolbarTableInsertUi = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createEditorToolbarTableInsertUiController({
    closeAllEditorToolbarBorderSelectMenus,
    closeAllEditorToolbarColorPanels,
    closeAllEditorToolbarFontFamilyMenus,
    closeAllEditorToolbarFontSizeMenus,
  }) {
    function getEditorToolbarTableInsertPopoverElements(panelId = "") {
      const normalizedPanelId = String(panelId || "").trim();
      const panelElement = normalizedPanelId ? document.getElementById(normalizedPanelId) : null;
      const popoverElement =
        panelElement?.closest(".template-toolbar-table-insert-popover") ||
        (normalizedPanelId
          ? document.querySelector(`.template-toolbar-table-insert-popover[data-editor-table-insert-popover="${normalizedPanelId}"]`)
          : null);
      const toggleElement = popoverElement?.querySelector("[data-editor-table-insert-toggle]") || null;

      return { panelElement, popoverElement, toggleElement };
    }

    function closeAllEditorToolbarTableInsertPanels(exceptPanelId = "") {
      let closedAnyPanel = false;

      Array.from(document.querySelectorAll(".template-toolbar-table-insert-popover")).forEach((popoverElement) => {
        const panelElement = popoverElement.querySelector(".template-table-insert-panel");
        const toggleElement = popoverElement.querySelector("[data-editor-table-insert-toggle]");
        const shouldKeepOpen =
          exceptPanelId &&
          panelElement?.id === exceptPanelId &&
          panelElement &&
          !panelElement.classList.contains("hidden");

        if (!panelElement || shouldKeepOpen || panelElement.classList.contains("hidden")) {
          return;
        }

        panelElement.classList.add("hidden");
        popoverElement.classList.remove("open");
        toggleElement?.setAttribute("aria-expanded", "false");
        closedAnyPanel = true;
      });

      return closedAnyPanel;
    }

    function setEditorToolbarTableInsertPanelVisibility(panelId = "", nextVisible = false) {
      const { panelElement, popoverElement, toggleElement } = getEditorToolbarTableInsertPopoverElements(panelId);

      if (!panelElement || !popoverElement) {
        return false;
      }

      if (nextVisible) {
        closeAllEditorToolbarTableInsertPanels(panelId);
        closeAllEditorToolbarColorPanels();
        closeAllEditorToolbarFontFamilyMenus();
        closeAllEditorToolbarFontSizeMenus();
        closeAllEditorToolbarBorderSelectMenus();
      }

      panelElement.classList.toggle("hidden", !nextVisible);
      popoverElement.classList.toggle("open", nextVisible);
      toggleElement?.setAttribute("aria-expanded", nextVisible ? "true" : "false");
      return true;
    }

    return Object.freeze({
      closeAllEditorToolbarTableInsertPanels,
      getEditorToolbarTableInsertPopoverElements,
      setEditorToolbarTableInsertPanelVisibility,
    });
  }

  return Object.freeze({
    createEditorToolbarTableInsertUiController,
  });
});

})();
