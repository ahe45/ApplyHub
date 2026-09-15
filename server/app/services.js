const { createDefaultTemplateContentBuilder } = require("../../shared/domain/default-template");
const DEFAULT_TEMPLATE_SEEDS = [{
  id: "default-application-ticket", name: "기본 수험표 양식", description: "접수 정보 기준 수험표", version: "v2.0", status: "used",
  contentHtml: createDefaultTemplateContentBuilder({buildTemplateTokenHtml: token => token})(),
}];
const {
  accountRoleOptions,
  buildRoleMenuVisibilityFromSuperAdminSettings,
  normalizeSuperAdminSettings,
  superAdminRole,
  templateRenderTagDefinitions: templateTagDefinitions,
} = require("../../shared/app-config");
const { createApplicantService } = require("../modules/applications/service");
const { createApplicantMembershipService } = require("../modules/applications/membership");
const { createEmailSettingsService } = require("../modules/system/service/email-settings");
const { createAuthService } = require("../modules/auth/service");
const { createAuthSessionStore } = require("../modules/auth/session-store");
const { createPasswordHelpers, DEFAULT_PASSWORD_HASH_PREFIX } = require("../modules/auth/passwords");
const { createSchemaBootstrapService } = require("../modules/bootstrap/schema");
const { createDatabaseErrorTranslator } = require("../modules/database/error-translation");
const { createAdmitCardService } = require("../modules/admit-cards/admit-card");
const { createSubmissionTicketDataService } = require("../modules/admit-cards/submission-records");
const { createPrintHistoryService } = require("../modules/print-history/service");
const {
  getDefaultApplicantNoticeHtml,
  getDefaultLoginNoticeHtml,
} = require("../modules/system/default-notices");
const { createSystemService } = require("../modules/system/service");
const { createTemplateBootstrapService } = require("../modules/templates/bootstrap");
const { createTemplateService } = require("../modules/templates/service");

const DEFAULT_INITIAL_PASSWORD = "1111";
const DEFAULT_AUTO_LOGOUT_MINUTES = 0;
const MAX_AUTO_LOGOUT_MINUTES = 1440;
const TEMPLATE_TAG_SCHEMA_VERSION = "3";
const SESSION_COOKIE_NAME = "admitcard.sid";
const AUTHENTICATED_SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const PASSWORD_SETUP_SESSION_TTL_MS = 1000 * 60 * 15;
const BATCH_ADMIT_CARD_JOB_TTL_MS = 1000 * 60 * 30;
const APPLICANT_EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 5;
const APPLICANT_PUBLIC_ACCESS_TTL_MS = 1000 * 60 * 60;
const EXAMINEE_PHOTO_STORAGE_DIR_NAME = "photo";
const APPLICANT_PHOTO_STORAGE_DIR_NAME = "uploads/photo";
const APPLICANT_FILE_STORAGE_DIR_NAME = "uploads/file";
const EDGE_EXECUTABLE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const DEFAULT_SEED_ACCOUNTS = Object.freeze([
  Object.freeze({
    legacyId: "admin001",
    id: "admin",
    name: "김관리",
    role: "관리자",
  }),
  Object.freeze({
    legacyId: "ops001",
    id: "ops",
    name: "박운영",
    role: "운영자",
  }),
  Object.freeze({
    legacyId: "viewer001",
    id: "view",
    name: "최조회",
    role: "조회용",
  }),
]);

