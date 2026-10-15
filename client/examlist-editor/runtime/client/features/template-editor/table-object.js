(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./table-object-geometry"), require("./table-object-sessions"));
    return;
  }

  globalScope.ExamListTemplateEditorTableObject = factory(
    globalScope.ExamListTemplateEditorTableObjectGeometry,
    globalScope.ExamListTemplateEditorTableObjectSessions,
  );
})(typeof globalThis !== "undefined" ? globalThis : this, (tableObjectGeometryModule, tableObjectSessionsModule) => {
  if (!tableObjectGeometryModule?.createTemplateEditorTableObjectGeometryController) {
    throw new Error("client/features/template-editor/table-object-geometry.js must be loaded before table-object.js.");
  }

  if (!tableObjectSessionsModule?.createTemplateEditorTableObjectSessionController) {
    throw new Error("client/features/template-editor/table-object-sessions.js must be loaded before table-object.js.");
  }

  const { createTemplateEditorTableObjectGeometryController } = tableObjectGeometryModule;
  const { createTemplateEditorTableObjectSessionController } = tableObjectSessionsModule;
  const CANDIDATE_BLOCK_FOCUS_TABLE_OBJECT_OUTER_HIT_SLOP = 24;

  function createTemplateEditorTableObjectController({
    TABLE_EDGE_THRESHOLD,
    TEMPLATE_EDITOR_TABLE_MIN_SIZE,
    buildTemplateTableCellMap,
    clearTemplateEditorActiveCell,
    clearTemplateEditorImageSelection,
    clearTemplateEditorTableSelection,
    ensureTemplateEditorTableColGroup,
    getTemplateEditorDocumentElement,
    getTemplateEditorImageOverlayContainer,
    getTemplateEditorMeasuredColumnWidth,
    getTemplateEditorModal,
    ownerDocument,
    ownerWindow,
    parseTemplateEditorPixelStyle,
    placeCaretAtEnd,
    shell,
    state,
    syncTemplateEditorContent,
    syncTemplateEditorTableWidth,
    updateTemplateEditorFormattingControls,
    updateTemplateTableControls,
  }) {
    let templateEditorTableHoverElement = null;

    function getTemplateEditorCandidateBlockSourceElement(rootElement) {
      return rootElement?.querySelector?.("[data-candidate-block-instance]") || null;
    }

    function isTemplateEditorCandidateBlockSourceElement(blockElement) {
      if (!(blockElement instanceof Element)) {
        return false;
      }

      if (
        blockElement.dataset?.candidateBlockTemplateRole === "preview" ||
        blockElement.classList.contains("is-candidate-block-template-preview") ||
        blockElement.getAttribute("contenteditable") === "false" ||
        blockElement.getAttribute("aria-readonly") === "true"
      ) {
        return false;
      }

      if (
        blockElement.dataset?.candidateBlockTemplateRole === "source" ||
        blockElement.classList.contains("is-candidate-block-template-source")
      ) {
        return true;
      }

      const gridElement = blockElement.closest?.("[data-candidate-block-grid], .examlist-candidate-block-grid") || null;

      return getTemplateEditorCandidateBlockSourceElement(gridElement) === blockElement;
    }

    function isTemplateEditorSelectableTableObjectElement(tableElement) {
      const candidateBlockElement = tableElement?.closest?.("[data-candidate-block-instance]") || null;
      const candidateBlockGridElement = tableElement?.closest?.("[data-candidate-block-grid], .examlist-candidate-block-grid") || null;

      if (!(candidateBlockElement instanceof Element)) {
        return !(candidateBlockGridElement instanceof Element);
      }

      return isTemplateEditorCandidateBlockSourceElement(candidateBlockElement) &&
        candidateBlockElement.classList.contains("is-candidate-block-focus-editor");
    }

    function isTemplateEditorCandidateBlockFocusTableElement(tableElement) {
      const candidateBlockElement = tableElement?.closest?.("[data-candidate-block-instance]") || null;

      return candidateBlockElement instanceof Element &&
        isTemplateEditorCandidateBlockSourceElement(candidateBlockElement) &&
        candidateBlockElement.classList.contains("is-candidate-block-focus-editor");
    }

    function isTemplateEditorTableObjectElement(element) {
      return (
        element instanceof Element &&
        String(element.tagName || "").toUpperCase() === "TABLE" &&
        shell.surfaceElement?.contains(element) &&
        isTemplateEditorSelectableTableObjectElement(element)
      );
    }

    function getTemplateEditorTableObjectTarget(target) {
      const baseElement =
        target instanceof Element ? target : target?.parentElement instanceof Element ? target.parentElement : null;

      if (!baseElement || baseElement.closest(".template-editor-table-selection")) {
        return null;
      }

      const tableElement = baseElement.closest("table");

      return isTemplateEditorTableObjectElement(tableElement) ? tableElement : null;
    }

    function getTemplateEditorTableObjectCaretHost(target, event = null) {
      const baseElement = target instanceof Element ? target : target?.parentElement || null;
      const caretHost = baseElement?.closest?.("p, div") || null;
      const documentElement = getTemplateEditorDocumentElement();

      // Empty paper can lie after any object, including a grid followed by
      // another table. Resolve the nearest preceding object row, not only the
      // document's final child, and keep one owner for the caret range.
      if (documentElement && (baseElement === documentElement || baseElement === shell.surfaceElement)) {
        const paperRect = documentElement.getBoundingClientRect();
        let nearestHost = null;
        let nearestTop = -Infinity;
        if (event?.clientX >= paperRect.left && event.clientX <= paperRect.right) {
          for (const host of Array.from(documentElement.children || [])) {
            if (!host.hasAttribute?.("data-template-object-caret-host")) continue;
            let object = host.previousElementSibling;
            while (object?.matches?.("[data-template-object-flow-spacer]")) object = object.previousElementSibling;
            const hostTop = host.getBoundingClientRect().top;
            const rowBottom = Math.max(hostTop, object?.getBoundingClientRect?.().bottom ?? hostTop);
            let nextContent = host.nextElementSibling;
            while (nextContent && (nextContent.matches?.("[data-template-object-flow-spacer]") ||
                nextContent.getBoundingClientRect().height === 0)) nextContent = nextContent.nextElementSibling;
            const nextTop = nextContent?.getBoundingClientRect?.().top ?? Infinity;
            if (event.clientY >= rowBottom && event.clientY < nextTop && rowBottom >= nearestTop) {
              nearestHost = host;
              nearestTop = rowBottom;
            }
          }
        }
        if (nearestHost) return nearestHost;
      }

      if (
        !(caretHost instanceof HTMLElement) ||
        caretHost.parentElement !== documentElement ||
        caretHost.getAttribute("contenteditable") === "false" ||
        !caretHost.hasAttribute("data-template-object-caret-host")
      ) {
        return null;
      }

      const previousElement = caretHost.previousElementSibling;
      const followsTableObject = isTemplateEditorTableObjectElement(previousElement);
      const followsCandidateBlockGrid = Boolean(
        previousElement instanceof HTMLElement &&
          previousElement.matches("[data-candidate-block-grid], .examlist-candidate-block-grid") &&
          shell.surfaceElement.contains(previousElement),
      );

      return followsTableObject || followsCandidateBlockGrid ? caretHost : null;
    }

    function placeCaretInTemplateEditorTableObjectHost(caretHost) {
      const selection = ownerWindow.getSelection?.();

      if (!(caretHost instanceof HTMLElement) || !selection) {
        return false;
      }

      if (!caretHost.childNodes.length) {
        caretHost.append(ownerDocument.createElement("br"));
      }

      const range = ownerDocument.createRange();

      shell.surfaceElement.focus?.({ preventScroll: true });
      if (caretHost.hasAttribute("data-template-object-caret-host")) {
        // An element boundary in a zero-height paragraph is not a paintable
        // caret position in Chromium. Give the native caret a temporary text node.
        let guard = caretHost.querySelector(".template-object-caret");
        if (!guard) {
          guard = ownerDocument.createElement("span");
          guard.className = "template-object-caret";
          guard.textContent = "\u200B";
          caretHost.replaceChildren(guard);
        }
        range.setStart(guard.firstChild, 1);
        range.collapse(true);
        caretHost.setAttribute("data-template-object-caret-active", "");
      } else {
        range.selectNodeContents(caretHost);
        range.collapse(false);
      }
      selection.removeAllRanges();
      selection.addRange(range);
      state.templateEditor.savedRange = range.cloneRange();
      state.templateEditor.savedSelectionSnapshot = null;
      return true;
    }

    function getTemplateEditorTableObjectOutsideBorderDistance(tableElement, event) {
      if (!isTemplateEditorTableObjectElement(tableElement) || !event) {
        return null;
      }

      const tableRect = tableElement.getBoundingClientRect();
      const zoom = tableElement.offsetWidth > 0 ? tableRect.width / tableElement.offsetWidth : 1;
      const hitSlop = Math.min(Math.max(6, TABLE_EDGE_THRESHOLD) * zoom, tableRect.width / 4, tableRect.height / 4);
      const outerHitSlop = isTemplateEditorCandidateBlockFocusTableElement(tableElement)
        ? Math.max(hitSlop, CANDIDATE_BLOCK_FOCUS_TABLE_OBJECT_OUTER_HIT_SLOP)
        : hitSlop;
      const eventX = Number(event.clientX);
      const eventY = Number(event.clientY);

      if (!Number.isFinite(eventX) || !Number.isFinite(eventY) || tableRect.width < 1 || tableRect.height < 1) {
        return null;
      }

      const hitDistances = [];

      if (
        eventX < tableRect.left &&
        eventX >= tableRect.left - outerHitSlop &&
        eventY >= tableRect.top - outerHitSlop &&
        eventY <= tableRect.bottom + outerHitSlop
      ) {
        hitDistances.push(tableRect.left - eventX);
      }

      if (
        eventX > tableRect.right &&
        eventX <= tableRect.right + outerHitSlop &&
        eventY >= tableRect.top - outerHitSlop &&
        eventY <= tableRect.bottom + outerHitSlop
      ) {
        hitDistances.push(eventX - tableRect.right);
      }

      if (
        eventY < tableRect.top &&
        eventY >= tableRect.top - outerHitSlop &&
        eventX >= tableRect.left - outerHitSlop &&
        eventX <= tableRect.right + outerHitSlop
      ) {
        hitDistances.push(tableRect.top - eventY);
      }

      if (
        eventY > tableRect.bottom &&
        eventY <= tableRect.bottom + outerHitSlop &&
        eventX >= tableRect.left - outerHitSlop &&
        eventX <= tableRect.right + outerHitSlop
      ) {
        hitDistances.push(eventY - tableRect.bottom);
      }

      if (isTemplateEditorCandidateBlockFocusTableElement(tableElement)) {
        const insideHitSlop = Math.min(
          hitSlop,
          Math.max(2, Math.min(tableRect.width, tableRect.height) / 4),
        );

        if (eventX >= tableRect.left && eventX <= tableRect.right && eventY >= tableRect.top && eventY <= tableRect.bottom) {
          const insideEdgeDistance = Math.min(
            eventX - tableRect.left,
            tableRect.right - eventX,
            eventY - tableRect.top,
            tableRect.bottom - eventY,
          );

          if (insideEdgeDistance <= insideHitSlop) {
            hitDistances.push(insideEdgeDistance);
          }
        }
      }

      if (!hitDistances.length) {
        return null;
      }

      return Math.min(...hitDistances);
    }

    function getTemplateEditorTableObjectBorderTarget(event) {
      const tableElement = getTemplateEditorTableObjectTarget(event?.target);

      if (tableElement) {
        return getTemplateEditorTableObjectOutsideBorderDistance(tableElement, event) === null ? null : tableElement;
      }

      let closestTableElement = null;
      let closestDistance = Infinity;

      shell.surfaceElement?.querySelectorAll?.("table").forEach((candidateTableElement) => {
        const distance = getTemplateEditorTableObjectOutsideBorderDistance(candidateTableElement, event);

        if (distance !== null && distance < closestDistance) {
          closestTableElement = candidateTableElement;
          closestDistance = distance;
        }
      });

      return closestTableElement;
    }

    const { getTemplateEditorTableObjectOverlayElement, updateTemplateEditorTableObjectOverlay } =
      globalThis.ExamListTemplateEditorTableObjectOverlay.createTemplateEditorTableObjectOverlayController({
        getHoveredTable: () => templateEditorTableHoverElement,
        getTemplateEditorImageOverlayContainer,
        getTemplateEditorModal,
        isTemplateEditorTableObjectElement,
        ownerDocument,
        shell,
        state,
      });

    const tableObjectGeometryController = createTemplateEditorTableObjectGeometryController({
      TEMPLATE_EDITOR_TABLE_MIN_SIZE,
      buildTemplateTableCellMap,
      ensureTemplateEditorTableColGroup,
      getTemplateEditorDocumentElement,
      getTemplateEditorMeasuredColumnWidth,
      isTemplateEditorTableObjectElement,
      parseTemplateEditorPixelStyle,
      syncTemplateEditorTableWidth,
    });
    const {
      applyTemplateEditorTableObjectHeight,
      applyTemplateEditorTableObjectWidth,
      getTemplateEditorBoundedTableObjectCoordinate,
      getTemplateEditorTableObjectResizeDirections,
      normalizeTemplateEditorTableObjectResizeCorner,
      prepareTemplateEditorTableObjectForMove,
      removeTemplateEditorTableObjectFlowSpacer,
      syncTemplateEditorTableObjectFlowSpacer,
    } = tableObjectGeometryController;
    const {
      nudgeSelectedTemplateEditorTableObject,
      releaseTemplateEditorTableObjectMoveSession,
      releaseTemplateEditorTableObjectResizeSession,
      startTemplateEditorTableObjectMoveSession,
      startTemplateEditorTableObjectResizeSession,
    } = createTemplateEditorTableObjectSessionController({
      TEMPLATE_EDITOR_TABLE_MIN_SIZE,
      applyTemplateEditorTableObjectHeight,
      applyTemplateEditorTableObjectWidth,
      getTemplateEditorBoundedTableObjectCoordinate,
      getTemplateEditorDocumentElement,
      getTemplateEditorTableObjectOverlayElement,
      getTemplateEditorTableObjectResizeDirections,
      isTemplateEditorTableObjectElement,
      normalizeTemplateEditorTableObjectResizeCorner,
      prepareTemplateEditorTableObjectForMove,
      selectTemplateEditorTableObject: (...args) => selectTemplateEditorTableObject(...args),
      shell,
      state,
      syncTemplateEditorTableObjectFlowSpacer,
      syncTemplateEditorContent,
      updateTemplateEditorTableObjectOverlay,
    });

    function clearTemplateEditorTableObjectHoverState({ updateOverlay = true } = {}) {
      templateEditorTableHoverElement = null;

      if (updateOverlay) {
        updateTemplateEditorTableObjectOverlay();
      }
    }

    function updateTemplateEditorTableObjectHoverState(event) {
      if (
        state.templateEditor.imageResizeSession ||
        state.templateEditor.imageMoveSession ||
        state.templateEditor.tableObjectMoveSession ||
        state.templateEditor.tableObjectResizeSession ||
        state.templateEditor.tableResizeSession ||
        state.templateEditor.tableSelectionSession
      ) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;

      if (target?.closest?.(".template-editor-table-selection")) {
        updateTemplateEditorTableObjectOverlay();
        return;
      }

      templateEditorTableHoverElement = getTemplateEditorTableObjectBorderTarget(event);
      updateTemplateEditorTableObjectOverlay();
    }

    function clearTemplateEditorTableObjectSelection({ updateOverlay = true } = {}) {
      if (state.templateEditor.tableObjectMoveSession) {
        releaseTemplateEditorTableObjectMoveSession({ sync: false });
      }

      if (state.templateEditor.tableObjectResizeSession) {
        releaseTemplateEditorTableObjectResizeSession({ sync: false });
      }

      shell.surfaceElement
        ?.querySelectorAll?.(".is-selected-table-object")
        .forEach((tableElement) => tableElement.classList.remove("is-selected-table-object"));
      state.templateEditor.selectedTableElement = null;

      if (updateOverlay) {
        updateTemplateEditorTableObjectOverlay();
      }
    }

    function selectTemplateEditorTableObject(tableElement, { focus = true } = {}) {
      if (!isTemplateEditorTableObjectElement(tableElement)) {
        clearTemplateEditorTableObjectSelection();
        return null;
      }

      clearTemplateEditorTableObjectSelection({ updateOverlay: false });
      clearTemplateEditorImageSelection();
      clearTemplateEditorTableSelection();
      clearTemplateEditorActiveCell();
      tableElement.classList.add("is-selected-table-object");
      state.templateEditor.selectedTableElement = tableElement;
      templateEditorTableHoverElement = tableElement;

      if (focus) {
        shell.surfaceElement.focus({ preventScroll: true });
      }

      ownerWindow.getSelection?.()?.removeAllRanges();
      state.templateEditor.savedRange = null;
      updateTemplateEditorFormattingControls();
      updateTemplateTableControls();
      updateTemplateEditorTableObjectOverlay();
      return tableElement;
    }

    function handleTemplateEditorTableObjectPointerDown(event) {
      const target = event.target instanceof Element ? event.target : null;
      const moveHandleElement = target?.closest?.("[data-template-table-object-move-handle]");
      const handleElement = target?.closest?.("[data-template-table-object-handle]");
      const borderTarget = getTemplateEditorTableObjectBorderTarget(event);
      const caretHost = borderTarget ? null : getTemplateEditorTableObjectCaretHost(target, event);

      if (caretHost) {
        event.preventDefault();
        event.stopPropagation();
        clearTemplateEditorActiveCell();
        clearTemplateEditorImageSelection();
        clearTemplateEditorTableSelection();
        clearTemplateEditorTableObjectSelection({ updateOverlay: false });
        shell.surfaceElement
          .querySelectorAll("[data-candidate-block-grid].is-selected-candidate-block-grid, .examlist-candidate-block-grid.is-selected-candidate-block-grid")
          .forEach((gridElement) => gridElement.classList.remove("is-selected-candidate-block-grid"));
        placeCaretInTemplateEditorTableObjectHost(caretHost);
        updateTemplateEditorFormattingControls();
        updateTemplateTableControls();
        updateTemplateEditorTableObjectOverlay();
        return true;
      }

      const controlElement = moveHandleElement || handleElement;
      const controlOverlayElement = controlElement?.closest?.(".template-editor-table-selection") || null;
      const controlTableElement = isTemplateEditorTableObjectElement(controlOverlayElement?.__templateEditorTableElement)
        ? controlOverlayElement.__templateEditorTableElement
        : null;
      if (!moveHandleElement && !handleElement && !borderTarget) {
        return false;
      }

      const tableElement = controlElement
        ? controlTableElement || getTemplateEditorTableObjectOverlayElement()?.__templateEditorTableElement || templateEditorTableHoverElement
        : borderTarget || getTemplateEditorTableObjectOverlayElement()?.__templateEditorTableElement || templateEditorTableHoverElement;

      if (!isTemplateEditorTableObjectElement(tableElement)) {
        return false;
      }

      if (moveHandleElement) {
        if (state.templateEditor.selectedTableElement !== tableElement) {
          selectTemplateEditorTableObject(tableElement);
        }
        return startTemplateEditorTableObjectMoveSession(tableElement, event, moveHandleElement);
      }

      if (handleElement) {
        if (state.templateEditor.selectedTableElement !== tableElement) {
          selectTemplateEditorTableObject(tableElement);
        }
        return startTemplateEditorTableObjectResizeSession(tableElement, handleElement, event);
      }

      event.preventDefault();
      event.stopPropagation();
      selectTemplateEditorTableObject(tableElement);
      return true;
    }

    function createTemplateEditorDeletionParagraph() {
      const paragraph = ownerDocument.createElement("p");

      paragraph.append(ownerDocument.createElement("br"));
      return paragraph;
    }

    function isTemplateEditorBlankDeletionHost(element) {
      if (!(element instanceof HTMLElement) || !/^(P|DIV)$/i.test(String(element.tagName || ""))) {
        return false;
      }

      const text = String(element.textContent || "").replace(/\u00a0/g, " ").trim();
      const hasOnlyLineBreaks = Array.from(element.childNodes || []).every((node) =>
        node.nodeType === Node.TEXT_NODE
          ? !String(node.textContent || "").replace(/\u00a0/g, " ").trim()
          : node.nodeType === Node.ELEMENT_NODE && String(node.tagName || "").toLowerCase() === "br",
      );

      return !text && hasOnlyLineBreaks;
    }

    function dispatchTemplateEditorTableDeletionInput(blockElement) {
      if (!(blockElement instanceof Element)) {
        return;
      }

      const InputEventConstructor = ownerWindow.InputEvent || ownerWindow.Event;

      try {
        blockElement.dispatchEvent(
          new InputEventConstructor("input", {
            bubbles: true,
            data: null,
            inputType: "deleteContent",
          }),
        );
      } catch (error) {
        blockElement.dispatchEvent(new ownerWindow.Event("input", { bubbles: true }));
      }
    }

    function replaceTemplateEditorTableWithCaretHost(tableElement) {
      const candidateBlockElement = tableElement.closest("[data-candidate-block-instance]");
      const paragraph = createTemplateEditorDeletionParagraph();

      if (candidateBlockElement instanceof Element && shell.surfaceElement.contains(candidateBlockElement)) {
        const parentElement = tableElement.parentElement;

        if (
          parentElement instanceof HTMLElement &&
          parentElement !== candidateBlockElement &&
          parentElement.closest("[data-candidate-block-instance]") === candidateBlockElement &&
          /^(P|DIV)$/i.test(String(parentElement.tagName || ""))
        ) {
          parentElement.replaceWith(paragraph);
        } else {
          tableElement.replaceWith(paragraph);
        }

        candidateBlockElement
          .querySelectorAll("p, div")
          .forEach((element) => {
            if (element !== paragraph && isTemplateEditorBlankDeletionHost(element)) {
              element.remove();
            }
          });

        candidateBlockElement.classList.toggle(
          "has-candidate-block-table",
          Boolean(candidateBlockElement.querySelector("table")),
        );
        placeCaretAtEnd(paragraph);
        dispatchTemplateEditorTableDeletionInput(candidateBlockElement);
        return paragraph;
      }

      removeTemplateEditorTableObjectFlowSpacer?.(tableElement);
      const nextElement = tableElement.nextElementSibling;
      const previousElement = tableElement.previousElementSibling;
      const existingCaretHost = isTemplateEditorBlankDeletionHost(nextElement)
        ? nextElement
        : isTemplateEditorBlankDeletionHost(previousElement)
          ? previousElement
          : null;

      if (existingCaretHost) {
        tableElement.remove();
        placeCaretAtEnd(existingCaretHost);
        return existingCaretHost;
      }

      tableElement.replaceWith(paragraph);
      placeCaretAtEnd(paragraph);
      return paragraph;
    }

    return Object.freeze({
      clearTemplateEditorTableObjectHoverState,
      clearTemplateEditorTableObjectSelection,
      handleTemplateEditorTableObjectPointerDown,
      isTemplateEditorTableObjectElement,
      nudgeSelectedTemplateEditorTableObject,
      releaseTemplateEditorTableObjectMoveSession,
      releaseTemplateEditorTableObjectResizeSession,
      replaceTemplateEditorTableWithCaretHost,
      updateTemplateEditorTableObjectHoverState,
      updateTemplateEditorTableObjectOverlay,
    });
  }

  return Object.freeze({
    createTemplateEditorTableObjectController,
  });
});

})();
