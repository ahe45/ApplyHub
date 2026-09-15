const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const dotenv = require('dotenv');
const { updateEnvironment } = require('./windows-env');

for (const [configured, expected] of [['', 'applyhub'], ['existing_database', 'existing_database']]) {
  const actual = execFileSync(process.execPath, ['-e', 'process.stdout.write(require("./db").getDbConfig().database)'], {
    cwd: path.resolve(__dirname, '..'), env: { ...process.env, DB_NAME: configured }, encoding: 'utf8',
  });
  assert.equal(actual, expected);
}
assert.equal(dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../.env.example'))).DB_NAME, 'applyhub');
console.log('PASS: ApplyHub default database and explicit database override');

const source = '# existing settings\nPORT=3000\nDB_USER=old\nDB_PASSWORD="old # value"\nSMTP_FROM_NAME="입학처"\nSMTP_PASS=keep-this\n';
for (const password of ['a # b', 'with\\backslash', 'has\'quote', 'has"quote', '한글 & % ! ^', ' spaces ', '', 'line\\ntext']) {
  const updated = updateEnvironment(source, { DB_PASSWORD: password, DB_USER: 'new-user', DB_HOST: '127.0.0.1' });
  const parsed = dotenv.parse(updated);
  assert.equal(parsed.DB_PASSWORD, password);
  assert.equal(parsed.DB_USER, 'new-user');
  assert.equal(parsed.DB_HOST, '127.0.0.1');
  assert.equal(parsed.SMTP_PASS, 'keep-this');
  assert.equal(parsed.SMTP_FROM_NAME, '입학처');
  assert(updated.includes('# existing settings'));
}
assert.throws(() => updateEnvironment(source, { SMTP_PASS: 'changed' }), /Invalid environment field/);
console.log('PASS: environment quoting and preservation of existing settings');

if (process.platform !== 'win32') {
  console.log('SKIP: batch execution requires Windows');
  process.exit(0);
}

const project = path.resolve(__dirname, '..');
const root = fs.mkdtempSync(path.join(project, '.tmp-windows-launchers-'));
const bin = path.join(root, 'test-bin');
fs.mkdirSync(bin);
fs.writeFileSync(path.join(bin, 'npm.cmd'), '@echo off\r\necho npm %*>> "%CD%\\npm-calls.log"\r\nif "%APPLYHUB_TEST_NPM_FAIL%"=="1" exit /b 7\r\nexit /b 0\r\n');
const env = { ...process.env, PATH: `${bin};${process.env.PATH}` };
const ignored = '.env\nnode_modules/\nlog/\nnpm-calls.log\n';

function fixture(name) {
  const dir = path.join(root, name + ' with spaces');
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'deploy'));
  for (const file of ['start-server.bat', 'update-server.bat']) fs.copyFileSync(path.join(project, file), path.join(dir, file));
  fs.writeFileSync(path.join(dir, '.gitignore'), ignored);
  fs.writeFileSync(path.join(dir, '.env'), 'DB_USER=test\n');
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: {} }));
  fs.mkdirSync(path.join(dir, 'node_modules'));
  fs.writeFileSync(path.join(dir, 'scripts/check-startup.js'), 'console.log("Test DB ready");\n');
  return dir;
}

