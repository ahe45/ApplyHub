const navItems = Array.from(document.querySelectorAll(".nav-item"));
const appDocumentEventsModule = globalThis.AdmitCardAppDocumentEvents;
const navigationEventsModule = globalThis.AdmitCardNavigationEvents;
const loginNoticeEventsModule = globalThis.AdmitCardLoginNoticeEvents;
const gridInteractionModule = globalThis.AdmitCardGridInteraction;

const templateEditorEventsModule = globalThis.AdmitCardTemplateEditorEvents;
const uploadDropzoneBindingsModule = globalThis.AdmitCardUploadDropzoneBindings;
const applicantAdminEventsModule = globalThis.AdmitCardApplicantAdminEvents;
const editorToolbarColorTriggerModule = globalThis.AdmitCardEditorToolbarColorTrigger;

if (!gridInteractionModule?.createGridInteractionController) {
  throw new Error("AdmitCardGridInteraction.createGridInteractionController is required before loading events.js");
}

if (!navigationEventsModule?.createNavigationEventController) {
  throw new Error("AdmitCardNavigationEvents.createNavigationEventController is required before loading events.js");
}

if (!appDocumentEventsModule?.createAppDocumentEventHandlers) {
  throw new Error("AdmitCardAppDocumentEvents.createAppDocumentEventHandlers is required before loading events.js");
}

if (!loginNoticeEventsModule?.createLoginNoticeEventHandlers) {
  throw new Error("AdmitCardLoginNoticeEvents.createLoginNoticeEventHandlers is required before loading events.js");
}

if (!templateEditorEventsModule?.createTemplateEditorEventHandlers) {
  throw new Error("AdmitCardTemplateEditorEvents.createTemplateEditorEventHandlers is required before loading events.js");
}

if (!uploadDropzoneBindingsModule?.createUploadDropzoneBindingsController) {
  throw new Error("AdmitCardUploadDropzoneBindings.createUploadDropzoneBindingsController is required before loading events.js");
}

if (!applicantAdminEventsModule?.createApplicantAdminEventHandlers) {
  throw new Error("AdmitCardApplicantAdminEvents.createApplicantAdminEventHandlers is required before loading events.js");
}

if (!editorToolbarColorTriggerModule?.createEditorToolbarColorTriggerHandler) {
  throw new Error("AdmitCardEditorToolbarColorTrigger.createEditorToolbarColorTriggerHandler is required before loading events.js");
}

const { createGridInteractionController } = gridInteractionModule;
const { createNavigationEventController } = navigationEventsModule;
const { createAppDocumentEventHandlers } = appDocumentEventsModule;
const { createLoginNoticeEventHandlers } = loginNoticeEventsModule;

const { createTemplateEditorEventHandlers } = templateEditorEventsModule;
const { createUploadDropzoneBindingsController } = uploadDropzoneBindingsModule;
const { createApplicantAdminEventHandlers } = applicantAdminEventsModule;
const { createEditorToolbarColorTriggerHandler } = editorToolbarColorTriggerModule;

createNavigationEventController({
  brandHome,
  getDefaultAccessibleView,
  hasPendingSystemSettingsChanges: globalThis.hasPendingSystemSettingsChanges,
  menuToggle,
  navigateToView,
  navItems,
  sidebar,
}).bindNavigationEvents();

const gridInteractionController = createGridInteractionController({
  refreshAdmitCardLookupView,
  renderView,
  state,
});

const {
  handleGridCellTooltipMouseOut,
  handleGridCellTooltipMouseOver,
  handleGridCellTooltipResize,
  handleGridCellTooltipScroll,
  hideGridCellTooltip,
  rerenderGridInteraction,
  rerenderLookupViewInteraction,
} = gridInteractionController;

const uploadDropzoneBindingsController = createUploadDropzoneBindingsController({

  applicantUnitUploadFileInput,
  applicantUnitUploadFileName,

  previewApplicantRecruitmentUnitUploadFile,

  showToast,

});

