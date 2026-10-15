(function () {
const editorContentModule = globalThis.ExamListEditorContentShared;
const editorFormattingStateModule = globalThis.ExamListEditorFormattingState;
const editorSharedCommandsModule = globalThis.ExamListEditorSharedCommands;
const editorToolbarConfigModule = globalThis.ExamListEditorToolbarConfig;
const editorToolbarMarkupModule = globalThis.ExamListEditorToolbarMarkup;
const editorToolbarUiModule = globalThis.ExamListEditorToolbarUi;

if (!editorContentModule) {
  throw new Error("client/features/editor/content-shared.js must be loaded before client/editor-toolbar.js.");
}

if (!editorToolbarMarkupModule?.createEditorToolbarMarkupRenderer) {
  throw new Error("client/features/editor/toolbar-markup.js must be loaded before client/editor-toolbar.js.");
}

if (!editorFormattingStateModule?.createEditorToolbarFormattingStateController) {
  throw new Error("client/features/editor/formatting-state.js must be loaded before client/editor-toolbar.js.");
}

if (!editorSharedCommandsModule?.createSharedEditorCommandHelpers) {
  throw new Error("client/features/editor/shared-commands.js must be loaded before client/editor-toolbar.js.");
}

if (!editorToolbarConfigModule) {
  throw new Error("client/features/editor/toolbar-config.js must be loaded before client/editor-toolbar.js.");
}

if (!editorToolbarUiModule?.createEditorToolbarUiController) {
  throw new Error("client/features/editor/toolbar-ui.js must be loaded before client/editor-toolbar.js.");
}

const {
  normalizeTemplateEditorColorValue,
  normalizeTemplateEditorFontNodes,
  normalizeTemplateEditorInlineFontSizeStyles,
} = editorContentModule;
const { createEditorToolbarFormattingStateController } = editorFormattingStateModule;
const { createSharedEditorCommandHelpers } = editorSharedCommandsModule;
const {
  EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR,
  EDITOR_TOOLBAR_FONT_OPTIONS,
  EDITOR_TOOLBAR_FONT_SIZE_OPTIONS,
  EDITOR_TOOLBAR_ICON_MARKUP,
  EDITOR_TOOLBAR_SHADING_COLOR_PRESETS,
  EDITOR_TOOLBAR_TEXT_COLOR_PRESETS,
} = editorToolbarConfigModule;

const editorToolbarMarkupRenderer = editorToolbarMarkupModule.createEditorToolbarMarkupRenderer({
  EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR,
  EDITOR_TOOLBAR_FONT_OPTIONS,
  EDITOR_TOOLBAR_FONT_SIZE_OPTIONS,
  EDITOR_TOOLBAR_ICON_MARKUP,
  EDITOR_TOOLBAR_SHADING_COLOR_PRESETS,
  EDITOR_TOOLBAR_TEXT_COLOR_PRESETS,
  isEditorToolbarPresetFontSize,
  normalizeEditorToolbarColorValue,
});

const {
  renderEditorToolbar,
  renderEditorToolbarInner,
} = editorToolbarMarkupRenderer;
const editorToolbarUiController = editorToolbarUiModule.createEditorToolbarUiController({
  isEditorToolbarPresetFontSize,
  normalizeEditorToolbarColorValue,
});
const {
  applyEditorToolbarCellPaddingOption,
  applyEditorToolbarBorderSelectOption,
  applyEditorToolbarBorderWidthOption,
  closeAllEditorToolbarCellPaddingMenus,
  closeAllEditorToolbarBorderSelectMenus,
  closeAllEditorToolbarBorderWidthMenus,
  closeAllEditorToolbarColorPanels,
  closeAllEditorToolbarFontFamilyMenus,
  closeAllEditorToolbarFontSizeMenus,
  closeAllEditorToolbarTableInsertPanels,
  getEditorToolbarCellPaddingComboElements,
  getEditorToolbarBorderSelectElements,
  getEditorToolbarBorderWidthComboElements,
  getEditorToolbarColorPickerElements,
  getEditorToolbarFontFamilyComboElements,
  getEditorToolbarFontFamilyMenuElement,
  getEditorToolbarFontSizeComboElements,
  getEditorToolbarFontSizeMenuElement,
  getEditorToolbarTableInsertPopoverElements,
  setEditorToolbarCellPaddingMenuVisibility,
  setEditorToolbarBorderSelectMenuVisibility,
  setEditorToolbarBorderWidthMenuVisibility,
  setEditorToolbarColorPanelVisibility,
  setEditorToolbarFontFamilyMenuVisibility,
  setEditorToolbarFontSizeMenuVisibility,
  setEditorToolbarTableInsertPanelVisibility,
  syncEditorToolbarCellPaddingControl,
  syncEditorToolbarBorderSelectControl,
  syncEditorToolbarBorderWidthControl,
  syncEditorToolbarColorControls,
  syncEditorToolbarFontFamilyControls,
  syncEditorToolbarFontSizeControls,
  syncEditorToolbarFontSizeMenuSelection,
} = editorToolbarUiController;

function isEditorToolbarPresetFontSize(fontSize) {
  return EDITOR_TOOLBAR_FONT_SIZE_OPTIONS.includes(Number(fontSize));
}

function normalizeEditorToolbarColorValue(rawValue, fallbackValue = "#ffffff") {
  if (typeof normalizeTemplateEditorColorValue === "function") {
    return normalizeTemplateEditorColorValue(rawValue, fallbackValue);
  }

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

function getEditorToolbarColorFallback(command = "", tableAction = "") {
  if (String(tableAction || "").trim() === "apply-cell-shading") {
    return "#ffffff";
  }

  if (String(tableAction || "").trim() === "apply-cell-border") {
    return "#000000";
  }

  if (String(command || "").trim() === "foreColor") {
    return EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR;
  }

  return "#fff59d";
}

const editorSharedCommandHelpers = createSharedEditorCommandHelpers({
  EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR,
  EDITOR_TOOLBAR_FONT_OPTIONS,
  getEditorToolbarColorFallback,
  normalizeEditorToolbarColorValue,
  normalizeTemplateEditorFontNodes,
  normalizeTemplateEditorInlineFontSizeStyles,
  syncEditorToolbarFontFamilyControls,
  syncEditorToolbarFontSizeControls,
});
const {
  applySharedEditorCommand,
  applySharedEditorFontFamily,
  applySharedEditorFontSize,
} = editorSharedCommandHelpers;
const editorFormattingStateController = createEditorToolbarFormattingStateController({
  EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR,
  EDITOR_TOOLBAR_FONT_OPTIONS,
  normalizeEditorToolbarColorValue,
  syncEditorToolbarColorControls,
  syncEditorToolbarFontFamilyControls,
  syncEditorToolbarFontSizeControls,
});
const { updateEditorToolbarFormattingState } = editorFormattingStateController;

globalThis.ExamListEditorToolbar = Object.freeze({
  EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR,
  EDITOR_TOOLBAR_FONT_OPTIONS,
  EDITOR_TOOLBAR_FONT_SIZE_OPTIONS,
  EDITOR_TOOLBAR_ICON_MARKUP,
  EDITOR_TOOLBAR_SHADING_COLOR_PRESETS,
  EDITOR_TOOLBAR_TEXT_COLOR_PRESETS,
  applyEditorToolbarCellPaddingOption,
  applyEditorToolbarBorderSelectOption,
  applyEditorToolbarBorderWidthOption,
  applySharedEditorCommand,
  applySharedEditorFontFamily,
  applySharedEditorFontSize,
  closeAllEditorToolbarCellPaddingMenus,
  closeAllEditorToolbarBorderSelectMenus,
  closeAllEditorToolbarBorderWidthMenus,
  closeAllEditorToolbarColorPanels,
  closeAllEditorToolbarFontFamilyMenus,
  closeAllEditorToolbarFontSizeMenus,
  closeAllEditorToolbarTableInsertPanels,
  getEditorToolbarCellPaddingComboElements,
  getEditorToolbarColorFallback,
  getEditorToolbarBorderSelectElements,
  getEditorToolbarBorderWidthComboElements,
  getEditorToolbarColorPickerElements,
  getEditorToolbarFontFamilyComboElements,
  getEditorToolbarFontFamilyMenuElement,
  getEditorToolbarFontSizeComboElements,
  getEditorToolbarFontSizeMenuElement,
  getEditorToolbarTableInsertPopoverElements,
  isEditorToolbarPresetFontSize,
  normalizeEditorToolbarColorValue,
  renderEditorToolbar,
  renderEditorToolbarInner,
  setEditorToolbarCellPaddingMenuVisibility,
  setEditorToolbarBorderSelectMenuVisibility,
  setEditorToolbarBorderWidthMenuVisibility,
  setEditorToolbarColorPanelVisibility,
  setEditorToolbarFontFamilyMenuVisibility,
  setEditorToolbarFontSizeMenuVisibility,
  setEditorToolbarTableInsertPanelVisibility,
  syncEditorToolbarCellPaddingControl,
  syncEditorToolbarBorderSelectControl,
  syncEditorToolbarBorderWidthControl,
  syncEditorToolbarColorControls,
  syncEditorToolbarFontFamilyControls,
  syncEditorToolbarFontSizeControls,
  syncEditorToolbarFontSizeMenuSelection,
  updateEditorToolbarFormattingState,
});

})();
