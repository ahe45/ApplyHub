import {
  applyObjectAlignmentSelection,
  clearObjectAlignmentSelection,
  getObjectCandidateBlockModalElement,
  getObjectAlignmentEventTarget,
  getObjectTableCellElement,
  getSelectedObjectAlignmentElements,
  isObjectEditorReadOnly,
  runObjectAlignmentCommand,
} from "./object-alignment-runtime.js";
import { bindObjectMultiSelectionOverlays } from "./object-multi-selection-overlays.js";
import { createObjectAlignmentToolbar, insertObjectToolbarSection } from "./object-toolbar-ui.js";

export function bindObjectAlignmentControls({ editor, surfaceElement, toolbarHost }) {
  if (!editor || !surfaceElement || !toolbarHost) {
    return null;
  }

  toolbarHost.querySelector(".examlist-object-align-control")?.remove();

  const alignmentToolbar = createObjectAlignmentToolbar();
  insertObjectToolbarSection(toolbarHost, alignmentToolbar, ".examlist-object-size-control");
  const multiSelectionOverlays = bindObjectMultiSelectionOverlays({ editor, surfaceElement });

  const getOptions = () => Array.from(alignmentToolbar.querySelectorAll("[data-examlist-object-align]"));
  const closeDropdowns = (exceptSelect = null) => {
    Array.from(alignmentToolbar.querySelectorAll(".examlist-object-align-select")).forEach((selectElement) => {
      if (exceptSelect && selectElement === exceptSelect) {
        return;
      }

      selectElement.classList.remove("open", "open-up", "open-down");
      selectElement.querySelector(".template-toolbar-icon-select-menu")?.classList.add("hidden");
      selectElement.querySelector("[data-examlist-object-align-toggle]")?.setAttribute("aria-expanded", "false");
    });
  };
  const getDropdownBoundaryRect = (selectElement) => {
    const viewportRect = {
      bottom: window.innerHeight || document.documentElement.clientHeight || 0,
      top: 0,
    };
    let currentElement = selectElement?.parentElement || null;

    while (currentElement && currentElement !== document.body && currentElement !== document.documentElement) {
      const computedStyle = window.getComputedStyle(currentElement);
      const overflowValue = `${computedStyle.overflow || ""} ${computedStyle.overflowY || ""}`;

      if (/(auto|scroll|hidden|clip)/i.test(overflowValue)) {
        const rect = currentElement.getBoundingClientRect();

        return {
          bottom: Math.min(viewportRect.bottom, rect.bottom),
          top: Math.max(viewportRect.top, rect.top),
        };
      }

      currentElement = currentElement.parentElement;
    }

    return viewportRect;
  };
  const updateDropdownPlacement = (selectElement, menuElement) => {
    if (!(selectElement instanceof HTMLElement) || !(menuElement instanceof HTMLElement)) {
      return;
    }

    selectElement.classList.remove("open-up", "open-down");

    if (menuElement.classList.contains("hidden")) {
      return;
    }

    const gap = 6;
    const selectRect = selectElement.getBoundingClientRect();
    const menuRect = menuElement.getBoundingClientRect();
    const boundaryRect = getDropdownBoundaryRect(selectElement);
    const spaceBelow = boundaryRect.bottom - selectRect.bottom;
    const spaceAbove = selectRect.top - boundaryRect.top;
    const shouldOpenUp = spaceBelow < menuRect.height + gap && spaceAbove > spaceBelow;

    selectElement.classList.toggle("open-up", shouldOpenUp);
    selectElement.classList.toggle("open-down", !shouldOpenUp);
  };
  const toggleDropdown = (selectElement) => {
    const menuElement = selectElement?.querySelector(".template-toolbar-icon-select-menu") || null;
    const toggleElement = selectElement?.querySelector("[data-examlist-object-align-toggle]") || null;

    if (!selectElement || !menuElement || !toggleElement || toggleElement.disabled) {
      return;
    }

    const nextOpen = menuElement.classList.contains("hidden");
    closeDropdowns(selectElement);
    selectElement.classList.toggle("open", nextOpen);
    menuElement.classList.toggle("hidden", !nextOpen);
    toggleElement.setAttribute("aria-expanded", nextOpen ? "true" : "false");

    if (nextOpen) {
      updateDropdownPlacement(selectElement, menuElement);
    } else {
      selectElement.classList.remove("open-up", "open-down");
    }
  };
  const syncButtonState = () => {
    const selectedElements = getSelectedObjectAlignmentElements(surfaceElement);
    const selectedCount = selectedElements.length;
    const hasCellContainedObject = selectedElements.some((element) => getObjectTableCellElement(element, surfaceElement));
    const allCellContainedObjects = selectedCount > 0 && selectedElements.every((element) => getObjectTableCellElement(element, surfaceElement));
    const hasCandidateBlockModalObject = selectedElements.some((element) => getObjectCandidateBlockModalElement(element, surfaceElement));

    getOptions().forEach((option) => {
      const command = option.dataset.examlistObjectAlign || "";
      const minimumCount = command.startsWith("distribute-") ? 3 : 1;
      const disabled =
        isObjectEditorReadOnly(surfaceElement) ||
        selectedCount < minimumCount ||
        (hasCellContainedObject && (!allCellContainedObjects || command.startsWith("distribute-"))) ||
        (hasCandidateBlockModalObject && !allCellContainedObjects);

      option.disabled = disabled;
      option.setAttribute("aria-disabled", disabled ? "true" : "false");
    });

    alignmentToolbar.querySelectorAll(".examlist-object-align-select").forEach((selectElement) => {
      const options = Array.from(selectElement.querySelectorAll("[data-examlist-object-align]"));
      const toggleElement = selectElement.querySelector("[data-examlist-object-align-toggle]");
      const referenceElement = selectElement.querySelector("[data-examlist-object-align-reference]");
      const shouldDisable = !options.some((option) => !option.disabled);

      if (toggleElement) {
        toggleElement.disabled = shouldDisable;
      }

      if (referenceElement) {
        referenceElement.textContent = `기준: ${allCellContainedObjects ? "셀" : selectedCount > 1 ? "개체" : "캔버스"}`;
      }

      if (shouldDisable) {
        closeDropdowns(selectElement);
        selectElement.classList.remove("open", "open-up", "open-down");
        selectElement.querySelector(".template-toolbar-icon-select-menu")?.classList.add("hidden");
        toggleElement?.setAttribute("aria-expanded", "false");
      }
    });
  };
  const handleToolbarClick = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const toggle = target?.closest?.("[data-examlist-object-align-toggle]") || null;
    const option = target?.closest?.("[data-examlist-object-align]") || null;

    if (toggle && alignmentToolbar.contains(toggle)) {
      event.preventDefault();
      event.stopPropagation();
      toggleDropdown(toggle.closest(".examlist-object-align-select"));
      return;
    }

    if (!option || !alignmentToolbar.contains(option)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (option.disabled) {
      return;
    }

    closeDropdowns();
    runObjectAlignmentCommand(editor, surfaceElement, option.dataset.examlistObjectAlign || "");
    syncButtonState();
    multiSelectionOverlays?.scheduleUpdate?.();
  };
  const handleDocumentPointerDown = (event) => {
    const target = event.target instanceof Element ? event.target : null;

    if (!target || !alignmentToolbar.contains(target)) {
      closeDropdowns();
    }
  };
  const handleSurfacePointerDown = (event) => {
    if (isObjectEditorReadOnly(surfaceElement)) {
      return;
    }

    const target = event.target instanceof Element ? event.target : null;

    if (target?.closest?.("[data-examlist-object-resize-handle], .examlist-object-resize-handle")) {
      return;
    }

    if (target?.closest?.("[data-template-table-object-move-handle], [data-template-table-object-handle]")) {
      return;
    }

    const objectElement = getObjectAlignmentEventTarget(target, surfaceElement, event);

    if (!objectElement) {
      if (!target?.closest?.(".template-editor-image-selection, .template-editor-table-selection, .examlist-object-selection")) {
        clearObjectAlignmentSelection(editor, surfaceElement);
        multiSelectionOverlays?.scheduleUpdate?.();
        window.requestAnimationFrame(syncButtonState);
      }
      return;
    }

    if (!(event.ctrlKey || event.metaKey || event.shiftKey)) {
      clearObjectAlignmentSelection(editor, surfaceElement);
      multiSelectionOverlays?.scheduleUpdate?.();
      window.requestAnimationFrame(syncButtonState);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const selectedElements = getSelectedObjectAlignmentElements(surfaceElement);
    const nextSelection = selectedElements.includes(objectElement)
      ? selectedElements.filter((element) => element !== objectElement)
      : [...selectedElements, objectElement];

    applyObjectAlignmentSelection(editor, surfaceElement, nextSelection);
    syncButtonState();
    multiSelectionOverlays?.scheduleUpdate?.();
  };
  const handleKeyDown = (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (alignmentToolbar.querySelector(".examlist-object-align-select.open")) {
      closeDropdowns();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (!getSelectedObjectAlignmentElements(surfaceElement).length) {
      return;
    }

    clearObjectAlignmentSelection(editor, surfaceElement);
    syncButtonState();
    multiSelectionOverlays?.scheduleUpdate?.();
  };
  const handleMutation = () => {
    window.requestAnimationFrame(syncButtonState);
    multiSelectionOverlays?.scheduleUpdate?.();
  };

  alignmentToolbar.addEventListener("click", handleToolbarClick);
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  surfaceElement.addEventListener("pointerdown", handleSurfacePointerDown, true);
  surfaceElement.addEventListener("keydown", handleKeyDown);
  alignmentToolbar.addEventListener("keydown", handleKeyDown);
  surfaceElement.addEventListener("input", handleMutation);
  document.addEventListener("selectionchange", handleMutation);
  syncButtonState();

  return () => {
    alignmentToolbar.removeEventListener("click", handleToolbarClick);
    document.removeEventListener("pointerdown", handleDocumentPointerDown);
    surfaceElement.removeEventListener("pointerdown", handleSurfacePointerDown, true);
    surfaceElement.removeEventListener("keydown", handleKeyDown);
    alignmentToolbar.removeEventListener("keydown", handleKeyDown);
    surfaceElement.removeEventListener("input", handleMutation);
    document.removeEventListener("selectionchange", handleMutation);
    multiSelectionOverlays?.dispose?.();
    alignmentToolbar.remove();
  };
}
