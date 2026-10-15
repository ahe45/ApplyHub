(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorImageSessionGeometry = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const imageResizeClassNames = Object.freeze([
    "is-image-resizing",
    "is-image-resizing-top-left",
    "is-image-resizing-top",
    "is-image-resizing-top-right",
    "is-image-resizing-right",
    "is-image-resizing-bottom",
    "is-image-resizing-bottom-left",
    "is-image-resizing-bottom-right",
    "is-image-resizing-left",
  ]);

  function getTemplateEditorBoundedCoordinate(value, maxValue) {
    const safeMax = Math.max(Math.round(maxValue) || 0, 0);

    return Math.min(Math.max(Math.round(value) || 0, 0), safeMax);
  }

  function normalizeTemplateEditorImageResizeCorner(value) {
    return ["top-left", "top", "top-right", "right", "bottom-right", "bottom", "bottom-left", "left"].includes(value)
      ? value
      : "bottom-right";
  }

  function getTemplateEditorImageResizeDirections(corner) {
    const normalizedCorner = normalizeTemplateEditorImageResizeCorner(corner);

    return {
      x: normalizedCorner === "left" || normalizedCorner.endsWith("left")
        ? -1
        : normalizedCorner === "right" || normalizedCorner.endsWith("right")
          ? 1
          : 0,
      y: normalizedCorner === "top" || normalizedCorner.startsWith("top")
        ? -1
        : normalizedCorner === "bottom" || normalizedCorner.startsWith("bottom")
          ? 1
          : 0,
    };
  }

  function getTemplateEditorImageResizeRect(resizeSession, event, minimumSize) {
    const scaleX = Math.max(Number(resizeSession.scaleX || resizeSession.visualScaleX || 1) || 1, 0.01);
    const scaleY = Math.max(Number(resizeSession.scaleY || resizeSession.visualScaleY || 1) || 1, 0.01);
    const deltaX = (event.clientX - resizeSession.startX) / scaleX;
    const deltaY = (event.clientY - resizeSession.startY) / scaleY;
    const directionX = Number.isFinite(resizeSession.directionX) ? resizeSession.directionX : 1;
    const directionY = Number.isFinite(resizeSession.directionY) ? resizeSession.directionY : 1;
    const maxWidth = Math.max(
      minimumSize,
      directionX === 0
        ? resizeSession.startWidth
        : directionX < 0
          ? resizeSession.startRight
          : resizeSession.maxDocumentWidth - resizeSession.startLeft,
    );
    const maxHeight = Math.max(
      minimumSize,
      directionY === 0
        ? resizeSession.startHeight
        : directionY < 0
          ? resizeSession.startBottom
          : resizeSession.maxDocumentHeight - resizeSession.startTop,
    );
    let nextWidth = directionX === 0
      ? Math.max(minimumSize, Math.round(resizeSession.startWidth))
      : Math.min(maxWidth, Math.max(minimumSize, Math.round(resizeSession.startWidth + deltaX * directionX)));
    let nextHeight = directionY === 0
      ? Math.max(minimumSize, Math.round(resizeSession.startHeight))
      : Math.min(maxHeight, Math.max(minimumSize, Math.round(resizeSession.startHeight + deltaY * directionY)));
    let nextLeft = directionX < 0 ? resizeSession.startRight - nextWidth : resizeSession.startLeft;
    let nextTop = directionY < 0 ? resizeSession.startBottom - nextHeight : resizeSession.startTop;

    if (event.shiftKey && directionX !== 0 && directionY !== 0) {
      const widthScale = nextWidth / resizeSession.startWidth;
      const heightScale = nextHeight / resizeSession.startHeight;
      let scale = Math.abs(widthScale - 1) >= Math.abs(heightScale - 1) ? widthScale : heightScale;

      if (!Number.isFinite(scale) || scale <= 0) {
        scale = minimumSize / resizeSession.startWidth;
      }

      const maxScale = Math.min(maxWidth / resizeSession.startWidth, maxHeight / resizeSession.startHeight);
      const minScale = Math.max(
        minimumSize / resizeSession.startWidth,
        minimumSize / resizeSession.startHeight,
      );
      const boundedScale = Number.isFinite(maxScale) && maxScale > 0
        ? Math.min(Math.max(scale, minScale), maxScale)
        : Math.max(scale, minScale);

      nextWidth = Math.max(minimumSize, Math.round(resizeSession.startWidth * boundedScale));
      nextHeight = Math.max(minimumSize, Math.round(resizeSession.startHeight * boundedScale));
      nextLeft = directionX < 0 ? resizeSession.startRight - nextWidth : resizeSession.startLeft;
      nextTop = directionY < 0 ? resizeSession.startBottom - nextHeight : resizeSession.startTop;
    }

    return {
      height: nextHeight,
      left: nextLeft,
      top: nextTop,
      width: nextWidth,
    };
  }

  return Object.freeze({
    getTemplateEditorBoundedCoordinate,
    getTemplateEditorImageResizeDirections,
    getTemplateEditorImageResizeRect,
    imageResizeClassNames,
    normalizeTemplateEditorImageResizeCorner,
  });
});

})();
