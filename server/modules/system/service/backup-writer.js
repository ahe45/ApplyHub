const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const archiver = require('archiver');
const { finalizeZipHeaders } = require('./zip-headers');

async function writeBackup({ rootDir, getPool, tables, assets, manifest, columnsFor, normalizeRow }) {
  const parent = path.join(rootDir, '.private', 'backup-work');
  await fs.promises.mkdir(parent, { recursive: true });
  const directory = await fs.promises.mkdtemp(path.join(parent, 'archive-'));
  const filePath = path.join(directory, 'backup.zip');
  const dispose = async () => { await fs.promises.unlink(filePath).catch(error => { if (error.code !== 'ENOENT') throw error; }); await fs.promises.rmdir(directory); };
  const archive = archiver('zip', { zlib: { level: 1 } });
  const output = fs.createWriteStream(filePath, { flags: 'wx' });
  const completion = pipeline(archive, output);
  let streamError, connection;
  completion.catch(error => { streamError = error; });
  archive.on('warning', error => archive.destroy(error));
  const quote = value => '`' + String(value).replaceAll('`','``') + '`';
  async function append(source, name) {
    if (streamError) throw streamError;
    await new Promise((resolve,reject) => {
      const clean = () => { archive.off('entry',done); archive.off('error',failed); output.off('error',failed); source?.off?.('error',failed); };
      const done = () => { clean(); resolve(); }, failed = error => { clean(); reject(error); };
      archive.once('entry',done); archive.once('error',failed); output.once('error',failed); source?.once?.('error',failed);
      archive.append(source,{name});
    });
  }
  try {
    if (manifest.databaseIncluded) {
      connection = await getPool().getConnection();
      await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
      const query = async (sql,params=[]) => (await connection.query(sql,params))[0];
      for (const table of tables) {
        const columns = await columnsFor(query,table.tableName);
        const entry = {tableName:table.tableName,rowCount:0,archivePath:`tables/${table.tableName}.json`};
        manifest.tables.push(entry);
        async function* jsonRows() {
          yield '[';
          let cursor = null, first = true;
          while (true) {
            const names=table.orderByColumns.map(quote);
            const where=cursor ? ` WHERE (${names.join(',')}) > (${names.map(()=>'?').join(',')})` : '';
            const rows=await query(`SELECT * FROM ${quote(table.tableName)}${where} ORDER BY ${names.join(',')} LIMIT 100`,cursor||[]);
            if (!rows.length) break;
            for (const row of rows) { yield (first?'':',') + JSON.stringify(normalizeRow(row,columns)); first=false;entry.rowCount++; }
            cursor=table.orderByColumns.map(key=>rows.at(-1)[key]);
          }
          yield ']';
        }
        await append(Readable.from(jsonRows()),entry.archivePath);
      }
      await connection.commit(); connection.release(); connection=null;
    }
    for (const file of assets) await append(fs.createReadStream(file.absolutePath),file.archivePath);
    await append(Buffer.from(JSON.stringify(manifest)),'manifest.json');
    await append(Buffer.from('ApplyHub backup. tables/*.json contains database rows; files/* contains attachments.'),'README.txt');
    await archive.finalize(); await completion;
    await finalizeZipHeaders(filePath);
    return {filePath,dispose};
  } catch (error) {
    archive.destroy();output.destroy();await completion.catch(()=>{});
    await dispose().catch(()=>{});throw error;
  } finally {
    if(connection){ await connection.rollback().catch(()=>{});connection.release(); }
  }
}
module.exports={writeBackup};
