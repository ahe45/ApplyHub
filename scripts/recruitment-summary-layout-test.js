const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const puppeteer = require('puppeteer-core');
async function run() {
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const admission = '순수외국인특별전형(신입)(한국어)';
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      const respond = body => request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.pathname === '/api/public/applicant-form') return respond({
        fields: [{ fieldKey: 'name', questionText: '이름', label: '이름', inputType: 'text', systemFieldKey: 'name', required: true }],
        recruitmentUnits: [{ id: 1, trackName: '9월', admissionName: admission, seriesName: '자연', unitName: '건설시스템공학과', majorName: '아주 긴 전공명 '.repeat(15) }],
        schedules: [], settings: {},
      });
      if (url.pathname === '/api/public/members/settings') return respond({ questions: [], terms: [] });
      if (url.pathname === '/api/public/members/session') return respond({ member: null });
      if (request.method() !== 'GET') return request.abort();
      request.continue();
    });
    const base = process.env.THEME_TEST_URL || 'http://localhost:3000';
    await page.goto(base + '/applicant/form?preview=1', { waitUntil: 'networkidle2' });
    await page.waitForSelector('.applicant-public-selection-summary-value');
    const artifacts = path.resolve(__dirname, '../.tmp-recruitment-summary-check');
    fs.mkdirSync(artifacts, { recursive: true });
    let hasShrink = false, hasEllipsis = false, hasFittedShrink = false;
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      for (const width of [320, 360, 390, 1440, 320, 390]) {
        await page.setViewport({ width, height: 1000 });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const rows = await page.$$eval('.applicant-public-selection-summary-item', elements => elements.map(el => {
          const value = el.querySelector('span'), label = el.querySelector('strong');
          const style = getComputedStyle(value), rect = value.getBoundingClientRect(), labelRect = label.getBoundingClientRect();
          return { height: el.getBoundingClientRect().height, valueHeight: rect.height, font: parseFloat(style.fontSize), clipped: value.scrollWidth > value.clientWidth,
            ellipsis: style.textOverflow, nowrap: style.whiteSpace, text: value.textContent, title: value.title, stacked: rect.top >= labelRect.bottom && Math.abs(rect.left - labelRect.left) < 1 };
        }));
        assert.equal(rows.length, 5);
        assert(rows.every(row => row.stacked && row.height === rows[0].height && row.valueHeight === 24 && row.font >= 14 && row.font <= 16 && row.nowrap === 'nowrap' && row.ellipsis === 'ellipsis'));
        assert(rows.every(row => row.title === row.text), 'full value retained in text and native tooltip');
        assert.equal(rows[1].text, admission);
        assert.equal(rows[0].font, 16, 'short value keeps default font');
        hasShrink ||= rows.some(row => row.font < 16);
        hasEllipsis ||= rows.some(row => row.clipped && row.font === 14);
        hasFittedShrink ||= rows.some(row => row.font < 16 && !row.clipped);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        if (width === 390) await page.screenshot({ path: path.join(artifacts, `${theme}.png`), fullPage: true });
      }
    }
    // Exercise a just-too-narrow value width independently of the page's outer spacing.
    const fitted = await page.$eval('.applicant-public-selection-summary-value', el => {
      el.style.fontSize = '16px';
      const range = document.createRange(); range.selectNodeContents(el);
      el.style.width = `${Math.ceil(range.getBoundingClientRect().width * .94)}px`;
      window.dispatchEvent(new Event('resize'));
      return { font: parseFloat(getComputedStyle(el).fontSize), clipped: el.scrollWidth > el.clientWidth };
    });
    hasFittedShrink ||= fitted.font < 16 && fitted.font >= 14 && !fitted.clipped;
    assert(hasShrink && hasEllipsis && hasFittedShrink, `shrink-to-fit, minimum-font ellipsis and fitted smaller font exercised: ${JSON.stringify({ hasShrink, hasEllipsis, hasFittedShrink })}`);
    assert.deepEqual(errors, []);
    console.log('PASS: stacked labels, single-line equal-height values, 16–14px fit, ellipsis, full-text titles and responsive recalculation in both themes');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
