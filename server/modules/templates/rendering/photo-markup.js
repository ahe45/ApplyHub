function createTemplatePhotoMarkupService({
  appendHtmlTagClass,
  escapeHtml,
}) {
  function buildExamineePhotoMarkup(examinee) {
    if (examinee?.useTemplatePreviewPhoto === true) {
      return '<img class="examinee-photo-token-image" src="/client/assets/template-preview-photo.png" alt="샘플 수험생 사진" />';
    }
    if (!examinee?.photoBlob || !examinee?.photoMime) {
      return '<span class="examinee-photo-placeholder">사진 미등록</span>';
    }

    const encodedImage = Buffer.from(examinee.photoBlob).toString("base64");
    return `<img class="examinee-photo-token-image" src="data:${examinee.photoMime};base64,${encodedImage}" alt="${escapeHtml(
      `${examinee.name || examinee.examineeNo || "수험생"} 사진`,
    )}" />`;
  }

  function extractExamineePhotoCellMarkup(content) {
    const photoPattern =
      /(<img\b[^>]*class=(["'])[^"']*\bexaminee-photo-token-image\b[^"']*\2[^>]*>|<span\b[^>]*class=(["'])[^"']*\bexaminee-photo-placeholder\b[^"']*\3[^>]*>[\s\S]*?<\/span>)/i;
    return String(content || "").match(photoPattern)?.[1] || "";
  }

  function normalizeExamineePhotoTableCellContent(content) {
    const photoMarkup = extractExamineePhotoCellMarkup(content);

    if (!photoMarkup) {
      return String(content || "");
    }

    const remainder = String(content || "").replace(photoMarkup, "");
    const normalizedRemainder = remainder
      .replace(/<br\s*\/?>/gi, "")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/<[^>]+>/g, "")
      .trim();

    return normalizedRemainder === "" ? photoMarkup : String(content || "");
  }

  function markExamineePhotoTableCells(markup) {
    return String(markup || "").replace(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (fullMatch, tagName, attributes, content) => {
      if (!/(examinee-photo-token-image|examinee-photo-placeholder)/i.test(content)) {
        return fullMatch;
      }

      const openingTag = appendHtmlTagClass(`<${tagName}${attributes}>`, "examinee-photo-token-cell");
      return `${openingTag}${normalizeExamineePhotoTableCellContent(content)}</${tagName}>`;
    });
  }

  return Object.freeze({
    buildExamineePhotoMarkup,
    markExamineePhotoTableCells,
  });
}

module.exports = {
  createTemplatePhotoMarkupService,
};
