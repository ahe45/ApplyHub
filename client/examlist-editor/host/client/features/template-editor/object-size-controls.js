import { showToast } from "../../app/toast.js";
import { candidateBlockGridMinimumHeight } from "./candidate-block-grid-config.js";
import { writeCandidateBlockGridSizeToConfig } from "./candidate-block-grid-sessions.js";
import { normalizeCandidateBlockTables } from "./candidate-block-grid-table-normalizer.js";
import {
  clampObjectAlignmentValue,
  getObjectAlignmentCanvasMetrics,
  getObjectAlignmentDocumentElement,
  getObjectCandidateBlockModalElement,
  getObjectCandidateBlockVisualScale,
  getObjectElementSize,
  getObjectTableCellContentSize,
  getObjectTableCellElement,
  getSelectedObjectAlignmentElements,
  isObjectAlignmentTableElement,
  isObjectEditorReadOnly,
  prepareObjectAlignmentItems,
  setObjectAlignmentItemPosition,
  syncObjectAlignmentTableFlow,
  syncObjectAlignmentMutation,
} from "./object-alignment-runtime.js";
import { templateEditorObjectMinimumSize } from "./object-toolbar-constants.js";
import {
  getCandidateBlockGridMinimumSize,
  getCandidateBlockModalContentSize,
  getObjectTableColumnWidths,
  getObjectTableRenderedTargetWidth,
  getObjectTableRowHeights,
} from "./object-size-measurements.js";
import { normalizeObjectTableSegmentSizes } from "./object-size-table-segments.js";
import {
  normalizeObjectSizeInputValue,
  parseObjectSizePixelValue,
} from "./object-size-values.js";
import { createObjectSizeToolbar, insertObjectToolbarSection } from "./object-toolbar-ui.js";

function isCandidateBlockGridSizeElement(element, surfaceElement) {
  return Boolean(
    element instanceof HTMLElement &&
      element.matches?.("[data-candidate-block-grid], .examlist-candidate-block-grid") &&
      element.classList.contains("is-selected-candidate-block-grid") &&
      surfaceElement?.contains?.(element) &&
      element.closest?.(".template-doc") &&
      !getObjectCandidateBlockModalElement(element, surfaceElement),
  );
}

function getSelectedCandidateBlockGridSizeElements(surfaceElement) {
  if (!surfaceElement?.querySelectorAll) {
    return [];
  }

  return Array.from(
    surfaceElement.querySelectorAll("[data-candidate-block-grid].is-selected-candidate-block-grid, .examlist-candidate-block-grid.is-selected-candidate-block-grid"),
  ).filter((element) => isCandidateBlockGridSizeElement(element, surfaceElement));
}

function getObjectSizeSelectedElements(surfaceElement) {
  return Array.from(
    new Set([
      ...getSelectedObjectAlignmentElements(surfaceElement),
      ...getSelectedCandidateBlockGridSizeElements(surfaceElement),
    ]),
  );
}

function lockObjectTableCellHeight(cellElement) {
  if (!(cellElement instanceof HTMLElement)) {
    return;
  }

  const cellRect = cellElement.getBoundingClientRect();
  const visualScale = getObjectCandidateBlockVisualScale(cellElement);
  const scaleY = Math.max(visualScale.y || 1, 0.01);
  const rowElement = cellElement.parentElement;
  const cellHeight = Math.max(
    templateEditorObjectMinimumSize,
    Math.round((cellRect.height ? cellRect.height / scaleY : 0) || cellElement.offsetHeight || 0),
  );

  if (cellHeight > 0) {
    cellElement.style.height = `${cellHeight}px`;
  }

  if (rowElement instanceof HTMLTableRowElement && Number(cellElement.rowSpan || 1) <= 1) {
    const rowRect = rowElement.getBoundingClientRect();
    const rowHeight = Math.max(
      cellHeight,
      Math.round((rowRect.height ? rowRect.height / scaleY : 0) || rowElement.offsetHeight || 0),
    );

    if (rowHeight > 0) {
      rowElement.style.height = `${rowHeight}px`;
      Array.from(rowElement.cells || []).forEach((rowCellElement) => {
        rowCellElement.style.height = `${rowHeight}px`;
      });
    }
  }
}

function getObjectTableUtils() {
  return window.ExamListEditorTableUtils || null;
}

