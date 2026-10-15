import { escapeHtml } from "../../app/html-utils.js";
import { formatCount } from "../../app/number-format.js";
import {
  buildGeneratedObjectMarkup,
  buildGeneratedObjectPreviewData,
} from "./generated-object-controller-patch.js";
import {
  filterGeneratedObjectSourceOptionsForType,
  getGeneratedObjectSourceOptions as getGeneratedObjectSourceOptionsFromDefinitions,
  normalizeGeneratedObjectSourceKey as normalizeGeneratedObjectSourceKeyFromConfig,
  normalizeGeneratedObjectType as normalizeGeneratedObjectTypeFromConfig,
} from "./generated-objects-adapter.js";
import { dataTagAccordionGroups, isVisibleTemplateTag, renderDataTagIcon } from "./data-tags-config.js";

let lastGeneratedObjectSelectionRange = null;
const defaultGeneratedObjectSourceKey = "candidate.examNo";

export function resetGeneratedObjectSourceControlState() {
  lastGeneratedObjectSelectionRange = null;
}

function getSelectionRangeInsideSurface(surfaceElement) {
  if (!surfaceElement || typeof window === "undefined") {
    return null;
  }

  const selection = window.getSelection?.();

  if (!selection?.rangeCount || !surfaceElement.contains(selection.anchorNode)) {
    return null;
  }

  const range = selection.getRangeAt(0);

  if (!surfaceElement.contains(range.startContainer) || !surfaceElement.contains(range.endContainer)) {
    return null;
  }

  return range;
}

function normalizeGeneratedObjectType(value) {
  return normalizeGeneratedObjectTypeFromConfig(value);
}

function normalizeGeneratedObjectSourceKey(value) {
  return normalizeGeneratedObjectSourceKeyFromConfig(value);
}

function getGeneratedObjectSourceOptions(tagDefinitions = []) {
  return getGeneratedObjectSourceOptionsFromDefinitions(tagDefinitions);
}

function getGeneratedObjectSourceOptionsForType(tagDefinitions = [], objectType = "barcode") {
  return filterGeneratedObjectSourceOptionsForType(
    getGeneratedObjectSourceOptions(tagDefinitions).filter(isVisibleTemplateTag),
    objectType,
  );
}

function getDefaultGeneratedObjectSourceKey(options = []) {
  const sourceOptions = Array.isArray(options) ? options : [];

  return sourceOptions.some((option) => option.key === defaultGeneratedObjectSourceKey)
    ? defaultGeneratedObjectSourceKey
    : sourceOptions[0]?.key || defaultGeneratedObjectSourceKey;
}

function getGroupedGeneratedObjectSourceOptions(options = []) {
  const optionMap = new Map(
    (Array.isArray(options) ? options : [])
      .filter(isVisibleTemplateTag)
      .map((option) => [String(option.key || "").trim(), option]),
  );
  const usedKeys = new Set();
  const groups = dataTagAccordionGroups.map((group) => {
    const sourceOptions = group.keys
      .map((key) => optionMap.get(key))
      .filter(Boolean);

    sourceOptions.forEach((option) => usedKeys.add(option.key));

    return {
      ...group,
      sourceOptions,
    };
  });
  const uncategorizedOptions = Array.from(optionMap.values()).filter((option) => !usedKeys.has(option.key));

  if (uncategorizedOptions.length) {
    const etcGroup = groups.find((group) => group.id === "etc");

    if (etcGroup) {
      etcGroup.sourceOptions = [...etcGroup.sourceOptions, ...uncategorizedOptions];
    }
  }

  return groups.filter((group) => group.sourceOptions.length);
}

