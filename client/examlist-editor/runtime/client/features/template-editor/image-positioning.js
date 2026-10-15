(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalScope);
    return;
  }

  globalScope.ExamListTemplateEditorImagePositioning = factory(globalScope);
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  const geometry = globalScope.ExamListTemplateEditorImageSessionGeometry;

  if (!geometry) {
    throw new Error("image-session-geometry.js must be loaded before image-positioning.js.");
  }

  function createTemplateEditorImagePositioningController({
    TEMPLATE_EDITOR_IMAGE_MIN_SIZE,
    getTemplateEditorDocumentElement,
    getTemplateEditorSurface,
    parseTemplateEditorPixelStyle,
  }) {
    function getTemplateEditorFinitePixelValue(value) {
      const parsedValue = Number.parseFloat(String(value || "").trim());

      return Number.isFinite(parsedValue) ? parsedValue : 0;
    }

    function getTemplateEditorCandidateBlockImageContainer(imageElement) {
      const blockElement = imageElement?.closest?.("[data-candidate-block-instance].is-candidate-block-focus-editor") || null;

      if (!(blockElement instanceof HTMLElement)) {
        return null;
      }

      const blockRect = blockElement.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(blockElement);
      const cssScale = getTemplateEditorFinitePixelValue(
        computedStyle.getPropertyValue("--examlist-candidate-block-focus-editor-scale") ||
          computedStyle.getPropertyValue("--examlist-candidate-block-focus-scale"),
      );
      const logicalWidth =
        getTemplateEditorFinitePixelValue(blockElement.dataset?.candidateBlockLogicalContentWidth) ||
        getTemplateEditorFinitePixelValue(blockElement.dataset?.candidateBlockLogicalWidth) ||
        blockElement.clientWidth ||
        blockElement.offsetWidth ||
        (cssScale > 0 ? blockRect.width / cssScale : 0) ||
        blockRect.width ||
        0;
      const logicalHeight =
        getTemplateEditorFinitePixelValue(blockElement.dataset?.candidateBlockLogicalContentHeight) ||
        getTemplateEditorFinitePixelValue(blockElement.dataset?.candidateBlockLogicalHeight) ||
        blockElement.clientHeight ||
        blockElement.offsetHeight ||
        (cssScale > 0 ? blockRect.height / cssScale : 0) ||
        blockRect.height ||
        0;
      const scaleX = logicalWidth > 0 && blockRect.width > 0 ? blockRect.width / logicalWidth : cssScale || 1;
      const scaleY = logicalHeight > 0 && blockRect.height > 0 ? blockRect.height / logicalHeight : cssScale || 1;

      return {
        element: blockElement,
        height: Math.max(TEMPLATE_EDITOR_IMAGE_MIN_SIZE, Math.floor(logicalHeight || TEMPLATE_EDITOR_IMAGE_MIN_SIZE)),
        rect: blockRect,
        scaleX: Math.max(scaleX || 1, 0.01),
        scaleY: Math.max(scaleY || 1, 0.01),
        width: Math.max(TEMPLATE_EDITOR_IMAGE_MIN_SIZE, Math.floor(logicalWidth || TEMPLATE_EDITOR_IMAGE_MIN_SIZE)),
      };
    }

    function removeEmptyTemplateEditorImageHost(hostElement, containerElement) {
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

    function getTemplateEditorTableCellImageContainer(imageElement) {
      const templateEditorSurface = getTemplateEditorSurface();
      const cellElement = imageElement?.closest?.("td, th") || null;

      if (!(cellElement instanceof HTMLElement) || !templateEditorSurface?.contains(cellElement)) {
        return null;
      }

      const cellRect = cellElement.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(cellElement);
      const candidateBlockContainer = getTemplateEditorCandidateBlockImageContainer(imageElement);
      const documentElement = getTemplateEditorDocumentElement();
      const documentRect = documentElement?.getBoundingClientRect();
      const documentScaleX = documentElement?.offsetWidth > 0 ? documentRect.width / documentElement.offsetWidth : 1;
      const documentScaleY = documentElement?.offsetHeight > 0 ? documentRect.height / documentElement.offsetHeight : 1;
      const scaleX = Math.max(candidateBlockContainer?.scaleX || documentScaleX, 0.01);
      const scaleY = Math.max(candidateBlockContainer?.scaleY || documentScaleY, 0.01);
      const borderLeft = getTemplateEditorFinitePixelValue(computedStyle.borderLeftWidth);
      const borderRight = getTemplateEditorFinitePixelValue(computedStyle.borderRightWidth);
      const borderTop = getTemplateEditorFinitePixelValue(computedStyle.borderTopWidth);
      const borderBottom = getTemplateEditorFinitePixelValue(computedStyle.borderBottomWidth);
      const paddingBoxWidth = Math.max(
        cellElement.clientWidth || 0,
        cellRect.width / scaleX - borderLeft - borderRight,
        0,
      );
      const paddingBoxHeight = Math.max(
        cellElement.clientHeight || 0,
        cellRect.height / scaleY - borderTop - borderBottom,
        0,
      );

      return {
        element: cellElement,
        height: Math.max(TEMPLATE_EDITOR_IMAGE_MIN_SIZE, Math.floor(paddingBoxHeight || TEMPLATE_EDITOR_IMAGE_MIN_SIZE)),
        rect: {
          left: cellRect.left + cellElement.clientLeft * scaleX,
          top: cellRect.top + cellElement.clientTop * scaleY,
        },
        scaleX,
        scaleY,
        width: Math.max(TEMPLATE_EDITOR_IMAGE_MIN_SIZE, Math.floor(paddingBoxWidth || TEMPLATE_EDITOR_IMAGE_MIN_SIZE)),
      };
    }

    function lockTemplateEditorImageTableCellSize(cellElement) {
      if (!(cellElement instanceof HTMLElement)) {
        return;
      }

      const rowElement = cellElement.parentElement;
      // Preserve used CSS height, not the border-box height: assigning the
      // latter adds cell padding again when an inline image becomes absolute.
      const cellHeight = window.getComputedStyle(cellElement).height;
      const rowHeight = rowElement ? window.getComputedStyle(rowElement).height : "";
      cellElement.style.height = cellHeight;
      if (rowElement instanceof HTMLTableRowElement && Number(cellElement.rowSpan || 1) <= 1) {
        rowElement.style.height = rowHeight;
      }
    }

    function prepareTemplateEditorImageForMove(imageElement) {
      const documentElement = getTemplateEditorDocumentElement();
      const templateEditorSurface = getTemplateEditorSurface();
      const cellContainer = getTemplateEditorTableCellImageContainer(imageElement);
      const candidateBlockContainer = getTemplateEditorCandidateBlockImageContainer(imageElement);
      const containerElement = cellContainer?.element || candidateBlockContainer?.element || documentElement;

      if (!containerElement || !templateEditorSurface?.contains(imageElement)) {
        return null;
      }

      if (cellContainer) {
        if (window.getComputedStyle(cellContainer.element).position === "static") {
          cellContainer.element.style.position = "relative";
        }

        if (imageElement.parentElement === cellContainer.element && imageElement.style.position === "absolute") {
          imageElement.classList.add("is-floating-object");
          return {
            boundsElement: cellContainer.element,
            boundsHeight: cellContainer.height,
            boundsWidth: cellContainer.width,
            left: parseTemplateEditorPixelStyle(imageElement.style.left, imageElement.offsetLeft),
            scaleX: cellContainer.scaleX,
            scaleY: cellContainer.scaleY,
            top: parseTemplateEditorPixelStyle(imageElement.style.top, imageElement.offsetTop),
          };
        }

        const imageRect = imageElement.getBoundingClientRect();
        const imageWidth = Math.max(
          Math.round(imageRect.width / Math.max(cellContainer.scaleX, 0.01)),
          TEMPLATE_EDITOR_IMAGE_MIN_SIZE,
        );
        const imageHeight = Math.max(
          Math.round(imageRect.height / Math.max(cellContainer.scaleY, 0.01)),
          TEMPLATE_EDITOR_IMAGE_MIN_SIZE,
        );
        const boundedLeft = geometry.getTemplateEditorBoundedCoordinate(
          (imageRect.left - cellContainer.rect.left) / Math.max(cellContainer.scaleX, 0.01),
          cellContainer.width - imageWidth,
        );
        const boundedTop = geometry.getTemplateEditorBoundedCoordinate(
          (imageRect.top - cellContainer.rect.top) / Math.max(cellContainer.scaleY, 0.01),
          cellContainer.height - imageHeight,
        );
        const previousParent = imageElement.parentElement;

        lockTemplateEditorImageTableCellSize(cellContainer.element);
        imageElement.style.width = `${imageWidth}px`;
        imageElement.style.height = `${imageHeight}px`;
        imageElement.style.position = "absolute";
        imageElement.style.left = `${boundedLeft}px`;
        imageElement.style.top = `${boundedTop}px`;
        imageElement.style.margin = "0";
        imageElement.style.zIndex = "2";
        imageElement.classList.add("is-floating-object");
        cellContainer.element.append(imageElement);
        removeEmptyTemplateEditorImageHost(previousParent, cellContainer.element);

        return {
          boundsElement: cellContainer.element,
          boundsHeight: cellContainer.height,
          boundsWidth: cellContainer.width,
          left: boundedLeft,
          scaleX: cellContainer.scaleX,
          scaleY: cellContainer.scaleY,
          top: boundedTop,
        };
      }

      const containerBounds = containerElement.getBoundingClientRect();
      const canvasScaleX = containerElement.offsetWidth > 0 ? containerBounds.width / containerElement.offsetWidth : 1;
      const canvasScaleY = containerElement.offsetHeight > 0 ? containerBounds.height / containerElement.offsetHeight : 1;
      if (imageElement.parentElement === containerElement && imageElement.style.position === "absolute") {
        imageElement.classList.add("is-floating-object");
        return {
          boundsElement: containerElement,
          boundsHeight:
            candidateBlockContainer?.height ||
            Math.max(documentElement?.scrollHeight || 0, documentElement?.clientHeight || 0),
          boundsWidth: candidateBlockContainer?.width || documentElement?.clientWidth || 0,
          left: parseTemplateEditorPixelStyle(imageElement.style.left, imageElement.offsetLeft),
          scaleX: candidateBlockContainer?.scaleX || canvasScaleX || 1,
          scaleY: candidateBlockContainer?.scaleY || canvasScaleY || 1,
          top: parseTemplateEditorPixelStyle(imageElement.style.top, imageElement.offsetTop),
        };
      }

      const imageRect = imageElement.getBoundingClientRect();
      const containerRect = candidateBlockContainer?.rect || containerElement.getBoundingClientRect();
      const scaleX = candidateBlockContainer?.scaleX || canvasScaleX || 1;
      const scaleY = candidateBlockContainer?.scaleY || canvasScaleY || 1;
      const boundsWidth = candidateBlockContainer?.width || documentElement?.clientWidth || containerElement.clientWidth || 0;
      const boundsHeight =
        candidateBlockContainer?.height ||
        Math.max(documentElement?.scrollHeight || 0, documentElement?.clientHeight || 0, containerElement.clientHeight || 0);
      const imageWidth = Math.max(Math.round(imageRect.width / Math.max(scaleX, 0.01)), TEMPLATE_EDITOR_IMAGE_MIN_SIZE);
      const imageHeight = Math.max(Math.round(imageRect.height / Math.max(scaleY, 0.01)), TEMPLATE_EDITOR_IMAGE_MIN_SIZE);
      const boundedLeft = geometry.getTemplateEditorBoundedCoordinate(
        (imageRect.left - containerRect.left) / Math.max(scaleX, 0.01) - containerElement.clientLeft,
        boundsWidth - imageWidth,
      );
      const boundedTop = geometry.getTemplateEditorBoundedCoordinate(
        (imageRect.top - containerRect.top) / Math.max(scaleY, 0.01) - containerElement.clientTop,
        boundsHeight - imageHeight,
      );
      const previousParent = imageElement.parentElement;

      imageElement.style.width = `${imageWidth}px`;
      imageElement.style.height = `${imageHeight}px`;
      imageElement.style.position = "absolute";
      imageElement.style.left = `${boundedLeft}px`;
      imageElement.style.top = `${boundedTop}px`;
      imageElement.style.margin = "0";
      imageElement.style.zIndex = "2";
      imageElement.classList.add("is-floating-object");
      if (imageElement.parentElement !== containerElement) {
        let host = previousParent;
        while (host?.parentElement && host.parentElement !== containerElement) host = host.parentElement;
        containerElement.insertBefore(imageElement, host?.parentElement === containerElement ? host.nextSibling : null);
      }

      removeEmptyTemplateEditorImageHost(previousParent, containerElement);

      return {
        boundsElement: containerElement,
        boundsHeight,
        boundsWidth,
        left: boundedLeft,
        scaleX,
        scaleY,
        top: boundedTop,
      };
    }

    return Object.freeze({
      prepareTemplateEditorImageForMove,
    });
  }

  return Object.freeze({
    createTemplateEditorImagePositioningController,
  });
});

})();
