import { escapeHtml } from "../../app/html-utils.js";
import { formatCount } from "../../app/number-format.js";
import { dataTagAccordionGroups, isVisibleTemplateTag, renderDataTagIcon } from "./data-tags-config.js";
import { getDataTagViewOptions, setDataTagViewOptions } from "./data-tags-view-options.js";

function getGroupedTagDefinitions(tagDefinitions = []) {
  const tagMap = new Map(
    (Array.isArray(tagDefinitions) ? tagDefinitions : [])
      .filter(isVisibleTemplateTag)
      .map((definition) => [String(definition.key || "").trim(), definition]),
  );
  const usedKeys = new Set();
  const groupDefinitions = tagDefinitions.some(tag => tag.group) ? [
    { id: 'system', label: '기본 정보', icon: 'book', keys: tagDefinitions.filter(tag => tag.group === 'system').map(tag => tag.key) },
    { id: 'signup', label: '회원가입', icon: 'user', keys: tagDefinitions.filter(tag => tag.group === 'signup').map(tag => tag.key) },
    { id: 'application', label: '원서접수', icon: 'book', keys: tagDefinitions.filter(tag => tag.group === 'application').map(tag => tag.key) },
  ] : dataTagAccordionGroups;
  const groups = groupDefinitions.map((group) => {
    const tags = group.keys
      .map((key) => tagMap.get(key))
      .filter(Boolean);

    tags.forEach((tag) => usedKeys.add(tag.key));

    return {
      ...group,
      tags,
    };
  });
  const uncategorizedTags = Array.from(tagMap.values()).filter((tag) => !usedKeys.has(tag.key));

  if (uncategorizedTags.length) {
    const etcGroup = groups.find((group) => group.id === "etc");

    if (etcGroup) {
      etcGroup.tags = [...etcGroup.tags, ...uncategorizedTags];
    }
  }

  return groups.filter((group) => group.tags.length);
}

function normalizeSearchText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function buildTagSearchText(tag = {}, groupLabel = "") {
  return normalizeSearchText(
    [
      groupLabel,
      tag.key,
      tag.token,
      tag.dataKey,
      tag.editorToken,
      tag.label,
      tag.example,
      ...(Array.isArray(tag.aliases) ? tag.aliases : []),
    ].join(" "),
  );
}

function filterDataTagPanel(tagHost, searchTerm = "") {
  const normalizedSearchTerm = normalizeSearchText(searchTerm);
  let visibleTagCount = 0;

  tagHost.querySelectorAll(".template-tag-accordion-group").forEach((groupElement) => {
    let groupVisibleCount = 0;

    groupElement.querySelectorAll(".template-tag-button").forEach((buttonElement) => {
      const searchText = String(buttonElement.dataset.templateTagSearch || "").toLowerCase();
      const isVisible = !normalizedSearchTerm || searchText.includes(normalizedSearchTerm);

      buttonElement.hidden = !isVisible;
      groupVisibleCount += isVisible ? 1 : 0;
      visibleTagCount += isVisible ? 1 : 0;
    });

    groupElement.hidden = groupVisibleCount === 0;
    const countElement = groupElement.querySelector("[data-template-tag-group-count]");

    if (countElement) {
      countElement.textContent = formatCount(groupVisibleCount);
    }

    if (normalizedSearchTerm && groupVisibleCount > 0) {
      groupElement.open = true;
    }
  });

  const emptyElement = tagHost.querySelector("[data-template-tag-search-empty]");

  if (emptyElement) {
    emptyElement.hidden = visibleTagCount > 0;
  }
}

function bindDataTagSearch(tagHost) {
  const searchInput = tagHost.querySelector("[data-template-tag-search]");

  if (!searchInput) {
    return;
  }

  searchInput.addEventListener("input", () => {
    tagHost.dataset.templateTagSearchTerm = searchInput.value;
    filterDataTagPanel(tagHost, searchInput.value);
  });
}

function bindDataTagViewOptionSwitches(tagHost) {
  tagHost.querySelectorAll("[data-template-tag-view-option]").forEach((inputElement) => {
    inputElement.addEventListener("change", () => {
      setDataTagViewOptions({
        [inputElement.dataset.templateTagViewOption]: inputElement.checked,
      });
    });
  });
}

