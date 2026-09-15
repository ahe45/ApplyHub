const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const config = require('../shared/app-config');

async function runAdminMenuChecks({ services, query, base, call }) {
  const roles = [config.superAdminRole, '관리자', '운영자', '조회용'];
  const ids = ['super-menu-test', 'admin', 'ops', 'view'];
  await services.authService.createAccount({ id: ids[0], name: '슈퍼관리자 테스트', role: roles[0] });
  await query('UPDATE accounts SET password_temporary = 0'); // Disposable test database only.
  const { initialPassword: password } = await services.systemService.getSystemSettings();
  const cookies = {};
  for (let i = 0; i < roles.length; i++) {
    const login = await call('/api/auth/login', { id: ids[i], password });
    assert.equal(login.status, 200);
    assert.equal(login.body.authenticated, true);
    cookies[roles[i]] = login.cookie;
  }
  const superCookie = cookies[roles[0]], adminCookie = cookies['관리자'];
  for (const role of roles) {
    const isSuper = role === config.superAdminRole;
    const bootstrap = await call('/api/bootstrap', null, cookies[role], 'GET');
    assert.equal(bootstrap.status, 200);
    assert.equal(bootstrap.body.accounts.some(account => account.id === ids[0]), isSuper);
    assert.equal(Boolean(bootstrap.body.systemBackupAutomation), isSuper);
    assert.equal(config.getAccessibleViewsForRole(role).includes('systemBackupRestore'), isSuper);
    // Old saved menu visibility cannot grant access to a super-admin view.
    assert.equal(config.getAccessibleViewsForRole(role, { roleMenuVisibility: { [role]: ['systemBackupRestore'] } }).includes('systemBackupRestore'), isSuper);
    if (!isSuper) {
      for (const [method, endpoint] of [['GET', 'automation'], ['PUT', 'automation'], ['POST', 'automation/run'], ['POST', 'export'], ['POST', 'validate'], ['POST', 'import']]) {
        assert.equal((await call('/api/system-backup/' + endpoint, {}, cookies[role], method)).status, 403, `${role}: ${endpoint}`);
      }
    }
  }
  assert.equal((await call('/api/system-backup/automation', null, superCookie, 'GET')).status, 200);
  const exportResponse = await fetch(base + '/api/system-backup/export', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: superCookie },
    body: JSON.stringify({ currentPassword: password, includeDatabase: true }),
  });
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get('content-type'), /application\/zip/);
  const archive = await exportResponse.arrayBuffer();
  const validationResponse = await fetch(base + '/api/system-backup/validate', {
    method: 'POST', headers: { Cookie: superCookie, 'Content-Type': 'application/zip' }, body: archive,
  });
  assert.equal(validationResponse.status, 200, await validationResponse.text());

  for (const [method, endpoint, body] of [
    ['POST', '/api/accounts', { id: 'unauthorized-super', name: '권한 테스트', role: roles[0] }],
    ['POST', '/api/accounts', { id: ids[0], name: '기존 계정', role: '관리자' }],
    ['PUT', '/api/accounts/admin', { role: roles[0] }],
    ['PUT', '/api/accounts/' + ids[0], { name: '변경 시도', role: '관리자' }],
    ['POST', '/api/accounts/' + ids[0] + '/reset-password', {}],
    ['DELETE', '/api/accounts/' + ids[0], {}],
  ]) assert.equal((await call(endpoint, body, adminCookie, method)).status, 403, endpoint);
  const createBody = { id: 'ordinary-test', name: '일반 계정 테스트', role: '운영자' };
  assert.equal((await call('/api/accounts', createBody, cookies['운영자'])).status, 403);
  assert.equal((await call('/api/accounts', createBody, adminCookie)).status, 201);
  assert.equal((await call('/api/accounts/ordinary-test', { name: '수정됨' }, adminCookie, 'PUT')).status, 200);
  assert.equal((await call('/api/accounts/ordinary-test/reset-password', {}, adminCookie)).status, 200);
  assert.equal((await call('/api/accounts/ordinary-test', {}, adminCookie, 'DELETE')).status, 200);
  assert.equal((await call('/api/accounts/' + ids[0], { name: '슈퍼관리자 테스트' }, superCookie, 'PUT')).status, 200);

  const branding = { ...(await services.systemService.getSuperAdminSettings()), schoolName: '보존대학교', logoImageUrl: '/client/assets/logo.png' };
  assert.equal((await call('/api/super-admin/settings', branding, superCookie, 'PUT')).status, 200);
  assert.equal((await call('/api/super-admin/settings', { ...branding, schoolName: '변경 시도' }, adminCookie, 'PUT')).status, 403);
  const settings = await services.systemService.getSystemSettings();
  assert.equal(Object.hasOwn(settings, 'schoolName'), false);
  assert.equal(Object.hasOwn(settings, 'schoolLogoImageUrl'), false);
  const settingsResponse = await call('/api/system-settings', { ...settings, schoolName: '변경 시도', schoolLogoImageUrl: '/wrong.png', admissionHomepageUrl: 'https://example.test/admission' }, adminCookie, 'PUT');
  assert.equal(settingsResponse.status, 200);
  assert.equal(settingsResponse.body.admissionHomepageUrl, 'https://example.test/admission');
  assert.deepEqual(await services.systemService.getSuperAdminSettings(), branding, 'System settings must never overwrite super-admin branding');
  console.log('PASS: role-filtered bootstrap, backup authorization/export/validation, protected super accounts and separate branding writes');

  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  try {
    for (const role of [config.superAdminRole, '관리자']) {
      const isSuper = role === config.superAdminRole;
      const context = await browser.createBrowserContext();
      try {
        const [name, ...valueParts] = cookies[role].split('=');
        await context.setCookie({ name, value: valueParts.join('='), url: base });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.setViewport({ width: 1440, height: 1000 });
        await page.goto(base + '/accounts', { waitUntil: 'networkidle0' });
        await page.waitForSelector('#viewRoot [data-grid-key="accountManagementGrid"]');
        assert.equal((await page.$eval('#viewRoot', el => el.textContent)).includes(ids[0]), isSuper);
        const nav = await page.$eval('[data-view="systemBackupRestore"]', el => ({ visible: !!el.getClientRects().length && getComputedStyle(el).display !== 'none', section: el.closest('.nav-section').querySelector('.nav-section-title').textContent }));
        assert.equal(nav.visible, isSuper);
        assert.equal(nav.section, '슈퍼관리자');
        await page.click('[data-account-edit="admin"]');
        assert.equal(await page.$eval('[data-account-field="role"]', (el, superRole) => [...el.options].some(option => option.value === superRole), config.superAdminRole), isSuper);
        await page.click('[data-open-modal="accountCreateModal"]');
        await page.waitForSelector('#accountCreateModal:not(.hidden)');
        assert.equal(await page.$eval('#accountCreateRole', (el, superRole) => [...el.options].some(option => option.value === superRole), config.superAdminRole), isSuper);
        await page.goto(base + '/system-settings', { waitUntil: 'networkidle0' });
        await page.waitForSelector('#systemSettingsAdmissionHomepageUrl');
        assert.equal(await page.$('#systemSettingsSchoolName'), null);
        assert.equal(await page.$('#systemSettingsSchoolLogo'), null);
        assert.equal(await page.$('[data-school-logo-reset]'), null);
        await page.goto(base + '/system-backup-restore', { waitUntil: 'networkidle0' });
        assert.equal(Boolean(await page.$('#systemBackupRestoreFileInput')), isSuper);
        if (isSuper) {
          assert((await page.$eval('#viewRoot', el => el.textContent)).includes('회원 계정·가입 답변·회원 첨부파일·약관 동의'));
          await page.goto(base + '/super-admin', { waitUntil: 'networkidle0' });
          await page.waitForSelector('#superAdminSchoolName');
          assert.equal(await page.$eval('#superAdminSchoolName', el => el.value), branding.schoolName);
          assert(await page.$('#superAdminLogoImageInput'));
          await page.$eval('#superAdminSchoolName', el => { el.value = '변경대학교'; el.dispatchEvent(new Event('input', { bubbles: true })); });
          const [saved] = await Promise.all([
            page.waitForResponse(response => response.url().endsWith('/api/super-admin/settings') && response.request().method() === 'PUT'),
            page.click('[data-super-admin-action="save"]'),
          ]);
          assert.equal(saved.status(), 200);
          assert.equal((await services.systemService.getSuperAdminSettings()).schoolName, '변경대학교');
        }
        assert.deepEqual(errors, []);
        console.log(`PASS: ${role} browser menus, account visibility and role options, system settings and direct backup navigation`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}

module.exports = { runAdminMenuChecks };
