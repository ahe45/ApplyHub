(function (globalScope, factory) {
  const moduleApi = factory(globalScope);

  if (typeof module === "object" && module.exports) {
    module.exports = moduleApi;
    return;
  }

  globalScope.AdmitCardApplicantFormFieldsWorkflow = moduleApi;
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  function createApplicantFormFieldsController({
    apiRequest,
    createEmptyApplicantFieldEditor,
    handleAuthenticationFailure,
    refreshApplicantBootstrap,
    renderView,
    showToast,
    state,
  }) {
    const currentFormScope = () => new URLSearchParams(globalScope.location?.search || '').get('tab') === 'documents' ? 'documents' : 'application';
    const selectedTemplateId = () => state.applicantManager.selectedFormTemplates?.[currentFormScope()]
      || state.applicantManager.formTemplates?.find(item => item.formScope === currentFormScope() && item.isDefault)?.id;

    function confirmFormTemplateDelete(template) {
      const dialog = globalScope.document.createElement('dialog');
      const trigger = globalScope.document.activeElement;
      dialog.className = 'modal-sheet form-template-delete-dialog';
      dialog.setAttribute('aria-labelledby', 'formTemplateDeleteTitle');
      dialog.setAttribute('aria-describedby', 'formTemplateDeleteMessage');
      dialog.innerHTML = `<form method="dialog">
        <div class="modal-header"><h3 id="formTemplateDeleteTitle">양식 삭제</h3>
          <button class="icon-button" type="submit" value="cancel" aria-label="닫기">×</button></div>
        <div class="form-template-delete-body"><p id="formTemplateDeleteMessage"><strong></strong> 양식을 삭제하시겠습니까?</p></div>
        <div class="form-template-delete-actions">
          <button class="ghost-button" type="submit" value="cancel" autofocus>취소</button>
          <button class="secondary-button danger-button" type="submit" value="delete">삭제</button>
        </div>
      </form>`;
      dialog.querySelector('strong').textContent = template.name;
      dialog.addEventListener('keydown', event => {
        if (event.key === 'Escape') event.stopPropagation();
      });
      return new Promise(resolve => {
        dialog.addEventListener('close', () => {
          const confirmed = dialog.returnValue === 'delete';
          dialog.remove();
          if (trigger?.isConnected) trigger.focus({ preventScroll: true });
          resolve(confirmed);
        }, { once: true });
        globalScope.document.body.append(dialog);
        dialog.showModal();
      });
    }

    async function deleteFormTemplate(template) {
      const manager = state.applicantManager;
      if (!template || manager.formTemplateBusy || globalScope.document.querySelector('.form-template-delete-dialog')) return;
      if (!(await confirmFormTemplateDelete(template))) return;
      manager.formTemplateBusy = true;
      renderView();
      try {
        await apiRequest('/api/applicant-form-templates/' + template.id, { method: 'DELETE' });
        manager.selectedFormTemplates ||= {};
        manager.selectedFormTemplates[template.formScope] = 0;
        manager.formTemplateEditingScope = null;
        manager.formTemplateEditor = null;
        resetApplicantFieldEditor({ render: false });
        await refreshApplicantBootstrap('템플릿을 삭제했습니다.');
      } catch (error) {
        if (!handleAuthenticationFailure(error)) showToast(error.message, 'error', 4200);
      } finally {
        state.applicantManager.formTemplateBusy = false;
        renderView();
      }
    }

    async function copyFormTemplate(template) {
      const manager = state.applicantManager;
      if (!template || manager.formTemplateBusy) return;
      manager.formTemplateBusy = true;
      renderView();
      try {
        const names = new Set(manager.formTemplates.filter(item => item.formScope === template.formScope).map(item => item.name));
        const copyName = suffix => `${template.name.slice(0, 100 - suffix.length)}${suffix}`;
        let name = copyName(' 복사');
        for (let index = 2; names.has(name); index += 1) name = copyName(` 복사 ${index}`);
        const result = await apiRequest('/api/applicant-form-templates', {
          method: 'POST',
          body: JSON.stringify({ formScope: template.formScope, name, copyFromId: template.id }),
        });
        manager.selectedFormTemplates ||= {};
        manager.selectedFormTemplates[template.formScope] = result.id;
        manager.formTemplateEditingScope = null;
        manager.formTemplateEditor = null;
        resetApplicantFieldEditor({ render: false });
        await refreshApplicantBootstrap('양식을 복사했습니다.');
      } catch (error) {
        if (!handleAuthenticationFailure(error)) showToast(error.message, 'error', 4200);
      } finally {
        state.applicantManager.formTemplateBusy = false;
        renderView();
      }
    }

    globalScope.document?.addEventListener('click', event => {
      const manager = state.applicantManager;
      if (manager.formTemplateBusy) return;
      const card = event.target.closest('[data-form-template-open]');
      const back = event.target.closest('[data-form-template-list]');
      if (card || back) {
        manager.selectedFormTemplates ||= {};
        if (card) manager.selectedFormTemplates[currentFormScope()] = Number(card.dataset.formTemplateOpen);
        manager.formTemplateEditingScope = card ? currentFormScope() : null;
        manager.formTemplateEditor = null;
        resetApplicantFieldEditor();
        globalScope.document.querySelector(card ? '[data-form-template-list]' : '[data-form-template-action=create]')?.focus({ preventScroll: true });
        globalScope.document.querySelector(card ? '[data-form-template-editing]' : '.form-template-gallery')?.scrollIntoView({ block: 'start' });
        return;
      }
      const button = event.target.closest('[data-form-template-action]');
      if (!button || state.applicantManager.formTemplateBusy) return;
      const action = button.dataset.formTemplateAction;
      if (button.dataset.formTemplateId) {
        manager.selectedFormTemplates ||= {};
        manager.selectedFormTemplates[currentFormScope()] = Number(button.dataset.formTemplateId);
      }
      const selected = state.applicantManager.formTemplates?.find(item => item.id === selectedTemplateId());
      if (action === 'copy') {
        void copyFormTemplate(selected);
        return;
      }
      if (action === 'delete') {
        void deleteFormTemplate(selected);
        return;
      }
      state.applicantManager.formTemplateEditor = action === 'cancel' ? null : {
        action, formScope: currentFormScope(), templateId: selected?.id,
        name: action === 'create' ? '' : selected?.name,
      };
      renderView();
      const templateForm = globalScope.document.querySelector('[data-form-template-form]');
      templateForm?.querySelector('[data-form-template-name], button[type=submit]')?.focus();
      templateForm?.scrollIntoView({ block: 'nearest' });
    });
    globalScope.document?.addEventListener('input', event => {
      if (event.target.matches('[data-form-template-name]') && state.applicantManager.formTemplateEditor) {
        state.applicantManager.formTemplateEditor.name = event.target.value;
      }
    });
    globalScope.document?.addEventListener('submit', async event => {
      if (!event.target.matches('[data-form-template-form]')) return;
      event.preventDefault();
      const manager = state.applicantManager;
      if (manager.formTemplateBusy || !manager.formTemplateEditor) return;
      const editor = { ...manager.formTemplateEditor };
      manager.formTemplateBusy = true;
      renderView();
      try {
        const updating = editor.action === 'rename';
        const result = await apiRequest('/api/applicant-form-templates' + (updating ? '/' + editor.templateId : ''), {
          method: updating ? 'PUT' : 'POST',
          body: JSON.stringify({ formScope: editor.formScope, name: editor.name }),
        });
        manager.selectedFormTemplates ||= {};
        manager.selectedFormTemplates[editor.formScope] = result.id || 0;
        if (editor.action === 'create') manager.formTemplateEditingScope = editor.formScope;
        manager.formTemplateEditor = null;
        resetApplicantFieldEditor({ render: false });
        await refreshApplicantBootstrap('템플릿을 저장했습니다.');
      } catch (error) { if (!handleAuthenticationFailure(error)) showToast(error.message, 'error', 4200); }
      finally { state.applicantManager.formTemplateBusy = false; renderView(); }
    });
    function resetApplicantFieldEditor({ render = true } = {}) {
      state.applicantManager.fieldEditor = createEmptyApplicantFieldEditor();

      if (render) {
        renderView();
      }
    }

    function activateApplicantFieldCreation() {
      state.applicantManager.activeTab = "form-settings";
      state.applicantManager.settingsSection = "fields";
      state.applicantManager.fieldEditor = createEmptyApplicantFieldEditor({
        isActive: true,
        isDraft: true,
        formScope: currentFormScope(),
        templateId: selectedTemplateId(),
        inputType: currentFormScope() === 'documents' ? 'file' : 'text',
      });
      renderView();
    }

    function startApplicantFieldEdit(fieldId) {
      const field = state.applicantManager.fields.find((candidate) => candidate.id === Number(fieldId || 0));

      if (!field) {
        showToast("수정할 접수 양식 항목을 찾을 수 없습니다.", "error");
        return;
      }

      state.applicantManager.activeTab = "form-settings";
      state.applicantManager.settingsSection = "fields";
      state.applicantManager.fieldEditor = {
        isActive: true,
        isDraft: false,
        editingId: field.id,
        templateId: field.templateId,
        formScope: field.formScope || 'application',
        questionText: field.questionText || "",
        questionDescription: field.questionDescription || "",
        questionTextEn: field.questionTextEn || "",
        questionDescriptionEn: field.questionDescriptionEn || "",
        inputType: field.inputType || "text",
        fileNamePattern: field.fileNamePattern || "",
        allowedExtensions: (field.allowedExtensions || []).join(", "),
        systemFieldKey: field.systemFieldKey || "",
        options: Array.isArray(field.options) ? [...field.options] : [],
        optionDraft: "",
        optionDraftEn: "",
        optionsEn: { ...field.optionsEn },
        allowCustomOption: false,
        customOptionLabel: String(field.customOptionLabel || "").trim(),
        required: field.required === true,
      };
      renderView();
    }

    function updateApplicantFieldEditorField(fieldName = "", value) {
      const editorState = state.applicantManager.fieldEditor || createEmptyApplicantFieldEditor();

      if (editorState.isActive !== true) {
        return;
      }

      if (fieldName.startsWith("optionKorean:")) {
        editorState.optionKoreanEdits = { ...editorState.optionKoreanEdits, [Number(fieldName.split(':')[1])]: String(value ?? '') };
        return;
      }
      if (fieldName.startsWith("optionEnglish:")) {
        const option = editorState.options[Number(fieldName.split(":")[1])];
        if (option !== undefined) editorState.optionsEn = { ...editorState.optionsEn, [option]: String(value || "") };
        return;
      }

      const normalizedValue =
        fieldName === "required" || fieldName === "allowCustomOption"
          ? value === true || value === "true" || Number(value) === 1
          : String(value ?? "");
      const nextEditorState = {
        ...editorState,
        [fieldName]: normalizedValue,
      };

      if (fieldName === "inputType" && !["select", "multiselect"].includes(normalizedValue)) {
        nextEditorState.allowCustomOption = false;
        nextEditorState.customOptionLabel = "";
      }

      if (fieldName === "inputType" && normalizedValue === "multiselect") nextEditorState.systemFieldKey = "";

      if (fieldName === "inputType") {
        if (normalizedValue === "file") {
          nextEditorState.systemFieldKey = "";
        } else if (normalizedValue === "photo") {
          if (nextEditorState.systemFieldKey && nextEditorState.systemFieldKey !== "photo") {
            nextEditorState.systemFieldKey = "";
          }
        } else if (nextEditorState.systemFieldKey === "photo") {
          nextEditorState.systemFieldKey = "";
        }
      }

      if (fieldName === "systemFieldKey") {
        if (editorState.inputType === "file" && normalizedValue) {
          nextEditorState.systemFieldKey = "";
        } else if (editorState.inputType === "photo" && normalizedValue && normalizedValue !== "photo") {
          nextEditorState.systemFieldKey = "";
        } else if (editorState.inputType !== "photo" && normalizedValue === "photo") {
          nextEditorState.systemFieldKey = "";
        }
      }

      if (fieldName === "allowCustomOption" && normalizedValue !== true) {
        nextEditorState.customOptionLabel = "";
      }

      state.applicantManager.fieldEditor = nextEditorState;

      if (fieldName === "inputType") {
        renderView();
      }
    }

    async function saveApplicantFieldEditor() {
      const editorState = state.applicantManager.fieldEditor || createEmptyApplicantFieldEditor();

      if (editorState.isActive !== true) {
        showToast("질문 카드를 먼저 선택하거나 새 질문을 추가하세요.", "error", 3200);
        return;
      }

      const requestPath = editorState.editingId
        ? `/api/applicant-form-fields/${editorState.editingId}`
        : "/api/applicant-form-fields";
      const requestMethod = editorState.editingId ? "PUT" : "POST";

      try {
        const choice = ["select", "multiselect"].includes(editorState.inputType)
          ? globalScope.AdmitCardApplicantFormConfig.resolveChoiceOptionEdits(editorState)
          : { options: [], optionsEn: {}, customOptionLabel: '' };
        await apiRequest(requestPath, {
          method: requestMethod,
          body: JSON.stringify({
            formScope: editorState.formScope || 'application',
            templateId: editorState.templateId,
            questionText: editorState.questionText,
            questionDescription: editorState.questionDescription,
            questionTextEn: editorState.questionTextEn || "",
            questionDescriptionEn: editorState.questionDescriptionEn || "",
            inputType: editorState.inputType,
            fileNamePattern: editorState.fileNamePattern || "",
            allowedExtensions: editorState.allowedExtensions || "",
            systemFieldKey: editorState.systemFieldKey,
            options: choice.options,
            optionsEn: choice.optionsEn,
            allowCustomOption:
              Boolean(choice.customOptionLabel),
            customOptionLabel:
              choice.customOptionLabel,
            required: editorState.required,
          }),
        });
        resetApplicantFieldEditor({ render: false });
        await refreshApplicantBootstrap(editorState.editingId ? "접수 양식 항목을 수정했습니다." : "접수 양식 항목을 추가했습니다.");
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return;
        }

        showToast(error?.message || "접수 양식 항목을 저장하지 못했습니다.", "error", 4200);
      }
    }

    function addApplicantFieldOption() {
      const editorState = state.applicantManager.fieldEditor || createEmptyApplicantFieldEditor();

      if (editorState.isActive !== true) {
        return;
      }

      try { Object.assign(editorState, globalScope.AdmitCardApplicantFormConfig.resolveChoiceOptionEdits(editorState)); }
      catch (error) { showToast(error.message, 'error', 3200); return; }
      const nextOption = String(editorState.optionDraft || "").trim();
      const existingOptions = Array.isArray(editorState.options) ? editorState.options : [];

      if (!nextOption) {
        showToast("추가할 선택지 항목을 입력하세요.", "error", 3200);
        return;
      }

      if (existingOptions.includes(nextOption)) {
        showToast("같은 선택지 항목이 이미 있습니다.", "error", 3200);
        return;
      }

      state.applicantManager.fieldEditor = {
        ...editorState,
        options: [...existingOptions, nextOption],
        optionsEn: { ...editorState.optionsEn, [nextOption]: String(editorState.optionDraftEn || "").trim() },
        optionDraft: "",
        optionDraftEn: "",
        allowCustomOption: false,
        customOptionLabel:
          editorState.allowCustomOption === true && !String(editorState.customOptionLabel || "").trim()
            ? nextOption
            : String(editorState.customOptionLabel || "").trim(),
      };
      renderView();
    }

    function removeApplicantFieldOption(optionIndex) {
      const normalizedIndex = Number(optionIndex);
      const editorState = state.applicantManager.fieldEditor || createEmptyApplicantFieldEditor();

      if (editorState.isActive !== true) {
        return;
      }

      const existingOptions = Array.isArray(editorState.options) ? editorState.options : [];

      if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0 || normalizedIndex >= existingOptions.length) {
        return;
      }

      const removedOption = String(existingOptions[normalizedIndex] || "").trim();
      const currentCustomOptionLabel = String(editorState.customOptionLabel || "").trim();

      state.applicantManager.fieldEditor = {
        ...editorState,
        options: existingOptions.filter((_, index) => index !== normalizedIndex),
        optionKoreanEdits: existingOptions.map((option, index) => editorState.optionKoreanEdits?.[index] ?? option).filter((_, index) => index !== normalizedIndex),
        customOptionLabel: currentCustomOptionLabel === removedOption ? "" : currentCustomOptionLabel,
      };
      renderView();
    }

    async function deleteApplicantField(fieldId) {
      if (!globalScope.confirm("선택한 접수 양식 항목을 삭제하시겠습니까?")) {
        return;
      }

      try {
        await apiRequest(`/api/applicant-form-fields/${fieldId}`, {
          method: "DELETE",
        });

        if (state.applicantManager.fieldEditor?.editingId === Number(fieldId || 0)) {
          resetApplicantFieldEditor({ render: false });
        }

        await refreshApplicantBootstrap("접수 양식 항목을 삭제했습니다.");
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return;
        }

        showToast(error?.message || "접수 양식 항목을 삭제하지 못했습니다.", "error", 4200);
      }
    }

    async function moveApplicantField(fieldId, direction = "") {
      try {
        await apiRequest(`/api/applicant-form-fields/${fieldId}/move`, {
          method: "POST",
          body: JSON.stringify({ direction }),
        });
        await refreshApplicantBootstrap("접수 양식 순서를 변경했습니다.");
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return;
        }

        showToast(error?.message || "접수 양식 순서를 변경하지 못했습니다.", "error", 4200);
      }
    }

    async function reorderApplicantField(fieldId, targetFieldId, placement = "before") {
      try {
        await apiRequest(`/api/applicant-form-fields/${fieldId}/move`, {
          method: "POST",
          body: JSON.stringify({
            targetFieldId,
            placement,
          }),
        });
        await refreshApplicantBootstrap("접수 양식 순서를 변경했습니다.");
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return;
        }

        showToast(error?.message || "접수 양식 순서를 변경하지 못했습니다.", "error", 4200);
      }
    }

    return Object.freeze({
      activateApplicantFieldCreation,
      addApplicantFieldOption,
      deleteApplicantField,
      moveApplicantField,
      removeApplicantFieldOption,
      reorderApplicantField,
      resetApplicantFieldEditor,
      saveApplicantFieldEditor,
      startApplicantFieldEdit,
      updateApplicantFieldEditorField,
    });
  }

  return Object.freeze({
    createApplicantFormFieldsController,
  });
});