function applyCandidateBlockModalObjectSize(element, surfaceElement, { hasHeight, hasWidth, height = null, width = null } = {}) {
  const modalSurfaceElement = getObjectCandidateBlockModalElement(element, surfaceElement);
  const modalSize = getCandidateBlockModalContentSize(modalSurfaceElement);

  if (!(element instanceof HTMLElement) || !modalSize) {
    return null;
  }

  const currentSize = getObjectElementSize(element, surfaceElement);
  const nextWidth = Math.min(
    modalSize.width,
    Math.max(templateEditorObjectMinimumSize, hasWidth ? width : currentSize.width),
  );
  const nextHeight = Math.min(
    modalSize.height,
    Math.max(templateEditorObjectMinimumSize, hasHeight ? height : currentSize.height),
  );

  element.style.width = `${nextWidth}px`;
  element.style.height = `${nextHeight}px`;
  element.style.maxWidth = "100%";
  element.style.maxHeight = "100%";
  element.style.margin = "0";

  if (String(element.style.position || "").trim() === "absolute") {
    const left = parseObjectSizePixelValue(element.style.left, element.offsetLeft || 0);
    const top = parseObjectSizePixelValue(element.style.top, element.offsetTop || 0);

    element.style.left = `${Math.max(0, Math.min(left, modalSize.width - nextWidth))}px`;
    element.style.top = `${Math.max(0, Math.min(top, modalSize.height - nextHeight))}px`;
  } else {
    element.style.display = "inline-block";

    if (!String(element.style.verticalAlign || "").trim()) {
      element.style.verticalAlign = "top";
    }
  }

  return modalSurfaceElement;
}

function syncCandidateBlockModalObjectMutations(modalSurfaceElements) {
  const uniqueModalSurfaceElements = Array.from(new Set(modalSurfaceElements)).filter(Boolean);

  uniqueModalSurfaceElements.forEach((modalSurfaceElement) => {
    modalSurfaceElement.dispatchEvent(new Event("input", { bubbles: true }));
  });

  if (uniqueModalSurfaceElements.length && typeof window.ExamListCandidateBlockModalEditor?.syncActiveEditor === "function") {
    window.ExamListCandidateBlockModalEditor.syncActiveEditor({ markDirty: true });
  }
}

function syncObjectTableRowGroupHeights(tableElement, rowHeights) {
  const rowIndexByElement = new Map(Array.from(tableElement.rows || []).map((rowElement, rowIndex) => [rowElement, rowIndex]));
  const rowGroups = [
    tableElement.tHead,
    ...Array.from(tableElement.tBodies || []),
    tableElement.tFoot,
  ].filter(Boolean);

  rowGroups.forEach((rowGroupElement) => {
    const rowGroupHeight = Array.from(rowGroupElement.rows || []).reduce((heightSum, rowElement) => {
      const rowIndex = rowIndexByElement.get(rowElement);

      return heightSum + Math.max(0, rowHeights[rowIndex] || 0);
    }, 0);

    if (rowGroupHeight > 0) {
      rowGroupElement.style.height = `${rowGroupHeight}px`;
    }
  });
}

function applyObjectTableWidth(tableElement, targetWidth) {
  const tableUtils = getObjectTableUtils();
  const renderedTargetWidth = getObjectTableRenderedTargetWidth(tableElement, targetWidth);

  if (!(tableElement instanceof HTMLTableElement) || !tableUtils?.ensureTemplateEditorTableColGroup) {
    tableElement.style.width = `${renderedTargetWidth}px`;
    tableElement.style.maxWidth = "none";
    return true;
  }

  const { columns, cellMap } = tableUtils.ensureTemplateEditorTableColGroup(tableElement);

  if (!columns.length) {
    tableElement.style.width = `${renderedTargetWidth}px`;
    tableElement.style.maxWidth = "none";
    return true;
  }

  const nextWidths = normalizeObjectTableSegmentSizes(
    getObjectTableColumnWidths(tableElement, columns, cellMap, tableUtils),
    renderedTargetWidth,
    templateEditorObjectMinimumSize,
  );

  columns.forEach((columnElement, columnIndex) => {
    columnElement.style.width = `${nextWidths[columnIndex] || templateEditorObjectMinimumSize}px`;
  });

  tableUtils.buildTemplateTableCellMap?.(tableElement)?.entries?.forEach((entry, cellElement) => {
    const cellWidth = nextWidths
      .slice(entry.colIndex, entry.colIndex + entry.colSpan)
      .reduce((widthSum, widthValue) => widthSum + Math.max(0, widthValue || 0), 0);

    if (cellWidth > 0) {
      cellElement.style.width = `${cellWidth}px`;
    }
  });

  tableUtils.syncTemplateEditorTableWidth?.(tableElement, columns);
  tableElement.style.maxWidth = "none";
  return true;
}

