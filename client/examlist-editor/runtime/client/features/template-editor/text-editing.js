(function () {
// Adapted from examcheck's text-selection, token-caret and line-alignment helpers.
(function (scope, factory) {
  const api = factory();
  scope.ExamListTemplateEditorTextEditing = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function captureTemplateTextSelection(root) {
    const selection = root.ownerDocument.defaultView?.getSelection();
    if (!selection?.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (
      !root.contains(range.startContainer) ||
      !root.contains(range.endContainer)
    )
      return null;
    const prefix = root.ownerDocument.createRange();
    prefix.selectNodeContents(root);
    prefix.setEnd(range.startContainer, range.startOffset);
    const start = prefix.toString().length;
    prefix.setEnd(range.endContainer, range.endOffset);
    return {
      text: root.textContent || "",
      start,
      end: prefix.toString().length,
      backward:
        selection.anchorNode === range.endContainer &&
        selection.anchorOffset === range.endOffset,
    };
  }
  function restoreTemplateTextSelection(root, snapshot) {
    // Formatting can replace wrappers and token labels. Keep logical text offsets,
    // but never restore a selection into different content (for example after undo).
    if (
      !root.isConnected ||
      !snapshot.text ||
      root.textContent !== snapshot.text
    )
      return false;
    const selection = root.ownerDocument.defaultView?.getSelection();
    if (!selection) return false;
    const range = root.ownerDocument.createRange();
    const boundary = (offset, end) => {
      const walker = root.ownerDocument.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
      );
      let remaining = offset;
      let node;
      while ((node = walker.nextNode())) {
        const length = node.textContent?.length || 0;
        if (
          !length ||
          remaining > length ||
          (!end && remaining === length && offset < snapshot.text.length)
        ) {
          remaining -= length;
          continue;
        }
        const token = node.parentElement?.closest(
          ".template-token[contenteditable='false']",
        );
        if (token && root.contains(token)) {
          // Tags are atomic editor objects: select their outer boundary, never
          // place an editable caret inside their protected display text.
          if (end) range.setEndAfter(token);
          else range.setStartBefore(token);
        } else if (end) range.setEnd(node, remaining);
        else range.setStart(node, remaining);
        return true;
      }
      return false;
    };
    if (!boundary(snapshot.start, false)) return false;
    if (snapshot.start !== snapshot.end && !boundary(snapshot.end, true))
      return false;
    if (snapshot.start === snapshot.end) range.collapse(true);
    if (snapshot.backward && !range.collapsed) {
      selection.setBaseAndExtent(
        range.endContainer,
        range.endOffset,
        range.startContainer,
        range.startOffset,
      );
    } else {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return true;
  }

  const TOKEN_SELECTOR =
    ".template-token[contenteditable='false'][data-template-tag-value]";
  const INLINE_WRAPPERS = new Set([
    "SPAN",
    "B",
    "STRONG",
    "I",
    "EM",
    "U",
    "S",
    "FONT",
  ]);
  // Chromium cannot paint a caret at an element boundary after a final atomic tag.
  // Create a temporary text position only when the user actually places a caret there.
  function ensureTemplateTokenCaret(surface) {
    const selection = surface.ownerDocument.defaultView?.getSelection();
    if (!selection?.isCollapsed || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    if (
      container.nodeType !== Node.ELEMENT_NODE ||
      !surface.contains(container) ||
      range.startOffset === 0
    )
      return null;
    let previous = container.childNodes[range.startOffset - 1];
    while (
      previous instanceof HTMLElement &&
      !previous.matches(TOKEN_SELECTOR) &&
      INLINE_WRAPPERS.has(previous.tagName)
    ) {
      if (!previous.lastChild) return null;
      previous = previous.lastChild;
    }
    if (!(previous instanceof HTMLElement) || !previous.matches(TOKEN_SELECTOR))
      return null;
    // The main canvas renders data blocks as objects; their separate modal owns editing.
    if (
      previous.closest("[data-candidate-block-grid]") &&
      !surface.matches("[data-candidate-block-modal-editor-surface]")
    )
      return null;
    if (previous.parentElement?.closest("[contenteditable='false']"))
      return null;
    let text = previous.nextSibling;
    if (
      text instanceof HTMLElement &&
      text.classList.contains("template-token-caret")
    )
      text = text.firstChild;
    if (text?.nodeType !== Node.TEXT_NODE || !text.textContent) {
      const guard = surface.ownerDocument.createElement("span");
      guard.className = "template-token-caret";
      text = surface.ownerDocument.createTextNode("\u200B");
      guard.append(text);
      previous.after(guard);
    }
    range.setStart(text, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    return range.cloneRange();
  }

  const BLOCK_SELECTOR =
    "p, div, h1, h2, h3, h4, h5, h6, li, td, th, blockquote";
  const ALIGNMENTS = {
    justifyLeft: "left",
    justifyCenter: "center",
    justifyRight: "right",
    justifyFull: "justify",
  };
  function applyLineAlignment(element, alignment) {
    element.style.textAlign = alignment;
    // Distributed alignment includes single lines and the last line of a
    // paragraph. Reset inherited distribution when choosing another alignment.
    element.style.textAlignLast = alignment === "justify" ? "justify" : "auto";
    element.style.setProperty(
      "text-justify",
      alignment === "justify" ? "inter-character" : "auto",
    );
  }
  function intersectsLine(selection, line) {
    if (selection.collapsed) {
      return (
        line.comparePoint(selection.startContainer, selection.startOffset) === 0
      );
    }
    if (
      selection.compareBoundaryPoints(Range.END_TO_START, line) >= 0 ||
      selection.compareBoundaryPoints(Range.START_TO_END, line) <= 0
    )
      return false;
    const startsBefore =
      selection.compareBoundaryPoints(Range.START_TO_START, line) <= 0;
    const endsAfter =
      selection.compareBoundaryPoints(Range.END_TO_END, line) >= 0;
    if (startsBefore && endsAfter) return true;
    const intersection = line.cloneRange();
    if (!startsBefore)
      intersection.setStart(selection.startContainer, selection.startOffset);
    if (!endsAfter)
      intersection.setEnd(selection.endContainer, selection.endOffset);
    const fragment = intersection.cloneContents();
    // A selection ending at offset zero of the next line's text has crossed its
    // opening wrappers, but has not selected any of that line's content.
    return Boolean(
      fragment.textContent ||
      fragment.querySelector("br, img, .template-token"),
    );
  }
  // Older templates use BRs inside a single paragraph. Browser alignment and the
  // runtime's token alignment both treat that entire paragraph as one target.
  // Keep its outer presentation, but give each explicit line its own block.
  function alignTemplateTextLines(content, alignment) {
    const selection = content.ownerDocument.defaultView?.getSelection();
    if (!selection?.rangeCount) return false;
    const range = selection.getRangeAt(0);
    if (
      !content.contains(range.startContainer) ||
      !content.contains(range.endContainer)
    )
      return false;
    const snapshot = captureTemplateTextSelection(content);
    const blocks = Array.from(content.querySelectorAll(BLOCK_SELECTOR)).filter(
      (block) =>
        !block.querySelector(BLOCK_SELECTOR) &&
        !block.closest("[contenteditable='false']"),
    );
    const targets = blocks.map((block) => {
      const breaks = Array.from(block.querySelectorAll("br")).filter(
        (br) => !br.closest("[contenteditable='false']"),
      );
      const isPlaceholder =
        breaks.length === 1 &&
        !block.textContent &&
        !block.querySelector("img, .template-token");
      const separators = isPlaceholder ? [] : breaks;
      const lines = Array.from(
        { length: separators.length + 1 },
        (_, index) => {
          const line = content.ownerDocument.createRange();
          line.selectNodeContents(block);
          if (index > 0) line.setStartAfter(separators[index - 1]);
          if (index < separators.length) line.setEndBefore(separators[index]);
          return { range: line, selected: intersectsLine(range, line) };
        },
      );
      return { block, lines, split: separators.length > 0 };
    });
    let changed = false;
    for (const { block, lines, split } of targets) {
      if (!lines.some((line) => line.selected)) continue;
      changed = true;
      if (!split) {
        applyLineAlignment(block, alignment);
        continue;
      }
      const fragments = lines.map((line) => line.range.cloneContents());
      // P and heading elements cannot contain DIVs in persisted HTML. Use a DIV
      // with the original attributes and computed paragraph presentation instead.
      let container = block;
      if (block.matches("p, h1, h2, h3, h4, h5, h6")) {
        container = content.ownerDocument.createElement("div");
        for (const attribute of Array.from(block.attributes))
          container.setAttribute(attribute.name, attribute.value);
        const style =
          content.ownerDocument.defaultView?.getComputedStyle(block);
        for (const property of [
          "margin-top",
          "margin-bottom",
          "font-size",
          "font-weight",
          "line-height",
        ]) {
          const value = style?.getPropertyValue(property);
          if (value) container.style.setProperty(property, value);
        }
        block.replaceWith(container);
      }
      container.replaceChildren();
      lines.forEach((line, index) => {
        const element = content.ownerDocument.createElement("div");
        element.append(fragments[index]);
        if (
          !element.textContent &&
          !element.querySelector("img, table, .template-token")
        ) {
          element.append(content.ownerDocument.createElement("br"));
        }
        if (line.selected) applyLineAlignment(element, alignment);
        container.append(element);
      });
    }
    if (changed && snapshot) restoreTemplateTextSelection(content, snapshot);
    return changed;
  }

  return Object.freeze({
    captureTemplateTextSelection,
    restoreTemplateTextSelection,
    ensureTemplateTokenCaret,
    alignTemplateTextLines,
  });
});

})();
