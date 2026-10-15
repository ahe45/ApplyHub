(function () {
(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.ExamListTemplateEditorTableObjectGeometry = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  let templateEditorObjectFlowIdCounter = 0;
  const candidateBlockTableHostSelector = "[data-candidate-block-instance], [data-candidate-block-column-name]";

  function createTemplateEditorTableObjectGeometryController({
    TEMPLATE_EDITOR_TABLE_MIN_SIZE,
    buildTemplateTableCellMap,
    ensureTemplateEditorTableColGroup,
    getTemplateEditorDocumentElement,
    getTemplateEditorMeasuredColumnWidth,
    isTemplateEditorTableObjectElement,
    parseTemplateEditorPixelStyle,
    syncTemplateEditorTableWidth,
  }) {
    function getTemplateEditorBoundedTableObjectCoordinate(value, maxValue) {
      const safeMax = Math.max(Math.round(maxValue) || 0, 0);

      return Math.min(Math.max(Math.round(value) || 0, 0), safeMax);
    }

    function normalizeTemplateEditorTableObjectEdgeCoordinate(value) {
      const roundedValue = Math.round(value) || 0;

      return Math.abs(roundedValue) <= 1 ? 0 : roundedValue;
    }

    function getTemplateEditorDocumentCoordinateOrigin(documentElement, scaleX = 1, scaleY = 1) {
      const rect = documentElement.getBoundingClientRect();
      const style = window.getComputedStyle(documentElement);
      const safeScaleX = Math.max(Number(scaleX) || 1, 0.01);
      const safeScaleY = Math.max(Number(scaleY) || 1, 0.01);

      return {
        left: rect.left + parseTemplateEditorPixelStyle(style.borderLeftWidth, 0) * safeScaleX,
        top: rect.top + parseTemplateEditorPixelStyle(style.borderTopWidth, 0) * safeScaleY,
      };
    }

    function normalizeTemplateEditorTableObjectResizeCorner(value) {
      return ["top-left", "top", "top-right", "right", "bottom-right", "bottom", "bottom-left", "left"].includes(value)
        ? value
        : "bottom-right";
    }

    function getTemplateEditorTableObjectResizeDirections(corner) {
      return {
        x: corner === "left" || corner.endsWith("left")
          ? -1
          : corner === "right" || corner.endsWith("right")
            ? 1
            : 0,
        y: corner === "top" || corner.startsWith("top")
          ? -1
          : corner === "bottom" || corner.startsWith("bottom")
            ? 1
            : 0,
      };
    }

    function getTemplateEditorTableObjectStylePixelValue(style, propertyName, fallback = 0) {
      return parseTemplateEditorPixelStyle(style?.getPropertyValue?.(propertyName) || style?.[propertyName] || "", fallback);
    }

    function isTemplateEditorTableObjectPixelLength(value = "") {
      return /^-?\d+(?:\.\d+)?px$/i.test(String(value || "").trim());
    }

    function getTemplateEditorObjectFlowId(objectElement, documentElement) {
      const existingId = String(objectElement?.dataset?.templateObjectFlowId || "").trim();

      if (existingId) {
        return existingId;
      }

      const usedIds = new Set(
        Array.from(documentElement?.querySelectorAll?.("[data-template-object-flow-id]") || [])
          .map((element) => String(element.dataset?.templateObjectFlowId || "").trim())
          .filter(Boolean),
      );
      let nextId = "";

      do {
        templateEditorObjectFlowIdCounter += 1;
        nextId = `template-object-flow-${Date.now().toString(36)}-${templateEditorObjectFlowIdCounter}`;
      } while (usedIds.has(nextId));

      objectElement.dataset.templateObjectFlowId = nextId;
      return nextId;
    }

    function getTemplateEditorObjectFlowSpacer(documentElement, flowId) {
      const normalizedFlowId = String(flowId || "").trim();

      if (!normalizedFlowId) {
        return null;
      }

      return Array.from(documentElement?.querySelectorAll?.("[data-template-object-flow-spacer]") || [])
        .find((element) => String(element.dataset?.templateObjectFlowId || "").trim() === normalizedFlowId) || null;
    }

    function applyTemplateEditorObjectFlowSpacerStyle(spacerElement) {
      if (!(spacerElement instanceof HTMLElement)) {
        return;
      }

      spacerElement.dataset.templateObjectFlowSpacer = "true";
      spacerElement.dataset.templateObjectFlowKind = "table";
      spacerElement.setAttribute("contenteditable", "false");
      spacerElement.setAttribute("aria-hidden", "true");
      spacerElement.style.display = "block";
      spacerElement.style.margin = "0";
      spacerElement.style.padding = "0";
      spacerElement.style.border = "0";
      spacerElement.style.clear = "both";
      spacerElement.style.fontSize = "0";
      spacerElement.style.lineHeight = "0";
      spacerElement.style.minHeight = "0";
      spacerElement.style.overflow = "hidden";
      spacerElement.style.pointerEvents = "none";
      spacerElement.style.userSelect = "none";
    }

    function ensureTemplateEditorTableObjectFlowSpacer(tableElement, documentElement) {
      if (!(tableElement instanceof HTMLElement) || !(documentElement instanceof HTMLElement)) {
        return null;
      }

      const flowId = getTemplateEditorObjectFlowId(tableElement, documentElement);
      let spacerElement = getTemplateEditorObjectFlowSpacer(documentElement, flowId);

      if (!(spacerElement instanceof HTMLElement)) {
        spacerElement = documentElement.ownerDocument.createElement("div");
        spacerElement.dataset.templateObjectFlowId = flowId;

        let referenceElement = tableElement;

        while (referenceElement.parentElement && referenceElement.parentElement !== documentElement) {
          referenceElement = referenceElement.parentElement;
        }

        if (referenceElement.parentElement === documentElement) {
          documentElement.insertBefore(spacerElement, referenceElement);
        } else {
          documentElement.append(spacerElement);
        }
      }

      applyTemplateEditorObjectFlowSpacerStyle(spacerElement);
      return spacerElement;
    }

    function syncTemplateEditorTableObjectFlowSpacer(tableElement, geometry = {}) {
      return globalThis.ExamListTemplateEditorObjectFlowReflow?.reflowTemplateEditorObjectRows(tableElement, {
        documentElement: getTemplateEditorDocumentElement(),
        activeTop: geometry.top,
        activeHeight: geometry.height,
        reorderByPosition: false,
      })?.spacerElement || null;
    }

    function removeTemplateEditorTableObjectFlowSpacer(tableElement) {
      const documentElement = getTemplateEditorDocumentElement();
      const flowId = String(tableElement?.dataset?.templateObjectFlowId || "").trim();
      const spacerElement = getTemplateEditorObjectFlowSpacer(documentElement, flowId);

      spacerElement?.remove();
      tableElement?.removeAttribute?.("data-template-object-flow-id");
    }

    function getTemplateEditorTableObjectLineHeightPixelValue(style, fontSize) {
      const rawLineHeight = String(style?.lineHeight || "").trim();
      const numericLineHeight = Number.parseFloat(rawLineHeight);

      if (!rawLineHeight || rawLineHeight === "normal") {
        return fontSize * 1.2;
      }

      if (Number.isFinite(numericLineHeight) && /^-?\d+(?:\.\d+)?$/.test(rawLineHeight)) {
        return fontSize * numericLineHeight;
      }

      return parseTemplateEditorPixelStyle(rawLineHeight, fontSize * 1.2);
    }

    function getTemplateEditorTableObjectCellMinimumSize(cellElement, axis) {
      if (!(cellElement instanceof HTMLElement)) {
        return TEMPLATE_EDITOR_TABLE_MIN_SIZE;
      }

      const style = window.getComputedStyle(cellElement);

      if (axis === "column") {
        return Math.max(
          1,
          Math.ceil(
            getTemplateEditorTableObjectStylePixelValue(style, "border-left-width") +
              getTemplateEditorTableObjectStylePixelValue(style, "border-right-width") +
              getTemplateEditorTableObjectStylePixelValue(style, "padding-left") +
              getTemplateEditorTableObjectStylePixelValue(style, "padding-right"),
          ),
        );
      }

      const fontSize = getTemplateEditorTableObjectStylePixelValue(style, "font-size", 11);

      return Math.max(
        1,
        Math.ceil(
          getTemplateEditorTableObjectStylePixelValue(style, "border-top-width") +
            getTemplateEditorTableObjectStylePixelValue(style, "border-bottom-width") +
            getTemplateEditorTableObjectStylePixelValue(style, "padding-top") +
            getTemplateEditorTableObjectStylePixelValue(style, "padding-bottom") +
            getTemplateEditorTableObjectLineHeightPixelValue(style, fontSize),
        ),
      );
    }

    function getTemplateEditorTableObjectSegmentMinimumSize(tableElement, axis) {
      if (!tableElement.closest(candidateBlockTableHostSelector)) {
        return TEMPLATE_EDITOR_TABLE_MIN_SIZE;
      }

      const { entries } = buildTemplateTableCellMap(tableElement);
      let minimumSize = 1;

      entries.forEach((entry, cellElement) => {
        const span = axis === "column" ? entry.colSpan : entry.rowSpan;
        const cellMinimumSize = getTemplateEditorTableObjectCellMinimumSize(cellElement, axis);

        minimumSize = Math.max(minimumSize, Math.ceil(cellMinimumSize / Math.max(1, span || 1)));
      });

      return minimumSize;
    }

    function getTemplateEditorTableObjectColumnWidths(tableElement, columns, cellMap) {
      const minimumSize = getTemplateEditorTableObjectSegmentMinimumSize(tableElement, "column");

      return columns.map((columnElement, columnIndex) =>
        Math.max(
          minimumSize,
          parseTemplateEditorPixelStyle(
            columnElement.style.width,
            getTemplateEditorMeasuredColumnWidth(cellMap, columnIndex),
          ),
        ),
      );
    }

    function getTemplateEditorTableObjectRowHeights(tableElement) {
      const minimumSize = getTemplateEditorTableObjectSegmentMinimumSize(tableElement, "row");
      const rows = Array.from(tableElement?.rows || []);
      const configuredHeights = rows.map((rowElement) =>
        Math.max(
          minimumSize,
          parseTemplateEditorPixelStyle(rowElement.style.height, Math.round(rowElement.getBoundingClientRect().height || 0)),
        ),
      );
      const configuredTotalHeight = configuredHeights.reduce((heightSum, height) => heightSum + Math.max(0, height || 0), 0);
      const renderedTableHeight = Math.round(tableElement?.getBoundingClientRect?.().height || 0);

      if (renderedTableHeight > configuredTotalHeight + 2) {
        return rows.map((rowElement) =>
          Math.max(minimumSize, Math.round(rowElement.getBoundingClientRect?.().height || 0)),
        );
      }

      return configuredHeights;
    }

    function normalizeTemplateEditorTableObjectSegmentSizes(
      sizes,
      targetSize,
      minimumSize = TEMPLATE_EDITOR_TABLE_MIN_SIZE,
      { fitTarget = false } = {},
    ) {
      const itemCount = Math.max(1, sizes.length);
      const requestedTargetSize = Math.round(targetSize);
      const safeMinimumSize = fitTarget
        ? Math.max(1, Math.min(Math.round(minimumSize) || 1, Math.floor(Math.max(itemCount, requestedTargetSize) / itemCount) || 1))
        : Math.max(1, Math.round(minimumSize) || 1);
      const safeTargetSize = fitTarget
        ? Math.max(itemCount, requestedTargetSize)
        : Math.max(safeMinimumSize * itemCount, requestedTargetSize);
      const normalizedSizes = sizes.map((size) => Math.max(safeMinimumSize, Math.round(Number(size) || 0)));

      if (sizes.length === 0) {
        return [];
      }

      const isEvenSource =
        normalizedSizes.length > 0 &&
        Math.max(...normalizedSizes) - Math.min(...normalizedSizes) <= 1;

      if (isEvenSource) {
        const baseSize = Math.max(safeMinimumSize, Math.floor(safeTargetSize / itemCount));
        let remainder = safeTargetSize - baseSize * itemCount;

        return Array.from({ length: itemCount }, () => {
          const nextSize = baseSize + (remainder > 0 ? 1 : 0);

          remainder -= 1;
          return Math.max(safeMinimumSize, nextSize);
        });
      }

      const extraSizes = normalizedSizes.map((size) => Math.max(0, size - safeMinimumSize));
      const totalExtraSize = extraSizes.reduce((sizeSum, size) => sizeSum + size, 0);
      const targetExtraSize = safeTargetSize - safeMinimumSize * itemCount;
      let usedSize = 0;
      const nextSizes = normalizedSizes.map((_size, index) => {
        const isLast = index === normalizedSizes.length - 1;
        const nextSize =
          isLast
            ? safeTargetSize - usedSize
            : safeMinimumSize +
              Math.round(targetExtraSize * (totalExtraSize > 0 ? extraSizes[index] / totalExtraSize : 1 / itemCount));

        usedSize += nextSize;
        return Math.max(safeMinimumSize, nextSize);
      });
      let overflow = nextSizes.reduce((sizeSum, size) => sizeSum + size, 0) - safeTargetSize;

      for (let index = nextSizes.length - 1; index >= 0 && overflow > 0; index -= 1) {
        const reduction = Math.min(overflow, Math.max(0, nextSizes[index] - safeMinimumSize));

        nextSizes[index] -= reduction;
        overflow -= reduction;
      }

      const deficit = safeTargetSize - nextSizes.reduce((sizeSum, size) => sizeSum + size, 0);

      if (deficit > 0) {
        nextSizes[nextSizes.length - 1] += deficit;
      }

      return nextSizes;
    }

    function syncTemplateEditorTableObjectRowGroupHeights(tableElement, rowHeights) {
      if (!(tableElement instanceof HTMLTableElement) || !Array.isArray(rowHeights)) {
        return;
      }

      const rowIndexByElement = new Map(Array.from(tableElement.rows || []).map((rowElement, rowIndex) => [rowElement, rowIndex]));
      const rowGroups = [
        tableElement.tHead,
        ...Array.from(tableElement.tBodies || []),
        tableElement.tFoot,
      ].filter(Boolean);

      rowGroups.forEach((rowGroupElement) => {
        const rowGroupHeight = Array.from(rowGroupElement.rows || []).reduce((heightSum, rowElement) => {
          const rowIndex = rowIndexByElement.get(rowElement);

          return heightSum + Math.max(0, rowHeights[rowIndex] || 0);
        }, 0);

        if (rowGroupHeight > 0) {
          rowGroupElement.style.height = `${rowGroupHeight}px`;
        }
      });
    }

    function applyTemplateEditorTableObjectWidth(tableElement, targetWidth) {
      if (!isTemplateEditorTableObjectElement(tableElement)) {
        return false;
      }

      const { columns, cellMap } = ensureTemplateEditorTableColGroup(tableElement);
      const isCandidateBlockTable = Boolean(tableElement.closest(candidateBlockTableHostSelector));

      if (!columns.length) {
        tableElement.style.width = `${Math.max(getTemplateEditorTableObjectSegmentMinimumSize(tableElement, "column"), Math.round(targetWidth))}px`;
        tableElement.style.maxWidth = "none";
        return true;
      }

      const minimumColumnWidth = getTemplateEditorTableObjectSegmentMinimumSize(tableElement, "column");
      const nextWidths = normalizeTemplateEditorTableObjectSegmentSizes(
        getTemplateEditorTableObjectColumnWidths(tableElement, columns, cellMap),
        targetWidth,
        minimumColumnWidth,
        { fitTarget: isCandidateBlockTable },
      );

      columns.forEach((columnElement, columnIndex) => {
        columnElement.style.width = `${nextWidths[columnIndex] || minimumColumnWidth}px`;
      });
      buildTemplateTableCellMap(tableElement).entries.forEach((entry, cellElement) => {
        const cellWidth = nextWidths
          .slice(entry.colIndex, entry.colIndex + entry.colSpan)
          .reduce((widthSum, width) => widthSum + Math.max(0, width || 0), 0);

        if (cellWidth > 0) {
          cellElement.style.width = `${cellWidth}px`;
        }
      });
      syncTemplateEditorTableWidth(tableElement, columns);
      return true;
    }

    function applyTemplateEditorTableObjectHeight(tableElement, targetHeight) {
      if (!isTemplateEditorTableObjectElement(tableElement)) {
        return false;
      }

      const rows = Array.from(tableElement.rows || []);
      const isCandidateBlockTable = Boolean(tableElement.closest(candidateBlockTableHostSelector));

      if (!rows.length) {
        tableElement.style.height = `${Math.max(getTemplateEditorTableObjectSegmentMinimumSize(tableElement, "row"), Math.round(targetHeight))}px`;
        return true;
      }

      const minimumRowHeight = getTemplateEditorTableObjectSegmentMinimumSize(tableElement, "row");
      const nextHeights = normalizeTemplateEditorTableObjectSegmentSizes(
        getTemplateEditorTableObjectRowHeights(tableElement),
        targetHeight,
        minimumRowHeight,
        { fitTarget: isCandidateBlockTable },
      );

      rows.forEach((rowElement, rowIndex) => {
        rowElement.style.height = `${nextHeights[rowIndex] || minimumRowHeight}px`;
      });
      buildTemplateTableCellMap(tableElement).entries.forEach((entry, cellElement) => {
        const cellHeight = nextHeights
          .slice(entry.rowIndex, entry.rowIndex + entry.rowSpan)
          .reduce((heightSum, height) => heightSum + Math.max(0, height || 0), 0);

        if (cellHeight > 0) {
          cellElement.style.height = `${cellHeight}px`;
          cellElement.style.minHeight = tableElement.closest(candidateBlockTableHostSelector) ? "0" : `${cellHeight}px`;
        }
      });
      syncTemplateEditorTableObjectRowGroupHeights(tableElement, nextHeights);
      tableElement.style.height = `${nextHeights.reduce((heightSum, height) => heightSum + Math.max(0, height || 0), 0)}px`;
      return true;
    }

    function prepareTemplateEditorTableObjectForMove(tableElement, { applyHeight = true, applyWidth = true, syncSegments = true } = {}) {
      const documentElement = getTemplateEditorDocumentElement();

      if (!isTemplateEditorTableObjectElement(tableElement) || !documentElement?.contains(tableElement)) {
        return null;
      }

      if (tableElement.closest(candidateBlockTableHostSelector)) {
        return null;
      }

      const tableRect = tableElement.getBoundingClientRect();
      const documentRect = documentElement.getBoundingClientRect();
      const width = Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, tableElement.offsetWidth || Math.floor(tableRect.width || 0));
      const height = Math.max(TEMPLATE_EDITOR_TABLE_MIN_SIZE, tableElement.offsetHeight || Math.floor(tableRect.height || 0));
      const scaleX = width > 0 ? Math.max(tableRect.width / width, 0.01) : 1;
      const scaleY = height > 0 ? Math.max(tableRect.height / height, 0.01) : 1;
      const documentOrigin = getTemplateEditorDocumentCoordinateOrigin(documentElement, scaleX, scaleY);
      const shouldApplyWidth = applyWidth || !isTemplateEditorTableObjectPixelLength(tableElement.style.width);
      const shouldApplyHeight = applyHeight || !isTemplateEditorTableObjectPixelLength(tableElement.style.height);
      const left =
        tableElement.style.position === "absolute"
          ? getTemplateEditorBoundedTableObjectCoordinate(
              normalizeTemplateEditorTableObjectEdgeCoordinate(
                parseTemplateEditorPixelStyle(tableElement.style.left, tableElement.offsetLeft),
              ),
              documentElement.clientWidth - width,
            )
          : getTemplateEditorBoundedTableObjectCoordinate(
              (tableRect.left - documentOrigin.left) / scaleX,
              documentElement.clientWidth - width,
            );
      const top =
        tableElement.style.position === "absolute"
          ? getTemplateEditorBoundedTableObjectCoordinate(
              normalizeTemplateEditorTableObjectEdgeCoordinate(
                parseTemplateEditorPixelStyle(tableElement.style.top, tableElement.offsetTop),
              ),
              documentElement.clientHeight - height,
            )
          : getTemplateEditorBoundedTableObjectCoordinate(
              (tableRect.top - documentOrigin.top) / scaleY,
              documentElement.clientHeight - height,
            );

      tableElement.style.position = "absolute";
      tableElement.style.left = `${left}px`;
      tableElement.style.top = `${top}px`;
      tableElement.style.margin = "0";
      tableElement.style.maxWidth = "none";
      tableElement.style.zIndex = "2";

      if (shouldApplyWidth) {
        tableElement.style.width = `${width}px`;
        if (syncSegments) {
          applyTemplateEditorTableObjectWidth(tableElement, width);
        }
      }

      if (shouldApplyHeight) {
        tableElement.style.height = `${height}px`;
        if (syncSegments) {
          applyTemplateEditorTableObjectHeight(tableElement, height);
        }
      }

      if (tableElement.parentElement !== documentElement) {
        documentElement.append(tableElement);
      }

      syncTemplateEditorTableObjectFlowSpacer(tableElement, { height, top });

      return {
        height,
        left,
        top,
        width,
      };
    }

    return Object.freeze({
      applyTemplateEditorTableObjectHeight,
      applyTemplateEditorTableObjectWidth,
      getTemplateEditorBoundedTableObjectCoordinate,
      getTemplateEditorTableObjectResizeDirections,
      normalizeTemplateEditorTableObjectResizeCorner,
      prepareTemplateEditorTableObjectForMove,
      removeTemplateEditorTableObjectFlowSpacer,
      syncTemplateEditorTableObjectFlowSpacer,
    });
  }

  return Object.freeze({
    createTemplateEditorTableObjectGeometryController,
  });
});

})();
