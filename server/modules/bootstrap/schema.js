const { createAccountSchemaBootstrap } = require("./schema/accounts");
const { createApplicantSchemaBootstrap } = require("./schema/applications");
const { COLUMN_COMMENTS_BY_TABLE, TABLE_COMMENTS_BY_TABLE } = require("./schema/comments");

const { createPrintHistorySchemaBootstrap } = require("./schema/print-history");
const { createSchemaQueryHelpers } = require("./schema/helpers");
const { createSystemAuditLogSchemaBootstrap } = require("./schema/system-audit-log");
const { createSystemSettingsSchemaBootstrap } = require("./schema/system-settings");

function createSchemaBootstrapService({
  defaultAutoLogoutMinutes,
  defaultInitialPassword,
  migrateLegacyAccountPasswords,
  query,
}) {
  const schemaQueryHelpers = createSchemaQueryHelpers({ query });
  const { getTableColumns, hasColumn, hasTable, syncColumnComments, syncTableComments } = schemaQueryHelpers;

  const printHistorySchemaBootstrap = createPrintHistorySchemaBootstrap({
    getTableColumns,
    hasColumn,
    hasTable,
    query,
  });
  const { ensurePrintHistorySchema } = printHistorySchemaBootstrap;

  const accountSchemaBootstrap = createAccountSchemaBootstrap({
    defaultInitialPassword,
    migrateLegacyAccountPasswords,
    query,
  });
  const { ensureAccountSchema } = accountSchemaBootstrap;

  const applicantSchemaBootstrap = createApplicantSchemaBootstrap({
    getTableColumns,
    hasColumn,
    hasTable,
    query,
  });
  const { ensureApplicantSchema } = applicantSchemaBootstrap;

  const systemSettingsSchemaBootstrap = createSystemSettingsSchemaBootstrap({
    defaultAutoLogoutMinutes,
    defaultInitialPassword,
    hasTable,
    query,
  });
  const { ensureSystemSettingsSchema } = systemSettingsSchemaBootstrap;

  const systemAuditLogSchemaBootstrap = createSystemAuditLogSchemaBootstrap({
    getTableColumns,
    hasColumn,
    query,
  });
  const { ensureSystemAuditLogSchema } = systemAuditLogSchemaBootstrap;

  async function ensureSchemaColumnComments() {
    await syncColumnComments(COLUMN_COMMENTS_BY_TABLE);
    await syncTableComments(TABLE_COMMENTS_BY_TABLE);
  }

  return Object.freeze({
    ensureAccountSchema,
    ensureApplicantSchema,
    ensureSchemaColumnComments,

    ensurePrintHistorySchema,
    ensureSystemAuditLogSchema,
    ensureSystemSettingsSchema,
  });
}

module.exports = {
  createSchemaBootstrapService,
};
