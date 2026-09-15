const renderersContentSharedModule = globalThis.AdmitCardEditorContentShared;
const renderersTableUtilsModule = globalThis.AdmitCardEditorTableUtils;
const renderersGeneratedObjectModule = globalThis.AdmitCardTemplateGeneratedObjects;
const authRenderers = globalThis.AdmitCardAuthRenderers;
const loginNoticeEditorModule = globalThis.AdmitCardLoginNoticeEditor;
const systemRenderers = globalThis.AdmitCardSystemRenderers;
const accountRenderers = globalThis.AdmitCardAccountRenderers;
const accountActionsModule = globalThis.AdmitCardAccountActions;
const htmlUtilsModule = globalThis.AdmitCardHtmlUtils;
const gridRuntimeModule = globalThis.AdmitCardGridRuntime;
const modalControllerModule = globalThis.AdmitCardModalController;
const viewShellModule = globalThis.AdmitCardViewShell;
const renderersExamineePhotoUtilsModule = globalThis.AdmitCardExamineePhotoUtils;

const examineePageRenderers = globalThis.AdmitCardExamineePageRenderers;
const applicantAdminModule = globalThis.AdmitCardApplicantAdmin;
const printHistoryRenderers = globalThis.AdmitCardPrintHistoryRenderers;
const templateManagementRenderers = globalThis.AdmitCardTemplateManagementRenderers;
const dashboardRenderers = globalThis.AdmitCardDashboardRenderers;
const applicantFormConfigModule = globalThis.AdmitCardApplicantFormConfig;

if (!renderersContentSharedModule) {
  throw new Error("client/features/editor/content-shared.js must be loaded before client/renderers.js.");
}

if (!renderersGeneratedObjectModule) {
  throw new Error("client/features/template-editor/generated-objects.js must be loaded before client/renderers.js.");
}

if (!renderersTableUtilsModule) {
  throw new Error("client/features/editor/table-utils.js must be loaded before client/renderers.js.");
}

if (!authRenderers) {
  throw new Error("client/features/auth/renderers.js must be loaded before client/renderers.js.");
}

if (!loginNoticeEditorModule) {
  throw new Error("client/features/system/login-notice-editor.js must be loaded before client/renderers.js.");
}

if (!systemRenderers) {
  throw new Error("client/features/system/renderers.js must be loaded before client/renderers.js.");
}

if (!accountRenderers) {
  throw new Error("client/features/accounts/renderers.js must be loaded before client/renderers.js.");
}

if (!accountActionsModule?.createAccountActionController) {
  throw new Error("client/features/accounts/actions.js must be loaded before client/renderers.js.");
}

if (!htmlUtilsModule) {
  throw new Error("client/app/html-utils.js must be loaded before client/renderers.js.");
}

if (!gridRuntimeModule?.createGridRuntimeController) {
  throw new Error("client/features/grids/runtime.js must be loaded before client/renderers.js.");
}

if (!modalControllerModule?.createModalController) {
  throw new Error("client/features/modals/controller.js must be loaded before client/renderers.js.");
}

if (!viewShellModule?.createViewShellController) {
  throw new Error("client/app/view-shell.js must be loaded before client/renderers.js.");
}

if (!renderersExamineePhotoUtilsModule) {
  throw new Error("client/features/admit-cards/photo-utils.js must be loaded before client/renderers.js.");
}

if (!examineePageRenderers) {
  throw new Error("client/features/admit-cards/renderers.js must be loaded before client/renderers.js.");
}

if (!applicantAdminModule?.createApplicantAdminController) {
  throw new Error("client/features/applications/admin.js must be loaded before client/renderers.js.");
}

if (!printHistoryRenderers) {
  throw new Error("client/features/print-history/renderers.js must be loaded before client/renderers.js.");
}

if (!templateManagementRenderers) {
  throw new Error("client/features/templates/renderers.js must be loaded before client/renderers.js.");
}

if (!dashboardRenderers?.createDashboardRenderer) {
  throw new Error("client/features/dashboard/renderers.js must be loaded before client/renderers.js.");
}

