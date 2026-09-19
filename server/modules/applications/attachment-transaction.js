const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

// The caller holds the application's database row lock until commit or rollback.
// Renames keep incomplete writes away from readers; backups allow a DB failure to restore files.
async function stageAttachments(records = []) {
  const changes = [];
  async function rollback() {
    for (const change of [...changes].reverse()) {
      if (change.installed) await fs.unlink(change.target).catch(error => { if (error.code !== 'ENOENT') throw error; });
      if (change.backedUp) await fs.rename(change.backup, change.target);
      await fs.unlink(change.temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
  }
  try {
    for (const record of records.filter(Boolean)) {
      const buffer = record.photoBuffer || record.fileBuffer;
      if (!record.filePath || !Buffer.isBuffer(buffer) || !buffer.length) continue;
      const target = record.filePath, token = randomUUID();
      const change = {target, temporary: target + '.' + token + '.pending', backup: target + '.' + token + '.previous'};
      changes.push(change);
      await fs.mkdir(path.dirname(target), {recursive:true});
      await fs.writeFile(change.temporary, buffer, {flag:'wx'});
      try { await fs.rename(target, change.backup); change.backedUp = true; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      await fs.rename(change.temporary, target); change.installed = true;
    }
    return {rollback, async finalize() {
      // Failure to remove a backup must never turn a committed save into a retry.
      await Promise.all(changes.filter(change => change.backedUp).map(change => fs.unlink(change.backup).catch(() => {})));
    }};
  } catch (error) { await rollback(); throw error; }
}
module.exports = {stageAttachments};
