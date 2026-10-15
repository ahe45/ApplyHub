import { showToast } from "../../app/toast.js";
import {
  getObjectAlignmentCanvasMetrics,
  getObjectAlignmentDocumentElement,
  getObjectCandidateBlockModalElement,
  getObjectTableCellElement,
  getSelectedObjectAlignmentElements,
} from "./object-alignment-metrics.js";
import {
  alignObjectsToCanvas,
  alignObjectsToSelection,
  distributeObjectAlignmentItems,
  prepareObjectAlignmentItems,
  resolveObjectAlignmentCommand,
} from "./object-alignment-positioning.js";
import { syncObjectAlignmentMutation } from "./object-alignment-selection.js";
import { alignObjectsInsideCells } from "./object-cell-alignment.js";

export function runObjectAlignmentCommand(editor, surfaceElement, command) {
  const selectedElements = getSelectedObjectAlignmentElements(surfaceElement);

  if (!selectedElements.length) {
    showToast("정렬할 개체를 선택해 주세요.", "warning");
    return false;
  }

  if (selectedElements.some((element) => getObjectTableCellElement(element, surfaceElement))) {
    if (!selectedElements.every((element) => getObjectTableCellElement(element, surfaceElement))) {
      showToast("셀 안의 개체끼리 선택해 주세요.", "warning");
      return false;
    }
    if (!alignObjectsInsideCells(selectedElements, surfaceElement, command)) return false;
    const modalSurfaces = new Set(selectedElements.map(element => getObjectCandidateBlockModalElement(element, surfaceElement)).filter(Boolean));
    if (modalSurfaces.size) {
      modalSurfaces.forEach(modal => modal.dispatchEvent(new Event("input", { bubbles: true })));
      window.ExamListCandidateBlockModalEditor?.syncActiveEditor?.({ markDirty: true });
    } else {
      syncObjectAlignmentMutation(editor, surfaceElement, selectedElements);
    }
    editor?.updateImageSelectionOverlay?.();
    return true;
  }

  if (selectedElements.some((element) => getObjectCandidateBlockModalElement(element, surfaceElement))) {
    showToast("데이터 블록 편집 영역 안의 개체는 정렬 기능을 사용할 수 없습니다.", "warning");
    return false;
  }

  const resolvedCommand = resolveObjectAlignmentCommand(command, selectedElements.length);

  if ((resolvedCommand.startsWith("selection-") || resolvedCommand.startsWith("distribute-")) && selectedElements.length < 2) {
    showToast("두 개 이상의 개체를 선택해 주세요.", "warning");
    return false;
  }

  if (resolvedCommand.startsWith("distribute-") && selectedElements.length < 3) {
    showToast("간격 맞춤은 세 개 이상의 개체를 선택해 주세요.", "warning");
    return false;
  }

  const documentElement = getObjectAlignmentDocumentElement(surfaceElement);

  if (!(documentElement instanceof HTMLElement)) {
    showToast("정렬 기준이 되는 캔버스를 찾을 수 없습니다.", "warning");
    return false;
  }

  const canvasMetrics = getObjectAlignmentCanvasMetrics(documentElement);
  const items = prepareObjectAlignmentItems(selectedElements, documentElement, canvasMetrics);

  if (!items.length) {
    showToast("정렬할 개체를 선택해 주세요.", "warning");
    return false;
  }

  if (resolvedCommand.startsWith("canvas-")) {
    alignObjectsToCanvas(items, resolvedCommand, canvasMetrics);
  } else if (resolvedCommand.startsWith("selection-")) {
    alignObjectsToSelection(items, resolvedCommand, canvasMetrics);
  } else if (resolvedCommand === "distribute-x") {
    distributeObjectAlignmentItems(items, "x", canvasMetrics);
  } else if (resolvedCommand === "distribute-y") {
    distributeObjectAlignmentItems(items, "y", canvasMetrics);
  } else {
    return false;
  }

  syncObjectAlignmentMutation(editor, surfaceElement, items.map((item) => item.element));
  return true;
}
