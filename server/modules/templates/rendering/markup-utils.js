function createTemplateRenderingMarkupUtils({ escapeHtml }) {
  function setHtmlTagAttribute(tagMarkup, attributeName, attributeValue) {
    const serializedValue = escapeHtml(String(attributeValue ?? ""));
    const attributePattern = new RegExp(`\\s${attributeName}=(["'])(.*?)\\1`, "i");

    if (attributePattern.test(tagMarkup)) {
      return tagMarkup.replace(attributePattern, ` ${attributeName}="${serializedValue}"`);
    }

    const closingIndex = tagMarkup.endsWith("/>") ? tagMarkup.lastIndexOf("/>") : tagMarkup.lastIndexOf(">");

    if (closingIndex === -1) {
      return tagMarkup;
    }

    return `${tagMarkup.slice(0, closingIndex)} ${attributeName}="${serializedValue}"${tagMarkup.slice(closingIndex)}`;
  }

  function appendHtmlTagClass(tagMarkup, className) {
    const normalizedClassName = String(className || "").trim();

    if (!normalizedClassName) {
      return tagMarkup;
    }

    const classPattern = /\sclass=(["'])([^"']*)\1/i;

    if (classPattern.test(tagMarkup)) {
      return tagMarkup.replace(classPattern, (fullMatch, quote, classValue) => {
        const nextClassNames = String(classValue || "")
          .split(/\s+/)
          .filter(Boolean);

        if (!nextClassNames.includes(normalizedClassName)) {
          nextClassNames.push(normalizedClassName);
        }

        return ` class=${quote}${nextClassNames.join(" ")}${quote}`;
      });
    }

    return setHtmlTagAttribute(tagMarkup, "class", normalizedClassName);
  }

  function findMatchingSpanMarkupEnd(markup, startIndex) {
    const openTagEndIndex = String(markup || "").indexOf(">", startIndex);

    if (openTagEndIndex < 0) {
      return -1;
    }

    const tagPattern = /<span\b|<\/span>/gi;
    tagPattern.lastIndex = openTagEndIndex + 1;
    let depth = 1;
    let match;

    while ((match = tagPattern.exec(markup))) {
      if (match[0][1] === "/") {
        depth -= 1;

        if (depth === 0) {
          return tagPattern.lastIndex;
        }
        continue;
      }

      depth += 1;
    }

    return -1;
  }

  function stripTemplateTokenDecorationMarkup(tokenMarkup) {
    let nextMarkup = String(tokenMarkup || "");

    nextMarkup = nextMarkup.replace(/\sdata-template-tag-value=(["'])[^"']*\1/gi, "");
    nextMarkup = nextMarkup.replace(/\sdata-template-tag-[\w-]+=(["'])[^"']*\1/gi, "");
    nextMarkup = nextMarkup.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "");
    nextMarkup = nextMarkup.replace(/\stitle=(["'])[^"']*\1/gi, "");
    nextMarkup = nextMarkup.replace(/\sdata-template-token=(["'])[^"']*\1/gi, "");
    nextMarkup = nextMarkup.replace(/\sspellcheck=(["'])[^"']*\1/gi, "");
    nextMarkup = nextMarkup.replace(/\scontenteditable=(["'])[^"']*\1/gi, "");
    nextMarkup = nextMarkup.replace(/\sclass=(["'])([^"']*)\1/gi, (fullMatch, quote, classValue) => {
      const nextClasses = String(classValue || "")
        .split(/\s+/)
        .filter(Boolean)
        .filter((className) => className !== "template-token" && className !== "template-data-fit");

      return nextClasses.length > 0 ? ` class=${quote}${nextClasses.join(" ")}${quote}` : "";
    });

    return nextMarkup;
  }

  function sanitizeTemplateRenderHtml(templateHtml) {
    const transientClassNames = new Set([
      "template-editor-image-object",
      "is-selected-object",
      "is-moving-object",
      "is-floating-object",
      "is-active-cell",
      "is-selected-cell",
    ]);
    let markup = String(templateHtml || "");

    markup = markup
      .replace(/<div[^>]*class=(["'])[^"']*\btemplate-editor-image-selection\b[^"']*\1[^>]*>[\s\S]*?<\/div>/gi, "")
      .replace(/<button[^>]*class=(["'])[^"']*\btemplate-editor-image-resize-handle\b[^"']*\1[^>]*>[\s\S]*?<\/button>/gi, "")
      .replace(/\sdraggable=(["'])[^"']*\1/gi, "")
      .replace(/\scontenteditable=(["'])[^"']*\1/gi, "");

    markup = markup.replace(/\sclass=(["'])([^"']*)\1/gi, (fullMatch, quote, classValue) => {
      const nextClassNames = String(classValue || "")
        .split(/\s+/)
        .filter(Boolean)
        .filter((className) => !transientClassNames.has(className));

      return nextClassNames.length > 0 ? ` class=${quote}${nextClassNames.join(" ")}${quote}` : "";
    });

    return markup;
  }

  return Object.freeze({
    appendHtmlTagClass,
    findMatchingSpanMarkupEnd,
    sanitizeTemplateRenderHtml,
    setHtmlTagAttribute,
    stripTemplateTokenDecorationMarkup,
  });
}

module.exports = {
  createTemplateRenderingMarkupUtils,
};
