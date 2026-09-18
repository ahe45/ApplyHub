const { createFormTemplateService } = require('./form-templates');
const applicantFormConfig = require("../../../shared/domain/applicant-form");
const { randomInt, randomUUID } = require("crypto");
const AdmZip = require("adm-zip");
const path = require("path");
const { getApplicantDocumentSubmissionScheduleState } = require("../../../shared/domain/applicant-form");
const { normalizeFileUploadSettings, isAllowedUploadExtension } = require("../../../shared/domain/applicant-form");
const {

  createApplicantImportHelpers,
  buildApplicantRecruitmentUnitImportKey,
  getApplicantRecruitmentImportRowLabel,
  normalizeApplicantImportExistingDataPolicy,
  shouldProcessApplicantImportOperation,
} = require("./import-utils");
const { createApplicantAttachmentStorage } = require("./attachment-storage");

const { createApplicantPublicAccessStore } = require("./public-access-store");
const { createApplicantWorkbookService } = require("./workbook-service");
const { createDocumentStatusService } = require("./document-status");
const { createApplicantArchiveJobs } = require("./archive-jobs");

const {

  APPLICANT_CODE_PATTERN,
  APPLICANT_DATE_PATTERN,
  APPLICANT_DEFAULT_EXAM_NO_COMPONENTS,
  APPLICANT_DEFAULT_EXAM_NO_DIGIT_COUNT,
  APPLICANT_DEFAULT_RECRUITMENT_EXAM_NO_PATTERN,
  APPLICANT_EMAIL_DELIVERY_STATUSES,
  APPLICANT_EMAIL_PATTERN,
  APPLICANT_EXAM_NO_CODE_TOKEN_PATTERN,
  APPLICANT_EXAM_NO_COMPONENT_TYPES,
  APPLICANT_EXAM_NO_TOKEN_PATTERN,
  APPLICANT_FORM_INPUT_TYPES,
  APPLICANT_IMPORT_PREVIEW_ROW_LIMIT,
  APPLICANT_MAX_EXAM_NO_DIGIT_COUNT,
  APPLICANT_PHONE_PATTERN,
  STORED_TICKET_OVERRIDE_KEYS,
  APPLICANT_PUBLIC_ACCESS_TYPES,
  APPLICANT_PUBLIC_LOOKUP_TARGETS,
  APPLICANT_RECRUITMENT_SELECTION_FIELDS,
  APPLICANT_RECRUITMENT_SELECTION_FIELD_KEY_MAP,
  APPLICANT_RECRUITMENT_SELECTION_SYSTEM_FIELD_MAP,
  APPLICANT_RECRUITMENT_UNIT_PAIR_FIELDS,
  APPLICANT_SCHEDULE_DATE_TIME_PATTERN,
  APPLICANT_TIME_PATTERN,
  DEFAULT_APPLICANT_FORM_FIELD_SEEDS,
  defaultApplicantExamNoPattern,
  defaultApplicantExamNoSequenceStart,
  findApplicantNationalityOption,
  getSharedApplicantStatusLabel,
  isApplicantUploadInputType,
  protectedApplicantSystemFields,
} = require("./config");

