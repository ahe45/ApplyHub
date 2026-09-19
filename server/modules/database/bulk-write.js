// Bound both parameter count and bytes: answers can contain large legacy values.
async function insertRows(connection, table, columns, rows, suffix = '', { maxRows = 200, maxBytes = 1024 * 1024 } = {}) {
  const quote = value => '`' + String(value).replaceAll('`', '``') + '`';
  let batch = [], bytes = 0;
  async function flush() {
    if (!batch.length) return;
    await connection.query(`INSERT INTO ${quote(table)} (${columns.map(quote).join(',')}) VALUES ${batch.map(() => '(' + columns.map(() => '?').join(',') + ')').join(',')} ${suffix}`, batch.flat());
    batch = []; bytes = 0;
  }
  for (const row of rows) {
    const size = row.reduce((sum, value) => sum + (Buffer.isBuffer(value) ? value.length * 2 : Buffer.byteLength(String(value ?? ''))) + 16, 0);
    if (batch.length && (batch.length >= maxRows || bytes + size > maxBytes)) await flush();
    batch.push(row); bytes += size;
  }
  await flush();
}

module.exports = { insertRows };
