const objectDragTargetSelector = [
  "[data-template-table-object-move-handle]",
  "[data-template-table-object-handle]",
  ".template-editor-image-resize-handle",
  "[data-candidate-block-grid-move-handle]",
  "[data-candidate-block-grid-resize-handle]",
  "img",
].join(",");

// Object coordinates use clientX/clientY throughout a gesture. A focus change
// or browser scroll anchoring must not move the viewport under that coordinate
// system. Keep only this editor's scroll ancestors fixed until the gesture ends.
export function bindObjectInteractionScroll({ surfaceElement }) {
  const ownerWindow = surfaceElement?.ownerDocument?.defaultView;
  if (!ownerWindow) return null;
  let session = null;
  let frameId = 0;

  const restoreScroll = () => {
    for (const entry of session?.ancestors || []) {
      if (entry.element.scrollLeft !== entry.left) entry.element.scrollLeft = entry.left;
      if (entry.element.scrollTop !== entry.top) entry.element.scrollTop = entry.top;
    }
  };
  const finish = () => {
    ownerWindow.cancelAnimationFrame(frameId);
    frameId = 0;
    restoreScroll();
    for (const entry of session?.ancestors || []) {
      if (entry.anchor) entry.element.style.setProperty("overflow-anchor", entry.anchor, entry.priority);
      else entry.element.style.removeProperty("overflow-anchor");
    }
    session = null;
  };
  const onStart = (event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        !surfaceElement.contains(event.target) || !event.target.closest?.(objectDragTargetSelector) ||
        event.target.closest("[data-candidate-block-focus-layer]")) return;
    finish();
    const ancestors = [];
    for (let element = surfaceElement; element; element = element.parentElement) {
      ancestors.push({ element, left: element.scrollLeft, top: element.scrollTop,
        anchor: element.style.getPropertyValue("overflow-anchor"),
        priority: element.style.getPropertyPriority("overflow-anchor") });
      element.style.setProperty("overflow-anchor", "none");
    }
    session = { pointerId: event.pointerId, ancestors };
  };
  const onEnd = (event) => {
    if (!session || session.pointerId !== event.pointerId) return;
    // Capture runs before the object handlers, including ones which stop event
    // propagation. Cover their sync and next-frame reselect before releasing.
    ownerWindow.cancelAnimationFrame(frameId);
    frameId = ownerWindow.requestAnimationFrame(() => {
      restoreScroll();
      frameId = ownerWindow.requestAnimationFrame(finish);
    });
  };

  ownerWindow.addEventListener("pointerdown", onStart, true);
  ownerWindow.addEventListener("pointerup", onEnd, true);
  ownerWindow.addEventListener("pointercancel", onEnd, true);
  ownerWindow.addEventListener("scroll", restoreScroll, true);
  ownerWindow.addEventListener("blur", finish);
  return () => {
    finish();
    ownerWindow.removeEventListener("pointerdown", onStart, true);
    ownerWindow.removeEventListener("pointerup", onEnd, true);
    ownerWindow.removeEventListener("pointercancel", onEnd, true);
    ownerWindow.removeEventListener("scroll", restoreScroll, true);
    ownerWindow.removeEventListener("blur", finish);
  };
}
