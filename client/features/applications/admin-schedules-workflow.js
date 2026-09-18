(function (globalScope, factory) {
  const moduleApi = factory(globalScope);

  if (typeof module === "object" && module.exports) {
    module.exports = moduleApi;
    return;
  }

  globalScope.AdmitCardApplicantSchedulesWorkflow = moduleApi;
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  function createApplicantSchedulesController({
    apiRequest,
    createEmptyApplicantScheduleEditor,
    handleAuthenticationFailure,
    openModal,
    refreshApplicantBootstrap,
    renderView,
    requestCloseModal,
    showToast,
    state,
  }) {
    const scheduleDateFieldNames = Object.freeze([
      "applicantScheduleStartAt",
      "applicantScheduleEndAt",
      "documentSubmissionScheduleStartAt",
      "documentReviewScheduleStartAt",
      "documentSubmissionScheduleEndAt",
      "documentReviewScheduleEndAt",
      "admitCardLookupScheduleStartAt",
      "admitCardLookupScheduleEndAt",
    ]);

    const scheduleTemplateFieldNames = ["applicationTemplateId", "documentTemplateId"];
    const scheduleEnabledFieldNames = Object.freeze(["applicantScheduleEnabled", "documentSubmissionScheduleEnabled", "documentReviewScheduleEnabled", "admitCardLookupScheduleEnabled"]);

    function isFormControlElement(element) {
      return (
        (typeof globalScope.HTMLInputElement === "function" && element instanceof globalScope.HTMLInputElement) ||
        (typeof globalScope.HTMLTextAreaElement === "function" && element instanceof globalScope.HTMLTextAreaElement) ||
        (typeof globalScope.HTMLSelectElement === "function" && element instanceof globalScope.HTMLSelectElement)
      );
    }

    function getApplicantScheduleKey(schedule = {}) {
      return String(schedule?.scheduleKey || schedule?.id || "").trim();
    }

    function getApplicantSchedulesByKeys(scheduleKeys = []) {
      const scheduleKeySet = new Set(
        (Array.isArray(scheduleKeys) ? scheduleKeys : [])
          .map((scheduleKey) => String(scheduleKey || "").trim())
          .filter(Boolean),
      );
      const schedules = Array.isArray(state.applicantManager?.schedules) ? state.applicantManager.schedules : [];

      return schedules.filter((schedule) => scheduleKeySet.has(getApplicantScheduleKey(schedule)));
    }

    function getSelectedApplicantSchedules() {
      const selectedScheduleKeys = Array.isArray(state.tableSettings?.applicantScheduleGrid?.selectedRowIds)
        ? state.tableSettings.applicantScheduleGrid.selectedRowIds
        : [];

      return getApplicantSchedulesByKeys(selectedScheduleKeys);
    }

    function getSharedApplicantScheduleValue(schedules = [], fieldName = "") {
      const values = new Set(
        (Array.isArray(schedules) ? schedules : []).map((schedule) => String(schedule?.[fieldName] || "")),
      );

      return values.size === 1 ? values.values().next().value || "" : "";
    }

    function buildApplicantScheduleTargetSummary(schedules = []) {
      const normalizedSchedules = Array.isArray(schedules) ? schedules : [];
      const visibleLabels = normalizedSchedules.slice(0, 3).map((schedule) => {
        const trackName = String(schedule?.trackName || "").trim();
        const admissionName = String(schedule?.admissionName || schedule?.admissionCode || "").trim();

        return [trackName, admissionName].filter(Boolean).join(" · ") || "전형 정보 없음";
      });
      const hiddenCount = Math.max(0, normalizedSchedules.length - visibleLabels.length);

      return `${visibleLabels.join(", ")}${hiddenCount > 0 ? ` 외 ${hiddenCount}개` : ""}`;
    }

    function syncApplicantScheduleModalForm() {
      const editorState = state.applicantManager.scheduleEditor || createEmptyApplicantScheduleEditor();
      const modalForm = globalScope.document?.getElementById("applicantScheduleForm") || null;
      const saveButton = globalScope.document?.getElementById("applicantScheduleModalSaveButton") || null;
      const modalTitle = globalScope.document?.getElementById("applicantScheduleModalTitle") || null;
      const modalDescription = globalScope.document?.getElementById("applicantScheduleModalDescription") || null;
      const bulkSummary = globalScope.document?.getElementById("applicantScheduleBulkSummary") || null;
      const bulkSummaryCount = globalScope.document?.getElementById("applicantScheduleBulkSummaryCount") || null;
      const bulkSummaryTargets = globalScope.document?.getElementById("applicantScheduleBulkSummaryTargets") || null;
      const isEditorActive = editorState.isActive === true;
      const isBulk = editorState.isBulk === true;
      const isSaving = editorState.isSaving === true;
      const targetSchedules = isBulk ? getApplicantSchedulesByKeys(editorState.targetScheduleKeys) : [];

      if (modalForm) {
        for (const [key, scope] of [['applicationTemplateId', 'application'], ['documentTemplateId', 'documents']]) {
          const select = modalForm.querySelector('[data-applicant-schedule-input="' + key + '"]');
          if (!select) continue;
          select.replaceChildren();
          if (isBulk) select.add(new Option('기존 템플릿 유지', ''));
          for (const template of state.applicantManager.formTemplates || []) {
            if (template.formScope === scope) select.add(new Option(template.name + (template.isDefault ? ' (기본)' : ''), String(template.id)));
          }
        }
        modalForm.querySelectorAll("[data-applicant-schedule-input]").forEach((inputElement) => {
          if (!isFormControlElement(inputElement)) {
            return;
          }

          const fieldName = String(inputElement.dataset.applicantScheduleInput || "").trim();
          if (inputElement.type === 'checkbox') {
            inputElement.checked = editorState[fieldName] !== false && editorState[fieldName] !== null;
            inputElement.indeterminate = isBulk && editorState[fieldName] === null;
            inputElement.closest('label').querySelector('[data-schedule-enabled-label]').textContent = inputElement.indeterminate ? '혼합 · 유지' : inputElement.checked ? '사용' : '미사용';
          } else inputElement.value = fieldName ? String(editorState[fieldName] || "") : "";
          const period = inputElement.closest('[data-schedule-period]');
          const periodDisabled = period && editorState[period.dataset.schedulePeriod + 'Enabled'] === false;
          inputElement.disabled = !isEditorActive || isSaving || (inputElement.type !== 'checkbox' && periodDisabled);
          period?.classList.toggle('is-disabled', periodDisabled);
        });
      }

      if (saveButton) {
        saveButton.disabled = !isEditorActive || isSaving;
        saveButton.textContent = isSaving ? "저장 중..." : isBulk ? `${targetSchedules.length}개 일정 저장` : "저장";
      }

      if (modalTitle) {
        modalTitle.textContent = isBulk ? "일정 일괄 설정" : "일정 상세정보";
      }

      if (modalDescription) {
        modalDescription.textContent = isBulk
          ? "선택한 전형에 동일한 접수, 서류 제출, 서류 제출 확인, 수험표 조회 기간을 적용합니다."
          : "모집시기와 전형별 접수, 서류 제출, 서류 제출 확인, 수험표 조회 기간을 설정합니다.";
      }

      if (bulkSummary) {
        bulkSummary.classList.toggle("hidden", !isBulk);
        bulkSummary.setAttribute("aria-hidden", isBulk ? "false" : "true");
      }

      if (bulkSummaryCount) {
        bulkSummaryCount.textContent = `선택한 ${targetSchedules.length}개 전형`;
      }

      if (bulkSummaryTargets) {
        bulkSummaryTargets.textContent = buildApplicantScheduleTargetSummary(targetSchedules);
      }
    }

    function resetApplicantScheduleEditor({ render = true } = {}) {
      state.applicantManager.scheduleEditor = createEmptyApplicantScheduleEditor();
      syncApplicantScheduleModalForm();

      if (render) {
        renderView();
      }
    }

    function startApplicantScheduleEdit(scheduleKey) {
      const normalizedScheduleKey = String(scheduleKey || "").trim();
      const schedule = state.applicantManager.schedules.find(
        (candidate) => String(candidate?.scheduleKey || candidate?.id || "").trim() === normalizedScheduleKey,
      );

      if (!schedule) {
        showToast("수정할 일정 항목을 찾을 수 없습니다.", "error");
        return;
      }

      state.applicantManager.scheduleEditor = {
        isActive: true,
        isBulk: false,
        isSaving: false,
        editingId: Number(schedule.id || 0),
        scheduleKey: String(schedule.scheduleKey || "").trim(),
        targetScheduleKeys: [],
        trackName: schedule.trackName || "",
        admissionCode: schedule.admissionCode || "",
        admissionName: schedule.admissionName || "",
        ...Object.fromEntries(scheduleTemplateFieldNames.map(key => [key, schedule[key] || ""])),
        ...Object.fromEntries(scheduleEnabledFieldNames.map(key => [key, schedule[key] !== false])),
        applicantScheduleStartAt: schedule.applicantScheduleStartAt || "",
        applicantScheduleEndAt: schedule.applicantScheduleEndAt || "",
        documentSubmissionScheduleStartAt: schedule.documentSubmissionScheduleStartAt || "",
        documentReviewScheduleStartAt: schedule.documentReviewScheduleStartAt || "",
        documentSubmissionScheduleEndAt: schedule.documentSubmissionScheduleEndAt || "",
        documentReviewScheduleEndAt: schedule.documentReviewScheduleEndAt || "",
        admitCardLookupScheduleStartAt: schedule.admitCardLookupScheduleStartAt || "",
        admitCardLookupScheduleEndAt: schedule.admitCardLookupScheduleEndAt || "",
      };
      renderView();
      syncApplicantScheduleModalForm();
      openModal?.("applicantScheduleModal");
    }

    function startApplicantScheduleBulkEdit() {
      const selectedSchedules = getSelectedApplicantSchedules();

      if (selectedSchedules.length === 0) {
        showToast("일괄 설정할 전형을 먼저 선택하세요.", "error", 3200);
        return;
      }

      const sharedScheduleValues = Object.fromEntries(
        scheduleDateFieldNames.map((fieldName) => [fieldName, getSharedApplicantScheduleValue(selectedSchedules, fieldName)]),
      );

      state.applicantManager.scheduleEditor = {
        ...createEmptyApplicantScheduleEditor({ isActive: true }),
        isActive: true,
        isBulk: true,
        isSaving: false,
        targetScheduleKeys: selectedSchedules.map((schedule) => getApplicantScheduleKey(schedule)),
        ...sharedScheduleValues,
        ...Object.fromEntries(scheduleTemplateFieldNames.map(key => [key, getSharedApplicantScheduleValue(selectedSchedules, key)])),
        ...Object.fromEntries(scheduleEnabledFieldNames.map(key => { const values = new Set(selectedSchedules.map(schedule => schedule[key] !== false)); return [key, values.size === 1 ? values.values().next().value : null]; })),
      };
      renderView();
      syncApplicantScheduleModalForm();
      openModal?.("applicantScheduleModal");
    }

    function updateApplicantScheduleEditorField(fieldName = "", value) {
      const editorState = state.applicantManager.scheduleEditor || createEmptyApplicantScheduleEditor();

      if (editorState.isActive !== true || editorState.isSaving === true) {
        return;
      }

      state.applicantManager.scheduleEditor = {
        ...editorState,
        [fieldName]: scheduleEnabledFieldNames.includes(fieldName) ? value === true : String(value ?? ""),
      };
      if (scheduleEnabledFieldNames.includes(fieldName)) syncApplicantScheduleModalForm();
    }

    async function saveApplicantSchedule() {
      const editorState = state.applicantManager.scheduleEditor || createEmptyApplicantScheduleEditor();

      if (editorState.isActive !== true) {
        showToast("일정 항목을 먼저 선택하세요.", "error", 3200);
        return;
      }

      if (editorState.isSaving === true) {
        return;
      }

      const scheduleValues = Object.fromEntries(
        scheduleDateFieldNames.map((fieldName) => [fieldName, editorState[fieldName] || ""]),
      );
      const targetSchedules = editorState.isBulk === true
        ? getApplicantSchedulesByKeys(editorState.targetScheduleKeys)
        : [];

      if (editorState.isBulk === true && targetSchedules.length !== editorState.targetScheduleKeys.length) {
        showToast("선택한 전형 정보가 변경되었습니다. 목록에서 다시 선택하세요.", "error", 3600);
        return;
      }

      state.applicantManager.scheduleEditor = {
        ...editorState,
        isSaving: true,
      };
      syncApplicantScheduleModalForm();

      try {
        if (editorState.isBulk === true) {
          await apiRequest("/api/applicant-schedules/bulk", {
            method: "PUT",
            body: JSON.stringify({
              schedules: targetSchedules.map((schedule) => ({
                trackName: schedule.trackName,
                admissionCode: schedule.admissionCode,
                admissionName: schedule.admissionName,
                ...scheduleValues,
                ...Object.fromEntries(scheduleTemplateFieldNames.map(key => [key, Number(editorState[key] || schedule[key])])),
                ...Object.fromEntries(scheduleEnabledFieldNames.map(key => [key, editorState[key] === null ? schedule[key] !== false : editorState[key] !== false])),
              })),
            }),
          });

          const scheduleGridState = state.tableSettings?.applicantScheduleGrid;

          if (scheduleGridState) {
            scheduleGridState.selectedRowIds = [];
            scheduleGridState.selectionAnchorRowId = "";
          }
        } else {
          await apiRequest("/api/applicant-schedules", {
            method: "PUT",
            body: JSON.stringify({
              trackName: editorState.trackName,
              admissionCode: editorState.admissionCode,
              admissionName: editorState.admissionName,
              ...scheduleValues,
              ...Object.fromEntries(scheduleTemplateFieldNames.map(key => [key, Number(editorState[key])])),
              ...Object.fromEntries(scheduleEnabledFieldNames.map(key => [key, editorState[key] !== false])),
            }),
          });
        }

        await requestCloseModal?.("applicantScheduleModal");
        await refreshApplicantBootstrap(
          editorState.isBulk === true ? `${targetSchedules.length}개 전형의 일정을 저장했습니다.` : "일정을 저장했습니다.",
        );
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return;
        }

        showToast(error?.message || "일정을 저장하지 못했습니다.", "error", 4200);
      } finally {
        const latestEditorState = state.applicantManager.scheduleEditor || createEmptyApplicantScheduleEditor();

        if (latestEditorState.isActive === true && latestEditorState.isSaving === true) {
          state.applicantManager.scheduleEditor = {
            ...latestEditorState,
            isSaving: false,
          };
          syncApplicantScheduleModalForm();
        }
      }
    }

    return Object.freeze({
      resetApplicantScheduleEditor,
      saveApplicantSchedule,
      startApplicantScheduleBulkEdit,
      startApplicantScheduleEdit,
      updateApplicantScheduleEditorField,
    });
  }

  return Object.freeze({
    createApplicantSchedulesController,
  });
});