function createApplicantService({
  applicantFileStorageDirName = "uploads/file",
  applicantPhotoStorageDirName = "uploads/photo",
  buildAdmitCardPdfBuffer,
  buildAdmitCardPdfBufferFromRecord,
  createHttpError,
  emailVerificationTtlMs = 1000 * 60 * 10,
  examineePhotoStorageDirName = "photo",
  getDefaultApplicantNoticeHtml = () => "",
  getPool,
  hashPassword = (value) => String(value ?? ""),
  publicAccessTtlMs = 1000 * 60 * 60,
  query,
  rootDir = process.cwd(),
  sendVerificationEmail,
  verifyPassword = (plainPassword, storedPassword) => String(plainPassword ?? "") === String(storedPassword ?? ""),
}) {
  const formTemplates = createFormTemplateService({ query, getPool, createHttpError, randomUUID });
  const documentStatusService = createDocumentStatusService({ query, getPool, getFields: getApplicantFormFields, getFieldsForSubmission: getDocumentFieldsForSubmission, getTemplateContext: getDocumentTemplateContext, getSubmission: getApplicantSubmissionById, getSubmissions: getApplicantSubmissions, createHttpError });
  const attachmentArchiveJobs = createApplicantArchiveJobs({
    query, getSubmission: getApplicantSubmissionById, getPhoto: getApplicantSubmissionPhoto,
    getFile: getApplicantSubmissionFile, createHttpError,
  });
  const buildSubmissionAdmitCardPdfBuffer =
    typeof buildAdmitCardPdfBufferFromRecord === "function"
      ? buildAdmitCardPdfBufferFromRecord
      : async () => {
          throw createHttpError(500, "접수 데이터 기반 수험표 PDF 생성기를 사용할 수 없습니다.", "APPLICANT_ADMIT_CARD_PDF_BUILDER_UNAVAILABLE");
        };
  const dispatchVerificationEmail =
    typeof sendVerificationEmail === "function"
      ? sendVerificationEmail
      : async () => {
          throw createHttpError(
            503,
            "이메일 발송 설정이 완료되지 않았습니다. SMTP 환경설정을 확인하세요.",
            "APPLICANT_VERIFICATION_EMAIL_NOT_CONFIGURED",
          );
        };
  const {
    createPublicAccessToken,
    getPublicAccessRecordOrThrow,
  } = createApplicantPublicAccessStore({
    createHttpError,
    publicAccessTtlMs,
  });
  const applicantWorkbookService = createApplicantWorkbookService({
    createHttpError,
  });
  const {

    buildStoredApplicantFileAnswerData,
    buildStoredApplicantFileRecord,
    buildStoredApplicantPhotoAnswerData,
    buildStoredApplicantPhotoRecord,

    deleteApplicantSubmissionArtifacts,
    normalizeApplicantFilePayload,
    normalizeApplicantPhotoPayload,
    normalizeApplicantStoredFileValue,
    normalizeApplicantStoredPhotoValue,
    persistApplicantFile,
    persistApplicantPhotoFile,

    readStoredApplicantFile,
    readStoredApplicantPhotoFile,
    readStoredPromotedPhotoFile,
  } = createApplicantAttachmentStorage({
    applicantFileStorageDirName,
    applicantPhotoStorageDirName,
    createHttpError,
    examineePhotoStorageDirName,
    rootDir,
  });
  function normalizeStoredTicketOverrides(rawValue = null) {
    const sourceValue =
      typeof rawValue === "string"
        ? (() => {
            try {
              return JSON.parse(rawValue);
            } catch (error) {
              return {};
            }
          })()
        : rawValue && typeof rawValue === "object"
          ? rawValue
          : {};
    const normalizedSourceValue =
      sourceValue.seriesCode || !sourceValue.trackCode
        ? sourceValue
        : {
            ...sourceValue,
            seriesCode: sourceValue.trackCode,
          };

    return STORED_TICKET_OVERRIDE_KEYS.reduce((override, key) => {
      const normalizedValue = String(normalizedSourceValue?.[key] || "").trim();

      if (normalizedValue) {
        override[key] = normalizedValue;
      }

      return override;
    }, {});
  }

  function normalizeApplicantEmailDeliveryStatus(value) {
    const normalizedValue = String(value || "").trim().toLowerCase();

    return Object.values(APPLICANT_EMAIL_DELIVERY_STATUSES).includes(normalizedValue)
      ? normalizedValue
      : APPLICANT_EMAIL_DELIVERY_STATUSES.PENDING;
  }

  async function executeRows(queryable, sql, params = []) {
    const result = await queryable(sql, params);
    return Array.isArray(result?.[0]) ? result[0] : result;
  }

  function normalizeApplicantDateTimeValue(value) {
    const normalizedStringValue = String(value || "").trim();

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalizedStringValue)) {
      return normalizedStringValue;
    }

    const candidateDate = value instanceof Date ? value : new Date(value);
    return Number.isNaN(candidateDate.getTime()) ? "" : candidateDate.toISOString().slice(0, 19).replace("T", " ");
  }

  function normalizeApplicantPublicLookupTarget(value, options = {}) {
    const normalizedValue = String(value ?? "").trim();
    const defaultValue =
      options.defaultValue && Object.values(APPLICANT_PUBLIC_LOOKUP_TARGETS).includes(options.defaultValue)
        ? options.defaultValue
        : APPLICANT_PUBLIC_LOOKUP_TARGETS.ticket;

    return Object.values(APPLICANT_PUBLIC_LOOKUP_TARGETS).includes(normalizedValue) ? normalizedValue : defaultValue;
  }

  function normalizeApplicantText(value, label, options = {}) {
    const normalizedValue = String(value ?? "").trim();

    if (!normalizedValue && options.required !== false) {
      throw createHttpError(400, `${label}을(를) 입력하세요.`, options.errorCode || "APPLICANT_VALUE_REQUIRED");
    }

    if (options.maxLength && normalizedValue.length > options.maxLength) {
      throw createHttpError(400, `${label}은(는) ${options.maxLength}자 이하여야 합니다.`, options.errorCode || "APPLICANT_VALUE_TOO_LONG");
    }

    return normalizedValue;
  }

  function normalizeApplicantDate(value, label, options = {}) {
    const normalizedValue = normalizeApplicantText(value, label, options);

    if (!normalizedValue) {
      return "";
    }

    if (!APPLICANT_DATE_PATTERN.test(normalizedValue)) {
      throw createHttpError(400, `${label} 형식은 YYYY-MM-DD여야 합니다.`, "APPLICANT_DATE_INVALID");
    }

    return normalizedValue;
  }

  function normalizeApplicantTime(value, label, options = {}) {
    const normalizedValue = normalizeApplicantText(value, label, options);

    if (!normalizedValue) {
      return "";
    }

    if (!APPLICANT_TIME_PATTERN.test(normalizedValue)) {
      throw createHttpError(400, `${label} 형식은 HH:MM이어야 합니다.`, "APPLICANT_TIME_INVALID");
    }

    const [hourText, minuteText] = normalizedValue.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);

    if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw createHttpError(400, `${label} 값이 올바르지 않습니다.`, "APPLICANT_TIME_RANGE_INVALID");
    }

    return normalizedValue;
  }

  function normalizeApplicantPhone(value, label, options = {}) {
    const normalizedValue = String(value ?? "").replace(/\D+/g, "");

    if (!normalizedValue && options.required !== false) {
      throw createHttpError(400, `${label}을(를) 입력하세요.`, options.errorCode || "APPLICANT_PHONE_REQUIRED");
    }

    if (!normalizedValue) {
      return "";
    }

    if (!APPLICANT_PHONE_PATTERN.test(normalizedValue)) {
      throw createHttpError(400, `${label}은(는) 숫자만 입력할 수 있습니다.`, options.errorCode || "APPLICANT_PHONE_INVALID");
    }

    if (normalizedValue.length > 20) {
      throw createHttpError(400, `${label}은(는) 20자리 이하여야 합니다.`, options.errorCode || "APPLICANT_PHONE_TOO_LONG");
    }

    return normalizedValue;
  }

  function normalizeApplicantEmail(value) {
    const normalizedValue = String(value ?? "").trim().toLowerCase();

    if (!normalizedValue) {
      throw createHttpError(400, "이메일을 입력하세요.", "APPLICANT_EMAIL_REQUIRED");
    }

    if (!APPLICANT_EMAIL_PATTERN.test(normalizedValue)) {
      throw createHttpError(400, "이메일 형식이 올바르지 않습니다.", "APPLICANT_EMAIL_INVALID");
    }

    return normalizedValue;
  }

  function normalizeApplicantNationality(value, label, options = {}) {
    const normalizedValue = normalizeApplicantText(value, label, {
      ...options,
      maxLength: 120,
    });

    if (!normalizedValue) {
      return "";
    }

    const matchedNationality = typeof findApplicantNationalityOption === "function" ? findApplicantNationalityOption(normalizedValue) : null;

    if (!matchedNationality) {
      throw createHttpError(400, `${label} 목록에서 올바른 국가를 선택하세요.`, "APPLICANT_NATIONALITY_INVALID");
    }

    return String(matchedNationality.label || normalizedValue).trim();
  }

  function normalizeApplicantSubmissionPassword(rawPassword, existingSubmission = null) {
    const passwordValue = String(rawPassword ?? "");

    if (!passwordValue.trim()) {
      if (existingSubmission?.hasPassword) {
        return {
          hasPassword: true,
          shouldUpdate: false,
          value: "",
        };
      }

      throw createHttpError(400, "비밀번호를 입력하세요.", "APPLICANT_PASSWORD_REQUIRED");
    }

    if (passwordValue.length < 4) {
      throw createHttpError(400, "비밀번호는 4자 이상이어야 합니다.", "APPLICANT_PASSWORD_TOO_SHORT");
    }

    if (passwordValue.length > 100) {
      throw createHttpError(400, "비밀번호는 100자 이하여야 합니다.", "APPLICANT_PASSWORD_TOO_LONG");
    }

    return {
      hasPassword: true,
      shouldUpdate: true,
      value: hashPassword(passwordValue),
    };
  }

  function normalizeApplicantOptionValues(payload = {}, existingField = {}) {
    const existingOptionConfig = parseApplicantOptionConfig(payload.optionsJson ?? existingField.optionsJson);
    const rawOptionValues = Array.isArray(payload.options)
      ? payload.options
      : payload.optionValuesText != null
        ? String(payload.optionValuesText)
            .split(/\r?\n/g)
            .map((value) => value.trim())
            .filter(Boolean)
        : Array.isArray(existingField.options)
          ? existingField.options
          : existingOptionConfig.items;

    return Array.from(new Set(rawOptionValues.map((value) => String(value).trim()).filter(Boolean)));
  }

  function parseApplicantOptionConfig(value) {
    const defaultConfig = {
      items: [],
      allowCustomOption: false,
      customOptionLabel: "",
    };

    if (!String(value || "").trim()) {
      return defaultConfig;
    }

    try {
      const parsedValue = JSON.parse(String(value || ""));

      if (Array.isArray(parsedValue)) {
        return {
          items: parsedValue.map((entry) => String(entry || "").trim()).filter(Boolean),
          allowCustomOption: false,
          customOptionLabel: "",
        };
      }

      if (!parsedValue || typeof parsedValue !== "object") {
        return defaultConfig;
      }

      const items = Array.isArray(parsedValue.items)
        ? parsedValue.items.map((entry) => String(entry || "").trim()).filter(Boolean)
        : [];
      const allowCustomOption = parsedValue.allowCustomOption === true || parsedValue.allowCustom === true;
      const explicitCustomOptionLabel = String(parsedValue.customOptionLabel || parsedValue.customOptionValue || "").trim();
      const customOptionLabel =
        explicitCustomOptionLabel && items.includes(explicitCustomOptionLabel)
          ? explicitCustomOptionLabel
          : allowCustomOption && items.includes("기타")
            ? "기타"
            : "";

      return {
        items,
        optionsEn: applicantFormConfig.normalizeChoiceTranslations(items, parsedValue.optionsEn),
        allowCustomOption,
        customOptionLabel,
        fileNamePattern: String(parsedValue.fileNamePattern || ""),
        allowedExtensions: Array.isArray(parsedValue.allowedExtensions) ? parsedValue.allowedExtensions : [],
      };
    } catch (error) {
      return defaultConfig;
    }
  }

  function normalizeApplicantAllowCustomOption(payload = {}, existingField = {}) {
    if (payload.allowCustomOption != null) {
      return payload.allowCustomOption === true || payload.allowCustomOption === "true" || Number(payload.allowCustomOption) === 1;
    }

    if (typeof existingField.allowCustomOption === "boolean") {
      return existingField.allowCustomOption;
    }

    const existingOptionConfig = parseApplicantOptionConfig(existingField.optionsJson);
    return existingOptionConfig.allowCustomOption === true || Boolean(existingOptionConfig.customOptionLabel);
  }

  function normalizeApplicantCustomOptionLabel(payload = {}, existingField = {}) {
    if (payload.customOptionLabel != null) {
      return String(payload.customOptionLabel || "").trim();
    }

    if (typeof existingField.customOptionLabel === "string") {
      return String(existingField.customOptionLabel || "").trim();
    }

    const existingOptionConfig = parseApplicantOptionConfig(existingField.optionsJson);
    return String(existingOptionConfig.customOptionLabel || "").trim();
  }

  function parseApplicantJsonArray(value) {
    if (!String(value || "").trim()) {
      return [];
    }

    try {
      const parsedValue = JSON.parse(String(value || "[]"));
      return Array.isArray(parsedValue) ? parsedValue : [];
    } catch (error) {
      return [];
    }
  }

  function normalizeApplicantFormFieldRecord(row = {}) {
    const optionConfig = parseApplicantOptionConfig(row.optionsJson);
    const options = optionConfig.items;

    return {
      id: Number(row.id || 0),
      templateId: Number(row.templateId || 0),
      formScope: row.formScope === 'documents' ? 'documents' : 'application',
      fieldKey: String(row.fieldKey || "").trim(),
      questionText: String(row.questionText || "").trim(),
      questionDescription: String(row.questionDescription || "").trim(),
      questionTextEn: String(row.questionTextEn || "").trim(),
      questionDescriptionEn: String(row.questionDescriptionEn || "").trim(),
      inputType: String(row.inputType || "text").trim(),
      systemFieldKey: String(row.systemFieldKey || "").trim(),
      options,
      optionValuesText: options.join("\n"),
      optionsEn: applicantFormConfig.normalizeChoiceTranslations(options, optionConfig.optionsEn),
      fileNamePattern: optionConfig.fileNamePattern || "",
      allowedExtensions: optionConfig.allowedExtensions || [],
      allowCustomOption: optionConfig.allowCustomOption === true,
      customOptionLabel: String(optionConfig.customOptionLabel || "").trim(),
      required: Number(row.required) === 1 || row.required === true,
      active: Number(row.active) === 1 || row.active === true,
      sortOrder: Number(row.sortOrder || 0),
      createdAt: String(row.createdAt || "").trim(),
      updatedAt: String(row.updatedAt || "").trim(),
    };
  }

  function buildApplicantFieldKey(questionText = "") {
    const normalizedQuestionText = String(questionText || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return normalizedQuestionText || `field-${randomUUID().slice(0, 8)}`;
  }

  function normalizeApplicantCode(value, label, options = {}) {
    const normalizedValue = String(value ?? "").trim().toUpperCase();

    if (!normalizedValue && options.required !== false) {
      throw createHttpError(400, `${label}를 입력하세요.`, options.errorCode || "APPLICANT_CODE_REQUIRED");
    }

    if (!normalizedValue) {
      return "";
    }

    if (normalizedValue.length > (options.maxLength || 30)) {
      throw createHttpError(
        400,
        `${label}는 ${options.maxLength || 30}자 이하여야 합니다.`,
        options.errorCode || "APPLICANT_CODE_TOO_LONG",
      );
    }

    if (!APPLICANT_CODE_PATTERN.test(normalizedValue)) {
      throw createHttpError(
        400,
        `${label}는 영문 대문자, 숫자, -, _ 만 사용할 수 있습니다.`,
        options.errorCode || "APPLICANT_CODE_INVALID",
      );
    }

    return normalizedValue;
  }

  function getApplicantSubmissionHasPhoto(submission = {}) {
    if (submission?.hasPhoto === true || Number(submission?.hasPhoto) === 1) {
      return true;
    }

    const photoAnswerItem =
      normalizeStoredAnswerItems(submission?.answerItems).find((answerItem) => answerItem?.inputType === "photo") || null;

    return photoAnswerItem?.value?.hasPhoto === true || Boolean(String(submission?.photoFileName || "").trim());
  }

  function getExistingApplicantUploadAnswerValue(existingSubmission = null, fieldKey = "", inputType = "") {
    const normalizedFieldKey = String(fieldKey || "").trim();
    const normalizedInputType = String(inputType || "").trim();

    if (!existingSubmission || !normalizedFieldKey || !isApplicantUploadInputType(normalizedInputType)) {
      return null;
    }

    const matchedAnswerItem = normalizeStoredAnswerItems(existingSubmission?.answerItems).find((answerItem) => {
      return String(answerItem?.fieldKey || "").trim() === normalizedFieldKey && String(answerItem?.inputType || "").trim() === normalizedInputType;
    });

    if (!matchedAnswerItem || !matchedAnswerItem.value || typeof matchedAnswerItem.value !== "object") {
      return null;
    }

    if (normalizedInputType === "photo") {
      return {
        fileName: String(matchedAnswerItem.value.fileName || "").trim(),
        mimeType: String(matchedAnswerItem.value.mimeType || "").trim(),
        hasPhoto: matchedAnswerItem.value.hasPhoto === true || Number(matchedAnswerItem.value.hasPhoto) === 1,
      };
    }

    return {
      fileName: String(matchedAnswerItem.value.fileName || "").trim(),
      mimeType: String(matchedAnswerItem.value.mimeType || "").trim(),
      hasFile: matchedAnswerItem.value.hasFile === true || Number(matchedAnswerItem.value.hasFile) === 1,
    };
  }

  function normalizeApplicantSubmissionIdList(values = []) {
    const normalizedIds = Array.from(
      new Set(
        (Array.isArray(values) ? values : [values])
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    );

    if (normalizedIds.length === 0) {
      throw createHttpError(400, "대상 접수 이력을 선택하세요.", "APPLICANT_PROMOTION_SUBMISSION_IDS_REQUIRED");
    }

    return normalizedIds;
  }

  function normalizeApplicantRecruitmentUnitRecord(row = {}) {
    return {
      id: Number(row.id || 0),
      trackName: String(row.trackName || "").trim(),
      admissionCode: String(row.admissionCode || "").trim(),
      admissionName: String(row.admissionName || "").trim(),
      admissionNameEn: String(row.admissionNameEn || "").trim(),
      seriesCode: String(row.seriesCode || "").trim(),
      seriesName: String(row.seriesName || "").trim(),
      unitCode: String(row.unitCode || "").trim(),
      unitName: String(row.unitName || "").trim(),
      unitNameEn: String(row.unitNameEn || "").trim(),
      majorCode: String(row.majorCode || "").trim(),
      majorName: String(row.majorName || "").trim(),
      majorNameEn: String(row.majorNameEn || "").trim(),
      sortOrder: Number(row.sortOrder || 0),
      createdAt: String(row.createdAt || "").trim(),
      updatedAt: String(row.updatedAt || "").trim(),
    };
  }

  function getApplicantRecruitmentSelectionFieldByFieldKey(fieldKey = "") {
    return APPLICANT_RECRUITMENT_SELECTION_FIELD_KEY_MAP[String(fieldKey || "").trim()] || null;
  }

  function getApplicantRecruitmentSelectionFieldBySystemFieldKey(systemFieldKey = "") {
    return APPLICANT_RECRUITMENT_SELECTION_SYSTEM_FIELD_MAP[String(systemFieldKey || "").trim()] || null;
  }

  function getApplicantRecruitmentSelectionOptions(recruitmentUnits = [], currentSelection = {}, selectionDefinition = null) {
    if (!selectionDefinition) {
      return [];
    }

    const selectedIndex = APPLICANT_RECRUITMENT_SELECTION_FIELDS.findIndex((definition) => definition.key === selectionDefinition.key);
    let filteredUnits = Array.isArray(recruitmentUnits) ? recruitmentUnits : [];

    for (let index = 0; index < selectedIndex; index += 1) {
      const definition = APPLICANT_RECRUITMENT_SELECTION_FIELDS[index];
      const selectedValue = String(currentSelection?.[definition.key] || "").trim();

      if (!selectedValue) {
        continue;
      }

      filteredUnits = filteredUnits.filter((unit) => String(unit?.[definition.unitKey] || "").trim() === selectedValue);
    }

    return Array.from(
      new Set(
        filteredUnits
          .map((unit) => String(unit?.[selectionDefinition.unitKey] || "").trim())
          .filter(Boolean),
      ),
    );
  }

  function normalizeApplicantRecruitmentSelection(selectionPayload = {}, recruitmentUnits = []) {
    const normalizedPayload = selectionPayload && typeof selectionPayload === "object" ? selectionPayload : {};
    const normalizedSelection = {};
    let hasSelectableField = false;

    APPLICANT_RECRUITMENT_SELECTION_FIELDS.forEach((definition) => {
      const options = getApplicantRecruitmentSelectionOptions(recruitmentUnits, normalizedSelection, definition);
      const requestedValue = String(normalizedPayload?.[definition.key] || "").trim();

      if (options.length === 0) {
        normalizedSelection[definition.key] = "";
        return;
      }

      hasSelectableField = true;

      if (!requestedValue) {
        throw createHttpError(400, `${definition.questionText}을(를) 선택하세요.`, "APPLICANT_RECRUITMENT_SELECTION_REQUIRED");
      }

      if (!options.includes(requestedValue)) {
        throw createHttpError(400, `${definition.questionText} 선택값이 올바르지 않습니다.`, "APPLICANT_RECRUITMENT_SELECTION_INVALID");
      }

      normalizedSelection[definition.key] = requestedValue;
    });

    return {
      selection: normalizedSelection,
      hasSelectableField,
    };
  }

  function normalizeApplicantRecruitmentUnitPayload(payload = {}, existingUnit = {}) {
    return {
      admissionNameEn: normalizeApplicantText(payload.admissionNameEn ?? existingUnit.admissionNameEn, "전형명(영어)", { required: false, maxLength: 200, errorCode: "APPLICANT_RECRUITMENT_ADMISSION_NAME_EN_INVALID" }),
      unitNameEn: normalizeApplicantText(payload.unitNameEn ?? existingUnit.unitNameEn, "모집단위명(영어)", { required: false, maxLength: 200, errorCode: "APPLICANT_RECRUITMENT_UNIT_NAME_EN_INVALID" }),
      majorNameEn: normalizeApplicantText(payload.majorNameEn ?? existingUnit.majorNameEn, "전공명(영어)", { required: false, maxLength: 200, errorCode: "APPLICANT_RECRUITMENT_MAJOR_NAME_EN_INVALID" }),
      trackName: normalizeApplicantText(payload.trackName ?? existingUnit.trackName, "모집시기", {
        required: false,
        maxLength: 100,
        errorCode: "APPLICANT_RECRUITMENT_TRACK_NAME_INVALID",
      }),
      admissionCode: normalizeApplicantCode(payload.admissionCode ?? existingUnit.admissionCode, "전형코드", {
        required: false,
        maxLength: 30,
        errorCode: "APPLICANT_RECRUITMENT_ADMISSION_CODE_INVALID",
      }),
      admissionName: normalizeApplicantText(payload.admissionName ?? existingUnit.admissionName, "전형명(한글)", {
        required: false,
        maxLength: 100,
        errorCode: "APPLICANT_RECRUITMENT_ADMISSION_NAME_INVALID",
      }),
      seriesCode: normalizeApplicantCode(payload.seriesCode ?? existingUnit.seriesCode, "계열코드", {
        required: false,
        maxLength: 30,
        errorCode: "APPLICANT_RECRUITMENT_SERIES_CODE_INVALID",
      }),
      seriesName: normalizeApplicantText(payload.seriesName ?? existingUnit.seriesName, "계열", {
        required: false,
        maxLength: 100,
        errorCode: "APPLICANT_RECRUITMENT_SERIES_NAME_INVALID",
      }),
      unitCode: normalizeApplicantCode(payload.unitCode ?? existingUnit.unitCode, "모집단위코드", {
        required: false,
        maxLength: 30,
        errorCode: "APPLICANT_RECRUITMENT_UNIT_CODE_INVALID",
      }),
      unitName: normalizeApplicantText(payload.unitName ?? existingUnit.unitName, "모집단위명(한글)", {
        required: false,
        maxLength: 100,
        errorCode: "APPLICANT_RECRUITMENT_UNIT_NAME_INVALID",
      }),
      majorCode: normalizeApplicantCode(payload.majorCode ?? existingUnit.majorCode, "전공코드", {
        required: false,
        maxLength: 30,
        errorCode: "APPLICANT_RECRUITMENT_MAJOR_CODE_INVALID",
      }),
      majorName: normalizeApplicantText(payload.majorName ?? existingUnit.majorName, "전공명(한글)", {
        required: false,
        maxLength: 100,
        errorCode: "APPLICANT_RECRUITMENT_MAJOR_NAME_INVALID",
      }),
    };
  }

  const { classifyApplicantRecruitmentUnitImportRows } = createApplicantImportHelpers({
    normalizeApplicantRecruitmentUnitPayload,
  });

  function normalizeRecruitmentImportRows(rows, currentUnits) {
    const existingByKey = new Map(currentUnits.map(unit => [buildApplicantRecruitmentUnitImportKey(unit), unit]));
    return rows.map(row => {
      const key = buildApplicantRecruitmentUnitImportKey(normalizeApplicantRecruitmentUnitPayload(row));
      // Legacy uploads omit English columns; retain previously authored translations.
      return normalizeApplicantRecruitmentUnitPayload(row, existingByKey.get(key));
    });
  }

  function normalizeApplicantRecruitmentImportCodeValue(value) {
    return String(value ?? "").trim().toUpperCase();
  }

  function normalizeApplicantRecruitmentImportNameValue(value) {
    return String(value ?? "").trim();
  }

  function validateApplicantRecruitmentUnitImportRows(sourceRows = [], existingUnits = []) {
    const pairConsistencyMaps = APPLICANT_RECRUITMENT_UNIT_PAIR_FIELDS.map((pairField) => ({
      ...pairField,
      codeToNameMap: new Map(),
      nameToCodeMap: new Map(),
    }));

    const rememberPair = (pairMap, codeValue, nameValue, sourceLabel) => {
      const existingNameRecord = pairMap.codeToNameMap.get(codeValue);

      if (existingNameRecord && existingNameRecord.nameValue !== nameValue) {
        throw createHttpError(
          400,
          `${sourceLabel}의 ${pairMap.codeLabel} '${codeValue}'는 ${existingNameRecord.sourceLabel}에서 이미 ${pairMap.nameLabel} '${existingNameRecord.nameValue}'와 연결되어 있습니다.`,
          "APPLICANT_RECRUITMENT_IMPORT_CODE_NAME_MISMATCH",
        );
      }

      const existingCodeRecord = pairMap.nameToCodeMap.get(nameValue);

      if (existingCodeRecord && existingCodeRecord.codeValue !== codeValue) {
        throw createHttpError(
          400,
          `${sourceLabel}의 ${pairMap.nameLabel} '${nameValue}'는 ${existingCodeRecord.sourceLabel}에서 이미 ${pairMap.codeLabel} '${existingCodeRecord.codeValue}'와 연결되어 있습니다.`,
          "APPLICANT_RECRUITMENT_IMPORT_CODE_NAME_MISMATCH",
        );
      }

      pairMap.codeToNameMap.set(codeValue, {
        nameValue,
        sourceLabel,
      });
      pairMap.nameToCodeMap.set(nameValue, {
        codeValue,
        sourceLabel,
      });
    };

    pairConsistencyMaps.forEach((pairMap) => {
      (Array.isArray(existingUnits) ? existingUnits : []).forEach((unit) => {
        const codeValue = normalizeApplicantRecruitmentImportCodeValue(unit?.[pairMap.codeKey]);
        const nameValue = normalizeApplicantRecruitmentImportNameValue(unit?.[pairMap.nameKey]);

        if (codeValue && nameValue) {
          rememberPair(pairMap, codeValue, nameValue, "기존 전형 관리 데이터");
        }
      });
    });

    (Array.isArray(sourceRows) ? sourceRows : []).forEach((row, rowIndex) => {
      const rowLabel = getApplicantRecruitmentImportRowLabel(row, rowIndex);

      pairConsistencyMaps.forEach((pairMap) => {
        const codeValue = normalizeApplicantRecruitmentImportCodeValue(row?.[pairMap.codeKey]);
        const nameValue = normalizeApplicantRecruitmentImportNameValue(row?.[pairMap.nameKey]);
        const hasCodeValue = codeValue !== "";
        const hasNameValue = nameValue !== "";

        if (hasCodeValue !== hasNameValue) {
          throw createHttpError(
            400,
            `${rowLabel}의 ${pairMap.codeLabel}/${pairMap.nameLabel}은(는) 둘 다 입력하거나 둘 다 비워야 합니다.`,
            "APPLICANT_RECRUITMENT_IMPORT_PAIR_REQUIRED",
          );
        }

        if (hasCodeValue && hasNameValue) {
          rememberPair(pairMap, codeValue, nameValue, rowLabel);
        }
      });
    });
  }

  async function buildApplicantRecruitmentUnitTemplateBuffer() {
    return applicantWorkbookService.buildApplicantRecruitmentUnitTemplateWorkbookBuffer();
  }

  async function buildApplicantRecruitmentUnitExportBuffer(rows = []) {
    const normalizedRows = (Array.isArray(rows) ? rows : []).map((row) => normalizeApplicantRecruitmentUnitRecord(row));
    return applicantWorkbookService.buildApplicantRecruitmentUnitExportWorkbookBuffer(normalizedRows);
  }

  async function buildApplicantSubmissionExportBuffer(rows = []) {
    const schedules = await getApplicantSchedules();
    const normalizedRows = (Array.isArray(rows) ? rows : []).map((row) => {
      const normalizedAnswerItems = normalizeStoredAnswerItems(row?.answerItems);
      const applicantScheduleState = getApplicantSubmissionScheduleState(findApplicantScheduleRecord(schedules, row));

      return {
        id: String(row?.id || "").trim(),
        name: String(row?.name || "").trim(),
        email: String(row?.email || "").trim(),
        statusLabel: String(
          row?.statusLabel ||
            getSharedApplicantStatusLabel(row?.status, {
              scheduleState: applicantScheduleState,
            }) ||
            row?.status ||
            "접수 완료",
        ).trim(),
        examineeNo: String(row?.examineeNo || "").trim(),
        createdAt: String(row?.createdAt || "").trim(),
        updatedAt: String(row?.updatedAt || "").trim(),
        answerValues: normalizedAnswerItems.map((answerItem) => {
          if (answerItem.inputType === "photo") {
            return answerItem?.value?.hasPhoto ? String(answerItem?.value?.fileName || "등록된 사진").trim() : "미등록";
          }

          if (answerItem.inputType === "file") {
            return answerItem?.value?.hasFile ? String(answerItem?.value?.fileName || "등록된 파일").trim() : "미등록";
          }

          return Array.isArray(answerItem?.value) ? answerItem.value.join(", ") : String(answerItem?.value || "").trim();
        }),
      };
    });
    const exportableRows = normalizedRows.filter((row) => row.id || row.name || row.email || row.answerValues.length > 0);

    if (exportableRows.length === 0) {
      throw createHttpError(400, "다운로드할 접수 이력 데이터가 없습니다.");
    }

    return applicantWorkbookService.buildApplicantSubmissionExportWorkbookBuffer(exportableRows);
  }

  async function buildApplicantSubmissionPhotoArchiveBuffer(rows = []) {
    const normalizedRows = (Array.isArray(rows) ? rows : [])
      .map((row) => ({
        submissionId: Number(row?.id || row?.submissionId || 0),
        examineeNo: String(row?.examineeNo || "").trim(),
        photoFileName: path.basename(String(row?.photoFileName || "").trim()),
      }))
      .filter((row) => row.submissionId > 0 || row.examineeNo || row.photoFileName);

    if (normalizedRows.length === 0) {
      throw createHttpError(400, "다운로드할 수험생 사진 대상이 없습니다.");
    }

    const zip = new AdmZip();
    const handledKeys = new Set();
    const handledZipEntryNames = new Set();
    let addedPhotoCount = 0;

    for (const row of normalizedRows) {
      const dedupeKey = row.submissionId > 0 ? `submission:${row.submissionId}` : row.examineeNo || row.photoFileName;

      if (!dedupeKey || handledKeys.has(dedupeKey)) {
        continue;
      }

      handledKeys.add(dedupeKey);
      const storedApplicantPhoto =
        row.submissionId > 0 ? await readStoredApplicantPhotoFile(row.submissionId, row.examineeNo, row.photoFileName) : null;
      const storedPhoto = storedApplicantPhoto || (await readStoredPromotedPhotoFile(row.examineeNo));

      if (!storedPhoto?.photoBlob) {
        continue;
      }

      const fallbackExtension = String(storedPhoto.photoMime || "").trim().toLowerCase() === "image/png" ? ".png" : ".jpg";
      const entryExtension = path.extname(String(storedPhoto.photoName || "").trim()).toLowerCase() || fallbackExtension;
      const entryBaseName = row.examineeNo || (row.submissionId > 0 ? `submission-${row.submissionId}` : "photo");
      let entryName = `${entryBaseName}${entryExtension}`;
      let duplicateIndex = 1;

      while (handledZipEntryNames.has(entryName.toLowerCase())) {
        duplicateIndex += 1;
        entryName = `${entryBaseName}-${duplicateIndex}${entryExtension}`;
      }

      handledZipEntryNames.add(entryName.toLowerCase());
      zip.addFile(entryName, storedPhoto.photoBlob);
      addedPhotoCount += 1;
    }

    if (addedPhotoCount === 0) {
      throw createHttpError(400, "접수 사진 저장소에서 다운로드할 사진 파일을 찾을 수 없습니다.");
    }

    return zip.toBuffer();
  }

  async function parseApplicantRecruitmentUnitWorkbook(fileContentBase64) {
    return applicantWorkbookService.parseApplicantRecruitmentUnitWorkbookRows(fileContentBase64);
  }

  async function previewApplicantRecruitmentUnitImport(payload = {}) {
    const sourceRows =
      Array.isArray(payload.rows) && payload.rows.length > 0
        ? payload.rows
        : payload.fileContentBase64
          ? await parseApplicantRecruitmentUnitWorkbook(payload.fileContentBase64)
          : [];

    if (sourceRows.length === 0) {
      throw createHttpError(400, "업로드할 전형 관리 데이터가 없습니다.", "APPLICANT_RECRUITMENT_IMPORT_EMPTY");
    }

    const currentUnits = await getApplicantRecruitmentUnits();
    validateApplicantRecruitmentUnitImportRows(sourceRows, currentUnits);
    const normalizedRows = normalizeRecruitmentImportRows(sourceRows, currentUnits);
    const classifiedRows = classifyApplicantRecruitmentUnitImportRows(normalizedRows, currentUnits);
    const previewRows = [];
    let insertCount = 0;
    let updateCount = 0;
    let unchangedCount = 0;

    classifiedRows.forEach(({ row, rowNumber, operation }) => {
      if (operation === "insert") {
        insertCount += 1;
      } else if (operation === "update") {
        updateCount += 1;
      } else {
        unchangedCount += 1;
      }

      if (previewRows.length < APPLICANT_IMPORT_PREVIEW_ROW_LIMIT) {
        previewRows.push({
          rowNumber,
          operation,
          trackName: row.trackName,
          admissionCode: row.admissionCode,
          admissionName: row.admissionName,
          admissionNameEn: row.admissionNameEn,
          seriesCode: row.seriesCode,
          seriesName: row.seriesName,
          unitCode: row.unitCode,
          unitName: row.unitName,
          unitNameEn: row.unitNameEn,
          majorCode: row.majorCode,
          majorName: row.majorName,
          majorNameEn: row.majorNameEn,
        });
      }
    });

    return {
      fileName: String(payload.fileName || "").trim(),
      currentTotalCount: currentUnits.length,
      resultTotalCount: currentUnits.length + insertCount,
      totalRows: normalizedRows.length,
      insertCount,
      updateCount,
      unchangedCount,
      previewRows,
    };
  }

  function ensureApplicantExamNoPattern(pattern = "") {
    const normalizedPattern = String(pattern || "").trim();

    if (!normalizedPattern) {
      throw createHttpError(400, "수험번호 규칙을 입력하세요.", "APPLICANT_EXAM_NO_PATTERN_REQUIRED");
    }

    if (normalizedPattern.length > 100) {
      throw createHttpError(400, "수험번호 규칙은 100자 이하여야 합니다.", "APPLICANT_EXAM_NO_PATTERN_TOO_LONG");
    }

    if (!/\{SEQ(?::\d{1,2})?\}/.test(normalizedPattern)) {
      throw createHttpError(400, "수험번호 규칙에는 {SEQ} 또는 {SEQ:n} 토큰이 포함되어야 합니다.", "APPLICANT_EXAM_NO_PATTERN_SEQ_REQUIRED");
    }

    const strippedPattern = normalizedPattern.replace(APPLICANT_EXAM_NO_TOKEN_PATTERN, "");

    if (/[{}]/.test(strippedPattern)) {
      throw createHttpError(
        400,
        "수험번호 규칙에는 {YYYY}, {YY}, {MM}, {DD}, {SEQ}, {SEQ:n}, {ADMISSION_CODE}, {SERIES_CODE}, {UNIT_CODE} 토큰만 사용할 수 있습니다.",
        "APPLICANT_EXAM_NO_PATTERN_TOKEN_INVALID",
      );
    }

    return normalizedPattern;
  }

  function normalizeApplicantSequenceStart(value) {
    const normalizedValue = Math.round(Number(value));

    if (!Number.isFinite(normalizedValue) || normalizedValue < 1 || normalizedValue > 99999999) {
      throw createHttpError(400, "수험번호 시작 순번은 1 이상 99999999 이하로 입력하세요.", "APPLICANT_EXAM_NO_SEQUENCE_INVALID");
    }

    return normalizedValue;
  }

  function normalizeApplicantExamNoDigitCount(value) {
    const normalizedValue = Math.round(Number(value));

    if (!Number.isFinite(normalizedValue) || normalizedValue < 1 || normalizedValue > APPLICANT_MAX_EXAM_NO_DIGIT_COUNT) {
      throw createHttpError(
        400,
        `수험번호 자리수는 1 이상 ${APPLICANT_MAX_EXAM_NO_DIGIT_COUNT} 이하로 입력하세요.`,
        "APPLICANT_EXAM_NO_DIGIT_COUNT_INVALID",
      );
    }

    return normalizedValue;
  }

  function normalizeApplicantExamNoComponents(value) {
    const sourceValues = Array.isArray(value)
      ? value
      : (() => {
          try {
            return JSON.parse(String(value || "[]"));
          } catch (error) {
            return [];
          }
        })();
    const normalizedValues = Array.from({ length: 5 }, (_, index) => {
      const normalizedValue = String(sourceValues?.[index] ?? "").trim();
      return APPLICANT_EXAM_NO_COMPONENT_TYPES.includes(normalizedValue) ? normalizedValue : "";
    });
    const selectedValues = normalizedValues.filter(Boolean);

    if (selectedValues.length === 0) {
      return [...APPLICANT_DEFAULT_EXAM_NO_COMPONENTS];
    }

    if (selectedValues.filter((valueItem) => valueItem === "sequence").length !== 1) {
      throw createHttpError(400, "수험번호 자동 생성 구성에는 순번을 한 번만 포함해야 합니다.", "APPLICANT_EXAM_NO_COMPONENT_SEQUENCE_REQUIRED");
    }

    if (new Set(selectedValues).size !== selectedValues.length) {
      throw createHttpError(400, "수험번호 자동 생성 구성 요소는 중복 없이 선택하세요.", "APPLICANT_EXAM_NO_COMPONENT_DUPLICATED");
    }

    return normalizedValues;
  }

  function normalizeApplicantSettingsRows(rows = []) {
    const rowsByKey = new Map(
      rows.map((row) => [String(row.settingKey || "").trim(), String(row.settingValue || "").trim()]),
    );

    const examNoPattern = rowsByKey.get("applicantExamNoPattern") || defaultApplicantExamNoPattern;
    const rawSequenceStart = rowsByKey.get("applicantExamNoSequenceStart");
    const parsedSequenceStart = Math.round(Number(rawSequenceStart));
    const rawDigitCount = rowsByKey.get("applicantExamNoDigitCount");
    const rawComponentsJson = rowsByKey.get("applicantExamNoComponentsJson");
    let normalizedComponents = [...APPLICANT_DEFAULT_EXAM_NO_COMPONENTS];

    try {
      normalizedComponents = normalizeApplicantExamNoComponents(rawComponentsJson || APPLICANT_DEFAULT_EXAM_NO_COMPONENTS);
    } catch (error) {
      normalizedComponents = [...APPLICANT_DEFAULT_EXAM_NO_COMPONENTS];
    }

    return {
      examNoPattern,
      examNoSequenceStart:
        Number.isFinite(parsedSequenceStart) && parsedSequenceStart >= 1
          ? parsedSequenceStart
          : defaultApplicantExamNoSequenceStart,
      digitCount:
        Number.isFinite(Math.round(Number(rawDigitCount))) && Math.round(Number(rawDigitCount)) >= 1
          ? Math.min(APPLICANT_MAX_EXAM_NO_DIGIT_COUNT, Math.round(Number(rawDigitCount)))
          : APPLICANT_DEFAULT_EXAM_NO_DIGIT_COUNT,
      components: normalizedComponents,
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

  function normalizeApplicantPublicSystemSettingsRows(rows = []) {
    const rowsByKey = new Map(
      rows.map((row) => [String(row.settingKey || "").trim(), String(row.settingValue || "").trim()]),
    );

    return {
      admissionHomepageUrl: String(rowsByKey.get("admissionHomepageUrl") || "").trim(),
    };
  }

  function normalizeApplicantScheduleDateTime(value, { defaultValue = "" } = {}) {
    const normalizedValue = String(value ?? "").trim();

    if (!normalizedValue) {
      return defaultValue;
    }

    const matchedValue = normalizedValue.match(APPLICANT_SCHEDULE_DATE_TIME_PATTERN);

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

  function getApplicantScheduleTimestamp(value, { inclusiveEndMinute = false } = {}) {
    const normalizedValue = normalizeApplicantScheduleDateTime(value);

    if (!normalizedValue) {
      return NaN;
    }

    const [, yearValue, monthValue, dayValue, hourValue, minuteValue] =
      normalizedValue.match(APPLICANT_SCHEDULE_DATE_TIME_PATTERN) || [];
    const scheduleTimestamp = new Date(
      Number(yearValue),
      Number(monthValue) - 1,
      Number(dayValue),
      Number(hourValue),
      Number(minuteValue),
      0,
      0,
    ).getTime();

    return inclusiveEndMinute ? scheduleTimestamp + (60 * 1000 - 1) : scheduleTimestamp;
  }

  function formatApplicantScheduleDateTimeLabel(value) {
    const normalizedValue = normalizeApplicantScheduleDateTime(value);

    if (!normalizedValue) {
      return "";
    }

    const [dateValue, timeValue] = normalizedValue.split("T");
    return `${String(dateValue || "").replaceAll("-", ".")} ${String(timeValue || "")}`;
  }

  function buildApplicantAdmissionScheduleKey(trackName = "", admissionCode = "", admissionName = "") {
    return [String(trackName || "").trim(), String(admissionCode || "").trim(), String(admissionName || "").trim()].join("\u241f");
  }

  function normalizeApplicantScheduleRecord(row = {}) {
    const trackName = String(row.trackName || "").trim();
    const admissionCode = String(row.admissionCode || "").trim();
    const admissionName = String(row.admissionName || "").trim();
    const applicantScheduleStartAt = normalizeApplicantScheduleDateTime(row.applicantScheduleStartAt);
    const applicantScheduleEndAt = normalizeApplicantScheduleDateTime(row.applicantScheduleEndAt);
    const documentSubmissionScheduleStartAt = normalizeApplicantScheduleDateTime(row.documentSubmissionScheduleStartAt);
    const documentReviewScheduleStartAt = normalizeApplicantScheduleDateTime(row.documentReviewScheduleStartAt);
    const documentSubmissionScheduleEndAt = normalizeApplicantScheduleDateTime(row.documentSubmissionScheduleEndAt);
    const documentReviewScheduleEndAt = normalizeApplicantScheduleDateTime(row.documentReviewScheduleEndAt);
    const admitCardLookupScheduleStartAt = normalizeApplicantScheduleDateTime(row.admitCardLookupScheduleStartAt);
    const admitCardLookupScheduleEndAt = normalizeApplicantScheduleDateTime(row.admitCardLookupScheduleEndAt);

    return {
      id: Number(row.id || 0),
      applicationTemplateId: Number(row.applicationTemplateId || 0),
      documentTemplateId: Number(row.documentTemplateId || 0),
      scheduleKey: buildApplicantAdmissionScheduleKey(trackName, admissionCode, admissionName),
      trackName,
      admissionCode,
      admissionName,
      applicantScheduleEnabled: applicantFormConfig.isApplicantScheduleEnabled(row, 'submission'),
      applicantScheduleStartAt,
      applicantScheduleStartAtLabel: formatApplicantScheduleDateTimeLabel(applicantScheduleStartAt),
      applicantScheduleEndAt,
      applicantScheduleEndAtLabel: formatApplicantScheduleDateTimeLabel(applicantScheduleEndAt),
      documentSubmissionScheduleEnabled: applicantFormConfig.isApplicantScheduleEnabled(row, 'documents'),
      documentReviewScheduleEnabled: applicantFormConfig.isApplicantScheduleEnabled(row, 'document-status'),
      documentSubmissionScheduleStartAt,
      documentReviewScheduleStartAt,
      documentSubmissionScheduleEndAt,
      documentReviewScheduleEndAt,
      documentSubmissionScheduleStartAtLabel: formatApplicantScheduleDateTimeLabel(documentSubmissionScheduleStartAt),
      documentReviewScheduleStartAtLabel: formatApplicantScheduleDateTimeLabel(documentReviewScheduleStartAt),
      documentSubmissionScheduleEndAtLabel: formatApplicantScheduleDateTimeLabel(documentSubmissionScheduleEndAt),
      documentReviewScheduleEndAtLabel: formatApplicantScheduleDateTimeLabel(documentReviewScheduleEndAt),
      applicantScheduleLabel:
        applicantScheduleStartAt && applicantScheduleEndAt
          ? `${formatApplicantScheduleDateTimeLabel(applicantScheduleStartAt)} ~ ${formatApplicantScheduleDateTimeLabel(applicantScheduleEndAt)}`
          : "",
      admitCardLookupScheduleEnabled: applicantFormConfig.isApplicantScheduleEnabled(row, 'lookup'),
      admitCardLookupScheduleStartAt,
      admitCardLookupScheduleStartAtLabel: formatApplicantScheduleDateTimeLabel(admitCardLookupScheduleStartAt),
      admitCardLookupScheduleEndAt,
      admitCardLookupScheduleEndAtLabel: formatApplicantScheduleDateTimeLabel(admitCardLookupScheduleEndAt),
      admitCardLookupScheduleLabel:
        admitCardLookupScheduleStartAt && admitCardLookupScheduleEndAt
          ? `${formatApplicantScheduleDateTimeLabel(admitCardLookupScheduleStartAt)} ~ ${formatApplicantScheduleDateTimeLabel(admitCardLookupScheduleEndAt)}`
          : "",
      createdAt: String(row.createdAt || "").trim(),
      updatedAt: String(row.updatedAt || "").trim(),
    };
  }

  function normalizeOptionalApplicantScheduleRange(scheduleLabel, startValue, endValue) {
    const startAt = normalizeApplicantScheduleDateTime(startValue);
    const endAt = normalizeApplicantScheduleDateTime(endValue);

    if (!startAt && !endAt) {
      return {
        startAt: "",
        endAt: "",
      };
    }

    if (!startAt || !endAt) {
      throw createHttpError(
        400,
        `${scheduleLabel}의 시작 일시와 종료 일시를 모두 입력하세요.`,
        "APPLICANT_SCHEDULE_RANGE_REQUIRED",
      );
    }

    const startTimestamp = getApplicantScheduleTimestamp(startAt);
    const endTimestamp = getApplicantScheduleTimestamp(endAt);

    if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp)) {
      throw createHttpError(400, `${scheduleLabel} 형식이 올바르지 않습니다.`, "APPLICANT_SCHEDULE_RANGE_INVALID");
    }

    if (startTimestamp > endTimestamp) {
      throw createHttpError(
        400,
        `${scheduleLabel}의 시작 일시는 종료 일시보다 늦을 수 없습니다.`,
        "APPLICANT_SCHEDULE_RANGE_INVALID",
      );
    }

    return {
      startAt,
      endAt,
    };
  }

  function normalizeScheduleEnabled(value, existing = true) {
    if (value == null) return existing !== false && existing !== 0;
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;
    throw createHttpError(400, '일정 사용 여부가 올바르지 않습니다.', 'APPLICANT_SCHEDULE_ENABLED_INVALID');
  }

  function normalizeApplicantSchedulePayload(payload = {}, existingSchedule = {}) {
    const trackName = normalizeApplicantText(payload.trackName ?? existingSchedule.trackName, "모집시기", {
      required: false,
      maxLength: 100,
      errorCode: "APPLICANT_SCHEDULE_TRACK_NAME_INVALID",
    });
    const admissionCode = normalizeApplicantCode(payload.admissionCode ?? existingSchedule.admissionCode, "전형코드", {
      required: false,
      maxLength: 30,
      errorCode: "APPLICANT_SCHEDULE_ADMISSION_CODE_INVALID",
    });
    const admissionName = normalizeApplicantText(payload.admissionName ?? existingSchedule.admissionName, "전형", {
      required: false,
      maxLength: 100,
      errorCode: "APPLICANT_SCHEDULE_ADMISSION_NAME_INVALID",
    });

    if (!trackName && !admissionCode && !admissionName) {
      throw createHttpError(400, "일정을 저장할 모집시기와 전형 정보를 찾을 수 없습니다.", "APPLICANT_SCHEDULE_TARGET_REQUIRED");
    }

    const applicantScheduleRange = normalizeOptionalApplicantScheduleRange(
      "접수 기간",
      payload.applicantScheduleStartAt ?? existingSchedule.applicantScheduleStartAt,
      payload.applicantScheduleEndAt ?? existingSchedule.applicantScheduleEndAt,
    );
    const admitCardLookupScheduleRange = normalizeOptionalApplicantScheduleRange(
      "수험표 조회 기간",
      payload.admitCardLookupScheduleStartAt ?? existingSchedule.admitCardLookupScheduleStartAt,
      payload.admitCardLookupScheduleEndAt ?? existingSchedule.admitCardLookupScheduleEndAt,
    );
    const documentSubmissionScheduleRange = normalizeOptionalApplicantScheduleRange(
      "서류 제출 기간",
      payload.documentSubmissionScheduleStartAt ?? existingSchedule.documentSubmissionScheduleStartAt,
      payload.documentSubmissionScheduleEndAt ?? existingSchedule.documentSubmissionScheduleEndAt,
    );
    const documentReviewScheduleRange = normalizeOptionalApplicantScheduleRange(
      "서류 제출 확인 기간",
      payload.documentReviewScheduleStartAt ?? existingSchedule.documentReviewScheduleStartAt,
      payload.documentReviewScheduleEndAt ?? existingSchedule.documentReviewScheduleEndAt,
    );

    return {
      trackName,
      admissionCode,
      admissionName,
      applicationTemplateId: payload.applicationTemplateId ?? existingSchedule.applicationTemplateId ?? null,
      documentTemplateId: payload.documentTemplateId ?? existingSchedule.documentTemplateId ?? null,
      applicantScheduleEnabled: normalizeScheduleEnabled(payload.applicantScheduleEnabled, existingSchedule.applicantScheduleEnabled),
      applicantScheduleStartAt: applicantScheduleRange.startAt,
      applicantScheduleEndAt: applicantScheduleRange.endAt,
      documentSubmissionScheduleEnabled: normalizeScheduleEnabled(payload.documentSubmissionScheduleEnabled, existingSchedule.documentSubmissionScheduleEnabled),
      documentReviewScheduleEnabled: normalizeScheduleEnabled(payload.documentReviewScheduleEnabled, existingSchedule.documentReviewScheduleEnabled),
      documentSubmissionScheduleStartAt: documentSubmissionScheduleRange.startAt,
      documentReviewScheduleStartAt: documentReviewScheduleRange.startAt,
      documentSubmissionScheduleEndAt: documentSubmissionScheduleRange.endAt,
      documentReviewScheduleEndAt: documentReviewScheduleRange.endAt,
      admitCardLookupScheduleEnabled: normalizeScheduleEnabled(payload.admitCardLookupScheduleEnabled, existingSchedule.admitCardLookupScheduleEnabled),
      admitCardLookupScheduleStartAt: admitCardLookupScheduleRange.startAt,
      admitCardLookupScheduleEndAt: admitCardLookupScheduleRange.endAt,
    };
  }

  function resolveApplicantScheduleCriteria(value = {}) {
    return {
      trackName: String(value.trackName ?? value.track ?? "").trim(),
      admissionCode: String(value.admissionCode ?? "").trim(),
      admissionName: String(value.admissionName ?? value.admission ?? "").trim(),
      scheduleKey: String(value.scheduleKey ?? "").trim(),
    };
  }

  function findApplicantScheduleRecord(schedules = [], value = {}) {
    const criteria = resolveApplicantScheduleCriteria(value);
    const normalizedSchedules = Array.isArray(schedules) ? schedules : [];

    if (criteria.scheduleKey) {
      return normalizedSchedules.find((schedule) => String(schedule?.scheduleKey || "").trim() === criteria.scheduleKey) || null;
    }

    const filteredSchedules = normalizedSchedules.filter(
      (schedule) =>
        String(schedule?.trackName || "").trim() === criteria.trackName &&
        String(schedule?.admissionName || "").trim() === criteria.admissionName,
    );

    if (criteria.admissionCode) {
      return filteredSchedules.find((schedule) => String(schedule?.admissionCode || "").trim() === criteria.admissionCode) || null;
    }

    return filteredSchedules[0] || null;
  }

  function buildApplicantScheduleContextLabel(value = {}) {
    const criteria = resolveApplicantScheduleCriteria(value);
    const labelParts = [criteria.trackName, criteria.admissionName || criteria.admissionCode].filter(Boolean);
    return labelParts.length > 0 ? labelParts.join(" / ") : "선택한 전형";
  }

  function getApplicantSubmissionScheduleState(schedule = {}, referenceDate = new Date()) {
    return applicantFormConfig.getApplicantSubmissionScheduleState(schedule, referenceDate);
  }

  function getApplicantAdmitCardLookupScheduleState(schedule = {}, referenceDate = new Date()) {
    return applicantFormConfig.getApplicantAdmitCardLookupScheduleState(schedule, referenceDate);
  }

  function getApplicantAggregateScheduleState(schedules = [], scheduleType = 'submission', referenceDate = new Date()) {
    return applicantFormConfig.getApplicantAggregateScheduleState(schedules, scheduleType, referenceDate);
  }

  function buildApplicantScheduleRangeLabel(scheduleState = {}, scheduleType = "submission") {
    if (scheduleType === "lookup") {
      return scheduleState.isConfigured && scheduleState.admitCardLookupScheduleStartAt && scheduleState.admitCardLookupScheduleEndAt
        ? `${formatApplicantScheduleDateTimeLabel(scheduleState.admitCardLookupScheduleStartAt)} ~ ${formatApplicantScheduleDateTimeLabel(scheduleState.admitCardLookupScheduleEndAt)}`
        : "";
    }

    return scheduleState.isConfigured && scheduleState.applicantScheduleStartAt && scheduleState.applicantScheduleEndAt
      ? `${formatApplicantScheduleDateTimeLabel(scheduleState.applicantScheduleStartAt)} ~ ${formatApplicantScheduleDateTimeLabel(scheduleState.applicantScheduleEndAt)}`
      : "";
  }

  async function assertApplicantSubmissionEntryIsOpen(selection = null) {
    const schedules = await getApplicantSchedules();
    const criteria = resolveApplicantScheduleCriteria(selection || {});
    const hasSpecificSelection = Boolean(criteria.trackName && criteria.admissionName);
    const matchedSchedule = hasSpecificSelection ? findApplicantScheduleRecord(schedules, criteria) : null;
    const scheduleState = hasSpecificSelection
      ? getApplicantSubmissionScheduleState(matchedSchedule)
      : getApplicantAggregateScheduleState(schedules, "submission");

    if (scheduleState.isOpen) {
      return scheduleState;
    }

    const contextLabel = hasSpecificSelection ? buildApplicantScheduleContextLabel(criteria) : "현재 접수 가능한 일정";
    const scheduleRangeLabel = buildApplicantScheduleRangeLabel(scheduleState, "submission");

    if (scheduleState.reason === "not_configured") {
      throw createHttpError(
        409,
        hasSpecificSelection
          ? `${contextLabel}의 접수 기간이 아직 설정되지 않았습니다.`
          : "현재 접수 가능한 전형 일정이 없습니다.",
        "APPLICANT_SUBMISSION_SCHEDULE_NOT_CONFIGURED",
      );
    }

    if (scheduleState.reason === "before_start") {
      throw createHttpError(
        409,
        `아직 접수 기간이 아닙니다.${scheduleRangeLabel ? ` 접수 가능 기간: ${scheduleRangeLabel}` : ""}`,
        "APPLICANT_SUBMISSION_SCHEDULE_NOT_STARTED",
      );
    }

    if (scheduleState.reason === "after_end") {
      throw createHttpError(
        409,
        `접수 기간이 종료되었습니다.${scheduleRangeLabel ? ` 접수 가능 기간: ${scheduleRangeLabel}` : ""}`,
        "APPLICANT_SUBMISSION_SCHEDULE_ENDED",
      );
    }

    throw createHttpError(
      409,
      hasSpecificSelection ? `${contextLabel}의 접수 일정을 확인할 수 없습니다.` : "현재는 접수를 진행할 수 없습니다.",
      "APPLICANT_SUBMISSION_SCHEDULE_CLOSED",
    );
  }

  async function assertApplicantAdmitCardLookupIsOpen(submission = null) {
    const schedules = await getApplicantSchedules();
    const criteria = resolveApplicantScheduleCriteria(submission || {});
    const hasSpecificSelection = Boolean(criteria.trackName && criteria.admissionName);
    const matchedSchedule = hasSpecificSelection ? findApplicantScheduleRecord(schedules, criteria) : null;
    const scheduleState = hasSpecificSelection
      ? getApplicantAdmitCardLookupScheduleState(matchedSchedule)
      : getApplicantAggregateScheduleState(schedules, "lookup");

    if (scheduleState.isOpen) {
      return scheduleState;
    }

    const scheduleRangeLabel = buildApplicantScheduleRangeLabel(scheduleState, "lookup");

    if (scheduleState.reason === "not_configured") {
      throw createHttpError(
        409,
        hasSpecificSelection
          ? `${buildApplicantScheduleContextLabel(criteria)}의 수험표 조회 기간이 아직 설정되지 않았습니다.`
          : "현재 조회 가능한 수험표 일정이 없습니다.",
        "APPLICANT_ADMIT_CARD_LOOKUP_SCHEDULE_NOT_CONFIGURED",
      );
    }

    if (scheduleState.reason === "before_start") {
      throw createHttpError(
        409,
        `아직 수험표 조회 기간이 아닙니다.${scheduleRangeLabel ? ` 조회 가능 기간: ${scheduleRangeLabel}` : ""}`,
        "APPLICANT_ADMIT_CARD_LOOKUP_SCHEDULE_NOT_STARTED",
      );
    }

    if (scheduleState.reason === "after_end") {
      throw createHttpError(
        409,
        `수험표 조회 기간이 종료되었습니다.${scheduleRangeLabel ? ` 조회 가능 기간: ${scheduleRangeLabel}` : ""}`,
        "APPLICANT_ADMIT_CARD_LOOKUP_SCHEDULE_ENDED",
      );
    }

    throw createHttpError(409, "현재는 수험표 조회를 진행할 수 없습니다.", "APPLICANT_ADMIT_CARD_LOOKUP_SCHEDULE_CLOSED");
  }

  function normalizeApplicantSettingsPayload(payload = {}) {
    return {
      examNoPattern: ensureApplicantExamNoPattern(payload.examNoPattern ?? defaultApplicantExamNoPattern),
      examNoSequenceStart: normalizeApplicantSequenceStart(payload.examNoSequenceStart ?? defaultApplicantExamNoSequenceStart),
      digitCount: normalizeApplicantExamNoDigitCount(payload.digitCount ?? APPLICANT_DEFAULT_EXAM_NO_DIGIT_COUNT),
      components: normalizeApplicantExamNoComponents(payload.components ?? APPLICANT_DEFAULT_EXAM_NO_COMPONENTS),
    };
  }

  async function getApplicantSettings() {
    const rows = await query(`
      SELECT
        setting_key AS settingKey,
        setting_value AS settingValue
      FROM system_set
      WHERE setting_key IN ('applicantExamNoPattern', 'applicantExamNoSequenceStart', 'applicantExamNoDigitCount', 'applicantExamNoComponentsJson')
    `);

    return normalizeApplicantSettingsRows(rows);
  }

  async function getApplicantPublicSystemSettings() {
    const rows = await query(`
      SELECT
        setting_key AS settingKey,
        setting_value AS settingValue
      FROM system_set
      WHERE setting_key IN (
        'admissionHomepageUrl'
      )
    `);

    return normalizeApplicantPublicSystemSettingsRows(rows);
  }

  async function getApplicantPublicNoticeHtml() {
    const rows = await query(`
      SELECT
        setting_key AS settingKey,
        setting_value AS settingValue
      FROM system_set
      WHERE setting_key IN ('applicantNoticeHtml', 'applicantNoticeHtmlEn')
    `);
    const rowsByKey = new Map(rows.map((row) => [String(row.settingKey || "").trim(), String(row.settingValue || "")]));
    const storedHtml = String(rowsByKey.get("applicantNoticeHtml") || "");

    return {
      noticeHtml: storedHtml.trim() ? storedHtml : String(getDefaultApplicantNoticeHtml() || "").trim(),
      noticeHtmlEn: String(rowsByKey.get("applicantNoticeHtmlEn") || ""),
    };
  }

  async function updateApplicantSettings(payload = {}) {
    const nextSettings = normalizeApplicantSettingsPayload(payload);

    await query(
      `
        INSERT INTO system_set (setting_key, setting_value)
        VALUES
          ('applicantExamNoPattern', ?),
          ('applicantExamNoSequenceStart', ?),
          ('applicantExamNoDigitCount', ?),
          ('applicantExamNoComponentsJson', ?)
        ON DUPLICATE KEY UPDATE
          setting_value = VALUES(setting_value)
      `,
      [
        nextSettings.examNoPattern,
        String(nextSettings.examNoSequenceStart),
        String(nextSettings.digitCount),
        JSON.stringify(nextSettings.components),
      ],
    );

    return getApplicantSettings();
  }

  async function getApplicantFormFields({ activeOnly = false, formScope = null, templateId = null } = {}) {
    const rows = await query(
      `
        SELECT
          id,
          field_key AS fieldKey,
          form_scope AS formScope,
          COALESCE(template_id, (SELECT id FROM app_form_template t WHERE t.form_scope = app_form.form_scope AND t.is_default = 1)) AS templateId,
          question_text AS questionText,
          question_description AS questionDescription,
          question_text_en AS questionTextEn,
          question_description_en AS questionDescriptionEn,
          input_type AS inputType,
          system_field_key AS systemFieldKey,
          options_json AS optionsJson,
          required,
          active,
          sort_order AS sortOrder,
          COALESCE(DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s'), '') AS createdAt,
          COALESCE(DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s'), '') AS updatedAt
        FROM app_form
        ${activeOnly ? "WHERE active = 1" : ""}
        ORDER BY sort_order ASC, id ASC
      `,
    );

    return rows.map(normalizeApplicantFormFieldRecord).filter(field => (!formScope || field.formScope === formScope) && (templateId == null || field.templateId === Number(templateId)));
  }

  async function getApplicantFormFieldById(fieldId, options = {}) {
    const normalizedFieldId = Number(fieldId);

    if (!Number.isInteger(normalizedFieldId) || normalizedFieldId <= 0) {
      throw createHttpError(400, "접수 양식 항목 ID가 올바르지 않습니다.", "APPLICANT_FIELD_ID_INVALID");
    }

    const rows = await query(
      `
        SELECT
          id,
          field_key AS fieldKey,
          form_scope AS formScope,
          COALESCE(template_id, (SELECT id FROM app_form_template t WHERE t.form_scope = app_form.form_scope AND t.is_default = 1)) AS templateId,
          question_text AS questionText,
          question_description AS questionDescription,
          question_text_en AS questionTextEn,
          question_description_en AS questionDescriptionEn,
          input_type AS inputType,
          system_field_key AS systemFieldKey,
          options_json AS optionsJson,
          required,
          active,
          sort_order AS sortOrder,
          COALESCE(DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s'), '') AS createdAt,
          COALESCE(DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s'), '') AS updatedAt
        FROM app_form
        WHERE id = ?
        LIMIT 1
      `,
      [normalizedFieldId],
    );

    const field = normalizeApplicantFormFieldRecord(rows[0] || {});

    if (!field.id && options.required !== false) {
      throw createHttpError(404, "접수 양식 항목을 찾을 수 없습니다.", "APPLICANT_FIELD_NOT_FOUND");
    }

    return field.id ? field : null;
  }

  async function getApplicantRecruitmentUnits(options = {}) {
    const rows = await executeRows(
      options.queryable || query,
      `
        SELECT
          id,
          track_name AS trackName,
          admission_code AS admissionCode,
          admission_name AS admissionName,
          admission_name_en AS admissionNameEn,
          series_code AS seriesCode,
          series_name AS seriesName,
          unit_code AS unitCode,
          unit_name AS unitName,
          unit_name_en AS unitNameEn,
          major_code AS majorCode,
          major_name AS majorName,
          major_name_en AS majorNameEn,
          sort_order AS sortOrder,
          COALESCE(DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s'), '') AS createdAt,
          COALESCE(DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s'), '') AS updatedAt
        FROM app_unit
        ORDER BY sort_order ASC, id ASC
      `,
    );

    return rows.map(normalizeApplicantRecruitmentUnitRecord);
  }

  async function getApplicantSchedules(options = {}) {
    const rows = await executeRows(
      options.queryable || query,
      `
        SELECT
          COALESCE(schedule.id, 0) AS id,
          COALESCE(schedule.application_template_id, (SELECT id FROM app_form_template WHERE form_scope = 'application' AND is_default = 1)) AS applicationTemplateId,
          COALESCE(schedule.document_template_id, (SELECT id FROM app_form_template WHERE form_scope = 'documents' AND is_default = 1)) AS documentTemplateId,
          grouped_units.track_name AS trackName,
          grouped_units.admission_code AS admissionCode,
          grouped_units.admission_name AS admissionName,
          COALESCE(schedule.applicant_schedule_enabled, 1) AS applicantScheduleEnabled,
          COALESCE(DATE_FORMAT(schedule.applicant_schedule_start_at, '%Y-%m-%dT%H:%i'), '') AS applicantScheduleStartAt,
          COALESCE(DATE_FORMAT(schedule.applicant_schedule_end_at, '%Y-%m-%dT%H:%i'), '') AS applicantScheduleEndAt,
          COALESCE(schedule.document_submission_schedule_enabled, 1) AS documentSubmissionScheduleEnabled,
          COALESCE(schedule.document_review_schedule_enabled, 1) AS documentReviewScheduleEnabled,
          COALESCE(DATE_FORMAT(schedule.document_submission_schedule_start_at, '%Y-%m-%dT%H:%i'), '') AS documentSubmissionScheduleStartAt,
          COALESCE(DATE_FORMAT(schedule.document_review_schedule_start_at, '%Y-%m-%dT%H:%i'), '') AS documentReviewScheduleStartAt,
          COALESCE(DATE_FORMAT(schedule.document_submission_schedule_end_at, '%Y-%m-%dT%H:%i'), '') AS documentSubmissionScheduleEndAt,
          COALESCE(DATE_FORMAT(schedule.document_review_schedule_end_at, '%Y-%m-%dT%H:%i'), '') AS documentReviewScheduleEndAt,
          COALESCE(schedule.admit_card_lookup_schedule_enabled, 1) AS admitCardLookupScheduleEnabled,
          COALESCE(DATE_FORMAT(schedule.admit_card_lookup_schedule_start_at, '%Y-%m-%dT%H:%i'), '') AS admitCardLookupScheduleStartAt,
          COALESCE(DATE_FORMAT(schedule.admit_card_lookup_schedule_end_at, '%Y-%m-%dT%H:%i'), '') AS admitCardLookupScheduleEndAt,
          COALESCE(DATE_FORMAT(schedule.created_at, '%Y-%m-%d %H:%i:%s'), '') AS createdAt,
          COALESCE(DATE_FORMAT(schedule.updated_at, '%Y-%m-%d %H:%i:%s'), '') AS updatedAt
        FROM (
          SELECT
            track_name,
            admission_code,
            admission_name,
            MIN(sort_order) AS minSortOrder,
            MIN(id) AS minId
          FROM app_unit
          GROUP BY track_name, admission_code, admission_name
        ) grouped_units
        LEFT JOIN app_schedule schedule
          ON schedule.track_name = grouped_units.track_name
         AND schedule.admission_code = grouped_units.admission_code
         AND schedule.admission_name = grouped_units.admission_name
        ORDER BY
          grouped_units.minSortOrder ASC,
          grouped_units.minId ASC,
          grouped_units.track_name ASC,
          grouped_units.admission_name ASC,
          grouped_units.admission_code ASC
      `,
    );

    return rows.map(normalizeApplicantScheduleRecord);
  }

  async function getApplicantRecruitmentUnitById(unitId, options = {}) {
    const normalizedUnitId = Number(unitId);

    if (!Number.isInteger(normalizedUnitId) || normalizedUnitId <= 0) {
      throw createHttpError(400, "전형 관리 항목 ID가 올바르지 않습니다.", "APPLICANT_RECRUITMENT_UNIT_ID_INVALID");
    }

    const rows = await query(
      `
        SELECT
          id,
          track_name AS trackName,
          admission_code AS admissionCode,
          admission_name AS admissionName,
          admission_name_en AS admissionNameEn,
          series_code AS seriesCode,
          series_name AS seriesName,
          unit_code AS unitCode,
          unit_name AS unitName,
          unit_name_en AS unitNameEn,
          major_code AS majorCode,
          major_name AS majorName,
          major_name_en AS majorNameEn,
          sort_order AS sortOrder,
          COALESCE(DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s'), '') AS createdAt,
          COALESCE(DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s'), '') AS updatedAt
        FROM app_unit
        WHERE id = ?
        LIMIT 1
      `,
      [normalizedUnitId],
    );
    const unit = normalizeApplicantRecruitmentUnitRecord(rows[0] || {});

    if (!unit.id && options.required !== false) {
      throw createHttpError(404, "전형 관리 항목을 찾을 수 없습니다.", "APPLICANT_RECRUITMENT_UNIT_NOT_FOUND");
    }

    return unit.id ? unit : null;
  }

  async function resolveScheduleTemplates(schedule) {
    schedule.applicationTemplateId = await formTemplates.resolve('application', schedule.applicationTemplateId);
    schedule.documentTemplateId = await formTemplates.resolve('documents', schedule.documentTemplateId);
  }

  async function saveApplicantSchedule(payload = {}) {
    const existingSchedule = findApplicantScheduleRecord(await getApplicantSchedules(), payload) || {};
    const normalizedPayload = normalizeApplicantSchedulePayload(payload, existingSchedule);
    await resolveScheduleTemplates(normalizedPayload);
    const matchingUnits = await query(
      `
        SELECT id
        FROM app_unit
        WHERE track_name = ?
          AND admission_code = ?
          AND admission_name = ?
        LIMIT 1
      `,
      [normalizedPayload.trackName, normalizedPayload.admissionCode, normalizedPayload.admissionName],
    );

    if (matchingUnits.length === 0) {
      throw createHttpError(404, "일정을 설정할 전형 관리 항목을 찾을 수 없습니다.", "APPLICANT_SCHEDULE_TARGET_NOT_FOUND");
    }

    await query(
      `
        INSERT INTO app_schedule (
          application_template_id,
          document_template_id,
          track_name,
          admission_code,
          admission_name,
          applicant_schedule_enabled,
          applicant_schedule_start_at,
          applicant_schedule_end_at,
          document_submission_schedule_enabled,
          document_review_schedule_enabled,
          document_submission_schedule_start_at,
          document_review_schedule_start_at,
          document_submission_schedule_end_at,
          document_review_schedule_end_at,
          admit_card_lookup_schedule_enabled,
          admit_card_lookup_schedule_start_at,
          admit_card_lookup_schedule_end_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          application_template_id = VALUES(application_template_id),
          document_template_id = VALUES(document_template_id),
          applicant_schedule_enabled = VALUES(applicant_schedule_enabled),
          applicant_schedule_start_at = VALUES(applicant_schedule_start_at),
          applicant_schedule_end_at = VALUES(applicant_schedule_end_at),
          document_submission_schedule_enabled = VALUES(document_submission_schedule_enabled),
          document_review_schedule_enabled = VALUES(document_review_schedule_enabled),
          document_submission_schedule_start_at = VALUES(document_submission_schedule_start_at),
          document_review_schedule_start_at = VALUES(document_review_schedule_start_at),
          document_submission_schedule_end_at = VALUES(document_submission_schedule_end_at),
          document_review_schedule_end_at = VALUES(document_review_schedule_end_at),
          admit_card_lookup_schedule_enabled = VALUES(admit_card_lookup_schedule_enabled),
          admit_card_lookup_schedule_start_at = VALUES(admit_card_lookup_schedule_start_at),
          admit_card_lookup_schedule_end_at = VALUES(admit_card_lookup_schedule_end_at)
      `,
      [
        normalizedPayload.applicationTemplateId,
        normalizedPayload.documentTemplateId,
        normalizedPayload.trackName,
        normalizedPayload.admissionCode,
        normalizedPayload.admissionName,
        normalizedPayload.applicantScheduleEnabled ? 1 : 0,
        normalizedPayload.applicantScheduleStartAt || null,
        normalizedPayload.applicantScheduleEndAt || null,
        normalizedPayload.documentSubmissionScheduleEnabled ? 1 : 0,
        normalizedPayload.documentReviewScheduleEnabled ? 1 : 0,
        normalizedPayload.documentSubmissionScheduleStartAt || null,
        normalizedPayload.documentReviewScheduleStartAt || null,
        normalizedPayload.documentSubmissionScheduleEndAt || null,
        normalizedPayload.documentReviewScheduleEndAt || null,
        normalizedPayload.admitCardLookupScheduleEnabled ? 1 : 0,
        normalizedPayload.admitCardLookupScheduleStartAt || null,
        normalizedPayload.admitCardLookupScheduleEndAt || null,
      ],
    );

    return getApplicantSchedules();
  }

  async function saveApplicantSchedules(payload = {}) {
    const schedulePayloads = Array.isArray(payload?.schedules) ? payload.schedules : [];

    if (schedulePayloads.length === 0) {
      throw createHttpError(400, "일괄 설정할 전형을 한 개 이상 선택하세요.", "APPLICANT_SCHEDULE_BULK_TARGET_REQUIRED");
    }

    if (schedulePayloads.length > 1000) {
      throw createHttpError(400, "일괄 설정은 한 번에 최대 1,000개 전형까지 가능합니다.", "APPLICANT_SCHEDULE_BULK_TARGET_LIMIT");
    }

    const normalizedSchedules = [];
    const handledScheduleKeys = new Set();

    const existingSchedules = await getApplicantSchedules();
    schedulePayloads.forEach((schedulePayload) => {
      const normalizedSchedule = normalizeApplicantSchedulePayload(schedulePayload, findApplicantScheduleRecord(existingSchedules, schedulePayload) || {});
      const scheduleKey = buildApplicantAdmissionScheduleKey(
        normalizedSchedule.trackName,
        normalizedSchedule.admissionCode,
        normalizedSchedule.admissionName,
      );

      if (handledScheduleKeys.has(scheduleKey)) {
        return;
      }

      handledScheduleKeys.add(scheduleKey);
      normalizedSchedules.push(normalizedSchedule);
    });

    for (const schedule of normalizedSchedules) await resolveScheduleTemplates(schedule);
    const connection = await getPool().getConnection();

    try {
      await connection.beginTransaction();

      for (const normalizedSchedule of normalizedSchedules) {
        const [matchingUnits] = await connection.query(
          `
            SELECT id
            FROM app_unit
            WHERE track_name = ?
              AND admission_code = ?
              AND admission_name = ?
            LIMIT 1
          `,
          [normalizedSchedule.trackName, normalizedSchedule.admissionCode, normalizedSchedule.admissionName],
        );

        if (matchingUnits.length === 0) {
          const targetLabel = [normalizedSchedule.trackName, normalizedSchedule.admissionName]
            .filter(Boolean)
            .join(" · ");

          throw createHttpError(
            404,
            `${targetLabel || "선택한 전형"}의 일정 설정 대상을 찾을 수 없습니다.`,
            "APPLICANT_SCHEDULE_TARGET_NOT_FOUND",
          );
        }

        await connection.query(
          `
            INSERT INTO app_schedule (
              application_template_id,
              document_template_id,
              track_name,
              admission_code,
              admission_name,
              applicant_schedule_enabled,
              applicant_schedule_start_at,
              applicant_schedule_end_at,
              document_submission_schedule_enabled,
              document_review_schedule_enabled,
              document_submission_schedule_start_at,
              document_review_schedule_start_at,
              document_submission_schedule_end_at,
              document_review_schedule_end_at,
              admit_card_lookup_schedule_enabled,
              admit_card_lookup_schedule_start_at,
              admit_card_lookup_schedule_end_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              application_template_id = VALUES(application_template_id),
              document_template_id = VALUES(document_template_id),
              applicant_schedule_enabled = VALUES(applicant_schedule_enabled),
              applicant_schedule_start_at = VALUES(applicant_schedule_start_at),
              applicant_schedule_end_at = VALUES(applicant_schedule_end_at),
              document_submission_schedule_enabled = VALUES(document_submission_schedule_enabled),
              document_review_schedule_enabled = VALUES(document_review_schedule_enabled),
              document_submission_schedule_start_at = VALUES(document_submission_schedule_start_at),
              document_review_schedule_start_at = VALUES(document_review_schedule_start_at),
              document_submission_schedule_end_at = VALUES(document_submission_schedule_end_at),
              document_review_schedule_end_at = VALUES(document_review_schedule_end_at),
              admit_card_lookup_schedule_enabled = VALUES(admit_card_lookup_schedule_enabled),
              admit_card_lookup_schedule_start_at = VALUES(admit_card_lookup_schedule_start_at),
              admit_card_lookup_schedule_end_at = VALUES(admit_card_lookup_schedule_end_at)
          `,
          [
            normalizedSchedule.applicationTemplateId,
            normalizedSchedule.documentTemplateId,
            normalizedSchedule.trackName,
            normalizedSchedule.admissionCode,
            normalizedSchedule.admissionName,
            normalizedSchedule.applicantScheduleEnabled ? 1 : 0,
            normalizedSchedule.applicantScheduleStartAt || null,
            normalizedSchedule.applicantScheduleEndAt || null,
            normalizedSchedule.documentSubmissionScheduleEnabled ? 1 : 0,
            normalizedSchedule.documentReviewScheduleEnabled ? 1 : 0,
            normalizedSchedule.documentSubmissionScheduleStartAt || null,
            normalizedSchedule.documentReviewScheduleStartAt || null,
            normalizedSchedule.documentSubmissionScheduleEndAt || null,
            normalizedSchedule.documentReviewScheduleEndAt || null,
            normalizedSchedule.admitCardLookupScheduleEnabled ? 1 : 0,
            normalizedSchedule.admitCardLookupScheduleStartAt || null,
            normalizedSchedule.admitCardLookupScheduleEndAt || null,
          ],
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return getApplicantSchedules();
  }

  async function validateUniqueApplicantRecruitmentUnit(payload = {}, excludeId = 0) {
    const codeRows = await query(
      `
        SELECT id
        FROM app_unit
        WHERE track_name = ?
          AND admission_code = ?
          AND series_code = ?
          AND unit_code = ?
          AND major_code = ?
          AND id <> ?
        LIMIT 1
      `,
      [payload.trackName, payload.admissionCode, payload.seriesCode, payload.unitCode, payload.majorCode, Number(excludeId || 0)],
    );

    if (codeRows.length > 0) {
      throw createHttpError(409, "같은 코드 조합의 전형 관리 항목이 이미 있습니다.", "APPLICANT_RECRUITMENT_UNIT_CODE_EXISTS");
    }

    const nameRows = await query(
      `
        SELECT id
        FROM app_unit
        WHERE track_name = ?
          AND admission_name = ?
          AND series_name = ?
          AND unit_name = ?
          AND major_name = ?
          AND id <> ?
        LIMIT 1
      `,
      [payload.trackName, payload.admissionName, payload.seriesName, payload.unitName, payload.majorName, Number(excludeId || 0)],
    );

    if (nameRows.length > 0) {
      throw createHttpError(409, "같은 모집시기/전형/계열/모집단위/전공 조합이 이미 있습니다.", "APPLICANT_RECRUITMENT_UNIT_NAME_EXISTS");
    }
  }

  async function validateUniqueApplicantFieldKey(fieldKey, excludeId = 0) {
    const rows = await query(
      `
        SELECT id
        FROM app_form
        WHERE field_key = ?
          AND id <> ?
        LIMIT 1
      `,
      [fieldKey, Number(excludeId || 0)],
    );

    if (rows.length > 0) {
      throw createHttpError(409, "중복된 항목 키가 있습니다. 질문명을 조금 다르게 입력하세요.", "APPLICANT_FIELD_KEY_EXISTS");
    }
  }

  async function validateUniqueApplicantSystemField(systemFieldKey = "", excludeId = 0, templateId) {
    const normalizedSystemFieldKey = String(systemFieldKey || "").trim();

    if (!normalizedSystemFieldKey) {
      return;
    }

    const rows = await query(
      `
        SELECT id
        FROM app_form
        WHERE system_field_key = ?
          AND COALESCE(template_id, (SELECT id FROM app_form_template WHERE form_scope = app_form.form_scope AND is_default = 1)) = ?
          AND active = 1
          AND id <> ?
        LIMIT 1
      `,
      [normalizedSystemFieldKey, templateId, Number(excludeId || 0)],
    );

    if (rows.length > 0) {
      throw createHttpError(409, "같은 시스템 항목에는 하나의 질문만 연결할 수 있습니다.", "APPLICANT_SYSTEM_FIELD_DUPLICATED");
    }
  }

  function normalizeApplicantFormFieldPayload(payload = {}, existingField = {}) {
    const formScope = String(payload.formScope ?? existingField.formScope ?? 'application');
    if (!['application', 'documents'].includes(formScope) || (existingField.id && formScope !== existingField.formScope)) {
      throw createHttpError(400, '질문 구분을 변경할 수 없습니다.', 'APPLICANT_FIELD_SCOPE_INVALID');
    }
    const questionText = normalizeApplicantText(payload.questionText ?? existingField.questionText, "질문 제목", {
      maxLength: 255,
      errorCode: "APPLICANT_FIELD_QUESTION_INVALID",
    });
    const questionDescription = normalizeApplicantText(
      payload.questionDescription ?? existingField.questionDescription,
      "질문 설명",
      {
        maxLength: 500,
        required: false,
        errorCode: "APPLICANT_FIELD_DESCRIPTION_INVALID",
      },
    );
    const questionTextEn = normalizeApplicantText(payload.questionTextEn ?? existingField.questionTextEn, "질문 제목 (영어)", {
      maxLength: 255, required: false, errorCode: "APPLICANT_FIELD_QUESTION_INVALID",
    });
    const questionDescriptionEn = normalizeApplicantText(payload.questionDescriptionEn ?? existingField.questionDescriptionEn, "질문 설명 (영어)", {
      maxLength: 500, required: false, errorCode: "APPLICANT_FIELD_DESCRIPTION_INVALID",
    });
    const inputType = String(payload.inputType ?? existingField.inputType ?? "text").trim();
    const systemFieldKey = String(payload.systemFieldKey ?? existingField.systemFieldKey ?? "").trim();
    if (formScope === 'documents' && (systemFieldKey || ['photo', 'birthdate'].includes(inputType))) {
      throw createHttpError(400, '서류제출 질문은 일반 항목으로 등록하세요. 사진은 파일 업로드 유형을 사용하세요.', 'DOCUMENT_FIELD_TYPE_INVALID');
    }
    const required = payload.required ?? existingField.required ?? false;
    const options = normalizeApplicantOptionValues(payload, existingField);
    const optionsEn = applicantFormConfig.normalizeChoiceTranslations(options, payload.optionsEn ?? existingField.optionsEn);
    const customOptionLabel = normalizeApplicantCustomOptionLabel(payload, existingField);
    const allowCustomOption = normalizeApplicantAllowCustomOption(payload, existingField) || Boolean(customOptionLabel);
    const fieldKey = String(existingField.fieldKey || payload.fieldKey || `${buildApplicantFieldKey(questionText).slice(0, 45)}-${randomUUID().slice(0, 8)}`).trim();
    let fileSettings = { fileNamePattern: "", allowedExtensions: [] };
    if (inputType === "file") {
      try { fileSettings = normalizeFileUploadSettings({ ...existingField, ...payload }); }
      catch (error) { throw createHttpError(400, error.message, "APPLICANT_FILE_SETTINGS_INVALID"); }
    }

    if (!APPLICANT_FORM_INPUT_TYPES.includes(inputType)) {
      throw createHttpError(400, "지원하지 않는 답변 유형입니다.", "APPLICANT_FIELD_INPUT_TYPE_INVALID");
    }
    if ((inputType === 'birthdate' && existingField.inputType !== 'birthdate') || (systemFieldKey === 'birth' && existingField.systemFieldKey !== 'birth')) {
      throw createHttpError(400, '생년월일은 회원가입에서 받습니다. 다른 날짜 질문은 날짜 유형을 사용하세요.', 'APPLICANT_MEMBER_FIELD_DUPLICATE');
    }

    if (applicantFormConfig.isChoiceInputType(inputType) && options.length === 0 && (inputType === 'multiselect' || allowCustomOption !== true)) {
      throw createHttpError(400, "선택지 항목은 최소 1개 이상의 선택지를 입력해야 합니다.", "APPLICANT_FIELD_OPTIONS_REQUIRED");
    }
    if (options.length > 100 || options.some(option => option.length > 200)) {
      throw createHttpError(400, "선택지는 100개 이하, 항목당 200자 이하로 입력하세요.", "APPLICANT_FIELD_OPTIONS_INVALID");
    }

    if (applicantFormConfig.isChoiceInputType(inputType) && customOptionLabel && !options.includes(customOptionLabel)) {
      throw createHttpError(400, "직접 입력 항목은 선택지 목록에 등록된 항목이어야 합니다.", "APPLICANT_FIELD_CUSTOM_OPTION_INVALID");
    }

    if (!applicantFormConfig.isChoiceInputType(inputType) && (options.length > 0 || allowCustomOption === true || customOptionLabel)) {
      throw createHttpError(400, "선택지 항목에서만 옵션을 입력할 수 있습니다.", "APPLICANT_FIELD_OPTIONS_INVALID");
    }

    if (inputType === "multiselect" && systemFieldKey) throw createHttpError(400, "복수 선택은 일반 항목으로 등록하세요.", "APPLICANT_FIELD_MAPPING_INVALID");

    if (inputType === "photo" && systemFieldKey && systemFieldKey !== "photo") {
      throw createHttpError(400, "사진 업로드 항목은 수험생 사진 시스템 항목에만 연결할 수 있습니다.", "APPLICANT_FIELD_PHOTO_MAPPING_INVALID");
    }

    if (systemFieldKey === "photo" && inputType !== "photo") {
      throw createHttpError(400, "수험생 사진 시스템 항목은 사진 업로드 유형으로만 설정할 수 있습니다.", "APPLICANT_FIELD_PHOTO_TYPE_REQUIRED");
    }

    if (inputType === "file" && systemFieldKey) {
      throw createHttpError(400, "파일 업로드 항목은 일반 항목으로만 설정할 수 있습니다.", "APPLICANT_FIELD_FILE_MAPPING_INVALID");
    }

    return {
      fieldKey,
      formScope,
      questionText,
      questionDescription,
      questionTextEn,
      questionDescriptionEn,
      inputType,
      ...fileSettings,
      systemFieldKey,
      options,
      optionsEn,
      allowCustomOption,
      customOptionLabel,
      required: required === true || required === "true" || Number(required) === 1,
    };
  }

  async function createApplicantFormField(payload = {}) {
    const normalizedPayload = normalizeApplicantFormFieldPayload(payload);
    normalizedPayload.templateId = await formTemplates.resolve(normalizedPayload.formScope, payload.templateId);
    const existingFields = await getApplicantFormFields({ formScope: normalizedPayload.formScope, templateId: normalizedPayload.templateId });
    const nextSortOrder = existingFields.length === 0 ? 1 : Math.max(...existingFields.map((field) => field.sortOrder || 0)) + 1;

    await validateUniqueApplicantFieldKey(normalizedPayload.fieldKey);
    await validateUniqueApplicantSystemField(normalizedPayload.systemFieldKey, 0, normalizedPayload.templateId);

    await query(
      `
        INSERT INTO app_form (
          template_id,
          form_scope,
          field_key,
          question_text,
          question_description,
          question_text_en,
          question_description_en,
          input_type,
          system_field_key,
          options_json,
          required,
          sort_order,
          active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `,
      [
        normalizedPayload.templateId,
        normalizedPayload.formScope,
        normalizedPayload.fieldKey,
        normalizedPayload.questionText,
        normalizedPayload.questionDescription,
        normalizedPayload.questionTextEn,
        normalizedPayload.questionDescriptionEn,
        normalizedPayload.inputType,
        normalizedPayload.systemFieldKey,
        JSON.stringify({
          items: normalizedPayload.options,
          optionsEn: normalizedPayload.optionsEn,
          allowCustomOption: normalizedPayload.allowCustomOption === true,
          customOptionLabel: normalizedPayload.customOptionLabel,
          fileNamePattern: normalizedPayload.fileNamePattern,
          allowedExtensions: normalizedPayload.allowedExtensions,
        }),
        normalizedPayload.required ? 1 : 0,
        nextSortOrder,
      ],
    );

    return getApplicantFormFields();
  }

  async function updateApplicantFormField(fieldId, payload = {}) {
    const existingField = await getApplicantFormFieldById(fieldId);
    const normalizedPayload = normalizeApplicantFormFieldPayload(payload, existingField);

    if (protectedApplicantSystemFields.includes(existingField.systemFieldKey) && existingField.systemFieldKey !== normalizedPayload.systemFieldKey) {
      throw createHttpError(400, "이름 항목의 시스템 연결은 변경할 수 없습니다.", "APPLICANT_FIELD_PROTECTED_MAPPING");
    }

    await validateUniqueApplicantFieldKey(normalizedPayload.fieldKey, existingField.id);
    await validateUniqueApplicantSystemField(normalizedPayload.systemFieldKey, existingField.id, existingField.templateId);

    await query(
      `
        UPDATE app_form
        SET
          field_key = ?,
          question_text = ?,
          question_description = ?,
          question_text_en = ?,
          question_description_en = ?,
          input_type = ?,
          system_field_key = ?,
          options_json = ?,
          required = ?
        WHERE id = ?
      `,
      [
        normalizedPayload.fieldKey,
        normalizedPayload.questionText,
        normalizedPayload.questionDescription,
        normalizedPayload.questionTextEn,
        normalizedPayload.questionDescriptionEn,
        normalizedPayload.inputType,
        normalizedPayload.systemFieldKey,
        JSON.stringify({
          items: normalizedPayload.options,
          optionsEn: normalizedPayload.optionsEn,
          allowCustomOption: normalizedPayload.allowCustomOption === true,
          customOptionLabel: normalizedPayload.customOptionLabel,
          fileNamePattern: normalizedPayload.fileNamePattern,
          allowedExtensions: normalizedPayload.allowedExtensions,
        }),
        normalizedPayload.required ? 1 : 0,
        existingField.id,
      ],
    );

    return getApplicantFormFields();
  }

  async function resequenceApplicantFormFields(connection, fields = []) {
    for (let index = 0; index < fields.length; index += 1) {
      await connection.query(`UPDATE app_form SET sort_order = ? WHERE id = ?`, [index + 1, fields[index].id]);
    }
  }

  async function deleteApplicantFormField(fieldId) {
    const existingField = await getApplicantFormFieldById(fieldId);

    await query(`DELETE FROM app_form WHERE id = ?`, [existingField.id]);

    const connection = await getPool().getConnection();

    try {
      await connection.beginTransaction();
      const fields = await getApplicantFormFields({ formScope: existingField.formScope, templateId: existingField.templateId });
      await resequenceApplicantFormFields(connection, fields);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return getApplicantFormFields();
  }

  async function moveApplicantFormField(fieldId, moveOptions = {}) {
    const normalizedMoveOptions =
      typeof moveOptions === "string"
        ? {
            direction: moveOptions,
          }
        : moveOptions || {};
    const normalizedFieldId = Number(fieldId);
    const sourceField = await getApplicantFormFieldById(normalizedFieldId);
    const fields = await getApplicantFormFields({ formScope: sourceField.formScope, templateId: sourceField.templateId });
    const fieldIndex = fields.findIndex((field) => field.id === normalizedFieldId);

    if (fieldIndex < 0) {
      throw createHttpError(404, "접수 양식 항목을 찾을 수 없습니다.", "APPLICANT_FIELD_NOT_FOUND");
    }

    const normalizedDirection = String(normalizedMoveOptions.direction || "").trim();
    const normalizedTargetFieldId = Number(normalizedMoveOptions.targetFieldId || 0);
    const normalizedPlacement = String(normalizedMoveOptions.placement || "before").trim() === "after" ? "after" : "before";
    let reorderedFields = [...fields];

    if (Number.isInteger(normalizedTargetFieldId) && normalizedTargetFieldId > 0) {
      if (normalizedTargetFieldId === normalizedFieldId) {
        return fields;
      }

      const filteredFields = reorderedFields.filter((field) => field.id !== normalizedFieldId);
      const targetIndex = filteredFields.findIndex((field) => field.id === normalizedTargetFieldId);

      if (targetIndex < 0) {
        throw createHttpError(404, "이동 대상 접수 양식 항목을 찾을 수 없습니다.", "APPLICANT_FIELD_MOVE_TARGET_NOT_FOUND");
      }

      const sourceField = fields[fieldIndex];
      const insertionIndex = normalizedPlacement === "after" ? targetIndex + 1 : targetIndex;
      filteredFields.splice(insertionIndex, 0, sourceField);
      reorderedFields = filteredFields;
    } else {
      if (!["up", "down"].includes(normalizedDirection)) {
        throw createHttpError(400, "이동 방향이 올바르지 않습니다.", "APPLICANT_FIELD_MOVE_DIRECTION_INVALID");
      }

      const targetIndex = normalizedDirection === "up" ? fieldIndex - 1 : fieldIndex + 1;

      if (targetIndex < 0 || targetIndex >= reorderedFields.length) {
        return fields;
      }

      const [movedField] = reorderedFields.splice(fieldIndex, 1);
      reorderedFields.splice(targetIndex, 0, movedField);
    }

    const connection = await getPool().getConnection();

    try {
      await connection.beginTransaction();
      await resequenceApplicantFormFields(connection, reorderedFields);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return getApplicantFormFields();
  }

  async function resequenceApplicantRecruitmentUnits(connection, units = []) {
    for (let index = 0; index < units.length; index += 1) {
      await connection.query(`UPDATE app_unit SET sort_order = ? WHERE id = ?`, [index + 1, units[index].id]);
    }
  }

  async function createApplicantRecruitmentUnit(payload = {}) {
    const existingUnits = await getApplicantRecruitmentUnits();
    const normalizedPayload = normalizeApplicantRecruitmentUnitPayload(payload);
    const nextSortOrder = existingUnits.length === 0 ? 1 : Math.max(...existingUnits.map((unit) => unit.sortOrder || 0)) + 1;

    await validateUniqueApplicantRecruitmentUnit(normalizedPayload);

    await query(
      `
        INSERT INTO app_unit (
          track_name,
          admission_code,
          admission_name,
          admission_name_en,
          series_code,
          series_name,
          unit_code,
          unit_name,
          unit_name_en,
          major_code,
          major_name,
          major_name_en,
          sort_order
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        normalizedPayload.trackName,
        normalizedPayload.admissionCode,
        normalizedPayload.admissionName,
        normalizedPayload.admissionNameEn,
        normalizedPayload.seriesCode,
        normalizedPayload.seriesName,
        normalizedPayload.unitCode,
        normalizedPayload.unitName,
        normalizedPayload.unitNameEn,
        normalizedPayload.majorCode,
        normalizedPayload.majorName,
        normalizedPayload.majorNameEn,
        nextSortOrder,
      ],
    );

    return getApplicantRecruitmentUnits();
  }

  async function updateApplicantRecruitmentUnit(unitId, payload = {}) {
    const existingUnit = await getApplicantRecruitmentUnitById(unitId);
    const normalizedPayload = normalizeApplicantRecruitmentUnitPayload(payload, existingUnit);

    await validateUniqueApplicantRecruitmentUnit(normalizedPayload, existingUnit.id);

    await query(
      `
        UPDATE app_unit
        SET
          track_name = ?,
          admission_code = ?,
          admission_name = ?,
          admission_name_en = ?,
          series_code = ?,
          series_name = ?,
          unit_code = ?,
          unit_name = ?,
          unit_name_en = ?,
          major_code = ?,
          major_name = ?,
          major_name_en = ?
        WHERE id = ?
      `,
      [
        normalizedPayload.trackName,
        normalizedPayload.admissionCode,
        normalizedPayload.admissionName,
        normalizedPayload.admissionNameEn,
        normalizedPayload.seriesCode,
        normalizedPayload.seriesName,
        normalizedPayload.unitCode,
        normalizedPayload.unitName,
        normalizedPayload.unitNameEn,
        normalizedPayload.majorCode,
        normalizedPayload.majorName,
        normalizedPayload.majorNameEn,
        existingUnit.id,
      ],
    );

    return getApplicantRecruitmentUnits();
  }

  async function deleteApplicantRecruitmentUnit(unitId) {
    const existingUnit = await getApplicantRecruitmentUnitById(unitId);
    const connection = await getPool().getConnection();

    try {
      await connection.beginTransaction();
      await connection.query(`DELETE FROM app_unit WHERE id = ?`, [existingUnit.id]);
      await connection.query(`
        UPDATE app_schedule schedule
        SET application_template_id = NULL, document_template_id = NULL
        WHERE track_name = ? AND admission_code = ? AND admission_name = ?
          AND NOT EXISTS (
            SELECT 1 FROM app_unit unit
            WHERE unit.track_name = schedule.track_name
              AND unit.admission_code = schedule.admission_code
              AND unit.admission_name = schedule.admission_name
          )
      `, [existingUnit.trackName, existingUnit.admissionCode, existingUnit.admissionName]);
      const units = await getApplicantRecruitmentUnits({ queryable: connection.query.bind(connection) });
      await resequenceApplicantRecruitmentUnits(connection, units);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return getApplicantRecruitmentUnits();
  }

  async function importApplicantRecruitmentUnits(payload = {}) {
    const sourceRows =
      Array.isArray(payload.rows) && payload.rows.length > 0
        ? payload.rows
        : payload.fileContentBase64
          ? await parseApplicantRecruitmentUnitWorkbook(payload.fileContentBase64)
          : [];

    if (sourceRows.length === 0) {
      throw createHttpError(400, "업로드할 전형 관리 데이터가 없습니다.", "APPLICANT_RECRUITMENT_IMPORT_EMPTY");
    }

    const currentUnits = await getApplicantRecruitmentUnits();
    validateApplicantRecruitmentUnitImportRows(sourceRows, currentUnits);
    const normalizedRows = normalizeRecruitmentImportRows(sourceRows, currentUnits);
    const existingDataPolicy = normalizeApplicantImportExistingDataPolicy(payload.existingDataPolicy);
    const selectedRows = classifyApplicantRecruitmentUnitImportRows(normalizedRows, currentUnits)
      .filter((entry) => shouldProcessApplicantImportOperation(entry.operation, existingDataPolicy))
      .map((entry) => entry.row);

    if (selectedRows.length === 0) {
      throw createHttpError(
        400,
        "선택한 기존 데이터 처리 방식에 따라 반영할 전형 관리 데이터가 없습니다.",
        "APPLICANT_RECRUITMENT_IMPORT_NOTHING_SELECTED",
      );
    }

    const connection = await getPool().getConnection();

    try {
      await connection.beginTransaction();
      const [summaryRows] = await connection.query(`SELECT COALESCE(MAX(sort_order), 0) AS maxSortOrder FROM app_unit`);
      let nextSortOrder = Number(summaryRows?.[0]?.maxSortOrder || 0);

      for (const row of selectedRows) {
        nextSortOrder += 1;
        await connection.query(
          `
            INSERT INTO app_unit (
              track_name,
              admission_code,
              admission_name,
              admission_name_en,
              series_code,
              series_name,
              unit_code,
              unit_name,
              unit_name_en,
              major_code,
              major_name,
              major_name_en,
              sort_order
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              track_name = VALUES(track_name),
              admission_name = VALUES(admission_name),
              admission_name_en = VALUES(admission_name_en),
              series_code = VALUES(series_code),
              series_name = VALUES(series_name),
              unit_code = VALUES(unit_code),
              unit_name = VALUES(unit_name),
              unit_name_en = VALUES(unit_name_en),
              major_code = VALUES(major_code),
              major_name = VALUES(major_name),
              major_name_en = VALUES(major_name_en)
          `,
          [
            row.trackName,
            row.admissionCode,
            row.admissionName,
            row.admissionNameEn,
            row.seriesCode,
            row.seriesName,
            row.unitCode,
            row.unitName,
            row.unitNameEn,
            row.majorCode,
            row.majorName,
            row.majorNameEn,
            nextSortOrder,
          ],
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return {
      processed: selectedRows.length,
      units: await getApplicantRecruitmentUnits(),
    };
  }

  function parseApplicantStoredPhotoAnswerData(answerData, options = {}) {
    if (!String(answerData || "").trim()) {
      return {
        fileName: "",
        mimeType: "",
        hasPhoto: false,
        ...(options.includeBase64 === true ? { base64: "" } : {}),
      };
    }

    try {
      const parsedValue = JSON.parse(String(answerData || "{}"));
      return {
        fileName: String(parsedValue?.fileName || "").trim(),
        mimeType: String(parsedValue?.mimeType || "").trim(),
        hasPhoto: parsedValue?.hasPhoto === true || Number(parsedValue?.hasPhoto) === 1,
        ...(options.includeBase64 === true ? { base64: String(parsedValue?.base64 || "").trim() } : {}),
      };
    } catch (error) {
      return {
        fileName: "",
        mimeType: "",
        hasPhoto: false,
        ...(options.includeBase64 === true ? { base64: "" } : {}),
      };
    }
  }

  function parseApplicantStoredFileAnswerData(answerData, options = {}) {
    if (!String(answerData || "").trim()) {
      return {
        fileName: "",
        mimeType: "",
        hasFile: false,
        ...(options.includeBase64 === true ? { base64: "" } : {}),
      };
    }

    try {
      const parsedValue = JSON.parse(String(answerData || "{}"));
      return {
        fileName: String(parsedValue?.fileName || parsedValue?.originalFileName || "").trim(),
        mimeType: String(parsedValue?.mimeType || "").trim(),
        hasFile: parsedValue?.hasFile === true || Number(parsedValue?.hasFile) === 1,
        ...(options.includeBase64 === true ? { base64: String(parsedValue?.base64 || "").trim() } : {}),
      };
    } catch (error) {
      return {
        fileName: "",
        mimeType: "",
        hasFile: false,
        ...(options.includeBase64 === true ? { base64: "" } : {}),
      };
    }
  }

  function normalizeApplicantStoredAnswerRow(row = {}, options = {}) {
    const inputType = String(row.inputType || "text").trim() || "text";
    const fieldKey = String(row.fieldKey || "").trim();
    const syntheticSelectionField = getApplicantRecruitmentSelectionFieldByFieldKey(fieldKey);

    if (!fieldKey) {
      return null;
    }

    if (inputType === "photo") {
      const photoValue = parseApplicantStoredPhotoAnswerData(row.answerData, {
        includeBase64: options.includeBase64 === true,
      });

      return {
        fieldKey,
        questionText: String(syntheticSelectionField?.questionText || row.questionText || fieldKey).trim(),
        questionTextEn: String(row.questionTextEn || "").trim(),
        inputType,
        systemFieldKey: String(syntheticSelectionField?.systemFieldKey || row.systemFieldKey || "").trim(),
        value: {
          fileName: photoValue.fileName,
          mimeType: photoValue.mimeType,
          hasPhoto: photoValue.hasPhoto,
        },
        ...(options.includeInternal === true
          ? {
              internalPhotoValue: {
                ...photoValue,
              },
            }
          : {}),
      };
    }

    if (inputType === "file") {
      const fileValue = parseApplicantStoredFileAnswerData(row.answerData, {
        includeBase64: options.includeBase64 === true,
      });

      return {
        fieldKey,
        questionText: String(syntheticSelectionField?.questionText || row.questionText || fieldKey).trim(),
        questionTextEn: String(row.questionTextEn || "").trim(),
        inputType,
        systemFieldKey: String(syntheticSelectionField?.systemFieldKey || row.systemFieldKey || "").trim(),
        value: {
          fileName: fileValue.fileName,
          mimeType: fileValue.mimeType,
          hasFile: fileValue.hasFile,
        },
        ...(options.includeInternal === true
          ? {
              internalFileValue: {
                ...fileValue,
              },
            }
          : {}),
      };
    }

    return {
      fieldKey,
      questionText: String(syntheticSelectionField?.questionText || row.questionText || fieldKey).trim(),
      questionTextEn: String(row.questionTextEn || "").trim(),
      inputType: syntheticSelectionField ? "text" : inputType,
      systemFieldKey: String(syntheticSelectionField?.systemFieldKey || row.systemFieldKey || "").trim(),
      value: inputType === "multiselect" ? applicantFormConfig.parseMultiSelectValue(row.answerData) : String(row.answerData ?? "").trim(),
    };
  }

  function normalizeStoredAnswerItems(answerItems = []) {
    return (Array.isArray(answerItems) ? answerItems : [])
      .map((answerItem) => {
        if (!answerItem || typeof answerItem !== "object") {
          return null;
        }

        if (answerItem.inputType === "photo") {
          const photoValue = answerItem.value && typeof answerItem.value === "object" ? answerItem.value : {};

          return {
            fieldKey: String(answerItem.fieldKey || "").trim(),
            questionText: String(answerItem.questionText || answerItem.fieldKey || "").trim(),
            questionTextEn: String(answerItem.questionTextEn || "").trim(),
            inputType: "photo",
            systemFieldKey: String(answerItem.systemFieldKey || "").trim(),
            value: {
              fileName: String(photoValue.fileName || "").trim(),
              mimeType: String(photoValue.mimeType || "").trim(),
              hasPhoto: photoValue.hasPhoto === true || Number(photoValue.hasPhoto) === 1,
            },
          };
        }

        if (answerItem.inputType === "file") {
          const fileValue = answerItem.value && typeof answerItem.value === "object" ? answerItem.value : {};

          return {
            fieldKey: String(answerItem.fieldKey || "").trim(),
            questionText: String(answerItem.questionText || answerItem.fieldKey || "").trim(),
            questionTextEn: String(answerItem.questionTextEn || "").trim(),
            inputType: "file",
            systemFieldKey: String(answerItem.systemFieldKey || "").trim(),
            value: {
              fileName: String(fileValue.fileName || "").trim(),
              mimeType: String(fileValue.mimeType || "").trim(),
              hasFile: fileValue.hasFile === true || Number(fileValue.hasFile) === 1,
            },
          };
        }

        return {
          fieldKey: String(answerItem.fieldKey || "").trim(),
          questionText: String(answerItem.questionText || answerItem.fieldKey || "").trim(),
          questionTextEn: String(answerItem.questionTextEn || "").trim(),
          inputType: String(answerItem.inputType || "text").trim(),
          systemFieldKey: String(answerItem.systemFieldKey || "").trim(),
          value: answerItem.inputType === "multiselect" ? applicantFormConfig.parseMultiSelectValue(answerItem.value) : String(answerItem.value ?? "").trim(),
        };
      })
      .filter((answerItem) => answerItem?.fieldKey);
  }

  function buildApplicantAnswerMap(answerItems = []) {
    return normalizeStoredAnswerItems(answerItems).reduce((answerMap, answerItem) => {
      answerMap[answerItem.fieldKey] = answerItem.value;
      return answerMap;
    }, {});
  }

  function buildApplicantSystemValueMap(answerItems = []) {
    const systemValueKeys = ["birth", "track", "admission", "series", "unit", "major"];

    return normalizeStoredAnswerItems(answerItems).reduce((systemValueMap, answerItem) => {
      const systemFieldKey = String(answerItem?.systemFieldKey || "").trim();

      if (!systemValueKeys.includes(systemFieldKey) || isApplicantUploadInputType(answerItem?.inputType)) {
        return systemValueMap;
      }

      if (!systemValueMap[systemFieldKey]) {
        systemValueMap[systemFieldKey] = String(answerItem?.value ?? "").trim();
      }

      return systemValueMap;
    }, {
      birth: "",
      track: "",
      admission: "",
      series: "",
      unit: "",
      major: "",
    });
  }

  function buildApplicantSubmissionFromRows(rows = [], options = {}) {
    const normalizedRows = Array.isArray(rows) ? rows : [];

    if (normalizedRows.length === 0) {
      return null;
    }

    const firstRow = normalizedRows[0] || {};
    const answerItems = normalizedRows
      .map((row) => normalizeApplicantStoredAnswerRow(row, options))
      .filter(Boolean);
    const photoAnswerItem = answerItems.find((answerItem) => answerItem.inputType === "photo") || null;
    const fieldOverrides = normalizeStoredTicketOverrides(firstRow.fieldOverridesJson);
    const systemValues = buildApplicantSystemValueMap(answerItems);

    return {
      id: Number(firstRow.id || 0),
      memberId: Number(firstRow.memberId || 0) || null,
      name: String(firstRow.applicantName || "").trim(),
      email: String(firstRow.email || "").trim(),
      hasPassword: Number(firstRow.hasPassword) === 1 || firstRow.hasPassword === true,
      status: String(firstRow.status || "submitted").trim(),
      examineeNo: String(firstRow.examineeNo || "").trim(),
      hasPhoto: photoAnswerItem?.value?.hasPhoto === true,
      photoFileName: String(photoAnswerItem?.value?.fileName || "").trim(),
      createdAt: String(firstRow.createdAt || "").trim(),
      updatedAt: String(firstRow.updatedAt || "").trim(),
      birth: systemValues.birth,
      track: systemValues.track,
      admission: systemValues.admission,
      series: systemValues.series,
      unit: systemValues.unit,
      major: systemValues.major,
      fieldOverrides,
      answerItems: normalizeStoredAnswerItems(answerItems),
      answerMap: buildApplicantAnswerMap(answerItems),
      ...(options.includeInternal === true
        ? {
            passwordHash: String(firstRow.passwordHash || "").trim(),
            internalPhotoValue: photoAnswerItem?.internalPhotoValue || null,
            fieldOverridesJson: String(firstRow.fieldOverridesJson || "").trim(),
          }
        : {}),
    };
  }

  function buildApplicantSubmissionListFromRows(rows = [], options = {}) {
    const submissionsById = new Map();

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const submissionId = Number(row?.id || 0);

      if (!Number.isInteger(submissionId) || submissionId <= 0) {
        return;
      }

      if (!submissionsById.has(submissionId)) {
        submissionsById.set(submissionId, []);
      }

      submissionsById.get(submissionId).push(row);
    });

    return Array.from(submissionsById.values())
      .map((submissionRows) => buildApplicantSubmissionFromRows(submissionRows, options))
      .filter(Boolean);
  }

  async function getApplicantSubmissionRowsById(queryable, submissionId, options = {}) {
    const normalizedSubmissionId = Number(submissionId);

    if (!Number.isInteger(normalizedSubmissionId) || normalizedSubmissionId <= 0) {
      throw createHttpError(400, "접수 이력 ID가 올바르지 않습니다.", "APPLICANT_SUBMISSION_ID_INVALID");
    }

    const lockClause = options.forUpdate === true ? "\n        FOR UPDATE" : "";

    return executeRows(
      queryable,
      `
        SELECT
          s.id,
          s.applicant_name AS applicantName,
          s.email,
          s.password_hash AS passwordHash,
          CASE WHEN s.password_hash IS NULL OR s.password_hash = '' THEN 0 ELSE 1 END AS hasPassword,
          s.status,
          s.field_key AS fieldKey,
          s.answer_data AS answerData,
          COALESCE(ff.question_text, s.field_key) AS questionText,
          COALESCE(ff.question_text_en, '') AS questionTextEn,
          COALESCE(ff.input_type, 'text') AS inputType,
          COALESCE(ff.system_field_key, '') AS systemFieldKey,
          COALESCE(meta.examinee_no, '') AS examineeNo,
          meta.member_id AS memberId,
          COALESCE(meta.field_overrides_json, '') AS fieldOverridesJson,
          COALESCE(DATE_FORMAT(summary.created_at, '%Y-%m-%d %H:%i:%s'), '') AS createdAt,
          COALESCE(DATE_FORMAT(summary.updated_at, '%Y-%m-%d %H:%i:%s'), '') AS updatedAt,
          COALESCE(ff.sort_order, 2147483647) AS sortOrder
        FROM app_subm s
        LEFT JOIN (
          SELECT
            id,
            MIN(created_at) AS created_at,
            MAX(updated_at) AS updated_at
          FROM app_subm
          WHERE id = ?
          GROUP BY id
        ) summary
          ON summary.id = s.id
        LEFT JOIN app_meta meta
          ON meta.id = s.id
        LEFT JOIN app_form ff
          ON ff.field_key = s.field_key
        WHERE s.id = ?
        ORDER BY COALESCE(ff.sort_order, 2147483647), s.field_key ASC${lockClause}
      `,
      [normalizedSubmissionId, normalizedSubmissionId],
    );
  }

  async function getApplicantSubmissionRowsByIds(queryable, submissionIds, options = {}) {
    const normalizedSubmissionIds = normalizeApplicantSubmissionIdList(submissionIds);
    const placeholders = normalizedSubmissionIds.map(() => "?").join(", ");
    const lockClause = options.forUpdate === true ? "\n        FOR UPDATE" : "";

    return executeRows(
      queryable,
      `
        SELECT
          s.id,
          s.applicant_name AS applicantName,
          s.email,
          s.password_hash AS passwordHash,
          CASE WHEN s.password_hash IS NULL OR s.password_hash = '' THEN 0 ELSE 1 END AS hasPassword,
          s.status,
          s.field_key AS fieldKey,
          s.answer_data AS answerData,
          COALESCE(ff.question_text, s.field_key) AS questionText,
          COALESCE(ff.question_text_en, '') AS questionTextEn,
          COALESCE(ff.input_type, 'text') AS inputType,
          COALESCE(ff.system_field_key, '') AS systemFieldKey,
          COALESCE(meta.examinee_no, '') AS examineeNo,
          meta.member_id AS memberId,
          COALESCE(meta.field_overrides_json, '') AS fieldOverridesJson,
          COALESCE(DATE_FORMAT(summary.created_at, '%Y-%m-%d %H:%i:%s'), '') AS createdAt,
          COALESCE(DATE_FORMAT(summary.updated_at, '%Y-%m-%d %H:%i:%s'), '') AS updatedAt,
          COALESCE(ff.sort_order, 2147483647) AS sortOrder
        FROM app_subm s
        INNER JOIN (
          SELECT
            id,
            MIN(created_at) AS created_at,
            MAX(updated_at) AS updated_at
          FROM app_subm
          WHERE id IN (${placeholders})
          GROUP BY id
        ) summary
          ON summary.id = s.id
        LEFT JOIN app_meta meta
          ON meta.id = s.id
        LEFT JOIN app_form ff
          ON ff.field_key = s.field_key
        WHERE s.id IN (${placeholders})
        ORDER BY summary.updated_at DESC, s.id DESC, COALESCE(ff.sort_order, 2147483647), s.field_key ASC${lockClause}
      `,
      [...normalizedSubmissionIds, ...normalizedSubmissionIds],
    );
  }

  async function getApplicantSubmissionsByIds(submissionIds, options = {}) {
    const rows = await getApplicantSubmissionRowsByIds(options.queryable || query, submissionIds, {
      forUpdate: options.forUpdate === true,
    });

    return buildApplicantSubmissionListFromRows(rows, {
      includeInternal: options.includeInternal === true,
      includeBase64: options.includeInternal === true,
    });
  }

  async function getApplicantSubmissionById(submissionId, options = {}) {
    const rows = await getApplicantSubmissionRowsById(options.queryable || query, submissionId, {
      forUpdate: options.forUpdate === true,
    });
    const submission = buildApplicantSubmissionFromRows(rows, {
      includeInternal: options.includeInternal === true,
      includeBase64: options.includeBase64 === true,
    });

    if (!submission?.id && options.required !== false) {
      throw createHttpError(404, "접수 이력을 찾을 수 없습니다.", "APPLICANT_SUBMISSION_NOT_FOUND");
    }

    return submission?.id ? submission : null;
  }

  async function getApplicantSubmissionPhoto(submissionId) {
    const submission = await getApplicantSubmissionById(submissionId, {
      includeInternal: true,
    });
    const internalPhotoValue = submission?.internalPhotoValue && typeof submission.internalPhotoValue === "object" ? submission.internalPhotoValue : null;
    const normalizedPhotoFileName = path.basename(String(submission?.photoFileName || internalPhotoValue?.fileName || "").trim());
    const normalizedMimeType = String(internalPhotoValue?.mimeType || "").trim();
    const storedApplicantPhoto = await readStoredApplicantPhotoFile(
      submission?.id,
      submission?.examineeNo,
      normalizedPhotoFileName,
      normalizedMimeType,
    );

    if (storedApplicantPhoto?.photoBlob) {
      return storedApplicantPhoto;
    }

    const storedPromotedPhoto = await readStoredPromotedPhotoFile(submission?.examineeNo);

    if (storedPromotedPhoto?.photoBlob) {
      return storedPromotedPhoto;
    }

    const legacySubmission = await getApplicantSubmissionById(submissionId, {
      includeInternal: true,
      includeBase64: true,
    });
    const normalizedBase64 = String(legacySubmission?.internalPhotoValue?.base64 || "").trim();

    if (normalizedBase64) {
      const photoBlob = Buffer.from(normalizedBase64, "base64");

      if (Buffer.isBuffer(photoBlob) && photoBlob.length > 0) {
        return {
          photoBlob,
          photoMime: normalizedMimeType || "application/octet-stream",
          photoName: normalizedPhotoFileName || `applicant-submission-${submission.id}.jpg`,
        };
      }
    }

    throw createHttpError(404, "접수 사진을 찾을 수 없습니다.", "APPLICANT_SUBMISSION_PHOTO_NOT_FOUND");
  }

  async function getApplicantSubmissionFile(submissionId, fieldKey = "") {
    const submission = await getApplicantSubmissionById(submissionId, {
      includeInternal: true,
    });
    const normalizedFieldKey = String(fieldKey || "").trim();
    const fileAnswerItem = normalizeStoredAnswerItems(submission?.answerItems).find((answerItem) => {
      return answerItem?.inputType === "file" && String(answerItem?.fieldKey || "").trim() === normalizedFieldKey;
    });

    if (!fileAnswerItem?.value?.hasFile) {
      throw createHttpError(404, "접수 첨부 파일을 찾을 수 없습니다.", "APPLICANT_SUBMISSION_FILE_NOT_FOUND");
    }

    const storedFile = await readStoredApplicantFile(fileAnswerItem.value.fileName, fileAnswerItem.value.mimeType);

    if (!storedFile?.fileBlob) {
      throw createHttpError(404, "접수 첨부 파일을 찾을 수 없습니다.", "APPLICANT_SUBMISSION_FILE_NOT_FOUND");
    }

    return {
      fileBlob: storedFile.fileBlob,
      fileMime: storedFile.fileMime,
      fileName: String(fileAnswerItem.value.fileName || "").trim() || storedFile.fileName,
    };
  }

  async function getApplicantSubmissions() {
    const rows = await executeRows(
      query,
      `
        SELECT
          s.id,
          s.applicant_name AS applicantName,
          s.email,
          s.password_hash AS passwordHash,
          CASE WHEN s.password_hash IS NULL OR s.password_hash = '' THEN 0 ELSE 1 END AS hasPassword,
          s.status,
          s.field_key AS fieldKey,
          s.answer_data AS answerData,
          COALESCE(ff.question_text, s.field_key) AS questionText,
          COALESCE(ff.question_text_en, '') AS questionTextEn,
          COALESCE(ff.input_type, 'text') AS inputType,
          COALESCE(ff.system_field_key, '') AS systemFieldKey,
          COALESCE(meta.examinee_no, '') AS examineeNo,
          meta.member_id AS memberId,
          COALESCE(meta.field_overrides_json, '') AS fieldOverridesJson,
          COALESCE(DATE_FORMAT(summary.created_at, '%Y-%m-%d %H:%i:%s'), '') AS createdAt,
          COALESCE(DATE_FORMAT(summary.updated_at, '%Y-%m-%d %H:%i:%s'), '') AS updatedAt,
          COALESCE(ff.sort_order, 2147483647) AS sortOrder
        FROM app_subm s
        INNER JOIN (
          SELECT
            id,
            MIN(created_at) AS created_at,
            MAX(updated_at) AS updated_at
          FROM app_subm
          GROUP BY id
        ) summary
          ON summary.id = s.id
        LEFT JOIN app_meta meta
          ON meta.id = s.id
        LEFT JOIN app_form ff
          ON ff.field_key = s.field_key
        ORDER BY summary.updated_at DESC, s.id DESC, COALESCE(ff.sort_order, 2147483647), s.field_key ASC
      `,
    );

    return buildApplicantSubmissionListFromRows(rows);
  }

  async function deleteApplicantSubmission(submissionId) {
    const normalizedSubmissionId = Number(submissionId);

    if (!Number.isInteger(normalizedSubmissionId) || normalizedSubmissionId <= 0) {
      throw createHttpError(400, "접수 이력 ID가 올바르지 않습니다.", "APPLICANT_SUBMISSION_ID_INVALID");
    }

    const connection = await getPool().getConnection();
    let submission = null;

    try {
      await connection.beginTransaction();
      const queryable = connection.query.bind(connection);

      submission = await getApplicantSubmissionById(normalizedSubmissionId, {
        queryable,
        includeInternal: true,
        forUpdate: true,
      });

      const normalizedPromotedExamineeNo = String(submission?.examineeNo || "").trim();

      if (normalizedPromotedExamineeNo) {
        await connection.query(`DELETE FROM print_log WHERE examinee_no = ?`, [normalizedPromotedExamineeNo]);
      }

      await connection.query(`DELETE FROM app_meta WHERE id = ?`, [normalizedSubmissionId]);
      await connection.query(`DELETE FROM app_subm WHERE id = ?`, [normalizedSubmissionId]);
      await connection.commit();
      await deleteApplicantSubmissionArtifacts(submission);

      return {
        deletedSubmissionId: normalizedSubmissionId,

      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function getLatestApplicantSubmissionByApplicant(name = "", email = "") {
    const normalizedName = normalizeApplicantText(name, "이름", { maxLength: 100 });
    const normalizedEmail = normalizeApplicantEmail(email);
    const latestRows = await executeRows(
      query,
      `
        SELECT
          id
        FROM app_subm
        WHERE applicant_name = ?
          AND email = ?
        GROUP BY id
        ORDER BY MAX(updated_at) DESC, id DESC
        LIMIT 1
      `,
      [normalizedName, normalizedEmail],
    );
    const latestSubmissionId = Number(latestRows?.[0]?.id || 0);

    if (!Number.isInteger(latestSubmissionId) || latestSubmissionId <= 0) {
      return {
        id: 0,
        name: "",
        email: "",
        hasPassword: false,
        status: "submitted",
        examineeNo: "",
        hasPhoto: false,
        photoFileName: "",
        createdAt: "",
        updatedAt: "",
        answerItems: [],
        answerMap: {},
      };
    }

    return getApplicantSubmissionById(latestSubmissionId, { required: false });
  }

  async function migrateApplicantPhotoStorage() {
    const photoRows = await query(`
      SELECT
        s.id,
        s.field_key AS fieldKey,
        s.answer_data AS answerData,
        COALESCE(meta.examinee_no, '') AS examineeNo
      FROM app_subm s
      LEFT JOIN app_meta meta
        ON meta.id = s.id
      WHERE s.answer_data LIKE '%"hasPhoto"%'
      ORDER BY s.id ASC, s.field_key ASC
    `);
    let migratedCount = 0;

    for (const photoRow of Array.isArray(photoRows) ? photoRows : []) {
      const normalizedExamineeNo = String(photoRow?.examineeNo || "").trim();
      const storedPhotoValue = parseApplicantStoredPhotoAnswerData(photoRow?.answerData, {
        includeBase64: true,
      });
      const normalizedStoredPhotoValue = normalizeApplicantStoredPhotoValue(storedPhotoValue);

      if (normalizedStoredPhotoValue.hasPhoto !== true || !normalizedExamineeNo) {
        continue;
      }

      let photoBuffer = null;
      const normalizedBase64 = String(storedPhotoValue?.base64 || "").trim();

      if (normalizedBase64) {
        photoBuffer = Buffer.from(normalizedBase64, "base64");
      } else {
        const storedApplicantPhoto = await readStoredApplicantPhotoFile(
          photoRow?.id,
          normalizedExamineeNo,
          normalizedStoredPhotoValue.fileName,
          normalizedStoredPhotoValue.mimeType,
        );
        photoBuffer = storedApplicantPhoto?.photoBlob || (await readStoredPromotedPhotoFile(normalizedExamineeNo))?.photoBlob || null;
      }

      if (!Buffer.isBuffer(photoBuffer) || photoBuffer.length === 0) {
        continue;
      }

      const storedPhotoRecord = buildStoredApplicantPhotoRecord(normalizedExamineeNo, normalizedStoredPhotoValue, {
        photoBuffer,
      });

      if (storedPhotoRecord) {
        await persistApplicantPhotoFile(storedPhotoRecord);
      }

      await query(`UPDATE app_subm SET answer_data = ? WHERE id = ? AND field_key = ?`, [
        JSON.stringify(buildStoredApplicantPhotoAnswerData(storedPhotoRecord, normalizedStoredPhotoValue)),
        Number(photoRow?.id || 0),
        String(photoRow?.fieldKey || "").trim(),
      ]);
      migratedCount += 1;
    }

    return {
      migratedCount,
    };
  }

  async function migrateApplicantFileAnswerData() {
    const fileRows = await query(
      `
        SELECT
          s.id,
          s.field_key AS fieldKey,
          s.answer_data AS answerData
        FROM app_subm s
        INNER JOIN app_form ff ON ff.field_key = s.field_key
        WHERE ff.input_type = 'file'
          AND s.answer_data LIKE '%"originalFileName"%'
      `,
    );
    let migratedCount = 0;

    for (const fileRow of fileRows) {
      const normalizedStoredFileValue = normalizeApplicantStoredFileValue(parseApplicantStoredFileAnswerData(fileRow?.answerData));

      await query(`UPDATE app_subm SET answer_data = ? WHERE id = ? AND field_key = ?`, [
        JSON.stringify(normalizedStoredFileValue),
        Number(fileRow?.id || 0),
        String(fileRow?.fieldKey || "").trim(),
      ]);
      migratedCount += 1;
    }

    return {
      migratedCount,
    };
  }

  function normalizeApplicantAnswerValue(field, rawValue, applicantIdentity, existingSubmission = null) {
    try { return normalizeApplicantAnswerValueForField(field, rawValue, applicantIdentity, existingSubmission); }
    catch (error) { error.fieldKey = field.fieldKey; throw error; }
  }

  function normalizeApplicantAnswerValueForField(field, rawValue, applicantIdentity, existingSubmission = null) {
    if (!field || !field.fieldKey) {
      return "";
    }

    if (field.systemFieldKey === "name") {
      return applicantIdentity.name;
    }

    if (field.inputType === "photo") {
      const nextPhotoPayload = normalizeApplicantPhotoPayload(rawValue);

      if (nextPhotoPayload) {
        const normalizedStoredPhotoValue = normalizeApplicantStoredPhotoValue(nextPhotoPayload);

        return {
          ...normalizedStoredPhotoValue,
          base64: nextPhotoPayload.base64,
        };
      }

      if (existingSubmission?.internalPhotoValue?.hasPhoto) {
        return {
          hasPhoto: true,
          fileName: existingSubmission.internalPhotoValue.fileName,
          mimeType: existingSubmission.internalPhotoValue.mimeType,
        };
      }

      if (field.required) {
        throw createHttpError(400, `${field.questionText} 파일을 업로드하세요.`, "APPLICANT_PHOTO_REQUIRED");
      }

      return {
        hasPhoto: false,
        fileName: "",
        mimeType: "",
      };
    }

    if (field.inputType === "file") {
      const nextFilePayload = normalizeApplicantFilePayload(rawValue);

      if (nextFilePayload) {
        if (!isAllowedUploadExtension(nextFilePayload.fileName, field.allowedExtensions)) {
          throw createHttpError(400, `${field.questionText}: ${field.allowedExtensions.join(", ")} 파일만 업로드할 수 있습니다.`, "APPLICANT_FILE_EXTENSION_INVALID");
        }
        const normalizedStoredFileValue = normalizeApplicantStoredFileValue(nextFilePayload);

        return {
          ...normalizedStoredFileValue,
          base64: nextFilePayload.base64,
        };
      }

      const existingFileValue = getExistingApplicantUploadAnswerValue(existingSubmission, field.fieldKey, "file");

      if (existingFileValue?.hasFile) {
        return existingFileValue;
      }

      if (field.required) {
        throw createHttpError(400, `${field.questionText} 파일을 업로드하세요.`, "APPLICANT_FILE_REQUIRED");
      }

      return {
        hasFile: false,
        fileName: "",
        mimeType: "",
      };
    }

    if (field.inputType === "date" || field.inputType === "birthdate") {
      return normalizeApplicantDate(rawValue, field.questionText, {
        required: field.required,
      });
    }

    if (field.inputType === "time") {
      return normalizeApplicantTime(rawValue, field.questionText, {
        required: field.required,
      });
    }

    if (field.inputType === "phone") {
      return normalizeApplicantPhone(rawValue, field.questionText, {
        required: field.required,
      });
    }

    if (field.inputType === "nationality") {
      return normalizeApplicantNationality(rawValue, field.questionText, {
        required: field.required,
      });
    }

    if (field.inputType === "multiselect") {
      try { return applicantFormConfig.validateMultiSelectAnswer(field, rawValue, field.questionText); }
      catch (error) { throw createHttpError(400, error.message, "APPLICANT_SELECT_VALUE_INVALID"); }
    }

    if (field.inputType === "select") {
      const normalizedValue = normalizeApplicantText(rawValue, field.questionText, {
        required: field.required,
        maxLength: 255,
      });

      if (normalizedValue && !field.options.includes(normalizedValue) && field.allowCustomOption !== true) {
        throw createHttpError(400, `${field.questionText} 선택값이 올바르지 않습니다.`, "APPLICANT_SELECT_VALUE_INVALID");
      }

      return normalizedValue;
    }

    return normalizeApplicantText(rawValue, field.questionText, {
      required: field.required,
      maxLength: field.inputType === "textarea" ? 1000 : 255,
    });
  }

  function buildApplicantSubmissionArtifacts(fields = [], answers = {}, applicantIdentity = {}, existingSubmission = null, options = {}) {
    const normalizedFields = Array.isArray(fields) ? fields : [];
    const normalizedAnswers = answers && typeof answers === "object" ? { ...answers } : {};
    const normalizedRecruitmentSelection =
      options.recruitmentSelection && typeof options.recruitmentSelection === "object" ? options.recruitmentSelection : {};
    const normalizedRecruitmentUnits = Array.isArray(options.recruitmentUnits) ? options.recruitmentUnits : [];
    const answerItems = [];
    const answerRows = [];
    const handledSelectionKeys = new Set();
    const fileUploads = [];
    let photoUpload = null;

    normalizedFields.forEach((field) => {
      const syntheticSelectionField = getApplicantRecruitmentSelectionFieldBySystemFieldKey(field?.systemFieldKey || "");

      if (!syntheticSelectionField) {
        return;
      }

      const selectedValue = String(normalizedRecruitmentSelection[syntheticSelectionField.key] || "").trim();

      if (selectedValue) {
        normalizedAnswers[field.fieldKey] = selectedValue;
        handledSelectionKeys.add(syntheticSelectionField.key);
      }
    });

    normalizedFields.forEach((field) => {
      const syntheticSelectionField = getApplicantRecruitmentSelectionFieldBySystemFieldKey(field?.systemFieldKey || "");
      const selectedRecruitmentValue = syntheticSelectionField ? String(normalizedRecruitmentSelection[syntheticSelectionField.key] || "").trim() : "";
      const selectableRecruitmentOptions = syntheticSelectionField
        ? getApplicantRecruitmentSelectionOptions(normalizedRecruitmentUnits, normalizedRecruitmentSelection, syntheticSelectionField)
        : [];
      const normalizedValue = selectedRecruitmentValue
        ? normalizeApplicantText(selectedRecruitmentValue, field.questionText, {
            required: field.required,
            maxLength: 255,
          })
        : syntheticSelectionField && selectableRecruitmentOptions.length === 0
          ? ""
        : normalizeApplicantAnswerValue(field, normalizedAnswers[field.fieldKey], applicantIdentity, existingSubmission);

      if (field.inputType === "photo") {
        const normalizedPhotoValue = normalizeApplicantStoredPhotoValue(normalizedValue);

        answerItems.push({
          fieldKey: field.fieldKey,
          questionText: field.questionText,
          questionTextEn: field.questionTextEn || "",
          inputType: field.inputType,
          systemFieldKey: field.systemFieldKey,
          value: {
            fileName: normalizedPhotoValue.fileName,
            mimeType: normalizedPhotoValue.mimeType,
            hasPhoto: normalizedPhotoValue.hasPhoto === true,
          },
        });
        answerRows.push({
          fieldKey: field.fieldKey,
          answerData: JSON.stringify(normalizedPhotoValue),
        });

        if (!photoUpload && normalizedPhotoValue.hasPhoto === true && String(normalizedValue?.base64 || "").trim()) {
          photoUpload = {
            fieldKey: field.fieldKey,
            ...normalizedPhotoValue,
            base64: String(normalizedValue.base64 || "").trim(),
          };
        }

        return;
      }

      if (field.inputType === "file") {
        const normalizedFileValue = normalizeApplicantStoredFileValue(normalizedValue);

        answerItems.push({
          fieldKey: field.fieldKey,
          questionText: field.questionText,
          questionTextEn: field.questionTextEn || "",
          inputType: field.inputType,
          systemFieldKey: field.systemFieldKey,
          value: {
            fileName: normalizedFileValue.fileName,
            mimeType: normalizedFileValue.mimeType,
            hasFile: normalizedFileValue.hasFile === true,
          },
        });
        answerRows.push({
          fieldKey: field.fieldKey,
          answerData: JSON.stringify(normalizedFileValue),
        });

        if (normalizedFileValue.hasFile === true && String(normalizedValue?.base64 || "").trim()) {
          fileUploads.push({
            fieldKey: field.fieldKey,
            questionText: field.questionText,
            questionTextEn: field.questionTextEn || "",
            fileNamePattern: field.fileNamePattern,
            allowedExtensions: field.allowedExtensions,
            ...normalizedFileValue,
            base64: String(normalizedValue.base64 || "").trim(),
          });
        }

        return;
      }

      answerItems.push({
        fieldKey: field.fieldKey,
        questionText: field.questionText,
        questionTextEn: field.questionTextEn || "",
        inputType: field.inputType,
          systemFieldKey: field.systemFieldKey,
          value: normalizedValue,
      });
      answerRows.push({
        fieldKey: field.fieldKey,
        answerData: field.inputType === "multiselect" ? JSON.stringify(normalizedValue) : String(normalizedValue ?? "").trim(),
      });
    });

    APPLICANT_RECRUITMENT_SELECTION_FIELDS.forEach((definition) => {
      const selectedValue = String(normalizedRecruitmentSelection[definition.key] || "").trim();

      if (!selectedValue || handledSelectionKeys.has(definition.key)) {
        return;
      }

      answerItems.push({
        fieldKey: definition.fieldKey,
        questionText: definition.questionText,
        inputType: "text",
        systemFieldKey: definition.systemFieldKey,
        value: selectedValue,
      });
      answerRows.push({
        fieldKey: definition.fieldKey,
        answerData: selectedValue,
      });
    });

    return {
      answerItems,
      answerRows,
      fileUploads,
      photoUpload,
    };
  }

  function buildApplicantSystemRecord(submission = {}) {
    const systemValues = {
      name: submission.name || "",
      birth: "",
      nationality: "",
      track: "",
      admission: "",
      series: "",
      unit: "",
      major: "",
      admissionCode: "",
      seriesCode: "",
      unitCode: "",
      majorCode: "",
    };

    normalizeStoredAnswerItems(submission.answerItems).forEach((answerItem) => {
      if (answerItem.inputType === "nationality" && !systemValues.nationality) {
        systemValues.nationality = String(answerItem.value || "").trim();
      }

      if (!answerItem.systemFieldKey || answerItem.systemFieldKey === "photo" || answerItem.inputType === "file") {
        return;
      }

      if (Object.hasOwn(systemValues, answerItem.systemFieldKey)) {
        systemValues[answerItem.systemFieldKey] = String(answerItem.value || "").trim();
      }
    });

    const fieldOverrides = normalizeStoredTicketOverrides(
      submission?.fieldOverridesJson || submission?.fieldOverrides || null,
    );

    Object.keys(fieldOverrides).forEach((key) => {
      systemValues[key] = String(fieldOverrides[key] || "").trim();
    });

    return systemValues;
  }

  async function buildApplicantAdmitCardRecordFromSubmission(submission = {}, { includePhoto = true } = {}) {
    const normalizedSubmissionId = Number(submission?.id || 0);
    const applicationRecord = buildApplicantSystemRecord(submission);
    let photoRecord = null;

    if (includePhoto && normalizedSubmissionId > 0) {
      try {
        photoRecord = await getApplicantSubmissionPhoto(normalizedSubmissionId);
      } catch (error) {
        if (error?.errorCode !== "APPLICANT_SUBMISSION_PHOTO_NOT_FOUND") {
          throw error;
        }
      }
    }

    return {
      ...applicationRecord,
      submissionId: normalizedSubmissionId,
      hasPhoto: submission.hasPhoto,
      photoVersion: Date.parse(submission.updatedAt) || 0,
      track: String(applicationRecord.track || "").trim(),
      admission: String(applicationRecord.admission || "").trim(),
      series: String(applicationRecord.series || "").trim(),
      unit: String(applicationRecord.unit || "").trim(),
      major: String(applicationRecord.major || "").trim(),
      examineeNo: String(submission?.examineeNo || "").trim(),
      name: String(applicationRecord.name || submission?.name || "").trim(),
      birth: String(applicationRecord.birth || "").trim(),
      photoBlob: photoRecord?.photoBlob || null,
      photoMime: String(photoRecord?.photoMime || "").trim(),
      photoName: String(photoRecord?.photoName || "").trim(),
    };
  }

  function resolveApplicantRecruitmentUnit(recruitmentUnits = [], applicationRecord = {}) {
    const normalizedTrackName = String(applicationRecord.track || "").trim();
    const normalizedAdmissionName = String(applicationRecord.admission || "").trim();
    const normalizedSeriesName = String(applicationRecord.series || "").trim();
    const normalizedUnitName = String(applicationRecord.unit || "").trim();
    const normalizedMajorName = String(applicationRecord.major || "").trim();
    const candidateUnits = (Array.isArray(recruitmentUnits) ? recruitmentUnits : []).filter(
      (unit) =>
        unit.trackName === normalizedTrackName &&
        unit.admissionName === normalizedAdmissionName &&
        unit.seriesName === normalizedSeriesName &&
        unit.unitName === normalizedUnitName,
    );

    if (candidateUnits.length === 0) {
      return null;
    }

    return (
      candidateUnits.find((unit) => unit.majorName === normalizedMajorName) ||
      candidateUnits.find((unit) => !String(unit.majorName || "").trim()) ||
      (candidateUnits.length === 1 ? candidateUnits[0] : null)
    );
  }

  function resolveApplicantExamNoPattern(pattern = "", recruitmentUnit = null) {
    const normalizedPattern = ensureApplicantExamNoPattern(pattern || defaultApplicantExamNoPattern);

    if (APPLICANT_EXAM_NO_CODE_TOKEN_PATTERN.test(normalizedPattern)) {
      return normalizedPattern;
    }

    if (recruitmentUnit && normalizedPattern === defaultApplicantExamNoPattern) {
      return APPLICANT_DEFAULT_RECRUITMENT_EXAM_NO_PATTERN;
    }

    return normalizedPattern;
  }

  function resolveApplicantExamNoComponentValue(componentKey = "", applicationRecord = {}, recruitmentUnit = null) {
    const normalizedComponentKey = String(componentKey || "").trim();

    if (normalizedComponentKey === "admissionCode") {
      const value = String(recruitmentUnit?.admissionCode || "").trim();

      if (!value) {
        throw createHttpError(400, "수험번호 생성을 위해 일치하는 전형코드가 필요합니다.", "APPLICANT_EXAM_NO_ADMISSION_CODE_REQUIRED");
      }

      return value;
    }

    if (normalizedComponentKey === "seriesCode") {
      const value = String(recruitmentUnit?.seriesCode || "").trim();

      if (!value) {
        throw createHttpError(400, "수험번호 생성을 위해 일치하는 계열코드가 필요합니다.", "APPLICANT_EXAM_NO_SERIES_CODE_REQUIRED");
      }

      return value;
    }

    if (normalizedComponentKey === "unitCode") {
      const value = String(recruitmentUnit?.unitCode || "").trim();

      if (!value) {
        throw createHttpError(400, "수험번호 생성을 위해 일치하는 모집단위코드가 필요합니다.", "APPLICANT_EXAM_NO_UNIT_CODE_REQUIRED");
      }

      return value;
    }

    if (normalizedComponentKey === "nationalityCode") {
      const nationalityOption =
        typeof findApplicantNationalityOption === "function"
          ? findApplicantNationalityOption(String(applicationRecord.nationality || "").trim())
          : null;
      const value = String(nationalityOption?.code || "").trim();

      if (!value) {
        throw createHttpError(400, "수험번호 생성을 위해 국적코드가 필요합니다.", "APPLICANT_EXAM_NO_NATIONALITY_CODE_REQUIRED");
      }

      return value;
    }

    return "";
  }

  function buildApplicantExamNoFromComponents(settings = {}, applicationRecord = {}, recruitmentUnit = null, sequence = 1) {
    const components = normalizeApplicantExamNoComponents(settings.components ?? APPLICANT_DEFAULT_EXAM_NO_COMPONENTS);
    const digitCount = normalizeApplicantExamNoDigitCount(settings.digitCount ?? APPLICANT_DEFAULT_EXAM_NO_DIGIT_COUNT);
    const fixedValues = components.map((componentKey) => {
      if (!componentKey || componentKey === "sequence") {
        return "";
      }

      return resolveApplicantExamNoComponentValue(componentKey, applicationRecord, recruitmentUnit);
    });
    const fixedLength = fixedValues.reduce((total, value) => total + value.length, 0);

    if (fixedLength >= digitCount) {
      throw createHttpError(
        400,
        `수험번호 자리수 ${digitCount}자 안에 선택한 코드 조합이 들어가지 않습니다. 자리수를 늘리거나 구성 요소를 조정하세요.`,
        "APPLICANT_EXAM_NO_DIGIT_COUNT_TOO_SHORT",
      );
    }

    const sequenceDigits = digitCount - fixedLength;
    const sequenceText = String(sequence);

    if (sequenceText.length > sequenceDigits) {
      throw createHttpError(500, "수험번호 순번 자릿수가 부족해 더 이상 수험번호를 생성할 수 없습니다.", "APPLICANT_EXAM_NO_SEQUENCE_OVERFLOW");
    }

    const paddedSequence = sequenceText.padStart(sequenceDigits, "0");

    return components
      .map((componentKey, index) => {
        if (!componentKey) {
          return "";
        }

        if (componentKey === "sequence") {
          return paddedSequence;
        }

        return fixedValues[index];
      })
      .join("");
  }

  function buildApplicantExamNoCandidate(pattern, sourceDate, sequence, recruitmentUnit = null) {
    const year = String(sourceDate.getFullYear());
    const shortYear = year.slice(-2);
    const month = String(sourceDate.getMonth() + 1).padStart(2, "0");
    const day = String(sourceDate.getDate()).padStart(2, "0");
    const sequenceMatch = /\{SEQ(?::(\d{1,2}))?\}/.exec(pattern);
    const sequencePadding = Math.max(1, Number(sequenceMatch?.[1] || 1));
    const sequenceValue = String(sequence).padStart(sequencePadding, "0");

    return pattern
      .replaceAll("{YYYY}", year)
      .replaceAll("{YY}", shortYear)
      .replaceAll("{MM}", month)
      .replaceAll("{DD}", day)
      .replaceAll("{ADMISSION_CODE}", String(recruitmentUnit?.admissionCode || "").trim())
      .replaceAll("{SERIES_CODE}", String(recruitmentUnit?.seriesCode || "").trim())
      .replaceAll("{UNIT_CODE}", String(recruitmentUnit?.unitCode || "").trim())
      .replace(/\{SEQ(?::\d{1,2})?\}/g, sequenceValue);
  }

  async function generateApplicantExamineeNo(connection, settings = {}, applicationRecord = {}, options = {}) {
    const recruitmentUnits = Array.isArray(options.recruitmentUnits)
      ? options.recruitmentUnits
      : await getApplicantRecruitmentUnits({
          queryable: connection.query.bind(connection),
        });
    const matchedRecruitmentUnit = options.matchedRecruitmentUnit || resolveApplicantRecruitmentUnit(recruitmentUnits, applicationRecord);
    const selectedComponents = Array.isArray(settings.components) ? settings.components.filter(Boolean) : [];
    const hasStructuredSettings = selectedComponents.length > 0;
    const pattern = resolveApplicantExamNoPattern(settings.examNoPattern || defaultApplicantExamNoPattern, matchedRecruitmentUnit);
    const requiresRecruitmentUnit =
      selectedComponents.some((componentKey) => ["admissionCode", "seriesCode", "unitCode"].includes(componentKey)) ||
      APPLICANT_EXAM_NO_CODE_TOKEN_PATTERN.test(pattern);
    const sequenceStart = normalizeApplicantSequenceStart(settings.examNoSequenceStart || defaultApplicantExamNoSequenceStart);
    const sourceDate = new Date();

    if (requiresRecruitmentUnit && !matchedRecruitmentUnit) {
      throw createHttpError(
        400,
        "전형 관리에서 접수 데이터와 일치하는 모집시기/전형/계열/모집단위/전공을 먼저 등록하세요.",
        "APPLICANT_RECRUITMENT_UNIT_MATCH_NOT_FOUND",
      );
    }

    for (let sequence = sequenceStart; sequence < sequenceStart + 500000; sequence += 1) {
      const candidateValue = hasStructuredSettings
        ? buildApplicantExamNoFromComponents(settings, applicationRecord, matchedRecruitmentUnit, sequence)
        : buildApplicantExamNoCandidate(pattern, sourceDate, sequence, matchedRecruitmentUnit);
      const [rows] = await connection.query(
        `
          SELECT examinee_no FROM app_meta WHERE examinee_no = ? LIMIT 1
        `,
        [candidateValue],
      );

      if (rows.length === 0) {
        return candidateValue;
      }
    }

    throw createHttpError(500, "사용 가능한 수험번호를 생성하지 못했습니다.", "APPLICANT_EXAM_NO_GENERATION_FAILED");
  }

  async function prepareApplicantSubmissionExamNo(connection, submission = {}, settings = {}, options = {}) {
    const applicationRecord = buildApplicantSystemRecord(submission);
    if (!submission.examineeNo && settings.components?.includes('nationalityCode') && !applicationRecord.nationality && submission.memberId) {
      const [rows] = await connection.query(`
        SELECT member.profile_json AS profileJson, settings.setting_value AS signupSettingsJson
        FROM applicant_members member
        LEFT JOIN system_set settings ON settings.setting_key = 'applicantSignupSettings'
        WHERE member.id = ?
      `, [submission.memberId]);
      const profile = JSON.parse(rows[0]?.profileJson || '{}');
      const signupSettings = JSON.parse(rows[0]?.signupSettingsJson || '{}');
      const questions = signupSettings.questions || signupSettings.extraFields || [];
      const values = questions.filter(question => question.inputType === 'nationality').map(question => profile[question.key]);
      // Older signup settings may have stored the standard nationality key directly.
      values.push(profile.nationality);
      applicationRecord.nationality = values.map(value => typeof value === 'string' ? findApplicantNationalityOption(value) : null).find(Boolean)?.code || '';
    }
    const recruitmentUnits = await getApplicantRecruitmentUnits({
      queryable: connection.query.bind(connection),
    });
    const recruitmentUnit = resolveApplicantRecruitmentUnit(recruitmentUnits, applicationRecord);
    const examineeNo =
      submission.examineeNo ||
      (await generateApplicantExamineeNo(connection, settings, applicationRecord, {
        recruitmentUnits,
        matchedRecruitmentUnit: recruitmentUnit,
      }));
    const uploadedPhotoValue = options.uploadedPhotoValue && typeof options.uploadedPhotoValue === "object" ? options.uploadedPhotoValue : null;
    const uploadedFileUploads = Array.isArray(options.uploadedFileUploads) ? options.uploadedFileUploads : [];
    const resolvedPhotoValue = uploadedPhotoValue || submission?.internalPhotoValue || null;
    const applicantPhotoRecord = buildStoredApplicantPhotoRecord(examineeNo, resolvedPhotoValue);

    const applicantFileRecords = uploadedFileUploads
      .map((fileUpload) => buildStoredApplicantFileRecord(examineeNo, fileUpload?.questionText, fileUpload?.fieldKey, fileUpload, fileUpload))
      .filter(Boolean);
    const applicantFileValuesByFieldKey = applicantFileRecords.reduce((fieldMap, storedFileRecord) => {
      fieldMap[String(storedFileRecord.fieldKey || "").trim()] = buildStoredApplicantFileAnswerData(storedFileRecord);
      return fieldMap;
    }, {});

    return {
      applicationRecord,
      examineeNo,
      recruitmentUnit,
      applicantFileRecords,
      applicantFileValuesByFieldKey,
      applicantPhotoFieldKey: String(uploadedPhotoValue?.fieldKey || "").trim(),
      applicantPhotoRecord,
      applicantPhotoValue:
        uploadedPhotoValue && applicantPhotoRecord ? buildStoredApplicantPhotoAnswerData(applicantPhotoRecord, uploadedPhotoValue) : null,

    };
  }

  async function applyPreparedApplicantUploadAnswerRows(connection, submissionId, preparedRecord = {}) {
    const normalizedSubmissionId = Number(submissionId);

    if (!Number.isInteger(normalizedSubmissionId) || normalizedSubmissionId <= 0) {
      return;
    }

    const queryable = typeof connection?.query === "function" ? connection.query.bind(connection) : query;
    const updateTasks = [];
    const applicantPhotoFieldKey = String(preparedRecord?.applicantPhotoFieldKey || "").trim();

    if (applicantPhotoFieldKey && preparedRecord?.applicantPhotoValue) {
      updateTasks.push(
        queryable(
          `
            UPDATE app_subm
            SET
              answer_data = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND field_key = ?
          `,
          [JSON.stringify(preparedRecord.applicantPhotoValue), normalizedSubmissionId, applicantPhotoFieldKey],
        ),
      );
    }

    Object.entries(preparedRecord?.applicantFileValuesByFieldKey || {}).forEach(([fieldKey, fileValue]) => {
      const normalizedFieldKey = String(fieldKey || "").trim();

      if (!normalizedFieldKey || !fileValue) {
        return;
      }

      updateTasks.push(
        queryable(
          `
            UPDATE app_subm
            SET
              answer_data = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND field_key = ?
          `,
          [JSON.stringify(fileValue), normalizedSubmissionId, normalizedFieldKey],
        ),
      );
    });

    if (updateTasks.length === 0) {
      return;
    }

    await Promise.all(updateTasks);
  }

  async function sendApplicantVerificationCode(payload = {}) {
    await assertApplicantSubmissionEntryIsOpen();

    const applicantName = normalizeApplicantText(payload.name, "이름", { maxLength: 100 });
    const email = normalizeApplicantEmail(payload.email);
    const codeValue = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + emailVerificationTtlMs);
    const insertResult = await query(
      `
        INSERT INTO app_email_log (
          applicant_name,
          email,
          code_value,
          expires_at,
          delivery_status
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [applicantName, email, codeValue, expiresAt, APPLICANT_EMAIL_DELIVERY_STATUSES.PENDING],
    );
    const verificationLogId = Math.max(0, Number(insertResult?.insertId || 0));

    try {
      const sendResult = await dispatchVerificationEmail({
        applicantName,
        codeValue,
        email,
        expiresAt,
      });
      const deliveryMode = String(sendResult?.deliveryMode || "smtp").trim() || "smtp";
      const deliveryStatus = normalizeApplicantEmailDeliveryStatus(
        sendResult?.deliveryStatus || APPLICANT_EMAIL_DELIVERY_STATUSES.SENT,
      );
      const messageId = String(sendResult?.messageId || "").trim().slice(0, 255);

      if (deliveryStatus !== APPLICANT_EMAIL_DELIVERY_STATUSES.SENT) {
        throw createHttpError(
          502,
          "인증 메일을 발송하지 못했습니다. 잠시 후 다시 시도하세요.",
          "APPLICANT_VERIFICATION_EMAIL_SEND_FAILED",
        );
      }

      if (verificationLogId > 0) {
        await query(
          `
            UPDATE app_email_log
            SET
              delivery_status = ?,
              delivery_message_id = ?,
              sent_at = CASE WHEN ? = ? THEN NOW() ELSE sent_at END,
              failed_at = CASE WHEN ? = ? THEN NOW() ELSE NULL END,
              delivery_error = ''
            WHERE id = ?
          `,
          [
            deliveryStatus,
            messageId || null,
            deliveryStatus,
            APPLICANT_EMAIL_DELIVERY_STATUSES.SENT,
            deliveryStatus,
            APPLICANT_EMAIL_DELIVERY_STATUSES.FAILED,
            verificationLogId,
          ],
        );
      }

      return {
        ok: true,
        expiresInSeconds: Math.round(emailVerificationTtlMs / 1000),
        deliveryMode,
        ...(sendResult?.debugCode ? { debugCode: String(sendResult.debugCode) } : {}),
      };
    } catch (error) {
      const normalizedError =
        error?.statusCode && error?.errorCode
          ? error
          : createHttpError(
              error?.statusCode || 502,
              String(error?.message || "인증 메일을 발송하지 못했습니다. 잠시 후 다시 시도하세요."),
              String(error?.errorCode || "APPLICANT_VERIFICATION_EMAIL_SEND_FAILED"),
            );

      if (verificationLogId > 0) {
        await query(
          `
            UPDATE app_email_log
            SET
              delivery_status = ?,
              failed_at = NOW(),
              delivery_error = ?
            WHERE id = ?
          `,
          [
            APPLICANT_EMAIL_DELIVERY_STATUSES.FAILED,
            String(normalizedError.message || "인증 메일 발송 실패").trim().slice(0, 500),
            verificationLogId,
          ],
        ).catch(() => {});
      }

      throw normalizedError;
    }
  }

  async function verifyApplicantVerificationCode(payload = {}) {
    await assertApplicantSubmissionEntryIsOpen();
    const applicantName = normalizeApplicantText(payload.name, "이름", { maxLength: 100 });
    const email = normalizeApplicantEmail(payload.email);
    const codeValue = normalizeApplicantText(payload.code, "인증 코드", {
      maxLength: 12,
      errorCode: "APPLICANT_VERIFICATION_CODE_REQUIRED",
    });
    const rows = await query(
      `
        SELECT
          id,
          applicant_name AS applicantName,
          email,
          code_value AS codeValue,
          expires_at AS expiresAt,
          verified_at AS verifiedAt,
          delivery_status AS deliveryStatus
        FROM app_email_log
        WHERE applicant_name = ?
          AND email = ?
          AND delivery_status = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [applicantName, email, APPLICANT_EMAIL_DELIVERY_STATUSES.SENT],
    );
    const latestVerification = rows[0];

    if (!latestVerification) {
      throw createHttpError(404, "생성된 인증 코드를 찾을 수 없습니다. 인증 코드를 다시 생성하세요.", "APPLICANT_VERIFICATION_NOT_FOUND");
    }

    if (latestVerification.verifiedAt) {
      throw createHttpError(409, "이미 사용된 인증 코드입니다. 새 코드를 발급받으세요.", "APPLICANT_VERIFICATION_ALREADY_USED");
    }

    const expiresAtTime = new Date(latestVerification.expiresAt).getTime();

    if (!Number.isFinite(expiresAtTime) || expiresAtTime < Date.now()) {
      throw createHttpError(410, "인증 코드가 만료되었습니다. 새 코드를 발급받으세요.", "APPLICANT_VERIFICATION_EXPIRED");
    }

    if (String(latestVerification.codeValue || "").trim() !== codeValue) {
      throw createHttpError(400, "인증 코드가 일치하지 않습니다.", "APPLICANT_VERIFICATION_CODE_MISMATCH");
    }

    await query(`UPDATE app_email_log SET verified_at = NOW() WHERE id = ?`, [latestVerification.id]);

    const accessToken = createPublicAccessToken({
      type: APPLICANT_PUBLIC_ACCESS_TYPES.verified,
      name: applicantName,
      email,
    });
    const latestSubmission = await getLatestApplicantSubmissionByApplicant(applicantName, email);

    return {
      verified: true,
      accessToken,
      submission: latestSubmission.id ? latestSubmission : null,
    };
  }

  async function lookupApplicantSubmission(payload = {}) {
    const lookupTarget = normalizeApplicantPublicLookupTarget(payload.lookupTarget);
    const applicantName = normalizeApplicantText(payload.name, "이름", { maxLength: 100 });
    const email = normalizeApplicantEmail(payload.email);
    const password = String(payload.password ?? "");
    const latestSubmission = await getLatestApplicantSubmissionByApplicant(applicantName, email);

    if (!latestSubmission.id) {
      throw createHttpError(404, "일치하는 접수 이력을 찾을 수 없습니다.", "APPLICANT_LOOKUP_NOT_FOUND");
    }

    if (!password.trim()) {
      throw createHttpError(400, "비밀번호를 입력하세요.", "APPLICANT_LOOKUP_PASSWORD_REQUIRED");
    }

    const lookupTargetSubmission = await getApplicantSubmissionById(latestSubmission.id, {
      includeInternal: true,
    });

    if (!lookupTargetSubmission.hasPassword || !verifyPassword(password, lookupTargetSubmission.passwordHash)) {
      throw createHttpError(401, "비밀번호가 일치하지 않습니다.", "APPLICANT_LOOKUP_PASSWORD_INVALID");
    }

    if (lookupTarget === APPLICANT_PUBLIC_LOOKUP_TARGETS.ticket) {
      await assertApplicantAdmitCardLookupIsOpen(lookupTargetSubmission);
    }

    const accessToken = createPublicAccessToken({
      type: APPLICANT_PUBLIC_ACCESS_TYPES.lookup,
      lookupTarget,
      name: applicantName,
      email,
      submissionId: latestSubmission.id,
    });

    return {
      accessToken,
      submission: latestSubmission,
    };
  }

  async function saveApplicantSubmission(payload = {}) {
    const accessRecord = getPublicAccessRecordOrThrow(payload.accessToken, [
      APPLICANT_PUBLIC_ACCESS_TYPES.lookup,
      APPLICANT_PUBLIC_ACCESS_TYPES.verified,
    ]);
    if (accessRecord.memberId && accessRecord.submissionId) {
      throw createHttpError(409, "이미 접수가 완료된 계정입니다. 접수는 계정당 한 번만 가능합니다.", "APPLICANT_ALREADY_SUBMITTED");
    }
    const applicantName = normalizeApplicantText(accessRecord.name, "이름", { maxLength: 100 });
    const email = normalizeApplicantEmail(accessRecord.email);
    const recruitmentUnits = await getApplicantRecruitmentUnits();
    const normalizedRecruitmentSelection = normalizeApplicantRecruitmentSelection(payload.selectionAnswers, recruitmentUnits);
    const schedule = findApplicantScheduleRecord(await getApplicantSchedules(), normalizedRecruitmentSelection.selection);
    const templateId = await formTemplates.resolve('application', schedule?.applicationTemplateId);
    const formFields = await getApplicantFormFields({ activeOnly: true, formScope: 'application', templateId });
    const allowedFieldKeys = new Set(formFields.map(field => field.fieldKey));
    if (Object.keys(payload.answers || {}).some(key => !allowedFieldKeys.has(key))) {
      throw createHttpError(400, '선택한 전형의 원서접수 질문만 저장할 수 있습니다.', 'APPLICATION_ANSWER_SCOPE_INVALID');
    }

    if (formFields.length === 0) {
      throw createHttpError(409, "관리자가 접수 양식을 아직 설정하지 않았습니다.", "APPLICANT_FORM_NOT_CONFIGURED");
    }

    let existingSubmission = null;
    const requestedSubmissionId = Number(payload.submissionId || accessRecord.submissionId || 0);

    if (Number.isInteger(requestedSubmissionId) && requestedSubmissionId > 0) {
      existingSubmission = await getApplicantSubmissionById(requestedSubmissionId, { includeInternal: true });

      if (existingSubmission.name !== applicantName || existingSubmission.email !== email) {
        throw createHttpError(403, "해당 접수 이력에 접근할 수 없습니다.", "APPLICANT_SUBMISSION_FORBIDDEN");
      }
    } else if (!accessRecord.memberId) {
      const latestSubmission = await getLatestApplicantSubmissionByApplicant(applicantName, email);
      existingSubmission = latestSubmission.id ? await getApplicantSubmissionById(latestSubmission.id, { includeInternal: true }) : null;
    }

    await assertApplicantSubmissionEntryIsOpen(normalizedRecruitmentSelection.selection);
    const submissionArtifacts = buildApplicantSubmissionArtifacts(
      formFields,
      accessRecord.memberId && accessRecord.birthDate ? {
        ...payload.answers,
        ...Object.fromEntries(formFields.filter(field => field.systemFieldKey === 'birth' || field.inputType === 'birthdate').map(field => [field.fieldKey, accessRecord.birthDate])),
      } : payload.answers,
      { name: applicantName, email },
      existingSubmission,
      {
        recruitmentSelection: normalizedRecruitmentSelection.selection,
        recruitmentUnits,
      },
    );
    const passwordPayload = accessRecord.memberId
      ? { shouldUpdate: !existingSubmission?.passwordHash, value: existingSubmission?.passwordHash || hashPassword(randomUUID()) }
      : normalizeApplicantSubmissionPassword(payload.password, existingSubmission);
    const connection = await getPool().getConnection();

    try {
      await connection.beginTransaction();

      let submissionId = existingSubmission?.id || 0;
      if (accessRecord.memberId) {
        const [members] = await connection.query("SELECT id FROM applicant_members WHERE id = ? FOR UPDATE", [accessRecord.memberId]);
        if (!members.length) throw createHttpError(401, "다시 로그인해 주세요.");
        const [owned] = await connection.query("SELECT id FROM app_meta WHERE member_id = ? FOR UPDATE", [accessRecord.memberId]);
        if (owned.length) {
          throw createHttpError(409, "이미 접수가 완료된 계정입니다. 접수는 계정당 한 번만 가능합니다.", "APPLICANT_ALREADY_SUBMITTED");
        }
      }
      const queryable = connection.query.bind(connection);
      const createdAtValue = normalizeApplicantDateTimeValue(existingSubmission?.createdAt || new Date());
      const updatedAtValue = normalizeApplicantDateTimeValue(new Date());
      const passwordHashValue = passwordPayload.shouldUpdate
        ? passwordPayload.value
        : String(existingSubmission?.passwordHash || "").trim() || null;
      const submissionStatus = String(existingSubmission?.status || "submitted").trim() || "submitted";

      if (submissionId > 0) {
        await connection.query(`INSERT INTO app_meta (id) VALUES (?) ON DUPLICATE KEY UPDATE id = VALUES(id)`, [submissionId]);
        await connection.query(`DELETE FROM app_subm WHERE id = ? AND field_key NOT IN (SELECT field_key FROM app_form WHERE form_scope = 'documents')`, [submissionId]);
      } else {
        const [insertResult] = await connection.query(`INSERT INTO app_meta () VALUES ()`);
        submissionId = Number(insertResult?.insertId || 0);
      }

      if (!Number.isInteger(submissionId) || submissionId <= 0) {
        throw createHttpError(500, "접수 정보를 저장하지 못했습니다.", "APPLICANT_SUBMISSION_SAVE_FAILED");
      }
      if (accessRecord.memberId) {
        await connection.query("UPDATE app_meta SET member_id = ? WHERE id = ?", [accessRecord.memberId, submissionId]);
      }

      for (const answerRow of submissionArtifacts.answerRows) {
        await connection.query(
          `
            INSERT INTO app_subm (
              id,
              applicant_name,
              email,
              password_hash,
              status,
              field_key,
              answer_data,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            submissionId,
            applicantName,
            email,
            passwordHashValue,
            submissionStatus,
            answerRow.fieldKey,
            answerRow.answerData,
            createdAtValue,
            updatedAtValue,
          ],
        );
      }

      const savedSubmission = await getApplicantSubmissionById(submissionId, {
        queryable,
        includeInternal: true,
      });

      if (!savedSubmission?.id) {
        throw createHttpError(500, "접수 정보를 저장하지 못했습니다.", "APPLICANT_SUBMISSION_SAVE_FAILED");
      }

      const applicantSettings = await getApplicantSettings();
      const preparedSubmissionRecord = await prepareApplicantSubmissionExamNo(connection, savedSubmission, applicantSettings, {
        uploadedFileUploads: submissionArtifacts.fileUploads,
        uploadedPhotoValue: submissionArtifacts.photoUpload,
      });

      await applyPreparedApplicantUploadAnswerRows(connection, submissionId, preparedSubmissionRecord);

        await connection.query(
          `
            INSERT INTO app_meta (
              id,
              examinee_no
            )
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE
              examinee_no = VALUES(examinee_no)
          `,
          [submissionId, preparedSubmissionRecord.examineeNo],
        );

      await connection.commit();
      const persistTasks = [];

      if (preparedSubmissionRecord.applicantPhotoRecord) {
        persistTasks.push(persistApplicantPhotoFile(preparedSubmissionRecord.applicantPhotoRecord));
      }

      if (Array.isArray(preparedSubmissionRecord.applicantFileRecords) && preparedSubmissionRecord.applicantFileRecords.length > 0) {
        persistTasks.push(...preparedSubmissionRecord.applicantFileRecords.map((storedFileRecord) => persistApplicantFile(storedFileRecord)));
      }

      await Promise.all(persistTasks);
      return getApplicantSubmissionById(submissionId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function updateApplicantSubmissionPhoto(submissionId, payload = {}) {
    const normalizedSubmissionId = Number(submissionId);

    if (!Number.isInteger(normalizedSubmissionId) || normalizedSubmissionId <= 0) {
      throw createHttpError(400, "접수 이력 ID가 올바르지 않습니다.", "APPLICANT_SUBMISSION_ID_INVALID");
    }

    const normalizedPhotoPayload = normalizeApplicantPhotoPayload({
      base64: payload?.base64 || payload?.fileContentBase64,
      fileName: payload?.fileName,
      mimeType: payload?.mimeType,
    });

    if (!normalizedPhotoPayload) {
      throw createHttpError(400, "등록할 사진 파일 데이터가 없습니다.", "APPLICANT_PHOTO_REQUIRED");
    }

    const connection = await getPool().getConnection();

    try {
      await connection.beginTransaction();
      const queryable = connection.query.bind(connection);

      await connection.query(`INSERT INTO app_meta (id) VALUES (?) ON DUPLICATE KEY UPDATE id = VALUES(id)`, [normalizedSubmissionId]);

      const existingSubmission = await getApplicantSubmissionById(normalizedSubmissionId, {
        queryable,
        includeInternal: true,
        forUpdate: true,
      });
      const photoAnswerItem =
        (Array.isArray(existingSubmission?.answerItems) ? existingSubmission.answerItems : []).find((answerItem) => {
          const fieldKey = String(answerItem?.fieldKey || "").trim();
          const systemFieldKey = String(answerItem?.systemFieldKey || "").trim();
          return answerItem?.inputType === "photo" || systemFieldKey === "photo" || fieldKey === "photo";
        }) || null;

      if (!photoAnswerItem?.fieldKey) {
        throw createHttpError(400, "등록된 사진 항목을 찾을 수 없습니다.", "APPLICANT_SUBMISSION_PHOTO_FIELD_NOT_FOUND");
      }

      const savedSubmission = await getApplicantSubmissionById(normalizedSubmissionId, {
        queryable,
        includeInternal: true,
      });
      const applicantSettings = await getApplicantSettings();
      const preparedSubmissionRecord = await prepareApplicantSubmissionExamNo(connection, savedSubmission, applicantSettings, {
        uploadedPhotoValue: {
          fieldKey: photoAnswerItem.fieldKey,
          ...normalizedPhotoPayload,
        },
      });

      await applyPreparedApplicantUploadAnswerRows(connection, normalizedSubmissionId, preparedSubmissionRecord);

      await connection.query(
        `
          INSERT INTO app_meta (
            id,
            examinee_no
          )
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE
            examinee_no = VALUES(examinee_no)
        `,
        [normalizedSubmissionId, preparedSubmissionRecord.examineeNo],
      );

      await connection.commit();
      const persistTasks = [];

      if (preparedSubmissionRecord.applicantPhotoRecord) {
        persistTasks.push(persistApplicantPhotoFile(preparedSubmissionRecord.applicantPhotoRecord));
      }

      await Promise.all(persistTasks);
      return getApplicantSubmissionById(normalizedSubmissionId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function getApplicantSubmissionForAccessToken(accessToken, submissionId, options = {}) {
    const accessRecord = getPublicAccessRecordOrThrow(accessToken, [
      APPLICANT_PUBLIC_ACCESS_TYPES.lookup,
      APPLICANT_PUBLIC_ACCESS_TYPES.verified,
    ]);

    if (options.requireTicketLookupTarget === true) {
      if (accessRecord.type !== APPLICANT_PUBLIC_ACCESS_TYPES.lookup) {
        throw createHttpError(403, "수험표 조회 권한이 없습니다.", "APPLICANT_ADMIT_CARD_LOOKUP_FORBIDDEN");
      }

      if (normalizeApplicantPublicLookupTarget(accessRecord.lookupTarget) !== APPLICANT_PUBLIC_LOOKUP_TARGETS.ticket) {
        throw createHttpError(403, "접수결과 조회에서는 수험표를 열 수 없습니다.", "APPLICANT_ADMIT_CARD_LOOKUP_TARGET_INVALID");
      }
    }

    const resolvedSubmissionId = Number(submissionId || accessRecord.submissionId || 0);

    if (!Number.isInteger(resolvedSubmissionId) || resolvedSubmissionId <= 0) {
      throw createHttpError(400, "접수 이력 ID가 필요합니다.", "APPLICANT_SUBMISSION_ID_REQUIRED");
    }

    const submission = await getApplicantSubmissionById(resolvedSubmissionId);

    if (submission.name !== accessRecord.name || submission.email !== accessRecord.email) {
      throw createHttpError(403, "해당 접수 이력에 접근할 수 없습니다.", "APPLICANT_SUBMISSION_FORBIDDEN");
    }

    return submission;
  }

  async function buildApplicantAdmitCardPdfForAccessToken(accessToken, submissionId) {
    const submission = await getApplicantSubmissionForAccessToken(accessToken, submissionId, {requireTicketLookupTarget: true});
    await assertApplicantAdmitCardLookupIsOpen(submission);
    const record = await buildApplicantAdmitCardRecordFromSubmission(submission);
    return {pdfBuffer: await buildSubmissionAdmitCardPdfBuffer(record, {title: `${record.name || "수험표"} 수험표`}), fileNameBase: String(submission.examineeNo || submission.id)};
  }

  async function getMemberApplicationContext(member) {
    const [row] = await query("SELECT id FROM app_meta WHERE member_id = ?", [member.id]);
    const submission = row ? await getApplicantSubmissionById(row.id) : null;
    const accessToken = createPublicAccessToken({
      type: APPLICANT_PUBLIC_ACCESS_TYPES.lookup,
      lookupTarget: APPLICANT_PUBLIC_LOOKUP_TARGETS.ticket,
      memberId: member.id, name: member.name, email: member.email, birthDate: member.birthDate || member.profile?.birth || '',
      submissionId: submission?.id || 0,
    });
    const schedules = await getApplicantSchedules();
    const schedule = submission ? findApplicantScheduleRecord(schedules, buildApplicantSystemRecord(submission)) : null;
    const visible = type => submission ? applicantFormConfig.isApplicantScheduleEnabled(schedule, type)
      : !schedules.length || schedules.some(item => applicantFormConfig.isApplicantScheduleEnabled(item, type));
    const window = (start, end) => ({
      startAt: Number.isFinite(getApplicantScheduleTimestamp(start)) ? getApplicantScheduleTimestamp(start) : null,
      endAt: Number.isFinite(getApplicantScheduleTimestamp(end, { inclusiveEndMinute: true })) ? getApplicantScheduleTimestamp(end, { inclusiveEndMinute: true }) : null,
    });
    return { accessToken, submission, serverTime: Date.now(), menuVisibility: {
      apply: visible('submission'), documents: visible('documents'), 'document-status': visible('document-status'), ticket: visible('lookup'),
    }, menuWindows: {
      ticket: window(schedule?.admitCardLookupScheduleStartAt, schedule?.admitCardLookupScheduleEndAt),
      documents: window(schedule?.documentSubmissionScheduleStartAt, schedule?.documentSubmissionScheduleEndAt),
      "document-status": window(schedule?.documentReviewScheduleStartAt, schedule?.documentReviewScheduleEndAt),
    } };
  }

  async function getMemberDocumentStatus(member) {
    const { submission } = await getMemberApplicationContext(member);
    if (!submission?.id) throw createHttpError(409, '접수 완료 후 이용할 수 있습니다.');
    const schedule = findApplicantScheduleRecord(await getApplicantSchedules(), buildApplicantSystemRecord(submission));
    if (!applicantFormConfig.getApplicantDocumentReviewScheduleState(schedule).isOpen) {
      throw createHttpError(409, '현재는 서류 제출 확인 기간이 아닙니다.', 'DOCUMENT_REVIEW_SCHEDULE_CLOSED');
    }
    const result = await documentStatusService.detail(submission.id);
    return { documents: result.documents };
  }

  async function getDocumentTemplateContext() {
    const [schedules, templates] = await Promise.all([getApplicantSchedules(), formTemplates.list()]);
    return { schedules, defaultId: templates.find(item => item.formScope === 'documents' && item.isDefault)?.id };
  }

  async function getDocumentFieldsForSubmission(submission, configuredFields = null, context = null) {
    context ||= await getDocumentTemplateContext();
    const schedule = findApplicantScheduleRecord(context.schedules, buildApplicantSystemRecord(submission));
    const templateId = schedule?.documentTemplateId || context.defaultId;
    const fields = configuredFields || await getApplicantFormFields({ activeOnly: true, formScope: 'documents', templateId });
    return fields.filter(field => field.templateId === templateId);
  }

  async function saveMemberDocuments(member, payload = {}) {
    const { submission } = await getMemberApplicationContext(member);
    if (!submission?.id) throw createHttpError(409, "접수를 완료한 후 서류를 제출하세요.");
    const fields = await getDocumentFieldsForSubmission(submission);
    const selection = buildApplicantSystemRecord(submission);
    const schedule = findApplicantScheduleRecord(await getApplicantSchedules(), selection);
    const scheduleState = getApplicantDocumentSubmissionScheduleState(schedule);
    if (!scheduleState.isOpen) {
      const message = scheduleState.reason === "not_configured" ? "서류 제출 기간이 아직 설정되지 않았습니다."
        : scheduleState.reason === "before_start" ? "아직 서류 제출 기간이 아닙니다."
        : scheduleState.reason === "after_end" ? "서류 제출 기간이 종료되었습니다."
        : "현재는 서류를 제출할 수 없습니다.";
      throw createHttpError(409, message, "DOCUMENT_SUBMISSION_SCHEDULE_CLOSED");
    }
    if (!fields.length) throw createHttpError(400, '등록된 서류제출 질문이 없습니다.');
    const answers = payload.answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) throw createHttpError(400, '서류제출 답변을 확인하세요.');
    const allowedKeys = new Set(fields.map(field => field.fieldKey));
    if (Object.keys(answers).some(key => !allowedKeys.has(key))) {
      throw createHttpError(400, '서류제출에 등록된 질문만 저장할 수 있습니다.', 'DOCUMENT_ANSWER_SCOPE_INVALID');
    }
    const existingAnswers = Object.fromEntries((submission.answerItems || []).map(item => [item.fieldKey, item.value]));
      const artifacts = buildApplicantSubmissionArtifacts(fields, { ...existingAnswers, ...answers }, { name: submission.name, email: submission.email }, submission);
      const records = artifacts.fileUploads.map(upload => buildStoredApplicantFileRecord(
        submission.examineeNo || `submission-${submission.id}`, upload.questionText, upload.fieldKey, upload,
        { ...upload, fileNamePattern: upload.fileNamePattern || '{수험번호}_{질문제목}' },
      ));
    const storedFiles = new Map(records.map(record => [record.fieldKey, JSON.stringify(buildStoredApplicantFileAnswerData(record))]));
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [owned] = await connection.query("SELECT id FROM app_meta WHERE id = ? AND member_id = ? FOR UPDATE", [submission.id, member.id]);
      if (!owned.length) throw createHttpError(403, "접수 정보를 찾을 수 없습니다.");
      const [answerRows] = await connection.query("SELECT applicant_name, email, password_hash, status, created_at FROM app_subm WHERE id = ? LIMIT 1", [submission.id]);
      const original = answerRows[0];
      if (!original) throw createHttpError(404, "접수 정보를 찾을 수 없습니다.");
      for (const record of records) {
        await persistApplicantFile(record);
        // A replacement upload supersedes the review of the previous file.
        await connection.query('DELETE ds FROM app_document_status ds INNER JOIN app_form f ON f.id = ds.field_id WHERE ds.submission_id = ? AND f.field_key = ?', [submission.id, record.fieldKey]);
      }
      for (const answer of artifacts.answerRows) {
        await connection.query("INSERT INTO app_subm (id,applicant_name,email,password_hash,status,field_key,answer_data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE answer_data = VALUES(answer_data), updated_at = NOW()", [submission.id, original.applicant_name, original.email, original.password_hash, original.status, answer.fieldKey, storedFiles.get(answer.fieldKey) ?? answer.answerData, original.created_at]);
      }
      await connection.commit();
      return getApplicantSubmissionById(submission.id);
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  async function getApplicantPublicForm() {
    const [fields, settings, systemSettings, noticeHtml, recruitmentUnits, schedules] = await Promise.all([
      getApplicantFormFields({ activeOnly: true }),
      getApplicantSettings(),
      getApplicantPublicSystemSettings(),
      getApplicantPublicNoticeHtml(),
      getApplicantRecruitmentUnits(),
      getApplicantSchedules(),
    ]);

    return {
      fields: fields.filter(field => field.formScope === 'application'),
      documentFields: fields.filter(field => field.formScope === 'documents'),
      formTemplates: await formTemplates.list(),
      settings,
      systemSettings,
      ...noticeHtml,
      recruitmentUnits,
      schedules,
    };
  }

  async function seedApplicantFormFields() {
    const [fieldSummary] = await query(`SELECT COUNT(*) AS fieldCount FROM app_form`);

    if (Number(fieldSummary?.fieldCount || 0) > 0) {
      return;
    }

    for (let index = 0; index < DEFAULT_APPLICANT_FORM_FIELD_SEEDS.length; index += 1) {
      const seed = DEFAULT_APPLICANT_FORM_FIELD_SEEDS[index];
      await query(
        `
          INSERT INTO app_form (
            field_key,
            question_text,
            input_type,
            system_field_key,
            options_json,
            required,
            sort_order,
            active
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `,
        [
          seed.fieldKey,
          seed.questionText,
          seed.inputType,
          seed.systemFieldKey,
          JSON.stringify(seed.options || []),
          seed.required ? 1 : 0,
          index + 1,
        ],
      );
    }
  }

  return Object.freeze({
    buildApplicantAdmitCardRecordFromSubmission,
    getApplicantSubmissionsByIds,
    getMemberApplicationContext,
    getMemberDocumentStatus,
    documentStatusService,
    saveMemberDocuments,

    buildApplicantAdmitCardPdfForAccessToken,

    buildApplicantSubmissionPhotoArchiveBuffer,
    buildApplicantSubmissionExportBuffer,
    buildApplicantRecruitmentUnitExportBuffer,
    buildApplicantRecruitmentUnitTemplateBuffer,

    createApplicantRecruitmentUnit,
    createApplicantFormField,

    deleteApplicantSubmission,
    deleteApplicantRecruitmentUnit,
    deleteApplicantFormField,

    getApplicantFormTemplates: formTemplates.list,
    saveApplicantFormTemplate: formTemplates.save,
    deleteApplicantFormTemplate: formTemplates.remove,
    getApplicantFormFields,
    getApplicantPublicForm,
    getApplicantRecruitmentUnits,
    getApplicantSchedules,
    getApplicantSettings,
    attachmentArchiveJobs,
    getApplicantSubmissionFile,
    getApplicantSubmissionById,
    getApplicantSubmissionPhoto,
    getApplicantSubmissionForAccessToken,
    getApplicantSubmissions,

    importApplicantRecruitmentUnits,
    lookupApplicantSubmission,
    migrateApplicantFileAnswerData,
    migrateApplicantPhotoStorage,
      moveApplicantFormField,

      previewApplicantRecruitmentUnitImport,

      saveApplicantSchedule,
      saveApplicantSchedules,
      saveApplicantSubmission,
    seedApplicantFormFields,
    sendApplicantVerificationCode,
    updateApplicantSubmissionPhoto,

    updateApplicantRecruitmentUnit,
    updateApplicantFormField,
    updateApplicantSettings,
    verifyApplicantVerificationCode,
  });
}

module.exports = {
  createApplicantService,
};
