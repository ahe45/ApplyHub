(function (scope) {
  scope.createApplicantMembershipController = function ({ apiRequest, escapeHtml: esc, render, navigate, setMessage, openApplication, clearApplication, getApplyAvailability = () => ({ isAvailable: true }) }) {
    const controls = scope.AdmitCardApplicantPublicRenderingHelpers;
    const feedback = scope.AdmitCardPublicFormFeedback;
    let member = null;
    let settings = null;
    let applicationContext = null, contextRequest = null, contextCheckedAt = 0, serverClockOffset = 0, menuTimer = null;
    let contextError = '';
    let busy = false;
    let signup = {};
    let signupStep = 'terms';
    let agreedTermsVersion = '';
    let termConsents = [];
    let verificationId = "";
    let verifiedEmail = "";
    let developmentCode = "";
    let sendingCode = false;
    let resendAvailableAt = 0;
    let resendTimer = null;
    const resendStorageKey = 'applyhub.signup-resend-at';
    try { resendAvailableAt = Number(sessionStorage.getItem(resendStorageKey)) || 0; } catch { /* In-memory fallback. */ }
    const resendSeconds = () => Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));
    const sendButtonText = () => sendingCode ? '발송 중…' : resendSeconds() ? `재발송까지 ${resendSeconds()}초` : verificationId ? '인증번호 재발송' : '인증번호 발송';
    const preview = new URLSearchParams(location.search).get('preview') === '1';
    const uploads = new Map();
    const pendingUploads = new Set();
    const uploadErrors = new Map();
    const request = (path, payload) => apiRequest(`/api/public/members/${path}`, payload === undefined ? {} : { method: "POST", body: JSON.stringify(payload) });
    const input = (name, label, type = "text", required = true, value = "", autocomplete = "") => `<label class="applicant-public-field"><span>${esc(label)}${feedback.badge(required)}</span><input name="${esc(name)}" type="${type}" value="${esc(value)}" ${required ? "required" : ""} ${autocomplete ? `autocomplete="${autocomplete}"` : ""} ${type === "password" ? 'minlength="4" maxlength="20"' : 'maxlength="500"'} /></label>`;
    async function initialize() {
      const [config, session] = await Promise.all([request("settings"), request("session")]);
      settings = config;
      member = session.member;
      if (!member && window.location.pathname !== "/applicant/signup") window.location.replace("/login");
      if (member && !preview) {
        await refreshApplication().catch(() => {});
        startMenuTimer();
      }
      return member;
    }
    function setApplicationContext(context) {
      applicationContext = context; contextError = '';
      if (Number.isFinite(context.serverTime)) serverClockOffset = context.serverTime - Date.now();
      syncMenuButtons();
    }
    function refreshApplication() {
      if (contextRequest) return contextRequest;
      contextCheckedAt = Date.now();
      contextRequest = request('application').then(result => { setApplicationContext(result); return result; })
        .catch(error => { contextError = '접수 정보를 불러오지 못했습니다. 잠시 후 다시 시도하세요.'; syncMenuButtons(); throw error; })
        .finally(() => { contextRequest = null; });
      return contextRequest;
    }
    function menuState(key) {
      const complete = Boolean(applicationContext?.submission?.id);
      const label = { apply: complete ? '접수완료' : '원서접수', summary: '접수결과 조회', ticket: '수험표 조회', documents: '서류 제출' }[key];
      let reason = contextError || (!applicationContext ? '접수 정보를 확인하는 중입니다.' : '');
      if (!reason && key === 'apply') {
        const availability = getApplyAvailability();
        reason = complete ? '접수가 완료되었습니다.' : !availability.isAvailable ? availability.disabledMessage || '현재는 접수 기간이 아닙니다.' : '';
      } else if (!reason && !complete) reason = '접수 완료 후 이용할 수 있습니다.';
      else if (!reason && (key === 'ticket' || key === 'documents')) {
        const window = applicationContext.menuWindows?.[key];
        const now = Date.now() + serverClockOffset;
        reason = !Number.isFinite(window?.startAt) || !Number.isFinite(window?.endAt) || window.startAt > window.endAt ? '기간이 아직 설정되지 않았습니다.'
          : now < window.startAt ? '아직 이용 기간이 아닙니다.' : now > window.endAt ? '이용 기간이 종료되었습니다.' : '';
      }
      return { label, isAvailable: !reason, disabled: busy || Boolean(reason), complete: key === 'apply' && complete,
        description: reason || { apply: '접수 신청서 작성', summary: '나의 접수 내역 확인', ticket: '수험표 확인 및 출력', documents: '첨부 서류 업로드' }[key] };
    }
    function syncMenuButtons() {
      document.querySelectorAll('.applicant-member-menu [data-applicant-action]').forEach(button => {
        const item = menuState(button.dataset.applicantAction.replace('member-', ''));
        button.disabled = item.disabled; button.classList.toggle('is-complete', item.complete);
        button.querySelector('strong').textContent = item.label;
        button.querySelector('small').textContent = item.description;
      });
    }
    function startMenuTimer() {
      clearInterval(menuTimer);
      menuTimer = setInterval(() => {
        if (document.hidden || !document.querySelector('.applicant-member-menu')) return;
        syncMenuButtons();
        if (Date.now() - contextCheckedAt >= 30000) refreshApplication().catch(() => {});
      }, 1000);
    }
    window.addEventListener('pagehide', () => clearInterval(menuTimer));
    window.addEventListener('pageshow', () => { if (member && !preview) { startMenuTimer(); refreshApplication().catch(() => {}); } });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && member && !preview) refreshApplication().catch(() => {}); });
    function home() {
      if (!settings) return `<p class="muted">로그인 정보를 불러오는 중입니다.</p>`;
      if (!member) return `<a class="primary-button" href="/login">공통 로그인으로 이동</a>`;
      return `<div class="applicant-member-menu">${['apply', 'documents', 'summary', 'ticket'].map(key => {
          const item = menuState(key);
          return `<button type="button" class="ghost-button applicant-member-tile${item.complete ? ' is-complete' : ''}" data-applicant-action="member-${key}" ${item.disabled ? 'disabled' : ''}><span class="applicant-member-tile-number" aria-hidden="true">${controls.getApplicantHomeActionIconMarkup(key === 'documents' ? 'scan' : key)}</span><strong>${esc(item.label)}</strong><small>${esc(item.description)}</small></button>`;
        }).join('')}</div>`;
    }
    function isValidSignupEmail(value) {
      const email = String(value || '').trim();
      if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
      const probe = document.createElement('input');
      probe.type = 'email'; probe.value = email;
      return probe.validity.valid;
    }
    function syncEmailSendButton() {
      const form = document.querySelector('[data-applicant-form="member-register"]');
      const button = form?.querySelector('[data-applicant-action="member-send-code"]');
      if (button) {
        button.disabled = busy || preview || resendSeconds() > 0 || !isValidSignupEmail(form.elements.email?.value);
        button.textContent = sendButtonText();
      }
      const verifyButton = form?.querySelector('[data-applicant-action="member-verify-code"]');
      if (verifyButton) verifyButton.disabled = busy || preview || !canVerifyEmail(form);
      if (button && resendSeconds() > 0 && !resendTimer) resendTimer = setInterval(syncEmailSendButton, 250);
      if ((!button || !resendSeconds()) && resendTimer) { clearInterval(resendTimer); resendTimer = null; }
    }
    function canVerifyEmail(form) {
      return Boolean(verificationId && !verifiedEmail && isValidSignupEmail(form?.elements.email?.value) && /^[0-9]{6}$/.test(form?.elements.code?.value || ''));
    }
    window.addEventListener('pagehide', () => { clearInterval(resendTimer); resendTimer = null; });
    function signupQuestion(q) {
      const core = ['password', 'name', 'email'].includes(q.key);
      const name = core ? q.key : `profile.${q.key}`;
      const value = signup[name] || '';
      const label = `${esc(q.label)}${feedback.badge(q.required)}`;
      const hint = q.key === 'email' ? '인증한 이메일을 로그인 ID로 사용합니다.' : q.key === 'password' ? '4~20자' : '';
      const note = q.description || hint ? `<small class="muted">${esc([q.description, hint].filter(Boolean).join(' · '))}</small>` : '';
      let control;
      if (['file', 'photo'].includes(q.inputType)) {
        const extensions = q.inputType === 'photo' ? ['jpg', 'jpeg', 'png'] : q.allowedExtensions?.length ? q.allowedExtensions : ['pdf', 'jpg', 'jpeg', 'png'];
        control = `<input type="file" aria-label="${esc(q.label)}" data-member-file="${esc(q.key)}" data-member-file-type="${q.inputType}" accept="${esc(extensions.map(e => '.' + e).join(','))}" ${q.required ? 'required' : ''} /><small>허용 확장자: ${esc(extensions.join(', '))} · 파일당 5MB, 전체 8MB 이하</small><span data-member-upload-preview="${esc(q.key)}"></span>`;
      } else if (q.inputType === 'textarea') {
        control = `<textarea name="${esc(name)}" aria-label="${esc(q.label)}" rows="4" maxlength="10000" ${q.required ? 'required' : ''}>${esc(value)}</textarea>`;
      } else if (['date', 'birthdate'].includes(q.inputType)) {
        const [year = '', month = '', day = ''] = value.split('-');
        control = `<div ${q.inputType === 'birthdate' ? 'class="applicant-member-birthdate"' : ''}>${controls.renderDateSelectControls({ fieldKey: q.key, inputType: q.inputType, parts: { year, month, day }, prefix: 'member', label: q.label, required: q.required })}</div><input type="hidden" name="${esc(name)}" data-member-date-value="${esc(q.key)}" value="${esc(value)}" />`;
      } else if (q.inputType === 'nationality') {
        const selected = scope.AdmitCardApplicantFormConfig.findApplicantNationalityOption(value);
        control = `<div class="applicant-public-nationality-combobox"><input type="search" data-member-nationality-search="${esc(q.key)}" aria-label="${esc(q.label)}" value="${esc(selected?.label || '')}" placeholder="국가를 검색하세요" autocomplete="off" spellcheck="false" ${q.required ? 'required' : ''} /><input type="hidden" name="${esc(name)}" value="${esc(selected?.code || '')}" /><div class="applicant-public-nationality-picker" data-member-nationality-picker="${esc(q.key)}"></div></div><small class="applicant-public-file-note">국가명을 검색한 뒤 목록에서 선택하세요.</small>`;
      } else if (q.inputType === 'select') {
        const options = q.options.map(v => [v, v]);
        control = `<select name="${esc(name)}" aria-label="${esc(q.label)}" data-member-select="${esc(q.key)}" ${q.required ? 'required' : ''}><option value="">선택하세요</option>${options.map(([key, text]) => `<option value="${esc(key)}" ${key === value ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select>${q.customOptionLabel ? `<input type="text" name="custom.${esc(q.key)}" data-member-custom="${esc(q.key)}" aria-label="${esc(q.label)} 직접 입력" placeholder="직접 입력하세요" maxlength="200" hidden />` : ''}`;
      } else {
        const type = q.inputType === 'phone' ? 'text' : q.inputType;
        control = `<input name="${esc(name)}" aria-label="${esc(q.label)}" type="${esc(type)}" value="${esc(value)}" ${q.required ? 'required' : ''} ${q.inputType === 'phone' ? 'data-member-phone inputmode="numeric" pattern="[0-9]*" maxlength="20" autocomplete="tel-national"' : q.key === 'password' ? 'minlength="4" maxlength="20"' : q.key === 'email' ? 'maxlength="255" autocapitalize="none" spellcheck="false"' : 'maxlength="500"'} ${core ? `autocomplete="${({ password: 'new-password', name: 'name', email: 'email' })[q.key]}"` : ''} />`;
      }
      if (q.key === 'email' && settings.emailVerification) control = `<div class="applicant-member-input-action">${control}<button class="primary-button" type="button" data-applicant-action="member-send-code" ${busy || preview || resendSeconds() > 0 || !isValidSignupEmail(value) ? 'disabled' : ''}>${sendButtonText()}</button></div>`;
      let html = `<div class="applicant-public-field"><span>${label}</span>${note}${control}</div>`;
      if (q.key === 'password') html += input('passwordConfirm', '비밀번호 확인', 'password', true, '', 'new-password');
      if (q.key === 'email' && settings.emailVerification) html += `<div class="applicant-public-field"><label for="memberEmailCode">인증번호${feedback.badge(true)}</label><div class="applicant-member-input-action"><input id="memberEmailCode" name="code" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" required autocomplete="one-time-code" /><button class="ghost-button" type="button" data-applicant-action="member-verify-code" disabled>인증 확인</button></div><span data-member-verified class="applicant-public-field-feedback is-success" role="status">${verifiedEmail ? '이메일 인증 완료' : ''}</span><p class="applicant-public-preview-note" data-member-code-preview role="status" ${developmentCode ? '' : 'hidden'}>${developmentCode ? esc(`개발용 인증번호: ${developmentCode} · 실제 이메일은 발송되지 않습니다.`) : ''}</p></div>`;
      return html;
    }
    document.addEventListener('change', event => {
      if (event.target.matches('[data-applicant-form="member-register"] [name="email"], #memberEmailCode')) syncEmailSendButton();
      const date = event.target.closest('[data-member-date-field-key]');
      if (date) {
        const q = settings.questions.find(q => q.key === date.dataset.memberDateFieldKey), field = date.closest('.applicant-public-field');
        const parts = Object.fromEntries([...field.querySelectorAll('[data-member-date-part]')].map(select => [select.dataset.memberDatePart, select.value]));
        const dayCount = controls.getDateDayCount(parts.year, parts.month);
        if (Number(parts.day) > dayCount) parts.day = '';
        const daySelect = field.querySelector('[data-member-date-part=day]');
        daySelect.innerHTML = controls.renderDateOptions(Array.from({ length: dayCount }, (_, i) => String(i + 1).padStart(2, '0')), parts.day, '일');
        const value = parts.year && parts.month && parts.day ? `${parts.year}-${parts.month}-${parts.day}` : '';
        field.querySelector('[data-member-date-value]').value = value;
        field.querySelectorAll('[data-member-date-part]').forEach(select => { select.required = q.required || Object.values(parts).some(Boolean); });
        const today = new Date(), localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        daySelect.setCustomValidity(q.inputType === 'birthdate' && value > localToday ? '생년월일은 오늘 이전 날짜로 선택하세요.' : '');
        return;
      }
      const select = event.target.closest('[data-member-select]');
      if (select) {
        const q = settings.questions.find(q => q.key === select.dataset.memberSelect);
        const custom = select.parentElement.querySelector('[data-member-custom]');
        if (custom) { custom.hidden = select.value !== q.customOptionLabel; custom.required = !custom.hidden; }
      }
      const fileInput = event.target.closest('[data-member-file]');
      if (!fileInput) return;
      const key = fileInput.dataset.memberFile, file = fileInput.files[0], mount = fileInput.parentElement.querySelector('[data-member-upload-preview]');
      uploads.delete(key); uploadErrors.delete(key); mount.textContent = '';
      if (!file) return;
      const promise = (async () => {
        const q = settings.questions.find(q => q.key === key);
        const allowed = q.inputType === 'photo' ? ['jpg', 'jpeg', 'png'] : q.allowedExtensions?.length ? q.allowedExtensions : ['pdf', 'jpg', 'jpeg', 'png'];
        if (!scope.AdmitCardApplicantFormConfig.isAllowedUploadExtension(file.name, allowed)) throw new Error(`${allowed.join(', ')} 파일만 업로드할 수 있습니다.`);
        if (file.size > 5 * 1024 * 1024) throw new Error('파일은 5MB 이하여야 합니다.');
        const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
        if (fileInput.files[0] !== file) return;
        uploads.set(key, { fileName: file.name, mimeType: file.type, base64 }); mount.textContent = file.name;
        if (['image/jpeg', 'image/png'].includes(file.type)) {
          const img = document.createElement('img'); img.src = `data:${file.type};base64,${base64}`; img.alt = '업로드한 사진 미리보기'; img.style.maxWidth = '160px'; img.style.display = 'block'; mount.append(img);
        }
        feedback.status(fileInput, '파일을 첨부했습니다.');
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'ghost-button'; remove.textContent = '파일 삭제';
        remove.addEventListener('click', () => { fileInput.value = ''; uploads.delete(key); uploadErrors.delete(key); mount.textContent = ''; feedback.status(fileInput); }); mount.append(remove);
      })().catch(error => { if (fileInput.files[0] === file) { uploadErrors.set(key, error.message); feedback.status(fileInput, error.message, true); } });
      pendingUploads.add(promise); promise.finally(() => pendingUploads.delete(promise));
    });
    function showMemberNationality(input) {
      const query = input.value.trim().toLowerCase(), key = input.dataset.memberNationalitySearch;
      const picker = input.parentElement.querySelector('[data-member-nationality-picker]');
      const options = scope.AdmitCardApplicantFormConfig.nationalityOptions.filter(option => !query || option.searchLabel.includes(query));
      picker.innerHTML = controls.renderNationalityOptions(options, key, input.parentElement.querySelector('input[type=hidden]').value, 'member', 'code');
      picker.classList.add('is-open');
    }
    document.addEventListener('focusin', event => { if (event.target.matches('[data-member-nationality-search]')) showMemberNationality(event.target); });
    document.addEventListener('input', event => {
      if (event.target.matches('#memberEmailCode')) {
        event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6);
        syncEmailSendButton();
      }
      if (event.target.matches('[data-member-phone]')) event.target.value = event.target.value.replace(/\D+/g, '');
      if (event.target.matches('[data-member-nationality-search]')) {
        event.target.parentElement.querySelector('input[type=hidden]').value = '';
        event.target.setCustomValidity(event.target.value.trim() ? '국가를 목록에서 선택하세요.' : '');
        showMemberNationality(event.target);
      }
    });
    document.addEventListener('click', event => {
      const option = event.target.closest('[data-member-nationality-value]');
      if (option) {
        const box = option.closest('.applicant-public-nationality-combobox'), input = box.querySelector('[data-member-nationality-search]');
        const country = scope.AdmitCardApplicantFormConfig.findApplicantNationalityOption(option.dataset.memberNationalityValue);
        box.querySelector('input[type=hidden]').value = country.code;
        input.value = country.label; input.setCustomValidity(''); input.focus();
        feedback.status(input);
        box.querySelector('[data-member-nationality-picker]').classList.remove('is-open');
      }
      document.querySelectorAll('[data-member-nationality-picker].is-open').forEach(picker => { if (!picker.parentElement.contains(event.target)) picker.classList.remove('is-open'); });
    });
    document.addEventListener('keydown', event => {
      const box = event.target.closest('.applicant-public-nationality-combobox');
      if (!box?.querySelector('[data-member-nationality-search]')) return;
      if (event.key === 'Escape') { event.preventDefault(); box.querySelector('[data-member-nationality-search]').focus(); box.querySelector('[data-member-nationality-picker]').classList.remove('is-open'); }
      if (event.key === 'ArrowDown' && event.target.matches('[data-member-nationality-search]')) { event.preventDefault(); showMemberNationality(event.target); box.querySelector('[data-member-nationality-value]')?.focus(); }
    });
    function hasRequiredTermConsents(consents = termConsents) {
      return (settings?.terms || []).every(term => !term.required || consents.some(c => c.id === term.id && c.agreed));
    }
    function readTermConsents(form) {
      return [...form.querySelectorAll('[data-member-term]')]
        .filter(input => input.closest('.applicant-member-consent-options').querySelector('input:checked'))
        .map(input => ({ id: input.dataset.memberTerm, agreed: input.checked }));
    }
    document.addEventListener('change', event => {
      const form = event.target.closest('[data-applicant-form="member-terms"]');
      if (!form || !event.target.matches('input[type="radio"]')) return;
      termConsents = readTermConsents(form);
      form.querySelector('button[type="submit"]').disabled = !hasRequiredTermConsents();
    });
    function signupScreen() {
      if (!settings) return `<p>회원가입 설정을 불러오는 중입니다.</p>`;
      return `<section class="applicant-public-step"><article class="applicant-public-slab applicant-member-signup">
        <div class="applicant-public-application-header">
          <div class="applicant-public-application-header-copy"><h2>회원가입</h2></div>
        </div>
        <ol class="applicant-member-steps" aria-label="회원가입 단계"><li data-member-step-label="terms" ${signupStep === 'terms' ? 'aria-current="step"' : ''}>1. 약관 동의</li><li data-member-step-label="details" ${signupStep === 'details' ? 'aria-current="step"' : ''}>2. 정보 입력</li></ol>
        ${preview ? '<p class="applicant-public-message">미리보기입니다. 회원가입 및 이메일 발송은 실행되지 않습니다.</p>' : ''}<div data-member-message></div>
        <div data-member-step="terms" ${signupStep !== 'terms' ? 'hidden' : ''}>
          <form class="applicant-public-form" data-applicant-form="member-terms">
          ${(settings.terms || []).length ? settings.terms.map(term => `<div class="applicant-member-terms">
            <div class="applicant-member-terms-heading"><h3>${esc(term.title)}${feedback.badge(term.required)}</h3></div>
            <div class="applicant-member-terms-text" tabindex="0" role="region" aria-label="${esc(term.title)} 내용">${esc(term.text)}</div>
            <div class="applicant-member-terms-consent"><button class="ghost-button applicant-member-terms-view" type="button" data-member-term-view="${esc(term.id)}" aria-haspopup="dialog" aria-controls="member-term-dialog" aria-label="${esc(term.title)} 전문보기" title="전문보기"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 9h8M8 12h8M8 15h5"></path></svg></button><div class="applicant-member-consent-options" role="radiogroup" aria-label="${esc(term.title)} 동의 여부">
              <label class="applicant-member-consent-option"><input type="radio" name="term-consent-${esc(term.id)}" value="agree" data-member-term="${esc(term.id)}" ${termConsents.some(c => c.id === term.id && c.agreed) ? 'checked' : ''} /><span>동의</span></label>
              <label class="applicant-member-consent-option"><input type="radio" name="term-consent-${esc(term.id)}" value="disagree" ${termConsents.some(c => c.id === term.id && c.agreed === false) ? 'checked' : ''} /><span>미동의</span></label>
            </div></div>
          </div>`).join('') : '<p class="applicant-public-preview-note">현재 별도로 동의할 약관이 없습니다. 다음 단계에서 회원 정보를 입력해 주세요.</p>'}
          <div class="applicant-public-actions"><button class="ghost-button" type="button" data-applicant-action="member-terms-all" ${settings.terms?.length ? '' : 'disabled'}>전체 동의</button><button class="primary-button" type="submit" ${hasRequiredTermConsents() ? '' : 'disabled'}>다음</button></div>
          </form>
        </div>
        <div data-member-step="details" ${signupStep !== 'details' ? 'hidden' : ''}>
        <form class="applicant-public-form" data-applicant-form="member-register">
        <div class="applicant-member-form-grid">${settings.questions.map(signupQuestion).join('')}</div>
        <div class="applicant-public-actions"><button class="ghost-button" type="button" data-applicant-action="member-terms-back">이전</button><button class="primary-button" type="submit" ${busy || preview ? "disabled" : ""}>회원가입</button></div>
      </form></div></article>
      <dialog id="member-term-dialog" class="applicant-member-term-dialog" aria-labelledby="member-term-dialog-title">
        <div class="applicant-member-term-dialog-heading"><h2 id="member-term-dialog-title"></h2><button class="ghost-button" type="button" data-member-term-close autofocus>닫기</button></div>
        <div class="applicant-member-term-dialog-text" data-member-term-content tabindex="0" role="region" aria-label="약관 전문"></div>
      </dialog></section>`;
    }
    document.addEventListener('click', event => {
      const view = event.target.closest('[data-member-term-view]');
      const dialog = document.getElementById('member-term-dialog');
      if (!dialog) return;
      if (view) {
        const term = settings?.terms.find(item => item.id === view.dataset.memberTermView);
        if (!term) return;
        dialog.querySelector('#member-term-dialog-title').textContent = term.title;
        const content = dialog.querySelector('[data-member-term-content]');
        content.textContent = term.text;
        dialog.showModal();
        content.scrollTop = 0;
      } else if (event.target.closest('[data-member-term-close]')) {
        dialog.close();
      } else if (event.target === dialog && dialog.open) {
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
      }
    });
    function showSignupStep(step) {
      signupStep = step;
      document.querySelectorAll('[data-member-step]').forEach(el => { el.hidden = el.dataset.memberStep !== step; });
      document.querySelectorAll('[data-member-step-label]').forEach(el => {
        if (el.dataset.memberStepLabel === step) el.setAttribute('aria-current', 'step');
        else el.removeAttribute('aria-current');
      });
      message('');
      syncEmailSendButton();
      document.querySelector(`[data-member-step="${step}"] input, [data-member-step="${step}"] button`)?.focus();
    }
    function formData(form) { return Object.fromEntries(new FormData(form)); }
    function showCodePreview(code = '') {
      developmentCode = /^\d{6}$/.test(String(code)) ? String(code) : '';
      const mount = document.querySelector('[data-member-code-preview]');
      if (mount) {
        mount.hidden = !developmentCode;
        mount.textContent = developmentCode ? `개발용 인증번호: ${developmentCode} · 실제 이메일은 발송되지 않습니다.` : '';
      }
    }
    document.addEventListener('input', event => {
      if (event.target.matches('[data-applicant-form="member-register"] [name="password"], [data-applicant-form="member-register"] [name="passwordConfirm"]')) {
        const form = event.target.form, confirm = form.elements.passwordConfirm;
        confirm.setCustomValidity(confirm.value && confirm.value !== form.elements.password.value ? '비밀번호 확인이 일치하지 않습니다.' : '');
        if (confirm.value) feedback.status(confirm, confirm.validationMessage || '비밀번호가 일치합니다.', !confirm.validity.valid);
      }
      if (!event.target.matches('[data-applicant-form="member-register"] [name="email"]')) return;
      showCodePreview(); verificationId = ''; verifiedEmail = '';
      syncEmailSendButton();
      const badge = document.querySelector('[data-member-verified]');
      if (badge) badge.textContent = '';
      feedback.status(document.getElementById('memberEmailCode'));
    });
    function message(text, error = false) {
      const mount = document.querySelector("[data-member-message]");
      if (mount) { mount.textContent = text; mount.setAttribute("role", "status"); mount.className = error ? "applicant-member-error" : "applicant-member-success"; }
      else { setMessage(error ? "error" : "success", text); render(); }
    }
    async function handleAction(action) {
      if (!action.startsWith("member-")) return false;
      if (busy) return true;
      if (action === 'member-send-code' && resendSeconds() > 0) return true;
      if (action === 'member-verify-code' && !canVerifyEmail(document.querySelector('[data-applicant-form="member-register"]'))) return true;
      try {
        if (action === "member-signup") { settings = await request("settings"); signup = {}; signupStep = 'terms'; agreedTermsVersion = ''; termConsents = []; uploads.clear(); uploadErrors.clear(); verificationId = ""; verifiedEmail = ""; navigate("signup"); return true; }
        if (action === "member-terms-back") { showSignupStep('terms'); return true; }
        if (action === "member-terms-all") {
          const form = document.querySelector('[data-applicant-form="member-terms"]');
          if (form) {
            form.querySelectorAll('[data-member-term]').forEach(input => { input.checked = true; });
            termConsents = readTermConsents(form);
            form.querySelector('button[type="submit"]').disabled = !hasRequiredTermConsents();
            message('');
          }
          return true;
        }
        if (action === "member-home") { signup = {}; window.location.assign(member ? "/applicant" : "/login"); return true; }
        if (action === "member-logout") { await apiRequest("/api/auth/logout", { method: "POST" }); member = null; clearApplication(); window.location.replace("/login"); return true; }
        busy = true;
        syncEmailSendButton();
        if (action === "member-send-code" || action === "member-verify-code") {
          if (preview) return true;
          const form = document.querySelector("[data-applicant-form='member-register']");
          const data = formData(form);
          const emailInput = form.elements.email, codeInput = form.elements.code;
          if (!isValidSignupEmail(emailInput.value)) {
            feedback.status(emailInput, '올바른 이메일을 입력하세요.', true);
            return true;
          }
          if (!emailInput.reportValidity()) return true;
          if (action === 'member-verify-code' && !codeInput.reportValidity()) return true;
          signup = { ...data, password: "", passwordConfirm: "" };
          if (action === "member-send-code") {
            sendingCode = true;
            codeInput.value = '';
            syncEmailSendButton();
            showCodePreview();
            verificationId = ''; verifiedEmail = '';
            form.querySelector('[data-member-verified]').textContent = '';
            feedback.status(codeInput);
            const result = await request("email-code", { email: data.email });
            resendAvailableAt = Date.now() + 10000;
            try { sessionStorage.setItem(resendStorageKey, String(resendAvailableAt)); } catch { /* In-memory fallback. */ }
            // Ignore a response for an email changed while the request was pending.
            if (emailInput.value.trim().toLowerCase() !== data.email.trim().toLowerCase()) return true;
            verificationId = result.verificationId;
            verifiedEmail = "";
            showCodePreview(result.debugCode);
            feedback.status(emailInput, developmentCode ? "아래 개발용 인증번호를 입력해 주세요. (10분간 유효)" : "인증번호를 발송했습니다. 10분 안에 입력하세요.");
          } else {
            await request("verify-email", { email: data.email, code: data.code, verificationId });
            if (emailInput.value.trim().toLowerCase() !== data.email.trim().toLowerCase()) return true;
            verifiedEmail = data.email.trim().toLowerCase();
            showCodePreview();
            const badge = form.querySelector("[data-member-verified]");
            if (badge) badge.textContent = "이메일 인증 완료";
            feedback.status(codeInput);
            feedback.status(emailInput, '인증한 이메일입니다.');
          }
          return true;
        }
        const result = await refreshApplication();
        const eligibility = menuState(action.replace('member-', ''));
        if (!eligibility.isAvailable) {
          throw new Error(eligibility.description);
        }
        await openApplication(action.replace("member-", ""), result, member);
      } catch (error) {
        if (error.status === 401 || error.statusCode === 401) { member = null; clearApplication(); window.location.replace("/login"); return true; }
        if (['member-send-code', 'member-verify-code'].includes(action)) {
          if (action === 'member-verify-code') {
            verifiedEmail = '';
            document.querySelector('[data-member-verified]').textContent = '';
            feedback.status(document.querySelector('[data-applicant-form="member-register"] [name=email]'));
          }
          feedback.status(document.querySelector(`[data-applicant-form="member-register"] [name="${action === 'member-send-code' ? 'email' : 'code'}"]`), error.message || '인증을 처리하지 못했습니다.', true);
        } else message(error.message || "요청을 처리하지 못했습니다.", true);
      } finally { busy = false; sendingCode = false; syncEmailSendButton(); if (!document.querySelector("[data-applicant-form='member-register']")) render(); }
      return true;
    }
    async function handleSubmit(form) {
      const type = form.dataset.applicantForm;
      if (type === 'member-terms') {
        if (busy || !form.reportValidity()) return true;
        termConsents = readTermConsents(form);
        if (!hasRequiredTermConsents()) { message('필수 약관에 모두 동의해 주세요.', true); return true; }
        agreedTermsVersion = settings.termsVersion;
        showSignupStep('details');
        return true;
      }
      if (type !== "member-register") return false;
      if (signupStep !== 'details' || (settings.termsEnabled && agreedTermsVersion !== settings.termsVersion)) {
        showSignupStep('terms'); message('약관을 확인하고 다음 단계로 진행해 주세요.', true); return true;
      }
      if (preview) { message('미리보기에서는 가입되지 않습니다.'); return true; }
      if (busy) return true;
      if (!feedback.validate(form)) return true;
      if (verifiedEmail !== String(form.elements.email.value || '').trim().toLowerCase()) {
        feedback.status(form.elements.code || form.elements.email, '현재 이메일의 인증을 완료하세요.', true);
        (form.elements.code || form.elements.email).focus();
        return true;
      }
      busy = true;
      const button = form.querySelector("button[type=submit]");
      if (button) button.disabled = true;
      try {
        const data = formData(form);
        {
          const profile = Object.fromEntries(Object.entries(data).filter(([key]) => key.startsWith("profile.")).map(([key, value]) => [key.slice(8), value]));
          await Promise.all([...pendingUploads]);
          if (uploadErrors.size) {
            const [key, text] = [...uploadErrors][0];
            const control = [...form.querySelectorAll('[data-member-file]')].find(input => input.dataset.memberFile === key);
            feedback.status(control, text, true); control?.focus(); return true;
          }
          for (const [key, upload] of uploads) profile[key] = upload;
          for (const q of settings.questions) if (q.customOptionLabel && profile[q.key] === q.customOptionLabel) profile[q.key] = q.customOptionLabel + ': ' + String(data[`custom.${q.key}`] || '').trim();
          await request("register", { ...data, termConsents, profile, verificationId, termsVersion: agreedTermsVersion });
          signup = {}; verificationId = ""; verifiedEmail = "";
          setMessage("success", "회원가입이 완료되었습니다.");
          busy = false;
          window.location.replace("/applicant");
        }
      } catch (error) {
        const control = error.fieldKey ? form.elements.namedItem(error.fieldKey) || [...form.querySelectorAll('[data-member-file], [data-member-date-field-key]')].find(input => `profile.${input.dataset.memberFile || input.dataset.memberDateFieldKey}` === error.fieldKey) : null;
        if (control && feedback.status(control, error.message, true)) {
          (control.type === 'hidden' ? control.closest('.applicant-public-field').querySelector('input:not([type=hidden]), select, textarea') : control)?.focus();
        }
        else message(error.message || "요청을 처리하지 못했습니다.", true);
      }
      finally { busy = false; if (button) button.disabled = false; }
      return true;
    }
    return { initialize, home, signupScreen, handleAction, handleSubmit, refreshApplication,
      markSubmitted(submission) { setApplicationContext({ ...applicationContext, submission }); }, get member() { return member; },
      get birthDate() {
        return member?.birthDate || scope.AdmitCardApplicantFormConfig.getMemberBirthDate(member, settings?.questions);
      },
    };
  };
})(globalThis);
