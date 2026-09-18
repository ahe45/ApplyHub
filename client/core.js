const HEADER_FILTER_STORAGE_KEY = "admitcard.headerFilters";
const FLASH_TOAST_STORAGE_KEY = "admitcard.flashToast";
const DEFAULT_SYSTEM_INITIAL_PASSWORD = "1111";
const DEFAULT_SYSTEM_AUTO_LOGOUT_MINUTES = 0;
const MAX_SYSTEM_AUTO_LOGOUT_MINUTES = 1440;
const appConfig = globalThis.AdmitCardAppConfig;
const clientExamineeConfig = globalThis.AdmitCardClientExamineeConfig;
const stateFactories = globalThis.AdmitCardStateFactories;
const apiClient = globalThis.AdmitCardApiClient;
const domElementsModule = globalThis.AdmitCardDomElements;
const appStateModule = globalThis.AdmitCardAppState;
const gridRowStoreModule = globalThis.AdmitCardGridRowStore;
const bootstrapDataModule = globalThis.AdmitCardBootstrapData;
const bootstrapLoaderModule = globalThis.AdmitCardBootstrapLoader;
const accountSystemRuntimeModule = globalThis.AdmitCardAccountSystemRuntime;
const workflowRuntimeModule = globalThis.AdmitCardWorkflowRuntime;
const navigationModule = globalThis.AdmitCardAppNavigation;
const busyOverlayModule = globalThis.AdmitCardBusyOverlays;
const autoLogoutModule = globalThis.AdmitCardAutoLogout;
const authAccountStateModule = globalThis.AdmitCardAuthAccountState;
const authUiStateModule = globalThis.AdmitCardAuthUiState;
const authSessionModule = globalThis.AdmitCardAuthSession;
const admitCardWorkflowModule = globalThis.AdmitCardWorkflow;
const examineeFileTransfer = globalThis.AdmitCardExamineeFileTransfer;

const accountCreateModule = globalThis.AdmitCardAccountCreate;
const systemSettingsModule = globalThis.AdmitCardSystemSettings;

if (!appConfig) {
  throw new Error("shared/app-config.js must be loaded before client/core.js.");
}

if (!clientExamineeConfig) {
  throw new Error("client/features/admit-cards/config.js must be loaded before client/core.js.");
}

if (!stateFactories) {
  throw new Error("client/app/state-factories.js must be loaded before client/core.js.");
}

if (!apiClient) {
  throw new Error("client/app/api-client.js must be loaded before client/core.js.");
}

if (!domElementsModule?.createDomElementRegistry) {
  throw new Error("client/app/dom-elements.js must be loaded before client/core.js.");
}

if (!appStateModule?.createAppStateController) {
  throw new Error("client/app/app-state.js must be loaded before client/core.js.");
}

if (!gridRowStoreModule?.createGridRowStoreController) {
  throw new Error("client/app/grid-row-store.js must be loaded before client/core.js.");
}

if (!bootstrapDataModule?.createBootstrapDataController || !bootstrapDataModule?.loadStoredHeaderFilters) {
  throw new Error("client/app/bootstrap-data.js must be loaded before client/core.js.");
}

if (!bootstrapLoaderModule?.createBootstrapLoaderController) {
  throw new Error("client/app/bootstrap-loader.js must be loaded before client/core.js.");
}

if (!accountSystemRuntimeModule?.createAccountSystemRuntimeController) {
  throw new Error("client/app/account-system-runtime.js must be loaded before client/core.js.");
}

if (!workflowRuntimeModule?.createWorkflowRuntimeController) {
  throw new Error("client/app/workflow-runtime.js must be loaded before client/core.js.");
}

if (!navigationModule?.createNavigationController) {
  throw new Error("client/app/navigation.js must be loaded before client/core.js.");
}

if (!busyOverlayModule?.createBusyOverlayController) {
  throw new Error("client/features/app/busy-overlays.js must be loaded before client/core.js.");
}

if (!autoLogoutModule?.createAutoLogoutController) {
  throw new Error("client/features/auth/auto-logout.js must be loaded before client/core.js.");
}

if (!authAccountStateModule?.createAuthAccountStateController) {
  throw new Error("client/features/auth/account-state.js must be loaded before client/core.js.");
}

if (!authUiStateModule?.createAuthUiController) {
  throw new Error("client/features/auth/ui-state.js must be loaded before client/core.js.");
}

