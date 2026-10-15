(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./toolbar-markup-helpers"));
    return;
  }

  globalScope.ExamListEditorToolbarMarkup = factory(globalScope.ExamListEditorToolbarMarkupHelpers);
})(typeof globalThis !== "undefined" ? globalThis : this, (toolbarMarkupHelpersModule) => {
  const { createEditorToolbarMarkupHelpers } = toolbarMarkupHelpersModule || {};

  if (typeof createEditorToolbarMarkupHelpers !== "function") {
    throw new Error("client/features/editor/toolbar-markup-helpers.js must be loaded before client/features/editor/toolbar-markup.js.");
  }

  function createEditorToolbarMarkupRenderer({
    EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR,
    EDITOR_TOOLBAR_FONT_OPTIONS,
    EDITOR_TOOLBAR_FONT_SIZE_OPTIONS,
    EDITOR_TOOLBAR_ICON_MARKUP,
    EDITOR_TOOLBAR_SHADING_COLOR_PRESETS,
    EDITOR_TOOLBAR_TEXT_COLOR_PRESETS,
    isEditorToolbarPresetFontSize,
    normalizeEditorToolbarColorValue,
  }) {
    const {
      escapeEditorToolbarAttribute,
      escapeEditorToolbarHtml,
      renderEditorToolbarAttribute,
      renderEditorToolbarBorderSection,
      renderEditorToolbarCellPaddingSection,
      renderEditorToolbarCellSplitPopover,
      renderEditorToolbarColorPickerSection,
      getEditorToolbarFontFamilyLabel,
      renderEditorToolbarFontFamilyOptionButtons,
      renderEditorToolbarFontSizeOptionButtons,
      renderEditorToolbarIconButton,
      renderEditorToolbarImageInsertPopover,
      renderEditorToolbarLabeledControl,
      renderEditorToolbarTableInsertPopover,
      renderEditorToolbarTextButton,
    } = createEditorToolbarMarkupHelpers({
      EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR,
      EDITOR_TOOLBAR_FONT_OPTIONS,
      EDITOR_TOOLBAR_FONT_SIZE_OPTIONS,
      EDITOR_TOOLBAR_ICON_MARKUP,
      EDITOR_TOOLBAR_TEXT_COLOR_PRESETS,
      isEditorToolbarPresetFontSize,
      normalizeEditorToolbarColorValue,
    });

    function renderEditorToolbarInner({
      commandAttr = "",
      commandSelectAttr = "",
      actionAttr = "",
      tableActionAttr = "",
      insertAttr = "",
      openImageAttr = "",
      showLinkAction = false,
      linkActionValue = "link",
      tableInsertLocation = "insert-group",
      tableLayout = "default",
      fontFamilyId = "",
      fontFamilyValue = EDITOR_TOOLBAR_FONT_OPTIONS[0].value,
      fontSizeId = "",
      fontSizeValue = 11,
      textColorId = "",
      textColorValue = EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR,
      textShadingId = "",
      textShadingValue = "#fff59d",
      cellShadingId = "",
      cellShadingValue = "#ffffff",
      tableInsertPanelId = "",
      tableRowsId = "",
      tableColumnsId = "",
      cellSplitPanelId = "",
      cellSplitCountId = "",
      cellSplitAxisName = "",
      cellSplitAxisRowId = "",
      cellSplitAxisColumnId = "",
      borderTargetId = "",
      borderStyleId = "",
      borderWidthId = "",
      borderColorId = "",
      cellPaddingTopId = "",
      cellPaddingRightId = "",
      cellPaddingBottomId = "",
      cellPaddingLeftId = "",
      cellWidthId = "",
      rowHeightId = "",
      sizeScopeId = "",
      imageInputId = "",
      imageInsertPanelId = "",
    }) {
      const resolvedFontSizeMenuId = `${fontSizeId}Menu`;
      const shouldRenderTableInsertInTableAddSection = tableInsertLocation === "table-add-section";
      const shouldRenderTableInsertInInsertGroup = !shouldRenderTableInsertInTableAddSection;
      const useNoticeTableLayout = tableLayout === "notice";
      const tableInsertPopoverMarkup = renderEditorToolbarTableInsertPopover({
        insertAttr,
        panelId: tableInsertPanelId,
        rowsId: tableRowsId,
        columnsId: tableColumnsId,
      });
      const tablePlacementSectionMarkup = `
        <div class="template-toolbar-section">
          <span class="template-toolbar-section-label">배치</span>
          <div class="template-toolbar-group-controls">
            ${renderEditorToolbarIconButton({ attributeName: tableActionAttr, attributeValue: "cell-vertical-align-top", label: "셀 위쪽 정렬", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.cellVerticalAlignTop })}
            ${renderEditorToolbarIconButton({ attributeName: tableActionAttr, attributeValue: "cell-vertical-align-middle", label: "셀 가운데 정렬", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.cellVerticalAlignMiddle })}
            ${renderEditorToolbarIconButton({ attributeName: tableActionAttr, attributeValue: "cell-vertical-align-bottom", label: "셀 아래쪽 정렬", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.cellVerticalAlignBottom })}
          </div>
        </div>
      `;
      const tableFitSectionMarkup = `
        <div class="template-toolbar-section">
          <span class="template-toolbar-section-label">맞춤</span>
          <div class="template-toolbar-group-controls">
            ${renderEditorToolbarIconButton({ attributeName: tableActionAttr, attributeValue: "equalize-column-widths", label: "열 너비 맞춤", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.equalizeColumnWidths })}
            ${renderEditorToolbarIconButton({ attributeName: tableActionAttr, attributeValue: "equalize-row-heights", label: "행 높이 맞춤", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.equalizeRowHeights })}
          </div>
        </div>
      `;
      const tableShadingSectionMarkup = renderEditorToolbarColorPickerSection({
        sectionLabel: "음영",
        inputId: cellShadingId,
        inputValue: cellShadingValue,
        presetColors: EDITOR_TOOLBAR_SHADING_COLOR_PRESETS,
        colorTableAction: "apply-cell-shading",
        fallbackValue: "#ffffff",
        sectionClassName: useNoticeTableLayout ? "" : "template-toolbar-section-compact",
        pickerClassName: useNoticeTableLayout
          ? ""
          : "template-toolbar-color-picker-compact template-toolbar-color-picker-align-end",
      });
      const tableBorderSectionMarkup = renderEditorToolbarBorderSection({
        tableActionAttr,
        borderTargetId,
        borderStyleId,
        borderWidthId,
        borderColorId,
      });
      const tableCellPaddingSectionMarkup = renderEditorToolbarCellPaddingSection({
        tableActionAttr,
        cellPaddingTopId,
        cellPaddingRightId,
        cellPaddingBottomId,
        cellPaddingLeftId,
      });
      const tableSizeSectionMarkup = cellWidthId && rowHeightId ? `
        <div class="template-toolbar-section template-toolbar-cell-size-section">
          <span class="template-toolbar-section-label">셀 크기</span>
          <div class="template-toolbar-cell-size-controls">
            <div class="template-toolbar-cell-size-grid">
              <label class="template-toolbar-cell-padding-field"><span class="template-toolbar-field-label">너비</span>
                <span class="template-toolbar-size-input-wrap"><input class="template-toolbar-number" id="${escapeEditorToolbarAttribute(cellWidthId)}" data-template-cell-size-input="width" type="number" min="24" step="1" aria-label="셀 너비 (px)" /><span aria-hidden="true">px</span></span>
              </label>
              <label class="template-toolbar-cell-padding-field"><span class="template-toolbar-field-label">높이</span>
                <span class="template-toolbar-size-input-wrap"><input class="template-toolbar-number" id="${escapeEditorToolbarAttribute(rowHeightId)}" data-template-cell-size-input="height" type="number" min="24" step="1" aria-label="셀 높이 (px)" /><span aria-hidden="true">px</span></span>
              </label>
            </div>
          </div>
        </div>` : "";
      const objectInsertSectionMarkup = `
        <div class="template-toolbar-section examlist-object-section examlist-object-insert-control">
          <span class="template-toolbar-section-label">삽입</span>
          <div class="template-toolbar-group-controls examlist-object-insert-grid">
            ${shouldRenderTableInsertInInsertGroup ? renderEditorToolbarLabeledControl({ controlMarkup: tableInsertPopoverMarkup }) : ""}
            ${renderEditorToolbarLabeledControl({
              controlMarkup: renderEditorToolbarImageInsertPopover({ panelId: imageInsertPanelId, openImageAttr }),
            })}
            ${showLinkAction
              ? renderEditorToolbarLabeledControl({
                  controlMarkup: renderEditorToolbarIconButton({ attributeName: actionAttr, attributeValue: linkActionValue, label: "링크 삽입", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.link, extraClassName: "examlist-object-insert-button" }),
                })
              : ""}
            ${renderEditorToolbarLabeledControl({
              controlMarkup: renderEditorToolbarIconButton({ attributeName: insertAttr, attributeValue: "barcode", label: "바코드 삽입", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.barcode, extraClassName: "examlist-object-insert-button" }),
            })}
            ${renderEditorToolbarLabeledControl({
              controlMarkup: renderEditorToolbarIconButton({ attributeName: insertAttr, attributeValue: "qrcode", label: "QR코드 삽입", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.qrcode, extraClassName: "examlist-object-insert-button" }),
            })}
          </div>
        </div>
      `;

      return `
        <div class="template-toolbar-group" data-editor-format-toolbar-group="true">
          <span class="template-toolbar-group-label">글자 모양</span>
          <div class="template-toolbar-section template-toolbar-font-section">
            <span class="template-toolbar-section-label">기본</span>
            <div class="template-toolbar-format-grid">
            <div class="template-toolbar-format-field">
              <span class="template-toolbar-format-field-label">글꼴</span>
              <div class="template-toolbar-group-controls">
                <div class="template-toolbar-font-family-combo" data-editor-font-family-combo="${escapeEditorToolbarAttribute(fontFamilyId)}">
                  <input class="template-toolbar-font-family-input" id="${escapeEditorToolbarAttribute(fontFamilyId)}" type="hidden" value="${escapeEditorToolbarAttribute(fontFamilyValue)}" aria-hidden="true" tabindex="-1"${renderEditorToolbarAttribute(commandSelectAttr, "fontName")} />
                  <button class="template-toolbar-combo-value template-toolbar-font-family-value" data-editor-font-family-toggle="${escapeEditorToolbarAttribute(fontFamilyId)}" type="button" aria-label="글꼴 목록 열기" aria-expanded="false" aria-controls="${escapeEditorToolbarAttribute(fontFamilyId)}Menu">
                    <span data-editor-font-family-current>${escapeEditorToolbarHtml(getEditorToolbarFontFamilyLabel(fontFamilyValue))}</span>
                    <span class="template-toolbar-combo-caret" aria-hidden="true"></span>
                  </button>
                  <div class="template-toolbar-combo-menu hidden" id="${escapeEditorToolbarAttribute(fontFamilyId)}Menu" data-editor-font-family-menu-for="${escapeEditorToolbarAttribute(fontFamilyId)}" role="listbox" aria-label="글꼴 목록">
                    ${renderEditorToolbarFontFamilyOptionButtons(fontFamilyValue)}
                  </div>
                </div>
              </div>
            </div>
            <div class="template-toolbar-format-field">
              <span class="template-toolbar-format-field-label">크기</span>
              <div class="template-toolbar-group-controls template-toolbar-font-size-controls">
                <div class="template-toolbar-font-size-combo" data-editor-font-size-combo="${escapeEditorToolbarAttribute(fontSizeId)}">
                  <input class="template-toolbar-font-size-input" id="${escapeEditorToolbarAttribute(fontSizeId)}" type="hidden" value="${escapeEditorToolbarAttribute(String(fontSizeValue))}" aria-hidden="true" tabindex="-1" />
                  <button class="template-toolbar-combo-value template-toolbar-font-size-value" data-editor-font-size-toggle="${escapeEditorToolbarAttribute(fontSizeId)}" type="button" aria-label="글꼴 크기 목록 열기" aria-expanded="false" aria-controls="${escapeEditorToolbarAttribute(resolvedFontSizeMenuId)}">
                    <span data-editor-font-size-current>${escapeEditorToolbarHtml(String(fontSizeValue))}</span>
                    <span class="template-toolbar-combo-unit" aria-hidden="true">pt</span>
                    <span class="template-toolbar-combo-caret" aria-hidden="true"></span>
                  </button>
                  <div class="template-toolbar-combo-menu hidden" id="${escapeEditorToolbarAttribute(resolvedFontSizeMenuId)}" data-editor-font-size-menu-for="${escapeEditorToolbarAttribute(fontSizeId)}" role="listbox" aria-label="글꼴 크기 목록">
                    ${renderEditorToolbarFontSizeOptionButtons(fontSizeValue)}
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
          <div class="template-toolbar-section template-toolbar-text-colors-section">
            <span class="template-toolbar-section-label">색깔</span>
            <div class="template-toolbar-format-grid">
              ${renderEditorToolbarColorPickerSection({ sectionLabel: "글자색", inputId: textColorId, inputValue: textColorValue, presetColors: EDITOR_TOOLBAR_TEXT_COLOR_PRESETS, colorCommand: "foreColor", fallbackValue: EDITOR_TOOLBAR_DEFAULT_TEXT_COLOR, sectionClassName: "template-toolbar-format-color-field", pickerClassName: "template-toolbar-color-picker-compact" })}
              ${renderEditorToolbarColorPickerSection({ sectionLabel: "음영", inputId: textShadingId, inputValue: textShadingValue, presetColors: EDITOR_TOOLBAR_SHADING_COLOR_PRESETS, colorCommand: "hiliteColor", fallbackValue: "#fff59d", sectionClassName: "template-toolbar-format-color-field", pickerClassName: "template-toolbar-color-picker-compact" })}
            </div>
          </div>
          <div class="template-toolbar-section">
            <span class="template-toolbar-section-label">스타일</span>
            <div class="template-toolbar-group-controls">
              ${renderEditorToolbarTextButton({ attributeName: commandAttr, attributeValue: "bold", label: "굵게", textContent: "B" })}
              ${renderEditorToolbarTextButton({ attributeName: commandAttr, attributeValue: "italic", label: "기울임", textContent: "I" })}
              ${renderEditorToolbarTextButton({ attributeName: commandAttr, attributeValue: "underline", label: "밑줄", textContent: "U" })}
              ${renderEditorToolbarIconButton({ attributeName: commandAttr, attributeValue: "insertUnorderedList", label: "목록", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.unorderedList })}
            </div>
          </div>
          <div class="template-toolbar-section">
            <span class="template-toolbar-section-label">정렬</span>
            <div class="template-toolbar-group-controls">
              ${renderEditorToolbarIconButton({ attributeName: commandAttr, attributeValue: "justifyLeft", label: "왼쪽 정렬", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.justifyLeft })}
              ${renderEditorToolbarIconButton({ attributeName: commandAttr, attributeValue: "justifyCenter", label: "가운데 정렬", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.justifyCenter })}
              ${renderEditorToolbarIconButton({ attributeName: commandAttr, attributeValue: "justifyRight", label: "오른쪽 정렬", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.justifyRight })}
              ${renderEditorToolbarIconButton({ attributeName: commandAttr, attributeValue: "justifyFull", label: "배분정렬", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.justifyFull })}
            </div>
          </div>
        </div>
        <div class="template-toolbar-group examlist-object-insert-group">
          ${objectInsertSectionMarkup}
        </div>
        <div class="template-toolbar-group template-toolbar-table-group is-disabled" data-editor-table-toolbar-group="true" aria-disabled="true">
          <span class="template-toolbar-group-label">표</span>
          <div class="template-toolbar-section">
            <span class="template-toolbar-section-label">추가</span>
            <div class="template-toolbar-group-controls">
              ${shouldRenderTableInsertInTableAddSection ? tableInsertPopoverMarkup : ""}
              ${renderEditorToolbarIconButton({ attributeName: tableActionAttr, attributeValue: "insert-row-before", label: "위에 행 추가", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.insertRowBefore })}
              ${renderEditorToolbarIconButton({ attributeName: tableActionAttr, attributeValue: "insert-row-after", label: "아래에 행 추가", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.insertRowAfter })}
              ${renderEditorToolbarIconButton({ attributeName: tableActionAttr, attributeValue: "insert-column-before", label: "왼쪽에 열 추가", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.insertColumnBefore })}
              ${renderEditorToolbarIconButton({ attributeName: tableActionAttr, attributeValue: "insert-column-after", label: "오른쪽에 열 추가", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.insertColumnAfter })}
            </div>
          </div>
          <div class="template-toolbar-section">
            <span class="template-toolbar-section-label">삭제</span>
            <div class="template-toolbar-group-controls">
              ${renderEditorToolbarIconButton({ attributeName: tableActionAttr, attributeValue: "delete-row", label: "행 삭제", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.deleteRow })}
              ${renderEditorToolbarIconButton({ attributeName: tableActionAttr, attributeValue: "delete-column", label: "열 삭제", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.deleteColumn })}
            </div>
          </div>
          ${useNoticeTableLayout
            ? `
              <div class="template-toolbar-section-row template-toolbar-section-row-stack">
                <div class="template-toolbar-section">
                  <span class="template-toolbar-section-label">편집</span>
                  <div class="template-toolbar-group-controls">
                    ${renderEditorToolbarIconButton({ attributeName: tableActionAttr, attributeValue: "merge-selection", label: "선택한 셀 병합", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.mergeSelection })}
                    ${renderEditorToolbarCellSplitPopover({
                      panelId: cellSplitPanelId,
                      countId: cellSplitCountId,
                      axisName: cellSplitAxisName,
                      axisRowId: cellSplitAxisRowId,
                      axisColumnId: cellSplitAxisColumnId,
                    })}
                  </div>
                </div>
                ${tableFitSectionMarkup}
              </div>
              ${tablePlacementSectionMarkup}
              ${tableShadingSectionMarkup}
              ${tableBorderSectionMarkup}
              ${tableSizeSectionMarkup}
              ${tableCellPaddingSectionMarkup}
            `
            : `
              <div class="template-toolbar-section-row template-toolbar-section-row-stack">
                <div class="template-toolbar-section">
                  <span class="template-toolbar-section-label">편집</span>
                  <div class="template-toolbar-group-controls">
                    ${renderEditorToolbarIconButton({ attributeName: tableActionAttr, attributeValue: "merge-selection", label: "선택한 셀 병합", iconMarkup: EDITOR_TOOLBAR_ICON_MARKUP.mergeSelection })}
                    ${renderEditorToolbarCellSplitPopover({
                      panelId: cellSplitPanelId,
                      countId: cellSplitCountId,
                      axisName: cellSplitAxisName,
                      axisRowId: cellSplitAxisRowId,
                      axisColumnId: cellSplitAxisColumnId,
                    })}
                  </div>
                </div>
                ${tableFitSectionMarkup}
              </div>
              <div class="template-toolbar-section-row template-toolbar-section-row-dual">
                ${tablePlacementSectionMarkup}
                ${tableShadingSectionMarkup}
              </div>
              ${tableBorderSectionMarkup}
              ${tableSizeSectionMarkup}
              ${tableCellPaddingSectionMarkup}
            `}
        </div>
        <div class="template-toolbar-group examlist-object-control">
          <span class="template-toolbar-group-label">개체 편집</span>
        </div>
        <input class="upload-file-input" id="${escapeEditorToolbarAttribute(imageInputId)}" type="file" accept="image/*" />
      `;
    }

    function renderEditorToolbar({
      toolbarClassName = "",
      ariaLabel = "편집 도구",
      ...options
    }) {
      const className = ["editor-toolbar", toolbarClassName].filter(Boolean).join(" ");

      return `
        <div class="${escapeEditorToolbarAttribute(className)}" role="toolbar" aria-label="${escapeEditorToolbarAttribute(ariaLabel)}">
          ${renderEditorToolbarInner(options)}
        </div>
      `;
    }

    return Object.freeze({
      renderEditorToolbar,
      renderEditorToolbarInner,
    });
  }

  return Object.freeze({
    createEditorToolbarMarkupRenderer,
  });
});

})();