const {
  TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY: renderersDefaultFontFamily,
  TEMPLATE_EDITOR_DEFAULT_FONT_SIZE: renderersDefaultFontSize,
  TEMPLATE_EDITOR_DEFAULT_TABLE_HEADER_BACKGROUND: renderersDefaultTableHeaderBackground,
  buildTemplateEditorTableMarkup: renderersBuildTemplateEditorTableMarkup,
  normalizeTemplateEditorColorValue: renderersNormalizeTemplateEditorColorValue,
  normalizeTemplateEditorFontNodes: renderersNormalizeTemplateEditorFontNodes,
} = renderersContentSharedModule;

const {
  buildTemplateTableCellMap: renderersBuildTemplateTableCellMap,
  ensureTemplateEditorTableColGroup: renderersEnsureTemplateEditorTableColGroup,
  normalizeTemplateEditorTableAppearance: renderersNormalizeTemplateEditorTableAppearance,
  normalizeTemplateEditorTables: renderersNormalizeTemplateEditorTables,
  syncTemplateEditorTableWidth: renderersSyncTemplateEditorTableWidth,
} = renderersTableUtilsModule;

const {
  buildTemplateGeneratedObjectMarkup: renderersBuildTemplateGeneratedObjectMarkup,
  decorateTemplateGeneratedObjectImage: renderersDecorateTemplateGeneratedObjectImage,
} = renderersGeneratedObjectModule;

const { getLoginNoticeMarkup, renderLoginScreen } = authRenderers;
const {
  renderLoginNoticeEditorToolbar,
  renderLoginNoticeSettings,
  renderSystemAuditLogModalContent,
  renderSystemAuditLog,
  renderSuperAdminManagement,
  renderSystemBackupRestore,
  renderSystemSettings,
  renderSystemDataDeletion,
} = systemRenderers;
const { renderAccountManagement, renderAccountRoleOptions } = accountRenderers;
const { createAccountActionController } = accountActionsModule;
const {
  escapeAttribute: renderersEscapeAttribute,
  escapeHtml: renderersEscapeHtml,
  escapeRegExp,
} = htmlUtilsModule;
const { createGridRuntimeController } = gridRuntimeModule;
const { createModalController } = modalControllerModule;
const { createViewShellController } = viewShellModule;
const { renderAdmitCardLookup, renderAdmitCardLookupGridSection, } = examineePageRenderers;
const { createApplicantAdminController } = applicantAdminModule;
const { renderPrintHistory } = printHistoryRenderers;
const {

  renderApplicantHistory,
  renderApplicantHistoryDetailModalContent,
  renderApplicantQuestionTemplateManagement,
  renderApplicantRecruitmentManagement,
  renderApplicantScheduleManagement,
  renderTemplateManagement,
} = templateManagementRenderers;
const { createDashboardRenderer } = dashboardRenderers;
const { buildExamineePhotoUrl: renderersBuildExamineePhotoUrl } = renderersExamineePhotoUtilsModule;
const isApplicantScheduleOpen =
  applicantFormConfigModule?.isApplicantScheduleOpen ||
  ((options = {}) => {
    const normalizedOptions = options && typeof options === "object" ? options : {};
    return normalizedOptions.scheduleState?.isOpen === true;
  });

const getApplicantStatusLabel = (status, options = {}) => {
  const applicantStatusOptions = options && typeof options === "object" ? options : {};

  if (applicantFormConfigModule?.getApplicantStatusLabel) {
    return applicantFormConfigModule.getApplicantStatusLabel(status, applicantStatusOptions);
  }

  const isScheduleOpen = isApplicantScheduleOpen(applicantStatusOptions);
  return String(status || "").trim() === "promoted" ? "접수 완료" : isScheduleOpen ? "접수 중" : "접수 완료";
};

