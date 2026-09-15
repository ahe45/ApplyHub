const assert = require('node:assert/strict');

async function waitForPath(page, pathname, timeout = 30000) {
  await page.waitForFunction((expectedPath) => location.pathname === expectedPath, { timeout }, pathname);
}

async function waitForVisible(page, selector, timeout = 30000) {
  await page.waitForSelector(selector, { visible: true, timeout });
}

async function clickFirstVisible(page, selector, timeout = 30000) {
  await page.waitForFunction((targetSelector) => {
    return Array.from(document.querySelectorAll(targetSelector)).some((element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
    });
  }, { timeout }, selector);
  await page.evaluate((targetSelector) => {
    const visibleElement = Array.from(document.querySelectorAll(targetSelector)).find((element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
    });

    if (!(visibleElement instanceof HTMLElement)) {
      throw new Error(`No visible element found for selector: ${targetSelector}`);
    }

    visibleElement.click();
  }, selector);
}

async function waitForHiddenClass(page, selector, timeout = 30000) {
  await page.waitForFunction((targetSelector) => {
    const element = document.querySelector(targetSelector);
    return Boolean(element) && element.classList.contains("hidden");
  }, { timeout }, selector);
}

async function navigateToView(page, view, pathname) {
  const navigationSelector = `.nav-item[data-view="${view}"]`;
  const hasNavigationItem = Boolean(await page.$(navigationSelector));

  if (hasNavigationItem) {
    try {
      await page.$eval(navigationSelector, (element) => {
        element.scrollIntoView({
          block: "center",
          inline: "center",
        });
      });
      await page.click(navigationSelector);
      await waitForPath(page, pathname);
    } catch (error) {
      await page.goto(new URL(pathname, page.url()).toString(), { waitUntil: "networkidle0" });
      await waitForPath(page, pathname);
    }
  } else {
    await page.goto(new URL(pathname, page.url()).toString(), { waitUntil: "networkidle0" });
    await waitForPath(page, pathname);
  }

  await page.waitForFunction(() => {
    const viewRoot = document.getElementById("viewRoot");
    return document.readyState === "complete" && Boolean(viewRoot) && viewRoot.innerHTML.trim().length > 0;
  });
}

async function selectEditorTableCell(page, {
  editorSelector,
  markup,
  cellSelector = "td, th",
}) {
  await page.evaluate(({ targetEditorSelector, targetMarkup, targetCellSelector }) => {
    const editor = document.querySelector(targetEditorSelector);

    if (!editor) {
      throw new Error(`Editor was not found for selector: ${targetEditorSelector}`);
    }

    editor.focus();
    editor.innerHTML = targetMarkup;

    const targetCell = editor.querySelector(targetCellSelector);

    if (!targetCell) {
      throw new Error(`Target table cell was not found for selector: ${targetCellSelector}`);
    }

    const range = document.createRange();
    const selection = window.getSelection();

    range.selectNodeContents(targetCell);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText" }));
  }, {
    targetEditorSelector: editorSelector,
    targetMarkup: markup,
    targetCellSelector: cellSelector,
  });
}

