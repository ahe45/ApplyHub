(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardSystemRenderers = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const appConfig = globalThis.AdmitCardAppConfig || {};
  const resolveSuperAdminLogoImageUrl =
    appConfig.resolveSuperAdminLogoImageUrl || ((settings = {}) => String(settings?.logoImageUrl || "").trim() || "/client/assets/logo.png");
  const resolveSuperAdminBackgroundImageUrl =
    appConfig.resolveSuperAdminBackgroundImageUrl || ((settings = {}) => String(settings?.backgroundImageUrl || "").trim() || "/client/assets/bg.png");
  const applicantExamNoComponentOptions = Object.freeze([
    Object.freeze({ key: "", label: "선택 안 함" }),
    Object.freeze({ key: "admissionCode", label: "전형코드" }),
    Object.freeze({ key: "seriesCode", label: "계열코드" }),
    Object.freeze({ key: "unitCode", label: "모집단위코드" }),
    Object.freeze({ key: "nationalityCode", label: "국적코드" }),
    Object.freeze({ key: "sequence", label: "순번" }),
  ]);
  const systemScheduleWeekdayLabels = Object.freeze(["일", "월", "화", "수", "목", "금", "토"]);
  const systemScheduleTargetDefinitions = Object.freeze({
    "applicant-start": Object.freeze({
      key: "applicant-start",
      edge: "start",
      triggerId: "systemSettingsApplicantScheduleStartTrigger",
      inputIdPrefix: "systemSettingsApplicantScheduleStart",
      ariaPrefix: "접수 시작",
      rangeSuffix: "부터 ",
    }),
    "applicant-end": Object.freeze({
      key: "applicant-end",
      edge: "end",
      triggerId: "systemSettingsApplicantScheduleEndTrigger",
      inputIdPrefix: "systemSettingsApplicantScheduleEnd",
      ariaPrefix: "접수 종료",
      rangeSuffix: "까지",
    }),
    "admit-card-lookup-start": Object.freeze({
      key: "admit-card-lookup-start",
      edge: "start",
      triggerId: "systemSettingsAdmitCardLookupScheduleStartTrigger",
      inputIdPrefix: "systemSettingsAdmitCardLookupScheduleStart",
      ariaPrefix: "수험표 조회 시작",
      rangeSuffix: "부터 ",
    }),
    "admit-card-lookup-end": Object.freeze({
      key: "admit-card-lookup-end",
      edge: "end",
      triggerId: "systemSettingsAdmitCardLookupScheduleEndTrigger",
      inputIdPrefix: "systemSettingsAdmitCardLookupScheduleEnd",
      ariaPrefix: "수험표 조회 종료",
      rangeSuffix: "까지",
    }),
  });

  function getSystemScheduleTargetDefinition(scheduleTarget = "") {
    const normalizedTarget = String(scheduleTarget || "").trim();
    return systemScheduleTargetDefinitions[normalizedTarget] || systemScheduleTargetDefinitions["applicant-start"];
  }

  function createEmptySystemScheduleParts() {
    return {
      year: "",
      month: "",
      day: "",
      hour: "",
      minute: "",
    };
  }

  function parseSystemScheduleParts(value = "") {
    const normalizedValue = String(value || "").trim();
    const matchedValue = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

    if (!matchedValue) {
      return createEmptySystemScheduleParts();
    }

    const [, yearValue, monthValue, dayValue, hourValue, minuteValue] = matchedValue;

    return {
      year: yearValue,
      month: monthValue,
      day: dayValue,
      hour: hourValue,
      minute: minuteValue,
    };
  }

  function padSystemScheduleValue(value) {
    return String(value || "").padStart(2, "0");
  }

  function getSystemScheduleYearOptions(selectedYear = "") {
    const currentYear = new Date().getFullYear();
    const normalizedSelectedYear = Number(selectedYear || 0);
    let startYear = currentYear - 1;
    let endYear = currentYear + 5;

    if (Number.isInteger(normalizedSelectedYear) && normalizedSelectedYear > 0) {
      startYear = Math.min(startYear, normalizedSelectedYear);
      endYear = Math.max(endYear, normalizedSelectedYear);
    }

    return Array.from({ length: endYear - startYear + 1 }, (_, index) => String(startYear + index));
  }

  function getSystemScheduleMinuteOptions(selectedMinute = "") {
    const minuteOptions = new Set(Array.from({ length: 12 }, (_, index) => padSystemScheduleValue(index * 5)));
    const normalizedSelectedMinute = String(selectedMinute || "").trim();

    minuteOptions.add("59");

    if (/^\d{2}$/.test(normalizedSelectedMinute)) {
      minuteOptions.add(normalizedSelectedMinute);
    }

    return Array.from(minuteOptions).sort((leftValue, rightValue) => Number(leftValue) - Number(rightValue));
  }

  function formatSystemSchedulePartsLabel(parts = {}) {
    const normalizedParts = createEmptySystemScheduleParts();
    const sourceParts = parts && typeof parts === "object" ? parts : {};

    normalizedParts.year = String(sourceParts.year || "").trim();
    normalizedParts.month = padSystemScheduleValue(sourceParts.month || "");
    normalizedParts.day = padSystemScheduleValue(sourceParts.day || "");
    normalizedParts.hour = padSystemScheduleValue(sourceParts.hour || "");
    normalizedParts.minute = padSystemScheduleValue(sourceParts.minute || "");

    if (Object.values(normalizedParts).some((value) => !value)) {
      return "";
    }

    return `${normalizedParts.year}.${normalizedParts.month}.${normalizedParts.day} ${normalizedParts.hour}:${normalizedParts.minute}`;
  }

  function renderSystemScheduleTriggerIcon() {
    return `
      <svg class="system-settings-schedule-trigger-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4.5" y="6" width="15" height="13.5" rx="2"></rect>
        <path d="M8 4.5v3"></path>
        <path d="M16 4.5v3"></path>
        <path d="M4.5 9.5h15"></path>
      </svg>
    `;
  }

  function getSystemScheduleCalendarDays(yearValue = "", monthValue = "") {
    const normalizedYear = Number(yearValue);
    const normalizedMonth = Number(monthValue);

    if (!Number.isInteger(normalizedYear) || !Number.isInteger(normalizedMonth) || normalizedMonth < 1 || normalizedMonth > 12) {
      return [];
    }

    const firstDateOfMonth = new Date(normalizedYear, normalizedMonth - 1, 1);
    const calendarStartDate = new Date(normalizedYear, normalizedMonth - 1, 1 - firstDateOfMonth.getDay());
    const today = new Date();

    return Array.from({ length: 42 }, (_, index) => {
      const currentDate = new Date(calendarStartDate.getFullYear(), calendarStartDate.getMonth(), calendarStartDate.getDate() + index);

      return {
        year: String(currentDate.getFullYear()),
        month: padSystemScheduleValue(currentDate.getMonth() + 1),
        day: padSystemScheduleValue(currentDate.getDate()),
        isCurrentMonth: currentDate.getMonth() === normalizedMonth - 1,
        isToday:
          currentDate.getFullYear() === today.getFullYear() &&
          currentDate.getMonth() === today.getMonth() &&
          currentDate.getDate() === today.getDate(),
      };
    });
  }

  function renderSystemScheduleSelect({
    inputId,
    scheduleTarget,
    schedulePart,
    selectedValue,
    options,
    ariaLabel,
  }) {
    const normalizedSelectedValue = String(selectedValue || "").trim();

    return `
      <label class="system-settings-schedule-select-shell" for="${escapeAttribute(inputId)}">
        <select
          class="system-settings-input system-settings-schedule-select"
          id="${escapeAttribute(inputId)}"
          aria-label="${escapeAttribute(ariaLabel)}"
          data-system-settings-schedule-target="${escapeAttribute(scheduleTarget)}"
          data-system-settings-schedule-part="${escapeAttribute(schedulePart)}"
        >
          ${options
            .map((value) => {
              const normalizedValue = String(value || "").trim();
              return `
                <option value="${escapeAttribute(normalizedValue)}" ${normalizedSelectedValue === normalizedValue ? "selected" : ""}>
                  ${escapeHtml(normalizedValue)}
                </option>
              `;
            })
            .join("")}
        </select>
      </label>
    `;
  }

  function renderSystemSchedulePopover({
    scheduleTarget,
    scheduleParts,
  }) {
    const scheduleTargetDefinition = getSystemScheduleTargetDefinition(scheduleTarget);
    const scheduleTargetLabel = scheduleTargetDefinition.edge === "end" ? "종료" : "시작";
    const scheduleMonthOptions = Array.from({ length: 12 }, (_, index) => padSystemScheduleValue(index + 1));
    const scheduleHourOptions = Array.from({ length: 24 }, (_, index) => padSystemScheduleValue(index));
    const scheduleMinuteOptions = getSystemScheduleMinuteOptions(scheduleParts.minute);
    const scheduleCalendarDays = getSystemScheduleCalendarDays(scheduleParts.year, scheduleParts.month);
    const selectedDateLabel = formatSystemSchedulePartsLabel(scheduleParts);
    const calendarHeadingLabel = `${scheduleParts.year}년 ${Number(scheduleParts.month || "0")}월`;

    return `
      <div class="system-settings-schedule-popover" data-system-settings-schedule-popover="${escapeAttribute(scheduleTargetDefinition.key)}">
        <div class="system-settings-schedule-popover-head">
          <strong class="system-settings-schedule-popover-title">${escapeHtml(`${scheduleTargetLabel} 일시`)}</strong>
          <p class="system-settings-schedule-popover-summary">${escapeHtml(selectedDateLabel)}</p>
        </div>
        <div class="system-settings-schedule-calendar-toolbar">
          <button
            class="system-settings-schedule-nav-button"
            data-system-settings-schedule-nav="prev"
            type="button"
            aria-label="${escapeAttribute(`${scheduleTargetDefinition.ariaPrefix} 일정 이전 달 보기`)}"
          >
            <span aria-hidden="true">&lsaquo;</span>
          </button>
          ${renderSystemScheduleSelect({
            inputId: `${scheduleTargetDefinition.inputIdPrefix}Year`,
            scheduleTarget: scheduleTargetDefinition.key,
            schedulePart: "year",
            selectedValue: scheduleParts.year,
            options: getSystemScheduleYearOptions(scheduleParts.year),
            ariaLabel: `${scheduleTargetDefinition.ariaPrefix} 일정 연도`,
          })}
          ${renderSystemScheduleSelect({
            inputId: `${scheduleTargetDefinition.inputIdPrefix}Month`,
            scheduleTarget: scheduleTargetDefinition.key,
            schedulePart: "month",
            selectedValue: scheduleParts.month,
            options: scheduleMonthOptions,
            ariaLabel: `${scheduleTargetDefinition.ariaPrefix} 일정 월`,
          })}
          <button
            class="system-settings-schedule-nav-button"
            data-system-settings-schedule-nav="next"
            type="button"
            aria-label="${escapeAttribute(`${scheduleTargetDefinition.ariaPrefix} 일정 다음 달 보기`)}"
          >
            <span aria-hidden="true">&rsaquo;</span>
          </button>
        </div>
        <div class="system-settings-schedule-calendar" role="group" aria-label="${escapeAttribute(`${scheduleTargetDefinition.ariaPrefix} 일정 날짜 선택`)}">
          <div class="system-settings-schedule-calendar-weekdays">
            ${systemScheduleWeekdayLabels
              .map(
                (weekdayLabel) => `
                  <span class="system-settings-schedule-calendar-weekday">${escapeHtml(weekdayLabel)}</span>
                `,
              )
              .join("")}
          </div>
          <p class="system-settings-schedule-calendar-caption">${escapeHtml(calendarHeadingLabel)}</p>
          <div class="system-settings-schedule-calendar-grid">
            ${scheduleCalendarDays
              .map((calendarDay) => {
                const isSelected =
                  scheduleParts.year === calendarDay.year &&
                  scheduleParts.month === calendarDay.month &&
                  scheduleParts.day === calendarDay.day;

                return `
                  <button
                    class="system-settings-schedule-calendar-day${calendarDay.isCurrentMonth ? "" : " is-outside-month"}${calendarDay.isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}"
                    data-system-settings-schedule-day="true"
                    data-system-settings-schedule-day-target="${escapeAttribute(scheduleTargetDefinition.key)}"
                    data-system-settings-schedule-day-year="${escapeAttribute(calendarDay.year)}"
                    data-system-settings-schedule-day-month="${escapeAttribute(calendarDay.month)}"
                    data-system-settings-schedule-day-value="${escapeAttribute(calendarDay.day)}"
                    type="button"
                    aria-pressed="${isSelected ? "true" : "false"}"
                  >
                    ${escapeHtml(String(Number(calendarDay.day)))}
                  </button>
                `;
              })
              .join("")}
          </div>
        </div>
        <div class="system-settings-schedule-time-row">
          <div class="system-settings-schedule-time-field">
            <span class="system-settings-schedule-time-label">시간</span>
            ${renderSystemScheduleSelect({
              inputId: `${scheduleTargetDefinition.inputIdPrefix}Hour`,
              scheduleTarget: scheduleTargetDefinition.key,
              schedulePart: "hour",
              selectedValue: scheduleParts.hour,
              options: scheduleHourOptions,
              ariaLabel: `${scheduleTargetDefinition.ariaPrefix} 일정 시`,
            })}
          </div>
          <div class="system-settings-schedule-time-field">
            <span class="system-settings-schedule-time-label">분</span>
            ${renderSystemScheduleSelect({
              inputId: `${scheduleTargetDefinition.inputIdPrefix}Minute`,
              scheduleTarget: scheduleTargetDefinition.key,
              schedulePart: "minute",
              selectedValue: scheduleParts.minute,
              options: scheduleMinuteOptions,
              ariaLabel: `${scheduleTargetDefinition.ariaPrefix} 일정 분`,
            })}
          </div>
        </div>
      </div>
    `;
  }

  function renderSystemScheduleField({
    title,
    helpText,
    startTarget,
    endTarget,
    startParts,
    endParts,
    activePopoverTarget,
  }) {
    const startTargetDefinition = getSystemScheduleTargetDefinition(startTarget);
    const endTargetDefinition = getSystemScheduleTargetDefinition(endTarget);
    const isStartPopoverOpen = activePopoverTarget === startTargetDefinition.key;
    const isEndPopoverOpen = activePopoverTarget === endTargetDefinition.key;

    return `
      <div class="field system-settings-field system-settings-schedule-field">
        <div class="system-settings-field-head">
          <label class="system-settings-label" for="${escapeAttribute(startTargetDefinition.triggerId)}">${escapeHtml(title)}</label>
          <small class="muted system-settings-help">${escapeHtml(helpText)}</small>
        </div>
        <div class="system-settings-control-wrap">
          <div class="system-settings-schedule-range">
            <div class="system-settings-schedule-item" data-system-settings-schedule-popover-root="${escapeAttribute(startTargetDefinition.key)}">
              <button
                class="outline-button system-settings-schedule-trigger${isStartPopoverOpen ? " is-active" : ""}"
                id="${escapeAttribute(startTargetDefinition.triggerId)}"
                data-system-settings-schedule-trigger="${escapeAttribute(startTargetDefinition.key)}"
                type="button"
                aria-expanded="${isStartPopoverOpen ? "true" : "false"}"
              >
                ${renderSystemScheduleTriggerIcon()}
                <strong class="system-settings-schedule-trigger-value">${escapeHtml(formatSystemSchedulePartsLabel(startParts))}</strong>
              </button>
              <span class="system-settings-schedule-suffix">${escapeHtml(startTargetDefinition.rangeSuffix)}</span>
              ${isStartPopoverOpen
                ? renderSystemSchedulePopover({
                    scheduleTarget: startTargetDefinition.key,
                    scheduleParts: startParts,
                  })
                : ""}
            </div>
            <div class="system-settings-schedule-item" data-system-settings-schedule-popover-root="${escapeAttribute(endTargetDefinition.key)}">
              <button
                class="outline-button system-settings-schedule-trigger${isEndPopoverOpen ? " is-active" : ""}"
                id="${escapeAttribute(endTargetDefinition.triggerId)}"
                data-system-settings-schedule-trigger="${escapeAttribute(endTargetDefinition.key)}"
                type="button"
                aria-expanded="${isEndPopoverOpen ? "true" : "false"}"
              >
                ${renderSystemScheduleTriggerIcon()}
                <strong class="system-settings-schedule-trigger-value">${escapeHtml(formatSystemSchedulePartsLabel(endParts))}</strong>
              </button>
              <span class="system-settings-schedule-suffix">${escapeHtml(endTargetDefinition.rangeSuffix)}</span>
              ${isEndPopoverOpen
                ? renderSystemSchedulePopover({
                    scheduleTarget: endTargetDefinition.key,
                    scheduleParts: endParts,
                  })
                : ""}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function getSystemDataDeleteItems() {
    return [
      {
        scope: "all",
        title: "전체 데이터",
        description: "회원가입 정보·첨부파일·약관 동의, 접수 사진·서류, 전형 관리, 출력 이력, 접수 이력을 모두 삭제합니다. 관리자 계정과 가입·접수 설정은 유지합니다.",
        buttonLabel: "삭제",
      },
      {
        scope: "applicant-settings",
        title: "전형 관리 데이터",
        description: "모집시기, 전형, 계열, 모집단위, 전공으로 구성된 전형 관리 데이터만 삭제합니다.",
        buttonLabel: "삭제",
      },

      {
        scope: "applicant-members",
        title: "회원가입 데이터",
        description: "전체 회원의 계정, 가입 답변·첨부파일, 약관 동의, 로그인·인증 정보를 삭제합니다. 접수 이력은 보존하고 회원 연결만 해제합니다. 관리자 계정과 가입 양식은 유지합니다.",
        buttonLabel: "삭제",
      },
      {
        scope: "applicant-history",
        title: "접수 이력 데이터",
        description: "수험생 접수 이력만 삭제하며 회원가입 정보, 출력 이력은 유지합니다.",
        buttonLabel: "삭제",
      },

      {
        scope: "print-history",
        title: "수험표 출력 이력",
        description: "발급 이력만 삭제하며 접수 이력과 사진 데이터는 유지합니다.",
        buttonLabel: "삭제",
      },
    ];
  }

  function getSystemBackupAssetItems() {
    return [

      {
        assetKey: "applicant-photos",
        title: "수험생 사진",
        description: "공개 접수에서 업로드한 사진 파일을 포함합니다.",
      },
      {
        assetKey: "applicant-files",
        title: "접수 첨부파일",
        description: "공개 접수에서 업로드한 증빙/첨부 파일을 포함합니다.",
      },
    ];
  }

  function getSystemBackupItems() {
    return [
      {
        itemKey: "database",
        title: "데이터베이스",
        description: "회원 계정·가입 답변·회원 첨부파일·약관 동의와 가입 양식, 관리자 계정, 수험생, 접수/출력 이력을 함께 백업합니다. 로그인 세션과 인증번호는 제외합니다.",
      },
      ...getSystemBackupAssetItems().map((item) => ({
        itemKey: item.assetKey,
        title: item.title,
        description: item.description,
      })),
    ];
  }

  function getSystemBackupRestoreItems() {
    return [
      {
        itemKey: "database",
        title: "데이터베이스",
        description: "회원 계정·가입 답변·회원 첨부파일·약관 동의·가입 양식과 접수 이력을 함께 복원합니다. 복원 후 회원은 다시 로그인해야 합니다.",
      },

      {
        itemKey: "applicant-photos",
        title: "수험생 사진",
        description: "공개 접수에서 업로드한 사진 파일을 복원합니다.",
      },
      {
        itemKey: "applicant-files",
        title: "접수 첨부파일",
        description: "공개 접수에서 업로드한 증빙/첨부 파일을 복원합니다.",
      },
    ];
  }

  function getSystemBackupItemTitle(itemKey = "") {
    const normalizedItemKey = String(itemKey || "").trim();

    if (!normalizedItemKey) {
      return "";
    }

    const matchingItem = [...getSystemBackupItems(), ...getSystemBackupRestoreItems()].find(
      (item) => String(item?.itemKey || "").trim() === normalizedItemKey,
    );

    return matchingItem?.title ? String(matchingItem.title) : normalizedItemKey;
  }

  function formatSystemAuditLogItemLabels(itemKeys = []) {
    const normalizedItemKeys = (Array.isArray(itemKeys) ? itemKeys : [])
      .map((itemKey) => String(itemKey || "").trim())
      .filter(Boolean);

    if (normalizedItemKeys.length === 0) {
      return "";
    }

    return normalizedItemKeys.map((itemKey) => getSystemBackupItemTitle(itemKey)).join(", ");
  }

  function buildSystemAuditLogDetailItems(row = {}) {
    const actionType = String(row?.actionType || "").trim();
    const details = row?.details && typeof row.details === "object" ? row.details : null;
    const detailItems = [];

    if (!details) {
      return detailItems;
    }

    function pushDetail(label, value) {
      if (value === null || typeof value === "undefined") {
        return;
      }

      const textValue = String(value).trim();

      if (!textValue) {
        return;
      }

      detailItems.push({
        label: String(label || "").trim(),
        value: textValue,
      });
    }

    if (actionType === "system_backup_export" || actionType === "system_backup_export_failed") {
      const selectedItemLabels = formatSystemAuditLogItemLabels([
        ...(details.databaseIncluded !== false ? ["database"] : []),
        ...(Array.isArray(details.selectedAssetKeys) ? details.selectedAssetKeys : []),
      ]);

      pushDetail("백업 파일", details.fileName);
      pushDetail("선택 항목", selectedItemLabels);
      pushDetail(
        "데이터베이스",
        details.databaseIncluded !== false ? `포함 (테이블 ${Number(details.tableCount || 0)}개)` : "미포함",
      );

      if (actionType.endsWith("_failed")) {
        pushDetail("오류 코드", details.errorCode);
        pushDetail("오류 내용", details.errorMessage);
      }

      return detailItems;
    }

    if (actionType === "system_backup_import" || actionType === "system_backup_import_failed") {
      pushDetail("백업 파일", details.fileName);
      pushDetail("복원 항목", formatSystemAuditLogItemLabels(details.selectedRestoreItemKeys));

      if (actionType === "system_backup_import") {
        pushDetail(
          "데이터베이스",
          details.restoredDatabase === true
            ? `복원됨 (테이블 ${Number(details.restoredTableCount || 0)}개, 데이터 ${Number(details.restoredRowCount || 0)}건)`
            : "유지",
        );
        pushDetail("복원 파일", `${Number(details.restoredFileCount || 0)}건`);
        if (details.restoredDatabase === true) pushDetail('복원 회원', `${Number(details.restoredMembers || 0)}명`);
        pushDetail("반영 파일 종류", formatSystemAuditLogItemLabels(details.restoredAssetKeys));
      } else {
        pushDetail("오류 코드", details.errorCode);
        pushDetail("오류 내용", details.errorMessage);
      }

      return detailItems;
    }

    if (actionType === "system_data_delete" || actionType === "system_data_delete_failed") {
      if (actionType === "system_data_delete") {
        pushDetail("삭제 범위", getSystemAuditLogScopeLabel(row?.targetScope));
        pushDetail("삭제 수험생", `${Number(details.deletedExaminees || 0)}건`);
        pushDetail("삭제 사진", `${Number(details.deletedPhotos || 0)}건`);
        pushDetail("삭제 접수 이력", `${Number(details.deletedApplicantSubmissions || 0)}건`);
        pushDetail("삭제 회원", `${Number(details.deletedMembers || 0)}명`);
        pushDetail("삭제 출력 이력", `${Number(details.deletedPrintHistory || 0)}건`);
      } else {
        pushDetail("오류 코드", details.errorCode);
        pushDetail("오류 내용", details.errorMessage);
      }
    }

    if (actionType === "system_backup_auto_settings_update" || actionType === "system_backup_auto_settings_update_failed") {
      if (actionType === "system_backup_auto_settings_update") {
        pushDetail("사용 여부", details.enabled === true ? "사용" : "사용 안 함");
        pushDetail("주기", details.scheduleType === "weekly" ? "매주" : "매일");
        pushDetail("실행 시각", details.time);
        pushDetail("보관 개수", `${Number(details.retentionCount || 0)}개`);
        pushDetail(
          "선택 항목",
          formatSystemAuditLogItemLabels([
            ...(details.includeDatabase !== false ? ["database"] : []),
            ...(Array.isArray(details.includedAssetKeys) ? details.includedAssetKeys : []),
          ]),
        );
      } else {
        pushDetail("오류 코드", details.errorCode);
        pushDetail("오류 내용", details.errorMessage);
      }

      return detailItems;
    }

    if (actionType === "system_backup_auto_run" || actionType === "system_backup_auto_run_failed") {
      pushDetail("실행 방식", details.trigger === "manual" ? "수동 실행" : "예약 실행");
      pushDetail("백업 파일", details.fileName);
      pushDetail(
        "선택 항목",
        formatSystemAuditLogItemLabels([
          ...(details.databaseIncluded !== false ? ["database"] : []),
          ...(Array.isArray(details.selectedAssetKeys) ? details.selectedAssetKeys : []),
        ]),
      );
      pushDetail("보관 개수", Number(details.retentionCount || 0) > 0 ? `${Number(details.retentionCount || 0)}개` : "");
      pushDetail("예약 시각", details.scheduledFor);

      if (actionType.endsWith("_failed")) {
        pushDetail("오류 코드", details.errorCode);
        pushDetail("오류 내용", details.errorMessage);
      }

      return detailItems;
    }

    return detailItems;
  }

  function getSystemAuditLogActionLabel(actionType = "") {
    const normalizedActionType = String(actionType || "").trim();

    if (normalizedActionType === "system_backup_export") {
      return "백업 다운로드";
    }

    if (normalizedActionType === "system_backup_export_failed") {
      return "백업 다운로드 실패";
    }

    if (normalizedActionType === "system_backup_import") {
      return "백업 복원";
    }

    if (normalizedActionType === "system_backup_import_failed") {
      return "백업 복원 실패";
    }

    if (normalizedActionType === "system_data_delete") {
      return "데이터 삭제";
    }

    if (normalizedActionType === "system_data_delete_failed") {
      return "데이터 삭제 실패";
    }

    if (normalizedActionType === "system_backup_auto_settings_update") {
      return "자동 백업 설정 저장";
    }

    if (normalizedActionType === "system_backup_auto_settings_update_failed") {
      return "자동 백업 설정 저장 실패";
    }

    if (normalizedActionType === "system_backup_auto_run") {
      return "자동 백업 실행";
    }

    if (normalizedActionType === "system_backup_auto_run_failed") {
      return "자동 백업 실행 실패";
    }

    return normalizedActionType || "감사 로그";
  }

  function getSystemAuditLogScopeLabel(targetScope = "") {
    const normalizedScope = String(targetScope || "").trim();
    if (normalizedScope === 'applicant-members') return '회원가입 데이터';

    if (normalizedScope === "system-backup") {
      return "백업 및 복구";
    }

    if (normalizedScope === "all") {
      return "전체 데이터";
    }

    if (normalizedScope === "applicant-settings") {
      return "전형 관리 데이터";
    }

    if (normalizedScope === "applicant-history") {
      return "접수 이력 데이터";
    }

    if (normalizedScope === "print-history") {
      return "수험표 출력 이력";
    }

    return normalizedScope;
  }

  function formatSystemAuditLogDetails(details = null) {
    if (details === null || typeof details === "undefined") {
      return "";
    }

    try {
      return JSON.stringify(details, null, 2);
    } catch (error) {
      return String(details || "");
    }
  }

  function renderSystemAuditLogContent({ showPageHeader = false } = {}) {
    const auditLogState = state.systemAuditLog && typeof state.systemAuditLog === "object" ? state.systemAuditLog : {};
    const rows = Array.isArray(auditLogState.rows) ? auditLogState.rows : [];
    const isLoading = auditLogState.isLoading === true;
    const hasLoaded = auditLogState.hasLoaded === true;
    const limit = Number.isFinite(Number(auditLogState.limit || 0)) && Number(auditLogState.limit || 0) > 0
      ? Number(auditLogState.limit)
      : 200;
    const lastLoadedAt = String(auditLogState.lastLoadedAt || "").trim();
    const statusClass = auditLogState.statusType === "warning" ? " warning" : "";

    return `
      ${showPageHeader
        ? `
          <div class="section-header">
            <div class="menu-section-copy">
              <h3>감사 로그</h3>
              <p>백업 다운로드, 복원, 데이터 삭제 같은 운영 위험 작업의 실행 이력을 확인합니다.</p>
            </div>
            <div class="inline-actions">
              <button
                class="outline-button"
                data-system-audit-log-action="refresh"
                type="button"
                ${isLoading ? "disabled" : ""}
              >
                ${isLoading ? "불러오는 중..." : "새로고침"}
              </button>
            </div>
          </div>
        `
        : `
          <div class="system-audit-log-modal-toolbar">
            <p class="muted">백업 다운로드, 복원, 데이터 삭제 같은 운영 위험 작업의 실행 이력을 확인합니다.</p>
            <button
              class="outline-button"
              data-system-audit-log-action="refresh"
              type="button"
              ${isLoading ? "disabled" : ""}
            >
              ${isLoading ? "불러오는 중..." : "새로고침"}
            </button>
          </div>
        `}

      <div class="system-audit-log-summary">
        <span>최근 ${escapeHtml(String(rows.length))}건 / 최대 ${escapeHtml(String(limit))}건</span>
        <span>${escapeHtml(lastLoadedAt ? `마지막 조회 ${lastLoadedAt}` : hasLoaded ? "조회 완료" : "아직 조회되지 않았습니다.")}</span>
      </div>

      ${rows.length === 0
        ? `
          <section class="empty-state system-audit-log-empty-state">
            <div>
              <strong>${escapeHtml(isLoading ? "감사 로그를 불러오는 중입니다." : hasLoaded ? "표시할 감사 로그가 없습니다." : "감사 로그를 불러오지 않았습니다.")}</strong>
              <p>${escapeHtml(isLoading ? "잠시만 기다려 주세요." : "새로고침 버튼을 눌러 최신 로그를 확인하세요.")}</p>
            </div>
          </section>
        `
        : `
          <div class="system-audit-log-list">
            ${rows
              .map((row) => {
                const actionLabel = getSystemAuditLogActionLabel(row?.actionType);
                const scopeLabel = getSystemAuditLogScopeLabel(row?.targetScope);
                const detailItems = buildSystemAuditLogDetailItems(row);
                const detailsText = formatSystemAuditLogDetails(row?.details);
                const isFailed = String(row?.actionType || "").trim().endsWith("_failed");
                const accountLabel = row?.accountName
                  ? `${String(row.accountName)} (${String(row?.accountId || "-")})`
                  : String(row?.accountId || "-");

                return `
                  <article class="field system-settings-field system-audit-log-entry${isFailed ? " is-failed" : ""}">
                    <div class="system-audit-log-entry-head">
                      <div class="system-audit-log-entry-copy">
                        <strong>${escapeHtml(String(row?.summaryText || actionLabel || "감사 로그"))}</strong>
                        <div class="system-audit-log-entry-meta">
                          <span>${escapeHtml(String(row?.createdAt || "-"))}</span>
                          <span>${escapeHtml(accountLabel)}</span>
                          <span>${escapeHtml(String(row?.accountRole || "-"))}</span>
                        </div>
                      </div>
                      <div class="system-audit-log-entry-badges">
                        <span class="system-audit-log-badge${isFailed ? " is-failed" : ""}">${escapeHtml(actionLabel)}</span>
                        ${scopeLabel ? `<span class="system-audit-log-badge is-neutral">${escapeHtml(scopeLabel)}</span>` : ""}
                      </div>
                    </div>
                    <div class="system-audit-log-entry-foot">
                      <span>${escapeHtml(`IP ${String(row?.ipAddress || "-")}`)}</span>
                      ${row?.userAgent
                        ? `<span class="system-audit-log-user-agent" title="${escapeAttribute(String(row.userAgent || ""))}">${escapeHtml(`UA ${String(row.userAgent || "")}`)}</span>`
                        : ""}
                    </div>
                    ${detailItems.length > 0
                      ? `
                        <dl class="system-audit-log-detail-list">
                          ${detailItems
                            .map(
                              (detailItem) => `
                                <div class="system-audit-log-detail-item">
                                  <dt>${escapeHtml(String(detailItem.label || "-"))}</dt>
                                  <dd>${escapeHtml(String(detailItem.value || "-"))}</dd>
                                </div>
                              `,
                            )
                            .join("")}
                        </dl>
                      `
                      : ""}
                    ${detailsText
                      ? `
                        <details class="system-audit-log-details">
                          <summary>원본 로그 데이터</summary>
                          <pre>${escapeHtml(detailsText)}</pre>
                        </details>
                      `
                      : ""}
                  </article>
                `;
              })
              .join("")}
          </div>
        `}

      <p class="system-settings-status${statusClass}${auditLogState.statusMessage ? "" : " hidden"}" id="systemAuditLogStatus">
        ${escapeHtml(String(auditLogState.statusMessage || ""))}
      </p>
    `;
  }

  function renderSystemAuditLog() {
    return `
      <section class="view-stack system-settings-view">
        <article class="form-card">
          ${renderSystemAuditLogContent({ showPageHeader: true })}
        </article>
      </section>
    `;
  }

  function renderSystemAuditLogModalContent() {
    return renderSystemAuditLogContent({ showPageHeader: false });
  }

  function renderSystemDataDeletion() {
    const isSavingSystemSettings = state.systemSettings.isSaving;
    const isSavingSuperAdmin = state.superAdmin?.isSaving === true || Boolean(String(state.superAdmin?.uploadingField || "").trim());
    const isBackingUp = Boolean(state.systemDataDeletion.isBackingUp);
    const isDeletingSystemData = state.systemDataDeletion.isDeleting;
    const isRestoringSystemData = Boolean(state.systemDataDeletion.isRestoring);
    const isBusyWithSystemData = isSavingSystemSettings || isSavingSuperAdmin || isDeletingSystemData || isBackingUp || isRestoringSystemData;
    const deleteStatusClass = state.systemDataDeletion.statusType === "warning" ? " warning" : "";
    const lastBackupDownloadedAt = String(state.systemDataDeletion.lastBackupDownloadedAt || "").trim();
    const dataDeleteItems = getSystemDataDeleteItems();
    const allDataDeleteItem = dataDeleteItems.find((item) => item.scope === "all") || null;
    const scopedDeleteItems = dataDeleteItems.filter((item) => item.scope !== "all");

    function renderDeleteCard(item, { emphasized = false } = {}) {
      const isDeletingCurrentItem = isDeletingSystemData && state.systemDataDeletion.activeScope === item.scope;
      const buttonLabel = `${item.title} ${isDeletingCurrentItem ? "삭제 중" : "삭제"}`;

      return `
        <div class="field system-settings-field system-data-delete-card${emphasized ? " system-data-delete-card-all" : ""}">
          <div class="system-data-delete-card-layout${emphasized ? " is-emphasized" : ""}">
            <div class="system-settings-field-head system-data-delete-card-head">
              <span class="system-settings-label">${item.title}</span>
              <small class="muted system-settings-help">${item.description}</small>
            </div>
            <div class="system-data-delete-card-action">
              <button
                class="icon-button danger-button system-data-delete-button${isDeletingCurrentItem ? " is-loading" : ""}"
                data-system-data-delete="${item.scope}"
                type="button"
                aria-label="${escapeAttribute(buttonLabel)}"
                title="${escapeAttribute(buttonLabel)}"
                ${isBusyWithSystemData ? "disabled" : ""}
              >
                <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4.5 7.5h15"></path>
                  <path d="M9.5 7.5V5.75a1.25 1.25 0 0 1 1.25-1.25h2.5a1.25 1.25 0 0 1 1.25 1.25V7.5"></path>
                  <path d="M7.5 7.5v11a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5v-11"></path>
                  <path d="M10 11v5.5"></path>
                  <path d="M14 11v5.5"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <section class="view-stack system-settings-view">
        <article class="form-card">
          <div class="section-header">
            <div class="menu-section-copy">
              <h3>데이터 삭제</h3>
              <p>운영 데이터를 범위별로 삭제합니다. 삭제된 데이터는 복구할 수 없습니다.</p>
            </div>
          </div>

          <div class="system-data-delete-guard-hint">
            <strong>전체 데이터 삭제 안전장치</strong>
            <span>${escapeHtml(lastBackupDownloadedAt ? `최근 백업 ZIP 다운로드: ${lastBackupDownloadedAt}` : "최근 백업 ZIP 다운로드 기록이 없습니다.")}</span>
            <span>전체 데이터 삭제 시 확인 문구와 현재 비밀번호를 다시 입력해야 합니다.</span>
          </div>

          <div class="system-settings-form system-data-delete-form">
            <div class="system-data-delete-grid">
              ${scopedDeleteItems.map((item) => renderDeleteCard(item)).join("")}
            </div>
            ${allDataDeleteItem
              ? `
                <div class="system-data-delete-all-wrap">
                  ${renderDeleteCard(allDataDeleteItem, { emphasized: true })}
                </div>
              `
              : ""}
          </div>

          <p class="system-data-delete-status${deleteStatusClass}${state.systemDataDeletion.statusMessage ? "" : " hidden"}" id="systemDataDeletionStatus">
            ${escapeHtml(state.systemDataDeletion.statusMessage)}
          </p>
        </article>
      </section>
    `;
  }

  function formatSystemBackupByteSize(totalBytes = 0) {
    const normalizedBytes = Number(totalBytes || 0);

    if (!Number.isFinite(normalizedBytes) || normalizedBytes <= 0) {
      return "0B";
    }

    if (normalizedBytes >= 1024 * 1024) {
      return `${(normalizedBytes / (1024 * 1024)).toFixed(normalizedBytes >= 1024 * 1024 * 10 ? 0 : 1)}MB`;
    }

    if (normalizedBytes >= 1024) {
      return `${(normalizedBytes / 1024).toFixed(normalizedBytes >= 1024 * 10 ? 0 : 1)}KB`;
    }

    return `${Math.round(normalizedBytes)}B`;
  }

  function formatSystemBackupDeltaLabel(delta = 0, unit = "건") {
    const normalizedDelta = Math.round(Number(delta || 0));

    if (!Number.isFinite(normalizedDelta)) {
      return "";
    }

    if (normalizedDelta === 0) {
      return "변동 없음";
    }

    return `${normalizedDelta > 0 ? "+" : ""}${normalizedDelta}${unit}`;
  }

  function getSystemBackupComparisonAssetEntry(summary = null, itemKey = "") {
    const normalizedItemKey = String(itemKey || "").trim();

    if (!normalizedItemKey) {
      return null;
    }

    return (
      (Array.isArray(summary?.comparison?.assets) ? summary.comparison.assets : []).find(
        (asset) => String(asset?.assetKey || "").trim() === normalizedItemKey,
      ) || null
    );
  }

  function getSystemBackupRestoreDetailText(item = {}, restoreValidationSummary = null, isAvailable = false) {
    if (!restoreValidationSummary || !item?.itemKey) {
      return "";
    }

    if (!isAvailable) {
      return "백업 ZIP에 포함되지 않은 항목입니다.";
    }

    if (item.itemKey === "database") {
      const databaseComparison =
        restoreValidationSummary?.comparison?.database && typeof restoreValidationSummary.comparison.database === "object"
          ? restoreValidationSummary.comparison.database
          : {};

      return `현재 ${Number(databaseComparison.currentRowCount || 0)}건 -> 복원 ${Number(databaseComparison.backupRowCount || 0)}건`;
    }

    const comparisonAsset = getSystemBackupComparisonAssetEntry(restoreValidationSummary, item.itemKey) || {};

    return `현재 ${Number(comparisonAsset.currentFileCount || 0)}건 -> 복원 ${Number(comparisonAsset.backupFileCount || 0)}건`;
  }

  function renderSystemBackupRestoreComparison(restoreValidationSummary = null) {
    if (!restoreValidationSummary) {
      return "";
    }

    const currentState =
      restoreValidationSummary?.currentState && typeof restoreValidationSummary.currentState === "object"
        ? restoreValidationSummary.currentState
        : {};
    const databaseComparison =
      restoreValidationSummary?.comparison?.database && typeof restoreValidationSummary.comparison.database === "object"
        ? restoreValidationSummary.comparison.database
        : {};
    const assetComparisons = Array.isArray(restoreValidationSummary?.comparison?.assets)
      ? restoreValidationSummary.comparison.assets
      : [];

    return `
      <div class="system-backup-restore-comparison">
        <article class="system-backup-restore-comparison-card${databaseComparison.included === false ? " is-neutral" : ""}">
          <strong>데이터베이스</strong>
          <span>
            ${databaseComparison.included === false
              ? `현재 운영 데이터 유지 (${escapeHtml(String(Number(currentState.totalRowCount || 0)))}건)`
              : `현재 ${escapeHtml(String(Number(databaseComparison.currentRowCount || 0)))}건 -> 백업 ${escapeHtml(String(Number(databaseComparison.backupRowCount || 0)))}건`}
          </span>
          <span>
            ${databaseComparison.included === false
              ? "이 백업 ZIP에는 데이터베이스가 포함되지 않았습니다."
              : `테이블 ${escapeHtml(String(Number(databaseComparison.currentTableCount || 0)))}개 -> ${escapeHtml(String(Number(databaseComparison.backupTableCount || 0)))}개 · 행 ${escapeHtml(formatSystemBackupDeltaLabel(databaseComparison.rowDelta, "건"))}`}
          </span>
        </article>
        ${assetComparisons
          .map((asset) => {
            const currentSizeLabel = formatSystemBackupByteSize(asset?.currentTotalBytes || 0);
            const backupSizeLabel = formatSystemBackupByteSize(asset?.backupTotalBytes || 0);

            return `
              <article class="system-backup-restore-comparison-card${asset?.included === false ? " is-neutral" : ""}">
                <strong>${escapeHtml(String(asset?.title || asset?.assetKey || "-"))}</strong>
                <span>
                  ${asset?.included === false
                    ? `현재 운영 파일 유지 (${escapeHtml(String(Number(asset?.currentFileCount || 0)))}건)`
                    : `현재 ${escapeHtml(String(Number(asset?.currentFileCount || 0)))}건 -> 백업 ${escapeHtml(String(Number(asset?.backupFileCount || 0)))}건`}
                </span>
                <span>
                  ${asset?.included === false
                    ? "이 백업 ZIP에는 이 파일 종류가 포함되지 않았습니다."
                    : `용량 ${escapeHtml(currentSizeLabel)} -> ${escapeHtml(backupSizeLabel)} · 파일 ${escapeHtml(formatSystemBackupDeltaLabel(asset?.fileDelta || 0, "건"))}`}
                </span>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function formatSystemBackupAutomationTimestamp(value = "", emptyLabel = "기록 없음") {
    const normalizedValue = String(value || "").trim();
    return normalizedValue || emptyLabel;
  }

  function getSystemBackupAutomationWeekdayLabel(value = 1) {
    const normalizedValue = Math.round(Number(value));

    if (!Number.isFinite(normalizedValue) || normalizedValue < 0 || normalizedValue > 6) {
      return systemScheduleWeekdayLabels[1];
    }

    return systemScheduleWeekdayLabels[normalizedValue];
  }

  function renderSystemBackupAutomationRuntimeCards(backupAutomationState = {}) {
    const runtimeItems = [
      {
        label: "다음 실행",
        value: backupAutomationState.enabled
          ? formatSystemBackupAutomationTimestamp(backupAutomationState.nextRunAt, "계산 중")
          : "사용 안 함",
      },
      {
        label: "마지막 성공",
        value: formatSystemBackupAutomationTimestamp(backupAutomationState.lastSuccessAt),
      },
      {
        label: "마지막 실패",
        value: backupAutomationState.lastFailureAt
          ? formatSystemBackupAutomationTimestamp(backupAutomationState.lastFailureAt)
          : backupAutomationState.lastErrorMessage
            ? "최근 실패 없음"
            : "기록 없음",
      },
      {
        label: "최근 백업 파일",
        value: String(backupAutomationState.lastFileName || "").trim() || "기록 없음",
      },
    ];

    return `
      <div class="system-backup-automation-runtime-grid">
        ${runtimeItems
          .map(
            (item) => `
              <article class="system-backup-automation-runtime-card">
                <strong>${escapeHtml(item.label)}</strong>
                <span>${escapeHtml(item.value)}</span>
              </article>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function renderSystemBackupRestore() {
    const isSavingSystemSettings = state.systemSettings.isSaving;
    const isSavingSuperAdmin = state.superAdmin?.isSaving === true || Boolean(String(state.superAdmin?.uploadingField || "").trim());
    const backupAutomationState =
      state.systemDataDeletion?.backupAutomation && typeof state.systemDataDeletion.backupAutomation === "object"
        ? state.systemDataDeletion.backupAutomation
        : {};
    const isSavingBackupAutomation = backupAutomationState.isSaving === true;
    const isRunningBackupAutomation = backupAutomationState.isRunning === true;
    const isBackingUp = Boolean(state.systemDataDeletion.isBackingUp);
    const isDeletingSystemData = state.systemDataDeletion.isDeleting;
    const isRestoringSystemData = Boolean(state.systemDataDeletion.isRestoring);
    const isRestoreValidating = Boolean(state.systemDataDeletion.isRestoreValidating);
    const isBusyWithSystemData =
      isSavingSystemSettings ||
      isSavingSuperAdmin ||
      isSavingBackupAutomation ||
      isRunningBackupAutomation ||
      isDeletingSystemData ||
      isBackingUp ||
      isRestoringSystemData ||
      isRestoreValidating;
    const statusClass = state.systemDataDeletion.statusType === "warning" ? " warning" : "";
    const backupAutomationStatusClass = backupAutomationState.statusType === "warning" ? " warning" : "";
    const backupItems = getSystemBackupItems();
    const backupAssetSelections =
      state.systemDataDeletion.backupAssetSelections && typeof state.systemDataDeletion.backupAssetSelections === "object"
        ? state.systemDataDeletion.backupAssetSelections
        : {};
    const selectedBackupAssetCount = backupItems.filter((item) => backupAssetSelections[item.itemKey] !== false).length;
    const backupAutomationSelectedItemCount =
      (backupAutomationState.includeDatabase !== false ? 1 : 0) +
      (Array.isArray(backupAutomationState.includedAssetKeys) ? backupAutomationState.includedAssetKeys.length : 0);
    const restoreItems = getSystemBackupRestoreItems();
    const restoreFileName = String(state.systemDataDeletion.restoreFileName || "").trim();
    const isRestoreFileValid = state.systemDataDeletion.isRestoreFileValid === true;
    const restoreValidationClass = state.systemDataDeletion.restoreValidationType === "warning" ? " warning" : isRestoreFileValid ? " success" : "";
    const restoreValidationMessage = String(state.systemDataDeletion.restoreValidationMessage || "").trim();
    const restoreValidationSummary =
      state.systemDataDeletion.restoreValidationSummary && typeof state.systemDataDeletion.restoreValidationSummary === "object"
        ? state.systemDataDeletion.restoreValidationSummary
        : null;
    const restoreSelections =
      state.systemDataDeletion.restoreSelections && typeof state.systemDataDeletion.restoreSelections === "object"
        ? state.systemDataDeletion.restoreSelections
        : {};
    const restoreAvailabilityByItemKey = restoreItems.reduce((availabilityMap, item) => {
      if (!restoreValidationSummary) {
        availabilityMap[item.itemKey] = false;
        return availabilityMap;
      }

      if (item.itemKey === "database") {
        availabilityMap[item.itemKey] = restoreValidationSummary?.databaseIncluded === true;
        return availabilityMap;
      }

      const matchingAsset =
        (Array.isArray(restoreValidationSummary?.assets) ? restoreValidationSummary.assets : []).find(
          (asset) => String(asset?.assetKey || "").trim() === item.itemKey,
        ) || null;
      availabilityMap[item.itemKey] = matchingAsset?.included !== false;
      return availabilityMap;
    }, {});
    const availableRestoreItemCount = restoreItems.filter((item) => restoreAvailabilityByItemKey[item.itemKey]).length;
    const selectedRestoreItemCount = restoreItems.filter(
      (item) => restoreAvailabilityByItemKey[item.itemKey] && restoreSelections[item.itemKey] !== false,
    ).length;
    const restoreProgressPercent = Math.max(0, Math.min(100, Number(state.systemDataDeletion.restoreUploadProgressPercent || 0)));
    const restoreProgressLabel = String(state.systemDataDeletion.restoreUploadProgressLabel || "").trim();

    return `
      <section class="view-stack system-settings-view">
        <article class="form-card">
          <div class="section-header">
            <div class="menu-section-copy">
              <h3>백업 및 복구</h3>
              <p>운영 데이터와 업로드 파일을 ZIP으로 백업하거나, 백업 ZIP 기준으로 전체 시스템을 복원합니다.</p>
            </div>
            <div class="inline-actions">
              <button
                class="outline-button"
                data-system-audit-log-action="open"
                type="button"
                ${isBusyWithSystemData ? "disabled" : ""}
              >
                감사 로그
              </button>
            </div>
          </div>

          <div class="system-settings-form system-backup-restore-form">
            <div class="field system-settings-field system-backup-restore-card">
              <div class="system-settings-field-head">
                <span class="system-settings-label">시스템 백업 다운로드</span>
                <small class="muted system-settings-help">데이터베이스와 파일 종류를 선택해서 ZIP에 포함할 수 있습니다.</small>
              </div>
              <div class="system-backup-restore-selection-meta">
                선택된 백업 항목 ${escapeHtml(String(selectedBackupAssetCount))}개 / ${escapeHtml(String(backupItems.length))}개
              </div>
              <div class="system-backup-restore-asset-list" role="group" aria-label="백업 항목 선택">
                ${backupItems
                  .map(
                    (item) => `
                      <label class="system-backup-restore-asset-option">
                        <input
                          class="system-backup-restore-asset-checkbox"
                          type="checkbox"
                          data-system-backup-asset-key="${escapeAttribute(item.itemKey)}"
                          ${backupAssetSelections[item.itemKey] !== false ? "checked" : ""}
                          ${isBusyWithSystemData ? "disabled" : ""}
                        />
                        <span class="system-backup-restore-asset-copy">
                          <strong>${escapeHtml(item.title)}</strong>
                          <span>${escapeHtml(item.description)}</span>
                        </span>
                      </label>
                    `,
                  )
                  .join("")}
              </div>
              <div class="system-backup-restore-action-row">
                <button
                  class="primary-button system-backup-restore-download-button${isBackingUp ? " is-loading" : ""}"
                  data-system-data-backup="export"
                  type="button"
                  ${isBusyWithSystemData || selectedBackupAssetCount === 0 ? "disabled" : ""}
                >
                  ${isBackingUp ? "백업 ZIP 생성 중..." : "백업 ZIP 다운로드"}
                </button>
              </div>
            </div>

            <div class="field system-settings-field system-backup-restore-card system-backup-automation-card">
              <div class="system-settings-field-head">
                <span class="system-settings-label">자동 백업</span>
                <small class="muted system-settings-help">매일 또는 매주 정해진 시각에 서버 내부 보관용 백업 ZIP을 생성합니다. 보관 개수를 넘기면 오래된 ZIP부터 자동으로 정리합니다.</small>
              </div>
              <label class="super-admin-switch system-backup-automation-switch" for="systemBackupAutomationEnabled">
                <input
                  class="sr-only"
                  id="systemBackupAutomationEnabled"
                  type="checkbox"
                  data-system-backup-automation-field="enabled"
                  ${backupAutomationState.enabled === true ? "checked" : ""}
                  ${isBusyWithSystemData ? "disabled" : ""}
                />
                <span class="super-admin-switch-track" aria-hidden="true">
                  <span class="super-admin-switch-thumb"></span>
                </span>
                <span class="super-admin-switch-copy">
                  <strong>${backupAutomationState.enabled === true ? "자동 백업 사용" : "자동 백업 사용 안 함"}</strong>
                  <span>${backupAutomationState.enabled === true ? "설정한 주기와 시각에 백업 ZIP을 생성합니다." : "수동 백업만 사용할 수 있습니다."}</span>
                </span>
              </label>
              <div class="system-backup-automation-config-grid">
                <label class="field system-backup-automation-field">
                  <span class="system-settings-label">주기</span>
                  <select
                    class="system-settings-input"
                    data-system-backup-automation-field="scheduleType"
                    ${isBusyWithSystemData ? "disabled" : ""}
                  >
                    <option value="daily" ${String(backupAutomationState.scheduleType || "").trim() !== "weekly" ? "selected" : ""}>매일</option>
                    <option value="weekly" ${String(backupAutomationState.scheduleType || "").trim() === "weekly" ? "selected" : ""}>매주</option>
                  </select>
                </label>
                <label class="field system-backup-automation-field">
                  <span class="system-settings-label">실행 시각</span>
                  <input
                    class="system-settings-input"
                    type="time"
                    value="${escapeAttribute(String(backupAutomationState.time || "03:00"))}"
                    data-system-backup-automation-field="time"
                    ${isBusyWithSystemData ? "disabled" : ""}
                  />
                </label>
                <label class="field system-backup-automation-field">
                  <span class="system-settings-label">보관 개수</span>
                  <input
                    class="system-settings-input system-settings-number-input"
                    type="number"
                    min="1"
                    max="30"
                    value="${escapeAttribute(String(backupAutomationState.retentionCount || 7))}"
                    data-system-backup-automation-field="retentionCount"
                    ${isBusyWithSystemData ? "disabled" : ""}
                  />
                </label>
                <label class="field system-backup-automation-field${String(backupAutomationState.scheduleType || "").trim() === "weekly" ? "" : " is-disabled"}">
                  <span class="system-settings-label">요일</span>
                  <select
                    class="system-settings-input"
                    data-system-backup-automation-field="weeklyDay"
                    ${String(backupAutomationState.scheduleType || "").trim() === "weekly" ? "" : "disabled"}
                    ${isBusyWithSystemData ? "disabled" : ""}
                  >
                    ${systemScheduleWeekdayLabels
                      .map(
                        (weekdayLabel, weekdayIndex) => `
                          <option value="${escapeAttribute(String(weekdayIndex))}" ${Number(backupAutomationState.weeklyDay || 0) === weekdayIndex ? "selected" : ""}>
                            매주 ${escapeHtml(weekdayLabel)}요일
                          </option>
                        `,
                      )
                      .join("")}
                  </select>
                </label>
              </div>
              <div class="system-backup-automation-summary">
                <span>선택 항목 ${escapeHtml(String(backupAutomationSelectedItemCount))}개 / ${escapeHtml(String(backupItems.length))}개</span>
                <span>
                  ${escapeHtml(
                    String(backupAutomationState.scheduleType || "").trim() === "weekly"
                      ? `매주 ${getSystemBackupAutomationWeekdayLabel(backupAutomationState.weeklyDay)}요일 ${String(backupAutomationState.time || "03:00")}`
                      : `매일 ${String(backupAutomationState.time || "03:00")}`,
                  )}
                </span>
              </div>
              <div class="system-backup-restore-asset-list" role="group" aria-label="자동 백업 항목 선택">
                ${backupItems
                  .map((item) => {
                    const isChecked =
                      item.itemKey === "database"
                        ? backupAutomationState.includeDatabase !== false
                        : Array.isArray(backupAutomationState.includedAssetKeys) && backupAutomationState.includedAssetKeys.includes(item.itemKey);

                    return `
                      <label class="system-backup-restore-asset-option">
                        <input
                          class="system-backup-restore-asset-checkbox"
                          type="checkbox"
                          data-system-backup-automation-item-key="${escapeAttribute(item.itemKey)}"
                          ${isChecked ? "checked" : ""}
                          ${isBusyWithSystemData ? "disabled" : ""}
                        />
                        <span class="system-backup-restore-asset-copy">
                          <strong>${escapeHtml(item.title)}</strong>
                          <span>${escapeHtml(item.description)}</span>
                        </span>
                      </label>
                    `;
                  })
                  .join("")}
              </div>
              ${renderSystemBackupAutomationRuntimeCards(backupAutomationState)}
              ${String(backupAutomationState.lastErrorMessage || "").trim()
                ? `<p class="system-backup-automation-error">${escapeHtml(String(backupAutomationState.lastErrorMessage || ""))}</p>`
                : ""}
              <div class="system-backup-restore-action-row">
                <button
                  class="outline-button"
                  data-system-backup-automation-action="run-now"
                  type="button"
                  ${isBusyWithSystemData || backupAutomationState.hasUnsavedChanges ? "disabled" : ""}
                >
                  ${isRunningBackupAutomation ? "자동 백업 실행 중..." : "지금 한 번 실행"}
                </button>
                <button
                  class="primary-button"
                  data-system-backup-automation-action="save"
                  type="button"
                  ${backupAutomationState.hasUnsavedChanges ? "" : "disabled"}
                  ${isBusyWithSystemData ? "disabled" : ""}
                >
                  ${isSavingBackupAutomation ? "저장 중..." : "자동 백업 설정 저장"}
                </button>
              </div>
              <p class="system-settings-status${backupAutomationStatusClass}${backupAutomationState.statusMessage ? "" : " hidden"}" id="systemBackupAutomationStatus">
                ${escapeHtml(String(backupAutomationState.statusMessage || ""))}
              </p>
            </div>

            <div class="field system-settings-field system-backup-restore-card system-backup-restore-card-danger">
              <div class="system-settings-field-head">
                <span class="system-settings-label">시스템 백업 복원</span>
                <small class="muted system-settings-help">백업 ZIP을 선택하면 즉시 유효성을 검사합니다. 검증이 끝나면 데이터베이스와 파일 종류를 선택해서 복원할 수 있습니다.</small>
              </div>
              <div class="system-backup-restore-file-row">
                <label class="outline-button system-backup-restore-file-button" for="systemBackupRestoreFileInput">
                  백업 ZIP 선택
                  <input
                    class="sr-only"
                    id="systemBackupRestoreFileInput"
                    type="file"
                    accept=".zip,application/zip"
                    data-system-backup-restore-file="true"
                    ${isBusyWithSystemData ? "disabled" : ""}
                  />
                </label>
                <strong class="system-backup-restore-file-name${restoreFileName ? "" : " is-empty"}">
                  ${escapeHtml(restoreFileName || "선택된 백업 ZIP이 없습니다.")}
                </strong>
              </div>
              ${isRestoringSystemData || isRestoreValidating || restoreProgressLabel
                ? `
                  <div class="system-backup-restore-progress" role="status" aria-live="polite">
                    <div class="system-backup-restore-progress-track" aria-hidden="true">
                      <span class="system-backup-restore-progress-fill" style="width:${escapeAttribute(String(restoreProgressPercent))}%"></span>
                    </div>
                    <span class="system-backup-restore-progress-label">${escapeHtml(restoreProgressLabel || "백업 ZIP을 처리하고 있습니다.")}</span>
                  </div>
                `
                : ""}
              ${restoreValidationMessage
                ? `
                  <p class="system-backup-restore-validation${restoreValidationClass}">
                    ${escapeHtml(restoreValidationMessage)}
                  </p>
                `
                : ""}
              ${restoreValidationSummary
                ? `
                  <div class="system-backup-restore-summary">
                    <div class="system-backup-restore-summary-meta">
                      <span>생성 시각 ${escapeHtml(String(restoreValidationSummary.createdAtLabel || "-"))}</span>
                      <span>DB ${escapeHtml(String(restoreValidationSummary.databaseName || "-"))}</span>
                      <span>테이블 ${escapeHtml(String(restoreValidationSummary.tableCount || 0))}개</span>
                      <span>데이터 ${escapeHtml(String(restoreValidationSummary.totalRowCount || 0))}건</span>
                      <span data-backup-member-summary>${restoreValidationSummary.databaseIncluded ? `회원 현재 ${escapeHtml(String(restoreValidationSummary.currentMemberCount || 0))}명 → 복원 ${escapeHtml(String(restoreValidationSummary.memberCount || 0))}명` : '회원 데이터 미포함'}</span>
                    </div>
                    <div class="system-backup-restore-summary-assets">
                      ${(Array.isArray(restoreValidationSummary.assets) ? restoreValidationSummary.assets : [])
                        .map(
                          (asset) => `
                            <span class="system-backup-restore-summary-asset${asset?.included === false ? " is-excluded" : ""}">
                              ${escapeHtml(String(asset?.title || asset?.assetKey || "-"))}
                              ${asset?.included === false
                                ? " 미포함"
                                : ` ${escapeHtml(String(asset?.fileCount || 0))}건`}
                            </span>
                          `,
                        )
                        .join("")}
                    </div>
                  </div>
                  ${renderSystemBackupRestoreComparison(restoreValidationSummary)}
                `
                : ""}
              ${restoreValidationSummary
                ? `
                  <div class="system-backup-restore-selection-meta">
                    선택된 복원 항목 ${escapeHtml(String(selectedRestoreItemCount))}개 / ${escapeHtml(String(availableRestoreItemCount))}개
                  </div>
                  <div class="system-backup-restore-asset-list" role="group" aria-label="복원 항목 선택">
                    ${restoreItems
                      .map((item) => {
                        const isAvailable = restoreAvailabilityByItemKey[item.itemKey] === true;
                        const isSelected = isAvailable && restoreSelections[item.itemKey] !== false;
                        const matchingAsset =
                          item.itemKey === "database"
                            ? null
                            : (Array.isArray(restoreValidationSummary.assets) ? restoreValidationSummary.assets : []).find(
                                (asset) => String(asset?.assetKey || "").trim() === item.itemKey,
                              ) || null;
                        const detailText = getSystemBackupRestoreDetailText(item, restoreValidationSummary, isAvailable);

                        return `
                          <label class="system-backup-restore-asset-option${isAvailable ? "" : " is-disabled"}">
                            <input
                              class="system-backup-restore-asset-checkbox"
                              type="checkbox"
                              data-system-backup-restore-item-key="${escapeAttribute(item.itemKey)}"
                              ${isSelected ? "checked" : ""}
                              ${isBusyWithSystemData || !isAvailable ? "disabled" : ""}
                            />
                            <span class="system-backup-restore-asset-copy">
                              <strong>${escapeHtml(item.title)}</strong>
                              <span>${escapeHtml(item.description)}</span>
                              <span>${escapeHtml(detailText)}</span>
                              ${matchingAsset?.included !== false && item.itemKey !== "database"
                                ? `<span>백업 포함 파일 ${escapeHtml(String(matchingAsset?.fileCount || 0))}건</span>`
                                : ""}
                            </span>
                          </label>
                        `;
                      })
                      .join("")}
                  </div>
                `
                : ""}
              <div class="system-backup-restore-action-row">
                <button
                  class="ghost-button"
                  data-system-backup-restore="clear"
                  type="button"
                  ${!restoreFileName || isBusyWithSystemData ? "disabled" : ""}
                >
                  선택 해제
                </button>
                <button
                  class="primary-button system-backup-restore-apply-button${isRestoringSystemData ? " is-loading" : ""}"
                  data-system-backup-restore="import"
                  type="button"
                  ${!restoreFileName || isBusyWithSystemData || !isRestoreFileValid || selectedRestoreItemCount === 0 ? "disabled" : ""}
                >
                  ${isRestoringSystemData ? "복원 중..." : "복원 실행"}
                </button>
              </div>
            </div>
          </div>

          <p class="system-data-delete-status${statusClass}${state.systemDataDeletion.statusMessage ? "" : " hidden"}" id="systemBackupRestoreStatus">
            ${escapeHtml(state.systemDataDeletion.statusMessage)}
          </p>
        </article>
      </section>
    `;
  }

  function getApplicantPreviewHomeActionIconMarkup(iconKey = "") {
    if (iconKey === "apply") {
      return `
        <svg class="button-icon applicant-public-home-action-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="5" y="4" width="14" height="16" rx="2"></rect>
          <path d="M9 4h6"></path>
          <path d="M9 9h6"></path>
          <path d="M12 12v5"></path>
          <path d="M9.5 14.5h5"></path>
        </svg>
      `;
    }

    if (iconKey === "summary") {
      return `
        <svg class="button-icon applicant-public-home-action-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="5" y="4" width="14" height="16" rx="2"></rect>
          <path d="M9 9h6"></path>
          <path d="M9 13h3"></path>
          <path d="m10 16 1.8 1.8 3.2-3.3"></path>
        </svg>
      `;
    }

    return `
      <svg class="button-icon applicant-public-home-action-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 9a2 2 0 0 0 0 4v2.5A1.5 1.5 0 0 0 6.5 17h11a1.5 1.5 0 0 0 1.5-1.5V13a2 2 0 0 0 0-4V8.5A1.5 1.5 0 0 0 17.5 7h-11A1.5 1.5 0 0 0 5 8.5z"></path>
        <path d="M12 7v10"></path>
        <path d="M9 10h6"></path>
      </svg>
    `;
  }

  function renderApplicantPreviewHomeActionButtonLabel(label = "", iconKey = "") {
    return `${getApplicantPreviewHomeActionIconMarkup(iconKey)}<span>${escapeHtml(label)}</span>`;
  }

  function getAuthRenderers() {
    return globalThis.AdmitCardAuthRenderers || {};
  }

  function getActiveNoticeScope() {
    return state.noticeManagement?.activeScope === "applicant" ? "applicant" : "login";
  }

  function getActiveNoticeScopeLabel() {
    return getActiveNoticeScope() === "applicant" ? "수험생 로그인 후" : "공통 로그인";
  }

  function renderLoginNoticeEditorToolbar(defaultFontFamily, defaultFontSize) {
    return renderEditorToolbar({
      toolbarClassName: "login-notice-editor-toolbar",
      ariaLabel: "공지사항 편집 도구",
      commandAttr: "data-notice-command",
      commandSelectAttr: "data-notice-command",
      actionAttr: "data-notice-action",
      tableActionAttr: "data-notice-table-action",
      insertAttr: "data-notice-insert",
      openImageAttr: "data-notice-open-image",
      showLinkAction: true,
      tableInsertLocation: "table-add-section",
      tableLayout: "notice",
      fontFamilyId: "loginNoticeFontFamily",
      fontFamilyValue: defaultFontFamily,
      fontSizeId: "loginNoticeFontSize",
      fontSizeValue: defaultFontSize,
      textColorId: "loginNoticeTextColor",
      textColorValue: typeof EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR === "string" ? EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR : "#152033",
      textShadingId: "loginNoticeTextShading",
      cellShadingId: "loginNoticeCellShading",
      tableInsertPanelId: "loginNoticeTableInsertPanel",
      tableRowsId: "loginNoticeTableRows",
      tableColumnsId: "loginNoticeTableColumns",
      cellSplitPanelId: "loginNoticeCellSplitPanel",
      cellSplitCountId: "loginNoticeCellSplitCount",
      cellSplitAxisName: "loginNoticeCellSplitAxis",
      cellSplitAxisRowId: "loginNoticeCellSplitAxisRow",
      cellSplitAxisColumnId: "loginNoticeCellSplitAxisColumn",
      borderTargetId: "loginNoticeBorderTarget",
      borderStyleId: "loginNoticeBorderStyle",
      borderWidthId: "loginNoticeBorderWidth",
      borderColorId: "loginNoticeBorderColor",
      imageInputId: "loginNoticeImageInput",
    });
  }

  function renderLoginNoticeSettings() {
    const defaultFontFamily = getLoginNoticeDefaultFontFamily();
    const defaultFontSize = getLoginNoticeDefaultFontSize();
    const { renderLoginStage } = getAuthRenderers();
    const activeScope = getActiveNoticeScope();
    const activeLanguage = state.noticeManagement.activeLanguage === "en" ? "en" : "ko";
    const noticeTabs = [
      { key: "login", label: "공통 로그인 공지" },
      { key: "applicant", label: "수험생 로그인 후 공지" },
    ];
    const renderCanvas = (language) => {
      const languageLabel = language === "en" ? "영어" : "한국어";
      const notice = (language === "en" ? state.noticeManagement.englishScopes : state.noticeManagement.scopes)[activeScope];
      const editorId = language === "en" ? "loginNoticeEditorEn" : "loginNoticeEditor";
      const editorAttributes = `data-notice-editor-language="${language}" contenteditable="true" spellcheck="false" lang="${language}" role="textbox" aria-multiline="true" aria-label="${languageLabel} 공지사항 내용"`;
      const renderApplicantNoticePreview = () => `
        <section class="login-shell login-notice-editor-stage applicant-notice-editor-stage">
          <header class="public-glass-intro">
            <div class="applicant-public-brand login-stage-brand">
              <img class="applicant-public-brand-mark" src="${escapeAttribute(globalThis.AdmitCardAppConfig.resolveSuperAdminLogoImageUrl(state.superAdmin || {}))}" alt="" />
              <div class="applicant-public-brand-copy login-stage-brand-copy"><strong>원서접수시스템</strong></div><applyhub-theme-toggle disabled></applyhub-theme-toggle>
            </div>
          </header>
          ${globalThis.AdmitCardApplicantPublicRenderingHelpers.renderCompactNotice({ html: buildLoginNoticeEditorMarkup(notice.draftHtml), cardClassName: 'applicant-public-hero', contentClassName: 'template-editor-surface login-notice-editor-surface applicant-public-notice-surface', contentId: editorId, contentAttributes: editorAttributes, editing: true })}

          <article class="applicant-public-panel applicant-public-action-grid login-panel-card login-stage-panel applicant-notice-stage-panel">
            <div class="applicant-member-welcome"><span>나의 접수 메뉴</span><button class="ghost-button" type="button" disabled>로그아웃</button></div>
            <div class="applicant-member-menu">
              ${["원서접수", "서류 제출", "서류 제출 확인", "접수결과 조회", "수험표 조회"].filter((label, index) => index !== 0 || state.superAdmin?.savedSnapshot?.recruitmentEnabled !== false).map((label, index) => `<button class="ghost-button applicant-member-tile" type="button" disabled><span class="applicant-member-tile-number">0${index + 1}</span><strong>${label}</strong></button>`).join("")}
            </div>
          </article>
          <p class="login-shell-copyright">ApplyHub · 원서접수시스템<br>© 2026 U-PLUS SYSTEM</p>
        </section>
      `;
      const previewMarkup =
        activeScope === "applicant"
          ? renderApplicantNoticePreview()
          : renderLoginStage({
              noticeHtml: notice.draftHtml,
              heading: "로그인",
              description: "관리자와 수험생이 함께 사용하는 로그인 화면입니다.",
              submitLabel: "로그인",
              accountIdValue: "",
              passwordValue: "",
              shellClassName: "login-notice-editor-stage",
              panelClassName: "login-notice-stage-panel",
              noticeContentClassName: "template-editor-surface login-notice-editor-surface",
              noticeContentId: editorId,
              noticeContentAttributes: editorAttributes,
              useEditorMarkup: true,
            });

      return `<section class="notice-language-canvas ${activeLanguage === language ? 'is-active' : ''}" data-notice-canvas="${language}" aria-labelledby="noticeCanvasHeading-${language}">
        <header class="notice-canvas-header">
          <h4 id="noticeCanvasHeading-${language}">${language === 'en' ? 'English · 영어' : '한국어'}</h4>
          <button class="primary-button" data-notice-action="save" type="button">${languageLabel} 저장</button>
        </header>
        <div class="notice-canvas-preview">${previewMarkup}</div>
      </section>`;
    };

    return `
      <section class="view-stack login-notice-settings-stack">
        <article class="form-card">
          <div class="section-header">
            <div class="menu-section-copy">
              <h3>공지사항 설정</h3>
              <p>화면별로 한국어와 영어 공지를 각각 작성합니다. 영어 공지가 없으면 한국어 공지가 표시됩니다.</p>
            </div>
          </div>
          <div class="template-management-tabs notice-settings-tabs" role="tablist" aria-label="공지사항 화면 선택">
            ${noticeTabs
              .map(
                (tab) => `
                  <button
                    class="template-management-tab ${activeScope === tab.key ? "active" : ""}"
                    data-notice-scope="${escapeAttribute(tab.key)}"
                    type="button"
                    role="tab"
                    aria-selected="${activeScope === tab.key ? "true" : "false"}"
                  >
                    ${escapeHtml(tab.label)}
                  </button>
                `,
              )
              .join("")}
          </div>
          <p class="notice-language-description">편집할 공지를 클릭하면 공통 서식 도구가 적용됩니다. 작성한 내용은 각 캔버스에서 저장해 주세요.</p>
          <div class="login-notice-editor-shell notice-bilingual-shell">
            <div class="editor-toolbar-column login-notice-editor-toolbar-column">
              <p class="notice-active-label" data-notice-active-label aria-live="polite">${activeLanguage === 'en' ? '영어' : '한국어'} 서식 편집</p>
              ${renderLoginNoticeEditorToolbar(defaultFontFamily, defaultFontSize)}
            </div>

            <div class="notice-bilingual-canvases">
              ${renderCanvas('ko')}
              ${renderCanvas('en')}
            </div>
          </div>
        </article>
      </section>
    `;
  }

  function renderSystemSettings() {
    const isSaving = state.systemSettings.isSaving;
    const disabled = isSaving ? 'disabled' : '';
    const saveDisabled = !state.systemSettings.hasUnsavedChanges || isSaving || state.systemDataDeletion.isDeleting || state.systemDataDeletion.isBackingUp || state.systemDataDeletion.isRestoring;
    const components = Array.isArray(state.systemSettings.applicantExamNoComponents) ? state.systemSettings.applicantExamNoComponents : ['admissionCode', 'seriesCode', 'unitCode', 'sequence', ''];
    return `
      <section class="view-stack system-settings-view">
        <article class="form-card system-settings-basic-card">
          <div class="section-header">
            <div class="menu-section-copy"><h3>시스템 설정</h3><p>원서접수 운영에 필요한 기본 설정을 관리합니다.</p></div>
            <button class="primary-button system-settings-save-button" data-system-settings-action="save" type="button" ${saveDisabled ? 'disabled' : ''}>${isSaving ? '저장 중...' : '기본 설정 저장'}</button>
          </div>
          <div class="system-settings-layout">
            <section class="settings-group settings-group-school" aria-labelledby="settingsSchoolHeading">
              <h4 id="settingsSchoolHeading">입학처 홈페이지</h4>
              <label class="field" for="systemSettingsAdmissionHomepageUrl"><span>입학처 홈페이지</span>
                <input class="system-settings-input" id="systemSettingsAdmissionHomepageUrl" type="url" maxlength="500" value="${escapeAttribute(state.systemSettings.admissionHomepageUrl || '')}" placeholder="https://admission.example.ac.kr" autocomplete="off" ${disabled} />
              </label>
            </section>
            <section class="settings-group settings-group-security" aria-labelledby="settingsSecurityHeading">
              <h4 id="settingsSecurityHeading">계정·보안</h4>
              <div class="settings-field-pair">
                <label class="field" for="systemSettingsInitialPassword"><span>초기 비밀번호</span>
                  <input class="system-settings-input" id="systemSettingsInitialPassword" type="text" maxlength="100" value="${escapeAttribute(getSystemInitialPassword())}" autocomplete="off" ${disabled} />
                  <small class="muted">관리자 계정 생성·초기화에 사용</small>
                </label>
                <label class="field" for="systemSettingsAutoLogoutMinutes"><span>자동 로그아웃 (분)</span>
                  <input class="system-settings-input" id="systemSettingsAutoLogoutMinutes" type="number" min="0" max="${MAX_SYSTEM_AUTO_LOGOUT_MINUTES}" step="1" value="${escapeAttribute(String(state.systemSettings.autoLogoutMinutes))}" ${disabled} />
                  <small class="muted">0분이면 자동 로그아웃 안 함</small>
                </label>
              </div>
            </section>
            <section class="settings-group settings-group-exam" aria-labelledby="settingsExamHeading">
              <div class="settings-group-heading"><h4 id="settingsExamHeading">수험번호 생성</h4><small class="muted">전체 자리수와 코드·순번의 조합 순서를 설정합니다.</small></div>
              <div class="settings-exam-fields">
                <label class="field" for="systemSettingsApplicantExamNoDigitCount"><span>전체 자리수</span>
                  <input class="system-settings-input" id="systemSettingsApplicantExamNoDigitCount" type="number" min="1" max="30" step="1" value="${escapeAttribute(String(state.systemSettings.applicantExamNoDigitCount || 10))}" ${disabled} />
                </label>
                ${Array.from({length: 5}, (_, index) => `
                  <label class="field" for="systemSettingsApplicantExamNoComponent${index + 1}"><span>조합 ${index + 1}</span>
                    <select class="system-settings-input" id="systemSettingsApplicantExamNoComponent${index + 1}" data-system-settings-exam-component-index="${index}" ${disabled}>
                      ${applicantExamNoComponentOptions.map(option => `<option value="${escapeAttribute(option.key)}" ${String(components[index] || '') === option.key ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
                    </select>
                  </label>`).join('')}
              </div>
            </section>
          </div>
          <p class="system-settings-status${state.systemSettings.statusType === 'warning' ? ' warning' : ''}${state.systemSettings.statusMessage ? '' : ' hidden'}" id="systemSettingsStatus">${escapeHtml(state.systemSettings.statusMessage)}</p>
        </article>
        <applyhub-email-settings></applyhub-email-settings>
      </section>`;
  }

  function renderSuperAdminManagement() {
    const isSaving = state.superAdmin?.isSaving === true;
    const uploadingField = String(state.superAdmin?.uploadingField || "").trim();
    const isUploadingImage = Boolean(uploadingField);
    const hasUnsavedChanges = state.superAdmin?.hasUnsavedChanges === true;
    const statusClass = state.superAdmin?.statusType === "warning" ? " warning" : "";
    const isDeletingSystemData = state.systemDataDeletion.isDeleting;
    const isBackingUpSystemData = Boolean(state.systemDataDeletion.isBackingUp);
    const isRestoringSystemData = Boolean(state.systemDataDeletion.isRestoring);
    const schoolName = String(state.superAdmin?.schoolName || "");
    const logoImageUrl = resolveSuperAdminLogoImageUrl(state.superAdmin || {});
    const backgroundImageUrl = resolveSuperAdminBackgroundImageUrl(state.superAdmin || {});
    const hasCustomLogoImage = Boolean(String(state.superAdmin?.logoImageUrl || "").trim());
    const hasCustomBackgroundImage = Boolean(String(state.superAdmin?.backgroundImageUrl || "").trim());
    const recruitmentEnabled = state.superAdmin?.recruitmentEnabled !== false;
    const backgroundPreviewStyle = backgroundImageUrl
      ? ` style="background-image: url('${escapeAttribute(backgroundImageUrl)}');"`
      : "";

    return `
      <section class="view-stack super-admin-view">
        <article class="form-card">
          <div class="section-header">
            <div class="menu-section-copy">
              <h3>슈퍼관리자</h3>
              <p>로그인 화면 브랜딩과 접수 기능 노출 여부를 관리합니다.</p>
            </div>
            <div class="inline-actions">
              <button
                class="primary-button system-settings-save-button"
                data-super-admin-action="save"
                type="button"
                ${!hasUnsavedChanges || isSaving || isUploadingImage || isDeletingSystemData || isBackingUpSystemData || isRestoringSystemData ? "disabled" : ""}
              >
                ${isSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>

          <div class="super-admin-form">
            <section class="super-admin-setting-card">
              <div class="system-settings-section-head">
                <span class="system-settings-label">학교명 설정</span>
                <small class="muted system-settings-help">사용자 페이지 헤더에 표시되는 학교명을 설정합니다.</small>
              </div>
              <label class="field super-admin-text-field" for="superAdminSchoolName">
                <span>학교 이름</span>
                <input
                  class="system-settings-input"
                  id="superAdminSchoolName"
                  type="text"
                  maxlength="100"
                  value="${escapeAttribute(schoolName)}"
                  data-super-admin-field="schoolName"
                  autocomplete="off"
                />
              </label>
            </section>

            <section class="super-admin-setting-card">
              <div class="system-settings-section-head">
                <span class="system-settings-label">로고 이미지 설정</span>
                <small class="muted system-settings-help">기본 로고는 현재 로그인 화면에서 사용 중인 이미지를 그대로 사용합니다.</small>
              </div>
              <div class="super-admin-image-layout">
                <div class="super-admin-logo-preview">
                  <img src="${escapeAttribute(logoImageUrl)}" alt="로고 미리보기" />
                </div>
                <div class="super-admin-image-actions">
                  <label class="outline-button super-admin-upload-button" for="superAdminLogoImageInput">
                    ${uploadingField === "logoImageUrl" ? "업로드 중..." : "이미지 업로드"}
                    <input
                      class="sr-only"
                      id="superAdminLogoImageInput"
                      type="file"
                      accept="image/*"
                      data-super-admin-image="logoImageUrl"
                      ${isUploadingImage ? "disabled" : ""}
                    />
                  </label>
                  <button
                    class="ghost-button"
                    data-super-admin-image-reset="logoImageUrl"
                    type="button"
                    ${hasCustomLogoImage && !isUploadingImage ? "" : "disabled"}
                  >
                    기본값 사용
                  </button>
                </div>
              </div>
            </section>

            <section class="super-admin-setting-card">
              <div class="system-settings-section-head">
                <span class="system-settings-label">배경 이미지 설정</span>
                <small class="muted system-settings-help">업로드한 이미지를 로그인 화면 배경으로 사용합니다.</small>
              </div>
              <div class="super-admin-image-layout">
                <div class="super-admin-background-preview${backgroundImageUrl ? "" : " is-empty"}"${backgroundPreviewStyle}>
                  ${backgroundImageUrl ? "" : "<span>배경 이미지 미설정</span>"}
                </div>
                <div class="super-admin-image-actions">
                  <label class="outline-button super-admin-upload-button" for="superAdminBackgroundImageInput">
                    ${uploadingField === "backgroundImageUrl" ? "업로드 중..." : "이미지 업로드"}
                    <input
                      class="sr-only"
                      id="superAdminBackgroundImageInput"
                      type="file"
                      accept="image/*"
                      data-super-admin-image="backgroundImageUrl"
                      ${isUploadingImage ? "disabled" : ""}
                    />
                  </label>
                  <button
                    class="ghost-button"
                    data-super-admin-image-reset="backgroundImageUrl"
                    type="button"
                    ${hasCustomBackgroundImage && !isUploadingImage ? "" : "disabled"}
                  >
                    기본값 사용
                  </button>
                </div>
              </div>
            </section>

            <section class="super-admin-setting-card">
              <div class="system-settings-section-head">
                <span class="system-settings-label">접수 버튼 표시 여부</span>
                <small class="muted system-settings-help">사용자 홈 화면의 원서접수 버튼을 표시하거나 숨깁니다.</small>
              </div>
              <label class="super-admin-switch" for="superAdminRecruitmentEnabled">
                <input
                  class="sr-only"
                  id="superAdminRecruitmentEnabled"
                  type="checkbox"
                  data-super-admin-toggle="recruitmentEnabled"
                  ${recruitmentEnabled ? "checked" : ""}
                />
                <span class="super-admin-switch-track" aria-hidden="true">
                  <span class="super-admin-switch-thumb"></span>
                </span>
                <span class="super-admin-switch-copy">
                  <strong>${recruitmentEnabled ? "표시함" : "숨김"}</strong>
                  <span>${recruitmentEnabled ? "사용자 홈 화면에 원서접수 버튼을 표시합니다." : "사용자 홈 화면에서 원서접수 버튼을 숨깁니다."}</span>
                </span>
              </label>
            </section>
          </div>

          <p class="system-settings-status${statusClass}${state.superAdmin?.statusMessage ? "" : " hidden"}" id="superAdminStatus">
            ${escapeHtml(String(state.superAdmin?.statusMessage || ""))}
          </p>
        </article>
      </section>
    `;
  }

  return {
    renderLoginNoticeEditorToolbar,
    renderLoginNoticeSettings,
    renderSystemAuditLogModalContent,
    renderSystemAuditLog,
    renderSuperAdminManagement,
    renderSystemBackupRestore,
    renderSystemDataDeletion,
    renderSystemSettings,
  };
});
