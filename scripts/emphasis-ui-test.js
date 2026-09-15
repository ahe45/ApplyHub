const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const base = process.env.THEME_TEST_URL || 'http://localhost:3000';
const pairs = [
  ['nav-item', 'active'], ['template-management-tab', 'active'], ['filter-chip', 'active'],
  ['page-btn', 'active'], ['table-page-button', 'active'], ['page-size-option', 'active'],
  ['header-chip-combo-option', 'active'], ['template-toolbar-icon-select-option', 'active'],
  ['template-toolbar-combo-option', 'active'], ['template-tool-button', 'is-active'],
  ['applicant-public-nationality-option', 'is-selected'], ['system-settings-schedule-calendar-day', 'is-selected'],
];
const stylesheetLinks = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8').match(/<link[^>]+rel="stylesheet"[^>]*>/g).filter(link => !link.includes('https:')).join('\n');
const markup = `<!doctype html><html><head>${stylesheetLinks}</head><body><main style="padding:24px;display:grid;gap:16px">
${pairs.map(([cls, active], i) => `<div><button id="plain-${i}" class="${cls}">일반</button><button id="selected-${i}" class="${cls} ${active}">선택</button></div>`).join('')}
<div class="applicant-public-body"><div class="applicant-member-consent-options"><label class="applicant-member-consent-option"><input type="radio" checked><span id="consent">동의</span></label></div><ol class="applicant-member-steps"><li id="step" aria-current="step">약관 동의</li></ol>
<button id="primary" class="primary-button">실행</button><button id="disabled" class="primary-button" disabled>실행</button></div>
<table class="result-grid-card"><tbody><tr class="is-selected"><td id="cell">선택된 데이터</td></tr><tr><td>일반 데이터</td></tr></tbody></table>
<button id="swatch" class="template-toolbar-color-swatch active" style="background:#ef4444">색상</button>
</main></body></html>`;
function luminance(color) {
  return color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
}
async function run() {
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  try {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setRequestInterception(true);
    page.on('request', request => new URL(request.url()).pathname === '/__emphasis-test' ? request.respond({ status: 200, contentType: 'text/html', body: markup }) : request.continue());
    const artifacts = path.resolve(__dirname, '../.tmp-emphasis-check');
    fs.mkdirSync(artifacts, { recursive: true });
    await page.goto(base + '/__emphasis-test', { waitUntil: 'networkidle2' });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      await new Promise(resolve => setTimeout(resolve, 350));
      const selectedColor = await page.$eval('#consent', el => getComputedStyle(el).backgroundColor);
      assert(1.05 / (luminance(selectedColor) + .05) >= 4.5, `${theme}: selected text contrast`);
      for (let i = 0; i < pairs.length; i++) {
        const get = id => page.$eval(id, el => ({ bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
        const selected = await get(`#selected-${i}`), plain = await get(`#plain-${i}`);
        assert.equal(selected.bg, selectedColor, `${theme}: ${pairs[i][0]} selection fill`);
        assert.equal(selected.color, 'rgb(255, 255, 255)');
        assert.notEqual(plain.bg, selected.bg);
        await page.hover(`#selected-${i}`);
        assert.equal((await get(`#selected-${i}`)).bg, selectedColor, 'hover must retain selection emphasis');
      }
      assert.equal(await page.$eval('#step', el => getComputedStyle(el).backgroundColor), selectedColor);
      assert.equal(await page.$eval('#disabled', el => getComputedStyle(el).opacity), '1');
      assert.equal(await page.$eval('#disabled', el => getComputedStyle(el).backgroundImage), 'none');
      assert.notEqual(await page.$eval('#cell', el => getComputedStyle(el).boxShadow), 'none');
      assert.equal(await page.$eval('#swatch', el => getComputedStyle(el).backgroundColor), 'rgb(239, 68, 68)');
      assert.equal(await page.$eval('#swatch', el => getComputedStyle(el).outlineWidth), '3px');
      await page.screenshot({ path: path.join(artifacts, `${theme}.png`), fullPage: true });
    }
    console.log('PASS: 15 selected control families, hover persistence, consent/steps, disabled buttons, rows and color swatches; light/dark text contrast >= 4.5:1');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
