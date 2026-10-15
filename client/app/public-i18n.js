/* Public UI translations only. Form values, API payloads and stored data remain unchanged. */
(() => {
  const catalogs = { en: globalThis.ApplyHubPublicMessages || {}, mn: globalThis.ApplyHubPublicMessagesMn || {} };
  const storageKey = 'applyhub.public-language';
  const normalize = globalThis.ApplyHubLanguages.normalize;
  let language = 'ko';
  try { language = normalize(localStorage.getItem(storageKey)); } catch { /* In-memory preference when storage is unavailable. */ }
  const controls = new Set();
  const originals = new WeakMap();
  const attributes = new WeakMap();
  const authoredHtml = new WeakMap();
  const attributeNames = ['placeholder', 'title', 'aria-label', 'aria-description', 'alt'];
  const excluded = 'script, style, textarea, [contenteditable="true"], [translate="no"], [data-i18n-user-content]';
  const patternsByLanguage = Object.fromEntries(Object.entries(catalogs).map(([locale,catalog]) => [locale, Object.entries(catalog).filter(([key]) => /\{\d+\}/.test(key)).sort(([a], [b]) => b.replace(/\{\d+\}/g, '').length - a.replace(/\{\d+\}/g, '').length).map(([key, value]) => {
    const slots = [];
    const parts = key.split(/(\{\d+\})/).map(part => {
      if (/^\{\d+\}$/.test(part)) { slots.push(part); return '([\\s\\S]*?)'; }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    return { regex: new RegExp(`^${parts.join('')}$`), slots, value };
  })]));

  function translate(text, locale = language) {
    const source = String(text ?? '');
    if (!catalogs[locale] || !/[가-힣]/.test(source)) return source;
    const trimmed = source.trim();
    let translated = catalogs[locale][trimmed];
    if (translated === undefined) {
      for (const pattern of patternsByLanguage[locale]) {
        const match = pattern.regex.exec(trimmed);
        if (match) {
          // Captures are data: never run them through the dictionary.
          translated = pattern.value.replace(/\{\d+\}/g, slot => match[pattern.slots.indexOf(slot) + 1] ?? slot);
          break;
        }
      }
    }
    if (translated === undefined) return source;
    return source.slice(0, source.indexOf(trimmed)) + translated + source.slice(source.indexOf(trimmed) + trimmed.length);
  }

  function isPublicPage() {
    return Boolean(document.body?.classList.contains('applicant-public-body') || document.querySelector('#appShell.auth-locked'));
  }
  function updateValue(target, current, records, write, explicitEnglish) {
    let record = records.get(target);
    if (!record || current !== record.output) record = { source: current, output: current };
    record.output = explicitEnglish !== undefined ? (language !== 'ko' ? explicitEnglish : record.source) : translate(record.source);
    records.set(target, record);
    if (current !== record.output) write(record.output);
  }
  function apply() {
    observer.disconnect();
    try {
      const active = isPublicPage();
      document.documentElement.lang = active ? language : 'ko';
      document.documentElement.dataset.publicLanguage = active ? language : 'ko';
      controls.forEach(control => control.update());
      const root = document.body?.classList.contains('applicant-public-body') ? document.body : document.querySelector('#appShell.auth-locked .common-login-stage');
      if (!active || !root) return;
      // Only administrator-authored notice HTML opts into rich-text language switching.
      for (const element of root.querySelectorAll('[data-i18n-html-ko]')) {
        const html = element.getAttribute('data-i18n-html-' + language) || element.dataset.i18nHtmlKo;
        if (authoredHtml.get(element) !== html) {
          element.innerHTML = html;
          authoredHtml.set(element, html);
        }
      }
      // Authored bilingual labels bypass the system dictionary in both languages.
      for (const element of root.querySelectorAll('[data-i18n-ko]')) {
        const text = element.getAttribute('data-i18n-' + language) || element.dataset.i18nKo;
        if (element.textContent !== text) element.textContent = text;
      }
      for (const name of ['aria-label', 'title']) {
        const selectors = Object.keys(catalogs).map(locale => `[data-i18n-${name}-${locale}]`).join(',');
        for (const element of root.querySelectorAll(selectors)) {
          let records = attributes.get(element);
          if (!records) { records = new Map(); attributes.set(element, records); }
          updateValue(name, element.getAttribute(name), records, value => element.setAttribute(name, value), element.getAttribute(`data-i18n-${name}-${language}`) ?? undefined);
        }
      }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: node => node.parentElement?.closest(excluded) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
      });
      let node;
      while ((node = walker.nextNode())) {
        const current = node;
        const element = current.parentElement;
        if (element.tagName === 'OPTION' && !element.hasAttribute('value')) element.setAttribute('value', element.value);
        const explicitEnglish = element.getAttribute('data-i18n-' + language);
        if (explicitEnglish !== null) {
          let record = originals.get(current);
          if (!record || current.data !== record.output) record = { source: current.data };
          record.output = language !== 'ko' ? explicitEnglish : record.source;
          originals.set(current, record);
          if (current.data !== record.output) current.data = record.output;
        } else updateValue(current, current.data, originals, value => { current.data = value; });
      }
      for (const element of root.querySelectorAll('[placeholder], [title], [aria-label], [aria-description], [alt]')) {
        if (element.closest(excluded)) continue;
        const preserved = (element.getAttribute('data-i18n-preserve') || '').split(' ');
        let records = attributes.get(element);
        if (!records) { records = new Map(); attributes.set(element, records); }
        for (const name of attributeNames) {
          if (!element.hasAttribute(name) || preserved.includes(name) || element.hasAttribute(`data-i18n-${name}-${language}`)) continue;
          updateValue(name, element.getAttribute(name), records, value => element.setAttribute(name, value));
        }
      }
      // Only explicitly marked, non-submitted read-only display fields can change format.
      for (const input of root.querySelectorAll('input[readonly][data-i18n-display-value]:not([name])')) {
        input.value = translate(input.dataset.i18nDisplayValue);
      }
      const title = document.querySelector('title');
      if (title?.firstChild) updateValue(title.firstChild, title.textContent, originals, value => { title.firstChild.data = value; });
    } finally {
      observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...attributeNames, 'class', 'translate', 'data-i18n-preserve', 'data-i18n-ko', 'data-i18n-en', 'data-i18n-mn', 'data-i18n-aria-label-en', 'data-i18n-aria-label-mn'] });
    }
  }
  const observer = new MutationObserver(apply);
  function setLanguage(value, persist = true) {
    language = normalize(value);
    if (persist) {
      try { localStorage.setItem(storageKey, language); } catch { /* Keep the control usable. */ }
    }
    apply();
    window.dispatchEvent(new CustomEvent('applyhub:languagechange', { detail: { language } }));
  }
  class LanguageToggle extends HTMLElement {
    connectedCallback() {
      this.setAttribute('translate', 'no');
      this.innerHTML = '<applyhub-language-menu value="' + language + '"></applyhub-language-menu>';
      this.onSelect ||= event => { if (!this.hasAttribute('disabled')) setLanguage(event.detail.language); };
      this.addEventListener('applyhub:language-select', this.onSelect);
      controls.add(this);
      this.update();
    }
    disconnectedCallback() { controls.delete(this); this.removeEventListener('applyhub:language-select', this.onSelect); }
    update() {
      const menu = this.querySelector('applyhub-language-menu');
      menu?.toggleAttribute('disabled', this.hasAttribute('disabled'));
      menu?.update(language);
    }
  }
  customElements.define('applyhub-language-toggle', LanguageToggle);
  globalThis.ApplyHubPublicI18n = Object.freeze({ translate, setLanguage, apply, get language() { return language; } });
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) setLanguage(event.newValue, false);
  });
  document.addEventListener('DOMContentLoaded', apply, { once: true });
  // Set the public document language before styles and content are rendered.
  document.documentElement.lang = /^\/(?:login|applicant(?:\/|$)|account-recovery)/.test(location.pathname) ? language : 'ko';
})();
