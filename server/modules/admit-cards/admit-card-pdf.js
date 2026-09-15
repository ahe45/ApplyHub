const fs = require("fs");
const os = require("os");

const AdmZip = require("adm-zip");
const { PDFDocument } = require("pdf-lib");
const puppeteer = require("puppeteer-core");

const templatePageSettings = require("../../../client/features/template-editor/page-settings");

const PRINT_PAGE_WIDTH_PX = 794;
const PRINT_PAGE_HEIGHT_PX = 1123;
const PDF_RENDER_TIMEOUT_MS = 60000;
const PDF_BROWSER_LAUNCH_ARGS = Object.freeze([
  "--disable-gpu",
  "--no-sandbox",
]);
const DEFAULT_BATCH_ADMIT_CARD_ZIP_MAX_WORKERS = 6;
const BATCH_ADMIT_CARD_ZIP_PARALLEL_MIN_COUNT = 4;
const DEFAULT_BATCH_ADMIT_CARD_ZIP_CHUNK_SIZE = 40;
const DEFAULT_SMALL_BATCH_ADMIT_CARD_ZIP_MAX_WORKERS = 4;
const DEFAULT_SMALL_BATCH_ADMIT_CARD_ZIP_CHUNK_SIZE = 28;
const DEFAULT_SMALL_BATCH_ADMIT_CARD_ZIP_MAX_COUNT = 128;
const ZIP_ENTRY_METHOD_STORED = 0;
const ZIP_ENTRY_METHOD_DEFLATED = 8;
const BATCH_ADMIT_CARD_CANCELLED_ERROR_CODE = "BATCH_JOB_CANCELLED";
const BATCH_ADMIT_CARD_CANCELLED_MESSAGE = "수험표 파일 생성을 취소했습니다.";
const ADMIT_CARD_PDF_RENDER_ROOT_ID = "admit-card-pdf-render-root";

