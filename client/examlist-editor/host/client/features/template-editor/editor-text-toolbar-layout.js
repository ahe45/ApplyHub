export function positionFontSizeSection(toolbarHost) {
  const groupedFontSection = toolbarHost?.querySelector?.(".template-toolbar-font-section");
  if (groupedFontSection) {
    return groupedFontSection;
  }
  const fontSizeSection = toolbarHost?.querySelector?.(".template-toolbar-font-size-combo")?.closest(".template-toolbar-section") || null;
  const fontFamilySection = toolbarHost?.querySelector?.(".template-toolbar-font-family-combo")?.closest(".template-toolbar-section") || null;
  const fontFamilyRow = fontFamilySection?.closest(".template-toolbar-section-row") || null;

  if (fontFamilyRow) {
    fontFamilyRow.classList.add("examlist-font-controls-row");
  }

  if (!fontSizeSection) {
    return null;
  }

  fontSizeSection.classList.add("examlist-font-size-control");

  if (fontFamilyRow?.contains(fontSizeSection)) {
    fontFamilyRow.after(fontSizeSection);
  }

  return fontSizeSection;
}
