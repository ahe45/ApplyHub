import { normalizeEditableDocumentRoot } from "./document-editor-root.js";
import { buildLegacyPageDocumentHtml } from "./document-editor-legacy-renderer.js";

export {
  buildDocumentTokenHtml,
  createDocumentTokenElement,
  getDocumentTokenDisplayText,
  normalizeDocumentTokenNodes,
  normalizeDocumentTokenTag,
} from "./document-editor-tokens.js";
export { buildLegacyPageDocumentHtml } from "./document-editor-legacy-renderer.js";

function isMeaningfulDocumentHtml(html) {
  const sourceHtml = String(html || "");

  if (/<(?:figure|hr|table)\b/i.test(sourceHtml)) {
    return true;
  }

  const plainText = sourceHtml
    .replace(/<br\s*\/?>/gi, "")
    .replace(/&nbsp;/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();

  return plainText.length > 0;
}

function normalizeStoredDocumentHtml(html) {
  const normalizedHtml = String(html || "").trim();

  return isMeaningfulDocumentHtml(normalizedHtml) ? normalizedHtml : "";
}


export function getPageDocumentHtml(page) {
  const storedHtml = normalizeStoredDocumentHtml(page?.settings?.documentHtml || "");
  const isDocumentMode = String(page?.settings?.editorMode || "").trim() === "document";
  const sourceHtml = storedHtml || (isDocumentMode ? "" : buildLegacyPageDocumentHtml(page));

  if (!sourceHtml && !isDocumentMode) {
    return "";
  }

  return prepareEditableDocumentHtml(sourceHtml);
}

export function prepareEditableDocumentHtml(value) {
  if (typeof document === "undefined") {
    return normalizeStoredDocumentHtml(value);
  }

  const template = document.createElement("template");

  template.innerHTML = String(value || "");
  normalizeEditableDocumentRoot(template.content);
  return normalizeStoredDocumentHtml(template.innerHTML);
}

export function serializeEditableDocumentRoot(rootNode) {
  if (!rootNode?.cloneNode || typeof document === "undefined") {
    return normalizeStoredDocumentHtml(rootNode?.innerHTML || "");
  }

  const clone = rootNode.cloneNode(true);

  normalizeEditableDocumentRoot(clone);
  return normalizeStoredDocumentHtml(clone.innerHTML);
}

export function syncEditableDocumentRoot(rootNode) {
  normalizeEditableDocumentRoot(rootNode, { preserveTokenPresentation: true, preserveTokenCarets: true });
}

export function sanitizeEditableDocumentHtml(value) {
  return prepareEditableDocumentHtml(value);
}
