import { escapeHtml } from "../../app/html-utils.js";
import {
  dataTagAccordionGroups,
  dataTagFallbackDefinitions,
  getDataTagGroupForKey,
  isVisibleTemplateTag,
  renderDataTagIcon,
} from "./data-tags-config.js";
import { applyDataTagSampleValuesToDefinitions } from "./data-tag-samples.js";
import { isDataTagFormatSupported } from "./data-tag-format-types.js";
import { formatDataTagSampleValue } from "./data-tag-value-formatting.js";
import { getDataTagViewOptions, normalizeDataTagViewOptions } from "./data-tags-view-options.js";
import { generatedObjectPreviewValues } from "./generated-objects-config.js";

const tokenTitleSeparator = " · ";

export function uniqueDataTagValues(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean)));
}

function createTemplateTagDefinition(tag = {}) {
  const key = String(tag?.key || "").trim();
  const fallback = dataTagFallbackDefinitions[key] || {};
  const label = String(fallback.label || tag?.label || key).trim();

  if (!key) {
    return null;
  }

  const iconKey = String(tag?.iconKey || tag?.icon || getDataTagGroupForKey(key)?.icon || "more").trim() || "more";
  const tagLabel = String(tag?.label || "").trim();

  return {
    aliases: uniqueDataTagValues([label, key, tagLabel, ...(Array.isArray(fallback.aliases) ? fallback.aliases : [])]),
    dataKey: key,
    editorToken: `#${label || key}`,
    example: String(tag?.example || fallback.example || generatedObjectPreviewValues[key] || ""),
    id: key,
    iconKey,
    iconMarkup: renderDataTagIcon(iconKey),
    key,
    label: label || key,
    token: key,
    type: String(tag?.type || fallback.type || "string"),
  };
}

export function flattenTemplateTags(dataTags, sampleValues = {}) {
  const tagDefinitions = (Array.isArray(dataTags?.groups) ? dataTags.groups : [])
    .flatMap((group) => (Array.isArray(group?.tags) ? group.tags : []))
    .map(createTemplateTagDefinition)
    .filter(isVisibleTemplateTag);
  const definitionMap = new Map(tagDefinitions.map((definition) => [definition.key, definition]));

  dataTagAccordionGroups.forEach((group) => {
    group.keys.forEach((key) => {
      if (!definitionMap.has(key)) {
        const fallbackDefinition = createTemplateTagDefinition({
          key,
          ...(dataTagFallbackDefinitions[key] || {}),
        });

        if (isVisibleTemplateTag(fallbackDefinition)) {
          definitionMap.set(key, fallbackDefinition);
        }
      }
    });
  });

  return applyDataTagSampleValuesToDefinitions(Array.from(definitionMap.values()), sampleValues);
}

