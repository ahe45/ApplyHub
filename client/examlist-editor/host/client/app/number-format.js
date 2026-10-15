const countFormatter = new Intl.NumberFormat("ko-KR");
const decimalFormatters = new Map();

function parseNumericValue(value) {
  return typeof value === "string" ? Number(value.replaceAll(",", "")) : Number(value);
}

function getDecimalFormatter(maximumFractionDigits = 1) {
  const safeDigits = Math.min(Math.max(Math.round(Number(maximumFractionDigits)) || 0, 0), 6);

  if (!decimalFormatters.has(safeDigits)) {
    decimalFormatters.set(
      safeDigits,
      new Intl.NumberFormat("ko-KR", {
        maximumFractionDigits: safeDigits,
      }),
    );
  }

  return decimalFormatters.get(safeDigits);
}

export function formatCount(value, fallback = "0") {
  const numericValue = parseNumericValue(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return countFormatter.format(Math.max(0, Math.trunc(numericValue)));
}

export function formatCountWithUnit(value, unit = "", fallback = "0") {
  return `${formatCount(value, fallback)}${unit}`;
}

export function formatOptionalCountWithUnit(value, unit = "") {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = parseNumericValue(value);

  if (!Number.isFinite(numericValue)) {
    return "-";
  }

  return `${formatCount(numericValue)}${unit}`;
}

export function formatDecimalNumber(value, maximumFractionDigits = 1, fallback = "0") {
  const numericValue = parseNumericValue(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return getDecimalFormatter(maximumFractionDigits).format(Math.max(0, numericValue));
}
