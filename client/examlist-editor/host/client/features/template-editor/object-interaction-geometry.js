export const objectResizeHandles = Object.freeze([
  "top-left",
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
]);

export function clampObjectCoordinate(value, maximum) {
  const safeMaximum = Math.max(0, Math.round(Number(maximum) || 0));
  return Math.min(safeMaximum, Math.max(0, Math.round(Number(value) || 0)));
}

export function getObjectResizeDirections(handle) {
  const normalizedHandle = objectResizeHandles.includes(handle) ? handle : "bottom-right";

  return {
    x: normalizedHandle === "left" || normalizedHandle.endsWith("left")
      ? -1
      : normalizedHandle === "right" || normalizedHandle.endsWith("right")
        ? 1
        : 0,
    y: normalizedHandle === "top" || normalizedHandle.startsWith("top")
      ? -1
      : normalizedHandle === "bottom" || normalizedHandle.startsWith("bottom")
        ? 1
        : 0,
  };
}

export function calculateObjectMovePosition({
  deltaX = 0,
  deltaY = 0,
  maximumLeft = 0,
  maximumTop = 0,
  startLeft = 0,
  startTop = 0,
} = {}) {
  return {
    left: clampObjectCoordinate(Number(startLeft) + Number(deltaX), maximumLeft),
    top: clampObjectCoordinate(Number(startTop) + Number(deltaY), maximumTop),
  };
}

export function calculateObjectResizeRect({
  deltaX = 0,
  deltaY = 0,
  directionX = 1,
  directionY = 1,
  maximumHeight = Number.POSITIVE_INFINITY,
  maximumWidth = Number.POSITIVE_INFINITY,
  minimumHeight = 1,
  minimumWidth = 1,
  preserveAspectRatio = false,
  startHeight = 1,
  startLeft = 0,
  startTop = 0,
  startWidth = 1,
} = {}) {
  const safeStartWidth = Math.max(1, Number(startWidth) || 1);
  const safeStartHeight = Math.max(1, Number(startHeight) || 1);
  const safeMinimumWidth = Math.max(1, Math.min(Number(minimumWidth) || 1, maximumWidth));
  const safeMinimumHeight = Math.max(1, Math.min(Number(minimumHeight) || 1, maximumHeight));
  const clampDimension = (value, minimum, maximum) => {
    const finiteMaximum = Number.isFinite(maximum) ? Math.max(minimum, maximum) : Number.POSITIVE_INFINITY;
    return Math.min(finiteMaximum, Math.max(minimum, Math.round(value)));
  };
  let width = directionX === 0
    ? safeStartWidth
    : clampDimension(safeStartWidth + Number(deltaX) * directionX, safeMinimumWidth, maximumWidth);
  let height = directionY === 0
    ? safeStartHeight
    : clampDimension(safeStartHeight + Number(deltaY) * directionY, safeMinimumHeight, maximumHeight);

  if (preserveAspectRatio && directionX !== 0 && directionY !== 0) {
    const widthScale = width / safeStartWidth;
    const heightScale = height / safeStartHeight;
    const requestedScale = Math.abs(widthScale - 1) >= Math.abs(heightScale - 1) ? widthScale : heightScale;
    const minimumScale = Math.max(safeMinimumWidth / safeStartWidth, safeMinimumHeight / safeStartHeight);
    const maximumScale = Math.min(maximumWidth / safeStartWidth, maximumHeight / safeStartHeight);
    const scale = Math.min(Math.max(requestedScale, minimumScale), maximumScale);

    width = clampDimension(safeStartWidth * scale, safeMinimumWidth, maximumWidth);
    height = clampDimension(safeStartHeight * scale, safeMinimumHeight, maximumHeight);
  }

  return {
    height,
    left: directionX < 0 ? Math.round(Number(startLeft) + safeStartWidth - width) : Math.round(Number(startLeft)),
    top: directionY < 0 ? Math.round(Number(startTop) + safeStartHeight - height) : Math.round(Number(startTop)),
    width,
  };
}
