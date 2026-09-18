const templateEditorContentSharedModule = globalThis.AdmitCardEditorContentShared;
const templateEditorTableUtilsModule = globalThis.AdmitCardEditorTableUtils;
const templateEditorExamineePhotoUtilsModule = globalThis.AdmitCardExamineePhotoUtils;
const templateEditorCommandsModule = globalThis.AdmitCardTemplateEditorCommands;
const templateEditorGeneratedObjectModule = globalThis.AdmitCardTemplateGeneratedObjects;
const templateEditorImageToolsModule = globalThis.AdmitCardTemplateEditorImageTools;
const templateEditorPageSettingsModule = globalThis.AdmitCardTemplateEditorPageSettings;
const templateEditorPreviewModule = globalThis.AdmitCardTemplateEditorPreview;
const templateEditorSelectionModule = globalThis.AdmitCardTemplateEditorSelection;
const templateEditorTableToolsModule = globalThis.AdmitCardTemplateEditorTableTools;
const templateEditorLifecycleModule = globalThis.AdmitCardTemplateEditorLifecycle;
const templateEditorTableFormattingModule = globalThis.AdmitCardTemplateEditorTableFormatting;
const templateEditorRuntimeModule = globalThis.AdmitCardTemplateEditorRuntime;
const templateEditorToolbarStateModule = globalThis.AdmitCardTemplateEditorToolbarState;
const templateCardModule = globalThis.AdmitCardTemplateCards;

if (!templateEditorContentSharedModule) {
  throw new Error("client/features/editor/content-shared.js must be loaded before client/template-editor.js.");
}

if (!templateEditorGeneratedObjectModule) {
  throw new Error("client/features/template-editor/generated-objects.js must be loaded before client/template-editor.js.");
}

if (!templateEditorCommandsModule?.createTemplateEditorCommandController) {
  throw new Error("client/features/template-editor/commands.js must be loaded before client/template-editor.js.");
}

if (!templateEditorImageToolsModule?.createTemplateEditorImageController) {
  throw new Error("client/features/template-editor/image-tools.js must be loaded before client/template-editor.js.");
}

if (!templateEditorPageSettingsModule?.createTemplatePagePropertiesController) {
  throw new Error("client/features/template-editor/page-settings.js must be loaded before client/template-editor.js.");
}

if (!templateEditorPreviewModule?.createTemplatePreviewController) {
  throw new Error("client/features/template-editor/preview.js must be loaded before client/template-editor.js.");
}

if (!templateEditorSelectionModule?.createTemplateEditorSelectionController) {
  throw new Error("client/features/template-editor/selection.js must be loaded before client/template-editor.js.");
}

if (!templateEditorTableToolsModule?.createTemplateEditorTableController) {
  throw new Error("client/features/template-editor/table-tools.js must be loaded before client/template-editor.js.");
}

if (!templateEditorLifecycleModule?.createTemplateEditorLifecycleController) {
  throw new Error("client/features/template-editor/lifecycle.js must be loaded before client/template-editor.js.");
}

if (!templateEditorTableFormattingModule?.createTemplateEditorTableFormattingController) {
  throw new Error("client/features/template-editor/table-formatting.js must be loaded before client/template-editor.js.");
}

if (!templateEditorRuntimeModule?.createTemplateEditorRuntimeController) {
  throw new Error("client/features/template-editor/runtime.js must be loaded before client/template-editor.js.");
}

if (!templateEditorToolbarStateModule?.createTemplateEditorToolbarStateController) {
  throw new Error("client/features/template-editor/toolbar-state.js must be loaded before client/template-editor.js.");
}

if (!templateEditorExamineePhotoUtilsModule) {
  throw new Error("client/features/admit-cards/photo-utils.js must be loaded before client/template-editor.js.");
}

if (!templateEditorTableUtilsModule) {
  throw new Error("client/features/editor/table-utils.js must be loaded before client/template-editor.js.");
}

if (!templateCardModule) {
  throw new Error("client/features/templates/cards.js must be loaded before client/template-editor.js.");
}

const {
  TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
  TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
  TEMPLATE_EDITOR_DEFAULT_TABLE_HEADER_BACKGROUND,
  buildTemplateEditorTableMarkup,
  normalizeTemplateEditorColorValue: templateNormalizeTemplateEditorColorValue,
  normalizeTemplateEditorFontNodes: templateNormalizeTemplateEditorFontNodes,
  normalizeTemplateEditorInlineFontSizeStyles: templateNormalizeTemplateEditorInlineFontSizeStyles,
} = templateEditorContentSharedModule;

