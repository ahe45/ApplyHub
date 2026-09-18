(function (globalScope, factory) {
  const applicantAdminEvents = factory(globalScope);

  if (typeof module === "object" && module.exports) {
    module.exports = applicantAdminEvents;
    return;
  }

  globalScope.AdmitCardApplicantAdminEvents = applicantAdminEvents;
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  function createApplicantAdminEventHandlers(deps = {}) {
    const doc = deps.document || globalScope.document;
    let applicantFieldDragSourceId = "";
    let applicantFieldIgnoreClickUntil = 0;

    function clearApplicantFieldDragIndicators() {
      doc
        ?.querySelectorAll(".applicant-field-card.is-dragging, .applicant-field-card.is-drop-target-before, .applicant-field-card.is-drop-target-after")
        .forEach((element) => {
          element.classList.remove("is-dragging", "is-drop-target-before", "is-drop-target-after");
        });
    }

    function handleClick(event) {
      const target = event.target instanceof Element ? event.target : null;
      const tabTrigger = target?.closest("[data-template-management-tab]") || null;

      const submissionToggleTrigger = target?.closest("[data-applicant-submission-toggle]") || null;
      const submissionDeleteTrigger = target?.closest("[data-applicant-submission-delete]") || null;
      const submissionPhotoUploadTrigger = target?.closest("[data-applicant-submission-photo-upload-trigger]") || null;

      const submissionDataDownloadTrigger = target?.closest("[data-download-applicant-submission-data]") || null;
      const submissionPhotoDownloadTrigger = target?.closest("[data-download-applicant-submission-photos]") || null;
      const recruitmentSelectTrigger = target?.closest("[data-applicant-recruitment-select]") || null;
      const recruitmentAddTrigger = target?.closest("[data-applicant-recruitment-add]") || null;
      const recruitmentDeleteTrigger = target?.closest("[data-applicant-recruitment-delete]") || null;
      const recruitmentDownloadTrigger = target?.closest("[data-download-applicant-recruitment]") || null;
      const recruitmentDownloadTemplateTrigger = target?.closest("[data-applicant-recruitment-download-template]") || null;
      const recruitmentUploadTrigger = target?.closest("[data-upload-applicant-recruitment]") || null;
      const scheduleBulkEditTrigger = target?.closest("[data-applicant-schedule-bulk-edit]") || null;
      const fieldAddTrigger = target?.closest("[data-applicant-field-add]") || null;
      const fieldPreviewTrigger = target?.closest("[data-applicant-field-preview]") || null;
      const fieldEditTrigger = target?.closest("[data-applicant-field-edit]") || null;
      const fieldDeleteTrigger = target?.closest("[data-applicant-field-delete]") || null;
      const fieldMoveTrigger = target?.closest("[data-applicant-field-move]") || null;
      const fieldOptionAddTrigger = target?.closest("[data-applicant-field-option-add]") || null;
      const fieldOptionRemoveTrigger = target?.closest("[data-applicant-field-option-remove]") || null;
      const fieldResetTrigger = target?.closest("[data-applicant-field-reset]") || null;
      const fieldSelectTrigger = target?.closest("[data-applicant-field-select]") || null;

      if (tabTrigger) {
        deps.setApplicantManagerTab?.(tabTrigger.dataset.templateManagementTab);
        return true;
      }

      if (submissionToggleTrigger) {
        deps.toggleApplicantSubmissionDetail?.(submissionToggleTrigger.dataset.applicantSubmissionToggle);
        return true;
      }

      const dashboardRow = target?.closest("[data-dashboard-submission]");
      if (dashboardRow) {
        deps.toggleApplicantSubmissionDetail?.(dashboardRow.dataset.dashboardSubmission);
        return true;
      }

      if (submissionDeleteTrigger) {
        void deps.deleteApplicantSubmission?.(submissionDeleteTrigger.dataset.applicantSubmissionDelete);
        return true;
      }

      if (submissionPhotoUploadTrigger) {
        const photoInput =
          submissionPhotoUploadTrigger
            .closest(".applicant-submission-detail-photo-panel")
            ?.querySelector("[data-applicant-submission-photo-input='true']") || null;

        if (photoInput instanceof HTMLInputElement) {
          photoInput.click();
          return true;
        }
      }

      if (recruitmentSelectTrigger) {
        deps.startApplicantRecruitmentUnitEdit?.(recruitmentSelectTrigger.dataset.applicantRecruitmentSelect);
        return true;
      }

      if (recruitmentAddTrigger) {
        deps.activateApplicantRecruitmentUnitCreation?.();
        deps.openModal?.("applicantRecruitmentUnitModal");
        return true;
      }

      if (recruitmentDeleteTrigger) {
        void deps.deleteApplicantRecruitmentUnit?.(recruitmentDeleteTrigger.dataset.applicantRecruitmentDelete);
        return true;
      }

      if (submissionDataDownloadTrigger) {
        void deps.downloadApplicantSubmissions?.();
        return true;
      }

      if (submissionPhotoDownloadTrigger) {
        void deps.downloadApplicantSubmissionPhotos?.();
        return true;
      }

      if (recruitmentDownloadTrigger) {
        void deps.downloadApplicantRecruitmentUnits?.();
        return true;
      }

      if (recruitmentDownloadTemplateTrigger) {
        void deps.downloadApplicantRecruitmentUnitTemplate?.();
        return true;
      }

      if (recruitmentUploadTrigger) {
        void deps.uploadApplicantRecruitmentUnitFile?.();
        return true;
      }

      if (scheduleBulkEditTrigger) {
        deps.startApplicantScheduleBulkEdit?.();
        return true;
      }

      if (fieldAddTrigger) {
        deps.activateApplicantFieldCreation?.();
        return true;
      }

      if (fieldPreviewTrigger) {
        deps.openApplicantFieldPreview?.();
        return true;
      }

      if (fieldEditTrigger) {
        deps.startApplicantFieldEdit?.(fieldEditTrigger.dataset.applicantFieldEdit);
        return true;
      }

      if (fieldDeleteTrigger) {
        void deps.deleteApplicantField?.(fieldDeleteTrigger.dataset.applicantFieldDelete);
        return true;
      }

      if (fieldMoveTrigger) {
        void deps.moveApplicantField?.(fieldMoveTrigger.dataset.applicantFieldMove, fieldMoveTrigger.dataset.applicantFieldDirection);
        return true;
      }

      if (fieldOptionAddTrigger) {
        deps.addApplicantFieldOption?.();
        return true;
      }

      if (fieldOptionRemoveTrigger) {
        deps.removeApplicantFieldOption?.(fieldOptionRemoveTrigger.dataset.applicantFieldOptionRemove);
        return true;
      }

      if (fieldSelectTrigger) {
        if (Date.now() < applicantFieldIgnoreClickUntil) {
          return true;
        }

        deps.startApplicantFieldEdit?.(fieldSelectTrigger.dataset.applicantFieldSelect);
        return true;
      }

      if (fieldResetTrigger) {
        deps.resetApplicantFieldEditor?.();
        return true;
      }

      return false;
    }

    function syncInputValue(event) {
      const target = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement
        ? event.target
        : null;

      if (!target) {
        return false;
      }

      if (target.dataset.applicantFieldInput) {
        deps.updateApplicantFieldEditorField?.(
          target.dataset.applicantFieldInput,
          target instanceof HTMLInputElement && target.type === "checkbox" ? target.checked : target.value,
        );
        return true;
      }

      if (target.dataset.applicantRecruitmentInput) {
        deps.updateApplicantRecruitmentUnitEditorField?.(target.dataset.applicantRecruitmentInput, target.value);
        return true;
      }

      if (target.dataset.applicantScheduleInput) {
        deps.updateApplicantScheduleEditorField?.(target.dataset.applicantScheduleInput, target.type === "checkbox" ? target.checked : target.value);
        return true;
      }

      if (target.dataset.applicantSettingsInput) {
        deps.updateApplicantSettingsField?.(target.dataset.applicantSettingsInput, target.value);
        return true;
      }

      return false;
    }

    async function handleChange(event) {
      const target = event.target instanceof HTMLInputElement ? event.target : null;

      if (!target) {
        return false;
      }

      if (target.dataset.applicantUploadExistingPolicy === "recruitment") {
        deps.updateApplicantRecruitmentUnitUploadExistingDataPolicy?.(target.value);
        return true;
      }

      if (target.dataset.applicantSubmissionPhotoInput !== "true") {
        return false;
      }

      const selectedFile = target.files?.[0] || null;
      const submissionId = target.dataset.applicantSubmissionId || "";
      target.value = "";

      if (!selectedFile) {
        return true;
      }

      await deps.uploadApplicantSubmissionPhoto?.(selectedFile, submissionId);
      return true;
    }

    async function handleSubmit(event) {
      const form = event.target instanceof HTMLFormElement ? event.target : null;

      if (!form) {
        return false;
      }

      if (form.matches("[data-applicant-field-form]")) {
        event.preventDefault();
        await deps.saveApplicantFieldEditor?.();
        return true;
      }

      if (form.matches("[data-applicant-recruitment-form]")) {
        event.preventDefault();
        await deps.saveApplicantRecruitmentUnit?.();
        return true;
      }

      if (form.matches("[data-applicant-schedule-form]")) {
        event.preventDefault();
        await deps.saveApplicantSchedule?.();
        return true;
      }

      if (form.matches("[data-applicant-settings-form]")) {
        event.preventDefault();
        await deps.saveApplicantSettings?.();
        return true;
      }

      return false;
    }

    function handleKeydown(event) {
      const target = event.target instanceof Element ? event.target : null;
      const fieldSelectTrigger = target?.closest("[data-applicant-field-select]") || null;
      const recruitmentSelectTrigger = target?.closest("[data-applicant-recruitment-select]") || null;
      const optionDraftInput = target?.closest("[data-applicant-field-option-draft]") || null;

      if (
        fieldSelectTrigger &&
        (event.key === "Enter" || event.key === " ") &&
        !(target instanceof HTMLButtonElement) &&
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLSelectElement) &&
        !(target instanceof HTMLTextAreaElement)
      ) {
        event.preventDefault();
        deps.startApplicantFieldEdit?.(fieldSelectTrigger.dataset.applicantFieldSelect);
        return true;
      }

      if (optionDraftInput && event.key === "Enter") {
        event.preventDefault();
        deps.addApplicantFieldOption?.();
        return true;
      }

      if (
        recruitmentSelectTrigger &&
        (event.key === "Enter" || event.key === " ") &&
        !(target instanceof HTMLButtonElement) &&
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLSelectElement) &&
        !(target instanceof HTMLTextAreaElement)
      ) {
        event.preventDefault();
        deps.startApplicantRecruitmentUnitEdit?.(recruitmentSelectTrigger.dataset.applicantRecruitmentSelect);
        return true;
      }

      return false;
    }

    function handleDragStart(event) {
      const target = event.target instanceof Element ? event.target.closest("[data-applicant-field-draggable]") : null;

      if (!target) {
        return false;
      }

      applicantFieldDragSourceId = String(target.dataset.applicantFieldDraggable || "").trim();

      if (!applicantFieldDragSourceId) {
        return false;
      }

      clearApplicantFieldDragIndicators();
      target.classList.add("is-dragging");

      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", applicantFieldDragSourceId);
      }

      return true;
    }

    function handleDragOver(event) {
      const target = event.target instanceof Element ? event.target.closest("[data-applicant-field-draggable]") : null;

      if (!applicantFieldDragSourceId || !target) {
        return false;
      }

      const targetFieldId = String(target.dataset.applicantFieldDraggable || "").trim();

      if (!targetFieldId || targetFieldId === applicantFieldDragSourceId) {
        return false;
      }

      event.preventDefault();
      clearApplicantFieldDragIndicators();
      const escapedFieldId =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(applicantFieldDragSourceId)
          : applicantFieldDragSourceId.replaceAll('"', '\\"');
      doc?.querySelector(`[data-applicant-field-draggable="${escapedFieldId}"]`)?.classList.add("is-dragging");

      const targetBounds = target.getBoundingClientRect();
      const placement = event.clientY > targetBounds.top + targetBounds.height / 2 ? "after" : "before";

      target.classList.add(placement === "after" ? "is-drop-target-after" : "is-drop-target-before");

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }

      return true;
    }

    function handleDrop(event) {
      const target = event.target instanceof Element ? event.target.closest("[data-applicant-field-draggable]") : null;

      if (!applicantFieldDragSourceId || !target) {
        clearApplicantFieldDragIndicators();
        applicantFieldDragSourceId = "";
        return false;
      }

      const targetFieldId = String(target.dataset.applicantFieldDraggable || "").trim();

      if (!targetFieldId || targetFieldId === applicantFieldDragSourceId) {
        clearApplicantFieldDragIndicators();
        applicantFieldDragSourceId = "";
        return false;
      }

      event.preventDefault();
      const targetBounds = target.getBoundingClientRect();
      const placement = event.clientY > targetBounds.top + targetBounds.height / 2 ? "after" : "before";
      applicantFieldIgnoreClickUntil = Date.now() + 250;
      void deps.reorderApplicantField?.(applicantFieldDragSourceId, targetFieldId, placement);
      clearApplicantFieldDragIndicators();
      applicantFieldDragSourceId = "";
      return true;
    }

    function handleDragEnd() {
      clearApplicantFieldDragIndicators();
      applicantFieldDragSourceId = "";
    }

    return Object.freeze({
      handleChange,
      handleClick,
      handleDragEnd,
      handleDragOver,
      handleDragStart,
      handleDrop,
      handleKeydown,
      handleSubmit,
      syncInputValue,
    });
  }

  return Object.freeze({
    createApplicantAdminEventHandlers,
  });
});
