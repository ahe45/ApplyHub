(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./object-flow-reflow"));
    return;
  }

  globalScope.ExamListTemplateEditorTableObjectSessions = factory(
    globalScope.ExamListTemplateEditorObjectFlowReflow,
  );
})(typeof globalThis !== "undefined" ? globalThis : this, (objectFlowReflowModule = {}) => {
  function createTemplateEditorTableObjectSessionController({
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
    selectTemplateEditorTableObject,
    shell,
    state,
    syncTemplateEditorTableObjectFlowSpacer,
    syncTemplateEditorContent,
    updateTemplateEditorTableObjectOverlay,
  }) {
    const reflowTemplateEditorObjectRows =
      typeof objectFlowReflowModule.reflowTemplateEditorObjectRows === "function"
        ? objectFlowReflowModule.reflowTemplateEditorObjectRows
        : () => ({ shiftedObjects: [], spacerElement: null });
    let removePendingTableObjectClickSuppression = null;
    const tableObjectClickSuppressionBypassActions = new Set([
      "save-template-layout",
      "open-template-preview",
      "close-template-preview",
      "open-data-tag-sample-modal",
      "close-data-tag-sample-modal",
      "reset-data-tag-sample-modal",
      "save-data-tag-sample-modal",
      "open-generation-unit-settings-modal",
      "close-generation-unit-settings-modal",
      "save-generation-unit-settings-modal",
      "open-page-number-format-modal",
      "close-page-number-format-modal",
      "save-page-number-format-modal",
    ]);

    function canBypassPendingTableObjectClickSuppression(event, ownerWindow) {
      const target = event.target instanceof ownerWindow.Element ? event.target : null;
      const actionTarget = target?.closest?.("[data-action]") || null;
      const actionName = String(actionTarget?.dataset?.action || "").trim();

      return Boolean(actionName && tableObjectClickSuppressionBypassActions.has(actionName));
    }

    function suppressNextTemplateEditorTableObjectClick() {
      const ownerDocument = shell.surfaceElement?.ownerDocument || document;
      const ownerWindow = ownerDocument.defaultView || window;

      ownerWindow.__examlistTemplateEditorObjectInteractionUntil = Date.now() + 750;
      removePendingTableObjectClickSuppression?.();

      let timeoutId = 0;
      const removeSuppression = () => {
        ownerDocument.removeEventListener("click", handleClick, true);
        if (timeoutId) {
          ownerWindow.clearTimeout(timeoutId);
          timeoutId = 0;
        }
        if (removePendingTableObjectClickSuppression === removeSuppression) {
          removePendingTableObjectClickSuppression = null;
        }
      };
      const handleClick = (event) => {
        if (
          Date.now() >= Number(ownerWindow.__examlistTemplateEditorObjectInteractionUntil || 0) ||
          canBypassPendingTableObjectClickSuppression(event, ownerWindow)
        ) {
          removeSuppression();
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        removeSuppression();
      };

      ownerDocument.addEventListener("click", handleClick, true);
      timeoutId = ownerWindow.setTimeout(removeSuppression, 10000);
      removePendingTableObjectClickSuppression = removeSuppression;
    }

    function getTemplateEditorTableObjectIndex(tableElement) {
      if (!isTemplateEditorTableObjectElement(tableElement)) {
        return -1;
      }

      return Array.from(shell.surfaceElement?.querySelectorAll?.("table") || []).indexOf(tableElement);
    }

    function getTemplateEditorTableObjectSignature(tableElement) {
      if (!(tableElement instanceof Element) || String(tableElement.tagName || "").toUpperCase() !== "TABLE") {
        return "";
      }

      const rowShape = Array.from(tableElement.rows || [])
        .map((row) => Array.from(row.cells || []).map((cell) => `${cell.colSpan || 1}:${cell.rowSpan || 1}`).join(","))
        .join("|");
      const text = String(tableElement.textContent || "").replace(/\s+/g, " ").trim();

      return [tableElement.id || "", rowShape, text].join("\n");
    }

    function resolveTemplateEditorTableObjectAfterSync(tableElement, tableIndex, tableSignature = "") {
      if (isTemplateEditorTableObjectElement(tableElement)) {
        return tableElement;
      }

      const tableElements = Array.from(shell.surfaceElement?.querySelectorAll?.("table") || []);
      const indexedTableElement = tableIndex >= 0 ? tableElements[tableIndex] || null : null;

      if (!isTemplateEditorTableObjectElement(indexedTableElement)) {
        return null;
      }

      if (tableSignature && getTemplateEditorTableObjectSignature(indexedTableElement) !== tableSignature) {
        return null;
      }

      return indexedTableElement;
    }

    function getTemplateEditorSurfaceContentSize() {
      const surfaceElement = shell.surfaceElement;

      if (!(surfaceElement instanceof HTMLElement)) {
        return { height: 0, width: 0 };
      }

      const style = window.getComputedStyle(surfaceElement);
      const width =
        (surfaceElement.clientWidth || surfaceElement.getBoundingClientRect().width || 0) -
        (Number.parseFloat(style.paddingLeft) || 0) -
        (Number.parseFloat(style.paddingRight) || 0);
      const height =
        (surfaceElement.clientHeight || surfaceElement.getBoundingClientRect().height || 0) -
        (Number.parseFloat(style.paddingTop) || 0) -
        (Number.parseFloat(style.paddingBottom) || 0);

      return {
        height: Math.max(0, Math.round(height) || 0),
        width: Math.max(0, Math.round(width) || 0),
      };
    }

    function getTemplateEditorTableObjectContainerWidth(containerElement, fallbackWidth = 0) {
      const fallback = Math.round(fallbackWidth) || 0;

      if (containerElement instanceof HTMLElement && containerElement.classList.contains("template-doc")) {
        const contentWidth = Math.round(containerElement.clientWidth || 0);

        return Math.max(
          TEMPLATE_EDITOR_TABLE_MIN_SIZE,
          contentWidth || fallback,
        );
      }

      const surfaceContentSize = getTemplateEditorSurfaceContentSize();

      return Math.max(
        TEMPLATE_EDITOR_TABLE_MIN_SIZE,
        Math.round(containerElement?.clientWidth || 0),
        Math.round(containerElement?.getBoundingClientRect?.().width || 0),
        surfaceContentSize.width,
        fallback,
      );
    }

    function getTemplateEditorTableObjectContainerHeight(containerElement, fallbackHeight = 0) {
      const fallback = Math.round(fallbackHeight) || 0;

      if (containerElement instanceof HTMLElement && containerElement.classList.contains("template-doc")) {
        const contentHeight = Math.round(containerElement.clientHeight || 0);

        return Math.max(
          TEMPLATE_EDITOR_TABLE_MIN_SIZE,
          contentHeight || fallback,
        );
      }

      const surfaceContentSize = getTemplateEditorSurfaceContentSize();

      return Math.max(
        TEMPLATE_EDITOR_TABLE_MIN_SIZE,
        Math.round(containerElement?.scrollHeight || 0),
        Math.round(containerElement?.clientHeight || 0),
        Math.round(containerElement?.getBoundingClientRect?.().height || 0),
        surfaceContentSize.height,
        fallback,
      );
    }

    function getTemplateEditorCandidateBlockContainerWidth(candidateBlockElement, fallbackWidth = 0, visualScale = 1) {
      const safeScale = Math.max(Number(visualScale) || 1, 0.01);
      const visualWidth = (candidateBlockElement?.getBoundingClientRect?.().width || 0) / safeScale;
      const clientWidth = candidateBlockElement?.clientWidth || 0;
      const contentWidth = visualWidth > 0 && clientWidth > 0
        ? Math.min(visualWidth, clientWidth)
        : visualWidth || clientWidth || fallbackWidth || 0;

      return Math.max(
        TEMPLATE_EDITOR_TABLE_MIN_SIZE,
        Math.round(contentWidth - 1),
      );
    }

    function getTemplateEditorCandidateBlockContainerHeight(candidateBlockElement, fallbackHeight = 0, visualScale = 1) {
      const safeScale = Math.max(Number(visualScale) || 1, 0.01);
      const visualHeight = (candidateBlockElement?.getBoundingClientRect?.().height || 0) / safeScale;
      const clientHeight = candidateBlockElement?.clientHeight || 0;
      const contentHeight = visualHeight > 0 && clientHeight > 0
        ? Math.min(visualHeight, clientHeight)
        : visualHeight || clientHeight || fallbackHeight || 0;

      return Math.max(
        TEMPLATE_EDITOR_TABLE_MIN_SIZE,
        Math.round(contentHeight - 1),
      );
    }

    function getTemplateEditorTableObjectCollapsedBorderAdjustment(tableElement) {
      if (!(tableElement instanceof HTMLTableElement)) {
        return 0;
      }

      const tableStyle = window.getComputedStyle(tableElement);

      if (String(tableStyle.borderCollapse || "").trim().toLowerCase() !== "collapse") {
        return 0;
      }

      const rows = Array.from(tableElement.rows || []);
      const leftCell = rows.map((rowElement) => rowElement.cells?.[0]).find(Boolean);
      const rightCell = rows
        .map((rowElement) => rowElement.cells?.[Math.max(0, (rowElement.cells?.length || 1) - 1)])
        .find(Boolean);
      const leftStyle = leftCell ? window.getComputedStyle(leftCell) : null;
      const rightStyle = rightCell ? window.getComputedStyle(rightCell) : null;
      const parseWidth = (value) => {
        const parsedValue = Number.parseFloat(String(value || ""));

        return Number.isFinite(parsedValue) ? parsedValue : 0;
      };

      return Math.max(
        parseWidth(tableStyle.borderLeftWidth),
        parseWidth(tableStyle.borderRightWidth),
        parseWidth(leftStyle?.borderLeftWidth),
        parseWidth(rightStyle?.borderRightWidth),
      );
    }

    function getTemplateEditorTableObjectRenderedWidthAdjustment(tableElement) {
      if (!(tableElement instanceof HTMLTableElement)) {
        return 0;
      }

      const inlineWidth = /^-?\d+(?:\.\d+)?px$/i.test(String(tableElement.style.width || "").trim())
        ? parseFloat(tableElement.style.width)
        : 0;
      const rectWidth = tableElement.getBoundingClientRect?.().width || 0;
      const renderedWidthAdjustment = inlineWidth > 0 && rectWidth > inlineWidth
        ? Math.ceil(rectWidth - inlineWidth)
        : 0;

      return Math.max(
        renderedWidthAdjustment,
        Math.max(0, Math.ceil(getTemplateEditorTableObjectCollapsedBorderAdjustment(tableElement))),
      );
    }

    function getCandidateBlockFocusScale(element) {
      const focusBlock = element?.closest?.("[data-candidate-block-instance].is-candidate-block-focus-editor") || null;

      if (!(focusBlock instanceof HTMLElement)) {
        return 1;
      }

      const computedStyle = window.getComputedStyle(focusBlock);
      const scale = Number.parseFloat(
        computedStyle.getPropertyValue("--examlist-candidate-block-focus-editor-scale") ||
          computedStyle.getPropertyValue("--examlist-candidate-block-focus-scale"),
      );

      return Number.isFinite(scale) && scale > 0 ? scale : 1;
    }

    function selectTemplateEditorTableObjectAfterSync(tableElement, tableIndex, { delayed = true } = {}) {
      const tableSignature = getTemplateEditorTableObjectSignature(tableElement);
      const resolvedTableElement = resolveTemplateEditorTableObjectAfterSync(tableElement, tableIndex, tableSignature);

      if (resolvedTableElement) {
        selectTemplateEditorTableObject(resolvedTableElement);
      }

      if (!delayed) {
        return;
      }

      const ownerWindow = shell.surfaceElement?.ownerDocument?.defaultView || window;

      ownerWindow.setTimeout(() => {
        if (state.templateEditor.tableObjectMoveSession || state.templateEditor.tableObjectResizeSession) {
          return;
        }

        const nextTableElement = resolveTemplateEditorTableObjectAfterSync(
          resolvedTableElement || tableElement,
          tableIndex,
          tableSignature,
        );

        if (nextTableElement) {
          selectTemplateEditorTableObject(nextTableElement);
        }
      }, 0);
    }

    function startTemplateEditorTableObjectResizeSession(tableElement, handleElement, event) {
      if (event.button !== 0 || !isTemplateEditorTableObjectElement(tableElement)) {
        return false;
      }

      const corner = normalizeTemplateEditorTableObjectResizeCorner(handleElement?.dataset?.templateTableObjectHandlePosition);
      const directions = getTemplateEditorTableObjectResizeDirections(corner);
      const documentElement = getTemplateEditorDocumentElement();
      const candidateBlockElement = tableElement.closest("[data-candidate-block-instance]");
      const startingPosition = candidateBlockElement instanceof HTMLElement
        ? null
        : prepareTemplateEditorTableObjectForMove(tableElement, {
            applyHeight: directions.y !== 0,
            applyWidth: directions.x !== 0,
          });
      const tableRect = tableElement.getBoundingClientRect();
      const focusScale = getCandidateBlockFocusScale(tableElement);
      const sizeContainer = candidateBlockElement instanceof HTMLElement ? candidateBlockElement : documentElement;
      const startWidth = Math.max(
        TEMPLATE_EDITOR_TABLE_MIN_SIZE,
        Math.round(startingPosition?.width || tableElement.offsetWidth || tableRect.width / focusScale || 0),
      );
      const startHeight = Math.max(
        TEMPLATE_EDITOR_TABLE_MIN_SIZE,
        Math.round(startingPosition?.height || tableElement.offsetHeight || tableRect.height / focusScale || 0),
      );
      const visualScaleX = Math.max(tableRect.width / Math.max(startWidth, 1), 0.01);
      const visualScaleY = Math.max(tableRect.height / Math.max(startHeight, 1), 0.01);
      const candidateBlockRect = candidateBlockElement instanceof HTMLElement
        ? candidateBlockElement.getBoundingClientRect()
        : null;
      const startLeft = candidateBlockRect
        ? Math.max(0, Math.round((tableRect.left - candidateBlockRect.left) / visualScaleX))
        : Math.round(startingPosition?.left || 0);
      const startTop = candidateBlockRect
        ? Math.max(0, Math.round((tableRect.top - candidateBlockRect.top) / visualScaleY))
        : Math.round(startingPosition?.top || 0);
      const rawDocumentWidth = candidateBlockElement instanceof HTMLElement
        ? getTemplateEditorCandidateBlockContainerWidth(candidateBlockElement, tableRect.width, visualScaleX)
        : getTemplateEditorTableObjectContainerWidth(sizeContainer || documentElement, tableRect.width);
      const documentWidth = candidateBlockElement instanceof HTMLElement
        ? rawDocumentWidth
        : Math.max(
            TEMPLATE_EDITOR_TABLE_MIN_SIZE,
            rawDocumentWidth - getTemplateEditorTableObjectRenderedWidthAdjustment(tableElement),
          );
      const documentHeight = candidateBlockElement instanceof HTMLElement
        ? getTemplateEditorCandidateBlockContainerHeight(candidateBlockElement, tableRect.height, visualScaleY)
        : getTemplateEditorTableObjectContainerHeight(documentElement, tableRect.height);
      let maxWidth = documentWidth;
      let maxHeight = documentHeight;

      if (candidateBlockElement instanceof HTMLElement) {
        maxWidth = Math.max(
          TEMPLATE_EDITOR_TABLE_MIN_SIZE,
          directions.x !== 0 ? documentWidth - startLeft : startWidth,
        );
        maxHeight = Math.max(
          TEMPLATE_EDITOR_TABLE_MIN_SIZE,
          directions.y !== 0 ? documentHeight - startTop : startHeight,
        );
      } else if (startingPosition) {
        maxWidth = Math.max(
          TEMPLATE_EDITOR_TABLE_MIN_SIZE,
          directions.x < 0 ? startLeft + startWidth : directions.x > 0 ? documentWidth - startLeft : startWidth,
        );
        maxHeight = Math.max(
          TEMPLATE_EDITOR_TABLE_MIN_SIZE,
          directions.y < 0 ? startTop + startHeight : directions.y > 0 ? documentHeight - startTop : startHeight,
        );
      }

      event.preventDefault();
      event.stopPropagation();
      suppressNextTemplateEditorTableObjectClick();

      state.templateEditor.tableObjectResizeSession = {
        corner,
        didChange: false,
        directionX: directions.x,
        directionY: directions.y,
        maxHeight,
        maxWidth,
        focusScale,
        visualScaleX,
        visualScaleY,
        pointerId: event.pointerId,
        startHeight,
        startLeft,
        startTop,
        startWidth,
        startX: event.clientX,
        startY: event.clientY,
        lastHeight: startHeight,
        lastWidth: startWidth,
        table: tableElement,
      };
      shell.surfaceElement.classList.add("is-table-object-resizing", `is-table-object-resizing-${corner}`);
      getTemplateEditorTableObjectOverlayElement()?.classList.add("is-resizing");
      try {
        handleElement?.setPointerCapture?.(event.pointerId);
      } catch (_error) {
        // Synthetic pointer events used in smoke tests may not have an active capture target.
      }
      window.addEventListener("pointermove", handleTemplateEditorTableObjectResizeMove, true);
      window.addEventListener("pointerup", handleTemplateEditorTableObjectResizeEnd, true);
      window.addEventListener("pointercancel", handleTemplateEditorTableObjectResizeEnd, true);
      return true;
    }

    function handleTemplateEditorTableObjectResizeMove(event) {
      const resizeSession = state.templateEditor.tableObjectResizeSession;

      if (
        !resizeSession ||
        resizeSession.pointerId !== event.pointerId ||
        !isTemplateEditorTableObjectElement(resizeSession.table)
      ) {
        return;
      }

      event.preventDefault();

      const deltaX = (event.clientX - resizeSession.startX) / Math.max(resizeSession.visualScaleX || resizeSession.focusScale || 1, 0.01);
      const deltaY = (event.clientY - resizeSession.startY) / Math.max(resizeSession.visualScaleY || resizeSession.focusScale || 1, 0.01);
      let nextWidth = resizeSession.directionX === 0
        ? Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, Math.round(resizeSession.startWidth))
        : Math.min(
            resizeSession.maxWidth,
            Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, Math.round(resizeSession.startWidth + deltaX * resizeSession.directionX)),
          );
      let nextHeight = resizeSession.directionY === 0
        ? Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, Math.round(resizeSession.startHeight))
        : Math.min(
            resizeSession.maxHeight,
            Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, Math.round(resizeSession.startHeight + deltaY * resizeSession.directionY)),
          );

      if (event.shiftKey && resizeSession.directionX !== 0 && resizeSession.directionY !== 0) {
        const widthScale = nextWidth / resizeSession.startWidth;
        const heightScale = nextHeight / resizeSession.startHeight;
        const rawScale = Math.abs(widthScale - 1) >= Math.abs(heightScale - 1) ? widthScale : heightScale;
        const maxScale = Math.min(resizeSession.maxWidth / resizeSession.startWidth, resizeSession.maxHeight / resizeSession.startHeight);
        const minScale = Math.max(
          TEMPLATE_EDITOR_TABLE_MIN_SIZE / resizeSession.startWidth,
          TEMPLATE_EDITOR_TABLE_MIN_SIZE / resizeSession.startHeight,
        );
        const boundedScale = Math.min(Math.max(Number.isFinite(rawScale) ? rawScale : minScale, minScale), maxScale);

        nextWidth = Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, Math.round(resizeSession.startWidth * boundedScale));
        nextHeight = Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, Math.round(resizeSession.startHeight * boundedScale));
      }

      const shouldApplyWidth = resizeSession.directionX !== 0 && nextWidth !== resizeSession.lastWidth;
      const shouldApplyHeight = resizeSession.directionY !== 0 && nextHeight !== resizeSession.lastHeight;

      if (!shouldApplyWidth && !shouldApplyHeight) {
        return;
      }

      if (shouldApplyWidth && resizeSession.directionX < 0 && String(resizeSession.table.style.position || "") === "absolute") {
        resizeSession.table.style.left = `${Math.max(0, Math.round(resizeSession.startLeft + resizeSession.startWidth - nextWidth))}px`;
      }

      if (shouldApplyHeight && resizeSession.directionY < 0 && String(resizeSession.table.style.position || "") === "absolute") {
        resizeSession.table.style.top = `${Math.max(0, Math.round(resizeSession.startTop + resizeSession.startHeight - nextHeight))}px`;
      }

      if (shouldApplyWidth && applyTemplateEditorTableObjectWidth(resizeSession.table, nextWidth)) {
        resizeSession.lastWidth = nextWidth;
        resizeSession.didChange = true;
      }

      if (shouldApplyHeight && applyTemplateEditorTableObjectHeight(resizeSession.table, nextHeight)) {
        resizeSession.lastHeight = nextHeight;
        resizeSession.didChange = true;
      }

      if (
        shouldApplyHeight &&
        resizeSession.directionY < 0 &&
        String(resizeSession.table.style.position || "") === "absolute"
      ) {
        const actualHeight =
          Number.parseFloat(resizeSession.table.style.height || "") ||
          (resizeSession.table.getBoundingClientRect().height / Math.max(resizeSession.visualScaleY || resizeSession.focusScale || 1, 0.01));
        const correctedTop = Math.max(0, Math.round(resizeSession.startTop + resizeSession.startHeight - actualHeight));

        resizeSession.table.style.top = `${correctedTop}px`;
        resizeSession.lastTop = correctedTop;
        resizeSession.lastHeight = Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, Math.round(actualHeight));
      }

      syncTemplateEditorTableObjectFlowSpacer?.(resizeSession.table, {
        height: resizeSession.lastHeight,
        top: parseFloat(resizeSession.table.style.top || "") || resizeSession.startTop,
      });
      updateTemplateEditorTableObjectOverlay();
    }

    function handleTemplateEditorTableObjectResizeEnd(event) {
      const resizeSession = state.templateEditor.tableObjectResizeSession;

      if (!resizeSession || resizeSession.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      releaseTemplateEditorTableObjectResizeSession({ sync: true });
    }

    function releaseTemplateEditorTableObjectResizeSession({ sync = true } = {}) {
      const resizeSession = state.templateEditor.tableObjectResizeSession;

      if (!resizeSession) {
        return;
      }

      window.removeEventListener("pointermove", handleTemplateEditorTableObjectResizeMove, true);
      window.removeEventListener("pointerup", handleTemplateEditorTableObjectResizeEnd, true);
      window.removeEventListener("pointercancel", handleTemplateEditorTableObjectResizeEnd, true);
      state.templateEditor.tableObjectResizeSession = null;
      shell.surfaceElement.classList.remove(
        "is-table-object-resizing",
        "is-table-object-resizing-top-left",
        "is-table-object-resizing-top",
        "is-table-object-resizing-top-right",
        "is-table-object-resizing-right",
        "is-table-object-resizing-bottom",
        "is-table-object-resizing-bottom-left",
        "is-table-object-resizing-bottom-right",
        "is-table-object-resizing-left",
      );
      getTemplateEditorTableObjectOverlayElement()?.classList.remove("is-resizing");

      if (sync && resizeSession.didChange && isTemplateEditorTableObjectElement(resizeSession.table)) {
        const tableIndex = getTemplateEditorTableObjectIndex(resizeSession.table);
        const shouldDelayReselect = !resizeSession.table.closest("[data-candidate-block-instance]");

        suppressNextTemplateEditorTableObjectClick();
        syncTemplateEditorContent({ preserveSelection: true, focusEditor: true });
        selectTemplateEditorTableObjectAfterSync(resizeSession.table, tableIndex, { delayed: shouldDelayReselect });
        return;
      }

      updateTemplateEditorTableObjectOverlay();
    }

    function startTemplateEditorTableObjectMoveSession(tableElement, event, captureElement = null) {
      if (event.button !== 0 || !isTemplateEditorTableObjectElement(tableElement)) {
        return false;
      }

      const startingPosition = prepareSelectedTemplateEditorTableObjectForNudge(tableElement);

      if (!startingPosition) {
        return false;
      }

      event.preventDefault();
      event.stopPropagation();
      suppressNextTemplateEditorTableObjectClick();

      state.templateEditor.tableObjectMoveSession = {
        didChange: false,
        height: startingPosition.height,
        isCandidateBlockTable: startingPosition.isCandidateBlockTable,
        scaleX: tableElement.getBoundingClientRect().width / Math.max(startingPosition.width, 1),
        scaleY: tableElement.getBoundingClientRect().height / Math.max(startingPosition.height, 1),
        lastLeft: startingPosition.left,
        lastTop: startingPosition.top,
        maxDocumentHeight: startingPosition.maxDocumentHeight,
        maxDocumentWidth: startingPosition.maxDocumentWidth,
        pointerId: event.pointerId,
        startLeft: startingPosition.left,
        startTop: startingPosition.top,
        startX: event.clientX,
        startY: event.clientY,
        table: tableElement,
        width: startingPosition.width,
      };
      shell.surfaceElement.classList.add("is-table-object-moving");
      getTemplateEditorTableObjectOverlayElement()?.classList.add("is-moving");
      try {
        captureElement?.setPointerCapture?.(event.pointerId);
      } catch (_error) {
        // Synthetic pointer events used in smoke tests may not have an active capture target.
      }
      window.addEventListener("pointermove", handleTemplateEditorTableObjectMove, true);
      window.addEventListener("pointerup", handleTemplateEditorTableObjectMoveEnd, true);
      window.addEventListener("pointercancel", handleTemplateEditorTableObjectMoveEnd, true);
      return true;
    }

    function handleTemplateEditorTableObjectMove(event) {
      const moveSession = state.templateEditor.tableObjectMoveSession;

      if (
        !moveSession ||
        moveSession.pointerId !== event.pointerId ||
        !isTemplateEditorTableObjectElement(moveSession.table)
      ) {
        return;
      }

      event.preventDefault();

      const nextLeft = getTemplateEditorBoundedTableObjectCoordinate(
        moveSession.startLeft + (event.clientX - moveSession.startX) / Math.max(moveSession.scaleX, 0.01),
        moveSession.maxDocumentWidth - moveSession.width,
      );
      const nextTop = getTemplateEditorBoundedTableObjectCoordinate(
        moveSession.startTop + (event.clientY - moveSession.startY) / Math.max(moveSession.scaleY, 0.01),
        moveSession.maxDocumentHeight - moveSession.height,
      );

      if (nextLeft === moveSession.lastLeft && nextTop === moveSession.lastTop) {
        return;
      }

      moveSession.table.style.left = `${nextLeft}px`;
      moveSession.table.style.top = `${nextTop}px`;
      if (!moveSession.isCandidateBlockTable) {
        reflowTemplateEditorObjectRows(moveSession.table, {
          activeHeight: moveSession.height,
          activeTop: nextTop,
          documentElement: getTemplateEditorDocumentElement(),
          minimumHeight: TEMPLATE_EDITOR_TABLE_MIN_SIZE,
          movementY: nextTop - moveSession.lastTop,
          reorderByPosition: Math.abs(nextTop - moveSession.lastTop) > 0.5,
        });
        syncTemplateEditorTableObjectFlowSpacer?.(moveSession.table, {
          height: moveSession.height,
          top: nextTop,
        });
      }

      moveSession.lastLeft = nextLeft;
      moveSession.lastTop = nextTop;
      moveSession.didChange = true;
      updateTemplateEditorTableObjectOverlay();
    }

    function handleTemplateEditorTableObjectMoveEnd(event) {
      const moveSession = state.templateEditor.tableObjectMoveSession;

      if (!moveSession || moveSession.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      releaseTemplateEditorTableObjectMoveSession({ sync: true });
    }

    function releaseTemplateEditorTableObjectMoveSession({ sync = true } = {}) {
      const moveSession = state.templateEditor.tableObjectMoveSession;

      if (!moveSession) {
        return;
      }

      window.removeEventListener("pointermove", handleTemplateEditorTableObjectMove, true);
      window.removeEventListener("pointerup", handleTemplateEditorTableObjectMoveEnd, true);
      window.removeEventListener("pointercancel", handleTemplateEditorTableObjectMoveEnd, true);
      state.templateEditor.tableObjectMoveSession = null;
      shell.surfaceElement.classList.remove("is-table-object-moving");
      getTemplateEditorTableObjectOverlayElement()?.classList.remove("is-moving");

      if (sync && moveSession.didChange && isTemplateEditorTableObjectElement(moveSession.table)) {
        const tableIndex = getTemplateEditorTableObjectIndex(moveSession.table);

        suppressNextTemplateEditorTableObjectClick();
        syncTemplateEditorContent({ preserveSelection: true, focusEditor: true, normalizeTables: false });
        selectTemplateEditorTableObjectAfterSync(moveSession.table, tableIndex, { delayed: !moveSession.isCandidateBlockTable });
        return;
      }

      updateTemplateEditorTableObjectOverlay();
    }

    function parseTemplateEditorTableObjectPixelLength(value = "") {
      const normalizedValue = String(value || "").trim();

      return /^-?\d+(?:\.\d+)?px$/i.test(normalizedValue) ? Number.parseFloat(normalizedValue) : 0;
    }

    function removeEmptyTemplateEditorTableObjectHost(hostElement, containerElement) {
      if (
        !(hostElement instanceof HTMLElement) ||
        hostElement === containerElement ||
        !/^(P|DIV)$/i.test(String(hostElement.tagName || ""))
      ) {
        return;
      }

      const text = String(hostElement.textContent || "").replace(/\u00a0/g, " ").trim();
      const hasMeaningfulObject = Boolean(
        hostElement.querySelector("img, table, hr, [data-template-tag-value], .template-token, .template-generated-object"),
      );

      if (!text && !hasMeaningfulObject) {
        hostElement.remove();
      }
    }

    function prepareTemplateEditorCandidateBlockTableObjectForMove(tableElement) {
      const candidateBlockElement = tableElement?.closest?.("[data-candidate-block-instance]");

      if (!(candidateBlockElement instanceof HTMLElement) || !isTemplateEditorTableObjectElement(tableElement)) {
        return null;
      }

      const tableRect = tableElement.getBoundingClientRect();
      const candidateBlockRect = candidateBlockElement.getBoundingClientRect();
      const focusScale = getCandidateBlockFocusScale(tableElement);
      const width = Math.max(
        TEMPLATE_EDITOR_TABLE_MIN_SIZE,
        Math.round(
          parseTemplateEditorTableObjectPixelLength(tableElement.style.width) ||
            tableElement.offsetWidth ||
            tableRect.width / Math.max(focusScale, 0.01) ||
            0,
        ),
      );
      const height = Math.max(
        TEMPLATE_EDITOR_TABLE_MIN_SIZE,
        Math.round(
          parseTemplateEditorTableObjectPixelLength(tableElement.style.height) ||
            tableElement.offsetHeight ||
            tableRect.height / Math.max(focusScale, 0.01) ||
            0,
        ),
      );
      const visualScaleX = Math.max(tableRect.width / Math.max(width, 1) || focusScale, 0.01);
      const visualScaleY = Math.max(tableRect.height / Math.max(height, 1) || focusScale, 0.01);
      const maxDocumentWidth = getTemplateEditorCandidateBlockContainerWidth(candidateBlockElement, tableRect.width, visualScaleX);
      const maxDocumentHeight = getTemplateEditorCandidateBlockContainerHeight(candidateBlockElement, tableRect.height, visualScaleY);
      const left = String(tableElement.style.position || "") === "absolute"
        ? getTemplateEditorBoundedTableObjectCoordinate(
            parseTemplateEditorTableObjectPixelLength(tableElement.style.left) || tableElement.offsetLeft || 0,
            maxDocumentWidth - width,
          )
        : getTemplateEditorBoundedTableObjectCoordinate(
            (tableRect.left - candidateBlockRect.left) / visualScaleX,
            maxDocumentWidth - width,
          );
      const top = String(tableElement.style.position || "") === "absolute"
        ? getTemplateEditorBoundedTableObjectCoordinate(
            parseTemplateEditorTableObjectPixelLength(tableElement.style.top) || tableElement.offsetTop || 0,
            maxDocumentHeight - height,
          )
        : getTemplateEditorBoundedTableObjectCoordinate(
            (tableRect.top - candidateBlockRect.top) / visualScaleY,
            maxDocumentHeight - height,
          );
      const previousParent = tableElement.parentElement;

      if (window.getComputedStyle(candidateBlockElement).position === "static") {
        candidateBlockElement.style.position = "relative";
      }

      tableElement.style.position = "absolute";
      tableElement.style.left = `${left}px`;
      tableElement.style.top = `${top}px`;
      tableElement.style.width = `${width}px`;
      tableElement.style.height = `${height}px`;
      tableElement.style.margin = "0";
      tableElement.style.maxWidth = "none";
      tableElement.style.zIndex = "2";

      if (tableElement.parentElement !== candidateBlockElement) {
        candidateBlockElement.append(tableElement);
        removeEmptyTemplateEditorTableObjectHost(previousParent, candidateBlockElement);
      }

      return {
        height,
        isCandidateBlockTable: true,
        left,
        maxDocumentHeight,
        maxDocumentWidth,
        top,
        width,
      };
    }

    function prepareSelectedTemplateEditorTableObjectForNudge(tableElement) {
      const normalMetrics = prepareTemplateEditorTableObjectForMove(tableElement, { syncSegments: false });

      if (normalMetrics) {
        const documentElement = getTemplateEditorDocumentElement();

        return {
          ...normalMetrics,
          isCandidateBlockTable: false,
          maxDocumentHeight: getTemplateEditorTableObjectContainerHeight(documentElement, normalMetrics.height),
          maxDocumentWidth: getTemplateEditorTableObjectContainerWidth(documentElement, normalMetrics.width),
        };
      }

      return prepareTemplateEditorCandidateBlockTableObjectForMove(tableElement);
    }

    function nudgeSelectedTemplateEditorTableObject(deltaX = 0, deltaY = 0) {
      const selectedTable = state.templateEditor.selectedTableElement;

      if (
        state.templateEditor.tableObjectMoveSession ||
        state.templateEditor.tableObjectResizeSession ||
        !isTemplateEditorTableObjectElement(selectedTable)
      ) {
        return false;
      }

      const metrics = prepareSelectedTemplateEditorTableObjectForNudge(selectedTable);

      if (!metrics) {
        return false;
      }

      const nextLeft = getTemplateEditorBoundedTableObjectCoordinate(
        Number(metrics.left || 0) + Number(deltaX || 0),
        metrics.maxDocumentWidth - metrics.width,
      );
      const nextTop = getTemplateEditorBoundedTableObjectCoordinate(
        Number(metrics.top || 0) + Number(deltaY || 0),
        metrics.maxDocumentHeight - metrics.height,
      );
      const didChange =
        nextLeft !== Math.round(Number(metrics.left || 0)) ||
        nextTop !== Math.round(Number(metrics.top || 0));

      selectedTable.style.left = `${nextLeft}px`;
      selectedTable.style.top = `${nextTop}px`;

      if (!metrics.isCandidateBlockTable) {
        reflowTemplateEditorObjectRows(selectedTable, {
          activeHeight: metrics.height,
          activeTop: nextTop,
          documentElement: getTemplateEditorDocumentElement(),
          minimumHeight: TEMPLATE_EDITOR_TABLE_MIN_SIZE,
          movementY: nextTop - Number(metrics.top || 0),
          reorderByPosition: Math.abs(nextTop - Number(metrics.top || 0)) > 0.5,
        });
        syncTemplateEditorTableObjectFlowSpacer?.(selectedTable, {
          height: metrics.height,
          top: nextTop,
        });
      }

      updateTemplateEditorTableObjectOverlay();

      if (didChange) {
        const tableIndex = getTemplateEditorTableObjectIndex(selectedTable);

        syncTemplateEditorContent({ preserveSelection: true, focusEditor: true, normalizeTables: false });
        selectTemplateEditorTableObjectAfterSync(selectedTable, tableIndex, { delayed: !metrics.isCandidateBlockTable });
      }

      return true;
    }

    return Object.freeze({
      nudgeSelectedTemplateEditorTableObject,
      releaseTemplateEditorTableObjectMoveSession,
      releaseTemplateEditorTableObjectResizeSession,
      startTemplateEditorTableObjectMoveSession,
      startTemplateEditorTableObjectResizeSession,
    });
  }

  return Object.freeze({
    createTemplateEditorTableObjectSessionController,
  });
});

})();
