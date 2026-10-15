(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorEvents = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const TEMPLATE_EDITOR_COLOR_INPUT_APPLY_DELAY_MS = 160;

  function createTemplateEditorEventController({
    applyTemplateEditorFontFamily,
    applyTemplateEditorFontSize,
    applyTemplateTableSize = () => {},
    applyToolbarColorTrigger,
    applyToolbarHexColorInput,
    clearTemplateEditorImageHoverState = () => {},
    clearTemplateEditorImageSelection,
    clearTemplateEditorTableHoverState,
    clearTemplateEditorTableObjectHoverState,
    clearTemplateEditorTableObjectSelection,
    clearTemplateEditorTableSelection,
    getTemplateEditorImageTarget,
    getTemplateEditorModal,
    getTemplateEditorSurface,
    handleClick,
    handleKeydown,
    handleTemplateTableAction,
    handleTemplateEditorTableObjectPointerDown,
    handleTemplateEditorTablePointerDown,
    handleTemplatePageSettingChange,
    insertTemplateHtml,
    insertTemplateImage,
    ownerDocument,
    ownerWindow,
    saveTemplateEditorSelection,
    selectTemplateEditorImage,
    shell,
    startTemplateEditorImageMoveSession,
    state,
    syncTemplateEditorContent,
    toolbar,
    toolbarElements,
    toolbarIds,
    redoTemplateEditorHistory = () => {},
    undoTemplateEditorHistory = () => {},
    updateTemplateEditorActiveCell,
    updateTemplateEditorFormattingControls,
    updateTemplateEditorImageHoverState = () => {},
    updateTemplateEditorImageSelectionOverlay,
    updateTemplateEditorTableHoverState,
    updateTemplateEditorTableObjectHoverState,
    updateTemplateEditorTableObjectOverlay,
    updateTemplateTableControls,
  }) {
    const isElement = (target) => Boolean(target && target instanceof ownerWindow.Element);
    let pendingToolbarColorInputTimer = 0;
    let pendingToolbarColorInputElement = null;

    function isCompositionInputEvent(event) {
      const inputType = String(event?.inputType || "");

      return Boolean(
        event?.isComposing ||
          state.templateEditor.isComposing ||
          inputType === "insertCompositionText" ||
          inputType === "deleteCompositionText"
      );
    }

    function isTemplateEditorToolbarFocusElement(element) {
      if (!isElement(element)) {
        return false;
      }

      return Boolean(
        shell.toolbarHost?.contains?.(element) ||
          shell.tagHost?.contains?.(element) ||
          shell.pagePropertiesHost?.contains?.(element)
      );
    }

    function isTemplateEditorSurfaceRootSelection(selection, templateEditorSurface) {
      if (!selection || !templateEditorSurface || selection.rangeCount === 0) {
        return false;
      }

      const range = selection.getRangeAt(0);

      return (
        selection.anchorNode === templateEditorSurface ||
        selection.focusNode === templateEditorSurface ||
        range.commonAncestorContainer === templateEditorSurface
      );
    }

    function resolveTemplateEditorSnapshotNode(path) {
      const templateEditorSurface = getTemplateEditorSurface();

      if (!templateEditorSurface || !Array.isArray(path)) {
        return null;
      }

      let currentNode = templateEditorSurface;

      for (const index of path) {
        currentNode = currentNode?.childNodes?.[index] || null;

        if (!currentNode) {
          return null;
        }
      }

      return currentNode;
    }

    function getTemplateEditorNodeMaxOffset(node) {
      if (!node) {
        return 0;
      }

      return node.nodeType === (ownerWindow.Node?.TEXT_NODE || 3) ? node.textContent.length : node.childNodes.length;
    }

    function createTemplateEditorRangeFromSnapshot(snapshot = state.templateEditor.savedSelectionSnapshot) {
      if (!snapshot || typeof ownerDocument.createRange !== "function") {
        return null;
      }

      const startNode = resolveTemplateEditorSnapshotNode(snapshot.startPath);
      const endNode = resolveTemplateEditorSnapshotNode(snapshot.endPath);

      if (!startNode || !endNode) {
        return null;
      }

      const range = ownerDocument.createRange();

      try {
        range.setStart(startNode, Math.min(snapshot.startOffset, getTemplateEditorNodeMaxOffset(startNode)));
        range.setEnd(endNode, Math.min(snapshot.endOffset, getTemplateEditorNodeMaxOffset(endNode)));
      } catch (_error) {
        return null;
      }

      return range;
    }

    function restoreTemplateEditorSavedRangeFromSnapshot() {
      const range = createTemplateEditorRangeFromSnapshot();

      if (!range) {
        return false;
      }

      state.templateEditor.savedRange = range;
      return true;
    }

    function getTemplateEditorActiveTableSelectionCells() {
      const templateEditorSurface = getTemplateEditorSurface();
      const selection = state.templateEditor.tableSelection;
      const selectedCells = Array.isArray(selection?.selectedCells) ? selection.selectedCells : [];

      if (!templateEditorSurface || !selectedCells.length) {
        return [];
      }

      return selectedCells.filter((cell) => cell?.isConnected !== false && templateEditorSurface.contains(cell));
    }

    function restoreTemplateEditorTableSelectionVisualState() {
      const selectedCells = getTemplateEditorActiveTableSelectionCells();

      if (!selectedCells.length) {
        return false;
      }

      selectedCells.forEach((cell) => cell.classList?.add?.("is-selected-cell"));
      return true;
    }

    function refreshTemplateEditorSelectionVisualState() {
      if (state.templateEditor.interactionDisabled) return;
      restoreTemplateEditorSavedRangeFromSnapshot();
      restoreTemplateEditorTableSelectionVisualState();
    }

    function scheduleTemplateEditorSelectionVisualStateRefresh() {
      ownerWindow.setTimeout(() => {
        if (state.templateEditor.suppressToolbarSelectionChange || isTemplateEditorToolbarFocusElement(ownerDocument.activeElement)) {
          refreshTemplateEditorSelectionVisualState();
        }
      }, 0);
    }

    function cancelPendingToolbarColorInputApply() {
      if (pendingToolbarColorInputTimer && typeof ownerWindow.clearTimeout === "function") {
        ownerWindow.clearTimeout(pendingToolbarColorInputTimer);
      }

      pendingToolbarColorInputTimer = 0;
      pendingToolbarColorInputElement = null;
    }

    function applyToolbarColorInput(colorInputElement) {
      if (!colorInputElement || state.templateEditor.interactionDisabled) {
        return;
      }

      applyToolbarColorTrigger(colorInputElement);
      scheduleTemplateEditorSelectionVisualStateRefresh();
    }

    function scheduleToolbarColorInputApply(colorInputElement) {
      cancelPendingToolbarColorInputApply();
      pendingToolbarColorInputElement = colorInputElement;
      pendingToolbarColorInputTimer = ownerWindow.setTimeout(() => {
        const targetInputElement = pendingToolbarColorInputElement;

        pendingToolbarColorInputTimer = 0;
        pendingToolbarColorInputElement = null;
        applyToolbarColorInput(targetInputElement);
      }, TEMPLATE_EDITOR_COLOR_INPUT_APPLY_DELAY_MS);
    }

    function flushToolbarColorInputApply(colorInputElement) {
      const targetInputElement = pendingToolbarColorInputElement || colorInputElement;

      cancelPendingToolbarColorInputApply();
      applyToolbarColorInput(targetInputElement);
    }

    function saveTemplateEditorSelectionFromToolbarPointer() {
      if (state.templateEditor.suppressToolbarSelectionChange) {
        return;
      }

      saveTemplateEditorSelection();
    }

    function preserveTemplateEditorSelectionForToolbarPointer() {
      saveTemplateEditorSelectionFromToolbarPointer();
      state.templateEditor.suppressToolbarSelectionChange = true;
      scheduleTemplateEditorSelectionVisualStateRefresh();
    }

    function getTemplateEditorToolbarPointerTarget(target) {
      const sizeTrigger = target.closest("[data-template-table-size]");
      const sizeControl = target.closest("[data-template-cell-size-input], [data-template-cell-size-scope]");
      if (sizeTrigger || sizeControl) {
        return { toolbarTrigger: sizeTrigger, toolbarSelectionControl: sizeControl };
      }
      const toolbarTrigger = target.closest(
        "[data-template-command], [data-template-table-action], [data-template-cell-split-step], [data-template-cell-split-toggle], [data-template-cell-split-axis-option], [data-template-cell-split-confirm], [data-template-insert], [data-template-open-image], [data-template-image-insert-toggle], [data-template-insert-school-logo], [data-template-tag], .template-tag-accordion-summary, [data-editor-color-preset], [data-editor-color-apply], [data-editor-color-toggle], [data-editor-color-direct], [data-editor-font-family-toggle], [data-editor-font-family-option], [data-editor-font-size-toggle], [data-editor-font-size-option], [data-template-line-height-toggle], [data-template-line-height-option], [data-editor-border-select-toggle], [data-editor-border-select-option], [data-editor-border-width-toggle], [data-editor-border-width-option], [data-editor-cell-padding-toggle], [data-editor-cell-padding-option]",
      );
      const toolbarSelectionControl = target.closest(
        `#${toolbarIds.fontFamily}, #${toolbarIds.textColor}, #${toolbarIds.textShading}, #${toolbarIds.cellShading}, #${toolbarIds.borderTarget}, #${toolbarIds.borderStyle}, #${toolbarIds.borderWidth}, #${toolbarIds.borderColor}, #${toolbarIds.cellPaddingTop}, #${toolbarIds.cellPaddingRight}, #${toolbarIds.cellPaddingBottom}, #${toolbarIds.cellPaddingLeft}, #${toolbarIds.tableRows}, #${toolbarIds.tableColumns}, #${toolbarIds.cellSplitPanel}, [data-editor-color-hex-input], [data-template-editor-runtime-page-properties] [data-template-page-setting], [data-candidate-block-feature-switch], [data-candidate-block-column-name-row-height-px]`,
      );

      return { toolbarSelectionControl, toolbarTrigger };
    }

    function handleToolbarPointerDownCapture(event) {
      const target = isElement(event.target) ? event.target : null;

      if (!target || !getTemplateEditorModal().contains(target)) {
        return;
      }

      const { toolbarSelectionControl, toolbarTrigger } = getTemplateEditorToolbarPointerTarget(target);

      if (toolbarTrigger && event.defaultPrevented) {
        return;
      }

      if (toolbarTrigger) {
        preserveTemplateEditorSelectionForToolbarPointer();
        event.preventDefault();
        return;
      }

      if (toolbarSelectionControl) {
        preserveTemplateEditorSelectionForToolbarPointer();
      }
    }

    function handlePointerDown(event) {
      const target = isElement(event.target) ? event.target : null;

      if (!target || !getTemplateEditorModal().contains(target)) {
        return;
      }

      const { toolbarSelectionControl, toolbarTrigger } = getTemplateEditorToolbarPointerTarget(target);

      if (toolbarTrigger) {
        preserveTemplateEditorSelectionForToolbarPointer();
        event.preventDefault();
        return;
      }

      if (toolbarSelectionControl) {
        preserveTemplateEditorSelectionForToolbarPointer();
        return;
      }

      if (
        event.button !== 0 ||
        state.templateEditor.imageResizeSession ||
        state.templateEditor.imageMoveSession ||
        state.templateEditor.tableObjectMoveSession ||
        state.templateEditor.tableObjectResizeSession ||
        state.templateEditor.tableResizeSession ||
        state.templateEditor.tableSelectionSession
      ) {
        return;
      }

      const selectedImage = getTemplateEditorImageTarget(target);

      if (selectedImage) {
        event.preventDefault();
        clearTemplateEditorTableObjectSelection();
        clearTemplateEditorTableSelection();
        clearTemplateEditorTableHoverState();
        selectTemplateEditorImage(selectedImage);

        // Pointer default is prevented, so explicitly give arrow keys to the
        // active editor (including a data-block modal) instead of the old field.
        const surface = getTemplateEditorSurface();
        surface?.focus({ preventScroll: true });
        surface?.ownerDocument.defaultView.getSelection()?.removeAllRanges();
        state.templateEditor.savedRange = null;
        state.templateEditor.savedSelectionSnapshot = null;

        startTemplateEditorImageMoveSession(selectedImage, event);

        return;
      }

      if (handleTemplateEditorTableObjectPointerDown(event)) {
        return;
      }

      if (handleTemplateEditorTablePointerDown(event)) {
        clearTemplateEditorTableObjectSelection();
        return;
      }

      if (getTemplateEditorSurface()?.contains(target)) {
        clearTemplateEditorImageSelection();
        clearTemplateEditorTableSelection();
        clearTemplateEditorTableHoverState();
        clearTemplateEditorTableObjectSelection();
      }
    }

    function handleChange(event) {
      if (handleTemplatePageSettingChange(event)) {
        return;
      }

      if (event.target?.matches?.(".template-toolbar-cell-padding-input")) {
        handleTemplateTableAction?.("apply-cell-padding", { preserveToolbarFocus: true });
        scheduleTemplateEditorSelectionVisualStateRefresh();
        return;
      }

      if (event.target === toolbarElements.imageInput) {
        insertTemplateImage(event.target.files?.[0]);
        event.target.value = "";
        return;
      }

      if (event.target === toolbarElements.fontFamily) {
        applyTemplateEditorFontFamily(event.target.value);
        scheduleTemplateEditorSelectionVisualStateRefresh();
        return;
      }

      if (event.target === toolbarElements.fontSize) {
        applyTemplateEditorFontSize(event.target.value);
        scheduleTemplateEditorSelectionVisualStateRefresh();
        return;
      }

      if (event.target?.matches?.(".template-toolbar-color")) {
        flushToolbarColorInputApply(event.target);
        toolbar.closeAllEditorToolbarColorPanels();
        return;
      }

      if (event.target?.matches?.("[data-editor-color-hex-input]")) {
        applyToolbarHexColorInput(event.target, { commit: true });
        scheduleTemplateEditorSelectionVisualStateRefresh();
      }
    }

    function handleInput(event) {
      if (event.target?.matches?.("[data-template-cell-size-input]")) {
        const value = event.target.value;
        if (value && Number.isFinite(Number(value)) && Number(value) >= 24) {
          applyTemplateTableSize({ dimension: event.target.dataset.templateCellSizeInput, preserveToolbarFocus: true });
          scheduleTemplateEditorSelectionVisualStateRefresh();
        }
        return;
      }
      if (event.target?.matches?.(".template-toolbar-border-width")) {
        event.target.dataset.editorBorderUserValue = "true";
      }

      if (event.target?.matches?.(".template-toolbar-cell-padding-input")) {
        handleTemplateTableAction?.("apply-cell-padding", { preserveToolbarFocus: true });
        scheduleTemplateEditorSelectionVisualStateRefresh();
        return;
      }

      if (event.target === toolbarElements.fontSize) {
        toolbar.syncEditorToolbarFontSizeMenuSelection(event.target, event.target.value);
        return;
      }

      if (event.target === getTemplateEditorSurface()) {
        if (isCompositionInputEvent(event)) {
          return;
        }

        if (event.inputType === "deleteContentForward") {
          const selection = ownerWindow.getSelection();
          const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
          const element = range?.startContainer.nodeType === ownerWindow.Node.ELEMENT_NODE
            ? range.startContainer : range?.startContainer.parentElement;
          const token = element?.closest?.(".template-token[contenteditable='false']");
          // Chromium can join paragraphs with the caret inside the tag at
          // offset zero. Put it before the tag so subsequent typing is editable.
          if (range?.collapsed && range.startOffset === 0 && token) {
            range.setStartBefore(token);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }

        syncTemplateEditorContent(
          getTemplateEditorSurface()?.dataset.templateEditorAllowOverflowSync === "true" ? { allowOverflow: true } : undefined,
        );
        return;
      }

      if (event.target?.matches?.(".template-toolbar-color")) {
        scheduleToolbarColorInputApply(event.target);
        return;
      }

      if (event.target?.matches?.("[data-editor-color-hex-input]")) {
        applyToolbarHexColorInput(event.target);
        scheduleTemplateEditorSelectionVisualStateRefresh();
      }
    }

    function handleBeforeInput(event) {
      const inputType = String(event?.inputType || "");

      if (inputType !== "historyUndo" && inputType !== "historyRedo") {
        return;
      }

      const templateEditorSurface = getTemplateEditorSurface();
      const target = isElement(event.target) ? event.target : null;

      if (!templateEditorSurface || (event.target !== templateEditorSurface && !templateEditorSurface.contains(target))) {
        return;
      }

      event.preventDefault();

      if (state.templateEditor.suppressedNativeHistoryInputType === inputType) {
        delete state.templateEditor.suppressedNativeHistoryInputType;
        return;
      }

      if (inputType === "historyRedo") {
        redoTemplateEditorHistory();
        return;
      }

      undoTemplateEditorHistory();
    }

    let composingSurface = null;
    let compositionSyncTimer = 0;

    function cancelCompositionSync() {
      ownerWindow.clearTimeout(compositionSyncTimer);
      compositionSyncTimer = 0;
    }

    function handleCompositionStart(event) {
      if (event.target !== getTemplateEditorSurface()) return;
      cancelCompositionSync();
      composingSurface = event.target;
      state.templateEditor.isComposing = true;
      const anchor = ownerWindow.getSelection?.()?.anchorNode;
      const anchorElement = anchor?.nodeType === 1 ? anchor : anchor?.parentElement;
      const caretHost = anchorElement?.closest?.("[data-template-object-caret-host]");
      // IME owns the caret as soon as composition starts, before normal input sync.
      caretHost?.removeAttribute("data-template-object-caret-host");
      caretHost?.removeAttribute("data-template-object-caret-active");
    }

    function handleCompositionEnd(event) {
      if (event.target !== composingSurface && event.target !== getTemplateEditorSurface()) return;
      const surface = event.target;
      composingSurface = null;
      state.templateEditor.isComposing = false;
      cancelCompositionSync();
      compositionSyncTimer = ownerWindow.setTimeout(() => {
        compositionSyncTimer = 0;
        // A Korean IME may already be composing the next syllable when the
        // previous composition's deferred callback runs. Never replace its DOM.
        if (state.templateEditor.interactionDisabled || state.templateEditor.isComposing || !surface.isConnected || surface !== getTemplateEditorSurface()) return;
        syncTemplateEditorContent(
          surface.dataset.templateEditorAllowOverflowSync === "true" ? { allowOverflow: true } : undefined,
        );
      }, 0);
    }

    function handleSelectionChange() {
      const caretSelection = ownerWindow.getSelection?.();
      const caretAnchor = caretSelection?.anchorNode;
      const caretElement = caretAnchor?.nodeType === 1 ? caretAnchor : caretAnchor?.parentElement;
      const caretHost = !state.templateEditor.isComposing && caretSelection?.isCollapsed
        ? caretElement?.closest?.("[data-template-object-caret-host]") : null;
      shell.surfaceElement?.querySelectorAll?.("[data-template-object-caret-host], [data-template-object-caret-active]").forEach((host) => {
        host.toggleAttribute("data-template-object-caret-active", host === caretHost);
      });
      if (state.templateEditor.isComposing) return;
      const activeElement = isElement(ownerDocument.activeElement) ? ownerDocument.activeElement : null;
      const selection = ownerWindow.getSelection?.();

      const templateEditorSurface = getTemplateEditorSurface();

      if (!selection || selection.rangeCount === 0 || !templateEditorSurface?.contains(selection.anchorNode)) {
        return;
      }

      if (isTemplateEditorToolbarFocusElement(activeElement)) {
        refreshTemplateEditorSelectionVisualState();
        return;
      }

      if (state.templateEditor.suppressToolbarSelectionChange) {
        if (isTemplateEditorSurfaceRootSelection(selection, templateEditorSurface)) {
          refreshTemplateEditorSelectionVisualState();
          return;
        }

        delete state.templateEditor.suppressToolbarSelectionChange;
      }

      globalThis.ExamListTemplateEditorTextEditing?.ensureTemplateTokenCaret(templateEditorSurface);
      saveTemplateEditorSelection();
      updateTemplateEditorActiveCell();
      updateTemplateEditorFormattingControls();
      updateTemplateTableControls();
    }

    function getClipboardSelectedTable(event) {
      const surface = getTemplateEditorSurface();
      const table = state.templateEditor.selectedTableElement;
      const target = isElement(event.target) ? event.target : null;
      const overlay = target?.closest(".template-editor-table-selection");
      const isSelectedTableHandle = overlay?.__templateEditorTableElement === table && Boolean(table);
      if ((target?.closest("input, textarea, select, button") && !isSelectedTableHandle) ||
          !(table instanceof ownerWindow.HTMLTableElement) || !surface?.contains(table)) {
        return null;
      }
      return table;
    }

    function prepareClipboardTable(table) {
      for (const element of [table, ...table.querySelectorAll("*")]) {
        element.removeAttribute("id");
        element.removeAttribute("data-template-object-flow-id");
        element.classList.remove("is-selected-table-object", "is-moving-table-object", "is-active-cell", "is-selected-cell");
      }
      // Placement belongs to the destination. Keep authored table/cell geometry.
      for (const property of ["position", "left", "top", "right", "bottom", "z-index"]) {
        table.style.removeProperty(property);
      }
      return table;
    }

    function handleCopy(event) {
      const selectedTable = getClipboardSelectedTable(event);
      if (!selectedTable || !event.clipboardData) return;
      // With an object selected there may be no DOM text range. Chromium can
      // dispatch copy at body/the previous selection instead of the surface.
      // Only consume that document-level event while this editor owns focus.
      const activeElement = ownerDocument.activeElement;
      if (!shell.surfaceElement.contains(activeElement) &&
          !getTemplateEditorSurface()?.contains(activeElement)) return;
      const table = prepareClipboardTable(selectedTable.cloneNode(true));
      const originals = [selectedTable, ...selectedTable.querySelectorAll("td, th")];
      const copies = [table, ...table.querySelectorAll("td, th")];
      originals.forEach((element, index) => {
        const style = ownerWindow.getComputedStyle(element);
        for (const property of ["font-family", "font-size", "font-weight", "font-style", "color", "line-height", "text-align"]) {
          copies[index].style.setProperty(property, style.getPropertyValue(property));
        }
      });
      table.setAttribute("data-template-table-clipboard", "true");
      event.clipboardData.setData("text/html", globalThis.ExamListDocumentHtmlSanitizer.sanitizeHtml(table.outerHTML, ownerDocument));
      event.clipboardData.setData("text/plain", Array.from(selectedTable.rows)
        .map(row => Array.from(row.cells).map(cell => cell.innerText || cell.textContent || "").join("\t")).join("\n"));
      event.preventDefault();
      getTemplateEditorSurface().dispatchEvent(new ownerWindow.CustomEvent("template-editor-table-copied", { bubbles: true }));
    }

    function handlePaste(event) {
      const surface = getTemplateEditorSurface();
      const target = isElement(event.target) ? event.target : null;
      const selectedTable = getClipboardSelectedTable(event);
      if (!surface || target?.closest("input, textarea, select, button") ||
          (!surface.contains(target) && !selectedTable)) return;
      if (!surface.contains(target) && !shell.surfaceElement.contains(ownerDocument.activeElement)) return;
      const clipboardHtml = event.clipboardData?.getData("text/html") || "";
      // Only intercept whole tables copied by this editor; ordinary text paste
      // continues to use the browser's contenteditable behavior.
      if (clipboardHtml.includes("data-template-table-clipboard")) {
        const template = ownerDocument.createElement("template");
        template.innerHTML = globalThis.ExamListDocumentHtmlSanitizer.sanitizeHtml(clipboardHtml, ownerDocument);
        const table = template.content.querySelector('table[data-template-table-clipboard="true"]');
        if (table) {
          event.preventDefault();
          prepareClipboardTable(table).removeAttribute("data-template-table-clipboard");
          if (selectedTable) {
            const range = ownerDocument.createRange();
            range.setStartAfter(selectedTable);
            range.collapse(true);
            const selection = ownerWindow.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            state.templateEditor.savedRange = range.cloneRange();
            state.templateEditor.savedSelectionSnapshot = null;
          }
          const selection = ownerWindow.getSelection();
          const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
          const root = surface.querySelector(":scope > .template-doc") || surface;
          const blank = root.children.length === 1 ? root.firstElementChild : null;
          if (range?.collapsed && (range.startContainer === root || range.startContainer === surface) &&
              blank?.matches("p") && !blank.textContent.trim() && !blank.querySelector(":not(br)")) {
            range.selectNodeContents(blank);
            range.collapse(true);
            state.templateEditor.savedRange = range.cloneRange();
            state.templateEditor.savedSelectionSnapshot = null;
          }
          clearTemplateEditorTableObjectSelection();
          clearTemplateEditorTableSelection();
          insertTemplateHtml(table.outerHTML, { preserveTablePresentation: true });
          return;
        }
      }
      if (event.target === surface) {
        ownerWindow.setTimeout(() => {
          if (!state.templateEditor.interactionDisabled) syncTemplateEditorContent();
        }, 0);
      }
    }

    function handleDragStart(event) {
      if (getTemplateEditorImageTarget(event.target)) {
        event.preventDefault();
      }
    }

    function closeToolbarPanelsForExternalClick(event) {
      const target = isElement(event.target) ? event.target : null;

      if (target?.closest(".template-toolbar-table-insert-popover")) {
        return;
      }

      if (target?.closest(".template-toolbar-font-size-combo")) {
        return;
      }

      if (target?.closest(".template-toolbar-font-family-combo")) {
        return;
      }

      if (target?.closest(".template-toolbar-color-picker")) {
        return;
      }

      if (target?.closest(".template-toolbar-icon-select")) {
        return;
      }

      if (target?.closest(".template-toolbar-border-width-combo")) {
        return;
      }

      if (target?.closest(".template-toolbar-cell-padding-combo")) {
        return;
      }

      toolbar.closeAllEditorToolbarTableInsertPanels();
      toolbar.closeAllEditorToolbarFontFamilyMenus?.();
      toolbar.closeAllEditorToolbarFontSizeMenus();
      toolbar.closeAllEditorToolbarColorPanels();
      toolbar.closeAllEditorToolbarBorderSelectMenus?.();
      toolbar.closeAllEditorToolbarBorderWidthMenus?.();
      toolbar.closeAllEditorToolbarCellPaddingMenus?.();
    }

    const disposers = [];
    const addListener = (target, type, listener, listenerOptions) => {
      const guardedListener = (event) => {
        if (!state.templateEditor.interactionDisabled) {
          listener(event);
        }
      };
      target.addEventListener(type, guardedListener, listenerOptions);
      disposers.push(() => target.removeEventListener(type, guardedListener, listenerOptions));
    };

    function bindEvents() {
      addListener(getTemplateEditorModal(), "click", handleClick);
      addListener(getTemplateEditorModal(), "pointerdown", handleToolbarPointerDownCapture, true);
      addListener(getTemplateEditorModal(), "pointerdown", handlePointerDown);
      addListener(getTemplateEditorModal(), "keydown", handleKeydown, true);
      addListener(getTemplateEditorModal(), "change", handleChange);
      addListener(getTemplateEditorModal(), "beforeinput", handleBeforeInput);
      addListener(getTemplateEditorModal(), "input", handleInput);
      addListener(getTemplateEditorModal(), "compositionstart", handleCompositionStart, true);
      addListener(getTemplateEditorModal(), "compositionend", handleCompositionEnd, true);
      disposers.push(() => {
        cancelCompositionSync();
        state.templateEditor.isComposing = false;
        composingSurface = null;
      });
      addListener(ownerDocument, "copy", handleCopy, true);
      addListener(getTemplateEditorModal(), "paste", handlePaste);
      addListener(getTemplateEditorModal(), "dragstart", handleDragStart);
      addListener(getTemplateEditorModal(), "pointermove", updateTemplateEditorImageHoverState);
      addListener(getTemplateEditorModal(), "pointermove", updateTemplateEditorTableObjectHoverState);
      addListener(getTemplateEditorModal(), "pointermove", (event) => {
        if (getTemplateEditorSurface()?.contains(event.target)) {
          updateTemplateEditorTableHoverState(event);
        }
      });
      addListener(shell.surfaceElement, "pointerleave", () => {
        clearTemplateEditorImageHoverState();
        clearTemplateEditorTableHoverState();
        clearTemplateEditorTableObjectHoverState();
      });
      addListener(shell.surfaceElement, "template-editor-canvas-zoom-change", () => {
        clearTemplateEditorImageHoverState();
        clearTemplateEditorTableHoverState();
        clearTemplateEditorTableObjectHoverState();
      });
      addListener(shell.surfaceElement, "scroll", () => {
        clearTemplateEditorImageHoverState();
        clearTemplateEditorTableHoverState();
        clearTemplateEditorTableObjectHoverState();
        updateTemplateEditorImageSelectionOverlay();
        updateTemplateEditorTableObjectOverlay();
      });
      addListener(ownerDocument, "selectionchange", handleSelectionChange);
      addListener(ownerDocument, "click", closeToolbarPanelsForExternalClick, true);
      addListener(ownerWindow, "resize", () => {
        clearTemplateEditorImageHoverState();
        updateTemplateEditorImageSelectionOverlay();
        updateTemplateEditorTableObjectOverlay();
      });
    }

    function unbindEvents() {
      cancelPendingToolbarColorInputApply();
      disposers.splice(0).forEach((dispose) => dispose());
    }

    return Object.freeze({
      bindEvents,
      unbindEvents,
    });
  }

  return Object.freeze({
    createTemplateEditorEventController,
  });
});

})();
