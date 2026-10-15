const { exactRoute } = require('../router');
function createTranslationRoutes(deps) {
  function requireSuperAdmin(account) {
    if (account?.role !== deps.superAdminRole) throw deps.createHttpError(403, '슈퍼관리자 권한이 필요합니다.', 'SUPER_ADMIN_REQUIRED');
  }
  return [
    exactRoute('GET', '/api/system-settings/translation', async ({response, authenticatedAccount}) => {
      requireSuperAdmin(authenticatedAccount);
      deps.sendJson(response, 200, await deps.translationService.getSettings(), {'Cache-Control': 'no-store'});
    }),
    exactRoute('PUT', '/api/system-settings/translation', async ({request, response, authenticatedAccount}) => {
      requireSuperAdmin(authenticatedAccount);
      const result = await deps.translationService.updateSettings(await deps.readJsonBody(request));
      try {
        await deps.recordSystemAuditLog?.({ accountId: authenticatedAccount.id, accountName: authenticatedAccount.name, accountRole: authenticatedAccount.role,
          actionType: 'translation_api_settings_update', targetScope: 'translation', summaryText: 'Google 번역 API 설정을 저장했습니다.', details: { provider: 'google' } });
      } catch { /* Settings are already saved; never log request bodies or credentials. */ }
      deps.sendJson(response, 200, result, {'Cache-Control': 'no-store'});
    }),
    exactRoute('POST', '/api/system-settings/translation/check', async ({request, response, authenticatedAccount}) => {
      requireSuperAdmin(authenticatedAccount);
      const controller = new AbortController();
      response.once('close', () => { if (!response.writableEnded) controller.abort(); });
      const result = await deps.translationService.checkSettings(await deps.readJsonBody(request), authenticatedAccount.id, controller.signal);
      deps.sendJson(response, 200, result, {'Cache-Control': 'no-store'});
    }),
    exactRoute('POST', '/api/admin/translations', async ({request,response,authenticatedAccount}) => {
    if (![deps.superAdminRole, '관리자', '운영자'].includes(authenticatedAccount?.role)) throw deps.createHttpError(403, '번역 설정을 수정할 권한이 없습니다.', 'TRANSLATION_FORBIDDEN');
    const body = await deps.readJsonBody(request);
    const controller = new AbortController();
    response.once('close', () => { if (!response.writableEnded) controller.abort(); });
    const result = await deps.translationService.translate(body, authenticatedAccount.id, controller.signal);
    deps.sendJson(response, 200, result);
  })];
}
module.exports = { createTranslationRoutes };
