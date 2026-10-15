import { escapeHtml } from "../../app/html-utils.js";
import { isDataTagFormatSupported } from "./data-tag-format-types.js";

export function normalizeDocumentTokenTag(rawTag) {
  return String(rawTag || "")
    .trim()
    .replace(/^{{\s*/, "")
    .replace(/\s*}}$/, "")
    .replace(/^#/, "");
}

export function getDocumentTokenDisplayText(rawTag) {
  const normalizedTag = normalizeDocumentTokenTag(rawTag);

  return normalizedTag;
}

function getDocumentTokenIconMarkup(tokenElement) {
  const iconElement = tokenElement?.querySelector?.("svg");

  return iconElement ? iconElement.outerHTML : "";
}

function buildDocumentTokenContentHtml(displayText, iconMarkup = "") {
  const normalizedDisplayText = String(displayText || "").trim();
  const normalizedIconMarkup = String(iconMarkup || "").trim();

  return `${normalizedIconMarkup}${escapeHtml(normalizedDisplayText)}`;
}

function syncDocumentTokenFormatSupportAttribute(tokenElement, definitionOrKey = "") {
  if (!tokenElement?.dataset) {
    return;
  }

  if (isDataTagFormatSupported(definitionOrKey)) {
    tokenElement.dataset.templateTagFormatSupported = "true";
  } else {
    delete tokenElement.dataset.templateTagFormatSupported;
  }
}

export function createDocumentTokenElement(rawTag, displayLabel = "", options = {}) {
  const normalizedTag = normalizeDocumentTokenTag(rawTag);
  const normalizedDisplayLabel = normalizeDocumentTokenTag(displayLabel);
  const tokenElement = document.createElement("span");

  tokenElement.className = "template-token";
  tokenElement.dataset.templateTagValue = normalizedTag;
  syncDocumentTokenFormatSupportAttribute(tokenElement, normalizedTag);

  if (normalizedDisplayLabel && normalizedDisplayLabel !== normalizedTag) {
    tokenElement.dataset.templateTagLabel = normalizedDisplayLabel;
  }

  tokenElement.setAttribute("contenteditable", "false");
  tokenElement.setAttribute("data-template-token", "true");
  tokenElement.setAttribute("spellcheck", "false");
  tokenElement.innerHTML = buildDocumentTokenContentHtml(
    getDocumentTokenDisplayText(normalizedDisplayLabel || normalizedTag),
    options.iconMarkup,
  );
  return tokenElement;
}

export function buildDocumentTokenHtml(rawTag, displayLabel = "", options = {}) {
  const normalizedTag = normalizeDocumentTokenTag(rawTag);
  const normalizedDisplayLabel = normalizeDocumentTokenTag(displayLabel);

  if (!normalizedTag) {
    return "";
  }

  const labelAttribute = normalizedDisplayLabel && normalizedDisplayLabel !== normalizedTag
    ? ` data-template-tag-label="${escapeHtml(normalizedDisplayLabel)}"`
    : "";
  const iconMarkup = String(options?.iconMarkup || "").trim();
  const formatSupportAttribute = isDataTagFormatSupported(normalizedTag) ? ' data-template-tag-format-supported="true"' : "";
  const contentHtml = buildDocumentTokenContentHtml(
    getDocumentTokenDisplayText(normalizedDisplayLabel || normalizedTag),
    iconMarkup,
  );

  return `<span class="template-token" data-template-token="true" spellcheck="false" data-template-tag-value="${escapeHtml(
    normalizedTag,
  )}"${labelAttribute}${formatSupportAttribute} contenteditable="false">${contentHtml}</span>`;
}

function getDocumentTokenPattern() {
  return /{{\s*([^}]+?)\s*}}/g;
}

function hasVisibleTokenPresentation(tokenElement) {
  return Boolean(String(tokenElement?.textContent || "").replace(/\u00a0/g, " ").trim());
}

export function normalizeDocumentTokenNodes(rootElement, options = {}) {
  if (!rootElement?.querySelectorAll || typeof document === "undefined") {
    return;
  }

  const preservePresentation = options.preservePresentation === true;

  rootElement.querySelectorAll("[data-template-tag-value]").forEach((tokenElement) => {
    const normalizedTag = normalizeDocumentTokenTag(tokenElement.dataset.templateTagValue || tokenElement.textContent || "");
    const normalizedDisplayLabel = normalizeDocumentTokenTag(tokenElement.dataset.templateTagLabel || "");

    tokenElement.classList.add("template-token");
    tokenElement.dataset.templateTagValue = normalizedTag;
    syncDocumentTokenFormatSupportAttribute(tokenElement, normalizedTag);

    if (normalizedDisplayLabel && normalizedDisplayLabel !== normalizedTag) {
      tokenElement.dataset.templateTagLabel = normalizedDisplayLabel;
    } else {
      delete tokenElement.dataset.templateTagLabel;
    }

    tokenElement.setAttribute("contenteditable", "false");
    tokenElement.setAttribute("data-template-token", "true");
    tokenElement.setAttribute("spellcheck", "false");

    if (preservePresentation && hasVisibleTokenPresentation(tokenElement)) {
      return;
    }

    tokenElement.innerHTML = buildDocumentTokenContentHtml(
      getDocumentTokenDisplayText(normalizedDisplayLabel || normalizedTag),
      getDocumentTokenIconMarkup(tokenElement),
    );
  });

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
    const sourceText = String(textNode.textContent || "");
    const tokenPattern = getDocumentTokenPattern();

    if (!tokenPattern.test(sourceText)) {
      return;
    }

    tokenPattern.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    sourceText.replace(tokenPattern, (matchedText, tokenExpression, offset) => {
      if (offset > lastIndex) {
        fragment.append(sourceText.slice(lastIndex, offset));
      }

      fragment.append(createDocumentTokenElement(tokenExpression));
      lastIndex = offset + matchedText.length;
      return matchedText;
    });

    if (lastIndex < sourceText.length) {
      fragment.append(sourceText.slice(lastIndex));
    }

    textNode.replaceWith(fragment);
  });
}