const applicantHistoryGridColumns = Object.freeze([
  Object.freeze({ key: "track", label: "모집시기", sortable: true, filterable: true }),
  Object.freeze({ key: "admission", label: "전형", sortable: true, filterable: true }),
  Object.freeze({ key: "series", label: "계열", sortable: true, filterable: true }),
  Object.freeze({ key: "unit", label: "모집단위", sortable: true, filterable: true }),
  Object.freeze({ key: "major", label: "전공", sortable: true, filterable: true }),
  Object.freeze({ key: "examineeNo", label: "수험번호", sortable: true, filterable: true }),
  Object.freeze({ key: "name", label: "이름", sortable: true, filterable: true }),
  Object.freeze({ key: "birth", label: "생년월일", sortable: true, filterable: true }),
  Object.freeze({ key: "id", label: "접수번호", sortable: true, filterable: true }),
  Object.freeze({ key: "statusLabel", label: "상태", sortable: true, filterable: true }),
  Object.freeze({ key: "detailAction", label: "답변", sortable: false, filterable: false }),
  Object.freeze({ key: "deleteAction", label: "삭제", sortable: false, filterable: false }),
]);

const applicantRecruitmentGridColumns = Object.freeze([
  Object.freeze({ key: "trackName", label: "모집시기", sortable: true, filterable: true }),
  Object.freeze({ key: "admissionCode", label: "전형코드", sortable: true, filterable: true }),
  Object.freeze({ key: "admissionName", label: "전형", sortable: true, filterable: true }),
  Object.freeze({ key: "seriesCode", label: "계열코드", sortable: true, filterable: true }),
  Object.freeze({ key: "seriesName", label: "계열", sortable: true, filterable: true }),
  Object.freeze({ key: "unitCode", label: "모집단위코드", sortable: true, filterable: true }),
  Object.freeze({ key: "unitName", label: "모집단위", sortable: true, filterable: true }),
  Object.freeze({ key: "majorCode", label: "전공코드", sortable: true, filterable: true }),
  Object.freeze({ key: "majorName", label: "전공", sortable: true, filterable: true }),
]);

const applicantScheduleGridColumns = Object.freeze([
  Object.freeze({ key: "trackName", label: "모집시기", sortable: true, filterable: true }),
  Object.freeze({ key: "admissionName", label: "전형", sortable: true, filterable: true }),
  Object.freeze({ key: "applicantScheduleStartAtLabel", label: "접수 시작", sortable: true, filterable: true }),
  Object.freeze({ key: "applicantScheduleEndAtLabel", label: "접수 종료", sortable: true, filterable: true }),
  Object.freeze({ key: "documentSubmissionScheduleStartAtLabel", label: "서류 제출 시작", sortable: true, filterable: true }),
  Object.freeze({ key: "documentSubmissionScheduleEndAtLabel", label: "서류 제출 종료", sortable: true, filterable: true }),
  Object.freeze({ key: "admitCardLookupScheduleStartAtLabel", label: "수험표 조회 시작", sortable: true, filterable: true }),
  Object.freeze({ key: "admitCardLookupScheduleEndAtLabel", label: "수험표 조회 종료", sortable: true, filterable: true }),
]);

let viewShellController = null;
const renderView = (...args) => viewShellController?.renderView(...args);
const refreshAdmitCardLookupView = (...args) => viewShellController?.refreshAdmitCardLookupView(...args);
const refreshAdmitCardLookupGrid = (...args) => viewShellController?.refreshAdmitCardLookupGrid(...args);

