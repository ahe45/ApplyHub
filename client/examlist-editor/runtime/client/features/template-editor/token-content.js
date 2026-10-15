(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTokenContent = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const pageSettingsModule = globalThis.ExamListTemplateEditorPageSettings;

  function createTemplateEditorTokenContentController({
    decorateTemplateEditorImages,
    getTemplateEditorTagDisplay,
    getTemplateEditorSurface,
    normalizeTemplateEditorFontNodes,
    normalizeTemplateEditorTables,
    templateTagDefinitions,
  }) {
    const formatSupportedDateTagKeys = new Set(["candidate.examDate", "candidate.birthDate"]);
    const formatSupportedTimeTagKeys = new Set(["candidate.examStartTime", "candidate.examEndTime"]);
    const resolveTemplateEditorTagDisplay =
      typeof getTemplateEditorTagDisplay === "function" ? getTemplateEditorTagDisplay : null;

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    }

    function escapeAttribute(value) {
      return escapeHtml(value).replaceAll('"', "&quot;");
    }

    function escapeRegExp(value) {
      return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function normalizeTemplateTag(rawTag) {
      const label = String(rawTag || "")
        .trim()
        .replace(/^@\{?/, "")
        .replace(/^#/, "")
        .replace(/\}$/, "");

      if (!label) {
        return "";
      }

      const matchedDefinition = templateTagDefinitions.find((definition) =>
        (Array.isArray(definition.aliases) ? definition.aliases : [definition.label]).includes(label),
      );
      return matchedDefinition?.token || `@{${label}}`;
    }

    function isTemplateTagFormatSupported(definitionOrKey = {}) {
      const key = typeof definitionOrKey === "string"
        ? String(definitionOrKey || "").trim()
        : String(definitionOrKey?.key || definitionOrKey?.dataKey || definitionOrKey?.token || "").trim();
      const type = typeof definitionOrKey === "string" ? "" : String(definitionOrKey?.type || "").trim().toLowerCase();

      return formatSupportedDateTagKeys.has(key) || formatSupportedTimeTagKeys.has(key) || type === "date" || type === "time" || type === "datetime";
    }

    function syncTemplateTokenFormatSupportAttribute(tokenElement, definitionOrKey = "") {
      if (!(tokenElement instanceof HTMLElement)) {
        return;
      }

      if (isTemplateTagFormatSupported(definitionOrKey)) {
        tokenElement.dataset.templateTagFormatSupported = "true";
      } else {
        delete tokenElement.dataset.templateTagFormatSupported;
      }
    }

    function findTemplateTagDefinition(rawTag) {
      const normalizedTag = normalizeTemplateTag(rawTag);

      if (!normalizedTag) {
        return null;
      }

      return (
        templateTagDefinitions.find((definition) => {
          const candidates = [
            definition.token,
            definition.key,
            definition.dataKey,
            definition.examineeKey,
            ...(Array.isArray(definition.aliases) ? definition.aliases : []),
          ]
            .map((value) => String(value || "").trim())
            .filter(Boolean);

          return candidates.includes(normalizedTag);
        }) || null
      );
    }

    function getTemplateEditorTagText(rawTag) {
      const normalizedTag = normalizeTemplateTag(rawTag);

      if (!normalizedTag) {
        return "";
      }

      const matchedDefinition = findTemplateTagDefinition(normalizedTag);
      const displayLabel = String(matchedDefinition?.label || normalizedTag.replace(/^@\{/, "").replace(/\}$/, "")).trim();

      return displayLabel;
    }

    function getTemplateEditorTagIconMarkup(rawTag) {
      const matchedDefinition = findTemplateTagDefinition(rawTag);

      return String(matchedDefinition?.iconMarkup || "").trim();
    }

    function normalizeTemplateEditorTagPresentation(rawPresentation, fallbackText, fallbackIconMarkup) {
      const presentation = rawPresentation && typeof rawPresentation === "object" ? rawPresentation : {};
      const hasText = Object.prototype.hasOwnProperty.call(presentation, "text");
      const hasIconMarkup = Object.prototype.hasOwnProperty.call(presentation, "iconMarkup");
      const hasTitle = Object.prototype.hasOwnProperty.call(presentation, "title");
      const resolvedText = hasText ? presentation.text : fallbackText;
      const resolvedIconMarkup = hasIconMarkup ? presentation.iconMarkup : fallbackIconMarkup;

      return {
        hideIcons: presentation.hideIcons === true,
        iconMarkup: String(resolvedIconMarkup || "").trim(),
        sampleDisplay: presentation.sampleDisplay === true,
        text: String(resolvedText ?? ""),
        title: hasTitle ? String(presentation.title || "") : "",
      };
    }

    function getTemplateEditorTagPresentation(rawTag, { storage = false, formatValue = "", formatType = "" } = {}) {
      const normalizedTag = normalizeTemplateTag(rawTag);
      const matchedDefinition = findTemplateTagDefinition(normalizedTag);
      const fallbackText = getTemplateEditorTagText(normalizedTag);
      const fallbackIconMarkup = getTemplateEditorTagIconMarkup(normalizedTag);

      if (storage || !resolveTemplateEditorTagDisplay) {
        return normalizeTemplateEditorTagPresentation(null, fallbackText, fallbackIconMarkup);
      }

      try {
        return normalizeTemplateEditorTagPresentation(
          resolveTemplateEditorTagDisplay({
            definition: matchedDefinition,
            iconMarkup: fallbackIconMarkup,
            label: fallbackText,
            tag: normalizedTag,
            formatValue,
            formatType,
          }),
          fallbackText,
          fallbackIconMarkup,
        );
      } catch (_error) {
        return normalizeTemplateEditorTagPresentation(null, fallbackText, fallbackIconMarkup);
      }
    }

    function setTemplateTokenTextPreservingMarkup(tokenElement, nextText) {
      if (!(tokenElement instanceof Element)) {
        return;
      }

      const normalizedText = String(nextText ?? "");
      const textNodes = [];
      const walker = document.createTreeWalker(tokenElement, NodeFilter.SHOW_TEXT);

      while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
      }

      const meaningfulTextNodes = textNodes.filter((textNode) => String(textNode.textContent || "").replace(/\u00a0/g, " ").trim() !== "");

      if (meaningfulTextNodes.length === 0) {
        tokenElement.textContent = normalizedText;
        return;
      }

      meaningfulTextNodes[0].textContent = normalizedText;
      meaningfulTextNodes.slice(1).forEach((textNode) => textNode.remove());
    }

    function applyTemplateTokenObjectAttributes(tokenElement) {
      if (!(tokenElement instanceof HTMLElement)) {
        return;
      }

      tokenElement.classList.add("template-token");
      tokenElement.setAttribute("contenteditable", "false");
      tokenElement.setAttribute("data-template-token", "true");
      tokenElement.setAttribute("spellcheck", "false");
    }

    function setTemplateTokenIconMarkupPreservingText(tokenElement, iconMarkup) {
      if (!(tokenElement instanceof Element)) {
        return;
      }

      const normalizedIconMarkup = String(iconMarkup || "").trim();
      const currentIconElement = tokenElement.querySelector("svg");

      if (!normalizedIconMarkup) {
        currentIconElement?.remove();
        return;
      }

      if (currentIconElement) {
        currentIconElement.outerHTML = normalizedIconMarkup;
        return;
      }

      tokenElement.insertAdjacentHTML("afterbegin", normalizedIconMarkup);
    }

    function setTemplateTokenIconPreservingText(tokenElement, normalizedTag) {
      setTemplateTokenIconMarkupPreservingText(tokenElement, getTemplateEditorTagIconMarkup(normalizedTag));
    }

    function applyTemplateTokenPresentation(tokenElement, normalizedTag, { storage = false } = {}) {
      if (!(tokenElement instanceof HTMLElement)) {
        return;
      }

      const matchedDefinition = findTemplateTagDefinition(normalizedTag);
      const presentation = getTemplateEditorTagPresentation(normalizedTag, { storage, formatValue: tokenElement.dataset.templateTagFormat || "", formatType: tokenElement.dataset.templateTagFormatType || "" });
      const label = String(matchedDefinition?.label || presentation.text || "").trim();
      const example = String(matchedDefinition?.example || "").trim();
      const title = presentation.title || [label, example].filter(Boolean).join(" / ");

      tokenElement.dataset.templateTagValue = normalizedTag;

      if (label) {
        tokenElement.dataset.templateTagLabel = label;
      } else {
        delete tokenElement.dataset.templateTagLabel;
      }

      if (example) {
        tokenElement.dataset.templateTagExample = example;
      } else {
        delete tokenElement.dataset.templateTagExample;
      }

      if (title) {
        tokenElement.title = title;
      } else {
        tokenElement.removeAttribute("title");
      }

      syncTemplateTokenFormatSupportAttribute(tokenElement, matchedDefinition || normalizedTag);
      tokenElement.classList.toggle("template-token-icons-hidden", presentation.hideIcons);
      tokenElement.classList.toggle("template-token-sample-display", presentation.sampleDisplay);
      setTemplateTokenIconMarkupPreservingText(tokenElement, presentation.iconMarkup);
      setTemplateTokenTextPreservingMarkup(tokenElement, presentation.text);
    }

    function buildTemplateTokenHtml(rawTag) {
      const normalizedTag = normalizeTemplateTag(rawTag);
      const presentation = getTemplateEditorTagPresentation(normalizedTag);

      if (!normalizedTag || !presentation.text) {
        return "";
      }

      const matchedDefinition = findTemplateTagDefinition(normalizedTag);
      const label = String(matchedDefinition?.label || presentation.text || "").trim();
      const example = String(matchedDefinition?.example || "").trim();
      const title = presentation.title || [label, example].filter(Boolean).join(" / ");
      const formatSupportAttribute = isTemplateTagFormatSupported(matchedDefinition || normalizedTag)
        ? ' data-template-tag-format-supported="true"'
        : "";
      const classNames = [
        "template-token",
        presentation.hideIcons ? "template-token-icons-hidden" : "",
        presentation.sampleDisplay ? "template-token-sample-display" : "",
      ].filter(Boolean).join(" ");

      return `<span class="${escapeAttribute(classNames)}" contenteditable="false" data-template-token="true" spellcheck="false" data-template-tag-value="${escapeAttribute(normalizedTag)}"${
        label ? ` data-template-tag-label="${escapeAttribute(label)}"` : ""
      }${example ? ` data-template-tag-example="${escapeAttribute(example)}"` : ""}${formatSupportAttribute}${title ? ` title="${escapeAttribute(title)}"` : ""}>${
        presentation.iconMarkup
      }${escapeHtml(presentation.text)}</span>`;
    }

    function createTemplateTokenElement(rawTag) {
      const normalizedTag = normalizeTemplateTag(rawTag);
      const tokenElement = document.createElement("span");

      applyTemplateTokenObjectAttributes(tokenElement);
      applyTemplateTokenPresentation(tokenElement, normalizedTag);
      return tokenElement;
    }

    function getTemplateTagMatcher() {
      const labels = Array.from(
        new Set(
          templateTagDefinitions.flatMap((definition) =>
            (Array.isArray(definition.aliases) ? definition.aliases : [definition.label]).map((label) => escapeRegExp(label)),
          ),
        ),
      ).join("|");

      if (!labels) {
        return /$^/g;
      }

      return new RegExp(`@\\{(${labels})\\}|@(${labels})|#(${labels})`, "g");
    }

    function stripTemplateEditorTransientState(rootElement) {
      if (!rootElement?.querySelectorAll) {
        return;
      }

      globalThis.ExamListDocumentHtmlSanitizer?.stripTransientDocumentState(rootElement);

      rootElement.querySelectorAll("[data-template-object-flow-spacer]").forEach((element) => element.remove());
      rootElement
        .querySelectorAll("[data-template-object-flow-id]")
        .forEach((element) => element.removeAttribute("data-template-object-flow-id"));
      rootElement
        .querySelectorAll(
          ".template-editor-image-selection, .template-editor-image-resize-handle, .examlist-object-selection, .examlist-object-resize-handle, .template-editor-table-selection, .template-editor-table-handle, .template-editor-table-move-handle, .template-editor-table-select-handle, [data-candidate-block-grid-resize-handle], [data-candidate-block-grid-move-handle], [data-candidate-block-focus-backdrop], .examlist-candidate-block-focus-backdrop, [data-candidate-block-focus-layer], .examlist-candidate-block-focus-layer",
        )
        .forEach((element) => element.remove());
      rootElement
        .querySelectorAll("[data-candidate-block-focus-placeholder], .is-candidate-block-focus-placeholder")
        .forEach((element) => element.remove());

      const transientClassNames = [
        "template-editor-image-object",
        "is-selected-object",
        "is-moving-object",
        "is-floating-object",
        "is-selected-table-object",
        "is-selected-candidate-block-grid",
        "is-resizing-candidate-block-grid",
        "is-moving-candidate-block-grid",
        "is-candidate-block-focus-editor",
        "is-candidate-block-focus-active",
        "is-candidate-block-focus-placeholder",
        "is-active-cell",
        "is-selected-cell",
      ];
      const transientSelector = transientClassNames.map((className) => `.${className}`).join(", ");

      rootElement.querySelectorAll(transientSelector).forEach((element) => {
        transientClassNames.forEach((className) => element.classList.remove(className));
      });

      rootElement.querySelectorAll("img[draggable]").forEach((imageElement) => {
        imageElement.removeAttribute("draggable");
      });

      rootElement.querySelectorAll("img[contenteditable]").forEach((imageElement) => {
        imageElement.removeAttribute("contenteditable");
      });
    }

    function normalizeTemplateTagNodes(rootElement) {
      if (!rootElement) {
        return;
      }

      rootElement.querySelectorAll("[data-template-tag-value]").forEach((tokenElement) => {
        const normalizedTag = normalizeTemplateTag(tokenElement.dataset.templateTagValue || tokenElement.textContent || "");
        tokenElement.classList.remove("template-data-fit");
        applyTemplateTokenObjectAttributes(tokenElement);
        applyTemplateTokenPresentation(tokenElement, normalizedTag);
      });

      const tagMatcher = getTemplateTagMatcher();
      const textNodes = [];
      const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);

      while (walker.nextNode()) {
        const currentNode = walker.currentNode;

        if (!currentNode.parentElement || currentNode.parentElement.closest("[data-template-tag-value]")) {
          continue;
        }

        textNodes.push(currentNode);
      }

      textNodes.forEach((textNode) => {
        const sourceText = textNode.textContent || "";
        tagMatcher.lastIndex = 0;

        if (!tagMatcher.test(sourceText)) {
          return;
        }

        const fragment = document.createDocumentFragment();
        let lastIndex = 0;

        sourceText.replace(tagMatcher, (matchedText, bracedLabel, plainLabel, hashLabel, offset) => {
          const label = bracedLabel || plainLabel || hashLabel;

          if (offset > lastIndex) {
            fragment.append(sourceText.slice(lastIndex, offset));
          }

          fragment.append(createTemplateTokenElement(`@{${label}}`));
          lastIndex = offset + matchedText.length;
          return matchedText;
        });

        if (lastIndex < sourceText.length) {
          fragment.append(sourceText.slice(lastIndex));
        }

        textNode.replaceWith(fragment);
      });
    }

    function prepareTemplateEditorContent(templateHtml) {
      const container = document.createElement("div");
      container.innerHTML = String(templateHtml || "");
      stripTemplateEditorTransientState(container);
      normalizeTemplateEditorFontNodes(container);
      normalizeTemplateTagNodes(container);
      normalizeTemplateEditorTables(container);

      if (!container.querySelector(".template-doc")) {
        const wrapper = document.createElement("div");
        wrapper.className = "template-doc";
        wrapper.innerHTML = container.innerHTML;
        container.innerHTML = "";
        container.append(wrapper);
      }

      pageSettingsModule?.normalizeTemplatePageDocumentSettings?.(container.querySelector(".template-doc"));

      decorateTemplateEditorImages(container);

      return container.innerHTML;
    }

    function getTemplateEditorSerializedHtml() {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface) {
        return "";
      }

      const clone = templateEditorSurface.cloneNode(true);
      clone.querySelectorAll("[data-template-tag-value]").forEach((tokenElement) => {
        const normalizedTag = normalizeTemplateTag(tokenElement.dataset.templateTagValue || tokenElement.textContent || "");
        tokenElement.classList.remove("template-data-fit");
        applyTemplateTokenObjectAttributes(tokenElement);
        applyTemplateTokenPresentation(tokenElement, normalizedTag, { storage: true });
      });
      stripTemplateEditorTransientState(clone);
      normalizeTemplateEditorFontNodes(clone);
      return clone.innerHTML;
    }

    return Object.freeze({
      buildTemplateTokenHtml,
      escapeAttribute,
      escapeHtml,
      escapeRegExp,
      getTemplateEditorSerializedHtml,
      getTemplateEditorTagText,
      normalizeTemplateTag,
      normalizeTemplateTagNodes,
      prepareTemplateEditorContent,
      stripTemplateEditorTransientState,
    });
  }

  return Object.freeze({
    createTemplateEditorTokenContentController,
  });
});

})();
