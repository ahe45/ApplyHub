(function (globalScope, factory) {
  const formFieldsWorkflow =
    globalScope.AdmitCardApplicantFormFieldsWorkflow ||
    (typeof require === "function" ? require("./admin-form-fields-workflow") : null);
  const recruitmentUnitsWorkflow =
    globalScope.AdmitCardApplicantRecruitmentUnitsWorkflow ||
    (typeof require === "function" ? require("./admin-recruitment-units-workflow") : null);
  const schedulesWorkflow =
    globalScope.AdmitCardApplicantSchedulesWorkflow ||
    (typeof require === "function" ? require("./admin-schedules-workflow") : null);

  const settingsWorkflow =
    globalScope.AdmitCardApplicantSettingsWorkflow ||
    (typeof require === "function" ? require("./admin-settings-workflow") : null);
  const moduleApi = factory({
    formFieldsWorkflow,
    recruitmentUnitsWorkflow,
    schedulesWorkflow,

    settingsWorkflow,
  });

  if (typeof module === "object" && module.exports) {
    module.exports = moduleApi;
    return;
  }

  globalScope.AdmitCardApplicantAdminManagementWorkflow = moduleApi;
})(typeof globalThis !== "undefined" ? globalThis : this, (workflows) => {
  if (!workflows.formFieldsWorkflow?.createApplicantFormFieldsController) {
    throw new Error("AdmitCardApplicantFormFieldsWorkflow.createApplicantFormFieldsController is required before loading admin-management-workflow.js");
  }

  if (!workflows.recruitmentUnitsWorkflow?.createApplicantRecruitmentUnitsController) {
    throw new Error("AdmitCardApplicantRecruitmentUnitsWorkflow.createApplicantRecruitmentUnitsController is required before loading admin-management-workflow.js");
  }

  if (!workflows.schedulesWorkflow?.createApplicantSchedulesController) {
    throw new Error("AdmitCardApplicantSchedulesWorkflow.createApplicantSchedulesController is required before loading admin-management-workflow.js");
  }

  if (!workflows.settingsWorkflow?.createApplicantSettingsController) {
    throw new Error("AdmitCardApplicantSettingsWorkflow.createApplicantSettingsController is required before loading admin-management-workflow.js");
  }

  const { createApplicantFormFieldsController } = workflows.formFieldsWorkflow;
  const { createApplicantRecruitmentUnitsController } = workflows.recruitmentUnitsWorkflow;
  const { createApplicantSchedulesController } = workflows.schedulesWorkflow;

  const { createApplicantSettingsController } = workflows.settingsWorkflow;

  function createApplicantAdminManagementController({
    apiRequest,

    createEmptyApplicantFieldEditor,
    createEmptyApplicantRecruitmentUnitEditor,
    createEmptyApplicantScheduleEditor,
    defaultExamNoPattern,
    defaultExamNoSequenceStart,
    handleAuthenticationFailure,
    openModal,
    refreshApplicantBootstrap,
    renderView,
    requestCloseModal,
    showToast,
    state,
  }) {
    const sharedDeps = {
      apiRequest,
      handleAuthenticationFailure,
      refreshApplicantBootstrap,
      renderView,
      requestCloseModal,
      showToast,
      state,
    };
    const formFieldsController = createApplicantFormFieldsController({
      ...sharedDeps,
      createEmptyApplicantFieldEditor,
    });
    const recruitmentUnitsController = createApplicantRecruitmentUnitsController({
      ...sharedDeps,
      createEmptyApplicantRecruitmentUnitEditor,
      openModal,
    });
    const schedulesController = createApplicantSchedulesController({
      ...sharedDeps,
      createEmptyApplicantScheduleEditor,
      openModal,
    });

    const settingsController = createApplicantSettingsController({
      apiRequest,
      defaultExamNoPattern,
      defaultExamNoSequenceStart,
      handleAuthenticationFailure,
      refreshApplicantBootstrap,
      showToast,
      state,
    });

    return Object.freeze({

      ...recruitmentUnitsController,
      ...schedulesController,
      ...formFieldsController,
      ...settingsController,
    });
  }

  return Object.freeze({
    createApplicantAdminManagementController,
  });
});
