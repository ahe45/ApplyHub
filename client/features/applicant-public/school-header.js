(function () {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fallbackLogo = '/client/assets/logo.png';
  const safeLogo = value => /^(\/(?!\/)|https?:\/\/|data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,)/i.test(String(value || '')) ? value : fallbackLogo;
  let contextPromise;
  function getContext() {
    if (!contextPromise) contextPromise = Promise.all([
      globalThis.AdmitCardApiClient.apiRequest('/api/public/school-branding').catch(() => ({})),
      globalThis.AdmitCardApiClient.apiRequest('/api/public/members/session').catch(() => ({ member: null })),
    ]);
    return contextPromise;
  }
  class PublicSchoolHeader extends HTMLElement {
    connectedCallback() {
      this.render({}, false);
      getContext().then(([branding, session]) => { if (this.isConnected) this.render(branding, Boolean(session.member)); });
    }
    render(branding, signedIn) {
      const preview = new URLSearchParams(location.search).get('preview') === '1';
      const name = branding.schoolName || '원서접수시스템';
      this.innerHTML = `<header class="public-school-header" aria-label="사용자 메뉴">
        <a class="ghost-button public-school-home" href="${preview ? '/applicant?preview=1' : signedIn ? '/applicant' : '/login'}" aria-label="처음으로" title="처음으로"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9" /></svg></a>
        <div class="public-school-brand"><img src="${escape(safeLogo(branding.logoImageUrl))}" alt="" /><strong title="${escape(name)}">${escape(name)}</strong></div>
        ${signedIn && !preview ? '<button class="ghost-button public-school-logout" type="button" title="로그아웃" aria-label="로그아웃"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 7.5V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-1.5"></path><path d="M10 12h9"></path><path d="m16 8 4 4-4 4"></path></svg></button>' : '<span class="public-school-action-spacer" aria-hidden="true"></span>'}
      </header><p class="public-school-header-error" role="alert" hidden></p>`;
      this.querySelector('img').addEventListener('error', event => {
        const img = event.currentTarget;
        if (img.getAttribute('src') !== fallbackLogo) img.src = fallbackLogo;
        else img.hidden = true;
      });
      this.querySelector('.public-school-logout')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        if (button.disabled) return;
        button.disabled = true;
        try {
          await globalThis.AdmitCardApiClient.apiRequest('/api/auth/logout', { method: 'POST' });
          location.replace('/login');
        } catch {
          const error = this.querySelector('.public-school-header-error');
          error.hidden = false; error.textContent = '로그아웃하지 못했습니다. 다시 시도해 주세요.';
          button.disabled = false;
        }
      });
    }
  }
  customElements.define('public-school-header', PublicSchoolHeader);
})();