if (!authSessionModule?.createAuthSessionController) {
  throw new Error("client/features/auth/session.js must be loaded before client/core.js.");
}

if (!admitCardWorkflowModule?.createAdmitCardWorkflowController) {
  throw new Error("client/features/admit-cards/workflow.js must be loaded before client/core.js.");
}

if (!examineeFileTransfer) {
  throw new Error("client/features/admit-cards/file-transfer.js must be loaded before client/core.js.");
}

if (!accountCreateModule?.createAccountCreateController) {
  throw new Error("client/features/accounts/create-modal.js must be loaded before client/core.js.");
}

if (!systemSettingsModule?.createSystemSettingsController) {
  throw new Error("client/features/system/settings.js must be loaded before client/core.js.");
}

const {
  accountRoleOptions,
  availableViews,
  buildDefaultRoleMenuVisibility,
  defaultView: DEFAULT_VIEW,
  getDefaultAccessibleView: getDefaultAccessibleViewForRoleConfig,
  getViewFromPathname,
  getViewRoutePath,
  getAccessibleViewsForRole: getAccessibleViewsForRoleConfig,
  getVisibleMenuViewsForRole: getVisibleMenuViewsForRoleConfig,
  isLoginRoutePath,
  isViewAccessibleForRole: isViewAccessibleForRoleConfig,
  loginRoutePath: LOGIN_ROUTE_PATH,
  normalizeSuperAdminSettings,
  normalizeRoutePath,
  pageTitles,
  superAdminRole,
  templateTagDefinitions,
} = appConfig;
const {
  headerFilterFields,
  lookupSelectFields,
  lookupSelectKeys,
  lookupTextFields,
  admitCardLookupGridColumns,

  printHistoryGridColumns,
} = clientExamineeConfig;
const SYSTEM_DATA_DELETE_CONFIG = Object.freeze({
  all: Object.freeze({
    confirmMessage:
      "전체 데이터를 삭제하시겠습니까?\n\n회원가입 정보·첨부파일·약관 동의, 접수 사진·서류, 전형 관리, 출력 이력, 접수 이력이 모두 삭제됩니다. 백업이 없으면 복구할 수 없습니다.",
  }),
  "applicant-settings": Object.freeze({
    confirmMessage: "전형 관리 데이터를 삭제하시겠습니까?\n\n전형 관리 데이터가 모두 삭제되며 복구할 수 없습니다.",
  }),

  "print-history": Object.freeze({
    confirmMessage: "수험표 출력 이력을 삭제하시겠습니까?\n\n출력 이력 데이터가 모두 삭제되며 복구할 수 없습니다.",
  }),
  "applicant-history": Object.freeze({
    confirmMessage: "접수 이력 데이터를 삭제하시겠습니까?\n\n접수 이력 데이터가 모두 삭제되며 복구할 수 없습니다.",
  }),
  "applicant-members": Object.freeze({
    confirmMessage: "전체 회원가입 데이터를 삭제하시겠습니까?\n\n회원 계정, 가입 답변·첨부파일, 약관 동의, 로그인·인증 정보가 삭제됩니다. 기존 접수 이력은 보존하고 회원 연결만 해제합니다. 관리자 계정과 가입 양식은 유지합니다. 백업이 없으면 복구할 수 없습니다.",
  }),
});
const AVAILABLE_VIEWS = new Set(availableViews);
const TEMPLATE_EDITOR_HISTORY_LIMIT = 120;
const LOGIN_NOTICE_EDITOR_HISTORY_LIMIT = 120;
const TEMPLATE_EDITOR_IMAGE_MIN_SIZE = 32;
const {
  createAccountEditorState,
  createApplicantManagementState,
  createAuthState,
  createBatchPrintState,

  createPdfGenerationState,
  createSuperAdminState: createSuperAdminStateBase,
  createSystemAuditLogState,
  createSystemDataDeletionState,
  createTableState,
  createTemplateCardEditorState,
  createTemplateEditorState,
  createTemplatePreviewState,
  createToastState,
} = stateFactories;
const createHeaderFilters = () => stateFactories.createHeaderFilters(headerFilterFields);
const createLookupFilters = () => stateFactories.createLookupFilters(lookupSelectFields, lookupTextFields);
const normalizeSystemInitialPassword = (value) =>
  stateFactories.normalizeSystemInitialPassword(value, DEFAULT_SYSTEM_INITIAL_PASSWORD);
