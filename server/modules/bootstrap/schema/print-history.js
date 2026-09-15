function createPrintHistorySchemaBootstrap({
  getTableColumns,
  hasColumn,
  hasTable,
  query,
}) {
  async function ensurePrintHistorySchema() {
    const hasLegacyPrintLogTable = typeof hasTable === "function" ? await hasTable("print_history") : false;
    const hasPrintLogTable = typeof hasTable === "function" ? await hasTable("print_log") : false;

    if (hasLegacyPrintLogTable && !hasPrintLogTable) {
      await query(`RENAME TABLE print_history TO print_log`);
    }

    await query(`
      CREATE TABLE IF NOT EXISTS print_log (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        examinee_no VARCHAR(30) NOT NULL,
        print_count INT NOT NULL,
        printed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_print_log_examinee_no (examinee_no),
        KEY idx_print_log_printed_at (printed_at)
      )
    `);

    let printHistoryColumns = await getTableColumns("print_log");

    if (hasColumn(printHistoryColumns, "candidate_id") && !hasColumn(printHistoryColumns, "examinee_no")) {
      await query(`ALTER TABLE print_log ADD COLUMN examinee_no VARCHAR(30) NULL AFTER id`);
      printHistoryColumns = await getTableColumns("print_log");
    }

    if (hasColumn(printHistoryColumns, "candidate_id") && hasColumn(printHistoryColumns, "examinee_no")) {
      await query(`
        UPDATE print_log ph
        INNER JOIN examinee e ON e.id = ph.candidate_id
        SET ph.examinee_no = e.examinee_no
        WHERE ph.examinee_no IS NULL
           OR ph.examinee_no = ''
           OR ph.examinee_no <> e.examinee_no
      `);

      const unresolvedRows = await query(`
        SELECT COUNT(*) AS unresolvedCount
        FROM print_log
        WHERE examinee_no IS NULL OR examinee_no = ''
      `);
      const unresolvedCount = Number(unresolvedRows[0]?.unresolvedCount || 0);

      if (unresolvedCount > 0) {
        throw new Error(`print_log.examinee_no migration failed for ${unresolvedCount} rows.`);
      }
    }

    const foreignKeys = await query(`
      SELECT
        CONSTRAINT_NAME AS constraintName,
        COLUMN_NAME AS columnName,
        REFERENCED_TABLE_NAME AS referencedTableName,
        REFERENCED_COLUMN_NAME AS referencedColumnName
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'print_log'
        AND COLUMN_NAME IN ('candidate_id', 'examinee_no')
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);

    for (const foreignKey of foreignKeys) {
      await query(`ALTER TABLE print_log DROP FOREIGN KEY \`${foreignKey.constraintName}\``);
    }

    printHistoryColumns = await getTableColumns("print_log");

    if (hasColumn(printHistoryColumns, "candidate_id")) {
      await query(`ALTER TABLE print_log DROP COLUMN candidate_id`);
      printHistoryColumns = await getTableColumns("print_log");
    }

    if (!hasColumn(printHistoryColumns, "examinee_no")) {
      await query(`ALTER TABLE print_log ADD COLUMN examinee_no VARCHAR(30) NULL AFTER id`);
      printHistoryColumns = await getTableColumns("print_log");
    }

    const invalidPrintHistoryRows = await query(`
      SELECT COUNT(*) AS invalidCount
      FROM print_log ph
      WHERE ph.examinee_no IS NULL
         OR ph.examinee_no = ''
    `);
    const invalidCount = Number(invalidPrintHistoryRows[0]?.invalidCount || 0);

    if (invalidCount > 0) {
      throw new Error(`print_log.examinee_no validation failed for ${invalidCount} rows.`);
    }

    await query(`ALTER TABLE print_log MODIFY COLUMN examinee_no VARCHAR(30) NOT NULL`);

    const printHistoryIndexes = await query(`SHOW INDEX FROM print_log`);
    const legacyPrintHistoryIndexNames = Array.from(new Set(
      printHistoryIndexes
        .filter(
          (index) => String(index.Column_name || "") === "candidate_id" && String(index.Key_name || "") !== "PRIMARY",
        )
        .map((index) => String(index.Key_name || "")),
    ));

    for (const indexName of legacyPrintHistoryIndexNames) {
      if (!indexName) {
        continue;
      }

      await query(`ALTER TABLE print_log DROP INDEX \`${indexName}\``);
    }

    const hasExamineeNoIndex = printHistoryIndexes.some(
      (index) => String(index.Column_name || "") === "examinee_no",
    );
    const hasPrintedAtIndex = printHistoryIndexes.some(
      (index) => String(index.Column_name || "") === "printed_at",
    );

    if (!hasExamineeNoIndex) {
      await query(`ALTER TABLE print_log ADD KEY idx_print_log_examinee_no (examinee_no)`);
    }

    if (!hasPrintedAtIndex) {
      await query(`ALTER TABLE print_log ADD KEY idx_print_log_printed_at (printed_at)`);
    }

  }

  return Object.freeze({
    ensurePrintHistorySchema,
  });
}

module.exports = {
  createPrintHistorySchemaBootstrap,
};
