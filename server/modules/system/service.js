const { createSystemAccountBootstrapService } = require("./service/account-bootstrap");
const { createSystemAuditLogService } = require("./service/audit-log");
const { createSystemBackupService } = require("./service/backup");
const { createSystemDataCleanupService } = require("./service/data-cleanup");
const { createSystemLoginNoticeService } = require("./service/login-notice");
const { createSystemSettingsService } = require("./service/settings");
const { createSystemSummaryService } = require("./service/summary");

function createSystemService({
  emailSettingsService,
  applicantFileStorageDirName,
  applicantPhotoStorageDirName,
  buildRoleMenuVisibilityFromSuperAdminSettings,
  createHttpError,
  databaseName,
  defaultAutoLogoutMinutes,
  defaultInitialPassword,
  defaultSeedAccounts,
  examineePhotoStorageDirName,
  fs,
  getDefaultApplicantNoticeHtml,
  formatDateAsYmd,
  getAccounts,

  getApplicantFormFields,
  getApplicantRecruitmentUnits,
  getApplicantSchedules,
  getApplicantSettings,
  getApplicantSubmissions,
  getDefaultLoginNoticeHtml,
  getExaminees,
  getPool,
  getPrintHistory,
  getTemplates,
  hashPassword,
  isPasswordHash,
  maxAutoLogoutMinutes,
  normalizeSuperAdminSettings,
  path,
  query,
  rootDir,
}) {
  const systemSettingsService = createSystemSettingsService({
    buildRoleMenuVisibilityFromSuperAdminSettings,
    createHttpError,
    defaultAutoLogoutMinutes,
    defaultInitialPassword,
    fs,
    maxAutoLogoutMinutes,
    normalizeSuperAdminSettings,
    path,
    query,
    rootDir,
  });
  const {
    getPublicSuperAdminSettings,
    getRoleMenuVisibilitySettings,
    getSuperAdminSettings,
    getSystemSettings,
    parseSystemInitialPassword,
    uploadSuperAdminImage,
    updateSuperAdminSettings,
    updateSystemSettings,
  } = systemSettingsService;

  const auditLogService = createSystemAuditLogService({
    query,
  });
  const { getSystemAuditLogs, recordSystemAuditLog } = auditLogService;

  const loginNoticeService = createSystemLoginNoticeService({
    getDefaultApplicantNoticeHtml,
    defaultInitialPassword,
    getDefaultLoginNoticeHtml,
    parseSystemInitialPassword,
    query,
  });
  const { getApplicantNoticeHtml, getLoginNoticeHtml, updateLoginNoticeHtml } = loginNoticeService;

  const backupService = createSystemBackupService({
    applicantFileStorageDirName,
    applicantPhotoStorageDirName,
    createHttpError,
    databaseName,
    examineePhotoStorageDirName,
    fs,
    getPool,
    path,
    query,
    rootDir,
  });
  const {
    buildSystemBackupArchive,
    getSystemBackupAutomationSettings,
    runSystemBackupAutomation,
    startSystemBackupAutomation,
    updateSystemBackupAutomationSettings,
    validateSystemBackupArchive,
    restoreSystemBackupArchive,
  } = backupService;

  const dataCleanupService = createSystemDataCleanupService({
    applicantFileStorageDirName,
    applicantPhotoStorageDirName,
    createHttpError,
    examineePhotoStorageDirName,
    fs,
    getPool,
    path,
    query,
    rootDir,
  });
  const { deleteSystemData } = dataCleanupService;

  const accountBootstrapService = createSystemAccountBootstrapService({
    defaultInitialPassword,
    defaultSeedAccounts,
    getSystemSettings,
    hashPassword,
    isPasswordHash,
    query,
  });
  const {
    migrateLegacyAccountPasswords,
    migrateLegacySeedAccountIds,
    seedAccounts,
  } = accountBootstrapService;

  const summaryService = createSystemSummaryService({
    formatDateAsYmd,
    getAccounts,

    getApplicantFormFields,
    getApplicantRecruitmentUnits,
    getApplicantSchedules,
    getApplicantSettings,
    getApplicantSubmissions,
    getApplicantNoticeHtml,
    getExaminees,
    getLoginNoticeHtml,
    getPrintHistory,
    getSystemBackupAutomationSettings,
    getSuperAdminSettings,
    getSystemSettings,
    getTemplates,
    query,
  });
  const { getBootstrapPayload } = summaryService;

  return Object.freeze({
    ...emailSettingsService,
    buildSystemBackupArchive,
    deleteSystemData,
    getBootstrapPayload,
    getApplicantNoticeHtml,
    getLoginNoticeHtml,
    getSystemBackupAutomationSettings,
    getPublicSuperAdminSettings,
    getRoleMenuVisibilitySettings,
    getSystemAuditLogs,
    getSuperAdminSettings,
    getSystemSettings,
    migrateLegacyAccountPasswords,
    migrateLegacySeedAccountIds,
    recordSystemAuditLog,
    runSystemBackupAutomation,
    seedAccounts,
    restoreSystemBackupArchive,
    startSystemBackupAutomation,
    updateSystemBackupAutomationSettings,
    validateSystemBackupArchive,
    uploadSuperAdminImage,
    updateLoginNoticeHtml,
    updateSuperAdminSettings,
    updateSystemSettings,
  });
}

module.exports = {
  createSystemService,
};
