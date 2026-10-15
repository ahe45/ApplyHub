(() => {
  const languages = globalThis.ApplyHubLanguages;
  let nextId = 0;
  const selections = new Map();
  const globe = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/></svg>';
  class LanguageMenu extends HTMLElement {
    connectedCallback() {
      this.setAttribute('translate', 'no');
      const key = this.getAttribute('editor-key');
      this.value = languages.normalize(key ? selections.get(key) || this.getAttribute('value') : this.getAttribute('value'));
      const id = 'language-menu-' + ++nextId;
      this.innerHTML = `<div class="language-menu"><button type="button" class="language-menu-trigger" aria-haspopup="menu" aria-expanded="false" aria-controls="${id}">${globe}<span>Language</span><span class="language-menu-current"></span><svg class="language-menu-chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div id="${id}" class="language-menu-options" role="menu" aria-label="Language" hidden>${languages.definitions.map(item => `<button type="button" role="menuitemradio" data-language="${item.code}" lang="${item.code}">${item.label}<span aria-hidden="true">✓</span></button>`).join('')}</div></div>`;
      this.abort?.abort();
      this.abort = new AbortController();
      const options = { signal: this.abort.signal };
      this.addEventListener('click', event => {
        if (this.hasAttribute('disabled') || this.closest('fieldset:disabled')) return;
        if (event.target.closest('.language-menu-trigger')) this.toggle(!this.open);
        const item = event.target.closest('[data-language]');
        if (item) this.select(item.dataset.language);
      }, options);
      this.addEventListener('keydown', event => {
        if (!event.target.closest('.language-menu')) return;
        if (event.key === 'Escape' && this.open) { event.preventDefault(); event.stopPropagation(); this.toggle(false, true); }
        if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
          event.preventDefault();
          const wasOpen = this.open;
          this.toggle(true);
          const items = [...this.querySelectorAll('[data-language]')];
          const current = items.indexOf(document.activeElement);
          const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length-1 : !wasOpen ? (event.key === 'ArrowUp' ? items.length-1 : 0) : (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
          items[index]?.focus();
        }
        if (event.key === 'Tab') this.toggle(false);
      }, options);
      document.addEventListener('pointerdown', event => { if (!this.contains(event.target)) this.toggle(false); }, options);
      document.addEventListener('focusin', event => { if (!this.contains(event.target)) this.toggle(false); }, options);
      this.update();
      globalThis.ApplyHubAutoTranslation?.mount(this);
      if (key) {
        this.applyEditorLanguage();
        // Static HTML connects the menu before the parser reaches later fields.
        // Reconcile after parsing as well as after dynamically inserted editors.
        queueMicrotask(() => { if (this.isConnected) this.applyEditorLanguage(); });
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => this.applyEditorLanguage(), { ...options, once: true });
        }
      }
    }
    disconnectedCallback() { this.translationAbort?.abort(); this.abort?.abort(); }
    toggle(open, focus = false) {
      this.open = open;
      this.querySelector('.language-menu-options').hidden = !open;
      this.querySelector('.language-menu-trigger').setAttribute('aria-expanded', String(open));
      this.querySelector('.language-menu').classList.remove('opens-up');
      if (open && this.querySelector('.language-menu-options').getBoundingClientRect().bottom > innerHeight - 12) this.querySelector('.language-menu').classList.add('opens-up');
      if (focus) this.querySelector('.language-menu-trigger').focus();
    }
    select(value) {
      this.value = languages.normalize(value);
      const key = this.getAttribute('editor-key');
      if (key) { selections.set(key, this.value); this.applyEditorLanguage(); }
      this.update(); this.toggle(false, true);
      this.dispatchEvent(new CustomEvent('applyhub:language-select', { bubbles:true, detail:{ language:this.value, editorKey:key } }));
    }
    update(value = this.value) {
      this.value = languages.normalize(value);
      const label = languages.definitions.find(item => item.code === this.value)?.label;
      this.querySelector('.language-menu-current').textContent = label;
      this.querySelector('.language-menu-trigger').disabled = this.hasAttribute('disabled');
      this.querySelectorAll('[data-language]').forEach(item => item.setAttribute('aria-checked', String(item.dataset.language === this.value)));
    }
    applyEditorLanguage() {
      const editor = this.closest('[data-language-editor]');
      if (!editor) return;
      editor.dataset.activeLanguage = this.value;
      editor.querySelectorAll('[data-edit-language]').forEach(panel => {
        if (panel.closest('[data-language-editor]') !== editor) return;
        panel.hidden = panel.dataset.editLanguage !== this.value;
        const inputs = panel.matches('input,textarea,select') ? [panel] : panel.querySelectorAll('input,textarea,select');
        inputs.forEach(input => {
          if (input.required) input.dataset.languageRequired = 'true';
          if (input.dataset.languageRequired === 'true') input.required = !panel.hidden && !input.closest('[data-edit-language][hidden]');
        });
      });
      this.translationSync?.();
    }
  }
  customElements.define('applyhub-language-menu', LanguageMenu);
})();
