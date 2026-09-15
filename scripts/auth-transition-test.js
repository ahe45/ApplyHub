const assert = require('node:assert/strict');
const { createAuthState } = require('../client/app/state-factories');
const { createAuthSessionController } = require('../client/features/auth/session');

function fixture(apiRequest, { loginPage = true, navigate = () => true } = {}) {
  const state = { auth: createAuthState() };
  state.auth.status = 'logged_out';
  state.auth.loginForm = { id: 'test', password: 'test-password' };
  let renders = 0;
  const node = () => {
    const classes = new Set();
    return { classes, classList: { toggle: (key, value) => value ? classes.add(key) : classes.delete(key) } };
  };
  const appShell = node(), sidebar = node(), topbar = node();
  const noop = () => {};
  const controller = createAuthSessionController({
    state, apiRequest, appShell, sidebar, topbar, pageShell: node(), createAuthState,
    isLoginPage: () => loginPage, isRouteNavigating: () => false,
    isUserAuthenticated: () => state.auth.status === 'authenticated',
    normalizeAuthAccount: account => account || null,
    getDefaultAccessibleView: () => 'dashboard', navigateToView: navigate, navigateToLogin: navigate,
    redirectToAccessibleRouteIfNeeded: () => false,
    loadBootstrapData: async () => {}, loadLoginNoticeData: async () => {},
    renderView: () => { renders++; controller.updateAuthChrome(); },
    clearAutoLogoutTimer: noop, consumeFlashToast: noop, hideToast: noop, queueFlashToast: noop,
    resetBootstrapData: noop, showToast: noop, syncAutoLogoutCountdown: noop,
    syncCurrentViewFromLocation: noop, syncNavigationVisibility: noop, syncPasswordSetupModal: noop,
  });
  return { controller, state, appShell, sidebar, topbar, get renders() { return renders; } };
}

async function run() {
  const authenticated = { authenticated: true, account: { id: 'admin', role: '관리자' } };
  let requests = 0;
  const admin = fixture(async () => { requests++; return authenticated; });
  await Promise.all([admin.controller.submitLogin(), admin.controller.submitLogin()]);
  assert.equal(requests, 1, 'Duplicate login submissions are ignored');
  assert.equal(admin.renders, 1, 'Successful admin login preserves the submitting form');
  assert.equal(admin.state.auth.isSubmittingLogin, true);
  admin.controller.updateAuthChrome();
  assert(admin.appShell.classes.has('auth-locked'));
  assert(admin.sidebar.classes.has('hidden'));
  assert(admin.topbar.classes.has('hidden'));

  let destination;
  global.window = { location: { replace: path => { destination = path; } } };
  const member = fixture(async () => ({ accountType: 'applicant', member: { id: 1 } }));
  await member.controller.submitLogin();
  assert.equal(destination, '/applicant');
  assert.equal(member.renders, 1);
  assert.equal(member.state.auth.isSubmittingLogin, true);

  const failed = fixture(async () => { throw new Error('비밀번호를 확인하세요.'); });
  await failed.controller.submitLogin();
  assert.equal(failed.state.auth.isSubmittingLogin, false);
  assert.equal(failed.state.auth.error, '비밀번호를 확인하세요.');
  assert.equal(failed.renders, 2, 'Failed login renders an editable form');
  failed.state.auth.loginForm.password = '';
  await failed.controller.submitLogin();
  assert.equal(failed.state.auth.isSubmittingLogin, false);

  const initialPassword = fixture(async () => ({ requiresPasswordChange: true, account: authenticated.account }));
  await initialPassword.controller.submitLogin();
  assert.equal(initialPassword.state.auth.status, 'password_setup');
  assert.equal(initialPassword.state.auth.isSubmittingLogin, false);
  assert.equal(initialPassword.renders, 2, 'Temporary passwords still open the setup prompt');

  const navigationError = fixture(async () => authenticated, { navigate: () => { throw new Error('Navigation failed'); } });
  await navigationError.controller.submitLogin();
  assert.equal(navigationError.state.auth.isSubmittingLogin, false);
  assert.equal(navigationError.state.auth.error, 'Navigation failed');

  const setup = fixture(async () => authenticated);
  setup.state.auth.status = 'password_setup';
  setup.state.auth.passwordSetup = { password: 'new-password', passwordConfirm: 'new-password', error: '' };
  await setup.controller.submitPasswordSetup();
  assert.equal(setup.renders, 0, 'Initial password success does not flash the login form');
  assert.equal(setup.state.auth.isSubmittingPasswordSetup, true);

  const session = fixture(async () => authenticated);
  await session.controller.loadAuthSession();
  assert.equal(session.renders, 1, 'An existing session redirects without another login render');

  const destinationPage = fixture(async () => authenticated, { loginPage: false });
  await destinationPage.controller.loadAuthSession();
  assert.equal(destinationPage.appShell.classes.has('auth-locked'), false);
  assert.equal(destinationPage.sidebar.classes.has('hidden'), false);
  assert.equal(destinationPage.topbar.classes.has('hidden'), false);
  delete global.window;
  console.log('PASS: admin/member login transitions, duplicate submission, failure, password setup and session restore');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
