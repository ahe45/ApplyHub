const assert = require('node:assert/strict');
const factories = require('../client/app/state-factories');
const { normalizeSuperAdminSettings } = require('../shared/app-config');
const { createSystemSettingsController } = require('../client/features/system/settings');

const saveButton = { disabled: true };
global.document = { querySelector: () => saveButton, getElementById: () => null };
const initial = { schoolName: '기존대학교', schoolLogoImageUrl: '/old-school-logo.png', admissionHomepageUrl: 'https://example.test' };
const state = {
  systemSettings: factories.createSystemSettingsState(initial),
  systemDataDeletion: factories.createSystemDataDeletionState(),
  superAdmin: factories.createSuperAdminState({ schoolName: initial.schoolName, logoImageUrl: initial.schoolLogoImageUrl }, { normalizeSuperAdminSettings }),
};
const controller = createSystemSettingsController({ state, normalizeSuperAdminSettings, normalizeSystemSettingsPayload: factories.normalizeSystemSettingsPayload, syncAccountCreateDescription() {}, syncAutoLogoutTimer() {} });
assert.equal(controller.syncSystemSettingsDirtyState(), false);
assert.equal(saveButton.disabled, true);
assert.equal(Object.hasOwn(state.systemSettings, 'schoolName'), false);
assert.equal(Object.hasOwn(state.systemSettings, 'schoolLogoImageUrl'), false);
state.superAdmin.schoolName = '변경대학교';
state.superAdmin.logoImageUrl = '/new-school-logo.png';
assert.equal(controller.syncSystemSettingsDirtyState(), false, 'Branding edits belong only to the super-admin screen');
state.systemSettings.admissionHomepageUrl = 'https://example.test/new';
assert.equal(controller.syncSystemSettingsDirtyState(), true);
assert.equal(saveButton.disabled, false);
assert(controller.getSystemSettingsChangeSummaries().some(item => item.label === '입학처 홈페이지 링크'));
assert(!controller.getSystemSettingsChangeSummaries().some(item => ['학교명', '학교 로고'].includes(item.label)));
const payload = controller.getValidatedSystemSettingsPayload();
assert.equal(Object.hasOwn(payload, 'schoolName'), false);
assert.equal(Object.hasOwn(payload, 'schoolLogoImageUrl'), false);
controller.applySystemSettingsPayload({ ...payload, ...initial });
assert.equal(controller.syncSystemSettingsDirtyState(), false);
assert.equal(state.superAdmin.schoolName, '변경대학교', 'System settings reload must preserve pending super-admin edits');
assert.equal(state.superAdmin.logoImageUrl, '/new-school-logo.png');
console.log('PASS: separate system and super-admin dirty states, save payload and pending branding edits');
