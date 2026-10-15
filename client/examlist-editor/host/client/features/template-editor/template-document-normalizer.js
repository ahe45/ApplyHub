import { normalizeTokenLabels } from "./data-tags-adapter.js";

export function ensureDocumentElement(container) {
  let documentElement = container.querySelector(".template-doc");

  if (documentElement) {
    return documentElement;
  }

  documentElement = document.createElement("div");
  documentElement.className = "template-doc";

  while (container.firstChild) {
    documentElement.append(container.firstChild);
  }

  if (!documentElement.childNodes.length) {
    documentElement.innerHTML = "<p><br></p>";
  }

  container.append(documentElement);
  return documentElement;
}

function isTemplateDocumentWrapper(node) {
  return node?.nodeType === Node.ELEMENT_NODE && node.classList?.contains("template-doc");
}

export function normalizeTemplateDocumentWrappers(rootElement) {
  if (!rootElement?.childNodes) {
    return false;
  }

  const directWrappers = Array.from(rootElement.childNodes).filter(isTemplateDocumentWrapper);
  let primaryWrapper = directWrappers[0] || null;
  let changed = false;

  if (!primaryWrapper) {
    primaryWrapper = rootElement.querySelector?.(".template-doc") || null;
  }

  if (!primaryWrapper) {
    return false;
  }

  if (primaryWrapper.parentNode !== rootElement) {
    const wrapper = document.createElement("div");

    wrapper.className = "template-doc";
    while (primaryWrapper.firstChild) {
      wrapper.append(primaryWrapper.firstChild);
    }
    rootElement.append(wrapper);
    primaryWrapper.remove();
    primaryWrapper = wrapper;
    changed = true;
  }

  Array.from(rootElement.childNodes).forEach((childNode) => {
    if (childNode === primaryWrapper) {
      return;
    }

    if (isTemplateDocumentWrapper(childNode)) {
      while (childNode.firstChild) {
        primaryWrapper.append(childNode.firstChild);
      }
      childNode.remove();
      changed = true;
      return;
    }

    if (
      childNode.nodeType === Node.ELEMENT_NODE &&
      childNode.matches?.(
        ".template-editor-image-selection, .examlist-object-selection, .template-editor-table-selection, .template-recognition-marks-overlay, [data-candidate-block-focus-backdrop], .examlist-candidate-block-focus-backdrop, [data-candidate-block-focus-layer], .examlist-candidate-block-focus-layer",
      )
    ) {
      return;
    }

    primaryWrapper.append(childNode);
    changed = true;
  });

  primaryWrapper.querySelectorAll?.(".template-doc").forEach((nestedWrapper) => {
    const parentNode = nestedWrapper.parentNode;

    if (!parentNode) {
      return;
    }

    while (nestedWrapper.firstChild) {
      parentNode.insertBefore(nestedWrapper.firstChild, nestedWrapper);
    }
    nestedWrapper.remove();
    changed = true;
  });

  return changed;
}

export function writeRuntimePageSettings(documentElement, settings) {
  documentElement.dataset.templatePageSize = settings.size;
  documentElement.dataset.templatePageOrientation = settings.orientation;
  documentElement.dataset.templatePageMarginTop = String(settings.marginTop);
  documentElement.dataset.templatePageMarginRight = String(settings.marginRight);
  documentElement.dataset.templatePageMarginBottom = String(settings.marginBottom);
  documentElement.dataset.templatePageMarginLeft = String(settings.marginLeft);
}


export function bindDocumentWrapperNormalization({ surfaceElement } = {}) {
  if (!surfaceElement) {
    return null;
  }

  let frameId = 0;
  const normalize = () => {
    frameId = 0;

    if (!normalizeTemplateDocumentWrappers(surfaceElement)) {
      return;
    }

    normalizeTokenLabels(surfaceElement);
  };
  const scheduleNormalize = (event) => {
    if (event?.target?.closest?.("[data-candidate-block-modal-editor-surface], [data-candidate-block-focus-layer]")) {
      return;
    }

    window.cancelAnimationFrame(frameId);
    frameId = window.requestAnimationFrame(normalize);
  };

  surfaceElement.addEventListener("input", scheduleNormalize);
  surfaceElement.addEventListener("keyup", scheduleNormalize);
  return () => {
    window.cancelAnimationFrame(frameId);
    surfaceElement.removeEventListener("input", scheduleNormalize);
    surfaceElement.removeEventListener("keyup", scheduleNormalize);
  };
}