const normalizeSystemAutoLogoutMinutes = (value) =>
  stateFactories.normalizeSystemAutoLogoutMinutes(value, {
    defaultValue: DEFAULT_SYSTEM_AUTO_LOGOUT_MINUTES,
    maxValue: MAX_SYSTEM_AUTO_LOGOUT_MINUTES,
  });
const normalizeGridSortRules = (rules) => stateFactories.normalizeGridSortRules(rules);
const normalizeSystemSettingsPayload = (payload = {}) =>
  stateFactories.normalizeSystemSettingsPayload(payload, {
    defaultPassword: DEFAULT_SYSTEM_INITIAL_PASSWORD,
    defaultAutoLogoutMinutes: DEFAULT_SYSTEM_AUTO_LOGOUT_MINUTES,
    maxAutoLogoutMinutes: MAX_SYSTEM_AUTO_LOGOUT_MINUTES,
  });
const createSystemSettingsState = (payload = {}) =>
  stateFactories.createSystemSettingsState(payload, {
    defaultPassword: DEFAULT_SYSTEM_INITIAL_PASSWORD,
    defaultAutoLogoutMinutes: DEFAULT_SYSTEM_AUTO_LOGOUT_MINUTES,
    maxAutoLogoutMinutes: MAX_SYSTEM_AUTO_LOGOUT_MINUTES,
  });
const createSuperAdminState = (payload = {}) =>
  createSuperAdminStateBase(
    payload && Object.keys(payload).length > 0 ? payload : globalThis.AdmitCardInitialSuperAdminSettings || {},
    {
      normalizeSuperAdminSettings,
    },
  );
const {
  apiRequest,
  apiRequestForBlobWithProgress,
  apiRequestWithUploadProgress,
  buildApiUrl,
} = apiClient;
const { createDomElementRegistry } = domElementsModule;
const { createAppStateController } = appStateModule;
const { createGridRowStoreController } = gridRowStoreModule;
const { createBootstrapDataController, loadStoredHeaderFilters } = bootstrapDataModule;
const { createBootstrapLoaderController } = bootstrapLoaderModule;
const { createAccountSystemRuntimeController } = accountSystemRuntimeModule;
const { createWorkflowRuntimeController } = workflowRuntimeModule;
const { createNavigationController } = navigationModule;
const { createBusyOverlayController } = busyOverlayModule;
const { createAutoLogoutController } = autoLogoutModule;
const { createAuthAccountStateController } = authAccountStateModule;
const { createAuthUiController } = authUiStateModule;
const { createAuthSessionController } = authSessionModule;
const { createAdmitCardWorkflowController } = admitCardWorkflowModule;
const { createAccountCreateController } = accountCreateModule;

const { createSystemSettingsController } = systemSettingsModule;
const {
  arrayBufferToBase64,

  downloadPrintHistoryGridWorkbook,

  readFileAsArrayBuffer,
  wait,
  waitForNextFrame,
} = examineeFileTransfer;
const getDefaultLoginNoticeHtml = (initialPassword = DEFAULT_SYSTEM_INITIAL_PASSWORD) =>
  stateFactories.getDefaultLoginNoticeHtml(initialPassword);
const getDefaultApplicantNoticeHtml = () => stateFactories.getDefaultApplicantNoticeHtml();
const DEFAULT_LOGIN_NOTICE_HTML = getDefaultLoginNoticeHtml(DEFAULT_SYSTEM_INITIAL_PASSWORD);
const DEFAULT_APPLICANT_NOTICE_HTML = getDefaultApplicantNoticeHtml();
const normalizeLoginNoticeHtml = (html = "") =>
  stateFactories.normalizeLoginNoticeHtml(html, {
    fallbackHtml: DEFAULT_LOGIN_NOTICE_HTML,
  });
const createLoginNoticeState = (initialHtml = getDefaultLoginNoticeHtml()) =>
  stateFactories.createLoginNoticeState(initialHtml, {
    defaultHtml: DEFAULT_LOGIN_NOTICE_HTML,
    fallbackHtml: DEFAULT_LOGIN_NOTICE_HTML,
  });
