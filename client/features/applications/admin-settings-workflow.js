(function (globalScope, factory) {
  const moduleApi = factory(globalScope);

  if (typeof module === "object" && module.exports) {
    module.exports = moduleApi;
    return;
  }

  globalScope.AdmitCardApplicantSettingsWorkflow = moduleApi;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createApplicantSettingsController({
    apiRequest,
    defaultExamNoPattern,
    defaultExamNoSequenceStart,
    handleAuthenticationFailure,
    refreshApplicantBootstrap,
    showToast,
    state,
  }) {
    function updateApplicantSettingsField(fieldName = "", value) {
      state.applicantManager.settings = {
        ...state.applicantManager.settings,
        [fieldName]: fieldName === "examNoSequenceStart" ? Number(value || 0) : String(value ?? ""),
      };
    }

    async function saveApplicantSettings() {
      try {
        await apiRequest("/api/applicant-settings", {
          method: "PUT",
          body: JSON.stringify({
            examNoPattern: state.applicantManager.settings?.examNoPattern || defaultExamNoPattern,
            examNoSequenceStart: state.applicantManager.settings?.examNoSequenceStart || defaultExamNoSequenceStart,
          }),
        });
        await refreshApplicantBootstrap("접수 수험번호 규칙을 저장했습니다.");
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return;
        }

        showToast(error?.message || "접수 수험번호 규칙을 저장하지 못했습니다.", "error", 4200);
      }
    }

    return Object.freeze({
      saveApplicantSettings,
      updateApplicantSettingsField,
    });
  }

  return Object.freeze({
    createApplicantSettingsController,
  });
});