async function setTemplateEditorBorderControls(page, {
  target = "",
  style = "",
  width = "",
  color = "",
} = {}) {
  await page.evaluate(({ targetValue, styleValue, widthValue, colorValue }) => {
    const toolbar = window.AdmitCardEditorToolbar || {};
    const applySelectValue = (inputId, nextValue) => {
      if (!nextValue) {
        return;
      }

      if (typeof toolbar.applyEditorToolbarBorderSelectOption === "function") {
        toolbar.applyEditorToolbarBorderSelectOption(inputId, nextValue);
        return;
      }

      const selectElement = document.getElementById(inputId);

      if (selectElement) {
        selectElement.value = nextValue;
        selectElement.dataset.editorBorderUserValue = "true";
        selectElement.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };

    applySelectValue("templateEditorBorderTarget", targetValue);
    applySelectValue("templateEditorBorderStyle", styleValue);

    const widthInput = document.getElementById("templateEditorBorderWidth");

    if (widthInput && widthValue !== "") {
      widthInput.value = String(widthValue);
      widthInput.dataset.editorBorderUserValue = "true";
      widthInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    const colorInput = document.getElementById("templateEditorBorderColor");

    if (colorInput && colorValue) {
      colorInput.value = String(colorValue);
      colorInput.dataset.editorBorderUserValue = "true";
      colorInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, {
    targetValue: target,
    styleValue: style,
    widthValue: width,
    colorValue: color,
  });
}

async function getTemplateEditorCellBorderState(page, cellSelector) {
  return page.evaluate((selector) => {
    const cell = document.querySelector(selector);

    if (!(cell instanceof HTMLElement)) {
      throw new Error(`Template editor cell was not found for selector: ${selector}`);
    }

    const computedStyle = window.getComputedStyle(cell);
    const rect = cell.getBoundingClientRect();
    const rowRect = cell.closest("tr")?.getBoundingClientRect();
    const tableRect = cell.closest("table")?.getBoundingClientRect();

    return {
      borderBottomStyle: computedStyle.borderBottomStyle,
      borderBottomWidth: computedStyle.borderBottomWidth,
      borderLeftStyle: computedStyle.borderLeftStyle,
      borderLeftWidth: computedStyle.borderLeftWidth,
      borderRightStyle: computedStyle.borderRightStyle,
      borderRightWidth: computedStyle.borderRightWidth,
      borderTopColor: computedStyle.borderTopColor,
      borderTopStyle: computedStyle.borderTopStyle,
      borderTopWidth: computedStyle.borderTopWidth,
      height: rect.height,
      inlineStyle: cell.getAttribute("style") || "",
      overlayCount: cell.querySelectorAll("[data-template-double-border-overlay]").length,
      rowHeight: rowRect?.height || 0,
      tableWidth: tableRect?.width || 0,
      width: rect.width,
    };
  }, cellSelector);
}

async function selectEditorTableCellRange(page, {
  editorSelector,
  markup,
  anchorCellSelector = "td, th",
  focusCellSelector = "td, th",
  expectedSelectedCount = 1,
}) {
  await page.evaluate(({ targetEditorSelector, targetMarkup }) => {
    const editor = document.querySelector(targetEditorSelector);

    if (!editor) {
      throw new Error(`Editor was not found for selector: ${targetEditorSelector}`);
    }

    editor.focus();
    editor.innerHTML = targetMarkup;
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText" }));
  }, {
    targetEditorSelector: editorSelector,
    targetMarkup: markup,
  });

  const getCenter = async (selector) => page.$eval(selector, (element) => {
    element.scrollIntoView({ block: "center", inline: "center" });
    const rect = element.getBoundingClientRect();

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  });
  const anchorCenter = await getCenter(`${editorSelector} ${anchorCellSelector}`);
  const focusCenter = await getCenter(`${editorSelector} ${focusCellSelector}`);

  await page.mouse.move(anchorCenter.x, anchorCenter.y);
  await page.mouse.down();
  await page.mouse.move(focusCenter.x, focusCenter.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(
    ({ targetEditorSelector, selectedCount }) =>
      document.querySelectorAll(`${targetEditorSelector} .is-selected-cell`).length === selectedCount,
    {},
    {
      targetEditorSelector: editorSelector,
      selectedCount: expectedSelectedCount,
    },
  );
}

async function verifyTemplateEditor(page) {
    console.log("Template editor: preview, tags, cell splitting and borders");
    await navigateToView(page, "templateManagement", "/templates");
    const templateCountBefore = await page.$$eval(".template-card", (cards) => cards.length);
    await waitForVisible(page, "[data-add-template='true']");
    await clickFirstVisible(page, "[data-add-template='true']");
    await page.waitForFunction((countBefore) => document.querySelectorAll(".template-card").length === countBefore + 1, {}, templateCountBefore);
    const createdTemplateId = await page.$$eval(".template-card", (cards) => cards[cards.length - 1]?.dataset.templateId || "");
    assert(createdTemplateId, "New template card was not created.");
    await waitForVisible(page, `[data-template-preview="${createdTemplateId}"]`);
    await page.evaluate((templateId) => {
      const trigger = document.querySelector(`[data-template-preview="${templateId}"]`);

      if (!(trigger instanceof HTMLButtonElement)) {
        throw new Error("Template preview button was not found.");
      }

      trigger.click();
    }, createdTemplateId);
    await page.waitForFunction(() => !document.getElementById("templatePreviewModal").classList.contains("hidden"));
    await page.waitForFunction(() => {
      const stage = document.getElementById("templatePreviewStage");
      return Boolean(stage) && stage.innerHTML.trim().length > 0;
    });
    await page.click("#templatePreviewModal .icon-button[data-close-modal='true']");
    await waitForHiddenClass(page, "#templatePreviewModal");
    await waitForVisible(page, `[data-template-edit="${createdTemplateId}"]`);
    await page.evaluate((templateId) => {
      const trigger = document.querySelector(`[data-template-edit="${templateId}"]`);

      if (!(trigger instanceof HTMLButtonElement)) {
        throw new Error("Template edit button was not found.");
      }

      trigger.click();
    }, createdTemplateId);
    await page.waitForFunction(() => !document.getElementById("templateEditorModal").classList.contains("hidden"));
    await page.waitForFunction(() => {
      const surface = document.getElementById("templateEditorSurface");
      return Boolean(surface) && surface.innerHTML.trim().length > 0;
    });
    const tags = await page.$$eval('#templateTagStrip [data-template-tag]', nodes => nodes.map(node => node.dataset.templateTag));
    assert.deepEqual(tags.sort(), require('../shared/app-config').templateTagDefinitions.map(tag=>tag.editorToken).sort());
    assert.equal(await page.$eval('#templateEditorSurface', node => /시험날짜|고사건물|고사실|#시간|#조/.test(node.innerHTML)), false);
    await waitForVisible(page, "#templateEditorModal [data-template-cell-split-toggle]");
    assert(await page.$eval('#templateEditorModal .modal-sheet', el => getComputedStyle(el).backgroundColor === (document.documentElement.dataset.theme === 'dark' ? 'rgb(32, 52, 70)' : 'rgb(255, 255, 255)')), 'Editor chrome follows the selected Quiet Glass mode.');
    assert(await page.$eval('#templateEditorSurface', el => getComputedStyle(el).backgroundColor) === 'rgb(255, 255, 255)', 'The document remains white.');
    assert(await page.$eval('#templateEditorSurface table', el => getComputedStyle(el).backgroundColor) === 'rgb(250, 253, 255)', 'Document tables do not inherit the dark UI theme.');
    await selectEditorTableCell(page, {
      editorSelector: "#templateEditorSurface",
      markup: "<table><tbody><tr><td colspan='2'>열 분할</td></tr><tr><td>A</td><td>B</td></tr></tbody></table>",
      cellSelector: "td[colspan='2']",
    });
    await page.click("#templateEditorModal [data-template-cell-split-toggle]");
    await waitForVisible(page, "#templateEditorCellSplitPanel");
    await page.click("#templateEditorCellSplitPanel [data-template-cell-split-step='up']");
    await page.click("#templateEditorCellSplitPanel [data-template-cell-split-step='down']");
    const templateSplitCountAfterStep = await page.$eval("#templateEditorCellSplitCount", (input) => input.value);
    assert(templateSplitCountAfterStep === "2", "Template editor cell split stepper did not stay synchronized.");
    await page.click("#templateEditorCellSplitPanel [data-template-cell-split-confirm]");
    await page.waitForFunction(() => {
      const firstRow = document.querySelector("#templateEditorSurface table tr");
      return Boolean(firstRow) && firstRow.children.length === 2 && Array.from(firstRow.children).every((cell) => cell.colSpan === 1);
    });
    await waitForHiddenClass(page, "#templateEditorCellSplitPanel");

    await selectEditorTableCell(page, {
      editorSelector: "#templateEditorSurface",
      markup: "<table><tbody><tr><td rowspan='2'>행 분할</td><td>A</td></tr><tr><td>B</td></tr></tbody></table>",
      cellSelector: "td[rowspan='2']",
    });
    await page.click("#templateEditorModal [data-template-cell-split-toggle]");
    await waitForVisible(page, "#templateEditorCellSplitPanel");
    await page.click("label[for='templateEditorCellSplitAxisRow']");
    await page.click("#templateEditorCellSplitPanel [data-template-cell-split-confirm]");
    await page.waitForFunction(() => {
      const tableRows = Array.from(document.querySelectorAll("#templateEditorSurface table tr"));
      const splitCells = Array.from(document.querySelectorAll("#templateEditorSurface table td")).filter((cell) => cell.textContent.includes("행 분할"));
      return tableRows.length === 2 && splitCells.length === 1 && splitCells[0].rowSpan === 1 && tableRows[1]?.children.length === 2;
    });
    await waitForHiddenClass(page, "#templateEditorCellSplitPanel");

    const singleCellTableMarkup = `
      <table style="width: 320px; border-collapse: collapse; table-layout: fixed;">
        <tbody>
          <tr>
            <td style="border: 1px solid #222222; padding: 6px; height: 28px;">A1</td>
            <td style="border: 1px solid #222222; padding: 6px; height: 28px;">A2</td>
          </tr>
          <tr>
            <td style="border: 1px solid #222222; padding: 6px; height: 28px;">B1</td>
            <td style="border: 1px solid #222222; padding: 6px; height: 28px;">B2</td>
          </tr>
        </tbody>
      </table>
    `;
    const singleCellSelector = "#templateEditorSurface tbody tr:nth-child(1) td:nth-child(1)";
    const untouchedCellSelector = "#templateEditorSurface tbody tr:nth-child(2) td:nth-child(2)";

    await selectEditorTableCell(page, {
      editorSelector: "#templateEditorSurface",
      markup: singleCellTableMarkup,
      cellSelector: "tbody tr:nth-child(1) td:nth-child(1)",
    });
    await setTemplateEditorBorderControls(page, {
      target: "all",
      style: "double",
      width: "1",
      color: "#ff0000",
    });
    const borderBeforeApply = await getTemplateEditorCellBorderState(page, singleCellSelector);
    assert(
      borderBeforeApply.borderTopColor !== "rgb(255, 0, 0)",
      "Template editor border color was applied before pressing the border apply button.",
    );
    await page.click("#templateEditorModal button[data-template-table-action='apply-cell-border']");
    await page.waitForFunction((selector) => {
      const cell = document.querySelector(selector);
      return Boolean(cell) && window.getComputedStyle(cell).borderTopStyle === "double";
    }, {}, singleCellSelector);
    const singleCellDoubleBorder = await getTemplateEditorCellBorderState(page, singleCellSelector);
    const untouchedCellAfterSingleApply = await getTemplateEditorCellBorderState(page, untouchedCellSelector);
    const toolbarWidthAfterSingleDouble = await page.$eval("#templateEditorBorderWidth", (input) => input.value);
    assert(
      singleCellDoubleBorder.borderTopStyle === "double" &&
        singleCellDoubleBorder.borderTopWidth === "3px" &&
        singleCellDoubleBorder.borderTopColor === "rgb(255, 0, 0)" &&
        singleCellDoubleBorder.overlayCount === 0,
      "Template editor did not apply a 1px logical double border as a native 3px double line.",
    );
    assert(toolbarWidthAfterSingleDouble === "1", "Template editor toolbar did not keep logical 1px width after applying a 3px double border.");
    assert(
      untouchedCellAfterSingleApply.borderTopStyle !== "double" &&
        !untouchedCellAfterSingleApply.inlineStyle.includes("double"),
      "Template editor double border leaked into an unselected table cell.",
    );

    await setTemplateEditorBorderControls(page, {
      target: "all",
      style: "solid",
      width: "1",
    });
    await page.click("#templateEditorModal button[data-template-table-action='apply-cell-border']");
    await page.waitForFunction((selector) => {
      const cell = document.querySelector(selector);
      const computedStyle = cell ? window.getComputedStyle(cell) : null;
      return Boolean(computedStyle) && computedStyle.borderTopStyle === "solid" && computedStyle.borderTopWidth === "1px";
    }, {}, singleCellSelector);

    await setTemplateEditorBorderControls(page, {
      target: "all",
      style: "double",
      width: "4",
    });
    await page.click("#templateEditorModal button[data-template-table-action='apply-cell-border']");
    await page.waitForFunction((selector) => {
      const cell = document.querySelector(selector);
      const computedStyle = cell ? window.getComputedStyle(cell) : null;
      return Boolean(computedStyle) && computedStyle.borderTopStyle === "double" && computedStyle.borderTopWidth === "6px";
    }, {}, singleCellSelector);
    const toolbarWidthAfterWideDouble = await page.$eval("#templateEditorBorderWidth", (input) => input.value);
    assert(toolbarWidthAfterWideDouble === "4", "Template editor toolbar did not preserve the logical 4px width for a 6px native double border.");

    const mergedPhotoCellMarkup = `
      <table style="width: 360px; border-collapse: collapse; table-layout: fixed;">
        <tbody>
          <tr>
            <td data-smoke-photo-cell="true" rowspan="3" style="border: 1px solid #222222; padding: 6px; height: 96px;">수험생 사진</td>
            <td style="border: 1px solid #222222; padding: 6px; height: 28px;">이름</td>
          </tr>
          <tr>
            <td style="border: 1px solid #222222; padding: 6px; height: 28px;">전형</td>
          </tr>
          <tr>
            <td style="border: 1px solid #222222; padding: 6px; height: 28px;">모집단위</td>
          </tr>
        </tbody>
      </table>
    `;
    const mergedCellSelector = "#templateEditorSurface td[data-smoke-photo-cell='true']";

    await selectEditorTableCell(page, {
      editorSelector: "#templateEditorSurface",
      markup: mergedPhotoCellMarkup,
      cellSelector: "td[data-smoke-photo-cell='true']",
    });
    const mergedCellBeforeBorder = await getTemplateEditorCellBorderState(page, mergedCellSelector);
    await setTemplateEditorBorderControls(page, {
      target: "all",
      style: "double",
      width: "1",
      color: "#000000",
    });
    await page.click("#templateEditorModal button[data-template-table-action='apply-cell-border']");
    await page.waitForFunction((selector) => {
      const cell = document.querySelector(selector);
      return Boolean(cell) && window.getComputedStyle(cell).borderTopStyle === "double";
    }, {}, mergedCellSelector);
    const mergedCellAfterBorder = await getTemplateEditorCellBorderState(page, mergedCellSelector);
    assert(
      mergedCellAfterBorder.borderTopStyle === "double" &&
        mergedCellAfterBorder.borderTopWidth === "3px" &&
        mergedCellAfterBorder.width <= mergedCellBeforeBorder.width + 3 &&
        mergedCellAfterBorder.height <= mergedCellBeforeBorder.height + 3 &&
        mergedCellAfterBorder.tableWidth <= mergedCellBeforeBorder.tableWidth + 3,
      "Template editor double border caused an excessive size increase on a merged photo cell.",
    );

    const multiCellTableMarkup = `
      <table style="width: 320px; border-collapse: collapse; table-layout: fixed;">
        <tbody>
          <tr>
            <td style="border: 1px solid #222222; padding: 6px; height: 28px;">A1</td>
            <td style="border: 1px solid #222222; padding: 6px; height: 28px;">A2</td>
          </tr>
          <tr>
            <td style="border: 1px solid #222222; padding: 6px; height: 28px;">B1</td>
            <td style="border: 1px solid #222222; padding: 6px; height: 28px;">B2</td>
          </tr>
        </tbody>
      </table>
    `;

    await selectEditorTableCellRange(page, {
      editorSelector: "#templateEditorSurface",
      markup: multiCellTableMarkup,
      anchorCellSelector: "tbody tr:nth-child(1) td:nth-child(1)",
      focusCellSelector: "tbody tr:nth-child(1) td:nth-child(2)",
      expectedSelectedCount: 2,
    });
    await setTemplateEditorBorderControls(page, {
      target: "all",
      style: "double",
      width: "2",
    });
    await page.click("#templateEditorModal button[data-template-table-action='apply-cell-border']");
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("#templateEditorSurface tbody tr:nth-child(1) td"))
        .every((cell) => window.getComputedStyle(cell).borderTopStyle === "double"),
    );
    const multiCellFirst = await getTemplateEditorCellBorderState(page, "#templateEditorSurface tbody tr:nth-child(1) td:nth-child(1)");
    const multiCellSecond = await getTemplateEditorCellBorderState(page, "#templateEditorSurface tbody tr:nth-child(1) td:nth-child(2)");
    const multiCellUnselected = await getTemplateEditorCellBorderState(page, "#templateEditorSurface tbody tr:nth-child(2) td:nth-child(1)");
    const doubleBorderOverlayCount = await page.$$eval("#templateEditorSurface [data-template-double-border-overlay]", (elements) => elements.length);
    assert(
      multiCellFirst.borderTopStyle === "double" &&
        multiCellFirst.borderTopWidth === "4px" &&
        multiCellSecond.borderTopStyle === "double" &&
        multiCellSecond.borderTopWidth === "4px",
      "Template editor did not apply the logical 2px double border to every selected adjacent cell.",
    );
    assert(
      multiCellUnselected.borderTopStyle !== "double" &&
        !multiCellUnselected.inlineStyle.includes("double") &&
        doubleBorderOverlayCount === 0,
      "Template editor adjacent-cell double border affected unselected cells or left legacy overlay lines.",
    );
    await page.click("button[data-save-template-editor='true']");
    await waitForHiddenClass(page, "#templateEditorModal");
    await navigateToView(page, "templateManagement", "/templates");
    await waitForVisible(page, `[data-template-edit="${createdTemplateId}"]`);


}
module.exports = {verifyTemplateEditor};
