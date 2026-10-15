import { escapeHtml } from "../../app/html-utils.js";

function sortLegacyElements(page) {
  const elements = Array.isArray(page?.elements) ? [...page.elements] : [];

  return elements.sort((left, right) => {
    const topDiff = (Number(left?.y) || 0) - (Number(right?.y) || 0);

    if (topDiff !== 0) {
      return topDiff;
    }

    const leftDiff = (Number(left?.x) || 0) - (Number(right?.x) || 0);

    if (leftDiff !== 0) {
      return leftDiff;
    }

    return (Number(left?.zIndex) || 0) - (Number(right?.zIndex) || 0);
  });
}

function renderLegacyTextBlock(element) {
  const content = String(element?.config?.content || "").trim();

  return `<p>${content ? escapeHtml(content) : "<br />"}</p>`;
}

function renderLegacyTableBlock(element) {
  const columns = Array.isArray(element?.config?.columns) ? element.config.columns : [];

  if (!columns.length) {
    return "<p><br /></p>";
  }

  return `
    <table>
      <thead>
        <tr>
          ${columns.map((column) => `<th>${escapeHtml(column.label || column.key || "")}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        <tr>
          ${columns
            .map((column) => {
              if (column.type === "checkbox") {
                return "<td>□</td>";
              }

              if (column.type === "photo") {
                return "<td>수험생 사진</td>";
              }

              return `<td>${escapeHtml(`{{${String(column.key || "").trim()}}}`)}</td>`;
            })
            .join("")}
        </tr>
      </tbody>
    </table>
  `;
}

function renderLegacyCheckboxBlock(element) {
  const checkedMark = element?.config?.checked ? "☑" : "□";
  const label = String(element?.config?.label || "확인");

  return `<p>${checkedMark} ${escapeHtml(label)}</p>`;
}

function renderLegacySignatureBlock(element) {
  return `
    <figure class="editor-document-signature-box">
      <strong>${escapeHtml(String(element?.config?.label || "감독관 서명"))}</strong>
      <figcaption>${escapeHtml(String(element?.config?.placeholderText || "서명란"))}</figcaption>
    </figure>
  `;
}

function renderLegacyImageBlock(element) {
  const placeholderLabel =
    element?.type === "candidatePhoto" ? "수험생 사진" : String(element?.config?.alt || "이미지");
  const imageSource =
    element?.type === "candidatePhoto"
      ? "{{candidate.photoUrl}}"
      : String(element?.config?.src || "").trim();

  return `
    <figure class="editor-document-image-placeholder" data-image-src="${escapeHtml(imageSource)}">
      <span>${escapeHtml(placeholderLabel)}</span>
    </figure>
  `;
}

function renderLegacyShapeBlock(element) {
  const label = String(element?.config?.label || (element?.type === "ellipse" ? "강조 영역" : "안내 영역"));

  return `<blockquote>${escapeHtml(label)}</blockquote>`;
}

function renderLegacyElementBlock(element) {
  switch (element?.type) {
    case "table":
      return renderLegacyTableBlock(element);
    case "candidatePhoto":
    case "image":
      return renderLegacyImageBlock(element);
    case "line":
      return "<hr />";
    case "rect":
    case "ellipse":
      return renderLegacyShapeBlock(element);
    case "checkbox":
      return renderLegacyCheckboxBlock(element);
    case "signatureBox":
      return renderLegacySignatureBlock(element);
    case "pageNumber":
    case "text":
    case "dataText":
    default:
      return renderLegacyTextBlock(element);
  }
}

export function buildLegacyPageDocumentHtml(page) {
  const elements = sortLegacyElements(page);

  if (!elements.length) {
    return "";
  }

  return elements.map((element) => renderLegacyElementBlock(element)).join("");
}
