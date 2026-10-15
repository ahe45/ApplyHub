(function(scope) {
  const feedback = scope.AdmitCardSettingsFeedback;
  const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  let session = null;
  const api = (suffix = '', options = {}) => scope.AdmitCardApiClient.apiRequest('/api/system-settings/email' + suffix, options);
  const draftOf = data => ({host: data.host, port: data.port, security: data.security, user: data.user, password: '', from: data.from, fromName: data.fromName});
  const dirty = () => Boolean(session?.data && JSON.stringify(session.draft) !== JSON.stringify(draftOf(session.data)));
  const draw = () => document.querySelector('applyhub-email-settings')?.render();
  async function save() {
    const current = session;
    const form = document.querySelector('applyhub-email-settings form');
    if (!current || current.busy || !form?.reportValidity()) return false;
    current.busy = 'save'; current.result = ''; draw();
    try {
      current.data = await api('', {method: 'PUT', body: JSON.stringify(current.draft)});
      current.draft = draftOf(current.data); current.result = 'saved'; feedback.notify('이메일 발송 설정을 저장했습니다.');
      return true;
    } catch(error) {current.result = 'saveFailed'; feedback.notify(error.message, 'error'); return false;}
    finally {current.busy = ''; if(session === current) draw();}
  }
  class EmailSettings extends HTMLElement {
    connectedCallback() {
      if (!session) {
        const current = session = {data: null, draft: null, busy: 'load', result: ''};
        api().then(data => {if(session !== current) return; current.data = data; current.draft = draftOf(data); if(data.passwordNeedsReset) feedback.notify('저장된 메일 비밀번호를 읽을 수 없습니다. 비밀번호를 다시 입력하고 저장해주세요.', 'warning');})
          .catch(error => {if(session !== current) return; current.result = 'loadFailed'; feedback.notify(error.message, 'error');})
          .finally(() => {current.busy = ''; if(session === current) draw();});
      }
      this.render();
    }
    disconnectedCallback() {
      queueMicrotask(() => {if(!document.querySelector('applyhub-email-settings')) session = null;});
    }
    render() {
      const current = session; if(!current) return;
      const data = current.data, draft = current.draft;
      const input = (name, label, type = 'text', extra = '') => '<label class="field"><span>' + label + '</span><input class="system-settings-input" name="' + name + '" type="' + type + '" value="' + esc(draft[name]) + '" ' + extra + ' /></label>';
      this.innerHTML = '<section class="super-admin-setting-card email-settings-card" aria-labelledby="emailSettingsHeading"><div class="system-settings-section-head"><span class="system-settings-label" id="emailSettingsHeading">이메일 발송 설정</span>' + feedback.badge({busy:current.busy,result:current.result,registered:data?.hasPassword,needsReset:data?.passwordNeedsReset}) + '</div>' +
        (!data ? (!current.busy ? '<button type="button" class="ghost-button" data-email-retry>다시 불러오기</button>' : '') :
        '<form autocomplete="off"><fieldset class="email-settings-fields" ' + (current.busy ? 'disabled' : '') + '>' +
          '<div class="email-settings-layout">' +
          '<div class="email-settings-server-row">' +
          input('host', '메일 서버 주소', 'text', 'required maxlength="255" placeholder="smtp.example.com"') +
          input('port', '포트', 'number', 'required min="1" max="65535" step="1"') +
          '<label class="field"><span>보안 방식</span><select class="system-settings-input" name="security"><option value="tls" ' + (draft.security === 'tls' ? 'selected' : '') + '>SSL/TLS · 465</option><option value="starttls" ' + (draft.security === 'starttls' ? 'selected' : '') + '>STARTTLS · 587</option></select></label></div>' +
          '<div><div class="settings-field-pair">' +
          input('user', '메일 계정', 'text', 'required maxlength="255" autocomplete="off"') +
          '<div class="settings-secret-field">' + input('password', '메일 비밀번호', 'password', 'maxlength="4096" autocomplete="new-password" ' + (data.hasPassword ? 'placeholder="저장됨 · 변경할 때만 입력"' : 'required placeholder="메일 비밀번호 입력"')) + '<button class="ghost-button" type="button" data-email-reveal title="' + (data.passwordNeedsReset ? '저장된 비밀번호를 읽을 수 없어 다시 저장해야 합니다.' : !data.hasPassword ? '메일 비밀번호를 먼저 저장해주세요.' : '로그인 비밀번호 확인 후 저장된 메일 비밀번호를 표시합니다.') + '" ' + (!data.hasPassword || data.passwordNeedsReset ? 'disabled' : '') + '>저장값 확인</button></div></div>' +
          '</div>' +
          '<div><div class="settings-field-pair">' +
          input('fromName', '발신자 이름', 'text', 'required maxlength="255"') +
          input('from', '발신 이메일', 'email', 'required maxlength="255" placeholder="admission@example.ac.kr"') + '</div></div></div>' +
          '<div class="form-actions"><button class="ghost-button" type="button" data-email-check>' + (current.busy === 'check' ? '연결 확인 중...' : '연결 확인') + '</button><button class="primary-button" type="submit" data-email-save ' + (!dirty() ? 'disabled' : '') + '>' + (current.busy === 'save' ? '저장 중...' : '메일 설정 저장') + '</button></div>' +
          '</fieldset></form>') + '</section>';
      this.querySelector('[data-email-retry]')?.addEventListener('click', () => {session = null; this.connectedCallback();});
      this.querySelector('[data-email-reveal]')?.addEventListener('click',event=>scope.AdmitCardSecretViewer.open({kind:'email',opener:event.currentTarget}));
      const form = this.querySelector('form'); if(!form) return;
      form.addEventListener('input', event => {
        if(!Object.hasOwn(current.draft, event.target.name)) return;
        current.draft[event.target.name] = event.target.name === 'port' ? Number(event.target.value) : event.target.value;
        current.result = dirty() ? 'changed' : ''; this.querySelector('[data-settings-status]').outerHTML = feedback.badge({result:current.result,registered:data.hasPassword,needsReset:data.passwordNeedsReset});
        this.querySelector('[data-email-save]').disabled = !dirty();
      });
      form.addEventListener('change', event => {
        if(event.target.name !== 'security') return;
        current.draft.security = event.target.value;
        if([465,587].includes(Number(current.draft.port))) {current.draft.port = event.target.value === 'tls' ? 465 : 587; this.render();}
      });
      form.addEventListener('submit', event => {event.preventDefault(); event.stopPropagation(); save();});
      this.querySelector('[data-email-check]').addEventListener('click', async () => {
        if(current.busy || !form.reportValidity()) return;
        current.busy = 'check'; current.result = ''; this.render();
        try {const result = await api('/check', {method: 'POST', body: JSON.stringify(current.draft)}); current.result = 'verified'; feedback.notify(result.message);}
        catch(error) {current.result = 'checkFailed'; feedback.notify(error.message, 'error');}
        finally {current.busy = ''; if(session === current) draw();}
      });
    }
  }
  scope.AdmitCardEmailSettings = {
    hasUnsavedChanges: () => dirty() || Boolean(session?.busy && session.busy !== 'load'),
    async confirmNavigation() {
      if(session?.busy && session.busy !== 'load') return false;
      if(!dirty()) return true;
      if(window.confirm('이메일 발송 설정에 저장하지 않은 변경사항이 있습니다.\n\n확인: 저장 후 이동\n취소: 저장하지 않고 이동')) return save();
      session.draft = draftOf(session.data); draw(); return true;
    },
  };
  customElements.define('applyhub-email-settings', EmailSettings);
})(window);
