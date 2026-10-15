(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalScope);
    return;
  }

  globalScope.ExamListTemplateEditorCommandInsertion = factory(globalScope);
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  const rangeHelpers = globalScope.ExamListTemplateEditorCommandInsertionRange;
  const objectFitHelpers = globalScope.ExamListTemplateEditorCommandInsertionObjectFit;

  if (!rangeHelpers || !objectFitHelpers) {
    throw new Error("template editor command insertion helper modules must be loaded before commands-insertion.js.");
  }

  const {
    getCurrentTemplateEditorRange,
    getTemplateEditorInsertionRange,
    getTemplateEditorInsertionRoot,
    isRangeInsideElement,
  } = rangeHelpers;
  const {
    fitTemplateEditorImagesToInsertionCell,
    fitTemplateEditorImagesToCandidateBlock,
    fitTemplateEditorTablesToCandidateBlock,
    getTemplateEditorBlankInsertionBlock,
    getTemplateEditorInsertionCandidateBlock,
    getTemplateEditorInsertionCell,
  } = objectFitHelpers;

  const TEMPLATE_EDITOR_INSERTED_TOKEN_SELECTOR = [
    ".template-token[data-template-tag-value]",
    "[data-template-token='true']",
  ].join(",");
  const TEMPLATE_EDITOR_INSERTION_STYLE_SOURCE_SELECTOR = [
    ".template-token[data-template-tag-value]",
    "[data-template-token='true']",
    "span",
    "font",
    "b",
    "strong",
    "em",
    "i",
    "u",
    "s",
    "small",
    "mark",
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "li",
    "blockquote",
    "div",
    "td",
    "th",
  ].join(",");

  function getTemplateEditorElementFromNode(node) {
    if (!node) {
      return null;
    }

    return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement || null;
  }

  function getTemplateEditorInsertionStyleSource(range, insertionCell, templateEditorSurface) {
    const startElement = getTemplateEditorElementFromNode(range?.startContainer);
    const sourceElement =
      startElement?.closest?.(TEMPLATE_EDITOR_INSERTION_STYLE_SOURCE_SELECTOR) ||
      insertionCell ||
      null;

    if (
      sourceElement instanceof HTMLElement &&
      sourceElement !== templateEditorSurface &&
      templateEditorSurface?.contains?.(sourceElement)
    ) {
      return sourceElement;
    }

    return insertionCell instanceof HTMLElement && templateEditorSurface?.contains?.(insertionCell)
      ? insertionCell
      : null;
  }

  function getTemplateEditorInsertionStyleValue(sourceElement, propertyName) {
    const inlineValue = String(sourceElement?.style?.[propertyName] || "").trim();

    if (inlineValue) {
      return inlineValue;
    }

    return String(window.getComputedStyle(sourceElement)?.[propertyName] || "").trim();
  }

  function setTemplateEditorInsertedTokenStyle(tokenElement, propertyName, value) {
    const normalizedValue = String(value || "").trim();

    if (!normalizedValue) {
      tokenElement.style.removeProperty(propertyName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`));
      return;
    }

    tokenElement.style[propertyName] = normalizedValue;
  }

  function applyTemplateEditorInsertedTokenContextStyle(fragment, range, insertionCell, templateEditorSurface) {
    if (!fragment?.querySelectorAll || !templateEditorSurface) {
      return;
    }

    const tokenElements = Array.from(fragment.querySelectorAll(TEMPLATE_EDITOR_INSERTED_TOKEN_SELECTOR));

    if (!tokenElements.length) {
      return;
    }

    const sourceElement = getTemplateEditorInsertionStyleSource(range, insertionCell, templateEditorSurface);

    if (!sourceElement) {
      return;
    }

    tokenElements.forEach((tokenElement) => {
      [
        "fontFamily",
        "fontSize",
        "fontStyle",
        "fontWeight",
        "lineHeight",
        "color",
      ].forEach((propertyName) => {
        setTemplateEditorInsertedTokenStyle(
          tokenElement,
          propertyName,
          getTemplateEditorInsertionStyleValue(sourceElement, propertyName),
        );
      });

      const textDecorationLine = getTemplateEditorInsertionStyleValue(sourceElement, "textDecorationLine").toLowerCase();

      if (textDecorationLine && textDecorationLine !== "none") {
        setTemplateEditorInsertedTokenStyle(tokenElement, "textDecorationLine", textDecorationLine);
        setTemplateEditorInsertedTokenStyle(
          tokenElement,
          "textDecorationStyle",
          getTemplateEditorInsertionStyleValue(sourceElement, "textDecorationStyle"),
        );
        setTemplateEditorInsertedTokenStyle(
          tokenElement,
          "textDecorationColor",
          getTemplateEditorInsertionStyleValue(sourceElement, "textDecorationColor"),
        );
      } else {
        tokenElement.style.removeProperty("text-decoration");
        tokenElement.style.removeProperty("text-decoration-line");
        tokenElement.style.removeProperty("text-decoration-style");
        tokenElement.style.removeProperty("text-decoration-color");
      }
    });
  }

  function createTemplateEditorInsertionTableGeometrySnapshot(fragment, insertionCell) {
    if (
      !fragment?.querySelector?.(TEMPLATE_EDITOR_INSERTED_TOKEN_SELECTOR) ||
      !(insertionCell instanceof HTMLTableCellElement)
    ) {
      return null;
    }

    const table = insertionCell.closest("table");

    if (!(table instanceof HTMLTableElement)) {
      return null;
    }

    const rows = Array.from(table.rows || []).map((rowElement) => ({
      cells: Array.from(rowElement.cells || []).map((cellElement) => ({
        cellElement,
        height: cellElement.style.height,
      })),
      height: `${Math.max(1, Math.round(rowElement.getBoundingClientRect?.().height || rowElement.offsetHeight || 0))}px`,
      rowElement,
    }));
    const totalHeight = rows.reduce((heightSum, row) => heightSum + (Number.parseFloat(row.height) || 0), 0);

    return {
      rows,
      table,
      tableHeight: table.style.height || (totalHeight > 0 ? `${Math.round(totalHeight)}px` : ""),
    };
  }

  function restoreTemplateEditorInsertionTableGeometrySnapshot(snapshot) {
    const table = snapshot?.table;

    if (!(table instanceof HTMLTableElement) || !table.isConnected) {
      return false;
    }

    snapshot.rows.forEach(({ cells, height, rowElement }) => {
      if (!rowElement?.isConnected || !String(height || "").trim()) {
        return;
      }

      rowElement.style.height = height;
      cells.forEach(({ cellElement, height: cellHeight }) => {
        if (!cellElement?.isConnected) {
          return;
        }

        if (String(cellHeight || "").trim()) {
          cellElement.style.height = cellHeight;
        } else {
          cellElement.style.removeProperty("height");
        }
      });

    });

    if (String(snapshot.tableHeight || "").trim()) {
      table.style.height = snapshot.tableHeight;
    }

    return true;
  }

  function cloneTemplateEditorInsertionRange(range, templateEditorSurface) {
    if (!range || !templateEditorSurface) {
      return null;
    }

    const insertionRoot = getTemplateEditorInsertionRoot(templateEditorSurface);

    if (!isRangeInsideElement(range, insertionRoot)) {
      return null;
    }

    try {
      return range.cloneRange();
    } catch (_error) {
      return null;
    }
  }

  function getTemplateEditorActiveInsertionRange(templateEditorSurface, currentRange, savedRange) {
    const currentInsertionRange = cloneTemplateEditorInsertionRange(currentRange, templateEditorSurface);

    if (currentInsertionRange) {
      return currentInsertionRange;
    }

    const savedInsertionRange = cloneTemplateEditorInsertionRange(savedRange, templateEditorSurface);

    if (savedInsertionRange) {
      return savedInsertionRange;
    }

    const selection = window.getSelection?.();
    const selectionRange = selection?.rangeCount > 0 ? selection.getRangeAt(0) : null;

    return cloneTemplateEditorInsertionRange(selectionRange, templateEditorSurface);
  }

  function ensureInsertedTableCaretHost(tableElement, templateEditorSurface) {
    if (!(tableElement instanceof HTMLTableElement) || !templateEditorSurface?.contains?.(tableElement)) {
      return null;
    }

    const documentElement = tableElement.closest(".template-doc") || templateEditorSurface;

    if (tableElement.parentElement !== documentElement || tableElement.closest("[data-candidate-block-grid], [data-candidate-block-instance]")) {
      return null;
    }

    const nextElement = tableElement.nextElementSibling;

    if (
      nextElement instanceof HTMLElement &&
      /^(P|DIV)$/i.test(String(nextElement.tagName || "")) &&
      nextElement.getAttribute("contenteditable") !== "false"
    ) {
      if (!nextElement.childNodes.length) {
        nextElement.append(document.createElement("br"));
      }
      return nextElement;
    }

    const paragraph = document.createElement("p");

    paragraph.append(document.createElement("br"));
    tableElement.after(paragraph);
    return paragraph;
  }

  function createTemplateEditorInsertionController({
    buildTemplateTokenHtml,
    escapeAttribute,
    getTemplateEditorSurface,
    placeCaretAtEnd,
    restoreTemplateEditorSelection,
    setTemplateEditorStatus,
    state,
    syncTemplateEditorContent,
  }) {
    function removeEmptyInlineInsertionPlaceholder(range, surface) {
      if (!range?.collapsed) return;
      const start = range.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer : range.startContainer.parentElement;
      const host = start?.closest?.("p, div, td, th, li");
      if (!host || !surface.contains(host)) return;
      if (String(host.textContent || "").replace(/[\u00a0\u200b\ufeff]/g, " ").trim()) return;
      const descendants = Array.from(host.querySelectorAll("*"));
      if (descendants.some(element => !element.matches("br, span, b, strong, i, em, u, s, strike, font") ||
        element.matches("[contenteditable='false'], [data-template-tag-value], .template-generated-object"))) return;
      const breaks = host.querySelectorAll("br");
      // One BR in an otherwise empty host is the browser's caret placeholder.
      // Multiple BRs represent intentional spacing and must remain intact.
      if (breaks.length === 1) breaks[0].remove();
    }

    function insertTemplateHtml(html, { preserveTablePresentation = false } = {}) {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface) {
        return false;
      }

      const currentRange = getCurrentTemplateEditorRange(templateEditorSurface);

      if (!currentRange) {
        restoreTemplateEditorSelection();
      }

      const selection = window.getSelection();
      const activeRange = getTemplateEditorActiveInsertionRange(
        templateEditorSurface,
        currentRange,
        state.templateEditor.savedRange,
      );
      const insertionRange = getTemplateEditorInsertionRange(templateEditorSurface, activeRange);

      if (!insertionRange) {
        placeCaretAtEnd(getTemplateEditorInsertionRoot(templateEditorSurface) || templateEditorSurface);
        return false;
      }

      const markup = String(html || "").trim();
      const fragment = insertionRange.createContextualFragment(markup);
      const insertionCell = getTemplateEditorInsertionCell(insertionRange, templateEditorSurface);
      const insertionCandidateBlock = getTemplateEditorInsertionCandidateBlock(insertionRange, templateEditorSurface);
      const hasInsertedTable = Boolean(fragment.querySelector?.("table"));
      const insertionDocumentElement = templateEditorSurface.querySelector?.(".template-doc") || templateEditorSurface;
      const flowTableCountBeforeInsertion = Array.from(insertionDocumentElement.children || [])
        .filter((element) => element instanceof HTMLTableElement).length;
      const shouldReplaceBlankCandidateBlockImageHost = Boolean(
        !insertionCell &&
          insertionCandidateBlock &&
          !hasInsertedTable &&
          fragment.querySelector?.("img"),
      );

      if (
        !fitTemplateEditorTablesToCandidateBlock(
          fragment,
          insertionCandidateBlock,
          {
            insertionRange,
            preservePresentation: preserveTablePresentation,
            setStatus: (message, type) => {
              setTemplateEditorStatus(message, type);
              if (preserveTablePresentation) {
                templateEditorSurface.dispatchEvent(new CustomEvent("template-editor-paste-error", {
                  bubbles: true, detail: { message },
                }));
              }
            },
          },
        )
      ) {
        return false;
      }

      fitTemplateEditorImagesToInsertionCell(
        fragment,
        insertionCell,
        insertionRange,
      );
      if (!insertionCell) {
        fitTemplateEditorImagesToCandidateBlock(fragment, insertionCandidateBlock);
      }
      if (!preserveTablePresentation) {
        applyTemplateEditorInsertedTokenContextStyle(fragment, insertionRange, insertionCell, templateEditorSurface);
      }
      const tableGeometrySnapshot = createTemplateEditorInsertionTableGeometrySnapshot(fragment, insertionCell);
      const insertedFlowTable = !insertionCell && !insertionCandidateBlock
        ? Array.from(fragment.childNodes || []).find((node) => node instanceof HTMLTableElement) || null
        : null;
      const lastInsertedNode = fragment.lastChild;
      const blankInsertionRoot = insertionCandidateBlock ||
        (!insertionCell && hasInsertedTable ? insertionDocumentElement : null);
      const blankInsertionBlock = hasInsertedTable || shouldReplaceBlankCandidateBlockImageHost
        ? getTemplateEditorBlankInsertionBlock(insertionRange, blankInsertionRoot)
        : null;

      if (blankInsertionBlock) {
        if (shouldReplaceBlankCandidateBlockImageHost) {
          insertionRange.selectNodeContents(blankInsertionBlock);
        } else {
          insertionRange.selectNode(blankInsertionBlock);
        }
      }

      if (fragment.childNodes.length === 1 && fragment.firstElementChild?.matches(".template-token[data-template-tag-value]")) {
        removeEmptyInlineInsertionPlaceholder(insertionRange, templateEditorSurface);
      }
      insertionRange.deleteContents();
      insertionRange.insertNode(fragment);
      restoreTemplateEditorInsertionTableGeometrySnapshot(tableGeometrySnapshot);
      const connectedInsertedFlowTable = insertedFlowTable ||
        (lastInsertedNode instanceof HTMLTableElement ? lastInsertedNode : null);
      const insertedObjectCaretHost = ensureInsertedTableCaretHost(connectedInsertedFlowTable, templateEditorSurface);
      const insertedTableDocument = connectedInsertedFlowTable?.closest?.(".template-doc") || null;
      const insertedFlowTableIndex = insertedTableDocument && connectedInsertedFlowTable
        ? Array.from(insertedTableDocument.children).filter((element) => element instanceof HTMLTableElement)
          .indexOf(connectedInsertedFlowTable)
        : -1;

      if (selection) {
        const nextRange = document.createRange();

        if (insertedObjectCaretHost) {
          nextRange.selectNodeContents(insertedObjectCaretHost);
          nextRange.collapse(false);
        } else if (lastInsertedNode) {
          nextRange.setStartAfter(lastInsertedNode);
        } else {
          nextRange.selectNodeContents(templateEditorSurface);
          nextRange.collapse(false);
        }

        if (!insertedObjectCaretHost) {
          nextRange.collapse(true);
        }
        selection.removeAllRanges();
        selection.addRange(nextRange);
        state.templateEditor.savedRange = nextRange.cloneRange();
      }

      syncTemplateEditorContent();

      if (selection && hasInsertedTable && !insertionCell && !insertionCandidateBlock) {
        const currentDocumentElement = insertedTableDocument || insertionDocumentElement;
        const currentTables = Array.from(currentDocumentElement.children || [])
          .filter((element) => element instanceof HTMLTableElement);
        const currentTable = insertedFlowTableIndex >= 0
          ? currentTables[insertedFlowTableIndex] || null
          : currentTables[Math.min(flowTableCountBeforeInsertion, currentTables.length - 1)] || null;
        const currentCaretHost = ensureInsertedTableCaretHost(currentTable, templateEditorSurface);

        if (currentCaretHost) {
          const currentRange = document.createRange();

          templateEditorSurface.focus?.({ preventScroll: true });
          currentRange.selectNodeContents(currentCaretHost);
          currentRange.collapse(false);
          selection.removeAllRanges();
          selection.addRange(currentRange);
          state.templateEditor.savedRange = currentRange.cloneRange();
        }
      }
      return true;
    }

    function insertTemplateTag(tag) {
      if (!tag) {
        return;
      }

      insertTemplateHtml(buildTemplateTokenHtml(tag));
    }

    function insertTemplateImage(file) {
      if (!file) {
        return;
      }

      const fileReader = new FileReader();

      fileReader.addEventListener("load", () => {
        insertTemplateHtml(`<img src="${fileReader.result}" alt="${escapeAttribute(file.name)}" />`);
      });

      fileReader.readAsDataURL(file);
    }

    function insertTemplateImageSource(sourceValue, caption = "이미지") {
      const normalizedSource = String(sourceValue || "").trim();
      const normalizedCaption = String(caption || "이미지").trim() || "이미지";

      if (!normalizedSource) {
        return false;
      }

      return insertTemplateHtml(
        `<img src="${escapeAttribute(normalizedSource)}" alt="${escapeAttribute(normalizedCaption)}" title="${escapeAttribute(normalizedCaption)}" />`,
      ) !== false;
    }

    return Object.freeze({
      insertTemplateHtml,
      insertTemplateImage,
      insertTemplateImageSource,
      insertTemplateTag,
    });
  }

  return Object.freeze({
    createTemplateEditorInsertionController,
  });
});

})();
