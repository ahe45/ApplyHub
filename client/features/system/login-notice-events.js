(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory({
      toolbarControlsModule: require("../editor/toolbar-controls"),
    });
    return;
  }

  globalScope.AdmitCardLoginNoticeEvents = factory({
    toolbarControlsModule: globalScope.AdmitCardEditorToolbarControls,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, ({ toolbarControlsModule }) => {
  if (!toolbarControlsModule) {
    throw new Error("client/features/editor/toolbar-controls.js must be loaded before login-notice-events.js.");
  }

  const { focusEditorToolbarNumberInput, stepEditorToolbarNumberInput } = toolbarControlsModule;

  function createLoginNoticeEventHandlers({
    applyLoginNoticeEditorCommand,
    captureLoginNoticeEditorSelection,
    clearLoginNoticeSelectedImage,
    getLoginNoticeCellSplitConfig,
    getLoginNoticeCellSplitCountInputElement,
    getLoginNoticeCellSplitPanelElement,
    getLoginNoticeEditorElement,
    getLoginNoticeImageInputElement,
    handleLoginNoticeAction,
    handleLoginNoticeInsert,
    handleLoginNoticeTableAction,
    insertLoginNoticeImage,
    redoLoginNoticeEditorHistory,
    renderView,
    selectLoginNoticeImage,
    setNoticeManagementScope,
    setLoginNoticeCellSplitPanelVisibility,
    setLoginNoticeTableInsertPanelVisibility,
    state,
    syncEditorToolbarFontSizeMenuSelection,
    syncLoginNoticeEditorDraft,
    undoLoginNoticeEditorHistory,
    updateLoginNoticeEditorActiveCell,
    updateLoginNoticeFormattingControls,
  }) {
    function isLoginNoticeViewActive() {
      return state.currentView === "loginNoticeSettings";
    }

    function activateNoticeCanvas(target) {
      const canvas = target?.closest?.('[data-notice-canvas]');
      const language = canvas?.dataset.noticeCanvas;
      if (!language || language === state.noticeManagement.activeLanguage) return;
      syncLoginNoticeEditorDraft();
      clearLoginNoticeSelectedImage?.();
      setNoticeManagementScope(state.noticeManagement.activeScope, language);
      document.querySelectorAll('[data-notice-canvas]').forEach(element => {
        element.classList.toggle('is-active', element === canvas);
      });
      const activeLabel = document.querySelector('[data-notice-active-label]');
      if (activeLabel) activeLabel.textContent = `${language === 'en' ? '영어' : '한국어'} 서식 편집`;
      setLoginNoticeTableInsertPanelVisibility(false);
      setLoginNoticeCellSplitPanelVisibility(false);
      updateLoginNoticeFormattingControls();
    }

    function handleFocusIn(event) {
      if (isLoginNoticeViewActive()) activateNoticeCanvas(event.target);
    }

    async function handleClick(event) {
      if (!isLoginNoticeViewActive()) {
        return false;
      }

      activateNoticeCanvas(event.target);
      const noticeEditor = getLoginNoticeEditorElement?.();
      const noticeEditorImage = event.target.closest("[data-notice-editor-language] img");
      const noticeEditorLink = event.target.closest("[data-notice-editor-language] a[href]");
      const noticeScopeTrigger = event.target.closest("[data-notice-scope]");
      const noticeCommandTrigger = event.target.closest(".login-notice-editor-shell button[data-notice-command]");
      const noticeActionTrigger = event.target.closest(".login-notice-editor-shell button[data-notice-action]");
      const noticeInsertTrigger = event.target.closest(".login-notice-editor-shell button[data-notice-insert]");
      const noticeTableActionTrigger = event.target.closest(".login-notice-editor-shell button[data-notice-table-action]");
      const noticeCellSplitStepTrigger = event.target.closest(".login-notice-editor-shell [data-template-cell-split-step]");
      const noticeCellSplitToggleTrigger = event.target.closest(".login-notice-editor-shell [data-template-cell-split-toggle]");
      const noticeCellSplitConfirmTrigger = event.target.closest(".login-notice-editor-shell [data-template-cell-split-confirm]");
      const noticeOpenImageTrigger = event.target.closest(".login-notice-editor-shell button[data-notice-open-image]");

      if (noticeEditorImage && noticeEditor?.contains(noticeEditorImage)) {
        event.preventDefault();
        selectLoginNoticeImage?.(noticeEditorImage);
        captureLoginNoticeEditorSelection();
        updateLoginNoticeEditorActiveCell();
        updateLoginNoticeFormattingControls();
        return true;
      }

      if (noticeEditorLink && noticeEditor?.contains(noticeEditorLink)) {
        clearLoginNoticeSelectedImage?.();
        event.preventDefault();
        return true;
      }

      if (noticeEditor && event.target instanceof Node && noticeEditor.contains(event.target)) {
        clearLoginNoticeSelectedImage?.();
      }

      if (noticeScopeTrigger) {
        syncLoginNoticeEditorDraft();
        setNoticeManagementScope?.(noticeScopeTrigger.dataset.noticeScope);
        renderView?.();
        return true;
      }

      if (noticeCellSplitStepTrigger) {
        const splitCountInput = getLoginNoticeCellSplitCountInputElement?.();

        if (!splitCountInput) {
          return true;
        }

        stepEditorToolbarNumberInput({
          inputElement: splitCountInput,
          direction: noticeCellSplitStepTrigger.dataset.templateCellSplitStep,
          minimum: 2,
        });
        focusEditorToolbarNumberInput(splitCountInput);
        return true;
      }

      if (noticeCellSplitToggleTrigger) {
        const splitPanel = getLoginNoticeCellSplitPanelElement?.();
        const splitCountInput = getLoginNoticeCellSplitCountInputElement?.();
        const nextOpen = splitPanel?.classList.contains("hidden") ?? true;

        setLoginNoticeCellSplitPanelVisibility(nextOpen);

        if (nextOpen) {
          focusEditorToolbarNumberInput(splitCountInput);
        }

        return true;
      }

      if (noticeCellSplitConfirmTrigger) {
        const cellSplitConfig = getLoginNoticeCellSplitConfig?.();

        if (!cellSplitConfig) {
          return true;
        }

        if (handleLoginNoticeTableAction("split-cell", cellSplitConfig)) {
          setLoginNoticeCellSplitPanelVisibility(false);
        }

        return true;
      }

      if (noticeCommandTrigger) {
        applyLoginNoticeEditorCommand(noticeCommandTrigger.dataset.noticeCommand);
        return true;
      }

      if (noticeActionTrigger) {
        await handleLoginNoticeAction(noticeActionTrigger.dataset.noticeAction);
        return true;
      }

      if (noticeInsertTrigger) {
        handleLoginNoticeInsert(noticeInsertTrigger.dataset.noticeInsert);
        return true;
      }

      if (noticeTableActionTrigger) {
        handleLoginNoticeTableAction(noticeTableActionTrigger.dataset.noticeTableAction);
        return true;
      }

      if (noticeOpenImageTrigger) {
        setLoginNoticeCellSplitPanelVisibility(false);
        setLoginNoticeTableInsertPanelVisibility(false);
        getLoginNoticeImageInputElement?.()?.click();
        return true;
      }

      return false;
    }

    function handlePointerDown(event) {
      if (!isLoginNoticeViewActive()) {
        return false;
      }

      activateNoticeCanvas(event.target);
      const noticeToolbarTrigger = event.target.closest(
        ".login-notice-editor-shell button[data-notice-command], .login-notice-editor-shell button[data-notice-action], .login-notice-editor-shell button[data-notice-insert], .login-notice-editor-shell button[data-notice-table-action], .login-notice-editor-shell button[data-notice-open-image], .login-notice-editor-shell [data-template-cell-split-step], .login-notice-editor-shell [data-template-cell-split-toggle], .login-notice-editor-shell [data-template-cell-split-confirm], .login-notice-editor-shell button[data-editor-color-preset], .login-notice-editor-shell button[data-editor-color-apply], .login-notice-editor-shell button[data-editor-color-toggle], .login-notice-editor-shell button[data-editor-color-direct]",
      );
      const noticeFontSizeTrigger = event.target.closest(
        ".login-notice-editor-shell [data-editor-font-size-toggle], .login-notice-editor-shell [data-editor-font-size-option]",
      );
      const noticeToolbarSelectionControl = event.target.closest(
        "#loginNoticeFontFamily, #loginNoticeFontSize, #loginNoticeTextColor, #loginNoticeTextShading, #loginNoticeCellShading, #loginNoticeBorderTarget, #loginNoticeBorderStyle, #loginNoticeBorderWidth, #loginNoticeBorderColor, #loginNoticeTableRows, #loginNoticeTableColumns, #loginNoticeCellSplitPanel",
      );

      if (noticeToolbarTrigger || noticeFontSizeTrigger) {
        captureLoginNoticeEditorSelection();
        event.preventDefault();
        return true;
      }

      if (noticeToolbarSelectionControl) {
        captureLoginNoticeEditorSelection();
        return true;
      }

      return false;
    }

    function handleKeydown(event) {
      if (!isLoginNoticeViewActive()) {
        return false;
      }

      activateNoticeCanvas(event.target);
      const loginNoticeEditor = getLoginNoticeEditorElement?.();
      const loginNoticeTableInsertPanel = document.getElementById("loginNoticeTableInsertPanel");
      const loginNoticeCellSplitPanel = getLoginNoticeCellSplitPanelElement?.();
      const isLoginNoticeShortcutTarget =
        state.currentView === "loginNoticeSettings" &&
        loginNoticeEditor &&
        (event.target === loginNoticeEditor || loginNoticeEditor.contains(event.target));
      const isModifierPressed = event.ctrlKey || event.metaKey;
      const normalizedKey = String(event.key || "").toLowerCase();
      const isLoginNoticeTableInsertField = event.target?.id === "loginNoticeTableRows" || event.target?.id === "loginNoticeTableColumns";
      const isLoginNoticeCellSplitField = event.target?.id === "loginNoticeCellSplitCount";
      const isLoginNoticeFontSizeField = event.target?.id === "loginNoticeFontSize";

      if (isLoginNoticeShortcutTarget && isModifierPressed && !event.altKey) {
        if (normalizedKey === "z" && event.shiftKey) {
          event.preventDefault();
          redoLoginNoticeEditorHistory();
          return true;
        }

        if (normalizedKey === "z") {
          event.preventDefault();
          undoLoginNoticeEditorHistory();
          return true;
        }

        if (normalizedKey === "y") {
          event.preventDefault();
          redoLoginNoticeEditorHistory();
          return true;
        }
      }

      if (
        isLoginNoticeTableInsertField &&
        event.key === "Enter" &&
        loginNoticeTableInsertPanel &&
        !loginNoticeTableInsertPanel.classList.contains("hidden")
      ) {
        event.preventDefault();
        handleLoginNoticeInsert("table-confirm");
        return true;
      }

      if (
        isLoginNoticeCellSplitField &&
        event.key === "Enter" &&
        loginNoticeCellSplitPanel &&
        !loginNoticeCellSplitPanel.classList.contains("hidden")
      ) {
        event.preventDefault();
        const cellSplitConfig = getLoginNoticeCellSplitConfig?.();

        if (cellSplitConfig && handleLoginNoticeTableAction("split-cell", cellSplitConfig)) {
          setLoginNoticeCellSplitPanelVisibility(false);
        }

        return true;
      }

      if (isLoginNoticeFontSizeField && event.key === "Enter") {
        event.preventDefault();
        applyLoginNoticeEditorCommand("fontSizePx", event.target.value);
        return true;
      }

      return false;
    }

    async function handleChange(event) {
      if (!isLoginNoticeViewActive()) {
        return false;
      }

      const noticeCommandSelect = event.target.matches("select[data-notice-command]") ? event.target : null;

      if (event.target.id === "loginNoticeImageInput") {
        insertLoginNoticeImage(event.target.files?.[0]);
        event.target.value = "";
        return true;
      }

      if (event.target.id === "loginNoticeFontSize") {
        if (!event.target.value) {
          return true;
        }

        applyLoginNoticeEditorCommand("fontSizePx", event.target.value);
        return true;
      }

      if (noticeCommandSelect) {
        if (!noticeCommandSelect.value) {
          return true;
        }

        applyLoginNoticeEditorCommand(noticeCommandSelect.dataset.noticeCommand, noticeCommandSelect.value);
        return true;
      }

      return false;
    }

    function handleInput(event) {
      if (!isLoginNoticeViewActive()) {
        return false;
      }

      activateNoticeCanvas(event.target);
      const loginNoticeEditor = getLoginNoticeEditorElement?.();

      if (loginNoticeEditor && (event.target === loginNoticeEditor || loginNoticeEditor.contains(event.target))) {
        captureLoginNoticeEditorSelection();
        syncLoginNoticeEditorDraft();
        return true;
      }

      if (event.target.matches('input[data-notice-command="foreColor"], input[data-notice-command="hiliteColor"]')) {
        applyLoginNoticeEditorCommand(event.target.dataset.noticeCommand, event.target.value);
        return true;
      }

      if (event.target.id === "loginNoticeFontSize") {
        syncEditorToolbarFontSizeMenuSelection(event.target, event.target.value);
        return true;
      }

      return false;
    }

    function handleSelectionChange() {
      if (!isLoginNoticeViewActive()) {
        return false;
      }

      const selection = window.getSelection();
      const anchorNode = selection?.anchorNode || null;
      const baseElement =
        anchorNode?.nodeType === Node.ELEMENT_NODE ? anchorNode : anchorNode?.parentElement instanceof Element ? anchorNode.parentElement : null;
      activateNoticeCanvas(baseElement);
      const noticeEditor = getLoginNoticeEditorElement?.();

      const selectionImage =
        (baseElement instanceof Element ? baseElement.closest("img") || baseElement.querySelector("img") : null) || null;

      if (!baseElement || !noticeEditor?.contains(baseElement) || !selectionImage) {
        clearLoginNoticeSelectedImage?.();
      }

      captureLoginNoticeEditorSelection();
      updateLoginNoticeEditorActiveCell();
      updateLoginNoticeFormattingControls();
      return true;
    }

    function handlePaste(event) {
      if (!isLoginNoticeViewActive()) {
        return false;
      }

      const loginNoticeEditor = getLoginNoticeEditorElement?.();

      if (loginNoticeEditor && (event.target === loginNoticeEditor || loginNoticeEditor.contains(event.target))) {
        window.setTimeout(() => {
          captureLoginNoticeEditorSelection();
          syncLoginNoticeEditorDraft();
        }, 0);
        return true;
      }

      return false;
    }

    return Object.freeze({
      handleFocusIn,
      handleChange,
      handleClick,
      handleInput,
      handleKeydown,
      handlePaste,
      handlePointerDown,
      handleSelectionChange,
    });
  }

  return Object.freeze({
    createLoginNoticeEventHandlers,
  });
});
