const assert = require('node:assert/strict');
const fs = require('node:fs');
const puppeteer = require('puppeteer-core');
const { PDFDocument } = require('pdf-lib');
const { createAdmitCardPdfService } = require('../server/modules/admit-cards/admit-card-pdf');

async function run() {
  const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const originalLaunch = puppeteer.launch.bind(puppeteer);
  const attempts = [], profiles = [];
  let failAll = false;
  puppeteer.launch = async options => {
    attempts.push(options.executablePath);
    profiles.push(options.userDataDir);
    assert(options.userDataDir, 'The service owns temporary profiles, including failed launches');
    if (failAll || options.executablePath === process.execPath) throw new Error('Simulated browser launch failure');
    return originalLaunch(options);
  };
  const createService = browserExecutablePaths => createAdmitCardPdfService({
    browserExecutablePaths,
    createHttpError: (statusCode, message, errorCode) => Object.assign(new Error(message), { statusCode, errorCode }),
    escapeHtml: value => String(value || ''),
    getActiveTemplate: async () => ({ contentHtml: '<div class="template-doc">PDF fallback test</div>' }),
    renderTemplateWithExaminee: async html => html,
  });
  try {
    const service = createService([process.execPath, chrome]);
    for (let index = 0; index < 2; index++) {
      const bytes = await service.buildAdmitCardPdfBufferFromRecord({ name: 'Test' });
      assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1);
    }
    assert.deepEqual(attempts, [process.execPath, chrome, chrome], 'Fallback is used and the working browser is preferred next time');
    failAll = true;
    await assert.rejects(() => service.buildAdmitCardPdfBufferFromRecord({}), error => error.errorCode === 'ADMIT_CARD_PDF_BROWSER_UNAVAILABLE' && error.cause.message.includes('Simulated'));
    assert.deepEqual(attempts.slice(-2), [chrome, process.execPath], 'A cached browser failure still tries other candidates');
    await assert.rejects(() => createService([]).buildAdmitCardPdfBufferFromRecord({}), error => error.errorCode === 'ADMIT_CARD_PDF_BROWSER_NOT_FOUND');
    assert(profiles.every(profile => !fs.existsSync(profile)), 'Success and failure both clean up owned temporary profiles');
    console.log('PASS: real PDF generation after launch failure, preferred browser reuse, all-browser failure and temporary profile cleanup');
  } finally { puppeteer.launch = originalLaunch; }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
