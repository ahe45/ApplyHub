(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalScope);
    return;
  }

  globalScope.AdmitCardTemplateEditorKit = factory(globalScope);
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  const DEFAULT_HISTORY_LIMIT = 120;
  const DEFAULT_IMAGE_MIN_SIZE = 32;
  const TABLE_EDGE_THRESHOLD = 8;
  const TABLE_SELECTION_DRAG_THRESHOLD = 6;
  let instanceCounter = 0;

  function createTemplateEditorState(overrides = {}) {
    return {
      activeTemplateId: "",
      name: "",
      description: "",
      version: "",
      draftHtml: "",
      lastValidHtml: "",
      hasOverflow: false,
      savedRange: null,
      historyEntries: [],
      historyIndex: -1,
      isRestoringHistory: false,
      statusMessage: "A4 세로 영역 안에서 편집 중입니다.",
      statusType: "",
      selectedImageElement: null,
      tableSelection: null,
      tableSelectionSession: null,
      tableResizeSession: null,
      imageMoveSession: null,
      imageResizeSession: null,
      ...overrides,
    };
  }

  function createTemplatePreviewState(overrides = {}) {
    return {
      activeTemplateId: "",
      renderedHtml: "",
      examineeLabel: "",
      examineeNo: "",
      ...overrides,
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll('"', "&quot;");
  }

  function formatDateAsYmd(date = new Date()) {
    const parsedDate = date instanceof Date ? date : new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "";
    }

    const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
    const day = String(parsedDate.getDate()).padStart(2, "0");
    return `${parsedDate.getFullYear()}-${month}-${day}`;
  }

  function resolveElement(elementOrSelector, documentRef = document) {
    if (typeof elementOrSelector === "string") {
      return documentRef.querySelector(elementOrSelector);
    }

    return elementOrSelector?.nodeType === 1 ? elementOrSelector : null;
  }

  function uniqueValues(values = []) {
    return Array.from(new Set(values.filter((value) => String(value || "").trim()).map((value) => String(value).trim())));
  }

  function normalizeTemplateTagDefinition(rawDefinition = {}) {
    const label = String(rawDefinition.label || rawDefinition.name || rawDefinition.id || rawDefinition.dataKey || rawDefinition.key || "")
      .trim();

    if (!label && !rawDefinition.token) {
      return null;
    }

    const dataKey = String(
      rawDefinition.examineeKey ||
        rawDefinition.dataKey ||
        rawDefinition.sourceKey ||
        rawDefinition.key ||
        rawDefinition.id ||
        label,
    ).trim();
    const token = String(rawDefinition.token || `@{${label}}`).trim();
    const displayLabel = label || token.replace(/^@\{/, "").replace(/\}$/, "");
    const aliases = uniqueValues([displayLabel, ...(Array.isArray(rawDefinition.aliases) ? rawDefinition.aliases : [])]);

    return Object.freeze({
      ...rawDefinition,
      label: displayLabel,
      dataKey,
      sourceKey: dataKey,
      examineeKey: dataKey,
      token,
      legacyTag: rawDefinition.legacyTag || `@${displayLabel}`,
      editorToken: rawDefinition.editorToken || `#${displayLabel}`,
      aliases: Object.freeze(aliases),
      editorTokens: Object.freeze(
        Array.isArray(rawDefinition.editorTokens) && rawDefinition.editorTokens.length > 0
          ? rawDefinition.editorTokens
          : aliases.map((alias) => `#${alias}`),
      ),
      legacyTokens: Object.freeze(Array.isArray(rawDefinition.legacyTokens) ? rawDefinition.legacyTokens : []),
      legacyTags: Object.freeze(Array.isArray(rawDefinition.legacyTags) ? rawDefinition.legacyTags : []),
    });
  }

  function normalizeTemplateTagDefinitions(rawDefinitions = []) {
    return Object.freeze(
      (Array.isArray(rawDefinitions) ? rawDefinitions : [])
        .map((definition) => normalizeTemplateTagDefinition(definition))
        .filter(Boolean),
    );
  }

  function getDefaultTagDefinitions() {
    return normalizeTemplateTagDefinitions(globalScope.AdmitCardAppConfig?.templateTagDefinitions || []);
  }

  function getRequiredDependency(value, name) {
    if (!value) {
      throw new Error(`${name} is required. Load the template editor kit manifest scripts in order first.`);
    }

    return value;
  }

  function getDependencies() {
    return Object.freeze({
      content: getRequiredDependency(globalScope.AdmitCardEditorContentShared, "AdmitCardEditorContentShared"),
      generatedObjects: getRequiredDependency(globalScope.AdmitCardTemplateGeneratedObjects, "AdmitCardTemplateGeneratedObjects"),
      imageTools: getRequiredDependency(globalScope.AdmitCardTemplateEditorImageTools, "AdmitCardTemplateEditorImageTools"),
      pageSettings: getRequiredDependency(globalScope.AdmitCardTemplateEditorPageSettings, "AdmitCardTemplateEditorPageSettings"),
      commands: getRequiredDependency(globalScope.AdmitCardTemplateEditorCommands, "AdmitCardTemplateEditorCommands"),
      preview: getRequiredDependency(globalScope.AdmitCardTemplateEditorPreview, "AdmitCardTemplateEditorPreview"),
      runtime: getRequiredDependency(globalScope.AdmitCardTemplateEditorRuntime, "AdmitCardTemplateEditorRuntime"),
      selection: getRequiredDependency(globalScope.AdmitCardTemplateEditorSelection, "AdmitCardTemplateEditorSelection"),
      tableFormatting: getRequiredDependency(globalScope.AdmitCardTemplateEditorTableFormatting, "AdmitCardTemplateEditorTableFormatting"),
      tableTools: getRequiredDependency(globalScope.AdmitCardTemplateEditorTableTools, "AdmitCardTemplateEditorTableTools"),
      tableUtils: getRequiredDependency(globalScope.AdmitCardEditorTableUtils, "AdmitCardEditorTableUtils"),
      toolbar: getRequiredDependency(globalScope.AdmitCardEditorToolbar, "AdmitCardEditorToolbar"),
      toolbarState: getRequiredDependency(globalScope.AdmitCardTemplateEditorToolbarState, "AdmitCardTemplateEditorToolbarState"),
    });
  }

  function createToolbarIds(prefix) {
    return Object.freeze({
      blockType: `${prefix}BlockType`,
      borderColor: `${prefix}BorderColor`,
      borderStyle: `${prefix}BorderStyle`,
      borderTarget: `${prefix}BorderTarget`,
      borderWidth: `${prefix}BorderWidth`,
      cellSplitAxisColumn: `${prefix}CellSplitAxisColumn`,
      cellSplitAxisName: `${prefix}CellSplitAxis`,
      cellSplitAxisRow: `${prefix}CellSplitAxisRow`,
      cellSplitCount: `${prefix}CellSplitCount`,
      cellSplitPanel: `${prefix}CellSplitPanel`,
      cellShading: `${prefix}CellShading`,
      cellWidth: `${prefix}CellWidth`,
      fontFamily: `${prefix}FontFamily`,
      fontSize: `${prefix}FontSize`,
      imageInput: `${prefix}ImageInput`,
      pageMarginBottom: `${prefix}PageMarginBottom`,
      pageMarginLeft: `${prefix}PageMarginLeft`,
      pageMarginRight: `${prefix}PageMarginRight`,
      pageMarginTop: `${prefix}PageMarginTop`,
      pageOrientationLandscape: `${prefix}PageOrientationLandscape`,
      pageOrientationName: `${prefix}PageOrientation`,
      pageOrientationPortrait: `${prefix}PageOrientationPortrait`,
      pageSize: `${prefix}PageSize`,
      rowHeight: `${prefix}RowHeight`,
      sizeScope: `${prefix}SizeScope`,
      tableColumns: `${prefix}TableColumns`,
      tableInsertPanel: `${prefix}TableInsertPanel`,
      tableRows: `${prefix}TableRows`,
      textColor: `${prefix}TextColor`,
      textShading: `${prefix}TextShading`,
    });
  }

  function createShell({
    rootElement,
    toolbarHost,
    surfaceElement,
    tagHost,
    pagePropertiesHost,
    statusElement,
  }) {
    if (!rootElement && (!toolbarHost || !surfaceElement)) {
      throw new Error("createTemplateEditor requires root, or both toolbarHost and surface.");
    }

    if (rootElement && (!toolbarHost || !surfaceElement)) {
      rootElement.classList.add("template-editor-kit");
      rootElement.innerHTML = `
        <div class="template-editor-kit-shell">
          <div class="editor-toolbar-column">
            <div class="editor-toolbar" data-template-editor-kit-toolbar role="toolbar" aria-label="편집 도구"></div>
          </div>
          <aside class="template-tag-panel" data-template-editor-kit-tag-panel>
            <p class="template-tag-caption">데이터 태그</p>
            <div class="template-tag-strip" data-template-editor-kit-tags></div>
          </aside>
          <div class="template-editor-page">
            <div class="template-editor-surface" data-template-editor-kit-surface contenteditable="true"></div>
          </div>
          <aside class="template-page-properties-panel" data-template-editor-kit-page-properties aria-label="페이지 속성"></aside>
        </div>
        <div class="template-editor-kit-status" data-template-editor-kit-status></div>
      `;
    }

    const resolvedToolbarHost = toolbarHost || rootElement.querySelector("[data-template-editor-kit-toolbar]");
    const resolvedSurfaceElement = surfaceElement || rootElement.querySelector("[data-template-editor-kit-surface]");
    const resolvedTagHost = tagHost || rootElement?.querySelector("[data-template-editor-kit-tags]") || null;
    const resolvedPagePropertiesHost =
      pagePropertiesHost || rootElement?.querySelector("[data-template-editor-kit-page-properties]") || null;
    const resolvedStatusElement = statusElement || rootElement?.querySelector("[data-template-editor-kit-status]") || null;

    if (!resolvedToolbarHost || !resolvedSurfaceElement) {
      throw new Error("Template editor toolbarHost and surface elements are required.");
    }

    resolvedSurfaceElement.setAttribute("contenteditable", "true");
    return Object.freeze({
      rootElement,
      pagePropertiesHost: resolvedPagePropertiesHost,
      toolbarHost: resolvedToolbarHost,
      surfaceElement: resolvedSurfaceElement,
      tagHost: resolvedTagHost,
      statusElement: resolvedStatusElement,
    });
  }

  function createTemplateEditor(options = {}) {
    const deps = getDependencies();
    const documentRef = options.document || document;
    const rootElement = resolveElement(options.root, documentRef);
    const shell = createShell({
      rootElement,
      toolbarHost: resolveElement(options.toolbarHost, documentRef),
      surfaceElement: resolveElement(options.surface, documentRef),
      tagHost: resolveElement(options.tagHost, documentRef),
      pagePropertiesHost: resolveElement(options.pagePropertiesHost, documentRef),
      statusElement: resolveElement(options.statusElement, documentRef),
    });
    const ownerDocument = shell.surfaceElement.ownerDocument || documentRef;
    const ownerWindow = ownerDocument.defaultView || window;
    const instancePrefix = String(options.idPrefix || `templateEditorKit${++instanceCounter}`);
    const toolbarIds = createToolbarIds(instancePrefix);
    const tagDefinitions = normalizeTemplateTagDefinitions(options.tags || getDefaultTagDefinitions());
    const buildApiUrl = typeof options.buildApiUrl === "function" ? options.buildApiUrl : (path) => String(path || "");
    const getTemplatePreviewDate =
      typeof options.getPreviewDate === "function" ? options.getPreviewDate : () => formatDateAsYmd(new Date());
    const getPreviewData = () => {
      const baseData =
        typeof options.getPreviewData === "function"
          ? options.getPreviewData()
          : options.previewData && typeof options.previewData === "object"
            ? options.previewData
            : {};

      return {
        currentDate: getTemplatePreviewDate(),
        ...baseData,
      };
    };
    const state = options.state || {
      templateEditor: createTemplateEditorState(),
      templatePreview: createTemplatePreviewState(),
    };

    if (!state.templateEditor) {
      state.templateEditor = createTemplateEditorState();
    }

    if (!state.templatePreview) {
      state.templatePreview = createTemplatePreviewState();
    }

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
    const generatedObjectController =
      typeof deps.generatedObjects.createTemplateGeneratedObjectController === "function"
        ? deps.generatedObjects.createTemplateGeneratedObjectController({
            buildApiUrl,
            getObjectValue: options.getGeneratedObjectValue,
            objectSourceKey: options.generatedObjectSourceKey || "examineeNo",
          })
        : deps.generatedObjects;
    const {
      applyTemplateRenderedObjects,
      buildTemplateGeneratedObjectMarkup,
      decorateTemplateGeneratedObjectImage,
    } = generatedObjectController;
    const toolbar = deps.toolbar;
    const toolbarElements = {};
    const getElementById = (id) => ownerDocument.getElementById(id);

    let appendMergedTemplateCellContent = () => {};
    let applyTemplateTableSize = () => {};
    let clearTemplateEditorImageSelection = () => {};
    let clearTemplateEditorTableHoverState = () => {};
    let clearTemplateEditorTableSelection = () => {};
    let createTemplateTableCell = () => null;
    let decorateTemplateEditorImages = () => {};
    let focusTemplateEditorCell = () => {};
    let getTemplateEditorActiveTableSelection = () => null;
    let getTemplateEditorCellShadingValue = () => "";
    let getTemplateEditorImageTarget = () => null;
    let getTemplateEditorFormattingTargetCells = () => [];
    let getTemplateEditorMedianValue = () => "";
    let getTemplateEditorPixelValue = () => "";
    let getTemplateEditorSelectedCell = () => null;
    let getTemplateEditorSelectedTable = () => null;
    let getTemplateEditorTableLogicalColumnWidth = () => "";
    let getTemplateEditorTableLogicalRowHeight = () => "";
    let handleTemplateEditorTablePointerDown = () => false;
    let handleTemplatePageSettingChange = () => false;
    let handleTemplateTableAction = () => {};
    let insertTemplateCellAtAbsoluteColumn = () => {};
    let isTemplateTableCellEmpty = () => true;
    let releaseTemplateEditorImageMoveSession = () => {};
    let releaseTemplateEditorImageResizeSession = () => {};
    let releaseTemplateEditorTableResizeSession = () => {};
    let releaseTemplateEditorTableSelectionSession = () => {};
    let selectTemplateEditorImage = () => {};
    let setTemplateEditorTableLogicalRowHeight = () => {};
    let startTemplateEditorImageMoveSession = () => {};
    let syncTemplatePageSettingsFromDocument = () => {};
    let updateTemplateEditorFormattingControls = () => {};
    let updateTemplateEditorImageSelectionOverlay = () => {};
    let updateTemplateEditorTableHoverState = () => {};
    let updateTemplateTableControls = () => {};

    const getTemplateEditorModal = () => shell.rootElement || shell.surfaceElement.closest(".template-editor-kit") || ownerDocument.body;
    const getTemplateEditorSurface = () => shell.surfaceElement;
    const getTemplateEditorStatusElement = () => shell.statusElement;

    function setFallbackStatus(message = "", type = "") {
      if (!shell.statusElement) {
        return;
      }

      shell.statusElement.textContent = String(message || "");
      shell.statusElement.classList.toggle("warning", type === "warning");
    }

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

    let lastNotifiedHtml = "";
    let api = null;

    function notifyChange() {
      const nextHtml = state.templateEditor.draftHtml || getTemplateEditorSerializedHtml();

      if (nextHtml === lastNotifiedHtml) {
        return;
      }

      lastNotifiedHtml = nextHtml;
      options.onChange?.(nextHtml, api);
    }

    function syncTemplateEditorContent(optionsForSync = {}) {
      baseSyncTemplateEditorContent(optionsForSync);
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
          : (record) => String(record?.photoUrl || ""),
      escapeAttribute: escapeEditorAttribute,
      escapeHtml: escapeEditorHtml,
      getTemplateEditorTagText,
      getTemplatePreviewDate,
      normalizeTemplateEditorFontNodes,
      normalizeTemplateTag,
      normalizeTemplateTagNodes,
      recordExamineePrint: options.recordPrint || (() => {}),
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
      EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR: toolbar.EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR || "#152033",
      TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
      TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
      applySharedEditorCommand: toolbar.applySharedEditorCommand,
      applySharedEditorFontFamily: toolbar.applySharedEditorFontFamily,
      applySharedEditorFontSize: toolbar.applySharedEditorFontSize,
      applyTemplateEditorTableSelectionCommand: (...args) => applyTemplateEditorTableSelectionCommand(...args),
      applyTemplateEditorTableSelectionFontFamily: (...args) => applyTemplateEditorTableSelectionFontFamily(...args),
      applyTemplateEditorTableSelectionFontSize: (...args) => applyTemplateEditorTableSelectionFontSize(...args),
      getTemplateEditorBlockTypeElement: () => toolbarElements.blockType || null,
      getTemplateEditorFontFamilyElement: () => toolbarElements.fontFamily || null,
      getTemplateEditorFontSizeElement: () => toolbarElements.fontSize || null,
      getTemplateEditorSurface,
      getTemplateEditorTextColorElement: () => toolbarElements.textColor || null,
      getTemplateEditorTextShadingElement: () => toolbarElements.textShading || null,
      redoTemplateEditorHistory,
      restoreTemplateEditorSelection,
      saveTemplateEditorSelection,
      setTemplateEditorStatus: (...args) => {
        setTemplateEditorStatus(...args);
        setFallbackStatus(...args);
      },
      syncTemplateEditorContent,
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
      getTemplateEditorCellSplitCountInput: () => toolbarElements.cellSplitCount || null,
      getTemplateEditorCellSplitPanel: () => toolbarElements.cellSplitPanel || null,
      getTemplateEditorSurface,
      getTemplateEditorTableColumnsInput: () => toolbarElements.tableColumns || null,
      getTemplateEditorTableInsertPanel: () => toolbarElements.tableInsertPanel || null,
      getTemplateEditorTableRowsInput: () => toolbarElements.tableRows || null,
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

    ({
      clearTemplateEditorImageSelection,
      decorateTemplateEditorImages,
      getTemplateEditorImageTarget,
      releaseTemplateEditorImageMoveSession,
      releaseTemplateEditorImageResizeSession,
      selectTemplateEditorImage,
      startTemplateEditorImageMoveSession,
      updateTemplateEditorImageSelectionOverlay,
    } = imageController);

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
      getTemplateEditorBorderColorInput: () => toolbarElements.borderColor || null,
      getTemplateEditorBorderStyleInput: () => toolbarElements.borderStyle || null,
      getTemplateEditorBorderTargetInput: () => toolbarElements.borderTarget || null,
      getTemplateEditorBorderWidthInput: () => toolbarElements.borderWidth || null,
      getTemplateEditorCellShadingInput: () => toolbarElements.cellShading || null,
      getTemplateEditorCellWidthInput: () => toolbarElements.cellWidth || null,
      getTemplateEditorRowHeightInput: () => toolbarElements.rowHeight || null,
      getTemplateEditorSizeScopeInput: () => toolbarElements.sizeScope || null,
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

    ({
      appendMergedTemplateCellContent,
      applyTemplateTableSize,
      clearTemplateEditorTableHoverState,
      clearTemplateEditorTableSelection,
      createTemplateTableCell,
      focusTemplateEditorCell,
      getTemplateEditorActiveTableSelection,
      getTemplateEditorCellShadingValue,
      getTemplateEditorMedianValue,
      getTemplateEditorPixelValue,
      getTemplateEditorSelectedCell,
      getTemplateEditorSelectedTable,
      getTemplateEditorTableLogicalColumnWidth,
      getTemplateEditorTableLogicalRowHeight,
      handleTemplateEditorTablePointerDown,
      handleTemplateTableAction,
      insertTemplateCellAtAbsoluteColumn,
      isTemplateTableCellEmpty,
      releaseTemplateEditorTableResizeSession,
      releaseTemplateEditorTableSelectionSession,
      setTemplateEditorTableLogicalRowHeight,
      updateTemplateEditorTableHoverState,
    } = tableController);

    const toolbarStateController = deps.toolbarState.createTemplateEditorToolbarStateController({
      TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
      TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
      getTemplateEditorActiveTableSelection,
      getTemplateEditorBorderColorElement: () => toolbarElements.borderColor || null,
      getTemplateEditorBorderStyleElement: () => toolbarElements.borderStyle || null,
      getTemplateEditorBorderTargetElement: () => toolbarElements.borderTarget || null,
      getTemplateEditorBorderWidthElement: () => toolbarElements.borderWidth || null,
      getTemplateEditorCellShadingElement: () => toolbarElements.cellShading || null,
      getTemplateEditorCellShadingValue,
      getTemplateEditorCellWidthElement: () => toolbarElements.cellWidth || null,
      getTemplateEditorFontFamilyElement: () => toolbarElements.fontFamily || null,
      getTemplateEditorFontSizeElement: () => toolbarElements.fontSize || null,
      getTemplateEditorModal,
      getTemplateEditorPixelValue,
      getTemplateEditorRowHeightElement: () => toolbarElements.rowHeight || null,
      getTemplateEditorSelectedCell,
      getTemplateEditorSelectionNode,
      getTemplateEditorSurface,
      getTemplateEditorTextColorElement: () => toolbarElements.textColor || null,
      getTemplateEditorTextShadingElement: () => toolbarElements.textShading || null,
      syncEditorToolbarBorderSelectControl: toolbar.syncEditorToolbarBorderSelectControl,
      syncEditorToolbarColorControls: toolbar.syncEditorToolbarColorControls,
      updateEditorToolbarFormattingState: toolbar.updateEditorToolbarFormattingState,
    });
    ({ getTemplateEditorFormattingTargetCells } = toolbarStateController);
    ({
      updateTemplateEditorFormattingControls,
      updateTemplateTableControls,
    } = toolbarStateController);
    const pagePropertiesController = deps.pageSettings.createTemplatePagePropertiesController({
      getPagePropertiesElement: () => shell.pagePropertiesHost || null,
      getTemplateEditorSurface,
      setTemplateEditorStatus,
      syncTemplateEditorContent,
      updateTemplateEditorImageSelectionOverlay: (...args) => updateTemplateEditorImageSelectionOverlay(...args),
    });
    ({
      handleTemplatePageSettingChange,
      syncTemplatePageSettingsFromDocument,
    } = pagePropertiesController);

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

    function refreshToolbarElements() {
      Object.assign(toolbarElements, {
        blockType: getElementById(toolbarIds.blockType),
        borderColor: getElementById(toolbarIds.borderColor),
        borderStyle: getElementById(toolbarIds.borderStyle),
        borderTarget: getElementById(toolbarIds.borderTarget),
        borderWidth: getElementById(toolbarIds.borderWidth),
        cellSplitCount: getElementById(toolbarIds.cellSplitCount),
        cellSplitPanel: getElementById(toolbarIds.cellSplitPanel),
        cellShading: getElementById(toolbarIds.cellShading),
        cellWidth: getElementById(toolbarIds.cellWidth),
        fontFamily: getElementById(toolbarIds.fontFamily),
        fontSize: getElementById(toolbarIds.fontSize),
        imageInput: getElementById(toolbarIds.imageInput),
        rowHeight: getElementById(toolbarIds.rowHeight),
        sizeScope: getElementById(toolbarIds.sizeScope),
        tableColumns: getElementById(toolbarIds.tableColumns),
        tableInsertPanel: getElementById(toolbarIds.tableInsertPanel),
        tableRows: getElementById(toolbarIds.tableRows),
        textColor: getElementById(toolbarIds.textColor),
        textShading: getElementById(toolbarIds.textShading),
      });
    }

    function renderToolbar() {
      shell.toolbarHost.innerHTML = toolbar.renderEditorToolbarInner({
        commandAttr: "data-template-command",
        tableActionAttr: "data-template-table-action",
        insertAttr: "data-template-insert",
        openImageAttr: "data-template-open-image",
        tableInsertLocation: "table-add-section",
        tableLayout: "notice",
        fontFamilyId: toolbarIds.fontFamily,
        fontFamilyValue: TEMPLATE_EDITOR_DEFAULT_FONT_FAMILY,
        fontSizeId: toolbarIds.fontSize,
        fontSizeValue: TEMPLATE_EDITOR_DEFAULT_FONT_SIZE,
        textColorId: toolbarIds.textColor,
        textColorValue: toolbar.EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR || "#152033",
        textShadingId: toolbarIds.textShading,
        cellShadingId: toolbarIds.cellShading,
        tableInsertPanelId: toolbarIds.tableInsertPanel,
        tableRowsId: toolbarIds.tableRows,
        tableColumnsId: toolbarIds.tableColumns,
        cellSplitPanelId: toolbarIds.cellSplitPanel,
        cellSplitCountId: toolbarIds.cellSplitCount,
        cellSplitAxisName: toolbarIds.cellSplitAxisName,
        cellSplitAxisRowId: toolbarIds.cellSplitAxisRow,
        cellSplitAxisColumnId: toolbarIds.cellSplitAxisColumn,
        borderTargetId: toolbarIds.borderTarget,
        borderStyleId: toolbarIds.borderStyle,
        borderWidthId: toolbarIds.borderWidth,
        borderColorId: toolbarIds.borderColor,
        imageInputId: toolbarIds.imageInput,
      });
      refreshToolbarElements();
    }

    function renderTagPanel() {
      if (!shell.tagHost) {
        return;
      }

      shell.tagHost.innerHTML = tagDefinitions
        .map((definition) => {
          const editorToken = String(definition.editorToken || definition.token || "").trim();

          if (!editorToken) {
            return "";
          }

          return `<button class="template-tag-button" data-template-tag="${escapeAttribute(editorToken)}" type="button">${escapeHtml(
            editorToken,
          )}</button>`;
        })
        .join("");
    }

    function renderPagePropertiesPanel() {
      if (!shell.pagePropertiesHost) {
        return;
      }

      shell.pagePropertiesHost.innerHTML = deps.pageSettings.renderTemplatePagePropertiesPanel({
        ids: {
          size: toolbarIds.pageSize,
          orientationName: toolbarIds.pageOrientationName,
          orientationPortrait: toolbarIds.pageOrientationPortrait,
          orientationLandscape: toolbarIds.pageOrientationLandscape,
          marginTop: toolbarIds.pageMarginTop,
          marginRight: toolbarIds.pageMarginRight,
          marginBottom: toolbarIds.pageMarginBottom,
          marginLeft: toolbarIds.pageMarginLeft,
        },
      });
    }

    function setHtml(html = "", { resetHistory = true, notify = false } = {}) {
      const preparedHtml = prepareTemplateEditorContent(html);
      state.templateEditor.draftHtml = preparedHtml;
      state.templateEditor.lastValidHtml = preparedHtml;
      shell.surfaceElement.innerHTML = preparedHtml;
      syncTemplatePageSettingsFromDocument();
      decorateTemplateEditorImages(shell.surfaceElement);
      clearTemplateEditorImageSelection();
      clearTemplateEditorTableSelection();
      placeCaretAtEnd(shell.surfaceElement);

      if (resetHistory) {
        initializeTemplateEditorHistory();
      }

      updateTemplateEditorActiveCell();
      updateTemplateEditorFormattingControls();
      updateTemplateTableControls();
      lastNotifiedHtml = getTemplateEditorSerializedHtml();

      if (notify) {
        options.onChange?.(lastNotifiedHtml, api);
      }
    }

    function getHtml() {
      syncTemplateEditorContent();
      return state.templateEditor.draftHtml || getTemplateEditorSerializedHtml();
    }

    function render(data = getPreviewData(), html = getHtml()) {
      return renderTemplateWithExaminee(html, {
        ...getTemplatePreviewExaminee(),
        ...(data && typeof data === "object" ? data : {}),
      });
    }

    function renderInto(target, data = getPreviewData(), html = getHtml()) {
      const targetElement = resolveElement(target, ownerDocument);

      if (!targetElement) {
        return "";
      }

      const renderedHtml = render(data, html);
      targetElement.innerHTML = `<article class="template-render-sheet">${renderedHtml}</article>`;
      deps.pageSettings.applyTemplatePageSettingsToRenderedSheet(targetElement.querySelector(".template-render-sheet"));
      return renderedHtml;
    }

    function applyToolbarColorTrigger(triggerElement) {
      const colorInputId = triggerElement?.dataset?.editorColorInput || "";
      const colorCommand = triggerElement?.dataset?.editorColorCommand || "";
      const colorTableAction = triggerElement?.dataset?.editorColorTableAction || "";
      const colorInputElement = getElementById(colorInputId);
      const colorValue = triggerElement?.dataset?.editorColorPreset || colorInputElement?.value || "";
      const fallbackValue =
        typeof toolbar.getEditorToolbarColorFallback === "function"
          ? toolbar.getEditorToolbarColorFallback(colorCommand, colorTableAction)
          : colorTableAction === "apply-cell-border"
            ? "#000000"
            : "#ffffff";

      if (colorInputElement && colorValue) {
        colorInputElement.value = colorValue;
        toolbar.syncEditorToolbarColorControls({ colorInputElement, colorValue, fallbackValue });
      }

      if (colorCommand) {
        applyTemplateEditorCommand(colorCommand, colorValue);
      }

      if (colorTableAction) {
        if (colorTableAction === "apply-cell-border" && colorInputId === toolbarIds.borderColor) {
          if (colorInputElement?.dataset) {
            colorInputElement.dataset.editorBorderUserValue = "true";
          }

          return;
        }

        handleTemplateTableAction(colorTableAction, { colorValue });
      }
    }

    function handleClick(event) {
      const target = event.target instanceof Element ? event.target : null;

      if (!target || !getTemplateEditorModal().contains(target)) {
        return;
      }

      const fontSizeToggleTrigger = target.closest("[data-editor-font-size-toggle]");
      const fontSizeOptionTrigger = target.closest("[data-editor-font-size-option]");
      const borderSelectToggleTrigger = target.closest("[data-editor-border-select-toggle]");
      const borderSelectOptionTrigger = target.closest("[data-editor-border-select-option]");
      const colorToggleTrigger = target.closest("[data-editor-color-toggle]");
      const colorDirectTrigger = target.closest("[data-editor-color-direct]");
      const colorPresetTrigger = target.closest("[data-editor-color-preset]");
      const colorApplyTrigger = target.closest("[data-editor-color-apply]");
      const cellSplitStepTrigger = target.closest("[data-template-cell-split-step]");
      const cellSplitToggleTrigger = target.closest("[data-template-cell-split-toggle]");
      const cellSplitConfirmTrigger = target.closest("[data-template-cell-split-confirm]");
      const commandTrigger = target.closest("[data-template-command]");
      const tableActionTrigger = target.closest("[data-template-table-action]");
      const tableSizeTrigger = target.closest("[data-template-table-size]");
      const insertTrigger = target.closest("[data-template-insert]");
      const tagTrigger = target.closest("[data-template-tag]");
      const openImageTrigger = target.closest("[data-template-open-image]");

      if (fontSizeToggleTrigger) {
        const inputId = fontSizeToggleTrigger.dataset.editorFontSizeToggle;
        const comboElement = fontSizeToggleTrigger.closest(".template-toolbar-font-size-combo");
        const menuElement = comboElement?.querySelector(".template-toolbar-combo-menu");
        toolbar.setEditorToolbarFontSizeMenuVisibility(inputId, menuElement?.classList.contains("hidden") ?? true);
        return;
      }

      if (fontSizeOptionTrigger) {
        const comboMenu = fontSizeOptionTrigger.closest(".template-toolbar-combo-menu");
        const inputId = comboMenu?.dataset.editorFontSizeMenuFor || "";
        const fontSize = fontSizeOptionTrigger.dataset.editorFontSizeOption || "";
        const inputElement = getElementById(inputId);

        if (inputElement) {
          inputElement.value = fontSize;
        }

        if (inputId === toolbarIds.fontSize) {
          applyTemplateEditorFontSize(fontSize);
        }

        toolbar.setEditorToolbarFontSizeMenuVisibility(inputId, false);
        return;
      }

      if (borderSelectToggleTrigger) {
        const inputId = borderSelectToggleTrigger.dataset.editorBorderSelectToggle || "";
        const { menuElement } = toolbar.getEditorToolbarBorderSelectElements?.(inputId) || {};

        toolbar.setEditorToolbarBorderSelectMenuVisibility?.(inputId, menuElement?.classList.contains("hidden") ?? true);
        return;
      }

      if (borderSelectOptionTrigger) {
        const comboMenu = borderSelectOptionTrigger.closest(".template-toolbar-icon-select-menu");
        const inputId = comboMenu?.dataset.editorBorderSelectMenuFor || "";
        const value = borderSelectOptionTrigger.dataset.editorBorderSelectOption || "";

        if (inputId && value) {
          toolbar.applyEditorToolbarBorderSelectOption?.(inputId, value);
        }

        toolbar.setEditorToolbarBorderSelectMenuVisibility?.(inputId, false);
        return;
      }

      if (colorToggleTrigger) {
        const inputId = colorToggleTrigger.dataset.editorColorToggle || "";
        const { panelElement } = toolbar.getEditorToolbarColorPickerElements(inputId);
        toolbar.setEditorToolbarColorPanelVisibility(inputId, panelElement?.classList.contains("hidden") ?? true);
        return;
      }

      if (colorDirectTrigger) {
        const inputId = colorDirectTrigger.dataset.editorColorInput || "";
        const { inputElement } = toolbar.getEditorToolbarColorPickerElements(inputId);
        inputElement?.showPicker ? inputElement.showPicker() : inputElement?.click();
        return;
      }

      if (colorPresetTrigger || colorApplyTrigger) {
        applyToolbarColorTrigger(colorPresetTrigger || colorApplyTrigger);
        toolbar.closeAllEditorToolbarColorPanels();
        return;
      }

      if (cellSplitStepTrigger) {
        const nextStep = cellSplitStepTrigger.dataset.templateCellSplitStep;
        globalScope.AdmitCardEditorToolbarControls?.stepEditorToolbarNumberInput({
          inputElement: toolbarElements.cellSplitCount,
          direction: nextStep,
          minimum: 2,
        });
        globalScope.AdmitCardEditorToolbarControls?.focusEditorToolbarNumberInput(toolbarElements.cellSplitCount);
        return;
      }

      if (cellSplitToggleTrigger) {
        const nextOpen = toolbarElements.cellSplitPanel?.classList.contains("hidden") ?? true;
        setTemplateEditorCellSplitPanelVisibility(nextOpen);
        toolbarElements.cellSplitCount?.focus();
        toolbarElements.cellSplitCount?.select?.();
        return;
      }

      if (cellSplitConfirmTrigger) {
        const cellSplitConfig = getTemplateEditorCellSplitConfig?.();

        if (cellSplitConfig && handleTemplateTableAction("split-cell", cellSplitConfig)) {
          setTemplateEditorCellSplitPanelVisibility(false);
        }
        return;
      }

      if (commandTrigger) {
        applyTemplateEditorCommand(commandTrigger.dataset.templateCommand);
        return;
      }

      if (tableActionTrigger) {
        handleTemplateTableAction(tableActionTrigger.dataset.templateTableAction);
        return;
      }

      if (tableSizeTrigger) {
        applyTemplateTableSize();
        return;
      }

      if (insertTrigger) {
        handleTemplateEditorInsert(insertTrigger.dataset.templateInsert);
        return;
      }

      if (tagTrigger) {
        insertTemplateTag(tagTrigger.dataset.templateTag);
        return;
      }

      if (openImageTrigger) {
        setTemplateEditorCellSplitPanelVisibility(false);
        setTemplateEditorTableInsertPanelVisibility(false);
        toolbarElements.imageInput?.click();
      }
    }

    function handlePointerDown(event) {
      const target = event.target instanceof Element ? event.target : null;

      if (!target || !getTemplateEditorModal().contains(target)) {
        return;
      }

      const toolbarTrigger = target.closest(
        "[data-template-command], [data-template-table-action], [data-template-cell-split-step], [data-template-cell-split-toggle], [data-template-cell-split-confirm], [data-template-insert], [data-template-open-image], [data-template-tag], [data-editor-color-preset], [data-editor-color-apply], [data-editor-color-toggle], [data-editor-color-direct], [data-editor-font-size-toggle], [data-editor-font-size-option], [data-editor-border-select-toggle], [data-editor-border-select-option]",
      );
      const toolbarSelectionControl = target.closest(
        `#${toolbarIds.fontFamily}, #${toolbarIds.fontSize}, #${toolbarIds.textColor}, #${toolbarIds.textShading}, #${toolbarIds.cellShading}, #${toolbarIds.borderTarget}, #${toolbarIds.borderStyle}, #${toolbarIds.borderWidth}, #${toolbarIds.borderColor}, #${toolbarIds.tableRows}, #${toolbarIds.tableColumns}, #${toolbarIds.cellSplitPanel}, [data-template-editor-kit-page-properties] [data-template-page-setting]`,
      );

      if (toolbarTrigger) {
        saveTemplateEditorSelection();
        event.preventDefault();
        return;
      }

      if (toolbarSelectionControl) {
        saveTemplateEditorSelection();
        return;
      }

      if (
        event.button !== 0 ||
        state.templateEditor.imageResizeSession ||
        state.templateEditor.imageMoveSession ||
        state.templateEditor.tableResizeSession ||
        state.templateEditor.tableSelectionSession
      ) {
        return;
      }

      if (handleTemplateEditorTablePointerDown(event)) {
        return;
      }

      const selectedImage = getTemplateEditorImageTarget(target);

      if (selectedImage) {
        event.preventDefault();
        clearTemplateEditorTableSelection();
        clearTemplateEditorTableHoverState();
        selectTemplateEditorImage(selectedImage);
        startTemplateEditorImageMoveSession(selectedImage, event);
        return;
      }

      if (shell.surfaceElement.contains(target)) {
        clearTemplateEditorImageSelection();
        clearTemplateEditorTableSelection();
        clearTemplateEditorTableHoverState();
      }
    }

    function handleKeydown(event) {
      const isSurfaceTarget = event.target === shell.surfaceElement || shell.surfaceElement.contains(event.target);
      const isModifierPressed = event.ctrlKey || event.metaKey;
      const normalizedKey = String(event.key || "").toLowerCase();

      if (event.key === "Escape" && toolbar.closeAllEditorToolbarBorderSelectMenus?.()) {
        event.preventDefault();
        return;
      }

      if (isSurfaceTarget && isModifierPressed && !event.altKey) {
        if (normalizedKey === "z" && event.shiftKey) {
          event.preventDefault();
          redoTemplateEditorHistory();
          return;
        }

        if (normalizedKey === "z") {
          event.preventDefault();
          undoTemplateEditorHistory();
          return;
        }

        if (normalizedKey === "y") {
          event.preventDefault();
          redoTemplateEditorHistory();
          return;
        }
      }

      if (isSurfaceTarget && !isModifierPressed && (event.key === "Backspace" || event.key === "Delete")) {
        handleTemplateEditorTokenDeletion(event);
      }

      if (
        event.key === "Enter" &&
        (event.target === toolbarElements.tableRows || event.target === toolbarElements.tableColumns) &&
        !toolbarElements.tableInsertPanel?.classList.contains("hidden")
      ) {
        event.preventDefault();
        handleTemplateEditorInsert("table-confirm");
      }

      if (
        event.key === "Enter" &&
        event.target === toolbarElements.cellSplitCount &&
        !toolbarElements.cellSplitPanel?.classList.contains("hidden")
      ) {
        event.preventDefault();
        const cellSplitConfig = getTemplateEditorCellSplitConfig?.();

        if (cellSplitConfig && handleTemplateTableAction("split-cell", cellSplitConfig)) {
          setTemplateEditorCellSplitPanelVisibility(false);
        }
      }

      if (event.key === "Enter" && event.target === toolbarElements.fontSize) {
        event.preventDefault();
        applyTemplateEditorFontSize(event.target.value);
      }
    }

    function handleChange(event) {
      if (handleTemplatePageSettingChange(event)) {
        return;
      }

      if (event.target === toolbarElements.imageInput) {
        insertTemplateImage(event.target.files?.[0]);
        event.target.value = "";
        return;
      }

      if (event.target === toolbarElements.fontFamily) {
        applyTemplateEditorFontFamily(event.target.value);
        return;
      }

      if (event.target === toolbarElements.fontSize) {
        applyTemplateEditorFontSize(event.target.value);
        return;
      }

      if (event.target?.matches?.(".template-toolbar-color")) {
        applyToolbarColorTrigger(event.target);
        toolbar.closeAllEditorToolbarColorPanels();
      }
    }

    function handleInput(event) {
      if (event.target?.matches?.(".template-toolbar-border-width")) {
        event.target.dataset.editorBorderUserValue = "true";
      }

      if (event.target === toolbarElements.fontSize) {
        toolbar.syncEditorToolbarFontSizeMenuSelection(event.target, event.target.value);
        return;
      }

      if (event.target === shell.surfaceElement) {
        syncTemplateEditorContent();
        return;
      }

      if (event.target?.matches?.(".template-toolbar-color")) {
        applyToolbarColorTrigger(event.target);
      }
    }

    function handleSelectionChange() {
      const selection = ownerWindow.getSelection?.();

      if (!selection || selection.rangeCount === 0 || !shell.surfaceElement.contains(selection.anchorNode)) {
        return;
      }

      saveTemplateEditorSelection();
      updateTemplateEditorActiveCell();
      updateTemplateEditorFormattingControls();
      updateTemplateTableControls();
    }

    function handlePaste(event) {
      if (event.target === shell.surfaceElement) {
        ownerWindow.setTimeout(() => {
          syncTemplateEditorContent();
        }, 0);
      }
    }

    function handleDragStart(event) {
      if (getTemplateEditorImageTarget(event.target)) {
        event.preventDefault();
      }
    }

    function closeToolbarPanelsForExternalClick(event) {
      const target = event.target instanceof Element ? event.target : null;

      if (target?.closest(".template-toolbar-table-insert-popover")) {
        return;
      }

      if (target?.closest(".template-toolbar-font-size-combo")) {
        return;
      }

      if (target?.closest(".template-toolbar-color-picker")) {
        return;
      }

      if (target?.closest(".template-toolbar-icon-select")) {
        return;
      }

      toolbar.closeAllEditorToolbarTableInsertPanels();
      toolbar.closeAllEditorToolbarFontSizeMenus();
      toolbar.closeAllEditorToolbarColorPanels();
      toolbar.closeAllEditorToolbarBorderSelectMenus?.();
    }

    const disposers = [];
    const addListener = (target, type, listener, listenerOptions) => {
      target.addEventListener(type, listener, listenerOptions);
      disposers.push(() => target.removeEventListener(type, listener, listenerOptions));
    };

    function bindEvents() {
      addListener(getTemplateEditorModal(), "click", handleClick);
      addListener(getTemplateEditorModal(), "pointerdown", handlePointerDown);
      addListener(getTemplateEditorModal(), "keydown", handleKeydown);
      addListener(getTemplateEditorModal(), "change", handleChange);
      addListener(getTemplateEditorModal(), "input", handleInput);
      addListener(getTemplateEditorModal(), "paste", handlePaste);
      addListener(getTemplateEditorModal(), "dragstart", handleDragStart);
      addListener(shell.surfaceElement, "pointermove", updateTemplateEditorTableHoverState);
      addListener(shell.surfaceElement, "pointerleave", clearTemplateEditorTableHoverState);
      addListener(shell.surfaceElement, "scroll", () => {
        clearTemplateEditorTableHoverState();
        updateTemplateEditorImageSelectionOverlay();
      });
      addListener(ownerDocument, "selectionchange", handleSelectionChange);
      addListener(ownerDocument, "click", closeToolbarPanelsForExternalClick, true);
      addListener(ownerWindow, "resize", updateTemplateEditorImageSelectionOverlay);
    }

    function destroy() {
      disposers.splice(0).forEach((dispose) => dispose());
      clearTemplateEditorImageSelection();
      clearTemplateEditorTableSelection();
      clearTemplateEditorTableHoverState();
      releaseTemplateEditorImageMoveSession({ sync: false });
      releaseTemplateEditorImageResizeSession({ sync: false });
      releaseTemplateEditorTableResizeSession({ sync: false });
      releaseTemplateEditorTableSelectionSession({ keepSelection: false });
    }

    api = Object.freeze({
      applyCommand: applyTemplateEditorCommand,
      destroy,
      getHtml,
      insertHtml: insertTemplateHtml,
      insertImage: insertTemplateImage,
      insertTag: insertTemplateTag,
      redo: redoTemplateEditorHistory,
      render,
      renderInto,
      renderPagePropertiesPanel,
      renderTagPanel,
      renderToolbar,
      setHtml,
      state,
      sync: syncTemplateEditorContent,
      undo: undoTemplateEditorHistory,
    });

    renderToolbar();
    renderTagPanel();
    renderPagePropertiesPanel();
    setHtml(options.initialHtml || "", { resetHistory: true, notify: false });
    bindEvents();
    setFallbackStatus(state.templateEditor.statusMessage, state.templateEditor.statusType);

    return api;
  }

  return Object.freeze({
    createTemplateEditor,
    createTemplateEditorState,
    createTemplatePreviewState,
    normalizeTemplateTagDefinition,
    normalizeTemplateTagDefinitions,
  });
});
