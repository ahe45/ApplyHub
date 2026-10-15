import {
  getObjectAlignmentElements,
  getSelectedObjectAlignmentElements,
  isObjectAlignmentElement,
  isObjectAlignmentTableElement,
  syncObjectAlignmentTableFlow,
} from "./object-alignment-metrics.js";

function hideObjectAlignmentImageOverlay(surfaceElement) {
  const overlayRoot = surfaceElement?.closest?.(".template-editor-page") || surfaceElement;

  overlayRoot
    ?.querySelectorAll?.(".template-editor-image-selection")
    ?.forEach((overlayElement) => {
      overlayElement.classList.add("hidden");
      overlayElement.classList.remove("is-resizing");
    });
}

function hideObjectAlignmentTableOverlay(surfaceElement) {
  surfaceElement
    ?.closest?.(".template-editor-page")
    ?.querySelectorAll?.(".template-editor-table-selection")
    ?.forEach((overlayElement) => {
      overlayElement.classList.add("hidden");
      overlayElement.classList.remove("is-selected", "is-hover-only", "is-moving", "is-resizing");
      overlayElement.__templateEditorTableElement = null;
    });
}

function setObjectAlignmentEditorSelection(editor, surfaceElement, selectedElements) {
  const selectedImageElements = selectedElements.filter((element) => element instanceof HTMLImageElement);
  const selectedTableElements = selectedElements.filter((element) => isObjectAlignmentTableElement(element, surfaceElement));
  const isMultiSelection = selectedElements.length > 1;
  const activeSelectedImage = !isMultiSelection && selectedImageElements.length === 1 ? selectedImageElements[0] : null;
  const activeSelectedTable = !isMultiSelection && selectedTableElements.length === 1 ? selectedTableElements[0] : null;

  surfaceElement?.classList?.toggle?.("has-multiple-object-selection", isMultiSelection);

  if (editor?.state?.templateEditor) {
    editor.state.templateEditor.selectedImageElement = activeSelectedImage;
    editor.state.templateEditor.selectedTableElement = activeSelectedTable;
  }

  if (activeSelectedImage) {
    editor?.updateImageSelectionOverlay?.();
  } else {
    hideObjectAlignmentImageOverlay(surfaceElement);
  }

  if (activeSelectedTable) {
    editor?.updateTableObjectOverlay?.();
  } else {
    hideObjectAlignmentTableOverlay(surfaceElement);
  }
}

export function clearObjectAlignmentSelection(editor, surfaceElement, selectedElements = getSelectedObjectAlignmentElements(surfaceElement)) {
  selectedElements.forEach((element) => {
    element.classList.remove("is-selected-object", "is-selected-table-object", "is-moving-object", "is-cell-contained-object");
  });
  setObjectAlignmentEditorSelection(editor, surfaceElement, []);
}

export function applyObjectAlignmentSelection(editor, surfaceElement, selectedElements) {
  const normalizedElements = Array.from(new Set(selectedElements)).filter(
    (element) => isObjectAlignmentElement(element, surfaceElement),
  );

  getObjectAlignmentElements(surfaceElement).forEach((element) => {
    const isSelected = normalizedElements.includes(element);
    const isTableElement = isObjectAlignmentTableElement(element, surfaceElement);

    element.classList.toggle("is-selected-object", isSelected);
    element.classList.toggle("is-selected-table-object", isSelected && isTableElement);
    element.classList.toggle("is-cell-contained-object", isSelected && !isTableElement && Boolean(element.closest("td, th")));
    element.classList.remove("is-moving-object");
  });
  setObjectAlignmentEditorSelection(editor, surfaceElement, normalizedElements);
}

export function syncObjectAlignmentMutation(editor, surfaceElement, selectedElements) {
  const selectionSnapshots = selectedElements.map((element) => {
    const type = element instanceof HTMLTableElement ? "table" : "image";
    const modalSurfaceId =
      element.closest?.("[data-candidate-block-modal-editor-surface]")?.dataset?.candidateBlockEditorSurfaceId || "";
    const peers = getObjectAlignmentElements(surfaceElement).filter(
      (candidate) =>
        (candidate instanceof HTMLTableElement ? "table" : "image") === type &&
        (candidate.closest?.("[data-candidate-block-modal-editor-surface]")?.dataset?.candidateBlockEditorSurfaceId || "") ===
          modalSurfaceId,
    );

    return { index: peers.indexOf(element), modalSurfaceId, type };
  });
  const resolveSelectedElements = () => {
    const currentElements = getObjectAlignmentElements(surfaceElement);

    return selectionSnapshots
      .map((snapshot) => {
        const peers = currentElements.filter(
          (candidate) =>
            (candidate instanceof HTMLTableElement ? "table" : "image") === snapshot.type &&
            (candidate.closest?.("[data-candidate-block-modal-editor-surface]")?.dataset?.candidateBlockEditorSurfaceId || "") ===
              snapshot.modalSurfaceId,
        );
        return peers[snapshot.index] || null;
      })
      .filter(Boolean);
  };

  [...selectedElements]
    .sort((leftElement, rightElement) => {
      const leftRect = leftElement?.getBoundingClientRect?.();
      const rightRect = rightElement?.getBoundingClientRect?.();

      return (leftRect?.top || 0) - (rightRect?.top || 0) || (leftRect?.left || 0) - (rightRect?.left || 0);
    })
    .forEach((element) => {
      syncObjectAlignmentTableFlow(element, surfaceElement);
    });
  applyObjectAlignmentSelection(editor, surfaceElement, selectedElements);
  // Object toolbar mutations call editor.sync directly. Keep this update local so
  // app-level document normalization does not strip the visual object selection.
  surfaceElement?.dispatchEvent(new Event("input"));

  if (typeof editor?.sync === "function") {
    editor.sync({ preserveSelection: false });
  }

  window.requestAnimationFrame(() => {
    applyObjectAlignmentSelection(editor, surfaceElement, resolveSelectedElements());
  });
}