function renderDataTagViewOptionSwitch({ checked, label, optionKey }) {
  return `
    <label class="template-tag-view-switch">
      <input
        data-template-tag-view-option="${escapeHtml(optionKey)}"
        ${checked ? "checked" : ""}
        type="checkbox"
      />
      <span class="template-tag-view-switch-track" aria-hidden="true"></span>
      <span class="template-tag-view-switch-label">${escapeHtml(label)}</span>
    </label>
  `;
}

function renderDataTagViewOptions() {
  const options = getDataTagViewOptions();

  return `
    <div class="template-tag-view-options" aria-label="캔버스 데이터태그 표시 옵션">
      ${renderDataTagViewOptionSwitch({
        checked: options.showIcons,
        label: "아이콘 표시",
        optionKey: "showIcons",
      })}
      ${renderDataTagViewOptionSwitch({
        checked: options.showSampleData,
        label: "샘플데이터로 표시",
        optionKey: "showSampleData",
      })}
    </div>
  `;
}

export function renderGroupedDataTagPanel(tagHost, tagDefinitions = [], canEdit = true) {
  if (!tagHost) {
    return;
  }

  const groups = getGroupedTagDefinitions(tagDefinitions);
  const searchTerm = String(tagHost.dataset.templateTagSearchTerm || "").trim();

  if (!groups.length) {
    tagHost.innerHTML = '<p class="editor-empty">사용 가능한 데이터 태그가 없습니다.</p>';
    return;
  }

  tagHost.innerHTML = `
    <label class="template-tag-search">
      <span class="template-tag-search-icon" aria-hidden="true"></span>
      <input
        data-template-tag-search
        type="search"
        placeholder="태그 검색..."
        value="${escapeHtml(searchTerm)}"
        autocomplete="off"
      />
    </label>
    ${renderDataTagViewOptions()}
    <div class="template-tag-accordion" data-template-tag-accordion>
      ${groups
        .map(
          (group) => `
            <details class="template-tag-accordion-group">
              <summary class="template-tag-accordion-summary">
                  <span class="template-tag-group-heading">
                    <span class="template-tag-group-icon">${renderDataTagIcon(group.icon)}</span>
                    <span class="template-tag-group-label">${escapeHtml(group.label)}</span>
                    <span class="template-tag-group-count" data-template-tag-group-count>${formatCount(group.tags.length)}</span>
                  </span>
                  <span class="template-tag-group-chevron" aria-hidden="true"></span>
                </summary>
              <div class="template-tag-accordion-list">
                ${group.tags
                  .map((tag) => {
                    const editorToken = String(tag.editorToken || tag.token || "").trim();
                    const label = String(tag.label || tag.key || "").trim();
                    const titleText = [label, tag.example].map((value) => String(value || "").trim()).filter(Boolean).join(" · ");

                    return `
                      <button
                        class="template-tag-button template-tag-accordion-button"
                        data-template-tag="${escapeHtml(editorToken)}"
                        data-template-tag-search="${escapeHtml(buildTagSearchText(tag, group.label))}"
                        type="button"
                        title="${escapeHtml(titleText || editorToken)}"
                        aria-label="${escapeHtml(titleText || editorToken)}"
                        ${canEdit ? "" : "disabled"}
                      >
                        <span class="template-tag-button-icon">${renderDataTagIcon(group.icon)}</span>
                        <span class="template-tag-button-label">${escapeHtml(label || editorToken)}</span>
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            </details>
          `,
        )
        .join("")}
    </div>
    <p class="editor-empty template-tag-search-empty" data-template-tag-search-empty hidden>검색 결과가 없습니다.</p>
  `;
  bindDataTagSearch(tagHost);
  bindDataTagViewOptionSwitches(tagHost);
  filterDataTagPanel(tagHost, searchTerm);
}

export function resetDataTagPanelState() {
  document.querySelectorAll("[data-template-tag-search]").forEach((inputElement) => {
    inputElement.value = "";
  });
  document.querySelectorAll("[data-template-tag-accordion] .template-tag-accordion-group").forEach((groupElement) => {
    groupElement.open = false;
  });
  document.querySelectorAll("#templateTagStrip").forEach((tagHost) => {
    delete tagHost.dataset.templateTagSearchTerm;
  });
}
