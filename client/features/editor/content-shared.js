(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardEditorContentShared = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY = "'Noto Sans KR', sans-serif";
  const TEMPLATE_EDITOR_DEFAULT_FONT_SIZE = 14;
  const TEMPLATE_EDITOR_DEFAULT_TABLE_BORDER = "1px solid #000000";
  const TEMPLATE_EDITOR_DEFAULT_TABLE_HEADER_BACKGROUND = "#f6f8fc";
  const TEMPLATE_EDITOR_DEFAULT_TABLE_CELL_PADDING = "5px 6px";
  const TEMPLATE_EDITOR_DEFAULT_TABLE_STYLE = "width: 100%; border-collapse: collapse; table-layout: fixed; background: transparent;";
  const TEMPLATE_EDITOR_DEFAULT_TABLE_CELL_STYLE =
    "border: 1px solid #000000; padding: 5px 6px; text-align: left; vertical-align: top; background: transparent;";
  const TEMPLATE_EDITOR_DEFAULT_TABLE_HEADER_STYLE =
    "border: 1px solid #000000; padding: 5px 6px; text-align: left; vertical-align: top; background: transparent;";

  function normalizeTemplateEditorFontNodes(rootElement, { appliedFontSizePx = null } = {}) {
    if (!rootElement?.querySelectorAll) {
      return;
    }

    const legacyFontSizeMap = {
      1: 10,
      2: 13,
      3: 16,
      4: 18,
      5: 24,
      6: 32,
      7: 48,
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
        size === "7" && appliedFontSizePx ? appliedFontSizePx : legacyFontSizeMap[Number(size)] || null;

      if (mappedFontSize) {
        replacementSpan.style.fontSize = `${mappedFontSize}px`;
      }

      while (fontElement.firstChild) {
        replacementSpan.appendChild(fontElement.firstChild);
      }

      fontElement.replaceWith(replacementSpan);
    });
  }

  function normalizeTemplateEditorInlineFontSizeStyles(rootElement, appliedFontSizePx = null) {
    if (!rootElement?.querySelectorAll || !appliedFontSizePx) {
      return;
    }

    rootElement.querySelectorAll("[style]").forEach((element) => {
      const fontSizeValue = String(element.style.fontSize || "").trim();

      if (!fontSizeValue || fontSizeValue.endsWith("px")) {
        return;
      }

      element.style.fontSize = `${appliedFontSizePx}px`;
    });
  }

  function normalizeTemplateEditorColorValue(rawValue, fallbackValue = "#ffffff") {
    const normalizedValue = String(rawValue || "").trim();

    if (/^#[0-9a-f]{6}$/i.test(normalizedValue)) {
      return normalizedValue.toLowerCase();
    }

    if (/^#[0-9a-f]{3}$/i.test(normalizedValue)) {
      const [, shortHex = ""] = normalizedValue.match(/^#([0-9a-f]{3})$/i) || [];
      return `#${shortHex.split("").map((value) => value.repeat(2)).join("").toLowerCase()}`;
    }

    const rgbMatch = normalizedValue.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);

    if (rgbMatch) {
      const [, red = "255", green = "255", blue = "255"] = rgbMatch;
      return `#${[red, green, blue]
        .map((value) => Math.max(0, Math.min(255, Number(value) || 0)).toString(16).padStart(2, "0"))
        .join("")}`;
    }

    return fallbackValue;
  }

  function buildTemplateEditorTableMarkup(rowCount, columnCount) {
    const rows = Array.from({ length: rowCount }, (_, rowIndex) => {
      const cells = Array.from({ length: columnCount }, (_, columnIndex) => {
        if (rowIndex === 0) {
          return `<th style="${TEMPLATE_EDITOR_DEFAULT_TABLE_HEADER_STYLE}">제목 ${columnIndex + 1}</th>`;
        }

        return `<td style="${TEMPLATE_EDITOR_DEFAULT_TABLE_CELL_STYLE}"><br /></td>`;
      }).join("");

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
