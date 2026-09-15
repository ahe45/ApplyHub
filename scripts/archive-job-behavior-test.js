const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const AdmZip = require('adm-zip');
const { createApplicantArchiveJobs } = require('../server/modules/applications/archive-jobs');
const naming = require('../shared/domain/applicant-archive');
const { createApplicantRoutes } = require('../server/http/routes/applications');

async function run() {
  const error = (statusCode, message) => Object.assign(new Error(message), { statusCode });
  let release;
  const pause = new Promise(resolve => { release = resolve; });
  const jobs = createApplicantArchiveJobs({ ttlMs: 1000,
    createHttpError: error, query: async () => [{ id: 1 }, { id: 2 }],
    getSubmission: async id => {
      await pause;
      return { id, name: '../동명이인\\', answerItems: [{ inputType: 'file', fieldKey: 'file', questionText: '같은서류', value: { hasFile: true } }] };
    },
    getFile: async id => ({ fileName: 'original.PDF', fileBlob: Buffer.from(`file-${id}`) }),
    getPhoto: async () => { throw error(404, 'No photo'); },
  });
  const job = await jobs.create({ ...naming.defaults, scope: 'all', photos: false, groupByApplicant: true, folderPattern: '{이름}', documentPattern: '{서류명}' }, 'owner');
  await assert.rejects(() => jobs.create({ ...naming.defaults, scope: 'all' }, 'owner'), { statusCode: 409 });
  assert.throws(() => jobs.status(job.id, 'other'), { statusCode: 404 });
  release();
  for (let tries = 0; jobs.status(job.id, 'owner').status !== 'ready'; tries++) {
    assert(tries < 100); await new Promise(resolve => setTimeout(resolve, 10));
  }
  const chunks = [];
  const response = new Writable({ write(chunk, encoding, callback) { chunks.push(chunk); callback(); } });
  response.writeHead = (status, headers) => { assert.equal(status, 200); assert.equal(headers['Cache-Control'], 'no-store'); };
  await jobs.download(job.id, 'owner', response, () => 'attachment');
  const entries = new AdmZip(Buffer.concat(chunks)).getEntries().filter(entry => !entry.isDirectory);
  assert.equal(entries.length, 2);
  assert.equal(new Set(entries.map(entry => entry.entryName.split('/')[0])).size, 2, 'Duplicate applicant names get separate folders');
  assert(entries.every(entry => !entry.entryName.split('/').includes('..') && !entry.entryName.includes('\\')));
  assert.deepEqual(entries.map(entry => entry.getData().toString()).sort(), ['file-1', 'file-2']);
  const fallback = naming.formatName('{수험번호}', { id: 17 });
  assert.equal(fallback, '접수-000017');
  assert.throws(() => naming.normalizeOptions({ photos: false, documents: false }), /선택/);
  await new Promise(resolve => setTimeout(resolve, 1050));
  assert.throws(() => jobs.status(job.id, 'owner'), { statusCode: 404 });
  await assert.rejects(() => jobs.download(job.id, 'owner', response, () => ''), { statusCode: 404 });
  const routes = createApplicantRoutes({ createHttpError: error });
  const createRoute = routes.find(route => route.path === '/api/applicant-submissions/archive-jobs');
  await assert.rejects(() => createRoute.handler({ authenticatedAccount: { id: 'read-only', role: '조회용' } }), { statusCode: 403 });
  console.log('PASS: concurrent request guard, owner isolation, folder collisions, safe names, number fallback, ZIP streaming, expiry and read-only role restriction');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
