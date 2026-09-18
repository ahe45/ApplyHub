(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardSystemSettings = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createSystemSettingsController({
    MAX_SYSTEM_AUTO_LOGOUT_MINUTES,
    SYSTEM_DATA_DELETE_CONFIG,
    apiRequest,
    apiRequestWithUploadProgress,
    getSystemAutoLogoutInputElement,
    handleAuthenticationFailure,
    loadBootstrapData,
    normalizeSuperAdminSettings,
    normalizeSystemAutoLogoutMinutes,
    normalizeSystemSettingsPayload,
    renderView,
    showToast,
    state,
    syncAccountCreateDescription,
    syncAutoLogoutTimer,
  }) {
    const SYSTEM_BACKUP_DATABASE_ITEM_KEY = "database";
    const SYSTEM_BACKUP_ASSET_ITEMS = Object.freeze([

      Object.freeze({ assetKey: "applicant-photos", title: "수험생 사진" }),
      Object.freeze({ assetKey: "applicant-files", title: "접수 첨부파일" }),
    ]);
    const SYSTEM_BACKUP_ASSET_KEYS = Object.freeze(SYSTEM_BACKUP_ASSET_ITEMS.map((item) => item.assetKey));
    const SYSTEM_BACKUP_ITEM_KEYS = Object.freeze([SYSTEM_BACKUP_DATABASE_ITEM_KEY, ...SYSTEM_BACKUP_ASSET_KEYS]);
    const SYSTEM_BACKUP_ASSET_LABELS = Object.freeze(
      SYSTEM_BACKUP_ASSET_ITEMS.reduce((labels, item) => {
        labels[item.assetKey] = item.title;
        return labels;
      }, {}),
    );
    const SYSTEM_BACKUP_RESTORE_ITEMS = Object.freeze([
      Object.freeze({ itemKey: SYSTEM_BACKUP_DATABASE_ITEM_KEY, title: "데이터베이스" }),

      Object.freeze({ itemKey: "applicant-photos", title: "수험생 사진" }),
      Object.freeze({ itemKey: "applicant-files", title: "접수 첨부파일" }),
    ]);
    const SYSTEM_BACKUP_RESTORE_ITEM_KEYS = Object.freeze(SYSTEM_BACKUP_RESTORE_ITEMS.map((item) => item.itemKey));
    const SYSTEM_BACKUP_AUTOMATION_DEFAULT_TIME = "03:00";
    const SYSTEM_BACKUP_AUTOMATION_DEFAULT_RETENTION_COUNT = 7;

    function getSystemSettingsStatusElement() {
      return document.getElementById("systemSettingsStatus");
    }

    function getSystemDataDeletionStatusElement() {
      return document.getElementById("systemDataDeletionStatus");
    }

    function getSystemBackupRestoreStatusElement() {
      return document.getElementById("systemBackupRestoreStatus");
    }

    function getSystemAuditLogStatusElement() {
      return document.getElementById("systemAuditLogStatus");
    }

    function getSystemBackupAutomationStatusElement() {
      return document.getElementById("systemBackupAutomationStatus");
    }

    function getSystemBackupRestoreFileInputElement() {
      return document.getElementById("systemBackupRestoreFileInput");
    }

    function getSystemSettingsSaveButtonElement() {
      return document.querySelector("[data-system-settings-action='save']");
    }

    function getSuperAdminStatusElement() {
      return document.getElementById("superAdminStatus");
    }

    function getSuperAdminSaveButtonElement() {
      return document.querySelector("[data-super-admin-action='save']");
    }

    function getSystemBackupAutomationSaveButtonElement() {
      return document.querySelector("[data-system-backup-automation-action='save']");
    }

    function createDefaultSystemBackupAssetSelections() {
      return SYSTEM_BACKUP_ITEM_KEYS.reduce((selections, itemKey) => {
        selections[itemKey] = true;
        return selections;
      }, {});
    }

    function createDefaultSystemBackupRestoreSelections() {
      return SYSTEM_BACKUP_RESTORE_ITEM_KEYS.reduce((selections, itemKey) => {
        selections[itemKey] = true;
        return selections;
      }, {});
    }

    function getDefaultSystemBackupAutomationSnapshot() {
      return {
        enabled: false,
        scheduleType: "daily",
        weeklyDay: 1,
        time: SYSTEM_BACKUP_AUTOMATION_DEFAULT_TIME,
        retentionCount: SYSTEM_BACKUP_AUTOMATION_DEFAULT_RETENTION_COUNT,
        includeDatabase: true,
        includedAssetKeys: [...SYSTEM_BACKUP_ASSET_KEYS],
      };
    }

    function normalizeSystemBackupAutomationScheduleType(value = "") {
      return String(value || "").trim().toLowerCase() === "weekly" ? "weekly" : "daily";
    }

    function normalizeSystemBackupAutomationWeeklyDay(value = 1) {
      const normalizedValue = Math.round(Number(value));

      if (!Number.isFinite(normalizedValue) || normalizedValue < 0 || normalizedValue > 6) {
        return 1;
      }

      return normalizedValue;
    }

    function normalizeSystemBackupAutomationTime(value = "") {
      const normalizedValue = String(value || "").trim();
      const matchedValue = normalizedValue.match(/^(\d{2}):(\d{2})$/);

      if (!matchedValue) {
        return SYSTEM_BACKUP_AUTOMATION_DEFAULT_TIME;
      }

      const hours = Number(matchedValue[1]);
      const minutes = Number(matchedValue[2]);

      if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return SYSTEM_BACKUP_AUTOMATION_DEFAULT_TIME;
      }

      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }

    function normalizeSystemBackupAutomationRetentionCount(value = SYSTEM_BACKUP_AUTOMATION_DEFAULT_RETENTION_COUNT) {
      const normalizedValue = Math.round(Number(value));

      if (!Number.isFinite(normalizedValue) || normalizedValue < 1) {
        return SYSTEM_BACKUP_AUTOMATION_DEFAULT_RETENTION_COUNT;
      }

      return Math.min(30, normalizedValue);
    }

    function normalizeSystemBackupAutomationAssetKeys(assetKeys = null) {
      const sourceKeys = Array.isArray(assetKeys) ? assetKeys : SYSTEM_BACKUP_ASSET_KEYS;
      return SYSTEM_BACKUP_ASSET_KEYS.filter((assetKey, index, keys) => {
        const normalizedKey = String(assetKey || "").trim();
        return (
          sourceKeys.map((value) => String(value || "").trim()).includes(normalizedKey) &&
          keys.indexOf(normalizedKey) === index
        );
      });
    }

    function createDefaultSystemBackupAutomationState() {
      const defaultSnapshot = getDefaultSystemBackupAutomationSnapshot();

      return {
        ...defaultSnapshot,
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
          ...defaultSnapshot,
          includedAssetKeys: [...defaultSnapshot.includedAssetKeys],
        },
      };
    }

    function getSystemBackupAutomationState() {
      const currentState = state.systemDataDeletion?.backupAutomation;

      if (currentState && typeof currentState === "object") {
        return currentState;
      }

      state.systemDataDeletion.backupAutomation = createDefaultSystemBackupAutomationState();
      return state.systemDataDeletion.backupAutomation;
    }

    function cloneSystemBackupAutomationSnapshot(snapshot = {}) {
      const sourceSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
      const defaultSnapshot = getDefaultSystemBackupAutomationSnapshot();

      return {
        enabled: sourceSnapshot.enabled === true,
        scheduleType: normalizeSystemBackupAutomationScheduleType(sourceSnapshot.scheduleType || defaultSnapshot.scheduleType),
        weeklyDay: normalizeSystemBackupAutomationWeeklyDay(sourceSnapshot.weeklyDay ?? defaultSnapshot.weeklyDay),
        time: normalizeSystemBackupAutomationTime(sourceSnapshot.time || defaultSnapshot.time),
        retentionCount: normalizeSystemBackupAutomationRetentionCount(sourceSnapshot.retentionCount ?? defaultSnapshot.retentionCount),
        includeDatabase: sourceSnapshot.includeDatabase !== false,
        includedAssetKeys: normalizeSystemBackupAutomationAssetKeys(sourceSnapshot.includedAssetKeys),
      };
    }

    function buildSystemBackupAutomationSnapshot(source = null) {
      return cloneSystemBackupAutomationSnapshot(source || getSystemBackupAutomationState());
    }

    function areSystemBackupAutomationSnapshotsEqual(leftSnapshot = {}, rightSnapshot = {}) {
      const left = cloneSystemBackupAutomationSnapshot(leftSnapshot);
      const right = cloneSystemBackupAutomationSnapshot(rightSnapshot);

      return (
        left.enabled === right.enabled &&
        left.scheduleType === right.scheduleType &&
        left.weeklyDay === right.weeklyDay &&
        left.time === right.time &&
        left.retentionCount === right.retentionCount &&
        left.includeDatabase === right.includeDatabase &&
        left.includedAssetKeys.length === right.includedAssetKeys.length &&
        left.includedAssetKeys.every((assetKey, index) => assetKey === right.includedAssetKeys[index])
      );
    }

    function normalizeSystemBackupAssetSelections(selections = null) {
      const sourceSelections = selections && typeof selections === "object" ? selections : state.systemDataDeletion.backupAssetSelections || {};
      return SYSTEM_BACKUP_ITEM_KEYS.reduce((normalizedSelections, itemKey) => {
        normalizedSelections[itemKey] = sourceSelections[itemKey] !== false;
        return normalizedSelections;
      }, {});
    }

    function shouldIncludeSystemBackupDatabase() {
      const normalizedSelections = normalizeSystemBackupAssetSelections();
      return normalizedSelections[SYSTEM_BACKUP_DATABASE_ITEM_KEY] !== false;
    }

    function getSelectedSystemBackupAssetKeys() {
      const normalizedSelections = normalizeSystemBackupAssetSelections();
      return SYSTEM_BACKUP_ASSET_KEYS.filter((assetKey) => normalizedSelections[assetKey] !== false);
    }

    function normalizeSystemBackupRestoreSelections(selections = null) {
      const sourceSelections = selections && typeof selections === "object" ? selections : state.systemDataDeletion.restoreSelections || {};
      return SYSTEM_BACKUP_RESTORE_ITEM_KEYS.reduce((normalizedSelections, itemKey) => {
        normalizedSelections[itemKey] = sourceSelections[itemKey] !== false;
        return normalizedSelections;
      }, {});
    }

    function buildAvailableSystemBackupRestoreSelections(summary = null) {
      const sourceSummary = summary && typeof summary === "object" ? summary : state.systemDataDeletion.restoreValidationSummary || null;
      const hasSummary = Boolean(sourceSummary && typeof sourceSummary === "object");
      const summaryAssets = Array.isArray(sourceSummary?.assets) ? sourceSummary.assets : [];

      return SYSTEM_BACKUP_RESTORE_ITEM_KEYS.reduce((availabilityMap, itemKey) => {
        if (!hasSummary) {
          availabilityMap[itemKey] = false;
          return availabilityMap;
        }

        if (itemKey === SYSTEM_BACKUP_DATABASE_ITEM_KEY) {
          availabilityMap[itemKey] = sourceSummary?.databaseIncluded === true;
          return availabilityMap;
        }

        const matchingAsset = summaryAssets.find((asset) => String(asset?.assetKey || "").trim() === itemKey) || null;
        availabilityMap[itemKey] = matchingAsset?.included !== false;
        return availabilityMap;
      }, {});
    }

    function buildInitialSystemBackupRestoreSelections(summary = null) {
      const availabilityMap = buildAvailableSystemBackupRestoreSelections(summary);
      const defaultSelections = createDefaultSystemBackupRestoreSelections();

      return SYSTEM_BACKUP_RESTORE_ITEM_KEYS.reduce((selections, itemKey) => {
        selections[itemKey] = availabilityMap[itemKey] ? defaultSelections[itemKey] !== false : false;
        return selections;
      }, {});
    }

    function getSelectedSystemBackupRestoreItemKeys(summary = null) {
      const normalizedSelections = normalizeSystemBackupRestoreSelections();
      const availabilityMap = buildAvailableSystemBackupRestoreSelections(summary);

      return SYSTEM_BACKUP_RESTORE_ITEM_KEYS.filter((itemKey) => availabilityMap[itemKey] && normalizedSelections[itemKey] !== false);
    }

    function setSystemSettingsStatus(message = "", type = "") {
      state.systemSettings.statusMessage = String(message || "");
      state.systemSettings.statusType = type;

      const statusElement = getSystemSettingsStatusElement();

      if (!statusElement) {
        return;
      }

      statusElement.textContent = state.systemSettings.statusMessage;
      statusElement.classList.toggle("hidden", !state.systemSettings.statusMessage);
      statusElement.classList.toggle("warning", type === "warning");
    }

    function setSystemDataDeletionStatus(message = "", type = "") {
      state.systemDataDeletion.statusMessage = String(message || "");
      state.systemDataDeletion.statusType = type;

      [getSystemDataDeletionStatusElement(), getSystemBackupRestoreStatusElement()]
        .filter(Boolean)
        .forEach((statusElement) => {
          statusElement.textContent = state.systemDataDeletion.statusMessage;
          statusElement.classList.toggle("hidden", !state.systemDataDeletion.statusMessage);
          statusElement.classList.toggle("warning", type === "warning");
        });
    }

    function setSystemAuditLogStatus(message = "", type = "") {
      state.systemAuditLog.statusMessage = String(message || "");
      state.systemAuditLog.statusType = type;

      const statusElement = getSystemAuditLogStatusElement();

      if (!statusElement) {
        return;
      }

      statusElement.textContent = state.systemAuditLog.statusMessage;
      statusElement.classList.toggle("hidden", !state.systemAuditLog.statusMessage);
      statusElement.classList.toggle("warning", type === "warning");
    }

    function setSystemBackupAutomationStatus(message = "", type = "") {
      const automationState = getSystemBackupAutomationState();
      automationState.statusMessage = String(message || "");
      automationState.statusType = type;

      const statusElement = getSystemBackupAutomationStatusElement();

      if (!statusElement) {
        return;
      }

      statusElement.textContent = automationState.statusMessage;
      statusElement.classList.toggle("hidden", !automationState.statusMessage);
      statusElement.classList.toggle("warning", type === "warning");
    }

    function applySystemBackupAutomationPayload(payload = {}, options = {}) {
      const automationState = getSystemBackupAutomationState();
      const nextSnapshot = cloneSystemBackupAutomationSnapshot(payload);

      automationState.enabled = nextSnapshot.enabled;
      automationState.scheduleType = nextSnapshot.scheduleType;
      automationState.weeklyDay = nextSnapshot.weeklyDay;
      automationState.time = nextSnapshot.time;
      automationState.retentionCount = nextSnapshot.retentionCount;
      automationState.includeDatabase = nextSnapshot.includeDatabase;
      automationState.includedAssetKeys = [...nextSnapshot.includedAssetKeys];
      automationState.lastRunAt = String(payload?.lastRunAt || "").trim();
      automationState.lastSuccessAt = String(payload?.lastSuccessAt || "").trim();
      automationState.lastFailureAt = String(payload?.lastFailureAt || "").trim();
      automationState.lastErrorMessage = String(payload?.lastErrorMessage || "").trim();
      automationState.lastFileName = String(payload?.lastFileName || "").trim();
      automationState.nextRunAt = String(payload?.nextRunAt || "").trim();
      automationState.isRunning = payload?.isRunning === true;
      automationState.savedSnapshot = {
        ...nextSnapshot,
        includedAssetKeys: [...nextSnapshot.includedAssetKeys],
      };
      automationState.hasUnsavedChanges = false;

      if (options.preserveSaving !== true) {
        automationState.isSaving = false;
      }

      if (!options.preserveStatus) {
        automationState.statusMessage = "";
        automationState.statusType = "";
      }

      syncSystemBackupAutomationDirtyState();
    }

    function formatSystemAuditLogLoadedAtLabel(date = new Date()) {
      const loadedDate = date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date(date);

      if (!Number.isFinite(loadedDate.getTime())) {
        return "";
      }

      return [
        loadedDate.getFullYear(),
        String(loadedDate.getMonth() + 1).padStart(2, "0"),
        String(loadedDate.getDate()).padStart(2, "0"),
      ].join("-") + ` ${String(loadedDate.getHours()).padStart(2, "0")}:${String(loadedDate.getMinutes()).padStart(2, "0")}:${String(loadedDate.getSeconds()).padStart(2, "0")}`;
    }

    function getSystemAuditLogLimit() {
      const normalizedLimit = Math.round(Number(state.systemAuditLog?.limit || 200));

      if (!Number.isFinite(normalizedLimit) || normalizedLimit < 1) {
        return 200;
      }

      return Math.min(500, normalizedLimit);
    }

    function normalizeLoadedSystemAuditLogLimit(value, fallbackValue = 200) {
      const normalizedLimit = Math.round(Number(value));

      if (!Number.isFinite(normalizedLimit) || normalizedLimit < 1) {
        return getSystemAuditLogLimit() || fallbackValue;
      }

      return Math.min(500, normalizedLimit);
    }

    async function loadSystemAuditLogs(options = {}) {
      const silent = options.silent === true;

      if (state.systemAuditLog.isLoading) {
        return false;
      }

      state.systemAuditLog.isLoading = true;

      if (!silent) {
        setSystemAuditLogStatus("");
      }

      renderView();

      try {
        const limit = getSystemAuditLogLimit();
        const payload = await apiRequest(`/api/system-audit-logs?limit=${encodeURIComponent(String(limit))}`);

        state.systemAuditLog.rows = Array.isArray(payload?.rows) ? payload.rows : [];
        state.systemAuditLog.limit = normalizeLoadedSystemAuditLogLimit(payload?.limit, limit);
        state.systemAuditLog.hasLoaded = true;
        state.systemAuditLog.lastLoadedAt = formatSystemAuditLogLoadedAtLabel(new Date());

        if (silent) {
          state.systemAuditLog.statusMessage = "";
          state.systemAuditLog.statusType = "";
        } else {
          setSystemAuditLogStatus(`감사 로그 ${state.systemAuditLog.rows.length}건을 불러왔습니다.`);
        }

        return true;
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return false;
        }

        state.systemAuditLog.hasLoaded = true;
        setSystemAuditLogStatus(error.message, "warning");
        return false;
      } finally {
        state.systemAuditLog.isLoading = false;
        renderView();
      }
    }

    function isSystemAuditLogModalOpen() {
      const modalElement = document.getElementById("systemAuditLogModal");
      return Boolean(modalElement && !modalElement.classList.contains("hidden"));
    }

    async function refreshSystemAuditLogsAfterSystemAction() {
      if (!state.systemAuditLog.hasLoaded && !isSystemAuditLogModalOpen()) {
        return false;
      }

      return loadSystemAuditLogs({ silent: true });
    }

    function triggerBlobDownload(blob, fileName) {
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = downloadUrl;
      anchor.download = String(fileName || "").trim() || "system-backup.zip";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    }

    function parseDownloadFileName(contentDispositionValue = "", fallbackFileName = "system-backup.zip") {
      const normalizedValue = String(contentDispositionValue || "").trim();
      const encodedMatch = normalizedValue.match(/filename\*=UTF-8''([^;]+)/i);

      if (encodedMatch?.[1]) {
        try {
          return decodeURIComponent(encodedMatch[1]);
        } catch (error) {
          return String(encodedMatch[1] || fallbackFileName);
        }
      }

      const plainMatch = normalizedValue.match(/filename="([^"]+)"|filename=([^;]+)/i);

      if (plainMatch?.[1] || plainMatch?.[2]) {
        return String(plainMatch[1] || plainMatch[2] || fallbackFileName).trim();
      }

      return fallbackFileName;
    }

    function encodeHeaderValue(value = "") {
      const textValue = String(value || "");

      if (!textValue) {
        return "";
      }

      const bytes = new TextEncoder().encode(textValue);
      let binaryString = "";

      bytes.forEach((byte) => {
        binaryString += String.fromCharCode(byte);
      });

      return window.btoa(binaryString);
    }

    function formatSystemBackupValidationCreatedAtLabel(value = "") {
      const normalizedValue = String(value || "").trim();

      if (!normalizedValue) {
        return "";
      }

      const parsedDate = new Date(normalizedValue);

      if (!Number.isFinite(parsedDate.getTime())) {
        return normalizedValue;
      }

      return [
        parsedDate.getFullYear(),
        String(parsedDate.getMonth() + 1).padStart(2, "0"),
        String(parsedDate.getDate()).padStart(2, "0"),
      ].join("-") + ` ${String(parsedDate.getHours()).padStart(2, "0")}:${String(parsedDate.getMinutes()).padStart(2, "0")}:${String(parsedDate.getSeconds()).padStart(2, "0")}`;
    }

    function buildSystemBackupValidationSummary(summary = {}) {
      const assets = Array.isArray(summary.assets) ? summary.assets : [];
      const currentState = summary?.currentState && typeof summary.currentState === "object" ? summary.currentState : {};
      const currentStateAssets = Array.isArray(currentState.assets) ? currentState.assets : [];
      const comparison = summary?.comparison && typeof summary.comparison === "object" ? summary.comparison : {};
      const comparisonDatabase = comparison?.database && typeof comparison.database === "object" ? comparison.database : {};
      const comparisonAssets = Array.isArray(comparison.assets) ? comparison.assets : [];

      return {
        createdAt: String(summary.createdAt || "").trim(),
        createdAtLabel: formatSystemBackupValidationCreatedAtLabel(summary.createdAt),
        databaseName: String(summary.databaseName || "").trim(),
        databaseIncluded: summary.databaseIncluded !== false,
        tableCount: Number(summary.tableCount || 0),
        totalRowCount: Number(summary.totalRowCount || 0),
        memberCount: Number(summary.memberCount || 0),
        currentMemberCount: Number(summary.currentMemberCount || 0),
        assets: assets.map((asset) => ({
          assetKey: String(asset?.assetKey || "").trim(),
          title: SYSTEM_BACKUP_ASSET_LABELS[String(asset?.assetKey || "").trim()] || String(asset?.assetKey || "").trim(),
          included: asset?.included !== false,
          fileCount: Number(asset?.fileCount || 0),
          totalBytes: Number(asset?.totalBytes || 0),
        })),
        currentState: {
          databaseName: String(currentState.databaseName || "").trim(),
          tableCount: Number(currentState.tableCount || 0),
          totalRowCount: Number(currentState.totalRowCount || 0),
          assets: currentStateAssets.map((asset) => ({
            assetKey: String(asset?.assetKey || "").trim(),
            title: SYSTEM_BACKUP_ASSET_LABELS[String(asset?.assetKey || "").trim()] || String(asset?.assetKey || "").trim(),
            fileCount: Number(asset?.fileCount || 0),
            totalBytes: Number(asset?.totalBytes || 0),
          })),
        },
        comparison: {
          database: {
            included: comparisonDatabase.included !== false,
            currentTableCount: Number(comparisonDatabase.currentTableCount || 0),
            backupTableCount: Number(comparisonDatabase.backupTableCount || 0),
            tableDelta: Number(comparisonDatabase.tableDelta || 0),
            currentRowCount: Number(comparisonDatabase.currentRowCount || 0),
            backupRowCount: Number(comparisonDatabase.backupRowCount || 0),
            rowDelta: Number(comparisonDatabase.rowDelta || 0),
          },
          assets: comparisonAssets.map((asset) => ({
            assetKey: String(asset?.assetKey || "").trim(),
            title: SYSTEM_BACKUP_ASSET_LABELS[String(asset?.assetKey || "").trim()] || String(asset?.assetKey || "").trim(),
            included: asset?.included !== false,
            currentFileCount: Number(asset?.currentFileCount || 0),
            backupFileCount: Number(asset?.backupFileCount || 0),
            fileDelta: Number(asset?.fileDelta || 0),
            currentTotalBytes: Number(asset?.currentTotalBytes || 0),
            backupTotalBytes: Number(asset?.backupTotalBytes || 0),
            totalBytesDelta: Number(asset?.totalBytesDelta || 0),
          })),
        },
      };
    }

    function resetSystemBackupValidationState(options = {}) {
      state.systemDataDeletion.isRestoreValidating = false;
      state.systemDataDeletion.isRestoreFileValid = false;
      state.systemDataDeletion.restoreValidationMessage = "";
      state.systemDataDeletion.restoreValidationType = "";
      state.systemDataDeletion.restoreValidationSummary = null;
      state.systemDataDeletion.restoreSelections = createDefaultSystemBackupRestoreSelections();

      if (options.preserveProgress !== true) {
        state.systemDataDeletion.restoreUploadProgressPercent = 0;
        state.systemDataDeletion.restoreUploadProgressLabel = "";
      }
    }

    function buildSystemBackupValidationSuccessMessage(summary = {}) {
      const normalizedSummary = buildSystemBackupValidationSummary(summary);
      const includedAssets = normalizedSummary.assets.filter((asset) => asset.included !== false);
      const databaseSummary = normalizedSummary.databaseIncluded
        ? `데이터베이스 포함(테이블 ${normalizedSummary.tableCount}개, 데이터 ${normalizedSummary.totalRowCount}건)`
        : "데이터베이스 미포함";
      return `유효한 백업 ZIP입니다. ${databaseSummary}, 포함된 파일 종류 ${includedAssets.length}개를 확인했습니다.`;
    }

    function isSystemDataOperationActive() {
      const automationState = getSystemBackupAutomationState();

      return (
        state.systemDataDeletion.isDeleting ||
        state.systemDataDeletion.isBackingUp ||
        state.systemDataDeletion.isRestoring ||
        state.systemDataDeletion.isRestoreValidating ||
        automationState.isSaving === true ||
        automationState.isRunning === true
      );
    }

    function isZipFile(file) {
      const selectedFile = file instanceof File ? file : null;

      if (!selectedFile) {
        return false;
      }

      const fileName = String(selectedFile.name || "").trim();
      const fileType = String(selectedFile.type || "").trim().toLowerCase();

      return /\.zip$/i.test(fileName) || fileType.includes("zip") || !fileType;
    }

    function clearSystemBackupRestoreFileSelection() {
      state.systemDataDeletion.restoreValidationRequestId = Number(state.systemDataDeletion.restoreValidationRequestId || 0) + 1;
      state.systemDataDeletion.restoreFile = null;
      state.systemDataDeletion.restoreFileName = "";
      resetSystemBackupValidationState();

      const fileInputElement = getSystemBackupRestoreFileInputElement();

      if (fileInputElement) {
        fileInputElement.value = "";
      }
    }

    function toggleSystemBackupAssetSelection(assetKey = "", isSelected = true) {
      const normalizedAssetKey = String(assetKey || "").trim();

      if (!SYSTEM_BACKUP_ITEM_KEYS.includes(normalizedAssetKey) || isSystemDataOperationActive()) {
        return false;
      }

      state.systemDataDeletion.backupAssetSelections = {
        ...createDefaultSystemBackupAssetSelections(),
        ...normalizeSystemBackupAssetSelections(),
        [normalizedAssetKey]: isSelected !== false,
      };
      renderView();
      return true;
    }

    function toggleSystemBackupRestoreSelection(itemKey = "", isSelected = true) {
      const normalizedItemKey = String(itemKey || "").trim();

      if (!SYSTEM_BACKUP_RESTORE_ITEM_KEYS.includes(normalizedItemKey) || isSystemDataOperationActive()) {
        return false;
      }

      const availabilityMap = buildAvailableSystemBackupRestoreSelections();

      if (!availabilityMap[normalizedItemKey]) {
        return false;
      }

      state.systemDataDeletion.restoreSelections = {
        ...createDefaultSystemBackupRestoreSelections(),
        ...normalizeSystemBackupRestoreSelections(),
        [normalizedItemKey]: isSelected !== false,
      };
      renderView();
      return true;
    }

    async function selectSystemBackupRestoreFile(file) {
      const selectedFile = file instanceof File ? file : null;

      if (!selectedFile) {
        clearSystemBackupRestoreFileSelection();
        setSystemDataDeletionStatus("");
        renderView();
        return false;
      }

      if (!isZipFile(selectedFile)) {
        clearSystemBackupRestoreFileSelection();
        setSystemDataDeletionStatus("백업 복원에는 ZIP 파일만 선택할 수 있습니다.", "warning");
        renderView();
        return false;
      }

      const validationRequestId = Number(state.systemDataDeletion.restoreValidationRequestId || 0) + 1;

      state.systemDataDeletion.restoreValidationRequestId = validationRequestId;
      state.systemDataDeletion.restoreFile = selectedFile;
      state.systemDataDeletion.restoreFileName = String(selectedFile.name || "").trim() || "system-backup.zip";
      resetSystemBackupValidationState();
      state.systemDataDeletion.isRestoreValidating = true;
      state.systemDataDeletion.restoreUploadProgressPercent = 0;
      state.systemDataDeletion.restoreUploadProgressLabel = "백업 ZIP 유효성 검사를 준비하고 있습니다.";
      setSystemDataDeletionStatus("");
      renderView();

      try {
        const validationResult = await apiRequestWithUploadProgress(
          "/api/system-backup/validate",
          {
            method: "POST",
            body: selectedFile,
            headers: {
              "Content-Type": selectedFile.type || "application/zip",
              "X-System-Backup-File-Name-Base64": encodeHeaderValue(selectedFile.name || "system-backup.zip"),
            },
          },
          {
            onProgress: ({ percent = 0 }) => {
              if (state.systemDataDeletion.restoreValidationRequestId !== validationRequestId) {
                return;
              }

              state.systemDataDeletion.restoreUploadProgressPercent = Math.max(0, Math.min(100, Number(percent || 0)));
              state.systemDataDeletion.restoreUploadProgressLabel = `백업 ZIP 검사 업로드 중... ${state.systemDataDeletion.restoreUploadProgressPercent}%`;
              renderView();
            },
            onUploadComplete: () => {
              if (state.systemDataDeletion.restoreValidationRequestId !== validationRequestId) {
                return;
              }

              state.systemDataDeletion.restoreUploadProgressPercent = 100;
              state.systemDataDeletion.restoreUploadProgressLabel = "백업 ZIP 업로드 완료, 서버에서 유효성을 검사 중입니다.";
              renderView();
            },
          },
        );

        if (state.systemDataDeletion.restoreValidationRequestId !== validationRequestId) {
          return false;
        }

        const validationSummary = buildSystemBackupValidationSummary(validationResult);
        state.systemDataDeletion.isRestoreFileValid = true;
        state.systemDataDeletion.restoreValidationMessage = buildSystemBackupValidationSuccessMessage(validationSummary);
        state.systemDataDeletion.restoreValidationType = "";
        state.systemDataDeletion.restoreValidationSummary = validationSummary;
        state.systemDataDeletion.restoreSelections = buildInitialSystemBackupRestoreSelections(validationSummary);
        state.systemDataDeletion.restoreUploadProgressPercent = 0;
        state.systemDataDeletion.restoreUploadProgressLabel = "";
        return true;
      } catch (error) {
        if (state.systemDataDeletion.restoreValidationRequestId !== validationRequestId) {
          return false;
        }

        if (handleAuthenticationFailure(error)) {
          return false;
        }

        resetSystemBackupValidationState();
        state.systemDataDeletion.restoreValidationMessage = error.message;
        state.systemDataDeletion.restoreValidationType = "warning";
        return false;
      } finally {
        if (state.systemDataDeletion.restoreValidationRequestId === validationRequestId) {
          state.systemDataDeletion.isRestoreValidating = false;
          state.systemDataDeletion.restoreUploadProgressPercent = 0;
          state.systemDataDeletion.restoreUploadProgressLabel = "";
          renderView();
        }
      }
    }

    function setSuperAdminStatus(message = "", type = "") {
      state.superAdmin.statusMessage = String(message || "");
      state.superAdmin.statusType = type;

      const statusElement = getSuperAdminStatusElement();

      if (!statusElement) {
        return;
      }

      statusElement.textContent = state.superAdmin.statusMessage;
      statusElement.classList.toggle("hidden", !state.superAdmin.statusMessage);
      statusElement.classList.toggle("warning", type === "warning");
    }

    function getSystemExamNoComponentLabel(value = "") {
      const normalizedValue = String(value || "").trim();

      if (normalizedValue === "admissionCode") {
        return "전형코드";
      }

      if (normalizedValue === "seriesCode") {
        return "계열코드";
      }

      if (normalizedValue === "unitCode") {
        return "모집단위코드";
      }

      if (normalizedValue === "nationalityCode") {
        return "국적코드";
      }

      if (normalizedValue === "sequence") {
        return "순번";
      }

      return "선택 안 함";
    }

    function normalizeApplicantScheduleDateTime(value) {
      const normalizedValue = String(value ?? "").trim();

      if (!normalizedValue) {
        return "";
      }

      const matchedValue = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

      if (!matchedValue) {
        return "";
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
        return "";
      }

      return `${yearValue}-${monthValue}-${dayValue}T${hourValue}:${minuteValue}`;
    }

    function createEmptyApplicantScheduleParts() {
      return {
        year: "",
        month: "",
        day: "",
        hour: "",
        minute: "",
      };
    }

    function normalizeSystemSettingsTextSnapshotValue(value = "") {
      return String(value ?? "").trim();
    }

    function normalizeSystemSettingsNumericSnapshotValue(value = "", { emptyValue = "" } = {}) {
      const normalizedValue = String(value ?? "").trim();

      if (!normalizedValue) {
        return emptyValue;
      }

      const numericValue = Number(normalizedValue);

      if (!Number.isFinite(numericValue)) {
        return normalizedValue;
      }

      return String(Math.round(numericValue));
    }

    function cloneSystemSettingsSnapshot(snapshot = {}) {
      return {
        initialPassword: normalizeSystemSettingsTextSnapshotValue(snapshot.initialPassword),
        autoLogoutMinutes: normalizeSystemSettingsNumericSnapshotValue(snapshot.autoLogoutMinutes, { emptyValue: "0" }),
        admissionHomepageUrl: normalizeSystemSettingsTextSnapshotValue(snapshot.admissionHomepageUrl),
        applicantExamNoDigitCount: normalizeSystemSettingsNumericSnapshotValue(snapshot.applicantExamNoDigitCount),
        applicantExamNoComponents: Array.isArray(snapshot.applicantExamNoComponents)
          ? snapshot.applicantExamNoComponents.map((value) => String(value || "").trim())
          : ["admissionCode", "seriesCode", "unitCode", "sequence", ""],
      };
    }

    function normalizeApplicantScheduleParts(parts = {}) {
      return {
        year: String(parts?.year || "").trim(),
        month: String(parts?.month || "").trim(),
        day: String(parts?.day || "").trim(),
        hour: String(parts?.hour || "").trim(),
        minute: String(parts?.minute || "").trim(),
      };
    }

    function isApplicantSchedulePartComplete(parts = {}) {
      const normalizedParts = normalizeApplicantScheduleParts(parts);
      return Object.values(normalizedParts).every(Boolean);
    }

    function buildApplicantScheduleDateTimeFromParts(parts = {}) {
      const normalizedParts = normalizeApplicantScheduleParts(parts);

      if (!isApplicantSchedulePartComplete(normalizedParts)) {
        return "";
      }

      return normalizeApplicantScheduleDateTime(
        `${normalizedParts.year}-${normalizedParts.month}-${normalizedParts.day}T${normalizedParts.hour}:${normalizedParts.minute}`,
      );
    }

    function buildSystemSettingsSnapshot(source = state.systemSettings) {
      const systemSettingsSource = source && typeof source === "object" ? source : {};

      return cloneSystemSettingsSnapshot({
        initialPassword: String(systemSettingsSource.initialPassword ?? "").trim(),
        autoLogoutMinutes: String(systemSettingsSource.autoLogoutMinutes ?? "").trim(),
        admissionHomepageUrl: String(systemSettingsSource.admissionHomepageUrl ?? "").trim(),
        applicantExamNoDigitCount: String(systemSettingsSource.applicantExamNoDigitCount ?? "").trim(),
        applicantExamNoComponents: Array.isArray(systemSettingsSource.applicantExamNoComponents)
          ? systemSettingsSource.applicantExamNoComponents.map((value) => String(value || "").trim())
          : ["admissionCode", "seriesCode", "unitCode", "sequence", ""],
      });
    }

    function areSystemSettingsSnapshotsEqual(leftSnapshot = {}, rightSnapshot = {}) {
      const left = cloneSystemSettingsSnapshot(leftSnapshot);
      const right = cloneSystemSettingsSnapshot(rightSnapshot);

      return (
        left.initialPassword === right.initialPassword &&
        left.autoLogoutMinutes === right.autoLogoutMinutes &&
        left.admissionHomepageUrl === right.admissionHomepageUrl &&
        left.applicantExamNoDigitCount === right.applicantExamNoDigitCount &&
        left.applicantExamNoComponents.length === right.applicantExamNoComponents.length &&
        left.applicantExamNoComponents.every((value, index) => value === right.applicantExamNoComponents[index])
      );
    }

    function cloneSuperAdminSnapshot(snapshot = state.superAdmin || {}) {
      return normalizeSuperAdminSettings(snapshot);
    }

    function areSuperAdminSnapshotsEqual(leftSnapshot = {}, rightSnapshot = {}) {
      const left = cloneSuperAdminSnapshot(leftSnapshot);
      const right = cloneSuperAdminSnapshot(rightSnapshot);

      return (
        left.schoolName === right.schoolName &&
        left.logoImageUrl === right.logoImageUrl &&
        left.backgroundImageUrl === right.backgroundImageUrl &&
        left.recruitmentEnabled === right.recruitmentEnabled
      );
    }

    function buildSuperAdminSnapshot(source = state.superAdmin || {}) {
      return cloneSuperAdminSnapshot(source);
    }

    function applySuperAdminPayload(payload = {}, options = {}) {
      const nextSnapshot = cloneSuperAdminSnapshot(payload);

      state.superAdmin.schoolName = nextSnapshot.schoolName;
      state.superAdmin.logoImageUrl = nextSnapshot.logoImageUrl;
      state.superAdmin.backgroundImageUrl = nextSnapshot.backgroundImageUrl;
      state.superAdmin.recruitmentEnabled = nextSnapshot.recruitmentEnabled;
      state.superAdmin.savedSnapshot = cloneSuperAdminSnapshot(nextSnapshot);
      state.superAdmin.hasUnsavedChanges = false;
      state.superAdmin.uploadingField = "";

      if (!options.preserveStatus) {
        state.superAdmin.statusMessage = "";
        state.superAdmin.statusType = "";
      }

      syncSuperAdminDirtyState();
    }

    function formatSuperAdminSummaryValue(summaryKey, snapshot = {}) {
      const normalizedSnapshot = cloneSuperAdminSnapshot(snapshot);

      if (summaryKey === "schoolName") {
        return normalizedSnapshot.schoolName || "미설정";
      }

      if (summaryKey === "logoImageUrl") {
        return normalizedSnapshot.logoImageUrl ? "사용자 업로드" : "기본 로고";
      }

      if (summaryKey === "backgroundImageUrl") {
        return normalizedSnapshot.backgroundImageUrl ? "사용자 업로드" : "기본 배경";
      }

      if (summaryKey === "recruitmentEnabled") {
        return normalizedSnapshot.recruitmentEnabled ? "표시함" : "숨김";
      }

      return "-";
    }

    function getSuperAdminChangeSummaries() {
      const savedSnapshot = cloneSuperAdminSnapshot(state.superAdmin.savedSnapshot || {});
      const draftSnapshot = buildSuperAdminSnapshot();
      const summaryDefinitions = [
        { key: "schoolName", label: "학교명" },
        { key: "logoImageUrl", label: "로고 이미지" },
        { key: "backgroundImageUrl", label: "배경 이미지" },
        { key: "recruitmentEnabled", label: "접수 버튼 표시 여부" },
      ];

      return summaryDefinitions
        .map((definition) => {
          const beforeValue = formatSuperAdminSummaryValue(definition.key, savedSnapshot);
          const afterValue = formatSuperAdminSummaryValue(definition.key, draftSnapshot);

          if (beforeValue === afterValue) {
            return null;
          }

          return {
            label: definition.label,
            beforeValue,
            afterValue,
          };
        })
        .filter(Boolean);
    }

    function formatSystemScheduleDisplayValue(value = "") {
      const normalizedValue = normalizeApplicantScheduleDateTime(value);

      if (!normalizedValue) {
        return "미설정";
      }

      const [dateValue, timeValue] = normalizedValue.split("T");
      return `${dateValue} ${timeValue}`;
    }

    function formatSystemSettingsSummaryValue(summaryKey, snapshot = {}) {
      const normalizedSnapshot = cloneSystemSettingsSnapshot(snapshot);

      if (summaryKey === "initialPassword") {
        return normalizedSnapshot.initialPassword || "미설정";
      }

      if (summaryKey === "autoLogoutMinutes") {
        return `${String(normalizedSnapshot.autoLogoutMinutes || "0")}분`;
      }

      if (summaryKey === "admissionHomepageUrl") {
        return normalizedSnapshot.admissionHomepageUrl || "미설정";
      }

      if (summaryKey === "applicantExamNoDigitCount") {
        return `${String(normalizedSnapshot.applicantExamNoDigitCount || "0")}자리`;
      }

      if (summaryKey === "applicantExamNoComponents") {
        const selectedComponents = normalizedSnapshot.applicantExamNoComponents
          .filter(Boolean)
          .map((value) => getSystemExamNoComponentLabel(value));

        return selectedComponents.length > 0 ? selectedComponents.join(" / ") : "미설정";
      }

      return "-";
    }

    function getSystemSettingsChangeSummaries() {
      const savedSnapshot = cloneSystemSettingsSnapshot(state.systemSettings.savedSnapshot || {});
      const draftSnapshot = buildSystemSettingsSnapshot();
      const summaryDefinitions = [
        { key: "initialPassword", label: "초기 비밀번호" },
        { key: "autoLogoutMinutes", label: "자동 로그아웃 시간" },
        { key: "admissionHomepageUrl", label: "입학처 홈페이지 링크" },
        { key: "applicantExamNoDigitCount", label: "수험번호 자리수" },
        { key: "applicantExamNoComponents", label: "수험번호 자동 생성 조합" },
      ];

      return summaryDefinitions
        .map((definition) => {
          const beforeValue = formatSystemSettingsSummaryValue(definition.key, savedSnapshot);
          const afterValue = formatSystemSettingsSummaryValue(definition.key, draftSnapshot);

          if (beforeValue === afterValue) {
            return null;
          }

          return {
            label: definition.label,
            beforeValue,
            afterValue,
          };
        })
        .filter(Boolean);
    }

    function syncSystemSettingsDirtyState() {
      const hasUnsavedChanges = !areSystemSettingsSnapshotsEqual(state.systemSettings.savedSnapshot, buildSystemSettingsSnapshot());
      const saveButtonElement = getSystemSettingsSaveButtonElement();

      state.systemSettings.hasUnsavedChanges = hasUnsavedChanges;

      if (saveButtonElement) {
        saveButtonElement.disabled =
          !hasUnsavedChanges ||
          state.systemSettings.isSaving ||
          state.systemDataDeletion.isDeleting ||
          state.systemDataDeletion.isBackingUp ||
          state.systemDataDeletion.isRestoring;
      }

      return hasUnsavedChanges;
    }

    function syncSuperAdminDirtyState() {
      const hasUnsavedChanges = !areSuperAdminSnapshotsEqual(state.superAdmin.savedSnapshot, buildSuperAdminSnapshot());
      const saveButtonElement = getSuperAdminSaveButtonElement();
      const isUploadingImage = Boolean(String(state.superAdmin.uploadingField || "").trim());

      state.superAdmin.hasUnsavedChanges = hasUnsavedChanges;

      if (saveButtonElement) {
        saveButtonElement.disabled =
          !hasUnsavedChanges ||
          state.superAdmin.isSaving ||
          isUploadingImage ||
          state.systemDataDeletion.isDeleting ||
          state.systemDataDeletion.isBackingUp ||
          state.systemDataDeletion.isRestoring;
      }

      return hasUnsavedChanges;
    }

    function syncSystemBackupAutomationDirtyState() {
      const automationState = getSystemBackupAutomationState();
      const hasUnsavedChanges = !areSystemBackupAutomationSnapshotsEqual(
        automationState.savedSnapshot,
        buildSystemBackupAutomationSnapshot(automationState),
      );
      const saveButtonElement = getSystemBackupAutomationSaveButtonElement();

      automationState.hasUnsavedChanges = hasUnsavedChanges;

      if (saveButtonElement) {
        saveButtonElement.disabled =
          !hasUnsavedChanges ||
          automationState.isSaving === true ||
          automationState.isRunning === true ||
          state.systemDataDeletion.isDeleting ||
          state.systemDataDeletion.isBackingUp ||
          state.systemDataDeletion.isRestoring ||
          state.systemDataDeletion.isRestoreValidating;
      }

      return hasUnsavedChanges;
    }

    async function confirmSystemSettingsNavigation() {
      if (window.AdmitCardEmailSettings && !(await window.AdmitCardEmailSettings.confirmNavigation())) return false;
      const currentView = String(state.currentView || "").trim();
      const automationState = getSystemBackupAutomationState();

      if (currentView === "superAdminManagement") {
        if (!syncSuperAdminDirtyState()) {
          return true;
        }

        const changeSummaries = getSuperAdminChangeSummaries();
        const messageLines = [
          "다음 슈퍼관리자 설정 변경사항이 있습니다.",
          ...changeSummaries.map((summary) => `- ${summary.label}: ${summary.beforeValue} -> ${summary.afterValue}`),
          "",
          "저장하고 이동하시겠습니까?",
          "확인: 저장 후 이동",
          "취소: 저장하지 않고 이동",
        ];

        if (!window.confirm(messageLines.join("\n"))) {
          return true;
        }

        return saveSuperAdminSettings();
      }

      if (currentView === "systemBackupRestore") {
        if (!syncSystemBackupAutomationDirtyState()) {
          return true;
        }

        const snapshot = buildSystemBackupAutomationSnapshot(automationState);
        const selectedItems = [
          ...(snapshot.includeDatabase ? ["데이터베이스"] : []),
          ...snapshot.includedAssetKeys.map((assetKey) => SYSTEM_BACKUP_ASSET_LABELS[assetKey] || assetKey),
        ];
        const messageLines = [
          "다음 자동 백업 변경사항이 있습니다.",
          `- 사용 여부: ${snapshot.enabled ? "사용" : "사용 안 함"}`,
          `- 주기: ${snapshot.scheduleType === "weekly" ? "매주" : "매일"}`,
          `- 실행 시각: ${snapshot.time}`,
          `- 보관 개수: ${snapshot.retentionCount}개`,
          `- 선택 항목: ${selectedItems.join(", ") || "없음"}`,
          "",
          "저장하고 이동하시겠습니까?",
          "확인: 저장 후 이동",
          "취소: 저장하지 않고 이동",
        ];

        if (!window.confirm(messageLines.join("\n"))) {
          return true;
        }

        return saveSystemBackupAutomationSettings();
      }

      if (currentView !== "systemSettings") {
        return true;
      }

      if (!syncSystemSettingsDirtyState()) {
        return true;
      }

      const changeSummaries = getSystemSettingsChangeSummaries();
      const messageLines = [
        "다음 시스템 설정 변경사항이 있습니다.",
        ...changeSummaries.map((summary) => `- ${summary.label}: ${summary.beforeValue} -> ${summary.afterValue}`),
        "",
        "저장하고 이동하시겠습니까?",
        "확인: 저장 후 이동",
        "취소: 저장하지 않고 이동",
      ];

      if (!window.confirm(messageLines.join("\n"))) {
        return true;
      }

      return saveSystemSettings();
    }

    function hasUnsavedSystemSettingsChanges() {
      return Boolean(window.AdmitCardEmailSettings?.hasUnsavedChanges()) || syncSystemSettingsDirtyState() || syncSuperAdminDirtyState() || syncSystemBackupAutomationDirtyState();
    }

    function getApplicantScheduleTimestamp(value) {
      const normalizedValue = normalizeApplicantScheduleDateTime(value);

      if (!normalizedValue) {
        return NaN;
      }

      const [, yearValue, monthValue, dayValue, hourValue, minuteValue] = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/) || [];
      return new Date(
        Number(yearValue),
        Number(monthValue) - 1,
        Number(dayValue),
        Number(hourValue),
        Number(minuteValue),
        0,
        0,
      ).getTime();
    }

    function validateSystemScheduleRange(scheduleLabel, startAtParts, endAtParts) {
      const normalizedStartAtParts = normalizeApplicantScheduleParts(startAtParts);
      const normalizedEndAtParts = normalizeApplicantScheduleParts(endAtParts);
      const startAt = buildApplicantScheduleDateTimeFromParts(normalizedStartAtParts);
      const endAt = buildApplicantScheduleDateTimeFromParts(normalizedEndAtParts);

      if (!isApplicantSchedulePartComplete(normalizedStartAtParts) || !isApplicantSchedulePartComplete(normalizedEndAtParts)) {
        throw new Error(`${scheduleLabel}은 년/월/일/시/분을 모두 선택하세요.`);
      }

      if (!startAt || !endAt) {
        throw new Error(`${scheduleLabel}은 반드시 설정해야 합니다.`);
      }

      const startTimestamp = getApplicantScheduleTimestamp(startAt);
      const endTimestamp = getApplicantScheduleTimestamp(endAt);

      if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp)) {
        throw new Error(`${scheduleLabel} 형식이 올바르지 않습니다.`);
      }

      if (startTimestamp > endTimestamp) {
        throw new Error(`${scheduleLabel}의 시작 일시는 종료 일시보다 늦을 수 없습니다.`);
      }

      return {
        startAt,
        endAt,
        startAtParts: normalizedStartAtParts,
        endAtParts: normalizedEndAtParts,
      };
    }

    function applySystemSettingsPayload(payload = {}, options = {}) {
      const nextSettings = normalizeSystemSettingsPayload(payload);
      state.systemSettings.initialPassword = nextSettings.initialPassword;
      state.systemSettings.autoLogoutMinutes = nextSettings.autoLogoutMinutes;
      state.systemSettings.admissionHomepageUrl = nextSettings.admissionHomepageUrl;
      state.systemSettings.applicantExamNoDigitCount = nextSettings.applicantExamNoDigitCount;
      state.systemSettings.applicantExamNoComponents = [...nextSettings.applicantExamNoComponents];
      state.systemSettings.savedSnapshot = buildSystemSettingsSnapshot(nextSettings);
      state.systemSettings.hasUnsavedChanges = false;

      if (!options.preserveStatus) {
        state.systemSettings.statusMessage = "";
        state.systemSettings.statusType = "";
      }

      syncAccountCreateDescription();
      syncAutoLogoutTimer();
      syncSystemSettingsDirtyState();
    }

    function changeSystemAutoLogoutMinutes(delta) {
      const normalizedDelta = Number(delta);

      if (!Number.isFinite(normalizedDelta) || normalizedDelta === 0) {
        return;
      }

      const nextValue = Math.min(
        MAX_SYSTEM_AUTO_LOGOUT_MINUTES,
        Math.max(0, normalizeSystemAutoLogoutMinutes(state.systemSettings.autoLogoutMinutes) + normalizedDelta),
      );

      state.systemSettings.autoLogoutMinutes = String(nextValue);
      syncSystemSettingsDirtyState();

      if (state.systemSettings.statusMessage) {
        setSystemSettingsStatus("");
      }

      const inputElement = getSystemAutoLogoutInputElement();

      if (inputElement) {
        inputElement.value = state.systemSettings.autoLogoutMinutes;
        inputElement.focus();
      }
    }

    function getValidatedSystemSettingsPayload() {
      const initialPassword = String(state.systemSettings.initialPassword ?? "").trim();
      const autoLogoutMinutes = Math.round(Number(state.systemSettings.autoLogoutMinutes));
      const admissionHomepageUrl = String(state.systemSettings.admissionHomepageUrl ?? "").trim();

      const applicantExamNoDigitCount = Math.round(Number(state.systemSettings.applicantExamNoDigitCount));
      const applicantExamNoComponents = Array.isArray(state.systemSettings.applicantExamNoComponents)
        ? state.systemSettings.applicantExamNoComponents.map((value) => String(value || "").trim())
        : [];

      if (!initialPassword) {
        throw new Error("초기 비밀번호를 입력하세요.");
      }

      if (initialPassword.length < 4) {
        throw new Error("초기 비밀번호는 4자 이상이어야 합니다.");
      }

      if (initialPassword.length > 100) {
        throw new Error("초기 비밀번호는 100자 이하여야 합니다.");
      }

      if (!Number.isFinite(autoLogoutMinutes) || autoLogoutMinutes < 0 || autoLogoutMinutes > MAX_SYSTEM_AUTO_LOGOUT_MINUTES) {
        throw new Error(`자동 로그아웃 시간은 0분 이상 ${MAX_SYSTEM_AUTO_LOGOUT_MINUTES}분 이하로 입력하세요.`);
      }

      if (admissionHomepageUrl.length > 500) {
        throw new Error("입학처 홈페이지 링크는 500자 이하여야 합니다.");
      }

      if (admissionHomepageUrl && !/^https?:\/\/\S+$/i.test(admissionHomepageUrl) && !/^\/\S*$/.test(admissionHomepageUrl)) {
        throw new Error("입학처 홈페이지 링크는 https:// 주소 또는 /경로 형식으로 입력하세요.");
      }

      if (!Number.isFinite(applicantExamNoDigitCount) || applicantExamNoDigitCount < 1 || applicantExamNoDigitCount > 30) {
        throw new Error("수험번호 자리수는 1자 이상 30자 이하로 입력하세요.");
      }

      const selectedExamNoComponents = applicantExamNoComponents.filter(Boolean);

      if (selectedExamNoComponents.length === 0) {
        throw new Error("수험번호 자동 생성 구성 요소를 하나 이상 선택하세요.");
      }

      if (selectedExamNoComponents.filter((value) => value === "sequence").length !== 1) {
        throw new Error("수험번호 자동 생성 구성에는 순번을 한 번만 포함해야 합니다.");
      }

      if (new Set(selectedExamNoComponents).size !== selectedExamNoComponents.length) {
        throw new Error("수험번호 자동 생성 구성 요소는 중복 없이 선택하세요.");
      }

      return {
        initialPassword,
        autoLogoutMinutes,
        admissionHomepageUrl,
        applicantExamNoDigitCount,
        applicantExamNoComponents,
      };
    }

    function getValidatedSuperAdminPayload() {
      const nextSettings = buildSuperAdminSnapshot();

      if (nextSettings.schoolName.length > 100) {
        throw new Error("학교명은 100자 이하여야 합니다.");
      }

      return nextSettings;
    }

    function updateSuperAdminField(field, value) {
      const normalizedField = String(field || "").trim();

      if (normalizedField === "schoolName") {
        state.superAdmin.schoolName = String(value || "");
      } else if (normalizedField === "recruitmentEnabled") {
        state.superAdmin.recruitmentEnabled = value !== false;
      } else {
        return;
      }

      syncSuperAdminDirtyState();

      if (state.superAdmin.statusMessage) {
        setSuperAdminStatus("");
      }
    }

    function updateSuperAdminImageField(field, value) {
      const normalizedField = String(field || "").trim();

      if (normalizedField === "logoImageUrl") {
        state.superAdmin.logoImageUrl = String(value || "").trim();
      } else if (normalizedField === "backgroundImageUrl") {
        state.superAdmin.backgroundImageUrl = String(value || "").trim();
      } else {
        return;
      }

      syncSuperAdminDirtyState();

      if (state.superAdmin.statusMessage) {
        setSuperAdminStatus("");
      }
    }

    function getPendingSuperAdminManagedImageUrl(field) {
      const normalizedField = String(field || "").trim();

      if (!["logoImageUrl", "backgroundImageUrl"].includes(normalizedField)) {
        return "";
      }

      const draftValue = String(state.superAdmin?.[normalizedField] || "").trim();
      const savedValue = String(state.superAdmin?.savedSnapshot?.[normalizedField] || "").trim();

      if (!draftValue || draftValue === savedValue || !draftValue.startsWith("/uploads/img/")) {
        return "";
      }

      return draftValue;
    }

    async function applySuperAdminImageFile(field, file) {
      const normalizedField = String(field || "").trim();
      const imageFile = file instanceof File ? file : null;

      if (!imageFile) {
        return false;
      }

      if (imageFile.size > 5 * 1024 * 1024) {
        setSuperAdminStatus("이미지 파일은 5MB 이하만 업로드할 수 있습니다.", "warning");
        return false;
      }

      if (!String(imageFile.type || "").toLowerCase().startsWith("image/")) {
        setSuperAdminStatus("이미지 파일만 업로드할 수 있습니다.", "warning");
        return false;
      }

      state.superAdmin.uploadingField = normalizedField;
      setSuperAdminStatus("이미지 파일을 업로드하고 있습니다.");
      syncSuperAdminDirtyState();
      renderView();

      try {
        const searchParams = new URLSearchParams({
          fileName: imageFile.name || `${normalizedField}.png`,
        });
        const replaceUrl = getPendingSuperAdminManagedImageUrl(normalizedField);

        if (replaceUrl) {
          searchParams.set("replaceUrl", replaceUrl);
        }

        const uploadResult = await apiRequestWithUploadProgress(
          `/api/super-admin/assets/${encodeURIComponent(normalizedField)}?${searchParams.toString()}`,
          {
            method: "POST",
            body: imageFile,
            headers: {
              "Content-Type": imageFile.type || "application/octet-stream",
            },
          },
        );

        updateSuperAdminImageField(normalizedField, uploadResult?.imageUrl || "");
        setSuperAdminStatus("이미지를 업로드했습니다. 저장 버튼을 눌러 반영하세요.");
        return true;
      } catch (error) {
        setSuperAdminStatus(error.message, "warning");
        return false;
      } finally {
        state.superAdmin.uploadingField = "";
        syncSuperAdminDirtyState();
      }
    }

    function buildSystemDataDeletionSuccessMessage(result = {}) {
      const scope = String(result.scope || "").trim();
      const deletedExaminees = Number(result.deletedExaminees || 0);
      const deletedPhotos = Number(result.deletedPhotos || 0);
      const deletedApplicantSettings = Number(result.deletedApplicantSettings || 0);

      const deletedPrintHistory = Number(result.deletedPrintHistory || 0);
      const deletedApplicantSubmissions = Number(result.deletedApplicantSubmissions || 0);
      const deletedMembers = Number(result.deletedMembers || 0);
      if (scope === 'applicant-members') return `회원 ${deletedMembers}명의 가입정보를 삭제했습니다. 접수 이력은 보존하고 회원 연결을 해제했습니다.`;

      if (scope === "all") {
        return `전체 데이터를 삭제했습니다. 회원 ${deletedMembers}명, 전형 관리 ${deletedApplicantSettings}건, 출력 이력 ${deletedPrintHistory}건, 접수 이력 ${deletedApplicantSubmissions}건이 정리되었습니다.`;
      }

      if (scope === "applicant-settings") {
        return `전형 관리 데이터 ${deletedApplicantSettings}건을 삭제했습니다.`;
      }

      if (scope === "applicant-history") {
        return `접수 이력 데이터 ${deletedApplicantSubmissions}건을 삭제했습니다.`;
      }

      return `수험표 출력 이력 ${deletedPrintHistory}건을 삭제했습니다.`;
    }

    async function saveSuperAdminSettings() {
      let nextSettings;

      if (isSystemDataOperationActive()) {
        setSuperAdminStatus("백업, 복원 또는 데이터 삭제 작업이 끝난 뒤 저장하세요.", "warning");
        syncSuperAdminDirtyState();
        return false;
      }

      if (String(state.superAdmin.uploadingField || "").trim()) {
        setSuperAdminStatus("이미지 업로드가 끝난 뒤 저장하세요.", "warning");
        syncSuperAdminDirtyState();
        return false;
      }

      try {
        nextSettings = getValidatedSuperAdminPayload();
      } catch (error) {
        setSuperAdminStatus(error.message, "warning");
        syncSuperAdminDirtyState();
        return false;
      }

      state.superAdmin.isSaving = true;
      setSuperAdminStatus("");
      syncSuperAdminDirtyState();
      renderView();

      try {
        const savedSettings = await apiRequest("/api/super-admin/settings", {
          method: "PUT",
          body: JSON.stringify(nextSettings),
        });

        applySuperAdminPayload(savedSettings, { preserveStatus: true });
        setSuperAdminStatus("슈퍼관리자 설정을 저장했습니다.");
        showToast("슈퍼관리자 설정을 저장했습니다.");
        renderView();
        return true;
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return false;
        }

        setSuperAdminStatus(error.message, "warning");
        syncSuperAdminDirtyState();
        renderView();
        return false;
      } finally {
        state.superAdmin.isSaving = false;
        syncSuperAdminDirtyState();
        renderView();
      }
    }

    async function saveSystemSettings() {
      let nextSettings;
      if (state.systemSettings.isSaving) return false;

      if (isSystemDataOperationActive()) {
        setSystemSettingsStatus("백업, 복원 또는 데이터 삭제 작업이 끝난 뒤 저장하세요.", "warning");
        syncSystemSettingsDirtyState();
        return false;
      }

      try {
        nextSettings = getValidatedSystemSettingsPayload();
      } catch (error) {
        setSystemSettingsStatus(error.message, "warning");
        syncSystemSettingsDirtyState();
        return false;
      }

      state.systemSettings.isSaving = true;
      setSystemSettingsStatus("");
      syncSystemSettingsDirtyState();
      renderView();

      try {
        const savedSettings = await apiRequest("/api/system-settings", {
          method: "PUT",
          body: JSON.stringify(nextSettings),
        });

        applySystemSettingsPayload(savedSettings, { preserveStatus: true });
        setSystemSettingsStatus("시스템 설정을 저장했습니다.");
        showToast("시스템 설정을 저장했습니다.");
        return true;
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return false;
        }

        setSystemSettingsStatus(error.message, "warning");
        syncSystemSettingsDirtyState();
        return false;
      } finally {
        state.systemSettings.isSaving = false;
        syncSystemSettingsDirtyState();
        renderView();
      }
    }

    function getValidatedSystemBackupAutomationPayload() {
      const automationState = getSystemBackupAutomationState();
      const snapshot = buildSystemBackupAutomationSnapshot(automationState);
      const selectedItemCount = (snapshot.includeDatabase ? 1 : 0) + snapshot.includedAssetKeys.length;

      if (selectedItemCount === 0) {
        throw new Error("자동 백업 항목을 하나 이상 선택하세요.");
      }

      return snapshot;
    }

    function updateSystemBackupAutomationField(fieldName = "", value = "") {
      const automationState = getSystemBackupAutomationState();
      const normalizedFieldName = String(fieldName || "").trim();

      if (!normalizedFieldName) {
        return false;
      }

      if (normalizedFieldName === "enabled") {
        automationState.enabled = value === true;
      } else if (normalizedFieldName === "scheduleType") {
        automationState.scheduleType = normalizeSystemBackupAutomationScheduleType(value);
      } else if (normalizedFieldName === "weeklyDay") {
        automationState.weeklyDay = normalizeSystemBackupAutomationWeeklyDay(value);
      } else if (normalizedFieldName === "time") {
        automationState.time = normalizeSystemBackupAutomationTime(value);
      } else if (normalizedFieldName === "retentionCount") {
        automationState.retentionCount = String(value || "");
      } else {
        return false;
      }

      if (automationState.statusMessage) {
        setSystemBackupAutomationStatus("");
      }

      syncSystemBackupAutomationDirtyState();
      renderView();
      return true;
    }

    function toggleSystemBackupAutomationItemSelection(itemKey = "", isSelected = true) {
      const normalizedItemKey = String(itemKey || "").trim();
      const automationState = getSystemBackupAutomationState();

      if (automationState.isSaving === true || automationState.isRunning === true || isSystemDataOperationActive()) {
        return false;
      }

      if (normalizedItemKey === SYSTEM_BACKUP_DATABASE_ITEM_KEY) {
        automationState.includeDatabase = isSelected === true;
      } else if (SYSTEM_BACKUP_ASSET_KEYS.includes(normalizedItemKey)) {
        const currentAssetKeySet = new Set(normalizeSystemBackupAutomationAssetKeys(automationState.includedAssetKeys));

        if (isSelected === true) {
          currentAssetKeySet.add(normalizedItemKey);
        } else {
          currentAssetKeySet.delete(normalizedItemKey);
        }

        automationState.includedAssetKeys = SYSTEM_BACKUP_ASSET_KEYS.filter((assetKey) => currentAssetKeySet.has(assetKey));
      } else {
        return false;
      }

      if (automationState.statusMessage) {
        setSystemBackupAutomationStatus("");
      }

      syncSystemBackupAutomationDirtyState();
      renderView();
      return true;
    }

    async function saveSystemBackupAutomationSettings() {
      const automationState = getSystemBackupAutomationState();
      let nextSettings;

      if (isSystemDataOperationActive() || automationState.isSaving === true || automationState.isRunning === true) {
        setSystemBackupAutomationStatus("백업, 복원, 삭제 또는 자동 백업 실행이 끝난 뒤 저장하세요.", "warning");
        syncSystemBackupAutomationDirtyState();
        return false;
      }

      try {
        nextSettings = getValidatedSystemBackupAutomationPayload();
      } catch (error) {
        setSystemBackupAutomationStatus(error.message, "warning");
        syncSystemBackupAutomationDirtyState();
        return false;
      }

      automationState.isSaving = true;
      setSystemBackupAutomationStatus("");
      syncSystemBackupAutomationDirtyState();
      renderView();

      try {
        const savedSettings = await apiRequest("/api/system-backup/automation", {
          method: "PUT",
          body: JSON.stringify(nextSettings),
        });

        applySystemBackupAutomationPayload(savedSettings, {
          preserveStatus: true,
        });
        setSystemBackupAutomationStatus("자동 백업 설정을 저장했습니다.");
        showToast("자동 백업 설정을 저장했습니다.");
        await refreshSystemAuditLogsAfterSystemAction();
        return true;
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return false;
        }

        setSystemBackupAutomationStatus(error.message, "warning");
        syncSystemBackupAutomationDirtyState();
        return false;
      } finally {
        automationState.isSaving = false;
        syncSystemBackupAutomationDirtyState();
        renderView();
      }
    }

    async function runSystemBackupAutomationNow() {
      const automationState = getSystemBackupAutomationState();

      if (isSystemDataOperationActive() || automationState.isSaving === true || automationState.isRunning === true) {
        setSystemBackupAutomationStatus("다른 시스템 작업이 끝난 뒤 자동 백업을 실행하세요.", "warning");
        return false;
      }

      if (automationState.hasUnsavedChanges) {
        setSystemBackupAutomationStatus("저장되지 않은 자동 백업 설정이 있습니다. 먼저 저장한 뒤 실행하세요.", "warning");
        return false;
      }

      if (!window.confirm("현재 자동 백업 설정 기준으로 즉시 백업 ZIP을 생성합니다.\n\n계속하시겠습니까?")) {
        return false;
      }

      automationState.isRunning = true;
      setSystemBackupAutomationStatus("자동 백업 ZIP을 생성하고 있습니다.");
      syncSystemBackupAutomationDirtyState();
      renderView();

      try {
        const result = await apiRequest("/api/system-backup/automation/run", {
          method: "POST",
        });

        applySystemBackupAutomationPayload(result, {
          preserveStatus: true,
        });
        setSystemBackupAutomationStatus("자동 백업 ZIP을 생성했습니다.");
        showToast("자동 백업 ZIP을 생성했습니다.");
        await refreshSystemAuditLogsAfterSystemAction();
        return true;
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return false;
        }

        setSystemBackupAutomationStatus(error.message, "warning");
        return false;
      } finally {
        automationState.isRunning = false;
        syncSystemBackupAutomationDirtyState();
        renderView();
      }
    }

    async function deleteSystemDataAction(scope) {
      const normalizedScope = String(scope || "").trim();
      const config = SYSTEM_DATA_DELETE_CONFIG[normalizedScope];

      if (!config || isSystemDataOperationActive()) {
        return;
      }

      if (!window.confirm(config.confirmMessage)) {
        return;
      }

      let currentPassword = "";

      if (normalizedScope === "all") {
        const lastBackupDownloadedAt = String(state.systemDataDeletion.lastBackupDownloadedAt || "").trim();
        const backupConfirmationMessage = lastBackupDownloadedAt
          ? `최근 백업 ZIP 다운로드 시각: ${lastBackupDownloadedAt}\n\n이 백업으로 복구 가능한지 확인한 뒤 전체 데이터 삭제를 진행하세요.\n\n계속하시겠습니까?`
          : "이번 세션에서 백업 ZIP 다운로드 기록이 없습니다.\n\n먼저 백업 및 복구 메뉴에서 백업 ZIP을 다운로드한 뒤 진행하는 것을 권장합니다.\n\n그래도 전체 데이터 삭제를 계속하시겠습니까?";

        if (!window.confirm(backupConfirmationMessage)) {
          setSystemDataDeletionStatus("전체 데이터 삭제 전 백업 상태 확인을 위해 작업을 중단했습니다.", "warning");
          return;
        }

        const confirmationPhrase = String(
          window.prompt("전체 데이터 삭제를 진행하려면 아래 문구를 그대로 입력하세요.\n\n전체 데이터 삭제", "") || "",
        ).trim();

        if (confirmationPhrase !== "전체 데이터 삭제") {
          setSystemDataDeletionStatus("확인 문구가 일치하지 않아 전체 데이터 삭제를 중단했습니다.", "warning");
          return;
        }

        currentPassword = String(window.prompt("전체 데이터 삭제를 진행하려면 현재 로그인한 계정의 비밀번호를 입력하세요.", "") || "");

        if (!currentPassword) {
          setSystemDataDeletionStatus("전체 데이터 삭제가 취소되었습니다.", "warning");
          return;
        }
      }

      if (normalizedScope === 'applicant-members') {
        currentPassword = String(window.prompt('회원가입 데이터를 삭제하려면 현재 로그인한 관리자 계정의 비밀번호를 입력하세요.', '') || '');
        if (!currentPassword) return;
      }
      state.systemDataDeletion.isDeleting = true;
      state.systemDataDeletion.activeScope = normalizedScope;
      setSystemDataDeletionStatus("");
      renderView();

      try {
        const result = await apiRequest(`/api/system-data/${encodeURIComponent(normalizedScope)}`, {
          method: "DELETE",
          body: ['all', 'applicant-members'].includes(normalizedScope) ? JSON.stringify({ currentPassword }) : undefined,
        });

        await loadBootstrapData({ showLoading: false });

        const successMessage = buildSystemDataDeletionSuccessMessage(result);
        setSystemDataDeletionStatus(successMessage);
        showToast(successMessage);
        await refreshSystemAuditLogsAfterSystemAction();
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return;
        }

        setSystemDataDeletionStatus(error.message, "warning");
      } finally {
        state.systemDataDeletion.isDeleting = false;
        state.systemDataDeletion.activeScope = "";
        renderView();
      }
    }

    async function downloadSystemBackupAction() {
      if (isSystemDataOperationActive()) {
        return false;
      }

      const includeDatabase = shouldIncludeSystemBackupDatabase();
      const includedAssetKeys = getSelectedSystemBackupAssetKeys();
      const selectedBackupItemCount = (includeDatabase ? 1 : 0) + includedAssetKeys.length;

      if (selectedBackupItemCount === 0) {
        setSystemDataDeletionStatus("백업할 항목을 하나 이상 선택하세요.", "warning");
        return false;
      }

      const currentPassword = String(window.prompt("시스템 백업 파일을 다운로드하려면 현재 로그인한 계정의 비밀번호를 입력하세요.", "") || "");

      if (!currentPassword) {
        setSystemDataDeletionStatus("시스템 백업 다운로드가 취소되었습니다.", "warning");
        return false;
      }

      state.systemDataDeletion.isBackingUp = true;
      setSystemDataDeletionStatus("");
      renderView();

      try {
        const response = await fetch("/api/system-backup/export", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentPassword,
            includeDatabase,
            includedAssetKeys,
          }),
        });
        const contentType = response.headers.get("content-type") || "";

        if (!response.ok) {
          const payload = contentType.includes("application/json") ? await response.json() : await response.text();
          throw new Error(payload?.error || payload || "시스템 백업 ZIP을 다운로드할 수 없습니다.");
        }

        const fileName = parseDownloadFileName(response.headers.get("content-disposition"), "system-backup.zip");

        triggerBlobDownload(await response.blob(), fileName);
        state.systemDataDeletion.lastBackupDownloadedAt = formatSystemAuditLogLoadedAtLabel(new Date());
        setSystemDataDeletionStatus("시스템 백업 ZIP을 다운로드했습니다.");
        showToast("시스템 백업 ZIP을 다운로드했습니다.");
        await refreshSystemAuditLogsAfterSystemAction();
        return true;
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return false;
        }

        setSystemDataDeletionStatus(error.message, "warning");
        return false;
      } finally {
        state.systemDataDeletion.isBackingUp = false;
        renderView();
      }
    }

    function buildSystemBackupRestoreSuccessMessage(result = {}) {
      const restoredTableCount = Number(result.restoredTableCount || 0);
      const restoredRowCount = Number(result.restoredRowCount || 0);
      const restoredFileCount = Number(result.restoredFileCount || 0);
      return `선택한 백업 항목을 복원했습니다. 데이터베이스 테이블 ${restoredTableCount}개, 데이터 ${restoredRowCount}건(회원 ${Number(result.restoredMembers || 0)}명 포함), 파일 ${restoredFileCount}건을 반영했습니다.`;
    }

    async function importSystemBackupAction() {
      if (isSystemDataOperationActive()) {
        return false;
      }

      const restoreFile = state.systemDataDeletion.restoreFile instanceof File ? state.systemDataDeletion.restoreFile : null;

      if (!restoreFile) {
        setSystemDataDeletionStatus("복원할 백업 ZIP을 먼저 선택하세요.", "warning");
        return false;
      }

      if (state.systemDataDeletion.isRestoreValidating) {
        setSystemDataDeletionStatus("백업 ZIP 유효성 검사가 끝난 뒤 복원을 실행하세요.", "warning");
        return false;
      }

      if (state.systemDataDeletion.isRestoreFileValid !== true) {
        setSystemDataDeletionStatus("유효성 검사가 완료된 백업 ZIP만 복원할 수 있습니다.", "warning");
        return false;
      }

      const selectedRestoreItemKeys = getSelectedSystemBackupRestoreItemKeys();

      if (selectedRestoreItemKeys.length === 0) {
        setSystemDataDeletionStatus("복원할 항목을 하나 이상 선택하세요.", "warning");
        return false;
      }

      if (!window.confirm("선택한 복원 항목 기준으로 현재 운영 데이터와 업로드 파일을 교체합니다.\n\n복원을 진행하시겠습니까?")) {
        return false;
      }

      const currentPassword = String(window.prompt("시스템 백업을 복원하려면 현재 로그인한 계정의 비밀번호를 입력하세요.", "") || "");

      if (!currentPassword) {
        setSystemDataDeletionStatus("시스템 백업 복원이 취소되었습니다.", "warning");
        return false;
      }

      state.systemDataDeletion.isRestoring = true;
      state.systemDataDeletion.restoreUploadProgressPercent = 0;
      state.systemDataDeletion.restoreUploadProgressLabel = "백업 ZIP 업로드를 준비하고 있습니다.";
      setSystemDataDeletionStatus("");
      renderView();

      try {
        const restoreResult = await apiRequestWithUploadProgress(
          "/api/system-backup/import",
          {
            method: "POST",
            body: restoreFile,
            headers: {
              "Content-Type": restoreFile.type || "application/zip",
              "X-System-Backup-Password-Base64": encodeHeaderValue(currentPassword),
              "X-System-Backup-File-Name-Base64": encodeHeaderValue(restoreFile.name || "system-backup.zip"),
              "X-System-Backup-Restore-Items-Base64": encodeHeaderValue(JSON.stringify(selectedRestoreItemKeys)),
            },
          },
          {
            onProgress: ({ percent = 0 }) => {
              state.systemDataDeletion.restoreUploadProgressPercent = Math.max(0, Math.min(100, Number(percent || 0)));
              state.systemDataDeletion.restoreUploadProgressLabel = `백업 ZIP 업로드 중... ${state.systemDataDeletion.restoreUploadProgressPercent}%`;
              renderView();
            },
            onUploadComplete: () => {
              state.systemDataDeletion.restoreUploadProgressPercent = 100;
              state.systemDataDeletion.restoreUploadProgressLabel = "백업 ZIP 업로드 완료, 서버에서 복원 작업을 진행 중입니다.";
              renderView();
            },
          },
        );

        clearSystemBackupRestoreFileSelection();
        await loadBootstrapData({ showLoading: false });

        const successMessage = buildSystemBackupRestoreSuccessMessage(restoreResult);
        setSystemDataDeletionStatus(successMessage);
        showToast(successMessage);
        await refreshSystemAuditLogsAfterSystemAction();
        return true;
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return false;
        }

        setSystemDataDeletionStatus(error.message, "warning");
        return false;
      } finally {
        state.systemDataDeletion.isRestoring = false;
        state.systemDataDeletion.restoreUploadProgressPercent = 0;
        state.systemDataDeletion.restoreUploadProgressLabel = "";
        renderView();
      }
    }

    return Object.freeze({
      applySystemBackupAutomationPayload,
      applySystemSettingsPayload,
      changeSystemAutoLogoutMinutes,
      clearSystemBackupRestoreFileSelection,
      confirmSystemSettingsNavigation,
      deleteSystemDataAction,
      downloadSystemBackupAction,
      getSystemDataDeletionStatusElement,
      getSystemBackupAutomationStatusElement,
      getSystemAuditLogStatusElement,
      getSystemSettingsStatusElement,
      getValidatedSystemSettingsPayload,
      getSystemSettingsChangeSummaries,
      hasUnsavedSystemSettingsChanges,
      importSystemBackupAction,
      loadSystemAuditLogs,
      applySuperAdminImageFile,
      applySuperAdminPayload,
      runSystemBackupAutomationNow,
      saveSuperAdminSettings,
      saveSystemBackupAutomationSettings,
      saveSystemSettings,
      selectSystemBackupRestoreFile,
      setSystemBackupAutomationStatus,
      setSystemAuditLogStatus,
      setSuperAdminStatus,
      setSystemDataDeletionStatus,
      setSystemSettingsStatus,
      syncSuperAdminDirtyState,
      syncSystemBackupAutomationDirtyState,
      syncSystemSettingsDirtyState,
      toggleSystemBackupAutomationItemSelection,
      toggleSystemBackupAssetSelection,
      toggleSystemBackupRestoreSelection,
      updateSystemBackupAutomationField,
      updateSuperAdminField,
      updateSuperAdminImageField,
    });
  }

  return Object.freeze({
    createSystemSettingsController,
  });
});
