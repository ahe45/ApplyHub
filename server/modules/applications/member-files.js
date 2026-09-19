const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function createMemberFileStorage(rootDir = process.cwd()) {
  const directory = path.join(rootDir, 'uploads', 'file', 'members');
  function filePath(key) {
    if (!/^member-[a-f0-9-]{36}\.bin$/.test(String(key))) throw new Error('Invalid member attachment key');
    return path.join(directory, key);
  }
  async function store(profile = {}) {
    const next = { ...profile }, keys = [];
    try {
      for (const [key, value] of Object.entries(profile)) {
        if (!value || typeof value !== 'object' || typeof value.base64 !== 'string') continue;
        const buffer = Buffer.from(value.base64, 'base64');
        const storageKey = `member-${randomUUID()}.bin`;
        keys.push(storageKey);
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(filePath(storageKey), buffer, { flag: 'wx' });
        next[key] = { storageKey, fileName: String(value.fileName || '첨부파일'), mimeType: String(value.mimeType || 'application/octet-stream'), size: buffer.length, hasFile: true };
      }
      return { profile: next, rollback: () => Promise.all(keys.map(key => fs.unlink(filePath(key)).catch(error => { if (error.code !== 'ENOENT') throw error; }))) };
    } catch (error) {
      await Promise.all(keys.map(key => fs.unlink(filePath(key)).catch(() => {})));
      throw error;
    }
  }
  async function migrate(query) {
    let last = 0;
    while (true) {
      const rows = await query('SELECT id, profile_json FROM applicant_members WHERE id > ? AND profile_json LIKE ? ORDER BY id LIMIT 50', [last, '%"base64"%']);
      if (!rows.length) break;
      for (const row of rows) {
        const stored = await store(JSON.parse(row.profile_json));
        try {
          const result = await query('UPDATE applicant_members SET profile_json = ? WHERE id = ? AND profile_json = ?', [JSON.stringify(stored.profile), row.id, row.profile_json]);
          if (!result.affectedRows) await stored.rollback();
        } catch (error) { await stored.rollback(); throw error; }
        last = row.id;
      }
    }
  }
  async function read(value) {
    if (value?.storageKey) return fs.readFile(filePath(value.storageKey));
    if (typeof value?.base64 === 'string') return Buffer.from(value.base64, 'base64');
    return null;
  }
  return { store, migrate, read };
}
module.exports = { createMemberFileStorage };
