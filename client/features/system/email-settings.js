(function(scope) {
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
    current.busy = 'save'; current.status = ''; draw();
    try {
      current.data = await api('', {method: 'PUT', body: JSON.stringify(current.draft)});
      current.draft = draftOf(current.data); current.status = '이메일 발송 설정을 저장했습니다. 다음 발송부터 바로 적용됩니다.'; current.error = false;
      return true;
    } catch(error) {current.status = error.message; current.error = true; return false;}
    finally {current.busy = ''; if(session === current) draw();}
  }
  class EmailSettings extends HTMLElement {
    connectedCallback() {
      if (!session) {
        const current = session = {data: null, draft: null, busy: 'load', status: '', error: false};
        api().then(data => {current.data = data; current.draft = draftOf(data);})
          .catch(error => {current.status = error.message; current.error = true;})
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
      this.innerHTML = '<article class="form-card email-settings-card"><div class="section-header"><div class="menu-section-copy"><h3>이메일 발송 설정</h3><p>회원가입과 계정 찾기에 사용할 인증 메일을 설정합니다.</p></div></div>' +
        (!data ? '<p role="status">' + esc(current.status || '메일 설정을 불러오는 중입니다.') + '</p>' + (!current.busy ? '<button type="button" class="ghost-button" data-email-retry>다시 불러오기</button>' : '') :
        '<form autocomplete="off"><fieldset class="email-settings-fields" ' + (current.busy ? 'disabled' : '') + '>' +
          '<div class="email-settings-layout"><div class="email-settings-connection">' +
          '<section class="settings-group" aria-labelledby="emailServerHeading"><h4 id="emailServerHeading">서버 연결</h4><div class="email-settings-server-row">' +
          input('host', '메일 서버 주소', 'text', 'required maxlength="255" placeholder="smtp.example.com"') +
          input('port', '포트', 'number', 'required min="1" max="65535" step="1"') +
          '<label class="field"><span>보안 방식</span><select class="system-settings-input" name="security"><option value="tls" ' + (draft.security === 'tls' ? 'selected' : '') + '>SSL/TLS · 465</option><option value="starttls" ' + (draft.security === 'starttls' ? 'selected' : '') + '>STARTTLS · 587</option></select></label></div></section>' +
          '<section class="settings-group" aria-labelledby="emailAccountHeading"><h4 id="emailAccountHeading">계정 인증</h4><div class="settings-field-pair">' +
          input('user', '메일 계정', 'text', 'required maxlength="255" autocomplete="off"') +
          input('password', '메일 비밀번호', 'password', 'maxlength="4096" autocomplete="new-password" ' + (data.hasPassword ? 'placeholder="저장됨 · 변경할 때만 입력"' : 'required placeholder="메일 비밀번호 입력"')) + '</div>' +
          '<p class="muted email-password-help">' + (data.passwordNeedsReset ? '저장된 비밀번호를 읽을 수 없습니다. 비밀번호를 다시 입력해 주세요.' : '메일 서비스에서 앱 비밀번호를 사용하는 경우 앱 비밀번호를 입력하세요.') + '</p></section></div>' +
          '<section class="settings-group settings-group-sender" aria-labelledby="emailSenderHeading"><h4 id="emailSenderHeading">발신자 정보</h4><div class="settings-field-pair">' +
          input('fromName', '발신자 이름', 'text', 'required maxlength="255"') +
          input('from', '발신 이메일', 'email', 'required maxlength="255" placeholder="admission@example.ac.kr"') + '</div><p class="muted email-password-help">메일 계정에서 발송 가능한 주소를 입력하세요. 다음 메일의 별도 도메인 주소는 스마트워크 연결이 필요합니다.</p></section></div>' +
          '<div class="form-actions"><button class="ghost-button" type="button" data-email-check>' + (current.busy === 'check' ? '연결 확인 중...' : '연결 확인') + '</button><button class="primary-button" type="submit" data-email-save ' + (!dirty() ? 'disabled' : '') + '>' + (current.busy === 'save' ? '저장 중...' : '메일 설정 저장') + '</button></div>' +
          '</fieldset><p class="muted email-settings-note">연결 확인은 입력한 정보로 서버 연결과 계정 인증을 확인합니다. 메일은 발송하지 않습니다.</p><p class="system-settings-status' + (current.error ? ' warning' : '') + '" role="status">' + esc(current.status) + '</p></form>') + '</article>';
      this.querySelector('[data-email-retry]')?.addEventListener('click', () => {session = null; this.connectedCallback();});
      const form = this.querySelector('form'); if(!form) return;
      form.addEventListener('input', event => {
        if(!Object.hasOwn(current.draft, event.target.name)) return;
        current.draft[event.target.name] = event.target.name === 'port' ? Number(event.target.value) : event.target.value;
        current.status = ''; this.querySelector('[role="status"]').textContent = '';
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
        current.busy = 'check'; current.status = ''; this.render();
        try {const result = await api('/check', {method: 'POST', body: JSON.stringify(current.draft)}); current.status = result.message; current.error = false;}
        catch(error) {current.status = error.message; current.error = true;}
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