function applyObjectTableHeight(tableElement, targetHeight) {
  const tableUtils = getObjectTableUtils();
  const rows = Array.from(tableElement?.rows || []);

  if (!(tableElement instanceof HTMLTableElement) || !rows.length) {
    tableElement.style.height = `${Math.max(templateEditorObjectMinimumSize, Math.round(targetHeight) || 0)}px`;
    return true;
  }

  const nextHeights = normalizeObjectTableSegmentSizes(
    getObjectTableRowHeights(tableElement),
    targetHeight,
    templateEditorObjectMinimumSize,
  );

  rows.forEach((rowElement, rowIndex) => {
    rowElement.style.height = `${nextHeights[rowIndex] || templateEditorObjectMinimumSize}px`;
  });

  tableUtils?.buildTemplateTableCellMap?.(tableElement)?.entries?.forEach((entry, cellElement) => {
    const cellHeight = nextHeights
      .slice(entry.rowIndex, entry.rowIndex + entry.rowSpan)
      .reduce((heightSum, heightValue) => heightSum + Math.max(0, heightValue || 0), 0);

    if (cellHeight > 0) {
      cellElement.style.height = `${cellHeight}px`;
      cellElement.style.minHeight = `${cellHeight}px`;
    }
  });

  syncObjectTableRowGroupHeights(tableElement, nextHeights);
  tableElement.style.height = `${nextHeights.reduce((heightSum, heightValue) => heightSum + Math.max(0, heightValue || 0), 0)}px`;
  return true;
}

export function applyObjectTableSize(tableElement, { height = null, width = null } = {}) {
  let didApply = false;

  if (Number.isFinite(width)) {
    didApply = applyObjectTableWidth(tableElement, width) || didApply;
  }

  if (Number.isFinite(height)) {
    didApply = applyObjectTableHeight(tableElement, height) || didApply;
  }

  return didApply;
}

function getObjectDocumentLogicalPosition(element, documentElement, canvasMetrics) {
  if (!(element instanceof HTMLElement) || !(documentElement instanceof HTMLElement)) {
    return { left: 0, top: 0 };
  }

  if (String(element.style.position || "").trim() === "absolute") {
    return {
      left: parseObjectSizePixelValue(element.style.left, element.offsetLeft || 0),
      top: parseObjectSizePixelValue(element.style.top, element.offsetTop || 0),
    };
  }

  const elementRect = element.getBoundingClientRect();
  const documentRect = canvasMetrics?.rect || documentElement.getBoundingClientRect();
  const scaleX = Math.max(canvasMetrics?.scaleX || 1, 0.01);
  const scaleY = Math.max(canvasMetrics?.scaleY || 1, 0.01);

  return {
    left: Math.max(0, Math.round((elementRect.left - documentRect.left) / scaleX)),
    top: Math.max(0, Math.round((elementRect.top - documentRect.top) / scaleY)),
  };
}