const {
  TEMPLATE_EDITOR_TABLE_MIN_SIZE,
  applyTemplateTableCellPresentation,
  buildTemplateTableCellMap,
  ensureTemplateEditorTableColGroup,
  getTemplateEditorMeasuredColumnWidth,
  getTemplateEditorTableColumnCount,
  normalizeTemplateEditorTableAppearance,
  normalizeTemplateEditorTables,
  parseTemplateEditorPixelStyle,
  syncTemplateEditorTableWidth,
} = templateEditorTableUtilsModule;

const {
  applyTemplateRenderedObjects,
  buildTemplateGeneratedObjectMarkup,
  decorateTemplateGeneratedObjectImage,
} = templateEditorGeneratedObjectModule;
const { createTemplateEditorCommandController } = templateEditorCommandsModule;
const { createTemplateEditorImageController } = templateEditorImageToolsModule;
const {
  applyTemplatePageSettingsToRenderedSheet,
  createTemplatePagePropertiesController,
} = templateEditorPageSettingsModule;
const { createTemplateEditorLifecycleController } = templateEditorLifecycleModule;
const { createTemplatePreviewController } = templateEditorPreviewModule;
const { createTemplateEditorSelectionController } = templateEditorSelectionModule;
const { createTemplateEditorTableFormattingController } = templateEditorTableFormattingModule;
const { createTemplateEditorRuntimeController } = templateEditorRuntimeModule;
const { createTemplateEditorTableController } = templateEditorTableToolsModule;
const { createTemplateEditorToolbarStateController } = templateEditorToolbarStateModule;
const { buildExamineePhotoUrl: buildSharedExamineePhotoUrl } = templateEditorExamineePhotoUtilsModule;

const {
  TEMPLATE_PREVIEW_PHOTO_PATH,
  closeTemplateCardMetaEditor,
  getTemplateCreationSeed,
  getTemplatePreviewDate,
  openTemplateCardMetaEditor,
  renderTemplateCard,
  saveTemplateCardMetaEditor,
  updateTemplateCardMetaEditorDraft,
} = templateCardModule;

const TEMPLATE_EDITOR_TABLE_EDGE_THRESHOLD = 8;
const TEMPLATE_EDITOR_TABLE_SELECTION_DRAG_THRESHOLD = 6;

let appendMergedTemplateCellContent = () => {};
let clearTemplateEditorImageSelection = () => {};
let clearTemplateEditorTableHoverState = () => {};
let clearTemplateEditorTableSelection = () => {};
let createTemplateTableCell = () => null;
let decorateTemplateEditorImages = () => {};
let ensureTemplateEditorImageOverlay = () => null;
let focusTemplateEditorCell = () => {};
let getTemplateEditorActiveTableSelection = () => null;
let getTemplateEditorCellShadingValue = () => "";
let getTemplateEditorImageTarget = () => null;
let getTemplateEditorMedianValue = () => "";
let getTemplateEditorPixelValue = () => "";
let getTemplateEditorSelectedCell = () => null;
let getTemplateEditorSelectedTable = () => null;
let getTemplateEditorTableLogicalColumnWidth = () => "";
let getTemplateEditorTableLogicalRowHeight = () => "";
let handleTemplateEditorTablePointerDown = () => false;
let handleTemplateTableAction = () => {};
let insertTemplateCellAtAbsoluteColumn = () => {};
let isTemplateTableCellEmpty = () => true;
let releaseTemplateEditorImageMoveSession = () => {};
let releaseTemplateEditorImageResizeSession = () => {};
let releaseTemplateEditorTableResizeSession = () => {};
let releaseTemplateEditorTableSelectionSession = () => {};
let selectTemplateEditorImage = () => {};
let setTemplateEditorTableLogicalRowHeight = () => {};
let startTemplateEditorImageMoveSession = () => {};
let syncTemplatePageSettingsFromDocument = () => {};
let handleTemplatePageSettingChange = () => false;
let updateTemplateEditorFormattingControls = () => {};
let updateTemplateEditorImageSelectionOverlay = () => {};
let updateTemplateEditorTableHoverState = () => {};
let updateTemplateTableControls = () => {};

