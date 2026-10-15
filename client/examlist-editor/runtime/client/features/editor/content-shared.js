(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListEditorContentShared = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY = "'Noto Sans KR', sans-serif";
  const TEMPLATE_EDITOR_DEFAULT_FONT_SIZE = 11;
  const TEMPLATE_EDITOR_DEFAULT_TABLE_BORDER = "1px solid #000000";
  const TEMPLATE_EDITOR_DEFAULT_TABLE_HEADER_BACKGROUND = "#f6f8fc";
  const TEMPLATE_EDITOR_DEFAULT_TABLE_CELL_PADDING = "2pt";
  const TEMPLATE_EDITOR_DEFAULT_TABLE_STYLE = "width: 100%; border-collapse: collapse; table-layout: fixed; background: transparent;";
  const TEMPLATE_EDITOR_DEFAULT_TABLE_CELL_STYLE =
    "border: 1pt solid #000000; padding: 2pt; text-align: left; vertical-align: middle; font-size: 11pt; background: transparent;";
  const TEMPLATE_EDITOR_DEFAULT_TABLE_HEADER_STYLE =
    "border: 1pt solid #000000; padding: 2pt; text-align: left; vertical-align: middle; font-size: 11pt; background: rgba(238, 243, 251, 0.92);";

  function normalizeTemplateEditorFontNodes(rootElement, { appliedFontSizePt = null, appliedFontSizePx = null } = {}) {
    if (!rootElement?.querySelectorAll) {
      return;
    }

    const appliedFontSize = appliedFontSizePt ?? appliedFontSizePx;
    const legacyFontSizeMap = {
      1: 8,
      2: 10,
      3: 12,
      4: 14,
      5: 18,
      6: 24,
      7: 36,
    };

    rootElement.querySelectorAll("font").forEach((fontElement) => {
      const replacementSpan = document.createElement("span");
      const inlineStyle = String(fontElement.getAttribute("style") || "").trim();
      const face = String(fontElement.getAttribute("face") || "").trim();
      const color = String(fontElement.getAttribute("color") || "").trim();
      const size = String(fontElement.getAttribute("size") || "").trim();

      if (inlineStyle) {
        replacementSpan.setAttribute("style", inlineStyle);
      }

      if (face) {
        replacementSpan.style.fontFamily = face;
      }

      if (color) {
        replacementSpan.style.color = color;
      }

      const mappedFontSize =
        size === "7" && appliedFontSize ? appliedFontSize : legacyFontSizeMap[Number(size)] || null;

      if (mappedFontSize) {
        replacementSpan.style.fontSize = `${mappedFontSize}pt`;
      }

      while (fontElement.firstChild) {
        replacementSpan.appendChild(fontElement.firstChild);
      }

      fontElement.replaceWith(replacementSpan);
    });
  }

  function normalizeTemplateEditorInlineFontSizeStyles(rootElement, appliedFontSizePt = null) {
    if (!rootElement?.querySelectorAll || !appliedFontSizePt) {
      return;
    }

    rootElement.querySelectorAll("[style]").forEach((element) => {
      const fontSizeValue = String(element.style.fontSize || "").trim();

      if (!fontSizeValue || /(?:px|pt|em|rem|%)$/i.test(fontSizeValue) || /^calc\(/i.test(fontSizeValue)) {
        return;
      }

      element.style.fontSize = `${appliedFontSizePt}pt`;
    });
  }

  function normalizeTemplateEditorColorValue(rawValue, fallbackValue = "#ffffff") {
    const normalizedValue = String(rawValue || "").trim();
    const normalizedFallbackValue = String(fallbackValue || "").trim().toLowerCase();
    const normalizeResolvedColorValue = (resolvedValue) =>
      normalizedFallbackValue === "#000000" && resolvedValue === "#152033" ? "#000000" : resolvedValue;

    if (/^#[0-9a-f]{6}$/i.test(normalizedValue)) {
      return normalizeResolvedColorValue(normalizedValue.toLowerCase());
    }

    if (/^#[0-9a-f]{3}$/i.test(normalizedValue)) {
      const [, shortHex = ""] = normalizedValue.match(/^#([0-9a-f]{3})$/i) || [];
      return normalizeResolvedColorValue(`#${shortHex.split("").map((value) => value.repeat(2)).join("").toLowerCase()}`);
    }

    const rgbMatch = normalizedValue.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);

    if (rgbMatch) {
      const [, red = "255", green = "255", blue = "255"] = rgbMatch;
      return normalizeResolvedColorValue(`#${[red, green, blue]
        .map((value) => Math.max(0, Math.min(255, Number(value) || 0)).toString(16).padStart(2, "0"))
        .join("")}`);
    }

    return fallbackValue;
  }

  function buildTemplateEditorTableMarkup(rowCount, columnCount) {
    const rows = Array.from({ length: rowCount }, () => {
      const cells = Array.from({ length: columnCount }, () => `<td style="${TEMPLATE_EDITOR_DEFAULT_TABLE_CELL_STYLE}"><br /></td>`).join("");

      return `<tr>${cells}</tr>`;
    }).join("");

    return `
      <table style="${TEMPLATE_EDITOR_DEFAULT_TABLE_STYLE}">
        <tbody>
          ${rows}
        </tbody>
      </table>
      <p></p>
    `;
  }

  return Object.freeze({
    TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
    TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
    TEMPLATE_EDITOR_DEFAULT_TABLE_BORDER,
    TEMPLATE_EDITOR_DEFAULT_TABLE_HEADER_BACKGROUND,
    TEMPLATE_EDITOR_DEFAULT_TABLE_CELL_PADDING,
    TEMPLATE_EDITOR_DEFAULT_TABLE_STYLE,
    TEMPLATE_EDITOR_DEFAULT_TABLE_CELL_STYLE,
    TEMPLATE_EDITOR_DEFAULT_TABLE_HEADER_STYLE,
    buildTemplateEditorTableMarkup,
    normalizeTemplateEditorColorValue,
    normalizeTemplateEditorFontNodes,
    normalizeTemplateEditorInlineFontSizeStyles,
  });
});

})();
