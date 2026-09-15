(function (scope) {
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const groups = [
    { name: '수험생', tokens: ['수험번호', '접수번호', '이름'] },
    { name: '지원 정보', tokens: ['모집시기', '전형', '모집단위'] },
    { name: '파일 정보', tokens: ['서류명', '파일명'] },
  ];
  function markup(value, allowed) {
    return String(value).split(/(\{[^{}]+\})/g).map(part => {
      const token = part.slice(1, -1);
      if (!part.startsWith('{') || !allowed.includes(token)) return escape(part);
      return `<span class="archive-data-chip" data-archive-chip="${escape(token)}" contenteditable="false">${escape(token)}</span>`;
    }).join('');
  }
  function renderPattern(name, label, value, folder) {
    const allowed = folder ? scope.AdmitCardApplicantArchive.commonTokens : scope.AdmitCardApplicantArchive.fileTokens;
    return `<div class="archive-pattern" data-pattern="${name}">
      <label id="archive-${name}-label" for="archive-${name}">${label}</label>
      <input name="${name}" type="hidden" value="${escape(value)}">
      <div id="archive-${name}" class="archive-pattern-editor" data-archive-editor="${name}" data-folder="${folder}" contenteditable="true" role="textbox" aria-multiline="false" aria-labelledby="archive-${name}-label" spellcheck="false">${markup(value, allowed)}</div>
      <details class="archive-tag-panel"><summary>데이터 태그 <span>선택하여 추가</span></summary>
        <div class="archive-tag-groups">${groups.map(group => {
          const tokens = group.tokens.filter(token => allowed.includes(token));
          if (!tokens.length) return '';
          return `<details class="archive-tag-group" open><summary><span>${group.name}</span><small data-archive-tag-count>${tokens.length}</small></summary>
            <div class="archive-tag-list">${tokens.map(token => {
              return `<button type="button" data-archive-token="${token}" data-target="${name}" aria-label="${label}에 ${token} 추가">${token}</button>`;
            }).join('')}</div></details>`;
        }).join('')}</div>
      </details></div>`;
  }
  function create({ root, onChange, isBusy }) {
    const ranges = new Map();
    let insertionId = 0;
    const field = name => root.querySelector(`[name="${name}"]`);
    const allowed = editor => editor.dataset.folder === 'true' ? scope.AdmitCardApplicantArchive.commonTokens : scope.AdmitCardApplicantArchive.fileTokens;
    function read(node) {
      if (node.nodeType === 3) return node.textContent.replace(/\u200b/g, '');
      if (node.dataset?.archiveChip) return `{${node.dataset.archiveChip}}`;
      if (node.nodeName === 'BR') return '';
      return [...node.childNodes].map(read).join('');
    }
    function remember(editor) {
      const selection = scope.getSelection();
      if (selection.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)) ranges.set(editor.dataset.archiveEditor, selection.getRangeAt(0).cloneRange());
    }
    function sync(editor) {
      field(editor.dataset.archiveEditor).value = read(editor);
      remember(editor); onChange();
    }
    function insert(editor, text) {
      if (isBusy() || editor.getAttribute('aria-disabled') === 'true') return;
      const name = editor.dataset.archiveEditor;
      const range = ranges.get(name);
      editor.focus();
      const selection = scope.getSelection();
      selection.removeAllRanges();
      if (range && editor.contains(range.commonAncestorContainer)) selection.addRange(range);
      else { const end = document.createRange(); end.selectNodeContents(editor); end.collapse(false); selection.addRange(end); }
      // Native editing preserves caret and undo history; all inserted markup is escaped.
      const markerId = String(++insertionId);
      document.execCommand('insertHTML', false, markup(text.replace(/[\r\n]+/g, ' '), allowed(editor)) + `<span data-archive-caret="${markerId}">&#8203;</span>`);
      const marker = editor.querySelector(`[data-archive-caret="${markerId}"]`);
      if (marker) {
        const caret = document.createRange(); caret.selectNodeContents(marker); caret.collapse(false);
        selection.removeAllRanges(); selection.addRange(caret);
      }
      sync(editor);
    }
    root.addEventListener('input', event => {
      const editor = event.target.closest('[data-archive-editor]');
      if (editor) sync(editor);
    });
    for (const type of ['keyup', 'mouseup', 'focusout']) root.addEventListener(type, event => {
      const editor = event.target.closest('[data-archive-editor]');
      if (editor) remember(editor);
    });
    root.addEventListener('keydown', event => {
      if (event.target.closest('[data-archive-editor]') && event.key === 'Enter' && !event.isComposing) event.preventDefault();
    });
    root.addEventListener('paste', event => {
      const editor = event.target.closest('[data-archive-editor]');
      if (!editor) return;
      event.preventDefault(); remember(editor); insert(editor, event.clipboardData.getData('text/plain'));
    });
    for (const type of ['copy', 'cut']) root.addEventListener(type, event => {
      const editor = event.target.closest('[data-archive-editor]');
      if (!editor || !scope.getSelection().rangeCount) return;
      event.preventDefault(); event.clipboardData.setData('text/plain', read(scope.getSelection().getRangeAt(0).cloneContents()));
      if (type === 'cut' && !isBusy() && editor.getAttribute('aria-disabled') !== 'true') { document.execCommand('delete'); sync(editor); }
    });
    root.addEventListener('drop', event => { if (event.target.closest('[data-archive-editor]')) event.preventDefault(); });
    root.addEventListener('click', event => {
      const button = event.target.closest('[data-archive-token]');
      if (button) insert(root.querySelector(`[data-archive-editor="${button.dataset.target}"]`), `{${button.dataset.archiveToken}}`);
      const label = event.target.closest('label[for^="archive-"]');
      if (label) root.querySelector(`[id="${label.htmlFor}"][data-archive-editor]`)?.focus();
    });
    return {
      update() {
        root.querySelectorAll('[data-archive-editor]').forEach(editor => {
          const input = field(editor.dataset.archiveEditor);
          if (read(editor) !== input.value) { editor.innerHTML = markup(input.value, allowed(editor)); ranges.delete(editor.dataset.archiveEditor); }
          editor.contentEditable = String(!input.disabled);
          editor.setAttribute('aria-disabled', String(input.disabled));
          editor.tabIndex = input.disabled ? -1 : 0;
        });
      },
    };
  }
  scope.AdmitCardArchivePatternEditor = { renderPattern, create };
})(globalThis);
