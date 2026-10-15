(function(scope) {
  const feedback = scope.AdmitCardSettingsFeedback;
  const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const api = (suffix = '', options = {}) => scope.AdmitCardApiClient.apiRequest('/api/system-settings/translation' + suffix, options);
  let session = null;
  const dirty = () => Boolean(session?.draft?.apiKey);
  const draw = () => document.querySelector('applyhub-translation-settings')?.render();
  async function perform(action) {
    const current = session;
    const form = document.querySelector('applyhub-translation-settings form');
    if (!current || current.busy || !form?.reportValidity()) return false;
    current.busy = action; current.result = ''; draw();
    try {
      const result = await api(action === 'check' ? '/check' : '', {method: action === 'check' ? 'POST' : 'PUT', body: JSON.stringify(current.draft)});
      if (action === 'save') {
        current.data = result; current.draft.apiKey = '';
        current.result = 'saved'; feedback.notify('번역 API 설정을 저장했습니다.');
      } else {current.result = 'verified'; feedback.notify(result.message);} return true;
    } catch(error) {current.result = action === 'check' ? 'checkFailed' : 'saveFailed'; feedback.notify(error.message, 'error'); return false;}
    finally {current.busy = ''; if(session === current) draw();}
  }
  class TranslationSettings extends HTMLElement {
    connectedCallback() {
      if (!session) {
        const current = session = {data:null, draft:{apiKey:''}, busy:'load', result:''};
        api().then(data => {if(session !== current) return; current.data = data; if(data.keyNeedsReset) feedback.notify('저장된 번역 API 키를 읽을 수 없습니다. 키를 다시 입력하고 저장해주세요.', 'warning');})
          .catch(error => {if(session !== current) return; current.result = 'loadFailed'; feedback.notify(error.message, 'error');})
          .finally(() => {current.busy = ''; if(session === current) draw();});
      }
      this.render();
    }
    disconnectedCallback() {
      queueMicrotask(() => {if(!document.querySelector('applyhub-translation-settings')) session = null;});
    }
    render() {
      const current = session; if(!current) return;
      const data = current.data;
      this.innerHTML = '<section class="super-admin-setting-card translation-settings-card" aria-labelledby="translationSettingsHeading"><div class="system-settings-section-head"><span class="system-settings-label" id="translationSettingsHeading">번역 API 설정</span>' + feedback.badge({busy:current.busy,result:current.result,registered:data?.hasApiKey,needsReset:data?.keyNeedsReset}) + '</div>' +
        (!data ? (!current.busy ? '<button type="button" class="ghost-button" data-translation-retry>다시 불러오기</button>' : '') :
        '<form autocomplete="off"><fieldset class="translation-settings-fields" ' + (current.busy ? 'disabled' : '') + '>' +
        '<div class="settings-secret-field translation-secret-field"><label class="field"><span>Google Cloud Translation API 키</span><input class="system-settings-input" name="apiKey" type="password" autocomplete="new-password" spellcheck="false" maxlength="256" value="' + esc(current.draft.apiKey) + '" ' + (data.hasApiKey ? 'placeholder="저장됨 · 변경할 때만 입력"' : 'required placeholder="Google Cloud에서 발급한 API 키 입력"') + ' /></label>' +
        '<button class="ghost-button settings-secret-reveal" type="button" data-translation-reveal title="' + (data.keyNeedsReset ? '저장된 키를 읽을 수 없어 다시 저장해야 합니다.' : !data.hasApiKey ? 'API 키를 먼저 저장해주세요.' : '로그인 비밀번호 확인 후 저장된 API 키를 표시합니다.') + '" ' + (!data.hasApiKey || data.keyNeedsReset ? 'disabled' : '') + '>저장값 확인</button></div>' +
        '<div class="form-actions"><button class="ghost-button" type="button" data-translation-check>' + (current.busy === 'check' ? '연결 확인 중...' : '연결 확인') + '</button><button class="primary-button" type="submit" data-translation-save ' + (!dirty() ? 'disabled' : '') + '>' + (current.busy === 'save' ? '저장 중...' : 'API 설정 저장') + '</button></div></fieldset>' +
        '</form>') + '</section>';
      this.querySelector('[data-translation-retry]')?.addEventListener('click', () => {session = null; this.connectedCallback();});
      this.querySelector('[data-translation-reveal]')?.addEventListener('click',event=>scope.AdmitCardSecretViewer.open({kind:'translation',opener:event.currentTarget}));
      const form = this.querySelector('form'); if(!form) return;
      form.addEventListener('input', event => {
        if(event.target.name !== 'apiKey') return;
        current.draft.apiKey = event.target.value;
        current.result = dirty() ? 'changed' : ''; this.querySelector('[data-settings-status]').outerHTML = feedback.badge({result:current.result,registered:data.hasApiKey,needsReset:data.keyNeedsReset});
        this.querySelector('[data-translation-save]').disabled = !dirty();
      });
      form.addEventListener('submit', event => {event.preventDefault(); event.stopPropagation(); perform('save');});
      this.querySelector('[data-translation-check]').addEventListener('click', () => perform('check'));
    }
  }
  scope.AdmitCardTranslationSettings = {
    hasUnsavedChanges: () => dirty() || Boolean(session?.busy && session.busy !== 'load'),
    async confirmNavigation() {
      if(session?.busy && session.busy !== 'load') return false;
      if(!dirty()) return true;
      if(window.confirm('번역 API 설정에 저장하지 않은 변경사항이 있습니다.\n\n확인: 저장 후 이동\n취소: 저장하지 않고 이동')) return perform('save');
      session.draft.apiKey = ''; draw(); return true;
    },
  };
  customElements.define('applyhub-translation-settings', TranslationSettings);
})(window);
