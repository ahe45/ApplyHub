(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalScope);
    return;
  }

  globalScope.ExamListTemplateEditorRuntimeFactory = factory(globalScope);
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  const runtimeComposition =
    typeof module === "object" && module.exports && typeof require === "function"
      ? require("./template-editor-runtime-composition")
      : globalScope.ExamListTemplateEditorRuntimeComposition;

  if (!runtimeComposition) {
    throw new Error("client/template-editor-runtime/template-editor-runtime-composition.js must be loaded before template-editor-runtime-factory.js.");
  }

  const { createTemplateEditorRuntimeApiAndInitialize } = runtimeComposition;

  function buildDefaultTemplateEditorPhotoUrl(record = {}, context = {}) {
    const photoUrl = String(record?.photoUrl || record?.candidate?.photoUrl || "").trim();

    if (photoUrl) {
      return photoUrl;
    }

    const previewPhotoPath = String(context?.previewPhotoPath || "").trim();

    return previewPhotoPath && (record?.useTemplatePreviewPhoto || record?.hasPhoto) ? previewPhotoPath : "";
  }

  function createTemplateEditorRuntimeFactory({
    core,
    runtimeApi,
    runtimeContext,
    runtimeHandlerAccessorsModule,
    runtimeHelpers,
    runtimeWiring,
  }) {
    const {
      DEFAULT_HISTORY_LIMIT,
      DEFAULT_IMAGE_MIN_SIZE,
      TABLE_EDGE_THRESHOLD,
      TABLE_SELECTION_DRAG_THRESHOLD,
      createTemplateEditorRuntimeHandlerCaller,
      createTemplateEditorRuntimeHandlerRegistry,
      createTemplateEditorRuntimeToolbarElementAccessors,
    } = runtimeWiring;
    const { createTemplateEditorRuntimeContext } = runtimeContext;
    const { createTemplateEditorRuntimePublicApi } = runtimeApi;
    const {
      createTemplateEditorRuntimeChangeNotifier,
      createTemplateEditorRuntimeDefaultHandlers,
      createTemplateEditorRuntimeDomAccessors,
      createTemplateGeneratedObjectRuntimeController,
      initializeTemplateEditorRuntime,
    } = runtimeHelpers;
    const { createTemplateEditorRuntimeHandlerAccessors } = runtimeHandlerAccessorsModule;
    const { escapeAttribute, escapeHtml, resolveElement } = core;
    let instanceCounter = 0;

    return function createTemplateEditor(options = {}) {
      const {
        buildApiUrl,
        deps,
        getPreviewData,
        getTemplatePreviewDate,
        ownerDocument,
        ownerWindow,
        shell,
        state,
        tagDefinitions,
        toolbarIds,
      } = createTemplateEditorRuntimeContext({
        core,
        instanceId: ++instanceCounter,
        options,
      });

      const {
        TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
        TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
        TEMPLATE_EDITOR_DEFAULT_TABLE_HEADER_BACKGROUND,
        buildTemplateEditorTableMarkup,
        normalizeTemplateEditorColorValue,
        normalizeTemplateEditorFontNodes,
      } = deps.content;
      const {
        TEMPLATE_EDITOR_TABLE_MIN_SIZE,
        applyTemplateTableCellPresentation,
        buildTemplateTableCellMap,
        ensureTemplateEditorTableColGroup,
        getTemplateEditorMeasuredColumnWidth,
        getTemplateEditorTableColumnCount,
        normalizeTemplateEditorTableAppearance,
        normalizeTemplateEditorTables,
        parseTemplateEditorPixelStyle,
        syncTemplateEditorTableWidth,
      } = deps.tableUtils;
      const generatedObjectController = createTemplateGeneratedObjectRuntimeController({
        buildApiUrl,
        deps,
        options,
      });
      const {
        applyTemplateRenderedObjects,
        buildTemplateGeneratedObjectMarkup,
        decorateTemplateGeneratedObjectImage,
      } = generatedObjectController;
      const toolbar = deps.toolbar;
      const toolbarElements = {};
      const getElementById = (id) => ownerDocument.getElementById(id);
      const runtimeHandlers = createTemplateEditorRuntimeHandlerRegistry(createTemplateEditorRuntimeDefaultHandlers());
      const callRuntimeHandler = createTemplateEditorRuntimeHandlerCaller(runtimeHandlers);
      const toolbarAccessors = createTemplateEditorRuntimeToolbarElementAccessors(toolbarElements);
      const {
        appendMergedTemplateCellContent,
        applyTemplateTableSize,
        clearTemplateEditorImageHoverState,
        clearTemplateEditorImageSelection,
        clearTemplateEditorTableHoverState,
        clearTemplateEditorTableObjectHoverState,
        clearTemplateEditorTableObjectSelection,
        clearTemplateEditorTableSelection,
        createTemplateTableCell,
        decorateTemplateEditorImages,
        focusTemplateEditorCell,
        getTemplateEditorActiveTableSelection,
        getTemplateEditorCellShadingValue,
        getTemplateEditorFormattingTargetCells,
        getTemplateEditorImageTarget,
        getTemplateEditorMedianValue,
        getTemplateEditorPixelValue,
        getTemplateEditorSelectedCell,
        getTemplateEditorSelectedTable,
        getTemplateEditorTableLogicalColumnWidth,
        getTemplateEditorTableLogicalRowHeight,
        handleTemplateEditorImageResizeStart,
        handleTemplateEditorTableObjectPointerDown,
        handleTemplateEditorTablePointerDown,
        handleTemplatePageSettingChange,
        handleTemplateTableAction,
        insertTemplateCellAtAbsoluteColumn,
        isTemplateEditorTableObjectElement,
        isTemplateTableCellEmpty,
        nudgeSelectedTemplateEditorImage,
        nudgeSelectedTemplateEditorTableObject,
        releaseTemplateEditorImageMoveSession,
        releaseTemplateEditorImageResizeSession,
        releaseTemplateEditorTableObjectMoveSession,
        releaseTemplateEditorTableObjectResizeSession,
        releaseTemplateEditorTableResizeSession,
        releaseTemplateEditorTableSelectionSession,
        replaceTemplateEditorTableWithCaretHost,
        selectTemplateEditorImage,
        setTemplateEditorTableLogicalRowHeight,
        startTemplateEditorImageMoveSession,
        syncTemplatePageSettingsFromDocument,
        updateTemplateEditorFormattingControls,
        updateTemplateEditorImageHoverState,
        updateTemplateEditorImageSelectionOverlay,
        updateTemplateEditorTableHoverState,
        updateTemplateEditorTableObjectHoverState,
        updateTemplateEditorTableObjectOverlay,
        updateTemplateTableControls,
      } = createTemplateEditorRuntimeHandlerAccessors(callRuntimeHandler);

      const {
        getTemplateEditorModal,
        getTemplateEditorStatusElement,
        getTemplateEditorSurface,
        setFallbackStatus,
      } = createTemplateEditorRuntimeDomAccessors({
        ownerDocument,
        shell,
      });

      const selectionController = deps.selection.createTemplateEditorSelectionController({
        TEMPLATE_EDITOR_HISTORY_LIMIT: options.historyLimit || DEFAULT_HISTORY_LIMIT,
        clearTemplateEditorImageSelection: (...args) => clearTemplateEditorImageSelection(...args),
        clearTemplateEditorTableSelection: (...args) => clearTemplateEditorTableSelection(...args),
        decorateTemplateEditorImages: (...args) => decorateTemplateEditorImages(...args),
        focusTemplateEditorCell: (...args) => focusTemplateEditorCell(...args),
        getTemplateEditorActiveTableSelection: (...args) => getTemplateEditorActiveTableSelection(...args),
        getTemplateEditorModal,
        getTemplateEditorSelectedCell: (...args) => getTemplateEditorSelectedCell(...args),
        getTemplateEditorStatusElement,
        getTemplateEditorTagDisplay: options.getTemplateEditorTagDisplay,
        getTemplateEditorSurface,
        normalizeTemplateEditorFontNodes,
        normalizeTemplateEditorTables,
        releaseTemplateEditorTableResizeSession: (...args) => releaseTemplateEditorTableResizeSession(...args),
        releaseTemplateEditorTableSelectionSession: (...args) => releaseTemplateEditorTableSelectionSession(...args),
        state,
        templateTagDefinitions: tagDefinitions,
        updateTemplateEditorFormattingControls: (...args) => updateTemplateEditorFormattingControls(...args),
        updateTemplateEditorImageSelectionOverlay: (...args) => updateTemplateEditorImageSelectionOverlay(...args),
        updateTemplateTableControls: (...args) => updateTemplateTableControls(...args),
      });
      const {
        buildTemplateTokenHtml,
        clearTemplateEditorActiveCell,
        escapeAttribute: escapeEditorAttribute,
        escapeHtml: escapeEditorHtml,
        getClosestTemplateEditorElement,
        getTemplateEditorSelectionNode,
        getTemplateEditorSerializedHtml,
        getTemplateEditorTagText,
        handleTemplateEditorTokenDeletion,
        initializeTemplateEditorHistory,
        normalizeTemplateTag,
        normalizeTemplateTagNodes,
        prepareTemplateEditorContent,
        restoreTemplateEditorSelection,
        saveTemplateEditorSelection,
        setTemplateEditorStatus,
        stripTemplateEditorTransientState,
        syncTemplateEditorContent: baseSyncTemplateEditorContent,
        updateTemplateEditorActiveCell,
      } = selectionController;

      let api = null;
      const { notifyChange, setLastNotifiedHtml } = createTemplateEditorRuntimeChangeNotifier({
        getApi: () => api,
        getSerializedHtml: getTemplateEditorSerializedHtml,
        onChange: options.onChange,
        state,
      });

      function getCandidateBlockModalEditorController() {
        return (
          state.templateEditor.candidateBlockModalEditorController ||
          globalScope.ExamListCandidateBlockModalEditor ||
          ownerWindow.ExamListCandidateBlockModalEditor ||
          null
        );
      }

      function serializeTemplateEditorDocumentSurface() {
        const modalEditorController = getCandidateBlockModalEditorController();

        if (typeof modalEditorController?.withDocumentSurface === "function") {
          return modalEditorController.withDocumentSurface(() => getTemplateEditorSerializedHtml());
        }

        return getTemplateEditorSerializedHtml();
      }

      function syncTemplateEditorContent(optionsForSync = {}) {
        if (state.templateEditor.isComposing) return;
        const modalEditorController = getCandidateBlockModalEditorController();
        const modalSurfaceElement = modalEditorController?.getActiveSurface?.() || null;
        const syncOptions = modalSurfaceElement instanceof HTMLElement
          ? { ...optionsForSync, allowOverflow: true }
          : optionsForSync;

        baseSyncTemplateEditorContent(syncOptions);
        updateTemplateEditorTableObjectOverlay();
        if (modalEditorController?.syncActiveEditor?.() === true) {
          const serializedHtml = serializeTemplateEditorDocumentSurface();

          state.templateEditor.draftHtml = serializedHtml;
          state.templateEditor.lastValidHtml = serializedHtml;
        }
        notifyChange();
      }

      function undoTemplateEditorHistory() {
        selectionController.undoTemplateEditorHistory();
        notifyChange();
      }

      function redoTemplateEditorHistory() {
        selectionController.redoTemplateEditorHistory();
        notifyChange();
      }

      const previewController = deps.preview.createTemplatePreviewController({
        TEMPLATE_PREVIEW_PHOTO_PATH: options.previewPhotoPath || "",
        applyTemplateRenderedObjects,
        buildApiUrl,
        buildSharedExamineePhotoUrl:
          typeof options.buildPhotoUrl === "function"
            ? (record, context) => options.buildPhotoUrl(record, context)
            : buildDefaultTemplateEditorPhotoUrl,
        escapeAttribute: escapeEditorAttribute,
        escapeHtml: escapeEditorHtml,
        getTemplateEditorTagText,
        getTemplatePreviewDate,
        normalizeTemplateEditorFontNodes,
        normalizeTemplateTag,
        normalizeTemplateTagNodes,
        state,
        stripTemplateEditorTransientState,
        templateTagDefinitions: tagDefinitions,
      });

      const {
        getTemplatePreviewExaminee: getDefaultTemplatePreviewExaminee,
        renderTemplateWithExaminee,
      } = previewController;
      const getTemplatePreviewExaminee = () => ({
        ...getDefaultTemplatePreviewExaminee(),
        ...getPreviewData(),
      });

      const runtimeController = deps.runtime.createTemplateEditorRuntimeController({
        EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR: toolbar.EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR || "#000000",
        TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
        TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
        applySharedEditorCommand: toolbar.applySharedEditorCommand,
        applySharedEditorFontFamily: toolbar.applySharedEditorFontFamily,
        applySharedEditorFontSize: toolbar.applySharedEditorFontSize,
        applyTemplateEditorTableSelectionCommand: (...args) => applyTemplateEditorTableSelectionCommand(...args),
        applyTemplateEditorTableSelectionFontFamily: (...args) => applyTemplateEditorTableSelectionFontFamily(...args),
        applyTemplateEditorTableSelectionFontSize: (...args) => applyTemplateEditorTableSelectionFontSize(...args),
        getTemplateEditorBlockTypeElement: toolbarAccessors.getBlockTypeElement,
        getTemplateEditorFontFamilyElement: toolbarAccessors.getFontFamilyElement,
        getTemplateEditorFontSizeElement: toolbarAccessors.getFontSizeElement,
        getTemplateEditorSurface,
        getTemplateEditorTextColorElement: toolbarAccessors.getTextColorElement,
        getTemplateEditorTextShadingElement: toolbarAccessors.getTextShadingElement,
        redoTemplateEditorHistory,
        restoreTemplateEditorSelection,
        saveTemplateEditorSelection,
        setTemplateEditorStatus: (...args) => {
          setTemplateEditorStatus(...args);
          setFallbackStatus(...args);
        },
        syncTemplateEditorContent,
        state,
        undoTemplateEditorHistory,
        updateTemplateEditorActiveCell,
      });
      const {
        applyTemplateEditorCommand,
        applyTemplateEditorFontFamily,
        applyTemplateEditorFontSize,
        getTemplateEditorDocumentElement,
        getTemplateEditorImageOverlayContainer,
        placeCaretAtEnd,
      } = runtimeController;

      const commandController = deps.commands.createTemplateEditorCommandController({
        buildTemplateEditorTableMarkup,
        buildTemplateGeneratedObjectMarkup,
        buildTemplateTokenHtml,
        escapeAttribute: escapeEditorAttribute,
        getTemplateEditorCellSplitCountInput: toolbarAccessors.getCellSplitCountElement,
        getTemplateEditorCellSplitPanel: toolbarAccessors.getCellSplitPanelElement,
        getTemplateEditorSurface,
        getTemplateEditorTableColumnsInput: toolbarAccessors.getTableColumnsElement,
        getTemplateEditorTableInsertPanel: toolbarAccessors.getTableInsertPanelElement,
        getTemplateEditorTableRowsInput: toolbarAccessors.getTableRowsElement,
        getTemplatePreviewExaminee,
        placeCaretAtEnd,
        restoreTemplateEditorSelection,
        setEditorToolbarTableInsertPanelVisibility: toolbar.setEditorToolbarTableInsertPanelVisibility,
        setTemplateEditorStatus,
        state,
        syncTemplateEditorContent,
      });
      const {
        getTemplateEditorCellSplitConfig,
        handleTemplateEditorInsert,
        insertTemplateHtml,
        insertTemplateImage,
        insertTemplateImageSource,
        insertTemplateTag,
        setTemplateEditorCellSplitPanelVisibility,
        setTemplateEditorTableInsertPanelVisibility,
      } = commandController;

      const imageController = deps.imageTools.createTemplateEditorImageController({
        TEMPLATE_EDITOR_IMAGE_MIN_SIZE: options.imageMinSize || DEFAULT_IMAGE_MIN_SIZE,
        clearTemplateEditorActiveCell,
        decorateTemplateGeneratedObjectImage,
        getTemplateEditorDocumentElement,
        getTemplateEditorImageOverlayContainer,
        getTemplateEditorModal,
        getTemplateEditorSurface,
        getTemplatePreviewExaminee,
        parseTemplateEditorPixelStyle,
        state,
        syncTemplateEditorContent,
      });
      runtimeHandlers.assign(imageController);

      const tableController = deps.tableTools.createTemplateEditorTableController({
        TEMPLATE_EDITOR_DEFAULT_TABLE_HEADER_BACKGROUND,
        TEMPLATE_EDITOR_TABLE_EDGE_THRESHOLD: TABLE_EDGE_THRESHOLD,
        TEMPLATE_EDITOR_TABLE_MIN_SIZE,
        TEMPLATE_EDITOR_TABLE_SELECTION_DRAG_THRESHOLD: TABLE_SELECTION_DRAG_THRESHOLD,
        applyTemplateTableCellPresentation,
        buildTemplateTableCellMap,
        clearTemplateEditorImageSelection,
        ensureTemplateEditorTableColGroup,
        getClosestTemplateEditorElement,
        getTemplateEditorDocumentElement,
        getTemplateEditorSelectionNode,
        getTemplateEditorSurface,
        getTemplateEditorModal,
        getTemplateEditorBorderColorInput: toolbarAccessors.getBorderColorElement,
        getTemplateEditorBorderStyleInput: toolbarAccessors.getBorderStyleElement,
        getTemplateEditorBorderTargetInput: toolbarAccessors.getBorderTargetElement,
        getTemplateEditorBorderWidthInput: toolbarAccessors.getBorderWidthElement,
        getTemplateEditorCellPaddingBottomInput: toolbarAccessors.getCellPaddingBottomElement,
        getTemplateEditorCellPaddingLeftInput: toolbarAccessors.getCellPaddingLeftElement,
        getTemplateEditorCellPaddingRightInput: toolbarAccessors.getCellPaddingRightElement,
        getTemplateEditorCellPaddingTopInput: toolbarAccessors.getCellPaddingTopElement,
        getTemplateEditorCellShadingInput: toolbarAccessors.getCellShadingElement,
        getTemplateEditorCellWidthInput: toolbarAccessors.getCellWidthElement,
        getTemplateEditorRowHeightInput: toolbarAccessors.getRowHeightElement,
        getTemplateEditorSizeScopeInput: toolbarAccessors.getSizeScopeElement,
        getTemplateEditorMeasuredColumnWidth,
        getTemplateEditorTableColumnCount,
        normalizeTemplateEditorColorValue,
        normalizeTemplateEditorTableAppearance,
        parseTemplateEditorPixelStyle,
        placeCaretAtEnd,
        restoreTemplateEditorSelection,
        setTemplateEditorStatus,
        state,
        syncTemplateEditorContent,
        syncTemplateEditorTableWidth,
        updateTemplateEditorActiveCell,
        updateTemplateEditorFormattingControls: (...args) => updateTemplateEditorFormattingControls(...args),
        updateTemplateTableControls: (...args) => updateTemplateTableControls(...args),
      });
      runtimeHandlers.assign(tableController);

      const toolbarStateController = deps.toolbarState.createTemplateEditorToolbarStateController({
        TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
        TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
        getTemplateEditorActiveTableSelection,
        getTemplateEditorBorderColorElement: toolbarAccessors.getBorderColorElement,
        getTemplateEditorBorderStyleElement: toolbarAccessors.getBorderStyleElement,
        getTemplateEditorBorderTargetElement: toolbarAccessors.getBorderTargetElement,
        getTemplateEditorBorderWidthElement: toolbarAccessors.getBorderWidthElement,
        getTemplateEditorCellPaddingBottomElement: toolbarAccessors.getCellPaddingBottomElement,
        getTemplateEditorCellPaddingLeftElement: toolbarAccessors.getCellPaddingLeftElement,
        getTemplateEditorCellPaddingRightElement: toolbarAccessors.getCellPaddingRightElement,
        getTemplateEditorCellPaddingTopElement: toolbarAccessors.getCellPaddingTopElement,
        getTemplateEditorCellShadingElement: toolbarAccessors.getCellShadingElement,
        getTemplateEditorCellShadingValue,
        getTemplateEditorCellWidthElement: toolbarAccessors.getCellWidthElement,
        getTemplateEditorFontFamilyElement: toolbarAccessors.getFontFamilyElement,
        getTemplateEditorFontSizeElement: toolbarAccessors.getFontSizeElement,
        getTemplateEditorModal,
        getTemplateEditorPixelValue,
        getTemplateEditorRowHeightElement: toolbarAccessors.getRowHeightElement,
        getTemplateEditorSelectedCell,
        getTemplateEditorSelectionNode,
        getTemplateEditorSurface,
        getTemplateEditorTextColorElement: toolbarAccessors.getTextColorElement,
        getTemplateEditorTextShadingElement: toolbarAccessors.getTextShadingElement,
        syncEditorToolbarBorderSelectControl: toolbar.syncEditorToolbarBorderSelectControl,
        syncEditorToolbarBorderWidthControl: toolbar.syncEditorToolbarBorderWidthControl,
        syncEditorToolbarCellPaddingControl: toolbar.syncEditorToolbarCellPaddingControl,
        syncEditorToolbarColorControls: toolbar.syncEditorToolbarColorControls,
        updateEditorToolbarFormattingState: toolbar.updateEditorToolbarFormattingState,
      });
      runtimeHandlers.assign(toolbarStateController);
      const pagePropertiesController = deps.pageSettings.createTemplatePagePropertiesController({
        getPagePropertiesElement: () => shell.pagePropertiesHost || null,
        getTemplateEditorSurface,
        setTemplateEditorStatus,
        syncTemplateEditorContent,
        updateTemplateEditorImageSelectionOverlay: (...args) => updateTemplateEditorImageSelectionOverlay(...args),
      });
      runtimeHandlers.assign(pagePropertiesController);

      const tableFormattingController = deps.tableFormatting.createTemplateEditorTableFormattingController({
        getTemplateEditorFormattingTargetCells,
        isTemplateTableCellEmpty,
        syncTemplateEditorContent,
      });
      const {
        applyTemplateEditorTableSelectionCommand,
        applyTemplateEditorTableSelectionFontFamily,
        applyTemplateEditorTableSelectionFontSize,
      } = tableFormattingController;

      const tableObjectController = deps.tableObject.createTemplateEditorTableObjectController({
        TABLE_EDGE_THRESHOLD,
        TEMPLATE_EDITOR_TABLE_MIN_SIZE,
        buildTemplateTableCellMap,
        clearTemplateEditorActiveCell,
        clearTemplateEditorImageSelection,
        clearTemplateEditorTableSelection: (...args) => clearTemplateEditorTableSelection(...args),
        ensureTemplateEditorTableColGroup,
        getTemplateEditorDocumentElement,
        getTemplateEditorImageOverlayContainer,
        getTemplateEditorMeasuredColumnWidth,
        getTemplateEditorModal,
        ownerDocument,
        ownerWindow,
        parseTemplateEditorPixelStyle,
        placeCaretAtEnd,
        shell,
        state,
        syncTemplateEditorContent,
        syncTemplateEditorTableWidth,
        updateTemplateEditorFormattingControls: (...args) => updateTemplateEditorFormattingControls(...args),
        updateTemplateTableControls: (...args) => updateTemplateTableControls(...args),
      });
      runtimeHandlers.assign(tableObjectController);

      const toolbarInteractionController = deps.toolbarInteractions.createTemplateEditorToolbarInteractionController({
        TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
        TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
        applyTemplateEditorCommand,
        applyTemplateEditorFontFamily,
        applyTemplateEditorFontSize,
        applyTemplateTableSize,
        escapeAttribute,
        escapeHtml,
        getElementById,
        getTemplateEditorCellSplitConfig,
        getTemplateEditorModal,
        handleTemplateEditorInsert,
        handleTemplateTableAction,
        insertTemplateImageSource,
        insertTemplateTag,
        options,
        pageSettings: deps.pageSettings,
        setTemplateEditorCellSplitPanelVisibility,
        setTemplateEditorStatus,
        shell,
        tagDefinitions,
        toolbar,
        toolbarElements,
        toolbarIds,
      });
      const {
        applyToolbarColorTrigger,
        applyToolbarHexColorInput,
        handleClick,
      } = toolbarInteractionController;

      const keyboardController = deps.keyboard.createTemplateEditorKeyboardController({
        applyTemplateEditorFontSize,
        applyToolbarHexColorInput,
        buildTemplateTableCellMap,
        clearTemplateEditorImageSelection,
        clearTemplateEditorTableObjectSelection,
        clearTemplateEditorTableSelection,
        focusTemplateEditorCell,
        getTemplateEditorCellSplitConfig,
        getTemplateEditorActiveTableSelection,
        getTemplateEditorSelectedCell,
        getTemplateEditorSurface,
        handleTemplateEditorInsert,
        handleTemplateEditorTokenDeletion,
        handleTemplateTableAction,
        isTemplateEditorTableObjectElement,
        nudgeSelectedTemplateEditorImage,
        nudgeSelectedTemplateEditorTableObject,
        ownerDocument,
        ownerWindow,
        releaseTemplateEditorImageMoveSession,
        releaseTemplateEditorImageResizeSession,
        releaseTemplateEditorTableObjectMoveSession,
        releaseTemplateEditorTableObjectResizeSession,
        releaseTemplateEditorTableResizeSession,
        releaseTemplateEditorTableSelectionSession,
        redoTemplateEditorHistory,
        replaceTemplateEditorTableWithCaretHost,
        setTemplateEditorCellSplitPanelVisibility,
        shell,
        state,
        syncTemplateEditorContent,
        toolbar,
        toolbarElements,
        undoTemplateEditorHistory,
        updateTemplateEditorTableObjectOverlay,
      });
      const { handleKeydown } = keyboardController;

      const documentApiController = deps.documentApi.createTemplateEditorDocumentApiController({
        clearTemplateEditorImageSelection,
        clearTemplateEditorTableObjectHoverState,
        clearTemplateEditorTableObjectSelection,
        clearTemplateEditorTableSelection,
        decorateTemplateEditorImages,
        getApi: () => api,
        getPreviewData,
        getTemplateEditorSerializedHtml,
        getTemplatePreviewExaminee,
        initializeTemplateEditorHistory,
        normalizeTemplateEditorTables,
        onChange: options.onChange,
        onSetHtml: options.onSetHtml,
        ownerDocument,
        pageSettings: deps.pageSettings,
        placeCaretAtEnd,
        prepareTemplateEditorContent,
        renderTemplateWithExaminee,
        resolveElement,
        setLastNotifiedHtml,
        shell,
        state,
        syncTemplateEditorContent,
        syncTemplatePageSettingsFromDocument,
        updateTemplateEditorActiveCell,
        updateTemplateEditorFormattingControls,
        updateTemplateTableControls,
      });

      const eventController = deps.events.createTemplateEditorEventController({
        applyTemplateTableSize,
        applyTemplateEditorFontFamily,
        applyTemplateEditorFontSize,
        applyToolbarColorTrigger,
        applyToolbarHexColorInput,
        clearTemplateEditorImageHoverState,
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
        redoTemplateEditorHistory,
        undoTemplateEditorHistory,
        updateTemplateEditorActiveCell,
        updateTemplateEditorFormattingControls,
        updateTemplateEditorImageHoverState,
        updateTemplateEditorImageSelectionOverlay,
        updateTemplateEditorTableHoverState,
        updateTemplateEditorTableObjectHoverState,
        updateTemplateEditorTableObjectOverlay,
        updateTemplateTableControls,
      });
      api = createTemplateEditorRuntimeApiAndInitialize({
        apiHandlers: {
          clearTemplateEditorActiveCell,
          clearTemplateEditorImageHoverState,
          clearTemplateEditorImageSelection,
          clearTemplateEditorTableHoverState,
          clearTemplateEditorTableObjectHoverState,
          clearTemplateEditorTableObjectSelection,
          clearTemplateEditorTableSelection,
          handleTemplateEditorImageResizeStart,
          ownerWindow,
          releaseTemplateEditorImageMoveSession,
          releaseTemplateEditorImageResizeSession,
          releaseTemplateEditorTableObjectMoveSession,
          releaseTemplateEditorTableObjectResizeSession,
          releaseTemplateEditorTableResizeSession,
          releaseTemplateEditorTableSelectionSession,
          updateTemplateEditorImageSelectionOverlay,
          updateTemplateEditorFormattingControls,
          updateTemplateEditorTableObjectOverlay,
          updateTemplateTableControls,
        },
        commandController,
        createTemplateEditorRuntimePublicApi,
        documentApiController,
        eventController,
        initialHtml: options.initialHtml || "",
        initializeTemplateEditorRuntime,
        runtimeActions: {
          applyTemplateEditorCommand,
          redoTemplateEditorHistory,
          syncTemplateEditorContent,
          undoTemplateEditorHistory,
        },
        setFallbackStatus,
        state,
        toolbarInteractionController,
      });

      return api;
    };
  }

  return Object.freeze({
    createTemplateEditorRuntimeFactory,
  });
});

})();
