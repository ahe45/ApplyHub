(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardAuthDocumentEvents = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createAuthDocumentEventHandlers({
    cancelAccountEdit,
    changeSystemAutoLogoutMinutes,
    clearSystemBackupRestoreFileSelection,
    closePasswordSetupPrompt,
    confirmSystemSettingsNavigation,
    deleteAccountAction,
    deleteSystemDataAction,
    downloadSystemBackupAction,
    loadSystemAuditLogs,
    runSystemBackupAutomationNow,

    hasUnsavedSystemSettingsChanges,
    importSystemBackupAction,
    logoutCurrentUser,
    openModal,
    prepareBatchPrintDownloadModal,
    applySuperAdminImageFile,
    renderView,
    requestCloseModal,
    resetAccountPasswordAction,
    saveAccountEdit,
    saveSuperAdminSettings,
    saveSystemBackupAutomationSettings,
    saveSystemSettings,
    setAccountCreateError,

    setSuperAdminStatus,
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
    updateSystemBackupAutomationField,
    updateSuperAdminField,
    updateSuperAdminImageField,
    updateBatchPrintOutputMode,
    updateAccountEditorField,
    selectSystemBackupRestoreFile,
  }) {
    function createEmptySystemScheduleParts() {
      return {
        year: "",
        month: "",
        day: "",
        hour: "",
        minute: "",
      };
    }

    function normalizeSystemScheduleParts(parts = {}) {
      return {
        year: String(parts?.year || "").trim(),
        month: String(parts?.month || "").trim(),
        day: String(parts?.day || "").trim(),
        hour: String(parts?.hour || "").trim(),
        minute: String(parts?.minute || "").trim(),
      };
    }

    function getSystemScheduleDayCount(yearValue, monthValue) {
      const normalizedYear = Number(yearValue);
      const normalizedMonth = Number(monthValue);

      if (!Number.isInteger(normalizedYear) || normalizedYear < 1 || !Number.isInteger(normalizedMonth) || normalizedMonth < 1 || normalizedMonth > 12) {
        return 31;
      }

      return new Date(normalizedYear, normalizedMonth, 0).getDate();
    }

    function padSystemScheduleValue(value) {
      return String(value || "").padStart(2, "0");
    }

    function clampSystemScheduleParts(parts = {}) {
      const normalizedParts = normalizeSystemScheduleParts(parts);
      const maxDay = getSystemScheduleDayCount(normalizedParts.year, normalizedParts.month);
      const normalizedDay = Number(normalizedParts.day);

      return {
        ...normalizedParts,
        day:
          Number.isInteger(normalizedDay) && normalizedDay >= 1
            ? padSystemScheduleValue(Math.min(normalizedDay, maxDay))
            : padSystemScheduleValue(1),
      };
    }

    function buildSystemScheduleDateTime(parts = {}) {
      const normalizedParts = clampSystemScheduleParts(parts);

      if (Object.values(normalizedParts).some((value) => !value)) {
        return "";
      }

      const candidateValue =
        `${normalizedParts.year}-${normalizedParts.month}-${normalizedParts.day}T${normalizedParts.hour}:${normalizedParts.minute}`;
      const matchedValue = candidateValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

      if (!matchedValue) {
        return "";
      }

      const [, yearValue, monthValue, dayValue, hourValue, minuteValue] = matchedValue;
      const parsedDate = new Date(
        Number(yearValue),
        Number(monthValue) - 1,
        Number(dayValue),
        Number(hourValue),
        Number(minuteValue),
        0,
        0,
      );

      if (
        parsedDate.getFullYear() !== Number(yearValue) ||
        parsedDate.getMonth() + 1 !== Number(monthValue) ||
        parsedDate.getDate() !== Number(dayValue) ||
        parsedDate.getHours() !== Number(hourValue) ||
        parsedDate.getMinutes() !== Number(minuteValue)
      ) {
        return "";
      }

      return candidateValue;
    }

    function resolveSystemScheduleTargetStateKeys(scheduleTarget = "") {
      const normalizedTarget = String(scheduleTarget || "").trim();

      if (normalizedTarget === "applicant-end") {
        return {
          scheduleTarget: normalizedTarget,
          partsStateKey: "applicantScheduleEndAtParts",
          valueStateKey: "applicantScheduleEndAt",
        };
      }

      if (normalizedTarget === "admit-card-lookup-start") {
        return {
          scheduleTarget: normalizedTarget,
          partsStateKey: "admitCardLookupScheduleStartAtParts",
          valueStateKey: "admitCardLookupScheduleStartAt",
        };
      }

      if (normalizedTarget === "admit-card-lookup-end") {
        return {
          scheduleTarget: normalizedTarget,
          partsStateKey: "admitCardLookupScheduleEndAtParts",
          valueStateKey: "admitCardLookupScheduleEndAt",
        };
      }

      return {
        scheduleTarget: "applicant-start",
        partsStateKey: "applicantScheduleStartAtParts",
        valueStateKey: "applicantScheduleStartAt",
      };
    }

    function applySystemScheduleParts(scheduleTarget = "start", nextParts = {}) {
      const targetState = resolveSystemScheduleTargetStateKeys(scheduleTarget);
      const normalizedParts = clampSystemScheduleParts(nextParts);

      state.systemSettings[targetState.partsStateKey] = normalizedParts;
      state.systemSettings[targetState.valueStateKey] = buildSystemScheduleDateTime(normalizedParts);
    }

    function shiftSystemScheduleMonth(parts = {}, delta = 0) {
      const normalizedParts = clampSystemScheduleParts(parts);
      const currentYear = Number(normalizedParts.year);
      const currentMonth = Number(normalizedParts.month);
      const normalizedDelta = Number(delta);

      if (!Number.isInteger(currentYear) || !Number.isInteger(currentMonth) || !Number.isInteger(normalizedDelta) || normalizedDelta === 0) {
        return normalizedParts;
      }

      const shiftedDate = new Date(currentYear, currentMonth - 1 + normalizedDelta, 1);

      return clampSystemScheduleParts({
        ...normalizedParts,
        year: String(shiftedDate.getFullYear()),
        month: padSystemScheduleValue(shiftedDate.getMonth() + 1),
      });
    }

    async function handleClick(event) {
      const target = event.target instanceof Element ? event.target : null;
      const noticeLink = target?.closest(".login-notice-content a[href]") || null;
      const activeSystemSchedulePopoverTarget = String(state.systemSettings.applicantSchedulePopoverTarget || "").trim();
      const systemSchedulePopoverRoot = target?.closest("[data-system-settings-schedule-popover-root]") || null;
      const systemScheduleTrigger = target?.closest("[data-system-settings-schedule-trigger]") || null;
      const systemScheduleActionTrigger = target?.closest("[data-system-settings-schedule-action]") || null;
      const systemScheduleNavigationTrigger = target?.closest("[data-system-settings-schedule-nav]") || null;
      const systemScheduleDayTrigger = target?.closest("[data-system-settings-schedule-day]") || null;
      const openModalTrigger = target?.closest("[data-open-modal]") || null;
      const passwordSetupCloseTrigger = target?.closest("[data-password-setup-close]") || null;
      const closeTrigger = target?.closest("[data-close-modal]") || null;

      const authLogoutTrigger = target?.closest("[data-auth-logout]") || null;
      const accountEditTrigger = target?.closest("[data-account-edit]") || null;
      const accountSaveTrigger = target?.closest("[data-account-save]") || null;
      const accountCancelTrigger = target?.closest("[data-account-cancel]") || null;
      const accountResetTrigger = target?.closest("[data-account-reset]") || null;
      const accountDeleteTrigger = target?.closest("[data-account-delete]") || null;
      const superAdminActionTrigger = target?.closest("[data-super-admin-action]") || null;
      const superAdminImageResetTrigger = target?.closest("[data-super-admin-image-reset]") || null;
      const systemSettingsActionTrigger = target?.closest("[data-system-settings-action]") || null;
      const systemSettingsStepTrigger = target?.closest("[data-system-settings-step]") || null;
      const systemDataBackupTrigger = target?.closest("[data-system-data-backup]") || null;
      const systemDataDeleteTrigger = target?.closest("[data-system-data-delete]") || null;
      const systemAuditLogTrigger = target?.closest("[data-system-audit-log-action]") || null;
      const systemBackupAutomationTrigger = target?.closest("[data-system-backup-automation-action]") || null;
      const systemBackupRestoreTrigger = target?.closest("[data-system-backup-restore]") || null;

      if (noticeLink instanceof HTMLAnchorElement && !noticeLink.closest("[contenteditable='true']")) {
        event.preventDefault();
        window.open(noticeLink.href, "_blank", "noopener,noreferrer");
        return true;
      }

      if (activeSystemSchedulePopoverTarget && !systemSchedulePopoverRoot) {
        state.systemSettings.applicantSchedulePopoverTarget = "";
        renderView();
      }

      if (systemScheduleTrigger) {
        const nextPopoverTarget = String(systemScheduleTrigger.dataset.systemSettingsScheduleTrigger || "").trim();
        state.systemSettings.applicantSchedulePopoverTarget =
          activeSystemSchedulePopoverTarget === nextPopoverTarget ? "" : resolveSystemScheduleTargetStateKeys(nextPopoverTarget).scheduleTarget;
        renderView();
        const triggerId = String(systemScheduleTrigger.id || "").trim();

        if (triggerId) {
          document.getElementById(triggerId)?.focus();
        }
        return true;
      }

      if (systemScheduleActionTrigger) {
        state.systemSettings.applicantSchedulePopoverTarget = "";
        renderView();
        return true;
      }

      if (systemScheduleNavigationTrigger) {
        const targetState = resolveSystemScheduleTargetStateKeys(activeSystemSchedulePopoverTarget);
        const currentParts = normalizeSystemScheduleParts(state.systemSettings[targetState.partsStateKey] || createEmptySystemScheduleParts());
        const direction = String(systemScheduleNavigationTrigger.dataset.systemSettingsScheduleNav || "").trim() === "prev" ? -1 : 1;
        applySystemScheduleParts(targetState.scheduleTarget, shiftSystemScheduleMonth(currentParts, direction));
        syncSystemSettingsDirtyState();

        if (state.systemSettings.statusMessage) {
          setSystemSettingsStatus("");
        }

        renderView();
        return true;
      }

      if (systemScheduleDayTrigger) {
        const targetState = resolveSystemScheduleTargetStateKeys(systemScheduleDayTrigger.dataset.systemSettingsScheduleDayTarget);
        const currentParts = normalizeSystemScheduleParts(state.systemSettings[targetState.partsStateKey] || createEmptySystemScheduleParts());
        applySystemScheduleParts(targetState.scheduleTarget, {
          ...currentParts,
          year: String(systemScheduleDayTrigger.dataset.systemSettingsScheduleDayYear || currentParts.year).trim(),
          month: padSystemScheduleValue(systemScheduleDayTrigger.dataset.systemSettingsScheduleDayMonth || currentParts.month),
          day: padSystemScheduleValue(systemScheduleDayTrigger.dataset.systemSettingsScheduleDayValue || ""),
        });
        syncSystemSettingsDirtyState();

        if (state.systemSettings.statusMessage) {
          setSystemSettingsStatus("");
        }

        renderView();
        return true;
      }

      if (authLogoutTrigger) {
        if (hasUnsavedSystemSettingsChanges() && !(await confirmSystemSettingsNavigation())) {
          return true;
        }

        await logoutCurrentUser();
        return true;
      }

      if (accountEditTrigger) {
        startAccountEdit(accountEditTrigger.dataset.accountEdit);
        renderView();
        return true;
      }

      if (accountSaveTrigger) {
        await saveAccountEdit(accountSaveTrigger.dataset.accountSave);
        return true;
      }

      if (accountCancelTrigger) {
        cancelAccountEdit();
        renderView();
        return true;
      }

      if (accountResetTrigger) {
        await resetAccountPasswordAction(accountResetTrigger.dataset.accountReset);
        return true;
      }

      if (accountDeleteTrigger) {
        await deleteAccountAction(accountDeleteTrigger.dataset.accountDelete);
        return true;
      }

      if (superAdminImageResetTrigger) {
        updateSuperAdminImageField(superAdminImageResetTrigger.dataset.superAdminImageReset, "");
        renderView();
        return true;
      }

      if (superAdminActionTrigger?.dataset.superAdminAction === "save") {
        await saveSuperAdminSettings();
        return true;
      }

      if (systemSettingsActionTrigger?.dataset.systemSettingsAction === "save") {
        await saveSystemSettings();
        return true;
      }

      if (systemSettingsStepTrigger) {
        changeSystemAutoLogoutMinutes(systemSettingsStepTrigger.dataset.systemSettingsStep === "down" ? -1 : 1);
        return true;
      }

      if (systemDataDeleteTrigger) {
        await deleteSystemDataAction(systemDataDeleteTrigger.dataset.systemDataDelete);
        return true;
      }

      if (systemDataBackupTrigger?.dataset.systemDataBackup === "export") {
        await downloadSystemBackupAction();
        return true;
      }

      if (systemAuditLogTrigger?.dataset.systemAuditLogAction === "open") {
        openModal("systemAuditLogModal");
        await loadSystemAuditLogs({ silent: true });
        return true;
      }

      if (systemAuditLogTrigger?.dataset.systemAuditLogAction === "refresh") {
        await loadSystemAuditLogs();
        return true;
      }

      if (systemBackupAutomationTrigger?.dataset.systemBackupAutomationAction === "save") {
        await saveSystemBackupAutomationSettings();
        return true;
      }

      if (systemBackupAutomationTrigger?.dataset.systemBackupAutomationAction === "run-now") {
        await runSystemBackupAutomationNow();
        return true;
      }

      if (systemBackupRestoreTrigger?.dataset.systemBackupRestore === "clear") {
        clearSystemBackupRestoreFileSelection();
        renderView();
        return true;
      }

      if (systemBackupRestoreTrigger?.dataset.systemBackupRestore === "import") {
        await importSystemBackupAction();
        return true;
      }



      if (openModalTrigger) {
        if (openModalTrigger.dataset.openModal === "batchPrintDownloadModal" && !prepareBatchPrintDownloadModal()) {
          return true;
        }

        openModal(openModalTrigger.dataset.openModal);
        return true;
      }

      if (passwordSetupCloseTrigger) {
        await closePasswordSetupPrompt();
        return true;
      }

      if (closeTrigger) {
        await requestCloseModal(closeTrigger.closest(".modal")?.id);
        return true;
      }

      return false;
    }

    async function handleSubmit(event) {
      const target = event.target;

      if (target?.id === "loginForm") {
        event.preventDefault();
        await submitLogin();
        return true;
      }

      if (target?.id === "passwordSetupForm") {
        event.preventDefault();
        await submitPasswordSetup();
        return true;
      }

      if (target?.id === "accountCreateForm") {
        event.preventDefault();
        await submitAccountCreate();
        return true;
      }

      if (target?.id === "batchPrintDownloadForm") {
        event.preventDefault();
        await submitBatchPrintDownloadSelection();
        return true;
      }

      return false;
    }

    async function handleChange(event) {
      const target = event.target instanceof Element ? event.target : null;
      const accountField = target?.closest("[data-account-field]") || null;
      const scheduleTarget = String(target?.dataset.systemSettingsScheduleTarget || "").trim();
      const schedulePart = String(target?.dataset.systemSettingsSchedulePart || "").trim();
      const superAdminToggle = String(target?.dataset.superAdminToggle || "").trim();
      const superAdminImageField = String(target?.dataset.superAdminImage || "").trim();
      const systemBackupAutomationField = String(target?.dataset.systemBackupAutomationField || "").trim();
      const systemBackupAutomationItemKey = String(target?.dataset.systemBackupAutomationItemKey || "").trim();
      const systemBackupAssetKey = String(target?.dataset.systemBackupAssetKey || "").trim();
      const systemBackupRestoreItemKey = String(target?.dataset.systemBackupRestoreItemKey || "").trim();
      const systemBackupRestoreFile = String(target?.dataset.systemBackupRestoreFile || "").trim();

      if (scheduleTarget && schedulePart) {
        const targetState = resolveSystemScheduleTargetStateKeys(scheduleTarget);
        const nextParts = normalizeSystemScheduleParts(state.systemSettings[targetState.partsStateKey] || createEmptySystemScheduleParts());
        nextParts[schedulePart] = String(target?.value || "").trim();
        applySystemScheduleParts(targetState.scheduleTarget, nextParts);
        syncSystemSettingsDirtyState();

        if (state.systemSettings.statusMessage) {
          setSystemSettingsStatus("");
        }

        const targetId = String(target?.id || "").trim();
        renderView();

        if (targetId) {
          document.getElementById(targetId)?.focus();
        }

        return true;
      }

      if (accountField?.dataset.accountField === "role") {
        updateAccountEditorField("draftRole", target?.value);
        return true;
      }

      if (superAdminToggle) {
        updateSuperAdminField(superAdminToggle, target?.checked === true);
        renderView();
        return true;
      }

      if (systemBackupAutomationField) {
        const nextValue =
          target instanceof HTMLInputElement && target.type === "checkbox"
            ? target.checked === true
            : target?.value;

        updateSystemBackupAutomationField(systemBackupAutomationField, nextValue);
        return true;
      }

      if (systemBackupAutomationItemKey && target instanceof HTMLInputElement && target.type === "checkbox") {
        toggleSystemBackupAutomationItemSelection(systemBackupAutomationItemKey, target.checked === true);
        return true;
      }

      if (systemBackupAssetKey && target instanceof HTMLInputElement && target.type === "checkbox") {
        toggleSystemBackupAssetSelection(systemBackupAssetKey, target.checked === true);
        return true;
      }

      if (systemBackupRestoreItemKey && target instanceof HTMLInputElement && target.type === "checkbox") {
        toggleSystemBackupRestoreSelection(systemBackupRestoreItemKey, target.checked === true);
        return true;
      }

      if (superAdminImageField && target instanceof HTMLInputElement && target.type === "file") {
        await applySuperAdminImageFile(superAdminImageField, target.files?.[0] || null);
        target.value = "";
        renderView();
        return true;
      }

      if (systemBackupRestoreFile && target instanceof HTMLInputElement && target.type === "file") {
        await selectSystemBackupRestoreFile(target.files?.[0] || null);
        target.value = "";
        return true;
      }

      if (target?.id === "accountCreateRole") {
        setAccountCreateError("");
        return true;
      }

      if (target?.dataset.systemSettingsExamComponentIndex) {
        const componentIndex = Number(target.dataset.systemSettingsExamComponentIndex);

        if (Number.isInteger(componentIndex) && componentIndex >= 0) {
          const nextComponents = Array.isArray(state.systemSettings.applicantExamNoComponents)
            ? [...state.systemSettings.applicantExamNoComponents]
            : ["admissionCode", "seriesCode", "unitCode", "sequence", ""];
          nextComponents[componentIndex] = String(target.value || "").trim();
          state.systemSettings.applicantExamNoComponents = nextComponents;
          syncSystemSettingsDirtyState();

          if (state.systemSettings.statusMessage) {
            setSystemSettingsStatus("");
          }
          return true;
        }
      }


      if (target?.dataset.batchPrintOutputMode) {
        updateBatchPrintOutputMode(target.dataset.batchPrintOutputMode || target.value);
        return true;
      }

      return false;
    }

    function handleInput(event) {
      const target = event.target instanceof Element ? event.target : null;
      const accountField = target?.closest("[data-account-field]") || null;

      if (target?.id === "loginAccountId") {
        state.auth.loginForm.id = target.value;
        if (state.auth.error) {
          state.auth.error = "";
          syncLoginErrorMessage();
        }
        return true;
      }

      if (target?.id === "loginPassword") {
        state.auth.loginForm.password = target.value;
        if (state.auth.error) {
          state.auth.error = "";
          syncLoginErrorMessage();
        }
        return true;
      }

      if (target?.id === "passwordSetupNext") {
        state.auth.passwordSetup.password = target.value;
        if (state.auth.passwordSetup.error) {
          state.auth.passwordSetup.error = "";
          syncPasswordSetupModal();
        }
        return true;
      }

      if (target?.id === "passwordSetupConfirm") {
        state.auth.passwordSetup.passwordConfirm = target.value;
        if (state.auth.passwordSetup.error) {
          state.auth.passwordSetup.error = "";
          syncPasswordSetupModal();
        }
        return true;
      }

      if (target?.id === "systemSettingsInitialPassword") {
        state.systemSettings.initialPassword = target.value;
        syncSystemSettingsDirtyState();
        if (state.systemSettings.statusMessage) {
          setSystemSettingsStatus("");
        }
        return true;
      }

      if (target?.id === "systemSettingsAutoLogoutMinutes") {
        state.systemSettings.autoLogoutMinutes = target.value;
        syncSystemSettingsDirtyState();
        if (state.systemSettings.statusMessage) {
          setSystemSettingsStatus("");
        }
        return true;
      }

      if (target?.id === "systemSettingsAdmissionHomepageUrl") {
        state.systemSettings.admissionHomepageUrl = target.value;
        syncSystemSettingsDirtyState();
        if (state.systemSettings.statusMessage) {
          setSystemSettingsStatus("");
        }
        return true;
      }

      if (target?.id === "systemSettingsApplicantExamNoDigitCount") {
        state.systemSettings.applicantExamNoDigitCount = target.value;
        syncSystemSettingsDirtyState();
        if (state.systemSettings.statusMessage) {
          setSystemSettingsStatus("");
        }
        return true;
      }

      if (target?.dataset.superAdminField === "schoolName") {
        updateSuperAdminField("schoolName", target.value);
        return true;
      }

      if (target?.id === "accountCreateId" || target?.id === "accountCreateName") {
        setAccountCreateError("");
        return true;
      }

      if (accountField?.dataset.accountField === "name") {
        updateAccountEditorField("draftName", target?.value);
        return true;
      }

      return false;
    }

    return Object.freeze({
      handleChange,
      handleClick,
      handleInput,
      handleSubmit,
    });
  }

  return Object.freeze({
    createAuthDocumentEventHandlers,
  });
});
