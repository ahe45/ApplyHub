// Current end-to-end flows each own a disposable database and server.
const {spawnSync} = require('node:child_process');
const path = require('node:path');
for (const args of [['scripts/verification-mail-test.js'], ['scripts/template-tags-test.js'], ['scripts/membership-smoke-test.js', '--application-core'], ['scripts/membership-smoke-test.js', '--document-settings'], ['scripts/archive-job-behavior-test.js'], ['scripts/membership-smoke-test.js', '--archive'], ['scripts/membership-smoke-test.js', '--submission-tickets']]) {
  const result = spawnSync(process.execPath, args, {cwd: path.resolve(__dirname, '..'), stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('PASS: current application, documents, downloads, ticket and template editor flows');
