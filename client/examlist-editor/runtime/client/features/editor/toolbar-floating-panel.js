(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListEditorToolbarFloatingPanel = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function getEditorToolbarFloatingPanelBoundaryRect(anchorElement) {
    const viewportRect = {
      top: 0,
      bottom: window.innerHeight || document.documentElement.clientHeight || 0,
    };
    let currentElement = anchorElement?.parentElement || null;

    while (currentElement && currentElement !== document.body && currentElement !== document.documentElement) {
      const computedStyle = window.getComputedStyle(currentElement);
      const overflowValue = `${computedStyle.overflow || ""} ${computedStyle.overflowY || ""}`;

      if (/(auto|scroll|hidden|clip)/i.test(overflowValue)) {
        const rect = currentElement.getBoundingClientRect();

        return {
          top: Math.max(viewportRect.top, rect.top),
          bottom: Math.min(viewportRect.bottom, rect.bottom),
        };
      }

      currentElement = currentElement.parentElement;
    }

    return viewportRect;
  }

  function updateEditorToolbarFloatingPanelPlacement(anchorElement, panelElement, gap = 8) {
    if (!(anchorElement instanceof HTMLElement) || !(panelElement instanceof HTMLElement)) {
      return "down";
    }

    anchorElement.classList.remove("open-up", "open-down");

    if (panelElement.classList.contains("hidden")) {
      return "down";
    }

    const anchorRect = anchorElement.getBoundingClientRect();
    const panelRect = panelElement.getBoundingClientRect();
    const boundaryRect = getEditorToolbarFloatingPanelBoundaryRect(anchorElement);
    const spaceBelow = boundaryRect.bottom - anchorRect.bottom;
    const spaceAbove = anchorRect.top - boundaryRect.top;
    const shouldOpenUp = spaceBelow < panelRect.height + gap && spaceAbove > spaceBelow;

    anchorElement.classList.toggle("open-up", shouldOpenUp);
    anchorElement.classList.toggle("open-down", !shouldOpenUp);
    return shouldOpenUp ? "up" : "down";
  }

  return Object.freeze({
    getEditorToolbarFloatingPanelBoundaryRect,
    updateEditorToolbarFloatingPanelPlacement,
  });
});

})();
