(function (scope) {
  let sequence = 0;
  let firstInvalid = null;
  const fieldSelector = '.applicant-public-field, .applicant-member-terms, .login-stage-form .login-field';
  function badge(required) {
    return `<span class="applicant-public-badge is-${required ? 'required' : 'optional'}">${required ? '필수' : '선택'}</span>`;
  }
  function status(control, text = '', error = false) {
    const field = control?.closest(fieldSelector);
    if (!field) return false;
    let mount = field.querySelector('[data-field-feedback]');
    if (!mount && !text) return true;
    if (!mount) {
      mount = document.createElement('span');
      mount.dataset.fieldFeedback = '';
      mount.id = `field-feedback-${++sequence}`;
      mount.setAttribute('aria-live', 'polite');
      field.append(mount);
    }
    mount.textContent = text;
    mount.hidden = !text;
    mount.className = `applicant-public-field-feedback${error ? ' is-error' : ' is-success'}`;
    field.querySelectorAll('input:not([type=hidden]), select, textarea').forEach(input => {
      const ids = new Set((input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean));
      ids.add(mount.id);
      input.setAttribute('aria-describedby', [...ids].join(' '));
      if (error && text) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    });
    return true;
  }
  function validationMessage(input) {
    if (input.validity.customError) return input.validationMessage;
    if (input.validity.valueMissing) return input.type === 'checkbox' ? '필수 약관에 동의해 주세요.' : input.type === 'file' ? '파일을 업로드해 주세요.' : input.tagName === 'SELECT' ? '항목을 선택해 주세요.' : '필수 항목을 입력해 주세요.';
    if (input.validity.typeMismatch && input.type === 'email') return '올바른 이메일 주소를 입력해 주세요.';
    if (input.validity.tooShort || input.validity.tooLong) return `길이를 ${input.minLength}~${input.maxLength}자로 입력해 주세요.`;
    if (input.name === 'code') return '인증번호 6자리를 입력해 주세요.';
    return input.validationMessage || '입력 내용을 확인해 주세요.';
  }
  function validate(container) {
    let first = null;
    container.querySelectorAll('input, select, textarea').forEach(input => {
      if (input.willValidate && !input.validity.valid) {
        status(input, validationMessage(input), true);
        first ||= input;
      }
    });
    first?.focus();
    return !first;
  }
  // Native validity still blocks submission; suppress its floating tooltip only.
  document.addEventListener('invalid', event => {
    if (!event.target.closest(fieldSelector)) return;
    event.preventDefault();
    status(event.target, validationMessage(event.target), true);
    if (!firstInvalid) {
      firstInvalid = event.target;
      queueMicrotask(() => { firstInvalid?.focus(); firstInvalid = null; });
    }
  }, true);
  for (const eventName of ['input', 'change']) document.addEventListener(eventName, event => {
    if (eventName === 'change' && !event.target.matches('select, [type=file], [type=checkbox], [type=radio]')) return;
    if (event.target.matches('input, select, textarea')) status(event.target);
  }, true);
  scope.AdmitCardPublicFormFeedback = Object.freeze({ badge, status, validate });
})(globalThis);
