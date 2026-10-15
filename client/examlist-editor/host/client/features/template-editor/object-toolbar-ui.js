import { escapeHtml } from "../../app/html-utils.js";
import { templateEditorObjectMinimumSize } from "./object-toolbar-constants.js";

function getObjectAlignmentIcon(name) {
  const iconMarkup = {
    "align-left": `
      <path d="M5 4v16" />
      <rect x="9" y="7" width="10" height="10" rx="1.5" />`,
    "align-center-x": `
      <path d="M12 4v16" />
      <rect x="7" y="7" width="10" height="10" rx="1.5" />`,
    "align-right": `
      <path d="M19 4v16" />
      <rect x="5" y="7" width="10" height="10" rx="1.5" />`,
    "align-top": `
      <path d="M4 5h16" />
      <rect x="7" y="9" width="10" height="10" rx="1.5" />`,
    "align-center-y": `
      <path d="M4 12h16" />
      <rect x="7" y="7" width="10" height="10" rx="1.5" />`,
    "align-bottom": `
      <path d="M4 19h16" />
      <rect x="7" y="5" width="10" height="10" rx="1.5" />`,
    "distribute-x": `
      <path d="M4 5v14M20 5v14" />
      <rect x="6.5" y="9" width="3.5" height="6" rx="1" />
      <rect x="10.25" y="8" width="3.5" height="8" rx="1" />
      <rect x="14" y="9" width="3.5" height="6" rx="1" />`,
    "distribute-y": `
      <path d="M5 4h14M5 20h14" />
      <rect x="9" y="6.5" width="6" height="3.5" rx="1" />
      <rect x="8" y="10.25" width="8" height="3.5" rx="1" />
      <rect x="9" y="14" width="6" height="3.5" rx="1" />`,
  };

  return `
    <svg class="template-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      ${iconMarkup[name] || iconMarkup["align-left"]}
    </svg>
  `;
}

const objectAlignmentGroups = Object.freeze([
  Object.freeze({
    id: "align",
    label: "맞춤",
    showReference: true,
    options: Object.freeze([
      Object.freeze({ command: "align-left", label: "왼쪽 맞춤", icon: "align-left" }),
      Object.freeze({ command: "align-center-x", label: "가로 가운데", icon: "align-center-x" }),
      Object.freeze({ command: "align-right", label: "오른쪽 맞춤", icon: "align-right" }),
      Object.freeze({ command: "align-top", label: "위쪽 맞춤", icon: "align-top" }),
      Object.freeze({ command: "align-center-y", label: "세로 가운데", icon: "align-center-y" }),
      Object.freeze({ command: "align-bottom", label: "아래쪽 맞춤", icon: "align-bottom" }),
    ]),
  }),
  Object.freeze({
    id: "distribute",
    label: "간격",
    options: Object.freeze([
      Object.freeze({ command: "distribute-x", label: "가로 간격 동일", icon: "distribute-x" }),
      Object.freeze({ command: "distribute-y", label: "세로 간격 동일", icon: "distribute-y" }),
    ]),
  }),
]);

function createObjectAlignmentOption(option) {
  return `
    <button
      class="template-toolbar-icon-select-option examlist-object-align-option"
      data-examlist-object-align="${escapeHtml(option.command)}"
      type="button"
      role="option"
      aria-selected="false"
    >
      <span class="template-toolbar-icon-select-option-icon" aria-hidden="true">
        ${getObjectAlignmentIcon(option.icon)}
      </span>
      <span class="template-toolbar-icon-select-option-label">${escapeHtml(option.label)}</span>
    </button>
  `;
}