function applyCandidateBlockGridObjectSize(gridElement, selectedPage, documentElement, canvasMetrics, { hasHeight, hasWidth, height = null, width = null } = {}) {
  if (!isCandidateBlockGridSizeElement(gridElement, documentElement)) {
    return false;
  }

  normalizeCandidateBlockTables(gridElement);

  const currentSize = getObjectElementSize(gridElement, documentElement);
  const position = getObjectDocumentLogicalPosition(gridElement, documentElement, canvasMetrics);
  const minimumSize = getCandidateBlockGridMinimumSize(gridElement);
  const maxWidth = Math.max(minimumSize.width, (documentElement?.clientWidth || canvasMetrics?.width || currentSize.width) - position.left);
  const maxHeight = Math.max(minimumSize.height, (documentElement?.clientHeight || canvasMetrics?.height || currentSize.height) - position.top);
  const nextWidth = Math.min(
    maxWidth,
    Math.max(minimumSize.width, hasWidth ? width : currentSize.width),
  );
  const nextHeight = Math.min(
    maxHeight,
    Math.max(minimumSize.height, hasHeight ? height : currentSize.height),
  );

  if (hasWidth) {
    gridElement.style.width = `${nextWidth}px`;
  }

  if (hasHeight) {
    gridElement.style.height = `${nextHeight}px`;
  }

  gridElement.style.maxWidth = "none";

  if (minimumSize.height < candidateBlockGridMinimumHeight) {
    gridElement.style.minHeight = `${minimumSize.height}px`;
  }

  normalizeCandidateBlockTables(gridElement);
  writeCandidateBlockGridSizeToConfig(selectedPage, gridElement);
  const InputEventConstructor = window.InputEvent || window.Event;

  try {
    gridElement.dispatchEvent(new InputEventConstructor("input", { bubbles: true, inputType: "formatSetBlockTextDirection", data: null }));
  } catch (_error) {
    gridElement.dispatchEvent(new window.Event("input", { bubbles: true }));
  }
  return true;
}

