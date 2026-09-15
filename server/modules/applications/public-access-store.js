const { randomUUID } = require("crypto");

function createApplicantPublicAccessStore({
  createHttpError,
  publicAccessTtlMs = 1000 * 60 * 60,
}) {
  const publicAccessStore = new Map();

  function cleanupPublicAccessStore() {
    const now = Date.now();

    publicAccessStore.forEach((record, token) => {
      if (!record || record.expiresAt <= now) {
        publicAccessStore.delete(token);
      }
    });
  }

  function createPublicAccessToken(payload = {}) {
    cleanupPublicAccessStore();
    const token = randomUUID();

    publicAccessStore.set(token, {
      ...payload,
      expiresAt: Date.now() + publicAccessTtlMs,
    });

    return token;
  }

  function getPublicAccessRecordOrThrow(token, allowedTypes = []) {
    const normalizedToken = String(token || "").trim();

    if (!normalizedToken) {
      throw createHttpError(401, "접근 토큰이 필요합니다.", "PUBLIC_ACCESS_TOKEN_REQUIRED");
    }

    cleanupPublicAccessStore();
    const record = publicAccessStore.get(normalizedToken);

    if (!record) {
      throw createHttpError(401, "유효하지 않거나 만료된 접근 토큰입니다.", "PUBLIC_ACCESS_TOKEN_INVALID");
    }

    if (Array.isArray(allowedTypes) && allowedTypes.length > 0 && !allowedTypes.includes(record.type)) {
      throw createHttpError(403, "허용되지 않은 접근 유형입니다.", "PUBLIC_ACCESS_TYPE_INVALID");
    }

    return {
      token: normalizedToken,
      ...record,
    };
  }

  return Object.freeze({
    createPublicAccessToken,
    getPublicAccessRecordOrThrow,
  });
}

module.exports = {
  createApplicantPublicAccessStore,
};
