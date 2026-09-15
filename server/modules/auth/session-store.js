const { randomUUID } = require("crypto");

function createAuthSessionStore({
  authenticatedSessionTtlMs,
  passwordSetupSessionTtlMs,
  sessionCookieName,
}) {
  const sessionStore = new Map();

  function parseCookies(request) {
    return String(request.headers.cookie || "")
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .reduce((cookies, entry) => {
        const separatorIndex = entry.indexOf("=");

        if (separatorIndex <= 0) {
          return cookies;
        }

        const key = entry.slice(0, separatorIndex).trim();
        const value = entry.slice(separatorIndex + 1).trim();

        cookies[key] = decodeURIComponent(value);
        return cookies;
      }, {});
  }

  function destroySession(sessionId) {
    if (!sessionId) {
      return;
    }

    sessionStore.delete(sessionId);
  }

  function destroySessionsByAccountId(accountId) {
    sessionStore.forEach((session, sessionId) => {
      if (session.accountId === accountId) {
        sessionStore.delete(sessionId);
      }
    });
  }

  function createSession(accountId, stage = "authenticated") {
    const expiresAt = Date.now() + (stage === "password_setup" ? passwordSetupSessionTtlMs : authenticatedSessionTtlMs);
    const sessionId = randomUUID();

    sessionStore.set(sessionId, {
      accountId,
      stage,
      expiresAt,
    });

    return sessionId;
  }

  function buildSessionCookieValue(sessionId, maxAgeMs) {
    const maxAgeSeconds = Math.max(0, Math.floor(maxAgeMs / 1000));
    return `${sessionCookieName}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
  }

  function clearSessionCookie(response) {
    response.setHeader("Set-Cookie", [...[].concat(response.getHeader("Set-Cookie") || []), `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`]);
  }

  function attachSessionCookie(response, sessionId, stage = "authenticated") {
    const maxAgeMs = stage === "password_setup" ? passwordSetupSessionTtlMs : authenticatedSessionTtlMs;
    response.setHeader("Set-Cookie", [...[].concat(response.getHeader("Set-Cookie") || []), buildSessionCookieValue(sessionId, maxAgeMs)]);
  }

  function getSessionContext(request) {
    const sessionId = parseCookies(request)[sessionCookieName];

    if (!sessionId) {
      return null;
    }

    const session = sessionStore.get(sessionId);

    if (!session) {
      return null;
    }

    if (session.expiresAt <= Date.now()) {
      destroySession(sessionId);
      return null;
    }

    return {
      sessionId,
      session,
    };
  }

  return Object.freeze({
    attachSessionCookie,
    buildSessionCookieValue,
    clearSessionCookie,
    createSession,
    destroySession,
    destroySessionsByAccountId,
    getSessionContext,
    parseCookies,
  });
}

module.exports = {
  createAuthSessionStore,
};