function applyObjectSizeToSelection(editor, surfaceElement, selectedPage, { height = null, onDirty = null, width = null } = {}) {
  const selectedElements = getObjectSizeSelectedElements(surfaceElement);

  if (!selectedElements.length) {
    showToast("크기를 변경할 개체를 선택해 주세요.", "warning");
    return false;
  }

  const hasWidth = Number.isFinite(width);
  const hasHeight = Number.isFinite(height);

  if (!hasWidth && !hasHeight) {
    showToast("가로 또는 세로 크기를 입력해 주세요.", "warning");
    return false;
  }

  const documentElement = getObjectAlignmentDocumentElement(surfaceElement);

  if (!(documentElement instanceof HTMLElement)) {
    showToast("크기 기준이 되는 캔버스를 찾을 수 없습니다.", "warning");
    return false;
  }

  const canvasMetrics = getObjectAlignmentCanvasMetrics(documentElement);
  const candidateBlockGridElements = selectedElements.filter((element) => isCandidateBlockGridSizeElement(element, surfaceElement));
  const tableElements = selectedElements.filter((element) => isObjectAlignmentTableElement(element, surfaceElement));
  const modalTableElements = tableElements.filter((element) => getObjectCandidateBlockModalElement(element, surfaceElement));
  const cellElements = selectedElements.filter(
    (element) =>
      !tableElements.includes(element) &&
      !candidateBlockGridElements.includes(element) &&
      getObjectTableCellElement(element, surfaceElement),
  );
  const candidateBlockModalElements = selectedElements.filter(
    (element) =>
      !tableElements.includes(element) &&
      !getObjectTableCellElement(element, surfaceElement) &&
      getObjectCandidateBlockModalElement(element, surfaceElement),
  );
  const canvasElements = selectedElements.filter(
    (element) =>
      !candidateBlockGridElements.includes(element) &&
      !getObjectTableCellElement(element, surfaceElement) &&
      !getObjectCandidateBlockModalElement(element, surfaceElement),
  );
  const items = prepareObjectAlignmentItems(canvasElements, documentElement, canvasMetrics);

  if (!items.length && !cellElements.length && !candidateBlockModalElements.length && !modalTableElements.length && !candidateBlockGridElements.length) {
    showToast("크기를 변경할 개체를 선택해 주세요.", "warning");
    return false;
  }

  cellElements.forEach((element) => {
    const cellElement = getObjectTableCellElement(element, surfaceElement);
    const cellSize = getObjectTableCellContentSize(element, surfaceElement, templateEditorObjectMinimumSize);
    const currentSize = getObjectElementSize(element, surfaceElement);
    const maxWidth = Math.max(templateEditorObjectMinimumSize, cellSize?.width || templateEditorObjectMinimumSize);
    const maxHeight = Math.max(templateEditorObjectMinimumSize, cellSize?.height || templateEditorObjectMinimumSize);
    const nextWidth = Math.min(
      maxWidth,
      Math.max(templateEditorObjectMinimumSize, hasWidth ? width : currentSize.width),
    );
    const nextHeight = Math.min(
      maxHeight,
      Math.max(templateEditorObjectMinimumSize, hasHeight ? height : currentSize.height),
    );

    lockObjectTableCellHeight(cellElement);
    element.style.display = "inline-block";
    element.style.width = `${nextWidth}px`;
    element.style.height = `${nextHeight}px`;
    element.style.maxWidth = "100%";
    element.style.maxHeight = `${nextHeight}px`;
    element.style.margin = "0";

    if (!String(element.style.verticalAlign || "").trim()) {
      element.style.verticalAlign = "top";
    }
  });

  const changedModalSurfaceElements = candidateBlockModalElements
    .map((element) =>
      applyCandidateBlockModalObjectSize(element, surfaceElement, {
        hasHeight,
        hasWidth,
        height,
        width,
      }),
    )
    .filter(Boolean);

  const changedModalTableSurfaceElements = modalTableElements
    .map((tableElement) => {
      const didApply = applyObjectTableSize(tableElement, {
        height: hasHeight ? Math.max(templateEditorObjectMinimumSize, height) : null,
        width: hasWidth ? Math.max(templateEditorObjectMinimumSize, width) : null,
      });

      return didApply ? getObjectCandidateBlockModalElement(tableElement, surfaceElement) : null;
    })
    .filter(Boolean);

  const didApplyCandidateBlockGridSize = candidateBlockGridElements.some((gridElement) =>
    applyCandidateBlockGridObjectSize(gridElement, selectedPage, documentElement, canvasMetrics, {
      hasHeight,
      hasWidth,
      height,
      width,
    }),
  );

  items.forEach((item) => {
    const nextWidth = hasWidth
      ? clampObjectAlignmentValue(width, Math.max(templateEditorObjectMinimumSize, canvasMetrics.width - item.left))
      : item.width;
    const nextHeight = hasHeight
      ? clampObjectAlignmentValue(height, Math.max(templateEditorObjectMinimumSize, canvasMetrics.height - item.top))
      : item.height;

    if (isObjectAlignmentTableElement(item.element, surfaceElement)) {
      applyObjectTableSize(item.element, {
        height: hasHeight ? Math.max(templateEditorObjectMinimumSize, nextHeight) : null,
        width: hasWidth ? Math.max(templateEditorObjectMinimumSize, nextWidth) : null,
      });

      const actualSize = getObjectElementSize(item.element, surfaceElement);

      item.width = actualSize.width;
      item.height = actualSize.height;
    } else {
      item.width = Math.max(templateEditorObjectMinimumSize, nextWidth);
      item.height = Math.max(templateEditorObjectMinimumSize, nextHeight);
      item.element.style.width = `${item.width}px`;
      item.element.style.height = `${item.height}px`;
    }

    setObjectAlignmentItemPosition(item, item.left, item.top, canvasMetrics);
    syncObjectAlignmentTableFlow(item.element, surfaceElement, {
      height: item.height,
      top: item.top,
    });
  });

  syncCandidateBlockModalObjectMutations([
    ...changedModalSurfaceElements,
    ...changedModalTableSurfaceElements,
  ]);
  const objectAlignmentMutationElements = [
    ...cellElements,
    ...candidateBlockModalElements,
    ...modalTableElements,
    ...items.map((item) => item.element),
  ];

  // Candidate-block grids are persisted by the dedicated dirty callback,
  // which also restores their selection after the editor re-renders. Running
  // the generic image/table sync with an empty selection first would clear the
  // grid selection and disable the size fields after the first change.
  if (objectAlignmentMutationElements.length) {
    syncObjectAlignmentMutation(editor, surfaceElement, objectAlignmentMutationElements);
  }

  if (didApplyCandidateBlockGridSize && typeof onDirty === "function") {
    onDirty();
  }
  return true;
}