function createObjectAlignmentDropdown(group) {
  const firstOption = group.options[0];
  const menuId = `examlistObjectAlignMenu-${group.id}`;

  return `
    <div class="examlist-object-align-section">
      <span class="examlist-object-align-section-label">${escapeHtml(group.label)}</span>
      <span class="template-toolbar-select-wrap template-toolbar-icon-select examlist-object-align-select" data-examlist-object-align-select="${escapeHtml(group.id)}">
        <button
          class="template-toolbar-icon-select-button"
          data-examlist-object-align-toggle="${escapeHtml(group.id)}"
          type="button"
          aria-label="${escapeHtml(group.label)} 정렬 메뉴 열기"
          aria-expanded="false"
          aria-controls="${escapeHtml(menuId)}"
        >
          <span class="template-toolbar-icon-select-current-icon" data-examlist-object-align-current-icon aria-hidden="true">
            ${getObjectAlignmentIcon(firstOption.icon)}
          </span>
          <span class="template-toolbar-icon-select-label" data-examlist-object-align-label>${escapeHtml(group.label)}</span>
          <span class="template-toolbar-icon-select-caret" aria-hidden="true"></span>
        </button>
        <div class="template-toolbar-icon-select-menu hidden" id="${escapeHtml(menuId)}" role="listbox" aria-label="${escapeHtml(group.label)} 정렬">
          ${group.options.map(createObjectAlignmentOption).join("")}
          ${group.showReference ? '<span class="examlist-object-align-reference" data-examlist-object-align-reference>기준: 캔버스</span>' : ""}
        </div>
      </span>
    </div>
  `;
}

export function createObjectAlignmentToolbar() {
  const sectionElement = document.createElement("div");

  sectionElement.className = "template-toolbar-section examlist-object-section examlist-object-align-control";
  sectionElement.innerHTML = `
    <span class="template-toolbar-section-label">정렬</span>
    <div class="examlist-object-align-grid">
      ${objectAlignmentGroups.map(createObjectAlignmentDropdown).join("")}
    </div>
  `;

  return sectionElement;
}

export function createObjectSizeToolbar() {
  const sectionElement = document.createElement("div");

  sectionElement.className = "template-toolbar-section examlist-object-section examlist-object-size-control";
  sectionElement.innerHTML = `
    <span class="template-toolbar-section-label">크기</span>
    <div class="examlist-object-size-grid">
      <label class="examlist-object-size-field">
        <span class="template-toolbar-field-label">가로</span>
        <div class="examlist-object-size-input-wrap">
          <input
            class="template-toolbar-number examlist-object-size-input"
            data-examlist-object-size="width"
            type="number"
            min="${templateEditorObjectMinimumSize}"
            step="1"
            inputmode="numeric"
            aria-label="개체 가로 크기(px)"
          />
          <small data-examlist-object-size-unit="width">px</small>
        </div>
      </label>
      <label class="examlist-object-size-field">
        <span class="template-toolbar-field-label">세로</span>
        <div class="examlist-object-size-input-wrap">
          <input
            class="template-toolbar-number examlist-object-size-input"
            data-examlist-object-size="height"
            type="number"
            min="${templateEditorObjectMinimumSize}"
            step="1"
            inputmode="numeric"
            aria-label="개체 세로 크기(px)"
          />
          <small data-examlist-object-size-unit="height">px</small>
        </div>
      </label>
    </div>
  `;

  return sectionElement;
}


function getObjectToolbarGroup(toolbarHost) {
  return (
    toolbarHost?.querySelector?.(".examlist-object-control") ||
    toolbarHost?.querySelector?.("[data-template-open-image]")?.closest?.(".template-toolbar-group") ||
    toolbarHost?.querySelector?.('[data-template-insert="barcode"]')?.closest?.(".template-toolbar-group") ||
    null
  );
}

export function insertObjectToolbarSection(toolbarHost, sectionElement, previousSectionSelector) {
  const objectGroup = getObjectToolbarGroup(toolbarHost);

  if (!objectGroup) {
    toolbarHost?.append?.(sectionElement);
    return;
  }

  const previousSection = previousSectionSelector ? objectGroup.querySelector(previousSectionSelector) : null;

  if (previousSection) {
    previousSection.after(sectionElement);
    return;
  }

  objectGroup.append(sectionElement);
}