const applicantAdminEventHandlers = createApplicantAdminEventHandlers({

  activateApplicantFieldCreation,
  activateApplicantRecruitmentUnitCreation,
  addApplicantFieldOption,

  deleteApplicantField,
  deleteApplicantRecruitmentUnit,
  deleteApplicantSubmission,
  document,

  downloadApplicantRecruitmentUnitTemplate,
  downloadApplicantRecruitmentUnits,
  downloadApplicantSubmissionPhotos,
  downloadApplicantSubmissions,
  moveApplicantField,

  openApplicantFieldPreview,

  openModal,

  removeApplicantFieldOption,
  reorderApplicantField,
  resetApplicantFieldEditor,

  saveApplicantFieldEditor,
  saveApplicantRecruitmentUnit,
  saveApplicantSchedule,
  saveApplicantSettings,
  setApplicantManagerTab,

  startApplicantFieldEdit,
  startApplicantRecruitmentUnitEdit,
  startApplicantScheduleBulkEdit,
  toggleApplicantSubmissionDetail,

  updateApplicantFieldEditorField,

  updateApplicantRecruitmentUnitEditorField,
  updateApplicantRecruitmentUnitUploadExistingDataPolicy,
  updateApplicantScheduleEditorField,
  updateApplicantSettingsField,

  uploadApplicantRecruitmentUnitFile,
  uploadApplicantSubmissionPhoto,
});

const applyEditorToolbarColorTrigger = createEditorToolbarColorTriggerHandler({
  applyLoginNoticeEditorCommand,
  applyTemplateEditorCommand,
  getEditorToolbarColorFallback,
  handleLoginNoticeTableAction,
  handleTemplateTableAction,
  syncEditorToolbarColorControls,
});

const loginNoticeEventHandlers = createLoginNoticeEventHandlers({
  applyLoginNoticeEditorCommand,
  captureLoginNoticeEditorSelection,
  clearLoginNoticeSelectedImage,
  getLoginNoticeCellSplitConfig,
  getLoginNoticeCellSplitCountInputElement: () => document.getElementById("loginNoticeCellSplitCount"),
  getLoginNoticeCellSplitPanelElement: () => document.getElementById("loginNoticeCellSplitPanel"),
  getLoginNoticeEditorElement,
  getLoginNoticeImageInputElement,
  handleLoginNoticeAction,
  handleLoginNoticeInsert,
  handleLoginNoticeTableAction,
  insertLoginNoticeImage,
  redoLoginNoticeEditorHistory,
  renderView,
  selectLoginNoticeImage,
  setNoticeManagementScope,
  setLoginNoticeCellSplitPanelVisibility,
  setLoginNoticeTableInsertPanelVisibility,
  state,
  syncEditorToolbarFontSizeMenuSelection,
  syncLoginNoticeEditorDraft,
  undoLoginNoticeEditorHistory,
  updateLoginNoticeEditorActiveCell,
  updateLoginNoticeFormattingControls,
});

const templateEditorEventHandlers = createTemplateEditorEventHandlers({
  addTemplateCard,
  applyEditorToolbarBorderSelectOption,
  applyTemplateCard,
  applyTemplateEditorCommand,
  applyTemplateEditorFontFamily,
  applyTemplateEditorFontSize,
  applyTemplateTableSize,
  clearTemplateEditorImageSelection,
  clearTemplateEditorTableHoverState,
  clearTemplateEditorTableSelection,
  closeTemplateCardMetaEditor,
  deleteTemplateCard,
  getTemplateEditorCellSplitConfig: () => getTemplateEditorCellSplitConfig(),
  getTemplateEditorCellSplitCountInput: () => templateEditorCellSplitCount,
  getTemplateEditorCellSplitPanel: () => templateEditorCellSplitPanel,
  getTemplateEditorImageInput: () => templateEditorImageInput,
  getTemplateEditorImageTarget,
  getTemplateEditorModal: () => templateEditorModal,
  getTemplateEditorSurface: () => templateEditorSurface,
  getTemplateEditorTableInsertPanel: () => templateEditorTableInsertPanel,
  getEditorToolbarBorderSelectElements,
  handleTemplateEditorInsert,
  handleTemplateEditorTablePointerDown,
  handleTemplateEditorTokenDeletion,
  handleTemplatePageSettingChange,
  handleTemplateTableAction,
  insertTemplateImage,
  insertTemplateTag,
  openTemplateCardMetaEditor,
  openTemplateEditor,
  openTemplatePreview,
  printTemplatePreview,
  redoTemplateEditorHistory,
  saveTemplateCardMetaEditor,
  saveTemplateEditor,
  saveTemplateEditorSelection,
  selectTemplateEditorImage,
  setEditorToolbarBorderSelectMenuVisibility,
  setEditorToolbarFontSizeMenuVisibility,
  setTemplateEditorCellSplitPanelVisibility,
  setTemplateEditorTableInsertPanelVisibility,
  startTemplateEditorImageMoveSession,
  state,
  syncEditorToolbarFontSizeMenuSelection,
  syncTemplateEditorContent,
  undoTemplateEditorHistory,
  updateTemplateCardMetaEditorDraft,
  updateTemplateEditorActiveCell,
  updateTemplateEditorFormattingControls,
  updateTemplateEditorImageSelectionOverlay,
  updateTemplateEditorTableHoverState,
  updateTemplateTableControls,
});

