const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const retiredTables = Object.freeze([
  'app_assign', 'examinee',
  'pdf_audit_logs', 'pdf_generation_batches', 'pdf_generation_histories',
  'pdf_templates', 'pdf_template_elements', 'pdf_template_pages', 'pdf_template_versions',
  'school_settings', 'surveys', 'survey_admins', 'survey_answers', 'survey_questions', 'survey_responses',
]);
const renamedMetaColumns = Object.freeze({
  promoted_examinee_no: 'examinee_no',
  promotion_override_json: 'field_overrides_json',
});
const identifier = value => '`' + String(value).replaceAll('`', '``') + '`';
const legacyTableNames = Object.freeze({
  applicant_form_fields: 'app_form', applicant_submission_meta: 'app_meta',
  applicant_submissions: 'app_subm', applicant_recruitment_units: 'app_unit',
  applicant_email_verifications: 'app_email_log', print_history: 'print_log',
});

function normalizeLegacyBackupRow(tableName, row) {
  if (tableName !== 'app_meta' || !row || typeof row !== 'object' || Array.isArray(row)) return row;
  const next = { ...row };
  for (const [oldName, newName] of Object.entries(renamedMetaColumns)) {
    if (Object.hasOwn(next, oldName)) {
      if (Object.hasOwn(next, newName) && next[newName] != null && next[oldName] != null && next[newName] !== next[oldName]) {
        throw new Error(`Conflicting backup columns: ${oldName} and ${newName}.`);
      }
      next[newName] = next[newName] ?? next[oldName];
      delete next[oldName];
    }
  }
  delete next.promoted_at;
  return next;
}

async function getColumns(connection, table) {
  const [rows] = await connection.query('SELECT COLUMN_NAME name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION', [table]);
  return rows.map(row => row.name);
}

async function findRetiredTables(connection) {
  const [rows] = await connection.query("SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'");
  const result = rows.filter(row => retiredTables.includes(row.name)).map(row => row.name);
  // Earlier answer-layout migrations left a copy of the original table behind.
  for (const row of rows.filter(row => /^app_subm_legacy_\d+$/.test(row.name))) {
    if ((await getColumns(connection, row.name)).includes('answers_json')) result.push(row.name);
  }
  return result;
}

async function getDropOrder(connection, tables) {
  const selected = new Set(tables);
  const [[{ databaseName }]] = await connection.query('SELECT DATABASE() AS databaseName');
  const [references] = await connection.query('SELECT TABLE_SCHEMA sourceDb, TABLE_NAME sourceTable, REFERENCED_TABLE_NAME targetTable FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA = DATABASE()');
  for (const reference of references) {
    if (selected.has(reference.targetTable) && (reference.sourceDb !== databaseName || !selected.has(reference.sourceTable))) {
      // print_log's historical examinee foreign key is removed by its own migration first.
      if (reference.sourceDb === databaseName && ['print_log', 'print_history'].includes(reference.sourceTable) && reference.targetTable === 'examinee') continue;
      throw new Error(`Cannot remove ${reference.targetTable}: it is referenced by ${reference.sourceDb}.${reference.sourceTable}.`);
    }
  }
  const order = [];
  while (selected.size) {
    const leaf = [...selected].find(table => !references.some(ref => ref.targetTable === table && ref.sourceTable !== table && selected.has(ref.sourceTable)));
    if (!leaf) throw new Error('Retired tables have circular foreign keys; automatic cleanup was stopped.');
    order.push(leaf);
    selected.delete(leaf);
  }
  return order;
}

async function writeSchemaSnapshot(connection, rootDir, tableNames) {
  const [[{ databaseName, timeZone }]] = await connection.query('SELECT DATABASE() databaseName, @@session.time_zone timeZone');
  const folder = path.join(rootDir, '.private', 'schema-backups');
  fs.mkdirSync(folder, { recursive: true });
  const name = `${databaseName.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}-${crypto.randomUUID()}`;
  const backupPath = path.join(folder, `${name}.sql`);
  const descriptor = fs.openSync(backupPath, 'wx');
  const digest = crypto.createHash('sha256');
  const tables = [];
  const write = text => { fs.writeSync(descriptor, text, null, 'utf8'); digest.update(text, 'utf8'); };
  try {
    await connection.query("SET time_zone = '+00:00'");
    await connection.beginTransaction();
    write('-- ApplyHub snapshot before schema cleanup. Restore into a separate database to recover old data.\n');
    write("SET @saved_fk = @@FOREIGN_KEY_CHECKS, @saved_tz = @@time_zone;\nSET FOREIGN_KEY_CHECKS = 0;\nSET time_zone = '+00:00';\nSET NAMES utf8mb4;\n");
    for (const table of [...new Set(tableNames)]) {
      const columns = await getColumns(connection, table);
      if (!columns.length) continue;
      const [triggers] = await connection.query('SELECT TRIGGER_NAME name FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE = ?', [table]);
      if (triggers.length) throw new Error(`Table ${table} has triggers; automatic schema cleanup was stopped.`);
      const [[definition]] = await connection.query(`SHOW CREATE TABLE ${identifier(table)}`);
      write(`\nDROP TABLE IF EXISTS ${identifier(table)};\n${definition['Create Table']};\n`);
      const select = columns.map(column => `HEX(CAST(${identifier(column)} AS BINARY)) AS ${identifier(column)}`).join(', ');
      let rowCount = 0;
      for (;;) {
        const [rows] = await connection.query(`SELECT ${select} FROM ${identifier(table)} LIMIT 500 OFFSET ?`, [rowCount]);
        for (const row of rows) {
          const values = columns.map(column => row[column] == null ? 'NULL' : `X'${row[column]}'`);
          write(`INSERT INTO ${identifier(table)} (${columns.map(identifier).join(', ')}) VALUES (${values.join(', ')});\n`);
        }
        rowCount += rows.length;
        if (rows.length < 500) break;
      }
      tables.push({ name: table, rowCount });
    }
    write('\nSET FOREIGN_KEY_CHECKS = @saved_fk;\nSET time_zone = @saved_tz;\n');
    await connection.commit();
    fs.fsyncSync(descriptor);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    fs.closeSync(descriptor);
    await connection.query('SET time_zone = ?', [timeZone]);
  }
  const sha256 = digest.digest('hex');
  const verification = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(backupPath)) verification.update(chunk);
  if (verification.digest('hex') !== sha256) throw new Error('Schema snapshot verification failed; cleanup was stopped.');
  fs.writeFileSync(path.join(folder, `${name}.json`), JSON.stringify({ databaseName, sha256, tables }, null, 2), { flag: 'wx' });
  console.log(`Schema snapshot saved: ${backupPath}`);
  return backupPath;
}

