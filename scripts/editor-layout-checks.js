const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function verifyEditorLayout(page, browser) {
  const source = path.resolve(__dirname, '../../ExamList');
  if (!fs.existsSync(path.join(source, 'index.html'))) return;
  const visited = new Set();
  function css(file) {
    if (visited.has(file)) return '';
    visited.add(file);
    return fs.readFileSync(file, 'utf8').replace(/@import\s+url\(['"]([^'"]+)['"]\);/g, (_, relative) => css(path.resolve(path.dirname(file), relative)));
  }
  const index = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
  const styles = [...index.matchAll(/href="(\/[^"?]+\.css)"/g)].map(match => css(path.join(source, match[1]))).join('\n');
  const runtimeStyles = fs.readFileSync(path.join(source, 'client/template-editor-runtime/client/template-editor-runtime/template-editor-runtime.css'), 'utf8');
  const markup = await page.$eval('#templateEditorPage', n => n.outerHTML);
  const reference = await browser.newPage();
  try {
    await reference.setViewport(page.viewport());
    await reference.setContent(`<style>${styles}\n${runtimeStyles}</style>${markup}`);
    const selectors = ['.editor-toolbar', '.template-tag-panel', '.template-page-properties-panel', '.template-toolbar-group-label', '.template-toolbar-field-label', '.template-toolbar-select', '.template-toolbar-number-input', '.examlist-object-size-field', '.template-tag-caption', '.template-tag-accordion-summary', '.template-tag-view-switch', '.template-page-property-field', '.template-page-property-control', '.template-page-properties-title', '.editor-toolbar-footer .primary-button'];
    const measure = list => Object.fromEntries(list.map(selector => {
      const node = document.querySelector('#templateEditorPage ' + selector);
      if (!node) return [selector, null];
      const style = getComputedStyle(node);
      const properties = ['fontSize', 'fontWeight', 'lineHeight', 'minHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'gap', 'borderRadius'];
      return [selector, Object.fromEntries(properties.map(key => [key, style[key]]))];
    }));
    const expected = await reference.evaluate(measure, selectors);
    const actual = await page.evaluate(measure, selectors);
    const differences = [];
    for (const selector of selectors) {
      for (const key of Object.keys(expected[selector] || {})) {
        if (expected[selector][key] !== actual[selector]?.[key]) differences.push(`${selector} ${key}: ${actual[selector]?.[key]} (ExamList ${expected[selector][key]})`);
      }
    }
    assert.deepEqual(differences, [], 'Editor controls match the original ExamList styles');
    assert.deepEqual(await page.$eval('#templateEditorRuntimeHost', n => ['--editor-toolbar-column-width', '--editor-tag-column-width', '--editor-page-properties-column-width'].map(key => getComputedStyle(n).getPropertyValue(key).trim())), ['330px', '210px', '230px']);
    assert.deepEqual(await page.$$eval('#templateEditorRuntimeHost > :is(.editor-toolbar-column, .template-tag-panel, .template-page-properties-column)', nodes => nodes.map(n => n.getBoundingClientRect().width)), [330, 210, 230]);
    console.log('PASS: panel widths, labels, controls, spacing and typography match ExamList');
  } finally { await reference.close(); }
}
module.exports = { verifyEditorLayout };