const appDocumentEventHandlers = createAppDocumentEventHandlers({
  applyEditorToolbarBorderSelectOption,
  applyEditorToolbarColorTrigger,
  applyLoginNoticeEditorCommand,
  batchPrintSelectedExaminees,
  cancelBatchPrintJob,
  cancelAccountEdit,
  changeSystemAutoLogoutMinutes,
  clearSystemBackupRestoreFileSelection,
  clearAllGridFilters,
  clearGridFilter,
  clearHeaderFilters,
  clampPage,
  closeAllEditorToolbarBorderSelectMenus,
  closeAllEditorToolbarColorPanels,
  closeAllEditorToolbarFontSizeMenus,
  closeAllEditorToolbarTableInsertPanels,
  closeAllGridFilterMenus,
  closeAllHeaderCombos,
  closeAllPageSizeMenus,
  closeGridFilterMenu,
  closePasswordSetupPrompt,
  confirmSystemSettingsNavigation,
  createLookupFilters,
  deleteAccountAction,
  deleteSystemDataAction,
  downloadSystemBackupAction,
  loadSystemAuditLogs,
  runSystemBackupAutomationNow,

  downloadPrintHistoryGridWorkbook,

  filterGridFilterOptionValues,
  getEditorToolbarBorderSelectElements,
  getEditorToolbarColorPickerElements,
  getGridFilterOptionValues,
  getGridFilterSelectionState,
  getGridPage,
  getGridRows,
  getHeaderComboElement,
  getSidebar: () => sidebar,
  getTableState,
  getTotalPages,
  headerFilterFields,
  hasUnsavedSystemSettingsChanges,
  hideGridCellTooltip,
  handleGridRowClickSelection,
  handleSelectableGridRowSelection,
  isBusyOverlayActive,
  loadBootstrapData,
  loginNoticeEventHandlers,
  logoutCurrentUser,
  lookupSelectFields,
  lookupTextFields,
  openModal,
  prepareBatchPrintDownloadModal,
  applySuperAdminImageFile,
  persistHeaderFilters,
  printExamineeAdmitCard,
  recordAutoLogoutActivity,
  refreshAdmitCardLookupGrid,
  refreshGridFilterMenu,
  reconcileHeaderFilters,
  reconcileLookupFilters,
  removeGridFilterValue,
  renderView,
  requestCloseAllModals,
  requestCloseModal,
  rerenderGridInteraction,
  rerenderLookupViewInteraction,
  importSystemBackupAction,
  resetAccountPasswordAction,
  resetGridPages,
  saveAccountEdit,
  saveSuperAdminSettings,
  saveSystemBackupAutomationSettings,
  saveSystemSettings,
  setAccountCreateError,

  setEditorToolbarBorderSelectMenuVisibility,
  setEditorToolbarColorPanelVisibility,
  setEditorToolbarFontSizeMenuVisibility,
  setGridFilterValues,
  setHeaderComboOpen,
  setSystemSettingsStatus,
  startAccountEdit,
  state,
  submitAccountCreate,
  submitBatchPrintDownloadSelection,
  submitLogin,
  submitPasswordSetup,
  syncSystemSettingsDirtyState,
  syncLoginErrorMessage,
  syncPasswordSetupModal,
  toggleSystemBackupAutomationItemSelection,
  toggleSystemBackupAssetSelection,
  toggleSystemBackupRestoreSelection,
  templateEditorEventHandlers,
  toggleGridFilterMenu,
  toggleGridFilterValue,
  toggleGridRowSelection,
  toggleGridSelectAll,
  toggleGridSort,
  updateAccountEditorField,
  updateBatchPrintOutputMode,
  updateSystemBackupAutomationField,
  updateSuperAdminField,
  updateSuperAdminImageField,
  updateLookupTextFilter,

  selectSystemBackupRestoreFile,
});

