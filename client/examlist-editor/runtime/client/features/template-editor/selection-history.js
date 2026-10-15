(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorSelectionHistory = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const pageSettingsModule = globalThis.ExamListTemplateEditorPageSettings;

  function createTemplateEditorSelectionHistoryController({
    TEMPLATE_EDITOR_HISTORY_LIMIT,
    clearTemplateEditorImageSelection,
    clearTemplateEditorTableSelection,
    createTemplateEditorSelectionSnapshot,
    decorateTemplateEditorImages,
    getTemplateEditorActiveTableSelection,
    getTemplateEditorSerializedHtml,
    getTemplateEditorSurface,
    normalizeTemplateEditorFontNodes,
    normalizeTemplateEditorTables,
    normalizeTemplateTagNodes,
    placeCaretAtTemplateEditorEnd,
    releaseTemplateEditorTableResizeSession,
    releaseTemplateEditorTableSelectionSession,
    restoreTemplateEditorSelectionSnapshot,
    saveTemplateEditorSelection,
    setTemplateEditorStatus,
    state,
    updateTemplateEditorActiveCell,
    updateTemplateEditorFormattingControls,
    updateTemplateEditorImageSelectionOverlay,
    updateTemplateTableControls,
  }) {
    function recordTemplateEditorHistorySnapshot({ force = false } = {}) {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface || state.templateEditor.isRestoringHistory) {
        return;
      }

      syncTemplateEditorObjectFlowLayout(templateEditorSurface);

      const snapshot = {
        html: getTemplateEditorSerializedHtml(),
        selection: createTemplateEditorSelectionSnapshot(),
      };
      const currentSnapshot = state.templateEditor.historyEntries[state.templateEditor.historyIndex];

      if (!force && currentSnapshot?.html === snapshot.html) {
        if (currentSnapshot) {
          currentSnapshot.selection = snapshot.selection;
        }
        return;
      }

      state.templateEditor.historyEntries = state.templateEditor.historyEntries.slice(0, state.templateEditor.historyIndex + 1);
      state.templateEditor.historyEntries.push(snapshot);

      if (state.templateEditor.historyEntries.length > TEMPLATE_EDITOR_HISTORY_LIMIT) {
        state.templateEditor.historyEntries.shift();
      }

      state.templateEditor.historyIndex = state.templateEditor.historyEntries.length - 1;
    }

    function initializeTemplateEditorHistory() {
      state.templateEditor.historyEntries = [];
      state.templateEditor.historyIndex = -1;
      recordTemplateEditorHistorySnapshot({ force: true });
    }

    function getTemplateEditorSnapshotText(html = "") {
      const sourceHtml = String(html || "");
      const ownerDocument =
        getTemplateEditorSurface()?.ownerDocument ||
        (typeof document !== "undefined" ? document : null);

      if (ownerDocument?.createElement) {
        const container = ownerDocument.createElement("div");

        container.innerHTML = sourceHtml;
        return String(container.textContent || "").trim();
      }

      return sourceHtml.replace(/<[^>]*>/g, "").trim();
    }

    function applyTemplateEditorHistorySnapshot(snapshot, { verifyNativeHistory = true } = {}) {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface || !snapshot) {
        return;
      }

      state.templateEditor.isRestoringHistory = true;
      clearTemplateEditorImageSelection();
      releaseTemplateEditorTableResizeSession({ sync: false });
      releaseTemplateEditorTableSelectionSession({ keepSelection: false });
      clearTemplateEditorTableSelection();
      templateEditorSurface.innerHTML = snapshot.html;
      pageSettingsModule?.syncTemplatePageSettingsFromDocumentToSurface?.(templateEditorSurface);
      decorateTemplateEditorImages(templateEditorSurface);
      syncTemplateEditorContent();

      if (!restoreTemplateEditorSelectionSnapshot(snapshot.selection)) {
        placeCaretAtTemplateEditorEnd();
      }

      state.templateEditor.isRestoringHistory = false;
      updateTemplateEditorActiveCell();
      updateTemplateEditorFormattingControls();
      updateTemplateTableControls();

      if (verifyNativeHistory) {
        const expectedHistoryIndex = state.templateEditor.historyIndex;
        const ownerWindow = templateEditorSurface.ownerDocument?.defaultView ||
          (typeof window !== "undefined" ? window : null);

        if (!ownerWindow?.setTimeout) {
          return;
        }

        ownerWindow.setTimeout(() => {
          const currentSnapshot = state.templateEditor.historyEntries[state.templateEditor.historyIndex] || null;

          if (
            state.templateEditor.isRestoringHistory ||
            state.templateEditor.historyIndex !== expectedHistoryIndex ||
            currentSnapshot !== snapshot ||
            getTemplateEditorSerializedHtml() === snapshot.html
          ) {
            return;
          }

          applyTemplateEditorHistorySnapshot(snapshot, { verifyNativeHistory: false });
        }, 0);
      }
    }

    function undoTemplateEditorHistory() {
      const currentSnapshot = state.templateEditor.historyEntries[state.templateEditor.historyIndex] || null;

      if (currentSnapshot?.html === state.templateEditor.draftHtml) {
        const currentHtml = getTemplateEditorSerializedHtml();
        const hasMeaningfulUnrecordedChange =
          getTemplateEditorSnapshotText(currentHtml) !== getTemplateEditorSnapshotText(currentSnapshot.html);

        if (hasMeaningfulUnrecordedChange) {
          recordTemplateEditorHistorySnapshot();
        } else {
          currentSnapshot.selection = createTemplateEditorSelectionSnapshot();
        }
      } else {
        recordTemplateEditorHistorySnapshot();
      }

      if (state.templateEditor.historyIndex <= 0) {
        return;
      }

      state.templateEditor.historyIndex -= 1;
      applyTemplateEditorHistorySnapshot(state.templateEditor.historyEntries[state.templateEditor.historyIndex]);
    }

    function redoTemplateEditorHistory() {
      if (state.templateEditor.historyIndex >= state.templateEditor.historyEntries.length - 1) {
        return;
      }

      state.templateEditor.historyIndex += 1;
      applyTemplateEditorHistorySnapshot(state.templateEditor.historyEntries[state.templateEditor.historyIndex]);
    }

    function getTemplateEditorContentRectBoundary(documentElement) {
      const boundary = {
        bottom: 0,
        hasRect: false,
        left: Number.POSITIVE_INFINITY,
        right: 0,
        top: Number.POSITIVE_INFINITY,
      };

      function includeRect(rect) {
        if (!rect || (!rect.width && !rect.height)) {
          return;
        }

        boundary.bottom = Math.max(boundary.bottom, rect.bottom);
        boundary.hasRect = true;
        boundary.left = Math.min(boundary.left, rect.left);
        boundary.right = Math.max(boundary.right, rect.right);
        boundary.top = Math.min(boundary.top, rect.top);
      }

      const transientMeasurementSelector =
        ".template-editor-image-selection, .template-editor-image-resize-handle, .examlist-object-selection, .examlist-object-resize-handle, .template-editor-table-selection, .template-editor-table-handle, .template-editor-table-move-handle, .template-editor-table-select-handle, [data-candidate-block-grid-resize-handle], [data-candidate-block-grid-move-handle]";
      const candidateBlockGridMeasurementSelector = "[data-candidate-block-grid], .examlist-candidate-block-grid";
      const excludedTextMeasurementSelector = `${transientMeasurementSelector}, ${candidateBlockGridMeasurementSelector}`;

      try {
        const nodeFilter = documentElement.ownerDocument.defaultView?.NodeFilter || NodeFilter;
        const range = documentElement.ownerDocument.createRange();
        const textWalker = documentElement.ownerDocument.createTreeWalker(
          documentElement,
          nodeFilter.SHOW_TEXT,
          {
            acceptNode(textNode) {
              if (!String(textNode.textContent || "").replace(/\u00a0/g, " ").trim()) {
                return nodeFilter.FILTER_REJECT;
              }

              if (textNode.parentElement?.closest?.(excludedTextMeasurementSelector)) {
                return nodeFilter.FILTER_REJECT;
              }

              return nodeFilter.FILTER_ACCEPT;
            },
          },
        );

        while (textWalker.nextNode()) {
          range.selectNodeContents(textWalker.currentNode);
          Array.from(range.getClientRects()).forEach(includeRect);
        }

        range.detach?.();
      } catch (error) {
        // Range measurement can fail while the editor is being detached. Element rects below are the fallback.
      }

      documentElement
        .querySelectorAll(
          "blockquote, figure, h1, h2, h3, hr, img, li, ol, p, table, ul, .template-generated-object, .template-token",
        )
        .forEach((element) => {
          if (element.closest(transientMeasurementSelector)) {
            return;
          }

          const candidateBlockGridElement = element.closest(candidateBlockGridMeasurementSelector);

          if (candidateBlockGridElement && candidateBlockGridElement !== element) {
            return;
          }

          Array.from(element.getClientRects()).forEach(includeRect);
        });

      if (!Number.isFinite(boundary.left)) {
        boundary.left = 0;
      }

      if (!Number.isFinite(boundary.top)) {
        boundary.top = 0;
      }

      return boundary;
    }

    function getTemplateEditorOverflowInfo() {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface) {
        return {
          hasOverflow: false,
          heightOverflow: 0,
          widthOverflow: 0,
        };
      }

      if (templateEditorSurface.matches?.("[data-candidate-block-modal-editor-surface]")) {
        return {
          hasOverflow: false,
          heightOverflow: 0,
          widthOverflow: 0,
        };
      }

      const documentElement = templateEditorSurface.querySelector(".template-doc") || templateEditorSurface;
      const documentRect = documentElement.getBoundingClientRect();
      const contentBoundary = getTemplateEditorContentRectBoundary(documentElement);
      const documentBottomOverflow = contentBoundary.hasRect
        ? Math.max(0, Math.ceil(contentBoundary.bottom - documentRect.bottom))
        : 0;
      const documentRightOverflow = contentBoundary.hasRect
        ? Math.max(0, Math.ceil(contentBoundary.right - documentRect.right))
        : 0;
      const documentLeftOverflow = contentBoundary.hasRect
        ? Math.max(0, Math.ceil(documentRect.left - contentBoundary.left))
        : 0;
      const heightOverflow = documentBottomOverflow;
      const widthOverflow = Math.max(documentLeftOverflow, documentRightOverflow);

      return {
        hasOverflow: heightOverflow > 4 || widthOverflow > 4,
        heightOverflow,
        widthOverflow,
      };
    }

    function isTemplateEditorOverflow() {
      return getTemplateEditorOverflowInfo().hasOverflow;
    }

    function syncTemplateEditorObjectFlowLayout(templateEditorSurface) {
      const syncObjectFlowObjects = globalThis.ExamListTemplateEditorObjectFlowReflow?.syncTemplateEditorObjectFlowObjects;

      if (typeof syncObjectFlowObjects !== "function" || !(templateEditorSurface instanceof HTMLElement)) {
        return;
      }

      syncObjectFlowObjects(templateEditorSurface.querySelector(".template-doc") || templateEditorSurface);
    }

    function restoreTemplateEditorLastValidContent(statusMessage = "") {
      const templateEditorSurface = getTemplateEditorSurface();
      const lastValidHtml = String(state.templateEditor.lastValidHtml || "");

      if (!templateEditorSurface || !lastValidHtml) {
        return false;
      }

      const currentHtml = getTemplateEditorSerializedHtml();

      if (currentHtml === lastValidHtml) {
        return false;
      }

      const currentSnapshot = state.templateEditor.historyEntries[state.templateEditor.historyIndex] || null;

      state.templateEditor.isRestoringHistory = true;
      clearTemplateEditorImageSelection();
      releaseTemplateEditorTableResizeSession({ sync: false });
      releaseTemplateEditorTableSelectionSession({ keepSelection: false });
      clearTemplateEditorTableSelection();
      templateEditorSurface.innerHTML = lastValidHtml;
      const pageSettings = pageSettingsModule?.syncTemplatePageSettingsFromDocumentToSurface?.(templateEditorSurface);
      normalizeTemplateEditorFontNodes(templateEditorSurface);
      normalizeTemplateTagNodes(templateEditorSurface);
      normalizeTemplateEditorTables(templateEditorSurface);
      decorateTemplateEditorImages(templateEditorSurface);
      state.templateEditor.draftHtml = getTemplateEditorSerializedHtml();
      state.templateEditor.lastValidHtml = state.templateEditor.draftHtml;
      state.templateEditor.hasOverflow = isTemplateEditorOverflow();

      if (!restoreTemplateEditorSelectionSnapshot(currentSnapshot?.selection)) {
        placeCaretAtTemplateEditorEnd();
      }

      state.templateEditor.isRestoringHistory = false;
      updateTemplateEditorActiveCell();
      updateTemplateEditorFormattingControls();
      updateTemplateTableControls();
      updateTemplateEditorImageSelectionOverlay();

      if (state.templateEditor.hasOverflow) {
        setTemplateEditorStatus(
          pageSettingsModule?.getTemplatePageStatusMessage?.(pageSettings, true) ||
            "페이지 영역을 초과했습니다. 내용 길이를 줄여야 합니다.",
          "warning",
        );
        return false;
      }

      setTemplateEditorStatus(
        statusMessage || "페이지 여백 경계선을 넘어 입력할 수 없습니다.",
        "warning",
      );
      return true;
    }

    function syncTemplateEditorContent(options = {}) {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface) {
        return;
      }

      const preserveSelection = Boolean(options.preserveSelection);
      const focusEditor = Boolean(options.focusEditor);
      const selectionSnapshot = preserveSelection ? createTemplateEditorSelectionSnapshot() : null;
      const shouldNormalizeTables = options.normalizeTables !== false;

      normalizeTemplateEditorFontNodes(templateEditorSurface);
      normalizeTemplateTagNodes(templateEditorSurface);
      if (shouldNormalizeTables) {
        normalizeTemplateEditorTables(templateEditorSurface);
      }
      decorateTemplateEditorImages(templateEditorSurface);
      const pageSettings = pageSettingsModule?.syncTemplatePageSettingsFromDocumentToSurface?.(templateEditorSurface);

      if (!getTemplateEditorActiveTableSelection()) {
        clearTemplateEditorTableSelection();
      }

      syncTemplateEditorObjectFlowLayout(templateEditorSurface);

      const serializedHtml = getTemplateEditorSerializedHtml();
      state.templateEditor.draftHtml = serializedHtml;
      state.templateEditor.hasOverflow = isTemplateEditorOverflow();

      if (state.templateEditor.hasOverflow) {
        setTemplateEditorStatus(
          pageSettingsModule?.getTemplatePageStatusMessage?.(pageSettings, true) ||
            "페이지 영역을 초과했습니다. 편집은 가능하지만 저장 전 내용 길이를 줄여야 합니다.",
          "warning",
        );
      } else {
        state.templateEditor.lastValidHtml = serializedHtml;
        setTemplateEditorStatus(
          pageSettingsModule?.getTemplatePageStatusMessage?.(pageSettings, false) || "페이지 영역 안에서 편집 중입니다.",
        );
      }

      if (selectionSnapshot && focusEditor) {
        templateEditorSurface.focus({ preventScroll: true });
      }

      if (!(selectionSnapshot && restoreTemplateEditorSelectionSnapshot(selectionSnapshot))) {
        saveTemplateEditorSelection();
      }

      recordTemplateEditorHistorySnapshot();
      updateTemplateEditorActiveCell();
      updateTemplateEditorFormattingControls();

      if (
        state.templateEditor.selectedImageElement &&
        !templateEditorSurface.contains(state.templateEditor.selectedImageElement)
      ) {
        clearTemplateEditorImageSelection();
      } else {
        updateTemplateEditorImageSelectionOverlay();
      }
    }

    return Object.freeze({
      initializeTemplateEditorHistory,
      redoTemplateEditorHistory,
      syncTemplateEditorContent,
      undoTemplateEditorHistory,
    });
  }

  return Object.freeze({
    createTemplateEditorSelectionHistoryController,
  });
});

})();
