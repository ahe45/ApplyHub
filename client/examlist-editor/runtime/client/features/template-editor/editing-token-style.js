(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorEditingTokenStyle = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateEditorTokenStyleController({
    TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
    getTemplateEditorSurface,
    restoreTemplateEditorSelection,
    saveTemplateEditorSelection,
    setTemplateEditorStatus,
    syncTemplateEditorContent,
    updateTemplateEditorActiveCell,
  }) {
    function getActiveTemplateTokenTargets() {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface) {
        return [];
      }

      let selection = window.getSelection();
      let range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

      if (!range || !templateEditorSurface.contains(range.commonAncestorContainer)) {
        restoreTemplateEditorSelection?.();
        selection = window.getSelection();
        range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      }

      if (!range || !templateEditorSurface.contains(range.commonAncestorContainer)) {
        return [];
      }

      const tokenSelector = ".template-token[data-template-tag-value]";
      const tokens = Array.from(templateEditorSurface.querySelectorAll(tokenSelector));

      if (!range.collapsed) {
        return tokens.filter((tokenElement) => {
          try {
            return range.intersectsNode(tokenElement);
          } catch (_error) {
            return false;
          }
        });
      }

      const startNode = range.startContainer;
      const closestToken =
        startNode instanceof Element
          ? startNode.closest?.(tokenSelector)
          : startNode?.parentElement?.closest?.(tokenSelector);

      if (closestToken && templateEditorSurface.contains(closestToken)) {
        return [closestToken];
      }

      const parentNode = startNode?.nodeType === Node.TEXT_NODE ? startNode.parentNode : startNode;
      const offset = range.startOffset;

      if (!parentNode?.childNodes) {
        return [];
      }

      const adjacentNodes = [parentNode.childNodes[offset - 1], parentNode.childNodes[offset]].filter(Boolean);
      const adjacentToken = adjacentNodes
        .map((node) =>
          node instanceof Element
            ? node.closest?.(tokenSelector)
            : node?.parentElement?.closest?.(tokenSelector),
        )
        .find((tokenElement) => tokenElement && templateEditorSurface.contains(tokenElement));

      return adjacentToken ? [adjacentToken] : [];
    }

    function syncAfterTemplateTokenStyle(syncOptions = {}) {
      syncTemplateEditorContent?.({ preserveSelection: true, focusEditor: true, ...syncOptions });
      updateTemplateEditorActiveCell?.();
    }

    function tokenStyleValueIncludes(tokenElement, propertyName, expectedValue) {
      const inlineValue = String(tokenElement.style[propertyName] || "").toLowerCase();
      const computedValue = String(window.getComputedStyle(tokenElement)[propertyName] || "").toLowerCase();

      return inlineValue.includes(expectedValue) || computedValue.includes(expectedValue);
    }

    function isTemplateTokenAlignmentCommand(command) {
      return ["justifyLeft", "justifyCenter", "justifyRight", "justifyFull"].includes(command);
    }

    function getTemplateTokenAlignmentValue(command) {
      if (command === "justifyCenter") {
        return "center";
      }

      if (command === "justifyRight") {
        return "right";
      }

      if (command === "justifyFull") {
        return "justify";
      }

      return "left";
    }

    function getTemplateTokenAlignmentTargets(tokenTargets) {
      const templateEditorSurface = getTemplateEditorSurface();
      const blockSelector = "p, div, h1, h2, h3, h4, h5, h6, li, td, th, blockquote";
      const targetSet = new Set();

      getConnectedTemplateTokenTargets(tokenTargets).forEach((tokenElement) => {
        const blockElement = tokenElement.closest(blockSelector) || tokenElement.parentElement;

        if (blockElement instanceof HTMLElement && templateEditorSurface?.contains(blockElement)) {
          targetSet.add(blockElement);
        }
      });

      return Array.from(targetSet);
    }

    function isTemplateTokenOnlySelection() {
      const templateEditorSurface = getTemplateEditorSurface();
      const selection = window.getSelection();
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

      if (!templateEditorSurface || !range || !templateEditorSurface.contains(range.commonAncestorContainer)) {
        return true;
      }

      if (range.collapsed) {
        return true;
      }

      const fragment = range.cloneContents();

      fragment.querySelectorAll?.(".template-token[data-template-tag-value]").forEach((tokenElement) => tokenElement.remove());

      if (String(fragment.textContent || "").trim()) {
        return false;
      }

      return !fragment.querySelector?.("img, table, hr, .template-generated-object");
    }

    function getConnectedTemplateTokenTargets(tokenTargets) {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface || !Array.isArray(tokenTargets)) {
        return [];
      }

      return tokenTargets.filter(
        (tokenElement) => tokenElement instanceof HTMLElement && templateEditorSurface.contains(tokenElement),
      );
    }

    function getTemplateTokenCommandSelection() {
      const tokenTargets = getActiveTemplateTokenTargets();

      return {
        tokenTargets,
        shouldStopAfterTokenStyle: tokenTargets.length > 0 ? isTemplateTokenOnlySelection() : false,
      };
    }

    function snapshotTemplateTokenStyles(tokenTargets) {
      return getConnectedTemplateTokenTargets(tokenTargets).map((tokenElement) => ({
        tokenElement,
        styleAttribute: tokenElement.getAttribute("style") || "",
      }));
    }

    function restoreTemplateTokenStyles(tokenStyleSnapshot, syncOptions = {}) {
      const connectedSnapshot = Array.isArray(tokenStyleSnapshot)
        ? tokenStyleSnapshot.filter(({ tokenElement }) => getConnectedTemplateTokenTargets([tokenElement]).length > 0)
        : [];

      if (!connectedSnapshot.length) {
        return false;
      }

      connectedSnapshot.forEach(({ tokenElement, styleAttribute }) => {
        if (styleAttribute) {
          tokenElement.setAttribute("style", styleAttribute);
        } else {
          tokenElement.removeAttribute("style");
        }
      });
      syncAfterTemplateTokenStyle(syncOptions);
      return true;
    }

    function applyTemplateTokenCommand(command, value = "", options = {}) {
      const tokenTargets = getConnectedTemplateTokenTargets(
        Array.isArray(options.tokenTargets) ? options.tokenTargets : getActiveTemplateTokenTargets(),
      );

      if (!tokenTargets.length) {
        return false;
      }

      const shouldStopAfterTokenStyle =
        typeof options.shouldStopAfterTokenStyle === "boolean"
          ? options.shouldStopAfterTokenStyle
          : isTemplateTokenOnlySelection();
      const shouldSyncAfterStyle = options.sync !== false;

      if (isTemplateTokenAlignmentCommand(command)) {
        const textAlignValue = getTemplateTokenAlignmentValue(command);
        const targetBlocks = getTemplateTokenAlignmentTargets(tokenTargets);

        if (!targetBlocks.length) {
          return false;
        }

        targetBlocks.forEach((blockElement) => {
          blockElement.style.textAlign = textAlignValue;
        });

        if (shouldSyncAfterStyle) {
          syncAfterTemplateTokenStyle();
        }

        return true;
      }

      if (command === "bold") {
        const shouldApplyBold = tokenTargets.some((tokenElement) => {
          const computedWeight = window.getComputedStyle(tokenElement).fontWeight;
          return computedWeight !== "bold" && Number(computedWeight) < 600;
        });

        tokenTargets.forEach((tokenElement) => {
          if (shouldApplyBold) {
            tokenElement.style.fontWeight = "700";
          } else {
            tokenElement.style.removeProperty("font-weight");
          }
        });
        if (shouldSyncAfterStyle) {
          syncAfterTemplateTokenStyle();
        }
        return options.returnHandled ? true : shouldStopAfterTokenStyle;
      }

      if (command === "italic") {
        const shouldApplyItalic = tokenTargets.some((tokenElement) => !tokenStyleValueIncludes(tokenElement, "fontStyle", "italic"));

        tokenTargets.forEach((tokenElement) => {
          if (shouldApplyItalic) {
            tokenElement.style.fontStyle = "italic";
          } else {
            tokenElement.style.removeProperty("font-style");
          }
        });
        if (shouldSyncAfterStyle) {
          syncAfterTemplateTokenStyle();
        }
        return options.returnHandled ? true : shouldStopAfterTokenStyle;
      }

      if (command === "underline") {
        const shouldApplyUnderline = tokenTargets.some(
          (tokenElement) =>
            !String(tokenElement.style.textDecorationLine || tokenElement.style.textDecoration || "").toLowerCase().includes("underline"),
        );

        tokenTargets.forEach((tokenElement) => {
          if (shouldApplyUnderline) {
            tokenElement.style.textDecoration = "underline";
            tokenElement.style.textDecorationLine = "underline";
          } else {
            tokenElement.style.removeProperty("text-decoration");
            tokenElement.style.removeProperty("text-decoration-line");
          }
        });
        if (shouldSyncAfterStyle) {
          syncAfterTemplateTokenStyle();
        }
        return options.returnHandled ? true : shouldStopAfterTokenStyle;
      }

      if (command === "foreColor") {
        const color = String(value || "").trim();

        if (!color) {
          return false;
        }

        tokenTargets.forEach((tokenElement) => {
          tokenElement.style.color = color;
        });
        if (shouldSyncAfterStyle) {
          syncAfterTemplateTokenStyle();
        }
        return options.returnHandled ? true : shouldStopAfterTokenStyle;
      }

      if (command === "hiliteColor") {
        const backgroundColor = String(value || "").trim();

        if (!backgroundColor) {
          return false;
        }

        tokenTargets.forEach((tokenElement) => {
          tokenElement.style.backgroundColor = backgroundColor;
        });
        if (shouldSyncAfterStyle) {
          syncAfterTemplateTokenStyle();
        }
        return options.returnHandled ? true : shouldStopAfterTokenStyle;
      }

      if (command === "fontSizePx") {
        const fontSize = Math.round(Number(value));

        if (!Number.isFinite(fontSize) || fontSize < 1 || fontSize > 72) {
          setTemplateEditorStatus?.("글자 크기는 1pt 이상 72pt 이하로 입력하세요.", "warning");
          return true;
        }

        tokenTargets.forEach((tokenElement) => {
          tokenElement.style.fontSize = `${fontSize}pt`;
        });
        if (shouldSyncAfterStyle) {
          syncAfterTemplateTokenStyle({ allowOverflow: true });
        }
        return options.returnHandled ? true : shouldStopAfterTokenStyle;
      }

      if (command === "fontName") {
        const fontFamily = String(value || TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY || "").trim();

        if (!fontFamily) {
          return false;
        }

        tokenTargets.forEach((tokenElement) => {
          tokenElement.style.fontFamily = fontFamily;
        });
        if (shouldSyncAfterStyle) {
          syncAfterTemplateTokenStyle();
        }
        return options.returnHandled ? true : shouldStopAfterTokenStyle;
      }

      return false;
    }

    function prepareMixedTemplateTokenStyle(command, value, tokenSelection) {
      if (!tokenSelection.tokenTargets.length || tokenSelection.shouldStopAfterTokenStyle) {
        return [];
      }

      const wasHandled = applyTemplateTokenCommand(command, value, {
        tokenTargets: tokenSelection.tokenTargets,
        shouldStopAfterTokenStyle: false,
        sync: false,
        returnHandled: true,
      });

      if (wasHandled) {
        saveTemplateEditorSelection?.();
      }

      return wasHandled ? snapshotTemplateTokenStyles(tokenSelection.tokenTargets) : [];
    }

    return Object.freeze({
      applyTemplateTokenCommand,
      getTemplateTokenCommandSelection,
      isTemplateTokenAlignmentCommand,
      prepareMixedTemplateTokenStyle,
      restoreTemplateTokenStyles,
    });
  }

  return Object.freeze({
    createTemplateEditorTokenStyleController,
  });
});

})();