const createApplicantNoticeState = (initialHtml = getDefaultApplicantNoticeHtml()) =>
  stateFactories.createApplicantNoticeState(initialHtml, {
    defaultHtml: DEFAULT_APPLICANT_NOTICE_HTML,
    fallbackHtml: DEFAULT_APPLICANT_NOTICE_HTML,
  });

const appStateController = createAppStateController({
  AVAILABLE_VIEWS,
  DEFAULT_VIEW,
  HEADER_FILTER_STORAGE_KEY,
  createAccountEditorState,
  createApplicantManagementState,
  createAuthState,
  createBatchPrintState,

  createHeaderFilters,
  createApplicantNoticeState,
  createLoginNoticeState,
  createLookupFilters,
  createPdfGenerationState,
  createSuperAdminState,
  createSystemAuditLogState,
  createSystemDataDeletionState,
  createSystemSettingsState,
  createTableState,
  createTemplateCardEditorState,
  createTemplateEditorState,
  createTemplatePreviewState,
  createToastState,
  getViewFromPathname,
  isLoginRoutePath,
  loadStoredHeaderFilters,
  normalizeRoutePath,
});
const {
  applyLoginNoticePayload,
  getCurrentRoutePath,
  getRequestedViewFromLocation,
  isLoginPage,
  loadCurrentViewFromLocation,
  setNoticeManagementScope,
  state,
} = appStateController;

const domElementRegistry = createDomElementRegistry(document);
const {
  accountCreateDescription,
  accountCreateError,
  accountCreateForm,
  accountCreateId,
  accountCreateModal,
  accountCreateName,
  accountCreateRole,

  applicantScheduleModal,

  applicantSubmissionDownloadModal,
  batchPrintDownloadForm,
  batchPrintDownloadModal,
  batchPrintDownloadModeCombinedPdf,
  batchPrintDownloadModeZip,
  batchPrintDownloadSelectionMeta,
  batchPrintDownloadSubmit,
  applicantSubmissionDetailBody,
  applicantSubmissionDetailMeta,
  applicantSubmissionDetailModal,
  applicantRecruitmentUnitModal,
  applicantUnitUploadFileInput,
  applicantUnitUploadFileName,
  applicantUnitUploadPreviewMount,
  applicantUnitUploadModal,
  appShell,
  autoLogoutCountdown,
  autoLogoutCountdownValue,
  brandHome,
  currentUserId,
  currentUserRole,

  logoutButton,
  menuToggle,
  pageShell,
  pageTitle,
  passwordSetupConfirm,
  passwordSetupDescription,
  passwordSetupError,
  passwordSetupForm,
  passwordSetupModal,
  passwordSetupNext,
  pdfGenerationMessage,
  pdfGenerationOverlay,
  pdfGenerationCancelButton,
  pdfGenerationProgress,
  pdfGenerationProgressBar,
  pdfGenerationProgressFill,
  pdfGenerationProgressLabel,
  pdfGenerationProgressValue,
  registeredExamineeCount,
  sidebar,
  systemAuditLogModal,
  systemAuditLogModalBody,
  templateEditorDescription,
  templateEditorModal,
  templateEditorName,
  templateEditorStatus,
  templateEditorSurface,
  templateEditorTitle,
  templatePreviewMeta,
  templatePreviewModal,
  templatePreviewStage,
  templatePreviewTitle,
  toastRoot,
  todayPrintCount,
  topbar,
  totalPrintCount,

  viewRoot,
} = domElementRegistry;
let templateEditorBlockType = null;
let templateEditorBorderColor = null;
let templateEditorBorderStyle = null;
let templateEditorBorderTarget = null;
let templateEditorBorderWidth = null;
let templateEditorCellSplitCount = null;
let templateEditorCellSplitPanel = null;
let templateEditorCellShading = null;
let templateEditorCellWidth = null;
let templateEditorFontFamily = null;
let templateEditorFontSize = null;
let templateEditorImageInput = null;
let templateEditorRowHeight = null;
let templateEditorSizeScope = null;
let templateEditorTableColumns = null;
let templateEditorTableInsertPanel = null;
let templateEditorTableRows = null;
let templateEditorTextColor = null;
let templateEditorTextShading = null;
const gridRowStoreController = createGridRowStoreController();
const {
  appendAccountGridRow,
  getAccountGridColumns,
  getAccountGridRows,
  getExamineeGridRows,
  getPrintHistoryRows,
  setAccountGridRows,
  setExamineeGridRows,
  setPrintHistoryRows,
} = gridRowStoreController;
const accountGridColumns = getAccountGridColumns();

