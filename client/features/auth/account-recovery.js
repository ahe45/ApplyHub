(function () {
  const mode = 'password';
  if (new URLSearchParams(location.search).get('mode') === 'id') history.replaceState(null, '', '/account-recovery?mode=password');
  const title = '비밀번호 재설정';
  let recoveryId = '', busy = false;
  const feedback = globalThis.AdmitCardPublicFormFeedback;
  const input = (name, label, type, autocomplete, extra = '') => `<label class="applicant-public-field"><span>${label}${feedback.badge(true)}</span><input name="${name}" type="${type}" autocomplete="${autocomplete}" required ${extra} /></label>`;
  document.title = `${title} | 원서접수시스템`;
  document.getElementById('accountRecoveryRoot').innerHTML = `<public-school-header></public-school-header><article class="applicant-public-slab">
    <h2>${title}</h2><p>가입한 이름과 이메일로 본인 확인 후 새 비밀번호를 설정하세요. 이메일이 로그인 ID입니다.</p>
    <div id="recoveryMessage" role="status" aria-live="polite"></div>
    <form id="recoveryForm" class="applicant-public-form">
      <fieldset class="recovery-fieldset" id="recoveryIdentity">
        ${input('name', '이름', 'text', 'name', 'maxlength="100"')}
        ${input('email', '가입 이메일', 'email', 'email', 'maxlength="255"')}
      </fieldset>
      <fieldset class="recovery-fieldset" id="recoveryProof" hidden disabled>
        ${input('code', '이메일 인증번호', 'text', 'one-time-code', 'inputmode="numeric" pattern="[0-9]{6}" maxlength="6"')}
        <small class="muted">인증번호는 10분 동안 유효하며 최대 5회 확인할 수 있습니다.</small>
        ${input('password', '새 비밀번호 (4~20자)', 'password', 'new-password', 'minlength="4" maxlength="20"') + input('passwordConfirm', '새 비밀번호 확인', 'password', 'new-password', 'minlength="4" maxlength="20"')}
        <button class="ghost-button" type="button" id="recoveryRestart">정보 수정 / 인증번호 다시 요청</button>
      </fieldset>
      <button class="primary-button" type="submit" id="recoverySubmit">인증번호 받기</button>
    </form>
    <div class="applicant-public-message is-success" id="recoverySuccess" role="status" hidden><span id="recoverySuccessText"></span></div>
    <div class="applicant-public-actions"><a class="ghost-button applicant-public-back-button" href="/login">이전</a></div>
    <div class="recovery-help"><p>수험생 회원 계정 찾기 기능입니다. 관리자 계정은 계정 관리 담당자에게 문의해 주세요.</p><p>이메일을 사용할 수 없는 경우에도 담당자에게 문의해 주세요.</p></div>
  </article>`;
  const form = document.getElementById('recoveryForm'), identity = document.getElementById('recoveryIdentity'), proof = document.getElementById('recoveryProof');
  const button = document.getElementById('recoverySubmit'), message = document.getElementById('recoveryMessage');
  function notify(text, error = false) { message.textContent = text; message.classList.toggle('is-error', error); }
  document.getElementById('recoveryRestart').addEventListener('click', () => {
    if (busy) return;
    recoveryId = ''; proof.hidden = true; proof.disabled = true;
    identity.querySelectorAll('input').forEach(input => input.readOnly = false);
    proof.querySelectorAll('input').forEach(input => input.value = '');
    button.textContent = '인증번호 받기'; notify('');
    form.querySelectorAll('input').forEach(input => feedback.status(input));
    feedback.status(form.elements.email, '인증번호는 1분 간격으로 다시 요청할 수 있습니다.');
    identity.querySelector('input').focus();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    const data = Object.fromEntries(new FormData(form));
    if (recoveryId && data.password !== data.passwordConfirm) { feedback.status(form.elements.passwordConfirm, '비밀번호 확인이 일치하지 않습니다.', true); form.elements.passwordConfirm.focus(); return; }
    busy = true; button.disabled = true; document.getElementById('recoveryRestart').disabled = true;
    const completing = Boolean(recoveryId);
    try {
      const result = await globalThis.AdmitCardApiClient.apiRequest(`/api/public/members/recovery/${completing ? 'complete' : 'request'}`, { method: 'POST', body: JSON.stringify({ ...data, purpose: mode, recoveryId, language: globalThis.ApplyHubPublicI18n?.language || 'ko' }) });
      if (!completing) {
        recoveryId = result.recoveryId; identity.querySelectorAll('input').forEach(input => input.readOnly = true);
        proof.hidden = false; proof.disabled = false; button.textContent = '비밀번호 재설정';
        notify(''); feedback.status(form.elements.email, result.message); proof.querySelector('input').focus();
      } else {
        form.hidden = true; notify(''); document.getElementById('recoverySuccess').hidden = false;
        document.getElementById('recoverySuccessText').textContent = '비밀번호를 변경했습니다. 이메일과 새 비밀번호로 로그인해 주세요.';
        proof.querySelectorAll('input').forEach(input => input.value = ''); recoveryId = '';
      }
    } catch (error) {
      if (error.status >= 400 && error.status < 500) feedback.status(form.elements.namedItem(error.fieldKey || (completing ? 'code' : 'email')), error.message, true);
      else notify(error.message || '요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요.', true);
    }
    finally { busy = false; button.disabled = false; document.getElementById('recoveryRestart').disabled = false; }
  });
})();