function createHttpError(statusCode, message, errorCode = "") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateAsYmd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function createApplicationServices({ env = process.env, fs, getPool, path, query, rootDir = process.cwd() }) {
  const databaseName = env.DB_NAME || "applyhub";
  const passwordHelpers = createPasswordHelpers({
    passwordHashPrefix: DEFAULT_PASSWORD_HASH_PREFIX,
  });
  const {
    hashPassword,
    isPasswordHash,
    normalizePasswordSetupValue,
    verifyPassword,
  } = passwordHelpers;
  const authSessionStore = createAuthSessionStore({
    authenticatedSessionTtlMs: AUTHENTICATED_SESSION_TTL_MS,
    passwordSetupSessionTtlMs: PASSWORD_SETUP_SESSION_TTL_MS,
    sessionCookieName: SESSION_COOKIE_NAME,
  });
  const {
    attachSessionCookie,
    clearSessionCookie,
    createSession,
    destroySession,
    destroySessionsByAccountId,
    getSessionContext,
  } = authSessionStore;
  const ticketDataService = createSubmissionTicketDataService({
    createHttpError,
    getPool,
    getApplicantService: () => applicantService,
    query,
    rootDir,
  });
  const {
    getExamineeByNo,
    getExamineesByNos,
    getExaminees,
    getPrintHistory,
  } = ticketDataService;
  const templateService = createTemplateService({
    createHttpError,
    escapeHtml,
    formatDateAsYmd,
    getPool,
    query,
    templateTagDefinitions,
  });
  const {
    createTemplateExamineeRenderer,
    getActiveTemplate,
    getTemplates,
    normalizeTemplatePayload,
    renderTemplateWithExaminee,
  } = templateService;
  const templateBootstrapService = createTemplateBootstrapService({
    defaultTemplateSeeds: DEFAULT_TEMPLATE_SEEDS,
    normalizeTemplatePayload,
    query,
    templateTagSchemaVersion: TEMPLATE_TAG_SCHEMA_VERSION,
  });
  const printHistoryService = createPrintHistoryService({
    createHttpError,
    getPool,
  });
  const { normalizeExamineeNoList } = printHistoryService;
  const translateDatabaseError = createDatabaseErrorTranslator({ createHttpError });
  const admitCardService = createAdmitCardService({
    batchAdmitCardJobTtlMs: BATCH_ADMIT_CARD_JOB_TTL_MS,
    createHttpError,
    createTemplateExamineeRenderer,
    edgeExecutablePaths: EDGE_EXECUTABLE_PATHS,
    escapeHtml,
    getActiveTemplate,
    getExamineeByNo,
    getExamineesByNos,
    normalizeExamineeNoList,
    renderTemplateWithExaminee,
    translateDatabaseError,
  });
  const {
    buildAdmitCardPdfBuffer,
    buildAdmitCardPdfBufferFromRecord,
  } = admitCardService;
  const emailSettingsService = createEmailSettingsService({
    query, rootDir, env, createHttpError,
    getSchoolName: async () => (await systemService.getSuperAdminSettings()).schoolName,
  });
  const applicantService = createApplicantService({
    applicantFileStorageDirName: APPLICANT_FILE_STORAGE_DIR_NAME,
    applicantPhotoStorageDirName: APPLICANT_PHOTO_STORAGE_DIR_NAME,
    buildAdmitCardPdfBuffer,
    buildAdmitCardPdfBufferFromRecord,
    createHttpError,
    emailVerificationTtlMs: APPLICANT_EMAIL_VERIFICATION_TTL_MS,
    examineePhotoStorageDirName: EXAMINEE_PHOTO_STORAGE_DIR_NAME,
    getDefaultApplicantNoticeHtml,
    getPool,
    hashPassword,
    publicAccessTtlMs: APPLICANT_PUBLIC_ACCESS_TTL_MS,
    query,
    rootDir,
    sendVerificationEmail: emailSettingsService.sendVerificationEmail,
    verifyPassword,
  });
  const membershipService = createApplicantMembershipService({
    query, getPool, createHttpError, env,
    sendEmail: emailSettingsService.sendVerificationEmail,
  });
  const {

    getApplicantFormFields,
    getApplicantRecruitmentUnits,
    getApplicantSchedules,
    getApplicantSettings,
    getApplicantSubmissions,
    migrateApplicantFileAnswerData,
    migrateApplicantPhotoStorage,
    seedApplicantFormFields,
  } = applicantService;

  async function getAccounts() {
    return query(`
      SELECT
        login_id AS id,
        display_name AS name,
        role,
        COALESCE(DATE_FORMAT(last_login_at, '%Y-%m-%d %H:%i:%s'), '-') AS recentAccess
      FROM accounts
      ORDER BY login_id
    `);
  }

  const systemService = createSystemService({
    emailSettingsService,
    applicantFileStorageDirName: APPLICANT_FILE_STORAGE_DIR_NAME,
    applicantPhotoStorageDirName: APPLICANT_PHOTO_STORAGE_DIR_NAME,
    buildRoleMenuVisibilityFromSuperAdminSettings,
    createHttpError,
    databaseName,
    defaultAutoLogoutMinutes: DEFAULT_AUTO_LOGOUT_MINUTES,
    defaultInitialPassword: DEFAULT_INITIAL_PASSWORD,
    defaultSeedAccounts: DEFAULT_SEED_ACCOUNTS,
    examineePhotoStorageDirName: EXAMINEE_PHOTO_STORAGE_DIR_NAME,
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
    maxAutoLogoutMinutes: MAX_AUTO_LOGOUT_MINUTES,
    normalizeSuperAdminSettings,
    path,
    query,
    rootDir,
  });
  const {
    getSystemSettings,
    migrateLegacyAccountPasswords,
  } = systemService;
  const schemaBootstrapService = createSchemaBootstrapService({
    defaultAutoLogoutMinutes: DEFAULT_AUTO_LOGOUT_MINUTES,
    defaultInitialPassword: DEFAULT_INITIAL_PASSWORD,
    migrateLegacyAccountPasswords,
    query,
  });
  const authService = createAuthService({
    accountRoleOptions,
    attachSessionCookie,
    clearSessionCookie,
    createHttpError,
    createSession,
    destroySession,
    destroySessionsByAccountId,
    getSessionContext,
    getSystemSettings,
    hashPassword,
    normalizePasswordSetupValue,
    query,
    verifyPassword,
  });

  async function verifySystemDataDeletionPassword(accountId, currentPassword) {
    const normalizedAccountId = String(accountId || "").trim();
    const normalizedPassword = String(currentPassword ?? "");

    if (!normalizedAccountId) {
      throw createHttpError(401, "로그인이 필요합니다.", "AUTH_REQUIRED");
    }

    if (!normalizedPassword) {
      throw createHttpError(400, "현재 비밀번호를 입력하세요.", "SYSTEM_DATA_DELETE_PASSWORD_REQUIRED");
    }

    const account = await authService.getAccountAuthRecord(normalizedAccountId);

    if (!account || !verifyPassword(normalizedPassword, account.passwordValue)) {
      throw createHttpError(401, "현재 비밀번호가 올바르지 않습니다.", "SYSTEM_DATA_DELETE_PASSWORD_INVALID");
    }

    return true;
  }

  async function initializeApplicationData() {
    await schemaBootstrapService.ensureApplicantSchema();
    await schemaBootstrapService.ensurePrintHistorySchema();
    await templateBootstrapService.ensureTemplateSchema();
    await seedApplicantFormFields();
    await migrateApplicantPhotoStorage();
    await migrateApplicantFileAnswerData();
    await schemaBootstrapService.ensureSystemSettingsSchema();
    await schemaBootstrapService.ensureSystemAuditLogSchema();
    await templateBootstrapService.migrateTemplateTagSchema();
    await templateBootstrapService.seedTemplates();
    await schemaBootstrapService.ensureAccountSchema();
    await schemaBootstrapService.ensureSchemaColumnComments();
    await systemService.migrateLegacySeedAccountIds();
    await systemService.seedAccounts();
    await membershipService.initialize();
    await systemService.startSystemBackupAutomation({
      recordSystemAuditLog: systemService.recordSystemAuditLog,
    });
  }

  return Object.freeze({
    admitCardService,
    applicantService,
    membershipService,
    authService,
    createHttpError,
    databaseName,
    ticketDataService,
    getAuthenticatedAccountFromRequest: authService.getAuthenticatedAccountFromRequest,
    getAuthSessionPayload: authService.getAuthSessionPayload,
    getPublicSuperAdminSettings: systemService.getPublicSuperAdminSettings,
    getRoleMenuVisibilitySettings: systemService.getRoleMenuVisibilitySettings,
    initializeApplicationData,
    printHistoryService,
    superAdminRole,
    systemService,
    templateService,
    translateDatabaseError,
    verifySystemDataDeletionPassword,
  });
}

module.exports = {
  createApplicationServices,
};
