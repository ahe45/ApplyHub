const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const { PDFDocument } = require('pdf-lib');
const config = require('../shared/app-config');

async function verifySubmissionTickets({ services, call, base, query, submissionId, memberCookie }) {
  assert.deepEqual(await query("SHOW TABLES LIKE 'examinee'"), [], 'Fresh installs have no separate roster');
  assert.deepEqual(await query("SHOW TABLES LIKE 'app_assign'"), [], 'Fresh installs have no assignment table');
  const submission = await services.applicantService.getApplicantSubmissionById(submissionId);
  assert.equal(submission.status, 'submitted');
  const number = submission.promotedExamineeNo;
  assert(number);
  const adminLogin = await call('/api/auth/login', {id: 'admin', password: '1111'});
  const setup = await call('/api/auth/password/setup', {password: 'TicketTest1234', passwordConfirm: 'TicketTest1234'}, adminLogin.cookie);
  assert.equal(setup.status, 200);
  const cookie = setup.cookie || adminLogin.cookie;
  for (const [method, path] of [['POST', '/api/examinees/import'], ['POST', '/api/examinees/import/preview'], ['POST', '/api/examinees/photo-archive'], ['PUT', `/api/examinees/${number}`], ['POST', '/api/applicant-assignments'], ['GET', '/api/applicant-assignments/template.xlsx'], ['POST', '/api/applicant-submissions/promotions/preview'], ['POST', '/api/applicant-submissions/promotions/commit'], ['POST', '/api/applicant-submissions/promotions/reset']]) {
    assert.equal((await call(path, method === 'GET' ? null : {}, cookie, method)).status, 404, path);
  }
  const bootstrap = await services.systemService.getBootstrapPayload();
  assert.equal(bootstrap.examinees.length, 1);
  assert.equal(bootstrap.examinees[0].submissionId, submissionId);
  assert.equal(bootstrap.examinees[0].examineeNo, number);
  assert.equal(bootstrap.examinees[0].name, submission.name);
  assert.equal(bootstrap.applicantManager.assignments, undefined);
  assert.equal(bootstrap.systemSettings.admitCardDataSource, undefined);
  assert(!config.availableViews.includes('examineeRegistration'));
  assert(!config.availableViews.includes('applicantAssignmentManagement'));
  // A stale saved setting cannot bring back the removed data source.
  await query("INSERT INTO system_set (setting_key, setting_value) VALUES ('admitCardDataSource', 'examinee') ON DUPLICATE KEY UPDATE setting_value = 'examinee'");
  const response = await fetch(base + `/api/admit-cards/${number}/pdf`, {headers: {cookie}});
  assert.equal(response.status, 200);
  const single = await PDFDocument.load(await response.arrayBuffer());
  assert(single.getPageCount() > 0);
  const batch = await services.admitCardService.buildBatchAdmitCardPdfBuffer([number]);
  assert.equal((await PDFDocument.load(batch)).getPageCount(), single.getPageCount());
  const job = await call('/api/admit-cards/jobs', {examineeNos: [number], outputMode: 'pdf-zip'}, cookie);
  assert.equal(job.status, 202);
  let jobState = job.body;
  const deadline = Date.now() + 30000;
  while (jobState.status === 'running' && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const result = await call(`/api/admit-cards/jobs/${job.body.jobId}`, null, cookie, 'GET');
    assert.equal(result.status, 200);
    jobState = result.body;
  }
  assert.equal(jobState.status, 'completed', JSON.stringify(jobState));
  const zipResponse = await fetch(base + `/api/admit-cards/jobs/${job.body.jobId}/file`, {headers: {cookie}});
  assert.equal(zipResponse.status, 200);
  const zip = new (require('adm-zip'))(Buffer.from(await zipResponse.arrayBuffer()));
  assert.equal(zip.getEntries().filter(entry => !entry.isDirectory).length, 1);
  assert((await PDFDocument.load(zip.getEntries()[0].getData())).getPageCount() > 0);
  assert.equal((await call('/api/print-history', {examineeNos: [number]}, cookie)).status, 201);
  const history = await services.systemService.getBootstrapPayload();
  assert.equal(history.printHistory[0].name, submission.name);
  assert.equal(history.printHistory[0].examineeNo, number);
  assert.equal((await call('/api/print-history', {examineeNos: ['missing-number']}, cookie)).status, 404);
  const schedule = (await services.applicantService.getApplicantSchedules())[0];
  await services.applicantService.saveApplicantSchedule({...schedule,
    admitCardLookupScheduleStartAt: schedule.applicantScheduleStartAt,
    admitCardLookupScheduleEndAt: schedule.applicantScheduleEndAt,
  });
  const publicPdf = await fetch(base + `/api/public/applications/${submissionId}/admit-card.pdf`, {headers: {cookie: memberCookie}});
  assert.equal(publicPdf.status, 200, 'Unpromoted applicants can view their ticket during the lookup period');
  assert.equal((await PDFDocument.load(await publicPdf.arrayBuffer())).getPageCount(), single.getPageCount());
  // Simulate an installed system's legacy foreign key in the disposable database.
  await query('CREATE TABLE examinee (examinee_no VARCHAR(30) NOT NULL PRIMARY KEY)');
  await query('INSERT INTO examinee (examinee_no) VALUES (?), (?)', [number, 'legacy-only']);
  await query('ALTER TABLE print_log ADD CONSTRAINT test_legacy_roster_fk FOREIGN KEY (examinee_no) REFERENCES examinee(examinee_no)');
  await query("INSERT INTO print_log (examinee_no, print_count) VALUES ('legacy-only', 1)");
  await services.initializeApplicationData();
  assert.equal((await query("SELECT * FROM print_log WHERE examinee_no = 'legacy-only'")).length, 1, 'Migration retains old print history');
  assert.equal((await services.systemService.getBootstrapPayload()).examinees.length, 1, 'Legacy-only roster entries never become ticket sources');
  await query('DROP TABLE examinee'); // Only this test fixture; production migration never deletes the legacy table.
  const backup = await services.systemService.buildSystemBackupArchive({includeDatabase: true, includedAssetKeys: []});
  assert(backup.archiveBuffer.length > 0);
  const browser = await puppeteer.launch({executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--no-sandbox']});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const separator = cookie.indexOf('=');
    await browser.setCookie({name: cookie.slice(0, separator), value: cookie.slice(separator + 1), url: base});
    for (const path of ['/applicant-history', '/admit-cards', '/print-history', '/applicant-recruitment-management', '/applicant-schedules', '/applicant-question-template-management', '/templates', '/system-settings', '/system-data-deletion', '/system-backup-restore']) {
      await page.goto(base + path, {waitUntil: 'networkidle2'});
      assert.deepEqual(errors, [], path);
      await page.waitForSelector('#viewRoot', {timeout: 5000});
      assert.equal(await page.$('[data-view="examineeRegistration"], [data-view="applicantAssignmentManagement"]'), null);
      if (path === '/admit-cards') {
        await page.waitForFunction(number => document.querySelector('#admitCardLookupResultMount')?.textContent.includes(number), {}, number);
        assert.equal(await page.$('[data-examinee-detail-open]'), null);
      }
    }
    await require("./dashboard-test").verifyDashboard(page, base);
    await require("./template-editor-smoke-test").verifyTemplateEditor(page);
    assert.deepEqual(errors, []);
  } finally {await browser.close();}
  console.log('PASS: submission-only single/batch PDF, print history, backup, removed APIs/schema/menus and admin pages');
}
module.exports = {verifySubmissionTickets};
