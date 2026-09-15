const { exactRoute } = require("../router");

function createAuthRoutes(deps) {
  const attempts = new Map();
  function limitLogin(request, id) {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    for (const [key, limit] of [[`ip:${request.socket.remoteAddress}`, 60], [`id:${id.toLowerCase()}`, 20]]) {
      const entry = attempts.get(key) || { count: 0, until: now + 60000 };
      entry.count += 1;
      attempts.set(key, entry);
      if (entry.count > limit) throw deps.createHttpError(429, "로그인 시도가 많습니다. 잠시 후 다시 시도하세요.");
    }
  }
  return [
    exactRoute(
      "GET",
      "/api/health",
      async ({ response }) => {
        const [health] = await deps.query(`SELECT 1 AS ok`);

        return deps.sendJson(response, 200, {
          ok: Number(health?.ok || 0) === 1,
          database: deps.databaseName || "applyhub",
        });
      },
      { auth: false },
    ),
    exactRoute(
      "GET",
      "/api/auth/session",
      async ({ request, response }) => deps.sendJson(response, 200, await deps.getAuthSessionPayload(request)),
      { auth: false },
    ),
    exactRoute(
      "POST",
      "/api/auth/login",
      async ({ request, response }) => {
        const body = await deps.readJsonBody(request);
        response.setHeader("Cache-Control", "no-store");
        const origin = request.headers.origin;
        if (origin && new URL(origin).host !== request.headers.host) throw deps.createHttpError(403, "허용되지 않은 요청입니다.");
        const id = String(body.id || body.email || body.loginId || "").trim();
        if (!id || !body.password) throw deps.createHttpError(400, "이메일 또는 관리자 ID와 비밀번호를 입력하세요.");
        limitLogin(request, id);
        // Staff IDs are reserved: a failed staff login must never fall back to a member.
        if (await deps.getAccountAuthRecord(id)) {
          const result = await deps.loginAccount({ ...body, id }, response);
          await deps.membershipService.logout(request, response);
          return deps.sendJson(response, 200, { ...result, accountType: "staff" });
        }
        const result = await deps.membershipService.login({ loginId: id, password: body.password }, request, response);
        deps.logoutAccount(request, response);
        return deps.sendJson(response, 200, { ...result, accountType: "applicant", redirectTo: "/applicant" });
      },
      { auth: false },
    ),
    exactRoute(
      "POST",
      "/api/auth/password/setup",
      async ({ request, response }) => {
        const body = await deps.readJsonBody(request);
        return deps.sendJson(response, 200, await deps.completeTemporaryPasswordSetup(request, body, response));
      },
      { auth: false },
    ),
    exactRoute(
      "POST",
      "/api/auth/logout",
      async ({ request, response }) => {
        deps.logoutAccount(request, response);
        await deps.membershipService.logout(request, response);
        return deps.sendJson(response, 200, { ok: true });
      },
      { auth: false },
    ),
    exactRoute(
      "GET",
      "/api/login-notice",
      async ({ response }) =>
        deps.sendJson(response, 200, {
          html: await deps.getLoginNoticeHtml(),
          superAdminSettings: await deps.getPublicSuperAdminSettings(),
        }),
      { auth: false },
    ),
  ];
}

module.exports = {
  createAuthRoutes,
};