const templateEditorSelectionController = createTemplateEditorSelectionController({
  TEMPLATE_EDITOR_HISTORY_LIMIT,
  clearTemplateEditorImageSelection: (...args) => clearTemplateEditorImageSelection(...args),
  clearTemplateEditorTableSelection: (...args) => clearTemplateEditorTableSelection(...args),
  decorateTemplateEditorImages: (...args) => decorateTemplateEditorImages(...args),
  focusTemplateEditorCell: (...args) => focusTemplateEditorCell(...args),
  getTemplateEditorActiveTableSelection: (...args) => getTemplateEditorActiveTableSelection(...args),
  getTemplateEditorModal: () => templateEditorModal,
  getTemplateEditorSelectedCell: (...args) => getTemplateEditorSelectedCell(...args),
  getTemplateEditorStatusElement: () => templateEditorStatus,
  getTemplateEditorSurface: () => templateEditorSurface,
  normalizeTemplateEditorFontNodes: templateNormalizeTemplateEditorFontNodes,
  normalizeTemplateEditorTables,
  releaseTemplateEditorTableResizeSession: (...args) => releaseTemplateEditorTableResizeSession(...args),
  releaseTemplateEditorTableSelectionSession: (...args) => releaseTemplateEditorTableSelectionSession(...args),
  state,
  templateTagDefinitions,
  updateTemplateEditorFormattingControls: (...args) => updateTemplateEditorFormattingControls(...args),
  updateTemplateEditorImageSelectionOverlay: (...args) => updateTemplateEditorImageSelectionOverlay(...args),
  updateTemplateTableControls: (...args) => updateTemplateTableControls(...args),
});

const {
  buildTemplateTokenHtml,
  clearTemplateEditorActiveCell,
  escapeAttribute,
  escapeHtml,
  getClosestTemplateEditorElement,
  getTemplateEditorSelectionNode,
  getTemplateEditorSerializedHtml,
  getTemplateEditorTagText,
  handleTemplateEditorTokenDeletion,
  initializeTemplateEditorHistory,
  normalizeTemplateTag,
  normalizeTemplateTagNodes,
  prepareTemplateEditorContent,
  redoTemplateEditorHistory,
  restoreTemplateEditorSelection,
  saveTemplateEditorSelection,
  setTemplateEditorStatus,
  stripTemplateEditorTransientState,
  syncTemplateEditorContent,
  undoTemplateEditorHistory,
  updateTemplateEditorActiveCell,
} = templateEditorSelectionController;

const templatePreviewController = createTemplatePreviewController({
  TEMPLATE_PREVIEW_PHOTO_PATH,
  applyTemplateRenderedObjects,
  buildApiUrl,
  buildSharedExamineePhotoUrl,
  escapeAttribute,
  escapeHtml,
  getTemplateEditorTagText,
  getTemplatePreviewDate,
  normalizeTemplateEditorFontNodes: templateNormalizeTemplateEditorFontNodes,
  normalizeTemplateTag,
  normalizeTemplateTagNodes,
  recordExamineePrint,
  state,
  stripTemplateEditorTransientState,
  templateTagDefinitions: globalThis.AdmitCardAppConfig.templateRenderTagDefinitions,
});

const {
  buildExamineePhotoUrl,
  getTemplatePreviewExaminee,
  printTemplatePreview,
  renderTemplateWithExaminee,
} = templatePreviewController;
const templateEditorRuntimeController = createTemplateEditorRuntimeController({
  EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR:
    typeof EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR === "string" ? EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR : "#152033",
  TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
  TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
  applySharedEditorCommand,
  applySharedEditorFontFamily,
  applySharedEditorFontSize,
  applyTemplateEditorTableSelectionCommand,
  applyTemplateEditorTableSelectionFontFamily,
  applyTemplateEditorTableSelectionFontSize,
  getTemplateEditorBlockTypeElement: () => templateEditorBlockType,
  getTemplateEditorFontFamilyElement: () => templateEditorFontFamily,
  getTemplateEditorFontSizeElement: () => templateEditorFontSize,
  getTemplateEditorSurface: () => templateEditorSurface,
  getTemplateEditorTextColorElement: () => templateEditorTextColor,
  getTemplateEditorTextShadingElement: () => templateEditorTextShading,
  redoTemplateEditorHistory,
  restoreTemplateEditorSelection,
  saveTemplateEditorSelection,
  setTemplateEditorStatus,
  syncTemplateEditorContent,
  undoTemplateEditorHistory,
  updateTemplateEditorActiveCell,
});

