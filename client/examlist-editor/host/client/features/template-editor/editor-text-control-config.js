export const defaultEditorLineHeight = 1;
export const lineHeightMinimum = 0;
export const lineHeightMaximum = 5;
export const lineHeightStep = 0.5;
export const fontSizeMinimum = 1;
export const fontSizeMaximum = 72;
export const fontSizeStep = 1;

export function normalizeLineHeightValue(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return String(defaultEditorLineHeight);
  }

  const clampedValue = Math.min(lineHeightMaximum, Math.max(lineHeightMinimum, numericValue));
  const roundedValue = Math.round(clampedValue * 100) / 100;

  return String(roundedValue).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function normalizeFontSizeValue(value, fallbackValue = 16) {
  const numericValue = Math.round(Number(value));

  if (!Number.isFinite(numericValue)) {
    return String(fallbackValue);
  }

  return String(Math.min(fontSizeMaximum, Math.max(fontSizeMinimum, numericValue)));
}
