function createSystemSettingsSchemaBootstrap({
  defaultAutoLogoutMinutes,
  defaultInitialPassword,
  hasTable,
  query,
}) {
  const obsoleteSettingKeys = Object.freeze([
    "applicantScheduleStartAt",
    "applicantScheduleEndAt",
    "admitCardLookupScheduleStartAt",
    "admitCardLookupScheduleEndAt",
  ]);

  async function ensureSystemSettingsSchema() {
    const hasLegacySystemSettingsTable = typeof hasTable === "function" ? await hasTable("system_settings") : false;
    const hasSystemSettingsTable = typeof hasTable === "function" ? await hasTable("system_set") : false;

    if (hasLegacySystemSettingsTable && !hasSystemSettingsTable) {
      await query(`RENAME TABLE system_settings TO system_set`);
    }

    await query(`
      CREATE TABLE IF NOT EXISTS system_set (
        setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
        setting_value MEDIUMTEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    const [settingValueColumn] = await query(`SHOW COLUMNS FROM system_set LIKE 'setting_value'`);

    if (!String(settingValueColumn?.Type || "").toLowerCase().includes("text")) {
      await query(`ALTER TABLE system_set MODIFY COLUMN setting_value MEDIUMTEXT NOT NULL`);
    }

    await query(
      `
        INSERT IGNORE INTO system_set (setting_key, setting_value)
        VALUES
          ('initialPassword', ?),
          ('autoLogoutMinutes', ?),
          ('applicantNoticeHtml', ''),
          ('admissionHomepageUrl', ''),
          ('applicantExamNoDigitCount', '10'),
          ('applicantExamNoComponentsJson', '["admissionCode","seriesCode","unitCode","sequence",""]'),
          ('superAdminSettingsJson', '{"schoolName":"","logoImageUrl":"","backgroundImageUrl":"","recruitmentEnabled":true}')
      `,
      [defaultInitialPassword, String(defaultAutoLogoutMinutes)],
    );

    await query(
      `
        DELETE FROM system_set
        WHERE setting_key IN (${obsoleteSettingKeys.map(() => "?").join(", ")})
      `,
      [...obsoleteSettingKeys],
    );
  }

  return Object.freeze({
    ensureSystemSettingsSchema,
  });
}

module.exports = {
  createSystemSettingsSchemaBootstrap,
};
