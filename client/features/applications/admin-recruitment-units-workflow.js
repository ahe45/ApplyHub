(function (globalScope, factory) {
  const moduleApi = factory(globalScope);

  if (typeof module === "object" && module.exports) {
    module.exports = moduleApi;
    return;
  }

  globalScope.AdmitCardApplicantRecruitmentUnitsWorkflow = moduleApi;
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  function createApplicantRecruitmentUnitsController({
    apiRequest,
    createEmptyApplicantRecruitmentUnitEditor,
    handleAuthenticationFailure,
    openModal,
    refreshApplicantBootstrap,
    renderView,
    requestCloseModal,
    showToast,
    state,
  }) {
    function isInputElement(element) {
      const ElementConstructor = globalScope.HTMLInputElement;
      return typeof ElementConstructor === "function" && element instanceof ElementConstructor;
    }

    function syncApplicantRecruitmentUnitModalForm() {
      const editorState = state.applicantManager.recruitmentUnitEditor || createEmptyApplicantRecruitmentUnitEditor();
      const modalForm = globalScope.document?.getElementById("applicantRecruitmentUnitForm") || null;
      const deleteButton = globalScope.document?.getElementById("applicantRecruitmentUnitModalDeleteButton") || null;
      const saveButton = globalScope.document?.getElementById("applicantRecruitmentUnitModalSaveButton") || null;
      const isEditorActive = editorState.isActive === true;
      const editingId = Number(editorState.editingId || 0);

      if (modalForm) {
        modalForm.querySelectorAll("[data-applicant-recruitment-input]").forEach((inputElement) => {
          if (!isInputElement(inputElement)) {
            return;
          }

          const fieldName = String(inputElement.dataset.applicantRecruitmentInput || "").trim();
          inputElement.value = fieldName ? String(editorState[fieldName] || "") : "";
          inputElement.disabled = !isEditorActive;
        });
      }

      if (deleteButton) {
        deleteButton.dataset.applicantRecruitmentDelete = editingId > 0 ? String(editingId) : "";
        deleteButton.disabled = !(isEditorActive && editingId > 0);
      }

      if (saveButton) {
        saveButton.disabled = !isEditorActive;
      }
    }

    function resetApplicantRecruitmentUnitEditor({ render = true } = {}) {
      state.applicantManager.recruitmentUnitEditor = createEmptyApplicantRecruitmentUnitEditor();
      syncApplicantRecruitmentUnitModalForm();

      if (render) {
        renderView();
      }
    }

    function activateApplicantRecruitmentUnitCreation() {
      state.applicantManager.activeTab = "form-settings";
      state.applicantManager.settingsSection = "recruitment-units";
      state.applicantManager.recruitmentUnitEditor = createEmptyApplicantRecruitmentUnitEditor({
        isActive: true,
      });
      syncApplicantRecruitmentUnitModalForm();
      renderView();
    }

    function startApplicantRecruitmentUnitEdit(unitId) {
      const unit = state.applicantManager.recruitmentUnits.find((candidate) => candidate.id === Number(unitId || 0));

      if (!unit) {
        showToast("수정할 전형 관리 항목을 찾을 수 없습니다.", "error");
        return;
      }

      state.applicantManager.activeTab = "form-settings";
      state.applicantManager.settingsSection = "recruitment-units";
      state.applicantManager.recruitmentUnitEditor = {
        isActive: true,
        editingId: unit.id,
        trackName: unit.trackName || "",
        admissionCode: unit.admissionCode || "",
        admissionName: unit.admissionName || "",
        admissionNameEn: unit.admissionNameEn || "",
        seriesCode: unit.seriesCode || "",
        seriesName: unit.seriesName || "",
        unitCode: unit.unitCode || "",
        unitName: unit.unitName || "",
        unitNameEn: unit.unitNameEn || "",
        majorCode: unit.majorCode || "",
        majorName: unit.majorName || "",
        majorNameEn: unit.majorNameEn || "",
      };
      renderView();
      syncApplicantRecruitmentUnitModalForm();
      openModal?.("applicantRecruitmentUnitModal");
    }

    function updateApplicantRecruitmentUnitEditorField(fieldName = "", value) {
      const editorState = state.applicantManager.recruitmentUnitEditor || createEmptyApplicantRecruitmentUnitEditor();

      if (editorState.isActive !== true) {
        return;
      }

      state.applicantManager.recruitmentUnitEditor = {
        ...editorState,
        [fieldName]: String(value ?? ""),
      };
    }

    async function saveApplicantRecruitmentUnit() {
      const editorState = state.applicantManager.recruitmentUnitEditor || createEmptyApplicantRecruitmentUnitEditor();

      if (editorState.isActive !== true) {
        showToast("전형 관리 항목을 선택하거나 새로 추가하세요.", "error", 3200);
        return;
      }

      const requestPath = editorState.editingId
        ? `/api/applicant-recruitment-units/${editorState.editingId}`
        : "/api/applicant-recruitment-units";
      const requestMethod = editorState.editingId ? "PUT" : "POST";

      try {
        await apiRequest(requestPath, {
          method: requestMethod,
          body: JSON.stringify({
            trackName: editorState.trackName,
            admissionCode: editorState.admissionCode,
            admissionName: editorState.admissionName,
            admissionNameEn: editorState.admissionNameEn,
            seriesCode: editorState.seriesCode,
            seriesName: editorState.seriesName,
            unitCode: editorState.unitCode,
            unitName: editorState.unitName,
            unitNameEn: editorState.unitNameEn,
            majorCode: editorState.majorCode,
            majorName: editorState.majorName,
            majorNameEn: editorState.majorNameEn,
          }),
        });
        await requestCloseModal?.("applicantRecruitmentUnitModal");
        await refreshApplicantBootstrap(editorState.editingId ? "전형 관리 항목을 수정했습니다." : "전형 관리 항목을 추가했습니다.");
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return;
        }

        showToast(error?.message || "전형 관리 항목을 저장하지 못했습니다.", "error", 4200);
      }
    }

    async function deleteApplicantRecruitmentUnit(unitId) {
      if (!globalScope.confirm("선택한 전형 관리 항목을 삭제하시겠습니까?")) {
        return;
      }

      try {
        await apiRequest(`/api/applicant-recruitment-units/${unitId}`, {
          method: "DELETE",
        });

        if (state.applicantManager.recruitmentUnitEditor?.editingId === Number(unitId || 0)) {
          await requestCloseModal?.("applicantRecruitmentUnitModal");
        }

        await refreshApplicantBootstrap("전형 관리 항목을 삭제했습니다.");
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return;
        }

        showToast(error?.message || "전형 관리 항목을 삭제하지 못했습니다.", "error", 4200);
      }
    }

    return Object.freeze({
      activateApplicantRecruitmentUnitCreation,
      deleteApplicantRecruitmentUnit,
      resetApplicantRecruitmentUnitEditor,
      saveApplicantRecruitmentUnit,
      startApplicantRecruitmentUnitEdit,
      updateApplicantRecruitmentUnitEditorField,
    });
  }

  return Object.freeze({
    createApplicantRecruitmentUnitsController,
  });
});
