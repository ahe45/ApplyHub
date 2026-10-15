const assert = require('node:assert/strict');
const { createApplicantVerificationEmailSender } = require('../server/modules/applications/verification-mailer');

async function run() {
  const originalLog = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values);
  const env = { SMTP_HOST: 'smtp.example.test', SMTP_USER: 'sender@example.test', SMTP_PASS: 'private-password', SMTP_FROM: 'sender@example.test', SMTP_PORT: '465' };
  const delivery = { email: 'recipient@example.test', codeValue: '987654', expiresAt: new Date() };
  const rejection = Object.assign(new Error('internal error, not for applicants'), {
    code: 'EMESSAGE', responseCode: 550, command: 'DATA',
    response: '550 5.7.1 Message rejected by policy\r\nsender@example.test recipient@example.test 987654 private-password',
  });
  const mailer = { createTransport: () => ({ verify: async () => {}, sendMail: async () => { throw rejection; } }) };
  try {
    const sender = createApplicantVerificationEmailSender({ env, mailer });
    await assert.rejects(sender(delivery), error => error.errorCode === 'APPLICANT_VERIFICATION_EMAIL_SEND_FAILED' && !error.message.includes('5.7.1'));
    assert.equal(logs[0][0], 'Verification SMTP send failed:');
    const details = JSON.parse(logs[0][1]);
    assert.equal(details.code, 'EMESSAGE');
    assert.equal(details.responseCode, 550);
    assert.equal(details.command, 'DATA');
    assert(details.response.includes('550 5.7.1 Message rejected by policy'));
    for (const secret of [env.SMTP_USER, env.SMTP_PASS, delivery.email, delivery.codeValue]) assert(!logs[0][1].includes(secret));
    assert(!/[\r\n]/.test(details.response));
    rejection.response = '550 5.7.0 no permitted from-header address, address: sender@example.test';
    await assert.rejects(sender(delivery), error => error.errorCode === 'APPLICANT_VERIFICATION_EMAIL_SENDER_NOT_ALLOWED');
    rejection.response = '550 5.7.1 ' + 'x'.repeat(2000);
    await assert.rejects(sender(delivery));
    assert.equal(JSON.parse(logs.at(-1)[1]).response.length, 1000);
    const unavailable = createApplicantVerificationEmailSender({ env, mailer: { createTransport: () => ({ verify: async () => { throw Object.assign(new Error('private'), { code: 'EAUTH', responseCode: 535, command: 'AUTH PLAIN', response: '535 Authentication failed for sender@example.test' }); } }) } });
    await assert.rejects(unavailable(delivery), error => error.errorCode === 'APPLICANT_VERIFICATION_EMAIL_NOT_AVAILABLE');
    assert.equal(logs.at(-1)[0], 'Verification SMTP check failed:');
    assert.equal(JSON.parse(logs.at(-1)[1]).command, 'AUTH PLAIN');
  } finally { console.error = originalLog; }
  console.log('PASS: SMTP rejection reason and command logged, sensitive values masked, applicant errors preserved');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
