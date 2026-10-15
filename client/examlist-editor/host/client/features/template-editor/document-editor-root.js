import { normalizeDocumentFontNodes, sanitizeNodeTree, stripTransientDocumentState } from "./document-editor-sanitizer.js";
import { normalizeDocumentTokenNodes } from "./document-editor-tokens.js";

export function normalizeEditableDocumentRoot(rootNode, options = {}) {
  if (!rootNode) {
    return;
  }

  stripTransientDocumentState(rootNode, { preserveTokenCarets: options.preserveTokenCarets === true });
  sanitizeNodeTree(rootNode);
  normalizeDocumentFontNodes(rootNode);
  normalizeDocumentTokenNodes(rootNode, {
    preservePresentation: options.preserveTokenPresentation === true,
  });
  ensureDocumentRootWrapper(rootNode);
  removeGeneratedUndefinedDocumentText(rootNode);
}


function isDocumentRootWrapper(node) {
  return node?.nodeType === Node.ELEMENT_NODE && node.classList?.contains("template-doc");
}

function getDirectDocumentRootWrapper(rootNode) {
  return Array.from(rootNode?.childNodes || []).find((childNode) => isDocumentRootWrapper(childNode)) || null;
}

function unwrapNestedDocumentRootWrappers(rootNode) {
  if (!rootNode?.querySelectorAll) {
    return;
  }

  rootNode.querySelectorAll(".template-doc").forEach((wrapper) => {
    if (wrapper === rootNode) {
      return;
    }

    const parentNode = wrapper.parentNode;

    if (!parentNode) {
      return;
    }

    while (wrapper.firstChild) {
      parentNode.insertBefore(wrapper.firstChild, wrapper);
    }
    wrapper.remove();
  });
}

function mergeDocumentRootWrapperSiblings(rootNode, wrapper) {
  const mergedContent = document.createDocumentFragment();

  Array.from(rootNode.childNodes).forEach((childNode) => {
    if (childNode === wrapper || isDocumentRootWrapper(childNode)) {
      while (childNode.firstChild) {
        mergedContent.append(childNode.firstChild);
      }

      if (childNode !== wrapper) {
        childNode.remove();
      }
      return;
    }

    mergedContent.append(childNode);
  });

  wrapper.append(mergedContent);
  rootNode.append(wrapper);
}

function ensureDocumentRootWrapper(rootNode) {
  if (!rootNode || typeof document === "undefined") {
    return;
  }

  if (isDocumentRootWrapper(rootNode)) {
    unwrapNestedDocumentRootWrappers(rootNode);
    return;
  }

  let wrapper = getDirectDocumentRootWrapper(rootNode);

  if (!wrapper) {
    wrapper = document.createElement("div");
    wrapper.className = "template-doc";

    while (rootNode.firstChild) {
      wrapper.append(rootNode.firstChild);
    }
    rootNode.append(wrapper);
  } else {
    mergeDocumentRootWrapperSiblings(rootNode, wrapper);
  }

  unwrapNestedDocumentRootWrappers(wrapper);
}

function removeGeneratedUndefinedDocumentText(rootNode) {
  if (!rootNode?.querySelectorAll) {
    return;
  }

  rootNode.querySelectorAll(".template-doc").forEach((wrapper) => {
    const textContent = String(wrapper.textContent || "").trim().toLowerCase();
    const hasStructuredContent = Boolean(wrapper.querySelector("figure, hr, img, table"));

    if (textContent === "undefined" && !hasStructuredContent) {
      wrapper.textContent = "";
    }
  });
}
