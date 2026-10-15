const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve(__dirname, '../../ExamList');
const target = path.resolve(__dirname, '../client/examlist-editor');
const runtime = path.join(source, 'client/template-editor-runtime');
const manifest = require(path.join(runtime, 'client/template-editor-runtime/manifest.js'));
let count = 0;
function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  count++;
}
for (const asset of [...manifest.requiredScripts, ...manifest.css, 'loader.js', 'client/template-editor-runtime/manifest.js']) {
  const dest = asset.startsWith('../../shared/') ? asset.replace('../../', '') : asset;
  copy(path.resolve(runtime, asset), path.join(target, 'runtime', dest));
  if (dest.endsWith('.js') && dest !== 'loader.js' && !dest.endsWith('/manifest.js')) {
    const output = path.join(target, 'runtime', dest);
    fs.writeFileSync(output, '(function () {\n' + fs.readFileSync(output, 'utf8') + '\n})();\n');
  }
}
const manifestTarget = path.join(target, 'runtime/client/template-editor-runtime/manifest.js');
const contentSharedTarget = path.join(target, 'runtime/client/features/editor/content-shared.js');
fs.writeFileSync(contentSharedTarget, fs.readFileSync(contentSharedTarget, 'utf8')
  .replace('table-layout: fixed;"', 'table-layout: fixed; background: transparent;"')
  .replace('font-size: 11pt;"', 'font-size: 11pt; background: transparent;"'));
const cellUtilsTarget = path.join(target, 'runtime/client/features/editor/table-cell-utils.js');
fs.writeFileSync(cellUtilsTarget, fs.readFileSync(cellUtilsTarget, 'utf8').replace('cell.style.backgroundColor = normalizeTemplateEditorColorValue(', "cell.style.backgroundColor = String(nextBackgroundColor).trim().toLowerCase() === 'transparent' ? 'transparent' : normalizeTemplateEditorColorValue("));
fs.writeFileSync(manifestTarget, fs.readFileSync(manifestTarget, 'utf8').replace('../../shared/document-html-sanitizer.js', 'shared/document-html-sanitizer.js'));
// The page's fitted canvas can be smaller than the source application's canvas.
// Keep edge resize targets from covering the middle of a scaled table cell.
const resizeHitPath = path.join(target, 'runtime/client/features/template-editor/table-resize-hit.js');
let resizeHit = fs.readFileSync(resizeHitPath, 'utf8').replace('const cellRect = cell.getBoundingClientRect();', `const cellRect = cell.getBoundingClientRect();
      const zoom = cell.offsetWidth > 0 ? cellRect.width / cell.offsetWidth : 1;
      const horizontalThreshold = Math.min(TEMPLATE_EDITOR_TABLE_EDGE_THRESHOLD * zoom, cellRect.width / 4);
      const verticalThreshold = Math.min(TEMPLATE_EDITOR_TABLE_EDGE_THRESHOLD * zoom, cellRect.height / 4);`);
for (const edge of ['Left', 'Right']) resizeHit = resizeHit.replace(`delta${edge} <= TEMPLATE_EDITOR_TABLE_EDGE_THRESHOLD`, `delta${edge} <= horizontalThreshold`);
for (const edge of ['Top', 'Bottom']) resizeHit = resizeHit.replace(`delta${edge} <= TEMPLATE_EDITOR_TABLE_EDGE_THRESHOLD`, `delta${edge} <= verticalThreshold`);
fs.writeFileSync(resizeHitPath, resizeHit);
const tableObjectPath = path.join(target, 'runtime/client/features/template-editor/table-object.js');
fs.writeFileSync(tableObjectPath, fs.readFileSync(tableObjectPath, 'utf8').replace('const hitSlop = Math.max(6, TABLE_EDGE_THRESHOLD);',
  'const zoom = tableElement.offsetWidth > 0 ? tableRect.width / tableElement.offsetWidth : 1;\n      const hitSlop = Math.min(Math.max(6, TABLE_EDGE_THRESHOLD) * zoom, tableRect.width / 4, tableRect.height / 4);'));

// Copy only the host controls needed by a single applicant's ticket.
const visited = new Set();
function copyModule(relative) {
  const from = path.resolve(source, relative);
  if (!from.startsWith(source + path.sep)) throw new Error('Import outside ExamList: ' + relative);
  if (visited.has(from)) return;
  visited.add(from);
  const code = fs.readFileSync(from, 'utf8');
  copy(from, path.join(target, 'host', path.relative(source, from)));
  if (path.basename(from) === 'canvas-zoom.js') {
    fs.writeFileSync(path.join(target, 'host', path.relative(source, from)), code.replace('templateEditorCanvasZoomMin = 0.5', 'templateEditorCanvasZoomMin = 0.25'));
  }
  for (const match of code.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)) {
    copyModule(path.relative(source, path.resolve(path.dirname(from), match[1])));
  }
}
for (const modulePath of [
  'client/features/template-editor/editor-text-controls.js',
  'client/features/template-editor/canvas-zoom.js',
  'client/features/template-editor/object-toolbar-controls.js',
  'client/features/template-editor/object-interaction-scroll.js',
  'client/features/template-editor/data-tags-panel.js',
  'client/features/template-editor/generated-object-source-control.js',
  'client/features/template-editor/data-tag-format-renderer.js',
]) copyModule(modulePath);

fs.mkdirSync(path.join(target, 'styles'), { recursive: true });
// Native CSS nesting adds the editor root's specificity, keeping host styles
// from changing ExamList control dimensions while preserving its media queries.
const cssVisited = new Set();
function bundleCss(file) {
  if (cssVisited.has(file)) return '';
  cssVisited.add(file);
  return fs.readFileSync(file, 'utf8').replace(/@import\s+url\(["']([^"']+)["']\);/g,
    (_, relative) => bundleCss(path.resolve(path.dirname(file), relative)));
}
fs.writeFileSync(path.join(target, 'styles/scoped.css'),
  '#templateEditorPage {\n' + bundleCss(path.join(source, 'styles/features/template-editor.css')) + '\n}\n');
const runtimeCss = path.join(target, 'runtime/client/template-editor-runtime/template-editor-runtime.css');
fs.writeFileSync(runtimeCss, '#templateEditorPage {\n' + fs.readFileSync(runtimeCss, 'utf8') + '\n}\n');
const tagPanel = path.join(target, 'host/client/features/template-editor/data-tags-panel.js');
fs.writeFileSync(tagPanel, fs.readFileSync(tagPanel, 'utf8').replace('const groups = dataTagAccordionGroups.map((group) => {', `const groupDefinitions = tagDefinitions.some(tag => tag.group) ? [
    { id: 'system', label: '기본 정보', icon: 'book', keys: tagDefinitions.filter(tag => tag.group === 'system').map(tag => tag.key) },
    { id: 'signup', label: '회원가입', icon: 'user', keys: tagDefinitions.filter(tag => tag.group === 'signup').map(tag => tag.key) },
    { id: 'application', label: '원서접수', icon: 'book', keys: tagDefinitions.filter(tag => tag.group === 'application').map(tag => tag.key) },
  ] : dataTagAccordionGroups;
  const groups = groupDefinitions.map((group) => {`));
console.log(`Imported ${count} ExamList editor assets (${visited.size} host modules).`);
