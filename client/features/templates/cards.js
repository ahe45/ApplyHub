(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory({
      metaEditorModule: require("./cards/meta-editor"),
      previewModule: require("./cards/preview"),
    });
    return;
  }

  globalScope.AdmitCardTemplateCards = factory({
    metaEditorModule: globalScope.AdmitCardTemplateCardMetaEditor,
    previewModule: globalScope.AdmitCardTemplateCardPreview,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, ({
  metaEditorModule,
  previewModule,
}) => {

  if (!previewModule?.createTemplateCardPreviewService) {
    throw new Error("client/features/templates/cards/preview.js must be loaded before cards.js.");
  }

  if (!metaEditorModule?.createTemplateCardMetaEditorService) {
    throw new Error("client/features/templates/cards/meta-editor.js must be loaded before cards.js.");
  }

  const { createTemplateCardPreviewService } = previewModule;
  const { createTemplateCardMetaEditorService } = metaEditorModule;

  const TEMPLATE_PREVIEW_PHOTO_PATH = "/client/assets/template-preview-photo.png";

  function getTemplateCardRuntimeDependencies() {
    return {
      apiRequest: typeof apiRequest === "function" ? apiRequest : null,
      createTemplateCardEditorState:
        typeof createTemplateCardEditorState === "function" ? createTemplateCardEditorState : null,
      escapeAttribute: typeof escapeAttribute === "function" ? escapeAttribute : (value) => String(value ?? ""),
      escapeHtml: typeof escapeHtml === "function" ? escapeHtml : (value) => String(value ?? ""),
      findTemplateCard: typeof findTemplateCard === "function" ? findTemplateCard : () => null,
      getDefaultTemplateContent: typeof getDefaultTemplateContent === "function" ? getDefaultTemplateContent : () => "",
      getTemplatePreviewExaminee: typeof getTemplatePreviewExaminee === "function" ? getTemplatePreviewExaminee : () => ({}),
      renderTemplateWithExaminee:
        typeof renderTemplateWithExaminee === "function" ? renderTemplateWithExaminee : (markup) => markup,
      renderView: typeof renderView === "function" ? renderView : () => {},
      showToast: typeof showToast === "function" ? showToast : () => {},
      updateTemplateCard: typeof updateTemplateCard === "function" ? updateTemplateCard : () => {},
    };
  }

  function createTemplateCardServices() {
    const runtimeDependencies = getTemplateCardRuntimeDependencies();

    const previewService = createTemplateCardPreviewService({
      getDefaultTemplateContent: runtimeDependencies.getDefaultTemplateContent,
      getTemplatePreviewExaminee: runtimeDependencies.getTemplatePreviewExaminee,
      renderTemplateWithExaminee: runtimeDependencies.renderTemplateWithExaminee,
      state,
    });

    const metaEditorService = createTemplateCardMetaEditorService({
      apiRequest: runtimeDependencies.apiRequest,
      createTemplateCardEditorState: runtimeDependencies.createTemplateCardEditorState,
      escapeAttribute: runtimeDependencies.escapeAttribute,
      escapeHtml: runtimeDependencies.escapeHtml,
      findTemplateCard: runtimeDependencies.findTemplateCard,
      renderView: runtimeDependencies.renderView,
      showToast: runtimeDependencies.showToast,
      state,
      updateTemplateCard: runtimeDependencies.updateTemplateCard,
    });

    return {
      metaEditorService,
      previewService,
      runtimeDependencies,
    };
  }

  function renderTemplateCard(card) {
    const {
      metaEditorService,
      previewService,
      runtimeDependencies,
    } = createTemplateCardServices();
    const { escapeAttribute } = runtimeDependencies;
    const { renderTemplateCardMetaEditor } = metaEditorService;
    const { renderTemplateCardThumbnail } = previewService;

    const badgeClass = card.status === "used" ? "green" : "gray";
    const badgeLabel = card.status === "used" ? "사용중" : "사용 안 함";
    const isActiveTemplate = card.status === "used";
    const applyButtonMarkup = `<button class="secondary-button template-card-action-button" ${
      isActiveTemplate ? "disabled" : `data-template-apply="${escapeAttribute(card.id)}"`
    } type="button">
      <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 12.5 9.2 16.7 19 7.5"></path>
      </svg>
      <span>사용 적용</span>
    </button>`;
    const deleteButtonMarkup = `<button class="icon-button template-card-delete-button danger-button" ${
      isActiveTemplate
        ? 'disabled title="사용 중 양식은 삭제할 수 없습니다."'
        : `data-template-delete="${escapeAttribute(card.id)}"`
    } type="button" aria-label="양식 삭제">
      <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7h16"></path>
        <path d="M9.5 3.5h5"></path>
        <path d="M8 7v11a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 16 18V7"></path>
        <path d="M10 10.5v5"></path>
        <path d="M14 10.5v5"></path>
      </svg>
    </button>`;
    const previewButtonMarkup = `<button class="outline-button template-card-action-button" data-template-preview="${escapeAttribute(
      card.id,
    )}" type="button">
      <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
      <span>미리보기</span>
    </button>`;
    const editButtonMarkup = `<button class="primary-button template-card-action-button" data-template-edit="${escapeAttribute(
      card.id,
    )}" type="button">
      <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20Z"></path>
        <path d="m12.5 7 4.5 4.5"></path>
      </svg>
      <span>수정</span>
    </button>`;

    return `
      <article class="template-card" data-template-id="${escapeAttribute(card.id)}">
        <div class="section-header template-card-header">
          <div class="template-card-heading">
            ${renderTemplateCardMetaEditor(card, "name", {
              tagName: "h3",
              inputLabel: "양식 제목 수정",
              placeholder: "양식 제목을 입력하세요.",
            })}
            ${renderTemplateCardMetaEditor(card, "description", {
              tagName: "p",
              inputLabel: "양식 설명 수정",
              placeholder: "양식 설명을 입력하세요.",
            })}
          </div>
          <div class="template-card-header-tools">
            <span class="badge ${badgeClass}">${badgeLabel}</span>
            <button class="icon-button template-card-copy-button" type="button" data-template-copy="${escapeAttribute(card.id)}" aria-label="양식 복사" title="양식 복사">
              <svg class="button-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"></path></svg>
            </button>
            ${deleteButtonMarkup}
          </div>
        </div>
        <div class="template-preview">${renderTemplateCardThumbnail(card)}</div>
        <div class="template-card-actions">
          ${applyButtonMarkup}
          ${previewButtonMarkup}
          ${editButtonMarkup}
        </div>
      </article>
    `;
  }

  function getTemplateCreationSeed() {
    return createTemplateCardServices().previewService.getTemplateCreationSeed();
  }

  function getTemplatePreviewDate() {
    return createTemplateCardServices().previewService.getTemplatePreviewDate();
  }

  function openTemplateCardMetaEditor(...args) {
    return createTemplateCardServices().metaEditorService.openTemplateCardMetaEditor(...args);
  }

  function updateTemplateCardMetaEditorDraft(...args) {
    return createTemplateCardServices().metaEditorService.updateTemplateCardMetaEditorDraft(...args);
  }

  function closeTemplateCardMetaEditor(...args) {
    return createTemplateCardServices().metaEditorService.closeTemplateCardMetaEditor(...args);
  }

  function saveTemplateCardMetaEditor(...args) {
    return createTemplateCardServices().metaEditorService.saveTemplateCardMetaEditor(...args);
  }

  return {
    TEMPLATE_PREVIEW_PHOTO_PATH,
    closeTemplateCardMetaEditor,
    getTemplateCreationSeed,
    getTemplatePreviewDate,
    openTemplateCardMetaEditor,
    renderTemplateCard,
    saveTemplateCardMetaEditor,
    updateTemplateCardMetaEditorDraft,
  };
});
