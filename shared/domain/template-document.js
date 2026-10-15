(function (scope, factory) {
  const api = factory(scope);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else scope.ApplyHubTemplateDocument = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, scope => {
  function getStyles() {
    return `
      .template-render-sheet {
        box-sizing: border-box; display: flex; flex-direction: column;
        font-family: "Noto Sans KR", "Malgun Gothic", sans-serif;
        font-size: 11pt; line-height: calc(1em + 1pt); color: #000;
        white-space: normal; word-break: break-word;
      }
      .template-render-sheet .template-doc {
        box-sizing: border-box; position: relative; flex: 1 1 auto;
        min-height: 0; min-width: 0; max-width: 100%; width: 100%;
        border: 1px solid transparent; border-radius: 0;
      }
      .template-render-sheet :is(h1,h2,h3,p,ul,ol,table,blockquote,figure),
      .template-render-sheet .template-doc > div:not([data-candidate-block-grid], .examlist-candidate-block-grid) { margin: 0 0 1pt; }
      .template-render-sheet > :first-child { margin-top: 0; }
      .template-render-sheet > :last-child { margin-bottom: 0; }
      .template-render-sheet h1 { font-size: 20pt; font-weight: 800; }
      .template-render-sheet h2 { font-size: 16pt; font-weight: 800; }
      .template-render-sheet h3 { font-size: 14pt; font-weight: 700; }
      .template-render-sheet :is(ul,ol) { padding-left: 22pt; }
      .template-render-sheet blockquote { background: rgba(238,243,251,.8); border-left: 4pt solid #000; border-radius: 12pt; padding: 12pt 16pt; }
      .template-render-sheet hr { border: 0; border-top: 1pt solid #000; margin: 20pt 0; }
      .template-render-sheet table { box-sizing: border-box; border-collapse: collapse; table-layout: fixed; min-width: 0; max-width: 100%; width: 100%; background: transparent; }
      .template-render-sheet :is(th,td) { box-sizing: border-box; border: 1pt solid #000; padding: 2pt; min-width: 24px; text-align: left; vertical-align: top; white-space: normal; overflow-wrap: break-word; }
      .template-render-sheet th { background: rgba(238,243,251,.92); font-weight: 800; }
      .template-render-sheet tr:hover { background: transparent; }
      .template-render-sheet img { display: block; height: auto; max-width: 100%; }
      .template-render-sheet img.template-generated-object { max-width: none; }
      .template-render-sheet .template-doc > :not([data-candidate-block-grid], .examlist-candidate-block-grid, [data-template-object-flow-spacer]) { position: relative; z-index: 2; }
      .template-render-sheet [data-template-object-caret-host] { height: 0 !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; line-height: calc(1em + 1pt) !important; }
    `;
  }
  function syncLayout(root = scope.document) {
    root.querySelectorAll('.template-render-sheet').forEach(sheet => {
      if (Number(sheet.dataset.templatePageHeightPx) > 0) sheet.style.height = sheet.dataset.templatePageHeightPx + 'px';
      sheet.querySelectorAll('.template-doc').forEach(doc => scope.ExamListTemplateEditorObjectFlowReflow?.syncTemplateEditorObjectFlowObjects(doc));
    });
  }
  async function prepare(root = scope.document) {
    const document = root.ownerDocument || root;
    await document.fonts?.ready;
    await Promise.allSettled([...root.querySelectorAll('img')].map(image => image.decode?.()));
    syncLayout(root);
  }
  if (scope.document) {
    const style = scope.document.createElement('style');
    style.dataset.templateDocument = 'true';
    style.textContent = getStyles();
    scope.document.head.append(style);
  }
  return { getStyles, syncLayout, prepare };
});
