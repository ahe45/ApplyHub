const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');

async function verifyTemplateDocumentLayout({ page, services }) {
  const initial = await page.evaluate(() => window.ApplyHubExamListEditor.instance.getHtml());
  const templateId = await page.evaluate(() => state.templateEditor.activeTemplateId);
  const original = (await services.templateService.getTemplates()).find(t => t.id === templateId);
  const markup = `<div class="template-doc" data-template-page-size="A4" data-template-page-margin-top="30" data-template-page-margin-right="30" data-template-page-margin-bottom="30" data-template-page-margin-left="30">
    <h1 class="layout-title" style="font-size:32px">수험표 제목</h1>
    <p class="layout-lead" style="width:300px;line-height:1.7">첫째 줄<br>둘째 줄과 자동으로 줄바꿈되는 긴 안내문입니다. 원서접수와 수험표 조회에 대한 설명을 끝까지 유지합니다.</p><p class="layout-blank"><br></p><p class="layout-blank"><br></p>
    <table class="layout-table" style="position:absolute;left:0;top:210px;width:480px;height:96px"><tbody><tr><td>보존할 표 내용</td><td>둘째 셀</td></tr></tbody></table>
    <p class="layout-after">표 다음 안내문<br>이 문장은 가려지지 않아야 합니다.</p>
    <img class="layout-logo" src="/client/assets/logo.png" style="position:absolute;left:0;top:360px;width:64px;height:64px" />
    <p class="layout-end">마지막 안내문</p></div>`;
  const measure = selector => {
    const surface = document.querySelector(selector), rect = surface.getBoundingClientRect();
    const zoom = surface.id === 'templateEditorSurface' ? Number(surface.closest('[data-template-editor-canvas]').dataset.templateEditorCanvasZoom) : 1;
    return ['layout-title', 'layout-lead', 'layout-blank', 'layout-table', 'layout-after', 'layout-logo', 'layout-end'].flatMap(name => [...surface.querySelectorAll('.' + name)].map(n => {
      const r = n.getBoundingClientRect(), style = getComputedStyle(n);
      return { name, text: n.textContent, x: (r.left - rect.left) / zoom, y: (r.top - rect.top) / zoom, width: r.width / zoom, height: r.height / zoom, font: style.fontSize, weight: style.fontWeight, lineHeight: style.lineHeight };
    }));
  };
  const launch = puppeteer.launch.bind(puppeteer);
  try {
    await page.evaluate(html => window.ApplyHubExamListEditor.instance.setHtml(html), markup);
    await page.click('[data-applyhub-zoom=reset]');
    await page.evaluate(async () => { await document.fonts.ready; await Promise.allSettled([...document.querySelectorAll('#templateEditorSurface img')].map(n => n.decode())); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    const expected = await page.evaluate(measure, '#templateEditorSurface');
    const html = await page.evaluate(() => window.ApplyHubExamListEditor.instance.getHtml());
    assert.equal((html.match(/layout-blank/g) || []).length, 2, 'Authored blank lines survive serialization');
    const compare = (actual, label) => {
      const differences = [];
      assert.equal(actual.length, expected.length, `${label}: all content is retained`);
      expected.forEach((entry, index) => {
        const other = actual[index];
        for (const key of ['x', 'y', 'width', 'height']) if (Math.abs(entry[key] - other[key]) > 1.5) differences.push(`${entry.name} ${key}: editor ${entry[key]}, ${label} ${other[key]}`);
        for (const key of ['text', 'font', 'weight', 'lineHeight']) if (entry[key] !== other[key]) differences.push(`${entry.name} ${key}: editor ${entry[key]}, ${label} ${other[key]}`);
      });
      assert.deepEqual(differences, [], `${label} matches the editor's content and geometry`);
    };
    await page.evaluate(html => window.ApplyHubExamListEditor.instance.setHtml(html), html);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    compare(await page.evaluate(measure, '#templateEditorSurface'), 'reopened editor');
    await page.click('[data-applyhub-editor-preview]');
    await page.waitForSelector('#templatePreviewModal:not(.hidden)');
    await page.evaluate(() => window.ApplyHubTemplateDocument.prepare(document.querySelector('#templatePreviewStage')));
    compare(await page.evaluate(measure, '#templatePreviewStage .template-render-sheet'), 'preview');
    await page.click('#templatePreviewModal .modal-header [data-close-modal]');
    await services.templateService.updateTemplate(templateId, { ...original, contentHtml: html });
    let pdfGeometry;
    puppeteer.launch = async options => {
      const browser = await launch(options), newPage = browser.newPage.bind(browser);
      browser.newPage = async () => {
        const pdfPage = await newPage(), pdf = pdfPage.pdf.bind(pdfPage);
        pdfPage.pdf = async options => { pdfGeometry = await pdfPage.evaluate(measure, '.template-render-sheet'); return pdf(options); };
        return pdfPage;
      };
      return browser;
    };
    await services.admitCardService.buildAdmitCardPdfBufferFromRecord({ track: '연결모집', admission: '연결전형', name: '배치 검증', examineeNo: '12345' });
    compare(pdfGeometry, 'PDF');
    console.log('PASS: editor, preview and actual PDF preserve blank lines, text, absolute tables and logo positions');
  } finally {
    puppeteer.launch = launch;
    await services.templateService.updateTemplate(templateId, original);
    await page.evaluate(html => window.ApplyHubExamListEditor.instance.setHtml(html), initial);
  }
}
module.exports = { verifyTemplateDocumentLayout };
