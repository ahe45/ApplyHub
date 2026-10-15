export const dataTagViewOptionsEventName = "examlist:data-tag-view-options-change";

const storageKey = "examlist.templateEditor.dataTagViewOptions";
const defaultDataTagViewOptions = Object.freeze({
  showIcons: false,
  showSampleData: true,
});

function normalizeBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeDataTagViewOptions(options = {}) {
  return Object.freeze({
    showIcons: normalizeBoolean(options.showIcons, defaultDataTagViewOptions.showIcons),
    showSampleData: normalizeBoolean(options.showSampleData, defaultDataTagViewOptions.showSampleData),
  });
}

function readStoredDataTagViewOptions() {
  if (typeof window === "undefined" || !window.localStorage) {
    return {};
  }

  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || "{}") || {};
  } catch (_error) {
    return {};
  }
}

function writeStoredDataTagViewOptions(options) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(options));
  } catch (_error) {
    // 보기 옵션 저장 실패는 편집 흐름을 막지 않는다.
  }
}

export function getDataTagViewOptions() {
  return normalizeDataTagViewOptions({
    ...defaultDataTagViewOptions,
    ...readStoredDataTagViewOptions(),
  });
}

export function setDataTagViewOptions(patch = {}) {
  const nextOptions = normalizeDataTagViewOptions({
    ...getDataTagViewOptions(),
    ...(patch && typeof patch === "object" ? patch : {}),
  });

  writeStoredDataTagViewOptions(nextOptions);

  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent(dataTagViewOptionsEventName, { detail: nextOptions }));
  }

  return nextOptions;
}