export function renderGeneratedObjectSourceOptions(options = [], selectedSourceKey = defaultGeneratedObjectSourceKey, objectType = "") {
  const sourceOptions = objectType ? filterGeneratedObjectSourceOptionsForType(options, objectType) : options;
  const groups = getGroupedGeneratedObjectSourceOptions(sourceOptions);
  const normalizedSelectedSourceKey = normalizeGeneratedObjectSourceKey(selectedSourceKey);

  if (!groups.length) {
    return '<p class="editor-empty">사용 가능한 데이터 태그가 없습니다.</p>';
  }

  return groups
    .map(
      (group) => `
        <details class="template-tag-accordion-group" data-examlist-generated-object-source-group="${escapeHtml(group.id)}">
          <summary class="template-tag-accordion-summary">
            <span class="template-tag-group-heading">
              <span class="template-tag-group-icon">${renderDataTagIcon(group.icon)}</span>
              <span class="template-tag-group-label">${escapeHtml(group.label)}</span>
              <span class="template-tag-group-count">${formatCount(group.sourceOptions.length)}</span>
            </span>
            <span class="template-tag-group-chevron" aria-hidden="true"></span>
          </summary>
          <div class="template-tag-accordion-list">
            ${group.sourceOptions
              .map((option) => {
                const isSelected = option.key === normalizedSelectedSourceKey;

                return `
                  <button
                    class="template-tag-button template-tag-accordion-button examlist-generated-object-source-option${isSelected ? " selected" : ""}"
                    data-examlist-generated-object-source-option="${escapeHtml(option.key)}"
                    type="button"
                    role="option"
                    aria-selected="${isSelected ? "true" : "false"}"
                    title="${escapeHtml(option.label)}"
                    aria-label="${escapeHtml(option.label)}"
                  >
                    <span class="template-tag-button-icon">${renderDataTagIcon(group.icon)}</span>
                    <span class="template-tag-button-label">${escapeHtml(option.label)}</span>
                  </button>
                `;
              })
              .join("")}
          </div>
        </details>
      `,
    )
    .join("");
}

function rememberGeneratedObjectSelection(surfaceElement) {
  const range = getSelectionRangeInsideSurface(surfaceElement);

  if (range) {
    lastGeneratedObjectSelectionRange = range.cloneRange();
  }
}

function canRestoreGeneratedObjectSelection(surfaceElement) {
  return Boolean(
    surfaceElement &&
      lastGeneratedObjectSelectionRange &&
      lastGeneratedObjectSelectionRange.startContainer?.isConnected &&
      lastGeneratedObjectSelectionRange.endContainer?.isConnected &&
      surfaceElement.contains(lastGeneratedObjectSelectionRange.startContainer) &&
      surfaceElement.contains(lastGeneratedObjectSelectionRange.endContainer),
  );
}

function isRangeInsideElement(range, element) {
  if (!range || !element) {
    return false;
  }

  return Boolean(
    range.startContainer?.isConnected &&
      range.endContainer?.isConnected &&
      element.contains(range.startContainer) &&
      element.contains(range.endContainer),
  );
}

function getGeneratedObjectInsertionSurface(surfaceElement) {
  const modalSurfaceElement = window.ExamListCandidateBlockModalEditor?.getActiveSurface?.();

  return modalSurfaceElement instanceof HTMLElement ? modalSurfaceElement : surfaceElement;
}

function restoreGeneratedObjectSelection(surfaceElement) {
  if (!canRestoreGeneratedObjectSelection(surfaceElement)) {
    return false;
  }

  const selection = window.getSelection?.();

  if (!selection) {
    return false;
  }

  surfaceElement.focus({ preventScroll: true });
  selection.removeAllRanges();
  selection.addRange(lastGeneratedObjectSelectionRange);
  return true;
}

function createGeneratedObjectSourcePicker(tagDefinitions = []) {
  const modalElement = document.createElement("div");
  const options = getGeneratedObjectSourceOptionsForType(tagDefinitions, "barcode");
  const selectedSourceKey = getDefaultGeneratedObjectSourceKey(options);

  modalElement.className = "modal-overlay examlist-generated-object-source-modal hidden";
  modalElement.dataset.examlistGeneratedObjectSourcePicker = "true";
  modalElement.dataset.examlistGeneratedObjectType = "barcode";
  modalElement.setAttribute("role", "dialog");
  modalElement.setAttribute("aria-modal", "true");
  modalElement.setAttribute("aria-label", "데이터 선택");
  modalElement.setAttribute("aria-hidden", "true");
  modalElement.innerHTML = `
    <div class="modal-card examlist-generated-object-source-card">
      <div class="modal-header examlist-generated-object-source-modal-header">
        <div>
          <p class="modal-kicker">데이터 선택</p>
          <h2 data-examlist-generated-object-source-picker-title>바코드 데이터</h2>
        </div>
        <button class="icon-button" data-examlist-generated-object-source-close type="button" aria-label="닫기">×</button>
      </div>
      <div class="template-tag-accordion examlist-generated-object-source-options" role="listbox">
        ${renderGeneratedObjectSourceOptions(options, selectedSourceKey)}
      </div>
    </div>
  `;

  return modalElement;
}