const loginNoticeEditorController = loginNoticeEditorModule.createLoginNoticeEditorController({
  LOGIN_NOTICE_EDITOR_HISTORY_LIMIT,
  TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY: renderersDefaultFontFamily,
  TEMPLATE_EDITOR_DEFAULT_FONT_SIZE: renderersDefaultFontSize,
  TEMPLATE_EDITOR_DEFAULT_TABLE_HEADER_BACKGROUND: renderersDefaultTableHeaderBackground,
  apiRequest,
  appendMergedTemplateCellContent,
  applyLoginNoticePayload,
  applySharedEditorCommand,
  buildTemplateEditorTableMarkup: renderersBuildTemplateEditorTableMarkup,
  buildTemplateGeneratedObjectMarkup: renderersBuildTemplateGeneratedObjectMarkup,
  buildTemplateTableCellMap: renderersBuildTemplateTableCellMap,
  createTemplateTableCell,
  decorateTemplateGeneratedObjectImage: renderersDecorateTemplateGeneratedObjectImage,
  defaultTextColor: typeof EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR === "string" ? EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR : "#152033",
  ensureTemplateEditorTableColGroup: renderersEnsureTemplateEditorTableColGroup,
  escapeAttribute: renderersEscapeAttribute,
  getLoginNoticeMarkup,
  getTemplateEditorMedianValue,
  getTemplateEditorTableLogicalColumnWidth,
  getTemplateEditorTableLogicalRowHeight,
  getTemplatePreviewExaminee: typeof getTemplatePreviewExaminee === "function" ? getTemplatePreviewExaminee : null,
  handleAuthenticationFailure,
  insertTemplateCellAtAbsoluteColumn,
  isTemplateTableCellEmpty,
  normalizeTemplateEditorColorValue: renderersNormalizeTemplateEditorColorValue,
  normalizeTemplateEditorFontNodes: renderersNormalizeTemplateEditorFontNodes,
  normalizeTemplateEditorTables: renderersNormalizeTemplateEditorTables,
  normalizeTemplateEditorTableAppearance: renderersNormalizeTemplateEditorTableAppearance,
  renderView,
  setEditorToolbarTableInsertPanelVisibility,
  setTemplateEditorTableLogicalRowHeight,
  showToast,
  state,
  stripTemplateEditorTransientState,
  syncEditorToolbarColorControls,
  syncTemplateEditorTableWidth: renderersSyncTemplateEditorTableWidth,
  updateEditorToolbarFormattingState,
});

const {
  applyLoginNoticeEditorCommand,
  buildLoginNoticeEditorMarkup,
  captureLoginNoticeEditorSelection,
  clearLoginNoticeSelectedImage,
  getLoginNoticeCellSplitConfig,
  getLoginNoticeDefaultFontFamily,
  getLoginNoticeDefaultFontSize,
  getLoginNoticeEditorElement,
  getLoginNoticeImageInputElement,
  getLoginNoticeSelectedImage,
  handleLoginNoticeAction,
  handleLoginNoticeInsert,
  handleLoginNoticeTableAction,
  insertLoginNoticeImage,
  redoLoginNoticeEditorHistory,
  restoreLoginNoticeEditorSelection,
  saveLoginNoticeContent,
  selectLoginNoticeImage,
  setLoginNoticeCellSplitPanelVisibility,
  setLoginNoticeTableInsertPanelVisibility,
  syncLoginNoticeEditorDraft,
  undoLoginNoticeEditorHistory,
  updateLoginNoticeEditorActiveCell,
  updateLoginNoticeFormattingControls,
} = loginNoticeEditorController;

const accountActionController = createAccountActionController({
  apiRequest,
  createAccountEditorState,
  getAccountGridRows,
  getSystemInitialPassword,
  handleAuthenticationFailure,
  logoutCurrentUser,
  normalizeAccountRecord,
  renderView,
  setAccountGridRows,
  state,
});

