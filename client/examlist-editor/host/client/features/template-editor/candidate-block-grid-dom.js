import { parseCandidateBlockPixelValue } from "./candidate-block-grid-pixels.js";
import {
  normalizeCandidateBlockTables,
  normalizeCandidateBlockTemplateHtmlFromElement,
} from "./candidate-block-grid-table-normalizer.js";

export {
  normalizeCandidateBlockTables,
  normalizeCandidateBlockTemplateHtmlFromElement,
  parseCandidateBlockPixelValue,
};

export function extractCandidateBlockTemplateHtml(rootElement) {
  const blockElement = rootElement?.querySelector?.("[data-candidate-block-instance]");

  if (!(blockElement instanceof HTMLElement)) {
    return "";
  }

  return normalizeCandidateBlockTemplateHtmlFromElement(blockElement, "");
}


export function getCandidateBlockGridElements(rootElement) {
  if (!rootElement?.querySelectorAll) {
    return [];
  }

  return Array.from(
    new Set([
      ...rootElement.querySelectorAll("[data-candidate-block-grid]"),
      ...rootElement.querySelectorAll(".examlist-candidate-block-grid"),
    ]),
  );
}

function createCandidateBlockGridStoragePlaceholder(gridElement = null) {
  const placeholderElement = document.createElement("div");

  placeholderElement.className = "examlist-candidate-block-grid";
  placeholderElement.dataset.candidateBlockGrid = "true";

  return placeholderElement;
}

export function removeCandidateBlockGridFlowSpacers(rootElement) {
  rootElement?.querySelectorAll?.("[data-template-object-flow-spacer]").forEach((element) => {
    if (String(element.dataset?.templateObjectFlowKind || "").trim() === "candidate-block-grid") {
      element.remove();
    }
  });

  getCandidateBlockGridElements(rootElement).forEach((gridElement) => {
    gridElement.removeAttribute("data-template-object-flow-id");
  });
}

export function collapseCandidateBlockGridForStorage(rootElement) {
  removeCandidateBlockGridFlowSpacers(rootElement);
  const gridElements = getCandidateBlockGridElements(rootElement);

  gridElements.forEach((gridElement, index) => {
    if (!(gridElement instanceof HTMLElement)) {
      return;
    }

    if (index === 0) {
      gridElement.replaceWith(createCandidateBlockGridStoragePlaceholder(gridElement));
    } else {
      gridElement.remove();
    }
  });

  rootElement?.querySelectorAll?.(".examlist-candidate-block").forEach((blockElement) => {
    if (!blockElement.closest("[data-candidate-block-grid], .examlist-candidate-block-grid")) {
      blockElement.remove();
    }
  });
}

export function removeCandidateBlockGridElements(rootElement) {
  removeCandidateBlockGridFlowSpacers(rootElement);
  getCandidateBlockGridElements(rootElement).forEach((gridElement) => gridElement.remove());

  rootElement?.querySelectorAll?.(".examlist-candidate-block").forEach((blockElement) => {
    if (!blockElement.closest("[data-candidate-block-grid], .examlist-candidate-block-grid")) {
      blockElement.remove();
    }
  });
}

export function removeCandidateBlockGridRuntimeControls(rootElement) {
  rootElement?.querySelectorAll?.("[data-candidate-block-grid-resize-handle]").forEach((element) => element.remove());
  rootElement?.querySelectorAll?.("[data-candidate-block-grid-move-handle]").forEach((element) => element.remove());
  rootElement?.querySelectorAll?.("[data-candidate-block-focus-backdrop], .examlist-candidate-block-focus-backdrop").forEach((element) => element.remove());
  rootElement?.querySelectorAll?.("[data-candidate-block-focus-layer], .examlist-candidate-block-focus-layer").forEach((element) => element.remove());
  rootElement?.querySelectorAll?.("[data-candidate-block-focus-frame], .examlist-candidate-block-focus-frame").forEach((element) => element.remove());
  rootElement?.querySelectorAll?.("[data-candidate-block-focus-placeholder], .is-candidate-block-focus-placeholder").forEach((element) => element.remove());
  rootElement?.querySelectorAll?.(".is-selected-candidate-block-grid").forEach((element) => {
    element.classList.remove("is-selected-candidate-block-grid");
  });
  rootElement?.querySelectorAll?.(".is-candidate-block-focus-editor, .is-candidate-block-focus-active, .is-candidate-block-focus-placeholder").forEach((element) => {
    element.classList.remove("is-candidate-block-focus-editor", "is-candidate-block-focus-active", "is-candidate-block-focus-placeholder");
  });

  if (rootElement instanceof HTMLElement) {
    rootElement.classList.remove("is-candidate-block-focus-editor", "is-candidate-block-focus-active", "is-candidate-block-focus-placeholder");
    rootElement.closest?.(".template-editor-page")?.classList.remove("is-candidate-block-focus-active");
  }
}

function isCandidateBlockGridElement(element) {
  return element instanceof HTMLElement && (
    element.matches("[data-candidate-block-grid], .examlist-candidate-block-grid") ||
    Boolean(element.closest?.("[data-candidate-block-grid], .examlist-candidate-block-grid"))
  );
}

function isCandidateBlockGridRuntimeElement(element) {
  return element instanceof HTMLElement && Boolean(
    element.matches(
      ".template-editor-image-selection, .examlist-object-selection, .template-editor-table-selection, [data-candidate-block-grid-resize-handle], [data-candidate-block-grid-move-handle]",
    ),
  );
}

function isCandidateBlockOutsideEditableHost(element, documentElement) {
  if (!(element instanceof HTMLElement) || !documentElement?.contains?.(element)) {
    return false;
  }

  if (isCandidateBlockGridElement(element) || isCandidateBlockGridRuntimeElement(element)) {
    return false;
  }

  if (element.closest?.("[data-candidate-block-grid], .examlist-candidate-block-grid")) {
    return false;
  }

  return /^(P|DIV|H1|H2|H3|BLOCKQUOTE|UL|OL)$/i.test(String(element.tagName || ""));
}

function createBlankTemplateParagraph() {
  const paragraph = document.createElement("p");

  paragraph.append(document.createElement("br"));
  return paragraph;
}

export function ensureCandidateBlockGridOutsideEditableHost(documentElement) {
  if (!(documentElement instanceof HTMLElement) || !getCandidateBlockGridElements(documentElement).length) {
    return null;
  }

  const directGridElements = Array.from(documentElement.children || []).filter((child) =>
    child instanceof HTMLElement && child.matches("[data-candidate-block-grid], .examlist-candidate-block-grid"),
  );
  const lastGridElement = directGridElements[directGridElements.length - 1] || null;
  const followingEditableHost = lastGridElement?.nextElementSibling;

  if (isCandidateBlockOutsideEditableHost(followingEditableHost, documentElement)) {
    return followingEditableHost;
  }

  const paragraph = createBlankTemplateParagraph();

  if (lastGridElement?.nextSibling) {
    documentElement.insertBefore(paragraph, lastGridElement.nextSibling);
  } else {
    documentElement.append(paragraph);
  }

  return paragraph;
}