function refreshTemplateEditorToolbarElements() {
  ({
    templateEditorBlockType,
    templateEditorBorderColor,
    templateEditorBorderStyle,
    templateEditorBorderTarget,
    templateEditorBorderWidth,
    templateEditorCellSplitCount,
    templateEditorCellSplitPanel,
    templateEditorCellShading,
    templateEditorCellWidth,
    templateEditorFontFamily,
    templateEditorFontSize,
    templateEditorImageInput,
    templateEditorRowHeight,
    templateEditorSizeScope,
    templateEditorTableColumns,
    templateEditorTableInsertPanel,
    templateEditorTableRows,
    templateEditorTextColor,
    templateEditorTextShading,
  } = domElementRegistry.getTemplateEditorToolbarElements());
}

refreshTemplateEditorToolbarElements();
let templateEditorImageOverlay = null;
const BATCH_PRINT_STATUS_POLL_INTERVAL_MS = 400;
const BATCH_PRINT_JOB_TIMEOUT_MS = 1000 * 60 * 30;
const titles = pageTitles;
const authAccountStateController = createAuthAccountStateController({
  accountCreateDescription,
  normalizeSystemAutoLogoutMinutes,
  normalizeSystemInitialPassword,
  state,
});
const {
  getSystemAutoLogoutMinutes,
  getSystemInitialPassword,
  isUserAuthenticated,
  normalizeAuthAccount,
  syncAccountCreateDescription,
} = authAccountStateController;
syncAccountCreateDescription();
let confirmPendingSystemSettingsNavigation = async () => true;
let hasPendingSystemSettingsChanges = () => false;
const getSavedRoleMenuVisibility = () =>
  buildDefaultRoleMenuVisibility();
const applySuperAdminPayload = (payload = {}) => {
  state.superAdmin = createSuperAdminState(payload);
};
const getAccessibleViewsForRole = (role = "") =>
  getAccessibleViewsForRoleConfig(role, {
    roleMenuVisibility: getSavedRoleMenuVisibility(),
  });
const getDefaultAccessibleViewForRole = (role = "") =>
  getDefaultAccessibleViewForRoleConfig(role, {
    roleMenuVisibility: getSavedRoleMenuVisibility(),
  });
const getVisibleMenuViewsForRole = (role = "") =>
  getVisibleMenuViewsForRoleConfig(role, {
    roleMenuVisibility: getSavedRoleMenuVisibility(),
  });
const isViewAccessibleForRole = (view, role = "") =>
  isViewAccessibleForRoleConfig(view, role, {
    roleMenuVisibility: getSavedRoleMenuVisibility(),
  });
const navigationController = createNavigationController({
  confirmNavigation: (...args) => confirmPendingSystemSettingsNavigation(...args),
  getAccessibleViewsForRoleConfig: (...args) => getAccessibleViewsForRole(...args),
  getCurrentRoutePath,
  getDefaultAccessibleViewForRole: (...args) => getDefaultAccessibleViewForRole(...args),
  getRequestedViewFromLocation,
  getViewRoutePath,
  getVisibleMenuViewsForRoleConfig: (...args) => getVisibleMenuViewsForRole(...args),
  isLoginPage,
  isUserAuthenticated,
  isViewAccessibleForRole: (...args) => isViewAccessibleForRole(...args),
  loadCurrentViewFromLocation,
  loginRoutePath: LOGIN_ROUTE_PATH,
  normalizeRoutePath,
  state,
});
const {
  getDefaultAccessibleView,
  isRouteNavigating,
  isViewAccessible,
  navigateToLogin,
  navigateToPath,
  navigateToView,
  redirectToAccessibleRouteIfNeeded,
  syncCurrentViewFromLocation,
  syncNavigationVisibility,
} = navigationController;
const authUiController = createAuthUiController({
  FLASH_TOAST_STORAGE_KEY,
  getLoginAccountInput: () => document.getElementById("loginAccountId"),
  getLoginErrorElement: () => document.getElementById("loginError"),
  getLoginPasswordInput: () => document.getElementById("loginPassword"),
  passwordSetupConfirm,
  passwordSetupDescription,
  passwordSetupError,
  passwordSetupForm,
  passwordSetupModal,
  passwordSetupNext,
  state,
  toastRoot,
});
const {
  consumeFlashToast,
  hideToast,
  queueFlashToast,
  showToast,
  syncLoginErrorMessage,
  syncLoginFormAutofocus,
  syncPasswordSetupModal,
  syncToast,
} = authUiController;
const autoLogoutController = createAutoLogoutController({
  apiRequest,
  autoLogoutCountdown,
  autoLogoutCountdownValue,
  getSystemAutoLogoutMinutes,
  isUserAuthenticated,
  navigateToLogin,
  queueFlashToast,
  renderView: (...args) => {
    if (typeof globalThis.renderView === "function") {
      return globalThis.renderView(...args);
    }

    return undefined;
  },
  setLoggedOutState: (...args) => {
    if (typeof setLoggedOutState === "function") {
      return setLoggedOutState(...args);
    }

    return undefined;
  },
  updateAuthChrome: (...args) => {
    if (typeof updateAuthChrome === "function") {
      return updateAuthChrome(...args);
    }

    return undefined;
  },
});
const {
  clearAutoLogoutCountdownInterval,
  clearAutoLogoutTimer,
  recordAutoLogoutActivity,
  syncAutoLogoutCountdown,
  syncAutoLogoutTimer,
} = autoLogoutController;