const {
  applyTemplateEditorCommand,
  applyTemplateEditorFontFamily,
  applyTemplateEditorFontSize,
  getTemplateEditorDocumentElement,
  getTemplateEditorImageOverlayContainer,
  placeCaretAtEnd,
} = templateEditorRuntimeController;

const templateEditorCommandController = createTemplateEditorCommandController({
  buildTemplateEditorTableMarkup,
  buildTemplateGeneratedObjectMarkup,
  buildTemplateTokenHtml,
  escapeAttribute,
  getTemplateEditorCellSplitCountInput: () => templateEditorCellSplitCount,
  getTemplateEditorCellSplitPanel: () => templateEditorCellSplitPanel,
  getTemplateEditorSurface: () => templateEditorSurface,
  getTemplateEditorTableColumnsInput: () => templateEditorTableColumns,
  getTemplateEditorTableInsertPanel: () => templateEditorTableInsertPanel,
  getTemplateEditorTableRowsInput: () => templateEditorTableRows,
  getTemplatePreviewExaminee,
  placeCaretAtEnd,
  restoreTemplateEditorSelection,
  setEditorToolbarTableInsertPanelVisibility:
    typeof setEditorToolbarTableInsertPanelVisibility === "function" ? setEditorToolbarTableInsertPanelVisibility : undefined,
  setTemplateEditorStatus,
  state,
  syncTemplateEditorContent,
});

const {
  getTemplateEditorCellSplitConfig,
  handleTemplateEditorInsert,
  insertTemplateHtml,
  insertTemplateImage,
  insertTemplateTag,
  setTemplateEditorCellSplitPanelVisibility,
  setTemplateEditorTableInsertPanelVisibility,
} = templateEditorCommandController;

const templateEditorImageController = createTemplateEditorImageController({
  TEMPLATE_EDITOR_IMAGE_MIN_SIZE,
  clearTemplateEditorActiveCell,
  decorateTemplateGeneratedObjectImage,
  getTemplateEditorDocumentElement,
  getTemplateEditorImageOverlayContainer,
  getTemplateEditorModal: () => templateEditorModal,
  getTemplateEditorSurface: () => templateEditorSurface,
  getTemplatePreviewExaminee,
  parseTemplateEditorPixelStyle,
  state,
  syncTemplateEditorContent,
});

({
  clearTemplateEditorImageSelection,
  decorateTemplateEditorImages,
  ensureTemplateEditorImageOverlay,
  getTemplateEditorImageTarget,
  releaseTemplateEditorImageMoveSession,
  releaseTemplateEditorImageResizeSession,
  selectTemplateEditorImage,
  startTemplateEditorImageMoveSession,
  updateTemplateEditorImageSelectionOverlay,
} = templateEditorImageController);

const templateEditorTableController = createTemplateEditorTableController({
  TEMPLATE_EDITOR_DEFAULT_TABLE_HEADER_BACKGROUND,
  TEMPLATE_EDITOR_TABLE_EDGE_THRESHOLD,
  TEMPLATE_EDITOR_TABLE_MIN_SIZE,
  TEMPLATE_EDITOR_TABLE_SELECTION_DRAG_THRESHOLD,
  applyTemplateTableCellPresentation,
  buildTemplateTableCellMap,
  clearTemplateEditorImageSelection,
  ensureTemplateEditorTableColGroup,
  getClosestTemplateEditorElement,
  getTemplateEditorDocumentElement,
  getTemplateEditorSelectionNode,
  getTemplateEditorSurface: () => templateEditorSurface,
  getTemplateEditorModal: () => templateEditorModal,
  getTemplateEditorBorderColorInput: () => templateEditorBorderColor,
  getTemplateEditorBorderStyleInput: () => templateEditorBorderStyle,
  getTemplateEditorBorderTargetInput: () => templateEditorBorderTarget,
  getTemplateEditorBorderWidthInput: () => templateEditorBorderWidth,
  getTemplateEditorCellShadingInput: () => templateEditorCellShading,
  getTemplateEditorCellWidthInput: () => templateEditorCellWidth,
  getTemplateEditorRowHeightInput: () => templateEditorRowHeight,
  getTemplateEditorSizeScopeInput: () => templateEditorSizeScope,
  getTemplateEditorMeasuredColumnWidth,
  getTemplateEditorTableColumnCount,
  normalizeTemplateEditorColorValue: templateNormalizeTemplateEditorColorValue,
  normalizeTemplateEditorTableAppearance,
  parseTemplateEditorPixelStyle,
  placeCaretAtEnd,
  restoreTemplateEditorSelection,
  setTemplateEditorStatus,
  state,
  syncTemplateEditorContent,
  syncTemplateEditorTableWidth,
  updateTemplateEditorActiveCell,
  updateTemplateEditorFormattingControls: (...args) => updateTemplateEditorFormattingControls(...args),
  updateTemplateTableControls: (...args) => updateTemplateTableControls(...args),
});

