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
        formScope: field.formScope || 'application',
        questionText: field.questionText || "",
        questionDescription: field.questionDescription || "",
        inputType: field.inputType || "text",
        fileNamePattern: field.fileNamePattern || "",
        allowedExtensions: (field.allowedExtensions || []).join(", "),
        systemFieldKey: field.systemFieldKey || "",
        options: Array.isArray(field.options) ? [...field.options] : [],
        optionDraft: "",
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

      const normalizedValue =
        fieldName === "required" || fieldName === "allowCustomOption"
          ? value === true || value === "true" || Number(value) === 1
          : String(value ?? "");
      const nextEditorState = {
        ...editorState,
        [fieldName]: normalizedValue,
      };

      if (fieldName === "inputType" && normalizedValue !== "select") {
        nextEditorState.allowCustomOption = false;
        nextEditorState.customOptionLabel = "";
      }

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
        await apiRequest(requestPath, {
          method: requestMethod,
          body: JSON.stringify({
            formScope: editorState.formScope || 'application',
            questionText: editorState.questionText,
            questionDescription: editorState.questionDescription,
            inputType: editorState.inputType,
            fileNamePattern: editorState.fileNamePattern || "",
            allowedExtensions: editorState.allowedExtensions || "",
            systemFieldKey: editorState.systemFieldKey,
            options: editorState.inputType === "select" ? editorState.options : [],
            allowCustomOption:
              editorState.inputType === "select" && String(editorState.customOptionLabel || "").trim() !== "",
            customOptionLabel:
              editorState.inputType === "select" ? String(editorState.customOptionLabel || "").trim() : "",
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
        optionDraft: "",
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
