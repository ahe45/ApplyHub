const { exactRoute, regexRoute } = require("../router");

function decodeRouteParams(groups = {}) {
  return Object.fromEntries(
    Object.entries(groups).map(([key, value]) => [key, decodeURIComponent(String(value || ""))]),
  );
}

function createAccountRoutes(deps) {
  async function requireAccountManager(authenticatedAccount, accountId = '', nextRole = '') {
    if (authenticatedAccount?.role === deps.superAdminRole) return;
    if (authenticatedAccount?.role !== '관리자') {
      throw deps.createHttpError(403, '관리자 권한이 필요합니다.', 'ACCOUNT_MANAGER_REQUIRED');
    }
    const existingAccount = accountId ? await deps.getAccountAuthRecord(accountId) : null;
    if (String(nextRole || '').trim() === deps.superAdminRole || existingAccount?.role === deps.superAdminRole) {
      throw deps.createHttpError(403, '슈퍼관리자 권한이 필요합니다.', 'SUPER_ADMIN_REQUIRED');
    }
  }

  return [
    exactRoute("POST", "/api/accounts", async ({ request, response, authenticatedAccount }) => {
      const body = await deps.readJsonBody(request);
      await requireAccountManager(authenticatedAccount, body.id, body.role);
      return deps.sendJson(response, 201, await deps.createAccount(body));
    }),
    regexRoute(
      "PUT",
      /^\/api\/accounts\/(?<accountId>[^/]+)$/,
      async ({ request, response, params, authenticatedAccount }) => {
        const body = await deps.readJsonBody(request);
        await requireAccountManager(authenticatedAccount, params.accountId, body.role);
        return deps.sendJson(response, 200, await deps.updateAccount(params.accountId, body));
      },
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
    regexRoute(
      "POST",
      /^\/api\/accounts\/(?<accountId>[^/]+)\/reset-password$/,
      async ({ response, params, authenticatedAccount }) => {
        await requireAccountManager(authenticatedAccount, params.accountId);
        return deps.sendJson(response, 200, await deps.resetAccountPassword(params.accountId));
      },
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
    regexRoute(
      "DELETE",
      /^\/api\/accounts\/(?<accountId>[^/]+)$/,
      async ({ response, params, authenticatedAccount }) => {
        await requireAccountManager(authenticatedAccount, params.accountId);
        return deps.sendJson(response, 200, await deps.deleteAccount(params.accountId));
      },
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
  ];
}

module.exports = {
  createAccountRoutes,
};
