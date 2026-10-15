(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalScope);
    return;
  }

  globalScope.ExamListTemplateEditorRuntimeCore = factory(globalScope);
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
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
      selectedTableElement: null,
      tableSelection: null,
      tableSelectionSession: null,
      tableResizeSession: null,
      tableObjectResizeSession: null,
      tableObjectMoveSession: null,
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
    return normalizeTemplateTagDefinitions(globalScope.ExamListAppConfig?.templateTagDefinitions || []);
  }

  function getRequiredDependency(value, name) {
    if (!value) {
      throw new Error(`${name} is required. Load the template editor runtime manifest scripts in order first.`);
    }

    return value;
  }

  function getDependencies() {
    return Object.freeze({
      content: getRequiredDependency(globalScope.ExamListEditorContentShared, "ExamListEditorContentShared"),
      documentApi: getRequiredDependency(globalScope.ExamListTemplateEditorDocumentApi, "ExamListTemplateEditorDocumentApi"),
      events: getRequiredDependency(globalScope.ExamListTemplateEditorEvents, "ExamListTemplateEditorEvents"),
      generatedObjects: getRequiredDependency(globalScope.ExamListTemplateGeneratedObjects, "ExamListTemplateGeneratedObjects"),
      imageTools: getRequiredDependency(globalScope.ExamListTemplateEditorImageTools, "ExamListTemplateEditorImageTools"),
      keyboard: getRequiredDependency(globalScope.ExamListTemplateEditorKeyboard, "ExamListTemplateEditorKeyboard"),
      pageSettings: getRequiredDependency(globalScope.ExamListTemplateEditorPageSettings, "ExamListTemplateEditorPageSettings"),
      commands: getRequiredDependency(globalScope.ExamListTemplateEditorCommands, "ExamListTemplateEditorCommands"),
      preview: getRequiredDependency(globalScope.ExamListTemplateEditorPreview, "ExamListTemplateEditorPreview"),
      runtime: getRequiredDependency(
        globalScope.ExamListTemplateEditorEditingRuntime,
        "ExamListTemplateEditorEditingRuntime",
      ),
      selection: getRequiredDependency(globalScope.ExamListTemplateEditorSelection, "ExamListTemplateEditorSelection"),
      tableFormatting: getRequiredDependency(globalScope.ExamListTemplateEditorTableFormatting, "ExamListTemplateEditorTableFormatting"),
      tableObject: getRequiredDependency(globalScope.ExamListTemplateEditorTableObject, "ExamListTemplateEditorTableObject"),
      tableTools: getRequiredDependency(globalScope.ExamListTemplateEditorTableTools, "ExamListTemplateEditorTableTools"),
      tableUtils: getRequiredDependency(globalScope.ExamListEditorTableUtils, "ExamListEditorTableUtils"),
      toolbar: getRequiredDependency(globalScope.ExamListEditorToolbar, "ExamListEditorToolbar"),
      toolbarInteractions: getRequiredDependency(globalScope.ExamListTemplateEditorToolbarInteractions, "ExamListTemplateEditorToolbarInteractions"),
      toolbarState: getRequiredDependency(globalScope.ExamListTemplateEditorToolbarState, "ExamListTemplateEditorToolbarState"),
    });
  }

  function createToolbarIds(prefix) {
    return Object.freeze({
      blockType: `${prefix}BlockType`,
      borderColor: `${prefix}BorderColor`,
      borderStyle: `${prefix}BorderStyle`,
      borderTarget: `${prefix}BorderTarget`,
      borderWidth: `${prefix}BorderWidth`,
      cellPaddingBottom: `${prefix}CellPaddingBottom`,
      cellPaddingLeft: `${prefix}CellPaddingLeft`,
      cellPaddingRight: `${prefix}CellPaddingRight`,
      cellPaddingTop: `${prefix}CellPaddingTop`,
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
      imageInsertPanel: `${prefix}ImageInsertPanel`,
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
      rootElement.classList.add("template-editor-runtime");
      rootElement.innerHTML = `
        <div class="template-editor-runtime-shell">
          <div class="editor-toolbar-column">
            <div class="editor-toolbar" data-template-editor-runtime-toolbar role="toolbar" aria-label="편집 도구"></div>
          </div>
          <aside class="template-tag-panel" data-template-editor-runtime-tag-panel>
            <p class="template-tag-caption">데이터 태그</p>
            <div class="template-tag-strip" data-template-editor-runtime-tags></div>
          </aside>
          <div
            class="template-editor-page"
            data-template-editor-canvas="true"
            data-template-editor-canvas-zoom="1"
            data-template-editor-canvas-zoom-mode="manual"
            style="--template-editor-canvas-zoom: 1;"
          >
            <div class="editor-paper-scale-box" data-template-editor-canvas-scale-box>
              <div class="template-editor-surface" data-template-editor-runtime-surface contenteditable="true"></div>
            </div>
          </div>
          <aside class="template-page-properties-panel" data-template-editor-runtime-page-properties aria-label="페이지 속성"></aside>
        </div>
        <div class="template-editor-runtime-status" data-template-editor-runtime-status></div>
      `;
    }

    const resolvedToolbarHost = toolbarHost || rootElement.querySelector("[data-template-editor-runtime-toolbar]");
    const resolvedSurfaceElement = surfaceElement || rootElement.querySelector("[data-template-editor-runtime-surface]");
    const resolvedTagHost = tagHost || rootElement?.querySelector("[data-template-editor-runtime-tags]") || null;
    const resolvedPagePropertiesHost =
      pagePropertiesHost || rootElement?.querySelector("[data-template-editor-runtime-page-properties]") || null;
    const resolvedStatusElement = statusElement || rootElement?.querySelector("[data-template-editor-runtime-status]") || null;

    if (!resolvedToolbarHost || !resolvedSurfaceElement) {
      throw new Error("Template editor toolbarHost and surface elements are required.");
    }

    // Establish document coordinates before setHtml initializes flow spacers and history.
    // Adding these classes later changes the containing block and shifts saved tables.
    resolvedSurfaceElement.classList.add("editor-paper", "editor-document-surface");
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

  return Object.freeze({
    createShell,
    createTemplateEditorState,
    createTemplatePreviewState,
    createToolbarIds,
    escapeAttribute,
    escapeHtml,
    formatDateAsYmd,
    getDefaultTagDefinitions,
    getDependencies,
    normalizeTemplateTagDefinition,
    normalizeTemplateTagDefinitions,
    resolveElement,
  });
});

})();
