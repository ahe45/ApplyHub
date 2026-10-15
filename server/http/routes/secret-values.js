const { exactRoute } = require('../router');
function createSecretValueRoutes(deps) {
  const attempts = new Map();
  async function audit(account, kind, success) {
    try {
      await deps.recordSystemAuditLog?.({accountId:account.id,accountName:account.name,accountRole:account.role,
        actionType: success ? 'setting_secret_view' : 'setting_secret_view_failed', targetScope:kind,
        summaryText:success ? '저장된 설정값을 확인했습니다.' : '저장된 설정값 확인에 실패했습니다.'});
    } catch { /* Credentials and request bodies must never enter logs. */ }
  }
  return [exactRoute('POST', '/api/system-settings/secrets/reveal', async ({request,response,authenticatedAccount:account}) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    if (account?.role !== deps.superAdminRole) throw deps.createHttpError(403, '슈퍼관리자 권한이 필요합니다.', 'SUPER_ADMIN_REQUIRED');
    const body = await deps.readJsonBody(request);
    if (!body || !['email','translation'].includes(body.kind) || typeof body.currentPassword !== 'string' || !body.currentPassword || body.currentPassword.length > 4096) throw deps.createHttpError(400, '현재 로그인한 계정의 비밀번호를 입력해주세요.', 'SECRET_PASSWORD_REQUIRED');
    const time = Date.now();
    for (const [id,times] of attempts) if (!times.some(t => time-t<60000)) attempts.delete(id);
    const recent=(attempts.get(account.id)||[]).filter(t=>time-t<60000);
    if (recent.length >= 10) throw deps.createHttpError(429, '확인 요청이 많습니다. 1분 후 다시 시도해주세요.', 'SECRET_REAUTH_RATE_LIMIT');
    attempts.set(account.id,[...recent,time]);
    try {
      try { await deps.verifySystemDataDeletionPassword(account.id,body.currentPassword); }
      catch(error) {
        if (error.errorCode === 'SYSTEM_DATA_DELETE_PASSWORD_INVALID') throw deps.createHttpError(403, '현재 로그인한 계정의 비밀번호가 올바르지 않습니다.', 'SECRET_PASSWORD_INVALID');
        throw error;
      }
      const value = body.kind === 'email' ? await deps.getStoredEmailPassword() : await deps.translationService.getStoredApiKey();
      if (!value) throw deps.createHttpError(404, '저장된 값이 없습니다. 먼저 설정을 저장해주세요.', 'SECRET_VALUE_NOT_FOUND');
      await audit(account,body.kind,true);
      deps.sendJson(response,200,{value},{'Cache-Control':'no-store','Pragma':'no-cache'});
    } catch(error) { await audit(account,body.kind,false); throw error; }
  })];
}
module.exports = { createSecretValueRoutes };
