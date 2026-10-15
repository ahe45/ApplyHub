import { templateEditorObjectMinimumSize } from "./object-toolbar-constants.js";

export function normalizeObjectSizeInputValue(value) {
  if (!String(value || "").trim()) {
    return null;
  }

  const numericValue = Math.round(Number(value));

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.max(templateEditorObjectMinimumSize, numericValue);
}

export function parseObjectSizePixelValue(value, fallback = 0) {
  const parsedValue = Number.parseFloat(String(value || "").trim());

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

export function parseObjectSizeInlinePixelValue(value, fallback = 0) {
  const rawValue = String(value || "").trim();

  return /^-?\d+(?:\.\d+)?px$/i.test(rawValue) ? parseObjectSizePixelValue(rawValue, fallback) : fallback;
}