function createAdmitCardPdfService({
  createHttpError,
  createTemplateExamineeRenderer,
  edgeExecutablePaths,
  escapeHtml,
  getActiveTemplate,
  getExamineeByNo,
  getExamineesByNos,
  normalizeExamineeNoList,
  renderTemplateWithExaminee,
}) {
  function getPdfExecutablePath() {
    const executablePath = edgeExecutablePaths.find((possiblePath) => fs.existsSync(possiblePath));

    if (!executablePath) {
      throw createHttpError(500, "PDF 생성을 위한 Microsoft Edge 실행 파일을 찾을 수 없습니다.");
    }

    return executablePath;
  }

  function createBatchAdmitCardCancelledError() {
    const error = new Error(BATCH_ADMIT_CARD_CANCELLED_MESSAGE);

    error.code = BATCH_ADMIT_CARD_CANCELLED_ERROR_CODE;
    return error;
  }

  function throwIfBatchAdmitCardCancelled(options = {}) {
    if (typeof options.shouldCancel === "function" && options.shouldCancel()) {
      throw createBatchAdmitCardCancelledError();
    }
  }

  async function closePdfBrowser(browser) {
    if (!browser) {
      return;
    }

    try {
      await browser.close();
    } catch (error) {
    }
  }

  function getConfiguredPositiveInteger(rawValue, fallbackValue) {
    const normalizedValue = Math.round(Number(rawValue));

    if (!Number.isFinite(normalizedValue) || normalizedValue < 1) {
      return Math.max(1, Math.round(Number(fallbackValue || 1)));
    }

    return normalizedValue;
  }

  function getDefaultSmallBatchAdmitCardZipMaxCount() {
    return getConfiguredPositiveInteger(
      process.env.BATCH_ADMIT_CARD_ZIP_SMALL_MAX_COUNT,
      DEFAULT_SMALL_BATCH_ADMIT_CARD_ZIP_MAX_COUNT,
    );
  }

  function getDefaultBatchAdmitCardZipChunkSize(totalCount) {
    const normalizedTotalCount = Math.max(1, Math.round(Number(totalCount || 0)));
    const smallBatchMaxCount = getDefaultSmallBatchAdmitCardZipMaxCount();

    if (normalizedTotalCount <= smallBatchMaxCount) {
      return DEFAULT_SMALL_BATCH_ADMIT_CARD_ZIP_CHUNK_SIZE;
    }

    return DEFAULT_BATCH_ADMIT_CARD_ZIP_CHUNK_SIZE;
  }

  function getDefaultBatchAdmitCardZipMaxWorkers(totalCount) {
    const normalizedTotalCount = Math.max(1, Math.round(Number(totalCount || 0)));
    const smallBatchMaxCount = getDefaultSmallBatchAdmitCardZipMaxCount();

    if (normalizedTotalCount <= smallBatchMaxCount) {
      return DEFAULT_SMALL_BATCH_ADMIT_CARD_ZIP_MAX_WORKERS;
    }

    return DEFAULT_BATCH_ADMIT_CARD_ZIP_MAX_WORKERS;
  }

  function getBatchAdmitCardZipChunkSize(totalCount) {
    const configuredChunkSize = getConfiguredPositiveInteger(
      process.env.BATCH_ADMIT_CARD_ZIP_CHUNK_SIZE,
      getDefaultBatchAdmitCardZipChunkSize(totalCount),
    );
    const normalizedTotalCount = Math.max(1, Math.round(Number(totalCount || 0)));

    return Math.max(1, Math.min(configuredChunkSize, normalizedTotalCount));
  }

  function normalizeBatchAdmitCardZipEntryMethod(value) {
    const normalizedValue = String(value || "").trim().toLowerCase();

    if (normalizedValue === "stored" || normalizedValue === "store" || normalizedValue === "none") {
      return ZIP_ENTRY_METHOD_STORED;
    }

    if (normalizedValue === "deflated" || normalizedValue === "deflate" || normalizedValue === "compressed") {
      return ZIP_ENTRY_METHOD_DEFLATED;
    }

    return null;
  }

  function getBatchAdmitCardZipEntryMethod(totalCount) {
    const configuredMethod = normalizeBatchAdmitCardZipEntryMethod(process.env.BATCH_ADMIT_CARD_ZIP_ENTRY_METHOD);

    if (configuredMethod !== null) {
      return configuredMethod;
    }

    return ZIP_ENTRY_METHOD_DEFLATED;
  }

  function getBatchAdmitCardZipWorkerCount(totalCount, chunkSize = getBatchAdmitCardZipChunkSize(totalCount)) {
    const normalizedTotalCount = Math.max(1, Math.round(Number(totalCount || 0)));

    if (normalizedTotalCount < BATCH_ADMIT_CARD_ZIP_PARALLEL_MIN_COUNT) {
      return 1;
    }

    const availableParallelism =
      typeof os.availableParallelism === "function"
        ? os.availableParallelism()
        : Array.isArray(os.cpus?.()) && os.cpus().length > 0
          ? os.cpus().length
          : 1;
    const configuredMaxWorkers = getConfiguredPositiveInteger(
      process.env.BATCH_ADMIT_CARD_ZIP_MAX_WORKERS,
      getDefaultBatchAdmitCardZipMaxWorkers(normalizedTotalCount),
    );
    const chunkLimitedWorkerCount = Math.max(1, Math.ceil(normalizedTotalCount / Math.max(1, Number(chunkSize || 1))));

    return Math.max(
      1,
      Math.min(
        configuredMaxWorkers,
        normalizedTotalCount,
        chunkLimitedWorkerCount,
        Math.max(1, Number(availableParallelism || 1)),
      ),
    );
  }

  function getTemplateDocumentStyles() {
    return `
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        font-family: "Noto Sans KR", sans-serif;
        color: #152033;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .template-render-sheet {
        width: 794px;
        min-height: 1123px;
        margin: 0;
        padding: 44px 46px;
        border-radius: 0;
        background: #ffffff;
      }
      .template-render-sheet:not(:last-child) {
        break-after: page;
        page-break-after: always;
      }
      .template-render-sheet .template-doc {
        position: relative;
        min-height: 100%;
      }
      .template-render-sheet h1,
      .template-render-sheet h2,
      .template-render-sheet h3,
      .template-render-sheet p { margin-top: 0; }
      .template-render-sheet img { max-width: 100%; height: auto; display: block; }
      .template-render-sheet .examinee-photo-token-image {
        width: 100%;
        max-width: 100%;
        height: 100%;
        min-height: 120px;
        object-fit: cover;
      }
      .template-render-sheet td.examinee-photo-token-cell,
      .template-render-sheet th.examinee-photo-token-cell {
        position: relative;
        overflow: hidden;
        padding: 0 !important;
        line-height: 0;
        text-align: center;
        vertical-align: middle;
      }
      .template-render-sheet .examinee-photo-token-cell .examinee-photo-token-image {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        min-height: 100%;
        max-width: none;
        max-height: none;
        margin: 0;
        object-fit: contain;
        background: #ffffff;
      }
      .template-render-sheet .examinee-photo-token-cell .examinee-photo-placeholder {
        position: absolute;
        inset: 0;
        width: 100%;
        max-width: none;
        margin: 0;
      }
      .template-render-sheet .template-generated-object {
        background: #ffffff;
      }
      .template-render-sheet .template-generated-object-barcode {
        object-fit: fill;
      }
      .template-render-sheet .template-generated-object-qrcode {
        object-fit: contain;
      }
      .template-render-sheet .template-data-fit {
        display: inline;
      }
      .template-render-sheet .examinee-photo-placeholder {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 120px;
        padding: 12px;
        border: 1px dashed rgba(138, 154, 181, 0.92);
        color: #53627a;
        font-size: 13px;
        font-weight: 700;
        text-align: center;
        background: rgba(246, 248, 252, 0.92);
      }
      .template-render-sheet table { width: 100%; border-collapse: collapse; margin: 16px 0; table-layout: fixed; }
      .template-render-sheet th,
      .template-render-sheet td { border: 1px solid #000000; padding: 5px 6px; text-align: left; vertical-align: top; }
      .template-render-sheet hr { border: 0; border-top: 1px solid #d8e0ea; margin: 18px 0; }
    `;
  }

  function getTemplateDocumentScript() {
    return `
      (() => {
        const MIN_SCALE = 0.7;
        const STEP_PX = 0.5;
        const BASE_FONT_SIZE_DATASET_KEY = "templateDataFitBaseFontSize";
        const RENDER_ROOT_ID = ${JSON.stringify(ADMIT_CARD_PDF_RENDER_ROOT_ID)};

        function getTextRectCount(element) {
          if (!(element instanceof HTMLElement)) {
            return 0;
          }

          const range = document.createRange();
          range.selectNodeContents(element);
          const rectCount = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0).length;
          range.detach?.();
          return rectCount;
        }

        function isWrapped(element) {
          if (!(element instanceof HTMLElement) || !element.isConnected) {
            return false;
          }

          return getTextRectCount(element) > 1;
        }

        function fitTemplateDataValue(element) {
          if (!(element instanceof HTMLElement) || !element.textContent?.trim()) {
            return;
          }

          const storedBaseFontSize = Number.parseFloat(element.dataset[BASE_FONT_SIZE_DATASET_KEY] || "");
          const computedFontSize = Number.parseFloat(window.getComputedStyle(element).fontSize);
          const baseFontSize =
            Number.isFinite(storedBaseFontSize) && storedBaseFontSize > 0 ? storedBaseFontSize : computedFontSize;

          if (!Number.isFinite(baseFontSize) || baseFontSize <= 0) {
            return;
          }

          element.dataset[BASE_FONT_SIZE_DATASET_KEY] = String(baseFontSize);
          const minFontSize = baseFontSize * MIN_SCALE;
          let nextFontSize = baseFontSize;

          element.style.fontSize = baseFontSize + "px";

          if (!isWrapped(element)) {
            element.style.removeProperty("font-size");
            return;
          }

          while (nextFontSize > minFontSize) {
            nextFontSize = Math.max(minFontSize, nextFontSize - STEP_PX);
            element.style.fontSize = nextFontSize + "px";

            if (!isWrapped(element)) {
              break;
            }
          }
        }

        function fitAllTemplateDataValues() {
          document.querySelectorAll("[data-template-data-fit='true']").forEach((element) => {
            fitTemplateDataValue(element);
          });
        }

        window.__admitCardFitTemplateData = fitAllTemplateDataValues;
        window.__admitCardReplaceSheets = (title, sheetMarkup) => {
          const renderRoot = document.getElementById(RENDER_ROOT_ID);

          document.title = String(title || document.title || "수험표");

          if (renderRoot instanceof HTMLElement) {
            renderRoot.innerHTML = String(sheetMarkup || "");
          }

          fitAllTemplateDataValues();
        };

        document.addEventListener("DOMContentLoaded", () => {
          window.requestAnimationFrame(fitAllTemplateDataValues);
        });

        window.addEventListener("load", () => {
          fitAllTemplateDataValues();
        });
      })();
    `;
  }

  function buildAdmitCardDocumentSheetMarkup(renderedSheets) {
    return (Array.isArray(renderedSheets) ? renderedSheets : [renderedSheets])
      .map((renderedHtml) => {
        const pageSettings = templatePageSettings.getTemplatePageSettingsFromHtml(renderedHtml);
        const renderAttributes = templatePageSettings.getTemplatePageRenderAttributes(pageSettings);

        return `
          <article class="template-render-sheet" ${renderAttributes}>
            ${renderedHtml}
          </article>
        `;
      })
      .join("");
  }

  function buildAdmitCardDocumentHtml(title) {
    return `
      <!DOCTYPE html>
      <html lang="ko">
        <head>
          <meta charset="UTF-8" />
          <title>${escapeHtml(title)}</title>
          <style>${getTemplateDocumentStyles()}</style>
          <script>${getTemplateDocumentScript()}</script>
        </head>
        <body>
          <main id="${ADMIT_CARD_PDF_RENDER_ROOT_ID}"></main>
        </body>
      </html>
    `;
  }

  function getPdfPageOptions(pageDimensions = null) {
    const normalizedDimensions =
      pageDimensions && Number(pageDimensions.width) > 0 && Number(pageDimensions.height) > 0
        ? {
            width: `${Math.round(Number(pageDimensions.width))}px`,
            height: `${Math.round(Number(pageDimensions.height))}px`,
          }
        : null;

    return {
      printBackground: true,
      preferCSSPageSize: !normalizedDimensions,
      displayHeaderFooter: false,
      ...(normalizedDimensions || {}),
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
    };
  }

  async function openPdfBrowser() {
    return puppeteer.launch({
      executablePath: getPdfExecutablePath(),
      headless: "new",
      args: PDF_BROWSER_LAUNCH_ARGS,
    });
  }

  async function initializePdfBrowserPage(page) {
    await page.setContent(buildAdmitCardDocumentHtml("수험표"), {
      waitUntil: "domcontentloaded",
      timeout: PDF_RENDER_TIMEOUT_MS,
    });
  }

  async function createPdfBrowserPage(browser) {
    const page = await browser.newPage();

    await page.setViewport({
      width: PRINT_PAGE_WIDTH_PX,
      height: PRINT_PAGE_HEIGHT_PX,
    });
    await page.emulateMediaType("print");
    await initializePdfBrowserPage(page);

    return page;
  }

  async function openPdfBrowserPage() {
    const browser = await openPdfBrowser();
    const page = await createPdfBrowserPage(browser);

    return {
      browser,
      page,
    };
  }

  async function waitForTemplateDocumentReady(page) {
    await page.evaluate(async () => {
      const pendingImages = Array.from(document.images || [])
        .filter((image) => !image.complete)
        .map(
          (image) =>
            new Promise((resolve) => {
              image.addEventListener("load", resolve, { once: true });
              image.addEventListener("error", resolve, { once: true });
            }),
        );

      if (document.fonts?.ready) {
        try {
          await document.fonts.ready;
        } catch (error) {
        }
      }

      if (pendingImages.length > 0) {
        await Promise.allSettled(pendingImages);
      }

      if (typeof window.__admitCardFitTemplateData === "function") {
        window.__admitCardFitTemplateData();
      }

      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      });
    });
  }

  async function renderPdfDocumentInPage(page, title, renderedSheets) {
    const sheetMarkup = buildAdmitCardDocumentSheetMarkup(renderedSheets);

    await page.evaluate(
      ({ nextTitle, nextSheetMarkup, renderRootId }) => {
        if (typeof window.__admitCardReplaceSheets === "function") {
          window.__admitCardReplaceSheets(nextTitle, nextSheetMarkup);
          return;
        }

        document.title = String(nextTitle || document.title || "수험표");

        const renderRoot = document.getElementById(renderRootId);

        if (renderRoot instanceof HTMLElement) {
          renderRoot.innerHTML = String(nextSheetMarkup || "");
        }
      },
      {
        nextTitle: title,
        nextSheetMarkup: sheetMarkup,
        renderRootId: ADMIT_CARD_PDF_RENDER_ROOT_ID,
      },
    );
    await waitForTemplateDocumentReady(page);
  }

  async function measureRenderedSheetPageCounts(page) {
    return page.evaluate((fallbackPageHeightPx) => {
      return Array.from(document.querySelectorAll(".template-render-sheet")).map((sheet) => {
        const pageHeightPx = Math.max(1, Math.round(Number(sheet.dataset.templatePageHeightPx || fallbackPageHeightPx)));
        const sheetHeight = Math.max(
          Number(sheet.scrollHeight || 0),
          Number(sheet.offsetHeight || 0),
          Math.ceil(Number(sheet.getBoundingClientRect().height || 0)),
          pageHeightPx,
        );

        return Math.max(1, Math.ceil(sheetHeight / pageHeightPx));
      });
    }, PRINT_PAGE_HEIGHT_PX);
  }

  async function getRenderedPdfPageDimensions(page) {
    return page.evaluate(
      ({ fallbackWidth, fallbackHeight }) => {
        const sheet = document.querySelector(".template-render-sheet");
        const width = Math.round(Number(sheet?.dataset?.templatePageWidthPx || fallbackWidth));
        const height = Math.round(Number(sheet?.dataset?.templatePageHeightPx || fallbackHeight));

        return {
          width: Number.isFinite(width) && width > 0 ? width : fallbackWidth,
          height: Number.isFinite(height) && height > 0 ? height : fallbackHeight,
        };
      },
      {
        fallbackWidth: PRINT_PAGE_WIDTH_PX,
        fallbackHeight: PRINT_PAGE_HEIGHT_PX,
      },
    );
  }

  function countPdfPages(pdfBuffer) {
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
      return 0;
    }

    const matches = pdfBuffer.toString("latin1").match(/\/Type\s*\/Page\b/g);
    return Array.isArray(matches) ? matches.length : 0;
  }

  function sanitizeBatchAdmitCardEntryBaseName(value, fallbackValue = "admit-card") {
    const normalizedValue = String(value ?? "").trim() || String(fallbackValue || "admit-card").trim();
    const sanitizedValue = normalizedValue
      .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
      .replace(/\s+/g, " ")
      .trim();

    return sanitizedValue || String(fallbackValue || "admit-card").trim() || "admit-card";
  }

  async function getBatchExamineeRecords(examineeNos) {
    if (typeof getExamineesByNos === "function") {
      return getExamineesByNos(examineeNos);
    }

    return Promise.all((Array.isArray(examineeNos) ? examineeNos : [examineeNos]).map((examineeNo) => getExamineeByNo(examineeNo)));
  }

  function createBatchTemplateRenderer(templateHtml) {
    if (typeof createTemplateExamineeRenderer === "function") {
      return createTemplateExamineeRenderer(templateHtml);
    }

    return async function renderBatchTemplate(examinee) {
      return renderTemplateWithExaminee(templateHtml, examinee);
    };
  }

  function createChunkedArray(values, chunkSize) {
    const normalizedValues = Array.isArray(values) ? values : [];
    const normalizedChunkSize = Math.max(1, Math.round(Number(chunkSize || 1)));
    const chunks = [];

    for (let startIndex = 0; startIndex < normalizedValues.length; startIndex += normalizedChunkSize) {
      chunks.push(normalizedValues.slice(startIndex, startIndex + normalizedChunkSize));
    }

    return chunks;
  }

  async function renderBatchTemplateChunk(examinees, renderTemplate) {
    return Promise.all(
      (Array.isArray(examinees) ? examinees : []).map(async (examinee) => {
        return {
          examinee,
          renderedSheet: await renderTemplate(examinee),
        };
      }),
    );
  }

  async function splitPdfBufferBySheetPageCounts(pdfBuffer, sheetPageCounts, options = {}) {
    throwIfBatchAdmitCardCancelled(options);

    const sourcePdf = await PDFDocument.load(pdfBuffer);
    const totalPageCount = Math.max(0, Number(sourcePdf.getPageCount() || 0));
    const normalizedSheetPageCounts = (Array.isArray(sheetPageCounts) ? sheetPageCounts : []).map((pageCount) =>
      Math.max(1, Math.round(Number(pageCount || 0))),
    );

    if (totalPageCount === 0) {
      return [];
    }

    if (normalizedSheetPageCounts.length === 0) {
      normalizedSheetPageCounts.push(totalPageCount);
    }

    const splitPdfBuffers = [];
    let nextPageIndex = 0;

    for (let sheetIndex = 0; sheetIndex < normalizedSheetPageCounts.length; sheetIndex += 1) {
      throwIfBatchAdmitCardCancelled(options);

      const remainingPageCount = totalPageCount - nextPageIndex;
      const remainingSheetCount = normalizedSheetPageCounts.length - sheetIndex;

      if (remainingPageCount <= 0 || remainingPageCount < remainingSheetCount) {
        throw createHttpError(500, "생성된 PDF 페이지 수를 개별 수험표 파일로 분리할 수 없습니다.");
      }

      const measuredPageCount = normalizedSheetPageCounts[sheetIndex];
      const actualPageCount =
        sheetIndex === normalizedSheetPageCounts.length - 1
          ? remainingPageCount
          : Math.max(1, Math.min(measuredPageCount, remainingPageCount - (remainingSheetCount - 1)));
      const targetPdf = await PDFDocument.create();
      const pageIndices = Array.from({ length: actualPageCount }, (_, offset) => nextPageIndex + offset);
      const copiedPages = await targetPdf.copyPages(sourcePdf, pageIndices);

      copiedPages.forEach((copiedPage) => {
        targetPdf.addPage(copiedPage);
      });

      splitPdfBuffers.push(Buffer.from(await targetPdf.save()));
      nextPageIndex += actualPageCount;
    }

    return splitPdfBuffers;
  }

  async function buildAdmitCardPdfDocumentWithPage(page, title, renderedSheets, options = {}) {
    throwIfBatchAdmitCardCancelled(options);
    await renderPdfDocumentInPage(page, title, renderedSheets);
    throwIfBatchAdmitCardCancelled(options);

    const sheetPageCounts = await measureRenderedSheetPageCounts(page);
    const measuredPageCount = sheetPageCounts.reduce(
      (totalCount, pageCount) => totalCount + Math.max(1, Number(pageCount || 0)),
      0,
    );

    options.onMeasure?.({
      sheetPageCounts,
      totalPageCount: measuredPageCount,
    });

    throwIfBatchAdmitCardCancelled(options);
    const pdfBuffer = Buffer.from(await page.pdf(getPdfPageOptions(await getRenderedPdfPageDimensions(page))));
    const parsedPageCount = options.skipBufferPageCount ? 0 : countPdfPages(pdfBuffer);

    throwIfBatchAdmitCardCancelled(options);
    return {
      pdfBuffer,
      sheetPageCounts,
      totalPageCount: parsedPageCount > 0 ? parsedPageCount : measuredPageCount,
    };
  }

  async function buildAdmitCardPdfDocument(title, renderedSheets, options = {}) {
    const { browser, page } = await openPdfBrowserPage();
    const cancelBrowser = async () => {
      await closePdfBrowser(browser);
    };

    options.registerCancelHandler?.(cancelBrowser);

    try {
      throwIfBatchAdmitCardCancelled(options);
      return await buildAdmitCardPdfDocumentWithPage(page, title, renderedSheets, options);
    } finally {
      options.registerCancelHandler?.(null);
      await closePdfBrowser(browser);
    }
  }

  async function buildAdmitCardPdfBufferFromSheets(title, renderedSheets) {
    const { pdfBuffer } = await buildAdmitCardPdfDocument(title, renderedSheets);
    return pdfBuffer;
  }

  async function buildAdmitCardPdfBufferFromRecord(record = {}, options = {}) {
    const template = await getActiveTemplate();
    const renderTemplate = createBatchTemplateRenderer(template.contentHtml);
    const title = String(options.title || `${record?.name || record?.examineeNo || "수험표"} 수험표`).trim() || "수험표";
    const renderedHtml = await renderTemplate(record || {});

    return buildAdmitCardPdfBufferFromSheets(title, [renderedHtml]);
  }

  async function buildAdmitCardPdfBuffer(examineeNo) {
    const examinee = await getExamineeByNo(examineeNo);
    return buildAdmitCardPdfBufferFromRecord(examinee, {
      title: `${examinee.name} 수험표`,
    });
  }

  async function buildBatchAdmitCardPdfBuffer(examineeNos, options = {}) {
    const normalizedExamineeNos = normalizeExamineeNoList(examineeNos);

    if (normalizedExamineeNos.length === 0) {
      throw createHttpError(400, "출력 대상 수험번호가 필요합니다.");
    }

    options.onPhaseChange?.({
      phase: "preparing",
      completedCount: 0,
      totalCount: normalizedExamineeNos.length,
      countUnit: "examinee",
      completedPageCount: 0,
      totalPageCount: 0,
      examineeTotalCount: normalizedExamineeNos.length,
      outputMode: "combined-pdf",
    });

    const [template, examinees] = await Promise.all([
      getActiveTemplate(),
      getBatchExamineeRecords(normalizedExamineeNos),
    ]);
    const renderTemplate = createBatchTemplateRenderer(template.contentHtml);
    const totalExamineeCount = normalizedExamineeNos.length;
    let completedCount = 0;

    options.onPhaseChange?.({
      phase: "rendering",
      completedCount,
      totalCount: totalExamineeCount,
      countUnit: "examinee",
      completedPageCount: 0,
      totalPageCount: 0,
      examineeTotalCount: totalExamineeCount,
      outputMode: "combined-pdf",
    });

    const renderedSheets = [];

    for (const examinee of examinees) {
      throwIfBatchAdmitCardCancelled(options);

      const renderedSheet = await renderTemplate(examinee);

      throwIfBatchAdmitCardCancelled(options);

      renderedSheets.push(renderedSheet);
      completedCount += 1;
      options.onProgress?.({
        phase: "rendering",
        completedCount,
        totalCount: totalExamineeCount,
        countUnit: "examinee",
        completedPageCount: 0,
        totalPageCount: 0,
        examineeTotalCount: totalExamineeCount,
        outputMode: "combined-pdf",
        examineeNo: examinee.examineeNo,
      });
    }

    let measuredTotalPageCount = 0;
    throwIfBatchAdmitCardCancelled(options);

    const { pdfBuffer, totalPageCount } = await buildAdmitCardPdfDocument(`수험표 ${totalExamineeCount}명`, renderedSheets, {
      onMeasure: ({ totalPageCount: nextTotalPageCount }) => {
        measuredTotalPageCount = Math.max(0, Number(nextTotalPageCount || 0));
        options.onPhaseChange?.({
          phase: "finalizing",
          completedCount: measuredTotalPageCount,
          totalCount: measuredTotalPageCount,
          countUnit: "page",
          completedPageCount: measuredTotalPageCount,
          totalPageCount: measuredTotalPageCount,
          examineeTotalCount: totalExamineeCount,
          outputMode: "combined-pdf",
        });
      },
      registerCancelHandler: options.registerCancelHandler,
      shouldCancel: options.shouldCancel,
    });
    const finalizedTotalPageCount = Math.max(measuredTotalPageCount, Number(totalPageCount || 0));

    throwIfBatchAdmitCardCancelled(options);

    options.onPhaseChange?.({
      phase: "ready",
      completedCount: finalizedTotalPageCount,
      totalCount: finalizedTotalPageCount,
      countUnit: "page",
      completedPageCount: finalizedTotalPageCount,
      totalPageCount: finalizedTotalPageCount,
      examineeTotalCount: totalExamineeCount,
      outputMode: "combined-pdf",
    });

    return pdfBuffer;
  }

  async function buildBatchAdmitCardZipBuffer(examineeNos, options = {}) {
    const normalizedExamineeNos = normalizeExamineeNoList(examineeNos);

    if (normalizedExamineeNos.length === 0) {
      throw createHttpError(400, "출력 대상 수험번호가 필요합니다.");
    }

    options.onPhaseChange?.({
      phase: "preparing",
      completedCount: 0,
      totalCount: normalizedExamineeNos.length,
      countUnit: "file",
      completedPageCount: 0,
      totalPageCount: 0,
      examineeTotalCount: normalizedExamineeNos.length,
      outputMode: "pdf-zip",
    });

    const [template, examinees] = await Promise.all([
      getActiveTemplate(),
      getBatchExamineeRecords(normalizedExamineeNos),
    ]);
    const renderTemplate = createBatchTemplateRenderer(template.contentHtml);
    const totalExamineeCount = normalizedExamineeNos.length;
    const zip = new AdmZip();
    const zipEntryMethod = getBatchAdmitCardZipEntryMethod(totalExamineeCount);
    let completedCount = 0;

    options.onPhaseChange?.({
      phase: "rendering",
      completedCount,
      totalCount: totalExamineeCount,
      countUnit: "file",
      completedPageCount: 0,
      totalPageCount: 0,
      examineeTotalCount: totalExamineeCount,
      outputMode: "pdf-zip",
    });

    const chunkSize = getBatchAdmitCardZipChunkSize(totalExamineeCount);
    const examineeChunks = createChunkedArray(examinees, chunkSize);
    const workerCount = getBatchAdmitCardZipWorkerCount(totalExamineeCount, chunkSize);
    const workers = await Promise.all(
      Array.from({ length: workerCount }, async () => {
        const browser = await openPdfBrowser();
        const page = await createPdfBrowserPage(browser);

        return {
          browser,
          page,
        };
      }),
    );
    const cancelBrowsers = async () => {
      await Promise.allSettled(workers.map((worker) => closePdfBrowser(worker.browser)));
    };

    options.registerCancelHandler?.(cancelBrowsers);

    try {
      let nextChunkIndex = 0;

      await Promise.all(
        workers.map(async ({ page }) => {
          while (true) {
            throwIfBatchAdmitCardCancelled(options);

            const currentChunkIndex = nextChunkIndex;
            nextChunkIndex += 1;

            if (currentChunkIndex >= examineeChunks.length) {
              return;
            }

            const currentChunk = examineeChunks[currentChunkIndex];
            const renderedEntries = await renderBatchTemplateChunk(currentChunk, renderTemplate);

            throwIfBatchAdmitCardCancelled(options);

            const { pdfBuffer, sheetPageCounts } = await buildAdmitCardPdfDocumentWithPage(
              page,
              `수험표 ${currentChunkIndex * chunkSize + 1}-${currentChunkIndex * chunkSize + renderedEntries.length}`,
              renderedEntries.map((entry) => entry.renderedSheet),
              {
                shouldCancel: options.shouldCancel,
                skipBufferPageCount: true,
              },
            );
            const splitPdfBuffers = await splitPdfBufferBySheetPageCounts(pdfBuffer, sheetPageCounts, {
              shouldCancel: options.shouldCancel,
            });

            if (splitPdfBuffers.length !== renderedEntries.length) {
              throw createHttpError(500, "생성된 PDF를 개별 수험표 파일로 분리할 수 없습니다.");
            }

            renderedEntries.forEach(({ examinee }, entryIndex) => {
              const fileBaseName = sanitizeBatchAdmitCardEntryBaseName(
                String(examinee?.examineeNo || "").trim() || String(examinee?.name || "").trim(),
                `admit-card-${currentChunkIndex * chunkSize + entryIndex + 1}`,
              );

              const zipEntry = zip.addFile(`${fileBaseName}.pdf`, splitPdfBuffers[entryIndex]);

              if (zipEntry?.header) {
                zipEntry.header.method = zipEntryMethod;
              }

              completedCount += 1;
              options.onProgress?.({
                phase: "rendering",
                completedCount,
                totalCount: totalExamineeCount,
                countUnit: "file",
                completedPageCount: 0,
                totalPageCount: 0,
                examineeTotalCount: totalExamineeCount,
                outputMode: "pdf-zip",
                examineeNo: examinee.examineeNo,
              });
            });
          }
        }),
      );
    } finally {
      options.registerCancelHandler?.(null);
      await Promise.allSettled(workers.map((worker) => closePdfBrowser(worker.browser)));
    }

    throwIfBatchAdmitCardCancelled(options);

    options.onPhaseChange?.({
      phase: "finalizing",
      completedCount,
      totalCount: totalExamineeCount,
      countUnit: "file",
      completedPageCount: 0,
      totalPageCount: 0,
      examineeTotalCount: totalExamineeCount,
      outputMode: "pdf-zip",
    });

    throwIfBatchAdmitCardCancelled(options);
    const zipBuffer = zip.toBuffer();

    throwIfBatchAdmitCardCancelled(options);

    options.onPhaseChange?.({
      phase: "ready",
      completedCount,
      totalCount: totalExamineeCount,
      countUnit: "file",
      completedPageCount: 0,
      totalPageCount: 0,
      examineeTotalCount: totalExamineeCount,
      outputMode: "pdf-zip",
    });

    return zipBuffer;
  }

  return Object.freeze({
    buildAdmitCardPdfBuffer,
    buildAdmitCardPdfBufferFromRecord,
    buildBatchAdmitCardPdfBuffer,
    buildBatchAdmitCardZipBuffer,
  });
}

module.exports = {
  createAdmitCardPdfService,
};
