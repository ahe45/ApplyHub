(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardTemplateEditorPreview = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const pageSettingsModule = globalThis.AdmitCardTemplateEditorPageSettings;

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
    recordExamineePrint,
    state,
    stripTemplateEditorTransientState,
    templateTagDefinitions,
  }) {
    function getTemplatePreviewExaminee() {
      return {
        currentDate: getTemplatePreviewDate(),
        track: "모집시기명",
        admission: "전형명",
        series: "계열명",
        unit: "모집단위명",
        major: "전공명",
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

      return `<img class="examinee-photo-token-image" src="${escapeAttribute(photoUrl)}" alt="${escapeAttribute(
        `${examinee.name || examinee.examineeNo || "수험생"} 사진`,
      )}" />`;
    }

    function getTemplateTagReplacement(definition, examinee) {
      if (!definition) {
        return "";
      }

      if (definition.token === "@{수험생사진}") {
        return buildExamineePhotoMarkup(examinee);
      }

      if (definition.examineeKey === "currentDate") {
        return escapeHtml(String(examinee?.currentDate || getTemplatePreviewDate()));
      }

      return escapeHtml(String(examinee[definition.examineeKey] ?? ""));
    }

    function getStyledTemplateTagReplacement(tokenElement, definition, examinee) {
      if (!(tokenElement instanceof HTMLElement)) {
        return getTemplateTagReplacement(definition, examinee);
      }

      if (definition?.token === "@{수험생사진}") {
        return buildExamineePhotoMarkup(examinee);
      }

      const replacementText = getTemplateTagReplacement(definition, examinee);

      if (!replacementText) {
        return "";
      }

      const clone = tokenElement.cloneNode(true);
      const editorTagText = getTemplateEditorTagText(definition?.token || tokenElement.dataset.templateTagValue || "");

      clone.classList.remove("template-token");
      clone.classList.remove("template-data-fit");
      clone.removeAttribute("data-template-tag-value");
      clone.removeAttribute("data-template-token");
      clone.removeAttribute("contenteditable");
      clone.removeAttribute("spellcheck");

      if (!String(clone.className || "").trim()) {
        clone.removeAttribute("class");
      }

      if (editorTagText && String(clone.innerHTML || "").includes(editorTagText)) {
        clone.innerHTML = String(clone.innerHTML).replaceAll(
          editorTagText,
          `<span class="template-data-fit" data-template-data-fit="true">${replacementText}</span>`,
        );
      } else {
        clone.innerHTML = `<span class="template-data-fit" data-template-data-fit="true">${replacementText}</span>`;
      }

      return clone.outerHTML;
    }

    function replaceNodeWithMarkup(node, markup) {
      if (!node?.parentNode) {
        return;
      }

      if (!/[<&]/.test(markup)) {
        node.replaceWith(document.createTextNode(markup));
        return;
      }

      const template = document.createElement("template");
      template.innerHTML = markup;
      const replacementNodes = Array.from(template.content.childNodes);

      if (replacementNodes.length === 0) {
        node.remove();
        return;
      }

      node.replaceWith(...replacementNodes);
    }

    function normalizeTemplateEditorExamineePhotoCellClone(node) {
      Array.from(node.childNodes).forEach((childNode) => {
        if (childNode.nodeType === Node.TEXT_NODE) {
          const normalizedText = String(childNode.textContent || "").replace(/\u00a0/g, " ").trim();

          if (!normalizedText) {
            childNode.remove();
          }
          return;
        }

        if (!(childNode instanceof Element)) {
          return;
        }

        normalizeTemplateEditorExamineePhotoCellClone(childNode);

        if (childNode.tagName === "BR") {
          childNode.remove();
          return;
        }

        const normalizedText = String(childNode.textContent || "").replace(/\u00a0/g, " ").trim();

        if (!normalizedText && childNode.children.length === 0) {
          childNode.remove();
        }
      });
    }

    function normalizeTemplateEditorExamineePhotoCellContent(cell) {
      if (!(cell instanceof HTMLTableCellElement)) {
        return;
      }

      const photoElement = cell.querySelector(".examinee-photo-token-image, .examinee-photo-placeholder");

      if (!photoElement) {
        return;
      }

      const clone = cell.cloneNode(true);
      clone
        .querySelectorAll(".examinee-photo-token-image, .examinee-photo-placeholder")
        .forEach((element) => element.remove());
      normalizeTemplateEditorExamineePhotoCellClone(clone);

      if (clone.textContent.trim() !== "" || clone.querySelector("*")) {
        return;
      }

      cell.innerHTML = "";
      cell.append(photoElement);
    }

    function markExamineePhotoTokenCells(rootElement) {
      if (!rootElement?.querySelectorAll) {
        return;
      }

      rootElement.querySelectorAll("td, th").forEach((cell) => {
        if (cell.querySelector(".examinee-photo-token-image, .examinee-photo-placeholder")) {
          normalizeTemplateEditorExamineePhotoCellContent(cell);
          cell.classList.add("examinee-photo-token-cell");
          return;
        }

        cell.classList.remove("examinee-photo-token-cell");
      });
    }

    function renderTemplateWithExaminee(templateHtml, examinee) {
      const container = document.createElement("div");
      container.innerHTML = String(templateHtml || "");
      stripTemplateEditorTransientState(container);
      normalizeTemplateEditorFontNodes(container);
      normalizeTemplateTagNodes(container);

      container.querySelectorAll("[data-template-tag-value]").forEach((tokenElement) => {
        const normalizedTag = normalizeTemplateTag(tokenElement.dataset.templateTagValue);
        const definition = templateTagDefinitions.find((tagDefinition) => tagDefinition.token === normalizedTag);
        replaceNodeWithMarkup(tokenElement, getStyledTemplateTagReplacement(tokenElement, definition, examinee));
      });

      applyTemplateRenderedObjects(container, examinee, { getPreviewExaminee: getTemplatePreviewExaminee });

      const markup = templateTagDefinitions.reduce((nextMarkup, definition) => {
        const replacement = getTemplateTagReplacement(definition, examinee);
        return [
          definition.token,
          definition.legacyTag,
          definition.editorToken,
          ...(definition.editorTokens || []),
          ...(definition.legacyTokens || []),
          ...(definition.legacyTags || []),
        ]
          .filter(Boolean)
          .reduce((resolvedMarkup, tag) => resolvedMarkup.replaceAll(tag, replacement), nextMarkup);
      }, container.innerHTML);

      const renderedContainer = document.createElement("div");
      renderedContainer.innerHTML = markup;
      markExamineePhotoTokenCells(renderedContainer);
      return renderedContainer.innerHTML;
    }

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
          color: #152033;
        }
        .template-render-sheet {
          width: 794px;
          min-height: 1123px;
          margin: 0 auto;
          padding: 44px 46px;
          border-radius: 0;
          background: #ffffff;
          box-shadow: 0 16px 32px rgba(15, 23, 42, 0.12);
        }
        .template-render-sheet .template-doc {
          position: relative;
          min-height: 100%;
        }
        .template-render-sheet h1,
        .template-render-sheet h2,
        .template-render-sheet h3,
        .template-render-sheet p { margin-top: 0; }
        .template-render-sheet img { max-width: 100%; height: auto; display: block; }
        .template-render-sheet .examinee-photo-token-image {
          width: 100%;
          max-width: 100%;
          height: 100%;
          min-height: 120px;
          object-fit: cover;
        }
        .template-render-sheet td.examinee-photo-token-cell,
        .template-render-sheet th.examinee-photo-token-cell {
          position: relative;
          overflow: hidden;
          padding: 0 !important;
          line-height: 0;
          text-align: center;
          vertical-align: middle;
        }
        .template-render-sheet .examinee-photo-token-cell .examinee-photo-token-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          min-height: 100%;
          max-width: none;
          max-height: none;
          margin: 0;
          object-fit: contain;
          background: #ffffff;
        }
        .template-render-sheet .examinee-photo-token-cell .examinee-photo-placeholder {
          position: absolute;
          inset: 0;
          width: 100%;
          max-width: none;
          margin: 0;
        }
        .template-render-sheet .template-generated-object,
        .template-preview-stage .template-generated-object {
          background: #ffffff;
        }
        .template-render-sheet .template-generated-object-barcode,
        .template-preview-stage .template-generated-object-barcode {
          object-fit: fill;
        }
        .template-render-sheet .template-generated-object-qrcode,
        .template-preview-stage .template-generated-object-qrcode {
          object-fit: contain;
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
        .template-render-sheet table { width: 100%; border-collapse: collapse; margin: 16px 0; table-layout: fixed; }
        .template-render-sheet th,
        .template-render-sheet td { border: 1px solid #000000; padding: 5px 6px; text-align: left; vertical-align: top; }
        .template-render-sheet hr { border: 0; border-top: 1px solid #d8e0ea; margin: 18px 0; }
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
            <title>수험표 출력</title>
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

      if (state.templatePreview.examineeNo && state.templatePreview.examineeNo !== "-") {
        await recordExamineePrint(state.templatePreview.examineeNo);
      }
    }

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