const bootstrapDataController = createBootstrapDataController({

  HEADER_FILTER_STORAGE_KEY,
  applyLoginNoticePayload,
  applySystemBackupAutomationPayload: (...args) => applySystemBackupAutomationPayload(...args),
  applySystemSettingsPayload: (...args) => applySystemSettingsPayload(...args),
  cancelAccountEdit: (...args) => {
    if (typeof cancelAccountEdit === "function") {
      return cancelAccountEdit(...args);
    }

    return undefined;
  },
  clearAutoLogoutCountdownInterval,
  clearAutoLogoutTimer,
  createAccountEditorState,
  createApplicantManagementState,

  createHeaderFilters,
  createPdfGenerationState,
  createSuperAdminState,
  createSystemAuditLogState,
  createSystemDataDeletionState,
  createTemplatePreviewState,
  getAccountGridRows,
  getExamineeGridRows,
  getPrintHistoryRows,
  reconcileHeaderFilters: (...args) => {
    if (typeof reconcileHeaderFilters === "function") {
      return reconcileHeaderFilters(...args);
    }

    return undefined;
  },
  reconcileLookupFilters: (...args) => {
    if (typeof reconcileLookupFilters === "function") {
      return reconcileLookupFilters(...args);
    }

    return undefined;
  },
  redirectToAccessibleRouteIfNeeded,
  registeredExamineeCount,
  renderView: (...args) => {
    if (typeof globalThis.renderView === "function") {
      return globalThis.renderView(...args);
    }

    return undefined;
  },
  setAccountGridRows,
  setExamineeGridRows,
  setPrintHistoryRows,
  setTemplateCards: (cards) => {
    state.templateCards = Array.isArray(cards) ? cards : [];
  },
  state,
  syncAutoLogoutCountdown,
  syncPdfGenerationOverlay: (...args) => {
    if (typeof syncPdfGenerationOverlay === "function") {
      return syncPdfGenerationOverlay(...args);
    }

    return undefined;
  },
  todayPrintCount,
  totalPrintCount,
});
const {
  applyBootstrapPayload,

  clearHeaderFilters,
  getCurrentUserRole,
  normalizeAccountRecord,
  normalizeExamineeRecord,
  persistHeaderFilters,

  resetBootstrapData,
  resetGridPages,
  updateMetricBadges,
} = bootstrapDataController;
const bootstrapLoaderController = createBootstrapLoaderController({
  apiRequest,
  applyBootstrapPayload,
  applyLoginNoticePayload,
  applySuperAdminPayload,
  handleAuthenticationFailure: (...args) => {
    if (typeof handleAuthenticationFailure === "function") {
      return handleAuthenticationFailure(...args);
    }

    return false;
  },
  isUserAuthenticated,
  loadCurrentViewData: async () => {
    if (state.currentView !== "systemAuditLog" || typeof loadSystemAuditLogs !== "function") {
      return;
    }

    await loadSystemAuditLogs({ silent: true });
  },
  renderView: (...args) => {
    if (typeof globalThis.renderView === "function") {
      return globalThis.renderView(...args);
    }

    return undefined;
  },
  state,
  updateAuthChrome: (...args) => {
    if (typeof updateAuthChrome === "function") {
      return updateAuthChrome(...args);
    }

    return undefined;
  },
});
const { loadBootstrapData, loadLoginNoticeData } = bootstrapLoaderController;

