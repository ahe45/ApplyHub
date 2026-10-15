(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorCommandInsertionRange = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function isRangeInsideElement(range, element) {
    if (!range || !element) {
      return false;
    }

    try {
      return element.contains(range.startContainer) && element.contains(range.endContainer);
    } catch (_error) {
      return false;
    }
  }

  function getTemplateEditorInsertionRoot(templateEditorSurface) {
    if (!templateEditorSurface) {
      return null;
    }

    if (templateEditorSurface.matches?.("[data-candidate-block-modal-editor-surface]")) {
      if (!templateEditorSurface.childNodes.length) {
        templateEditorSurface.innerHTML = "<p><br></p>";
      }

      return templateEditorSurface;
    }

    const existingDocument = templateEditorSurface.querySelector?.(".template-doc") || null;

    if (existingDocument) {
      return existingDocument;
    }

    const documentElement = document.createElement("div");

    documentElement.className = "template-doc";

    while (templateEditorSurface.firstChild) {
      documentElement.append(templateEditorSurface.firstChild);
    }

    if (!documentElement.childNodes.length) {
      documentElement.innerHTML = "<p><br></p>";
    }

    templateEditorSurface.append(documentElement);
    return documentElement;
  }

  function hasMeaningfulDocumentContent(element) {
    if (!element) {
      return false;
    }

    if (String(element.textContent || "").trim()) {
      return true;
    }

    return Boolean(element.querySelector("img, table, hr, [data-template-tag-value], .template-generated-object"));
  }

  function getEmptyDocumentInsertionHost(documentElement) {
    if (!documentElement) {
      return null;
    }

    const existingParagraph = Array.from(documentElement.children).find((child) =>
      /^(P|DIV)$/i.test(String(child.tagName || "")),
    );

    if (existingParagraph) {
      return existingParagraph;
    }

    const paragraph = document.createElement("p");
    paragraph.append(document.createElement("br"));
    documentElement.append(paragraph);
    return paragraph;
  }

  function createFallbackTemplateEditorInsertionRange(templateEditorSurface) {
    const insertionRoot = getTemplateEditorInsertionRoot(templateEditorSurface);

    if (!insertionRoot) {
      return null;
    }

    const range = document.createRange();

    if (insertionRoot !== templateEditorSurface && !hasMeaningfulDocumentContent(insertionRoot)) {
      const host = getEmptyDocumentInsertionHost(insertionRoot);

      if (host) {
        range.setStart(host, 0);
        range.collapse(true);
        return range;
      }
    }

    range.selectNodeContents(insertionRoot);
    range.collapse(false);
    return range;
  }

  function getTemplateEditorInsertionRange(templateEditorSurface, activeRange) {
    const insertionRoot = getTemplateEditorInsertionRoot(templateEditorSurface);

    if (isRangeInsideElement(activeRange, insertionRoot)) {
      return activeRange;
    }

    return createFallbackTemplateEditorInsertionRange(templateEditorSurface);
  }

  function getCurrentTemplateEditorRange(templateEditorSurface) {
    const selection = window.getSelection?.();
    const insertionRoot = getTemplateEditorInsertionRoot(templateEditorSurface);

    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const currentRange = selection.getRangeAt(0);

    return isRangeInsideElement(currentRange, insertionRoot) ? currentRange.cloneRange() : null;
  }

  return Object.freeze({
    createFallbackTemplateEditorInsertionRange,
    getCurrentTemplateEditorRange,
    getEmptyDocumentInsertionHost,
    getTemplateEditorInsertionRange,
    getTemplateEditorInsertionRoot,
    hasMeaningfulDocumentContent,
    isRangeInsideElement,
  });
});

})();
