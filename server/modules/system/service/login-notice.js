function createSystemLoginNoticeService({
  getDefaultApplicantNoticeHtml,
  defaultInitialPassword,
  getDefaultLoginNoticeHtml,
  parseSystemInitialPassword,
  query,
}) {
  const NOTICE_SCOPE_CONFIG = Object.freeze({
    login: Object.freeze({
      settingKey: "loginNoticeHtml",
      responseKey: "loginNoticeHtml",
      getDefaultHtml: (initialPassword) => getDefaultLoginNoticeHtml(initialPassword),
    }),
    applicant: Object.freeze({
      settingKey: "applicantNoticeHtml",
      responseKey: "applicantNoticeHtml",
      getDefaultHtml: () => getDefaultApplicantNoticeHtml(),
    }),
  });

  function normalizeNoticeScope(scope = "") {
    return String(scope || "").trim() === "applicant" ? "applicant" : "login";
  }

  function getNoticeScopeConfig(scope = "") {
    return NOTICE_SCOPE_CONFIG[normalizeNoticeScope(scope)] || NOTICE_SCOPE_CONFIG.login;
  }

  function parseLoginNoticeHtml(value, initialPassword = defaultInitialPassword) {
    const normalizedValue = String(value ?? "");
    // Replace only the exact old generated default; never rewrite a custom notice.
    const legacyDefault = [
      '<p><span style="display:inline-flex;padding:3px 8px;border-radius:6px;background:#2f63c8;color:#fff;font-weight:800;">계정 안내</span></p>',
      "<p><strong>ID : 계정 관리에 등록된 계정 ID</strong></p>",
      `<p><strong>PW : ${initialPassword}(초기 비밀번호)</strong></p>`,
      "<p>최초 로그인 시 비밀번호를 변경해야 서비스를 사용할 수 있습니다.</p>",
    ].join("");
    if (normalizedValue.trim() === legacyDefault) return getDefaultLoginNoticeHtml(initialPassword);
    const previousCommonDefault = [
      '<p><span style="display:inline-flex;padding:3px 8px;border-radius:6px;background:#2f63c8;color:#fff;font-weight:800;">계정 안내</span></p>',
      "<p>관리자와 수험생 모두 ID와 비밀번호로 로그인하세요.</p>",
      "<p>처음 방문한 수험생은 회원가입 후 접수를 진행해 주세요.</p>",
      "<p>관리자 계정은 부여된 권한에 맞는 관리 화면으로 이동합니다.</p>",
    ].join("");
    if (normalizedValue.trim() === previousCommonDefault) return getDefaultLoginNoticeHtml(initialPassword);
    return normalizedValue.trim() ? normalizedValue : getDefaultLoginNoticeHtml(initialPassword);
  }

  function parseApplicantNoticeHtml(value) {
    const normalizedValue = String(value ?? "");
    return normalizedValue.trim() ? normalizedValue : getDefaultApplicantNoticeHtml();
  }

  function normalizeLoginNoticePayload(payload = {}) {
    return {
      scope: normalizeNoticeScope(payload.scope),
      language: payload.language === "en" ? "en" : "ko",
      html: String(payload.html ?? payload.loginNoticeHtml ?? ""),
    };
  }

  async function getLoginNoticeHtml(scope = "login", language = "ko") {
    const scopeConfig = getNoticeScopeConfig(scope);
    const settingKey = scopeConfig.settingKey + (language === "en" ? "En" : "");
    const rows = await query(
      `
        SELECT
          setting_key AS settingKey,
          setting_value AS settingValue
        FROM system_set
        WHERE setting_key IN ('initialPassword', ?)
      `,
      [settingKey],
    );
    const rowsByKey = new Map((Array.isArray(rows) ? rows : []).map((row) => [String(row.settingKey || ""), row.settingValue]));
    const initialPassword = parseSystemInitialPassword(rowsByKey.get("initialPassword"));
    const storedValue = rowsByKey.get(settingKey);
    if (language === "en") return String(storedValue ?? "");

    return scopeConfig.settingKey === "applicantNoticeHtml"
      ? parseApplicantNoticeHtml(storedValue)
      : parseLoginNoticeHtml(storedValue, initialPassword);
  }

  async function updateLoginNoticeHtml(payload) {
    const nextNotice = normalizeLoginNoticePayload(payload);
    const scopeConfig = getNoticeScopeConfig(nextNotice.scope);

    await query(
      `
        INSERT INTO system_set (setting_key, setting_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE
          setting_value = VALUES(setting_value)
      `,
      [scopeConfig.settingKey + (nextNotice.language === "en" ? "En" : ""), nextNotice.html],
    );

    const savedHtml = await getLoginNoticeHtml(nextNotice.scope, nextNotice.language);

    return {
      scope: nextNotice.scope,
      language: nextNotice.language,
      html: savedHtml,
      [scopeConfig.responseKey + (nextNotice.language === "en" ? "En" : "")]: savedHtml,
    };
  }

  return Object.freeze({
    getApplicantNoticeHtml: async () => getLoginNoticeHtml("applicant"),
    getLoginNoticeHtml,
    normalizeLoginNoticePayload,
    parseApplicantNoticeHtml,
    parseLoginNoticeHtml,
    updateLoginNoticeHtml,
  });
}

module.exports = {
  createSystemLoginNoticeService,
};