function renderGeneratedObjectSourcePickerOptions(pickerElement, objectType, tagDefinitions = []) {
  const normalizedType = normalizeGeneratedObjectType(objectType);
  const options = getGeneratedObjectSourceOptionsForType(tagDefinitions, normalizedType);
  const selectedSourceKey = getDefaultGeneratedObjectSourceKey(options);
  const optionsContainer = pickerElement?.querySelector?.(".examlist-generated-object-source-options");

  if (optionsContainer) {
    optionsContainer.innerHTML = renderGeneratedObjectSourceOptions(options, selectedSourceKey);
  }

  return selectedSourceKey;
}

function closeGeneratedObjectSourceGroups(pickerElement) {
  pickerElement?.querySelectorAll?.(".template-tag-accordion-group").forEach((groupElement) => {
    groupElement.open = false;
  });
}

function setGeneratedObjectSourcePickerVisibility(pickerElement, objectType, isVisible, tagDefinitions = []) {
  if (!(pickerElement instanceof HTMLElement)) {
    return;
  }

  const normalizedType = normalizeGeneratedObjectType(objectType || pickerElement.dataset.examlistGeneratedObjectType);
  const pickerTitle = pickerElement.querySelector("[data-examlist-generated-object-source-picker-title]");

  pickerElement.dataset.examlistGeneratedObjectType = normalizedType;

  if (pickerTitle) {
    pickerTitle.textContent = normalizedType === "qrcode" ? "QR코드 데이터" : "바코드 데이터";
  }

  pickerElement.classList.toggle("hidden", !isVisible);
  pickerElement.setAttribute("aria-hidden", isVisible ? "false" : "true");

  if (isVisible) {
    const defaultSourceKey = renderGeneratedObjectSourcePickerOptions(pickerElement, normalizedType, tagDefinitions);
    const firstSummary = pickerElement.querySelector(".template-tag-accordion-summary");

    syncGeneratedObjectSourcePickerSelection(pickerElement, defaultSourceKey);
    closeGeneratedObjectSourceGroups(pickerElement);

    window.requestAnimationFrame(() => {
      firstSummary?.focus?.({ preventScroll: true });
    });
  }
}

function syncGeneratedObjectSourcePickerSelection(pickerElement, sourceKey) {
  const normalizedSourceKey = normalizeGeneratedObjectSourceKey(sourceKey);

  if (pickerElement instanceof HTMLElement) {
    pickerElement.dataset.examlistGeneratedObjectSourceKey = normalizedSourceKey;
  }

  pickerElement?.querySelectorAll?.("[data-examlist-generated-object-source-option]").forEach((optionElement) => {
    const isSelected = optionElement.getAttribute("data-examlist-generated-object-source-option") === normalizedSourceKey;

    optionElement.classList.toggle("selected", isSelected);
    optionElement.setAttribute("aria-selected", isSelected ? "true" : "false");
  });
}

