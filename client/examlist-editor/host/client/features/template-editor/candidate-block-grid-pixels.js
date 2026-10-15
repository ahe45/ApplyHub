export function parseCandidateBlockPixelValue(value, fallback = 0) {
  const numericValue = Number.parseFloat(String(value || ""));

  return Number.isFinite(numericValue) ? numericValue : fallback;
}
