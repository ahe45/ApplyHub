(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardBootstrapLoader = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createBootstrapLoaderController({
    apiRequest,
    applyBootstrapPayload,
    applyLoginNoticePayload,
    applySuperAdminPayload,
    handleAuthenticationFailure,
    isUserAuthenticated,
    loadCurrentViewData,
    renderView,
    state,
    updateAuthChrome,
  }) {
    async function loadLoginNoticeData({ render = true } = {}) {
      try {
        const payload = await apiRequest("/api/login-notice");
        applyLoginNoticePayload(payload.html || payload.loginNoticeHtml || "", { scope: "login" });
        applySuperAdminPayload(payload.superAdminSettings || {});
        state.loginNotice.admissionHomepageUrl = String(payload.admissionHomepageUrl || '').trim();
      } catch (error) {
        // Keep the default in-memory notice when the server payload cannot be loaded.
      } finally {
        if (render) {
          renderView();
        }
      }
    }

    async function loadBootstrapData({ showLoading = true } = {}) {
      if (!isUserAuthenticated()) {
        state.bootstrap.isLoading = false;
        state.bootstrap.error = "";
        return;
      }

      state.bootstrap.error = "";

      if (showLoading) {
        state.bootstrap.isLoading = true;
        renderView();
      }

      try {
        const payload = await apiRequest("/api/bootstrap");
        applyBootstrapPayload(payload);
        if (typeof loadCurrentViewData === "function") {
          await loadCurrentViewData();
        }
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return;
        }

        state.bootstrap.error = error.message;
      } finally {
        state.bootstrap.isLoading = false;
        updateAuthChrome();
        renderView();
      }
    }

    return Object.freeze({
      loadBootstrapData,
      loadLoginNoticeData,
    });
  }

  return Object.freeze({
    createBootstrapLoaderController,
  });
});
