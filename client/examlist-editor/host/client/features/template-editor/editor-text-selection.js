let lastTextControlSelectionRange = null;
let lastTextControlSelectionSnapshot = null;

function getTextControlSelectionNodePath(surfaceElement, node) {
  if (!surfaceElement || !node) {
    return null;
  }

  const path = [];
  let currentNode = node;

  while (currentNode && currentNode !== surfaceElement) {
    const parentNode = currentNode.parentNode;

    if (!parentNode) {
      return null;
    }

    path.unshift(Array.prototype.indexOf.call(parentNode.childNodes, currentNode));
    currentNode = parentNode;
  }

  return currentNode === surfaceElement ? path : null;
}

function resolveTextControlSelectionNodePath(surfaceElement, path) {
  if (!surfaceElement || !Array.isArray(path)) {
    return null;
  }

  let currentNode = surfaceElement;

  for (const index of path) {
    currentNode = currentNode?.childNodes?.[index] || null;

    if (!currentNode) {
      return null;
    }
  }

  return currentNode;
}

function getTextControlNodeMaxOffset(node) {
  if (!node) {
    return 0;
  }

  return node.nodeType === Node.TEXT_NODE ? node.textContent.length : node.childNodes.length;
}

function createTextControlSelectionSnapshot(surfaceElement, range) {
  if (!surfaceElement || !range) {
    return null;
  }

  const startPath = getTextControlSelectionNodePath(surfaceElement, range.startContainer);
  const endPath = getTextControlSelectionNodePath(surfaceElement, range.endContainer);

  if (!startPath || !endPath) {
    return null;
  }

  return {
    collapsed: range.collapsed,
    endOffset: range.endOffset,
    endPath,
    startOffset: range.startOffset,
    startPath,
  };
}

function createTextControlRangeFromSnapshot(surfaceElement, snapshot) {
  if (!surfaceElement || !snapshot) {
    return null;
  }

  const startNode = resolveTextControlSelectionNodePath(surfaceElement, snapshot.startPath);
  const endNode = resolveTextControlSelectionNodePath(surfaceElement, snapshot.endPath);

  if (!startNode || !endNode) {
    return null;
  }

  const range = document.createRange();

  try {
    range.setStart(startNode, Math.min(snapshot.startOffset, getTextControlNodeMaxOffset(startNode)));
    range.setEnd(endNode, Math.min(snapshot.endOffset, getTextControlNodeMaxOffset(endNode)));
  } catch (_error) {
    return null;
  }

  return range;
}

function isSurfaceRootTextControlRange(surfaceElement, range) {
  return Boolean(
    surfaceElement &&
      range &&
      (range.startContainer === surfaceElement ||
        range.endContainer === surfaceElement ||
        range.commonAncestorContainer === surfaceElement),
  );
}

export function resetEditorTextControlSelection() {
  lastTextControlSelectionRange = null;
  lastTextControlSelectionSnapshot = null;
}

export function getSelectionRangeInsideSurface(surfaceElement) {
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

export function rememberEditorTextControlSelection(surfaceElement) {
  const range = getSelectionRangeInsideSurface(surfaceElement);

  if (range) {
    lastTextControlSelectionRange = range.cloneRange();
    lastTextControlSelectionSnapshot = createTextControlSelectionSnapshot(surfaceElement, range);
  }
}

export function canRestoreEditorTextControlSelection(surfaceElement) {
  const snapshotRange = createTextControlRangeFromSnapshot(surfaceElement, lastTextControlSelectionSnapshot);

  if (
    surfaceElement &&
      lastTextControlSelectionRange &&
      lastTextControlSelectionRange.startContainer?.isConnected &&
      lastTextControlSelectionRange.endContainer?.isConnected &&
      surfaceElement.contains(lastTextControlSelectionRange.startContainer) &&
      surfaceElement.contains(lastTextControlSelectionRange.endContainer) &&
      !(snapshotRange && isSurfaceRootTextControlRange(surfaceElement, lastTextControlSelectionRange))
  ) {
    return true;
  }

  return Boolean(snapshotRange);
}

export function getRestorableEditorTextControlSelection(surfaceElement) {
  const snapshotRange = createTextControlRangeFromSnapshot(surfaceElement, lastTextControlSelectionSnapshot);

  if (
    surfaceElement &&
    lastTextControlSelectionRange &&
    lastTextControlSelectionRange.startContainer?.isConnected &&
    lastTextControlSelectionRange.endContainer?.isConnected &&
    surfaceElement.contains(lastTextControlSelectionRange.startContainer) &&
    surfaceElement.contains(lastTextControlSelectionRange.endContainer) &&
    !(snapshotRange && isSurfaceRootTextControlRange(surfaceElement, lastTextControlSelectionRange))
  ) {
    return lastTextControlSelectionRange;
  }

  return snapshotRange;
}

export function restoreEditorTextControlSelection(surfaceElement) {
  const range = getRestorableEditorTextControlSelection(surfaceElement);

  if (!range) {
    return false;
  }

  const selection = window.getSelection?.();

  if (!selection) {
    return false;
  }

  selection.removeAllRanges();
  selection.addRange(range);
  lastTextControlSelectionRange = range.cloneRange();
  lastTextControlSelectionSnapshot = createTextControlSelectionSnapshot(surfaceElement, range);
  surfaceElement.focus();
  return true;
}

export function getSelectedTableCells(surfaceElement) {
  return Array.from(
    new Set(
      Array.from(
        surfaceElement?.querySelectorAll?.("td.is-selected-cell, th.is-selected-cell, td.is-active-cell, th.is-active-cell") || [],
      ),
    ),
  );
}

export function getClosestEditorTextBlock(surfaceElement, node) {
  const startElement = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  const blockElement = startElement?.closest?.("p,h1,h2,h3,li,blockquote,td,th,div");

  if (
    !blockElement ||
    blockElement === surfaceElement ||
    blockElement.classList.contains("template-doc") ||
    !surfaceElement?.contains(blockElement)
  ) {
    return null;
  }

  return blockElement;
}
