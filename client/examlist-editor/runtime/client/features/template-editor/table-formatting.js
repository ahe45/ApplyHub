(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableFormatting = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const TEMPLATE_TABLE_TEXT_STYLE_TARGET_SELECTOR = [
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
  ].join(",");

  function createTemplateEditorTableFormattingController({
    getTemplateEditorFormattingTargetCells,
    isTemplateTableCellEmpty,
    syncTemplateEditorContent,
  }) {
    function isTemplateEditorOwnedByCell(element, cell) {
      return element instanceof HTMLElement && cell instanceof HTMLTableCellElement && element.closest("td, th") === cell;
    }

    function wrapTemplateEditorCellTextNodes(cell) {
      if (!(cell instanceof HTMLTableCellElement)) {
        return;
      }

      Array.from(cell.childNodes).forEach((node) => {
        if (node.nodeType !== Node.TEXT_NODE || !String(node.textContent || "").trim()) {
          return;
        }

        const wrapper = document.createElement("span");

        wrapper.dataset.templateTableInlineStyleTarget = "true";
        node.before(wrapper);
        wrapper.appendChild(node);
      });
    }

    function getTemplateEditorCellTextStyleTargets(cell, { includeCell = true, wrapTextNodes = false } = {}) {
      if (!(cell instanceof HTMLTableCellElement)) {
        return [];
      }

      if (wrapTextNodes) {
        wrapTemplateEditorCellTextNodes(cell);
      }

      return Array.from(
        new Set([
          ...(includeCell ? [cell] : []),
          ...Array.from(cell.querySelectorAll(TEMPLATE_TABLE_TEXT_STYLE_TARGET_SELECTOR)).filter((element) =>
            isTemplateEditorOwnedByCell(element, cell),
          ),
        ]),
      );
    }

    function getTemplateEditorTableTextStyleTargets(cells, options = {}) {
      return Array.from(new Set(cells.flatMap((cell) => getTemplateEditorCellTextStyleTargets(cell, options))));
    }

    function isTemplateEditorElementBold(element) {
      const fontWeight = String(element?.style.fontWeight || window.getComputedStyle(element || document.body).fontWeight || "")
        .trim()
        .toLowerCase();

      if (fontWeight === "bold") {
        return true;
      }

      const numericFontWeight = Number(fontWeight);
      return Number.isFinite(numericFontWeight) && numericFontWeight >= 600;
    }

    function isTemplateEditorElementItalic(element) {
      const fontStyle = String(element?.style.fontStyle || window.getComputedStyle(element || document.body).fontStyle || "")
        .trim()
        .toLowerCase();
      return fontStyle.includes("italic");
    }

    function isTemplateEditorElementUnderlined(element) {
      const inlineValue = `${element?.style.textDecorationLine || ""} ${element?.style.textDecoration || ""}`.toLowerCase();
      const computedStyle = element ? window.getComputedStyle(element) : null;
      const computedValue = `${computedStyle?.textDecorationLine || ""} ${computedStyle?.textDecoration || ""}`.toLowerCase();
      return inlineValue.includes("underline") || computedValue.includes("underline");
    }

    function getTemplateEditorCellUnorderedList(cell) {
      if (!cell) {
        return null;
      }

      const meaningfulNodes = Array.from(cell.childNodes).filter((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          return String(node.textContent || "").trim() !== "";
        }

        return true;
      });

      return meaningfulNodes.length === 1 && meaningfulNodes[0] instanceof HTMLUListElement ? meaningfulNodes[0] : null;
    }

    function unwrapTemplateEditorCellUnorderedList(cell) {
      const listElement = getTemplateEditorCellUnorderedList(cell);

      if (!listElement) {
        return;
      }

      cell.innerHTML = "";
      const items = Array.from(listElement.children).filter((child) => child.tagName === "LI");

      items.forEach((item, index) => {
        while (item.firstChild) {
          cell.appendChild(item.firstChild);
        }

        if (index < items.length - 1) {
          cell.appendChild(document.createElement("br"));
        }
      });

      if (isTemplateTableCellEmpty(cell)) {
        cell.innerHTML = "<br />";
      }
    }

    function wrapTemplateEditorCellUnorderedList(cell) {
      if (!cell || getTemplateEditorCellUnorderedList(cell)) {
        return;
      }

      const listElement = document.createElement("ul");
      const listItem = document.createElement("li");
      const contentNodes = Array.from(cell.childNodes);
      const hasMeaningfulContent = contentNodes.some((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          return String(node.textContent || "").trim() !== "";
        }

        return !(node instanceof HTMLBRElement && contentNodes.length === 1);
      });

      if (!hasMeaningfulContent) {
        listItem.appendChild(document.createElement("br"));
      } else {
        contentNodes.forEach((node) => {
          listItem.appendChild(node);
        });
      }

      listElement.appendChild(listItem);
      cell.replaceChildren(listElement);
    }

    function applyTemplateEditorTableSelectionCommand(command, value = "") {
      const targetCells = getTemplateEditorFormattingTargetCells();

      if (targetCells.length === 0) {
        return false;
      }

      if (command === "bold") {
        const styleTargets = getTemplateEditorTableTextStyleTargets(targetCells);
        const shouldApplyBold = !styleTargets.every((element) => isTemplateEditorElementBold(element));

        styleTargets.forEach((element) => {
          element.style.fontWeight = shouldApplyBold ? "700" : "400";
        });
      } else if (command === "italic") {
        const styleTargets = getTemplateEditorTableTextStyleTargets(targetCells);
        const shouldApplyItalic = !styleTargets.every((element) => isTemplateEditorElementItalic(element));

        styleTargets.forEach((element) => {
          element.style.fontStyle = shouldApplyItalic ? "italic" : "normal";
        });
      } else if (command === "underline") {
        const styleTargets = getTemplateEditorTableTextStyleTargets(targetCells);
        const shouldApplyUnderline = !styleTargets.every((element) => isTemplateEditorElementUnderlined(element));

        styleTargets.forEach((element) => {
          if (shouldApplyUnderline) {
            element.style.textDecoration = "underline";
            element.style.textDecorationLine = "underline";
            return;
          }

          element.style.removeProperty("text-decoration");
          element.style.removeProperty("text-decoration-line");
        });
      } else if (command === "foreColor") {
        const textColor = String(value || "").trim();

        if (!textColor) {
          return false;
        }

        getTemplateEditorTableTextStyleTargets(targetCells).forEach((element) => {
          element.style.color = textColor;
        });
      } else if (command === "hiliteColor") {
        const backgroundColor = String(value || "").trim();

        if (!backgroundColor) {
          return false;
        }

        getTemplateEditorTableTextStyleTargets(targetCells, { includeCell: false, wrapTextNodes: true }).forEach((element) => {
          element.style.backgroundColor = backgroundColor;
        });
      } else if (
        command === "justifyLeft" ||
        command === "justifyCenter" ||
        command === "justifyRight" ||
        command === "justifyFull"
      ) {
        const textAlignValue =
          command === "justifyCenter" ? "center" : command === "justifyRight" ? "right" : command === "justifyFull" ? "justify" : "left";
        getTemplateEditorTableTextStyleTargets(targetCells).forEach((element) => {
          element.style.textAlign = textAlignValue;
          element.style.textAlignLast = textAlignValue === "justify" ? "justify" : "auto";
          element.style.setProperty("text-justify", textAlignValue === "justify" ? "inter-character" : "auto");
        });
      } else if (command === "insertUnorderedList") {
        const shouldApplyList = !targetCells.every((cell) => getTemplateEditorCellUnorderedList(cell));
        targetCells.forEach((cell) => {
          if (shouldApplyList) {
            wrapTemplateEditorCellUnorderedList(cell);
            return;
          }

          unwrapTemplateEditorCellUnorderedList(cell);
        });
      } else {
        return false;
      }

      syncTemplateEditorContent();
      return true;
    }

    function applyTemplateEditorTableSelectionFontFamily(fontFamily) {
      const targetCells = getTemplateEditorFormattingTargetCells();

      if (targetCells.length === 0) {
        return false;
      }

      getTemplateEditorTableTextStyleTargets(targetCells).forEach((element) => {
        element.style.fontFamily = fontFamily;
      });

      syncTemplateEditorContent();
      return true;
    }

    function applyTemplateEditorTableSelectionFontSize(fontSize) {
      const targetCells = getTemplateEditorFormattingTargetCells();

      if (targetCells.length === 0) {
        return false;
      }

      const styleTargets = getTemplateEditorTableTextStyleTargets(targetCells);

      styleTargets.forEach((element) => {
        element.style.fontSize = `${fontSize}pt`;
      });

      syncTemplateEditorContent({ allowOverflow: true });
      return true;
    }

    return Object.freeze({
      applyTemplateEditorTableSelectionCommand,
      applyTemplateEditorTableSelectionFontFamily,
      applyTemplateEditorTableSelectionFontSize,
    });
  }

  return Object.freeze({
    createTemplateEditorTableFormattingController,
  });
});

})();