const authSessionController = createAuthSessionController({
  apiRequest,
  appShell,
  clearAutoLogoutTimer,
  consumeFlashToast,
  createAuthState,
  currentUserId,
  currentUserRole,
  getDefaultAccessibleView,
  hideToast,
  isLoginPage,
  isRouteNavigating,
  isUserAuthenticated,
  loadBootstrapData,
  loadLoginNoticeData,
  logoutButton,
  navigateToLogin,
  navigateToView,
  normalizeAuthAccount,
  pageShell,
  passwordSetupForm,
  queueFlashToast,
  redirectToAccessibleRouteIfNeeded,
  renderView: (...args) => {
    if (typeof globalThis.renderView === "function") {
      return globalThis.renderView(...args);
    }

    return undefined;
  },
  resetBootstrapData,
  showToast,
  sidebar,
  state,
  syncAutoLogoutCountdown,
  syncCurrentViewFromLocation,
  syncNavigationVisibility,
  syncPasswordSetupModal,
  topbar,
});
const {
  applyAuthPayload,
  closePasswordSetupPrompt,
  handleAuthenticationFailure,
  loadAuthSession,
  logoutCurrentUser,
  resetAuthFormState,
  setLoggedOutState,
  submitLogin,
  submitPasswordSetup,
  updateAuthChrome,
} = authSessionController;
const accountSystemRuntimeController = createAccountSystemRuntimeController({
  MAX_SYSTEM_AUTO_LOGOUT_MINUTES,
  SYSTEM_DATA_DELETE_CONFIG,
  accountCreateError,
  accountCreateForm,
  accountCreateId,
  accountCreateModal,
  accountCreateName,
  accountCreateRole,
  accountRoleOptions,
  apiRequest,
  apiRequestWithUploadProgress,
  appendAccountRecord: appendAccountGridRow,
  closeModal: (...args) => {
    if (typeof globalThis.closeModal === "function") {
      return globalThis.closeModal(...args);
    }

    return undefined;
  },
  createAccountCreateController,
  createSystemSettingsController,
  getSortedAccountRows: () => {
    if (typeof globalThis.getGridRows === "function") {
      return globalThis.getGridRows("accountManagementGrid");
    }

    return getAccountGridRows();
  },
  getSystemAutoLogoutInputElement: () => document.getElementById("systemSettingsAutoLogoutMinutes"),
  getSystemInitialPassword,
  getTableState: (...args) => {
    if (typeof globalThis.getTableState === "function") {
      return globalThis.getTableState(...args);
    }

    return null;
  },
  handleAuthenticationFailure,
  loadBootstrapData,
  normalizeAccountRecord,
  normalizeSuperAdminSettings,
  normalizeSystemAutoLogoutMinutes,
  normalizeSystemSettingsPayload,
  renderView: (...args) => {
    if (typeof globalThis.renderView === "function") {
      return globalThis.renderView(...args);
    }

    return undefined;
  },
  showToast,
  state,
  syncAccountCreateDescription,
  syncAutoLogoutTimer,
});
const {
  applySystemBackupAutomationPayload,
  applySuperAdminImageFile,
  applySuperAdminPayload: applySuperAdminSettingsPayload,
  applySystemSettingsPayload,
  changeSystemAutoLogoutMinutes,
  clearSystemBackupRestoreFileSelection,
  confirmSystemSettingsNavigation,
  deleteSystemDataAction,
  downloadSystemBackupAction,
  getDefaultAccountRole,
  getSystemDataDeletionStatusElement,
  loadSystemAuditLogs,
  runSystemBackupAutomationNow,
  getSystemSettingsStatusElement,
  getValidatedSystemSettingsPayload,
  getSystemSettingsChangeSummaries,
  hasUnsavedSystemSettingsChanges,
  importSystemBackupAction,
  prepareAccountCreateModal,
  resetAccountCreateFormState,
  saveSuperAdminSettings,
  saveSystemBackupAutomationSettings,
  saveSystemSettings,
  selectSystemBackupRestoreFile,
  setAccountCreateError,
  setSystemBackupAutomationStatus,
  setSuperAdminStatus,
  setSystemDataDeletionStatus,
  setSystemSettingsStatus,
  submitAccountCreate,
  syncSuperAdminDirtyState,
  syncSystemBackupAutomationDirtyState,
  syncSystemSettingsDirtyState,
  syncAccountCreateRoleOptions,
  syncAccountCreateSubmitButton,
  toggleSystemBackupAutomationItemSelection,
  toggleSystemBackupAssetSelection,
  toggleSystemBackupRestoreSelection,
  updateSystemBackupAutomationField,
  updateSuperAdminField,
  updateSuperAdminImageField,
} = accountSystemRuntimeController;
confirmPendingSystemSettingsNavigation = (...args) => confirmSystemSettingsNavigation(...args);
hasPendingSystemSettingsChanges = () => hasUnsavedSystemSettingsChanges();
Object.assign(globalThis, {
  confirmPendingSystemSettingsNavigation: (...args) => confirmPendingSystemSettingsNavigation(...args),
  hasPendingSystemSettingsChanges: () => hasPendingSystemSettingsChanges(),
});
const workflowRuntimeController = createWorkflowRuntimeController({
  BATCH_PRINT_JOB_TIMEOUT_MS,
  BATCH_PRINT_STATUS_POLL_INTERVAL_MS,
  apiRequest,
  apiRequestForBlobWithProgress,
  apiRequestWithUploadProgress,
  arrayBufferToBase64,
  buildApiUrl,

  closeModal: (modalId) => {
    if (typeof globalThis.closeModal === "function") {
      return globalThis.closeModal(modalId);
    }

    return undefined;
  },
  createAdmitCardWorkflowController,
  createBusyOverlayController,

  createPdfGenerationState,
  getBatchPrintDownloadElements: () => ({
    formElement: batchPrintDownloadForm,
    modal: batchPrintDownloadModal,
    combinedPdfOption: batchPrintDownloadModeCombinedPdf,
    pdfZipOption: batchPrintDownloadModeZip,
    selectionMetaElement: batchPrintDownloadSelectionMeta,
    submitButton: batchPrintDownloadSubmit,
  }),
  getDocumentBody: () => document.body,
  getExamineeGridRows,
  getGridRowId: (...args) => (typeof getGridRowId === "function" ? getGridRowId(...args) : ""),
  getGridRows: (...args) => (typeof getGridRows === "function" ? getGridRows(...args) : []),
  getGridSelectedRowIds: (...args) => (typeof getGridSelectedRowIds === "function" ? getGridSelectedRowIds(...args) : []),
  getPdfGenerationElements: () => ({
    overlay: pdfGenerationOverlay,
    messageElement: pdfGenerationMessage,
    cancelButtonElement: pdfGenerationCancelButton,
    progressElement: pdfGenerationProgress,
    progressLabelElement: pdfGenerationProgressLabel,
    progressValueElement: pdfGenerationProgressValue,
    progressBarElement: pdfGenerationProgressBar,
    progressFillElement: pdfGenerationProgressFill,
  }),

  handleAuthenticationFailure,
  hideToast,
  loadBootstrapData,

  readFileAsArrayBuffer,
  renderView: (...args) => {
    if (typeof globalThis.renderView === "function") {
      return globalThis.renderView(...args);
    }

    return undefined;
  },
  showToast,
  state,
  wait,
  waitForNextFrame,
});
const {
  batchPrintSelectedExaminees,
  buildBusyOverlayMessage,
  buildPdfGenerationMessage,

  fetchExamineeAdmitCardPdfUrl,
  getSelectedAdmitCardExamineeCount,
  getSelectedAdmitCardExaminees,
  isBusyOverlayActive,
  isPdfGenerationActive,
  normalizeExamineeNoList,
  normalizeProgressValue,
  openPdfWindow,
  cancelBatchPrintJob,

  prepareBatchPrintDownloadModal,
  printExamineeAdmitCard,
  printPdfUrl,

  recordExamineePrint,
  resetPdfGenerationState,
  runWithPdfGenerationLock,

  setPdfGenerationState,
  submitBatchPrintDownloadSelection,
  syncAppBusyState,
  syncPdfGenerationOverlay,
  updateBatchPrintOutputMode,

} = workflowRuntimeController;

