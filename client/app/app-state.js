(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardAppState = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createAppStateController({
    AVAILABLE_VIEWS,
    DEFAULT_VIEW,
    HEADER_FILTER_STORAGE_KEY,
    createAccountEditorState,
    createApplicantManagementState,
    createApplicantNoticeState,
    createAuthState,
    createBatchPrintState,

    createHeaderFilters,
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
  }) {
    function getCurrentRoutePath() {
      return normalizeRoutePath(window.location.pathname || "/");
    }

    function isLoginPage() {
      return isLoginRoutePath(getCurrentRoutePath());
    }

    function getRequestedViewFromLocation() {
      return getViewFromPathname(getCurrentRoutePath()) || "";
    }

    function loadCurrentViewFromLocation() {
      const requestedView = getRequestedViewFromLocation();
      return AVAILABLE_VIEWS.has(requestedView) ? requestedView : DEFAULT_VIEW;
    }

    const noticeManagementState = {
      activeScope: "login",
      scopes: {
        login: createLoginNoticeState(),
        applicant: createApplicantNoticeState(),
      },
    };

    const state = {
      currentView: loadCurrentViewFromLocation(),
      headerFilters: loadStoredHeaderFilters({
        HEADER_FILTER_STORAGE_KEY,
        createHeaderFilters,
      }),
      lookupFilters: createLookupFilters(),
      composingInputId: "",
      applicantManager: createApplicantManagementState(),

      templateCards: [],
      templateCardEditor: createTemplateCardEditorState(),
      templateEditor: createTemplateEditorState(),
      templatePreview: createTemplatePreviewState(),
      batchPrint: createBatchPrintState(),
      pdfGeneration: createPdfGenerationState(),
      accountEditor: createAccountEditorState(),
      auth: createAuthState(),
      systemSettings: createSystemSettingsState(),
      superAdmin: createSuperAdminState(),
      systemAuditLog: createSystemAuditLogState(),
      systemDataDeletion: createSystemDataDeletionState(),
      bootstrap: {
        isLoading: true,
        error: "",
        serverDate: "",
        serverTimeOffsetMs: 0,
      },
      metrics: {
        registeredExaminees: 0,
        todayPrints: 0,
        totalPrints: 0,
      },
      toast: createToastState(),
      noticeManagement: noticeManagementState,
      loginNotice: noticeManagementState.scopes.login,
      tableSettings: {

        admitCardLookupGrid: createTableState({
          defaultSortRules: [{ key: "examineeNo", direction: "asc" }],
        }),
        printHistoryGrid: createTableState({
          defaultSortRules: [{ key: "printedAt", direction: "desc" }],
        }),
        accountManagementGrid: createTableState({
          defaultSortRules: [{ key: "id", direction: "asc" }],
        }),
        applicantHistoryGrid: createTableState({
          defaultSortRules: [{ key: "promotedExamineeNo", direction: "asc" }],
        }),
        applicantRecruitmentGrid: createTableState(),
        applicantScheduleGrid: createTableState(),

      },
    };

    function getNoticeScopeState(scope = "") {
      return String(scope || "").trim() === "applicant" ? "applicant" : "login";
    }

    function applyLoginNoticePayload(html = "", options = {}) {
      const scope = getNoticeScopeState(options.scope);
      const nextNoticeState = scope === "applicant" ? createApplicantNoticeState(html) : createLoginNoticeState(html);

      state.noticeManagement.scopes[scope] = nextNoticeState;

      if (state.noticeManagement.activeScope === scope) {
        state.loginNotice = nextNoticeState;
      }
    }

    function setNoticeManagementScope(scope = "") {
      const nextScope = getNoticeScopeState(scope);
      state.noticeManagement.activeScope = nextScope;
      state.loginNotice = state.noticeManagement.scopes[nextScope];
    }

    return Object.freeze({
      applyLoginNoticePayload,
      getCurrentRoutePath,
      getRequestedViewFromLocation,
      isLoginPage,
      loadCurrentViewFromLocation,
      setNoticeManagementScope,
      state,
    });
  }

  return Object.freeze({
    createAppStateController,
  });
});