({
  appendMergedTemplateCellContent,
  applyTemplateTableSize,
  clearTemplateEditorTableHoverState,
  clearTemplateEditorTableSelection,
  createTemplateTableCell,
  focusTemplateEditorCell,
  getTemplateEditorActiveTableSelection,
  getTemplateEditorCellShadingValue,
  getTemplateEditorMedianValue,
  getTemplateEditorPixelValue,
  getTemplateEditorSelectedCell,
  getTemplateEditorSelectedTable,
  getTemplateEditorTableLogicalColumnWidth,
  getTemplateEditorTableLogicalRowHeight,
  handleTemplateEditorTablePointerDown,
  handleTemplateTableAction,
  insertTemplateCellAtAbsoluteColumn,
  isTemplateTableCellEmpty,
  releaseTemplateEditorTableResizeSession,
  releaseTemplateEditorTableSelectionSession,
  setTemplateEditorTableLogicalRowHeight,
  updateTemplateEditorTableHoverState,
} = templateEditorTableController);

const templateEditorToolbarStateController = createTemplateEditorToolbarStateController({
  TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
  TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
  getTemplateEditorActiveTableSelection,
  getTemplateEditorBorderColorElement: () => templateEditorBorderColor,
  getTemplateEditorBorderStyleElement: () => templateEditorBorderStyle,
  getTemplateEditorBorderTargetElement: () => templateEditorBorderTarget,
  getTemplateEditorBorderWidthElement: () => templateEditorBorderWidth,
  getTemplateEditorCellShadingElement: () => templateEditorCellShading,
  getTemplateEditorCellShadingValue,
  getTemplateEditorCellWidthElement: () => templateEditorCellWidth,
  getTemplateEditorFontFamilyElement: () => templateEditorFontFamily,
  getTemplateEditorFontSizeElement: () => templateEditorFontSize,
  getTemplateEditorModal: () => templateEditorModal,
  getTemplateEditorPixelValue,
  getTemplateEditorRowHeightElement: () => templateEditorRowHeight,
  getTemplateEditorSelectedCell,
  getTemplateEditorSelectionNode,
  getTemplateEditorSurface: () => templateEditorSurface,
  getTemplateEditorTextColorElement: () => templateEditorTextColor,
  getTemplateEditorTextShadingElement: () => templateEditorTextShading,
  syncEditorToolbarBorderSelectControl,
  syncEditorToolbarColorControls,
  updateEditorToolbarFormattingState,
});

