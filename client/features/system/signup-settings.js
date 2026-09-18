(function (scope) {
  const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const coreKeys = ['email', 'password', 'name'];
  let settings = null, editor = {}, termEditor = null, rerenderQuestions = null, busy = false, status = '', dragKey = '', termDragKey = '';
  const api = payload => scope.AdmitCardApiClient.apiRequest('/api/applicant-signup-settings', payload ? { method: 'PUT', body: JSON.stringify(payload) } : {});
  function redraw() { rerenderQuestions?.(); }
  function termsContent() {
    if (!settings) return '<p>약관을 불러오는 중입니다.</p>';
    const terms = settings.terms || [], draft = termEditor;
    const isNew = draft && !terms.some(t => t.id === draft.id);
    const displayTerms = isNew ? [...terms, { ...draft, isDraft: true }] : terms;
    const list = scope.AdmitCardTemplateManagementRenderers.renderApplicantFieldList(
      displayTerms.map(term => ({ ...term, questionText: term.title || '새 약관', questionDescription: term.text.length > 80 ? `${term.text.slice(0, 80)}…` : term.text,
        answerTypeLabel: '약관 동의', systemLabel: term.enabled ? '사용 중' : '미사용' })),
      { isActive: !!draft, editingId: draft?.id },
      { empty: '등록된 약관이 없습니다.', emptyHelp: '상단의 새 약관 추가 버튼으로 첫 약관을 생성하세요.', cardHelp: '드래그하여 순서를 변경하거나 클릭하여 약관을 수정합니다.' }
    ).replaceAll('data-applicant-field-direction="up"', 'data-direction="-1"').replaceAll('data-applicant-field-direction="down"', 'data-direction="1"').replaceAll('data-applicant-field-', 'data-term-');
    const disabled = draft ? '' : 'disabled';
    return `<div id="signup-terms-editor" class="view-stack"><p data-signup-status role="status">${esc(status)}</p>
      <fieldset class="signup-question-controls" ${busy ? 'disabled' : ''}><section class="applicant-settings-layout">
        <article class="form-card applicant-settings-fields-panel">
          <div class="section-header"><div class="menu-section-copy"><h3>약관관리</h3><p>사용 중인 약관이 회원가입 첫 화면에 순서대로 표시됩니다.</p></div>
            <div class="inline-actions"><button class="ghost-button" type="button" data-term-preview>미리보기</button><button class="ghost-button" type="button" data-term-add>새 약관 추가</button></div>
          </div>${list}
        </article>
        <div class="applicant-settings-side"><article class="form-card applicant-field-editor-panel ${draft ? '' : 'is-disabled'}">
          <div class="section-header"><div><h3>${draft ? isNew ? '약관 추가' : '약관 수정' : '약관 카드 선택'}</h3><p>${draft ? '약관 제목, 내용, 필수 동의와 사용 여부를 설정합니다.' : '약관 카드를 선택하거나 새 약관을 추가하면 수정할 수 있습니다.'}</p></div></div>
          <form data-term-form class="applicant-field-editor-form">
            <div class="signup-term-language-grid">
              <div class="signup-term-language-column">
                <label class="field"><span>제목(한국어)</span><input data-term-input="title" value="${esc(draft?.title)}" placeholder="예: 개인정보 수집 및 이용 동의" maxlength="100" required ${disabled} /></label>
                <label class="field"><span>내용(한국어)</span><textarea data-term-input="text" rows="12" maxlength="30000" placeholder="수험생에게 안내할 한국어 약관 내용을 입력하세요." ${draft?.enabled ? 'required' : ''} ${disabled}>${esc(draft?.text)}</textarea></label>
              </div>
              <div class="signup-term-language-column">
                <label class="field"><span>제목(영어)</span><input data-term-input="titleEn" value="${esc(draft?.titleEn)}" placeholder="예: Consent to Personal Data Collection and Use" maxlength="100" ${disabled} /></label>
                <label class="field"><span>내용(영어)</span><textarea data-term-input="textEn" rows="12" maxlength="30000" placeholder="수험생에게 안내할 영어 약관 내용을 입력하세요." ${disabled}>${esc(draft?.textEn)}</textarea></label>
              </div>
            </div>
            <p class="muted applicant-answer-type-help">영어 제목이나 내용을 비워두면 해당 항목은 한국어로 표시됩니다.</p>
            <label class="checkbox-field applicant-required-field"><input data-term-input="required" type="checkbox" ${draft?.required ? 'checked' : ''} ${disabled} /><span>필수 동의 항목으로 설정</span></label>
            <label class="checkbox-field applicant-required-field"><input data-term-input="enabled" type="checkbox" ${draft?.enabled ? 'checked' : ''} ${disabled} /><span>회원가입 화면에서 사용</span></label>
            <div class="form-actions"><button type="button" class="ghost-button" data-term-cancel ${disabled}>선택 해제</button><button class="primary-button" type="submit" ${disabled}>${isNew ? '약관 추가' : '약관 저장'}</button></div>
            <p class="muted applicant-answer-type-help">필수 동의를 끄면 동의하지 않아도 가입할 수 있습니다. 변경 전 회원의 동의 기록은 유지됩니다.</p>
          </form>
        </article></div>
      </section></fieldset></div>`;
  }
  function content() {
    if (!settings) return '<p>질문을 불러오는 중입니다.</p>';
    const markup = scope.AdmitCardTemplateManagementRenderers.renderApplicantFieldSettingsPanel({
      title: '회원가입', description: '회원가입에 표시할 질문과 답변 종류를 관리합니다. 이메일·비밀번호·이름은 필수이며 인증한 이메일로 로그인합니다.',
      fileUploadScope: 'signup',
      fields: settings.questions.map((q, index) => ({ ...q, id: q.key, questionText: q.label, questionDescription: q.description, questionTextEn: q.labelEn, questionDescriptionEn: q.descriptionEn, locked: coreKeys.includes(q.key), orderLocked: coreKeys.includes(q.key),
        moveUpDisabled: index === 0 || coreKeys.includes(settings.questions[index - 1]?.key), moveDownDisabled: index === settings.questions.length - 1,
        answerTypeLabel: ({password: '비밀번호', email: '이메일'})[q.inputType], systemLabel: coreKeys.includes(q.key) ? '기본 항목 · 순서 고정' : '일반 항목' })), editorState: editor, lockedCore: coreKeys.includes(editor.editingId),
      inputTypeOptions: scope.AdmitCardApplicantFormConfig.signupAnswerTypeOptions,
    }).replaceAll('data-applicant-field-', 'data-signup-field-');
    return `<div class="view-stack" id="signup-question-editor"><p role="status" data-signup-status>${esc(status)}</p><fieldset class="signup-question-controls" ${busy ? 'disabled' : ''}>${markup}</fieldset></div>`;
  }
  function renderSettings(tab = 'signup') {
    const renderContent = tab === 'terms' ? termsContent : content;
    if (!settings) queueMicrotask(async () => {
      const mount = document.getElementById('signup-question-mount'); if (!mount) return;
      try { settings = await api(); if (mount.isConnected) mount.innerHTML = renderContent(); }
      catch (error) { if (mount.isConnected) mount.textContent = error.message; }
    });
    return `<div id="signup-question-mount">${renderContent()}</div>`;
  }
  function renderQuestionManagement(renderApplication, rerender, canManageSignup) {
    rerenderQuestions = rerender;
    const requestedTab = new URLSearchParams(location.search).get('tab');
    const active = ['documents', 'signup', 'terms'].includes(requestedTab) ? requestedTab : 'application';
    return `<section class="view-stack question-management-view"><div class="template-management-tabs question-management-tabs" role="tablist" aria-label="질문 양식 구분">
      ${[['application', '원서접수'], ['documents', '서류제출'], ['signup', '회원가입'], ['terms', '약관관리']].map(([key, label]) => `<button class="template-management-tab ${active === key ? 'active' : ''}" id="question-tab-${key}" type="button" role="tab" aria-selected="${active === key}" aria-controls="question-management-panel" data-question-scope="${key}">${label}</button>`).join('')}
      </div><div id="question-management-panel" role="tabpanel" aria-labelledby="question-tab-${active}">${['signup', 'terms'].includes(active) ? (canManageSignup ? renderSettings(active) : '<article class="form-card">회원가입 질문과 약관은 관리자만 설정할 수 있습니다.</article>') : renderApplication(active)}</div></section>`;
  }
  async function persist(next, message) {
    busy = true; redraw();
    try { settings = await api(next); status = message; return true; }
    catch (error) { status = error.message; return false; }
    finally { busy = false; redraw(); }
  }
  async function saveQuestion() {
    if (!editor.isActive || busy) return;
    let choice = {};
    try { if (['select', 'multiselect'].includes(editor.inputType)) choice = scope.AdmitCardApplicantFormConfig.resolveChoiceOptionEdits(editor); }
    catch (error) { status = error.message; redraw(); return; }
    const q = { key: editor.editingId || `extra_${crypto.randomUUID()}`, label: editor.questionText, description: editor.questionDescription, labelEn: editor.questionTextEn || '', descriptionEn: editor.questionDescriptionEn || '',
      inputType: editor.inputType, required: editor.required, options: editor.options, optionsEn: editor.optionsEn || {}, customOptionLabel: editor.customOptionLabel || '',
      fileNamePattern: editor.fileNamePattern || '', allowedExtensions: editor.allowedExtensions || [], ...choice };
    delete q.optionKoreanEdits;
    const questions = editor.editingId ? settings.questions.map(old => old.key === editor.editingId ? q : old) : [...settings.questions, q];
    if (await persist({ ...settings, questions }, '회원가입 질문을 저장했습니다.')) { editor = {}; redraw(); }
  }
  async function move(key, target, placement) {
    if (busy || key === target || coreKeys.includes(key) || coreKeys.includes(target)) return;
    const questions = [...settings.questions], from = questions.findIndex(q => q.key === key);
    if (from < 0) return;
    const [item] = questions.splice(from, 1), to = questions.findIndex(q => q.key === target);
    if (to < 0) return;
    questions.splice(to + (placement === 'after' ? 1 : 0), 0, item);
    await persist({ ...settings, questions }, '질문 순서를 변경했습니다.');
  }
  document.addEventListener('click', async event => {
    const target = event.target, tab = target.closest('[data-question-scope]');
    if (tab && !busy && rerenderQuestions) {
      status = '';
      const url = new URL(location.href); url.searchParams.set('tab', tab.dataset.questionScope); history.replaceState(history.state, '', url); rerenderQuestions(); return;
    }
    if (target.closest('#signup-terms-editor')) {
      if (busy) return;
      if (target.closest('[data-term-preview]')) { window.open('/applicant/signup?preview=1', '_blank', 'noopener'); return; }
      if (target.closest('[data-term-add]')) { termEditor = { id: crypto.randomUUID(), title: '', text: '', titleEn: '', textEn: '', required: true, enabled: true }; status = ''; redraw(); return; }
      if (target.closest('[data-term-cancel]')) { termEditor = null; redraw(); return; }
      const remove = target.closest('[data-term-delete]');
      if (remove) {
        if (confirm('약관을 삭제하시겠습니까? 기존 회원의 동의 기록은 유지됩니다.')) {
          if (await persist({ ...settings, terms: settings.terms.filter(t => t.id !== remove.dataset.termDelete) }, '약관을 삭제했습니다.')) {
            if (termEditor?.id === remove.dataset.termDelete) termEditor = null;
            redraw();
          }
        }
        return;
      }
      const arrow = target.closest('[data-term-move]');
      if (arrow) {
        const terms = [...settings.terms], from = terms.findIndex(t => t.id === arrow.dataset.termMove), to = from + Number(arrow.dataset.direction);
        if (from < 0 || to < 0 || to >= terms.length) return;
        [terms[from], terms[to]] = [terms[to], terms[from]];
        await persist({ ...settings, terms }, '약관 순서를 변경했습니다.');
        return;
      }
      const select = target.closest('[data-term-select]');
      if (select) { termEditor = { ...settings.terms.find(t => t.id === select.dataset.termSelect) }; status = ''; redraw(); }
      return;
    }
    if (!target.closest('#signup-question-editor') || busy) return;
    if (target.closest('[data-signup-field-preview]')) { window.open('/applicant/signup?preview=1', '_blank', 'noopener'); return; }
    if (target.closest('[data-signup-field-add]')) { editor = { isActive: true, isDraft: true, inputType: 'text', options: [], required: false }; redraw(); return; }
    if (target.closest('[data-signup-field-reset]')) { editor = {}; redraw(); return; }
    const remove = target.closest('[data-signup-field-delete]');
    if (remove) {
      const key = remove.dataset.signupFieldDelete;
      if (coreKeys.includes(key)) { status = '이메일·비밀번호·이름은 삭제할 수 없습니다.'; redraw(); return; }
      if (confirm('선택한 회원가입 질문을 삭제하시겠습니까? 기존 회원의 답변은 유지됩니다.')) {
        if (await persist({ ...settings, questions: settings.questions.filter(q => q.key !== key) }, '질문을 삭제했습니다.')) { if (editor.editingId === key) editor = {}; redraw(); }
      } return;
    }
    const arrow = target.closest('[data-signup-field-move]');
    if (arrow) {
      const index = settings.questions.findIndex(q => q.key === arrow.dataset.signupFieldMove), up = arrow.dataset.signupFieldDirection === 'up', neighbor = settings.questions[index + (up ? -1 : 1)];
      if (neighbor) await move(arrow.dataset.signupFieldMove, neighbor.key, up ? 'before' : 'after'); return;
    }
    if (target.closest('[data-signup-field-option-add]')) {
      try { Object.assign(editor, scope.AdmitCardApplicantFormConfig.resolveChoiceOptionEdits(editor)); }
      catch (error) { status = error.message; redraw(); return; }
      const option = String(editor.optionDraft || '').trim();
      if (!option || editor.options.includes(option)) { status = '중복되지 않는 선택지를 입력하세요.'; redraw(); return; }
      editor.optionsEn = { ...editor.optionsEn, [option]: String(editor.optionDraftEn || "").trim() };
      editor.options.push(option); if (editor.allowCustomOption) editor.customOptionLabel = option;
      editor.optionDraft = ''; editor.optionDraftEn = ''; editor.allowCustomOption = false; redraw(); return;
    }
    const optionRemove = target.closest('[data-signup-field-option-remove]');
    if (optionRemove) { const index = Number(optionRemove.dataset.signupFieldOptionRemove); editor.optionKoreanEdits = editor.options.map((option, i) => editor.optionKoreanEdits?.[i] ?? option).filter((_, i) => i !== index); const [old] = editor.options.splice(index, 1); if (editor.customOptionLabel === old) editor.customOptionLabel = ''; redraw(); return; }
    const card = target.closest('[data-signup-field-select]');
    if (card) {
      const q = settings.questions.find(q => q.key === card.dataset.signupFieldSelect);
      if (q) editor = { ...q, options: [...q.options], optionsEn: { ...q.optionsEn }, editingId: q.key, questionText: q.label, questionDescription: q.description, questionTextEn: q.labelEn, questionDescriptionEn: q.descriptionEn, isActive: true, isDraft: false };
      status = ''; redraw();
    }
  });
  function update(event) {
    const termInput = event.target.closest('[data-term-input]');
    if (termInput && termEditor && !busy) {
      termEditor[termInput.dataset.termInput] = termInput.type === 'checkbox' ? termInput.checked : termInput.value;
      if (termInput.dataset.termInput === 'enabled') termInput.form.querySelector('[data-term-input=text]').required = termInput.checked;
      return;
    }
    const input = event.target.closest('[data-signup-field-input]'); if (!input || busy) return;
    const key = input.dataset.signupFieldInput;
    if (coreKeys.includes(editor.editingId) && ['required', 'inputType'].includes(key)) return;
    if (key.startsWith('optionKorean:')) { editor.optionKoreanEdits = { ...editor.optionKoreanEdits, [Number(key.split(':')[1])]: input.value }; return; }
    if (key.startsWith('optionEnglish:')) { const option = editor.options[Number(key.split(':')[1])]; if (option !== undefined) editor.optionsEn = { ...editor.optionsEn, [option]: input.value }; return; }
    editor[key] = input.type === 'checkbox' ? input.checked : input.value;
    if (key === 'inputType') { if (!['select', 'multiselect'].includes(input.value)) { editor.options = []; editor.optionsEn = {}; editor.customOptionLabel = ''; } redraw(); }
  }
  document.addEventListener('input', update);
  document.addEventListener('change', event => { if (event.target.tagName === 'SELECT' && event.target.isConnected) update(event); });
  document.addEventListener('submit', async event => {
    if (event.target.matches('[data-signup-field-form]')) { event.preventDefault(); await saveQuestion(); }
    if (event.target.matches('[data-term-form]')) {
      event.preventDefault(); if (busy || !termEditor) return;
      const terms = settings.terms.some(t => t.id === termEditor.id) ? settings.terms.map(t => t.id === termEditor.id ? { ...termEditor } : t) : [...settings.terms, { ...termEditor }];
      if (await persist({ ...settings, terms }, '약관을 저장했습니다.')) { termEditor = null; redraw(); }
    }
  });
  document.addEventListener('keydown', event => {
    if (event.target.matches('[data-signup-field-select], [data-term-select]') && ['Enter', ' '].includes(event.key)) { event.preventDefault(); event.target.click(); }
    if (event.target.matches('[data-signup-field-option-draft]') && event.key === 'Enter') { event.preventDefault(); document.querySelector('[data-signup-field-option-add]')?.click(); }
  });
  document.addEventListener('dragstart', event => {
    const selected = event.target.closest('[data-signup-field-select]');
    if (selected && (busy || coreKeys.includes(selected.dataset.signupFieldSelect))) { event.preventDefault(); dragKey = ''; return; }
    const card = event.target.closest('[data-signup-field-draggable]');
    if (card && !busy) { dragKey = card.dataset.signupFieldDraggable; event.dataTransfer.setData('text/plain', dragKey); }
  });
  document.addEventListener('dragover', event => { if (dragKey && event.target.closest('[data-signup-field-draggable]')) event.preventDefault(); });
  document.addEventListener('drop', event => { const card = event.target.closest('[data-signup-field-draggable]'); if (!card || !dragKey) return; event.preventDefault(); const rect = card.getBoundingClientRect(); void move(dragKey, card.dataset.signupFieldDraggable, event.clientY > rect.top + rect.height / 2 ? 'after' : 'before'); dragKey = ''; });
  document.addEventListener('dragend', () => { dragKey = ''; });
  function clearTermDrag() {
    document.querySelectorAll('#signup-terms-editor .is-dragging, #signup-terms-editor .is-drop-target-before, #signup-terms-editor .is-drop-target-after').forEach(card => card.classList.remove('is-dragging', 'is-drop-target-before', 'is-drop-target-after'));
  }
  document.addEventListener('dragstart', event => {
    const card = event.target.closest('[data-term-draggable]');
    if (!card) return;
    if (busy || event.target.closest('button')) { event.preventDefault(); return; }
    termDragKey = card.dataset.termDraggable;
    event.dataTransfer.setData('text/plain', termDragKey);
    event.dataTransfer.effectAllowed = 'move';
    card.classList.add('is-dragging');
  });
  document.addEventListener('dragover', event => {
    const card = event.target.closest('[data-term-draggable]');
    if (!termDragKey || !card || busy) return;
    event.preventDefault();
    document.querySelectorAll('#signup-terms-editor [data-term-draggable]').forEach(item => item.classList.remove('is-drop-target-before', 'is-drop-target-after'));
    if (card.dataset.termDraggable !== termDragKey) {
      const rect = card.getBoundingClientRect();
      card.classList.add(event.clientY > rect.top + rect.height / 2 ? 'is-drop-target-after' : 'is-drop-target-before');
    }
  });
  document.addEventListener('drop', async event => {
    const card = event.target.closest('[data-term-draggable]'), key = termDragKey;
    termDragKey = ''; clearTermDrag();
    if (!key || !card || busy) return;
    event.preventDefault();
    const terms = [...settings.terms], from = terms.findIndex(t => t.id === key);
    if (from < 0 || key === card.dataset.termDraggable) return;
    const [term] = terms.splice(from, 1), to = terms.findIndex(t => t.id === card.dataset.termDraggable);
    if (to < 0) return;
    const rect = card.getBoundingClientRect();
    terms.splice(to + (event.clientY > rect.top + rect.height / 2 ? 1 : 0), 0, term);
    await persist({ ...settings, terms }, '약관 순서를 변경했습니다.');
  });
  document.addEventListener('dragend', () => { termDragKey = ''; clearTermDrag(); });
  scope.AdmitCardSignupSettings = { renderQuestionManagement };
})(globalThis);