async function maintainApplicationSchema({ connection, rootDir, initialize }) {
  const [[{ databaseName }]] = await connection.query('SELECT DATABASE() databaseName');
  const lock = 'applyhub-schema-' + crypto.createHash('sha256').update(databaseName).digest('hex').slice(0, 32);
  const [[{ acquired }]] = await connection.query('SELECT GET_LOCK(?, 30) acquired', [lock]);
  if (Number(acquired) !== 1) throw new Error('Another ApplyHub schema update is running. Try again after it finishes.');
  const backups = [];
  try {
    const aliases = [];
    for (const [oldName, newName] of Object.entries(legacyTableNames)) {
      if (!(await getColumns(connection, oldName)).length) continue;
      if ((await getColumns(connection, newName)).length) throw new Error(`Both ${oldName} and ${newName} exist; resolve duplicate tables before migration.`);
      aliases.push([oldName, newName]);
    }
    const metaSource = aliases.find(([, name]) => name === 'app_meta')?.[0] || 'app_meta';
    const submissionSource = aliases.find(([, name]) => name === 'app_subm')?.[0] || 'app_subm';
    const columns = await getColumns(connection, metaSource);
    const oldColumns = [...Object.keys(renamedMetaColumns), 'promoted_at'].filter(column => columns.includes(column));
    for (const [oldName, newName] of Object.entries(renamedMetaColumns)) {
      if (columns.includes(oldName) && columns.includes(newName)) throw new Error(`Both ${oldName} and ${newName} exist; resolve the duplicate columns before migration.`);
    }
    const retired = await findRetiredTables(connection);
    await getDropOrder(connection, retired);
    const legacyAnswers = (await getColumns(connection, submissionSource)).includes('answers_json');
    const backedUpTables = new Set();
    if (oldColumns.length || retired.length || legacyAnswers || aliases.length) {
      const affected = [...retired, 'app_meta', 'app_subm', 'print_log', ...aliases.map(([oldName]) => oldName)];
      backups.push(await writeSchemaSnapshot(connection, rootDir, affected));
      affected.forEach(table => backedUpTables.add(table));
    }
    for (const [oldName, newName] of aliases) await connection.query(`RENAME TABLE ${identifier(oldName)} TO ${identifier(newName)}`);
    for (const [oldName, newName] of Object.entries(renamedMetaColumns)) {
      if (!columns.includes(oldName)) continue;
      const type = newName === 'examinee_no' ? 'VARCHAR(30)' : 'MEDIUMTEXT';
      await connection.query(`ALTER TABLE app_meta CHANGE COLUMN ${identifier(oldName)} ${identifier(newName)} ${type} NULL`);
    }
    if (columns.includes('promoted_at')) await connection.query('ALTER TABLE app_meta DROP COLUMN promoted_at');
    if (columns.length) {
      const [indexes] = await connection.query('SHOW INDEX FROM app_meta');
      if (indexes.some(index => index.Key_name === 'idx_app_meta_promoted')) {
        await connection.query('ALTER TABLE app_meta DROP INDEX idx_app_meta_promoted, ADD KEY idx_app_meta_examinee_no (examinee_no)');
      }
    }
    await initialize();
    const remainingRetired = await findRetiredTables(connection);
    const newlyRetired = remainingRetired.filter(table => !backedUpTables.has(table));
    if (newlyRetired.length) backups.push(await writeSchemaSnapshot(connection, rootDir, newlyRetired));
    const dropOrder = await getDropOrder(connection, remainingRetired);
    for (const table of dropOrder) await connection.query(`DROP TABLE ${identifier(table)}`);
    if (dropOrder.length) console.log(`Removed unused tables: ${dropOrder.join(', ')}`);
    return { backups, removedTables: dropOrder, renamedColumns: oldColumns.filter(column => column !== 'promoted_at') };
  } finally {
    await connection.query('SELECT RELEASE_LOCK(?)', [lock]);
  }
}

module.exports = { maintainApplicationSchema, normalizeLegacyBackupRow, retiredTables };
