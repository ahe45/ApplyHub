(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorPreview = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const pageSettingsModule = globalThis.ExamListTemplateEditorPageSettings;
  const previewRenderingModule = globalThis.ExamListTemplateEditorPreviewRendering;
  const previewPrintingModule = globalThis.ExamListTemplateEditorPreviewPrinting;

  if (!previewRenderingModule?.createTemplatePreviewRenderer) {
    throw new Error("client/features/template-editor/preview-rendering.js must be loaded before preview.js.");
  }

  if (!previewPrintingModule?.createTemplatePreviewPrintController) {
    throw new Error("client/features/template-editor/preview-printing.js must be loaded before preview.js.");
  }

  const { createTemplatePreviewRenderer } = previewRenderingModule;
  const { createTemplatePreviewPrintController } = previewPrintingModule;

  function createTemplatePreviewController({
    TEMPLATE_PREVIEW_PHOTO_PATH,
    applyTemplateRenderedObjects,
    buildApiUrl,
    buildSharedExamineePhotoUrl,
    escapeAttribute,
    escapeHtml,
    getTemplateEditorTagText,
    getTemplatePreviewDate,
    normalizeTemplateEditorFontNodes,
    normalizeTemplateTag,
    normalizeTemplateTagNodes,
    state,
    stripTemplateEditorTransientState,
    templateTagDefinitions,
  }) {
    function getTemplatePreviewExaminee() {
      return {
        date: getTemplatePreviewDate(),
        currentDate: getTemplatePreviewDate(),
        time: "09:00",
        session: "09:00",
        track: "모집시기명",
        admission: "전형명",
        exam: "전형명",
        series: "계열명",
        unit: "모집단위명",
        major: "전공명",
        building: "고사건물명",
        room: "고사실명",
        group: "조",
        examineeNo: "123100001",
        name: "홍길동",
        birth: "2000-03-01",
        hasPhoto: true,
        photoVersion: 1,
        useTemplatePreviewPhoto: true,
      };
    }

    function buildExamineePhotoUrl(examinee) {
      return buildSharedExamineePhotoUrl(examinee, {
        buildApiUrl,
        previewPhotoPath: TEMPLATE_PREVIEW_PHOTO_PATH,
      });
    }

    function buildExamineePhotoMarkup(examinee) {
      const photoUrl = buildExamineePhotoUrl(examinee);

      if (!photoUrl) {
        return '<span class="examinee-photo-placeholder">사진 미등록</span>';
      }

      return `
        <span class="examinee-photo-token-frame">
          <img class="examinee-photo-token-image" src="${escapeAttribute(photoUrl)}" alt="${escapeAttribute(
            `${examinee.name || examinee.examineeNo || "수험생"} 사진`,
          )}" />
        </span>
      `;
    }

    const { renderTemplateWithExaminee } = createTemplatePreviewRenderer({
      applyTemplateRenderedObjects,
      buildExamineePhotoMarkup,
      escapeHtml,
      getTemplateEditorTagText,
      getTemplatePreviewDate,
      getTemplatePreviewExaminee,
      normalizeTemplateEditorFontNodes,
      normalizeTemplateTag,
      normalizeTemplateTagNodes,
      stripTemplateEditorTransientState,
      templateTagDefinitions,
    });

    const { printTemplatePreview } = createTemplatePreviewPrintController({
      pageSettingsModule,
      state,
    });

    return Object.freeze({
      buildExamineePhotoUrl,
      getTemplatePreviewExaminee,
      printTemplatePreview,
      renderTemplateWithExaminee,
    });
  }

  return Object.freeze({
    createTemplatePreviewController,
  });
});

})();
