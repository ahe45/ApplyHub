(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardBootstrapData = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const DASHBOARD_FILTER_STORAGE_KEY = "applyhub.dashboardFilters";
  function loadStoredHeaderFilters({ HEADER_FILTER_STORAGE_KEY, createHeaderFilters }) {
    const filters = createHeaderFilters();
    try {
      // Retire the removed topbar filters without leaving invisible restrictions.
      window.localStorage.removeItem(HEADER_FILTER_STORAGE_KEY);
      // Dashboard preferences must not silently restrict other administrator pages.
      if (window.location.pathname === "/dashboard") {
        const saved = JSON.parse(window.localStorage.getItem(DASHBOARD_FILTER_STORAGE_KEY) || "{}");
        for (const key of Object.keys(filters)) filters[key] = typeof saved?.[key] === "string" ? saved[key] : "";
      }
    } catch (error) {
      // Storage may be unavailable; defaults must still apply.
    }
    return filters;
  }

  function createBootstrapDataController(deps) {
    const {

      HEADER_FILTER_STORAGE_KEY,
      applyLoginNoticePayload,
      applySystemBackupAutomationPayload,
      applySystemSettingsPayload,
      cancelAccountEdit,
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
      reconcileHeaderFilters,
      reconcileLookupFilters,
      redirectToAccessibleRouteIfNeeded,
      registeredExamineeCount,
      renderView,
      setAccountGridRows,
      setExamineeGridRows,
      setPrintHistoryRows,
      setTemplateCards,
      state,
      syncAutoLogoutCountdown,
      syncPdfGenerationOverlay,
      todayPrintCount,
      totalPrintCount,
    } = deps;

    function getCurrentUserRole() {
      return String(state.auth.currentUser?.role || "").trim();
    }

    function persistHeaderFilters() {
      try {
        window.localStorage.removeItem(HEADER_FILTER_STORAGE_KEY);
        if (state.currentView === "dashboard") {
          window.localStorage.setItem(DASHBOARD_FILTER_STORAGE_KEY, JSON.stringify(state.headerFilters));
        }
      } catch (error) {
        // Ignore storage failures and keep the in-memory state.
      }
    }

    function resetGridPages() {
      Object.values(state.tableSettings).forEach((tableState) => {
        tableState.page = 1;
      });
    }

    function clearHeaderFilters() {
      state.headerFilters = createHeaderFilters();
      reconcileLookupFilters();
      persistHeaderFilters();
      resetGridPages();
      renderView();
    }

    function updateMetricBadges() {
      if (registeredExamineeCount) {
        registeredExamineeCount.textContent = `${state.metrics.registeredExaminees}명`;
      }

      if (todayPrintCount) {
        todayPrintCount.textContent = `${state.metrics.todayPrints}건`;
      }

      if (totalPrintCount) {
        totalPrintCount.textContent = `${state.metrics.totalPrints}건`;
      }
    }

    function normalizeExamineeRecord(record = {}) {
      const track = String(record.track ?? "");
      const admission = String(record.admission ?? record.exam ?? "");
      const series = String(record.series ?? "");
      const unit = String(record.unit ?? "");
      const examineeNo = String(record.examineeNo ?? "");

      return {
        ...record,
        track,
        admission,
        exam: admission,
        series,
        unit,
        examineeNo,
        hasPhoto: record.hasPhoto === true || record.hasPhoto === "true" || Number(record.hasPhoto) === 1,
        photoVersion: Number(record.photoVersion || 0),
      };
    }

    function resetBootstrapData() {
      clearAutoLogoutTimer();
      clearAutoLogoutCountdownInterval();
      setExamineeGridRows([]);
      setPrintHistoryRows([]);
      setAccountGridRows([]);
      setTemplateCards([]);
      state.systemDataDeletion = createSystemDataDeletionState();
      state.systemAuditLog = createSystemAuditLogState();
      state.superAdmin = createSuperAdminState();
      state.metrics = {
        registeredExaminees: 0,
        todayPrints: 0,
        totalPrints: 0,
      };
      state.applicantManager = createApplicantManagementState();
      state.pdfGeneration = createPdfGenerationState();
      state.bootstrap.error = "";
      state.bootstrap.isLoading = false;
      state.bootstrap.serverDate = "";
      state.bootstrap.serverTimeOffsetMs = 0;

      state.accountEditor = createAccountEditorState();
      state.templatePreview = createTemplatePreviewState();
      updateMetricBadges();
      syncPdfGenerationOverlay();
      syncAutoLogoutCountdown();
    }

    function normalizeAccountRecord(record = {}) {
      return {
        id: String(record.id || ""),
        name: String(record.name || ""),
        role: String(record.role || "조회용"),
        recentAccess: String(record.recentAccess || "-"),
      };
    }

    function applyBootstrapPayload(payload) {
      applySystemSettingsPayload(payload.systemSettings);
      applySystemBackupAutomationPayload(payload.systemBackupAutomation);
      state.superAdmin = createSuperAdminState({
        ...(payload.superAdminSettings || {}),
      });
      applyLoginNoticePayload(payload.loginNoticeHtml, { scope: "login" });
      applyLoginNoticePayload(payload.applicantNoticeHtml, { scope: "applicant" });
      const nextExamineeRows = Array.isArray(payload.examinees) ? payload.examinees.map(normalizeExamineeRecord) : [];
      const nextPrintHistoryRows = Array.isArray(payload.printHistory) ? payload.printHistory.map(normalizeExamineeRecord) : [];
      const nextAccountRows = Array.isArray(payload.accounts) ? payload.accounts.map(normalizeAccountRecord) : [];

      setExamineeGridRows(nextExamineeRows);
      setPrintHistoryRows(nextPrintHistoryRows);
      setAccountGridRows(nextAccountRows);
      setTemplateCards(Array.isArray(payload.templates) ? payload.templates : []);
      state.applicantManager = {
        ...state.applicantManager,
        fields: Array.isArray(payload.applicantManager?.fields) ? payload.applicantManager.fields : [],
        recruitmentUnits: Array.isArray(payload.applicantManager?.recruitmentUnits) ? payload.applicantManager.recruitmentUnits : [],
        schedules: Array.isArray(payload.applicantManager?.schedules) ? payload.applicantManager.schedules : [],

        submissions: Array.isArray(payload.applicantManager?.submissions) ? payload.applicantManager.submissions : [],
        settings: payload.applicantManager?.settings || createApplicantManagementState().settings,
      };
      state.bootstrap.serverDate = String(payload.serverDate || "").trim();
      state.bootstrap.serverTimeOffsetMs = Number(payload.serverTime || Date.now()) - Date.now();
      state.metrics = {
        registeredExaminees: Number(payload.summary?.registeredExaminees || nextExamineeRows.length),
        todayPrints: Number(payload.summary?.todayPrints || 0),
        totalPrints: Number(payload.summary?.totalPrints || nextPrintHistoryRows.length),
      };

      if (state.accountEditor.editingId && !getAccountGridRows().some((row) => row.id === state.accountEditor.editingId)) {
        cancelAccountEdit();
      }

      if (state.auth.currentUser?.id) {
        const currentAccount = getAccountGridRows().find((row) => row.id === state.auth.currentUser.id);

        if (currentAccount) {
          state.auth.currentUser = {
            ...state.auth.currentUser,
            name: currentAccount.name,
            role: currentAccount.role,
          };
        }
      }

      if (redirectToAccessibleRouteIfNeeded()) {
        return;
      }

      reconcileHeaderFilters();
      reconcileLookupFilters();
      persistHeaderFilters();
      updateMetricBadges();
    }

    return Object.freeze({
      applyBootstrapPayload,

      clearHeaderFilters,
      getCurrentUserRole,
      normalizeAccountRecord,
      normalizeExamineeRecord,
      persistHeaderFilters,

      resetBootstrapData,
      resetGridPages,
      updateMetricBadges,
    });
  }

  return Object.freeze({
    createBootstrapDataController,
    loadStoredHeaderFilters,
  });
});
