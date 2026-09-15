/* Run before styles load so a saved theme is applied before the first paint. */
(() => {
  const storageKey = 'applyhub.theme';
  const controls = new Set();
  const normalize = value => value === 'dark' ? 'dark' : 'light';
  let saved;
  try { saved = localStorage.getItem(storageKey); } catch { /* Storage can be blocked. */ }
  let theme = normalize(saved);

  function applyTheme(value, persist = false) {
    theme = normalize(value);
    document.documentElement.dataset.theme = theme;
    if (persist) {
      try { localStorage.setItem(storageKey, theme); } catch { /* Keep the in-page choice usable. */ }
    }
    controls.forEach(control => control.update());
  }
  applyTheme(theme);

  // A small self-contained control survives application view/form re-renders.
  class ThemeToggle extends HTMLElement {
    connectedCallback() {
      this.innerHTML = `<button type="button" class="theme-toggle" ${this.hasAttribute('disabled') ? 'disabled' : ''}>
        <svg class="theme-toggle-sun" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"></path></svg>
        <svg class="theme-toggle-moon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"></path></svg>
      </button>`;
      this.button = this.querySelector('button');
      this.button.addEventListener('click', () => applyTheme(theme === 'dark' ? 'light' : 'dark', true));
      controls.add(this);
      this.update();
    }
    disconnectedCallback() { controls.delete(this); }
    update() {
      const nextLabel = `${theme === 'dark' ? '라이트' : '다크'} 모드로 전환`;
      this.button.setAttribute('aria-label', nextLabel);
      this.button.title = nextLabel;
    }
  }
  customElements.define('applyhub-theme-toggle', ThemeToggle);
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) applyTheme(event.newValue);
  });
})();
