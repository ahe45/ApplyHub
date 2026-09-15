function createApplicantSchemaBootstrap({
  getTableColumns,
  hasColumn,
  hasTable,
  query,
}) {
  const applicantFieldInputTypeSql = "ENUM('text', 'textarea', 'select', 'date', 'birthdate', 'time', 'photo', 'file', 'phone', 'nationality')";
  const applicantSubmissionStatusSql = "ENUM('submitted', 'promoted')";

  async function renameLegacyTableIfNeeded(legacyTableName, nextTableName) {
    const legacyExists = typeof hasTable === "function" ? await hasTable(legacyTableName) : false;
    const nextExists = typeof hasTable === "function" ? await hasTable(nextTableName) : false;

    if (legacyExists && !nextExists) {
      await query(`RENAME TABLE ${legacyTableName} TO ${nextTableName}`);
    }
  }

  async function createApplicantSubmissionMetaTable() {
    await query(`
      CREATE TABLE IF NOT EXISTS app_meta (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        examinee_no VARCHAR(30) NULL,
        field_overrides_json MEDIUMTEXT NULL,
        PRIMARY KEY (id),
        KEY idx_app_meta_examinee_no (examinee_no)
      )
    `);
  }

  async function createApplicantSubmissionAnswerTable() {
    await query(`
      CREATE TABLE IF NOT EXISTS app_subm (
        id BIGINT UNSIGNED NOT NULL,
        applicant_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NULL,
        status ${applicantSubmissionStatusSql} NOT NULL DEFAULT 'submitted',
        field_key VARCHAR(60) NOT NULL,
        answer_data MEDIUMTEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id, field_key),
        KEY idx_app_subm_lookup (email, applicant_name, id),
        KEY idx_app_subm_status (status),
        KEY idx_app_subm_field_key (field_key)
      )
    `);
  }

  async function createApplicantRecruitmentUnitTable() {
    await query(`
      CREATE TABLE IF NOT EXISTS app_unit (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        track_name VARCHAR(100) NOT NULL DEFAULT '',
        admission_code VARCHAR(30) NOT NULL,
        admission_name VARCHAR(100) NOT NULL,
        series_code VARCHAR(30) NOT NULL DEFAULT '',
        series_name VARCHAR(100) NOT NULL DEFAULT '',
        unit_code VARCHAR(30) NOT NULL,
        unit_name VARCHAR(100) NOT NULL,
        major_code VARCHAR(30) NOT NULL DEFAULT '',
        major_name VARCHAR(100) NOT NULL DEFAULT '',
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_app_unit_codes (track_name, admission_code, series_code, unit_code, major_code),
        UNIQUE KEY uniq_app_unit_names (track_name, admission_name, series_name, unit_name, major_name),
        KEY idx_app_unit_sort_order (sort_order)
      )
    `);
  }

  async function createApplicantScheduleTable() {
    await query(`
      CREATE TABLE IF NOT EXISTS app_schedule (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        track_name VARCHAR(100) NOT NULL DEFAULT '',
        admission_code VARCHAR(30) NOT NULL,
        admission_name VARCHAR(100) NOT NULL,
        applicant_schedule_start_at DATETIME NULL,
        applicant_schedule_end_at DATETIME NULL,
        admit_card_lookup_schedule_start_at DATETIME NULL,
        admit_card_lookup_schedule_end_at DATETIME NULL,
        document_submission_schedule_start_at DATETIME NULL,
        document_submission_schedule_end_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_app_schedule_track_admission (track_name, admission_code, admission_name),
        KEY idx_app_schedule_track_name (track_name),
        KEY idx_app_schedule_admission_name (admission_name)
      )
    `);
  }

  function parseLegacyAnswerItems(rawAnswerItems = "") {
    if (!String(rawAnswerItems || "").trim()) {
      return [];
    }

    try {
      const parsedValue = JSON.parse(String(rawAnswerItems || "[]"));
      return Array.isArray(parsedValue) ? parsedValue : [];
    } catch (error) {
      return [];
    }
  }

  function buildMigratedApplicantAnswerData(answerItem = {}, legacyRow = {}) {
    const inputType = String(answerItem?.inputType || "text").trim();
    const answerValue = answerItem?.value;

    if (inputType !== "photo") {
      return String(answerValue ?? "").trim();
    }

    const normalizedPhotoValue =
      answerValue && typeof answerValue === "object"
        ? {
            fileName: String(answerValue.fileName || legacyRow.photoName || "").trim(),
            mimeType: String(answerValue.mimeType || legacyRow.photoMime || "").trim(),
            hasPhoto: answerValue.hasPhoto === true || Number(answerValue.hasPhoto) === 1 || Boolean(legacyRow.photoBase64),
            base64: String(legacyRow.photoBase64 || "").trim(),
          }
        : {
            fileName: String(legacyRow.photoName || "").trim(),
            mimeType: String(legacyRow.photoMime || "").trim(),
            hasPhoto: Boolean(legacyRow.photoBase64),
            base64: String(legacyRow.photoBase64 || "").trim(),
          };

    return JSON.stringify(normalizedPhotoValue);
  }

  async function migrateLegacyApplicantSubmissionsTable() {
    const legacyTableName = `app_subm_legacy_${Date.now()}`;
    const legacyRows = await query(`
      SELECT
        id,
        applicant_name AS applicantName,
        email,
        password_hash AS passwordHash,
        status,
        answers_json AS answersJson,
        promoted_examinee_no AS examineeNo,
        photo_name AS photoName,
        photo_mime AS photoMime,
        TO_BASE64(photo_blob) AS photoBase64,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM app_subm
      ORDER BY id ASC
    `);

    await query(`RENAME TABLE app_subm TO ${legacyTableName}`);
    await createApplicantSubmissionMetaTable();
    await createApplicantSubmissionAnswerTable();

    for (const legacyRow of Array.isArray(legacyRows) ? legacyRows : []) {
      const submissionId = Number(legacyRow?.id || 0);

      if (!Number.isInteger(submissionId) || submissionId <= 0) {
        continue;
      }

      await query(
        `
          INSERT INTO app_meta (
            id,
            examinee_no
          )
          VALUES (?, ?)
        `,
        [
          submissionId,
          String(legacyRow?.examineeNo || "").trim() || null,
        ],
      );

      const answerItems = parseLegacyAnswerItems(legacyRow?.answersJson)
        .map((answerItem) => ({
          fieldKey: String(answerItem?.fieldKey || "").trim(),
          answerData: buildMigratedApplicantAnswerData(answerItem, legacyRow),
        }))
        .filter((answerItem) => answerItem.fieldKey);

      for (const answerItem of answerItems) {
        await query(
          `
            INSERT INTO app_subm (
              id,
              applicant_name,
              email,
              password_hash,
              status,
              field_key,
              answer_data,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            submissionId,
            String(legacyRow?.applicantName || "").trim(),
            String(legacyRow?.email || "").trim(),
            String(legacyRow?.passwordHash || "").trim() || null,
            String(legacyRow?.status || "submitted").trim() || "submitted",
            answerItem.fieldKey,
            answerItem.answerData,
            legacyRow?.createdAt || new Date(),
            legacyRow?.updatedAt || legacyRow?.createdAt || new Date(),
          ],
        );
      }
    }
  }

  async function ensureApplicantUnitSchema() {
    await createApplicantRecruitmentUnitTable();

    const applicantUnitColumns = await getTableColumns("app_unit");
    const hadLegacyTrackCodeColumn = hasColumn(applicantUnitColumns, "track_code");
    const hadTrackNameColumn = hasColumn(applicantUnitColumns, "track_name");
    const hadSeriesCodeColumn = hasColumn(applicantUnitColumns, "series_code");
    const hadSeriesNameColumn = hasColumn(applicantUnitColumns, "series_name");

    if (!hadTrackNameColumn) {
      await query(`ALTER TABLE app_unit ADD COLUMN track_name VARCHAR(100) NOT NULL DEFAULT '' AFTER id`);
    }

    if (!hadSeriesCodeColumn) {
      await query(`ALTER TABLE app_unit ADD COLUMN series_code VARCHAR(30) NOT NULL DEFAULT '' AFTER admission_name`);
    }

    if (!hadSeriesNameColumn) {
      await query(`ALTER TABLE app_unit ADD COLUMN series_name VARCHAR(100) NOT NULL DEFAULT '' AFTER series_code`);
    }

    const refreshedApplicantUnitColumns = await getTableColumns("app_unit");

    if (!hasColumn(refreshedApplicantUnitColumns, "major_code")) {
      await query(`ALTER TABLE app_unit ADD COLUMN major_code VARCHAR(30) NOT NULL DEFAULT '' AFTER unit_name`);
    }

    if (!hasColumn(refreshedApplicantUnitColumns, "major_name")) {
      await query(`ALTER TABLE app_unit ADD COLUMN major_name VARCHAR(100) NOT NULL DEFAULT '' AFTER major_code`);
    }

    if ((!hadSeriesCodeColumn || !hadSeriesNameColumn) && hasColumn(refreshedApplicantUnitColumns, "track_code")) {
      await query(`
        UPDATE app_unit
        SET
          series_code = CASE WHEN series_code = '' THEN track_code ELSE series_code END,
          series_name = CASE WHEN series_name = '' THEN track_name ELSE series_name END
        WHERE (track_code <> '' OR track_name <> '')
      `);
    }

    if ((!hadSeriesCodeColumn || !hadSeriesNameColumn) && hadLegacyTrackCodeColumn && hadTrackNameColumn) {
      await query(`
        UPDATE app_unit
        SET
          track_name = ''
        WHERE series_name = track_name
          AND (track_code <> '' OR track_name <> '')
      `);
    }

    const appUnitIndexes = await query(`SHOW INDEX FROM app_unit`);
    const legacyTrackCodeIndexNames = Array.from(
      new Set(
        appUnitIndexes
          .filter(
            (index) =>
              String(index.Key_name || "") !== "PRIMARY" && String(index.Column_name || "") === "track_code",
          )
          .map((index) => String(index.Key_name || "")),
      ),
    );
    const removableIndexNames = Array.from(
      new Set([
        "uniq_app_unit_codes",
        "uniq_app_unit_names",
        "uniq_applicant_recruitment_unit_codes",
        "uniq_applicant_recruitment_unit_names",
        "idx_applicant_recruitment_units_sort_order",
        ...legacyTrackCodeIndexNames,
      ]),
    );

    for (const indexName of removableIndexNames) {
      if (appUnitIndexes.some((index) => String(index.Key_name || "") === indexName)) {
        await query(`ALTER TABLE app_unit DROP INDEX \`${indexName}\``);
      }
    }

    if (hasColumn(await getTableColumns("app_unit"), "track_code")) {
      await query(`ALTER TABLE app_unit DROP COLUMN track_code`);
    }

    const refreshedIndexes = await query(`SHOW INDEX FROM app_unit`);
    const hasCodeIndex = refreshedIndexes.some((index) => String(index.Key_name || "") === "uniq_app_unit_codes");
    const hasNameIndex = refreshedIndexes.some((index) => String(index.Key_name || "") === "uniq_app_unit_names");
    const hasSortIndex = refreshedIndexes.some((index) => String(index.Key_name || "") === "idx_app_unit_sort_order");

    if (!hasCodeIndex) {
      await query(`ALTER TABLE app_unit ADD UNIQUE KEY uniq_app_unit_codes (track_name, admission_code, series_code, unit_code, major_code)`);
    }

    if (!hasNameIndex) {
      await query(`ALTER TABLE app_unit ADD UNIQUE KEY uniq_app_unit_names (track_name, admission_name, series_name, unit_name, major_name)`);
    }

    if (!hasSortIndex) {
      await query(`ALTER TABLE app_unit ADD KEY idx_app_unit_sort_order (sort_order)`);
    }

    await query(`
      ALTER TABLE app_unit
      MODIFY COLUMN track_name VARCHAR(100) NOT NULL DEFAULT '' AFTER id,
      MODIFY COLUMN admission_code VARCHAR(30) NOT NULL AFTER track_name,
      MODIFY COLUMN admission_name VARCHAR(100) NOT NULL AFTER admission_code,
      MODIFY COLUMN series_code VARCHAR(30) NOT NULL DEFAULT '' AFTER admission_name,
      MODIFY COLUMN series_name VARCHAR(100) NOT NULL DEFAULT '' AFTER series_code,
      MODIFY COLUMN unit_code VARCHAR(30) NOT NULL AFTER series_name,
      MODIFY COLUMN unit_name VARCHAR(100) NOT NULL AFTER unit_code,
      MODIFY COLUMN major_code VARCHAR(30) NOT NULL DEFAULT '' AFTER unit_name,
      MODIFY COLUMN major_name VARCHAR(100) NOT NULL DEFAULT '' AFTER major_code,
      MODIFY COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER major_name
    `);
  }

  async function ensureApplicantScheduleSchema() {
    await createApplicantScheduleTable();

    const applicantScheduleColumns =
      typeof getTableColumns === "function" && typeof hasColumn === "function"
        ? await getTableColumns("app_schedule")
        : await query(`SHOW COLUMNS FROM app_schedule`);
    const columnExists = (columnName) =>
      typeof hasColumn === "function"
        ? hasColumn(applicantScheduleColumns, columnName)
        : applicantScheduleColumns.some((column) => String(column?.Field || "") === columnName);

    if (!columnExists("track_name")) {
      await query(`ALTER TABLE app_schedule ADD COLUMN track_name VARCHAR(100) NOT NULL DEFAULT '' AFTER id`);
    }

    if (!columnExists("admission_code")) {
      await query(`ALTER TABLE app_schedule ADD COLUMN admission_code VARCHAR(30) NOT NULL AFTER track_name`);
    }

    if (!columnExists("admission_name")) {
      await query(`ALTER TABLE app_schedule ADD COLUMN admission_name VARCHAR(100) NOT NULL AFTER admission_code`);
    }

    if (!columnExists("applicant_schedule_start_at")) {
      await query(`ALTER TABLE app_schedule ADD COLUMN applicant_schedule_start_at DATETIME NULL AFTER admission_name`);
    }

    if (!columnExists("applicant_schedule_end_at")) {
      await query(`ALTER TABLE app_schedule ADD COLUMN applicant_schedule_end_at DATETIME NULL AFTER applicant_schedule_start_at`);
    }

    if (!columnExists("admit_card_lookup_schedule_start_at")) {
      await query(`ALTER TABLE app_schedule ADD COLUMN admit_card_lookup_schedule_start_at DATETIME NULL AFTER applicant_schedule_end_at`);
    }

    if (!columnExists("admit_card_lookup_schedule_end_at")) {
      await query(`ALTER TABLE app_schedule ADD COLUMN admit_card_lookup_schedule_end_at DATETIME NULL AFTER admit_card_lookup_schedule_start_at`);
    }
    if (!columnExists("document_submission_schedule_start_at")) {
      await query(`ALTER TABLE app_schedule ADD COLUMN document_submission_schedule_start_at DATETIME NULL`);
    }
    if (!columnExists("document_submission_schedule_end_at")) {
      await query(`ALTER TABLE app_schedule ADD COLUMN document_submission_schedule_end_at DATETIME NULL`);
    }

    const refreshedIndexes = await query(`SHOW INDEX FROM app_schedule`);
    const hasTrackAdmissionIndex = refreshedIndexes.some((index) => String(index.Key_name || "") === "uniq_app_schedule_track_admission");
    const hasTrackNameIndex = refreshedIndexes.some((index) => String(index.Key_name || "") === "idx_app_schedule_track_name");
    const hasAdmissionNameIndex = refreshedIndexes.some((index) => String(index.Key_name || "") === "idx_app_schedule_admission_name");

    if (!hasTrackAdmissionIndex) {
      await query(`ALTER TABLE app_schedule ADD UNIQUE KEY uniq_app_schedule_track_admission (track_name, admission_code, admission_name)`);
    }

    if (!hasTrackNameIndex) {
      await query(`ALTER TABLE app_schedule ADD KEY idx_app_schedule_track_name (track_name)`);
    }

    if (!hasAdmissionNameIndex) {
      await query(`ALTER TABLE app_schedule ADD KEY idx_app_schedule_admission_name (admission_name)`);
    }
  }

  async function ensureApplicantFormSchema() {
    await query(`
      CREATE TABLE IF NOT EXISTS app_form (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        form_scope ENUM('application', 'documents') NOT NULL DEFAULT 'application',
        field_key VARCHAR(60) NOT NULL,
        question_text VARCHAR(255) NOT NULL,
        question_description VARCHAR(500) NOT NULL DEFAULT '',
        input_type ${applicantFieldInputTypeSql} NOT NULL DEFAULT 'text',
        system_field_key VARCHAR(40) NOT NULL DEFAULT '',
        options_json TEXT NULL,
        required TINYINT(1) NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_app_form_field_key (field_key),
        KEY idx_app_form_sort_order (sort_order)
      )
    `);

    if (typeof getTableColumns === "function" && typeof hasColumn === "function") {
      const applicantFieldColumns = await getTableColumns("app_form");
      if (!hasColumn(applicantFieldColumns, "form_scope")) {
        await query("ALTER TABLE app_form ADD COLUMN form_scope ENUM('application', 'documents') NOT NULL DEFAULT 'application' AFTER id");
      }
      const inputTypeColumn = applicantFieldColumns.find((column) => String(column.Field || "") === "input_type");

      if (!hasColumn(applicantFieldColumns, "question_description")) {
        await query(`ALTER TABLE app_form ADD COLUMN question_description VARCHAR(500) NOT NULL DEFAULT '' AFTER question_text`);
      }

      if (
        !String(inputTypeColumn?.Type || "").includes("'phone'") ||
        !String(inputTypeColumn?.Type || "").includes("'nationality'") ||
        !String(inputTypeColumn?.Type || "").includes("'file'")
      ) {
        await query(`ALTER TABLE app_form MODIFY COLUMN input_type ${applicantFieldInputTypeSql} NOT NULL DEFAULT 'text'`);
      }
    } else {
      const [descriptionColumn] = await query(`SHOW COLUMNS FROM app_form LIKE 'question_description'`);
      const [scopeColumn] = await query("SHOW COLUMNS FROM app_form LIKE 'form_scope'");
      if (!scopeColumn) {
        await query("ALTER TABLE app_form ADD COLUMN form_scope ENUM('application', 'documents') NOT NULL DEFAULT 'application' AFTER id");
      }
      const [inputTypeColumn] = await query(`SHOW COLUMNS FROM app_form LIKE 'input_type'`);

      if (!descriptionColumn) {
        await query(`ALTER TABLE app_form ADD COLUMN question_description VARCHAR(500) NOT NULL DEFAULT '' AFTER question_text`);
      }

      if (
        !String(inputTypeColumn?.Type || "").includes("'phone'") ||
        !String(inputTypeColumn?.Type || "").includes("'nationality'") ||
        !String(inputTypeColumn?.Type || "").includes("'file'")
      ) {
        await query(`ALTER TABLE app_form MODIFY COLUMN input_type ${applicantFieldInputTypeSql} NOT NULL DEFAULT 'text'`);
      }
    }
  }

  async function ensureApplicantSubmissionSchema() {
    let applicantSubmissionColumns = [];
    let applicantSubmissionTableExists = false;

    if (typeof hasTable === "function") {
      applicantSubmissionTableExists = await hasTable("app_subm");
    } else {
      const applicantSubmissionTables = await query(`SHOW TABLES LIKE 'app_subm'`);
      applicantSubmissionTableExists = Array.isArray(applicantSubmissionTables) && applicantSubmissionTables.length > 0;
    }

    if (applicantSubmissionTableExists) {
      if (typeof getTableColumns === "function") {
        applicantSubmissionColumns = await getTableColumns("app_subm");
      } else {
        applicantSubmissionColumns = await query(`SHOW COLUMNS FROM app_subm`);
      }
    }

    const hasLegacyApplicantSubmissionSchema = applicantSubmissionColumns.some((column) => String(column?.Field || "") === "answers_json");

    if (applicantSubmissionTableExists && hasLegacyApplicantSubmissionSchema) {
      await migrateLegacyApplicantSubmissionsTable();
    } else {
      await createApplicantSubmissionMetaTable();
      await createApplicantSubmissionAnswerTable();
    }

    if (typeof getTableColumns === "function" && typeof hasColumn === "function") {
      applicantSubmissionColumns = await getTableColumns("app_subm");

      if (!hasColumn(applicantSubmissionColumns, "password_hash")) {
        await query(`ALTER TABLE app_subm ADD COLUMN password_hash VARCHAR(255) NULL AFTER email`);
      }

      const statusColumn = applicantSubmissionColumns.find((column) => String(column.Field || "") === "status");

      if (!String(statusColumn?.Type || "").includes("'promoted'")) {
        await query(`ALTER TABLE app_subm MODIFY COLUMN status ${applicantSubmissionStatusSql} NOT NULL DEFAULT 'submitted'`);
      }
    } else {
      const [passwordHashColumn] = await query(`SHOW COLUMNS FROM app_subm LIKE 'password_hash'`);
      const [statusColumn] = await query(`SHOW COLUMNS FROM app_subm LIKE 'status'`);

      if (!passwordHashColumn) {
        await query(`ALTER TABLE app_subm ADD COLUMN password_hash VARCHAR(255) NULL AFTER email`);
      }

      if (!String(statusColumn?.Type || "").includes("'promoted'")) {
        await query(`ALTER TABLE app_subm MODIFY COLUMN status ${applicantSubmissionStatusSql} NOT NULL DEFAULT 'submitted'`);
      }
    }

    const applicantMetaColumns =
      typeof getTableColumns === "function" && typeof hasColumn === "function"
        ? await getTableColumns("app_meta")
        : await query(`SHOW COLUMNS FROM app_meta`);

    if (!(typeof hasColumn === "function" ? hasColumn(applicantMetaColumns, "field_overrides_json") : applicantMetaColumns.some((column) => String(column?.Field || "") === "field_overrides_json"))) {
      await query(`ALTER TABLE app_meta ADD COLUMN field_overrides_json MEDIUMTEXT NULL AFTER examinee_no`);
    }
  }

  async function ensureApplicantSchema() {
    await renameLegacyTableIfNeeded("applicant_form_fields", "app_form");
    await renameLegacyTableIfNeeded("applicant_submission_meta", "app_meta");
    await renameLegacyTableIfNeeded("applicant_submissions", "app_subm");
    await renameLegacyTableIfNeeded("applicant_recruitment_units", "app_unit");
    await renameLegacyTableIfNeeded("applicant_email_verifications", "app_email_log");

    await ensureApplicantFormSchema();
    await ensureApplicantUnitSchema();
    await ensureApplicantScheduleSchema();
    await ensureApplicantSubmissionSchema();

    await query(`
      CREATE TABLE IF NOT EXISTS app_email_log (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        applicant_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        code_value VARCHAR(12) NOT NULL,
        expires_at DATETIME NOT NULL,
        verified_at DATETIME NULL,
        delivery_status ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'sent',
        delivery_message_id VARCHAR(255) NULL,
        sent_at DATETIME NULL,
        failed_at DATETIME NULL,
        delivery_error VARCHAR(500) NOT NULL DEFAULT '',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_app_email_log_lookup (email, applicant_name),
        KEY idx_app_email_log_expires (expires_at)
      )
    `);

    const applicantEmailLogColumns =
      typeof getTableColumns === "function" && typeof hasColumn === "function"
        ? await getTableColumns("app_email_log")
        : await query(`SHOW COLUMNS FROM app_email_log`);

    if (!(typeof hasColumn === "function" ? hasColumn(applicantEmailLogColumns, "delivery_status") : applicantEmailLogColumns.some((column) => String(column?.Field || "") === "delivery_status"))) {
      await query(`ALTER TABLE app_email_log ADD COLUMN delivery_status ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'sent' AFTER verified_at`);
    }

    if (!(typeof hasColumn === "function" ? hasColumn(applicantEmailLogColumns, "delivery_message_id") : applicantEmailLogColumns.some((column) => String(column?.Field || "") === "delivery_message_id"))) {
      await query(`ALTER TABLE app_email_log ADD COLUMN delivery_message_id VARCHAR(255) NULL AFTER delivery_status`);
    }

    if (!(typeof hasColumn === "function" ? hasColumn(applicantEmailLogColumns, "sent_at") : applicantEmailLogColumns.some((column) => String(column?.Field || "") === "sent_at"))) {
      await query(`ALTER TABLE app_email_log ADD COLUMN sent_at DATETIME NULL AFTER delivery_message_id`);
    }

    if (!(typeof hasColumn === "function" ? hasColumn(applicantEmailLogColumns, "failed_at") : applicantEmailLogColumns.some((column) => String(column?.Field || "") === "failed_at"))) {
      await query(`ALTER TABLE app_email_log ADD COLUMN failed_at DATETIME NULL AFTER sent_at`);
    }

    if (!(typeof hasColumn === "function" ? hasColumn(applicantEmailLogColumns, "delivery_error") : applicantEmailLogColumns.some((column) => String(column?.Field || "") === "delivery_error"))) {
      await query(`ALTER TABLE app_email_log ADD COLUMN delivery_error VARCHAR(500) NOT NULL DEFAULT '' AFTER failed_at`);
    }

    await query(`
      UPDATE app_email_log
      SET
        delivery_status = CASE
          WHEN verified_at IS NOT NULL OR sent_at IS NOT NULL THEN 'sent'
          ELSE delivery_status
        END,
        sent_at = COALESCE(sent_at, created_at)
      WHERE delivery_status = 'sent'
        AND sent_at IS NULL
    `);
  }

  return Object.freeze({
    ensureApplicantSchema,
  });
}

module.exports = {
  createApplicantSchemaBootstrap,
};