export function bindGeneratedObjectSourceControl({ editor, surfaceElement, tagDefinitions, toolbarHost }) {
  if (!editor || !surfaceElement || !toolbarHost) {
    return null;
  }

  document.querySelectorAll(".examlist-generated-object-source-modal").forEach((element) => element.remove());

  const barcodeButton = toolbarHost.querySelector('[data-template-insert="barcode"]');
  const insertSection = barcodeButton?.closest?.(".template-toolbar-section") || null;
  const insertGroup = insertSection?.closest?.(".template-toolbar-group") || null;

  if (!barcodeButton || !insertSection || !insertGroup) {
    return null;
  }

  const pickerElement = createGeneratedObjectSourcePicker(tagDefinitions);

  document.body.append(pickerElement);

  const handleSelectionChange = () => {
    rememberGeneratedObjectSelection(surfaceElement);
  };
  const handlePointerDown = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const activeToolbarHost = document.getElementById("templateEditorToolbarHost");

    if (
      target?.closest?.('[data-template-insert="barcode"], [data-template-insert="qrcode"]') &&
      (toolbarHost.contains(target) || activeToolbarHost?.contains(target))
    ) {
      rememberGeneratedObjectSelection(surfaceElement);
    }
  };
  const hidePicker = () => {
    setGeneratedObjectSourcePickerVisibility(pickerElement, pickerElement.dataset.examlistGeneratedObjectType, false, tagDefinitions);
  };
  const insertGeneratedObject = (objectType, objectSourceKey) => {
    const normalizedSourceKey = normalizeGeneratedObjectSourceKey(objectSourceKey);
    const canRestoreSelection = canRestoreGeneratedObjectSelection(surfaceElement);
    const insertionSurfaceElement = getGeneratedObjectInsertionSurface(surfaceElement);
    const savedRange = editor.state?.templateEditor?.savedRange || null;
    const hasUsableEditorSavedRange = isRangeInsideElement(savedRange, insertionSurfaceElement);

    syncGeneratedObjectSourcePickerSelection(pickerElement, normalizedSourceKey);

    if (editor.state?.templateEditor && canRestoreSelection && !hasUsableEditorSavedRange) {
      editor.state.templateEditor.savedRange = lastGeneratedObjectSelectionRange.cloneRange();
    }

    if (canRestoreSelection && !hasUsableEditorSavedRange) {
      restoreGeneratedObjectSelection(surfaceElement);
    }

    editor.insertHtml?.(buildGeneratedObjectMarkup(objectType, normalizedSourceKey, {
      previewRecord: buildGeneratedObjectPreviewData(tagDefinitions),
    }));
    hidePicker();
  };
  const handleToolbarClick = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const insertButton = target?.closest?.('[data-template-insert="barcode"], [data-template-insert="qrcode"]') || null;
    const activeToolbarHost = document.getElementById("templateEditorToolbarHost");

    if (!insertButton || (!toolbarHost.contains(insertButton) && !activeToolbarHost?.contains(insertButton))) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const objectType = normalizeGeneratedObjectType(insertButton.dataset.templateInsert);

    setGeneratedObjectSourcePickerVisibility(
      pickerElement,
      objectType,
      pickerElement.classList.contains("hidden") || pickerElement.dataset.examlistGeneratedObjectType !== objectType,
      tagDefinitions,
    );
  };
  const handleModalClick = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const optionButton = target?.closest?.("[data-examlist-generated-object-source-option]") || null;

    if (optionButton && pickerElement.contains(optionButton)) {
      event.preventDefault();
      insertGeneratedObject(
        normalizeGeneratedObjectType(pickerElement.dataset.examlistGeneratedObjectType),
        optionButton.getAttribute("data-examlist-generated-object-source-option"),
      );
      return;
    }

    if (target === pickerElement || target?.closest?.("[data-examlist-generated-object-source-close]")) {
      event.preventDefault();
      hidePicker();
    }
  };
  const handleKeyDown = (event) => {
    if (event.key === "Escape" && !pickerElement.classList.contains("hidden")) {
      event.preventDefault();
      hidePicker();
    }
  };

  toolbarHost.addEventListener("pointerdown", handlePointerDown, true);
  toolbarHost.addEventListener("click", handleToolbarClick, true);
  document.addEventListener("pointerdown", handlePointerDown, true);
  document.addEventListener("click", handleToolbarClick, true);
  pickerElement.addEventListener("click", handleModalClick);
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("selectionchange", handleSelectionChange);

  return () => {
    toolbarHost.removeEventListener("pointerdown", handlePointerDown, true);
    toolbarHost.removeEventListener("click", handleToolbarClick, true);
    document.removeEventListener("pointerdown", handlePointerDown, true);
    document.removeEventListener("click", handleToolbarClick, true);
    pickerElement.removeEventListener("click", handleModalClick);
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("selectionchange", handleSelectionChange);
    pickerElement.remove();
  };
}
