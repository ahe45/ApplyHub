import { normalizeDataTagSampleValue } from "./data-tag-value-formatting.js";

export const dataTagSampleValuesEventName = "examlist:data-tag-sample-values-change";
export const dataTagSettingsEventName = "examlist:data-tag-settings-change";

const sampleStorageKey = "examlist.templateEditor.dataTagSampleValues.v1";
const emptyValueStorageKey = "examlist.templateEditor.dataTagEmptyValueData.v1";

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function getDefinitionKey(definition = {}) {
  return String(definition?.key || definition?.dataKey || definition?.token || "").trim();
}

function getDefinitionLabel(definition = {}) {
  const label = String(definition?.label || "").trim();

  return label || getDefinitionKey(definition);
}

function getDefaultEmptyValueForDefinition(definition = {}) {
  const key = getDefinitionKey(definition);

  if (key === "candidate.photo") {
    return "사진";
  }

  return getDefinitionLabel(definition);
}

function readStoredDataTagValues(storageKey) {
  if (typeof window === "undefined" || !window.localStorage) {
    return {};
  }

  try {
    const parsedValue = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    return parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue) ? parsedValue : {};
  } catch (_error) {
    return {};
  }
}

function writeStoredDataTagValues(storageKey, values) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(values || {}));
  } catch (_error) {
    // 샘플데이터 저장 실패는 편집 흐름을 막지 않는다.
  }
}

function dispatchDataTagSampleValuesChange(values) {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent(dataTagSampleValuesEventName, { detail: values || {} }));
  }
}

function dispatchDataTagSettingsChange(settings) {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent(dataTagSettingsEventName, { detail: settings || {} }));
  }
}

export function buildDefaultDataTagSampleValues(tagDefinitions = []) {
  return (Array.isArray(tagDefinitions) ? tagDefinitions : []).reduce((values, definition) => {
    const key = getDefinitionKey(definition);

    if (key && !hasOwn(values, key)) {
      values[key] = String(definition?.example ?? "");
    }

    return values;
  }, {});
}

export function buildDefaultDataTagEmptyValueData(tagDefinitions = []) {
  return (Array.isArray(tagDefinitions) ? tagDefinitions : []).reduce((values, definition) => {
    const key = getDefinitionKey(definition);

    if (key && !hasOwn(values, key)) {
      values[key] = getDefaultEmptyValueForDefinition(definition);
    }

    return values;
  }, {});
}

function normalizeDataTagValues(tagDefinitions = [], rawValues = {}, buildDefaults = buildDefaultDataTagSampleValues) {
  const defaults = buildDefaults(tagDefinitions);
  const source = rawValues && typeof rawValues === "object" && !Array.isArray(rawValues) ? rawValues : {};

  return Object.keys(defaults).reduce((values, key) => {
    values[key] = hasOwn(source, key) ? String(source[key] ?? "") : defaults[key];
    return values;
  }, {});
}

export function normalizeDataTagSampleValues(tagDefinitions = [], sampleValues = {}) {
  const normalizedValues = normalizeDataTagValues(tagDefinitions, sampleValues);
  const definitionMap = new Map(
    (Array.isArray(tagDefinitions) ? tagDefinitions : [])
      .map((definition) => [getDefinitionKey(definition), definition])
      .filter(([key]) => Boolean(key)),
  );

  return Object.keys(normalizedValues).reduce((values, key) => {
    values[key] = normalizeDataTagSampleValue(definitionMap.get(key) || key, normalizedValues[key]);
    return values;
  }, {});
}

export function normalizeDataTagEmptyValueData(tagDefinitions = [], emptyValueData = {}) {
  return normalizeDataTagValues(tagDefinitions, emptyValueData, buildDefaultDataTagEmptyValueData);
}

export function loadDataTagSampleValues(tagDefinitions = [], sourceValues = null) {
  const storedValues = sourceValues && typeof sourceValues === "object" && !Array.isArray(sourceValues)
    ? sourceValues
    : readStoredDataTagValues(sampleStorageKey);

  return normalizeDataTagSampleValues(tagDefinitions, storedValues);
}

export function loadDataTagEmptyValueData(tagDefinitions = [], sourceValues = null) {
  const storedValues = sourceValues && typeof sourceValues === "object" && !Array.isArray(sourceValues)
    ? sourceValues
    : readStoredDataTagValues(emptyValueStorageKey);

  return normalizeDataTagEmptyValueData(tagDefinitions, storedValues);
}

export function saveDataTagSampleValues(tagDefinitions = [], sampleValues = {}) {
  const normalizedValues = normalizeDataTagSampleValues(tagDefinitions, sampleValues);

  writeStoredDataTagValues(sampleStorageKey, normalizedValues);
  dispatchDataTagSampleValuesChange(normalizedValues);
  return normalizedValues;
}

export function saveDataTagEmptyValueData(tagDefinitions = [], emptyValueData = {}) {
  const normalizedValues = normalizeDataTagEmptyValueData(tagDefinitions, emptyValueData);

  writeStoredDataTagValues(emptyValueStorageKey, normalizedValues);
  dispatchDataTagSettingsChange({ emptyValueData: normalizedValues });
  return normalizedValues;
}

export function applyDataTagSampleValuesToDefinitions(tagDefinitions = [], sampleValues = {}) {
  const normalizedValues = normalizeDataTagSampleValues(tagDefinitions, sampleValues);

  return (Array.isArray(tagDefinitions) ? tagDefinitions : []).map((definition) => {
    const key = getDefinitionKey(definition);

    if (!key || !hasOwn(normalizedValues, key)) {
      return definition;
    }

    return {
      ...definition,
      example: normalizedValues[key],
    };
  });
}

export function createDataTagSampleValuesPayload(tagDefinitions = [], sampleValues = {}) {
  return normalizeDataTagSampleValues(tagDefinitions, sampleValues);
}

export function createDataTagEmptyValueDataPayload(tagDefinitions = [], emptyValueData = {}) {
  return normalizeDataTagEmptyValueData(tagDefinitions, emptyValueData);
}

export function createDataTagSettingsPayload(tagDefinitions = [], { emptyValueData = {}, sampleData = {} } = {}) {
  return {
    emptyValueData: createDataTagEmptyValueDataPayload(tagDefinitions, emptyValueData),
    sampleData: createDataTagSampleValuesPayload(tagDefinitions, sampleData),
  };
}

export function areDataTagSampleValuesEqual(tagDefinitions = [], leftValues = {}, rightValues = {}) {
  const left = normalizeDataTagSampleValues(tagDefinitions, leftValues);
  const right = normalizeDataTagSampleValues(tagDefinitions, rightValues);
  const keys = Object.keys(buildDefaultDataTagSampleValues(tagDefinitions));

  return keys.every((key) => left[key] === right[key]);
}

export function areDataTagEmptyValueDataEqual(tagDefinitions = [], leftValues = {}, rightValues = {}) {
  const left = normalizeDataTagEmptyValueData(tagDefinitions, leftValues);
  const right = normalizeDataTagEmptyValueData(tagDefinitions, rightValues);
  const keys = Object.keys(buildDefaultDataTagEmptyValueData(tagDefinitions));

  return keys.every((key) => left[key] === right[key]);
}
