(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorPreviewPrinting = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplatePreviewPrintController({ pageSettingsModule, state }) {
    function getTemplateDocumentStyles(settings = null) {
      const pageSettings = settings || pageSettingsModule?.getDefaultTemplatePageSettings?.() || null;
      return `
        ${pageSettingsModule?.getTemplatePagePrintCss?.(pageSettings) || "@page { size: A4 portrait; margin: 0; }"}
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 24px;
          background: #eef2f8;
          font-family: "Noto Sans KR", sans-serif;
          color: #000000;
        }
        .template-render-sheet {
          width: 794px;
          min-height: 1123px;
          margin: 0 auto;
          padding: 44px 46px;
          border-radius: 0;
          background: #ffffff;
          box-shadow: 0 16px 32px rgba(15, 23, 42, 0.12);
          font-family: "Noto Sans KR", "Malgun Gothic", sans-serif;
          font-size: 11pt;
          line-height: calc(1em + 1pt);
        }
        .template-render-sheet .template-doc {
          position: relative;
          min-height: 100%;
        }
        .template-render-sheet h1,
        .template-render-sheet h2,
        .template-render-sheet h3,
        .template-render-sheet p {
          margin: 0 0 1pt;
        }
        .template-render-sheet .template-doc > div:not([data-candidate-block-grid], .examlist-candidate-block-grid, .preview-candidate-block-grid) {
          margin: 0 0 1pt;
        }
        .template-render-sheet img { max-width: 100%; height: auto; display: block; }
        .template-render-sheet .examinee-photo-token-frame {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          min-height: 0;
          line-height: 0;
        }
        .template-render-sheet .examinee-photo-token-image {
          width: auto;
          max-width: 100%;
          height: auto;
          max-height: 100%;
          object-fit: contain;
        }
        .template-render-sheet td.examinee-photo-token-cell,
        .template-render-sheet th.examinee-photo-token-cell {
          position: relative;
          overflow: hidden;
          line-height: 0;
          text-align: center;
          vertical-align: middle;
        }
        .template-render-sheet .examinee-photo-token-cell .examinee-photo-token-image {
          width: 100%;
          height: 100%;
          max-width: 100%;
          max-height: 100%;
          margin: 0;
          object-fit: contain;
          background: #ffffff;
        }
        .template-render-sheet .examinee-photo-token-cell .examinee-photo-placeholder {
          width: 100%;
          margin: 0;
        }
        .template-render-sheet .template-generated-object,
        .template-preview-stage .template-generated-object {
          background: #ffffff;
          max-width: none;
        }
        .template-render-sheet .template-generated-object-barcode,
        .template-preview-stage .template-generated-object-barcode {
          object-fit: fill;
        }
        .template-render-sheet .template-generated-object-qrcode,
        .template-preview-stage .template-generated-object-qrcode {
          object-fit: fill;
        }
        .template-render-sheet .examinee-photo-placeholder {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 120px;
          padding: 12px;
          border: 1px dashed rgba(138, 154, 181, 0.92);
          color: #53627a;
          font-size: 13px;
          font-weight: 700;
          text-align: center;
          background: rgba(246, 248, 252, 0.92);
        }
        .template-render-sheet table { width: 100%; border-collapse: collapse; margin: 1pt 0; table-layout: fixed; }
        .template-render-sheet th,
        .template-render-sheet td { border: 1pt solid #000000; padding: 2pt; text-align: left; vertical-align: top; font-size: 11pt; }
        .template-render-sheet th { background: rgba(238, 243, 251, 0.92); font-weight: 800; }
        .template-render-sheet hr { border: 0; border-top: 1pt solid #d8e0ea; margin: 20pt 0; }
        @media print {
          body { padding: 0; background: #ffffff; }
          .template-render-sheet { box-shadow: none; }
        }
      `;
    }

    function getTemplatePreviewPageSettings(markup = "") {
      return pageSettingsModule?.getTemplatePageSettingsFromHtml?.(markup) || null;
    }

    function getTemplatePreviewRenderAttributes(markup = "") {
      const pageSettings = getTemplatePreviewPageSettings(markup);
      return pageSettingsModule?.getTemplatePageRenderAttributes?.(pageSettings) || "";
    }

    async function printTemplatePreview() {
      if (!state.templatePreview.renderedHtml) {
        return;
      }

      const printWindow = window.open("", "_blank", "width=1100,height=900");

      if (!printWindow) {
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ko">
          <head>
            <meta charset="UTF-8" />
            <title>수험생확인대장 출력</title>
            <style>${getTemplateDocumentStyles(getTemplatePreviewPageSettings(state.templatePreview.renderedHtml))}</style>
          </head>
          <body>
            <article class="template-render-sheet" ${getTemplatePreviewRenderAttributes(state.templatePreview.renderedHtml)}>
              ${state.templatePreview.renderedHtml}
            </article>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      window.setTimeout(() => {
        printWindow.print();
      }, 250);
    }

    return Object.freeze({
      getTemplateDocumentStyles,
      getTemplatePreviewPageSettings,
      getTemplatePreviewRenderAttributes,
      printTemplatePreview,
    });
  }

  return Object.freeze({
    createTemplatePreviewPrintController,
  });
});

})();
