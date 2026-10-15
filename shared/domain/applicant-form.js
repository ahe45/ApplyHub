(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardApplicantFormConfig = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const applicantNationalityRegionCodes = Object.freeze([
    "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
    "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
    "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
    "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE",
    "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF",
    "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
    "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM",
    "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC",
    "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK",
    "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
    "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG",
    "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW",
    "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
    "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO",
    "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
    "VN", "VU", "WF", "WS", "XK", "YE", "YT", "ZA", "ZM", "ZW",
  ]);

  function createRegionNameResolver(locale) {
    try {
      return typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
        ? new Intl.DisplayNames([locale], { type: "region" })
        : null;
    } catch (error) {
      return null;
    }
  }

  function buildApplicantNationalityOptions() {
    const koreanResolver = createRegionNameResolver("ko");
    const englishResolver = createRegionNameResolver("en");

    return Object.freeze(
      applicantNationalityRegionCodes
        .map((code) => {
          const label = String(koreanResolver?.of(code) || code).trim();
          const englishLabel = String(englishResolver?.of(code) || "").trim();

          return Object.freeze({
            key: code,
            code,
            label,
            englishLabel,
            searchLabel: [label, englishLabel, code].filter(Boolean).join(" ").toLowerCase(),
          });
        })
        .filter((option) => option.label)
        .sort((left, right) => left.label.localeCompare(right.label, "ko")),
    );
  }

  // Country calling codes: google/libphonenumber resources/PhoneNumberMetadata.xml (2026-10-15).
  const phoneCountryCodes = Object.freeze({"AC":"247","AD":"376","AE":"971","AF":"93","AG":"1","AI":"1","AL":"355","AM":"374","AO":"244","AR":"54","AS":"1","AT":"43","AU":"61","AW":"297","AX":"358","AZ":"994","BA":"387","BB":"1","BD":"880","BE":"32","BF":"226","BG":"359","BH":"973","BI":"257","BJ":"229","BL":"590","BM":"1","BN":"673","BO":"591","BQ":"599","BR":"55","BS":"1","BT":"975","BW":"267","BY":"375","BZ":"501","CA":"1","CC":"61","CD":"243","CF":"236","CG":"242","CH":"41","CI":"225","CK":"682","CL":"56","CM":"237","CN":"86","CO":"57","CR":"506","CU":"53","CV":"238","CW":"599","CX":"61","CY":"357","CZ":"420","DE":"49","DJ":"253","DK":"45","DM":"1","DO":"1","DZ":"213","EC":"593","EE":"372","EG":"20","EH":"212","ER":"291","ES":"34","ET":"251","FI":"358","FJ":"679","FK":"500","FM":"691","FO":"298","FR":"33","GA":"241","GB":"44","GD":"1","GE":"995","GF":"594","GG":"44","GH":"233","GI":"350","GL":"299","GM":"220","GN":"224","GP":"590","GQ":"240","GR":"30","GT":"502","GU":"1","GW":"245","GY":"592","HK":"852","HN":"504","HR":"385","HT":"509","HU":"36","ID":"62","IE":"353","IL":"972","IM":"44","IN":"91","IO":"246","IQ":"964","IR":"98","IS":"354","IT":"39","JE":"44","JM":"1","JO":"962","JP":"81","KE":"254","KG":"996","KH":"855","KI":"686","KM":"269","KN":"1","KP":"850","KR":"82","KW":"965","KY":"1","KZ":"7","LA":"856","LB":"961","LC":"1","LI":"423","LK":"94","LR":"231","LS":"266","LT":"370","LU":"352","LV":"371","LY":"218","MA":"212","MC":"377","MD":"373","ME":"382","MF":"590","MG":"261","MH":"692","MK":"389","ML":"223","MM":"95","MN":"976","MO":"853","MP":"1","MQ":"596","MR":"222","MS":"1","MT":"356","MU":"230","MV":"960","MW":"265","MX":"52","MY":"60","MZ":"258","NA":"264","NC":"687","NE":"227","NF":"672","NG":"234","NI":"505","NL":"31","NO":"47","NP":"977","NR":"674","NU":"683","NZ":"64","OM":"968","PA":"507","PE":"51","PF":"689","PG":"675","PH":"63","PK":"92","PL":"48","PM":"508","PR":"1","PS":"970","PT":"351","PW":"680","PY":"595","QA":"974","RE":"262","RO":"40","RS":"381","RU":"7","RW":"250","SA":"966","SB":"677","SC":"248","SD":"249","SE":"46","SG":"65","SH":"290","SI":"386","SJ":"47","SK":"421","SL":"232","SM":"378","SN":"221","SO":"252","SR":"597","SS":"211","ST":"239","SV":"503","SX":"1","SY":"963","SZ":"268","TA":"290","TC":"1","TD":"235","TG":"228","TH":"66","TJ":"992","TK":"690","TL":"670","TM":"993","TN":"216","TO":"676","TR":"90","TT":"1","TV":"688","TW":"886","TZ":"255","UA":"380","UG":"256","US":"1","UY":"598","UZ":"998","VA":"39","VC":"1","VE":"58","VG":"1","VI":"1","VN":"84","VU":"678","WF":"681","WS":"685","XK":"383","YE":"967","YT":"262","ZA":"27","ZM":"260","ZW":"263"});

  const nationalityOptions = buildApplicantNationalityOptions();

  function parsePhoneValue(value) {
    const text = String(value ?? '').trim();
    const match = text.match(/^\+(\d{1,3})\s+(\d*)$/);
    return match ? { countryCode: match[1], number: match[2] } : { countryCode: '82', number: text.replace(/\D/g, '') };
  }

  function normalizePhoneValue(value, { required = false } = {}) {
    const text = String(value ?? '').trim();
    if (!text) { if (required) throw new Error('전화번호를 입력하세요.'); return ''; }
    if (text.startsWith('+')) {
      const match = text.match(/^\+(\d{1,3})\s+(\d{1,20})$/);
      if (!match || !Object.values(phoneCountryCodes).includes(match[1])) throw new Error('국가코드와 전화번호를 확인하세요.');
      return `+${match[1]} ${match[2]}`;
    }
    const number = text.replace(/\D/g, '');
    if (!/^\d{1,20}$/.test(number)) throw new Error('전화번호는 20자리 이하의 숫자로 입력하세요.');
    return number;
  }

  function findApplicantNationalityOption(value = "") {
    const normalizedValue = String(value || "").trim();

    if (!normalizedValue) {
      return null;
    }

    const upperValue = normalizedValue.toUpperCase();
    const lowerValue = normalizedValue.toLowerCase();
    const exactMatch =
      nationalityOptions.find((option) => option.code === upperValue) ||
      nationalityOptions.find((option) => option.label === normalizedValue) ||
      nationalityOptions.find((option) => option.searchLabel === lowerValue);

    if (exactMatch) {
      return exactMatch;
    }

    const partialMatches = nationalityOptions.filter((option) => option.searchLabel.includes(lowerValue));
    return partialMatches.length === 1 ? partialMatches[0] : null;
  }

  function isApplicantNationalityValue(value = "") {
    return Boolean(findApplicantNationalityOption(value));
  }

  const answerTypeOptions = Object.freeze([
    Object.freeze({ key: "text", label: "텍스트" }),
    Object.freeze({ key: "phone", label: "전화번호" }),
    Object.freeze({ key: "nationality", label: "국적" }),
    Object.freeze({ key: "select", label: "단일 선택" }),
    Object.freeze({ key: "multiselect", label: "복수 선택" }),
    Object.freeze({ key: "date", label: "날짜" }),
    Object.freeze({ key: "daterange", label: "기간" }),
    Object.freeze({ key: "birthdate", label: "생년월일" }),
    Object.freeze({ key: "photo", label: "사진 업로드" }),
    Object.freeze({ key: "file", label: "파일 업로드" }),
  ]);

  const answerTypeDescriptions = Object.freeze({
    text: '주소처럼 짧은 내용을 직접 입력합니다.',
    textarea: '여러 줄의 긴 내용을 직접 입력합니다.',
    phone: '전화번호를 숫자로 입력합니다.',
    nationality: '국가명을 검색한 뒤 목록에서 선택합니다.',
    select: '등록한 선택지 중 하나를 선택합니다. 직접 입력 항목도 추가할 수 있습니다.',
    multiselect: '등록한 선택지 중 여러 항목을 선택합니다. 직접 입력 항목도 추가할 수 있습니다.',
    date: '설정한 날짜 형식에 따라 연도, 월, 일 중 필요한 부분만 선택합니다.',
    daterange: '설정한 날짜 형식으로 시작일과 종료일을 선택합니다.',
    birthdate: '생년월일의 연도, 월, 일을 선택합니다.',
    time: '시간과 분을 입력합니다.',
    photo: 'JPG·PNG 사진을 업로드합니다.',
    file: '서류 파일을 업로드합니다. 저장 파일명 규칙과 허용 확장자를 설정할 수 있습니다.',
  });

  const applicationAnswerTypeOptions = Object.freeze(answerTypeOptions.filter(option => option.key !== 'birthdate'));
  const signupAnswerTypeOptions = Object.freeze(answerTypeOptions.filter(option => !['photo', 'file'].includes(option.key)));
  const isChoiceInputType = type => ['select', 'multiselect'].includes(type);
  const datePartKeys = Object.freeze(['year', 'month', 'day']);
  function normalizeDateParts(value) {
    if (value === undefined) return [...datePartKeys];
    if (!Array.isArray(value) || !value.length || value.some(part => !datePartKeys.includes(part)) || new Set(value).size !== value.length) {
      throw new Error('날짜 형식에서 연, 월, 일 중 하나 이상을 선택하세요.');
    }
    // A day needs a month when a year is requested; standalone days remain valid.
    const requiresMonth = value.includes('year') && value.includes('day');
    return datePartKeys.filter(part => value.includes(part) || (part === 'month' && requiresMonth));
  }
  function getDateParts(field = {}) {
    return normalizeDateParts(field.inputType === 'birthdate' ? undefined : field.dateParts);
  }
  function parseDateValue(value, field = {}) {
    const parts = getDateParts(field), values = String(value || '').split('-');
    if (values.length !== parts.length) return {};
    return Object.fromEntries(parts.map((part, index) => [part, values[index]]));
  }
  function buildDateValue(values = {}, field = {}) {
    const parts = getDateParts(field);
    return parts.every(part => values[part]) ? parts.map(part => String(values[part]).padStart(part === 'year' ? 4 : 2, '0')).join('-') : '';
  }
  function getDateDayCount(year, month) {
    if (!month) return 31;
    const numericYear = Number(year || 2000), numericMonth = Number(month);
    const leap = numericYear % 4 === 0 && (numericYear % 100 !== 0 || numericYear % 400 === 0);
    return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][numericMonth - 1] || 31;
  }
  function isValidDateValue(value, field = {}) {
    const parts = getDateParts(field), values = parseDateValue(value, field);
    if (!parts.every(part => (part === 'year' ? /^\d{4}$/ : /^\d{2}$/).test(values[part] || ''))) return false;
    if (parts.includes('year') && Number(values.year) < 1) return false;
    if (parts.includes('month') && (Number(values.month) < 1 || Number(values.month) > 12)) return false;
    if (parts.includes('day') && (Number(values.day) < 1 || Number(values.day) > getDateDayCount(values.year, values.month))) return false;
    return true;
  }
  function normalizeChoiceTranslations(options = [], translations = {}) {
    return Object.fromEntries(options.map(option => [option, Object.hasOwn(translations || {}, option) ? String(translations[option] || '').trim().slice(0, 200) : '']));
  }
  function parseDateRange(value) {
    const values = String(value || '').split(' ~ ');
    return values.length === 2 ? { start: values[0], end: values[1] } : { start: '', end: '' };
  }
  function buildDateRangeValue(start, end) {
    return start && end ? `${start} ~ ${end}` : '';
  }
  function validateDateRangeAnswer(field, raw) {
    if (raw == null || raw === '') {
      if (field.required) throw new Error('시작일과 종료일을 모두 선택하세요.');
      return '';
    }
    if (typeof raw !== 'string' || raw.length > 23) throw new Error('올바른 기간을 선택하세요.');
    const { start, end } = parseDateRange(raw);
    if (!isValidDateValue(start, field) || !isValidDateValue(end, field)) throw new Error('시작일과 종료일을 올바르게 선택하세요.');
    if (start > end) throw new Error('종료일은 시작일보다 빠를 수 없습니다.');
    return buildDateRangeValue(start, end);
  }
  function parseMultiSelectValue(value) {
    if (Array.isArray(value)) return value.filter(item => typeof item === 'string');
    if (!value) return [];
    try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed.filter(item => typeof item === 'string'); } catch {}
    return [String(value)];
  }
  function validateMultiSelectAnswer(field, raw, label) {
    const values = raw == null || raw === '' ? [] : raw;
    if (!Array.isArray(values) || values.length > 100 || values.some(value => typeof value !== 'string' || !value.trim() || value.length > 255)) throw new Error(`${label} 선택값이 올바르지 않습니다.`);
    const unique = [...new Set(values.map(value => value.trim()))];
    if (field.required && !unique.length) throw new Error(`${label} 항목을 선택하세요.`);
    const custom = field.customOptionLabel;
    if (unique.some(value => !field.options.includes(value) && !(custom && value.startsWith(custom + ': ') && value.slice(custom.length + 2).trim()))) throw new Error(`${label} 선택값이 올바르지 않습니다.`);
    if (custom && unique.includes(custom)) throw new Error(`${label} 직접 입력 내용을 작성하세요.`);
    return unique;
  }
  function getMemberBirthDate(member, questions = []) {
    const profile = member?.profile || {};
    if (typeof profile.birth === 'string' && profile.birth.trim()) return profile.birth.trim();
    const question = questions.find(q => q.inputType === 'birthdate' && typeof profile[q.key] === 'string' && profile[q.key].trim());
    return question ? profile[question.key].trim() : '';
  }

  const systemFieldOptions = Object.freeze([
    Object.freeze({ key: "", label: "일반 항목" }),
    Object.freeze({ key: "name", label: "이름" }),
    Object.freeze({ key: "birth", label: "생년월일" }),
    Object.freeze({ key: "track", label: "모집시기" }),
    Object.freeze({ key: "admission", label: "전형" }),
    Object.freeze({ key: "series", label: "계열" }),
    Object.freeze({ key: "unit", label: "모집단위" }),
    Object.freeze({ key: "major", label: "전공" }),
    Object.freeze({ key: "photo", label: "수험생 사진" }),
  ]);

  const applicantStatusOptions = Object.freeze([
    Object.freeze({ key: "submitted", label: "접수 완료" }),
    Object.freeze({ key: "promoted", label: "접수 완료" }),
  ]);

  const defaultApplicantExamNoPattern = "AD-{YY}{MM}{DD}-{SEQ:4}";
  const defaultApplicantExamNoSequenceStart = 1;
  const protectedApplicantSystemFields = Object.freeze(["name"]);

  const answerTypeLabelMap = Object.freeze(
    answerTypeOptions.reduce(
      (map, option) => {
        map[option.key] = option.label;
        return map;
      },
      {
        textarea: "긴 텍스트",
        time: "시간",
      },
    ),
  );
  const systemFieldLabelMap = Object.freeze(
    systemFieldOptions.reduce((map, option) => {
      map[option.key] = option.label;
      return map;
    }, {}),
  );
  const applicantStatusLabelMap = Object.freeze(
    applicantStatusOptions.reduce((map, option) => {
      map[option.key] = option.label;
      return map;
    }, {}),
  );

  function getApplicantAnswerTypeLabel(answerType = "") {
    return answerTypeLabelMap[String(answerType || "").trim()] || "텍스트";
  }

  function getApplicantSystemFieldLabel(systemFieldKey = "") {
    return systemFieldLabelMap[String(systemFieldKey || "").trim()] || "일반 항목";
  }

  function normalizeApplicantScheduleDateTime(value = "") {
    const normalizedValue = String(value || "").trim();

    if (!normalizedValue) {
      return "";
    }

    const matchedValue = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

    if (!matchedValue) {
      return "";
    }

    const [, yearValue, monthValue, dayValue, hourValue, minuteValue] = matchedValue;
    const parsedDate = new Date(
      Number(yearValue),
      Number(monthValue) - 1,
      Number(dayValue),
      Number(hourValue),
      Number(minuteValue),
      0,
      0,
    );

    if (
      parsedDate.getFullYear() !== Number(yearValue) ||
      parsedDate.getMonth() + 1 !== Number(monthValue) ||
      parsedDate.getDate() !== Number(dayValue) ||
      parsedDate.getHours() !== Number(hourValue) ||
      parsedDate.getMinutes() !== Number(minuteValue)
    ) {
      return "";
    }

    return `${yearValue}-${monthValue}-${dayValue}T${hourValue}:${minuteValue}`;
  }

  function getApplicantScheduleTimestamp(value = "", { inclusiveEndMinute = false } = {}) {
    const normalizedValue = normalizeApplicantScheduleDateTime(value);

    if (!normalizedValue) {
      return NaN;
    }

    const [, yearValue, monthValue, dayValue, hourValue, minuteValue] =
      normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/) || [];

    return new Date(
      Number(yearValue),
      Number(monthValue) - 1,
      Number(dayValue),
      Number(hourValue),
      Number(minuteValue),
      inclusiveEndMinute ? 59 : 0,
      inclusiveEndMinute ? 999 : 0,
    ).getTime();
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

  function buildApplicantScheduleWindowState(startAt, endAt, referenceDate = new Date()) {
    const normalizedStartAt = normalizeApplicantScheduleDateTime(startAt);
    const normalizedEndAt = normalizeApplicantScheduleDateTime(endAt);

    if (!normalizedStartAt || !normalizedEndAt) {
      return {
        isConfigured: false,
        isOpen: false,
        reason: "not_configured",
      };
    }

    const currentTimestamp = referenceDate instanceof Date ? referenceDate.getTime() : new Date(referenceDate).getTime();
    const startTimestamp = getApplicantScheduleTimestamp(normalizedStartAt);
    const endTimestamp = getApplicantScheduleTimestamp(normalizedEndAt, {
      inclusiveEndMinute: true,
    });

    if (!Number.isFinite(currentTimestamp) || !Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp)) {
      return {
        isConfigured: true,
        isOpen: false,
        reason: "invalid",
      };
    }

    if (currentTimestamp < startTimestamp) {
      return {
        isConfigured: true,
        isOpen: false,
        reason: "before_start",
      };
    }

    if (currentTimestamp > endTimestamp) {
      return {
        isConfigured: true,
        isOpen: false,
        reason: "after_end",
      };
    }

    return {
      isConfigured: true,
      isOpen: true,
      reason: "open",
    };
  }

  function isApplicantScheduleEnabled(schedule = {}, type = 'submission') {
    const key = { submission: 'applicantScheduleEnabled', documents: 'documentSubmissionScheduleEnabled', 'document-status': 'documentReviewScheduleEnabled', lookup: 'admitCardLookupScheduleEnabled' }[type];
    const value = schedule?.[key];
    return value !== false && value !== 0 && value !== '0';
  }

  function getScheduleEnabledState(schedule, type) {
    const enabled = isApplicantScheduleEnabled(schedule, type);
    return enabled ? { enabled: true } : { enabled: false, isOpen: false, reason: 'disabled' };
  }

  function getApplicantSubmissionScheduleState(schedule = {}, referenceDate = new Date()) {
    const applicantScheduleStartAt = normalizeApplicantScheduleDateTime(schedule?.applicantScheduleStartAt);
    const applicantScheduleEndAt = normalizeApplicantScheduleDateTime(schedule?.applicantScheduleEndAt);

    return {
      applicantScheduleStartAt,
      applicantScheduleEndAt,
      ...buildApplicantScheduleWindowState(applicantScheduleStartAt, applicantScheduleEndAt, referenceDate),
      ...getScheduleEnabledState(schedule, 'submission'),
    };
  }

  function getApplicantDocumentSubmissionScheduleState(schedule = {}, referenceDate = new Date()) {
    const documentSubmissionScheduleStartAt = normalizeApplicantScheduleDateTime(schedule?.documentSubmissionScheduleStartAt);
    const documentSubmissionScheduleEndAt = normalizeApplicantScheduleDateTime(schedule?.documentSubmissionScheduleEndAt);
    return {
      documentSubmissionScheduleStartAt,
      documentSubmissionScheduleEndAt,
      ...buildApplicantScheduleWindowState(documentSubmissionScheduleStartAt, documentSubmissionScheduleEndAt, referenceDate),
      ...getScheduleEnabledState(schedule, 'documents'),
    };
  }

  function getApplicantDocumentReviewScheduleState(schedule = {}, referenceDate = new Date()) {
    const documentReviewScheduleStartAt = normalizeApplicantScheduleDateTime(schedule?.documentReviewScheduleStartAt);
    const documentReviewScheduleEndAt = normalizeApplicantScheduleDateTime(schedule?.documentReviewScheduleEndAt);
    return {
      documentReviewScheduleStartAt,
      documentReviewScheduleEndAt,
      ...buildApplicantScheduleWindowState(documentReviewScheduleStartAt, documentReviewScheduleEndAt, referenceDate),
      ...getScheduleEnabledState(schedule, 'document-status'),
    };
  }

  function getApplicantAdmitCardLookupScheduleState(schedule = {}, referenceDate = new Date()) {
    const admitCardLookupScheduleStartAt = normalizeApplicantScheduleDateTime(schedule?.admitCardLookupScheduleStartAt);
    const admitCardLookupScheduleEndAt = normalizeApplicantScheduleDateTime(schedule?.admitCardLookupScheduleEndAt);

    return {
      admitCardLookupScheduleStartAt,
      admitCardLookupScheduleEndAt,
      ...buildApplicantScheduleWindowState(admitCardLookupScheduleStartAt, admitCardLookupScheduleEndAt, referenceDate),
      ...getScheduleEnabledState(schedule, 'lookup'),
    };
  }

  function getApplicantAggregateScheduleState(schedules = [], scheduleType = "submission", referenceDate = new Date()) {
    const allSchedules = Array.isArray(schedules) ? schedules : [];
    const normalizedSchedules = allSchedules.filter(schedule => isApplicantScheduleEnabled(schedule, scheduleType));
    const scheduleStateResolver =
      scheduleType === "lookup" ? getApplicantAdmitCardLookupScheduleState : getApplicantSubmissionScheduleState;
    if (allSchedules.length && !normalizedSchedules.length) return { ...scheduleStateResolver({}, referenceDate), enabled: false, reason: 'disabled' };
    const configuredStates = normalizedSchedules
      .map((schedule) => scheduleStateResolver(schedule, referenceDate))
      .filter((scheduleState) => scheduleState.isConfigured);

    if (configuredStates.some((scheduleState) => scheduleState.isOpen)) {
      return configuredStates.find((scheduleState) => scheduleState.isOpen) || scheduleStateResolver({}, referenceDate);
    }

    if (configuredStates.length === 0) {
      return scheduleStateResolver({}, referenceDate);
    }

    const beforeStartStates = configuredStates
      .filter((scheduleState) => scheduleState.reason === "before_start")
      .sort((leftState, rightState) => {
        const leftTimestamp = getApplicantScheduleTimestamp(
          scheduleType === "lookup" ? leftState.admitCardLookupScheduleStartAt : leftState.applicantScheduleStartAt,
        );
        const rightTimestamp = getApplicantScheduleTimestamp(
          scheduleType === "lookup" ? rightState.admitCardLookupScheduleStartAt : rightState.applicantScheduleStartAt,
        );
        return leftTimestamp - rightTimestamp;
      });

    if (beforeStartStates.length > 0) {
      return beforeStartStates[0];
    }

    const afterEndStates = configuredStates
      .filter((scheduleState) => scheduleState.reason === "after_end")
      .sort((leftState, rightState) => {
        const leftTimestamp = getApplicantScheduleTimestamp(
          scheduleType === "lookup" ? leftState.admitCardLookupScheduleEndAt : leftState.applicantScheduleEndAt,
          { inclusiveEndMinute: true },
        );
        const rightTimestamp = getApplicantScheduleTimestamp(
          scheduleType === "lookup" ? rightState.admitCardLookupScheduleEndAt : rightState.applicantScheduleEndAt,
          { inclusiveEndMinute: true },
        );
        return rightTimestamp - leftTimestamp;
      });

    return afterEndStates[0] || configuredStates[0];
  }

  function buildApplicantScheduleRangeLabel(scheduleState = {}, scheduleType = "submission") {
    if (scheduleType === "lookup") {
      return scheduleState.isConfigured && scheduleState.admitCardLookupScheduleStartAt && scheduleState.admitCardLookupScheduleEndAt
        ? `${scheduleState.admitCardLookupScheduleStartAt} ~ ${scheduleState.admitCardLookupScheduleEndAt}`
        : "";
    }

    return scheduleState.isConfigured && scheduleState.applicantScheduleStartAt && scheduleState.applicantScheduleEndAt
      ? `${scheduleState.applicantScheduleStartAt} ~ ${scheduleState.applicantScheduleEndAt}`
      : "";
  }

  function isApplicantScheduleOpen(options = {}) {
    const normalizedOptions = options && typeof options === "object" ? options : {};

    if (typeof normalizedOptions.isApplicantScheduleOpen === "boolean") {
      return normalizedOptions.isApplicantScheduleOpen;
    }

    if (typeof normalizedOptions.scheduleState?.isOpen === "boolean") {
      return normalizedOptions.scheduleState.isOpen;
    }

    const scheduleStartAt = String(normalizedOptions.applicantScheduleStartAt || "").trim();
    const scheduleEndAt = String(normalizedOptions.applicantScheduleEndAt || "").trim();
    const referenceValue = normalizedOptions.referenceDate ?? new Date();
    const referenceTimestamp = referenceValue instanceof Date ? referenceValue.getTime() : new Date(referenceValue).getTime();

    if (!scheduleStartAt || !scheduleEndAt || !Number.isFinite(referenceTimestamp)) {
      return false;
    }

    const parsedStartDate = new Date(scheduleStartAt);
    const parsedEndDate = new Date(scheduleEndAt);

    if (Number.isNaN(parsedStartDate.getTime()) || Number.isNaN(parsedEndDate.getTime())) {
      return false;
    }

    return referenceTimestamp >= parsedStartDate.getTime() && referenceTimestamp <= parsedEndDate.getTime() + (60 * 1000 - 1);
  }

  function getApplicantStatusLabel(status = "", options = {}) {
    const normalizedStatus = String(status || "").trim();
    const isScheduleOpen = isApplicantScheduleOpen(options);

    if (normalizedStatus === "promoted") {
      return applicantStatusLabelMap.promoted || "접수 완료";
    }

    return isScheduleOpen ? "접수 중" : applicantStatusLabelMap.submitted || "접수 완료";
  }

  function resolveChoiceOptionEdits(editor = {}) {
    const original = Array.isArray(editor.options) ? editor.options : [];
    const options = original.map((option, index) => String(editor.optionKoreanEdits?.[index] ?? option).trim());
    if (options.some(option => !option)) throw new Error('선택지의 한국어 내용을 입력하세요.');
    if (new Set(options).size !== options.length) throw new Error('같은 선택지 항목이 이미 있습니다.');
    return {
      options,
      optionsEn: Object.fromEntries(original.map((option, index) => [options[index], String(editor.optionsEn?.[option] || '').trim()])),
      optionsMn: Object.fromEntries(original.map((option, index) => [options[index], String(editor.optionsMn?.[option] || '').trim()])),
      customOptionLabel: options[original.indexOf(editor.customOptionLabel)] || '',
      optionKoreanEdits: {},
    };
  }

  function normalizeFileUploadSettings(value = {}, scope = "application") {
    const fileNamePattern = String(value.fileNamePattern || "").trim();
    const tokens = scope === "signup" ? ["ID", "질문제목", "원본파일명"] : ["수험번호", "질문제목", "원본파일명"];
    if (fileNamePattern.length > 120 || /[<>:"/\\|?*\u0000-\u001f]/.test(fileNamePattern)) throw new Error("저장 파일명 규칙은 경로 문자 없이 120자 이내로 입력하세요.");
    if (fileNamePattern.replace(/\{([^{}]+)\}/g, (match, token) => {
      if (!tokens.includes(token)) throw new Error(`사용 가능한 항목: ${tokens.map(t => `{${t}}`).join(", ")}`);
      return "";
    }).match(/[{}]/)) throw new Error("파일명 규칙의 중괄호를 확인하세요.");
    const raw = Array.isArray(value.allowedExtensions) ? value.allowedExtensions : String(value.allowedExtensions || "").split(/[,\s]+/);
    const allowedExtensions = [...new Set(raw.map(v => String(v).trim().toLowerCase().replace(/^\./, "")).filter(Boolean))];
    if (allowedExtensions.length > 30 || allowedExtensions.some(v => !/^[a-z0-9]{1,10}$/.test(v))) throw new Error("확장자는 pdf, jpg처럼 쉼표로 구분해 입력하세요. (최대 30개)");
    return { fileNamePattern, allowedExtensions };
  }

  function isAllowedUploadExtension(fileName, allowedExtensions = []) {
    const extension = String(fileName || "").split(/[\\/]/).pop().match(/\.([^.]+)$/)?.[1]?.toLowerCase() || "";
    return !allowedExtensions.length || allowedExtensions.includes(extension);
  }

  function formatUploadFileBaseName(pattern, values = {}) {
    const text = String(pattern || "").replace(/\{([^{}]+)\}/g, (_, key) => String(values[key] || ""));
    return text.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/\s+/g, " ").replace(/^[. ]+|[. ]+$/g, "").slice(0, 100) || "file";
  }

  return Object.freeze({
    phoneCountryCodes,
    parsePhoneValue,
    normalizePhoneValue,
    datePartKeys,
    normalizeDateParts,
    getDateParts,
    parseDateValue,
    buildDateValue,
    getDateDayCount,
    isValidDateValue,
    parseDateRange,
    buildDateRangeValue,
    validateDateRangeAnswer,
    isApplicantScheduleEnabled,
    signupAnswerTypeOptions,
    isChoiceInputType,
    normalizeChoiceTranslations,
    resolveChoiceOptionEdits,
    parseMultiSelectValue,
    validateMultiSelectAnswer,
    normalizeFileUploadSettings,
    isAllowedUploadExtension,
    formatUploadFileBaseName,
    answerTypeOptions,
    answerTypeDescriptions,
    applicationAnswerTypeOptions,
    getMemberBirthDate,
    applicantNationalityRegionCodes,
    applicantStatusOptions,
    defaultApplicantExamNoPattern,
    defaultApplicantExamNoSequenceStart,
    findApplicantNationalityOption,
    findApplicantScheduleRecord,
    getApplicantAdmitCardLookupScheduleState,
    getApplicantDocumentSubmissionScheduleState,
    getApplicantDocumentReviewScheduleState,
    getApplicantAggregateScheduleState,
    getApplicantAnswerTypeLabel,
    getApplicantScheduleTimestamp,
    getApplicantStatusLabel,
    getApplicantSubmissionScheduleState,
    getApplicantSystemFieldLabel,
    isApplicantScheduleOpen,
    isApplicantNationalityValue,
    nationalityOptions,
    normalizeApplicantScheduleDateTime,
    protectedApplicantSystemFields,
    resolveApplicantScheduleCriteria,
    systemFieldOptions,
    buildApplicantScheduleContextLabel,
    buildApplicantScheduleRangeLabel,
  });
});
