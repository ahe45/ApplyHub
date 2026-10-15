import { escapeHtml } from "../../app/html-utils.js";
import {
  getGeneratedObjectConfig,
  normalizeGeneratedObjectSourceKey,
  normalizeGeneratedObjectType,
} from "./generated-objects-config.js";
import {
  getGeneratedObjectSourceLabel,
  resolveGeneratedObjectPreviewValue,
} from "./generated-objects-source.js";
import {
  buildGeneratedObjectSvg,
  createGeneratedObjectSvgDataUrl,
} from "./generated-objects-svg.js";

export function buildGeneratedObjectMarkup(objectType, objectSourceKey = "candidate.examNo", {
  previewRecord = null,
  tagDefinitions = [],
} = {}) {
  const normalizedType = normalizeGeneratedObjectType(objectType);
  const objectConfig = getGeneratedObjectConfig(normalizedType);
  const normalizedSourceKey = normalizeGeneratedObjectSourceKey(objectSourceKey);
  const sourceLabel = getGeneratedObjectSourceLabel(normalizedSourceKey, tagDefinitions);
  const previewValue = resolveGeneratedObjectPreviewValue(previewRecord || {}, normalizedSourceKey, tagDefinitions);
  const objectLabel = `${sourceLabel} ${objectConfig.labelSuffix}`;
  const sourceUrl = createGeneratedObjectSvgDataUrl(buildGeneratedObjectSvg(normalizedType, previewValue, normalizedSourceKey));

  return `
    <img
      class="template-generated-object ${objectConfig.className}"
      data-template-object-type="${escapeHtml(normalizedType)}"
      data-template-object-source="${escapeHtml(normalizedSourceKey)}"
      src="${escapeHtml(sourceUrl)}"
      alt="${escapeHtml(`${sourceLabel} ${objectConfig.altSuffix}`)}"
      title="${escapeHtml(objectLabel)}"
      style="width: ${objectConfig.width}px; height: ${objectConfig.height}px;"
    />
  `;
}
