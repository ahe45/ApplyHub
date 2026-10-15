const assert = require('node:assert/strict');
const { apiRequest, apiRequestWithUploadProgress, apiRequestForBlobWithProgress } = require('../client/app/api-client');

const gatewayMessage = '서버 연결이 일시적으로 원활하지 않습니다. 잠시 후 다시 시도해 주세요.';
const html = '<!DOCTYPE html><html><head><title>502 Bad gateway</title></head><body>Cloudflare Host Error</body></html>';

async function run() {
  const original = { fetch: global.fetch, window: global.window, XMLHttpRequest: global.XMLHttpRequest };
  let reply;
  global.window = { localStorage: { getItem: () => null }, location: { origin: 'https://example.test' } };
  global.fetch = async () => new Response(reply.body, { status: reply.status, headers: { 'content-type': reply.type } });
  global.XMLHttpRequest = class {
    constructor() { this.listeners = {}; this.upload = { addEventListener() {} }; }
    open() {}
    setRequestHeader() {}
    getResponseHeader() { return reply.type; }
    addEventListener(name, listener) { this.listeners[name] = listener; }
    send() {
      this.status = reply.status;
      this.responseText = reply.body;
      this.response = new Blob([reply.body], { type: reply.type });
      queueMicrotask(() => this.listeners.load());
    }
  };
  try {
    for (const request of [apiRequest, apiRequestWithUploadProgress, apiRequestForBlobWithProgress]) {
      for (const type of ['text/html', 'text/plain', 'application/json']) {
        for (const status of [502, 503, 504, 520, 522, 524]) {
          reply = { status, type, body: html };
          await assert.rejects(request('/api/public/members/email-code'), error => {
            assert.equal(error.message, gatewayMessage);
            assert.equal(error.status, status);
            return true;
          });
        }
      }
      const duplicate = { error: '이미 가입된 이메일입니다.', code: 'MEMBER_EMAIL_EXISTS', fieldKey: 'email' };
      reply = { status: 409, type: 'application/json', body: JSON.stringify(duplicate) };
      await assert.rejects(request('/api/public/members/email-code'), error => {
        assert.equal(error.message, duplicate.error);
        assert.equal(error.code, duplicate.code);
        assert.equal(error.fieldKey, duplicate.fieldKey);
        return true;
      });
      reply = { status: 502, type: 'application/json', body: JSON.stringify({ error: '인증 메일을 발송하지 못했습니다.', code: 'EMAIL_SEND_FAILED' }) };
      await assert.rejects(request('/api/public/members/email-code'), error => error.message === '인증 메일을 발송하지 못했습니다.' && error.code === 'EMAIL_SEND_FAILED');
      for (const body of ['{broken JSON', '{"error":{"internal":"details"}}', '']) {
        reply = { status: 502, type: 'application/json', body };
        await assert.rejects(request('/api/public/members/email-code'), error => error.message === gatewayMessage && error.status === 502);
      }
      reply = { status: 400, type: 'text/plain', body: '잘못된 요청입니다.' };
      await assert.rejects(request('/api/example'), error => error.message === reply.body);
      reply = { status: 200, type: 'application/json', body: '{"verificationId":"test-id"}' };
      const result = await request('/api/public/members/email-code');
      if (request === apiRequestForBlobWithProgress) assert.equal(await result.blob.text(), reply.body);
      else assert.deepEqual(result, { verificationId: 'test-id' });
    }
    console.log('PASS: HTML gateway errors are readable; status, validation details, SMTP errors and successful responses are preserved for fetch, uploads and downloads');
  } finally {
    Object.assign(global, original);
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