const { getTemplateEditorFormattingTargetCells } = templateEditorToolbarStateController;
({
  updateTemplateEditorFormattingControls,
  updateTemplateTableControls,
} = templateEditorToolbarStateController);
const templatePagePropertiesController = createTemplatePagePropertiesController({
  getPagePropertiesElement: () => document.getElementById("templatePagePropertiesPanel"),
  getTemplateEditorSurface: () => templateEditorSurface,
  setTemplateEditorStatus,
  syncTemplateEditorContent,
  updateTemplateEditorImageSelectionOverlay: (...args) => updateTemplateEditorImageSelectionOverlay(...args),
});
({
  handleTemplatePageSettingChange,
  syncTemplatePageSettingsFromDocument,
} = templatePagePropertiesController);
const templateEditorLifecycleController = createTemplateEditorLifecycleController({
  EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR:
    typeof EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR === "string" ? EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR : "#152033",
  TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
  TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
  apiRequest,
  buildTemplateTokenHtml,
  clearTemplateEditorImageSelection,
  createTemplateCardEditorState,
  createTemplateEditorState,
  decorateTemplateEditorImages,
  getTemplateCreationSeed,
  getTemplateEditorFontFamilyElement: () => templateEditorFontFamily,
  getTemplateEditorFontSizeElement: () => templateEditorFontSize,
  getTemplateEditorModal: () => templateEditorModal,
  getTemplateEditorSerializedHtml,
  getTemplateEditorSurface: () => templateEditorSurface,
  getTemplateEditorTableColumnsInput: () => templateEditorTableColumns,
  getTemplateEditorTableRowsInput: () => templateEditorTableRows,
  getTemplateEditorTitleElement: () => templateEditorTitle,
  getTemplatePreviewExaminee,
  getTemplatePreviewMetaElement: () => templatePreviewMeta,
  getTemplatePreviewStageElement: () => templatePreviewStage,
  getTemplatePreviewTitleElement: () => templatePreviewTitle,
  initializeTemplateEditorHistory,
  applyTemplatePageSettingsToRenderedSheet,
  openModal: (...args) => (typeof openModal === "function" ? openModal(...args) : undefined),
  placeCaretAtEnd,
  prepareTemplateEditorContent,
  refreshTemplateEditorToolbarElements,
  renderEditorToolbarInner: typeof renderEditorToolbarInner === "function" ? renderEditorToolbarInner : null,
  renderTemplateWithExaminee,
  renderView: (...args) => (typeof renderView === "function" ? renderView(...args) : undefined),
  setTemplateEditorCellSplitPanelVisibility,
  setTemplateEditorStatus,
  setTemplateEditorTableInsertPanelVisibility,
  showToast,
  state,
  syncEditorToolbarFontSizeControls,
  syncTemplatePageSettingsFromDocument,
  syncTemplateEditorContent,
  updateTemplateEditorActiveCell,
  updateTemplateEditorFormattingControls,
  updateTemplateTableControls,
  closeModal: (...args) => (typeof closeModal === "function" ? closeModal(...args) : undefined),
});
const templateEditorTableFormattingController = createTemplateEditorTableFormattingController({
  getTemplateEditorFormattingTargetCells,
  isTemplateTableCellEmpty,
  syncTemplateEditorContent,
});

function addTemplateCard(...args) {
  return templateEditorLifecycleController.addTemplateCard(...args);
}

function applyTemplateCard(...args) {
  return templateEditorLifecycleController.applyTemplateCard(...args);
}

function deleteTemplateCard(...args) {
  return templateEditorLifecycleController.deleteTemplateCard(...args);
}

function copyTemplateCard(...args) {
  return templateEditorLifecycleController.copyTemplateCard(...args);
}

function getDefaultTemplateContent(...args) {
  return templateEditorLifecycleController.getDefaultTemplateContent(...args);
}

function findTemplateCard(...args) {
  return templateEditorLifecycleController.findTemplateCard(...args);
}

function updateTemplateCard(...args) {
  return templateEditorLifecycleController.updateTemplateCard(...args);
}

function renderTemplateEditorToolbar(...args) {
  return templateEditorLifecycleController.renderTemplateEditorToolbar(...args);
}

function openTemplateEditor(...args) {
  return templateEditorLifecycleController.openTemplateEditor(...args);
}

function openTemplatePreview(...args) {
  return templateEditorLifecycleController.openTemplatePreview(...args);
}

function previewTemplateEditorDraft(...args) {
  return templateEditorLifecycleController.previewTemplateEditorDraft(...args);
}

function saveTemplateEditor(...args) {
  return templateEditorLifecycleController.saveTemplateEditor(...args);
}

function applyTemplateEditorTableSelectionCommand(...args) {
  return templateEditorTableFormattingController.applyTemplateEditorTableSelectionCommand(...args);
}

function applyTemplateEditorTableSelectionFontFamily(...args) {
  return templateEditorTableFormattingController.applyTemplateEditorTableSelectionFontFamily(...args);
}

function applyTemplateEditorTableSelectionFontSize(...args) {
  return templateEditorTableFormattingController.applyTemplateEditorTableSelectionFontSize(...args);
}

renderTemplateEditorToolbar();