const {
  cancelAccountEdit,
  deleteAccountAction,
  resetAccountPasswordAction,
  saveAccountEdit,
  startAccountEdit,
  updateAccountEditorField,
} = accountActionController;
const applicantAdminController = createApplicantAdminController({
  arrayBufferToBase64,
  apiRequest,
  buildApiUrl,

  getApplicantUnitUploadFileInput: () => applicantUnitUploadFileInput,
  getApplicantUnitUploadFileName: () => applicantUnitUploadFileName,
  getApplicantUnitUploadPreviewMount: () => applicantUnitUploadPreviewMount,
  handleAuthenticationFailure,
  loadBootstrapData,
  openModal: (...args) => modalController?.openModal(...args),
  readFileAsArrayBuffer,
  renderView,
  requestCloseModal: (...args) => modalController?.requestCloseModal(...args),
  showToast,
  state,
});
const {

  activateApplicantRecruitmentUnitCreation,
  activateApplicantFieldCreation,
  addApplicantFieldOption,

  clearApplicantRecruitmentUnitUploadFiles,

  deleteApplicantSubmission,
  deleteApplicantRecruitmentUnit,
  deleteApplicantField,

  downloadApplicantSubmissionPhotos,
  downloadApplicantSubmissions,
  downloadApplicantRecruitmentUnits,
  downloadApplicantRecruitmentUnitTemplate,
  moveApplicantField,

  openApplicantFieldPreview,

  previewApplicantRecruitmentUnitUploadFile,

  reorderApplicantField,

  resetApplicantScheduleEditor,
  resetApplicantRecruitmentUnitEditor,
  resetApplicantFieldEditor,
  resetApplicantSubmissionDetail,
  removeApplicantFieldOption,

  saveApplicantSchedule,
  saveApplicantRecruitmentUnit,
  saveApplicantFieldEditor,
  saveApplicantSettings,
  setApplicantSettingsSection,
  setApplicantManagerTab,

  startApplicantRecruitmentUnitEdit,
  startApplicantScheduleBulkEdit,
  startApplicantScheduleEdit,
  startApplicantFieldEdit,
  toggleApplicantSubmissionDetail,

  uploadApplicantRecruitmentUnitFile,
  uploadApplicantSubmissionPhoto,

  updateApplicantScheduleEditorField,
  updateApplicantRecruitmentUnitUploadExistingDataPolicy,
  updateApplicantRecruitmentUnitEditorField,
  updateApplicantFieldEditorField,
  updateApplicantSettingsField,
} = applicantAdminController;
let modalController = null;

function syncApplicantSubmissionDetailModal() {
  if (!applicantSubmissionDetailBody) {
    return;
  }

  const submissions = Array.isArray(state.applicantManager?.submissions) ? state.applicantManager.submissions : [];
  const expandedSubmissionId = Number(state.applicantManager?.expandedSubmissionId || 0);
  const selectedSubmission =
    expandedSubmissionId > 0 ? submissions.find((submission) => Number(submission?.id || 0) === expandedSubmissionId) || null : null;
  const selectedSubmissionForModal = selectedSubmission
    ? {
        ...selectedSubmission,
        answerItems: (Array.isArray(selectedSubmission.answerItems) ? selectedSubmission.answerItems : []).map((answerItem) => {
          if (String(answerItem?.inputType || "").trim() !== "file") {
            return answerItem;
          }

          const fieldKey = String(answerItem?.fieldKey || "").trim();
          const fileValue = answerItem?.value && typeof answerItem.value === "object" ? answerItem.value : {};

          return {
            ...answerItem,
            value: {
              ...fileValue,
              fileUrl:
                fileValue.hasFile === true && fieldKey
                  ? buildApiUrl(
                      `/api/applicant-submissions/${encodeURIComponent(selectedSubmission.id)}/files/${encodeURIComponent(fieldKey)}?v=${encodeURIComponent(selectedSubmission.updatedAt || "")}`,
                    )
                  : "",
            },
          };
        }),
        photoUrl:
          selectedSubmission.hasPhoto === true ||
          Number(selectedSubmission.hasPhoto) === 1 ||
          String(selectedSubmission.photoFileName || "").trim() !== ""
            ? buildApiUrl(
                `/api/applicant-submissions/${encodeURIComponent(selectedSubmission.id)}/photo?v=${encodeURIComponent(selectedSubmission.updatedAt || "")}`,
              )
            : "",
      }
    : null;
  const submissionDetailMetaText = selectedSubmission
    ? `접수일시 ${selectedSubmission.createdAt || "-"} / 최종수정 ${selectedSubmission.updatedAt || "-"}`
    : "";

  if (applicantSubmissionDetailMeta) {
    applicantSubmissionDetailMeta.textContent = submissionDetailMetaText;
    applicantSubmissionDetailMeta.title = submissionDetailMetaText;
  }

  applicantSubmissionDetailBody.innerHTML = renderApplicantHistoryDetailModalContent(selectedSubmissionForModal);

  if (applicantSubmissionDetailModal && !selectedSubmission) {
    applicantSubmissionDetailModal.classList.add("hidden");
    applicantSubmissionDetailModal.setAttribute("aria-hidden", "true");
  }
}

