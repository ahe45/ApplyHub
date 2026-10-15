import {
  normalizeFontSizeValue,
} from "./editor-text-control-config.js";
import {
  getClosestEditorTextBlock,
  getRestorableEditorTextControlSelection,
  getSelectedTableCells,
  getSelectionRangeInsideSurface,
  rememberEditorTextControlSelection,
} from "./editor-text-selection.js";
import { positionFontSizeSection } from "./editor-text-toolbar-layout.js";

const cssPixelsPerPoint = 96 / 72;

function getPointFontSizeValue(computedFontSize = "", fallbackValue = 11) {
  const parsedValue = Number.parseFloat(computedFontSize);

  if (!Number.isFinite(parsedValue)) {
    return fallbackValue;
  }

  return Math.round(parsedValue / cssPixelsPerPoint);
}

function getFontSizeCandidates(surfaceElement) {
  const selectedCells = getSelectedTableCells(surfaceElement);

  if (selectedCells.length) {
    return selectedCells;
  }

  const activeRange = getSelectionRangeInsideSurface(surfaceElement) || getRestorableEditorTextControlSelection(surfaceElement);

  if (!surfaceElement || !activeRange) {
    return [];
  }

  if (activeRange.collapsed) {
    return [getClosestEditorTextBlock(surfaceElement, activeRange.startContainer)].filter(Boolean);
  }

  return Array.from(surfaceElement.querySelectorAll("span,font,b,strong,em,i,u,p,h1,h2,h3,li,blockquote,td,th,div"))
    .filter((element) => element !== surfaceElement && !element.classList.contains("template-doc"))
    .filter((element) => {
      try {
        return activeRange.intersectsNode(element);
      } catch (_error) {
        return false;
      }
    });
}

function getCurrentFontSizeValue(surfaceElement, inputElement) {
  const fallbackValue = Number(inputElement?.value) || 11;
  const candidates = getFontSizeCandidates(surfaceElement);
  const explicitTarget = candidates.find((element) => String(element.style?.fontSize || "").trim());
  const target = explicitTarget || candidates[0] || null;
  const computedFontSize = target ? window.getComputedStyle(target).fontSize : "";

  return normalizeFontSizeValue(getPointFontSizeValue(computedFontSize, fallbackValue), fallbackValue);
}

export function bindFontSizeStepper({ editor, surfaceElement, toolbarHost }) {
  positionFontSizeSection(toolbarHost);

  const fontSizeCombo = toolbarHost?.querySelector?.(".template-toolbar-font-size-combo");
  const fontSizeInput = fontSizeCombo?.querySelector?.(".template-toolbar-font-size-input");

  if (!editor || !surfaceElement || !fontSizeCombo || !fontSizeInput) {
    return null;
  }

  fontSizeCombo.querySelector(".examlist-font-size-stepper-controls")?.remove();
  fontSizeCombo.classList.add("examlist-font-size-combo");

  const syncFontSizeControlValue = (rawFontSizeValue = fontSizeInput.value) => {
    const fontSizeValue = normalizeFontSizeValue(rawFontSizeValue, getCurrentFontSizeValue(surfaceElement, fontSizeInput));
    const valueElement = fontSizeCombo.querySelector("[data-editor-font-size-current]");

    fontSizeInput.value = fontSizeValue;
    fontSizeInput.dataset.templateEditorCurrentFontSize = `${fontSizeValue}pt`;

    if (valueElement) {
      valueElement.textContent = fontSizeValue;
    }

    fontSizeCombo.querySelectorAll("[data-editor-font-size-option], [data-font-size-option]").forEach((optionElement) => {
      const optionValue = optionElement.dataset.editorFontSizeOption || optionElement.dataset.fontSizeOption || "";
      const isActive = optionValue === fontSizeValue;

      optionElement.classList.toggle("active", isActive);
      optionElement.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  };
  const handlePointerDown = () => {
    rememberEditorTextControlSelection(surfaceElement);
    syncFontSizeControlValue(getCurrentFontSizeValue(surfaceElement, fontSizeInput));
  };

  fontSizeCombo.addEventListener("pointerdown", handlePointerDown, true);
  syncFontSizeControlValue(fontSizeInput.value);

  return () => {
    fontSizeCombo.removeEventListener("pointerdown", handlePointerDown, true);
    fontSizeCombo.classList.remove("examlist-font-size-combo");
  };
}
