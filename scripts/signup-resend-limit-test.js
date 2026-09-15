const assert = require('node:assert/strict');
const { createApplicantMembershipService } = require('../server/modules/applications/membership');
async function run() {
  const now = Date.now;
  let time = now(), writes = 0;
  Date.now = () => time;
  try {
    const service = createApplicantMembershipService({
      query: async () => { writes++; return []; },
      createHttpError: (status, message) => Object.assign(new Error(message), { status }),
      env: { NODE_ENV: 'development', APPLICANT_SIGNUP_CODE_PREVIEW: 'true' },
    });
    await service.sendCode({ email: 'resend@example.com' }, 'test-ip');
    await assert.rejects(service.sendCode({ email: 'resend@example.com' }, 'test-ip'), error => error.status === 429);
    time += 9999;
    await assert.rejects(service.sendCode({ email: 'resend@example.com' }, 'test-ip'), error => error.status === 429);
    time += 1;
    await service.sendCode({ email: 'resend@example.com' }, 'test-ip');
    assert.equal(writes, 4, 'two successful sends only');
    for (let i = 0; i < 11; i++) await service.sendCode({ email: `limit${i}@example.com` }, 'test-ip');
    await assert.rejects(service.sendCode({ email: 'over-limit@example.com' }, 'test-ip'), error => error.status === 429);
    console.log('PASS: server resend blocked before 10 seconds, allowed at 10 seconds; IP request limit retained');
  } finally { Date.now = now; }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
