(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardAuthSession = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createAuthSessionController({
    apiRequest,
    appShell,
    clearAutoLogoutTimer,
    consumeFlashToast,
    createAuthState,
    currentUserId,
    currentUserRole,
    getDefaultAccessibleView,
    hideToast,
    isLoginPage,
    isRouteNavigating,
    isUserAuthenticated,
    loadBootstrapData,
    loadLoginNoticeData,
    logoutButton,
    navigateToLogin,
    navigateToView,
    normalizeAuthAccount,
    pageShell,
    passwordSetupForm,
    queueFlashToast,
    redirectToAccessibleRouteIfNeeded,
    renderView,
    resetBootstrapData,
    showToast,
    sidebar,
    state,
    syncAutoLogoutCountdown,
    syncCurrentViewFromLocation,
    syncNavigationVisibility,
    syncPasswordSetupModal,
    topbar,
  }) {
    function updateAuthChrome() {
      const isAuthenticated = isUserAuthenticated();
      // Authentication can finish before the browser leaves the login document.
      const showAdminChrome = isAuthenticated && !isLoginPage();

      appShell?.classList.toggle("auth-locked", !showAdminChrome);
      pageShell?.classList.toggle("auth-only", !showAdminChrome);
      sidebar?.classList.toggle("hidden", !showAdminChrome);
      topbar?.classList.toggle("hidden", !showAdminChrome);

      if (logoutButton) {
        logoutButton.disabled = !isAuthenticated;
      }

      if (currentUserId) {
        const userId = String(state.auth.currentUser?.id || "").trim();
        const userRole = String(state.auth.currentUser?.role || "").trim();

        currentUserId.textContent = userId || "로그인 필요";

        if (currentUserRole) {
          currentUserRole.textContent = userId && userRole ? `(${userRole})` : "";
        }
      }

      syncAutoLogoutCountdown();
      syncNavigationVisibility();
      syncPasswordSetupModal();
    }

    function applyAuthPayload(payload = {}) {
      const account = normalizeAuthAccount(payload.account);

      state.auth.currentUser = account;
      state.auth.error = "";

      if (payload.authenticated && account) {
        state.auth.status = "authenticated";
        state.auth.passwordSetup.error = "";
        return;
      }

      if (payload.requiresPasswordChange && account) {
        state.auth.status = "password_setup";
        return;
      }

      state.auth.status = "logged_out";
    }

    function resetAuthFormState() {
      state.auth.isSubmittingLogin = false;
      state.auth.isSubmittingPasswordSetup = false;
      state.auth.loginForm.password = "";
      state.auth.passwordSetup = {
        password: "",
        passwordConfirm: "",
        error: "",
      };

      if (passwordSetupForm) {
        passwordSetupForm.reset();
      }
    }

    function setLoggedOutState({ preserveLoginId = true, message = "" } = {}) {
      const nextLoginId = preserveLoginId ? state.auth.loginForm.id : "";

      if (typeof globalThis.closeAllModals === "function") {
        globalThis.closeAllModals();
      }

      hideToast();
      resetBootstrapData();
      state.auth = createAuthState();
      state.auth.status = "logged_out";
      state.auth.loginForm.id = nextLoginId;
      state.auth.error = message;
    }

    function handleAuthenticationFailure(error) {
      if (!error || (error.code !== "AUTH_REQUIRED" && error.code !== "PASSWORD_SETUP_REQUIRED")) {
        return false;
      }

      if (error.code === "PASSWORD_SETUP_REQUIRED") {
        clearAutoLogoutTimer();
        state.auth.status = "password_setup";
        state.auth.passwordSetup.error = "초기 비밀번호를 먼저 설정하세요.";
        updateAuthChrome();
        renderView();

        if (!isLoginPage()) {
          navigateToLogin({ replace: true });
        }

        return true;
      }

      if (isLoginPage()) {
        showToast("세션이 만료되었습니다. 다시 로그인하세요.", "error", 4200);
      } else {
        queueFlashToast("세션이 만료되었습니다. 다시 로그인하세요.", "error", 4200);
      }

      setLoggedOutState({
        preserveLoginId: false,
        message: "",
      });
      updateAuthChrome();
      renderView();

      if (!isLoginPage()) {
        navigateToLogin({ replace: true });
        void loadLoginNoticeData();
      }

      return true;
    }

    async function loadAuthSession() {
      clearAutoLogoutTimer();
      syncCurrentViewFromLocation();
      const loginNoticePromise = isLoginPage() ? loadLoginNoticeData({ render: false }) : Promise.resolve();
      let didNavigate = false;

      state.auth.status = "loading";
      state.auth.error = "";
      updateAuthChrome();
      renderView();

      try {
        const payload = await apiRequest("/api/auth/session");
        applyAuthPayload(payload);
        syncCurrentViewFromLocation();

        if (state.auth.status === "authenticated") {
          if (isLoginPage()) {
            didNavigate = navigateToView(getDefaultAccessibleView(state.auth.currentUser?.role), { replace: true }) || didNavigate;
            return;
          }

          if (redirectToAccessibleRouteIfNeeded()) {
            didNavigate = true;
            return;
          }

          await loadBootstrapData({ showLoading: false });
        } else {
          resetBootstrapData();

          if (!isLoginPage()) {
            didNavigate = navigateToLogin({ replace: true }) || didNavigate;
            return;
          }
        }
      } catch (error) {
        setLoggedOutState({
          preserveLoginId: false,
          message: isLoginPage() ? error.message : "",
        });

        if (!isLoginPage()) {
          queueFlashToast(error.message, "error", 4200);
          didNavigate = navigateToLogin({ replace: true }) || didNavigate;
          return;
        }
      } finally {
        await loginNoticePromise;

        if (!didNavigate && !isRouteNavigating()) {
          updateAuthChrome();
          renderView();
          consumeFlashToast();
        }
      }
    }

    async function submitLogin() {
      if (state.auth.isSubmittingLogin || isRouteNavigating()) {
        return;
      }

      let didNavigate = false;
      const accountId = String(state.auth.loginForm.id || "").trim();
      const password = String(state.auth.loginForm.password || "");

      if (!accountId || !password) {
        state.auth.error = "이메일 또는 관리자 ID와 비밀번호를 입력하세요.";
        renderView();
        return;
      }

      state.auth.error = "";
      state.auth.isSubmittingLogin = true;
      renderView();

      try {
        const payload = await apiRequest("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            id: accountId,
            password,
          }),
        });

        if (payload.accountType === "applicant" && payload.member) {
          state.auth.loginForm.password = "";
          window.location.replace("/applicant");
          didNavigate = true;
          return;
        }

        applyAuthPayload(payload);
        state.auth.loginForm.password = "";
        state.auth.passwordSetup.error = "";

        if (state.auth.status === "authenticated") {
          didNavigate = navigateToView(getDefaultAccessibleView(state.auth.currentUser?.role), { replace: true });
          return;
        }

        resetBootstrapData();
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return;
        }

        state.auth.error = error.message;
      } finally {
        // Keep the existing, disabled login panel until the new document loads.
        // Re-rendering here used to reset the form and briefly expose admin chrome.
        if (!didNavigate) {
          state.auth.isSubmittingLogin = false;
          updateAuthChrome();
          renderView();
        }
      }
    }

    async function closePasswordSetupPrompt() {
      if (state.auth.status !== "password_setup" || state.auth.isSubmittingPasswordSetup) {
        return;
      }

      try {
        await apiRequest("/api/auth/logout", {
          method: "POST",
        });
      } catch (error) {
        // Ignore logout failures and clear the local password-setup state anyway.
      }

      setLoggedOutState({
        preserveLoginId: true,
        message: "",
      });
      updateAuthChrome();
      renderView();

      if (!isLoginPage()) {
        navigateToLogin({ replace: true });
      }
    }

    async function submitPasswordSetup() {
      if (state.auth.isSubmittingPasswordSetup || isRouteNavigating()) {
        return;
      }

      let didNavigate = false;
      const nextPassword = String(state.auth.passwordSetup.password || "");
      const passwordConfirm = String(state.auth.passwordSetup.passwordConfirm || "");

      state.auth.passwordSetup.error = "";

      if (!nextPassword || !passwordConfirm) {
        state.auth.passwordSetup.error = "새 비밀번호와 확인 값을 모두 입력하세요.";
        syncPasswordSetupModal();
        return;
      }

      state.auth.isSubmittingPasswordSetup = true;
      syncPasswordSetupModal();

      try {
        const payload = await apiRequest("/api/auth/password/setup", {
          method: "POST",
          body: JSON.stringify({
            password: nextPassword,
            passwordConfirm,
          }),
        });

        applyAuthPayload(payload);

        if (state.auth.status === "authenticated") {
          queueFlashToast("변경된 비밀번호로 로그인에 성공했습니다.");
          didNavigate = navigateToView(getDefaultAccessibleView(state.auth.currentUser?.role), { replace: true });
          return;
        }
        resetAuthFormState();
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return;
        }

        state.auth.passwordSetup.error = error.message;
      } finally {
        if (!didNavigate) {
          state.auth.isSubmittingPasswordSetup = false;
          updateAuthChrome();
          renderView();
        }
      }
    }

    async function logoutCurrentUser() {
      try {
        await apiRequest("/api/auth/logout", {
          method: "POST",
        });
      } catch (error) {
        // Ignore logout request failures and clear the local state anyway.
      }

      setLoggedOutState({
        preserveLoginId: false,
        message: "",
      });
      updateAuthChrome();
      renderView();
      navigateToLogin({ replace: true });
      void loadLoginNoticeData();
    }

    return Object.freeze({
      applyAuthPayload,
      closePasswordSetupPrompt,
      handleAuthenticationFailure,
      loadAuthSession,
      logoutCurrentUser,
      resetAuthFormState,
      setLoggedOutState,
      submitLogin,
      submitPasswordSetup,
      updateAuthChrome,
    });
  }

  return Object.freeze({
    createAuthSessionController,
  });
});