function findTagDefinitionByToken(rawToken, tagDefinitions = []) {
  const normalizedToken = String(rawToken || "")
    .trim()
    .replace(/^@\{/, "")
    .replace(/^#/, "")
    .replace(/\}$/, "");

  if (!normalizedToken) {
    return null;
  }

  return tagDefinitions.find((definition) => {
    const candidates = uniqueDataTagValues([
      definition.key,
      definition.token,
      definition.dataKey,
      definition.label,
      ...(Array.isArray(definition.aliases) ? definition.aliases : []),
    ]);

    return candidates.includes(normalizedToken);
  }) || null;
}

function getFormattedTokenSampleText(definition = {}, tokenElement = null) {
  const sampleText = String(definition.example || "").trim();
  const formatValue = String(tokenElement?.dataset?.templateTagFormat || "").trim();

  if (!sampleText || !formatValue) {
    return sampleText;
  }

  return formatDataTagSampleValue(
    definition,
    sampleText,
    formatValue,
    tokenElement?.dataset?.templateTagFormatType || "",
  ) || sampleText;
}

function getTokenDisplayText(definition = {}, viewOptions = getDataTagViewOptions(), tokenElement = null) {
  const options = normalizeDataTagViewOptions(viewOptions);
  const sampleText = getFormattedTokenSampleText(definition, tokenElement);
  const labelText = String(definition.label || definition.key || "").trim();

  return options.showSampleData && sampleText ? sampleText : labelText;
}

function getTokenIconMarkup(definition = {}, viewOptions = getDataTagViewOptions()) {
  const options = normalizeDataTagViewOptions(viewOptions);

  if (!options.showIcons) {
    return "";
  }

  return definition.iconMarkup || renderDataTagIcon(definition.iconKey || getDataTagGroupForKey(definition.key)?.icon || "more");
}

function getDirectTokenIconElement(tokenElement) {
  return Array.from(tokenElement?.children || []).find((childElement) =>
    String(childElement?.tagName || "").toLowerCase() === "svg"
  ) || null;
}

function setTokenIconMarkupPreservingText(tokenElement, iconMarkup) {
  if (!tokenElement) {
    return;
  }

  const normalizedIconMarkup = String(iconMarkup || "").trim();
  const currentIconElement = getDirectTokenIconElement(tokenElement);

  if (!normalizedIconMarkup) {
    currentIconElement?.remove?.();
    return;
  }

  if (currentIconElement) {
    currentIconElement.outerHTML = normalizedIconMarkup;
    return;
  }

  tokenElement.insertAdjacentHTML?.("afterbegin", normalizedIconMarkup);
}

function isInsideTokenIcon(node) {
  return Boolean(node?.parentElement?.closest?.("svg"));
}

function isTokenIconElement(element) {
  return String(element?.tagName || "").toLowerCase() === "svg";
}

function setTokenTextPreservingMarkup(tokenElement, nextText) {
  if (!tokenElement) {
    return;
  }

  const normalizedText = String(nextText ?? "");
  const textNodes = [];
  const walker = document.createTreeWalker(tokenElement, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    if (!isInsideTokenIcon(walker.currentNode)) {
      textNodes.push(walker.currentNode);
    }
  }

  const meaningfulTextNodes = textNodes.filter((textNode) =>
    String(textNode.textContent || "").replace(/\u00a0/g, " ").trim() !== ""
  );

  if (meaningfulTextNodes.length > 0) {
    meaningfulTextNodes[0].textContent = normalizedText;
    meaningfulTextNodes.slice(1).forEach((textNode) => textNode.remove?.());
    return;
  }

  const styledTextHost = Array.from(tokenElement.children || []).find((childElement) => !isTokenIconElement(childElement));

  if (styledTextHost) {
    styledTextHost.textContent = normalizedText;
    return;
  }

  tokenElement.append?.(document.createTextNode(normalizedText));
}

export function normalizeTokenLabels(rootElement, tagDefinitions = [], viewOptions = getDataTagViewOptions()) {
  const options = normalizeDataTagViewOptions(viewOptions);

  rootElement?.querySelectorAll?.(".template-token[data-template-tag-value]").forEach((tokenElement) => {
    const definition = findTagDefinitionByToken(tokenElement.dataset.templateTagValue, tagDefinitions);

    if (!definition) {
      return;
    }

    const displaySampleText = getFormattedTokenSampleText(definition, tokenElement);

    tokenElement.dataset.templateTagValue = definition.key;
    tokenElement.dataset.templateTagLabel = definition.label;
    tokenElement.dataset.templateTagExample = String(definition.example || "");
    if (isDataTagFormatSupported(definition)) {
      tokenElement.dataset.templateTagFormatSupported = "true";
    } else {
      delete tokenElement.dataset.templateTagFormatSupported;
    }
    tokenElement.setAttribute("contenteditable", "false");
    tokenElement.setAttribute("spellcheck", "false");
    tokenElement.title = [definition.label, displaySampleText].map((value) => String(value || "").trim()).filter(Boolean).join(tokenTitleSeparator);
    tokenElement.classList.toggle("template-token-icons-hidden", !options.showIcons);
    tokenElement.classList.toggle("template-token-sample-display", options.showSampleData);
    setTokenIconMarkupPreservingText(tokenElement, getTokenIconMarkup(definition, options));
    setTokenTextPreservingMarkup(tokenElement, getTokenDisplayText(definition, options, tokenElement));
  });
}
