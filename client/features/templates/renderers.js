(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalScope.AdmitCardApplicantFormConfig);
    return;
  }

  globalScope.AdmitCardTemplateManagementRenderers = factory(globalScope.AdmitCardApplicantFormConfig);
})(typeof globalThis !== "undefined" ? globalThis : this, (applicantFormConfig) => {
  const getApplicantAnswerTypeLabel =
    applicantFormConfig?.getApplicantAnswerTypeLabel || ((value) => String(value || "텍스트"));
  const isApplicantScheduleOpen =
    applicantFormConfig?.isApplicantScheduleOpen ||
    ((options = {}) => {
      const normalizedOptions = options && typeof options === "object" ? options : {};
      return normalizedOptions.scheduleState?.isOpen === true;
    });

  const getApplicantStatusLabel = (status, options = {}) => {
    const applicantStatusOptions = options && typeof options === "object" ? options : {};

    return applicantFormConfig?.getApplicantStatusLabel
      ? applicantFormConfig.getApplicantStatusLabel(status, applicantStatusOptions)
      : String(status || "").trim() === "promoted"
        ? "접수 완료"
        : isApplicantScheduleOpen(applicantStatusOptions)
          ? "접수 중"
          : "접수 완료";
  };
  const getApplicantSystemFieldLabel =
    applicantFormConfig?.getApplicantSystemFieldLabel || ((value) => String(value || "일반 항목"));

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function renderMenuSectionCopy(title = "", description = "") {
    const normalizedTitle = String(title || "").trim();
    const normalizedDescription = String(description || "").trim();

    return `
      <div class="menu-section-copy">
        ${normalizedTitle ? `<h3>${escapeHtml(normalizedTitle)}</h3>` : ""}
        ${normalizedDescription ? `<p>${escapeHtml(normalizedDescription)}</p>` : ""}
      </div>
    `;
  }

  function chunkItems(items = [], size = 3) {
    const normalizedItems = Array.isArray(items) ? items : [];
    const normalizedSize = Math.max(1, Number(size) || 1);
    const chunks = [];

    for (let index = 0; index < normalizedItems.length; index += normalizedSize) {
      chunks.push(normalizedItems.slice(index, index + normalizedSize));
    }

    return chunks;
  }

  function getSharedGridRenderer() {
    return globalThis.AdmitCardSharedGridRenderer || null;
  }

  function renderTemplateListPanel() {
    return `
      <article class="form-card template-management-panel">
        <div class="section-header template-management-header">
          ${renderMenuSectionCopy("수험표 양식 설정", "등록된 수험표 양식을 확인하고 관리합니다.")}
          <button class="primary-button" data-add-template="true" type="button">새 양식 등록</button>
        </div>

        <div class="template-grid">
          ${
            state.templateCards.length > 0
              ? state.templateCards.map((card) => renderTemplateCard(card)).join("")
              : `
                <article class="panel-card">
                  <p>등록된 수험표 양식이 없습니다.</p>
                  <span class="muted">새 양식 등록 버튼으로 사용할 첫 양식을 생성하세요.</span>
                </article>
              `
          }
        </div>
      </article>
    `;
  }

  function renderApplicantHistoryAnswerItems(answerItems = []) {
    const normalizedItems = Array.isArray(answerItems) ? answerItems : [];

    if (normalizedItems.length === 0) {
      return `<p class="muted">저장된 답변이 없습니다.</p>`;
    }

    return `
      <div class="applicant-answer-list">
        ${normalizedItems
          .map((answerItem) => {
            const isPhotoValue = answerItem?.inputType === "photo";
            const isFileValue = answerItem?.inputType === "file";
            const answerValue = isPhotoValue
              ? answerItem?.value?.hasPhoto
                ? `${answerItem?.value?.fileName || "등록된 사진"}`
                : "미등록"
              : isFileValue
                ? answerItem?.value?.hasFile
                  ? `${answerItem?.value?.fileName || "등록된 파일"}`
                  : "미등록"
                : String(answerItem?.value || "").trim() || "-";

            return `
              <div class="applicant-answer-item">
                <strong>${escapeHtml(answerItem?.questionText || "-")}</strong>
                <span>${escapeHtml(answerValue)}</span>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderApplicantSubmissionDetailField(field = {}) {
    const label = String(field?.label || "-").trim() || "-";

    if (field?.markup) {
      return `
        <div class="field applicant-submission-detail-field">
          <label title="${escapeAttribute(label)}">
            <span class="applicant-submission-detail-label-text">${escapeHtml(label)}</span>
          </label>
          <div class="applicant-submission-detail-value">${field.markup}</div>
        </div>
      `;
    }

    const value = String(field?.value || "").trim() || "-";

    return `
      <div class="field applicant-submission-detail-field">
        <label title="${escapeAttribute(label)}">
          <span class="applicant-submission-detail-label-text">${escapeHtml(label)}</span>
        </label>
        <div class="applicant-submission-detail-value" title="${escapeAttribute(value)}">
          <span class="applicant-submission-detail-value-text">${escapeHtml(value)}</span>
        </div>
      </div>
    `;
  }

  function renderApplicantHistoryDetailModalContent(submission = null) {
    const normalizedSubmission = submission && typeof submission === "object" ? submission : null;

    if (!normalizedSubmission) {
      return `
        <article class="form-card examinee-detail-card examinee-detail-empty-card">
          <div class="empty-state examinee-detail-empty-state">
            <div>
              <strong>접수 이력 상세</strong>
              <p>표에서 접수 이력의 답변 보기 버튼을 누르면 상세정보를 확인할 수 있습니다.</p>
            </div>
          </div>
        </article>
      `;
    }

    const summaryFields = [
      { label: "수험번호", value: normalizedSubmission.promotedExamineeNo || "-" },
      { label: "이름", value: normalizedSubmission.name || "-" },
      { label: "이메일", value: normalizedSubmission.email || "-" },
    ];
    const prioritizedSystemFieldOrder = ["track", "admission", "series", "unit", "major"];
    const filteredAnswerItems = (Array.isArray(normalizedSubmission.answerItems) ? normalizedSubmission.answerItems : [])
      .filter((answerItem) => {
        const fieldKey = String(answerItem?.fieldKey || "").trim();
        const systemFieldKey = String(answerItem?.systemFieldKey || "").trim();
        return (
          answerItem?.inputType !== "photo" &&
          !["name", "email", "photo"].includes(systemFieldKey) &&
          !["name", "email", "photo"].includes(fieldKey)
        );
      });
    const prioritizedFieldKeys = new Set();
    const prioritizedAnswerFields = prioritizedSystemFieldOrder
      .map((systemFieldKey) => {
        const matchedAnswerItem = filteredAnswerItems.find((answerItem) => String(answerItem?.systemFieldKey || "").trim() === systemFieldKey);

        if (!matchedAnswerItem) {
          return null;
        }

        const fieldKey = String(matchedAnswerItem?.fieldKey || "").trim();

        if (fieldKey) {
          prioritizedFieldKeys.add(fieldKey);
        }

        return {
          label: matchedAnswerItem?.questionText || "-",
          value: String(matchedAnswerItem?.value || "").trim() || "-",
        };
      })
      .filter(Boolean);
    const remainingAnswerFields = filteredAnswerItems
      .filter((answerItem) => !prioritizedFieldKeys.has(String(answerItem?.fieldKey || "").trim()))
      .map((answerItem) => {
        if (answerItem?.inputType === "file") {
          const fileValue = answerItem?.value && typeof answerItem.value === "object" ? answerItem.value : {};
          const fileLabel = String(fileValue.fileName || "").trim();
          const fileUrl = String(fileValue.fileUrl || "").trim();

          return fileValue.hasFile === true && fileLabel && fileUrl
            ? {
                label: answerItem?.questionText || "-",
                markup: `<a class="applicant-submission-detail-file-link" href="${escapeAttribute(fileUrl)}">${escapeHtml(fileLabel)}</a>`,
              }
            : {
                label: answerItem?.questionText || "-",
                value: fileValue.hasFile === true ? fileLabel || "등록된 파일" : "미등록",
              };
        }

        return {
          label: answerItem?.questionText || "-",
          value: String(answerItem?.value || "").trim() || "-",
        };
      });
    const orderedAnswerFields = [...prioritizedAnswerFields, ...remainingAnswerFields];
    const fieldRows = [summaryFields, ...chunkItems(orderedAnswerFields, 3)].filter((row) => Array.isArray(row) && row.length > 0);

    return `
      <div class="examinee-detail-card applicant-submission-detail-card">
        ${normalizedSubmission.memberId && ['관리자', '슈퍼관리자'].includes(state.auth.currentUser?.role) ? `<div class="inline-actions"><a class="ghost-button" href="/applicant-members?member=${encodeURIComponent(normalizedSubmission.memberId)}" data-member-profile-link>회원정보 보기</a></div>` : ''}
        <div class="examinee-detail-layout">
          <div class="examinee-detail-field-grid applicant-submission-detail-field-grid">
            ${fieldRows
              .map(
                (row) => `
                  <div class="examinee-detail-field-row">
                    ${row
                      .map((field) => renderApplicantSubmissionDetailField(field))
                      .join("")}
                  </div>
                `,
              )
              .join("")}
          </div>
          <aside class="examinee-detail-photo-panel applicant-submission-detail-photo-panel">
            <div class="examinee-detail-photo-frame">
              ${
                normalizedSubmission.photoUrl
                  ? `<img
                      class="examinee-detail-photo-image"
                      src="${escapeAttribute(normalizedSubmission.photoUrl)}"
                      alt="${escapeAttribute(`${normalizedSubmission.name || normalizedSubmission.promotedExamineeNo || "수험생"} 사진`)}"
                    />`
                  : `<div class="examinee-detail-photo-placeholder">
                      <strong>사진 미등록</strong>
                      <span>등록된 접수 사진이 없습니다.</span>
                    </div>`
              }
            </div>
            <input
              class="sr-only"
              id="applicantSubmissionDetailPhotoInput"
              data-applicant-submission-photo-input="true"
              data-applicant-submission-id="${escapeAttribute(normalizedSubmission.id || "")}"
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            />
            <button
              class="outline-button examinee-detail-photo-button applicant-submission-detail-photo-button"
              data-applicant-submission-photo-upload-trigger="true"
              type="button"
            >
              사진 재등록
            </button>
          </aside>
        </div>
      </div>
    `;
  }

  function renderApplicantHistoryPanel() {
    const sharedGridRenderer = getSharedGridRenderer();
    const dashboardFilter = globalThis.AdmitCardDashboardData.readHistoryFilter(globalThis.location?.search || "");
    const dashboardFilterLabel = dashboardFilter ? [
      { all: "전체 접수", today: `오늘 접수 (${dashboardFilter.date})`, documents: "서류 미제출 · 필수 항목 기준" }[dashboardFilter.mode],
      dashboardFilter.track, dashboardFilter.admission, dashboardFilter.series,
    ].filter(Boolean).join(" · ") : "";

    if (!sharedGridRenderer?.renderExamineeResultTable || !sharedGridRenderer?.renderGridHeaderActions) {
      return `
        <article class="form-card applicant-history-panel">
          <div class="section-header">
            ${renderMenuSectionCopy("접수 이력", "공통 그리드를 불러오는 중입니다.")}
          </div>
        </article>
      `;
    }

    return `
      ${sharedGridRenderer.renderExamineeResultTable({
        title: "접수 이력",
        description: "수험생이 제출한 접수 이력과 답변을 확인합니다.",
        headerLeadingMarkup: dashboardFilter ? `<div class="menu-section-copy"><h3>접수 이력</h3><div class="dashboard-history-filter"><span>${escapeHtml(dashboardFilterLabel)}</span><a href="/applicant-history">조건 해제</a></div></div>` : "",
        gridKey: "applicantHistoryGrid",
        showPrintColumn: false,
        selectable: true,
        showRowNumber: true,
        checkboxFirst: true,
        headerActionsMarkup: sharedGridRenderer.renderGridHeaderActions({ gridKey: "applicantHistoryGrid" }),
        emptyMessage: "데이터가 없습니다.",
      })}
    `;
  }

  function renderApplicantFieldList(fields = state.applicantManager?.fields || [], editorState = state.applicantManager?.fieldEditor || {}, labels = {}) {
    const hasDraftField = editorState.isActive === true && editorState.isDraft === true;
    const draftField = hasDraftField
      ? {
          id: "draft",
          questionText: editorState.questionText || "새 질문",
          questionDescription: editorState.questionDescription || "질문 설명을 입력하세요.",
          inputType: editorState.inputType || "text",
          systemFieldKey: editorState.systemFieldKey || "",
          required: editorState.required === true,
          options: Array.isArray(editorState.options) ? editorState.options : [],
          isDraft: true,
        }
      : null;
    const displayFields = draftField ? [...fields, draftField] : fields;

    if (displayFields.length === 0) {
      return `
        <article class="panel-card applicant-field-empty">
          <p>${escapeHtml(labels.empty || '등록된 접수 양식 항목이 없습니다.')}</p>
          <span class="muted">${escapeHtml(labels.emptyHelp || '상단의 새 질문 추가 버튼으로 첫 질문을 생성하세요.')}</span>
        </article>
      `;
    }

    return `
      <div class="applicant-field-list">
        ${displayFields
          .map((field) => {
            const description = String(field.questionDescription ?? '');
            const descriptionText = description.trim() ? description : '등록된 설명이 없습니다.';
            const isEditing =
              field.isDraft === true ||
              (editorState.isActive === true &&
                editorState.isDraft !== true &&
                String(editorState.editingId || "") === String(field.id || ""));
            const cardAttributes =
              field.isDraft === true
                ? `aria-current="true"`
                : `data-applicant-field-select="${escapeAttribute(field.id)}" ${field.orderLocked ? 'draggable="false"' : `data-applicant-field-draggable="${escapeAttribute(field.id)}" draggable="true"`} tabindex="0" title="${escapeAttribute(field.orderLocked ? '순서가 고정된 기본 항목입니다. 클릭하여 질문을 수정합니다.' : labels.cardHelp || '드래그하여 순서를 변경하거나 클릭하여 질문을 수정합니다.')}"`;

            return `
              <article
                class="panel-card applicant-field-card ${isEditing ? "is-editing" : ""} ${field.isDraft === true || field.orderLocked ? "" : "is-draggable"}"
                ${cardAttributes}
              >
                <div class="applicant-field-card-main">
                  <div class="applicant-field-card-content">
                    <div class="applicant-field-card-heading">
                      <strong>${escapeHtml(field.questionText || "-")}</strong>
                      <div class="applicant-field-card-description">${escapeHtml(descriptionText)}</div>
                    </div>
                    <div class="applicant-field-card-meta">
                      <span class="applicant-field-meta-chip applicant-field-meta-type">${escapeHtml(field.answerTypeLabel || getApplicantAnswerTypeLabel(field.inputType))}</span>
                      <span class="applicant-field-meta-chip applicant-field-meta-system">${escapeHtml(field.systemLabel || getApplicantSystemFieldLabel(field.systemFieldKey))}</span>
                      <span class="applicant-field-meta-chip ${field.required ? "applicant-field-meta-required" : "applicant-field-meta-optional"}">${field.required ? "필수" : "선택"}</span>
                    </div>
                  </div>
                  <div class="inline-actions applicant-field-card-actions ${field.isDraft === true ? "is-disabled" : ""}">
                    <button
                      class="icon-button applicant-field-action-button"
                      data-applicant-field-move="${escapeAttribute(field.id)}"
                      data-applicant-field-direction="up"
                      type="button"
                      ${field.isDraft === true || field.orderLocked || field.moveUpDisabled ? "disabled" : ""}
                      aria-label="위로 이동"
                      title="위로 이동"
                    >
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 5.5v13"></path>
                        <path d="m7.5 10 4.5-4.5 4.5 4.5"></path>
                      </svg>
                    </button>
                    <button
                      class="icon-button applicant-field-action-button"
                      data-applicant-field-move="${escapeAttribute(field.id)}"
                      data-applicant-field-direction="down"
                      type="button"
                      ${field.isDraft === true || field.orderLocked || field.moveDownDisabled ? "disabled" : ""}
                      aria-label="아래로 이동"
                      title="아래로 이동"
                    >
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 5.5v13"></path>
                        <path d="m7.5 14 4.5 4.5 4.5-4.5"></path>
                      </svg>
                    </button>
                    <button
                      class="icon-button danger-button applicant-field-action-button"
                      data-applicant-field-delete="${escapeAttribute(field.id)}"
                      type="button"
                      ${field.isDraft === true || field.locked === true ? "disabled" : ""}
                      aria-label="삭제"
                      title="삭제"
                    >
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M4.5 7.5h15"></path>
                        <path d="M9.5 7.5V5.75a1.25 1.25 0 0 1 1.25-1.25h2.5a1.25 1.25 0 0 1 1.25 1.25V7.5"></path>
                        <path d="M7.5 7.5v11a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5v-11"></path>
                        <path d="M10 11v5.5"></path>
                        <path d="M14 11v5.5"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderApplicantRecruitmentSettingsPanel() {
    const sharedGridRenderer = getSharedGridRenderer();

    if (!sharedGridRenderer?.renderExamineeResultTable || !sharedGridRenderer?.renderGridHeaderActions) {
      return `
        <article class="form-card applicant-recruitment-settings-panel">
          <div class="section-header">
            ${renderMenuSectionCopy("전형 관리", "공통 그리드를 불러오는 중입니다.")}
          </div>
        </article>
      `;
    }

    return `
      ${sharedGridRenderer.renderExamineeResultTable({
        title: "전형 관리",
        description: "수험생이 접수 화면에서 선택할 수 있는 모집시기, 전형, 계열, 모집단위, 전공을 관리합니다.",
        gridKey: "applicantRecruitmentGrid",
        showPrintColumn: false,
        selectable: false,
        showRowNumber: true,
        headerActionsMarkup: `
          <button class="ghost-button" data-applicant-recruitment-add="true" type="button">새 항목 추가</button>
          <button class="outline-button" data-download-applicant-recruitment="true" type="button">
            <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 4v10"></path>
              <path d="m7.5 10.5 4.5 4.5 4.5-4.5"></path>
              <path d="M4 20h16"></path>
            </svg>
            <span>다운로드</span>
          </button>
          <button class="primary-button" data-open-modal="applicantUnitUploadModal" type="button">
            <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 16V4"></path>
              <path d="M7.5 8.5 12 4l4.5 4.5"></path>
              <path d="M4 20h16"></path>
            </svg>
            <span>데이터 업로드</span>
          </button>
        `,
        emptyMessage: "데이터가 없습니다.",
      })}
    `;
  }

  function renderApplicantScheduleManagementPanel() {
    const sharedGridRenderer = getSharedGridRenderer();

    if (!sharedGridRenderer?.renderExamineeResultTable || !sharedGridRenderer?.renderGridHeaderActions) {
      return `
        <article class="form-card applicant-recruitment-settings-panel">
          <div class="section-header">
            ${renderMenuSectionCopy("일정 관리", "공통 그리드를 불러오는 중입니다.")}
          </div>
        </article>
      `;
    }

    const selectedScheduleKeySet = new Set(
      (Array.isArray(state.tableSettings?.applicantScheduleGrid?.selectedRowIds)
        ? state.tableSettings.applicantScheduleGrid.selectedRowIds
        : [])
        .map((scheduleKey) => String(scheduleKey || "").trim())
        .filter(Boolean),
    );
    const schedules = Array.isArray(state.applicantManager?.schedules) ? state.applicantManager.schedules : [];
    const selectedScheduleCount = schedules.filter((schedule) =>
      selectedScheduleKeySet.has(String(schedule?.scheduleKey || schedule?.id || "").trim()),
    ).length;
    const scheduleBulkActionMarkup = `
      <button
        class="primary-button"
        data-applicant-schedule-bulk-edit="true"
        type="button"
        title="${selectedScheduleCount > 0 ? `선택한 ${selectedScheduleCount}개 전형의 일정을 한 번에 설정합니다.` : "일괄 설정할 전형을 먼저 선택하세요."}"
        ${selectedScheduleCount === 0 ? "disabled" : ""}
      >
        <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="5.5" width="16" height="14" rx="2"></rect>
          <path d="M8 3.5v4"></path>
          <path d="M16 3.5v4"></path>
          <path d="M4 9.5h16"></path>
          <path d="m8.5 14 2 2 4.5-4.5"></path>
        </svg>
        <span>일괄 설정 (${selectedScheduleCount}개)</span>
      </button>
    `;

    return `
      ${sharedGridRenderer.renderExamineeResultTable({
        title: "일정 관리",
        description: "왼쪽 체크박스로 여러 전형을 선택해 일정을 일괄 설정하거나, 행을 클릭해 개별 일정을 편집할 수 있습니다.",
        gridKey: "applicantScheduleGrid",
        showPrintColumn: false,
        selectable: true,
        checkboxFirst: true,
        showRowNumber: true,
        headerActionsMarkup: `${scheduleBulkActionMarkup}${sharedGridRenderer.renderGridHeaderActions({ gridKey: "applicantScheduleGrid" })}`,
        emptyMessage: "전형 관리에 등록된 일정 대상이 없습니다.",
      })}
    `;
  }

  function renderApplicantFieldSettingsPanel(config = {}) {
    const editorState = config.editorState || state.applicantManager?.fieldEditor || {};
    const isEditorActive = editorState.isActive === true;
    const isDocumentScope = config.fileUploadScope === 'documents';
    const isLegacyBirth = config.fileUploadScope !== 'signup' && editorState.inputType === 'birthdate';
    const answerTypeDescriptions = applicantFormConfig?.answerTypeDescriptions || {};
    const answerTypeDescription = isLegacyBirth ? '생년월일은 회원가입에서 받습니다. 기존 항목과 답변은 보존하며, 회원정보가 있으면 자동 연동합니다.' : config.lockedCore ? '회원가입 기본 항목입니다. 답변 종류는 변경할 수 없습니다.' : isEditorActive
      ? answerTypeDescriptions[editorState.inputType || "text"] || "선택한 종류에 맞는 답변을 받습니다."
      : "질문을 추가하거나 선택하면 답변 데이터 종류에 대한 안내가 표시됩니다.";
    const fixedTypes = ['email', 'password', 'name', ...(config.fileUploadScope === 'signup' ? [] : ['birthdate'])];
    const inputTypeOptions = [...(config.inputTypeOptions || applicantFormConfig?.applicationAnswerTypeOptions || [])].filter(option => !fixedTypes.includes(option.key));
    const editorOptions = Array.isArray(editorState.options) ? editorState.options : [];
    const allowCustomOption = editorState.allowCustomOption === true;
    const customOptionLabel = String(editorState.customOptionLabel || "").trim();

    if (editorState.inputType && !fixedTypes.includes(editorState.inputType) && !inputTypeOptions.some((option) => option.key === editorState.inputType)) {
      inputTypeOptions.push({
        key: editorState.inputType,
        label: `${getApplicantAnswerTypeLabel(editorState.inputType)} (기존 값)`,
      });
    }

    return `
      <section class="applicant-settings-layout">
        <article class="form-card applicant-settings-fields-panel">
          <div class="section-header">
            ${renderMenuSectionCopy(config.title || "가입·접수 설정", config.description || "수험생 접수 페이지에 표시할 질문과 데이터 유형을 관리합니다.")}
            <div class="inline-actions">
              <button class="ghost-button" data-applicant-field-preview="true" type="button">미리보기</button>
              <button class="ghost-button" data-applicant-field-add="true" type="button">새 질문 추가</button>
            </div>
          </div>

          ${renderApplicantFieldList((config.fields || state.applicantManager?.fields || []).map(field => config.fileUploadScope !== 'signup' && (field.systemFieldKey === 'birth' || field.inputType === 'birthdate') ? { ...field, systemLabel: '회원가입 정보 · 자동 연동' } : field), editorState)}
        </article>

        <div class="applicant-settings-side">
          <article class="form-card applicant-field-editor-panel ${isEditorActive ? "" : "is-disabled"}">
            <div class="section-header">
              <div>
                <h3>${editorState.isDraft ? "질문 추가" : editorState.editingId ? "질문 수정" : "질문 카드 선택"}</h3>
                <p>${isEditorActive ? (isDocumentScope ? '제출 서류의 제목, 설명, 파일 설정과 필수 여부를 설정합니다.' : "질문 제목, 설명, 답변 방식과 필수 입력 여부를 설정합니다.") : "질문 카드를 선택하거나 새 질문을 추가하면 수정할 수 있습니다."}</p>
              </div>
            </div>

            <form class="applicant-field-editor-form" data-applicant-field-form="true">
              <label class="field">
                <span>제목</span>
                <input
                  data-applicant-field-input="questionText"
                  type="text"
                  value="${escapeAttribute(editorState.questionText || "")}"
                  placeholder="${isDocumentScope ? '예: 졸업증명서' : '예: 본인 확인용 생년월일'}"
                  ${isEditorActive ? "" : "disabled"}
                />
              </label>

              <label class="field">
                <span>설명</span>
                <input
                  data-applicant-field-input="questionDescription"
                  type="text"
                  value="${escapeAttribute(editorState.questionDescription || "")}"
                  placeholder="${isDocumentScope ? '예: 졸업증명서를 PDF 파일로 제출하세요' : '예: 주민등록상 생년월일 8자리를 입력하세요'}"
                  ${isEditorActive ? "" : "disabled"}
                />
              </label>

              ${isDocumentScope ? '' : config.lockedCore || isLegacyBirth ? `<div class="field"><span>입력 항목</span><input type="text" value="${isLegacyBirth ? '생년월일 · 회원정보 연동' : '회원가입 고정 항목'}" readonly /></div>` : `<label class="field select-field">
                <span>답변 데이터 종류</span>
                <select data-applicant-field-input="inputType" aria-describedby="applicant-answer-type-help" ${isEditorActive && !config.lockedCore ? "" : "disabled"}>
                  ${inputTypeOptions
                    .map(
                      (option) => `
                        <option value="${escapeAttribute(option.key)}" ${editorState.inputType === option.key ? "selected" : ""}>
                          ${escapeHtml(option.label)}
                        </option>
                      `,
                    )
                    .join("")}
                </select>
              </label>`}

              ${
                editorState.inputType === "select"
                  ? `
                    <div class="field applicant-option-editor">
                      <span>선택지 목록</span>
                      <div class="applicant-option-editor-row">
                        <input
                          data-applicant-field-input="optionDraft"
                          data-applicant-field-option-draft="true"
                          type="text"
                          value="${escapeAttribute(editorState.optionDraft || "")}"
                          placeholder="예: 오전반"
                          ${isEditorActive ? "" : "disabled"}
                        />
                        <label class="checkbox-field applicant-option-custom-toggle">
                          <input
                            data-applicant-field-input="allowCustomOption"
                            type="checkbox"
                            ${allowCustomOption ? "checked" : ""}
                            ${isEditorActive ? "" : "disabled"}
                          />
                          <span>직접 입력</span>
                        </label>
                        <button class="ghost-button applicant-option-add-button" data-applicant-field-option-add="true" type="button" ${isEditorActive ? "" : "disabled"}>항목 추가</button>
                      </div>
                      <span class="muted applicant-option-editor-help">항목을 하나씩 추가하여 수험생 선택지를 구성합니다.</span>
                      ${
                        editorOptions.length > 0
                          ? `
                            <div class="applicant-option-editor-list">
                              ${editorOptions
                                .map(
                                  (option, index) => `
                                    <div class="applicant-option-editor-item">
                                      <div class="applicant-option-editor-item-main">
                                        <span>${escapeHtml(option)}</span>
                                        ${
                                          customOptionLabel && customOptionLabel === option
                                            ? `<em class="applicant-option-editor-badge">직접 입력</em>`
                                            : ""
                                        }
                                      </div>
                                      <button
                                        class="icon-button danger-button applicant-option-remove-button"
                                        data-applicant-field-option-remove="${index}"
                                        type="button"
                                        ${isEditorActive ? "" : "disabled"}
                                        aria-label="선택지 삭제"
                                        title="선택지 삭제"
                                      >
                                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                          <path d="M4.5 7.5h15"></path>
                                          <path d="M9.5 7.5V5.75a1.25 1.25 0 0 1 1.25-1.25h2.5a1.25 1.25 0 0 1 1.25 1.25V7.5"></path>
                                          <path d="M7.5 7.5v11a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5v-11"></path>
                                          <path d="M10 11v5.5"></path>
                                          <path d="M14 11v5.5"></path>
                                        </svg>
                                      </button>
                                    </div>
                                  `,
                                )
                                .join("")}
                            </div>
                          `
                          : `<p class="muted applicant-option-editor-empty">등록된 선택지가 없습니다.</p>`
                      }
                    </div>
                  `
                  : ""
              }

              ${editorState.inputType === "file" ? `
                <label class="field"><span>저장 파일명 규칙</span>
                  <input data-applicant-field-input="fileNamePattern" type="text" maxlength="120" value="${escapeAttribute(editorState.fileNamePattern || "")}" placeholder="${config.fileUploadScope === 'signup' ? '{ID}_증빙서류' : '{수험번호}_증빙서류'}" />
                  <small class="muted">${config.fileUploadScope === 'signup' ? '사용 가능: {ID}(인증한 이메일), {질문제목}, {원본파일명}. 비우면 원본 파일명으로 저장합니다.' : '사용 가능: {수험번호}, {질문제목}, {원본파일명}. 비우면 수험번호_질문제목으로 저장합니다.'} 확장자는 자동으로 붙습니다.${config.fileUploadScope === 'signup' ? '' : ' 사용자 지정 이름 끝에는 중복 방지 식별자가 붙습니다.'}</small>
                </label>
                <label class="field"><span>허용 확장자</span>
                  <input data-applicant-field-input="allowedExtensions" type="text" value="${escapeAttribute(Array.isArray(editorState.allowedExtensions) ? editorState.allowedExtensions.join(', ') : editorState.allowedExtensions || '')}" placeholder="예: pdf, jpg, png" />
                  <small class="muted">쉼표로 구분하세요. ${config.fileUploadScope === 'signup' ? '비우면 PDF, JPG, JPEG, PNG만 허용합니다.' : '비우면 확장자를 제한하지 않습니다.'} 기존 업로드 파일에는 소급 적용하지 않습니다.</small>
                </label>` : ''}
              <label class="checkbox-field applicant-required-field">
                <input
                  data-applicant-field-input="required"
                  type="checkbox"
                  ${editorState.required ? "checked" : ""}
                  ${isEditorActive && !config.lockedCore ? "" : "disabled"}
                />
                <span>필수 입력 항목으로 설정</span>
              </label>

              <div class="form-actions">
                <button class="ghost-button" data-applicant-field-reset="true" type="button" ${isEditorActive ? "" : "disabled"}>선택 해제</button>
                <button class="primary-button" type="submit" ${isEditorActive ? "" : "disabled"}>${editorState.editingId ? "질문 저장" : "질문 추가"}</button>
              </div>
              ${isDocumentScope ? '' : `<p id="applicant-answer-type-help" class="muted applicant-answer-type-help" role="status">
                ${escapeHtml(answerTypeDescription)}
              </p>`}
            </form>
          </article>
        </div>
      </section>
    `;
  }

  function renderTemplateManagement() {
    return `
      <section class="view-stack template-management-view">
        ${renderTemplateListPanel()}
      </section>
    `;
  }

  function renderApplicantHistory() {
    return `
      <section class="view-stack applicant-history-view table-view-stack">
        ${renderApplicantHistoryPanel()}
      </section>
    `;
  }

  function renderApplicantRecruitmentManagement() {
    return `
      <section class="view-stack applicant-form-settings-view table-view-stack is-recruitment-settings">
        ${renderApplicantRecruitmentSettingsPanel()}
      </section>
    `;
  }

  function renderApplicantQuestionTemplateManagement(formScope = 'application') {
    formScope = formScope === 'documents' ? 'documents' : 'application';
    const documentScope = formScope === 'documents';
    const editor = state.applicantManager.fieldEditor || {};
    return `
      <section class="view-stack applicant-form-settings-view table-view-stack is-field-settings">
        ${renderApplicantFieldSettingsPanel({
          title: documentScope ? '서류제출' : '원서접수',
          description: documentScope ? '수험생 서류제출 화면에 표시할 질문을 관리합니다.' : '이름·이메일·생년월일은 회원정보에서 불러오며, 그 외 접수 질문을 관리합니다.',
          fields: (state.applicantManager.fields || []).filter(field => (field.formScope || 'application') === formScope),
          editorState: (editor.formScope || 'application') === formScope ? editor : {},
          fileUploadScope: documentScope ? 'documents' : 'application',
        })}
      </section>
    `;
  }

  function renderApplicantScheduleManagement() {
    return `
      <section class="view-stack applicant-history-view table-view-stack">
        ${renderApplicantScheduleManagementPanel()}
      </section>
    `;
  }

  return {
    renderApplicantFieldList,
    renderApplicantFieldSettingsPanel,

    renderApplicantHistoryDetailModalContent,
    renderApplicantHistory,
    renderApplicantQuestionTemplateManagement,
    renderApplicantRecruitmentManagement,
    renderApplicantScheduleManagement,
    renderTemplateManagement,
  };
});