export function bindObjectSizeControls({ editor, onDirty = null, selectedPage = null, surfaceElement, toolbarHost }) {
  if (!editor || !surfaceElement || !toolbarHost) {
    return null;
  }

  toolbarHost.querySelector(".examlist-object-size-control")?.remove();

  const sizeToolbar = createObjectSizeToolbar();
  insertObjectToolbarSection(toolbarHost, sizeToolbar, ".examlist-object-insert-control");

  const widthInput = sizeToolbar.querySelector('[data-examlist-object-size="width"]');
  const heightInput = sizeToolbar.querySelector('[data-examlist-object-size="height"]');
  const manualEditingInputs = new WeakSet();
  const committedInputValues = new WeakMap();
  const getInputs = () => [widthInput, heightInput].filter(Boolean);
  const markManualEditingInput = (input) => {
    if (!input) {
      return;
    }

    manualEditingInputs.add(input);
    window.setTimeout(() => {
      manualEditingInputs.delete(input);
    }, 0);
  };
  const isManualEditingKey = (event) =>
    Boolean(
      event.key === "Backspace" ||
        event.key === "Delete" ||
        ((event.ctrlKey || event.metaKey) && ["v", "x"].includes(String(event.key || "").toLowerCase())) ||
        (!event.ctrlKey && !event.metaKey && !event.altKey && String(event.key || "").length === 1),
    );
  const isManualInputEvent = (event) => Boolean(String(event.inputType || ""));
  const setCommittedInputValue = (input) => {
    if (input) {
      committedInputValues.set(input, String(input.value || ""));
    }
  };
  const setSizeFieldEmptyState = (input, isEmpty) => {
    const wrap = input?.closest?.(".examlist-object-size-input-wrap") || null;
    const unitElement = wrap?.querySelector("[data-examlist-object-size-unit]") || null;

    wrap?.classList.toggle("is-empty", Boolean(isEmpty));

    if (unitElement) {
      unitElement.textContent = "px";
    }
  };
  const setControlDisabled = (isDisabled) => {
    getInputs().forEach((input) => {
      const wrap = input?.closest?.(".examlist-object-size-input-wrap") || null;

      input.disabled = isDisabled;

      if (wrap) {
        wrap.classList.toggle("is-disabled", isDisabled);
        wrap.setAttribute("aria-disabled", isDisabled ? "true" : "false");
      }
    });
  };
  const syncSizeControls = () => {
    const selectedElements = getObjectSizeSelectedElements(surfaceElement);
    const isDisabled = isObjectEditorReadOnly(surfaceElement) || selectedElements.length === 0;

    setControlDisabled(isDisabled);

    if (isDisabled) {
      getInputs().forEach((input) => {
        input.value = "";
        input.placeholder = "-";
        setCommittedInputValue(input);
        setSizeFieldEmptyState(input, true);
      });
      return;
    }

    getInputs().forEach((input) => {
      setSizeFieldEmptyState(input, false);
    });

    const sizes = selectedElements.map((element) => getObjectElementSize(element, surfaceElement));
    const firstSize = sizes[0] || { height: "", width: "" };
    const hasSameWidth = sizes.every((size) => size.width === firstSize.width);
    const hasSameHeight = sizes.every((size) => size.height === firstSize.height);

    if (widthInput && document.activeElement !== widthInput) {
      widthInput.value = hasSameWidth ? String(firstSize.width) : "";
      widthInput.placeholder = hasSameWidth ? "px" : "혼합";
      setCommittedInputValue(widthInput);
    }

    if (heightInput && document.activeElement !== heightInput) {
      heightInput.value = hasSameHeight ? String(firstSize.height) : "";
      heightInput.placeholder = hasSameHeight ? "px" : "혼합";
      setCommittedInputValue(heightInput);
    }
  };
  const scheduleSizeControlSync = () => {
    window.requestAnimationFrame(syncSizeControls);
  };
  const restoreToolbarFocus = (focusElement, selectionSnapshot) => {
    if (!focusElement?.isConnected || !sizeToolbar.contains(focusElement)) {
      return;
    }

    focusElement.focus?.({ preventScroll: true });

    if (
      selectionSnapshot &&
      typeof focusElement.setSelectionRange === "function" &&
      typeof selectionSnapshot.start === "number" &&
      typeof selectionSnapshot.end === "number"
    ) {
      focusElement.setSelectionRange(selectionSnapshot.start, selectionSnapshot.end);
    }
  };
  const applyFromControls = (changedInput = null, options = {}) => {
    if (isObjectEditorReadOnly(surfaceElement)) {
      return false;
    }

    const preserveToolbarFocus = options.preserveToolbarFocus === true;
    const focusElement =
      preserveToolbarFocus && document.activeElement instanceof HTMLElement && sizeToolbar.contains(document.activeElement)
        ? document.activeElement
        : null;
    const selectionSnapshot =
      focusElement &&
      typeof focusElement.selectionStart === "number" &&
      typeof focusElement.selectionEnd === "number"
        ? {
            start: focusElement.selectionStart,
            end: focusElement.selectionEnd,
          }
        : null;
    const nextWidth = changedInput === heightInput ? null : normalizeObjectSizeInputValue(widthInput?.value);
    const nextHeight = changedInput === widthInput ? null : normalizeObjectSizeInputValue(heightInput?.value);
    const didApply = applyObjectSizeToSelection(editor, surfaceElement, selectedPage, {
      height: nextHeight,
      onDirty,
      width: nextWidth,
    });

    if (didApply) {
      if (changedInput) {
        setCommittedInputValue(changedInput);
      } else {
        getInputs().forEach(setCommittedInputValue);
      }
      scheduleSizeControlSync();

      if (focusElement) {
        window.requestAnimationFrame(() => {
          restoreToolbarFocus(focusElement, selectionSnapshot);
        });
      }
    }

    return didApply;
  };
  const commitSizeInput = (input, options = {}) => {
    if (!input || input.disabled || !sizeToolbar.contains(input)) {
      return false;
    }

    const currentValue = String(input.value || "");

    if (options.force !== true && committedInputValues.get(input) === currentValue) {
      return false;
    }

    return applyFromControls(input, { preserveToolbarFocus: options.preserveToolbarFocus === true });
  };
  const getEventSizeInput = (event) => {
    const input = event.target?.closest?.("[data-examlist-object-size]");

    if (!input || !sizeToolbar.contains(input)) {
      return null;
    }

    return input;
  };
  const handleControlInput = (event) => {
    const input = getEventSizeInput(event);

    if (!input) {
      return;
    }

    if (manualEditingInputs.has(input) || isManualInputEvent(event)) {
      manualEditingInputs.delete(input);
      return;
    }

    commitSizeInput(input, { preserveToolbarFocus: true });
  };
  const handleControlChange = (event) => {
    const input = getEventSizeInput(event);

    if (input) {
      commitSizeInput(input);
    }
  };
  const handleFocusOut = (event) => {
    const input = getEventSizeInput(event);

    if (input) {
      manualEditingInputs.delete(input);
      commitSizeInput(input);
    }
  };
  const handleKeyDown = (event) => {
    const input = getEventSizeInput(event);

    if (!input) {
      return;
    }

    if (event.key !== "Enter") {
      if (isManualEditingKey(event)) {
        markManualEditingInput(input);
      }
      return;
    }

    event.preventDefault();
    manualEditingInputs.delete(input);
    commitSizeInput(input, { force: true, preserveToolbarFocus: true });
  };

  sizeToolbar.addEventListener("input", handleControlInput);
  sizeToolbar.addEventListener("change", handleControlChange);
  sizeToolbar.addEventListener("focusout", handleFocusOut);
  sizeToolbar.addEventListener("keydown", handleKeyDown);
  surfaceElement.addEventListener("pointerdown", scheduleSizeControlSync, true);
  surfaceElement.addEventListener("input", scheduleSizeControlSync);
  surfaceElement.addEventListener("keyup", scheduleSizeControlSync);
  document.addEventListener("selectionchange", scheduleSizeControlSync);
  window.addEventListener("pointerup", scheduleSizeControlSync);
  window.addEventListener("pointercancel", scheduleSizeControlSync);
  window.addEventListener("resize", scheduleSizeControlSync);
  syncSizeControls();

  return () => {
    sizeToolbar.removeEventListener("input", handleControlInput);
    sizeToolbar.removeEventListener("change", handleControlChange);
    sizeToolbar.removeEventListener("focusout", handleFocusOut);
    sizeToolbar.removeEventListener("keydown", handleKeyDown);
    surfaceElement.removeEventListener("pointerdown", scheduleSizeControlSync, true);
    surfaceElement.removeEventListener("input", scheduleSizeControlSync);
    surfaceElement.removeEventListener("keyup", scheduleSizeControlSync);
    document.removeEventListener("selectionchange", scheduleSizeControlSync);
    window.removeEventListener("pointerup", scheduleSizeControlSync);
    window.removeEventListener("pointercancel", scheduleSizeControlSync);
    window.removeEventListener("resize", scheduleSizeControlSync);
    sizeToolbar.remove();
  };
}
