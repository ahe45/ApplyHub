(function () {
  const applicantFormConfig = globalThis.AdmitCardApplicantFormConfig || {};
  const apiClientModule = globalThis.AdmitCardApiClient || {};
  const loginNoticeLinkUtilsModule = globalThis.AdmitCardLoginNoticeLinkUtils || {};
  const applicantPublicConstantsModule = globalThis.AdmitCardApplicantPublicConstants || {};
  const applicantPublicRenderingHelpersModule = globalThis.AdmitCardApplicantPublicRenderingHelpers || {};
  const applicantPublicUploadHelpersModule = globalThis.AdmitCardApplicantPublicUploadHelpers || {};
  const findApplicantScheduleRecord = applicantFormConfig.findApplicantScheduleRecord || (() => null);
  const getApplicantAggregateScheduleState =
    applicantFormConfig.getApplicantAggregateScheduleState ||
    (() => ({
      isConfigured: false,
      isOpen: false,
      reason: "not_configured",
      applicantScheduleStartAt: "",
      applicantScheduleEndAt: "",
      admitCardLookupScheduleStartAt: "",
      admitCardLookupScheduleEndAt: "",
    }));
  const getApplicantSubmissionScheduleStateForSchedule =
    applicantFormConfig.getApplicantSubmissionScheduleState ||
    ((schedule = {}) => ({
      applicantScheduleStartAt: String(schedule?.applicantScheduleStartAt || "").trim(),
      applicantScheduleEndAt: String(schedule?.applicantScheduleEndAt || "").trim(),
      isConfigured: false,
      isOpen: false,
      reason: "not_configured",
    }));
  const getApplicantLookupScheduleStateForSchedule =
    applicantFormConfig.getApplicantAdmitCardLookupScheduleState ||
    ((schedule = {}) => ({
      admitCardLookupScheduleStartAt: String(schedule?.admitCardLookupScheduleStartAt || "").trim(),
      admitCardLookupScheduleEndAt: String(schedule?.admitCardLookupScheduleEndAt || "").trim(),
      isConfigured: false,
      isOpen: false,
      reason: "not_configured",
    }));

  if (!apiClientModule?.buildApiUrl || !apiClientModule?.apiRequest) {
    throw new Error("client/app/api-client.js must be loaded before applicant-page.js.");
  }

  if (!applicantPublicConstantsModule?.createApplicantPublicRuntimeConstants) {
    throw new Error("client/features/applicant-public/constants.js must be loaded before applicant-page.js.");
  }

  if (
    !applicantPublicRenderingHelpersModule?.escapeHtml ||
    !applicantPublicRenderingHelpersModule?.escapeAttribute ||
    !applicantPublicRenderingHelpersModule?.renderApplicantHomeActionButtonLabel
  ) {
    throw new Error("client/features/applicant-public/rendering-helpers.js must be loaded before applicant-page.js.");
  }

  if (!applicantPublicUploadHelpersModule?.createApplicantPublicUploadHelpers) {
    throw new Error("client/features/applicant-public/upload-helpers.js must be loaded before applicant-page.js.");
  }

  const { buildApiUrl, apiRequest } = apiClientModule;
  let membership = null;
  const { buildLoginNoticeMarkup } = loginNoticeLinkUtilsModule;
  const { escapeAttribute, escapeHtml, renderApplicantHomeActionButtonLabel } = applicantPublicRenderingHelpersModule;
  const {
    buildApplicantUploadDraftValue,
    canPreviewApplicantPdfUploadValue,
    createApplicantPdfPreviewFile,
    createApplicantPdfPreviewState,
    getApplicantUploadFieldValueLabel,
    isApplicantBlobInstance,
    isApplicantFileInstance,
    isApplicantMobilePdfPreviewEnvironment,
    isApplicantUploadField,
    readFileAsBase64,
    revokeApplicantPdfPreviewObjectUrl,
  } = applicantPublicUploadHelpersModule.createApplicantPublicUploadHelpers();
  const root = document.getElementById("applicantPageRoot");

  if (!root) {
    return;
  }

  const APPLICANT_IS_PREVIEW_MODE = new URLSearchParams(window.location.search).get("preview") === "1";
  const APPLICANT_IS_THUMBNAIL = APPLICANT_IS_PREVIEW_MODE && new URLSearchParams(window.location.search).get("thumbnail") === "1";
  document.documentElement.classList.toggle("applicant-template-thumbnail", APPLICANT_IS_THUMBNAIL);
  const APPLICANT_PREVIEW_TEMPLATE_ID = APPLICANT_IS_PREVIEW_MODE ? Number(new URLSearchParams(window.location.search).get("templateId")) : 0;
  const recruitmentSummaryObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => fitRecruitmentSummaryValues()) : null;
  document.fonts?.ready.then(() => fitRecruitmentSummaryValues());
  document.fonts?.addEventListener('loadingdone', () => fitRecruitmentSummaryValues());
  const APPLICANT_FORM_TEST_ENTRY_VISIBLE = false;
  const {
    APPLICANT_PREVIEW_SEARCH,
    APPLICANT_PUBLIC_STATE_STORAGE_KEY,
  } = applicantPublicConstantsModule.createApplicantPublicRuntimeConstants({
    isPreviewMode: APPLICANT_IS_PREVIEW_MODE,
  });
  const {
    APPLICANT_CUSTOM_SELECT_VALUE,
    APPLICANT_HISTORY_STATE_MARKER,
    APPLICANT_LOOKUP_TARGETS,
    APPLICANT_PAGE_TITLES,
    APPLICANT_PREVIEW_STATE_STORAGE_KEY,
    APPLICANT_RECRUITMENT_SELECTION_FIELDS,
    APPLICANT_ROUTE_PATHS,
    APPLICANT_SUMMARY_PRIORITY_SYSTEM_FIELDS,
    DEFAULT_LOGIN_BACKGROUND_PATH,
    DEFAULT_LOGIN_BRAND_MARK_PATH,
  } = applicantPublicConstantsModule;
  const INITIAL_SUPER_ADMIN_SETTINGS =
    globalThis.AdmitCardInitialSuperAdminSettings && typeof globalThis.AdmitCardInitialSuperAdminSettings === "object"
      ? globalThis.AdmitCardInitialSuperAdminSettings
      : {};
  let verificationCountdownTimerId = 0;
  const VERIFICATION_CODE_LENGTH = 6;
  const VERIFICATION_RESEND_DELAY_MS = 10_000;
  let applicantToastTimerId = 0;
  const applicantToastRoot =
    document.getElementById("applicantPublicToastRoot") ||
    (() => {
      const toastElement = document.createElement("div");
      toastElement.id = "applicantPublicToastRoot";
      toastElement.className = "applicant-public-toast-root";
      toastElement.setAttribute("aria-live", "polite");
      toastElement.setAttribute("aria-atomic", "true");
      document.body.appendChild(toastElement);
      return toastElement;
    })();

  const state = {
    mode: "home",
    isLoadingForm: true,
    loadError: "",
    formConfig: {
      fields: [],
      documentFields: [],
      recruitmentUnits: [],
      schedules: [],
      settings: {},
      superAdminSettings: {
        logoImageUrl: String(INITIAL_SUPER_ADMIN_SETTINGS?.logoImageUrl || "").trim(),
        backgroundImageUrl: String(INITIAL_SUPER_ADMIN_SETTINGS?.backgroundImageUrl || "").trim(),
      },
      systemSettings: {
        admissionHomepageUrl: "",
      },
      noticeHtml: "",
      noticeHtmlEn: "",
    },
    message: {
      type: "",
      text: "",
    },
    dialog: {
      isOpen: false,
      title: "",
      message: "",
    },
    verification: {
      name: "",
      email: "",
      code: "",
      debugCode: "",
      expiresAt: 0,
      resendAvailableAt: 0,
      isSending: false,
      isVerifying: false,
    },
    lookup: {
      target: APPLICANT_LOOKUP_TARGETS.result,
      name: "",
      email: "",
      password: "",
      isLoading: false,
    },
    identity: {
      name: "",
      email: "",
      accessToken: "",
      submissionId: 0,
      source: "",
    },
    recruitment: {
      track: "",
      admission: "",
      series: "",
      unit: "",
      major: "",
    },
    application: {
      password: "",
      passwordConfirm: "",
      passwordConfirmTouched: false,
    },
    nationalityPicker: {
      openFieldKey: "",
    },
    pdfPreview: createApplicantPdfPreviewState(),
    fieldUi: {
      dateParts: {},
      customSelectModes: {},
    },
    currentSubmission: null,
    draftAnswers: {},
    isSaving: false,
  };

  function createApplicantHistoryState(overrides = {}) {
    return {
      [APPLICANT_HISTORY_STATE_MARKER]: true,
      mode: getGuardedApplicantMode(overrides.mode ?? state.mode),
    };
  }

  function normalizeApplicantLookupTarget(value = "") {
    return String(value || "").trim() === APPLICANT_LOOKUP_TARGETS.ticket
      ? APPLICANT_LOOKUP_TARGETS.ticket
      : APPLICANT_LOOKUP_TARGETS.result;
  }

  function getApplicantLookupResultMode(target = state.lookup.target) {
    return normalizeApplicantLookupTarget(target) === APPLICANT_LOOKUP_TARGETS.ticket ? "lookup-ticket" : "lookup-summary";
  }

  function syncApplicantLookupTargetWithMode(mode = "") {
    if (mode === "lookup-ticket") {
      state.lookup.target = APPLICANT_LOOKUP_TARGETS.ticket;
      return;
    }

    if (mode === "lookup-summary") {
      state.lookup.target = APPLICANT_LOOKUP_TARGETS.result;
    }
  }

  function getApplicantLookupScreenCopy(target = state.lookup.target) {
    const normalizedTarget = normalizeApplicantLookupTarget(target);

    if (normalizedTarget === APPLICANT_LOOKUP_TARGETS.ticket) {
      return {
        heading: "수험표 조회",
        description: "이름, 이메일, 비밀번호를 입력하면 일치하는 최신 접수 내역 기준으로 수험표를 조회합니다.",
      };
    }

    return {
      heading: "접수결과 조회",
      description: "이름, 이메일, 비밀번호를 입력하면 일치하는 최신 접수 내역의 접수 결과를 조회합니다.",
    };
  }

  function normalizeApplicantBrandSettings(settings = {}) {
    return {
      logoImageUrl: String(settings?.logoImageUrl || "").trim(),
      backgroundImageUrl: String(settings?.backgroundImageUrl || "").trim(),
      recruitmentEnabled: settings?.recruitmentEnabled !== false,
    };
  }

  function getApplicantBrandSettings() {
    return normalizeApplicantBrandSettings(state.formConfig?.superAdminSettings || {});
  }

  function getApplicantBrandLogoUrl() {
    return getApplicantBrandSettings().logoImageUrl || DEFAULT_LOGIN_BRAND_MARK_PATH;
  }

  function getApplicantBrandBackgroundUrl() {
    return getApplicantBrandSettings().backgroundImageUrl || DEFAULT_LOGIN_BACKGROUND_PATH;
  }

  function getApplicantBackgroundMediaElement() {
    let backgroundMediaElement = document.getElementById("applicantPublicBackgroundMedia");

    if (backgroundMediaElement instanceof HTMLElement) {
      return backgroundMediaElement;
    }

    backgroundMediaElement = document.createElement("div");
    backgroundMediaElement.id = "applicantPublicBackgroundMedia";
    backgroundMediaElement.className = "applicant-public-background-media";
    backgroundMediaElement.setAttribute("aria-hidden", "true");
    backgroundMediaElement.innerHTML = `<img class="applicant-public-background-image" alt="" />`;
    document.body.prepend(backgroundMediaElement);
    return backgroundMediaElement;
  }

  function syncApplicantBranding() {
    const bodyElement = document.body;

    if (!(bodyElement instanceof HTMLElement)) {
      return;
    }

    const backgroundImageUrl = getApplicantBrandBackgroundUrl();

    const backgroundMediaElement = getApplicantBackgroundMediaElement();
    const backgroundImageElement = backgroundMediaElement.querySelector(".applicant-public-background-image");

    if (!(backgroundImageElement instanceof HTMLImageElement)) {
      return;
    }

    if (backgroundImageElement.getAttribute("src") !== backgroundImageUrl) {
      backgroundImageElement.setAttribute("src", backgroundImageUrl);
    }
  }

  function stopVerificationCountdown() {
    if (verificationCountdownTimerId) {
      window.clearInterval(verificationCountdownTimerId);
      verificationCountdownTimerId = 0;
    }
  }

  function getVerificationRemainingSeconds() {
    const expiresAt = Number(state.verification.expiresAt || 0);

    if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
      return 0;
    }

    return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  }

  function isVerificationCodeExpired() {
    return getVerificationRemainingSeconds() <= 0;
  }

  function formatVerificationCountdown(seconds = 0) {
    const normalizedSeconds = Math.max(0, Number(seconds || 0));
    const minutes = Math.floor(normalizedSeconds / 60);
    const remainingSeconds = normalizedSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  function getVerificationCountdownUiState() {
    const expiresAt = Number(state.verification.expiresAt || 0);
    const remainingSeconds = getVerificationRemainingSeconds();

    if (expiresAt <= 0) {
      return {
        shouldShow: false,
        isExpired: false,
        text: "",
      };
    }

    if (remainingSeconds > 0) {
      return {
        shouldShow: true,
        isExpired: false,
        text: `인증코드 만료까지 ${formatVerificationCountdown(remainingSeconds)}`,
      };
    }

    return {
      shouldShow: true,
      isExpired: true,
      text: "인증 코드가 만료되었습니다. 새 코드를 다시 생성하세요.",
    };
  }

  function renderVerificationCountdownMarkup() {
    const countdownState = getVerificationCountdownUiState();

    if (!countdownState.shouldShow) {
      return "";
    }

    return `<span class="applicant-public-verification-timer${countdownState.isExpired ? " is-expired" : ""}" data-applicant-verification-timer="true">${escapeHtml(countdownState.text)}</span>`;
  }

  function syncVerificationCountdownUi() {
    syncVerificationButtons();
    const verificationCodeInput = document.getElementById("verificationCode");
    const verificationField = verificationCodeInput?.closest(".applicant-public-field") || null;
    const existingTimerElement = verificationField?.querySelector("[data-applicant-verification-timer='true']") || null;
    const countdownState = getVerificationCountdownUiState();

    if (!verificationField || state.mode !== "verify") {
      existingTimerElement?.remove();
      return;
    }

    if (!countdownState.shouldShow) {
      existingTimerElement?.remove();
      return;
    }

    if (existingTimerElement) {
      existingTimerElement.textContent = countdownState.text;
      existingTimerElement.classList.toggle("is-expired", countdownState.isExpired);
      return;
    }

    const timerElement = document.createElement("span");
    const debugCodeNote = verificationField.querySelector(".applicant-public-file-note");

    timerElement.dataset.applicantVerificationTimer = "true";
    timerElement.className = `applicant-public-verification-timer${countdownState.isExpired ? " is-expired" : ""}`;
    timerElement.textContent = countdownState.text;

    if (debugCodeNote) {
      verificationField.insertBefore(timerElement, debugCodeNote);
      return;
    }

    verificationField.appendChild(timerElement);
  }

  function syncVerificationCountdown() {
    const shouldRun = state.mode === "verify" && (getVerificationResendSeconds() > 0 || !isVerificationCodeExpired());

    if (!shouldRun) {
      stopVerificationCountdown();
      syncVerificationCountdownUi();
      return;
    }

    if (verificationCountdownTimerId) {
      syncVerificationCountdownUi();
      return;
    }

    syncVerificationCountdownUi();
    verificationCountdownTimerId = window.setInterval(() => {
      if (state.mode !== "verify") {
        stopVerificationCountdown();
        return;
      }

      syncVerificationCountdownUi();

      if (isVerificationCodeExpired() && getVerificationResendSeconds() === 0) {
        stopVerificationCountdown();
      }
    }, 1000);
  }

  function getVerificationResendSeconds() {
    let availableAt = Number(state.verification.resendAvailableAt || 0);
    try { availableAt = Math.max(availableAt, Number(sessionStorage.getItem('applyhub.applicant-verification-resend-at')) || 0); } catch { /* Use in-memory cooldown when storage is blocked. */ }
    return Math.max(0, Math.ceil((availableAt - Date.now()) / 1000));
  }

  function canVerifyCode() {
    return new RegExp(`^[0-9]{${VERIFICATION_CODE_LENGTH}}$`).test(state.verification.code)
      && !isVerificationCodeExpired() && !state.verification.isSending && !state.verification.isVerifying
      && getApplicantFormEditAvailabilityState().isEditable;
  }

  function syncVerificationButtons() {
    if (state.mode !== 'verify') return;
    const sendButton = root.querySelector('[data-applicant-action="send-code"]');
    const seconds = getVerificationResendSeconds();
    if (sendButton) {
      sendButton.disabled = state.verification.isSending || state.verification.isVerifying || seconds > 0 || !getApplicantFormEditAvailabilityState().isEditable;
      sendButton.textContent = state.verification.isSending ? '발송 중...' : seconds > 0 ? `재발송까지 ${seconds}초` : Number(state.verification.expiresAt || 0) > 0 ? '인증코드 재발송' : '인증코드 발송';
    }
    const verifyButton = root.querySelector('[data-applicant-form="verify-code"] button[type="submit"]');
    if (verifyButton) verifyButton.disabled = !canVerifyCode();
  }

  function normalizeApplicantRoutePath(pathname = "") {
    return `/${String(pathname || "/applicant").trim()}`
      .replace(/\/{2,}/g, "/")
      .replace(/\/+$/g, "") || APPLICANT_ROUTE_PATHS.home;
  }

  function getApplicantModeFromPathname(pathname = "") {
    const normalizedPathname = normalizeApplicantRoutePath(pathname);
    const matchedRouteEntry =
      Object.entries(APPLICANT_ROUTE_PATHS).find(([, routePath]) => routePath === normalizedPathname) || null;

    return matchedRouteEntry?.[0] || "home";
  }

  function getApplicantRoutePath(mode = "") {
    return APPLICANT_ROUTE_PATHS[String(mode || "").trim()] || APPLICANT_ROUTE_PATHS.home;
  }

  function updateApplicantDocumentTitle() {
    const pageTitle = APPLICANT_PAGE_TITLES[state.mode] || APPLICANT_PAGE_TITLES.home;
    document.title = `${pageTitle} | 원서접수시스템`;
  }

  function getApplicantFormFieldByKey(fieldKey = "") {
    const normalizedFieldKey = String(fieldKey || "").trim();
    return getAllApplicantFields().find((field) => String(field?.fieldKey || "").trim() === normalizedFieldKey) || null;
  }

  function getAllApplicantFields() {
    return [...(state.formConfig.fields || []), ...(state.formConfig.documentFields || [])];
  }

  function getTemplateFields(formScope) {
    const fields = formScope === 'documents' ? state.formConfig.documentFields || [] : state.formConfig.fields || [];
    const selection = state.currentSubmission?.id
      ? { ...getApplicantRecruitmentSelectionFromSubmission(state.currentSubmission), ...state.currentSubmission.fieldOverrides }
      : state.recruitment;
    const schedule = findApplicantScheduleRecord(getApplicantSchedules(), selection);
    const previewId = APPLICANT_PREVIEW_TEMPLATE_ID;
    const templateId = previewId || schedule?.[formScope === 'documents' ? 'documentTemplateId' : 'applicationTemplateId']
      || state.formConfig.formTemplates?.find(item => item.formScope === formScope && item.isDefault)?.id;
    return templateId ? fields.filter(field => Number(field.templateId) === Number(templateId)) : fields;
  }

  function getActiveApplicantFields() {
    return getTemplateFields(state.mode === 'documents' ? 'documents' : 'application');
  }

  function createSerializableDraftAnswers() {
    return Object.fromEntries(
      Object.entries(state.draftAnswers || {}).map(([fieldKey, value]) => {
        const field = getApplicantFormFieldByKey(fieldKey);

        if (isApplicantUploadField(field) && value && typeof value === "object") {
          return [fieldKey, buildApplicantUploadDraftValue(field.inputType, value)];
        }

        if (value && typeof value === "object") {
          return [
            fieldKey,
            {
              ...value,
            },
          ];
        }

        return [fieldKey, value];
      }),
    );
  }

  function createSerializableApplicantFieldUi() {
    const rawDateParts = state.fieldUi?.dateParts && typeof state.fieldUi.dateParts === "object" ? state.fieldUi.dateParts : {};
    const rawCustomSelectModes =
      state.fieldUi?.customSelectModes && typeof state.fieldUi.customSelectModes === "object" ? state.fieldUi.customSelectModes : {};

    return {
      dateParts: Object.fromEntries(
        Object.entries(rawDateParts).map(([fieldKey, value]) => [
          fieldKey,
          {
            year: String(value?.year || ""),
            month: String(value?.month || ""),
            day: String(value?.day || ""),
          },
        ]),
      ),
      customSelectModes: Object.fromEntries(
        Object.entries(rawCustomSelectModes).map(([fieldKey, value]) => [fieldKey, value === true]),
      ),
    };
  }

  function persistApplicantPublicState() {
    if (APPLICANT_IS_THUMBNAIL) return;
    try {
      window.sessionStorage.setItem(
        APPLICANT_PUBLIC_STATE_STORAGE_KEY,
        JSON.stringify({
          verification: {
            name: state.verification.name,
            email: state.verification.email,
            code: state.verification.code,
            debugCode: state.verification.debugCode,
            expiresAt: Number(state.verification.expiresAt || 0),
            resendAvailableAt: Number(state.verification.resendAvailableAt || 0),
          },
          lookup: {
            target: normalizeApplicantLookupTarget(state.lookup.target),
            name: state.lookup.name,
            email: state.lookup.email,
          },
          identity: {
            name: state.identity.name,
            email: state.identity.email,
            accessToken: state.identity.accessToken,
            submissionId: state.identity.submissionId,
            source: state.identity.source,
          },
          recruitment: {
            track: String(state.recruitment.track || ""),
            admission: String(state.recruitment.admission || ""),
            series: String(state.recruitment.series || ""),
            unit: String(state.recruitment.unit || ""),
            major: String(state.recruitment.major || ""),
          },
          currentSubmission: state.currentSubmission,
          draftAnswers: createSerializableDraftAnswers(),
          fieldUi: createSerializableApplicantFieldUi(),
        }),
      );
    } catch (error) {
      // Ignore storage errors in private browsing or restricted contexts.
    }
  }

  function restoreApplicantPublicState() {
    try {
      const rawSnapshot = window.sessionStorage.getItem(APPLICANT_PUBLIC_STATE_STORAGE_KEY);

      if (!rawSnapshot) {
        return;
      }

      const snapshot = JSON.parse(rawSnapshot);

      if (snapshot?.verification && typeof snapshot.verification === "object") {
        state.verification = {
          ...state.verification,
          name: String(snapshot.verification.name || ""),
          email: String(snapshot.verification.email || ""),
          code: String(snapshot.verification.code || ""),
          debugCode: String(snapshot.verification.debugCode || ""),
          expiresAt: Number(snapshot.verification.expiresAt || 0),
          resendAvailableAt: Number(snapshot.verification.resendAvailableAt || 0),
          isSending: false,
          isVerifying: false,
        };
      }

      if (snapshot?.lookup && typeof snapshot.lookup === "object") {
        state.lookup = {
          ...state.lookup,
          target: normalizeApplicantLookupTarget(snapshot.lookup.target),
          name: String(snapshot.lookup.name || ""),
          email: String(snapshot.lookup.email || ""),
          password: "",
          isLoading: false,
        };
      }

      if (snapshot?.identity && typeof snapshot.identity === "object") {
        state.identity = {
          name: String(snapshot.identity.name || ""),
          email: String(snapshot.identity.email || ""),
          accessToken: String(snapshot.identity.accessToken || ""),
          submissionId: Number(snapshot.identity.submissionId || 0),
          source: String(snapshot.identity.source || ""),
        };
      }

      if (snapshot?.recruitment && typeof snapshot.recruitment === "object") {
        state.recruitment = {
          track: String(snapshot.recruitment.track || ""),
          admission: String(snapshot.recruitment.admission || ""),
          series: String(snapshot.recruitment.series || ""),
          unit: String(snapshot.recruitment.unit || ""),
          major: String(snapshot.recruitment.major || ""),
        };
      }

      if (snapshot?.currentSubmission && typeof snapshot.currentSubmission === "object") {
        state.currentSubmission = snapshot.currentSubmission;
      }

      if (snapshot?.draftAnswers && typeof snapshot.draftAnswers === "object") {
        state.draftAnswers = snapshot.draftAnswers;
      }

      if (snapshot?.fieldUi && typeof snapshot.fieldUi === "object") {
        state.fieldUi = {
          dateParts:
            snapshot.fieldUi.dateParts && typeof snapshot.fieldUi.dateParts === "object"
              ? snapshot.fieldUi.dateParts
              : {},
          customSelectModes:
            snapshot.fieldUi.customSelectModes && typeof snapshot.fieldUi.customSelectModes === "object"
              ? snapshot.fieldUi.customSelectModes
              : {},
        };
      }
    } catch (error) {
      // Ignore invalid storage payloads and continue with a clean state.
    }
  }

  function canAccessApplicantForm() {
    return APPLICANT_IS_PREVIEW_MODE || Boolean(state.identity.accessToken && state.identity.email);
  }

  function canAccessApplicantSelection() {
    return canAccessApplicantForm();
  }

  function hasApplicantFormConfigured() {
    return Array.isArray(state.formConfig.fields) && state.formConfig.fields.length > 0;
  }

  function normalizeApplicantScheduleDateTime(value, { defaultValue = "" } = {}) {
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

  function formatApplicantScheduleDateTime(value) {
    const normalizedValue = normalizeApplicantScheduleDateTime(value);

    if (!normalizedValue) {
      return "";
    }

    const [dateValue, timeValue] = normalizedValue.split("T");
    return `${String(dateValue || "").replaceAll("-", ".")} ${String(timeValue || "")}`;
  }

  function getApplicantSchedules() {
    return Array.isArray(state.formConfig.schedules) ? state.formConfig.schedules : [];
  }

  function isApplicantRecruitmentUnitOpen(unit = {}, referenceDate = new Date()) {
    const matchedSchedule = findApplicantScheduleRecord(getApplicantSchedules(), unit);
    return getApplicantSubmissionScheduleStateForSchedule(matchedSchedule, referenceDate).isOpen === true;
  }

  function getApplicantRecruitmentScheduleTarget(selection = state.recruitment) {
    const track = String(selection?.track || "").trim();
    const admission = String(selection?.admission || "").trim();

    if (!track || !admission) {
      return null;
    }

    return {
      track,
      admission,
    };
  }

  function getApplicantEditableScheduleTarget() {
    return getApplicantRecruitmentScheduleTarget() || state.currentSubmission;
  }

  function getApplicantSubmissionScheduleState(referenceDate = new Date(), target = getApplicantEditableScheduleTarget()) {
    if (target) {
      return getApplicantSubmissionScheduleStateForSchedule(findApplicantScheduleRecord(getApplicantSchedules(), target), referenceDate);
    }

    return getApplicantAggregateScheduleState(getApplicantSchedules(), "submission", referenceDate);
  }

  function getApplicantSubmissionSchedulePeriodLabel(scheduleState = getApplicantSubmissionScheduleState()) {
    if (!scheduleState.isConfigured || !scheduleState.applicantScheduleStartAt || !scheduleState.applicantScheduleEndAt) {
      return "";
    }

    return `${formatApplicantScheduleDateTime(scheduleState.applicantScheduleStartAt)} ~ ${formatApplicantScheduleDateTime(scheduleState.applicantScheduleEndAt)}`;
  }

  function getApplicantLookupScheduleState(referenceDate = new Date(), target = null) {
    if (target) {
      return getApplicantLookupScheduleStateForSchedule(findApplicantScheduleRecord(getApplicantSchedules(), target), referenceDate);
    }

    return getApplicantAggregateScheduleState(getApplicantSchedules(), "lookup", referenceDate);
  }

  function getApplicantLookupSchedulePeriodLabel(scheduleState = getApplicantLookupScheduleState()) {
    if (!scheduleState.isConfigured || !scheduleState.admitCardLookupScheduleStartAt || !scheduleState.admitCardLookupScheduleEndAt) {
      return "";
    }

    return `${formatApplicantScheduleDateTime(scheduleState.admitCardLookupScheduleStartAt)} ~ ${formatApplicantScheduleDateTime(scheduleState.admitCardLookupScheduleEndAt)}`;
  }

  function getApplicantApplyAvailabilityState({ target = getApplicantEditableScheduleTarget() } = {}) {
    const scheduleState = getApplicantSubmissionScheduleState(new Date(), target);
    const isFormConfigured = hasApplicantFormConfigured();
    const isAvailable =
      !state.isLoadingForm &&
      !state.loadError &&
      isFormConfigured &&
      scheduleState.isOpen;

    return {
      isAvailable,
      isFormConfigured,
      scheduleState,
    };
  }

  function getApplicantLookupAvailabilityState({ target = null } = {}) {
    const scheduleState = getApplicantLookupScheduleState(new Date(), target);
    const isAvailable = !state.loadError && scheduleState.isOpen;

    return {
      isAvailable,
      scheduleState,
    };
  }

  function getApplicantResultLookupAvailabilityState() {
    return {
      isAvailable: true,
      reason: "open",
    };
  }

  function getApplicantApplyDisabledMessage(applyAvailabilityState = getApplicantApplyAvailabilityState()) {
    if (state.isLoadingForm) {
      return "접수 양식을 불러오는 중입니다.";
    }

    if (state.loadError) {
      return state.loadError || "접수 페이지를 준비하지 못했습니다.";
    }

    if (!applyAvailabilityState.isFormConfigured) {
      return "접수 양식이 아직 설정되지 않았습니다.";
    }

    if (applyAvailabilityState.scheduleState.reason === "not_configured") {
      return "접수 기간이 아직 설정되지 않았습니다.";
    }

    if (applyAvailabilityState.scheduleState.reason === "before_start") {
      const periodLabel = getApplicantSubmissionSchedulePeriodLabel(applyAvailabilityState.scheduleState);
      return `아직 접수 기간이 아닙니다.${periodLabel ? ` 접수 가능 기간: ${periodLabel}` : ""}`;
    }

    if (applyAvailabilityState.scheduleState.reason === "after_end") {
      const periodLabel = getApplicantSubmissionSchedulePeriodLabel(applyAvailabilityState.scheduleState);
      return `접수 기간이 종료되었습니다.${periodLabel ? ` 접수 가능 기간: ${periodLabel}` : ""}`;
    }

    return "현재는 접수를 진행할 수 없습니다.";
  }

  function getMemberDocumentEditAvailabilityState() {
    if (APPLICANT_IS_PREVIEW_MODE) return { isEditable: true, disabledMessage: '', periodLabel: '' };
    const selection = getApplicantRecruitmentSelectionFromSubmission(state.currentSubmission);
    for (const item of state.currentSubmission?.answerItems || []) {
      if (item.systemFieldKey === "admissionCode") selection.admissionCode = String(item.value || "").trim();
    }
    const overrides = state.currentSubmission?.fieldOverrides || {};
    for (const key of ["track", "admission", "admissionCode"]) {
      if (Object.prototype.hasOwnProperty.call(overrides, key)) selection[key] = String(overrides[key] || "").trim();
    }
    const schedule = findApplicantScheduleRecord(getApplicantSchedules(), selection);
    const scheduleState = applicantFormConfig.getApplicantDocumentSubmissionScheduleState(schedule);
    const periodLabel = scheduleState.isConfigured
      ? `${scheduleState.documentSubmissionScheduleStartAt.replace("T", " ")} ~ ${scheduleState.documentSubmissionScheduleEndAt.replace("T", " ")}` : "";
    const disabledMessage = state.isLoadingForm ? "서류 제출 페이지를 준비하는 중입니다."
      : state.loadError ? state.loadError
      : !state.currentSubmission?.id ? "접수를 완료한 후 서류를 제출하세요."
      : scheduleState.reason === "not_configured" ? "서류 제출 기간이 아직 설정되지 않았습니다."
      : scheduleState.reason === "before_start" ? "아직 서류 제출 기간이 아닙니다."
      : scheduleState.reason === "after_end" ? "서류 제출 기간이 종료되었습니다."
      : !scheduleState.isOpen ? "현재는 서류를 제출할 수 없습니다." : "";
    return { isEditable: !disabledMessage, disabledMessage, periodLabel };
  }

  function getApplicantFormEditAvailabilityState() {
    if (state.mode === "documents") return getMemberDocumentEditAvailabilityState();
    if (!APPLICANT_IS_PREVIEW_MODE && membership?.member && state.currentSubmission?.id) {
      return { isEditable: false, disabledMessage: '접수가 완료되었습니다. 접수는 계정당 한 번만 가능합니다.' };
    }
    const applyAvailabilityState = getApplicantApplyAvailabilityState({ target: getApplicantEditableScheduleTarget() });

    return {
      isEditable: APPLICANT_IS_PREVIEW_MODE || applyAvailabilityState.isAvailable,
      disabledMessage: APPLICANT_IS_PREVIEW_MODE ? "" : getApplicantApplyDisabledMessage(applyAvailabilityState),
      applyAvailabilityState,
    };
  }

  function getApplicantLookupDisabledMessage(lookupAvailabilityState = getApplicantLookupAvailabilityState()) {
    if (state.isLoadingForm) {
      return "수험표 조회 페이지를 준비하는 중입니다.";
    }

    if (state.loadError) {
      return state.loadError || "수험표 조회 페이지를 준비하지 못했습니다.";
    }

    if (lookupAvailabilityState.scheduleState.reason === "not_configured") {
      return "수험표 조회 기간이 아직 설정되지 않았습니다.";
    }

    if (lookupAvailabilityState.scheduleState.reason === "before_start") {
      const periodLabel = getApplicantLookupSchedulePeriodLabel(lookupAvailabilityState.scheduleState);
      return `아직 수험표 조회 기간이 아닙니다.${periodLabel ? ` 조회 가능 기간: ${periodLabel}` : ""}`;
    }

    if (lookupAvailabilityState.scheduleState.reason === "after_end") {
      const periodLabel = getApplicantLookupSchedulePeriodLabel(lookupAvailabilityState.scheduleState);
      return `수험표 조회 기간이 종료되었습니다.${periodLabel ? ` 조회 가능 기간: ${periodLabel}` : ""}`;
    }

    return "현재는 수험표 조회를 진행할 수 없습니다.";
  }

  function getApplicantLookupActionAvailabilityState(target = state.lookup.target) {
    return normalizeApplicantLookupTarget(target) === APPLICANT_LOOKUP_TARGETS.ticket
      ? getApplicantLookupAvailabilityState()
      : getApplicantResultLookupAvailabilityState();
  }

  function getApplicantLookupActionDisabledMessage(target = state.lookup.target, lookupAvailabilityState = getApplicantLookupActionAvailabilityState(target)) {
    return normalizeApplicantLookupTarget(target) === APPLICANT_LOOKUP_TARGETS.ticket
      ? getApplicantLookupDisabledMessage(lookupAvailabilityState)
      : "";
  }

  function canEnterApplicantVerification() {
    return APPLICANT_IS_PREVIEW_MODE || getApplicantApplyEntryAvailabilityState().isAvailable;
  }

  function getApplicantRecruitmentUnits(referenceDate = new Date()) {
    const recruitmentUnits = Array.isArray(state.formConfig.recruitmentUnits) ? state.formConfig.recruitmentUnits : [];

    if (APPLICANT_IS_PREVIEW_MODE) {
      return recruitmentUnits;
    }

    return recruitmentUnits.filter((unit) => isApplicantRecruitmentUnitOpen(unit, referenceDate));
  }

  function getApplicantApplyEntryAvailabilityState(referenceDate = new Date()) {
    const isFormConfigured = hasApplicantFormConfigured();
    const hasOpenRecruitmentUnits = getApplicantRecruitmentUnits(referenceDate).length > 0;
    const isAvailable = !state.isLoadingForm && !state.loadError && isFormConfigured && hasOpenRecruitmentUnits;

    return {
      isAvailable,
      isFormConfigured,
      hasOpenRecruitmentUnits,
    };
  }

  function getApplicantApplyEntryDisabledMessage(entryAvailabilityState = getApplicantApplyEntryAvailabilityState()) {
    if (state.isLoadingForm) {
      return "접수 양식을 불러오는 중입니다.";
    }

    if (state.loadError) {
      return state.loadError || "접수 페이지를 준비하지 못했습니다.";
    }

    if (!entryAvailabilityState.isFormConfigured) {
      return "접수 양식이 아직 설정되지 않았습니다.";
    }

    if (!entryAvailabilityState.hasOpenRecruitmentUnits) {
      return "현재 접수중인 전형이 없습니다.";
    }

    return "현재는 접수를 진행할 수 없습니다.";
  }

  function getApplicantRecruitmentSelectionOptions(fieldKey = "", selection = state.recruitment) {
    const definition = APPLICANT_RECRUITMENT_SELECTION_FIELDS.find((field) => field.key === String(fieldKey || "").trim()) || null;

    if (!definition) {
      return [];
    }

    let filteredUnits = getApplicantRecruitmentUnits();
    const definitionIndex = APPLICANT_RECRUITMENT_SELECTION_FIELDS.findIndex((field) => field.key === definition.key);

    for (let index = 0; index < definitionIndex; index += 1) {
      const priorDefinition = APPLICANT_RECRUITMENT_SELECTION_FIELDS[index];
      const selectedValue = String(selection?.[priorDefinition.key] || "").trim();

      if (!selectedValue) {
        continue;
      }

      filteredUnits = filteredUnits.filter((unit) => String(unit?.[priorDefinition.unitKey] || "").trim() === selectedValue);
    }

    return Array.from(
      new Set(
        filteredUnits
          .map((unit) => String(unit?.[definition.unitKey] || "").trim())
          .filter(Boolean),
      ),
    );
  }

  function getApplicantRecruitmentSelectionIndex(fieldKey = "") {
    return APPLICANT_RECRUITMENT_SELECTION_FIELDS.findIndex((field) => field.key === String(fieldKey || "").trim());
  }

  function getRecruitmentEnglishName(fieldKey, value, selection = state.recruitment) {
    if (!["admission", "unit", "major"].includes(fieldKey)) return value;
    const definitionIndex = getApplicantRecruitmentSelectionIndex(fieldKey);
    const definition = APPLICANT_RECRUITMENT_SELECTION_FIELDS[definitionIndex];
    const candidates = (state.formConfig.recruitmentUnits || []).filter(unit =>
      String(unit[definition.unitKey] || "").trim() === value &&
      APPLICANT_RECRUITMENT_SELECTION_FIELDS.slice(0, definitionIndex).every(parent =>
        !selection[parent.key] || String(unit[parent.unitKey] || "").trim() === selection[parent.key]));
    return candidates.map(unit => String(unit[`${definition.unitKey}En`] || "").trim()).find(Boolean) || value;
  }

  function hasApplicantRecruitmentSelectionPrerequisites(fieldKey = "", selection = state.recruitment) {
    const definitionIndex = getApplicantRecruitmentSelectionIndex(fieldKey);

    if (definitionIndex <= 0) {
      return true;
    }

    for (let index = 0; index < definitionIndex; index += 1) {
      const previousDefinition = APPLICANT_RECRUITMENT_SELECTION_FIELDS[index];
      const previousOptions = getApplicantRecruitmentSelectionOptions(previousDefinition.key, {});

      if (previousOptions.length === 0) {
        continue;
      }

      const selectedValue = String(selection?.[previousDefinition.key] || "").trim();

      if (!selectedValue) {
        return false;
      }
    }

    return true;
  }

  function hasApplicantRecruitmentSelectionStep() {
    if (getApplicantRecruitmentUnits().length === 0) {
      return false;
    }

    return APPLICANT_RECRUITMENT_SELECTION_FIELDS.some(
      (definition) => getApplicantRecruitmentSelectionOptions(definition.key).length > 0,
    );
  }

  function hasCompletedApplicantRecruitmentSelection() {
    if (!hasApplicantRecruitmentSelectionStep()) {
      return true;
    }

    return APPLICANT_RECRUITMENT_SELECTION_FIELDS.every((definition) => {
      const options = getApplicantRecruitmentSelectionOptions(definition.key, state.recruitment);

      if (options.length === 0) {
        return true;
      }

      const selectedValue = String(state.recruitment?.[definition.key] || "").trim();
      return Boolean(selectedValue && options.includes(selectedValue));
    });
  }

  function syncApplicantRecruitmentSelection({ preserveExisting = true } = {}) {
    const nextSelection = {
      track: "",
      admission: "",
      series: "",
      unit: "",
      major: "",
    };

    APPLICANT_RECRUITMENT_SELECTION_FIELDS.forEach((definition) => {
      const globalOptions = getApplicantRecruitmentSelectionOptions(definition.key, {});

      if (globalOptions.length === 0 || !hasApplicantRecruitmentSelectionPrerequisites(definition.key, nextSelection)) {
        nextSelection[definition.key] = "";
        return;
      }

      const options = getApplicantRecruitmentSelectionOptions(definition.key, nextSelection);
      const previousValue = preserveExisting ? String(state.recruitment?.[definition.key] || "").trim() : "";

      if (previousValue && options.includes(previousValue)) {
        nextSelection[definition.key] = previousValue;
        return;
      }

      nextSelection[definition.key] = options.length === 1 ? options[0] : "";
    });

    state.recruitment = nextSelection;
  }

  function getApplicantRecruitmentSelectionFromSubmission(submission = null) {
    const nextSelection = {
      track: "",
      admission: "",
      series: "",
      unit: "",
      major: "",
    };
    const answerItems = Array.isArray(submission?.answerItems) ? submission.answerItems : [];

    answerItems.forEach((answerItem) => {
      const systemFieldKey = String(answerItem?.systemFieldKey || "").trim();
      const value = String(answerItem?.value || "").trim();

      if (!value) {
        return;
      }

      if (systemFieldKey === "admission") {
        nextSelection.admission = value;
      }

      if (systemFieldKey === "track") {
        nextSelection.track = value;
      }

      if (systemFieldKey === "series") {
        nextSelection.series = value;
      }

      if (systemFieldKey === "unit") {
        nextSelection.unit = value;
      }

      if (systemFieldKey === "major") {
        nextSelection.major = value;
      }
    });

    return nextSelection;
  }

  function syncApplicantRecruitmentSelectionIntoDraftAnswers() {
    const fields = Array.isArray(state.formConfig.fields) ? state.formConfig.fields : [];

    fields.forEach((field) => {
      if (field.systemFieldKey === "track") {
        state.draftAnswers[field.fieldKey] = state.recruitment.track || "";
      }

      if (field.systemFieldKey === "admission") {
        state.draftAnswers[field.fieldKey] = state.recruitment.admission || "";
      }

      if (field.systemFieldKey === "series") {
        state.draftAnswers[field.fieldKey] = state.recruitment.series || "";
      }

      if (field.systemFieldKey === "unit") {
        state.draftAnswers[field.fieldKey] = state.recruitment.unit || "";
      }

      if (field.systemFieldKey === "major") {
        state.draftAnswers[field.fieldKey] = state.recruitment.major || "";
      }
    });
  }

  function canAccessApplicantResult() {
    return canAccessApplicantForm() && state.currentSubmission;
  }

  function canEnterApplicantLookup() {
    return getApplicantLookupActionAvailabilityState().isAvailable;
  }

  function canAccessApplicantLookupSummaryResult() {
    return Boolean(state.identity.source === "lookup" && state.identity.accessToken && state.currentSubmission?.id);
  }

  function canAccessApplicantLookupTicketResult() {
    return Boolean(
      state.identity.source === "lookup" &&
      state.identity.accessToken &&
      state.currentSubmission?.id &&
      normalizeApplicantLookupTarget(state.lookup.target) === APPLICANT_LOOKUP_TARGETS.ticket &&
      getApplicantLookupAvailabilityState().isAvailable,
    );
  }

  function getGuardedApplicantMode(requestedMode = "") {
    const normalizedMode = String(requestedMode || "").trim();
    if (!APPLICANT_IS_PREVIEW_MODE && !membership?.member && !["home", "signup"].includes(normalizedMode)) return "home";
    if (normalizedMode === "signup") return membership?.member ? "home" : "signup";
    if (normalizedMode === "document-status") return APPLICANT_IS_PREVIEW_MODE || state.currentSubmission?.id ? "document-status" : "home";
    if (normalizedMode === "documents") return APPLICANT_IS_PREVIEW_MODE || state.currentSubmission?.id ? "documents" : "home";

    if (normalizedMode === "verify") {
      return canEnterApplicantVerification() ? "verify" : "home";
    }

    if (normalizedMode === "apply") {
      if (APPLICANT_IS_PREVIEW_MODE) {
        return "form";
      }

      return canAccessApplicantSelection() ? (hasApplicantRecruitmentSelectionStep() ? "apply" : "form") : "home";
    }

    if (normalizedMode === "form") {
      if (!canAccessApplicantForm()) {
        return "home";
      }

      if (APPLICANT_IS_PREVIEW_MODE) {
        return "form";
      }

      if (hasApplicantRecruitmentSelectionStep() && !hasCompletedApplicantRecruitmentSelection()) {
        return "apply";
      }

      return "form";
    }

    if (normalizedMode === "result") {
      return canAccessApplicantResult() ? "result" : "home";
    }

    if (normalizedMode === "lookup") {
      return canEnterApplicantLookup() ? "lookup" : "home";
    }

    if (normalizedMode === "lookup-summary") {
      return canAccessApplicantLookupSummaryResult() ? "lookup-summary" : "home";
    }

    if (normalizedMode === "lookup-ticket") {
      return canAccessApplicantLookupTicketResult() ? "lookup-ticket" : "home";
    }

    return APPLICANT_ROUTE_PATHS[normalizedMode] ? normalizedMode : "home";
  }

  function syncApplicantRoute({ replace = false } = {}) {
    state.mode = getGuardedApplicantMode(state.mode);
    syncApplicantLookupTargetWithMode(state.mode);
    updateApplicantDocumentTitle();
    const targetPath = getApplicantRoutePath(state.mode);
    const targetLocation = `${targetPath}${APPLICANT_PREVIEW_SEARCH}${APPLICANT_PREVIEW_TEMPLATE_ID ? `&templateId=${APPLICANT_PREVIEW_TEMPLATE_ID}` : ""}`;
    const currentPath = normalizeApplicantRoutePath(window.location.pathname);
    const currentLocation = `${currentPath}${window.location.search || ""}`;

    if (currentLocation !== targetLocation) {
      const historyMethod = replace ? "replaceState" : "pushState";
      window.history[historyMethod](
        createApplicantHistoryState({
          mode: state.mode,

        }),
        "",
        targetLocation,
      );
    } else if (replace === true) {
      window.history.replaceState(
        createApplicantHistoryState({
          mode: state.mode,

        }),
        "",
        targetLocation,
      );
    }

    persistApplicantPublicState();
  }

  function navigateToApplicantMode(mode, options = {}) {
    state.mode = String(mode || "home").trim() || "home";
    syncApplicantRoute({ replace: options.replace === true });

    if (options.render !== false) {
      render();
    }
  }

  function applyApplicantRouteFromLocation({ replace = false } = {}) {
    state.mode = getApplicantModeFromPathname(window.location.pathname);
    syncApplicantRoute({ replace });
    render();
  }

  function resetMessage() {
    hideApplicantToast();
    state.message = {
      type: "",
      text: "",
    };
  }

  function hideApplicantToast() {
    if (applicantToastTimerId) {
      window.clearTimeout(applicantToastTimerId);
      applicantToastTimerId = 0;
    }

    if (applicantToastRoot) {
      applicantToastRoot.classList.remove("is-visible", "is-error", "is-success");
      applicantToastRoot.textContent = "";
    }
  }

  function closeApplicantDialog({ shouldRender = true } = {}) {
    state.dialog = {
      isOpen: false,
      title: "",
      message: "",
    };

    if (shouldRender) {
      render();
    }
  }

  function openApplicantDialog({ title = "", message = "" } = {}) {
    hideApplicantToast();
    state.dialog = {
      isOpen: true,
      title: String(title || "").trim() || "안내",
      message: String(message || "").trim(),
    };
    render();
  }

  function shouldUseApplicantEntryDialog(entryAvailabilityState = getApplicantApplyEntryAvailabilityState()) {
    return (
      !state.isLoadingForm &&
      !state.loadError &&
      entryAvailabilityState.isFormConfigured === true &&
      entryAvailabilityState.hasOpenRecruitmentUnits === false
    );
  }

  function notifyApplicantApplyEntryUnavailable(entryAvailabilityState = getApplicantApplyEntryAvailabilityState()) {
    const message = getApplicantApplyEntryDisabledMessage(entryAvailabilityState);

    if (shouldUseApplicantEntryDialog(entryAvailabilityState)) {
      openApplicantDialog({
        title: "접수 안내",
        message,
      });
      return;
    }

    setMessage("error", message);
    render();
  }

  function showApplicantToast(message = "", type = "error") {
    const normalizedMessage = String(message || "").trim();

    if (!normalizedMessage || !applicantToastRoot) {
      return;
    }

    hideApplicantToast();
    applicantToastRoot.textContent = normalizedMessage;
    applicantToastRoot.classList.add("is-visible", type === "success" ? "is-success" : "is-error");
    applicantToastTimerId = window.setTimeout(() => {
      hideApplicantToast();
    }, 3600);
  }

  function setMessage(type, text) {
    const normalizedType = String(type || "").trim();
    const normalizedText = String(text || "").trim();

    if (normalizedType === "error") {
      state.message = {
        type: "",
        text: "",
      };
      showApplicantToast(normalizedText || "처리 중 오류가 발생했습니다.", "error");
      return;
    }

    hideApplicantToast();
    state.message = {
      type: normalizedType,
      text: normalizedText,
    };
  }

  function renderApplicantDialog() {
    if (state.dialog?.isOpen !== true) {
      return "";
    }

    return `
      <div class="applicant-public-dialog-layer" data-applicant-dialog-layer="true">
        <button
          class="applicant-public-dialog-backdrop"
          data-applicant-dialog-close="true"
          type="button"
          aria-label="안내 닫기"
        ></button>
        <section
          class="applicant-public-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="applicantPublicDialogTitle"
          aria-describedby="applicantPublicDialogMessage"
        >
          <div class="applicant-public-dialog-copy">
            <h2 id="applicantPublicDialogTitle">${escapeHtml(state.dialog.title || "안내")}</h2>
            <p id="applicantPublicDialogMessage">${escapeHtml(state.dialog.message || "")}</p>
          </div>
          <div class="applicant-public-actions applicant-public-dialog-actions">
            <button
              class="primary-button"
              data-applicant-dialog-close="true"
              data-applicant-dialog-primary="true"
              type="button"
            >확인</button>
          </div>
        </section>
      </div>
    `;
  }

  function syncApplicantDialogUi() {
    if (state.dialog?.isOpen !== true) {
      return;
    }

    const confirmButton = root.querySelector("[data-applicant-dialog-primary='true']");

    if (confirmButton instanceof HTMLButtonElement) {
      confirmButton.focus();
    }
  }

  function renderApplicantPdfPreview() {
    if (state.pdfPreview?.isOpen !== true) {
      return "";
    }

    const canUseInlineViewer = state.pdfPreview?.useInlineViewer !== false && !!state.pdfPreview.viewerUrl;
    const showExternalOpenButton = !canUseInlineViewer;
    const bodyMarkup = canUseInlineViewer
      ? `
          <div class="applicant-public-pdf-frame applicant-public-pdf-viewer-frame">
            <iframe ${state.pdfPreview.fileName ? 'data-i18n-preserve="title"' : ''} title="${escapeAttribute(state.pdfPreview.fileName || "PDF 미리보기")}" src="${escapeAttribute(state.pdfPreview.viewerUrl)}"></iframe>
          </div>
        `
      : `
            <div class="applicant-public-empty-state applicant-public-pdf-mobile-empty">
              <strong>PDF 미리보기</strong>
              <span>미리볼 수 있는 PDF 페이지가 없습니다.</span>
            </div>
          `;

    return `
      <div class="applicant-public-pdf-viewer-layer" data-applicant-pdf-viewer="true">
        <button
          class="applicant-public-pdf-viewer-backdrop"
          data-applicant-action="close-pdf-preview"
          type="button"
          aria-label="PDF 미리보기 닫기"
        ></button>
        <section
          class="applicant-public-pdf-viewer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="applicantPdfPreviewTitle"
        >
          <div class="applicant-public-pdf-viewer-head">
            <div class="applicant-public-pdf-viewer-copy">
              <h2 id="applicantPdfPreviewTitle">${state.pdfPreview.fieldKey ? applicantPublicRenderingHelpersModule.renderAuthoredText(state.pdfPreview.title, state.pdfPreview.titleEn) : escapeHtml(state.pdfPreview.title || "PDF 미리보기")}</h2>
              <p translate="no">${escapeHtml(state.pdfPreview.fileName || "")}</p>
            </div>
            <div class="applicant-public-actions applicant-public-pdf-viewer-actions">
              ${
                showExternalOpenButton
                  ? `
                    <button
                      class="primary-button applicant-public-pdf-download-button"
                      data-applicant-action="open-pdf-preview-external"
                      data-applicant-pdf-preview-open="true"
                      type="button"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path
                          d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.29a1 1 0 1 1 1.4 1.41l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.41L11 12.59V4a1 1 0 0 1 1-1Zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z"
                          fill="currentColor"
                        ></path>
                      </svg>
                      <span>원본 PDF파일 다운로드</span>
                    </button>
                  `
                  : ""
              }
              <button
                class="ghost-button"
                data-applicant-action="close-pdf-preview"
                data-applicant-pdf-preview-close="true"
                type="button"
              >닫기</button>
            </div>
          </div>
          ${bodyMarkup}
        </section>
      </div>
    `;
  }

  function syncApplicantPdfPreviewUi() {
    if (state.pdfPreview?.isOpen !== true) {
      return;
    }

    const preferredButton =
      root.querySelector("[data-applicant-pdf-preview-open='true']") ||
      root.querySelector("[data-applicant-pdf-preview-close='true']");

    if (preferredButton instanceof HTMLButtonElement) {
      preferredButton.focus();
    }
  }

  function resetIdentity() {
    closeApplicantPdfPreview({ render: false });
    state.identity = {
      name: "",
      email: "",
      accessToken: "",
      submissionId: 0,
      source: "",
    };
    state.recruitment = {
      track: "",
      admission: "",
      series: "",
      unit: "",
      major: "",
    };
    state.application.password = "";
    state.application.passwordConfirm = "";
    state.application.passwordConfirmTouched = false;
    state.nationalityPicker.openFieldKey = "";
    state.fieldUi = {
      dateParts: {},
      customSelectModes: {},
    };
    state.currentSubmission = null;
    state.draftAnswers = {};
  }

  function resetToHome() {
    resetMessage();
    resetIdentity();
    state.verification = {
      name: "",
      email: "",
      code: "",
      debugCode: "",
      expiresAt: 0,
      resendAvailableAt: state.verification.resendAvailableAt || 0,
      isSending: false,
      isVerifying: false,
    };
    state.lookup = {
      target: APPLICANT_LOOKUP_TARGETS.result,
      name: "",
      email: "",
      password: "",
      isLoading: false,
    };
    state.isSaving = false;
    navigateToApplicantMode("home");
  }

  function applyApplicantPreviewIdentity() {
    if (!APPLICANT_IS_PREVIEW_MODE) {
      return;
    }

    state.identity = {
      ...state.identity,
      name: state.identity.name || "홍길동",
      email: state.identity.email || "preview@example.com",
      source: "preview",
    };
  }

  function getSubmissionAnswerMap(submission = null) {
    return submission?.answerMap && typeof submission.answerMap === "object" ? submission.answerMap : {};
  }

  function parseApplicantDateParts(value = "") {
    const normalizedValue = String(value || "").trim();
    const matchedDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedValue);

    if (!matchedDate) {
      return {
        year: "",
        month: "",
        day: "",
      };
    }

    return {
      year: matchedDate[1],
      month: matchedDate[2],
      day: matchedDate[3],
    };
  }

  function buildApplicantDateValueFromParts(parts = {}) {
    const year = String(parts?.year || "").trim();
    const month = String(parts?.month || "").trim();
    const day = String(parts?.day || "").trim();

    if (!year || !month || !day) {
      return "";
    }

    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  function getApplicantDatePartState(fieldKey = "") {
    const normalizedFieldKey = String(fieldKey || "").trim();
    const storedParts = state.fieldUi?.dateParts?.[normalizedFieldKey];

    if (storedParts && typeof storedParts === "object") {
      return {
        year: String(storedParts.year || ""),
        month: String(storedParts.month || ""),
        day: String(storedParts.day || ""),
      };
    }

    return parseApplicantDateParts(state.draftAnswers?.[normalizedFieldKey]);
  }

  function getApplicantDateDayCount(year, month) {
    return applicantPublicRenderingHelpersModule.getDateDayCount(year, month);
  }

  function syncApplicantFieldUiState({ preserveExisting = true } = {}) {
    const nextDateParts = {};
    const nextCustomSelectModes = {};
    const fields = getAllApplicantFields();

    fields.forEach((field) => {
      const fieldKey = String(field?.fieldKey || "").trim();

      if (!fieldKey) {
        return;
      }

      if (field.inputType === "date" || field.inputType === "birthdate") {
        const existingParts = preserveExisting ? state.fieldUi?.dateParts?.[fieldKey] : null;

        nextDateParts[fieldKey] =
          existingParts && typeof existingParts === "object"
            ? {
                year: String(existingParts.year || ""),
                month: String(existingParts.month || ""),
                day: String(existingParts.day || ""),
              }
            : parseApplicantDateParts(state.draftAnswers[fieldKey]);
      }

      if (field.inputType === "select" && field.allowCustomOption === true) {
        const draftValue = String(state.draftAnswers[fieldKey] ?? "").trim();
        const existingMode = preserveExisting && state.fieldUi?.customSelectModes?.[fieldKey] === true;
        nextCustomSelectModes[fieldKey] =
          existingMode || (draftValue && !(Array.isArray(field.options) ? field.options : []).includes(draftValue));
      }
    });

    state.fieldUi = {
      dateParts: nextDateParts,
      customSelectModes: nextCustomSelectModes,
    };
  }

  function buildDraftAnswers(submission = null) {
    const answerMap = getSubmissionAnswerMap(submission);

    return getAllApplicantFields().reduce((draft, field) => {
      if (field.systemFieldKey === "name") {
        draft[field.fieldKey] = state.identity.name || state.verification.name || state.lookup.name || "";
        return draft;
      }

      draft[field.fieldKey] = answerMap[field.fieldKey] ?? (isApplicantUploadField(field) ? buildApplicantUploadDraftValue(field.inputType) : "");
      return draft;
    }, {});
  }

  function buildApplicantTestRecruitmentSelection() {
    const firstRecruitmentUnit = (Array.isArray(state.formConfig.recruitmentUnits) ? state.formConfig.recruitmentUnits : [])[0] || {};

    return {
      track: String(firstRecruitmentUnit.trackName || ""),
      admission: String(firstRecruitmentUnit.admissionName || ""),
      series: String(firstRecruitmentUnit.seriesName || ""),
      unit: String(firstRecruitmentUnit.unitName || ""),
      major: String(firstRecruitmentUnit.majorName || ""),
    };
  }

  function buildApplicantTestDraftValue(field = {}, index = 0, options = {}) {
    const recruitmentSelection = options?.recruitmentSelection || {};
    const identity = options?.identity || {};
    const normalizedQuestionText = String(field?.questionText || "").trim();
    const normalizedSystemFieldKey = String(field?.systemFieldKey || "").trim();
    const normalizedInputType = String(field?.inputType || "text").trim();

    if (normalizedSystemFieldKey === "name") {
      return identity.name || "테스트 수험생";
    }

    if (normalizedSystemFieldKey === "email") {
      return identity.email || "applicant.test@example.com";
    }

    if (normalizedSystemFieldKey === "track") {
      return recruitmentSelection.track || "";
    }

    if (normalizedSystemFieldKey === "admission") {
      return recruitmentSelection.admission || "";
    }

    if (normalizedSystemFieldKey === "series") {
      return recruitmentSelection.series || "";
    }

    if (normalizedSystemFieldKey === "unit") {
      return recruitmentSelection.unit || "";
    }

    if (normalizedSystemFieldKey === "major") {
      return recruitmentSelection.major || "";
    }

    if (normalizedInputType === "multiselect") return (field.options || []).filter(option => option !== field.customOptionLabel).slice(0, 2);

    if (normalizedInputType === "select") {
      const fieldOptions = Array.isArray(field.options) ? field.options : [];

      if (fieldOptions.length > 0) {
        return String(fieldOptions[0] || "");
      }

      return field.allowCustomOption === true ? `${normalizedQuestionText || "선택 항목"} 테스트` : "";
    }

    if (normalizedInputType === "textarea") {
      return `${normalizedQuestionText || "입력 항목"} 테스트 입력값입니다.`;
    }

    if (normalizedInputType === "phone") {
      return "01012345678";
    }

    if (normalizedInputType === "nationality") {
      return "대한민국";
    }

    if (normalizedInputType === "date") {
      return "2026-09-01";
    }

    if (normalizedInputType === "birthdate") {
      return "2005-03-15";
    }

    if (normalizedInputType === "time") {
      return "09:00";
    }

    if (isApplicantUploadField(field)) {
      return buildApplicantUploadDraftValue(normalizedInputType);
    }

    return `${normalizedQuestionText || "입력 항목"} 테스트 ${index + 1}`;
  }

  function buildApplicantFormTestPreviewSnapshot() {
    const identity = {
      name: "테스트 수험생",
      email: "applicant.test@example.com",
      accessToken: "",
      submissionId: 0,
      source: "preview",
    };
    const recruitmentSelection = buildApplicantTestRecruitmentSelection();
    const draftAnswers = (Array.isArray(state.formConfig.fields) ? state.formConfig.fields : []).reduce((draft, field, index) => {
      const fieldKey = String(field?.fieldKey || "").trim();

      if (!fieldKey) {
        return draft;
      }

      draft[fieldKey] = buildApplicantTestDraftValue(field, index, {
        recruitmentSelection,
        identity,
      });
      return draft;
    }, {});

    return {
      verification: {
        name: identity.name,
        email: identity.email,
        code: "",
        debugCode: "",
        expiresAt: 0,
      },
      lookup: {
        target: APPLICANT_LOOKUP_TARGETS.result,
        name: "",
        email: "",
      },
      identity,
      recruitment: recruitmentSelection,
      currentSubmission: null,
      draftAnswers,
      fieldUi: {
        dateParts: {},
        customSelectModes: {},
      },
    };
  }

  function openApplicantFormTestEntry() {
    if (state.isLoadingForm) {
      setMessage("error", "접수 양식을 불러오는 중입니다.");
      render();
      return;
    }

    if (state.loadError) {
      setMessage("error", state.loadError || "접수 페이지를 준비하지 못했습니다.");
      render();
      return;
    }

    if (!hasApplicantFormConfigured()) {
      setMessage("error", "접수 양식이 아직 설정되지 않았습니다.");
      render();
      return;
    }

    try {
      window.sessionStorage.setItem(APPLICANT_PREVIEW_STATE_STORAGE_KEY, JSON.stringify(buildApplicantFormTestPreviewSnapshot()));
      window.location.assign(`${APPLICANT_ROUTE_PATHS.form}?preview=1`);
    } catch (error) {
      setMessage("error", "테스트 진입 상태를 준비하지 못했습니다.");
      render();
    }
  }

  function getApplicantFlowEntryMode() {
    return hasApplicantRecruitmentSelectionStep() ? "apply" : "form";
  }

  function getApplicantFormBackMode() {
    if (membership?.member && !hasApplicantRecruitmentSelectionStep()) return "home";
    if (APPLICANT_IS_PREVIEW_MODE) {
      return "home";
    }

    if (hasApplicantRecruitmentSelectionStep()) {
      return "apply";
    }

    return state.identity.source === "lookup" ? getApplicantLookupResultMode() : "verify";
  }

  function applySubmissionContext({ accessToken = "", submission = null, source = "" }) {
    const submissionRecruitment = getApplicantRecruitmentSelectionFromSubmission(submission);

    state.identity = {
      name: submission?.name || state.verification.name || state.lookup.name || state.identity.name,
      email: submission?.email || state.verification.email || state.lookup.email || state.identity.email,
      accessToken: String(accessToken || ""),
      submissionId: Number(submission?.id || 0),
      source: String(source || ""),
    };
    state.application.password = "";
    state.application.passwordConfirm = "";
    state.application.passwordConfirmTouched = false;
    state.nationalityPicker.openFieldKey = "";
    state.currentSubmission = submission || null;
    state.recruitment = {
      track: submissionRecruitment.track || state.recruitment.track || "",
      admission: submissionRecruitment.admission || state.recruitment.admission || "",
      series: submissionRecruitment.series || state.recruitment.series || "",
      unit: submissionRecruitment.unit || state.recruitment.unit || "",
      major: submissionRecruitment.major || state.recruitment.major || "",
    };
    state.draftAnswers = buildDraftAnswers(submission);
    syncApplicantRecruitmentSelection({ preserveExisting: true });
    syncApplicantRecruitmentSelectionIntoDraftAnswers();
    syncApplicantFieldUiState({ preserveExisting: false });
  }

  function getAdmissionHomepageUrl() {
    return String(state.formConfig.systemSettings?.admissionHomepageUrl || "").trim();
  }

  function getNationalityOptions() {
    return Array.isArray(applicantFormConfig?.nationalityOptions) ? applicantFormConfig.nationalityOptions : [];
  }

  function getFilteredNationalityOptions(fieldKey = "") {
    const options = getNationalityOptions();
    const searchValue = String(state.draftAnswers[fieldKey] || "")
      .trim()
      .toLowerCase();

    if (!searchValue) {
      return options.slice(0, 12);
    }

    const startsWithMatches = [];
    const containsMatches = [];

    options.forEach((option) => {
      const searchLabel = String(option?.searchLabel || "").trim();

      if (!searchLabel) {
        return;
      }

      if (searchLabel.startsWith(searchValue)) {
        startsWithMatches.push(option);
        return;
      }

      if (searchLabel.includes(searchValue)) {
        containsMatches.push(option);
      }
    });

    return [...startsWithMatches, ...containsMatches].slice(0, 12);
  }

  function closeNationalityPicker() {
    state.nationalityPicker.openFieldKey = "";
  }

  function findApplicantFieldElement(fieldKey = "") {
    return Array.from(root.querySelectorAll("[data-applicant-field-key]")).find((element) => {
      return String(element?.dataset?.applicantFieldKey || "").trim() === String(fieldKey || "").trim();
    });
  }

  function findApplicantNationalityPickerElement(fieldKey = "") {
    return Array.from(root.querySelectorAll("[data-applicant-nationality-picker-for]")).find((element) => {
      return String(element?.dataset?.applicantNationalityPickerFor || "").trim() === String(fieldKey || "").trim();
    });
  }

  function renderNationalityPickerContent(fieldKey = "") {
    const filteredNationalityOptions = getFilteredNationalityOptions(fieldKey);
    const fieldValue = String(state.draftAnswers[fieldKey] || "").trim();
    return applicantPublicRenderingHelpersModule.renderNationalityOptions(filteredNationalityOptions, fieldKey, fieldValue);
  }

  function getNationalityDisplayValue(value = '') {
    const country = applicantFormConfig.findApplicantNationalityOption(value);
    return country ? applicantPublicRenderingHelpersModule.formatNationalitySelection(country) : String(value || '');
  }

  function syncNationalityFieldUI(fieldKey = "") {
    const normalizedFieldKey = String(fieldKey || "").trim();

    if (!normalizedFieldKey) {
      return;
    }

    const fieldElement = findApplicantFieldElement(normalizedFieldKey);

    if (fieldElement instanceof HTMLInputElement) {
      const value = String(state.draftAnswers[normalizedFieldKey] || '');
      fieldElement.value = state.nationalityPicker.openFieldKey === normalizedFieldKey ? value : getNationalityDisplayValue(value);
    }

    const pickerElement = findApplicantNationalityPickerElement(normalizedFieldKey);

    if (!(pickerElement instanceof HTMLElement)) {
      return;
    }

    const isOpen = state.nationalityPicker.openFieldKey === normalizedFieldKey;
    pickerElement.classList.toggle("is-open", isOpen);
    pickerElement.innerHTML = isOpen ? renderNationalityPickerContent(normalizedFieldKey) : "";
  }

  function normalizeNationalityDraftValue(fieldKey = "") {
    const normalizedFieldKey = String(fieldKey || "").trim();

    if (!normalizedFieldKey) {
      return;
    }

    const rawValue = String(state.draftAnswers[normalizedFieldKey] || "").trim();

    if (!rawValue) {
      return;
    }

    const matchedOption =
      typeof applicantFormConfig?.findApplicantNationalityOption === "function"
        ? applicantFormConfig.findApplicantNationalityOption(rawValue)
        : null;

    if (matchedOption?.label) {
      state.draftAnswers[normalizedFieldKey] = matchedOption.label;
    }
  }

  function resolveAdmissionHomepageUrl() {
    const admissionHomepageUrl = getAdmissionHomepageUrl();

    if (!admissionHomepageUrl) {
      return "";
    }

    try {
      return new URL(admissionHomepageUrl, window.location.origin).toString();
    } catch (error) {
      return "";
    }
  }

  function closeApplicantPdfPreview(options = {}) {
    revokeApplicantPdfPreviewObjectUrl(state.pdfPreview?.objectUrl);
    state.pdfPreview = createApplicantPdfPreviewState();

    if (options.render !== false) {
      render();
    }
  }

  async function openApplicantPdfPreview(fieldKey = "") {
    const normalizedFieldKey = String(fieldKey || "").trim();
    const field = getApplicantFormFieldByKey(normalizedFieldKey);
    const fieldValue = normalizedFieldKey ? state.draftAnswers?.[normalizedFieldKey] : null;
    let previewFile = null;

    try {
      previewFile = await createApplicantPdfPreviewFile(fieldValue);
    } catch (error) {
      console.error("Failed to create applicant PDF preview file.", error);
    }

    if (!isApplicantBlobInstance(previewFile)) {
      setMessage("error", "미리볼 수 있는 PDF 파일이 없습니다.");
      render();
      return;
    }

    closeApplicantPdfPreview({ render: false });
    const objectUrl = URL.createObjectURL(previewFile);
    state.pdfPreview = createApplicantPdfPreviewState({
      isOpen: true,
      fieldKey: normalizedFieldKey,
      title: String(field?.questionText || "").trim() || "PDF 미리보기",
      titleEn: field?.questionTextEn || "",
      fileName: String(previewFile.name || fieldValue?.fileName || "").trim() || "document.pdf",
      file: previewFile,
      objectUrl,
      viewerUrl: `${objectUrl}#page=1&view=FitH&navpanes=0&pagemode=none`,
      useInlineViewer: !isApplicantMobilePdfPreviewEnvironment(),
    });
    render();
  }

  function openApplicantPdfPreviewExternally() {
    const previewFile = state.pdfPreview?.file;

    if (!isApplicantBlobInstance(previewFile)) {
      setMessage("error", "열 수 있는 PDF 파일이 없습니다.");
      render();
      return;
    }

    const objectUrl = URL.createObjectURL(previewFile);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = String(state.pdfPreview?.fileName || previewFile.name || "document.pdf").trim() || "document.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => revokeApplicantPdfPreviewObjectUrl(objectUrl), 300000);
  }

  async function buildSubmissionPayloadAnswers() {
    const answerPayload = {};
    const fields = getActiveApplicantFields();

    syncApplicantRecruitmentSelectionIntoDraftAnswers();

    for (const field of fields) {
      const currentValue = state.draftAnswers[field.fieldKey];

      if (!isApplicantUploadField(field)) {
        answerPayload[field.fieldKey] = currentValue ?? "";
        continue;
      }

      if (isApplicantFileInstance(currentValue?.file)) {
        if (field.inputType === 'file' && !applicantFormConfig.isAllowedUploadExtension(currentValue.file.name, field.allowedExtensions)) {
          const error = new Error(`${field.questionText}: ${field.allowedExtensions.join(', ')} 파일만 업로드할 수 있습니다.`);
          error.fieldKey = field.fieldKey;
          throw error;
        }
        answerPayload[field.fieldKey] = {
          fileName: currentValue.file.name,
          mimeType: currentValue.file.type || "application/octet-stream",
          base64: await readFileAsBase64(currentValue.file),
        };
        continue;
      }

      answerPayload[field.fieldKey] = {};
    }

    return answerPayload;
  }

  function buildApplicantRecruitmentSelectionPayload() {
    return {
      track: String(state.recruitment.track || "").trim(),
      admission: String(state.recruitment.admission || "").trim(),
      series: String(state.recruitment.series || "").trim(),
      unit: String(state.recruitment.unit || "").trim(),
      major: String(state.recruitment.major || "").trim(),
    };
  }

  function getApplicantStatusLabel(status = "", options = {}) {
    const scheduleState = options?.scheduleState || getApplicantSubmissionScheduleState();
    const isScheduleOpen =
      typeof options?.isApplicantScheduleOpen === "boolean" ? options.isApplicantScheduleOpen : scheduleState?.isOpen === true;

    return applicantFormConfig?.getApplicantStatusLabel
      ? applicantFormConfig.getApplicantStatusLabel(status, {
          ...options,
          isApplicantScheduleOpen: isScheduleOpen,
        })
      : String(status || "").trim() === "promoted"
        ? "접수 완료"
        : isScheduleOpen
          ? "접수 중"
          : "접수 완료";
  }

  function getApplicantNoticeMarkup(html, placeholder = "공지사항이 없습니다.") {
    const normalizedHtml = String(html || "").trim();
    const fallbackMarkup = `<p>${escapeHtml(placeholder)}</p>`;

    if (typeof buildLoginNoticeMarkup === "function") {
      return buildLoginNoticeMarkup(normalizedHtml, fallbackMarkup);
    }

    return normalizedHtml || fallbackMarkup;
  }

  function renderMessage() {
    if (!state.message.text || state.message.type === "error") {
      return "";
    }

    return `
      <div class="applicant-public-message ${state.message.type === "success" ? "is-success" : ""}">
        ${escapeHtml(state.message.text)}
      </div>
    `;
  }

  function getApplicantPasswordConfirmError() {
    const hasExistingPassword = state.currentSubmission?.hasPassword === true;
    const passwordValue = String(state.application.password || "");
    const passwordConfirmValue = String(state.application.passwordConfirm || "");

    if (state.application.passwordConfirmTouched !== true) {
      return "";
    }

    if (!passwordValue.trim()) {
      if (passwordConfirmValue.trim()) {
        return hasExistingPassword ? "변경할 비밀번호를 먼저 입력하세요." : "비밀번호를 먼저 입력하세요.";
      }

      return "";
    }

    if (!passwordConfirmValue.trim()) {
      return "비밀번호를 한 번 더 입력하세요.";
    }

    if (passwordValue !== passwordConfirmValue) {
      return "비밀번호가 일치하지 않습니다.";
    }

    return "";
  }

  function syncApplicantPasswordConfirmValidationUI() {
    const passwordField = root.querySelector("[data-applicant-password-confirm-field]");
    const passwordInput = root.querySelector("#applicationPasswordConfirm");
    const errorElement = root.querySelector("[data-applicant-password-confirm-error]");
    const errorMessage = getApplicantPasswordConfirmError();

    if (passwordField instanceof HTMLElement) {
      passwordField.classList.toggle("is-invalid", Boolean(errorMessage));
    }

    if (passwordInput instanceof HTMLElement) {
      passwordInput.classList.toggle("is-invalid", Boolean(errorMessage));
      passwordInput.setAttribute("aria-invalid", errorMessage ? "true" : "false");
    }

    if (errorElement instanceof HTMLElement) {
      errorElement.textContent = errorMessage;
      errorElement.classList.toggle("is-visible", Boolean(errorMessage));
    }
  }

  function renderHome() {
    const admissionHomepageUrl = getAdmissionHomepageUrl();
    const entryAvailabilityState = getApplicantApplyEntryAvailabilityState();
    const applyAvailabilityState = getApplicantApplyAvailabilityState({ target: null });
    const applicantScheduleState = applyAvailabilityState.scheduleState;
    const resultLookupAvailabilityState = getApplicantResultLookupAvailabilityState();
    const ticketLookupAvailabilityState = getApplicantLookupAvailabilityState({ target: null });
    const lookupScheduleState = ticketLookupAvailabilityState.scheduleState;
    const formNotReady = !state.isLoadingForm && !state.loadError && !entryAvailabilityState.isFormConfigured;
    const applyButtonTitle = "접수하기";
    const resultLookupButtonTitle = !resultLookupAvailabilityState.isAvailable
      ? getApplicantLookupActionDisabledMessage(APPLICANT_LOOKUP_TARGETS.result, resultLookupAvailabilityState)
      : "접수결과 조회";
    const ticketLookupButtonTitle = !ticketLookupAvailabilityState.isAvailable
      ? getApplicantLookupDisabledMessage(ticketLookupAvailabilityState)
      : "수험표 조회";
    const formTestButtonTitle = state.isLoadingForm
      ? "접수 양식을 불러오는 중입니다."
      : state.loadError
        ? state.loadError || "접수 페이지를 준비하지 못했습니다."
        : !hasApplicantFormConfigured()
          ? "접수 양식이 아직 설정되지 않았습니다."
          : "임의의 데이터로 접수 페이지를 바로 테스트합니다.";
    const isFormTestDisabled = state.isLoadingForm || Boolean(state.loadError) || !hasApplicantFormConfigured();

    return `
      <button
        class="ghost-button applicant-public-browser-home-link"
        data-applicant-action="go-admission-home"
        type="button"
        ${admissionHomepageUrl ? "" : "disabled"}
        title="${escapeAttribute(admissionHomepageUrl ? "입학처 홈페이지로 이동" : "입학처 홈페이지 링크가 아직 설정되지 않았습니다.")}"
      >
        입학처 홈페이지
      </button>

      <section class="applicant-public-home-stage">
        <section class="applicant-public-home">
          ${applicantPublicRenderingHelpersModule.renderCompactNotice({ html: getApplicantNoticeMarkup(state.formConfig.noticeHtml, "접수 전 공지사항을 확인하세요."), htmlEn: state.formConfig.noticeHtmlEn.trim() ? getApplicantNoticeMarkup(state.formConfig.noticeHtmlEn) : '', userContent: Boolean(String(state.formConfig.noticeHtml || "").trim()), cardClassName: 'applicant-public-hero', contentClassName: 'applicant-public-notice-surface' })}

          <article class="applicant-public-panel applicant-public-action-grid login-panel-card login-stage-panel">
            ${renderMessage()}
            ${
              state.isLoadingForm
                ? `<div class="applicant-public-empty-state"><strong>접수 양식을 불러오는 중입니다.</strong><span>잠시만 기다려 주세요.</span></div>`
                : ""
            }
            ${
              state.loadError
                ? `<div class="applicant-public-empty-state"><strong>페이지를 준비하지 못했습니다.</strong><span>${escapeHtml(state.loadError)}</span></div>`
                : ""
            }
            ${
              formNotReady
                ? `<div class="applicant-public-empty-state"><strong>접수 양식이 아직 설정되지 않았습니다.</strong><span>관리자에게 접수 양식 설정 여부를 확인하세요.</span></div>`
                : ""
            }
            ${!APPLICANT_IS_PREVIEW_MODE ? membership.home() : `<div class="applicant-public-action-stack applicant-public-home-actions">
              ${getApplicantBrandSettings().recruitmentEnabled ? `<button
                class="primary-button"
                data-applicant-action="go-verify"
                type="button"
                title="${escapeAttribute(applyButtonTitle)}"
              >${renderApplicantHomeActionButtonLabel("접수하기", "apply")}</button>` : ""}
              <button
                class="ghost-button"
                data-applicant-action="go-lookup-summary"
                type="button"
                ${resultLookupAvailabilityState.isAvailable ? "" : "disabled"}
                title="${escapeAttribute(resultLookupButtonTitle)}"
              >${renderApplicantHomeActionButtonLabel("접수결과 조회", "summary")}</button>
              <button
                class="ghost-button"
                data-applicant-action="go-lookup-ticket"
                type="button"
                ${ticketLookupAvailabilityState.isAvailable ? "" : "disabled"}
                title="${escapeAttribute(ticketLookupButtonTitle)}"
              >${renderApplicantHomeActionButtonLabel("수험표 조회", "ticket")}</button>
              ${
                APPLICANT_FORM_TEST_ENTRY_VISIBLE
                  ? `
                    <button
                      class="ghost-button applicant-public-home-test-button"
                      data-applicant-action="open-form-test-entry"
                      type="button"
                      ${isFormTestDisabled ? "disabled" : ""}
                      title="${escapeAttribute(formTestButtonTitle)}"
                    >${renderApplicantHomeActionButtonLabel("Form 테스트 진입", "apply")}</button>
                  `
                  : ""
              }
            </div>`}
          </article>
        </section>

        <p class="login-shell-copyright applicant-public-copyright">ApplyHub · 원서접수시스템<br>© 2026 U-PLUS SYSTEM</p>
      </section>
    `;
  }

  function renderVerify() {
    const formEditAvailabilityState = getApplicantFormEditAvailabilityState();
    const isVerificationDisabled = !formEditAvailabilityState.isEditable;

    return `
      <section class="applicant-public-step">
        <article class="applicant-public-slab applicant-public-verification-panel">
          ${renderApplicantStepHeader('이메일 인증')}
          ${renderMessage()}
          ${
            !APPLICANT_IS_PREVIEW_MODE && isVerificationDisabled
              ? `<div class="applicant-public-preview-note">${escapeHtml(formEditAvailabilityState.disabledMessage)}</div>`
              : ""
          }

          <div class="applicant-public-form applicant-public-verify-form">
            <div class="applicant-public-field">
              <label for="verificationName">이름 ${globalThis.AdmitCardPublicFormFeedback.badge(true)}</label>
              <input
                id="verificationName"
                required
                data-applicant-model="verification.name"
                type="text"
                value="${escapeAttribute(state.verification.name)}"
                ${isVerificationDisabled || state.verification.isSending || state.verification.isVerifying ? "disabled" : ""}
              />
            </div>
            <div class="applicant-public-field">
              <label for="verificationEmail">이메일 ${globalThis.AdmitCardPublicFormFeedback.badge(true)}</label>
              <input
                id="verificationEmail"
                required
                data-applicant-model="verification.email"
                type="email"
                value="${escapeAttribute(state.verification.email)}"
                ${isVerificationDisabled || state.verification.isSending || state.verification.isVerifying ? "disabled" : ""}
              />
            </div>
          </div>

          <div class="applicant-public-actions">
            <button
              class="primary-button"
              data-applicant-action="send-code"
              type="button"
              ${state.verification.isSending || isVerificationDisabled || getVerificationResendSeconds() > 0 ? "disabled" : ""}
              title="${isVerificationDisabled ? escapeAttribute(formEditAvailabilityState.disabledMessage) : "인증코드 발송"}"
            >
              ${state.verification.isSending ? "발송 중..." : "인증코드 발송"}
            </button>
          </div>

          <form class="applicant-public-form" data-applicant-form="verify-code">
            <div class="applicant-public-field">
              <label for="verificationCode">인증 코드 ${globalThis.AdmitCardPublicFormFeedback.badge(true)}</label>
              <input
                id="verificationCode"
                required
                data-applicant-model="verification.code"
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                pattern="[0-9]{${VERIFICATION_CODE_LENGTH}}"
                minlength="${VERIFICATION_CODE_LENGTH}"
                maxlength="${VERIFICATION_CODE_LENGTH}"
                value="${escapeAttribute(state.verification.code)}"
                ${isVerificationDisabled || state.verification.isSending || state.verification.isVerifying ? "disabled" : ""}
              />
              ${renderVerificationCountdownMarkup()}
              ${
                state.verification.debugCode
                  ? `
                    <span
                      class="applicant-public-file-note applicant-public-verification-code-preview"
                      data-applicant-verification-code-preview="true"
                      role="status"
                      aria-live="polite"
                    >
                      <span>이메일은 발송되지 않습니다.</span>
                      <strong>인증 코드 ${escapeHtml(state.verification.debugCode)}</strong>
                    </span>
                  `
                  : ""
              }
            </div>

            <div class="applicant-public-actions">
              <button
                class="primary-button"
                type="submit"
                ${!canVerifyCode() ? "disabled" : ""}
                title="${isVerificationDisabled ? escapeAttribute(formEditAvailabilityState.disabledMessage) : "인증 확인"}"
              >
                ${state.verification.isVerifying ? "확인 중..." : "인증 확인"}
              </button>
            </div>
          </form>
        </article>
      </section>
    `;
  }

  function renderApplicantStaticField({ fieldId = "", label = "", value = "", helperText = "" } = {}) {
    return `
      <div class="applicant-public-field applicant-public-static-field">
        <label for="${escapeAttribute(fieldId)}">${escapeHtml(label)}</label>
        ${helperText ? `<span class="applicant-public-file-note applicant-public-field-note">${escapeHtml(helperText)}</span>` : ""}
        <input id="${escapeAttribute(fieldId)}" type="text" value="${escapeAttribute(value)}" ${fieldId === 'applicationBirth' ? `data-i18n-display-value="${escapeAttribute(value)}"` : ''} readonly />
      </div>
    `;
  }

  function renderApplicantPasswordFields(isReadOnly = false) {
    if (membership?.member) return "";
    const hasExistingPassword = Boolean(membership?.member) || state.currentSubmission?.hasPassword === true;
    const passwordConfirmError = getApplicantPasswordConfirmError();

    return `
      <div class="applicant-public-field applicant-public-password-field">
        <label for="applicationPassword">
          비밀번호
          ${globalThis.AdmitCardPublicFormFeedback.badge(!hasExistingPassword)}
        </label>
        <span class="applicant-public-file-note applicant-public-field-note">
          ${
            hasExistingPassword
              ? "새 비밀번호를 입력하면 변경되고, 비워 두면 기존 비밀번호를 유지합니다."
              : "접수 비밀번호를 4자 이상 입력하세요."
          }
        </span>
        <input
          id="applicationPassword"
          data-applicant-model="application.password"
          type="password"
          value="${escapeAttribute(state.application.password)}"
          placeholder="${hasExistingPassword ? "변경할 때만 입력" : "비밀번호를 입력하세요"}"
          autocomplete="new-password"
          ${isReadOnly ? "disabled" : ""}
        />
      </div>
      <div class="applicant-public-field applicant-public-password-field ${passwordConfirmError ? "is-invalid" : ""}" data-applicant-password-confirm-field="true">
        <label for="applicationPasswordConfirm">
          비밀번호 확인
          ${globalThis.AdmitCardPublicFormFeedback.badge(!hasExistingPassword)}
        </label>
        <span class="applicant-public-file-note applicant-public-field-note">비밀번호를 한 번 더 입력해 주세요.</span>
        <input
          id="applicationPasswordConfirm"
          data-applicant-model="application.passwordConfirm"
          type="password"
          value="${escapeAttribute(state.application.passwordConfirm)}"
          placeholder="${hasExistingPassword ? "변경한 비밀번호를 다시 입력" : "비밀번호를 다시 입력하세요"}"
          autocomplete="new-password"
          aria-invalid="${passwordConfirmError ? "true" : "false"}"
          ${isReadOnly ? "disabled" : ""}
        />
        <span class="applicant-public-input-error ${passwordConfirmError ? "is-visible" : ""}" data-applicant-password-confirm-error="true">${escapeHtml(passwordConfirmError)}</span>
      </div>
    `;
  }

  function renderApplicantDateField(field, fieldValue, requiredBadge, fieldDescriptionMarkup, isReadOnly) {
    const dateParts = getApplicantDatePartState(field.fieldKey);

    return `
      <div class="applicant-public-field">
        <label>${applicantPublicRenderingHelpersModule.renderAuthoredText(field.questionText, field.questionTextEn)} ${requiredBadge}</label>
        ${fieldDescriptionMarkup}
        ${applicantPublicRenderingHelpersModule.renderDateSelectControls({ fieldKey: field.fieldKey, inputType: field.inputType, parts: dateParts, label: field.questionText, labelEn: field.questionTextEn, disabled: isReadOnly })}
        <input type="hidden" data-applicant-field-key="${escapeAttribute(field.fieldKey)}" value="${escapeAttribute(fieldValue || "")}" />
      </div>
    `;
  }

  function renderApplicantField(field, options = {}) {
    const fieldValue = state.draftAnswers[field.fieldKey];
    const isReadOnly = options.isReadOnly === true || field.systemFieldKey === "name";
    const requiredBadge = globalThis.AdmitCardPublicFormFeedback.badge(field.required);
    const fieldDescription = String(field.questionDescription || "").trim();
    const fieldDescriptionMarkup = fieldDescription || field.questionDescriptionEn
      ? `<span class="applicant-public-file-note applicant-public-field-note">${applicantPublicRenderingHelpersModule.renderAuthoredText(fieldDescription, field.questionDescriptionEn)}</span>`
      : "";
    const fieldTypeAttribute = `data-applicant-field-type="${escapeAttribute(field.inputType || "text")}"`;

    if (field.inputType === "textarea") {
      return `
        <div class="applicant-public-field">
          <label for="field-${escapeAttribute(field.fieldKey)}">${applicantPublicRenderingHelpersModule.renderAuthoredText(field.questionText, field.questionTextEn)} ${requiredBadge}</label>
          ${fieldDescriptionMarkup}
          <textarea
            id="field-${escapeAttribute(field.fieldKey)}"
            data-applicant-field-key="${escapeAttribute(field.fieldKey)}"
            ${fieldTypeAttribute}
            ${isReadOnly ? "readonly" : ""}
          >${escapeHtml(fieldValue || "")}</textarea>
        </div>
      `;
    }

    if (field.inputType === "multiselect") {
      return `<div class="applicant-public-field"><span>${applicantPublicRenderingHelpersModule.renderAuthoredText(field.questionText, field.questionTextEn)} ${requiredBadge}</span>${fieldDescriptionMarkup}${applicantPublicRenderingHelpersModule.renderMultiSelect(field, fieldValue, { disabled: isReadOnly })}</div>`;
    }

    if (field.inputType === "select") {
      const normalizedOptions = Array.isArray(field.options) ? field.options : [];
      const customOptionLabel = String(field.customOptionLabel || "").trim();
      const hasLinkedCustomOption =
        field.allowCustomOption === true && customOptionLabel !== "" && normalizedOptions.includes(customOptionLabel);
      const isCustomSelectMode = state.fieldUi?.customSelectModes?.[field.fieldKey] === true && field.allowCustomOption === true;
      const selectedOptionValue =
        isCustomSelectMode
          ? hasLinkedCustomOption
            ? customOptionLabel
            : APPLICANT_CUSTOM_SELECT_VALUE
          : normalizedOptions.includes(String(fieldValue || "").trim())
            ? String(fieldValue || "").trim()
            : "";
      const customInputValue =
        isCustomSelectMode
          ? hasLinkedCustomOption
            ? normalizedOptions.includes(String(fieldValue || "").trim())
              ? ""
              : String(fieldValue || "")
            : !normalizedOptions.includes(String(fieldValue || "").trim())
              ? String(fieldValue || "")
              : ""
          : "";

      return `
        <div class="applicant-public-field">
          <label for="field-${escapeAttribute(field.fieldKey)}">${applicantPublicRenderingHelpersModule.renderAuthoredText(field.questionText, field.questionTextEn)} ${requiredBadge}</label>
          ${fieldDescriptionMarkup}
          <select
            id="field-${escapeAttribute(field.fieldKey)}"
            data-applicant-field-key="${escapeAttribute(field.fieldKey)}"
            data-applicant-select-source="true"
            ${fieldTypeAttribute}
            ${isReadOnly ? "disabled" : ""}
          >
            <option value="">선택하세요</option>
            ${normalizedOptions
              .map(
                (option) => `
                  <option translate="no" data-i18n-ko="${escapeAttribute(option)}" data-i18n-en="${escapeAttribute(field.optionsEn?.[option] || option)}" value="${escapeAttribute(option)}" ${selectedOptionValue === option ? "selected" : ""}>${escapeHtml(option)}</option>
                `,
              )
              .join("")}
            ${
              field.allowCustomOption === true && !hasLinkedCustomOption
                ? `<option value="${escapeAttribute(APPLICANT_CUSTOM_SELECT_VALUE)}" ${selectedOptionValue === APPLICANT_CUSTOM_SELECT_VALUE ? "selected" : ""}>직접 입력</option>`
                : ""
            }
          </select>
          ${
            field.allowCustomOption === true && isCustomSelectMode
              ? `
                <input
                  id="field-${escapeAttribute(field.fieldKey)}-custom"
                  data-applicant-select-custom-field-key="${escapeAttribute(field.fieldKey)}"
                  type="text"
                  value="${escapeAttribute(customInputValue)}"
                  placeholder="직접 입력 값을 작성하세요"
                  ${isReadOnly ? "readonly" : ""}
                />
              `
              : ""
          }
        </div>
      `;
    }

    if (isApplicantUploadField(field)) {
      const isPhotoField = field.inputType === "photo";
      const uploadLabel = getApplicantUploadFieldValueLabel(field, fieldValue);
      const isPdfPreviewAvailable = !isPhotoField && canPreviewApplicantPdfUploadValue(fieldValue);

      return `
        <div class="applicant-public-field applicant-public-file-field">
          <label for="field-${escapeAttribute(field.fieldKey)}">${applicantPublicRenderingHelpersModule.renderAuthoredText(field.questionText, field.questionTextEn)} ${requiredBadge}</label>
          ${fieldDescriptionMarkup}
          <div class="applicant-public-file-shell">
            ${!isPhotoField && field.allowedExtensions?.length ? `<small class="muted">허용 확장자: ${escapeHtml(field.allowedExtensions.join(', '))}</small>` : ''}
            <input
              id="field-${escapeAttribute(field.fieldKey)}"
              class="applicant-public-file-input"
              data-applicant-field-key="${escapeAttribute(field.fieldKey)}"
              ${fieldTypeAttribute}
              type="file"
              ${isPhotoField ? 'accept="image/*"' : field.allowedExtensions?.length ? `accept="${escapeAttribute(field.allowedExtensions.map(ext => '.' + ext).join(','))}"` : ""}
              ${isReadOnly ? "disabled" : ""}
            />
            ${
              isPhotoField
                ? `
                  <label class="applicant-public-file-display" for="field-${escapeAttribute(field.fieldKey)}">
                    <span class="applicant-public-file-button">파일 선택</span>
                    <span ${fieldValue?.file?.name || fieldValue?.fileName ? 'translate="no"' : ''} class="applicant-public-file-name">${escapeHtml(uploadLabel)}</span>
                  </label>
                `
                : `
                  <div class="applicant-public-file-display">
                    <button
                      class="applicant-public-file-button applicant-public-file-register-button"
                      data-applicant-action="choose-upload-file"
                      data-applicant-upload-field-key="${escapeAttribute(field.fieldKey)}"
                      type="button"
                      ${isReadOnly ? "disabled" : ""}
                    >파일 등록</button>
                    ${
                      isPdfPreviewAvailable
                        ? `
                          <button
                            translate="no" class="applicant-public-file-name applicant-public-file-name-button"
                            data-applicant-action="open-uploaded-pdf-preview"
                            data-applicant-upload-field-key="${escapeAttribute(field.fieldKey)}"
                            type="button"
                            title="${escapeAttribute(uploadLabel)}"
                          >${escapeHtml(uploadLabel)}</button>
                        `
                        : `<span ${fieldValue?.file?.name || fieldValue?.fileName ? 'translate="no"' : ''} class="applicant-public-file-name">${escapeHtml(uploadLabel)}</span>`
                    }
                  </div>
                `
            }
          </div>
        </div>
      `;
    }

    if (field.inputType === "nationality") {
      const isPickerOpen = state.nationalityPicker.openFieldKey === field.fieldKey && !isReadOnly;

      return `
        <div class="applicant-public-field applicant-public-nationality-field">
          <label for="field-${escapeAttribute(field.fieldKey)}">${applicantPublicRenderingHelpersModule.renderAuthoredText(field.questionText, field.questionTextEn)} ${requiredBadge}</label>
          ${fieldDescriptionMarkup}
          <div class="applicant-public-nationality-combobox">
            <input
              id="field-${escapeAttribute(field.fieldKey)}"
              data-applicant-field-key="${escapeAttribute(field.fieldKey)}"
              ${fieldTypeAttribute}
              type="search"
              value="${escapeAttribute(isPickerOpen ? fieldValue || "" : getNationalityDisplayValue(fieldValue))}"
              placeholder="국가를 검색하세요"
              autocomplete="off"
              spellcheck="false"
              ${isReadOnly ? "readonly" : ""}
            />
            <div
              class="applicant-public-nationality-picker ${isPickerOpen ? "is-open" : ""}"
              data-applicant-nationality-picker-for="${escapeAttribute(field.fieldKey)}"
            >
              ${isPickerOpen ? renderNationalityPickerContent(field.fieldKey) : ""}
            </div>
          </div>
          <span class="applicant-public-file-note">국가명을 검색한 뒤 목록에서 선택하세요.</span>
        </div>
      `;
    }

    if (field.inputType === "date" || field.inputType === "birthdate") {
      return renderApplicantDateField(field, fieldValue, requiredBadge, fieldDescriptionMarkup, isReadOnly);
    }

    const inputType =
      field.inputType === "time"
          ? "time"
          : "text";
    const inputAttributes =
      field.inputType === "phone"
        ? `inputmode="numeric" pattern="[0-9]*" maxlength="20" autocomplete="tel-national"`
        : "";

    return `
      <div class="applicant-public-field">
        <label for="field-${escapeAttribute(field.fieldKey)}">${applicantPublicRenderingHelpersModule.renderAuthoredText(field.questionText, field.questionTextEn)} ${requiredBadge}</label>
        ${fieldDescriptionMarkup}
        <input
          id="field-${escapeAttribute(field.fieldKey)}"
          data-applicant-field-key="${escapeAttribute(field.fieldKey)}"
          ${fieldTypeAttribute}
          type="${inputType}"
          value="${escapeAttribute(fieldValue || "")}"
          ${inputAttributes}
          ${isReadOnly ? "readonly" : ""}
        />
      </div>
    `;
  }

  function getVisibleApplicantFormFields() {
    const fields = getTemplateFields('application');

    if (!hasApplicantRecruitmentSelectionStep()) {
      return fields;
    }

    return fields.filter((field) => !["track", "admission", "series", "unit", "major"].includes(String(field?.systemFieldKey || "").trim()));
  }

  function fitRecruitmentSummaryValues() {
    root.querySelectorAll('.applicant-public-selection-summary-value').forEach(element => {
      if (!element.clientWidth) return;
      // Preserve a readable floor; CSS ellipsis handles values that still do not fit.
      let size = 16;
      element.style.fontSize = `${size}px`;
      while (size > 14 && element.scrollWidth > element.clientWidth) {
        size -= 0.5;
        element.style.fontSize = `${size}px`;
      }
    });
  }

  function renderApplicantRecruitmentSelectionSummary() {
    const summaryItems = APPLICANT_RECRUITMENT_SELECTION_FIELDS
      .map((definition) => ({
        label: definition.label,
        key: definition.key,
        value: String(state.recruitment?.[definition.key] || "").trim(),
      }))
      .filter((item) => item.value);

    if (summaryItems.length === 0) {
      return "";
    }

    return `
      <div class="applicant-public-selection-summary">
        ${summaryItems
          .map(
            (item) => `
              <div class="applicant-public-selection-summary-item">
                <strong>${escapeHtml(item.label)}</strong>
                <span translate="no" class="applicant-public-selection-summary-value" data-i18n-ko="${escapeAttribute(item.value)}" data-i18n-en="${escapeAttribute(getRecruitmentEnglishName(item.key, item.value))}" title="${escapeAttribute(item.value)}" data-i18n-title-en="${escapeAttribute(getRecruitmentEnglishName(item.key, item.value))}">${escapeHtml(item.value)}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function renderApplicantRecruitmentSelectionFields(isReadOnly = false) {
    return APPLICANT_RECRUITMENT_SELECTION_FIELDS.map((definition) => {
      const globalOptions = getApplicantRecruitmentSelectionOptions(definition.key, {});
      const previousDefinition =
        APPLICANT_RECRUITMENT_SELECTION_FIELDS[getApplicantRecruitmentSelectionIndex(definition.key) - 1] || null;
      const isEnabled = hasApplicantRecruitmentSelectionPrerequisites(definition.key, state.recruitment);
      const options = isEnabled ? getApplicantRecruitmentSelectionOptions(definition.key, state.recruitment) : [];
      const placeholderLabel = !isEnabled
        ? `${previousDefinition?.label || "이전 항목"} 먼저 선택하세요`
        : options.length > 0
          ? "선택하세요"
          : `선택 가능한 ${definition.label}이(가) 없습니다`;

      if (globalOptions.length === 0) {
        return "";
      }

      const selectedValue = String(state.recruitment?.[definition.key] || "").trim();

      return `
        <div class="applicant-public-field">
          <label for="applicationSelection-${escapeAttribute(definition.key)}">${escapeHtml(definition.label)} ${globalThis.AdmitCardPublicFormFeedback.badge(true)}</label>
          <select
            id="applicationSelection-${escapeAttribute(definition.key)}"
            data-applicant-model="recruitment.${escapeAttribute(definition.key)}"
            ${isReadOnly || !isEnabled || options.length === 0 ? "disabled" : ""}
          >
            <option value="">${escapeHtml(placeholderLabel)}</option>
            ${options
              .map(
                (option) => `
                  <option translate="no" value="${escapeAttribute(option)}" data-i18n-ko="${escapeAttribute(option)}" data-i18n-en="${escapeAttribute(getRecruitmentEnglishName(definition.key, option))}" ${selectedValue === option ? "selected" : ""}>${escapeHtml(option)}</option>
                `,
              )
              .join("")}
          </select>
        </div>
      `;
    }).join("");
  }

  function renderApplicantStepHeader(title, statusMarkup = "") {
    return `
      <div class="applicant-public-application-header">
        <div class="applicant-public-application-header-copy"><h2>${escapeHtml(title)}</h2>${statusMarkup}</div>
      </div>
    `;
  }

  function renderApply() {
    const entryAvailabilityState = getApplicantApplyEntryAvailabilityState();
    const isReadOnly = !APPLICANT_IS_PREVIEW_MODE && !entryAvailabilityState.isAvailable;
    const disabledMessage = APPLICANT_IS_PREVIEW_MODE ? "" : getApplicantApplyEntryDisabledMessage(entryAvailabilityState);

    return `
      <section class="applicant-public-step applicant-public-application-step">
        <article class="applicant-public-slab applicant-public-application-panel">
          ${renderApplicantStepHeader('원서접수')}
          ${renderMessage()}
          ${
            !APPLICANT_IS_PREVIEW_MODE && isReadOnly
              ? `<div class="applicant-public-preview-note">${escapeHtml(disabledMessage)}</div>`
              : ""
          }
          <div class="applicant-public-form applicant-public-application-form">
            <div class="applicant-public-form-section">
              <div class="applicant-public-form-stack">
                ${renderApplicantRecruitmentSelectionFields(isReadOnly)}
              </div>
            </div>

            <div class="applicant-public-actions applicant-public-application-actions applicant-public-step-navigation">
              <button class="ghost-button applicant-public-back-button" data-applicant-action="back-home" type="button">이전</button>
              <button
                class="primary-button"
                data-applicant-action="continue-application"
                type="button"
                ${isReadOnly ? "disabled" : ""}
                title="${isReadOnly ? escapeAttribute(disabledMessage) : "다음"}"
              >다음</button>
            </div>
          </div>
        </article>
      </section>
    `;
  }

  function renderApplicationConfiguredFields(isReadOnly = false) {
    const fields = getVisibleApplicantFormFields();
    const renderedFields = [];
    const birthField = renderApplicantStaticField({
      fieldId: 'applicationBirth', label: '생년월일',
      value: applicantPublicRenderingHelpersModule.formatApplicantBirthDate(membership?.birthDate),
      helperText: membership?.birthDate ? '회원가입 시 등록한 생년월일입니다.' : '회원가입 시 등록한 생년월일이 없습니다.',
    });
    let insertedEmailAndPassword = false;

    fields.forEach((field) => {
      if (membership?.birthDate && (field.systemFieldKey === 'birth' || field.inputType === 'birthdate')) return;
      renderedFields.push(renderApplicantField(field, { isReadOnly }));

      if (!insertedEmailAndPassword && field.systemFieldKey === "name") {
        renderedFields.push(
          renderApplicantStaticField({
            fieldId: "applicationEmail",
            label: "이메일",
            value: state.identity.email || "-",
            helperText: "회원가입 시 등록한 이메일입니다.",
          }),
        );
        renderedFields.push(birthField, renderApplicantPasswordFields(isReadOnly));
        insertedEmailAndPassword = true;
      }
    });

    if (!insertedEmailAndPassword) {
      renderedFields.unshift(renderApplicantPasswordFields(isReadOnly));
      renderedFields.unshift(birthField);
      renderedFields.unshift(
        renderApplicantStaticField({
          fieldId: "applicationEmail",
          label: "이메일",
          value: state.identity.email || "-",
          helperText: "회원가입 시 등록한 이메일입니다.",
        }),
      );
      renderedFields.unshift(
        renderApplicantStaticField({
          fieldId: "applicationName",
          label: "이름",
          value: state.identity.name || "-",
          helperText: "회원가입 시 등록한 이름입니다.",
        }),
      );
    }

    return renderedFields.join("");
  }

  function renderForm() {
    const isPreviewMode = APPLICANT_IS_PREVIEW_MODE;
    const formEditAvailabilityState = getApplicantFormEditAvailabilityState();
    const isReadOnly = !isPreviewMode && !formEditAvailabilityState.isEditable;
    const applicantScheduleState = getApplicantSubmissionScheduleState();
    const submissionStatus = state.currentSubmission?.status
      ? getApplicantStatusLabel(state.currentSubmission.status, { scheduleState: applicantScheduleState })
      : "";
    const statusMarkup =
      submissionStatus || isPreviewMode
        ? `<span class="applicant-public-application-status ${isPreviewMode ? "is-preview" : ""}">${escapeHtml(isPreviewMode ? "미리보기" : submissionStatus)}</span>`
        : "";

    return `
      <section class="applicant-public-step applicant-public-application-step">
        <article class="applicant-public-slab applicant-public-application-panel">
          ${renderApplicantStepHeader('원서접수', statusMarkup)}
          ${renderMessage()}
          ${
            isPreviewMode
              ? `<div class="applicant-public-preview-note">관리자 미리보기 화면입니다. 입력값은 저장되지 않습니다.</div>`
              : isReadOnly
                ? `<div class="applicant-public-preview-note">${escapeHtml(formEditAvailabilityState.disabledMessage)}</div>`
              : ""
          }
          <form class="applicant-public-form applicant-public-application-form" data-applicant-form="application">
            <div class="applicant-public-form-section">
              ${renderApplicantRecruitmentSelectionSummary()}
              <div class="applicant-public-form-stack">
                ${renderApplicationConfiguredFields(isReadOnly)}
              </div>
            </div>

            <div class="applicant-public-actions applicant-public-application-actions">
              ${
                isPreviewMode
                  ? `
                    <button class="ghost-button applicant-public-back-button" data-applicant-action="preview-home" type="button">이전</button>
                    <button class="primary-button" type="button" disabled>미리보기 전용</button>
                  `
                  : `
                    <button class="ghost-button applicant-public-back-button" data-applicant-action="back-form" type="button">이전</button>
                    <button
                      class="primary-button"
                      type="submit"
                      ${state.isSaving || isReadOnly ? "disabled" : ""}
                      title="${isReadOnly ? escapeAttribute(formEditAvailabilityState.disabledMessage) : "접수 완료"}"
                    >
                      ${state.isSaving ? "저장 중..." : "접수 완료"}
                    </button>
                  `
              }
            </div>
          </form>
        </article>
      </section>
    `;
  }

  function renderSummaryItems(answerItems = []) {
    const recruitmentSelection = getApplicantRecruitmentSelectionFromSubmission({ answerItems });
    const documentKeys = new Set((state.formConfig.documentFields || []).map(field => field.fieldKey));
    const fieldOrderMap = (Array.isArray(state.formConfig?.fields) ? state.formConfig.fields : []).reduce((orderMap, field, fieldIndex) => {
      const fieldKey = String(field?.fieldKey || "").trim();

      if (fieldKey && !orderMap.has(fieldKey)) {
        orderMap.set(fieldKey, fieldIndex);
      }

      return orderMap;
    }, new Map());
    const normalizedItems = Array.isArray(answerItems)
      ? answerItems
          .filter(item => !documentKeys.has(item?.fieldKey))
          .map((answerItem, index) => ({
            answerItem: answerItem && typeof answerItem === "object" ? answerItem : {},
            index,
          }))
          .sort((leftItem, rightItem) => {
            const leftSystemFieldKey = String(leftItem.answerItem?.systemFieldKey || "").trim();
            const rightSystemFieldKey = String(rightItem.answerItem?.systemFieldKey || "").trim();
            const leftPriorityIndex = APPLICANT_SUMMARY_PRIORITY_SYSTEM_FIELDS.indexOf(leftSystemFieldKey);
            const rightPriorityIndex = APPLICANT_SUMMARY_PRIORITY_SYSTEM_FIELDS.indexOf(rightSystemFieldKey);
            const leftIsPriority = leftPriorityIndex >= 0;
            const rightIsPriority = rightPriorityIndex >= 0;

            if (leftIsPriority || rightIsPriority) {
              if (leftIsPriority && rightIsPriority) {
                return leftPriorityIndex - rightPriorityIndex;
              }

              return leftIsPriority ? -1 : 1;
            }

            const leftFieldKey = String(leftItem.answerItem?.fieldKey || "").trim();
            const rightFieldKey = String(rightItem.answerItem?.fieldKey || "").trim();
            const leftFieldOrder = fieldOrderMap.has(leftFieldKey) ? fieldOrderMap.get(leftFieldKey) : Number.MAX_SAFE_INTEGER;
            const rightFieldOrder = fieldOrderMap.has(rightFieldKey) ? fieldOrderMap.get(rightFieldKey) : Number.MAX_SAFE_INTEGER;

            if (leftFieldOrder !== rightFieldOrder) {
              return leftFieldOrder - rightFieldOrder;
            }

            return leftItem.index - rightItem.index;
          })
          .map((item) => item.answerItem)
      : [];

    return `
      <div class="applicant-public-summary-grid">
        ${normalizedItems
          .map((answerItem) => {
            const value =
              answerItem?.inputType === "photo"
                ? answerItem?.value?.hasPhoto
                  ? answerItem?.value?.fileName || "등록된 사진"
                  : "미등록"
                : answerItem?.inputType === "file"
                  ? answerItem?.value?.hasFile
                    ? answerItem?.value?.fileName || "등록된 파일"
                    : "미등록"
                : (Array.isArray(answerItem?.value) ? answerItem.value.join(", ") : String(answerItem?.value || "").trim()) || "-";

            return `
              <div class="applicant-public-summary-item">
                <strong>${applicantPublicRenderingHelpersModule.renderAuthoredText(answerItem?.questionText || "-", answerItem?.questionTextEn)}</strong>
                <span ${answerItem?.inputType === "photo" || answerItem?.inputType === "file" ? (answerItem?.value?.fileName ? 'translate="no"' : '') : 'translate="no"'}>${["admission", "unit", "major"].includes(answerItem.systemFieldKey) ? applicantPublicRenderingHelpersModule.renderAuthoredText(value, getRecruitmentEnglishName(answerItem.systemFieldKey, value, recruitmentSelection)) : applicantFormConfig.isChoiceInputType(answerItem.inputType) ? applicantPublicRenderingHelpersModule.renderChoiceAnswer(getApplicantFormFieldByKey(answerItem.fieldKey) || {}, answerItem.value) : escapeHtml(value)}</span>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderResult() {
    return `
      <section class="applicant-public-step">
        <article class="applicant-public-slab">
          <h2>접수 결과</h2>
          <p>접수 내용을 확인한 뒤 이전 버튼을 누르면 첫 화면으로 돌아갑니다.</p>
          ${renderMessage()}

          ${renderSummaryItems(state.currentSubmission?.answerItems)}

          <div class="applicant-public-actions">
            <button class="ghost-button applicant-public-back-button" data-applicant-action="confirm-result" type="button">이전</button>
          </div>
        </article>
      </section>
    `;
  }

  function renderLookup() {
    const lookupScreenCopy = getApplicantLookupScreenCopy();

    return `
      <section class="applicant-public-step">
        <article class="applicant-public-slab">
          <h2>${escapeHtml(lookupScreenCopy.heading)}</h2>
          <p>${escapeHtml(lookupScreenCopy.description)}</p>
          ${renderMessage()}

          <form class="applicant-public-form applicant-public-lookup-form" data-applicant-form="lookup">
            <div class="applicant-public-field">
              <label for="lookupName">이름 ${globalThis.AdmitCardPublicFormFeedback.badge(true)}</label>
              <input
                id="lookupName"
                required
                data-applicant-model="lookup.name"
                type="text"
                value="${escapeAttribute(state.lookup.name)}"
                autocomplete="name"
              />
            </div>
            <div class="applicant-public-field">
              <label for="lookupEmail">이메일 ${globalThis.AdmitCardPublicFormFeedback.badge(true)}</label>
              <input
                id="lookupEmail"
                required
                data-applicant-model="lookup.email"
                type="email"
                value="${escapeAttribute(state.lookup.email)}"
                autocomplete="email"
              />
            </div>
            <div class="applicant-public-field applicant-public-password-field">
              <label for="lookupPassword">비밀번호 ${globalThis.AdmitCardPublicFormFeedback.badge(true)}</label>
              <input
                id="lookupPassword"
                required
                data-applicant-model="lookup.password"
                type="password"
                value="${escapeAttribute(state.lookup.password)}"
                autocomplete="current-password"
              />
            </div>

            <div class="applicant-public-actions">
              <button class="ghost-button applicant-public-back-button" data-applicant-action="back-home" type="button">이전</button>
              <button class="primary-button" type="submit" ${state.lookup.isLoading ? "disabled" : ""}>
                ${state.lookup.isLoading ? "조회 중..." : "조회"}
              </button>
            </div>
          </form>
        </article>
      </section>
    `;
  }

  function renderLookupSummaryResult() {
    const submission = state.currentSubmission;
    const formEditAvailabilityState = getApplicantFormEditAvailabilityState();
    const isEditDisabled = !formEditAvailabilityState.isEditable;

    return `
      <section class="applicant-public-step">
        <article class="applicant-public-slab">
          <h2>접수결과 조회</h2>
          <p>등록된 최신 접수 내용을 확인합니다.</p>
          ${renderMessage()}

          ${renderSummaryItems(submission?.answerItems)}

          <div class="applicant-public-actions">
            <button class="ghost-button applicant-public-back-button" data-applicant-action="back-home" type="button">이전</button>
            <button
              class="primary-button"
              data-applicant-action="edit-application"
              type="button"
              ${isEditDisabled ? "disabled" : ""}
              title="${isEditDisabled ? escapeAttribute(formEditAvailabilityState.disabledMessage) : "접수 내용 수정"}"
            >수정</button>
          </div>
        </article>
      </section>
    `;
  }

  function renderLookupTicketResult() {
    const submission = state.currentSubmission;
    const examineeNo = String(submission?.examineeNo || "").trim();
    const pdfUrl =
      submission?.id &&
      state.identity.accessToken
        ? buildApiUrl(`/api/public/applications/${submission.id}/admit-card.pdf?token=${encodeURIComponent(state.identity.accessToken)}`)
        : "";
    const previewMarkup = pdfUrl
      ? `
        <ticket-pdf-viewer src="${escapeAttribute(pdfUrl)}" aria-label="수험표 미리보기"></ticket-pdf-viewer>
      `
      : `
        <div class="applicant-public-empty-state">
          <strong>수험표가 아직 발급되지 않았습니다.</strong>
          <span>원서접수를 완료한 후 수험표 조회 기간에 확인할 수 있습니다.</span>
        </div>
      `;

    return `
      <section class="applicant-public-step">
        <article class="applicant-public-slab applicant-public-ticket-slab applicant-public-ticket-viewer-slab">
          <div class="applicant-public-ticket-viewer-head">
            <div class="applicant-public-ticket-viewer-copy">
              <h2>수험표 조회</h2>
              <div class="applicant-ticket-number-row">
                <p>수험번호: ${escapeHtml(examineeNo || "미부여")}</p>
              </div>
            </div>
          </div>
          ${renderMessage()}
          ${previewMarkup}
          <div class="applicant-public-actions">
            <button class="ghost-button applicant-public-back-button" data-applicant-action="back-home" type="button">이전</button>
            ${pdfUrl ? `<a class="primary-button applicant-ticket-download" href="${escapeAttribute(`${pdfUrl}&download=1`)}" download="${escapeAttribute(`수험표_${examineeNo || submission.id}.pdf`)}">다운로드</a>` : ''}
          </div>
        </article>
      </section>
    `;
  }

  function renderMemberDocumentStatus() {
    const documents = state.documentStatus?.documents || [];
    return `<section class="applicant-public-step"><article class="applicant-public-slab"><h2>서류 제출 확인</h2>
      <p class="muted">서류별 제출 상태를 확인해 주세요.</p>${renderMessage()}
      <div class="applicant-document-status-list">${documents.map(item => `<div class="applicant-document-status-row">
        <div><strong>${applicantPublicRenderingHelpersModule.renderAuthoredText(item.questionText, item.questionTextEn)}</strong>
          ${item.fileName ? `<p translate="no">${escapeHtml(item.fileName)}</p>` : ''}</div>
        <span class="applicant-document-status-badge is-${escapeAttribute(item.status)}">${escapeHtml(item.statusLabel)}</span>
      </div>`).join('') || '<p>확인할 서류 항목이 없습니다.</p>'}</div>
      <div class="applicant-public-actions"><button class="ghost-button applicant-public-back-button" type="button" data-applicant-action="member-home">이전</button><button class="primary-button" type="button" data-applicant-action="member-document-status">새로고침</button></div>
    </article></section>`;
  }

  function renderMemberDocuments() {
    const fields = getTemplateFields('documents');
    const availability = getApplicantFormEditAvailabilityState();
    return `<section class="applicant-public-step"><article class="applicant-public-slab"><h2>서류 제출</h2>
      ${availability.periodLabel ? `<p class="applicant-public-preview-note">서류 제출 기간: ${escapeHtml(availability.periodLabel)}</p>` : ""}
      ${renderMessage()}${!availability.isEditable ? `<p class="applicant-public-preview-note">${escapeHtml(availability.disabledMessage)}</p>` : ""}
      <form class="applicant-public-form" data-applicant-form="member-documents"><div class="applicant-public-form-stack">${fields.length ? fields.map((field) => renderApplicantField(field, { isReadOnly: !availability.isEditable })).join("") : "<p>제출할 서류 항목이 없습니다.</p>"}</div>
      <div class="applicant-public-actions"><button class="ghost-button applicant-public-back-button" type="button" data-applicant-action="member-home">이전</button><button class="primary-button" type="submit" ${!fields.length || !availability.isEditable || state.isSaving ? "disabled" : ""}>${state.isSaving ? "제출 중…" : "서류 제출"}</button></div></form></article></section>`;
  }

  async function saveMemberDocuments() {
    if (state.isSaving) return;
    const availability = getMemberDocumentEditAvailabilityState();
    if (!availability.isEditable) {
      setMessage("error", availability.disabledMessage);
      render();
      return;
    }
    if (!validatePublicApplicationFields()) return;
    if (APPLICANT_IS_PREVIEW_MODE) { setMessage('success', '미리보기에서는 서류를 저장하지 않습니다.'); render(); return; }
    let fieldError = null;
    state.isSaving = true;
    resetMessage();
    render();
    try {
      const submission = await apiRequest("/api/public/members/documents", { method: "POST", body: JSON.stringify({ answers: await buildSubmissionPayloadAnswers() }) });
      applySubmissionContext({ accessToken: state.identity.accessToken, submission, source: "lookup" });
      setMessage("success", "서류를 제출했습니다.");
    } catch (error) {
      if (error.fieldKey) fieldError = error;
      else setMessage("error", error.message);
    }
    finally { state.isSaving = false; render(); if (fieldError) showPublicApplicationFieldError(fieldError); }
  }

  function render() {
    const markup =
      state.mode === "signup"
        ? membership.signupScreen()
        : state.mode === "document-status"
        ? renderMemberDocumentStatus()
        : state.mode === "documents"
        ? renderMemberDocuments()
        : state.mode === "verify"
        ? renderVerify()
        : state.mode === "apply"
          ? renderApply()
        : state.mode === "form"
          ? renderForm()
          : state.mode === "result"
            ? renderResult()
            : state.mode === "lookup"
              ? renderLookup()
              : state.mode === "lookup-summary"
                ? renderLookupSummaryResult()
                : state.mode === "lookup-ticket"
                ? renderLookupTicketResult()
                : renderHome();

    root.innerHTML = `<public-school-header></public-school-header>${markup}${renderApplicantDialog()}${renderApplicantPdfPreview()}`;
    recruitmentSummaryObserver?.disconnect();
    root.querySelectorAll('.applicant-public-selection-summary').forEach(element => recruitmentSummaryObserver?.observe(element));
    fitRecruitmentSummaryValues();
    syncApplicantBranding();
    updateApplicantDocumentTitle();
    persistApplicantPublicState();
    syncVerificationCountdown();
    syncVerificationCountdownUi();
    syncApplicantPasswordConfirmValidationUI();
    syncApplicantDialogUi();
    syncApplicantPdfPreviewUi();
  }

  async function loadFormConfig() {
    state.isLoadingForm = true;
    state.loadError = "";
    render();

    try {
      const payload = await apiRequest("/api/public/applicant-form", {
        method: "GET",
        headers: {},
      });
      applyApplicantPreviewIdentity();
      state.formConfig = {
        fields: Array.isArray(payload?.fields) ? payload.fields : [],
        documentFields: Array.isArray(payload?.documentFields) ? payload.documentFields : [],
        formTemplates: Array.isArray(payload?.formTemplates) ? payload.formTemplates : [],
        recruitmentUnits: Array.isArray(payload?.recruitmentUnits) ? payload.recruitmentUnits : [],
        schedules: Array.isArray(payload?.schedules) ? payload.schedules : [],
        settings: payload?.settings || {},
        superAdminSettings: normalizeApplicantBrandSettings(payload?.superAdminSettings),
        systemSettings: {
          admissionHomepageUrl: "",
          ...(payload?.systemSettings && typeof payload.systemSettings === "object" ? payload.systemSettings : {}),
        },
        noticeHtml: String(payload?.noticeHtml || ""),
        noticeHtmlEn: String(payload?.noticeHtmlEn || ""),
      };
      syncApplicantRecruitmentSelection({ preserveExisting: true });
      state.draftAnswers = {
        ...buildDraftAnswers(state.currentSubmission),
        ...(state.draftAnswers && typeof state.draftAnswers === "object" ? state.draftAnswers : {}),
      };
      syncApplicantRecruitmentSelectionIntoDraftAnswers();
      syncApplicantFieldUiState();
      syncApplicantRoute({ replace: true });
    } catch (error) {
      state.loadError = error?.message || "접수 양식을 불러오지 못했습니다.";
    } finally {
      state.isLoadingForm = false;
      render();
    }
  }

  async function sendVerificationCode() {
    if (state.verification.isSending || state.verification.isVerifying || getVerificationResendSeconds() > 0) return;
    resetMessage();
    const entryAvailabilityState = getApplicantApplyEntryAvailabilityState();

    if (!entryAvailabilityState.isAvailable) {
      notifyApplicantApplyEntryUnavailable(entryAvailabilityState);
      return;
    }

    const verificationForm = root.querySelector('.applicant-public-verify-form');
    if (verificationForm && !globalThis.AdmitCardPublicFormFeedback.validate(verificationForm)) return;
    let fieldStatus = null;
    state.verification.code = "";
    state.verification.debugCode = "";
    state.verification.isSending = true;
    render();

    try {
      const payload = await apiRequest("/api/public/email-verifications", {
        method: "POST",
        body: JSON.stringify({
          name: state.verification.name,
          email: state.verification.email,
        }),
      });
      state.verification.debugCode = String(payload?.debugCode || "");
      state.verification.expiresAt = Date.now() + Math.max(0, Number(payload?.expiresInSeconds || 0)) * 1000;
      state.verification.resendAvailableAt = Date.now() + VERIFICATION_RESEND_DELAY_MS;
      try { sessionStorage.setItem('applyhub.applicant-verification-resend-at', String(state.verification.resendAvailableAt)); } catch { /* In-memory cooldown still applies. */ }
      fieldStatus = { text: state.verification.debugCode ? '아래 표시된 인증코드를 입력해 주세요.' : '이메일로 발송한 인증코드를 입력해 주세요.', error: false };
    } catch (error) {
      fieldStatus = { text: error?.message || '인증 코드를 생성하지 못했습니다.', error: true };
    } finally {
      state.verification.isSending = false;
      render();
      if (fieldStatus) globalThis.AdmitCardPublicFormFeedback.status(document.getElementById('verificationEmail'), fieldStatus.text, fieldStatus.error);
    }
  }

  async function verifyCode() {
    if (state.verification.isVerifying || state.verification.isSending) return;
    resetMessage();
    const entryAvailabilityState = getApplicantApplyEntryAvailabilityState();

    if (!APPLICANT_IS_PREVIEW_MODE && !entryAvailabilityState.isAvailable) {
      notifyApplicantApplyEntryUnavailable(entryAvailabilityState);
      return;
    }

    if (Number(state.verification.expiresAt || 0) > 0 && isVerificationCodeExpired()) {
      render();
      globalThis.AdmitCardPublicFormFeedback.status(document.getElementById('verificationCode'), '인증 코드가 만료되었습니다. 새 코드를 다시 생성하세요.', true);
      return;
    }

    if (!canVerifyCode()) {
      syncVerificationButtons();
      return;
    }
    let fieldError = '';
    state.verification.isVerifying = true;
    render();

    try {
      const payload = await apiRequest("/api/public/email-verifications/verify", {
        method: "POST",
        body: JSON.stringify({
          name: state.verification.name,
          email: state.verification.email,
          code: state.verification.code,
        }),
      });
      applySubmissionContext({
        accessToken: payload?.accessToken || "",
        submission: payload?.submission || {
          name: state.verification.name,
          email: state.verification.email,
        },
        source: "apply",
      });
      state.verification.expiresAt = 0;
      setMessage("success", hasApplicantRecruitmentSelectionStep() ? "이메일 인증이 완료되었습니다. 접수 신청 정보를 선택하세요." : "이메일 인증이 완료되었습니다. 접수를 진행하세요.");
      navigateToApplicantMode(getApplicantFlowEntryMode());
      return;
    } catch (error) {
      fieldError = error?.message || '이메일 인증에 실패했습니다.';
    } finally {
      state.verification.isVerifying = false;
      if (state.mode === "verify") {
        render();
        if (fieldError) globalThis.AdmitCardPublicFormFeedback.status(document.getElementById('verificationCode'), fieldError, true);
      }
    }
  }

  function getPublicApplicationControl(fieldKey) {
    return [...root.querySelectorAll('[data-applicant-field-key]')].find(input => input.dataset.applicantFieldKey === fieldKey) || [...root.querySelectorAll('[data-choice-prefix=applicant]')].find(group => group.dataset.choiceGroup === fieldKey)?.querySelector('[data-choice-option]');
  }

  function showPublicApplicationFieldError(error) {
    const control = getPublicApplicationControl(error.fieldKey);
    if (!globalThis.AdmitCardPublicFormFeedback.status(control, error.message, true)) {
      setMessage('error', error.message);
      return;
    }
    const field = control.closest('.applicant-public-field');
    (field.querySelector('select, input:not([type=hidden]):not([type=file]), textarea, button, label[for]') || control).focus();
    field.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function validatePublicApplicationFields() {
    let firstError = null;
    for (const field of getActiveApplicantFields()) {
      const control = getPublicApplicationControl(field.fieldKey);
      if (!control || control.disabled || control.readOnly) continue;
      const value = state.draftAnswers[field.fieldKey];
      const missing = isApplicantUploadField(field) ? !(value?.file || value?.hasFile || value?.hasPhoto) : !String(value || '').trim();
      const parts = state.fieldUi?.dateParts?.[field.fieldKey];
      const partialDate = ['date', 'birthdate'].includes(field.inputType) && parts && Object.values(parts).some(Boolean) && !value;
      if ((field.required && missing) || partialDate) {
        const error = { fieldKey: field.fieldKey, message: isApplicantUploadField(field) ? '파일을 업로드해 주세요.' : partialDate ? '날짜를 모두 선택해 주세요.' : '필수 항목을 입력하거나 선택해 주세요.' };
        globalThis.AdmitCardPublicFormFeedback.status(control, error.message, true);
        firstError ||= error;
      }
    }
    if (firstError) showPublicApplicationFieldError(firstError);
    return !firstError;
  }

  async function saveApplication() {
    resetMessage();
    const formEditAvailabilityState = getApplicantFormEditAvailabilityState();

    if (!APPLICANT_IS_PREVIEW_MODE && !formEditAvailabilityState.isEditable) {
      setMessage("error", formEditAvailabilityState.disabledMessage);
      render();
      return;
    }

    if (hasApplicantRecruitmentSelectionStep() && !hasCompletedApplicantRecruitmentSelection()) {
      setMessage("error", "접수 신청 정보를 먼저 선택하세요.");
      return;
    }

    if (!validatePublicApplicationFields()) return;
    const passwordError = (id, text) => {
      const control = document.getElementById(id);
      globalThis.AdmitCardPublicFormFeedback.status(control, text, true);
      control?.focus();
    };

    const hasExistingPassword = Boolean(membership?.member) || state.currentSubmission?.hasPassword === true;
    const passwordValue = String(state.application.password || "");
    const passwordConfirmValue = String(state.application.passwordConfirm || "");
    state.application.passwordConfirmTouched = true;
    syncApplicantPasswordConfirmValidationUI();

    if (!passwordValue.trim()) {
      if (!hasExistingPassword) {
        passwordError('applicationPassword', '비밀번호를 입력하세요.');
        return;
      }

      if (passwordConfirmValue.trim()) {
        passwordError('applicationPassword', '변경할 비밀번호를 입력하세요.');
        return;
      }
    }

    if (passwordValue.trim()) {
      if (passwordValue.length < 4) {
        passwordError('applicationPassword', '비밀번호는 4자 이상이어야 합니다.');
        return;
      }

      if (passwordValue.length > 100) {
        passwordError('applicationPassword', '비밀번호는 100자 이하여야 합니다.');
        return;
      }

      if (!passwordConfirmValue.trim()) {
        document.getElementById('applicationPasswordConfirm')?.focus();
        return;
      }

      if (passwordValue !== passwordConfirmValue) {
        document.getElementById('applicationPasswordConfirm')?.focus();
        return;
      }
    }

    let fieldError = null;
    state.isSaving = true;
    render();

    try {
      const payload = await apiRequest("/api/public/applications", {
        method: "POST",
        body: JSON.stringify({
          accessToken: state.identity.accessToken,
          submissionId: state.identity.submissionId || state.currentSubmission?.id || 0,
          password: state.application.password,
          selectionAnswers: buildApplicantRecruitmentSelectionPayload(),
          answers: await buildSubmissionPayloadAnswers(),
        }),
      });
      applySubmissionContext({
        accessToken: state.identity.accessToken,
        submission: payload,
        source: state.identity.source || "apply",
      });
      membership?.markSubmitted(payload);
      await membership?.refreshApplication().catch(() => {});
      state.application.passwordConfirm = "";
      state.application.passwordConfirmTouched = false;
      setMessage("success", "접수가 완료되었습니다.");
      navigateToApplicantMode("result");
      return;
    } catch (error) {
      if (error.code === 'APPLICANT_ALREADY_SUBMITTED') {
        await membership?.refreshApplication().catch(() => {});
        setMessage('error', error.message);
        navigateToApplicantMode('home');
        return;
      }
      if (error.fieldKey) fieldError = error;
      else setMessage("error", error?.message || "접수 저장에 실패했습니다.");
    } finally {
      state.isSaving = false;
      if (state.mode === "form") {
        render();
        if (fieldError) showPublicApplicationFieldError(fieldError);
      }
    }
  }

  async function lookupSubmission() {
    resetMessage();
    const lookupTarget = normalizeApplicantLookupTarget(state.lookup.target);
    const lookupAvailabilityState = getApplicantLookupActionAvailabilityState(lookupTarget);

    if (!lookupAvailabilityState.isAvailable) {
      setMessage("error", getApplicantLookupActionDisabledMessage(lookupTarget, lookupAvailabilityState));
      render();
      return;
    }

    let fieldError = '';
    state.lookup.isLoading = true;
    render();

    try {
      const payload = await apiRequest("/api/public/applications/lookup", {
        method: "POST",
        body: JSON.stringify({
          lookupTarget,
          name: state.lookup.name,
          email: state.lookup.email,
          password: state.lookup.password,
        }),
      });
      state.lookup.password = "";
      applySubmissionContext({
        accessToken: payload?.accessToken || "",
        submission: payload?.submission,
        source: "lookup",
      });
      navigateToApplicantMode(getApplicantLookupResultMode(lookupTarget));
      return;
    } catch (error) {
      if (error.status >= 400 && error.status < 500) fieldError = error.message || '입력한 접수 조회 정보를 확인해 주세요.';
      else setMessage('error', error?.message || '접수 이력을 찾지 못했습니다.');
    } finally {
      state.lookup.isLoading = false;
      if (state.mode === "lookup") {
        render();
        if (fieldError) globalThis.AdmitCardPublicFormFeedback.status(document.getElementById('lookupPassword'), fieldError, true);
      }
    }
  }

  root.addEventListener("click", async (event) => {
    const clickedElement = event.target instanceof Element ? event.target : null;
    const nationalityOption = clickedElement?.closest("[data-applicant-nationality-value]");
    const noticeLink = clickedElement?.closest(".login-notice-content a[href]") || null;

    if (noticeLink instanceof HTMLAnchorElement) {
      event.preventDefault();
      window.open(noticeLink.href, "_blank", "noopener,noreferrer");
      return;
    }

    if (clickedElement?.closest("[data-applicant-dialog-close]")) {
      closeApplicantDialog();
      return;
    }

    if (nationalityOption instanceof HTMLElement) {
      const fieldKey = String(nationalityOption.dataset.applicantNationalityFieldKey || "").trim();
      const optionValue = String(nationalityOption.dataset.applicantNationalityValue || "").trim();

      if (fieldKey && optionValue) {
        state.draftAnswers[fieldKey] = optionValue;
      }

      const inputElement = findApplicantFieldElement(fieldKey);
      // Restore focus before closing: focusin opens this field's search results.
      if (inputElement instanceof HTMLInputElement) {
        inputElement.focus({ preventScroll: true });
      }
      closeNationalityPicker();
      syncNationalityFieldUI(fieldKey);
      persistApplicantPublicState();

      return;
    }

    const openNationalityFieldKey = state.nationalityPicker.openFieldKey;

    if (!clickedElement?.closest(".applicant-public-nationality-field") && openNationalityFieldKey) {
      closeNationalityPicker();
      syncNationalityFieldUI(openNationalityFieldKey);
    }

    const target = clickedElement ? clickedElement.closest("[data-applicant-action]") : null;

    if (!target) {
      return;
    }

    const action = String(target.dataset.applicantAction || "").trim();
    if (await membership.handleAction(action)) return;

    if (action === "choose-upload-file") {
      const fieldKey = String(target.dataset.applicantUploadFieldKey || "").trim();

      if (!fieldKey) {
        return;
      }

      const fileInput = findApplicantFieldElement(fieldKey);

      if (fileInput instanceof HTMLInputElement && fileInput.type === "file") {
        fileInput.click();
      }

      return;
    }

    if (action === "open-uploaded-pdf-preview") {
      await openApplicantPdfPreview(target.dataset.applicantUploadFieldKey);
      return;
    }

    if (action === "close-pdf-preview") {
      closeApplicantPdfPreview();
      return;
    }

    if (action === "open-pdf-preview-external") {
      openApplicantPdfPreviewExternally();
      return;
    }

    if (action === "go-verify") {
      const entryAvailabilityState = getApplicantApplyEntryAvailabilityState();

      if (!entryAvailabilityState.isAvailable) {
        notifyApplicantApplyEntryUnavailable(entryAvailabilityState);
        return;
      }

      resetMessage();
      navigateToApplicantMode("verify");
      return;
    }

    if (action === "go-lookup-summary") {
      state.lookup.target = APPLICANT_LOOKUP_TARGETS.result;
      resetMessage();
      navigateToApplicantMode("lookup");
      return;
    }

    if (action === "go-lookup" || action === "go-lookup-ticket") {
      state.lookup.target = APPLICANT_LOOKUP_TARGETS.ticket;
      const lookupAvailabilityState = getApplicantLookupAvailabilityState();

      if (!lookupAvailabilityState.isAvailable) {
        setMessage("error", getApplicantLookupDisabledMessage(lookupAvailabilityState));
        render();
        return;
      }

      resetMessage();
      navigateToApplicantMode("lookup");
      return;
    }

    if (action === "open-form-test-entry") {
      openApplicantFormTestEntry();
      return;
    }

    if (action === "go-admission-home") {
      const admissionHomepageUrl = resolveAdmissionHomepageUrl();

      if (!admissionHomepageUrl) {
        setMessage("error", "입학처 홈페이지 링크가 아직 설정되지 않았습니다.");
        render();
        return;
      }

      window.open(admissionHomepageUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (action === "back-home" || action === "confirm-result") {
      resetToHome();
      return;
    }

    if (action === "continue-application") {
      resetMessage();
      const entryAvailabilityState = getApplicantApplyEntryAvailabilityState();

      if (!APPLICANT_IS_PREVIEW_MODE && !entryAvailabilityState.isAvailable) {
        notifyApplicantApplyEntryUnavailable(entryAvailabilityState);
        return;
      }

      if (!hasCompletedApplicantRecruitmentSelection()) {
        const nextRequiredField =
          APPLICANT_RECRUITMENT_SELECTION_FIELDS.find((definition) => {
            const options = getApplicantRecruitmentSelectionOptions(definition.key, state.recruitment);

            if (options.length === 0) {
              return false;
            }

            const selectedValue = String(state.recruitment?.[definition.key] || "").trim();
            return !selectedValue || !options.includes(selectedValue);
          }) || null;

        const control = document.getElementById(`applicationSelection-${nextRequiredField?.key}`);
        if (globalThis.AdmitCardPublicFormFeedback.status(control, `${nextRequiredField?.label || '접수 신청 정보'}을(를) 선택하세요.`, true)) control.focus();
        else setMessage('error', '접수 신청 정보를 선택하세요.');
        return;
      }

      const formEditAvailabilityState = getApplicantFormEditAvailabilityState();

      if (!APPLICANT_IS_PREVIEW_MODE && !formEditAvailabilityState.isEditable) {
        setMessage("error", formEditAvailabilityState.disabledMessage);
        render();
        return;
      }

      syncApplicantRecruitmentSelectionIntoDraftAnswers();
      navigateToApplicantMode("form");
      return;
    }

    if (action === "back-form") {
      resetMessage();
      navigateToApplicantMode(getApplicantFormBackMode());
      return;
    }

    if (action === "preview-home") {
      resetMessage();
      navigateToApplicantMode("home");
      return;
    }

    if (action === "back-lookup-result") {
      resetMessage();
      navigateToApplicantMode(getApplicantLookupResultMode());
      return;
    }

    if (action === "edit-application") {
      resetMessage();
      const formEditAvailabilityState = getApplicantFormEditAvailabilityState();

      if (!APPLICANT_IS_PREVIEW_MODE && !formEditAvailabilityState.isEditable) {
        setMessage("error", formEditAvailabilityState.disabledMessage);
        render();
        return;
      }

      state.application.password = "";
      state.application.passwordConfirm = "";
      state.application.passwordConfirmTouched = false;
      state.draftAnswers = buildDraftAnswers(state.currentSubmission);
      state.recruitment = getApplicantRecruitmentSelectionFromSubmission(state.currentSubmission);
      syncApplicantRecruitmentSelection({ preserveExisting: true });
      syncApplicantRecruitmentSelectionIntoDraftAnswers();
      syncApplicantFieldUiState({ preserveExisting: false });
      closeNationalityPicker();
      navigateToApplicantMode(getApplicantFlowEntryMode());
      return;
    }

    if (action === "send-code") {
      await sendVerificationCode();
    }
  });

  root.addEventListener("submit", async (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;

    if (!form) {
      return;
    }
    if (["member-login", "member-register", "member-terms"].includes(form.dataset.applicantForm)) {
      event.preventDefault();
      await membership.handleSubmit(form);
      return;
    }
    if (form.dataset.applicantForm === "member-documents") {
      event.preventDefault();
      await saveMemberDocuments();
      return;
    }

    if (form.matches("[data-applicant-form='verify-code']")) {
      event.preventDefault();
      await verifyCode();
      return;
    }

    if (form.matches("[data-applicant-form='application']")) {
      event.preventDefault();

      if (APPLICANT_IS_PREVIEW_MODE) {
        setMessage("error", "미리보기 화면에서는 접수를 저장할 수 없습니다.");
        return;
      }

      await saveApplication();
      return;
    }

    if (form.matches("[data-applicant-form='lookup']")) {
      event.preventDefault();
      await lookupSubmission();
    }
  });

  root.addEventListener("input", (event) => {
    const target = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement
      ? event.target
      : null;

    if (!target) {
      return;
    }

    if (target.dataset.applicantModel === "verification.name") {
      state.verification.name = target.value;
      persistApplicantPublicState();
      return;
    }

    if (target.dataset.applicantModel === "verification.email") {
      state.verification.email = target.value;
      persistApplicantPublicState();
      return;
    }

    if (target.dataset.applicantModel === "verification.code") {
      target.value = target.value.replace(/\D/g, '').slice(0, VERIFICATION_CODE_LENGTH);
      state.verification.code = target.value;
      syncVerificationButtons();
      persistApplicantPublicState();
      return;
    }

    if (target.dataset.applicantModel === "lookup.name") {
      state.lookup.name = target.value;
      persistApplicantPublicState();
      return;
    }

    if (target.dataset.applicantModel === "lookup.email") {
      state.lookup.email = target.value;
      persistApplicantPublicState();
      return;
    }

    if (target.dataset.applicantModel === "lookup.password") {
      state.lookup.password = target.value;
      return;
    }

    if (target.dataset.applicantModel === "application.password") {
      state.application.password = target.value;
      if (state.application.passwordConfirmTouched) {
        syncApplicantPasswordConfirmValidationUI();
      }
      persistApplicantPublicState();
      return;
    }

    if (String(target.dataset.applicantModel || "").startsWith("recruitment.")) {
      const recruitmentKey = String(target.dataset.applicantModel || "").replace("recruitment.", "").trim();
      const definition = APPLICANT_RECRUITMENT_SELECTION_FIELDS.find((field) => field.key === recruitmentKey) || null;

      if (!definition) {
        return;
      }

      state.recruitment[recruitmentKey] = target.value;
      const changedFieldIndex = APPLICANT_RECRUITMENT_SELECTION_FIELDS.findIndex((field) => field.key === recruitmentKey);

      for (let index = changedFieldIndex + 1; index < APPLICANT_RECRUITMENT_SELECTION_FIELDS.length; index += 1) {
        state.recruitment[APPLICANT_RECRUITMENT_SELECTION_FIELDS[index].key] = "";
      }

      syncApplicantRecruitmentSelection({ preserveExisting: true });
      syncApplicantRecruitmentSelectionIntoDraftAnswers();
      persistApplicantPublicState();
      render();
      document.getElementById(target.id)?.focus();
      return;
    }

    if (target.dataset.applicantModel === "application.passwordConfirm") {
      state.application.passwordConfirm = target.value;
      if (state.application.passwordConfirmTouched) {
        syncApplicantPasswordConfirmValidationUI();
      }
      persistApplicantPublicState();
      return;
    }

    const multiGroup = target.closest('[data-choice-prefix="applicant"]');
    if (multiGroup) { state.draftAnswers[multiGroup.dataset.choiceGroup] = applicantPublicRenderingHelpersModule.readMultiSelect(multiGroup); persistApplicantPublicState(); return; }

    const customSelectFieldKey = String(target.dataset.applicantSelectCustomFieldKey || "").trim();

    if (customSelectFieldKey) {
      state.draftAnswers[customSelectFieldKey] = target.value;
      persistApplicantPublicState();
      return;
    }

    const fieldKey = String(target.dataset.applicantFieldKey || "").trim();

    if (!fieldKey) {
      return;
    }

    if (target.dataset.applicantSelectSource === "true") {
      return;
    }

    if (target.dataset.applicantFieldType === "nationality") {
      state.draftAnswers[fieldKey] = target.value;
      state.nationalityPicker.openFieldKey = fieldKey;
      syncNationalityFieldUI(fieldKey);
      persistApplicantPublicState();
      return;
    }

    if (target.dataset.applicantFieldType === "phone") {
      const normalizedPhoneValue = String(target.value || "").replace(/\D+/g, "");
      target.value = normalizedPhoneValue;
      state.draftAnswers[fieldKey] = normalizedPhoneValue;
      persistApplicantPublicState();
      return;
    }

    state.draftAnswers[fieldKey] = target.value;
    persistApplicantPublicState();
  });

  root.addEventListener("change", async (event) => {
    const element =
      event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement
        ? event.target
        : null;

    if (!element) {
      return;
    }

    if (String(element.dataset.applicantModel || "").startsWith("recruitment.")) {
      const mirroredInputEvent = new Event("input", { bubbles: true });
      element.dispatchEvent(mirroredInputEvent);
      return;
    }

    const multiGroup = element.closest('[data-choice-prefix="applicant"]');
    if (multiGroup) { state.draftAnswers[multiGroup.dataset.choiceGroup] = applicantPublicRenderingHelpersModule.readMultiSelect(multiGroup); persistApplicantPublicState(); return; }

    const dateFieldKey = String(element.dataset.applicantDateFieldKey || "").trim();
    const datePart = String(element.dataset.applicantDatePart || "").trim();

    if (dateFieldKey && datePart) {
      const nextParts = {
        ...getApplicantDatePartState(dateFieldKey),
        [datePart]: String(element.value || "").trim(),
      };
      const maxDay = getApplicantDateDayCount(nextParts.year, nextParts.month);

      if (nextParts.day && Number(nextParts.day) > maxDay) {
        nextParts.day = "";
      }

      state.fieldUi.dateParts[dateFieldKey] = nextParts;
      state.draftAnswers[dateFieldKey] = buildApplicantDateValueFromParts(nextParts);
      persistApplicantPublicState();
      render();
      document.getElementById(element.id)?.focus();
      return;
    }

    if (element instanceof HTMLInputElement && element.type === "file") {
      const fieldKey = String(element.dataset.applicantFieldKey || "").trim();
      const fieldType = String(element.dataset.applicantFieldType || getApplicantFormFieldByKey(fieldKey)?.inputType || "").trim();
      const file = element.files?.[0] || null;

      if (!fieldKey) {
        return;
      }

      if (state.pdfPreview?.fieldKey === fieldKey) {
        closeApplicantPdfPreview({ render: false });
      }

      const field = getApplicantFormFieldByKey(fieldKey);
      if (file && fieldType === 'file' && !applicantFormConfig.isAllowedUploadExtension(file.name, field?.allowedExtensions)) {
        element.value = '';
        globalThis.AdmitCardPublicFormFeedback.status(element, `${field.allowedExtensions.join(', ')} 파일만 업로드할 수 있습니다.`, true);
        return;
      }
      state.draftAnswers[fieldKey] = file
        ? fieldType === "photo"
          ? {
              file,
              fileName: file.name,
              hasPhoto: true,
            }
          : {
              file,
              fileName: file.name,
              hasFile: true,
            }
        : buildApplicantUploadDraftValue(fieldType);
      persistApplicantPublicState();
      render();
      return;
    }

    const fieldKey = String(element.dataset.applicantFieldKey || "").trim();

    if (fieldKey) {
      if (element.dataset.applicantSelectSource === "true") {
        const field = getApplicantFormFieldByKey(fieldKey);
        const fieldOptions = Array.isArray(field?.options) ? field.options : [];
        const customOptionLabel = String(field?.customOptionLabel || "").trim();
        const hasLinkedCustomOption =
          field?.allowCustomOption === true && customOptionLabel !== "" && fieldOptions.includes(customOptionLabel);

        if (element.value === APPLICANT_CUSTOM_SELECT_VALUE || (hasLinkedCustomOption && element.value === customOptionLabel)) {
          state.fieldUi.customSelectModes[fieldKey] = true;

          const currentDraftValue = String(state.draftAnswers[fieldKey] || "").trim();

          if (!currentDraftValue || currentDraftValue === customOptionLabel || fieldOptions.includes(currentDraftValue)) {
            state.draftAnswers[fieldKey] = "";
          }

          persistApplicantPublicState();
          render();
          document.getElementById(`field-${fieldKey}-custom`)?.focus();
          return;
        }

        delete state.fieldUi.customSelectModes[fieldKey];
        state.draftAnswers[fieldKey] = element.value;
        persistApplicantPublicState();
        render();
        document.getElementById(element.id)?.focus();
        return;
      }

      if (element.dataset.applicantFieldType === "phone") {
        const normalizedPhoneValue = String(element.value || "").replace(/\D+/g, "");
        element.value = normalizedPhoneValue;
        state.draftAnswers[fieldKey] = normalizedPhoneValue;
        persistApplicantPublicState();
        return;
      }

      if (element.dataset.applicantFieldType === "nationality") {
        if (element.value !== getNationalityDisplayValue(state.draftAnswers[fieldKey])) state.draftAnswers[fieldKey] = element.value;
        persistApplicantPublicState();
        return;
      }

      state.draftAnswers[fieldKey] = element.value;
      persistApplicantPublicState();
    }
  });

  root.addEventListener("focusin", (event) => {
    const target = event.target instanceof HTMLInputElement ? event.target : null;
    const fieldKey = String(target?.dataset?.applicantFieldKey || "").trim();

    if (!target || target.dataset.applicantFieldType !== "nationality" || !fieldKey) {
      return;
    }

    if (state.nationalityPicker.openFieldKey === fieldKey) {
      return;
    }

    state.nationalityPicker.openFieldKey = fieldKey;
    syncNationalityFieldUI(fieldKey);
  });

  root.addEventListener("focusout", (event) => {
    const passwordConfirmInput =
      event.target instanceof HTMLInputElement && event.target.dataset.applicantModel === "application.passwordConfirm"
        ? event.target
        : null;

    if (passwordConfirmInput) {
      state.application.passwordConfirmTouched = true;
      syncApplicantPasswordConfirmValidationUI();
    }

    const currentTarget = event.target instanceof Element ? event.target.closest(".applicant-public-nationality-field") : null;

    if (!currentTarget) {
      return;
    }

    const relatedTarget = event.relatedTarget instanceof Element ? event.relatedTarget : null;

    if (relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }

    const fieldInput = currentTarget.querySelector("[data-applicant-field-key]");
    const fieldKey = String(fieldInput?.dataset?.applicantFieldKey || "").trim();

    if (!fieldKey || state.nationalityPicker.openFieldKey !== fieldKey) {
      return;
    }

    normalizeNationalityDraftValue(fieldKey);
    closeNationalityPicker();
    syncNationalityFieldUI(fieldKey);
  });

  window.addEventListener("popstate", (event) => {
    closeApplicantPdfPreview({ render: false });
    applyApplicantRouteFromLocation();
  });

  window.addEventListener("resize", () => {
    fitRecruitmentSummaryValues();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.pdfPreview?.isOpen === true) {
      event.preventDefault();
      closeApplicantPdfPreview();
      return;
    }

    if (event.key === "Escape" && state.dialog?.isOpen === true) {
      event.preventDefault();
      closeApplicantDialog();
      return;
    }

  });

  membership = globalThis.createApplicantMembershipController({
    apiRequest, escapeHtml, render, navigate: navigateToApplicantMode, setMessage,
    isApplyButtonVisible: () => getApplicantBrandSettings().recruitmentEnabled,
    getApplyAvailability: () => {
      const availability = getApplicantApplyEntryAvailabilityState();
      return { ...availability, disabledMessage: getApplicantApplyEntryDisabledMessage(availability) };
    },
    clearApplication: () => {
      window.sessionStorage.removeItem(APPLICANT_PUBLIC_STATE_STORAGE_KEY);
      state.identity = { name: "", email: "", accessToken: "", submissionId: 0, source: "" };
      state.currentSubmission = null;
      state.documentStatus = null;
      state.draftAnswers = {};
      state.recruitment = {};
      state.verification.name = "";
      state.verification.email = "";
      state.lookup.name = "";
      state.lookup.email = "";
    },
    openApplication: async (action, context, member) => {
      if (action !== "apply" && !context.submission?.id) throw new Error("접수 내역이 없습니다. 먼저 접수하기를 진행하세요.");
      state.identity.name = member.name;
      state.identity.email = member.email;
      state.verification.name = member.name;
      state.verification.email = member.email;
      state.lookup.name = member.name;
      state.lookup.email = member.email;
      applySubmissionContext({ ...context, source: "lookup" });
      for (const field of state.formConfig.fields) {
        if (!state.draftAnswers[field.fieldKey]) {
          if ((field.systemFieldKey === 'birth' || field.inputType === 'birthdate') && membership.birthDate) state.draftAnswers[field.fieldKey] = membership.birthDate;
          if (field.inputType === "phone" && typeof member.profile?.phone === 'string') state.draftAnswers[field.fieldKey] = member.profile.phone;
        }
      }
      syncApplicantFieldUiState({ preserveExisting: false });
      resetMessage();
      if (action === "apply") {
        const availability = getApplicantApplyEntryAvailabilityState();
        if (!availability.isAvailable) { notifyApplicantApplyEntryUnavailable(availability); return; }
        navigateToApplicantMode(getApplicantFlowEntryMode());
      } else if (action === "document-status") {
        state.documentStatus = null;
        state.documentStatus = await apiRequest("/api/public/members/document-status");
        navigateToApplicantMode("document-status");
      } else if (action === "documents") {
        navigateToApplicantMode("documents");
      } else {
        state.lookup.target = action === "ticket" ? APPLICANT_LOOKUP_TARGETS.ticket : APPLICANT_LOOKUP_TARGETS.result;
        if (action === "ticket" && !getApplicantLookupAvailabilityState().isAvailable) throw new Error(getApplicantLookupDisabledMessage());
        navigateToApplicantMode(action === "ticket" ? "lookup-ticket" : "lookup-summary");
      }
    },
  });
  const initialMode = getApplicantModeFromPathname(window.location.pathname);
  if (APPLICANT_IS_PREVIEW_MODE) {
    if (!APPLICANT_IS_THUMBNAIL) restoreApplicantPublicState();
    state.mode = initialMode;
    render();
    loadFormConfig();
    if (initialMode === 'signup') {
      membership.initialize().then(render).catch(error => { state.loadError = error.message; render(); });
    }
  } else {
    window.sessionStorage.removeItem(APPLICANT_PUBLIC_STATE_STORAGE_KEY);
    state.mode = initialMode === "signup" ? "signup" : "home";
    render();
    membership.initialize().then(async () => {
      await loadFormConfig();
      if (membership.member && ["form", "apply", "lookup-summary", "lookup-ticket", "documents", "document-status", "result"].includes(initialMode)) {
        const action = ["form", "apply"].includes(initialMode) ? "apply" : initialMode === "lookup-ticket" ? "ticket" : initialMode === "documents" ? "documents" : initialMode === "document-status" ? "document-status" : "summary";
        await membership.handleAction(`member-${action}`);
      }
    }).catch((error) => { state.loadError = error.message; state.isLoadingForm = false; render(); });
  }
})();
