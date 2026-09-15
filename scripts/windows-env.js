const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const configurableKeys = new Set(['PORT', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']);

function encodeValue(key, value) {
  // Let the same parser used by the server verify quoting, including # and backslashes.
  const candidates = [value, `'${value}'`, `"${value}"`, '`' + value + '`'];
  for (const candidate of candidates) {
    const parsed = dotenv.parse(`${key}=${candidate}\n`);
    if (Object.keys(parsed).length === 1 && parsed[key] === value) return candidate;
  }
  throw new Error(`Cannot safely write ${key} to .env. Configure this value manually.`);
}

function updateEnvironment(source, updates) {
  for (const [key, value] of Object.entries(updates)) {
    if (!configurableKeys.has(key) || typeof value !== 'string' || /[\r\n]/.test(value)) {
      throw new Error(`Invalid environment field: ${key}`);
    }
  }
  const pending = new Map(Object.entries(updates));
  // Match dotenv's full assignments so existing quoted values and unrelated comments survive.
  const assignments = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;
  let result = source.replace(assignments, (assignment, key) => {
    if (!Object.hasOwn(updates, key)) return assignment;
    pending.delete(key);
    const leadingLines = assignment.match(/^\s*\n/)?.[0] || '';
    return `${leadingLines}${key}=${encodeValue(key, updates[key])}`;
  });
  for (const [key, value] of pending) result += `\n${key}=${encodeValue(key, value)}`;
  const parsed = dotenv.parse(result);
  for (const [key, value] of Object.entries(updates)) {
    if (parsed[key] !== value) throw new Error(`Could not verify ${key}; .env was not changed.`);
  }
  return result.replace(/\r?\n/g, '\r\n').replace(/(?:\r\n)*$/, '\r\n');
}

if (require.main === module) {
  try {
    const envPath = path.resolve(__dirname, '../.env');
    const source = fs.readFileSync(envPath, 'utf8');
    if (process.argv[2] === 'read') {
      const parsed = dotenv.parse(source);
      const json = JSON.stringify(Object.fromEntries([...configurableKeys].map(key => [key, parsed[key] || ''])));
      // Windows PowerShell 5.1 may decode native stdout using the system code page.
      process.stdout.write(json.replace(/[^\x00-\x7f]/g, character => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0')));
    } else if (process.argv[2] === 'write') {
      const payload = fs.readFileSync(0, 'utf8').trim();
      let updates;
      try { updates = JSON.parse(Buffer.from(payload, 'base64').toString('utf8')); }
      catch { throw new Error('Could not read the setup settings; .env was not changed.'); }
      fs.writeFileSync(envPath, updateEnvironment(source, updates), 'utf8');
      console.log('Server and database settings saved to .env.');
    } else {
      throw new Error('Expected read or write.');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { updateEnvironment };