function syncSystemAuditLogModal() {
  if (!systemAuditLogModalBody) {
    return;
  }

  systemAuditLogModalBody.innerHTML = renderSystemAuditLogModalContent();

  if (systemAuditLogModal && state.auth.status !== "authenticated") {
    systemAuditLogModal.classList.add("hidden");
    systemAuditLogModal.setAttribute("aria-hidden", "true");
  }
}

modalController = createModalController({
  TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY: renderersDefaultFontFamily,
  TEMPLATE_EDITOR_DEFAULT_FONT_SIZE: renderersDefaultFontSize,

  clearApplicantRecruitmentUnitUploadFiles,

  clearTemplateEditorActiveCell,
  clearTemplateEditorImageSelection,
  clearTemplateEditorTableHoverState,
  clearTemplateEditorTableSelection,

  createTemplateEditorState,
  createTemplatePreviewState,
  getAccountCreateModal: () => accountCreateModal,

  getApplicantScheduleModal: () => applicantScheduleModal,
  getApplicantSubmissionDownloadModal: () => applicantSubmissionDownloadModal,
  getApplicantSubmissionDetailModal: () => applicantSubmissionDetailModal,
  getApplicantRecruitmentUnitModal: () => applicantRecruitmentUnitModal,
  getApplicantUnitUploadModal: () => applicantUnitUploadModal,
  getBatchPrintDownloadModal: () => batchPrintDownloadModal,
  getSystemAuditLogModal: () => systemAuditLogModal,

  getTemplateEditorDescription: () => templateEditorDescription,
  getTemplateEditorFontFamily: () => templateEditorFontFamily,
  getTemplateEditorFontSize: () => templateEditorFontSize,
  getTemplateEditorModal: () => templateEditorModal,
  getTemplateEditorName: () => templateEditorName,
  getTemplateEditorTableColumns: () => templateEditorTableColumns,
  getTemplateEditorTableRows: () => templateEditorTableRows,
  getTemplatePreviewModal: () => templatePreviewModal,
  getTemplatePreviewStage: () => templatePreviewStage,

  prepareAccountCreateModal,

  releaseTemplateEditorTableResizeSession,
  releaseTemplateEditorTableSelectionSession,
  resetAccountCreateFormState,
  resetApplicantScheduleEditor,
  resetApplicantRecruitmentUnitEditor,
  resetApplicantSubmissionDetail,

  setTemplateEditorTableInsertPanelVisibility,
  state,
  syncEditorToolbarFontSizeControls,
});
const gridRuntimeController = createGridRuntimeController({

  applicantHistoryGridColumns,
  applicantRecruitmentGridColumns,
  applicantScheduleGridColumns,
  accountGridColumns,
  admitCardLookupGridColumns,
  createTableState,
  escapeAttribute: renderersEscapeAttribute,
  escapeHtml: renderersEscapeHtml,

  getApplicantStatusLabel,
  getAccountGridRows,
  getExamineeGridRows,
  getPrintHistoryRows,
  getSelectedAdmitCardExamineeCount,
  headerFilterFields,
  lookupSelectKeys,
  normalizeGridSortRules,

  printHistoryGridColumns,
  renderAccountRoleOptions,
  renderView,

  startApplicantRecruitmentUnitEdit,
  startApplicantScheduleEdit,
  state,
});
const {
  buildOptionMarkup,
  clampPage,
  clearAllGridFilters,
  clearGridFilter,
  closeAllHeaderCombos,
  closeAllGridFilterMenus,
  closeAllPageSizeMenus,
  closeGridFilterMenu,
  decorateSelectFields,
  filterGridFilterOptionValues,
  getActiveGridFilters,
  getActiveGridSortRules,
  getFilteredLookupRows,
  getGridColumns,
  getGridFilterOptionValues,
  getGridFilterSelectionState,
  getGridPage,
  getGridRowId,
  getGridRows,
  getGridSelectableRowIds,
  getGridSelectedRowIds,
  getGridSelectionState,
  getHeaderComboElement,
  getHeaderFilteredRows,
  getLookupOptionMap,
  getTableState,
  getTotalPages,
  getVisiblePageNumbers,
  handleGridRowClickSelection,
  handleSelectableGridRowSelection,
  hasGridFilter,
  isGridRowClickable,
  isGridRowHighlighted,
  isGridRowSelected,
  reconcileHeaderFilters,
  reconcileLookupFilters,
  refreshGridFilterMenu,
  removeGridFilterValue,
  renderBatchPrintButton,
  renderExamineeResultTable,
  renderGridHeaderActions,

  rerenderWithFocus,
  setGridFilterValues,
  setHeaderComboOpen,
  syncGridSelectionIndicators,
  syncHeaderSelectOptions,
  syncOpenGridFilterMenuPosition,
  toggleGridFilterMenu,
  toggleGridFilterValue,
  toggleGridRowSelection,
  toggleGridSelectAll,
  toggleGridSort,
  updateLookupTextFilter,
} = gridRuntimeController;
const dashboardRendererController = createDashboardRenderer({
  escapeHtml: renderersEscapeHtml,
  isViewAccessible: (...args) => isViewAccessible(...args),
  state,
});
const { renderDashboard } = dashboardRendererController;
const renderers = {
  dashboard: renderDashboard,
  applicantHistory: renderApplicantHistory,
  applicantMembers: () => globalThis.AdmitCardMemberList.render(() => renderView(), state.auth.currentUser?.id),
  applicantRecruitmentManagement: renderApplicantRecruitmentManagement,
  applicantQuestionTemplateManagement: () => globalThis.AdmitCardSignupSettings.renderQuestionManagement(
    renderApplicantQuestionTemplateManagement,
    () => renderView(),
    ["관리자", "슈퍼관리자"].includes(state.auth.currentUser?.role),
  ),
  applicantScheduleManagement: renderApplicantScheduleManagement,

  admitCardLookup: renderAdmitCardLookup,
  printHistory: renderPrintHistory,
  templateManagement: renderTemplateManagement,
  accountManagement: renderAccountManagement,
  loginNoticeSettings: renderLoginNoticeSettings,
  systemSettings: renderSystemSettings,
  systemDataDeletion: renderSystemDataDeletion,
  systemBackupRestore: renderSystemBackupRestore,
  superAdminManagement: renderSuperAdminManagement,
};
viewShellController = createViewShellController({
  DEFAULT_VIEW,
  decorateSelectFields,
  escapeHtml: renderersEscapeHtml,
  getViewRenderer: (viewKey) => renderers[viewKey] || renderDashboard,
  isLoginPage,
  isUserAuthenticated,
  pageTitle,
  renderAdmitCardLookup,
  renderAdmitCardLookupGridSection,
  renderLoginScreen,
  state,
  syncCurrentViewFromLocation,
  syncApplicantSubmissionDetailModal: (...args) =>
    (typeof syncApplicantSubmissionDetailModal === "function" ? syncApplicantSubmissionDetailModal(...args) : undefined),
  syncSystemAuditLogModal: (...args) => (typeof syncSystemAuditLogModal === "function" ? syncSystemAuditLogModal(...args) : undefined),

  syncGridSelectionIndicators,
  syncHeaderSelectOptions,
  syncLoginFormAutofocus,
  syncOpenGridFilterMenuPosition,
  syncPdfGenerationOverlay,
  titles,
  updateAuthChrome,
  updateMetricBadges,
  viewRoot,
  navItems: Array.from(document.querySelectorAll(".nav-item")),
});

Object.assign(globalThis, {
  AdmitCardSharedGridRenderer: Object.freeze({
    renderExamineeResultTable,
    renderGridHeaderActions,
  }),
  getGridRowId,
  getGridRows,
  getGridSelectedRowIds,
  getTableState,
  renderView,
  refreshAdmitCardLookupGrid,
  refreshAdmitCardLookupView,
});

function openModal(modalId) {
  return modalController?.openModal(modalId);
}

async function requestCloseModal(modalId) {
  return modalController?.requestCloseModal(modalId) ?? false;
}

function closeModal(modalId) {
  return modalController?.closeModal(modalId);
}

function closeAllModals() {
  return modalController?.closeAllModals();
}

async function requestCloseAllModals() {
  return modalController?.requestCloseAllModals() ?? true;
}
