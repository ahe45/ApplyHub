const AdmZip = require("adm-zip");
const { normalizeLegacyBackupRow } = require('../../database/schema-maintenance');

function createSystemBackupService({
  applicantFileStorageDirName = "uploads/file",
  applicantPhotoStorageDirName = "uploads/photo",
  createHttpError,
  databaseName = "applyhub",
  examineePhotoStorageDirName = "photo",
  fs,
  getPool,
  path,
  query,
  rootDir = process.cwd(),
}) {
  const backupSchemaVersion = "1";
  const databaseSelectionItemKey = "database";
  const legacyTableRestoreItemKey = "table-data";
  const tableDefinitions = Object.freeze([
    Object.freeze({ tableName: "accounts", orderByColumns: ["login_id"] }),
    Object.freeze({ tableName: "applicant_members", orderByColumns: ["id"] }),
    Object.freeze({ tableName: "system_set", orderByColumns: ["setting_key"] }),
    Object.freeze({ tableName: "templates", orderByColumns: ["id"] }),
    Object.freeze({ tableName: "print_log", orderByColumns: ["id"] }),
    Object.freeze({ tableName: "app_form_template", orderByColumns: ["id"] }),
    Object.freeze({ tableName: "app_form", orderByColumns: ["id"] }),
    Object.freeze({ tableName: "app_meta", orderByColumns: ["id"] }),
    Object.freeze({ tableName: "app_subm", orderByColumns: ["id", "field_key"] }),
    Object.freeze({ tableName: "app_document_status", orderByColumns: ["submission_id", "field_id"] }),
    Object.freeze({ tableName: "app_unit", orderByColumns: ["id"] }),
    Object.freeze({ tableName: "app_schedule", orderByColumns: ["id"] }),
    Object.freeze({ tableName: "app_email_log", orderByColumns: ["id"] }),
  ]);
  const autoIncrementTableNames = new Set([
    "applicant_members",
    "app_meta",
    "app_unit",
    "app_schedule",
    "app_email_log",
    "print_log",
    "app_form",
    "app_form_template",
  ]);
  const assetDefinitions = Object.freeze([

    Object.freeze({
      assetKey: "applicant-photos",
      directoryPath: path.join(rootDir, applicantPhotoStorageDirName),
      archivePrefix: "files/applicant-photos",
    }),
    Object.freeze({
      assetKey: "applicant-files",
      directoryPath: path.join(rootDir, applicantFileStorageDirName),
      archivePrefix: "files/applicant-files",
    }),
  ]);
  const assetDefinitionMap = new Map(assetDefinitions.map((assetDefinition) => [assetDefinition.assetKey, assetDefinition]));
  const restorableAssetKeySet = new Set(["applicant-photos", "applicant-files"]);
  const systemBackupAutomationSettingKey = "systemBackupAutomationJson";
  const systemAutoBackupDirectoryPath = path.join(rootDir, "backups", "system-auto");
  const defaultSystemBackupAutomationSettings = Object.freeze({
    enabled: false,
    scheduleType: "daily",
    weeklyDay: 1,
    time: "03:00",
    retentionCount: 7,
    includeDatabase: true,
    includedAssetKeys: assetDefinitions.map((assetDefinition) => assetDefinition.assetKey),
  });
  let systemBackupAutomationTimer = null;
  let systemBackupAutomationAuditRecorder = null;
  let systemBackupAutomationLastExecutedSlotKey = "";
  let systemBackupAutomationRunChain = Promise.resolve();
  let systemBackupAutomationRuntimeState = {
    isRunning: false,
    lastRunAt: "",
    lastSuccessAt: "",
    lastFailureAt: "",
    lastErrorMessage: "",
    lastFileName: "",
    nextRunAt: "",
  };

  function getDefaultSystemBackupAutomationSettings() {
    return {
      enabled: defaultSystemBackupAutomationSettings.enabled,
      scheduleType: defaultSystemBackupAutomationSettings.scheduleType,
      weeklyDay: defaultSystemBackupAutomationSettings.weeklyDay,
      time: defaultSystemBackupAutomationSettings.time,
      retentionCount: defaultSystemBackupAutomationSettings.retentionCount,
      includeDatabase: defaultSystemBackupAutomationSettings.includeDatabase,
      includedAssetKeys: [...defaultSystemBackupAutomationSettings.includedAssetKeys],
    };
  }

  function normalizeSystemBackupAutomationScheduleType(value = "") {
    const normalizedValue = String(value || "").trim().toLowerCase();
    return normalizedValue === "weekly" ? "weekly" : "daily";
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
      return defaultSystemBackupAutomationSettings.time;
    }

    const hours = Number(matchedValue[1]);
    const minutes = Number(matchedValue[2]);

    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return defaultSystemBackupAutomationSettings.time;
    }

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function normalizeSystemBackupAutomationRetentionCount(value = 7) {
    const normalizedValue = Math.round(Number(value));

    if (!Number.isFinite(normalizedValue) || normalizedValue < 1) {
      return defaultSystemBackupAutomationSettings.retentionCount;
    }

    return Math.min(30, normalizedValue);
  }

  function normalizeSystemBackupAutomationAssetKeys(assetKeys = null) {
    const normalizedAssetKeySet = getNormalizedIncludedAssetKeySet(assetKeys);
    return assetDefinitions
      .map((assetDefinition) => assetDefinition.assetKey)
      .filter((assetKey) => normalizedAssetKeySet.has(assetKey));
  }

  function normalizeSystemBackupAutomationPayload(payload = {}, options = {}) {
    const sourcePayload = payload && typeof payload === "object" ? payload : {};
    const normalizedSettings = {
      enabled: sourcePayload.enabled === true,
      scheduleType: normalizeSystemBackupAutomationScheduleType(sourcePayload.scheduleType),
      weeklyDay: normalizeSystemBackupAutomationWeeklyDay(sourcePayload.weeklyDay),
      time: normalizeSystemBackupAutomationTime(sourcePayload.time),
      retentionCount: normalizeSystemBackupAutomationRetentionCount(sourcePayload.retentionCount),
      includeDatabase: sourcePayload.includeDatabase !== false,
      includedAssetKeys: normalizeSystemBackupAutomationAssetKeys(sourcePayload.includedAssetKeys),
    };
    const selectedItemCount = (normalizedSettings.includeDatabase ? 1 : 0) + normalizedSettings.includedAssetKeys.length;

    if (options.allowEmptySelection !== true && selectedItemCount === 0) {
      throw createBackupError(400, "자동 백업 항목을 하나 이상 선택하세요.", "SYSTEM_AUTO_BACKUP_SELECTION_REQUIRED");
    }

    return normalizedSettings;
  }

  function parseSystemBackupAutomationSettings(value = "") {
    const normalizedValue = String(value || "").trim();

    if (!normalizedValue) {
      return getDefaultSystemBackupAutomationSettings();
    }

    try {
      return normalizeSystemBackupAutomationPayload(JSON.parse(normalizedValue), {
        allowEmptySelection: false,
      });
    } catch (error) {
      return getDefaultSystemBackupAutomationSettings();
    }
  }

  function buildSystemBackupAutomationSlotDate(settings = {}, referenceDate = new Date()) {
    const validReferenceDate = referenceDate instanceof Date && Number.isFinite(referenceDate.getTime()) ? referenceDate : new Date();
    const normalizedSettings = normalizeSystemBackupAutomationPayload(settings, {
      allowEmptySelection: false,
    });
    const [hoursValue, minutesValue] = String(normalizedSettings.time || defaultSystemBackupAutomationSettings.time)
      .split(":")
      .map((value) => Number(value));
    const slotDate = new Date(
      validReferenceDate.getFullYear(),
      validReferenceDate.getMonth(),
      validReferenceDate.getDate(),
      Number.isFinite(hoursValue) ? hoursValue : 0,
      Number.isFinite(minutesValue) ? minutesValue : 0,
      0,
      0,
    );

    if (normalizedSettings.scheduleType === "weekly") {
      const weekdayOffset = normalizedSettings.weeklyDay - slotDate.getDay();
      slotDate.setDate(slotDate.getDate() + weekdayOffset);
    }

    return slotDate;
  }

  function getMostRecentSystemBackupAutomationSlotDate(settings = {}, referenceDate = new Date()) {
    const slotDate = buildSystemBackupAutomationSlotDate(settings, referenceDate);
    const validReferenceDate = referenceDate instanceof Date && Number.isFinite(referenceDate.getTime()) ? referenceDate : new Date();

    if (slotDate.getTime() > validReferenceDate.getTime()) {
      slotDate.setDate(slotDate.getDate() + (normalizeSystemBackupAutomationScheduleType(settings.scheduleType) === "weekly" ? -7 : -1));
    }

    return slotDate;
  }

  function getNextSystemBackupAutomationSlotDate(settings = {}, referenceDate = new Date()) {
    const slotDate = buildSystemBackupAutomationSlotDate(settings, referenceDate);
    const validReferenceDate = referenceDate instanceof Date && Number.isFinite(referenceDate.getTime()) ? referenceDate : new Date();

    if (slotDate.getTime() <= validReferenceDate.getTime()) {
      slotDate.setDate(slotDate.getDate() + (normalizeSystemBackupAutomationScheduleType(settings.scheduleType) === "weekly" ? 7 : 1));
    }

    return slotDate;
  }

  function formatSystemBackupAutomationSlotKey(date = new Date()) {
    return `${formatDateValue(date)} ${padTimestampValue(date.getHours())}:${padTimestampValue(date.getMinutes())}`;
  }

  async function readSystemBackupAutomationSettingValue() {
    const rows = await readRows(
      query,
      `
        SELECT setting_value AS settingValue
        FROM system_set
        WHERE setting_key = ?
      `,
      [systemBackupAutomationSettingKey],
    );

    return String(rows?.[0]?.settingValue || "").trim();
  }

  async function getStoredSystemBackupAutomationSettings() {
    return parseSystemBackupAutomationSettings(await readSystemBackupAutomationSettingValue());
  }

  function buildSystemBackupAutomationState(settings = {}) {
    const normalizedSettings = normalizeSystemBackupAutomationPayload(settings, {
      allowEmptySelection: false,
    });
    const nextRunAt = normalizedSettings.enabled ? formatDateTimeValue(getNextSystemBackupAutomationSlotDate(normalizedSettings, new Date())) : "";

    systemBackupAutomationRuntimeState = {
      ...systemBackupAutomationRuntimeState,
      nextRunAt,
    };

    return {
      ...normalizedSettings,
      lastRunAt: String(systemBackupAutomationRuntimeState.lastRunAt || "").trim(),
      lastSuccessAt: String(systemBackupAutomationRuntimeState.lastSuccessAt || "").trim(),
      lastFailureAt: String(systemBackupAutomationRuntimeState.lastFailureAt || "").trim(),
      lastErrorMessage: String(systemBackupAutomationRuntimeState.lastErrorMessage || "").trim(),
      lastFileName: String(systemBackupAutomationRuntimeState.lastFileName || "").trim(),
      nextRunAt: String(systemBackupAutomationRuntimeState.nextRunAt || "").trim(),
      isRunning: systemBackupAutomationRuntimeState.isRunning === true,
    };
  }

  async function getSystemBackupAutomationSettings() {
    return buildSystemBackupAutomationState(await getStoredSystemBackupAutomationSettings());
  }

  async function updateSystemBackupAutomationSettings(payload = {}) {
    const normalizedSettings = normalizeSystemBackupAutomationPayload(payload, {
      allowEmptySelection: false,
    });

    await query(
      `
        INSERT INTO system_set (setting_key, setting_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE
          setting_value = VALUES(setting_value)
      `,
      [systemBackupAutomationSettingKey, JSON.stringify(normalizedSettings)],
    );

    systemBackupAutomationLastExecutedSlotKey = "";
    return getSystemBackupAutomationSettings();
  }

  async function ensureSystemAutoBackupDirectory() {
    await fs.promises.mkdir(systemAutoBackupDirectoryPath, { recursive: true });
    return systemAutoBackupDirectoryPath;
  }

  async function pruneSystemAutoBackupArchives(retentionCount = 7) {
    const normalizedRetentionCount = normalizeSystemBackupAutomationRetentionCount(retentionCount);
    let fileNames = [];

    try {
      fileNames = await fs.promises.readdir(systemAutoBackupDirectoryPath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        return [];
      }

      throw error;
    }

    const archiveEntries = await Promise.all(
      fileNames
        .filter((fileName) => /\.zip$/i.test(String(fileName || "")))
        .map(async (fileName) => {
          const absolutePath = path.join(systemAutoBackupDirectoryPath, fileName);
          const fileStats = await fs.promises.stat(absolutePath);

          return {
            fileName,
            absolutePath,
            modifiedAtMs: Number(fileStats.mtimeMs || 0),
          };
        }),
    );

    const removableEntries = archiveEntries
      .sort((leftEntry, rightEntry) => rightEntry.modifiedAtMs - leftEntry.modifiedAtMs)
      .slice(normalizedRetentionCount);

    for (const archiveEntry of removableEntries) {
      await fs.promises.rm(archiveEntry.absolutePath, { force: true });
    }

    return archiveEntries;
  }

  async function recordSystemBackupAutomationAuditLog(entry = {}) {
    if (typeof systemBackupAutomationAuditRecorder !== "function") {
      return;
    }

    try {
      const normalizedEntry = entry && typeof entry === "object" ? entry : {};
      await systemBackupAutomationAuditRecorder({
        accountId: normalizedEntry.accountId || "system:auto-backup",
        accountName: normalizedEntry.accountName || "자동 백업",
        accountRole: normalizedEntry.accountRole || "system",
        ipAddress: normalizedEntry.ipAddress || "",
        userAgent: normalizedEntry.userAgent || "server-scheduler",
        ...normalizedEntry,
      });
    } catch (error) {
      console.error(`System auto backup audit log write failed: ${error.message}`);
    }
  }

  async function runSystemBackupAutomation(settings = null, options = {}) {
    const normalizedSettings = normalizeSystemBackupAutomationPayload(
      settings || (await getStoredSystemBackupAutomationSettings()),
      {
        allowEmptySelection: false,
      },
    );
    const startedAt = new Date();

    if (systemBackupAutomationRuntimeState.isRunning) {
      return buildSystemBackupAutomationState(normalizedSettings);
    }

    systemBackupAutomationRuntimeState = {
      ...systemBackupAutomationRuntimeState,
      isRunning: true,
      lastRunAt: formatDateTimeValue(startedAt),
      lastErrorMessage: "",
    };

    try {
      await ensureSystemAutoBackupDirectory();
      const backupArchive = await buildSystemBackupArchive({
        includeDatabase: normalizedSettings.includeDatabase,
        includedAssetKeys: normalizedSettings.includedAssetKeys,
      });
      const targetPath = path.join(systemAutoBackupDirectoryPath, backupArchive.fileName || "system-backup.zip");

      await fs.promises.writeFile(targetPath, backupArchive.archiveBuffer);
      await pruneSystemAutoBackupArchives(normalizedSettings.retentionCount);

      systemBackupAutomationRuntimeState = {
        ...systemBackupAutomationRuntimeState,
        isRunning: false,
        lastSuccessAt: formatDateTimeValue(new Date()),
        lastFailureAt: "",
        lastErrorMessage: "",
        lastFileName: String(backupArchive.fileName || "system-backup.zip"),
        nextRunAt: normalizedSettings.enabled ? formatDateTimeValue(getNextSystemBackupAutomationSlotDate(normalizedSettings, new Date())) : "",
      };

      await recordSystemBackupAutomationAuditLog({
        actionType: "system_backup_auto_run",
        targetScope: "system-backup",
        summaryText: "자동 백업 ZIP을 생성했습니다.",
        accountId: options?.auditEntryContext?.accountId,
        accountName: options?.auditEntryContext?.accountName,
        accountRole: options?.auditEntryContext?.accountRole,
        ipAddress: options?.auditEntryContext?.ipAddress,
        userAgent: options?.auditEntryContext?.userAgent,
        details: {
          trigger: String(options.trigger || "scheduled").trim() || "scheduled",
          fileName: backupArchive.fileName || "system-backup.zip",
          databaseIncluded: normalizedSettings.includeDatabase !== false,
          selectedAssetKeys: normalizedSettings.includedAssetKeys,
          retentionCount: normalizedSettings.retentionCount,
          scheduledFor: options.scheduledFor ? formatDateTimeValue(options.scheduledFor) : "",
        },
      });
    } catch (error) {
      systemBackupAutomationRuntimeState = {
        ...systemBackupAutomationRuntimeState,
        isRunning: false,
        lastFailureAt: formatDateTimeValue(new Date()),
        lastErrorMessage: String(error?.message || "자동 백업에 실패했습니다."),
        nextRunAt: normalizedSettings.enabled ? formatDateTimeValue(getNextSystemBackupAutomationSlotDate(normalizedSettings, new Date())) : "",
      };

      await recordSystemBackupAutomationAuditLog({
        actionType: "system_backup_auto_run_failed",
        targetScope: "system-backup",
        summaryText: "자동 백업 ZIP 생성에 실패했습니다.",
        accountId: options?.auditEntryContext?.accountId,
        accountName: options?.auditEntryContext?.accountName,
        accountRole: options?.auditEntryContext?.accountRole,
        ipAddress: options?.auditEntryContext?.ipAddress,
        userAgent: options?.auditEntryContext?.userAgent,
        details: {
          trigger: String(options.trigger || "scheduled").trim() || "scheduled",
          errorCode: error?.errorCode || "",
          errorMessage: error?.message || "",
          scheduledFor: options.scheduledFor ? formatDateTimeValue(options.scheduledFor) : "",
        },
      });

      if (options.throwOnError === true) {
        throw error;
      }
    }

    return buildSystemBackupAutomationState(normalizedSettings);
  }

  async function tickSystemBackupAutomation(referenceDate = new Date()) {
    const normalizedSettings = await getStoredSystemBackupAutomationSettings();
    const nextRunAt = normalizedSettings.enabled ? formatDateTimeValue(getNextSystemBackupAutomationSlotDate(normalizedSettings, referenceDate)) : "";

    systemBackupAutomationRuntimeState = {
      ...systemBackupAutomationRuntimeState,
      nextRunAt,
    };

    if (!normalizedSettings.enabled || systemBackupAutomationRuntimeState.isRunning) {
      return buildSystemBackupAutomationState(normalizedSettings);
    }

    const mostRecentSlotDate = getMostRecentSystemBackupAutomationSlotDate(normalizedSettings, referenceDate);
    const slotKey = formatSystemBackupAutomationSlotKey(mostRecentSlotDate);

    if (!slotKey || slotKey === systemBackupAutomationLastExecutedSlotKey || mostRecentSlotDate.getTime() > referenceDate.getTime()) {
      return buildSystemBackupAutomationState(normalizedSettings);
    }

    systemBackupAutomationLastExecutedSlotKey = slotKey;
    systemBackupAutomationRunChain = systemBackupAutomationRunChain
      .then(() =>
        runSystemBackupAutomation(normalizedSettings, {
          trigger: "scheduled",
          scheduledFor: mostRecentSlotDate,
        }),
      )
      .catch(() => null);

    return buildSystemBackupAutomationState(normalizedSettings);
  }

  async function startSystemBackupAutomation(options = {}) {
    if (typeof options.recordSystemAuditLog === "function") {
      systemBackupAutomationAuditRecorder = options.recordSystemAuditLog;
    }

    if (systemBackupAutomationTimer) {
      clearInterval(systemBackupAutomationTimer);
    }

    await tickSystemBackupAutomation(new Date());
    systemBackupAutomationTimer = setInterval(() => {
      void tickSystemBackupAutomation(new Date());
    }, 60 * 1000);

    if (typeof systemBackupAutomationTimer?.unref === "function") {
      systemBackupAutomationTimer.unref();
    }

    return true;
  }

  function toSqlIdentifier(value = "") {
    return `\`${String(value || "").replaceAll("`", "``")}\``;
  }

  function buildOrderByClause(orderByColumns = []) {
    const normalizedColumns = (Array.isArray(orderByColumns) ? orderByColumns : [])
      .map((columnName) => String(columnName || "").trim())
      .filter(Boolean);

    if (normalizedColumns.length === 0) {
      return "";
    }

    return ` ORDER BY ${normalizedColumns.map((columnName) => toSqlIdentifier(columnName)).join(", ")}`;
  }

  function padTimestampValue(value) {
    return String(value || "").padStart(2, "0");
  }

  function formatDateValue(date) {
    const validDate = date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date(date);

    if (!Number.isFinite(validDate.getTime())) {
      return "";
    }

    return [
      validDate.getFullYear(),
      padTimestampValue(validDate.getMonth() + 1),
      padTimestampValue(validDate.getDate()),
    ].join("-");
  }

  function formatDateTimeValue(date) {
    const validDate = date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date(date);

    if (!Number.isFinite(validDate.getTime())) {
      return "";
    }

    return [
      formatDateValue(validDate),
      `${padTimestampValue(validDate.getHours())}:${padTimestampValue(validDate.getMinutes())}:${padTimestampValue(validDate.getSeconds())}`,
    ].join(" ");
  }

  function buildBackupTimestamp(date = new Date()) {
    const validDate = date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date();
    return [
      validDate.getFullYear(),
      padTimestampValue(validDate.getMonth() + 1),
      padTimestampValue(validDate.getDate()),
      "-",
      padTimestampValue(validDate.getHours()),
      padTimestampValue(validDate.getMinutes()),
      padTimestampValue(validDate.getSeconds()),
    ].join("");
  }

  function normalizeArchiveEntryPath(value = "") {
    return String(value || "")
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/{2,}/g, "/");
  }

  function getNormalizedIncludedAssetKeySet(includedAssetKeys = null) {
    const requestedAssetKeys = Array.isArray(includedAssetKeys) ? includedAssetKeys : assetDefinitions.map((assetDefinition) => assetDefinition.assetKey);
    const normalizedKeys = requestedAssetKeys
      .map((assetKey) => String(assetKey || "").trim())
      .filter((assetKey) => assetDefinitionMap.has(assetKey));

    return new Set(normalizedKeys);
  }

  function getNormalizedRestorableAssetKeySet(assetKeys = null) {
    const requestedAssetKeys = Array.isArray(assetKeys) ? assetKeys : [...restorableAssetKeySet];
    const normalizedKeys = requestedAssetKeys
      .map((assetKey) => String(assetKey || "").trim())
      .filter((assetKey) => restorableAssetKeySet.has(assetKey));

    return new Set(normalizedKeys);
  }

  function getNormalizedRestoreSelectionState(selectedRestoreItemKeys = null) {
    if (!Array.isArray(selectedRestoreItemKeys)) {
      return {
        hasExplicitSelection: false,
        restoreDatabase: true,
        includedAssetKeySet: getNormalizedRestorableAssetKeySet(),
      };
    }

    const normalizedItemKeys = selectedRestoreItemKeys
      .map((itemKey) => String(itemKey || "").trim())
      .filter(Boolean);
    const includesDatabase =
      normalizedItemKeys.includes(databaseSelectionItemKey) || normalizedItemKeys.includes(legacyTableRestoreItemKey);

    return {
      hasExplicitSelection: true,
      restoreDatabase: includesDatabase,
      includedAssetKeySet: getNormalizedRestorableAssetKeySet(normalizedItemKeys),
    };
  }

  function createBackupError(statusCode, message, errorCode) {
    if (typeof createHttpError === "function") {
      return createHttpError(statusCode, message, errorCode);
    }

    const error = new Error(message);
    error.statusCode = statusCode;
    error.errorCode = errorCode;
    return error;
  }

  async function readRows(queryable, sql, params = []) {
    const queryResult = await queryable(sql, params);

    if (Array.isArray(queryResult) && queryResult.length === 2 && Array.isArray(queryResult[0]) && Array.isArray(queryResult[1])) {
      return queryResult[0];
    }

    return Array.isArray(queryResult) ? queryResult : [];
  }

  async function getTableColumnDefinitions(queryable, tableName = "") {
    const normalizedTableName = String(tableName || "").trim();

    if (!normalizedTableName) {
      return [];
    }

    return readRows(
      queryable,
      `
        SELECT
          COLUMN_NAME AS columnName,
          DATA_TYPE AS dataType
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `,
      [String(databaseName || "applyhub").trim() || "applyhub", normalizedTableName],
    );
  }

  function normalizeBackupValue(value, columnDefinition = {}) {
    if (value === null || value === undefined) {
      return null;
    }

    const dataType = String(columnDefinition.dataType || "").trim().toLowerCase();

    if (value instanceof Date) {
      if (dataType === "date") {
        return formatDateValue(value);
      }

      if (["datetime", "timestamp"].includes(dataType)) {
        return formatDateTimeValue(value);
      }
    }

    if (typeof value === "bigint") {
      return value.toString();
    }

    if (typeof value === "string") {
      if (dataType === "date") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return value;
        }

        const parsedDate = new Date(value);
        const formattedDate = formatDateValue(parsedDate);
        return formattedDate || value;
      }

      if (["datetime", "timestamp"].includes(dataType)) {
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
          return value;
        }

        const parsedDateTime = new Date(value);
        const formattedDateTime = formatDateTimeValue(parsedDateTime);
        return formattedDateTime || value;
      }
    }

    return value;
  }

  function normalizeBackupRow(row = {}, columnDefinitions = []) {
    const normalizedRow = {};
    const columnDefinitionMap = new Map(
      (Array.isArray(columnDefinitions) ? columnDefinitions : []).map((columnDefinition) => [
        String(columnDefinition.columnName || "").trim(),
        columnDefinition,
      ]),
    );

    Object.keys(row || {}).forEach((columnName) => {
      normalizedRow[columnName] = normalizeBackupValue(row[columnName], columnDefinitionMap.get(columnName) || {});
    });

    return normalizedRow;
  }

  async function getTableBackupPayload(tableDefinition = {}) {
    const tableName = String(tableDefinition.tableName || "").trim();

    if (!tableName) {
      return {
        tableName: "",
        rows: [],
      };
    }

    const [rows, columnDefinitions] = await Promise.all([
      query(`SELECT * FROM ${toSqlIdentifier(tableName)}${buildOrderByClause(tableDefinition.orderByColumns)}`),
      getTableColumnDefinitions(query, tableName),
    ]);

    return {
      tableName,
      rows: (Array.isArray(rows) ? rows : []).map((row) => normalizeBackupRow(row, columnDefinitions)),
    };
  }

  async function collectDirectoryFileEntries(directoryPath = "", archivePrefix = "") {
    const normalizedPrefix = normalizeArchiveEntryPath(archivePrefix);

    async function walk(currentDirectoryPath, currentRelativePath = "") {
      let directoryEntries = [];

      try {
        directoryEntries = await fs.promises.readdir(currentDirectoryPath, { withFileTypes: true });
      } catch (error) {
        if (error?.code === "ENOENT") {
          return [];
        }

        throw error;
      }

      const sortedEntries = directoryEntries
        .slice()
        .sort((leftEntry, rightEntry) => String(leftEntry.name || "").localeCompare(String(rightEntry.name || "")));
      const fileEntries = [];

      for (const directoryEntry of sortedEntries) {
        const absolutePath = path.join(currentDirectoryPath, directoryEntry.name);
        const nextRelativePath = currentRelativePath
          ? path.join(currentRelativePath, directoryEntry.name)
          : directoryEntry.name;

        if (directoryEntry.isDirectory()) {
          fileEntries.push(...(await walk(absolutePath, nextRelativePath)));
          continue;
        }

        if (!directoryEntry.isFile()) {
          continue;
        }

        const stats = await fs.promises.stat(absolutePath);
        fileEntries.push({
          archivePath: normalizeArchiveEntryPath(path.posix.join(normalizedPrefix, nextRelativePath.replace(/\\/g, "/"))),
          size: Number(stats.size || 0),
          absolutePath,
        });
      }

      return fileEntries;
    }

    return walk(directoryPath);
  }

  async function buildSystemBackupArchive(options = {}) {
    const createdAt = new Date();
    const createdAtIso = createdAt.toISOString();
    const zipArchive = new AdmZip();
    const includeDatabase = options?.includeDatabase !== false;
    const includedAssetKeySet = getNormalizedIncludedAssetKeySet(options.includedAssetKeys);

    if (!includeDatabase && includedAssetKeySet.size === 0) {
      throw createBackupError(400, "백업할 항목을 하나 이상 선택하세요.", "SYSTEM_BACKUP_SELECTION_REQUIRED");
    }

    const manifest = {
      schemaVersion: backupSchemaVersion,
      createdAt: createdAtIso,
      databaseName: String(databaseName || "applyhub").trim() || "applyhub",
      databaseIncluded: includeDatabase,
      tables: [],
      assets: [],
    };

    if (includeDatabase) {
      for (const tableDefinition of tableDefinitions) {
        const tablePayload = await getTableBackupPayload(tableDefinition);
        manifest.tables.push({
          tableName: tablePayload.tableName,
          rowCount: tablePayload.rows.length,
          archivePath: `tables/${tablePayload.tableName}.json`,
        });

        zipArchive.addFile(
          `tables/${tablePayload.tableName}.json`,
          Buffer.from(JSON.stringify(tablePayload.rows, null, 2), "utf8"),
        );
      }
    }

    for (const assetDefinition of assetDefinitions) {
      const isIncluded = includedAssetKeySet.has(assetDefinition.assetKey);
      const fileEntries = isIncluded
        ? await collectDirectoryFileEntries(assetDefinition.directoryPath, assetDefinition.archivePrefix)
        : [];
      let assetSize = 0;

      if (isIncluded) {
        for (const fileEntry of fileEntries) {
          zipArchive.addLocalFile(fileEntry.absolutePath, path.posix.dirname(fileEntry.archivePath), path.posix.basename(fileEntry.archivePath));
          assetSize += fileEntry.size;
        }
      }

      manifest.assets.push({
        assetKey: assetDefinition.assetKey,
        archivePrefix: assetDefinition.archivePrefix,
        included: isIncluded,
        fileCount: fileEntries.length,
        totalBytes: assetSize,
      });
    }

    zipArchive.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf8"));
    zipArchive.addFile(
      "README.txt",
      Buffer.from(
        [
          "AdmitCard system backup archive",
          `Created at: ${createdAtIso}`,
          `Database: ${manifest.databaseName}`,
          `Database included: ${includeDatabase ? "yes" : "no"}`,
          "",
          "Contents:",
          "- manifest.json: backup summary metadata",
          "- tables/*.json: database snapshots in restore order when included",
          "- files/*: uploaded assets and stored photos when included",
        ].join("\n"),
        "utf8",
      ),
    );

    const safeDatabaseName = String(manifest.databaseName || "applyhub")
      .trim()
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "applyhub";

    return {
      archiveBuffer: zipArchive.toBuffer(),
      fileName: `${safeDatabaseName}-backup-${buildBackupTimestamp(createdAt)}.zip`,
      manifest,
    };
  }

  function parseArchiveJson(zipArchive, entryPath, errorMessage, errorCode) {
    const archiveEntry = zipArchive.getEntry(entryPath);

    if (!archiveEntry) {
      throw createBackupError(400, errorMessage, errorCode);
    }

    try {
      return JSON.parse(zipArchive.readAsText(archiveEntry, "utf8"));
    } catch (error) {
      throw createBackupError(400, errorMessage, errorCode);
    }
  }

  function getNormalizedManifestAssetEntries(manifest = {}) {
    const manifestAssets = Array.isArray(manifest.assets) ? manifest.assets : [];

    return assetDefinitions.map((assetDefinition) => {
      const matchingEntry = manifestAssets.find((assetEntry) => String(assetEntry?.assetKey || "").trim() === assetDefinition.assetKey) || null;

      return {
        assetKey: assetDefinition.assetKey,
        archivePrefix: assetDefinition.archivePrefix,
        included: matchingEntry ? matchingEntry.included !== false : true,
        fileCount: Number(matchingEntry?.fileCount || 0),
        totalBytes: Number(matchingEntry?.totalBytes || 0),
      };
    });
  }

  function validateArchiveAssetEntries(zipArchive, manifestAssetEntries = []) {
    const validationRoot = path.join(rootDir, ".tmp-system-backup-validate");

    zipArchive.getEntries().forEach((zipEntry) => {
      const entryPath = normalizeArchiveEntryPath(zipEntry.entryName);

      if (!entryPath || zipEntry.isDirectory || !entryPath.startsWith("files/")) {
        return;
      }

      const matchingAsset = manifestAssetEntries.find((assetEntry) => entryPath.startsWith(`${normalizeArchiveEntryPath(assetEntry.archivePrefix)}/`));

      if (!matchingAsset) {
        return;
      }

      const relativeEntryPath = entryPath.slice(`${normalizeArchiveEntryPath(matchingAsset.archivePrefix)}/`.length);

      if (relativeEntryPath) {
        resolveChildPath(validationRoot, relativeEntryPath);
      }
    });
  }

  async function getCurrentDatabaseTableStates() {
    return Promise.all(
      tableDefinitions.map(async (tableDefinition) => {
        const rows = await readRows(
          query,
          `SELECT COUNT(*) AS rowCount FROM ${toSqlIdentifier(tableDefinition.tableName)}`,
        );

        return {
          tableName: tableDefinition.tableName,
          rowCount: Number(rows?.[0]?.rowCount || 0),
        };
      }),
    );
  }

  async function getCurrentAssetStates() {
    return Promise.all(
      assetDefinitions.map(async (assetDefinition) => {
        const fileEntries = await collectDirectoryFileEntries(assetDefinition.directoryPath, assetDefinition.archivePrefix);

        return {
          assetKey: assetDefinition.assetKey,
          fileCount: fileEntries.length,
          totalBytes: fileEntries.reduce((totalBytes, fileEntry) => totalBytes + Number(fileEntry.size || 0), 0),
        };
      }),
    );
  }

  async function buildCurrentSystemBackupState() {
    const [tables, assets] = await Promise.all([
      getCurrentDatabaseTableStates(),
      getCurrentAssetStates(),
    ]);

    return {
      databaseName: String(databaseName || "applyhub").trim() || "applyhub",
      tableCount: tables.length,
      totalRowCount: tables.reduce((count, tableState) => count + Number(tableState?.rowCount || 0), 0),
      tables,
      assets,
    };
  }

  function buildSystemBackupValidationComparison(manifest = {}, tablePayloads = [], currentState = {}) {
    const databaseIncluded = manifest?.databaseIncluded !== false;
    const backupTableCount = databaseIncluded ? tablePayloads.length : 0;
    const backupRowCount = databaseIncluded
      ? tablePayloads.reduce((count, tablePayload) => count + (Array.isArray(tablePayload.rows) ? tablePayload.rows.length : 0), 0)
      : 0;
    const currentTableCount = Number(currentState?.tableCount || 0);
    const currentRowCount = Number(currentState?.totalRowCount || 0);
    const currentAssets = Array.isArray(currentState?.assets) ? currentState.assets : [];
    const currentAssetMap = new Map(
      currentAssets.map((assetEntry) => [String(assetEntry?.assetKey || "").trim(), assetEntry]),
    );

    return {
      database: {
        included: databaseIncluded,
        currentTableCount,
        backupTableCount,
        tableDelta: backupTableCount - currentTableCount,
        currentRowCount,
        backupRowCount,
        rowDelta: backupRowCount - currentRowCount,
      },
      assets: getNormalizedManifestAssetEntries(manifest).map((assetEntry) => {
        const currentAssetEntry = currentAssetMap.get(assetEntry.assetKey) || null;
        const currentFileCount = Number(currentAssetEntry?.fileCount || 0);
        const currentTotalBytes = Number(currentAssetEntry?.totalBytes || 0);
        const backupFileCount = assetEntry.included !== false ? Number(assetEntry.fileCount || 0) : 0;
        const backupTotalBytes = assetEntry.included !== false ? Number(assetEntry.totalBytes || 0) : 0;

        return {
          assetKey: assetEntry.assetKey,
          included: assetEntry.included !== false,
          currentFileCount,
          backupFileCount,
          fileDelta: backupFileCount - currentFileCount,
          currentTotalBytes,
          backupTotalBytes,
          totalBytesDelta: backupTotalBytes - currentTotalBytes,
        };
      }),
    };
  }

  async function buildSystemBackupValidationSummary(manifest = {}, tablePayloads = [], options = {}) {
    const normalizedManifestAssetEntries = getNormalizedManifestAssetEntries(manifest);
    const currentState =
      options?.currentState && typeof options.currentState === "object"
        ? options.currentState
        : await buildCurrentSystemBackupState();

    return {
      schemaVersion: String(manifest.schemaVersion || "").trim(),
      createdAt: String(manifest.createdAt || "").trim(),
      databaseName: String(manifest.databaseName || "").trim(),
      databaseIncluded: manifest?.databaseIncluded !== false,
      tableCount: tablePayloads.length,
      memberCount: tablePayloads.find(table => table.tableName === 'applicant_members')?.rows.length || 0,
      currentMemberCount: Number(currentState.tables?.find(table => table.tableName === 'applicant_members')?.rowCount || 0),
      totalRowCount: tablePayloads.reduce((count, tablePayload) => count + (Array.isArray(tablePayload.rows) ? tablePayload.rows.length : 0), 0),
      assets: normalizedManifestAssetEntries,
      currentState,
      comparison: buildSystemBackupValidationComparison(manifest, tablePayloads, currentState),
    };
  }

  function parseSystemBackupArchive(archiveBuffer) {
    if (!Buffer.isBuffer(archiveBuffer) || archiveBuffer.length === 0) {
      throw createBackupError(400, "복원할 백업 ZIP 파일이 비어 있습니다.", "SYSTEM_BACKUP_ARCHIVE_EMPTY");
    }

    let zipArchive = null;

    try {
      zipArchive = new AdmZip(archiveBuffer);
    } catch (error) {
      throw createBackupError(400, "백업 ZIP 파일을 읽을 수 없습니다.", "SYSTEM_BACKUP_ARCHIVE_INVALID");
    }

    const manifest = parseArchiveJson(
      zipArchive,
      "manifest.json",
      "백업 ZIP의 manifest.json 형식이 올바르지 않습니다.",
      "SYSTEM_BACKUP_MANIFEST_INVALID",
    );

    if (String(manifest?.schemaVersion || "").trim() !== backupSchemaVersion) {
      throw createBackupError(400, "지원하지 않는 백업 파일 버전입니다.", "SYSTEM_BACKUP_SCHEMA_UNSUPPORTED");
    }
    const databaseIncluded = manifest?.databaseIncluded !== false;
    const tablePayloads = databaseIncluded
      ? tableDefinitions.map((tableDefinition) => {
          const tableName = String(tableDefinition.tableName || "").trim();
          // Backups created before document status management have no status table.
          const legacyDocumentStatuses = tableName === 'app_document_status'
            && !zipArchive.getEntry('tables/app_document_status.json')
            && !manifest.tables?.some(table => table.tableName === 'app_document_status');
          const legacyFormTemplates = tableName === 'app_form_template'
            && !zipArchive.getEntry('tables/app_form_template.json')
            && !manifest.tables?.some(table => table.tableName === 'app_form_template');
          const tableRows = legacyFormTemplates ? [
            { id: 1, form_scope: 'application', name: '기본 원서접수', is_default: 1 },
            { id: 2, form_scope: 'documents', name: '기본 서류제출', is_default: 1 },
          ] : legacyDocumentStatuses ? [] : parseArchiveJson(
            zipArchive,
            `tables/${tableName}.json`,
            `${tableName} 데이터베이스 백업 데이터 형식이 올바르지 않습니다.`,
            "SYSTEM_BACKUP_TABLE_INVALID",
          );

          if (!Array.isArray(tableRows)) {
            throw createBackupError(400, `${tableName} 데이터베이스 백업 데이터 형식이 올바르지 않습니다.`, "SYSTEM_BACKUP_TABLE_INVALID");
          }

          return {
            tableName,
            rows: tableRows.map(row => normalizeLegacyBackupRow(tableName, row)),
          };
        })
      : [];

    const manifestAssetEntries = getNormalizedManifestAssetEntries(manifest);

    validateArchiveAssetEntries(zipArchive, manifestAssetEntries);

    return {
      manifest,
      manifestAssetEntries,
      tablePayloads,
      zipArchive,
    };
  }

  function normalizeRestoreValue(value, columnDefinition = {}) {
    if (value === undefined) {
      return null;
    }

    if (value === null) {
      return null;
    }

    const dataType = String(columnDefinition.dataType || "").trim().toLowerCase();
    const normalizedValue = typeof value === "string" ? value.trim() : value;

    if (typeof normalizedValue === "string" && !normalizedValue) {
      return normalizedValue;
    }

    if (dataType === "date" && typeof normalizedValue === "string") {
      const parsedDate = new Date(normalizedValue);
      const formattedDate = formatDateValue(parsedDate);

      if (formattedDate) {
        return formattedDate;
      }

      const matchedDate = normalizedValue.match(/^(\d{4}-\d{2}-\d{2})/);
      return matchedDate ? matchedDate[1] : normalizedValue;
    }

    if (["datetime", "timestamp"].includes(dataType) && typeof normalizedValue === "string") {
      const parsedDateTime = new Date(normalizedValue);
      const formattedDateTime = formatDateTimeValue(parsedDateTime);

      if (formattedDateTime) {
        return formattedDateTime;
      }

      const matchedDateTime = normalizedValue.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
      return matchedDateTime ? `${matchedDateTime[1]} ${matchedDateTime[2]}` : normalizedValue;
    }

    return normalizedValue;
  }

  async function pathExists(targetPath = "") {
    try {
      await fs.promises.access(targetPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  function resolveChildPath(basePath = "", relativePath = "") {
    const normalizedRelativePath = normalizeArchiveEntryPath(relativePath);
    const resolvedPath = path.resolve(basePath, ...normalizedRelativePath.split("/"));
    const normalizedBasePath = path.resolve(basePath);
    const relativeToBase = path.relative(normalizedBasePath, resolvedPath);

    if (relativeToBase.startsWith("..") || path.isAbsolute(relativeToBase)) {
      throw createBackupError(400, "백업 ZIP 안에 허용되지 않는 파일 경로가 포함되어 있습니다.", "SYSTEM_BACKUP_ENTRY_PATH_INVALID");
    }

    return resolvedPath;
  }

  async function extractAssetsToStage(zipArchive, manifestAssetEntries = [], tempRoot = "") {
    const zipEntries = zipArchive.getEntries();
    const stagedAssets = [];

    for (const manifestAssetEntry of manifestAssetEntries) {
      if (manifestAssetEntry.included === false) {
        continue;
      }

      const assetDefinition = assetDefinitionMap.get(manifestAssetEntry.assetKey) || manifestAssetEntry;
      const archivePrefix = `${normalizeArchiveEntryPath(assetDefinition.archivePrefix)}/`;
      const stageDirectoryPath = path.join(tempRoot, "assets", assetDefinition.assetKey);
      let restoredFileCount = 0;

      await fs.promises.mkdir(stageDirectoryPath, { recursive: true });

      for (const zipEntry of zipEntries) {
        const entryPath = normalizeArchiveEntryPath(zipEntry.entryName);

        if (zipEntry.isDirectory || !entryPath.startsWith(archivePrefix)) {
          continue;
        }

        const relativeEntryPath = entryPath.slice(archivePrefix.length);

        if (!relativeEntryPath) {
          continue;
        }

        const targetPath = resolveChildPath(stageDirectoryPath, relativeEntryPath);

        await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.promises.writeFile(targetPath, zipEntry.getData());
        restoredFileCount += 1;
      }

      stagedAssets.push({
        ...assetDefinition,
        included: true,
        stageDirectoryPath,
        restoredFileCount,
      });
    }

    return stagedAssets;
  }

  async function restoreTables(connection, tablePayloads = []) {
    let restoredRowCount = 0;

    await connection.query(`SET FOREIGN_KEY_CHECKS = 0`);

    try {
      for (const tableDefinition of [...tableDefinitions].reverse()) {
        await connection.query(`DELETE FROM ${toSqlIdentifier(tableDefinition.tableName)}`);
      }

      for (const tablePayload of tablePayloads) {
        const tableName = String(tablePayload.tableName || "").trim();
        const columnDefinitions = await getTableColumnDefinitions(connection.query.bind(connection), tableName);
        const knownColumns = new Set(columnDefinitions.map((columnDefinition) => String(columnDefinition.columnName || "").trim()));

        for (const row of tablePayload.rows) {
          const rowObject = row && typeof row === "object" && !Array.isArray(row) ? row : null;

          if (!rowObject) {
            throw createBackupError(400, `${tableName} 테이블 백업 데이터 형식이 올바르지 않습니다.`, "SYSTEM_BACKUP_TABLE_INVALID");
          }

          const rowColumns = Object.keys(rowObject);
          const unknownColumns = rowColumns.filter((columnName) => !knownColumns.has(columnName));

          if (unknownColumns.length > 0) {
            throw createBackupError(
              400,
              `${tableName} 테이블 백업 데이터에 알 수 없는 컬럼이 포함되어 있습니다: ${unknownColumns.join(", ")}`,
              "SYSTEM_BACKUP_COLUMN_UNKNOWN",
            );
          }

          if (rowColumns.length === 0) {
            continue;
          }

          const insertColumns = columnDefinitions.filter((columnDefinition) =>
            Object.prototype.hasOwnProperty.call(rowObject, columnDefinition.columnName),
          );
          const insertSql = `
            INSERT INTO ${toSqlIdentifier(tableName)} (${insertColumns.map((columnDefinition) => toSqlIdentifier(columnDefinition.columnName)).join(", ")})
            VALUES (${insertColumns.map(() => "?").join(", ")})
          `;
          const insertValues = insertColumns.map((columnDefinition) =>
            normalizeRestoreValue(rowObject[columnDefinition.columnName], columnDefinition),
          );

          await connection.query(insertSql, insertValues);
          restoredRowCount += 1;
        }
      }
    } finally {
      await connection.query(`SET FOREIGN_KEY_CHECKS = 1`);
    }

    return {
      restoredRowCount,
    };
  }

  async function resetAutoIncrementCounters(tablePayloads = []) {
    for (const tablePayload of tablePayloads) {
      const tableName = String(tablePayload.tableName || "").trim();

      if (!autoIncrementTableNames.has(tableName)) {
        continue;
      }

      const nextAutoIncrementValue = (Array.isArray(tablePayload.rows) ? tablePayload.rows : []).reduce((maxValue, row) => {
        const numericId = Number(row?.id);

        if (!Number.isFinite(numericId)) {
          return maxValue;
        }

        return Math.max(maxValue, Math.floor(numericId) + 1);
      }, 1);

      await query(`ALTER TABLE ${toSqlIdentifier(tableName)} AUTO_INCREMENT = ${nextAutoIncrementValue}`);
    }
  }

  async function rollbackSwappedAssets(swapRecords = []) {
    for (const swapRecord of [...swapRecords].reverse()) {
      if (await pathExists(swapRecord.liveDirectoryPath)) {
        await fs.promises.rm(swapRecord.liveDirectoryPath, { recursive: true, force: true });
      }

      if (swapRecord.hadOriginalDirectory && (await pathExists(swapRecord.rollbackDirectoryPath))) {
        await fs.promises.mkdir(path.dirname(swapRecord.liveDirectoryPath), { recursive: true });
        await fs.promises.rename(swapRecord.rollbackDirectoryPath, swapRecord.liveDirectoryPath);
      }
    }
  }

  async function swapAssets(stagedAssets = [], tempRoot = "") {
    const rollbackRoot = path.join(tempRoot, "rollback");
    const swapRecords = [];

    for (const stagedAsset of stagedAssets) {
      const rollbackDirectoryPath = path.join(rollbackRoot, stagedAsset.assetKey);
      const hadOriginalDirectory = await pathExists(stagedAsset.directoryPath);

      try {
        await fs.promises.mkdir(path.dirname(stagedAsset.directoryPath), { recursive: true });

        if (hadOriginalDirectory) {
          await fs.promises.mkdir(path.dirname(rollbackDirectoryPath), { recursive: true });
          await fs.promises.rm(rollbackDirectoryPath, { recursive: true, force: true });
          await fs.promises.rename(stagedAsset.directoryPath, rollbackDirectoryPath);
        }

        await fs.promises.rename(stagedAsset.stageDirectoryPath, stagedAsset.directoryPath);
        swapRecords.push({
          liveDirectoryPath: stagedAsset.directoryPath,
          rollbackDirectoryPath,
          hadOriginalDirectory,
        });
      } catch (error) {
        if (await pathExists(stagedAsset.directoryPath)) {
          await fs.promises.rm(stagedAsset.directoryPath, { recursive: true, force: true });
        }

        if (hadOriginalDirectory && (await pathExists(rollbackDirectoryPath))) {
          await fs.promises.mkdir(path.dirname(stagedAsset.directoryPath), { recursive: true });
          await fs.promises.rename(rollbackDirectoryPath, stagedAsset.directoryPath);
        }

        await rollbackSwappedAssets(swapRecords);
        throw error;
      }
    }

    return swapRecords;
  }

  async function validateSystemBackupArchive(archiveBuffer) {
    const { manifest, manifestAssetEntries, tablePayloads, zipArchive } = parseSystemBackupArchive(archiveBuffer);

    validateArchiveAssetEntries(zipArchive, manifestAssetEntries);

    return buildSystemBackupValidationSummary(manifest, tablePayloads);
  }

  async function restoreSystemBackupArchive(archiveBuffer, options = {}) {
    const { manifest, manifestAssetEntries, tablePayloads, zipArchive } = parseSystemBackupArchive(archiveBuffer);
    const restoreSelectionState = getNormalizedRestoreSelectionState(options?.selectedRestoreItemKeys);
    const selectedManifestAssetEntries = manifestAssetEntries.filter(
      (manifestAssetEntry) => manifestAssetEntry.included !== false && restoreSelectionState.includedAssetKeySet.has(manifestAssetEntry.assetKey),
    );
    const shouldRestoreDatabase = restoreSelectionState.restoreDatabase === true && manifest?.databaseIncluded !== false;

    if (restoreSelectionState.hasExplicitSelection && !shouldRestoreDatabase && selectedManifestAssetEntries.length === 0) {
      throw createBackupError(400, "복원할 항목을 하나 이상 선택하세요.", "SYSTEM_BACKUP_RESTORE_SELECTION_REQUIRED");
    }

    const tempRoot = await fs.promises.mkdtemp(path.join(rootDir, ".tmp-system-backup-restore-"));
    const stagedAssets = await extractAssetsToStage(zipArchive, selectedManifestAssetEntries, tempRoot);
    const restoredFileCount = stagedAssets.reduce(
      (count, stagedAsset) => count + Number(stagedAsset.restoredFileCount || 0),
      0,
    );
    let restoredRowCount = 0;
    let connection = null;
    let didCommit = false;
    let swapRecords = [];

    try {
      if (!shouldRestoreDatabase) {
        await swapAssets(stagedAssets, tempRoot);

        return {
          schemaVersion: String(manifest.schemaVersion || "").trim(),
          createdAt: String(manifest.createdAt || "").trim(),
          restoredDatabase: false,
          restoredTableCount: 0,
          restoredRowCount: 0,
          restoredFileCount,
          restoredAssetKeys: selectedManifestAssetEntries.map((assetEntry) => assetEntry.assetKey),
          assets: manifestAssetEntries,
        };
      }

      if (!getPool) {
        throw createBackupError(500, "백업 복원 연결을 초기화할 수 없습니다.", "SYSTEM_BACKUP_RESTORE_NOT_READY");
      }

      connection = await getPool().getConnection();
      await connection.beginTransaction();

      ({ restoredRowCount } = await restoreTables(connection, tablePayloads));
      await connection.query("DELETE FROM applicant_member_sessions");
      await connection.query("DELETE FROM applicant_member_verifications");
      await connection.query("DELETE FROM applicant_member_recovery");

      swapRecords = await swapAssets(stagedAssets, tempRoot);
      await connection.commit();
      didCommit = true;

      try {
        await resetAutoIncrementCounters(tablePayloads);
      } catch (error) {
        // Explicit id inserts keep the restore usable even if AUTO_INCREMENT reset fails.
      }

      return {
        schemaVersion: String(manifest.schemaVersion || "").trim(),
        createdAt: String(manifest.createdAt || "").trim(),
        restoredDatabase: true,
        restoredTableCount: tablePayloads.length,
        restoredMembers: tablePayloads.find(table => table.tableName === 'applicant_members')?.rows.length || 0,
        restoredRowCount,
        restoredFileCount,
        restoredAssetKeys: selectedManifestAssetEntries.map((assetEntry) => assetEntry.assetKey),
        assets: manifestAssetEntries,
      };
    } catch (error) {
      if (!didCommit) {
        if (connection) {
          try {
            await connection.rollback();
          } catch (rollbackError) {
            // Ignore rollback errors and surface the original restore failure.
          }
        }

        if (swapRecords.length > 0) {
          await rollbackSwappedAssets(swapRecords);
        }
      }

      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
      await fs.promises.rm(tempRoot, { recursive: true, force: true });
    }
  }

  return Object.freeze({
    buildSystemBackupArchive,
    getSystemBackupAutomationSettings,
    runSystemBackupAutomation,
    startSystemBackupAutomation,
    updateSystemBackupAutomationSettings,
    validateSystemBackupArchive,
    restoreSystemBackupArchive,
  });
}

module.exports = {
  createSystemBackupService,
};