const {
  handleChange: handleAppDocumentChange,
  handleClick: handleAppDocumentClick,
  handleCompositionEnd: handleAppDocumentCompositionEnd,
  handleCompositionStart: handleAppDocumentCompositionStart,
  handleInput: handleAppDocumentInput,
  handleKeydown: handleAppDocumentKeydown,
  handleSubmit: handleAppDocumentSubmit,
} = appDocumentEventHandlers;

document.addEventListener("click", async (event) => {
  if (applicantAdminEventHandlers.handleClick(event)) {
    return;
  }

  await handleAppDocumentClick(event);
});

document.addEventListener("keydown", async (event) => {
  if (applicantAdminEventHandlers.handleKeydown(event)) {
    return;
  }

  await handleAppDocumentKeydown(event);
});

document.addEventListener("submit", async (event) => {
  if (await applicantAdminEventHandlers.handleSubmit(event)) {
    return;
  }

  await handleAppDocumentSubmit(event);
});

document.addEventListener("pointerdown", (event) => {
  const target = event.target instanceof Element ? event.target : null;

  if (isBusyOverlayActive() && !target?.closest("[data-cancel-batch-print]")) {
    event.preventDefault();
    return;
  }

  hideGridCellTooltip();
  recordAutoLogoutActivity();
  if (loginNoticeEventHandlers.handlePointerDown(event)) {
    return;
  }
});

document.addEventListener("pointerdown", (event) => {
  hideGridCellTooltip();
  templateEditorEventHandlers.handlePointerDown(event);
});

document.addEventListener("dragstart", (event) => {
  if (templateEditorEventHandlers.handleDragStart(event)) {
    return;
  }

  applicantAdminEventHandlers.handleDragStart(event);
});

document.addEventListener("mouseover", (event) => {
  handleGridCellTooltipMouseOver(event);
});

document.addEventListener("mouseout", (event) => {
  handleGridCellTooltipMouseOut(event);
});

if (templateEditorSurface) {
  templateEditorSurface.addEventListener("pointermove", (event) => {
    templateEditorEventHandlers.handleSurfacePointerMove(event);
  });

  templateEditorSurface.addEventListener("pointerleave", () => {
    templateEditorEventHandlers.handleSurfacePointerLeave();
  });

  templateEditorSurface.addEventListener("scroll", () => {
    templateEditorEventHandlers.handleSurfaceScroll();
  });
}

window.addEventListener("resize", () => {
  handleGridCellTooltipResize();
  updateTemplateEditorImageSelectionOverlay();
  syncOpenGridFilterMenuPosition?.();
});

document.addEventListener("scroll", () => {
  handleGridCellTooltipScroll();
  syncOpenGridFilterMenuPosition?.();
}, true);

document.addEventListener("dragover", (event) => {
  applicantAdminEventHandlers.handleDragOver(event);
});

document.addEventListener("drop", (event) => {
  applicantAdminEventHandlers.handleDrop(event);
});

document.addEventListener("dragend", () => {
  applicantAdminEventHandlers.handleDragEnd();
});

uploadDropzoneBindingsController.bindUploadDropzoneEvents();

document.addEventListener("change", async (event) => {
  const examineePolicyTarget = event.target instanceof HTMLInputElement ? event.target : null;

  if (await applicantAdminEventHandlers.handleChange(event)) {
    return;
  }

  if (applicantAdminEventHandlers.syncInputValue(event)) {
    return;
  }

  await handleAppDocumentChange(event);
});

document.addEventListener("compositionstart", (event) => {
  handleAppDocumentCompositionStart(event);
});

document.addEventListener("compositionend", (event) => {
  handleAppDocumentCompositionEnd(event);
});

document.addEventListener("input", (event) => {
  if (applicantAdminEventHandlers.syncInputValue(event)) {
    return;
  }

  handleAppDocumentInput(event);
});

document.addEventListener("selectionchange", () => {
  loginNoticeEventHandlers.handleSelectionChange();
  templateEditorEventHandlers.handleSelectionChange();
});

document.addEventListener("paste", (event) => {
  if (loginNoticeEventHandlers.handlePaste(event)) {
    return;
  }

  templateEditorEventHandlers.handlePaste(event);
});

document.addEventListener("touchstart", () => {
  recordAutoLogoutActivity();
}, { passive: true });

globalThis.createApplicantArchiveDownloadController({ buildApiUrl, getGridRows, requestCloseModal });

loadAuthSession();

