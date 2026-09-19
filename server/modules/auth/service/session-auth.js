function createAuthSessionService({
  attachSessionCookie,
  clearSessionCookie,
  createHttpError,
  createSession,
  destroySession,
  destroySessionsByAccountId,
  getAccountAuthRecord,
  getSessionContext,
  hashPassword,
  normalizeAccountSessionPayload,
  normalizePasswordSetupValue,
  query,
  updateAccountLastLogin,
  verifyPassword,
}) {
  async function getAuthenticatedAccountFromRequest(request, options = {}) {
    const sessionContext = getSessionContext(request);
    const allowPasswordSetup = options.allowPasswordSetup === true;

    if (!sessionContext) {
      throw createHttpError(401, "로그인이 필요합니다.", "AUTH_REQUIRED");
    }

    if (sessionContext.session.stage !== "authenticated" && !allowPasswordSetup) {
      throw createHttpError(403, "초기 비밀번호 변경을 먼저 완료하세요.", "PASSWORD_SETUP_REQUIRED");
    }

    const account = await getAccountAuthRecord(sessionContext.session.accountId);

    if (!account) {
      destroySession(sessionContext.sessionId);
      throw createHttpError(401, "계정 정보를 찾을 수 없습니다. 다시 로그인하세요.", "AUTH_REQUIRED");
    }

    return {
      ...sessionContext,
      account,
    };
  }

  async function loginAccount(payload, response) {
    const accountId = String(payload.id || "").trim();
    const password = normalizePasswordSetupValue(payload.password);

    if (!accountId || !password) {
      throw createHttpError(400, "계정 ID와 비밀번호를 모두 입력하세요.", "INVALID_LOGIN_PAYLOAD");
    }

    const account = await getAccountAuthRecord(accountId);

    if (!account || !(await verifyPassword(password, account.passwordValue))) {
      throw createHttpError(401, "계정 ID 또는 비밀번호가 올바르지 않습니다.", "INVALID_CREDENTIALS");
    }

    destroySessionsByAccountId(account.id);

    if (Number(account.passwordTemporary) === 1) {
      const sessionId = createSession(account.id, "password_setup");
      attachSessionCookie(response, sessionId, "password_setup");

      return {
        authenticated: false,
        requiresPasswordChange: true,
        account: normalizeAccountSessionPayload(account),
      };
    }

    await updateAccountLastLogin(account.id);
    const sessionId = createSession(account.id, "authenticated");
    attachSessionCookie(response, sessionId, "authenticated");

    return {
      authenticated: true,
      requiresPasswordChange: false,
      account: normalizeAccountSessionPayload(account),
    };
  }

  async function getAuthSessionPayload(request) {
    const sessionContext = getSessionContext(request);

    if (!sessionContext) {
      return {
        authenticated: false,
        requiresPasswordChange: false,
        account: null,
      };
    }

    const account = await getAccountAuthRecord(sessionContext.session.accountId);

    if (!account) {
      destroySession(sessionContext.sessionId);
      return {
        authenticated: false,
        requiresPasswordChange: false,
        account: null,
      };
    }

    return {
      authenticated: sessionContext.session.stage === "authenticated",
      requiresPasswordChange: sessionContext.session.stage === "password_setup",
      account: normalizeAccountSessionPayload(account),
    };
  }

  async function completeTemporaryPasswordSetup(request, payload, response) {
    const { sessionId, session, account } = await getAuthenticatedAccountFromRequest(request, { allowPasswordSetup: true });
    const nextPassword = normalizePasswordSetupValue(payload.password);
    const passwordConfirm = normalizePasswordSetupValue(payload.passwordConfirm);

    if (session.stage !== "password_setup") {
      throw createHttpError(400, "초기 비밀번호 설정이 필요한 로그인 상태가 아닙니다.", "PASSWORD_SETUP_NOT_REQUIRED");
    }

    if (!nextPassword) {
      throw createHttpError(400, "새 비밀번호를 입력하세요.", "PASSWORD_REQUIRED");
    }

    if (nextPassword.length < 4) {
      throw createHttpError(400, "비밀번호는 4자 이상이어야 합니다.", "PASSWORD_TOO_SHORT");
    }

    if (await verifyPassword(nextPassword, account.passwordValue)) {
      throw createHttpError(400, "초기 비밀번호와 다른 비밀번호를 설정하세요.", "PASSWORD_MUST_CHANGE");
    }

    if (passwordConfirm && nextPassword !== passwordConfirm) {
      throw createHttpError(400, "비밀번호 확인이 일치하지 않습니다.", "PASSWORD_CONFIRM_MISMATCH");
    }

    await query(
      `
        UPDATE accounts
        SET
          password_value = ?,
          password_temporary = 0,
          last_login_at = NOW()
        WHERE login_id = ?
      `,
      [await hashPassword(nextPassword), account.id],
    );

    destroySession(sessionId);
    const nextSessionId = createSession(account.id, "authenticated");
    attachSessionCookie(response, nextSessionId, "authenticated");

    return {
      authenticated: true,
      requiresPasswordChange: false,
      account: normalizeAccountSessionPayload(account),
    };
  }

  function logoutAccount(request, response) {
    const sessionContext = getSessionContext(request);

    if (sessionContext) {
      destroySession(sessionContext.sessionId);
    }

    clearSessionCookie(response);

    return {
      ok: true,
    };
  }

  return Object.freeze({
    completeTemporaryPasswordSetup,
    getAuthenticatedAccountFromRequest,
    getAuthSessionPayload,
    loginAccount,
    logoutAccount,
  });
}

module.exports = {
  createAuthSessionService,
};
