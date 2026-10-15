import { objectResizeCorners } from "./candidate-block-grid-config.js";
import { getCandidateBlockGridElements } from "./candidate-block-grid-dom.js";
import { applyCandidateBlockTemplateRoles } from "./candidate-block-grid-block-roles.js";

export function ensureCandidateBlockGridObjectControls(gridElement) {
  if (!(gridElement instanceof HTMLElement)) {
    return null;
  }

  gridElement.classList.add("examlist-candidate-block-grid");
  gridElement.dataset.candidateBlockGrid = "true";
  gridElement.dataset.candidateBlockObject = "true";
  gridElement.tabIndex = 0;
  gridElement.setAttribute("aria-label", "수험생 데이터 블록");
  gridElement.setAttribute("contenteditable", "false");
  applyCandidateBlockTemplateRoles(gridElement);

  if (!gridElement.style.position) {
    gridElement.style.position = "relative";
  }

  const existingMoveHandles = Array.from(gridElement.querySelectorAll("[data-candidate-block-grid-move-handle]"));
  const moveHandleElement = existingMoveHandles.shift() || document.createElement("button");

  existingMoveHandles.forEach((element) => element.remove());
  moveHandleElement.className = "examlist-candidate-block-grid-move-handle";
  moveHandleElement.dataset.candidateBlockGridMoveHandle = "true";
  moveHandleElement.type = "button";
  moveHandleElement.tabIndex = -1;
  moveHandleElement.title = "수험생 데이터 블록 위치 이동";
  moveHandleElement.setAttribute("aria-label", "수험생 데이터 블록 위치 이동");
  moveHandleElement.setAttribute("contenteditable", "false");
  moveHandleElement.innerHTML = `
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 1.8v12.4M1.8 8h12.4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.7"/>
      <path d="M8 1.8 5.9 3.9M8 1.8l2.1 2.1M8 14.2l-2.1-2.1M8 14.2l2.1-2.1M1.8 8l2.1-2.1M1.8 8l2.1 2.1M14.2 8l-2.1-2.1M14.2 8l-2.1 2.1" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
    </svg>
  `;

  if (moveHandleElement.parentElement !== gridElement) {
    gridElement.prepend(moveHandleElement);
  }

  const seenCorners = new Set();

  gridElement.querySelectorAll("[data-candidate-block-grid-resize-handle]").forEach((element) => {
    const corner = element.dataset.candidateBlockGridResizeCorner || "bottom-right";

    if (!objectResizeCorners.includes(corner) || seenCorners.has(corner)) {
      element.remove();
      return;
    }

    seenCorners.add(corner);
    element.className = "examlist-candidate-block-grid-resize-handle";
    element.dataset.candidateBlockGridResizeHandle = "true";
    element.dataset.candidateBlockGridResizeCorner = corner;
    element.setAttribute("contenteditable", "false");
    element.setAttribute("aria-hidden", "true");
  });

  objectResizeCorners.forEach((corner) => {
    if (seenCorners.has(corner)) {
      return;
    }

    const resizeHandle = document.createElement("span");
    resizeHandle.className = "examlist-candidate-block-grid-resize-handle";
    resizeHandle.dataset.candidateBlockGridResizeHandle = "true";
    resizeHandle.dataset.candidateBlockGridResizeCorner = corner;
    resizeHandle.setAttribute("contenteditable", "false");
    resizeHandle.setAttribute("aria-hidden", "true");
    gridElement.append(resizeHandle);
  });

  return gridElement;
}

export function hydrateCandidateBlockGridObjects(rootElement) {
  getCandidateBlockGridElements(rootElement).forEach((gridElement) => {
    ensureCandidateBlockGridObjectControls(gridElement);
  });
}
