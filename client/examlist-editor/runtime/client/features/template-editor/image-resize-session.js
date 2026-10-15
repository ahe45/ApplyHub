(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalScope);
    return;
  }

  globalScope.ExamListTemplateEditorImageResizeSession = factory(globalScope);
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  const geometry = globalScope.ExamListTemplateEditorImageSessionGeometry;

  if (!geometry) {
    throw new Error("image-session-geometry.js must be loaded before image-resize-session.js.");
  }

  function createTemplateEditorImageResizeSessionController({
    TEMPLATE_EDITOR_IMAGE_MIN_SIZE,
    getSelectedTemplateEditorImage,
    getTemplateEditorDocumentElement,
    getTemplateEditorImageOverlay,
    getTemplateEditorSurface,
    parseTemplateEditorPixelStyle,
    prepareTemplateEditorImageForMove,
    selectTemplateEditorImage,
    state,
    syncTemplateEditorContent,
    updateTemplateEditorImageSelectionOverlay,
  }) {
    function getTemplateEditorImageTableCell(imageElement, templateEditorSurface) {
      const cellElement = imageElement?.closest?.("td, th") || null;

      return cellElement instanceof HTMLElement && templateEditorSurface?.contains(cellElement)
        ? cellElement
        : null;
    }

    function getTemplateEditorFinitePixelValue(value) {
      const parsedValue = Number.parseFloat(String(value || "").trim());

      return Number.isFinite(parsedValue) ? parsedValue : 0;
    }

    function getTemplateEditorCandidateBlockVisualScale(element) {
      const blockElement = element?.closest?.("[data-candidate-block-instance]") || null;

      if (!(blockElement instanceof HTMLElement)) {
        return { x: 1, y: 1 };
      }

      const blockRect = blockElement.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(blockElement);
      const cssScale = getTemplateEditorFinitePixelValue(
        computedStyle.getPropertyValue("--examlist-candidate-block-focus-editor-scale") ||
          computedStyle.getPropertyValue("--examlist-candidate-block-focus-scale"),
      );
      const logicalWidth =
        getTemplateEditorFinitePixelValue(blockElement.dataset?.candidateBlockLogicalWidth) ||
        blockElement.offsetWidth ||
        blockElement.clientWidth ||
        (cssScale > 0 ? blockRect.width / cssScale : 0) ||
        blockRect.width ||
        0;
      const logicalHeight =
        getTemplateEditorFinitePixelValue(blockElement.dataset?.candidateBlockLogicalHeight) ||
        blockElement.offsetHeight ||
        blockElement.clientHeight ||
        (cssScale > 0 ? blockRect.height / cssScale : 0) ||
        blockRect.height ||
        0;

      return {
        x: logicalWidth > 0 && blockRect.width > 0 ? blockRect.width / logicalWidth : cssScale || 1,
        y: logicalHeight > 0 && blockRect.height > 0 ? blockRect.height / logicalHeight : cssScale || 1,
      };
    }

    function getTemplateEditorCandidateBlockImageResizeBounds(imageElement) {
      const blockElement = imageElement?.closest?.("[data-candidate-block-instance].is-candidate-block-focus-editor") || null;

      if (!(blockElement instanceof HTMLElement)) {
        return null;
      }

      const blockRect = blockElement.getBoundingClientRect();
      const visualScale = getTemplateEditorCandidateBlockVisualScale(blockElement);
      const scaleX = Math.max(visualScale.x || 1, 0.01);
      const scaleY = Math.max(visualScale.y || 1, 0.01);
      const logicalWidth =
        getTemplateEditorFinitePixelValue(blockElement.dataset?.candidateBlockLogicalContentWidth) ||
        getTemplateEditorFinitePixelValue(blockElement.dataset?.candidateBlockLogicalWidth) ||
        blockElement.clientWidth ||
        blockElement.offsetWidth ||
        (blockRect.width > 0 ? blockRect.width / scaleX : 0);
      const logicalHeight =
        getTemplateEditorFinitePixelValue(blockElement.dataset?.candidateBlockLogicalContentHeight) ||
        getTemplateEditorFinitePixelValue(blockElement.dataset?.candidateBlockLogicalHeight) ||
        blockElement.clientHeight ||
        blockElement.offsetHeight ||
        (blockRect.height > 0 ? blockRect.height / scaleY : 0);
      const imageRect = imageElement.getBoundingClientRect();

      return {
        blockElement,
        height: Math.max(TEMPLATE_EDITOR_IMAGE_MIN_SIZE, Math.floor(logicalHeight || TEMPLATE_EDITOR_IMAGE_MIN_SIZE)),
        scaleX,
        scaleY,
        startLeft: Math.max(0, Math.round(((imageRect.left || blockRect.left) - blockRect.left) / scaleX)),
        startTop: Math.max(0, Math.round(((imageRect.top || blockRect.top) - blockRect.top) / scaleY)),
        width: Math.max(TEMPLATE_EDITOR_IMAGE_MIN_SIZE, Math.floor(logicalWidth || TEMPLATE_EDITOR_IMAGE_MIN_SIZE)),
      };
    }

    function getTemplateEditorCellContentSize(cellElement, minimumSize) {
      const computedStyle = window.getComputedStyle(cellElement);
      const cellRect = cellElement.getBoundingClientRect();
      const visualScale = getTemplateEditorCandidateBlockVisualScale(cellElement);
      const scaleX = Math.max(visualScale.x || 1, 0.01);
      const scaleY = Math.max(visualScale.y || 1, 0.01);
      const borderLeft = getTemplateEditorFinitePixelValue(computedStyle.borderLeftWidth);
      const borderRight = getTemplateEditorFinitePixelValue(computedStyle.borderRightWidth);
      const borderTop = getTemplateEditorFinitePixelValue(computedStyle.borderTopWidth);
      const borderBottom = getTemplateEditorFinitePixelValue(computedStyle.borderBottomWidth);
      const paddingBoxWidth = Math.max(
        minimumSize,
        Math.floor(
          Math.max(
            cellElement.clientWidth,
            cellRect.width / scaleX - borderLeft - borderRight,
            0,
          ),
        ),
      );
      const paddingBoxHeight = Math.max(
        minimumSize,
        Math.floor(
          Math.max(
            cellElement.clientHeight,
            cellRect.height / scaleY - borderTop - borderBottom,
            0,
          ),
        ),
      );

      return {
        height: paddingBoxHeight,
        scaleX,
        scaleY,
        width: paddingBoxWidth,
      };
    }

    function lockTemplateEditorImageCellHeight(cellElement) {
      const cellRect = cellElement.getBoundingClientRect();
      const visualScale = getTemplateEditorCandidateBlockVisualScale(cellElement);
      const scaleY = Math.max(visualScale.y || 1, 0.01);
      const rowElement = cellElement.parentElement;
      const measuredCellHeight = cellRect.height > 0 ? cellRect.height / scaleY : cellElement.offsetHeight || 0;
      const cellHeight = Math.max(TEMPLATE_EDITOR_IMAGE_MIN_SIZE, Math.round(measuredCellHeight));

      if (cellHeight > 0) {
        cellElement.style.height = `${cellHeight}px`;
      }

      if (rowElement instanceof HTMLTableRowElement && Number(cellElement.rowSpan || 1) <= 1) {
        const rowRect = rowElement.getBoundingClientRect();
        const measuredRowHeight = rowRect.height > 0 ? rowRect.height / scaleY : rowElement.offsetHeight || 0;
        const rowHeight = Math.max(cellHeight, Math.round(measuredRowHeight));

        if (rowHeight > 0) {
          rowElement.style.height = `${rowHeight}px`;
          Array.from(rowElement.cells || []).forEach((rowCellElement) => {
            rowCellElement.style.height = `${rowHeight}px`;
          });
        }
      }
    }

    function getTemplateEditorCellImageResizeBounds(imageElement, templateEditorSurface) {
      const cellElement = getTemplateEditorImageTableCell(imageElement, templateEditorSurface);

      if (!cellElement) {
        return null;
      }

      return {
        cellElement,
        ...getTemplateEditorCellContentSize(cellElement, TEMPLATE_EDITOR_IMAGE_MIN_SIZE),
      };
    }

    function applyTemplateEditorCellImageResizeStyle(imageElement, maxHeight = 0) {
      imageElement.style.display = "inline-block";
      imageElement.style.margin = "0";
      imageElement.style.maxWidth = "100%";
      imageElement.style.maxHeight = Number.isFinite(maxHeight) && maxHeight > 0
        ? `${Math.round(maxHeight)}px`
        : "none";

      if (!String(imageElement.style.verticalAlign || "").trim()) {
        imageElement.style.verticalAlign = "top";
      }
    }

    function handleTemplateEditorImageResizeStart(event) {
      const selectedImage = getSelectedTemplateEditorImage();
      const templateEditorSurface = getTemplateEditorSurface();

      if (event.button !== 0 || !selectedImage || !templateEditorSurface?.contains(selectedImage)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const normalizedCorner = geometry.normalizeTemplateEditorImageResizeCorner(
        event.currentTarget?.dataset?.templateResizeCorner ||
          event.target?.closest?.("[data-template-resize-corner]")?.dataset?.templateResizeCorner,
      );
      const directions = geometry.getTemplateEditorImageResizeDirections(normalizedCorner);
      const initialCellElement = getTemplateEditorImageTableCell(selectedImage, templateEditorSurface);
      const cellStartingPosition = initialCellElement
        ? prepareTemplateEditorImageForMove(selectedImage)
        : null;
      const cellResizeBounds = initialCellElement
        ? getTemplateEditorCellImageResizeBounds(selectedImage, templateEditorSurface)
        : null;

      if (!cellResizeBounds && (directions.x < 0 || directions.y < 0)) {
        prepareTemplateEditorImageForMove(selectedImage);
      }

      const imageRect = selectedImage.getBoundingClientRect();
      const documentElement = getTemplateEditorDocumentElement();
      const candidateBlockResizeBounds = cellResizeBounds
        ? null
        : getTemplateEditorCandidateBlockImageResizeBounds(selectedImage);
      const resizeBounds = cellResizeBounds || candidateBlockResizeBounds;
      const maxResizeWidth = resizeBounds?.width || documentElement?.clientWidth || Number.POSITIVE_INFINITY;
      const maxResizeHeight =
        resizeBounds?.height ||
        Math.max(documentElement?.scrollHeight || 0, documentElement?.clientHeight || 0) ||
        Number.POSITIVE_INFINITY;
      const imageWidth = resizeBounds ? imageRect.width / Math.max(resizeBounds.scaleX || 1, 0.01) : imageRect.width;
      const imageHeight = resizeBounds ? imageRect.height / Math.max(resizeBounds.scaleY || 1, 0.01) : imageRect.height;
      const startWidth = Math.min(maxResizeWidth, Math.max(imageWidth, TEMPLATE_EDITOR_IMAGE_MIN_SIZE));
      const startHeight = Math.min(maxResizeHeight, Math.max(imageHeight, TEMPLATE_EDITOR_IMAGE_MIN_SIZE));
      const startLeft = candidateBlockResizeBounds
        ? candidateBlockResizeBounds.startLeft
        : cellResizeBounds
          ? Math.max(0, Math.round(cellStartingPosition?.left || parseTemplateEditorPixelStyle(selectedImage.style.left, selectedImage.offsetLeft)))
          : selectedImage.style.position === "absolute"
            ? parseTemplateEditorPixelStyle(selectedImage.style.left, selectedImage.offsetLeft)
            : Math.max(0, selectedImage.offsetLeft);
      const startTop = candidateBlockResizeBounds
        ? candidateBlockResizeBounds.startTop
        : cellResizeBounds
          ? Math.max(0, Math.round(cellStartingPosition?.top || parseTemplateEditorPixelStyle(selectedImage.style.top, selectedImage.offsetTop)))
          : selectedImage.style.position === "absolute"
            ? parseTemplateEditorPixelStyle(selectedImage.style.top, selectedImage.offsetTop)
            : Math.max(0, selectedImage.offsetTop);
      const startRight = candidateBlockResizeBounds
        ? startLeft + startWidth
        : cellResizeBounds
          ? startLeft + startWidth
          : startLeft + startWidth;
      const startBottom = candidateBlockResizeBounds
        ? startTop + startHeight
        : cellResizeBounds
          ? startTop + startHeight
          : startTop + startHeight;
      const absoluteStartLeft = selectedImage.style.position === "absolute"
        ? parseTemplateEditorPixelStyle(selectedImage.style.left, selectedImage.offsetLeft)
        : startLeft;
      const absoluteStartTop = selectedImage.style.position === "absolute"
        ? parseTemplateEditorPixelStyle(selectedImage.style.top, selectedImage.offsetTop)
        : startTop;

      if (cellResizeBounds) {
        const didClampCellImage =
          Math.round(imageWidth) !== Math.round(startWidth) ||
          Math.round(imageHeight) !== Math.round(startHeight);

        if (didClampCellImage) {
          lockTemplateEditorImageCellHeight(cellResizeBounds.cellElement);
        }

        applyTemplateEditorCellImageResizeStyle(selectedImage, startHeight);
        selectedImage.style.width = `${Math.round(startWidth)}px`;
        selectedImage.style.height = `${Math.round(startHeight)}px`;
      }

      if (candidateBlockResizeBounds) {
        applyTemplateEditorCellImageResizeStyle(selectedImage, startHeight);
        selectedImage.style.width = `${Math.round(startWidth)}px`;
        selectedImage.style.height = `${Math.round(startHeight)}px`;
      }

      state.templateEditor.imageResizeSession = {
        corner: normalizedCorner,
        directionX: directions.x,
        directionY: directions.y,
        image: selectedImage,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: absoluteStartLeft,
        startTop: absoluteStartTop,
        startRight,
        startBottom,
        startWidth,
        startHeight,
        lastLeft: absoluteStartLeft,
        lastTop: absoluteStartTop,
        lastWidth: Math.max(Math.round(startWidth), TEMPLATE_EDITOR_IMAGE_MIN_SIZE),
        lastHeight: Math.max(Math.round(startHeight), TEMPLATE_EDITOR_IMAGE_MIN_SIZE),
        maxDocumentWidth: maxResizeWidth,
        maxDocumentHeight: maxResizeHeight,
        scaleX: resizeBounds?.scaleX || 1,
        scaleY: resizeBounds?.scaleY || 1,
        isCellObject: Boolean(cellResizeBounds),
        isCandidateBlockObject: Boolean(candidateBlockResizeBounds),
        cellElement: cellResizeBounds?.cellElement || null,
        cellHeightLocked: false,
        didChange: Boolean(
          resizeBounds &&
            (Math.round(imageWidth) !== Math.round(startWidth) ||
              Math.round(imageHeight) !== Math.round(startHeight)),
        ),
      };

      templateEditorSurface?.classList.add("is-image-resizing", `is-image-resizing-${normalizedCorner}`);
      getTemplateEditorImageOverlay()?.classList.add("is-resizing");
      window.addEventListener("pointermove", handleTemplateEditorImageResizeMove);
      window.addEventListener("pointerup", handleTemplateEditorImageResizeEnd);
      window.addEventListener("pointercancel", handleTemplateEditorImageResizeEnd);
    }

    function handleTemplateEditorImageResizeMove(event) {
      const resizeSession = state.templateEditor.imageResizeSession;
      const templateEditorSurface = getTemplateEditorSurface();

      if (
        !resizeSession ||
        resizeSession.pointerId !== event.pointerId ||
        !resizeSession.image ||
        !templateEditorSurface?.contains(resizeSession.image)
      ) {
        return;
      }

      event.preventDefault();

      const nextRect = geometry.getTemplateEditorImageResizeRect(resizeSession, event, TEMPLATE_EDITOR_IMAGE_MIN_SIZE);

      if (
        nextRect.width === resizeSession.lastWidth &&
        nextRect.height === resizeSession.lastHeight &&
        nextRect.left === resizeSession.lastLeft &&
        nextRect.top === resizeSession.lastTop
      ) {
        return;
      }

      resizeSession.lastWidth = nextRect.width;
      resizeSession.lastHeight = nextRect.height;
      resizeSession.lastLeft = nextRect.left;
      resizeSession.lastTop = nextRect.top;
      resizeSession.didChange = true;

      if (resizeSession.isCellObject) {
        if (!resizeSession.cellHeightLocked && resizeSession.cellElement) {
          lockTemplateEditorImageCellHeight(resizeSession.cellElement);
          resizeSession.cellHeightLocked = true;
        }

        applyTemplateEditorCellImageResizeStyle(resizeSession.image, nextRect.height);
      }

      resizeSession.image.style.width = `${nextRect.width}px`;
      resizeSession.image.style.height = `${nextRect.height}px`;

      if (resizeSession.image.style.position === "absolute") {
        resizeSession.image.style.left = `${geometry.getTemplateEditorBoundedCoordinate(nextRect.left, resizeSession.maxDocumentWidth - nextRect.width)}px`;
        resizeSession.image.style.top = `${geometry.getTemplateEditorBoundedCoordinate(nextRect.top, resizeSession.maxDocumentHeight - nextRect.height)}px`;
        globalScope.ExamListTemplateEditorObjectFlowReflow?.reflowTemplateEditorObjectRows(resizeSession.image, {
          documentElement: getTemplateEditorDocumentElement(),
          activeTop: parseFloat(resizeSession.image.style.top),
          activeHeight: nextRect.height,
          reorderByPosition: false,
          strictGeometry: true,
        });
      } else {
        globalScope.ExamListTemplateEditorObjectFlowReflow?.syncTemplateEditorObjectFlowObjects(getTemplateEditorDocumentElement());
      }

      updateTemplateEditorImageSelectionOverlay();
    }

    function handleTemplateEditorImageResizeEnd(event) {
      const resizeSession = state.templateEditor.imageResizeSession;

      if (!resizeSession || resizeSession.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      releaseTemplateEditorImageResizeSession({ sync: true });
    }

    function releaseTemplateEditorImageResizeSession({ sync = true } = {}) {
      const resizeSession = state.templateEditor.imageResizeSession;
      const templateEditorSurface = getTemplateEditorSurface();

      if (!resizeSession) {
        return;
      }

      window.removeEventListener("pointermove", handleTemplateEditorImageResizeMove);
      window.removeEventListener("pointerup", handleTemplateEditorImageResizeEnd);
      window.removeEventListener("pointercancel", handleTemplateEditorImageResizeEnd);
      state.templateEditor.imageResizeSession = null;
      templateEditorSurface?.classList.remove(...geometry.imageResizeClassNames);
      getTemplateEditorImageOverlay()?.classList.remove("is-resizing");

      if (sync && resizeSession.didChange && resizeSession.image && templateEditorSurface?.contains(resizeSession.image)) {
        syncTemplateEditorContent();
        selectTemplateEditorImage(resizeSession.image);
        return;
      }

      updateTemplateEditorImageSelectionOverlay();
    }

    return Object.freeze({
      handleTemplateEditorImageResizeStart,
      releaseTemplateEditorImageResizeSession,
    });
  }

  return Object.freeze({
    createTemplateEditorImageResizeSessionController,
  });
});

})();
