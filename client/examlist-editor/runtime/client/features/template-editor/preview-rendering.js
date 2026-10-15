(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorPreviewRendering = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function replaceTemplatePreviewNodeWithMarkup(node, markup) {
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

    const photoElement = cell.querySelector(
      ".examinee-photo-token-frame, .examinee-photo-token-image, .examinee-photo-placeholder",
    );

    if (!photoElement) {
      return;
    }

    const clone = cell.cloneNode(true);
    clone
      .querySelectorAll(".examinee-photo-token-frame, .examinee-photo-token-image, .examinee-photo-placeholder")
      .forEach((element) => element.remove());
    normalizeTemplateEditorExamineePhotoCellClone(clone);

    if (clone.textContent.trim() !== "" || clone.querySelector("*")) {
      return;
    }

    cell.innerHTML = "";
    cell.append(photoElement);
  }

  function isTemplatePhotoDefinition(definition = {}) {
    return [
      definition?.token,
      definition?.key,
      definition?.dataKey,
      definition?.sourceKey,
      definition?.examineeKey,
    ]
      .map((value) => String(value || "").trim())
      .some((value) => ["candidate.photo", "candidate.photoUrl", "candidate.photoFileId", "@{수험생사진}"].includes(value));
  }

  function markTemplatePreviewExamineePhotoTokenCells(rootElement) {
    if (!rootElement?.querySelectorAll) {
      return;
    }

    rootElement.querySelectorAll("td, th").forEach((cell) => {
      if (cell.querySelector(".examinee-photo-token-frame, .examinee-photo-token-image, .examinee-photo-placeholder")) {
        normalizeTemplateEditorExamineePhotoCellContent(cell);
        cell.classList.add("examinee-photo-token-cell");
        return;
      }

      cell.classList.remove("examinee-photo-token-cell");
    });
  }

  function createTemplatePreviewRenderer({
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
  }) {
    function getTemplateTagReplacement(definition, examinee) {
      if (!definition) {
        return "";
      }

      if (isTemplatePhotoDefinition(definition)) {
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

      if (isTemplatePhotoDefinition(definition)) {
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
      clone.removeAttribute("data-template-tag-format-supported");
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

    function renderTemplateWithExaminee(templateHtml, examinee) {
      const container = document.createElement("div");
      container.innerHTML = String(templateHtml || "");
      stripTemplateEditorTransientState(container);
      normalizeTemplateEditorFontNodes(container);
      normalizeTemplateTagNodes(container);

      container.querySelectorAll("[data-template-tag-value]").forEach((tokenElement) => {
        const normalizedTag = normalizeTemplateTag(tokenElement.dataset.templateTagValue);
        const definition = templateTagDefinitions.find((tagDefinition) => tagDefinition.token === normalizedTag);
        replaceTemplatePreviewNodeWithMarkup(tokenElement, getStyledTemplateTagReplacement(tokenElement, definition, examinee));
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
      markTemplatePreviewExamineePhotoTokenCells(renderedContainer);
      return renderedContainer.innerHTML;
    }

    return Object.freeze({
      getTemplateTagReplacement,
      renderTemplateWithExaminee,
    });
  }

  return Object.freeze({
    createTemplatePreviewRenderer,
    markTemplatePreviewExamineePhotoTokenCells,
    normalizeTemplateEditorExamineePhotoCellContent,
    replaceTemplatePreviewNodeWithMarkup,
  });
});

})();
