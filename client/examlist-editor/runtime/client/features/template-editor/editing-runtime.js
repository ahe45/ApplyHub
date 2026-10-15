(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./editing-token-style"));
    return;
  }

  globalScope.ExamListTemplateEditorEditingRuntime = factory(globalScope.ExamListTemplateEditorEditingTokenStyle);
})(typeof globalThis !== "undefined" ? globalThis : this, (editingTokenStyleModule) => {
  if (!editingTokenStyleModule?.createTemplateEditorTokenStyleController) {
    throw new Error("client/features/template-editor/editing-token-style.js must be loaded before editing-runtime.js.");
  }

  const { createTemplateEditorTokenStyleController } = editingTokenStyleModule;

  function createTemplateEditorRuntimeController({
    EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR,
    TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
    TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
    applySharedEditorCommand,
    applySharedEditorFontFamily,
    applySharedEditorFontSize,
    applyTemplateEditorTableSelectionCommand,
    applyTemplateEditorTableSelectionFontFamily,
    applyTemplateEditorTableSelectionFontSize,
    getTemplateEditorBlockTypeElement,
    getTemplateEditorFontFamilyElement,
    getTemplateEditorFontSizeElement,
    getTemplateEditorSurface,
    getTemplateEditorTextColorElement,
    getTemplateEditorTextShadingElement,
    redoTemplateEditorHistory,
    restoreTemplateEditorSelection,
    saveTemplateEditorSelection,
    setTemplateEditorStatus,
    syncTemplateEditorContent,
    state,
    undoTemplateEditorHistory,
    updateTemplateEditorActiveCell,
  }) {
    const {
      applyTemplateTokenCommand,
      getTemplateTokenCommandSelection,
      isTemplateTokenAlignmentCommand,
      prepareMixedTemplateTokenStyle,
      restoreTemplateTokenStyles,
    } = createTemplateEditorTokenStyleController({
      TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
      getTemplateEditorSurface,
      restoreTemplateEditorSelection,
      saveTemplateEditorSelection,
      setTemplateEditorStatus,
      syncTemplateEditorContent,
      updateTemplateEditorActiveCell,
    });

    function getWholeInlineSelectionTarget(templateEditorSurface) {
      const selection = window.getSelection?.();
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

      if (!templateEditorSurface || !range || range.collapsed) {
        return null;
      }

      const targetElement =
        range.commonAncestorContainer instanceof HTMLElement
          ? range.commonAncestorContainer
          : range.commonAncestorContainer?.parentElement || null;

      if (
        !targetElement ||
        targetElement === templateEditorSurface ||
        !templateEditorSurface.contains(targetElement) ||
        /^(P|DIV|LI|UL|OL|H1|H2|H3|H4|H5|H6|BLOCKQUOTE|TD|TH|TR|TBODY|THEAD|TFOOT|TABLE)$/i.test(targetElement.tagName || "")
      ) {
        return null;
      }

      return range.startContainer === targetElement &&
        range.startOffset === 0 &&
        range.endContainer === targetElement &&
        range.endOffset === targetElement.childNodes.length
        ? targetElement
        : null;
    }

    function applyWholeInlineColorCommand(command, value, templateEditorSurface) {
      if (command !== "foreColor" && command !== "hiliteColor") {
        return false;
      }

      const targetElement = getWholeInlineSelectionTarget(templateEditorSurface);

      if (!targetElement) {
        return false;
      }

      if (command === "foreColor") {
        targetElement.style.color = value;
      } else {
        targetElement.style.backgroundColor = value;
      }

      syncTemplateEditorContent?.({ preserveSelection: true, focusEditor: true });
      updateTemplateEditorActiveCell?.();
      return true;
    }

    function isTemplateTokenElement(element) {
      return element instanceof HTMLElement && element.matches(".template-token[data-template-tag-value]");
    }

    function isInsideTemplateToken(node) {
      const element = node instanceof Element ? node : node?.parentElement || null;

      return Boolean(element?.closest?.(".template-token[data-template-tag-value]"));
    }

    function getActiveTemplateEditorRange(templateEditorSurface) {
      let selection = window.getSelection?.();
      let range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

      if (!range || !templateEditorSurface.contains(range.commonAncestorContainer)) {
        restoreTemplateEditorSelection?.();
        selection = window.getSelection?.();
        range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      }

      if (!range || range.collapsed || !templateEditorSurface.contains(range.commonAncestorContainer)) {
        return null;
      }

      return range;
    }

    function isBlockTextStyleElement(element, templateEditorSurface) {
      if (!(element instanceof HTMLElement) || element === templateEditorSurface) {
        return true;
      }

      if (element.classList.contains("template-doc")) {
        return true;
      }

      return /^(P|DIV|LI|UL|OL|H1|H2|H3|H4|H5|H6|BLOCKQUOTE|TD|TH|TR|TBODY|THEAD|TFOOT|TABLE)$/i.test(
        element.tagName || "",
      );
    }

    function getTemplateEditorElementFromNode(node) {
      if (!node) {
        return null;
      }

      return node instanceof Element ? node : node.parentElement || null;
    }

    function getTemplateEditorLineSpacingFromCalcValue(value = "") {
      const normalizedValue = String(value || "").trim();
      const calcMatch = normalizedValue.match(/^calc\(\s*1em\s*\+\s*(-?\d+(?:\.\d+)?)pt\s*\)$/i);

      return calcMatch ? Number.parseFloat(calcMatch[1]) : Number.NaN;
    }

    function formatTemplateEditorLineSpacingPointValue(value) {
      const numericValue = Number(value);
      const safeValue = Number.isFinite(numericValue) ? Math.max(0, numericValue) : 1;
      const roundedValue = Math.round(safeValue * 10) / 10;

      return Number.isInteger(roundedValue) ? String(roundedValue) : roundedValue.toFixed(1);
    }

    function getTemplateEditorPreservedLineHeightValue(element) {
      const inlineLineHeight = String(element?.style?.lineHeight || "").trim();
      const inlineSpacing = getTemplateEditorLineSpacingFromCalcValue(inlineLineHeight);

      if (Number.isFinite(inlineSpacing)) {
        const spacingValue = formatTemplateEditorLineSpacingPointValue(inlineSpacing);

        return Number(spacingValue) <= 0 ? "1" : `calc(1em + ${spacingValue}pt)`;
      }

      // Preserve scalable line heights, but convert fixed lengths using the
      // pre-format font size so enlarging text retains the authored spacing.
      if (inlineLineHeight && !/^[\d.]+(?:px|pt)$/i.test(inlineLineHeight) && inlineLineHeight !== "inherit") {
        return inlineLineHeight;
      }

      const computedStyle = element ? window.getComputedStyle(element) : null;
      const computedLineHeight = String(computedStyle?.lineHeight || "").trim();
      const computedFontSize = Number.parseFloat(computedStyle?.fontSize || "");
      const computedSpacing = getTemplateEditorLineSpacingFromCalcValue(computedLineHeight);

      if (Number.isFinite(computedSpacing)) {
        const spacingValue = formatTemplateEditorLineSpacingPointValue(computedSpacing);

        return Number(spacingValue) <= 0 ? "1" : `calc(1em + ${spacingValue}pt)`;
      }

      if (computedLineHeight.endsWith("px") && Number.isFinite(computedFontSize) && computedFontSize > 0) {
        const spacingValue = formatTemplateEditorLineSpacingPointValue((Number.parseFloat(computedLineHeight) - computedFontSize) * 0.75);

        return Number(spacingValue) <= 0 ? "1" : `calc(1em + ${spacingValue}pt)`;
      }

      const numericLineHeight = Number.parseFloat(computedLineHeight);

      if (
        Number.isFinite(numericLineHeight) &&
        /^-?\d+(?:\.\d+)?$/.test(computedLineHeight) &&
        Number.isFinite(computedFontSize) &&
        computedFontSize > 0
      ) {
        const spacingValue = formatTemplateEditorLineSpacingPointValue((numericLineHeight - 1) * computedFontSize * 0.75);

        return Number(spacingValue) <= 0 ? "1" : `calc(1em + ${spacingValue}pt)`;
      }

      return "calc(1em + 1pt)";
    }

    function getTemplateEditorLineHeightTargets(templateEditorSurface) {
      const selectedCells = Array.from(templateEditorSurface?.querySelectorAll?.("td.is-selected-cell, th.is-selected-cell") || []);

      if (selectedCells.length) {
        return selectedCells;
      }

      const selection = window.getSelection?.();
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const blockSelector = "p,h1,h2,h3,h4,h5,h6,li,blockquote,td,th,div";

      if (!templateEditorSurface || !range || !templateEditorSurface.contains(range.commonAncestorContainer)) {
        return [];
      }

      if (range.collapsed) {
        const blockElement = getTemplateEditorElementFromNode(range.startContainer)?.closest?.(blockSelector) || null;

        return blockElement &&
          blockElement !== templateEditorSurface &&
          !blockElement.classList.contains("template-doc") &&
          templateEditorSurface.contains(blockElement)
          ? [blockElement]
          : [];
      }

      const targets = Array.from(templateEditorSurface.querySelectorAll(blockSelector))
        .filter((element) => element !== templateEditorSurface && !element.classList.contains("template-doc"))
        .filter((element) => {
          try {
            return range.intersectsNode(element);
          } catch (_error) {
            return false;
          }
        });

      if (targets.length) {
        return Array.from(new Set(targets));
      }

      const blockElement = getTemplateEditorElementFromNode(range.commonAncestorContainer)?.closest?.(blockSelector) || null;

      return blockElement &&
        blockElement !== templateEditorSurface &&
        !blockElement.classList.contains("template-doc") &&
        templateEditorSurface.contains(blockElement)
        ? [blockElement]
        : [];
    }

    function createTemplateEditorLineHeightSnapshot(templateEditorSurface) {
      const blockSelector = "p,h1,h2,h3,h4,h5,h6,li,blockquote,td,th,div";
      const blocks = Array.from(templateEditorSurface.querySelectorAll(blockSelector));
      return getTemplateEditorLineHeightTargets(templateEditorSurface).map((element) => ({
        element,
        surface: templateEditorSurface,
        blockIndex: blocks.indexOf(element),
        lineHeight: getTemplateEditorPreservedLineHeightValue(element),
      }));
    }

    function restoreTemplateEditorLineHeightSnapshot(lineHeightSnapshot) {
      const blockSelector = "p,h1,h2,h3,h4,h5,h6,li,blockquote,td,th,div";
      const connectedSnapshot = Array.isArray(lineHeightSnapshot)
        ? lineHeightSnapshot.map((entry) => ({
          ...entry,
          // Font normalization may replace the content DOM. Formatting does
          // not reorder blocks, so recover their live counterparts before sync.
          element: entry.element.isConnected
            ? entry.element
            : entry.surface.querySelectorAll(blockSelector)[entry.blockIndex],
        }))
          .filter(({ element }) => element instanceof HTMLElement && element.isConnected)
        : [];

      if (!connectedSnapshot.length) {
        return false;
      }

      connectedSnapshot.forEach(({ element, lineHeight }) => {
        element.style.lineHeight = lineHeight;
        // CSS computes an inherited calc(1em + spacing) on the parent. An
        // enlarged inline span must evaluate it against its own font size.
        element.querySelectorAll("[style]").forEach((inlineElement) => {
          if (!inlineElement.style.fontSize || inlineElement.matches(blockSelector) ||
              inlineElement.parentElement?.closest(blockSelector) !== element) return;
          const ownLineHeight = inlineElement.style.lineHeight;
          if (!ownLineHeight || ownLineHeight === "inherit" || /^[\d.]+(?:px|pt)$/i.test(ownLineHeight)) {
            inlineElement.style.lineHeight = lineHeight;
          }
        });
      });
      return true;
    }

    function syncTemplateEditorLineHeightSnapshot(lineHeightSnapshot, syncOptions = {}) {
      if (!restoreTemplateEditorLineHeightSnapshot(lineHeightSnapshot)) {
        return false;
      }

      syncTemplateEditorContent?.({ preserveSelection: true, focusEditor: true, ...syncOptions });
      updateTemplateEditorActiveCell?.();
      return true;
    }

    function isRangeFullySelectingNode(range, node) {
      const ownerDocument = node?.ownerDocument || document;
      const ownerWindow = ownerDocument.defaultView || window;
      const nodeRange = ownerDocument.createRange();

      try {
        nodeRange.selectNode(node);
        return (
          range.compareBoundaryPoints(ownerWindow.Range.START_TO_START, nodeRange) <= 0 &&
          range.compareBoundaryPoints(ownerWindow.Range.END_TO_END, nodeRange) >= 0
        );
      } catch (_error) {
        return false;
      } finally {
        nodeRange.detach?.();
      }
    }

    function getInlineFontSizeTargetForTextNode(textNode, range, templateEditorSurface) {
      const parentElement = textNode.parentElement;

      if (
        !parentElement ||
        isInsideTemplateToken(parentElement) ||
        isBlockTextStyleElement(parentElement, templateEditorSurface)
      ) {
        return null;
      }

      return isRangeFullySelectingNode(range, parentElement) ? parentElement : null;
    }

    function collectMixedFontSizeTextTargets(range, templateEditorSurface) {
      const ownerDocument = templateEditorSurface.ownerDocument || document;
      const ownerWindow = ownerDocument.defaultView || window;
      const nodeFilter = ownerWindow.NodeFilter || NodeFilter;
      const elementTargets = [];
      const textTargets = [];
      const styledElementSet = new Set();
      const textWalker = ownerDocument.createTreeWalker(
        templateEditorSurface,
        nodeFilter.SHOW_TEXT,
        {
          acceptNode(textNode) {
            if (!String(textNode.textContent || "")) {
              return nodeFilter.FILTER_REJECT;
            }

            if (isInsideTemplateToken(textNode)) {
              return nodeFilter.FILTER_REJECT;
            }

            try {
              return range.intersectsNode(textNode) ? nodeFilter.FILTER_ACCEPT : nodeFilter.FILTER_REJECT;
            } catch (_error) {
              return nodeFilter.FILTER_REJECT;
            }
          },
        },
      );

      while (textWalker.nextNode()) {
        const textNode = textWalker.currentNode;
        const textLength = textNode.textContent.length;
        const startOffset = textNode === range.startContainer ? Math.max(0, Math.min(range.startOffset, textLength)) : 0;
        const endOffset = textNode === range.endContainer ? Math.max(0, Math.min(range.endOffset, textLength)) : textLength;

        if (startOffset >= endOffset) {
          continue;
        }

        const elementTarget = getInlineFontSizeTargetForTextNode(textNode, range, templateEditorSurface);

        if (elementTarget) {
          if (!styledElementSet.has(elementTarget)) {
            styledElementSet.add(elementTarget);
            elementTargets.push(elementTarget);
          }
          continue;
        }

        textTargets.push({ endOffset, startOffset, textNode });
      }

      return { elementTargets, textTargets };
    }

    function wrapTextNodeRangeWithFontSize({ textNode, startOffset, endOffset }, fontSize) {
      if (!textNode?.parentNode || startOffset >= endOffset) {
        return false;
      }

      const ownerDocument = textNode.ownerDocument || document;
      let targetTextNode = textNode;

      if (endOffset < targetTextNode.textContent.length) {
        targetTextNode.splitText(endOffset);
      }

      if (startOffset > 0) {
        targetTextNode = targetTextNode.splitText(startOffset);
      }

      if (!targetTextNode.textContent) {
        return false;
      }

      const fontSizeElement = ownerDocument.createElement("span");

      fontSizeElement.style.fontSize = `${fontSize}pt`;
      targetTextNode.parentNode.insertBefore(fontSizeElement, targetTextNode);
      fontSizeElement.appendChild(targetTextNode);
      return true;
    }

    function applyMixedTemplateTokenTextFontSize(fontSize, tokenSelection, templateEditorSurface) {
      if (!tokenSelection.tokenTargets.length || tokenSelection.shouldStopAfterTokenStyle) {
        return false;
      }

      const range = getActiveTemplateEditorRange(templateEditorSurface);

      if (!range) {
        return false;
      }

      const { elementTargets, textTargets } = collectMixedFontSizeTextTargets(range, templateEditorSurface);

      if (!elementTargets.length && !textTargets.length) {
        return false;
      }

      const didStyleTokens = applyTemplateTokenCommand("fontSizePx", fontSize, {
        tokenTargets: tokenSelection.tokenTargets.filter(isTemplateTokenElement),
        shouldStopAfterTokenStyle: false,
        sync: false,
        returnHandled: true,
      });

      elementTargets.forEach((element) => {
        element.style.fontSize = `${fontSize}pt`;
      });

      let didStyleText = false;

      textTargets
        .slice()
        .reverse()
        .forEach((textTarget) => {
          didStyleText = wrapTextNodeRangeWithFontSize(textTarget, fontSize) || didStyleText;
        });

      if (!didStyleTokens && !didStyleText && !elementTargets.length) {
        return false;
      }

      syncTemplateEditorContent?.({ preserveSelection: true, focusEditor: true, allowOverflow: true });
      updateTemplateEditorActiveCell?.();
      return true;
    }

    function applyTemplateEditorCommand(command, value = "") {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface) {
        return;
      }

      const normalizedValue =
        command === "hiliteColor" && !String(value || "").trim()
          ? getTemplateEditorTextShadingElement()?.value || "#fff59d"
          : command === "foreColor" && !String(value || "").trim()
            ? getTemplateEditorTextColorElement()?.value || EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR
            : value;

      if (command === "fontName") {
        applyTemplateEditorFontFamily(normalizedValue);
        return;
      }

      if (command === "fontSizePx") {
        applyTemplateEditorFontSize(normalizedValue);
        return;
      }

      const tokenSelection = getTemplateTokenCommandSelection();

      if (applyTemplateEditorTableSelectionCommand(command, normalizedValue)) {
        return;
      }

      const alignment = { justifyLeft: "left", justifyCenter: "center", justifyRight: "right", justifyFull: "justify" }[command];
      if (alignment) {
        restoreTemplateEditorSelection();
        const content = templateEditorSurface.querySelector(":scope > .template-doc") || templateEditorSurface;
        if (globalThis.ExamListTemplateEditorTextEditing?.alignTemplateTextLines(content, alignment)) {
          saveTemplateEditorSelection();
          syncTemplateEditorContent({ preserveSelection: true, focusEditor: true });
          return;
        }
      }

      if (
        tokenSelection.tokenTargets.length &&
        isTemplateTokenAlignmentCommand(command) &&
        applyTemplateTokenCommand(command, normalizedValue, {
          tokenTargets: tokenSelection.tokenTargets,
          shouldStopAfterTokenStyle: true,
        })
      ) {
        return;
      }

      if (applyWholeInlineColorCommand(command, normalizedValue, templateEditorSurface)) {
        return;
      }

      const mixedTokenStyleSnapshot = prepareMixedTemplateTokenStyle(command, normalizedValue, tokenSelection);

      if (
        tokenSelection.tokenTargets.length &&
        tokenSelection.shouldStopAfterTokenStyle &&
        applyTemplateTokenCommand(command, normalizedValue, {
          tokenTargets: tokenSelection.tokenTargets,
          shouldStopAfterTokenStyle: true,
        })
      ) {
        return;
      }

      applySharedEditorCommand({
        rootElement: templateEditorSurface,
        focusElement: templateEditorSurface,
        restoreSelection: restoreTemplateEditorSelection,
        syncContent: syncTemplateEditorContent,
        onUndo: undoTemplateEditorHistory,
        onRedo: redoTemplateEditorHistory,
        applyTableSelectionCommand: applyTemplateEditorTableSelectionCommand,
        command,
        value: normalizedValue,
        fontFamilyElement: getTemplateEditorFontFamilyElement(),
        defaultFontFamily: TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
        fontSizeElement: getTemplateEditorFontSizeElement(),
        defaultFontSize: TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
        setStatus: setTemplateEditorStatus,
        syncOptions: { preserveSelection: true, focusEditor: true },
        onFormatBlockApplied: (nextValue) => {
          const blockTypeElement = getTemplateEditorBlockTypeElement();

          if (blockTypeElement && nextValue) {
            blockTypeElement.value = nextValue;
          }
        },
      });

      restoreTemplateTokenStyles(mixedTokenStyleSnapshot);
    }

    function applyTemplateEditorFontFamily(rawFontFamily) {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface) {
        return;
      }

      const fontFamily = String(rawFontFamily || "").trim() || TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY;

      if (applyTemplateEditorTableSelectionFontFamily(fontFamily)) {
        syncTemplateEditorFontFamilyControlValue(fontFamily);
        return;
      }

      const tokenSelection = getTemplateTokenCommandSelection();
      const mixedTokenStyleSnapshot = prepareMixedTemplateTokenStyle("fontName", fontFamily, tokenSelection);

      if (
        tokenSelection.tokenTargets.length &&
        tokenSelection.shouldStopAfterTokenStyle &&
        applyTemplateTokenCommand("fontName", fontFamily, {
          tokenTargets: tokenSelection.tokenTargets,
          shouldStopAfterTokenStyle: true,
        })
      ) {
        syncTemplateEditorFontFamilyControlValue(fontFamily);
        return;
      }

      applySharedEditorFontFamily({
        rootElement: templateEditorSurface,
        focusElement: templateEditorSurface,
        restoreSelection: restoreTemplateEditorSelection,
        syncContent: syncTemplateEditorContent,
        applyTableSelectionFontFamily: applyTemplateEditorTableSelectionFontFamily,
        rawFontFamily: fontFamily,
        fontFamilyElement: getTemplateEditorFontFamilyElement(),
        defaultFontFamily: TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
        syncOptions: { preserveSelection: true, focusEditor: true },
      });

      restoreTemplateTokenStyles(mixedTokenStyleSnapshot);
    }

    function syncTemplateEditorFontFamilyControlValue(fontFamily) {
      const fontFamilyElement = getTemplateEditorFontFamilyElement();
      const normalizedFontFamily = String(fontFamily || "").trim() || TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY;

      if (!fontFamilyElement) {
        return;
      }

      const comboElement = fontFamilyElement.closest?.(".template-toolbar-font-family-combo") || null;
      const valueElement = comboElement?.querySelector?.("[data-editor-font-family-current]") || null;
      let activeLabel = "";

      fontFamilyElement.value = normalizedFontFamily;

      Array.from(comboElement?.querySelectorAll?.("[data-editor-font-family-option]") || []).forEach((optionElement) => {
        const isActive = optionElement.dataset.editorFontFamilyOption === normalizedFontFamily;

        if (isActive) {
          activeLabel = optionElement.dataset.editorFontFamilyLabel || optionElement.textContent.trim();
        }

        optionElement.classList.toggle("active", isActive);
        optionElement.setAttribute("aria-selected", isActive ? "true" : "false");
      });

      if (valueElement) {
        valueElement.textContent = activeLabel || normalizedFontFamily;
      }
    }

    function syncTemplateEditorFontSizeControlValue(fontSize) {
      const fontSizeElement = getTemplateEditorFontSizeElement();
      const normalizedFontSize = String(fontSize);

      if (!fontSizeElement) {
        return;
      }

      const comboElement = fontSizeElement.closest?.(".template-toolbar-font-size-combo") || null;
      const valueElement = comboElement?.querySelector?.("[data-editor-font-size-current]") || null;

      fontSizeElement.value = normalizedFontSize;
      fontSizeElement.dataset.templateEditorCurrentFontSize = `${normalizedFontSize}pt`;

      if (valueElement) {
        valueElement.textContent = normalizedFontSize;
      }

      Array.from(comboElement?.querySelectorAll?.("[data-editor-font-size-option]") || []).forEach((optionElement) => {
        const isActive = optionElement.dataset.editorFontSizeOption === normalizedFontSize;

        optionElement.classList.toggle("active", isActive);
        optionElement.setAttribute("aria-selected", isActive ? "true" : "false");
      });
    }

    function applyTemplateEditorFontSize(rawFontSize) {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface) {
        return;
      }

      const normalizedFontSize = Math.round(Number(rawFontSize));

      const isFontSizeInRange =
        Number.isFinite(normalizedFontSize) && normalizedFontSize >= 1 && normalizedFontSize <= 72;
      const lineHeightSnapshot = isFontSizeInRange
        ? createTemplateEditorLineHeightSnapshot(templateEditorSurface)
        : [];

      if (isFontSizeInRange && applyTemplateEditorTableSelectionFontSize(normalizedFontSize)) {
        syncTemplateEditorFontSizeControlValue(normalizedFontSize);
        syncTemplateEditorLineHeightSnapshot(lineHeightSnapshot, { allowOverflow: true });
        return;
      }

      const tokenSelection = getTemplateTokenCommandSelection();

      if (
        isFontSizeInRange &&
        tokenSelection.tokenTargets.length &&
        !tokenSelection.shouldStopAfterTokenStyle &&
        applyMixedTemplateTokenTextFontSize(normalizedFontSize, tokenSelection, templateEditorSurface)
      ) {
        syncTemplateEditorFontSizeControlValue(normalizedFontSize);
        syncTemplateEditorLineHeightSnapshot(lineHeightSnapshot, { allowOverflow: true });
        return;
      }

      const mixedTokenStyleSnapshot = prepareMixedTemplateTokenStyle("fontSizePx", rawFontSize, tokenSelection);

      if (
        tokenSelection.tokenTargets.length &&
        tokenSelection.shouldStopAfterTokenStyle &&
        applyTemplateTokenCommand("fontSizePx", rawFontSize, {
          tokenTargets: tokenSelection.tokenTargets,
          shouldStopAfterTokenStyle: true,
        })
      ) {
        if (Number.isFinite(normalizedFontSize)) {
          syncTemplateEditorFontSizeControlValue(normalizedFontSize);
        }
        syncTemplateEditorLineHeightSnapshot(lineHeightSnapshot, { allowOverflow: true });
        return;
      }

      if (Number.isFinite(normalizedFontSize)) {
        restoreTemplateEditorSelection();
      }

      const allowFontSizeOverflow = isFontSizeInRange;
      const fontSizeElement = getTemplateEditorFontSizeElement();

      if (allowFontSizeOverflow) {
        templateEditorSurface.dataset.templateEditorAllowOverflowSync = "true";
      }

      applySharedEditorFontSize({
        rootElement: templateEditorSurface,
        focusElement: templateEditorSurface,
        restoreSelection: restoreTemplateEditorSelection,
        syncContent: syncTemplateEditorContent,
        applyTableSelectionFontSize: applyTemplateEditorTableSelectionFontSize,
        rawFontSize,
        fontSizeElement,
        defaultFontSize: TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
        setStatus: setTemplateEditorStatus,
        syncOptions: { preserveSelection: true, focusEditor: true, allowOverflow: allowFontSizeOverflow },
      });

      if (fontSizeElement && Number.isFinite(normalizedFontSize)) {
        syncTemplateEditorFontSizeControlValue(normalizedFontSize);
      }

      if (allowFontSizeOverflow) {
        const ownerWindow = templateEditorSurface.ownerDocument?.defaultView || window;

        ownerWindow.setTimeout(() => {
          if (templateEditorSurface.dataset.templateEditorAllowOverflowSync === "true") {
            delete templateEditorSurface.dataset.templateEditorAllowOverflowSync;
          }
        }, 0);
      }

      restoreTemplateTokenStyles(mixedTokenStyleSnapshot, { allowOverflow: allowFontSizeOverflow });
      syncTemplateEditorLineHeightSnapshot(lineHeightSnapshot, { allowOverflow: allowFontSizeOverflow });
    }

    function getTemplateEditorDocumentElement() {
      return getTemplateEditorSurface()?.querySelector(".template-doc") || null;
    }

    function getTemplateEditorImageOverlayContainer() {
      const surfaceElement = getTemplateEditorSurface();

      if (surfaceElement?.matches?.("[data-candidate-block-modal-editor-surface]")) {
        return surfaceElement.closest("[data-candidate-block-focus-layer]") ||
          surfaceElement.closest(".examlist-candidate-block-modal-editor-viewport") ||
          surfaceElement.parentElement ||
          surfaceElement;
      }

      return surfaceElement || null;
    }

    function placeCaretAtEnd(element) {
      if (!element) {
        return;
      }

      const range = document.createRange();
      const selection = window.getSelection();

      range.selectNodeContents(element);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      saveTemplateEditorSelection();
      updateTemplateEditorActiveCell();
    }

    function withFormattingHistory(operation) {
      const historyState = state?.templateEditor;
      if (!historyState || historyState.isRestoringHistory) return operation();
      if (historyState.isComposing) return;
      restoreTemplateEditorSelection();
      const surface = getTemplateEditorSurface();
      const textEditing = globalThis.ExamListTemplateEditorTextEditing;
      const selection = surface && textEditing?.captureTemplateTextSelection(surface);
      // Native text formatting and protected-token formatting synchronize in
      // several stages. They are one user action, hence one undo snapshot.
      historyState.isRestoringHistory = true;
      try {
        return operation();
      } finally {
        historyState.isRestoringHistory = false;
        syncTemplateEditorContent({ preserveSelection: true, focusEditor: true });
        // Preserve selected text across DOM normalization for successive toolbar
        // commands. A collapsed caret must retain native pending typing styles.
        if (selection && selection.start !== selection.end &&
            surface === getTemplateEditorSurface() && textEditing.restoreTemplateTextSelection(surface, selection)) {
          saveTemplateEditorSelection();
        }
      }
    }

    return Object.freeze({
      applyTemplateEditorCommand: (command, value) => command === "undo" || command === "redo"
        ? applyTemplateEditorCommand(command, value)
        : withFormattingHistory(() => applyTemplateEditorCommand(command, value)),
      applyTemplateEditorFontFamily: (...args) => withFormattingHistory(() => applyTemplateEditorFontFamily(...args)),
      applyTemplateEditorFontSize: (...args) => withFormattingHistory(() => applyTemplateEditorFontSize(...args)),
      getTemplateEditorDocumentElement,
      getTemplateEditorImageOverlayContainer,
      placeCaretAtEnd,
    });
  }

  return Object.freeze({
    createTemplateEditorRuntimeController,
  });
});

})();
