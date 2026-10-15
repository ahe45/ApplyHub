(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorImageSelection = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorImageSelectionController({
    clearTemplateEditorActiveCell,
    decorateTemplateGeneratedObjectImage,
    getHandleTemplateEditorImageResizeStart,
    getTemplateEditorImageOverlayContainer,
    getTemplateEditorModal,
    getTemplateEditorSurface,
    getTemplatePreviewExaminee,
    releaseTemplateEditorImageMoveSession,
    releaseTemplateEditorImageResizeSession,
    state,
  }) {
    let templateEditorImageOverlay = null;
    let templateEditorImageHoverOverlay = null;

    function decorateTemplateEditorImages(rootElement) {
      if (!rootElement?.querySelectorAll) {
        return;
      }

      rootElement.querySelectorAll("img").forEach((imageElement) => {
        decorateTemplateGeneratedObjectImage(imageElement, { getPreviewExaminee: getTemplatePreviewExaminee });
        imageElement.classList.add("template-editor-image-object");
        imageElement.setAttribute("draggable", "false");
        imageElement.setAttribute("contenteditable", "false");

        if (!String(imageElement.style.height || "").trim() && !imageElement.getAttribute("height")) {
          imageElement.style.height = "auto";
        }
      });
    }

    function getTemplateEditorImageTarget(target) {
      const templateEditorSurface = getTemplateEditorSurface();
      const baseElement =
        target instanceof Element ? target : target?.parentElement instanceof Element ? target.parentElement : null;
      const imageElement = baseElement?.closest("img");

      if (!imageElement || !templateEditorSurface?.contains(imageElement)) {
        return null;
      }

      return imageElement;
    }

    function parseTemplateEditorImagePixelValue(value, fallback = 0) {
      const parsedValue = Number.parseFloat(String(value || "").trim());

      return Number.isFinite(parsedValue) ? parsedValue : fallback;
    }

    function getTemplateEditorCandidateBlockImageScale(imageElement) {
      const blockElement = imageElement?.closest?.("[data-candidate-block-instance]") || null;

      if (!(blockElement instanceof HTMLElement)) {
        const surface = getTemplateEditorSurface();
        const documentElement = surface?.querySelector(".template-doc") || surface;
        const rect = documentElement?.getBoundingClientRect();
        return {
          x: documentElement?.offsetWidth > 0 ? rect.width / documentElement.offsetWidth : 1,
          y: documentElement?.offsetHeight > 0 ? rect.height / documentElement.offsetHeight : 1,
        };
      }

      const blockRect = blockElement.getBoundingClientRect();
      const logicalWidth =
        parseTemplateEditorImagePixelValue(blockElement.dataset?.candidateBlockLogicalWidth, 0) ||
        parseTemplateEditorImagePixelValue(blockElement.dataset?.candidateBlockLogicalContentWidth, 0) ||
        blockElement.offsetWidth ||
        blockElement.clientWidth ||
        blockRect.width ||
        0;
      const logicalHeight =
        parseTemplateEditorImagePixelValue(blockElement.dataset?.candidateBlockLogicalHeight, 0) ||
        parseTemplateEditorImagePixelValue(blockElement.dataset?.candidateBlockLogicalContentHeight, 0) ||
        blockElement.offsetHeight ||
        blockElement.clientHeight ||
        blockRect.height ||
        0;

      return {
        x: logicalWidth > 0 && blockRect.width > 0 ? blockRect.width / logicalWidth : 1,
        y: logicalHeight > 0 && blockRect.height > 0 ? blockRect.height / logicalHeight : 1,
      };
    }

    function materializeCellImageLogicalSize(imageElement) {
      if (!(imageElement instanceof HTMLImageElement) || !imageElement.closest("td, th")) {
        return false;
      }

      const widthStyle = String(imageElement.style.width || "").trim();
      const heightStyle = String(imageElement.style.height || "").trim();
      const hasPixelWidth = /^-?\d+(?:\.\d+)?px$/i.test(widthStyle);
      const hasPixelHeight = /^-?\d+(?:\.\d+)?px$/i.test(heightStyle);

      const imageRect = imageElement.getBoundingClientRect();
      const scale = getTemplateEditorCandidateBlockImageScale(imageElement);
      const logicalWidth = Math.max(1, Math.round((imageRect.width || imageElement.offsetWidth || 0) / Math.max(scale.x || 1, 0.01)));
      const logicalHeight = Math.max(1, Math.round((imageRect.height || imageElement.offsetHeight || 0) / Math.max(scale.y || 1, 0.01)));
      const currentWidth = parseTemplateEditorImagePixelValue(widthStyle, 0);
      const currentHeight = parseTemplateEditorImagePixelValue(heightStyle, 0);
      let didMaterialize = false;

      if ((!hasPixelWidth || Math.abs(currentWidth - logicalWidth) > 1) && logicalWidth > 0) {
        imageElement.style.width = `${logicalWidth}px`;
        didMaterialize = true;
      }

      if ((!hasPixelHeight || Math.abs(currentHeight - logicalHeight) > 1) && logicalHeight > 0) {
        imageElement.style.height = `${logicalHeight}px`;
        didMaterialize = true;
      }

      imageElement.style.display = "inline-block";
      imageElement.style.margin = "0";
      imageElement.style.maxWidth = "100%";
      imageElement.style.maxHeight = `${logicalHeight}px`;

      if (!String(imageElement.style.verticalAlign || "").trim()) {
        imageElement.style.verticalAlign = "top";
      }

      return didMaterialize;
    }

    function ensureTemplateEditorImageOverlay() {
      const overlayContainer = getTemplateEditorImageOverlayContainer();

      if (!overlayContainer) {
        return null;
      }

      if (templateEditorImageOverlay) {
        if (templateEditorImageOverlay.parentElement !== overlayContainer) {
          overlayContainer.append(templateEditorImageOverlay);
        }

        ensureTemplateEditorImageResizeHandles(templateEditorImageOverlay);
        return templateEditorImageOverlay;
      }

      const overlayElement = document.createElement("div");

      overlayElement.className = "template-editor-image-selection hidden";
      overlayElement.setAttribute("aria-hidden", "true");
      overlayElement.setAttribute("contenteditable", "false");
      ensureTemplateEditorImageResizeHandles(overlayElement);
      overlayContainer.append(overlayElement);
      templateEditorImageOverlay = overlayElement;

      return overlayElement;
    }

    function ensureTemplateEditorImageHoverOverlay() {
      const overlayContainer = getTemplateEditorImageOverlayContainer();

      if (!overlayContainer) {
        return null;
      }

      if (templateEditorImageHoverOverlay) {
        if (templateEditorImageHoverOverlay.parentElement !== overlayContainer) {
          overlayContainer.append(templateEditorImageHoverOverlay);
        }

        if (templateEditorImageOverlay?.parentElement === overlayContainer) {
          overlayContainer.append(templateEditorImageOverlay);
        }

        return templateEditorImageHoverOverlay;
      }

      const overlayElement = document.createElement("div");

      overlayElement.className = "template-editor-image-selection is-hover-only hidden";
      overlayElement.dataset.templateImageHoverOverlay = "true";
      overlayElement.setAttribute("aria-hidden", "true");
      overlayElement.setAttribute("contenteditable", "false");
      overlayContainer.append(overlayElement);
      templateEditorImageHoverOverlay = overlayElement;

      if (templateEditorImageOverlay?.parentElement === overlayContainer) {
        overlayContainer.append(templateEditorImageOverlay);
      }

      return overlayElement;
    }

    function ensureTemplateEditorImageResizeHandles(overlayElement) {
      const corners = ["bottom-right", "bottom", "bottom-left", "left", "top-left", "top", "top-right", "right"];
      const existingHandles = Array.from(overlayElement?.querySelectorAll?.(".template-editor-image-resize-handle") || []);
      const existingCorners = new Set(
        existingHandles
          .map((handle) => String(handle.dataset.templateResizeCorner || "").trim())
          .filter(Boolean),
      );
      const needsRebuild = existingHandles.length !== corners.length || corners.some((corner) => !existingCorners.has(corner));

      if (!needsRebuild) {
        return;
      }

      existingHandles.forEach((handle) => handle.remove());
      corners.forEach((corner) => {
        const resizeHandle = document.createElement("button");

        resizeHandle.className = "template-editor-image-resize-handle";
        resizeHandle.dataset.templateResizeCorner = corner;
        resizeHandle.type = "button";
        resizeHandle.tabIndex = -1;
        resizeHandle.setAttribute("aria-label", "이미지 크기 조절");
        resizeHandle.addEventListener("pointerdown", (event) => getHandleTemplateEditorImageResizeStart()(event));
        overlayElement.append(resizeHandle);
      });
    }

    function syncTemplateEditorImageOverlayToImage(overlayElement, overlayContainer, imageElement) {
      if (
        !overlayElement ||
        !overlayContainer ||
        !imageElement
      ) {
        overlayElement?.classList.add("hidden");
        overlayElement?.classList.remove("is-resizing");
        return false;
      }

      const imageRect = imageElement.getBoundingClientRect();
      const overlayRect = overlayContainer.getBoundingClientRect();

      if (imageRect.width < 1 || imageRect.height < 1) {
        overlayElement.classList.add("hidden");
        return false;
      }

      // Client rects include the canvas transform; overlay CSS coordinates do not.
      const scaleX = Math.max(overlayContainer.offsetWidth > 0 ? overlayRect.width / overlayContainer.offsetWidth : 1, 0.01);
      const scaleY = Math.max(overlayContainer.offsetHeight > 0 ? overlayRect.height / overlayContainer.offsetHeight : 1, 0.01);
      const toPixel = (value) => `${Math.round(value * 100) / 100}px`;
      overlayElement.style.left = toPixel((imageRect.left - overlayRect.left) / scaleX - overlayContainer.clientLeft + overlayContainer.scrollLeft);
      overlayElement.style.top = toPixel((imageRect.top - overlayRect.top) / scaleY - overlayContainer.clientTop + overlayContainer.scrollTop);
      overlayElement.style.width = toPixel(imageRect.width / scaleX);
      overlayElement.style.height = toPixel(imageRect.height / scaleY);
      overlayElement.classList.remove("hidden");
      return true;
    }

    function updateTemplateEditorImageSelectionOverlay() {
      const overlayElement = ensureTemplateEditorImageOverlay();
      const overlayContainer = getTemplateEditorImageOverlayContainer();
      const selectedImage = state.templateEditor.selectedImageElement;
      const templateEditorSurface = getTemplateEditorSurface();
      const templateEditorModal = getTemplateEditorModal();

      if (
        !overlayElement ||
        !overlayContainer ||
        templateEditorModal?.classList.contains("hidden") ||
        !selectedImage ||
        !templateEditorSurface?.contains(selectedImage)
      ) {
        overlayElement?.classList.add("hidden");
        overlayElement?.classList.remove("is-resizing");
        return;
      }

      syncTemplateEditorImageOverlayToImage(overlayElement, overlayContainer, selectedImage);
    }

    function clearTemplateEditorImageHoverState() {
      templateEditorImageHoverOverlay?.classList.add("hidden");
    }

    function updateTemplateEditorImageHoverState(event) {
      if (
        state.templateEditor.imageResizeSession ||
        state.templateEditor.imageMoveSession ||
        state.templateEditor.tableObjectMoveSession ||
        state.templateEditor.tableObjectResizeSession
      ) {
        clearTemplateEditorImageHoverState();
        return;
      }

      const templateEditorSurface = getTemplateEditorSurface();
      const templateEditorModal = getTemplateEditorModal();
      const hoveredImage = getTemplateEditorImageTarget(event?.target);
      const selectedImage = state.templateEditor.selectedImageElement;
      const hoverTargetImage = hoveredImage && hoveredImage !== selectedImage ? hoveredImage : null;
      const overlayElement = ensureTemplateEditorImageHoverOverlay();
      const overlayContainer = getTemplateEditorImageOverlayContainer();

      if (
        !overlayElement ||
        !overlayContainer ||
        templateEditorModal?.classList.contains("hidden") ||
        !hoverTargetImage ||
        !templateEditorSurface?.contains(hoverTargetImage)
      ) {
        clearTemplateEditorImageHoverState();
        return;
      }

      syncTemplateEditorImageOverlayToImage(overlayElement, overlayContainer, hoverTargetImage);
    }

    function selectTemplateEditorImage(imageElement) {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!imageElement || !templateEditorSurface?.contains(imageElement)) {
        clearTemplateEditorImageSelection();
        return;
      }

      materializeCellImageLogicalSize(imageElement);

      if (state.templateEditor.selectedImageElement === imageElement) {
        updateTemplateEditorImageSelectionOverlay();
        return;
      }

      clearTemplateEditorImageSelection();
      clearTemplateEditorImageHoverState();
      state.templateEditor.selectedImageElement = imageElement;
      imageElement.classList.add("is-selected-object");
      imageElement.classList.toggle("is-cell-contained-object", Boolean(imageElement.closest("td, th")));
      clearTemplateEditorActiveCell();
      updateTemplateEditorImageSelectionOverlay();
    }

    function clearTemplateEditorImageSelection() {
      const templateEditorSurface = getTemplateEditorSurface();

      if (state.templateEditor.imageMoveSession) {
        releaseTemplateEditorImageMoveSession({ sync: false });
      }

      if (state.templateEditor.imageResizeSession) {
        releaseTemplateEditorImageResizeSession({ sync: false });
      }

      if (state.templateEditor.selectedImageElement) {
        state.templateEditor.selectedImageElement.classList.remove("is-selected-object", "is-cell-contained-object");
      }

      state.templateEditor.selectedImageElement = null;
      templateEditorSurface?.classList.remove("is-image-moving");
      templateEditorSurface?.classList.remove(
        "is-image-resizing",
        "is-image-resizing-top-left",
        "is-image-resizing-top",
        "is-image-resizing-top-right",
        "is-image-resizing-right",
        "is-image-resizing-bottom",
        "is-image-resizing-bottom-left",
        "is-image-resizing-bottom-right",
        "is-image-resizing-left",
      );
      templateEditorImageOverlay?.classList.add("hidden");
      templateEditorImageOverlay?.classList.remove("is-resizing");
    }

    return Object.freeze({
      clearTemplateEditorImageSelection,
      clearTemplateEditorImageHoverState,
      decorateTemplateEditorImages,
      ensureTemplateEditorImageOverlay,
      getTemplateEditorImageOverlay: () => templateEditorImageOverlay,
      getTemplateEditorImageTarget,
      selectTemplateEditorImage,
      updateTemplateEditorImageHoverState,
      updateTemplateEditorImageSelectionOverlay,
    });
  }

  return Object.freeze({
    createTemplateEditorImageSelectionController,
  });
});

})();
