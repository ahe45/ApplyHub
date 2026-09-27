const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { cases: dateCases } = require('./date-parts-test');

async function runDateSettingsChecks({ services, members, query, base, call, getDeliveredCode, inputType = 'date' }) {
  const isRange = inputType === 'daterange';
  const cases = isRange ? require('./date-range-test').cases : dateCases;
  const typeLabel = isRange ? '기간' : '날짜';
  const service = services.applicantService;
  const settings = await members.getSettings();
  if (isRange) {
    const beforeMigration = await query('SELECT * FROM app_form ORDER BY id');
    const [column] = await query("SHOW COLUMNS FROM app_form LIKE 'input_type'");
    await query(`ALTER TABLE app_form MODIFY input_type ${column.Type.replace(",'daterange'", '')} NOT NULL DEFAULT 'text'`);
    await services.initializeApplicationData();
    assert((await query("SHOW COLUMNS FROM app_form LIKE 'input_type'"))[0].Type.includes("'daterange'"));
    assert.deepEqual(await query('SELECT * FROM app_form ORDER BY id'), beforeMigration);
  }
  const questions = cases.map(item => ({ key: `date-${item.key}`, label: `${typeLabel} ${item.key}`, inputType, dateParts: item.dateParts, required: true }));
  await members.saveSettings({ ...settings, terms: [], questions: [...settings.questions.filter(q => ['email', 'password', 'name'].includes(q.key)), ...questions] });
  for (const question of questions) {
    await service.createApplicantFormField({ fieldKey: question.key, questionText: question.label, inputType, dateParts: question.dateParts, required: true });
  }
  for (const item of cases) {
    const field = (await service.getApplicantFormFields()).find(f => f.fieldKey === `date-${item.key}`);
    assert.deepEqual(field.dateParts, item.dateParts);
    await service.updateApplicantFormField(field.id, { questionDescription: '날짜 형식 유지 확인' });
    assert.deepEqual((await service.getApplicantFormFields()).find(f => f.id === field.id).dateParts, item.dateParts);
    assert.deepEqual((await members.getSettings()).questions.find(q => q.key === field.fieldKey).dateParts, item.dateParts);
  }
  await assert.rejects(() => service.createApplicantFormField({ questionText: '잘못된 날짜', inputType, dateParts: [] }), /날짜 형식/);
  await service.createApplicantFormField({ fieldKey: 'month-dependency', questionText: '월 포함 확인', inputType, dateParts: ['year', 'day'] });
  const dependency = (await service.getApplicantFormFields()).find(f => f.fieldKey === 'month-dependency');
  assert.deepEqual(dependency.dateParts, ['year', 'month', 'day']);
  const [storedDependency] = await query('SELECT options_json FROM app_form WHERE id = ?', [dependency.id]);
  assert.deepEqual(JSON.parse(storedDependency.options_json).dateParts, ['year', 'month', 'day'], 'Settings saved through the API must also include a month');
  await query('UPDATE app_form SET options_json = ? WHERE id = ?', [JSON.stringify({ dateParts: ['year', 'day'] }), dependency.id]);
  assert.deepEqual((await service.getApplicantFormFields()).find(f => f.id === dependency.id).dateParts, ['year', 'month', 'day'], 'Legacy settings remain readable with the month requirement');
  await service.createApplicantFormField({ fieldKey: 'legacy-date', questionText: '기본 날짜', inputType: 'date' });
  const legacy = (await service.getApplicantFormFields()).find(f => f.fieldKey === 'legacy-date');
  await query('UPDATE app_form SET options_json = ? WHERE id = ?', ['[]', legacy.id]);
  assert.deepEqual((await service.getApplicantFormFields()).find(f => f.id === legacy.id).dateParts, ['year', 'month', 'day']);
  const before = await query('SELECT * FROM app_form ORDER BY id');
  await services.initializeApplicationData();
  assert.deepEqual(await query('SELECT * FROM app_form ORDER BY id'), before);

  const profile = Object.fromEntries(cases.map(item => [`date-${item.key}`, item.value]));
  const email = 'date-form@example.test', password = 'DateTest1234';
  const proof = await call('/api/public/members/email-code', { email });
  assert.equal(proof.status, 200);
  assert.equal((await call('/api/public/members/verify-email', { email, verificationId: proof.body.verificationId, code: getDeliveredCode() })).status, 200);
  const signup = { email, name: '날짜 회원', password, passwordConfirm: password, verificationId: proof.body.verificationId, profile };
  assert.equal((await call('/api/public/members/register', { ...signup, profile: { ...profile, 'date-month-day': '02-30' } })).status, 400);
  const registered = await call('/api/public/members/register', signup);
  assert.equal(registered.status, 200, JSON.stringify(registered));
  assert.deepEqual(registered.body.member.profile, profile);
  const application = { selectionAnswers: { track: '수시', admission: '일반', series: '인문', unit: '문학', major: '' }, answers: profile };
  for (const item of cases) {
    const invalid = await call('/api/public/applications', { ...application, answers: { ...profile, [`date-${item.key}`]: item.invalid } }, registered.cookie);
    assert.equal(invalid.status, 400, JSON.stringify(invalid));
    assert.equal(invalid.body.fieldKey, `date-${item.key}`);
  }
  if (isRange) {
    for (const value of ['2025 ~ 2024', '2024 ~ ', '', ' ~ 2025']) {
      const rejected = await call('/api/public/applications', { ...application, answers: { ...profile, 'date-year': value } }, registered.cookie);
      assert.equal(rejected.status, 400);
      assert.equal(rejected.body.fieldKey, 'date-year');
    }
  }
  const saved = await call('/api/public/applications', application, registered.cookie);
  assert.equal(saved.status, 200, JSON.stringify(saved));
  const reloaded = await service.getApplicantSubmissionById(saved.body.id);
  for (const [key, value] of Object.entries(profile)) assert.equal(reloaded.answerMap[key], value);
  console.log('PASS: date settings round trips, legacy defaults, signup and application API validation and saved values');

  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const errors = [], artifacts = path.resolve(__dirname, isRange ? '../.tmp-period-check' : '../.tmp-date-check');
  fs.mkdirSync(artifacts, { recursive: true });
  async function pageFor(cookie) {
    const context = await browser.createBrowserContext();
    if (cookie) { const index = cookie.indexOf('='); await context.setCookie({ name: cookie.slice(0, index), value: cookie.slice(index + 1), url: base }); }
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 1280, height: 1000 });
    return page;
  }
  try {
    await query('UPDATE accounts SET password_temporary = 0');
    const { initialPassword } = await services.systemService.getSystemSettings();
    const login = await call('/api/auth/login', { id: 'admin', password: initialPassword });
    assert.equal(login.status, 200);
    const exportResponse = await fetch(base + '/api/applicant-submissions/export.xlsx', { method: 'POST', headers: { cookie: login.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionIds: [saved.body.id] }) });
    assert.equal(exportResponse.status, 200);
    const workbook = new (require('exceljs').Workbook)();
    await workbook.xlsx.load(Buffer.from(await exportResponse.arrayBuffer()));
    const sheet = workbook.getWorksheet('접수이력');
    assert.equal(sheet.getRow(2).getCell(sheet.getRow(1).values.indexOf(`회원가입 · ${typeLabel} full`)).value, cases.at(-1).value);
    assert(sheet.getRow(2).values.filter(value => value === cases.at(-1).value).length >= 2, 'Signup and application values appear in the export');
    const admin = await pageFor(login.cookie);
    for (const scope of ['signup', 'application']) {
      const prefix = scope === 'signup' ? 'signup' : 'applicant';
      await admin.goto(`${base}/applicant-question-template-management?tab=${scope}`, { waitUntil: 'networkidle0' });
      if (scope === 'application') await admin.click('.form-template-thumbnail-open');
      await admin.waitForSelector(`[data-${prefix}-field-add]`);
      await admin.click(`[data-${prefix}-field-add]`);
      await admin.type(`[data-${prefix}-field-input=questionText]`, `${scope} ${typeLabel} 설정`);
      await admin.select(`[data-${prefix}-field-input=inputType]`, inputType);
      const partControl = part => `[data-${prefix}-field-input="datePart:${part}"]`;
      assert(await admin.$eval(partControl('month'), input => input.checked && input.disabled));
      await admin.click(partControl('year'));
      await admin.click(partControl('month'));
      assert(await admin.$eval(partControl('day'), input => input.checked && input.disabled), 'Day-only remains available');
      await admin.click(partControl('year'));
      assert(await admin.$eval(partControl('month'), input => input.checked && input.disabled), 'Adding year to day includes month');
      await admin.click(partControl('day'));
      await admin.click(partControl('month'));
      await admin.click(partControl('day'));
      assert(await admin.$eval(partControl('month'), input => input.checked && input.disabled), 'Adding day to year includes month');
      for (const part of (scope === 'signup' ? ['day', 'month'] : ['year'])) await admin.click(partControl(part));
      const expected = scope === 'signup' ? ['year'] : ['month', 'day'];
      assert.deepEqual(await admin.$$eval(`[data-${prefix}-field-input^="datePart:"]:checked`, inputs => inputs.map(input => input.dataset[Object.keys(input.dataset)[0]].split(':')[1])), expected);
      if (scope === 'signup') assert(await admin.$eval('[data-signup-field-input="datePart:year"]', input => input.disabled));
      await admin.screenshot({ path: path.join(artifacts, `${scope}-date-editor.png`), fullPage: true });
      const endpoint = scope === 'signup' ? '/api/applicant-signup-settings' : '/api/applicant-form-fields';
      await Promise.all([admin.waitForResponse(r => r.url().endsWith(endpoint) && ['POST', 'PUT'].includes(r.request().method())), admin.click(`[data-${prefix}-field-form] button[type=submit]`)]);
      const stored = scope === 'signup' ? (await members.getSettings()).questions.find(q => q.label === `${scope} ${typeLabel} 설정`) : (await service.getApplicantFormFields()).find(q => q.questionText === `${scope} ${typeLabel} 설정`);
      assert.deepEqual(stored.dateParts, expected);
      await admin.reload({ waitUntil: 'networkidle0' });
      if (scope === 'application') await admin.click('.form-template-thumbnail-open');
      await admin.waitForSelector(`[data-${prefix}-field-select="${stored.key || stored.id}"]`);
      await admin.click(`[data-${prefix}-field-select="${stored.key || stored.id}"]`);
      assert.equal(await admin.$$eval(`[data-${prefix}-field-input^="datePart:"]:checked`, inputs => inputs.length), expected.length);
    }

    for (const prefix of ['member', 'applicant']) {
      const page = await pageFor();
      await page.goto(base + (prefix === 'member' ? '/applicant/signup?preview=1' : '/applicant/form?preview=1'), { waitUntil: 'networkidle0' });
      if (prefix === 'member') await page.click('[data-applicant-form=member-terms] button[type=submit]');
      await page.waitForSelector(`[data-${prefix}-date-field-key="date-year"]`, { visible: true });
      for (const item of cases) {
        const selector = `[data-${prefix}-date-field-key="date-${item.key}"]`;
        assert.deepEqual(await page.$$eval(selector, (inputs, name) => inputs.map(input => input.dataset[`${name}DatePart`]), prefix), isRange ? [...item.dateParts, ...item.dateParts] : item.dateParts);
        for (const edge of (isRange ? ['start', 'end'] : [''])) {
          for (const [index, part] of item.dateParts.entries()) await page.select(`${selector}${edge ? `[data-${prefix}-date-edge=${edge}]` : ''}[data-${prefix}-date-part=${part}]`, (edge ? item[edge] : item.value).split('-')[index]);
        }
        const hidden = prefix === 'member' ? `[data-member-date-value="date-${item.key}"]` : `[data-applicant-field-key="date-${item.key}"]`;
        assert.equal(await page.$eval(hidden, input => input.value), item.value);
      }
      if (isRange) {
        const endYear = `[data-${prefix}-date-field-key="date-year"][data-${prefix}-date-edge=end]`;
        await page.select(endYear, '2023');
        if (prefix === 'member') assert.match(await page.$eval(endYear, el => el.validationMessage), /시작일/);
        await page.select(endYear, '2025');
        if (prefix === 'member') assert.equal(await page.$eval(endYear, el => el.validationMessage), '');
        await page.select(endYear, '');
        if (prefix === 'member') assert.equal(await page.$eval(endYear, el => el.validity.valueMissing), true);
        await page.select(endYear, '2025');
      }
      const monthDay = `[data-${prefix}-date-field-key="date-month-day"]${isRange ? `[data-${prefix}-date-edge=start]` : ''}`;
      assert.equal(await page.$$eval(`${monthDay}[data-${prefix}-date-part=day] option`, options => options.length), 30, 'Month/day allows February 29 without requesting a year');
      await page.select(`${monthDay}[data-${prefix}-date-part=month]`, '01');
      await page.select(`${monthDay}[data-${prefix}-date-part=day]`, '31');
      await page.select(`${monthDay}[data-${prefix}-date-part=month]`, '04');
      assert.equal(await page.$eval(`${monthDay}[data-${prefix}-date-part=day]`, input => input.value), '', 'Changing month clears an invalid day');
      for (const width of [320, 390]) {
        await page.setViewport({ width, height: 844 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        assert(await page.$$eval('.applicant-public-date-select-grid', groups => groups.every(group => {
          const boxes = [...group.querySelectorAll('select')].map(select => select.getBoundingClientRect());
          return boxes.every(box => Math.abs(box.top - boxes[0].top) < 2 && box.width > 50);
        })));
      }
      await page.screenshot({ path: path.join(artifacts, `${prefix}-dates-mobile.png`), fullPage: true });
      if (prefix === 'applicant') {
        await page.reload({ waitUntil: 'networkidle0' });
        assert.equal(await page.$eval('[data-applicant-date-field-key="date-year"][data-applicant-date-part=year]', select => select.value), '2024');
        if (isRange) {
          assert.equal(await page.$eval('[data-applicant-date-field-key="date-year"][data-applicant-date-edge=end]', select => select.value), '2025');
          assert.equal(await page.$eval('[data-applicant-date-field-key="date-month-day"][data-applicant-date-edge=start][data-applicant-date-part=month]', select => select.value), '04');
          assert.equal(await page.$eval('[data-applicant-date-field-key="date-month-day"][data-applicant-date-edge=end][data-applicant-date-part=day]', select => select.value), '30');
        }
      }
    }
    assert.deepEqual(errors, []);
    console.log('PASS: admin date format controls, saved settings, all signup/application selectors, mobile layout and draft restoration');
  } finally { await browser.close(); }
}

module.exports = { runDateSettingsChecks };
