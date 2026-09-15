(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardStateFactories = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createHeaderFilters(fields = []) {
    return (Array.isArray(fields) ? fields : []).reduce((filters, field) => {
      if (field?.key) {
        filters[field.key] = "";
      }
      return filters;
    }, {});
  }

  function createLookupFilters(selectFields = [], textFields = []) {
    return [...(Array.isArray(selectFields) ? selectFields : []), ...(Array.isArray(textFields) ? textFields : [])].reduce(
      (filters, field) => {
        if (field?.key) {
          filters[field.key] = "";
        }
        return filters;
      },
      {},
    );
  }

  function normalizeGridSortDirection(direction) {
    return direction === "desc" ? "desc" : "asc";
  }

  function normalizeGridSortRules(rawRules) {
    if (!Array.isArray(rawRules)) {
      return [];
    }

    const sortRules = [];

    rawRules.forEach((rule) => {
      const key = String(rule?.key || "").trim();

      if (!key || sortRules.some((entry) => entry.key === key)) {
        return;
      }

      sortRules.push({
        key,
        direction: normalizeGridSortDirection(rule?.direction),
      });
    });

    return sortRules;
  }

  function buildInitialGridSortRules(options = {}) {
    if (Array.isArray(options.defaultSortRules)) {
      return normalizeGridSortRules(options.defaultSortRules);
    }

    if (options.defaultSortKey) {
      return normalizeGridSortRules([
        {
          key: options.defaultSortKey,
          direction: options.defaultSortDirection,
        },
      ]);
    }

    return [];
  }

  function createTableState(options = {}) {
    const defaultSortRules = buildInitialGridSortRules(options);

    return {
      page: 1,
      pageSize: 20,
      pageSizeMenuOpen: false,
      defaultSortRules,
      sortRules: normalizeGridSortRules(defaultSortRules),
      filterMenuKey: "",
      filterMenuSearch: "",
      filters: {},
      selectedRowIds: [],
      selectionAnchorRowId: "",
    };
  }

  function createTemplateEditorState() {
    return {
      activeTemplateId: "",
      name: "",
      description: "",
      version: "",
      draftHtml: "",
      lastValidHtml: "",
      hasOverflow: false,
      savedRange: null,
      historyEntries: [],
      historyIndex: -1,
      isRestoringHistory: false,
      statusMessage: "A4 세로 영역 안에서 편집 중입니다.",
      statusType: "",
      selectedImageElement: null,
      tableSelection: null,
      tableSelectionSession: null,
      tableResizeSession: null,
      imageMoveSession: null,
      imageResizeSession: null,
    };
  }

  function createTemplateCardEditorState() {
    return {
      activeTemplateId: "",
      field: "",
      draftValue: "",
      isSaving: false,
    };
  }

  function createTemplatePreviewState() {
    return {
      activeTemplateId: "",
      renderedHtml: "",
      examineeLabel: "",
      examineeNo: "",
    };
  }

  function createApplicantManagementState() {
    return {
      activeTab: "templates",
      settingsSection: "recruitment-units",
      expandedSubmissionId: 0,
      fields: [],
      recruitmentUnits: [],
      schedules: [],

      submissions: [],

      settings: {
        examNoPattern: "AD-{YY}{MM}{DD}-{SEQ:4}",
        examNoSequenceStart: 1,
      },
      fieldEditor: {
        isActive: false,
        isDraft: false,
        editingId: 0,
        questionText: "",
        questionDescription: "",
        inputType: "text",
        systemFieldKey: "",
        options: [],
        optionDraft: "",
        allowCustomOption: false,
        customOptionLabel: "",
        required: false,
      },
      recruitmentUnitEditor: {
        isActive: false,
        editingId: 0,
        trackName: "",
        admissionCode: "",
        admissionName: "",
        seriesCode: "",
        seriesName: "",
        unitCode: "",
        unitName: "",
        majorCode: "",
        majorName: "",
      },
      scheduleEditor: {
        isActive: false,
        isBulk: false,
        isSaving: false,
        editingId: 0,
        scheduleKey: "",
        targetScheduleKeys: [],
        trackName: "",
        admissionCode: "",
        admissionName: "",
        applicantScheduleStartAt: "",
        applicantScheduleEndAt: "",
        admitCardLookupScheduleStartAt: "",
        admitCardLookupScheduleEndAt: "",
        documentSubmissionScheduleStartAt: "",
        documentSubmissionScheduleEndAt: "",
      },

    };
  }

  function createAuthState() {
    return {
      status: "loading",
      currentUser: null,
      error: "",
      isSubmittingLogin: false,
      isSubmittingPasswordSetup: false,
      loginForm: {
        id: "",
        password: "",
      },
      passwordSetup: {
        password: "",
        passwordConfirm: "",
        error: "",
      },
    };
  }

  function normalizeSystemInitialPassword(value, defaultValue = "1111") {
    const normalizedValue = String(value ?? "").trim();
    return normalizedValue || defaultValue;
  }

  function normalizeSystemAutoLogoutMinutes(value, { defaultValue = 0, maxValue = 1440 } = {}) {
    const normalizedValue = Math.round(Number(value));

    if (!Number.isFinite(normalizedValue) || normalizedValue < 0) {
      return defaultValue;
    }

    return Math.min(maxValue, normalizedValue);
  }

  function normalizeSystemAdmissionHomepageUrl(value, { defaultValue = "" } = {}) {
    const normalizedValue = String(value ?? "").trim();
    return normalizedValue || defaultValue;
  }

  function getValidSystemScheduleReferenceDate(referenceDate = new Date()) {
    if (referenceDate instanceof Date && Number.isFinite(referenceDate.getTime())) {
      return referenceDate;
    }

    const parsedDate = new Date(referenceDate);
    return Number.isFinite(parsedDate.getTime()) ? parsedDate : new Date();
  }

  function getSystemApplicantScheduleDefaultRange(referenceDate = new Date()) {
    const validReferenceDate = getValidSystemScheduleReferenceDate(referenceDate);
    const year = validReferenceDate.getFullYear();

    return {
      startAt: `${year}-01-01T00:00`,
      endAt: `${year}-12-31T23:59`,
    };
  }

  function normalizeSystemApplicantScheduleDateTime(value, { defaultValue = "" } = {}) {
    const normalizedValue = String(value ?? "").trim();

    if (!normalizedValue) {
      return defaultValue;
    }

    const matchedValue = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

    if (!matchedValue) {
      return defaultValue;
    }

    const [, yearValue, monthValue, dayValue, hourValue, minuteValue] = matchedValue;
    const year = Number(yearValue);
    const month = Number(monthValue);
    const day = Number(dayValue);
    const hour = Number(hourValue);
    const minute = Number(minuteValue);
    const parsedDate = new Date(year, month - 1, day, hour, minute, 0, 0);

    if (
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() + 1 !== month ||
      parsedDate.getDate() !== day ||
      parsedDate.getHours() !== hour ||
      parsedDate.getMinutes() !== minute
    ) {
      return defaultValue;
    }

    return `${yearValue}-${monthValue}-${dayValue}T${hourValue}:${minuteValue}`;
  }

  function createEmptySystemApplicantScheduleParts() {
    return {
      year: "",
      month: "",
      day: "",
      hour: "",
      minute: "",
    };
  }

  function normalizeSystemApplicantScheduleParts(value, options = {}) {
    const normalizedValue = normalizeSystemApplicantScheduleDateTime(value, {
      defaultValue: options.defaultValue || "",
    });

    if (!normalizedValue) {
      return createEmptySystemApplicantScheduleParts();
    }

    const matchedValue = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

    if (!matchedValue) {
      return createEmptySystemApplicantScheduleParts();
    }

    const [, yearValue, monthValue, dayValue, hourValue, minuteValue] = matchedValue;

    return {
      year: yearValue,
      month: monthValue,
      day: dayValue,
      hour: hourValue,
      minute: minuteValue,
    };
  }

  function normalizeSystemApplicantExamNoDigitCount(value, { defaultValue = 10, maxValue = 30 } = {}) {
    const normalizedValue = Math.round(Number(value));

    if (!Number.isFinite(normalizedValue) || normalizedValue < 1) {
      return defaultValue;
    }

    return Math.min(maxValue, normalizedValue);
  }

  function normalizeSystemApplicantExamNoComponents(value, { defaultValue = ["admissionCode", "seriesCode", "unitCode", "sequence", ""] } = {}) {
    const sourceValues = Array.isArray(value) ? value : defaultValue;
    const allowedValues = new Set(["", "admissionCode", "seriesCode", "unitCode", "nationalityCode", "sequence"]);

    return Array.from({ length: 5 }, (_, index) => {
      const normalizedValue = String(sourceValues[index] ?? "").trim();
      return allowedValues.has(normalizedValue) ? normalizedValue : "";
    });
  }

  function normalizeSystemSettingsPayload(payload = {}, options = {}) {
    return {
      initialPassword: normalizeSystemInitialPassword(payload.initialPassword, options.defaultPassword),
      autoLogoutMinutes: String(
        normalizeSystemAutoLogoutMinutes(payload.autoLogoutMinutes, {
          defaultValue: options.defaultAutoLogoutMinutes,
          maxValue: options.maxAutoLogoutMinutes,
        }),
      ),
      admissionHomepageUrl: normalizeSystemAdmissionHomepageUrl(payload.admissionHomepageUrl, {
        defaultValue: options.defaultAdmissionHomepageUrl,
      }),
      applicantExamNoDigitCount: String(
        normalizeSystemApplicantExamNoDigitCount(payload.applicantExamNoDigitCount, {
          defaultValue: options.defaultApplicantExamNoDigitCount,
          maxValue: options.maxApplicantExamNoDigitCount,
        }),
      ),
      applicantExamNoComponents: normalizeSystemApplicantExamNoComponents(payload.applicantExamNoComponents, {
        defaultValue: options.defaultApplicantExamNoComponents,
      }),
    };
  }

  function cloneSystemSettingsSnapshot(snapshot = {}) {
    return {
      initialPassword: String(snapshot.initialPassword ?? ""),
      autoLogoutMinutes: String(snapshot.autoLogoutMinutes ?? ""),
      admissionHomepageUrl: String(snapshot.admissionHomepageUrl ?? ""),
      applicantExamNoDigitCount: String(snapshot.applicantExamNoDigitCount ?? ""),
      applicantExamNoComponents: Array.isArray(snapshot.applicantExamNoComponents)
        ? snapshot.applicantExamNoComponents.map((value) => String(value ?? ""))
        : ["admissionCode", "seriesCode", "unitCode", "sequence", ""],
    };
  }

  function createSystemSettingsState(payload = {}, options = {}) {
    const normalizedSettings = normalizeSystemSettingsPayload(payload, options);

    return {
      ...normalizedSettings,
      isSaving: false,
      hasUnsavedChanges: false,
      savedSnapshot: cloneSystemSettingsSnapshot(normalizedSettings),
      statusMessage: "",
      statusType: "",
    };
  }

  function createSystemDataDeletionState() {
    return {
      isBackingUp: false,
      isDeleting: false,
      isRestoring: false,
      isRestoreValidating: false,
      activeScope: "",
      backupAssetSelections: {
        database: true,
        "applicant-photos": true,
        "applicant-files": true,
      },
      restoreSelections: {
        database: true,
        "applicant-photos": true,
        "applicant-files": true,
      },
      restoreFile: null,
      restoreFileName: "",
      isRestoreFileValid: false,
      restoreValidationRequestId: 0,
      restoreValidationMessage: "",
      restoreValidationType: "",
      restoreValidationSummary: null,
      restoreUploadProgressPercent: 0,
      restoreUploadProgressLabel: "",
      lastBackupDownloadedAt: "",
      backupAutomation: {
        enabled: false,
        scheduleType: "daily",
        weeklyDay: 1,
        time: "03:00",
        retentionCount: 7,
        includeDatabase: true,
        includedAssetKeys: ["applicant-photos", "applicant-files"],
        lastRunAt: "",
        lastSuccessAt: "",
        lastFailureAt: "",
        lastErrorMessage: "",
        lastFileName: "",
        nextRunAt: "",
        isRunning: false,
        isSaving: false,
        hasUnsavedChanges: false,
        statusMessage: "",
        statusType: "",
        savedSnapshot: {
          enabled: false,
          scheduleType: "daily",
          weeklyDay: 1,
          time: "03:00",
          retentionCount: 7,
          includeDatabase: true,
          includedAssetKeys: ["applicant-photos", "applicant-files"],
        },
      },
      statusMessage: "",
      statusType: "",
    };
  }

  function createSystemAuditLogState() {
    return {
      rows: [],
      limit: 200,
      isLoading: false,
      hasLoaded: false,
      statusMessage: "",
      statusType: "",
      lastLoadedAt: "",
    };
  }

  function cloneSuperAdminSnapshot(snapshot = {}, normalizeSuperAdminSettings = null) {
    if (typeof normalizeSuperAdminSettings === "function") {
      return normalizeSuperAdminSettings(snapshot);
    }

    return Object.freeze({
      schoolName: "",
      logoImageUrl: "",
      backgroundImageUrl: "",
      recruitmentEnabled: true,
    });
  }

  function createSuperAdminState(payload = {}, options = {}) {
    const settings = cloneSuperAdminSnapshot(payload, options.normalizeSuperAdminSettings);

    return {
      schoolName: settings.schoolName,
      logoImageUrl: settings.logoImageUrl,
      backgroundImageUrl: settings.backgroundImageUrl,
      recruitmentEnabled: settings.recruitmentEnabled,
      savedSnapshot: cloneSuperAdminSnapshot(settings, options.normalizeSuperAdminSettings),
      isSaving: false,
      uploadingField: "",
      hasUnsavedChanges: false,
      statusMessage: "",
      statusType: "",
    };
  }

  function createToastState() {
    return {
      visible: false,
      message: "",
      type: "success",
    };
  }

  function getDefaultLoginNoticeHtml(initialPassword = "1111") {
    return [
      '<p><span style="display:inline-flex;padding:3px 8px;border-radius:6px;background:#2f63c8;color:#fff;font-weight:800;">계정 안내</span></p>',
      "<p><strong>ID : 계정 관리에 등록된 계정 ID</strong></p>",
      `<p><strong>PW : ${initialPassword}(초기 비밀번호)</strong></p>`,
      "<p>최초 로그인 시 비밀번호를 변경해야 서비스를 사용할 수 있습니다.</p>",
    ].join("");
  }

  function getDefaultApplicantNoticeHtml() {
    return [
      '<p><span style="display:inline-flex;padding:3px 8px;border-radius:6px;background:#2f63c8;color:#fff;font-weight:800;">접수 안내</span></p>',
      "<p>이메일 인증 후 접수를 진행하고, 접수 완료 후 수험표를 열람하고 인쇄할 수 있습니다.</p>",
      "<p>수험표 조회 기간에 접수 이력을 기준으로 수험표 PDF가 표시됩니다.</p>",
    ].join("");
  }

  function normalizeLoginNoticeHtml(html = "", { fallbackHtml = "" } = {}) {
    const normalizedHtml = String(html || "");
    const resolvedFallback = String(fallbackHtml || getDefaultLoginNoticeHtml()).trim() || getDefaultLoginNoticeHtml();
    return normalizedHtml.trim() ? normalizedHtml : resolvedFallback;
  }

  function createNoticeEditorState(initialHtml = "", { fallbackHtml = "", defaultHtml = "", statusLabel = "로그인화면" } = {}) {
    const resolvedDefaultHtml = String(defaultHtml || "").trim() || getDefaultLoginNoticeHtml();
    const storedHtml = normalizeLoginNoticeHtml(initialHtml || resolvedDefaultHtml, {
      fallbackHtml: fallbackHtml || resolvedDefaultHtml,
    });

    return {
      savedHtml: storedHtml,
      draftHtml: storedHtml,
      selectionSnapshot: null,
      historyEntries: [
        {
          html: storedHtml,
          selection: null,
        },
      ],
      historyIndex: 0,
      isRestoringHistory: false,
      selectedImageElement: null,
      statusMessage: `${String(statusLabel || "로그인화면")} 공지사항을 편집 중입니다.`,
      statusType: "",
    };
  }

  function createLoginNoticeState(initialHtml = "", { fallbackHtml = "", defaultHtml = "" } = {}) {
    return createNoticeEditorState(initialHtml, {
      fallbackHtml,
      defaultHtml: defaultHtml || getDefaultLoginNoticeHtml(),
      statusLabel: "로그인화면",
    });
  }

  function createApplicantNoticeState(initialHtml = "", { fallbackHtml = "", defaultHtml = "" } = {}) {
    return createNoticeEditorState(initialHtml, {
      fallbackHtml,
      defaultHtml: defaultHtml || getDefaultApplicantNoticeHtml(),
      statusLabel: "접수화면",
    });
  }

  function createBatchPrintState() {
    return {
      isLoading: false,
      isCancelling: false,
      outputMode: "combined-pdf",
    };
  }

  function createPdfGenerationState() {
    return {
      isActive: false,
      message: "",
      progressMode: "hidden",
      progressValue: 0,
      progressLabel: "",
      isCancelable: false,
      isCanceling: false,
      cancelLabel: "작업 취소",
    };
  }

  function createAccountEditorState() {
    return {
      editingId: "",
      draftName: "",
      draftRole: "관리자",
    };
  }

  return {
    buildInitialGridSortRules,
    createAccountEditorState,
    createApplicantNoticeState,
    createApplicantManagementState,
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
    getDefaultApplicantNoticeHtml,
    getDefaultLoginNoticeHtml,
    normalizeGridSortDirection,
    normalizeGridSortRules,
    normalizeLoginNoticeHtml,
    normalizeSystemAutoLogoutMinutes,
    normalizeSystemAdmissionHomepageUrl,
    normalizeSystemApplicantScheduleDateTime,
    normalizeSystemApplicantScheduleParts,
    normalizeSystemInitialPassword,
    normalizeSystemSettingsPayload,
  };
});
