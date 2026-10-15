(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  globalScope.ExamListTemplateEditorObjectFlowReflow = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const objectFlowLayoutChangeEventName = "examlist:object-flow-layoutchange";

  const flowObjectSelector = [
    "[data-candidate-block-grid]",
    ".examlist-candidate-block-grid",
    "table",
    "img",
  ].join(",");
  const transientSelector = [
    ".template-editor-image-selection",
    ".template-editor-image-resize-handle",
    ".examlist-object-selection",
    ".examlist-object-resize-handle",
    ".template-editor-table-selection",
    ".template-editor-table-handle",
    ".template-editor-table-move-handle",
    ".template-editor-table-select-handle",
    "[data-candidate-block-grid-resize-handle]",
    "[data-candidate-block-grid-move-handle]",
    "[data-candidate-block-focus-backdrop]",
    ".examlist-candidate-block-focus-backdrop",
    "[data-candidate-block-focus-layer]",
    ".examlist-candidate-block-focus-layer",
  ].join(",");
  const nonSplittableFlowTextBlockSelector = [
    "[data-candidate-block-grid]",
    ".examlist-candidate-block-grid",
    "[data-candidate-block-instance]",
    "[data-candidate-block-column-name]",
    ".examlist-candidate-block",
  ].join(",");
  let objectFlowReflowIdCounter = 0;
  const flowObjectLayoutState = new WeakMap();

  function getOwnerWindow(element) {
    return element?.ownerDocument?.defaultView || (typeof window !== "undefined" ? window : null);
  }

  function isHtmlElement(element, ownerWindow = getOwnerWindow(element)) {
    return Boolean(ownerWindow?.HTMLElement && element instanceof ownerWindow.HTMLElement);
  }

  function parsePixelValue(value, fallback = 0) {
    const parsedValue = Number.parseFloat(String(value || ""));

    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  function getDocumentRelativeRect(element, documentElement) {
    const documentRect = documentElement.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const scale = documentElement.offsetHeight > 0 && documentRect.height > 0
      ? documentRect.height / documentElement.offsetHeight : 1;
    const top = (rect.top - documentRect.top) / scale - (documentElement.clientTop || 0);
    const height = rect.height / scale;
    return { top, height, bottom: top + height };
  }

  function moveFlowNodeBefore(documentElement, element, reference) {
    if (element === reference || (element.parentElement === documentElement && element.nextSibling === reference)) return;
    if (typeof documentElement.moveBefore === "function" && element.isConnected) {
      // Preserve focus and pointer capture. Detaching a focused data block fires
      // blur handlers that serialize the document while the block is missing.
      documentElement.moveBefore(element, reference);
      return;
    }
    const focusedElement = element.ownerDocument.activeElement;
    const restoreFocus = element.contains(focusedElement);
    if (restoreFocus) focusedElement.blur();
    documentElement.insertBefore(element, reference?.parentElement === documentElement ? reference : null);
    if (restoreFocus && focusedElement.isConnected) focusedElement.focus({ preventScroll: true });
  }

  function getFlowObjectKind(objectElement) {
    if (!isHtmlElement(objectElement)) {
      return "";
    }

    if (objectElement.matches?.("[data-candidate-block-grid], .examlist-candidate-block-grid")) {
      return "candidate-block-grid";
    }

    if (objectElement.tagName === "IMG") return "image";
    return String(objectElement.tagName || "").toUpperCase() === "TABLE" ? "table" : "";
  }

  function isFlowObjectElement(objectElement, documentElement) {
    if (!isHtmlElement(objectElement) || !isHtmlElement(documentElement) || !documentElement.contains(objectElement)) {
      return false;
    }

    const kind = getFlowObjectKind(objectElement);

    if (!kind || objectElement.closest(transientSelector) || getTopLevelChild(objectElement, documentElement) !== objectElement) {
      return false;
    }

    if (kind === "table") {
      return !objectElement.closest("[data-candidate-block-grid], .examlist-candidate-block-grid, [data-candidate-block-instance]");
    }

    return kind === "candidate-block-grid" || kind === "image";
  }

  function getFlowObjectId(objectElement, documentElement) {
    const existingId = String(objectElement?.dataset?.templateObjectFlowId || "").trim();

    if (existingId) {
      return existingId;
    }

    const usedIds = new Set(
      Array.from(documentElement?.querySelectorAll?.("[data-template-object-flow-id]") || [])
        .map((element) => String(element.dataset?.templateObjectFlowId || "").trim())
        .filter(Boolean),
    );
    let nextId = "";

    do {
      objectFlowReflowIdCounter += 1;
      nextId = `template-object-flow-${Date.now().toString(36)}-${objectFlowReflowIdCounter}`;
    } while (usedIds.has(nextId));

    objectElement.dataset.templateObjectFlowId = nextId;
    return nextId;
  }

  function getFlowSpacer(documentElement, flowId) {
    const normalizedFlowId = String(flowId || "").trim();

    if (!normalizedFlowId) {
      return null;
    }

    return Array.from(documentElement?.querySelectorAll?.("[data-template-object-flow-spacer]") || [])
      .find((element) => String(element.dataset?.templateObjectFlowId || "").trim() === normalizedFlowId) || null;
  }

  function cleanupUnsupportedFlowState(documentElement) {
    const flowObjects = Array.from(documentElement?.querySelectorAll?.(flowObjectSelector) || [])
      .filter((objectElement) => isFlowObjectElement(objectElement, documentElement));
    const flowObjectSet = new Set(flowObjects);
    const flowObjectById = new Map();

    flowObjects.forEach((objectElement) => {
      const flowId = String(objectElement.dataset?.templateObjectFlowId || "").trim();

      if (!flowId) {
        return;
      }

      if (flowObjectById.has(flowId)) {
        objectElement.removeAttribute("data-template-object-flow-id");
        return;
      }

      flowObjectById.set(flowId, objectElement);
    });

    const retainedSpacerIds = new Set();

    Array.from(documentElement?.querySelectorAll?.("[data-template-object-flow-spacer]") || [])
      .forEach((spacerElement) => {
        const flowId = String(spacerElement.dataset?.templateObjectFlowId || "").trim();

        if (!flowId || !flowObjectById.has(flowId) || retainedSpacerIds.has(flowId) ||
          flowObjectById.get(flowId).style.position !== "absolute") {
          spacerElement.remove();
          return;
        }

        retainedSpacerIds.add(flowId);
      });

    Array.from(documentElement?.querySelectorAll?.("[data-template-object-flow-id]") || [])
      .forEach((element) => {
        if (!element.matches?.("[data-template-object-flow-spacer]") && !flowObjectSet.has(element)) {
          element.removeAttribute("data-template-object-flow-id");
        }
      });

    return flowObjects;
  }

  function applyFlowSpacerStyle(spacerElement, kind) {
    if (!isHtmlElement(spacerElement)) {
      return;
    }

    if (spacerElement.dataset.templateObjectFlowSpacer !== "true") spacerElement.dataset.templateObjectFlowSpacer = "true";
    if (spacerElement.dataset.templateObjectFlowKind !== (kind || "object")) spacerElement.dataset.templateObjectFlowKind = kind || "object";
    if (spacerElement.getAttribute("contenteditable") !== "false") spacerElement.setAttribute("contenteditable", "false");
    if (spacerElement.getAttribute("aria-hidden") !== "true") spacerElement.setAttribute("aria-hidden", "true");
    const styles = {
      border: "0px",
      clear: "both",
      display: "block",
      fontSize: "0px",
      lineHeight: "0px",
      margin: "0px",
      minHeight: "0px",
      overflow: "hidden",
      padding: "0px",
      pointerEvents: "none",
      userSelect: "none",
    };

    Object.entries(styles).forEach(([propertyName, value]) => {
      if (spacerElement.style[propertyName] !== value) {
        spacerElement.style[propertyName] = value;
      }
    });
  }

  function getTopLevelChild(element, documentElement) {
    let currentElement = element;

    while (currentElement?.parentElement && currentElement.parentElement !== documentElement) {
      currentElement = currentElement.parentElement;
    }

    return currentElement?.parentElement === documentElement ? currentElement : null;
  }

  function isFlowObjectCaretHost(element, documentElement) {
    return Boolean(
      isHtmlElement(element) &&
        element.parentElement === documentElement &&
        /^(P|DIV)$/i.test(String(element.tagName || "")) &&
        !element.matches(flowObjectSelector) &&
        !element.matches("[data-template-object-flow-spacer]") &&
        !element.closest(transientSelector) &&
        element.getAttribute?.("contenteditable") !== "false",
    );
  }

  function syncFlowObjectCaretHostSpace(paragraph) {
    const isEmpty = !String(paragraph.textContent || "").replace(/[\u200b\ufeff]/g, "").trim() &&
      paragraph.querySelectorAll("br").length <= 1 &&
      !paragraph.querySelector("*:not(br):not(.template-object-caret)");
    paragraph.toggleAttribute("data-template-object-caret-host", isEmpty);
    return paragraph;
  }

  function createFlowObjectCaretHost(documentElement) {
    const paragraph = documentElement.ownerDocument.createElement("p");

    paragraph.append(documentElement.ownerDocument.createElement("br"));
    return syncFlowObjectCaretHostSpace(paragraph);
  }

  function ensureFlowObjectCaretHost(objectElement, documentElement) {
    if (!isFlowObjectElement(objectElement, documentElement)) {
      return null;
    }

    const referenceElement = getTopLevelChild(objectElement, documentElement);
    let nextElement = referenceElement?.nextElementSibling || null;
    // Runtime spacers must not hide the existing editable paragraph.
    while (nextElement?.matches?.("[data-template-object-flow-spacer]")) {
      nextElement = nextElement.nextElementSibling;
    }

    if (isFlowObjectCaretHost(nextElement, documentElement)) {
      if (!nextElement.childNodes.length) {
        nextElement.append(documentElement.ownerDocument.createElement("br"));
      }
      return syncFlowObjectCaretHostSpace(nextElement);
    }

    const paragraph = createFlowObjectCaretHost(documentElement);

    if (referenceElement?.nextSibling) {
      documentElement.insertBefore(paragraph, referenceElement.nextSibling);
    } else {
      documentElement.append(paragraph);
    }

    return paragraph;
  }

  function ensureFlowSpacer(objectElement, documentElement) {
    if (!isFlowObjectElement(objectElement, documentElement)) {
      return null;
    }

    const kind = getFlowObjectKind(objectElement);
    const flowId = getFlowObjectId(objectElement, documentElement);
    let spacerElement = getFlowSpacer(documentElement, flowId);

    if (!isHtmlElement(spacerElement)) {
      spacerElement = documentElement.ownerDocument.createElement("div");
      spacerElement.dataset.templateObjectFlowId = flowId;

      const referenceElement = getTopLevelChild(objectElement, documentElement);

      if (referenceElement?.parentElement === documentElement) {
        documentElement.insertBefore(spacerElement, referenceElement);
      } else {
        documentElement.append(spacerElement);
      }
    }

    applyFlowSpacerStyle(spacerElement, kind);
    return spacerElement;
  }

  function getFlowObjectMetrics(objectElement, documentElement, geometry = {}, minimumHeight = 5) {
    const objectRect = getDocumentRelativeRect(objectElement, documentElement);
    const renderedTop = objectRect.top;
    const hasStrictGeometry = geometry.strictGeometry === true &&
      Number.isFinite(Number(geometry.top)) &&
      Number.isFinite(Number(geometry.height));
    const strictHeight = Math.max(
      Math.max(1, Math.round(Number(minimumHeight) || 1)),
      Math.round(Number(geometry.height) || 0),
    );

    if (hasStrictGeometry) {
      const top = Number(geometry.top);

      return {
        bottom: top + strictHeight,
        height: strictHeight,
        top,
      };
    }

    const styleTop = parsePixelValue(objectElement.style.top, renderedTop);
    const top = Number.isFinite(Number(geometry.top)) ? Number(geometry.top) : styleTop;
    const height = Math.max(
      Math.max(1, Math.round(Number(minimumHeight) || 1)),
      Math.round(Number(geometry.height) || objectElement.offsetHeight || objectRect.height || parsePixelValue(objectElement.style.height, 0) || 0),
    );
    const bottom = top + height;

    return {
      bottom,
      height: Math.max(height, bottom - top),
      top,
    };
  }

  function syncFlowSpacer(objectElement, documentElement, geometry = {}, minimumHeight = 5) {
    const spacerElement = ensureFlowSpacer(objectElement, documentElement);

    if (!isHtmlElement(spacerElement)) {
      return null;
    }

    const metrics = getFlowObjectMetrics(objectElement, documentElement, geometry, minimumHeight);
    const spacerTop = Math.max(0, getDocumentRelativeRect(spacerElement, documentElement).top);
    const reservedHeight = Math.max(metrics.height, metrics.bottom - spacerTop);

    const nextHeight = `${Math.max(0, Math.ceil(reservedHeight))}px`;

    if (spacerElement.style.height !== nextHeight) {
      spacerElement.style.height = nextHeight;
    }
    rememberFlowObjectLayout(objectElement, documentElement, spacerElement, metrics);
    return spacerElement;
  }

  function rememberFlowObjectLayout(objectElement, documentElement, spacerElement = null, metrics = null) {
    if (!isHtmlElement(objectElement) || !isHtmlElement(documentElement)) {
      return null;
    }

    const resolvedSpacer = spacerElement || getFlowSpacer(
      documentElement,
      String(objectElement.dataset?.templateObjectFlowId || "").trim(),
    );

    if (!isHtmlElement(resolvedSpacer)) {
      return null;
    }

    const resolvedMetrics = metrics || getFlowObjectMetrics(objectElement, documentElement);
    const spacerTop = Math.max(0, getDocumentRelativeRect(resolvedSpacer, documentElement).top);
    const objectTop = Math.max(0, resolvedMetrics.top);

    const state = {
      height: Math.max(1, resolvedMetrics.height || 1),
      objectTop,
      offsetTop: objectTop - spacerTop,
      spacerTop,
    };

    flowObjectLayoutState.set(objectElement, state);
    return state;
  }

  function isAbsoluteFlowObjectChild(element, documentElement) {
    return isFlowObjectElement(element, documentElement) && String(element.style.position || "").trim() === "absolute";
  }

  function isFlowReferenceChild(element, documentElement, activeElement, activeSpacer) {
    if (!isHtmlElement(element) || element === activeElement || element === activeSpacer || element.closest(transientSelector)) {
      return false;
    }

    if (element.matches("[data-template-object-flow-spacer]")) {
      return true;
    }

    if (isAbsoluteFlowObjectChild(element, documentElement)) {
      return false;
    }

    const rects = Array.from(element.getClientRects?.() || []);
    const hasBox = rects.some((rect) => rect.width > 0 || rect.height > 0);
    const hasMeaningfulText = String(element.textContent || "").replace(/\u00a0/g, " ").trim().length > 0;
    const hasStructuredContent = Boolean(element.querySelector?.("img, table, hr, [data-template-tag-value], .template-token"));

    return hasBox || hasMeaningfulText || hasStructuredContent;
  }

  function isExplicitLineBreakElement(element) {
    return String(element?.tagName || "").toUpperCase() === "BR";
  }

  function cloneLineAncestor(element) {
    const clone = element.cloneNode(false);

    clone.removeAttribute?.("id");
    return clone;
  }

  function createLineFragmentState(ownerDocument) {
    return {
      cloneByAncestor: new Map(),
      fragment: ownerDocument.createDocumentFragment(),
    };
  }

  function ensureLineFragmentParent(lineState, ancestors = []) {
    let parent = lineState.fragment;

    ancestors.forEach((ancestor) => {
      let clone = lineState.cloneByAncestor.get(ancestor);

      if (!clone) {
        clone = cloneLineAncestor(ancestor);
        parent.append(clone);
        lineState.cloneByAncestor.set(ancestor, clone);
      }

      parent = clone;
    });

    return parent;
  }

  function createExplicitTextLineFragments(blockElement) {
    const ownerDocument = blockElement?.ownerDocument || document;
    const lines = [];
    let lineState = createLineFragmentState(ownerDocument);

    function finishLine() {
      lines.push(lineState.fragment);
      lineState = createLineFragmentState(ownerDocument);
    }

    function appendNodeToCurrentLine(node, ancestors = []) {
      if (node.nodeType === 3) {
        ensureLineFragmentParent(lineState, ancestors).append(node.cloneNode(true));
        return;
      }

      if (node.nodeType !== 1) {
        return;
      }

      if (isExplicitLineBreakElement(node)) {
        finishLine();
        return;
      }

      const childNodes = Array.from(node.childNodes || []);

      if (!childNodes.length) {
        ensureLineFragmentParent(lineState, ancestors).append(node.cloneNode(true));
        return;
      }

      childNodes.forEach((childNode) => appendNodeToCurrentLine(childNode, [...ancestors, node]));
    }

    Array.from(blockElement.childNodes || []).forEach((childNode) => appendNodeToCurrentLine(childNode));

    if (lineState.fragment.childNodes.length > 0) {
      lines.push(lineState.fragment);
    }

    return lines;
  }

  function isSplittableFlowTextBlock(element, documentElement, activeElement, activeSpacer) {
    if (!isFlowReferenceChild(element, documentElement, activeElement, activeSpacer)) {
      return false;
    }

    const tagName = String(element.tagName || "").toUpperCase();

    return (
      (tagName === "P" || tagName === "DIV") &&
      !element.matches("[data-template-object-flow-spacer]") &&
      !element.matches(nonSplittableFlowTextBlockSelector) &&
      !element.matches(flowObjectSelector) &&
      !element.querySelector(nonSplittableFlowTextBlockSelector) &&
      !element.querySelector(flowObjectSelector) &&
      Boolean(element.querySelector("br"))
    );
  }

  function createFlowTextLineBlock(blockElement, lineFragment, index, lineCount, marginBottom) {
    const ownerDocument = blockElement.ownerDocument || document;
    const lineElement = blockElement.cloneNode(false);

    if (index > 0) {
      lineElement.removeAttribute("id");
    }

    lineElement.style.margin = "0";
    if (index === lineCount - 1 && marginBottom && marginBottom !== "0px") {
      lineElement.style.marginBottom = marginBottom;
    }

    lineElement.append(lineFragment);
    if (!lineElement.childNodes.length) {
      lineElement.append(ownerDocument.createElement("br"));
    }

    return lineElement;
  }

  function splitFlowTextBlockIntoLines(blockElement) {
    const lineFragments = createExplicitTextLineFragments(blockElement);

    if (lineFragments.length < 2) {
      return [];
    }

    const ownerWindow = getOwnerWindow(blockElement);
    const marginBottom = ownerWindow?.getComputedStyle?.(blockElement)?.marginBottom || "";
    const lineElements = lineFragments.map((lineFragment, index) =>
      createFlowTextLineBlock(blockElement, lineFragment, index, lineFragments.length, marginBottom)
    );

    blockElement.replaceWith(...lineElements);
    return lineElements;
  }

  function splitFlowTextBlockAtTarget(documentElement, activeElement, activeSpacer, targetTop) {
    const blockElement = Array.from(documentElement.children || [])
      .find((childElement) => {
        if (!isSplittableFlowTextBlock(childElement, documentElement, activeElement, activeSpacer)) {
          return false;
        }

        const { top, bottom } = getDocumentRelativeRect(childElement, documentElement);

        return targetTop >= top - 1 && targetTop < bottom - 1;
      });

    return blockElement ? splitFlowTextBlockIntoLines(blockElement) : [];
  }

  function findFlowReferenceChild(documentElement, activeElement, activeSpacer, activeMetrics) {
    const participants = Array.from(documentElement.children || [])
      .filter((childElement) => isFlowReferenceChild(childElement, documentElement, activeElement, activeSpacer))
      .map((childElement) => {
        const rect = getDocumentRelativeRect(childElement, documentElement);
        const top = Math.max(0, rect.top);
        const height = childElement.matches("[data-template-object-flow-spacer]")
          ? Math.max(rect.height || 0, parsePixelValue(childElement.style.height, 0))
          : rect.height || 0;

        return {
          element: childElement,
          bottom: top + Math.max(0, height),
          top,
        };
      })
      .filter((entry) => Number.isFinite(entry.top) && entry.bottom > entry.top + 0.5 &&
        !entry.element.hasAttribute("data-template-object-caret-host"));

    return participants.find((entry) => activeMetrics.top < entry.bottom - 1)?.element || null;
  }

  function dispatchObjectFlowLayoutChange(objectElement, detail = {}) {
    const ownerWindow = getOwnerWindow(objectElement);

    if (!ownerWindow?.CustomEvent || !isHtmlElement(objectElement, ownerWindow)) {
      return;
    }

    objectElement.dispatchEvent(new ownerWindow.CustomEvent(objectFlowLayoutChangeEventName, {
      bubbles: true,
      detail: {
        kind: getFlowObjectKind(objectElement),
        objectElement,
        ...detail,
      },
    }));
  }

  function syncAbsoluteFlowObjectToSpacer(objectElement, documentElement, options = {}) {
    if (!isAbsoluteFlowObjectChild(objectElement, documentElement)) {
      return null;
    }

    const spacerElement = ensureFlowSpacer(objectElement, documentElement);

    if (!isHtmlElement(spacerElement)) {
      return null;
    }

    const spacerTop = Math.max(0, getDocumentRelativeRect(spacerElement, documentElement).top);
    const metrics = getFlowObjectMetrics(objectElement, documentElement, {}, options.minimumHeight);
    const rememberedState = flowObjectLayoutState.get(objectElement);
    const styleTop = parsePixelValue(objectElement.style.top, metrics.top);
    const rememberedObjectTop = Number(rememberedState?.objectTop);
    const hasExplicitMovedTop =
      Number.isFinite(styleTop) &&
      Number.isFinite(rememberedObjectTop) &&
      Math.abs(styleTop - rememberedObjectTop) > 1;
    const fallbackOffset = hasExplicitMovedTop
      ? styleTop - spacerTop
      : metrics.top < spacerTop - 1
        ? 0
        : Math.max(0, metrics.top - spacerTop);
    const offsetTop = Number.isFinite(Number(rememberedState?.offsetTop)) && !hasExplicitMovedTop
      ? Number(rememberedState.offsetTop)
      : fallbackOffset;
    const nextTop = Math.max(0, Math.round(spacerTop + offsetTop));
    const didMove = Math.abs(metrics.top - nextTop) > 1;

    if (didMove) {
      objectElement.style.top = `${nextTop}px`;
    }

    syncFlowSpacer(objectElement, documentElement, {
      height: metrics.height,
      top: nextTop,
    }, options.minimumHeight);

    if (didMove) {
      dispatchObjectFlowLayoutChange(objectElement, {
        height: metrics.height,
        top: nextTop,
      });
      options.onObjectShift?.(objectElement, {
        height: metrics.height,
        top: nextTop,
      });
    }

    return {
      didMove,
      height: metrics.height,
      objectElement,
      spacerElement,
      top: nextTop,
    };
  }

  function syncTemplateEditorObjectFlowObjects(documentElement, options = {}) {
    if (!isHtmlElement(documentElement)) {
      return [];
    }

    const flowObjects = cleanupUnsupportedFlowState(documentElement);

    const caretHosts = new Set(flowObjects.map((objectElement) => ensureFlowObjectCaretHost(objectElement, documentElement)));
    documentElement.querySelectorAll("[data-template-object-caret-host]").forEach((paragraph) => {
      if (!caretHosts.has(paragraph)) paragraph.removeAttribute("data-template-object-caret-host");
    });

    return flowObjects
      .filter((objectElement) => String(objectElement.style.position || "").trim() === "absolute")
      .map((objectElement) => syncAbsoluteFlowObjectToSpacer(objectElement, documentElement, options))
      .filter(Boolean);
  }

  function reflowTemplateEditorObjectRows(activeElement, options = {}) {
    const documentElement = options.documentElement || activeElement?.closest?.(".template-doc") || null;

    if (!isFlowObjectElement(activeElement, documentElement)) {
      return {
        shiftedObjects: [],
        spacerElement: null,
      };
    }

    if (activeElement.style.position !== "absolute") {
      // In-flow objects already reserve their own height. Only their absolute
      // neighbours need to follow a native layout change (for example resizing).
      return {
        shiftedObjects: syncTemplateEditorObjectFlowObjects(documentElement, options)
          .filter((entry) => entry.didMove).map((entry) => entry.objectElement),
        spacerElement: null,
      };
    }

    cleanupUnsupportedFlowState(documentElement);
    const caretHost = ensureFlowObjectCaretHost(activeElement, documentElement);

    const activeSpacer = ensureFlowSpacer(activeElement, documentElement);

    if (!isHtmlElement(activeSpacer)) {
      return {
        shiftedObjects: [],
        spacerElement: null,
      };
    }

    const activeMetrics = getFlowObjectMetrics(activeElement, documentElement, {
      height: options.activeHeight,
      strictGeometry: options.strictGeometry === true,
      top: options.activeTop,
    }, options.minimumHeight);
    const movementY = Number(options.movementY) || 0;
    const shouldReorderByPosition =
      options.reorderByPosition === true ||
      (options.reorderByPosition !== false && Math.abs(movementY) > 0.5);

    if (shouldReorderByPosition) {
      // Measure the drop position without counting the dragged object's old row.
      activeSpacer.style.height = "0px";
      splitFlowTextBlockAtTarget(documentElement, activeElement, activeSpacer, activeMetrics.top);
      const referenceElement = findFlowReferenceChild(documentElement, activeElement, activeSpacer, activeMetrics);
      moveFlowNodeBefore(documentElement, activeSpacer, referenceElement);
      // Persist the same order that the spacers display. Spacers themselves are
      // transient and disappear when HTML is saved or copied.
      moveFlowNodeBefore(documentElement, activeElement, activeSpacer.nextSibling);
      if (caretHost?.hasAttribute("data-template-object-caret-host")) moveFlowNodeBefore(documentElement, caretHost, activeElement.nextSibling);
    }

    const spacerTop = Math.max(0, getDocumentRelativeRect(activeSpacer, documentElement).top);
    const nextTop = Math.max(spacerTop, activeMetrics.top);
    activeElement.style.top = `${Math.round(nextTop)}px`;
    syncFlowSpacer(activeElement, documentElement, {
      height: activeMetrics.height,
      top: nextTop,
    }, options.minimumHeight);

    // Normal document flow moves text immediately; move the absolute objects to
    // their reserved rows in that same order, for both upward and downward moves.
    const shiftedObjects = syncTemplateEditorObjectFlowObjects(documentElement, options)
      .filter((entry) => entry.didMove && entry.objectElement !== activeElement)
      .map((entry) => entry.objectElement);

    return {
      activeTop: nextTop,
      shiftedObjects,
      spacerElement: activeSpacer,
    };
  }

  return Object.freeze({ objectFlowLayoutChangeEventName, reflowTemplateEditorObjectRows, syncTemplateEditorObjectFlowObjects });
});

})();
