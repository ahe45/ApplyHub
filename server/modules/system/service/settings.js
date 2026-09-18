const crypto = require("crypto");

function createSystemSettingsService({
  buildDefaultRoleMenuVisibility,
  createHttpError,
  defaultAutoLogoutMinutes,
  defaultInitialPassword,
  fs,
  maxAutoLogoutMinutes,
  normalizeSuperAdminSettings,
  path,
  query,
  rootDir,
}) {
  const defaultApplicantExamNoDigitCount = 10;
  const maxApplicantExamNoDigitCount = 30;
  const defaultApplicantExamNoComponents = Object.freeze(["admissionCode", "seriesCode", "unitCode", "sequence", ""]);
  const allowedApplicantExamNoComponents = new Set(["", "admissionCode", "seriesCode", "unitCode", "nationalityCode", "sequence"]);
  const allowedAdmitCardDataSources = new Set(["submission", "examinee"]);
  const applicantScheduleDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
  const superAdminAssetPathPrefix = "/uploads/img/";
  const maxSuperAdminImageBytes = 5 * 1024 * 1024;
  const allowedSuperAdminImageMimeTypes = new Map(
    Object.entries({
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "image/svg+xml": ".svg",
    }),
  );
  const allowedSuperAdminImageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

  function getManagedSuperAdminAssetPrefix(assetUrl = "") {
    const normalizedAssetUrl = String(assetUrl || "").trim();
    return normalizedAssetUrl.startsWith(superAdminAssetPathPrefix) ? superAdminAssetPathPrefix : "";
  }

  function getSuperAdminAssetRootDir() {
    return path.join(rootDir, "uploads", "img");
  }

  function getDefaultSuperAdminSnapshot() {
    return {
      schoolName: "",
      logoImageUrl: "",
      backgroundImageUrl: "",
      recruitmentEnabled: true,
    };
  }

  function normalizeSuperAdminAssetField(field = "") {
    const normalizedField = String(field || "").trim();
    return normalizedField === "logoImageUrl" || normalizedField === "backgroundImageUrl" ? normalizedField : "";
  }

  function isManagedSuperAdminAssetUrl(value = "") {
    return Boolean(getManagedSuperAdminAssetPrefix(value));
  }

  function resolveManagedSuperAdminAssetPath(assetUrl = "") {
    const normalizedAssetUrl = String(assetUrl || "").trim();
    const matchedPrefix = getManagedSuperAdminAssetPrefix(normalizedAssetUrl);

    if (!matchedPrefix) {
      return "";
    }

    const safeRelativePath = path
      .normalize(normalizedAssetUrl)
      .replace(/^[/\\]+/, "");
    const absolutePath = path.join(rootDir, safeRelativePath);
    const assetRootDir = getSuperAdminAssetRootDir(normalizedAssetUrl);
    const relativeToAssetRoot = path.relative(assetRootDir, absolutePath);

    if (!relativeToAssetRoot || relativeToAssetRoot.startsWith("..") || path.isAbsolute(relativeToAssetRoot)) {
      return "";
    }

    return absolutePath;
  }

  async function deleteManagedSuperAdminAsset(assetUrl = "") {
    const absolutePath = resolveManagedSuperAdminAssetPath(assetUrl);

    if (!absolutePath) {
      return false;
    }

    try {
      await fs.promises.unlink(absolutePath);
      return true;
    } catch (error) {
      if (error?.code === "ENOENT") {
        return false;
      }

      throw error;
    }
  }

  async function cleanupReplacedSuperAdminAssets(currentSettings = {}, nextSettings = {}) {
    const normalizedCurrentSettings = normalizeSuperAdminSettings(currentSettings);
    const normalizedNextSettings = normalizeSuperAdminSettings(nextSettings);

    for (const field of ["logoImageUrl", "backgroundImageUrl"]) {
      const currentValue = String(normalizedCurrentSettings[field] || "").trim();
      const nextValue = String(normalizedNextSettings[field] || "").trim();

      if (!currentValue || currentValue === nextValue || !isManagedSuperAdminAssetUrl(currentValue)) {
        continue;
      }

      await deleteManagedSuperAdminAsset(currentValue);
    }
  }

  function getSuperAdminUploadExtension(fileName = "", mimeType = "") {
    const normalizedMimeType = String(mimeType || "").split(";")[0].trim().toLowerCase();

    if (allowedSuperAdminImageMimeTypes.has(normalizedMimeType)) {
      return allowedSuperAdminImageMimeTypes.get(normalizedMimeType) || "";
    }

    const normalizedExtension = path.extname(String(fileName || "").trim()).toLowerCase();

    if (allowedSuperAdminImageExtensions.has(normalizedExtension)) {
      return normalizedExtension === ".jpeg" ? ".jpg" : normalizedExtension;
    }

    throw createHttpError(400, "지원하지 않는 이미지 형식입니다.", "SUPER_ADMIN_IMAGE_TYPE_INVALID");
  }

  function buildSuperAdminAssetUrl(field = "", extension = ".png") {
    const normalizedField = normalizeSuperAdminAssetField(field);

    if (!normalizedField) {
      throw createHttpError(400, "이미지 저장 대상이 올바르지 않습니다.", "SUPER_ADMIN_IMAGE_FIELD_INVALID");
    }

    const filePrefix = normalizedField === "logoImageUrl" ? "logo" : "background";
    const uniqueId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
    return `${superAdminAssetPathPrefix}${filePrefix}-${Date.now()}-${uniqueId}${extension}`;
  }

  async function uploadSuperAdminImage(field, fileBuffer, options = {}) {
    const normalizedField = normalizeSuperAdminAssetField(field);
    const imageBuffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.alloc(0);
    const mimeType = String(options?.mimeType || "").trim();
    const fileName = String(options?.fileName || "").trim();
    const replaceUrl = String(options?.replaceUrl || "").trim();

    if (!normalizedField) {
      throw createHttpError(400, "이미지 저장 대상이 올바르지 않습니다.", "SUPER_ADMIN_IMAGE_FIELD_INVALID");
    }

    if (!imageBuffer.length) {
      throw createHttpError(400, "업로드할 이미지 파일이 없습니다.", "SUPER_ADMIN_IMAGE_REQUIRED");
    }

    if (imageBuffer.length > maxSuperAdminImageBytes) {
      throw createHttpError(400, "이미지 파일은 5MB 이하만 업로드할 수 있습니다.", "SUPER_ADMIN_IMAGE_TOO_LARGE");
    }

    const assetExtension = getSuperAdminUploadExtension(fileName, mimeType);
    const assetUrl = buildSuperAdminAssetUrl(normalizedField, assetExtension);
    const absolutePath = path.join(rootDir, assetUrl.replace(/^[/\\]+/, ""));

    await fs.promises.mkdir(getSuperAdminAssetRootDir(), { recursive: true });
    await fs.promises.writeFile(absolutePath, imageBuffer);

    if (replaceUrl && replaceUrl !== assetUrl && isManagedSuperAdminAssetUrl(replaceUrl)) {
      await deleteManagedSuperAdminAsset(replaceUrl);
    }

    return {
      field: normalizedField,
      imageUrl: assetUrl,
    };
  }

  function getValidApplicantScheduleReferenceDate(referenceDate = new Date()) {
    if (referenceDate instanceof Date && Number.isFinite(referenceDate.getTime())) {
      return referenceDate;
    }

    const parsedDate = new Date(referenceDate);
    return Number.isFinite(parsedDate.getTime()) ? parsedDate : new Date();
  }

  function getDefaultApplicantScheduleRange(referenceDate = new Date()) {
    const validReferenceDate = getValidApplicantScheduleReferenceDate(referenceDate);
    const year = validReferenceDate.getFullYear();

    return {
      startAt: `${year}-01-01T00:00`,
      endAt: `${year}-12-31T23:59`,
    };
  }

  function parseSystemInitialPassword(value) {
    const normalizedValue = String(value ?? "").trim();
    return normalizedValue || defaultInitialPassword;
  }

  function parseAutoLogoutMinutes(value) {
    const normalizedValue = Math.round(Number(value));

    if (!Number.isFinite(normalizedValue) || normalizedValue < 0) {
      return defaultAutoLogoutMinutes;
    }

    return Math.min(maxAutoLogoutMinutes, normalizedValue);
  }

  function parseAdmissionHomepageUrl(value) {
    return String(value ?? "").trim();
  }

  function parseApplicantScheduleDateTime(value, { defaultValue = "" } = {}) {
    const normalizedValue = String(value ?? "").trim();

    if (!normalizedValue) {
      return defaultValue;
    }

    const matchedValue = normalizedValue.match(applicantScheduleDateTimePattern);

    if (!matchedValue) {
      return defaultValue;
    }

    const [, yearValue, monthValue, dayValue, hourValue, minuteValue] = matchedValue;
    const year = Number(yearValue);
    const month = Number(monthValue);
    const day = Number(dayValue);
    const hour = Number(hourValue);
    const minute = Number(minuteValue);
    const parsedDate = new Date(year, month - 1, day, hour, minute, 0, 0);

    if (
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() + 1 !== month ||
      parsedDate.getDate() !== day ||
      parsedDate.getHours() !== hour ||
      parsedDate.getMinutes() !== minute
    ) {
      return defaultValue;
    }

    return `${yearValue}-${monthValue}-${dayValue}T${hourValue}:${minuteValue}`;
  }

  function getApplicantScheduleTimestamp(value) {
    const normalizedValue = parseApplicantScheduleDateTime(value);

    if (!normalizedValue) {
      return NaN;
    }

    const [, yearValue, monthValue, dayValue, hourValue, minuteValue] = normalizedValue.match(applicantScheduleDateTimePattern) || [];
    return new Date(
      Number(yearValue),
      Number(monthValue) - 1,
      Number(dayValue),
      Number(hourValue),
      Number(minuteValue),
      0,
      0,
    ).getTime();
  }

  function parseRequiredApplicantScheduleRange(scheduleLabel, startValue, endValue) {
    const startAt = parseApplicantScheduleDateTime(startValue);
    const endAt = parseApplicantScheduleDateTime(endValue);

    if (!startAt || !endAt) {
      throw createHttpError(400, `${scheduleLabel}은 반드시 설정해야 합니다.`, "APPLICANT_SCHEDULE_REQUIRED");
    }

    const startTimestamp = getApplicantScheduleTimestamp(startAt);
    const endTimestamp = getApplicantScheduleTimestamp(endAt);

    if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp)) {
      throw createHttpError(400, `${scheduleLabel} 형식이 올바르지 않습니다.`, "APPLICANT_SCHEDULE_INVALID");
    }

    if (startTimestamp > endTimestamp) {
      throw createHttpError(400, `${scheduleLabel}의 시작 일시는 종료 일시보다 늦을 수 없습니다.`, "APPLICANT_SCHEDULE_RANGE_INVALID");
    }

    return {
      startAt,
      endAt,
    };
  }

  function parseApplicantExamNoDigitCount(value) {
    const normalizedValue = Math.round(Number(value));

    if (!Number.isFinite(normalizedValue) || normalizedValue < 1) {
      return defaultApplicantExamNoDigitCount;
    }

    return Math.min(maxApplicantExamNoDigitCount, normalizedValue);
  }

  function parseApplicantExamNoComponents(value) {
    let sourceValues = value;

    if (!Array.isArray(sourceValues)) {
      try {
        sourceValues = JSON.parse(String(value || "[]"));
      } catch (error) {
        sourceValues = [];
      }
    }

    const normalizedValues = Array.from({ length: 5 }, (_, index) => {
      const normalizedValue = String(sourceValues?.[index] ?? "").trim();
      return allowedApplicantExamNoComponents.has(normalizedValue) ? normalizedValue : "";
    });

    return normalizedValues.some(Boolean) ? normalizedValues : [...defaultApplicantExamNoComponents];
  }

  function parseSuperAdminSettings(value) {
    let parsedValue = {};

    if (value && typeof value === "object") {
      parsedValue = value;
    } else {
      try {
        parsedValue = JSON.parse(String(value || "{}"));
      } catch (error) {
        parsedValue = {};
      }
    }

    return normalizeSuperAdminSettings({
      ...getDefaultSuperAdminSnapshot(),
      ...parsedValue,
    });
  }

  function validateSuperAdminImageUrl(value, fieldLabel) {
    const normalizedValue = String(value ?? "").trim();

    if (!normalizedValue) {
      return "";
    }

    if (/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(normalizedValue)) {
      return normalizedValue;
    }

    if (/^\/\S*$/i.test(normalizedValue) || /^https?:\/\/\S+$/i.test(normalizedValue)) {
      return normalizedValue;
    }

    throw createHttpError(400, `${fieldLabel} 형식이 올바르지 않습니다.`, "SUPER_ADMIN_IMAGE_INVALID");
  }

  function validateSuperAdminSettings(payload) {
    const nextSettings = normalizeSuperAdminSettings(payload);

    if (nextSettings.schoolName.length > 100) {
      throw createHttpError(400, "학교명은 100자 이하여야 합니다.", "SCHOOL_NAME_TOO_LONG");
    }

    const logoImageUrl = validateSuperAdminImageUrl(nextSettings.logoImageUrl, "로고 이미지");
    const backgroundImageUrl = validateSuperAdminImageUrl(nextSettings.backgroundImageUrl, "배경 이미지");

    if (logoImageUrl.length > 8_000_000 || backgroundImageUrl.length > 8_000_000) {
      throw createHttpError(400, "업로드한 이미지 데이터가 너무 큽니다.", "SUPER_ADMIN_IMAGE_TOO_LARGE");
    }

    return {
      ...nextSettings,
      logoImageUrl,
      backgroundImageUrl,
    };
  }

  function normalizeSystemSettingsRows(rows) {
    const rowsByKey = new Map(
      (Array.isArray(rows) ? rows : []).map((row) => [String(row.settingKey || ""), String(row.settingValue || "")]),
    );

    return {
      initialPassword: parseSystemInitialPassword(rowsByKey.get("initialPassword")),
      autoLogoutMinutes: parseAutoLogoutMinutes(rowsByKey.get("autoLogoutMinutes")),
      admissionHomepageUrl: parseAdmissionHomepageUrl(rowsByKey.get("admissionHomepageUrl")),
      applicantExamNoDigitCount: parseApplicantExamNoDigitCount(rowsByKey.get("applicantExamNoDigitCount")),
      applicantExamNoComponents: parseApplicantExamNoComponents(rowsByKey.get("applicantExamNoComponentsJson")),
    };
  }

  function normalizeSystemSettingsPayload(payload = {}) {
    const initialPassword = String(payload.initialPassword ?? "").trim();
    const autoLogoutMinutes = Math.round(Number(payload.autoLogoutMinutes));
    const admissionHomepageUrl = parseAdmissionHomepageUrl(payload.admissionHomepageUrl);

    if (!initialPassword) {
      throw createHttpError(400, "초기 비밀번호를 입력하세요.", "INITIAL_PASSWORD_REQUIRED");
    }

    if (initialPassword.length < 4) {
      throw createHttpError(400, "초기 비밀번호는 4자 이상이어야 합니다.", "INITIAL_PASSWORD_TOO_SHORT");
    }

    if (initialPassword.length > 100) {
      throw createHttpError(400, "초기 비밀번호는 100자 이하여야 합니다.", "INITIAL_PASSWORD_TOO_LONG");
    }

    if (!Number.isFinite(autoLogoutMinutes) || autoLogoutMinutes < 0 || autoLogoutMinutes > maxAutoLogoutMinutes) {
      throw createHttpError(
        400,
        `자동 로그아웃 시간은 0분 이상 ${maxAutoLogoutMinutes}분 이하로 입력하세요.`,
        "AUTO_LOGOUT_MINUTES_INVALID",
      );
    }

    if (admissionHomepageUrl.length > 500) {
      throw createHttpError(400, "입학처 홈페이지 링크는 500자 이하여야 합니다.", "ADMISSION_HOMEPAGE_URL_TOO_LONG");
    }

    if (admissionHomepageUrl && !/^https?:\/\/\S+$/i.test(admissionHomepageUrl) && !/^\/\S*$/.test(admissionHomepageUrl)) {
      throw createHttpError(
        400,
        "입학처 홈페이지 링크는 https:// 주소 또는 /경로 형식으로 입력하세요.",
        "ADMISSION_HOMEPAGE_URL_INVALID",
      );
    }

    const applicantExamNoDigitCount = parseApplicantExamNoDigitCount(payload.applicantExamNoDigitCount);
    const applicantExamNoComponents = parseApplicantExamNoComponents(payload.applicantExamNoComponents);
    const selectedComponents = applicantExamNoComponents.filter(Boolean);

    if (selectedComponents.length === 0) {
      throw createHttpError(400, "수험번호 자동 생성 구성 요소를 하나 이상 선택하세요.", "APPLICANT_EXAM_NO_COMPONENTS_REQUIRED");
    }

    if (selectedComponents.filter((value) => value === "sequence").length !== 1) {
      throw createHttpError(400, "수험번호 자동 생성 구성에는 순번을 한 번만 포함해야 합니다.", "APPLICANT_EXAM_NO_SEQUENCE_COMPONENT_REQUIRED");
    }

    if (new Set(selectedComponents).size !== selectedComponents.length) {
      throw createHttpError(400, "수험번호 자동 생성 구성 요소는 중복 없이 선택하세요.", "APPLICANT_EXAM_NO_COMPONENTS_DUPLICATED");
    }

    return {
      initialPassword,
      autoLogoutMinutes,
      admissionHomepageUrl,
      applicantExamNoDigitCount,
      applicantExamNoComponents,
    };
  }

  async function getSystemSettings() {
    const rows = await query(
      `
        SELECT
          setting_key AS settingKey,
          setting_value AS settingValue
        FROM system_set
        WHERE setting_key IN (
          'initialPassword',
          'autoLogoutMinutes',
          'admissionHomepageUrl',
          'applicantExamNoDigitCount',
          'applicantExamNoComponentsJson'
        )
      `,
    );

    return normalizeSystemSettingsRows(rows);
  }

  async function getSuperAdminSettings() {
    const rows = await query(
      `
        SELECT
          setting_key AS settingKey,
          setting_value AS settingValue
        FROM system_set
        WHERE setting_key IN ('superAdminSettingsJson')
      `,
    );
    const rowsByKey = new Map(
      (Array.isArray(rows) ? rows : []).map((row) => [String(row.settingKey || ""), String(row.settingValue || "")]),
    );

    return parseSuperAdminSettings(rowsByKey.get("superAdminSettingsJson"));
  }

  async function getPublicSuperAdminSettings() {
    return getSuperAdminSettings();
  }

  async function getRoleMenuVisibilitySettings() {
    return buildDefaultRoleMenuVisibility();
  }

  async function updateSystemSettings(payload) {
    const nextSettings = normalizeSystemSettingsPayload(payload);
    await query(
      `
        INSERT INTO system_set (setting_key, setting_value)
        VALUES
          ('initialPassword', ?),
          ('autoLogoutMinutes', ?),
          ('admissionHomepageUrl', ?),
          ('applicantExamNoDigitCount', ?),
          ('applicantExamNoComponentsJson', ?)
        ON DUPLICATE KEY UPDATE
          setting_value = VALUES(setting_value)
      `,
      [
        nextSettings.initialPassword,
        String(nextSettings.autoLogoutMinutes),
        nextSettings.admissionHomepageUrl,
        String(nextSettings.applicantExamNoDigitCount),
        JSON.stringify(nextSettings.applicantExamNoComponents),
      ],
    );

    return getSystemSettings();
  }

  async function updateSuperAdminSettings(payload) {
    const currentSettings = await getSuperAdminSettings();
    const nextSettings = validateSuperAdminSettings(payload);

    await query(
      `
        INSERT INTO system_set (setting_key, setting_value)
        VALUES ('superAdminSettingsJson', ?)
        ON DUPLICATE KEY UPDATE
          setting_value = VALUES(setting_value)
      `,
      [JSON.stringify(nextSettings)],
    );

    await cleanupReplacedSuperAdminAssets(currentSettings, nextSettings);
    return getSuperAdminSettings();
  }

  return Object.freeze({
    getPublicSuperAdminSettings,
    getRoleMenuVisibilitySettings,
    getSuperAdminSettings,
    getSystemSettings,
    normalizeSystemSettingsPayload,
    parseAutoLogoutMinutes,
    parseAdmissionHomepageUrl,
    parseSystemInitialPassword,
    uploadSuperAdminImage,
    updateSuperAdminSettings,
    updateSystemSettings,
  });
}

module.exports = {
  createSystemSettingsService,
};
