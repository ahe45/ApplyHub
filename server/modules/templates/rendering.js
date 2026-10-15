const { createTemplateGeneratedObjectService } = require("./rendering/generated-objects");
const { createTemplateRenderingMarkupUtils } = require("./rendering/markup-utils");
const { createTemplatePhotoMarkupService } = require("./rendering/photo-markup");
const { createTemplateTagReplacementService } = require("./rendering/tag-replacements");
const { dynamicDefinition } = require('../../../shared/domain/template-data');

function createTemplateRenderingService({
  createHttpError,
  escapeHtml,
  formatDateAsYmd,
  templateTagDefinitions,
}) {
  const markupUtils = createTemplateRenderingMarkupUtils({ escapeHtml });
  const {
    appendHtmlTagClass,
    findMatchingSpanMarkupEnd,
    sanitizeTemplateRenderHtml,
    setHtmlTagAttribute,
    stripTemplateTokenDecorationMarkup,
  } = markupUtils;

  const photoMarkupService = createTemplatePhotoMarkupService({
    appendHtmlTagClass,
    escapeHtml,
  });
  const { buildExamineePhotoMarkup, markExamineePhotoTableCells } = photoMarkupService;

  const generatedObjectService = createTemplateGeneratedObjectService({
    createHttpError,
    setHtmlTagAttribute,
  });
  const { buildTemplateGeneratedObjectSvg, replaceTemplateGeneratedObjectMarkup } = generatedObjectService;

  async function renderTemplateMarkupWithExaminee(markup, examinee) {
    const definitions = new Map([...templateTagDefinitions, ...(examinee.templateTags || [])].map(tag => [tag.token, tag]));
    for (const match of markup.matchAll(/<span\b[^>]*\sdata-template-tag-value=(["'])(@\{(?:회원가입|원서접수):[a-zA-Z0-9_-]{1,64}\})\1[^>]*>/gi)) {
      const label = /\bdata-template-tag-label=(["'])([^"']*)\1/i.exec(match[0])?.[2];
      const decodedLabel = label?.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
      const tag = dynamicDefinition(match[2], decodedLabel);
      if (tag) definitions.set(tag.token, { ...tag, ...definitions.get(tag.token), ...(decodedLabel ? { label: decodedLabel } : {}) });
    }
    for (const match of markup.matchAll(/@\{(?:회원가입|원서접수):[a-zA-Z0-9_-]{1,64}\}/g)) {
      const tag = dynamicDefinition(match[0]);
      if (tag && !definitions.has(tag.token)) definitions.set(tag.token, tag);
    }
    const tags = [...definitions.values()];
    const { getTemplateTagPlainTextReplacement, replaceStyledTemplateTagMarkup } = createTemplateTagReplacementService({
      buildExamineePhotoMarkup, escapeHtml, findMatchingSpanMarkupEnd, formatDateAsYmd, stripTemplateTokenDecorationMarkup, templateTagDefinitions: tags,
    });
    markup = replaceStyledTemplateTagMarkup(markup, examinee);

    tags.forEach((definition) => {
      const replacementText = getTemplateTagPlainTextReplacement(definition, examinee);
      [definition.token, definition.editorToken, ...(definition.editorTokens || []), ...(definition.legacyTokens || [])]
        .filter(Boolean)
        .forEach((tokenValue) => {
          markup = markup.replaceAll(tokenValue, replacementText);
        });

      [definition.legacyTag, ...(definition.legacyTags || [])]
        .filter(Boolean)
        .forEach((legacyTag) => {
          markup = markup.replaceAll(legacyTag, replacementText);
        });
    });

    const renderedMarkup = await replaceTemplateGeneratedObjectMarkup(markup, examinee);
    return markExamineePhotoTableCells(renderedMarkup);
  }

  function createTemplateExamineeRenderer(templateHtml) {
    const sanitizedTemplateHtml = sanitizeTemplateRenderHtml(templateHtml);

    return async function renderTemplateMarkup(examinee) {
      return renderTemplateMarkupWithExaminee(sanitizedTemplateHtml, examinee);
    };
  }

  async function renderTemplateWithExaminee(templateHtml, examinee) {
    return createTemplateExamineeRenderer(templateHtml)(examinee);
  }

  return Object.freeze({
    buildTemplateGeneratedObjectSvg,
    createTemplateExamineeRenderer,
    renderTemplateWithExaminee,
  });
}

module.exports = {
  createTemplateRenderingService,
};
