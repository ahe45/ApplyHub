(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableObjectOverlay = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorTableObjectOverlayController({
    getHoveredTable,
    getTemplateEditorImageOverlayContainer,
    getTemplateEditorModal,
    isTemplateEditorTableObjectElement,
    ownerDocument,
    shell,
    state,
  }) {
    let templateEditorTableSelectionOverlay = null;
    let templateEditorTableHoverOverlay = null;

    function createTemplateEditorTableObjectOverlayElement(kind = "selection") {
      const overlayElement = ownerDocument.createElement("div");

      overlayElement.className = "template-editor-table-selection hidden";
      overlayElement.dataset.templateTableObjectOverlay = kind;
      overlayElement.setAttribute("aria-hidden", "true");
      overlayElement.setAttribute("contenteditable", "false");
      ensureTemplateEditorTableObjectOverlayControls(overlayElement);

      return overlayElement;
    }

    function ensureTemplateEditorTableObjectOverlayControls(overlayElement) {
      if (!(overlayElement instanceof HTMLElement)) {
        return;
      }

      const positions = ["bottom-right", "bottom", "bottom-left", "left", "top-left", "top", "top-right", "right"];
      const existingMoveHandle = overlayElement.querySelector("[data-template-table-object-move-handle]");
      const existingHandles = Array.from(overlayElement.querySelectorAll("[data-template-table-object-handle]"));
      const existingPositions = new Set(
        existingHandles
          .map((handle) => String(handle.dataset.templateTableObjectHandlePosition || "").trim())
          .filter(Boolean),
      );
      const needsRebuild = !existingMoveHandle ||
        existingHandles.length !== positions.length ||
        positions.some((position) => !existingPositions.has(position));

      if (!needsRebuild) {
        return;
      }

      overlayElement
        .querySelectorAll("[data-template-table-object-move-handle], [data-template-table-object-handle]")
        .forEach((element) => element.remove());
      const moveHandleElement = ownerDocument.createElement("button");

      moveHandleElement.className = "template-editor-table-move-handle";
      moveHandleElement.dataset.templateTableObjectMoveHandle = "true";
      moveHandleElement.type = "button";
      moveHandleElement.tabIndex = -1;
      moveHandleElement.title = "표 위치 이동";
      moveHandleElement.setAttribute("aria-label", "표 위치 이동");
      moveHandleElement.innerHTML = `
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M8 1.8v12.4M1.8 8h12.4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.7"/>
          <path d="M8 1.8 5.9 3.9M8 1.8l2.1 2.1M8 14.2l-2.1-2.1M8 14.2l2.1-2.1M1.8 8l2.1-2.1M1.8 8l2.1 2.1M14.2 8l-2.1-2.1M14.2 8l-2.1 2.1" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
        </svg>
      `;
      overlayElement.append(moveHandleElement);

      positions.forEach((position) => {
        const handleElement = ownerDocument.createElement("button");

        handleElement.className = "template-editor-table-handle";
        handleElement.dataset.templateTableObjectHandle = "true";
        handleElement.dataset.templateTableObjectHandlePosition = position;
        handleElement.type = "button";
        handleElement.tabIndex = -1;
        handleElement.title = "표 크기 조절";
        handleElement.setAttribute("aria-label", "표 크기 조절");
        overlayElement.append(handleElement);
      });
    }

    function ensureTemplateEditorTableObjectOverlay(kind = "selection") {
      const overlayContainer = getTemplateEditorImageOverlayContainer();

      if (!overlayContainer) {
        return null;
      }

      let overlayElement = kind === "hover" ? templateEditorTableHoverOverlay : templateEditorTableSelectionOverlay;

      if (!overlayElement) {
        overlayElement = createTemplateEditorTableObjectOverlayElement(kind);

        if (kind === "hover") {
          templateEditorTableHoverOverlay = overlayElement;
        } else {
          templateEditorTableSelectionOverlay = overlayElement;
        }
      }

      if (overlayElement.parentElement !== overlayContainer) {
        overlayContainer.append(overlayElement);
      }

      ensureTemplateEditorTableObjectOverlayControls(overlayElement);

      if (templateEditorTableSelectionOverlay?.parentElement === overlayContainer) {
        overlayContainer.append(templateEditorTableSelectionOverlay);
      }

      return overlayElement;
    }

    function hideTemplateEditorTableObjectOverlay(overlayElement) {
      overlayElement?.classList.add("hidden");
      overlayElement?.classList.remove("is-hover-only", "is-selected", "is-table-move-disabled");
      if (overlayElement) {
        overlayElement.__templateEditorTableElement = null;
      }
    }

    function syncTemplateEditorTableObjectOverlayToTable(overlayElement, overlayContainer, tableElement, { selected = false } = {}) {
      if (!overlayElement || !overlayContainer || !tableElement) {
        hideTemplateEditorTableObjectOverlay(overlayElement);
        return false;
      }

      const tableRect = tableElement.getBoundingClientRect();
      const overlayRect = overlayContainer.getBoundingClientRect();

      if (tableRect.width < 1 || tableRect.height < 1) {
        hideTemplateEditorTableObjectOverlay(overlayElement);
        return false;
      }

      const scaleX = overlayContainer.offsetWidth > 0 ? overlayRect.width / overlayContainer.offsetWidth : 1;
      const scaleY = overlayContainer.offsetHeight > 0 ? overlayRect.height / overlayContainer.offsetHeight : 1;
      overlayElement.style.left = `${Math.round((tableRect.left - overlayRect.left) / Math.max(scaleX, 0.01) - overlayContainer.clientLeft)}px`;
      overlayElement.style.top = `${Math.round((tableRect.top - overlayRect.top) / Math.max(scaleY, 0.01) - overlayContainer.clientTop)}px`;
      overlayElement.style.width = `${Math.round(tableRect.width / Math.max(scaleX, 0.01))}px`;
      overlayElement.style.height = `${Math.round(tableRect.height / Math.max(scaleY, 0.01))}px`;
      overlayElement.classList.toggle("is-hover-only", !selected);
      overlayElement.classList.toggle("is-selected", selected);
      const block = tableElement.closest("[data-candidate-block-instance]");
      overlayElement.classList.toggle("is-table-move-disabled", Boolean(block && !block.classList.contains("is-candidate-block-focus-editor")));
      overlayElement.classList.remove("hidden");
      overlayElement.__templateEditorTableElement = tableElement;
      return true;
    }

    function updateTemplateEditorTableObjectOverlay() {
      const selectionOverlayElement = ensureTemplateEditorTableObjectOverlay("selection");
      const hoverOverlayElement = ensureTemplateEditorTableObjectOverlay("hover");
      const overlayContainer = getTemplateEditorImageOverlayContainer();
      const selectedTable = isTemplateEditorTableObjectElement(state.templateEditor.selectedTableElement)
        ? state.templateEditor.selectedTableElement
        : null;
      const hoveredTable = isTemplateEditorTableObjectElement(getHoveredTable())
        ? getHoveredTable()
        : null;
      const hoverTargetTable = hoveredTable && hoveredTable !== selectedTable ? hoveredTable : (!selectedTable ? hoveredTable : null);

      if (!selectionOverlayElement || !hoverOverlayElement || !overlayContainer || getTemplateEditorModal()?.classList.contains("hidden") || (!selectedTable && !hoverTargetTable)) {
        if (state.templateEditor.selectedTableElement && !selectedTable) {
          state.templateEditor.selectedTableElement = null;
        }

        shell.surfaceElement?.classList.remove("is-table-object-border-hover", "is-table-object-moving", "is-table-object-resizing");
        hideTemplateEditorTableObjectOverlay(selectionOverlayElement);
        hideTemplateEditorTableObjectOverlay(hoverOverlayElement);
        return;
      }

      const hasVisibleSelection = selectedTable
        ? syncTemplateEditorTableObjectOverlayToTable(selectionOverlayElement, overlayContainer, selectedTable, { selected: true })
        : false;
      const hasVisibleHover = hoverTargetTable
        ? syncTemplateEditorTableObjectOverlayToTable(hoverOverlayElement, overlayContainer, hoverTargetTable, { selected: false })
        : false;

      if (!hasVisibleSelection) {
        hideTemplateEditorTableObjectOverlay(selectionOverlayElement);
      }

      if (!hasVisibleHover) {
        hideTemplateEditorTableObjectOverlay(hoverOverlayElement);
      }

      shell.surfaceElement?.classList.toggle("is-table-object-border-hover", hasVisibleHover);
    }

    function getTemplateEditorTableObjectOverlayElement() {
      return templateEditorTableSelectionOverlay;
    }

    return Object.freeze({
      getTemplateEditorTableObjectOverlayElement,
      updateTemplateEditorTableObjectOverlay,
    });
  }

  return Object.freeze({
    createTemplateEditorTableObjectOverlayController,
  });
});

})();