function batch(dir, file, expected, extraEnv = {}, args = []) {
  const result = spawnSync('cmd.exe', ['/d', '/c', file, ...args], {
    cwd: dir, env: { ...env, ...extraEnv }, encoding: 'utf8', input: '\r\n\r\n', timeout: 30000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, expected, result.stdout + result.stderr);
  return result.stdout;
}

const normal = fixture('normal start');
assert.match(batch(normal, 'start-server.bat', 0), /Server process exited/);
assert.match(fs.readFileSync(path.join(normal, 'npm-calls.log'), 'utf8'), /npm start/);
assert.match(batch(normal, 'start-server.bat', 1, { APPLYHUB_TEST_NPM_FAIL: '1' }), /could not start/);
const failedDb = fixture('DB failure');
fs.writeFileSync(path.join(failedDb, 'scripts/check-startup.js'), 'console.error("Test DB failure"); process.exit(1);');
assert.match(batch(failedDb, 'start-server.bat', 1), /Test DB failure/);
assert(!fs.existsSync(path.join(failedDb, 'npm-calls.log')));

const setup = fixture('setup routing');
fs.writeFileSync(path.join(setup, 'deploy/setup-windows.ps1'), 'Write-Host "Test setup invoked"; exit 1');
assert.match(batch(setup, 'start-server.bat', 1, {}, ['--setup']), /Test setup invoked/);
fs.unlinkSync(path.join(setup, '.env'));
assert.match(batch(setup, 'start-server.bat', 1), /Test setup invoked/);
console.log('PASS: normal start, setup routing, DB failure and npm failure in paths with spaces');

function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
const seed = fixture('seed');
const remote = path.join(root, 'remote.git');
git(root, ['init', '--bare', remote]);
git(seed, ['init', '-b', 'main']);
git(seed, ['config', 'user.name', 'Launcher Test']);
git(seed, ['config', 'user.email', 'launcher@example.test']);
git(seed, ['add', '.']);
git(seed, ['commit', '-m', 'Initial fixture']);
git(seed, ['remote', 'add', 'origin', remote]);
git(seed, ['push', '-u', 'origin', 'main']);

function clone(name) {
  const dir = path.join(root, name + ' clone with spaces');
  git(root, ['clone', '--branch', 'main', remote, dir]);
  fs.writeFileSync(path.join(dir, '.env'), 'DB_USER=test\n');
  return dir;
}
const clean = clone('clean');
const diverged = clone('diverged');
git(diverged, ['config', 'user.name', 'Launcher Test']);
git(diverged, ['config', 'user.email', 'launcher@example.test']);
fs.writeFileSync(path.join(diverged, 'local-commit.txt'), 'local commit');
git(diverged, ['add', '.']);
git(diverged, ['commit', '-m', 'Local deployment commit']);
const dirty = clone('dirty');
fs.writeFileSync(path.join(dirty, 'local-change.txt'), 'keep me');
assert.match(batch(dirty, 'update-server.bat', 1), /Local changes found/);
assert(!fs.existsSync(path.join(dirty, 'npm-calls.log')));
const detached = clone('detached');
git(detached, ['checkout', '--detach']);
assert.match(batch(detached, 'update-server.bat', 1), /No branch is checked out/);
fs.writeFileSync(path.join(seed, 'remote-change.txt'), 'new version');
// The running launcher itself changes during the update; each step must still run once.
const launcherPath = path.join(seed, 'update-server.bat');
fs.writeFileSync(launcherPath, '@rem New launcher header\r\n'.repeat(80) + fs.readFileSync(launcherPath, 'utf8'));
git(seed, ['add', '.']);
git(seed, ['commit', '-m', 'Remote update']);
git(seed, ['push']);
assert.match(batch(clean, 'update-server.bat', 0), /update completed/);
assert.equal(fs.readFileSync(path.join(clean, 'remote-change.txt'), 'utf8'), 'new version');
assert.equal(git(clean, ['status', '--porcelain']), '');
assert.match(fs.readFileSync(path.join(clean, 'npm-calls.log'), 'utf8'), /npm ci[\s\S]*npm run db:setup/);
assert.equal(fs.readFileSync(path.join(clean, 'npm-calls.log'), 'utf8').match(/npm ci/g).length, 1);
assert.match(batch(diverged, 'update-server.bat', 1), /update failed/);
assert(!fs.existsSync(path.join(diverged, 'npm-calls.log')));
assert.match(batch(clean, 'update-server.bat', 1, { APPLYHUB_TEST_NPM_FAIL: '1' }), /update failed/);
console.log('PASS: self-update, fast-forward, divergent branch, local-change protection, detached branch, dependency failure and ignored logs');

for (const scenario of [
  { name: 'defaults', existing: true, answers: [['Q1.', ''], ['Q2.', ''], ['Q3.', '']], port: '3000', user: 'old', password: '한글 # value' },
  { name: 'custom port', existing: true, answers: [['Q1.', 'Y'], ['Q1-1.', '70000'], ['Q1-1.', '3100'], ['Q2.', ''], ['Q3.', '']], port: '3100', user: 'old', password: '한글 # value' },
  { name: 'first setup', existing: false, answers: [['Q1.', 'N'], ['Q2.', ''], ['Q2.', 'applyhub_app'], ['Q3.', ''], ['Q3.', '새 비밀번호 # !']], port: '3000', user: 'applyhub_app', password: '새 비밀번호 # !' },
]) {
const psSetup = fixture(`PowerShell setup ${scenario.name}`);
fs.copyFileSync(path.join(project, 'deploy/setup-windows.ps1'), path.join(psSetup, 'deploy/setup-windows.ps1'));
fs.copyFileSync(path.join(project, 'scripts/windows-env.js'), path.join(psSetup, 'scripts/windows-env.js'));
if (scenario.existing) {
  fs.writeFileSync(path.join(psSetup, '.env'), source.replace('PORT=3000', 'PORT=4000').replace('old # value', '한글 # value') + 'DB_HOST=old-host\nDB_PORT=3307\nDB_NAME=old_database\n');
} else {
  fs.unlinkSync(path.join(psSetup, '.env'));
  fs.copyFileSync(path.join(project, '.env.example'), path.join(psSetup, '.env.example'));
}
fs.writeFileSync(path.join(psSetup, 'package.json'), JSON.stringify({ name: 'launcher-test', version: '1.0.0', scripts: { 'db:setup': 'node scripts/check-startup.js' } }));
fs.writeFileSync(path.join(psSetup, 'package-lock.json'), JSON.stringify({ name: 'launcher-test', version: '1.0.0', lockfileVersion: 3, packages: { '': { name: 'launcher-test', version: '1.0.0' } } }));
// Only prompt input is replaced. The real setup, npm ci and environment writer run in this fixture.
fs.writeFileSync(path.join(psSetup, 'answers.json'), JSON.stringify(scenario.answers.map(([prefix, value]) => ({ prefix, value }))));
fs.writeFileSync(path.join(psSetup, 'test-setup.ps1'), `
$ErrorActionPreference = 'Stop'
$global:answers = New-Object System.Collections.Queue
foreach ($answer in (Get-Content -LiteralPath "$PSScriptRoot\\answers.json" -Raw -Encoding UTF8 | ConvertFrom-Json)) { $global:answers.Enqueue($answer) }
function global:Read-Host {
  param($Prompt, [switch]$AsSecureString)
  if ($global:answers.Count -eq 0) { throw "Unexpected prompt: $Prompt" }
  $answer = $global:answers.Dequeue()
  if (-not $Prompt.StartsWith($answer.prefix)) { throw "Unexpected prompt: $Prompt" }
  if ([bool]$AsSecureString -ne ($answer.prefix -eq 'Q3.')) { throw 'Password prompt must be secure' }
  if ($AsSecureString) {
    $secureValue = New-Object Security.SecureString
    foreach ($character in $answer.value.ToCharArray()) { $secureValue.AppendChar($character) }
    return $secureValue
  }
  return $answer.value
}
& "$PSScriptRoot\\deploy\\setup-windows.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if ($global:answers.Count -ne 0) { throw 'Expected prompts were not asked' }
`);
const ps = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(psSetup, 'test-setup.ps1')], { cwd: psSetup, env: process.env, encoding: 'utf8', timeout: 60000 });
assert.ifError(ps.error);
assert.equal(ps.status, 0, ps.stdout + ps.stderr);
const saved = dotenv.parse(fs.readFileSync(path.join(psSetup, '.env')));
assert.equal(saved.DB_PASSWORD, scenario.password);
assert.equal(saved.DB_USER, scenario.user);
assert.equal(saved.PORT, scenario.port);
assert.equal(saved.DB_HOST, '127.0.0.1');
assert.equal(saved.DB_PORT, '3306');
if (scenario.existing) {
assert.equal(saved.SMTP_FROM_NAME, '입학처');
assert.equal(saved.SMTP_PASS, 'keep-this');
}
assert.equal(saved.DB_NAME, 'applyhub');
assert(!fs.readFileSync(path.join(psSetup, 'log/setup-windows.log'), 'utf8').includes(scenario.password));
console.log(`PASS: Windows PowerShell ${scenario.name}, exact prompt flow, database defaults, password transport and log redaction`);
}
