const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const archiver = require('archiver');
const naming = require('../../../shared/domain/applicant-archive');

function createApplicantArchiveJobs({ query, getSubmission, getPhoto, getFile, createHttpError, ttlMs = 60 * 60 * 1000 }) {
  const jobs = new Map();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'admitcard-archives-'));
  const activeStates = new Set(['pending', 'building']);
  fs.writeFileSync(path.join(directory, '.archive-owner'), String(process.pid));
  async function cleanAbandonedArchives() {
    // A stopped server cannot run its expiry timers. Remove only this feature's marked,
    // expired ZIP files; never traverse links or recursively delete temporary directories.
    const temporaryRoot = path.resolve(os.tmpdir());
    for (const entry of await fs.promises.readdir(temporaryRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^admitcard-archives-[a-zA-Z0-9]+$/.test(entry.name)) continue;
      const candidate = path.resolve(temporaryRoot, entry.name);
      if (candidate === directory || path.dirname(candidate) !== temporaryRoot) continue;
      try {
        const pid = Number(await fs.promises.readFile(path.join(candidate, '.archive-owner'), 'utf8'));
        if (!Number.isSafeInteger(pid) || pid <= 0) continue;
        try { process.kill(pid, 0); continue; } catch (error) { if (error.code !== 'ESRCH') continue; }
        for (const file of await fs.promises.readdir(candidate, { withFileTypes: true })) {
          if (!file.isFile() || !/^[a-f0-9-]{36}\.zip$/.test(file.name)) continue;
          const filePath = path.resolve(candidate, file.name);
          if (path.dirname(filePath) !== candidate) continue;
          const stat = await fs.promises.stat(filePath);
          if (Date.now() - stat.mtimeMs > ttlMs) await fs.promises.rm(filePath, { force: true });
        }
        if ((await fs.promises.readdir(candidate)).every(name => name === '.archive-owner')) {
          await fs.promises.rm(path.join(candidate, '.archive-owner'), { force: true });
          await fs.promises.rmdir(candidate);
        }
      } catch (error) { if (!['ENOENT', 'ENOTEMPTY', 'EPERM', 'EBUSY'].includes(error.code)) console.error(error); }
    }
  }
  cleanAbandonedArchives().catch(console.error);
  setInterval(() => cleanAbandonedArchives().catch(console.error), 10 * 60 * 1000).unref();
  function snapshot(job) {
    return { id: job.id, status: job.status, total: job.ids.length, completed: job.completed,
      files: job.files, missing: job.missing, message: job.message, expiresAt: job.expiresAt };
  }
  function getJob(id, owner) {
    const job = jobs.get(id);
    if (!job || job.owner !== String(owner) || (job.expiresAt && job.expiresAt <= Date.now())) throw createHttpError(404, '다운로드 작업이 없거나 만료되었습니다. 다시 준비해 주세요.');
    return job;
  }
  async function discard(job) {
    jobs.delete(job.id);
    // Only remove the exact generated ZIP in this service's private temporary directory.
    if (path.dirname(path.resolve(job.filePath)) !== path.resolve(directory)) throw new Error('Invalid archive path');
    try { await fs.promises.rm(job.filePath, { force: true }); }
    catch (error) {
      if (!['EPERM', 'EBUSY'].includes(error.code)) throw error;
      setTimeout(() => discard(job).catch(console.error), 60000).unref();
    }
  }
  function expire(job) {
    job.expiresAt = Date.now() + ttlMs;
    setTimeout(() => discard(job).catch(console.error), ttlMs).unref();
  }
  function uniqueName(base, extension, used) {
    let name = base + extension, count = 1;
    while (used.has(name.toLocaleLowerCase('en-US'))) name = `${base}_${++count}${extension}`;
    used.add(name.toLocaleLowerCase('en-US'));
    return name;
  }
  async function build(job) {
    job.status = 'building';
    const archive = archiver('zip', { store: true });
    const output = fs.createWriteStream(job.filePath, { flags: 'wx' });
    let streamError;
    const complete = pipeline(archive, output);
    complete.catch(error => { streamError = error; });
    archive.on('warning', error => archive.destroy(error));
    const folders = new Set(), paths = new Set();
    async function append(buffer, name) {
      if (streamError) throw streamError;
      // Wait for each entry before reading the next file, keeping only one file buffer in memory.
      await new Promise((resolve, reject) => {
        const cleanup = () => { archive.off('entry', onEntry); archive.off('error', onError); output.off('error', onError); };
        const onEntry = () => { cleanup(); resolve(); };
        const onError = error => { cleanup(); reject(error); };
        archive.once('entry', onEntry); archive.once('error', onError); output.once('error', onError);
        archive.append(buffer, { name });
      });
    }
    try {
      for (const id of job.ids) {
        const submission = await getSubmission(id, { required: false });
        if (!submission) { job.missing++; job.completed++; continue; }
        const folder = job.options.groupByApplicant ? uniqueName(naming.formatName(job.options.folderPattern, submission), '', folders) + '/' : '';
        const candidates = [];
        if (job.options.documents) {
          for (const answer of submission.answerItems || []) {
            if (answer.inputType === 'file' && answer.value?.hasFile) candidates.push({ kind: 'document', key: answer.fieldKey, label: answer.questionText || answer.fieldKey });
          }
        }
        if (job.options.photos) candidates.push({ kind: 'photo', label: '수험생사진' });
        for (const candidate of candidates) {
          let file;
          try { file = candidate.kind === 'photo' ? await getPhoto(id) : await getFile(id, candidate.key); }
          catch (error) { if (error.statusCode === 404 || error.status === 404) { job.missing++; continue; } throw error; }
          const buffer = file.fileBlob || file.photoBlob;
          if (!buffer?.length) { job.missing++; continue; }
          const original = file.fileName || file.photoName || '';
          const extension = path.extname(original).replace(/[^.a-zA-Z0-9]/g, '').slice(0, 16) || (candidate.kind === 'photo' ? '.jpg' : '');
          const base = naming.formatName(candidate.kind === 'photo' ? job.options.photoPattern : job.options.documentPattern, submission, { label: candidate.label, fileName: original });
          await append(buffer, uniqueName(folder + base, extension, paths));
          job.files++;
        }
        job.completed++;
      }
      if (!job.files) throw new Error('선택한 대상에 다운로드할 파일이 없습니다.');
      await archive.finalize();
      await complete;
      job.status = 'ready';
    } catch (error) {
      archive.destroy(); output.destroy();
      await complete.catch(() => {});
      await fs.promises.rm(job.filePath, { force: true }).catch(cleanupError => console.error('Archive cleanup failed:', cleanupError.message));
      job.status = 'failed';
      job.message = error.statusCode && error.statusCode < 500 ? error.message : '파일 준비에 실패했습니다. 잠시 후 다시 시도해 주세요.';
      if (!job.files && job.completed === job.ids.length) job.message = '선택한 대상에 다운로드할 파일이 없습니다.';
      console.error('Applicant archive failed:', error.message);
    } finally { expire(job); }
  }
  async function create(payload, owner) {
    if (!owner) throw createHttpError(401, '로그인이 필요합니다.');
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw createHttpError(400, '다운로드 설정이 올바르지 않습니다.');
    if ([...jobs.values()].some(job => job.owner === String(owner) && activeStates.has(job.status))) throw createHttpError(409, '이미 파일을 준비하고 있습니다. 완료 후 다시 시도하세요.');
    if ([...jobs.values()].filter(job => activeStates.has(job.status)).length >= 2) throw createHttpError(429, '다른 다운로드를 준비하고 있습니다. 잠시 후 다시 시도하세요.');
    let options;
    try { options = naming.normalizeOptions(payload); } catch (error) { throw createHttpError(400, error.message); }
    let ids;
    if (payload.scope === 'all') ids = (await query('SELECT DISTINCT id FROM app_subm ORDER BY id')).map(row => Number(row.id));
    else if (['filtered', 'selected'].includes(payload.scope) && Array.isArray(payload.submissionIds)) {
      ids = [...new Set(payload.submissionIds.map(Number))];
      if (ids.some(id => !Number.isSafeInteger(id) || id <= 0)) throw createHttpError(400, '접수번호가 올바르지 않습니다.');
    } else throw createHttpError(400, '다운로드 대상을 선택하세요.');
    if (!ids.length) throw createHttpError(400, '다운로드할 접수자가 없습니다.');
    // Recheck after the asynchronous ID query to prevent concurrent creation by one account.
    if ([...jobs.values()].some(job => job.owner === String(owner) && activeStates.has(job.status)) || [...jobs.values()].filter(job => activeStates.has(job.status)).length >= 2) throw createHttpError(409, '다른 다운로드를 준비하고 있습니다. 잠시 후 다시 시도하세요.');
    const id = randomUUID();
    const job = { id, owner: String(owner), ids, options, filePath: path.join(directory, id + '.zip'), status: 'pending', completed: 0, files: 0, missing: 0, message: '', expiresAt: null };
    jobs.set(id, job);
    setImmediate(() => build(job).catch(error => {
      job.status = 'failed'; job.message = '파일 준비에 실패했습니다. 잠시 후 다시 시도해 주세요.';
      expire(job); console.error('Archive preparation failed:', error.message);
    }));
    return snapshot(job);
  }
  return {
    create,
    status: (id, owner) => snapshot(getJob(id, owner)),
    async download(id, owner, response, contentDisposition) {
      const job = getJob(id, owner);
      if (job.status !== 'ready') throw createHttpError(409, '파일 준비가 완료되지 않았습니다.');
      const handle = await fs.promises.open(job.filePath, 'r');
      try {
        const stat = await handle.stat();
        response.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': stat.size,
          'Content-Disposition': contentDisposition('attachment', `접수_첨부파일_${new Date().toISOString().slice(0, 10)}.zip`), 'Cache-Control': 'no-store' });
        try { await pipeline(handle.createReadStream(), response); }
        catch (error) { if (!response.destroyed) throw error; }
      } finally { await handle.close(); }
    },
  };
}
module.exports = { createApplicantArchiveJobs };
