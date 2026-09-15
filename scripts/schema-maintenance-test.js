const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');
const AdmZip = require('adm-zip');
const { getDbConfig } = require('../db');
const { maintainApplicationSchema, retiredTables } = require('../server/modules/database/schema-maintenance');
const { createSchemaQueryHelpers } = require('../server/modules/bootstrap/schema/helpers');
const { createApplicantSchemaBootstrap } = require('../server/modules/bootstrap/schema/applications');
const { createPrintHistorySchemaBootstrap } = require('../server/modules/bootstrap/schema/print-history');
const { createSystemBackupService } = require('../server/modules/system/service/backup');

async function run() {
  const database = `applyhub_schema_test_${Date.now()}`;
  const restoreDatabase = `${database}_restore`;
  const rootDir = fs.mkdtempSync(path.resolve(__dirname, '../.tmp-schema-maintenance-'));
  const connection = await mysql.createConnection(getDbConfig(false));
  const read = async (sql, params = []) => (await connection.query(sql, params))[0];
  const queryHelpers = createSchemaQueryHelpers({ query: read });
  const initialize = async () => {
    await createApplicantSchemaBootstrap({ ...queryHelpers, query: read }).ensureApplicantSchema();
    await createPrintHistorySchemaBootstrap({ ...queryHelpers, query: read }).ensurePrintHistorySchema();
    await connection.query(fs.readFileSync(path.resolve(__dirname, '../db/schema.sql'), 'utf8'));
  };
  try {
    await connection.query('CREATE DATABASE ?? CHARACTER SET utf8mb4', [database]);
    await connection.query('USE ??', [database]);
    await connection.query(`CREATE TABLE app_meta (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, member_id BIGINT UNSIGNED NULL,
      promoted_examinee_no VARCHAR(30), promotion_override_json MEDIUMTEXT, promoted_at DATETIME,
      KEY idx_app_meta_promoted(promoted_examinee_no))`);
    const overrides = JSON.stringify({ admission: '보정 전형' });
    await connection.query("INSERT INTO app_meta VALUES (7, NULL, '20260007', ?, '2020-01-02 03:04:05')", [overrides]);
    await connection.query(`CREATE TABLE examinee (id BIGINT UNSIGNED PRIMARY KEY, examinee_no VARCHAR(30))`);
    await connection.query("INSERT INTO examinee VALUES (7, '20260007')");
    await connection.query(`CREATE TABLE print_log (id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      candidate_id BIGINT UNSIGNED, print_count INT, printed_at DATETIME,
      CONSTRAINT legacy_candidate FOREIGN KEY(candidate_id) REFERENCES examinee(id))`);
    await connection.query("INSERT INTO print_log VALUES (1, 7, 3, '2020-01-02 03:04:05')");
    for (const table of retiredTables.filter(table => table !== 'examinee')) {
      await connection.query('CREATE TABLE ?? (id INT PRIMARY KEY, payload LONGBLOB)', [table]);
      await connection.query('INSERT INTO ?? VALUES (1, ?)', [table, Buffer.from('한글\0binary\xff')]);
    }
    await connection.query('ALTER TABLE pdf_template_pages ADD FOREIGN KEY(id) REFERENCES pdf_templates(id)');
    await connection.query('ALTER TABLE pdf_template_elements ADD FOREIGN KEY(id) REFERENCES pdf_template_pages(id)');
    await connection.query('CREATE TABLE unrelated_kept (id INT PRIMARY KEY)');
    await connection.query('INSERT INTO unrelated_kept VALUES (9)');

    const result = await maintainApplicationSchema({ connection, rootDir, initialize });
    assert.equal(result.removedTables.length, 15);
    assert.equal(result.backups.length, 1);
    const [meta] = await read('SELECT * FROM app_meta');
    assert.equal(meta.examinee_no, '20260007');
    assert.equal(meta.field_overrides_json, overrides);
    assert(!Object.hasOwn(meta, 'promoted_at'));
    assert(!Object.hasOwn(meta, 'promoted_examinee_no'));
    assert.equal((await read('SELECT examinee_no FROM print_log'))[0].examinee_no, '20260007');
    assert.equal((await read('SELECT * FROM unrelated_kept'))[0].id, 9);
    const second = await maintainApplicationSchema({ connection, rootDir, initialize });
    assert.deepEqual(second.backups, []);
    assert.deepEqual(second.removedTables, []);

    const snapshot = fs.readFileSync(result.backups[0]);
    const manifest = JSON.parse(fs.readFileSync(result.backups[0].replace(/\.sql$/, '.json')));
    assert.equal(crypto.createHash('sha256').update(snapshot).digest('hex'), manifest.sha256);
    await connection.query('CREATE DATABASE ?? CHARACTER SET utf8mb4', [restoreDatabase]);
    await connection.query('USE ??', [restoreDatabase]);
    await connection.query(snapshot.toString('utf8'));
    assert.equal((await read('SELECT promoted_examinee_no number FROM app_meta'))[0].number, '20260007');
    assert.equal((await read("SELECT DATE_FORMAT(promoted_at, '%Y-%m-%d %H:%i:%s') stamp FROM app_meta"))[0].stamp, '2020-01-02 03:04:05');
    assert.deepEqual((await read('SELECT payload FROM app_assign'))[0].payload, Buffer.from('한글\0binary\xff'));
    assert.equal((await read('SELECT candidate_id FROM print_log'))[0].candidate_id, 7);
    await connection.query('USE ??', [database]);
    console.log('PASS: 15 retired tables removed, current data/print history retained, unrelated table retained, repeatable migration and verified SQL snapshot restore');

    const backupService = createSystemBackupService({ fs, path, rootDir, databaseName: database, query: read,
      getPool: () => ({ getConnection: async () => ({ query: connection.query.bind(connection), beginTransaction: connection.beginTransaction.bind(connection), commit: connection.commit.bind(connection), rollback: connection.rollback.bind(connection), release() {} }) }),
      createHttpError: (statusCode, message, errorCode) => Object.assign(new Error(message), { statusCode, errorCode }),
    });
    const archive = await backupService.buildSystemBackupArchive({ includedAssetKeys: [] });
    const zip = new AdmZip(archive.archiveBuffer);
    const rows = JSON.parse(zip.readAsText('tables/app_meta.json'));
    for (const row of rows) {
      row.promoted_examinee_no = row.examinee_no; delete row.examinee_no;
      row.promotion_override_json = row.field_overrides_json; delete row.field_overrides_json;
      row.promoted_at = '2020-01-02 03:04:05';
    }
    zip.updateFile('tables/app_meta.json', Buffer.from(JSON.stringify(rows)));
    await connection.query("UPDATE app_meta SET examinee_no = 'changed', field_overrides_json = NULL");
    await backupService.restoreSystemBackupArchive(zip.toBuffer());
    assert.equal((await read('SELECT examinee_no FROM app_meta'))[0].examinee_no, '20260007');
    assert.equal((await read('SELECT field_overrides_json FROM app_meta'))[0].field_overrides_json, overrides);
    console.log('PASS: old ZIP backup restores into renamed columns');

    await connection.query('CREATE TABLE app_assign (id INT PRIMARY KEY)');
    await connection.query('CREATE TABLE external_link (id INT, FOREIGN KEY(id) REFERENCES app_assign(id))');
    await assert.rejects(() => maintainApplicationSchema({ connection, rootDir, initialize }), /referenced by/);
    assert(await queryHelpers.hasTable('app_assign'));
    await connection.query('DROP TABLE external_link');
    const blockedRoot = path.join(rootDir, 'blocked');
    fs.writeFileSync(blockedRoot, 'not a directory');
    await assert.rejects(() => maintainApplicationSchema({ connection, rootDir: blockedRoot, initialize }));
    assert(await queryHelpers.hasTable('app_assign'));
    console.log('PASS: foreign-key dependency and backup failure prevent deletion');

    await connection.query('ALTER TABLE app_meta CHANGE examinee_no promoted_examinee_no VARCHAR(30), CHANGE field_overrides_json promotion_override_json MEDIUMTEXT, ADD promoted_at DATETIME');
    await connection.query('RENAME TABLE app_meta TO applicant_submission_meta, app_subm TO applicant_submissions');
    await maintainApplicationSchema({ connection, rootDir, initialize });
    assert.equal((await read('SELECT examinee_no FROM app_meta'))[0].examinee_no, '20260007');
    assert(!await queryHelpers.hasTable('applicant_submission_meta'));

    await connection.query('DROP DATABASE ??', [restoreDatabase]);
    await connection.query('CREATE DATABASE ?? CHARACTER SET utf8mb4', [restoreDatabase]);
    await connection.query('USE ??', [restoreDatabase]);
    await connection.query(`CREATE TABLE applicant_submissions (
      id BIGINT UNSIGNED PRIMARY KEY, applicant_name VARCHAR(100), email VARCHAR(255), password_hash VARCHAR(255),
      status VARCHAR(30), answers_json MEDIUMTEXT, promoted_examinee_no VARCHAR(30), photo_name VARCHAR(255),
      photo_mime VARCHAR(255), photo_blob LONGBLOB, created_at DATETIME, updated_at DATETIME, promoted_at DATETIME)`);
    await connection.query("INSERT INTO applicant_submissions VALUES (9, '이전 접수', 'legacy@example.test', 'hash', 'submitted', ?, '20260009', '', '', NULL, '2020-01-02 03:04:05', '2020-01-02 03:04:05', NULL)", [JSON.stringify([{fieldKey: 'legacy-name', value: '이전 접수', inputType: 'text'}])]);
    const oldest = await maintainApplicationSchema({ connection, rootDir, initialize });
    assert.equal((await read('SELECT examinee_no FROM app_meta'))[0].examinee_no, '20260009');
    assert.equal((await read('SELECT answer_data FROM app_subm'))[0].answer_data, '이전 접수');
    assert(oldest.removedTables.some(name => name.startsWith('app_subm_legacy_')));
    console.log('PASS: older table aliases and monolithic answer storage migrate without losing answers');
  } finally {
    // Both names are generated here; no configured application database is dropped.
    for (const name of [restoreDatabase, database]) {
      assert(/^applyhub_schema_test_\d+(?:_restore)?$/.test(name));
      await connection.query('DROP DATABASE IF EXISTS ??', [name]);
    }
    await connection.end();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
