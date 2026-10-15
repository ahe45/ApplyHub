const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { PDFDocument, PDFName } = require('pdf-lib');
const { inlineLocalTemplateImages } = require('../server/modules/admit-cards/local-image-assets');
const { createAdmitCardPdfService } = require('../server/modules/admit-cards/admit-card-pdf');

async function run() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'applyhub-logo-test-'));
  try {
    const bytes = await fs.readFile(path.resolve(__dirname, '../client/assets/logo.png'));
    await fs.mkdir(path.join(rootDir, 'uploads/img'), { recursive: true });
    await fs.writeFile(path.join(rootDir, 'uploads/img/school logo.png'), bytes);
    const src = '/uploads/img/school%20logo.png?v=2';
    const html = `<div class="template-doc"><p>Ticket logo</p><img src="${src}" alt="학교 로고" style="width:64px;height:64px" /></div>`;
    const embedded = await inlineLocalTemplateImages(html, { rootDir });
    assert(embedded.includes('data:image/png;base64,' + bytes.toString('base64')));
    assert(!embedded.includes(src));
    assert((await inlineLocalTemplateImages('<img src="/client/assets/logo.png">', { rootDir })).includes('data:image/png;base64,'));
    const existing = '<img src="data:image/png;base64,AA=="><img src="https://example.test/logo.png">';
    assert.equal(await inlineLocalTemplateImages(existing, { rootDir }), existing);
    for (const unsafe of ['/uploads/img/../../.env', '/uploads/img/%2e%2e/%2e%2e/.env', '/uploads/img/..%5c..%5c.env']) {
      await assert.rejects(() => inlineLocalTemplateImages(`<img src="${unsafe}">`, { rootDir }));
    }
    const template = { id: 'local-logo', contentHtml: html };
    const service = createAdmitCardPdfService({
      rootDir,
      browserExecutablePaths: [process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
      createHttpError: (statusCode, message, errorCode) => Object.assign(new Error(message), { statusCode, errorCode }),
      escapeHtml: value => String(value || ''),
      getActiveTemplate: async () => template,
      getExamineeByNo: async examineeNo => ({ examineeNo, name: 'Logo test' }),
      normalizeExamineeNoList: values => values,
      renderTemplateWithExaminee: async markup => markup,
    });
    for (const [buffer, pages] of [
      [await service.buildAdmitCardPdfBufferFromRecord({ name: 'Logo test' }), 1],
      [await service.buildBatchAdmitCardPdfBuffer(['001', '002']), 2],
    ]) {
      const pdf = await PDFDocument.load(buffer);
      assert.equal(pdf.getPageCount(), pages);
      assert(pdf.context.enumerateIndirectObjects().some(([, object]) => object.dict?.get(PDFName.of('Subtype')) === PDFName.of('Image')), 'The PDF embeds the uploaded logo image');
    }
    template.contentHtml = '<img src="/uploads/img/missing.png">';
    await assert.rejects(() => service.buildAdmitCardPdfBufferFromRecord({}), error => error.errorCode === 'ADMIT_CARD_IMAGE_UNAVAILABLE');
    console.log('PASS: local logos embedded in single and batch PDFs, static images, invalid paths and missing files');
  } finally { await fs.rm(rootDir, { recursive: true, force: true }); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
