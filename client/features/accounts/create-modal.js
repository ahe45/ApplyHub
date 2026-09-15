(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardAccountCreate = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createAccountCreateController({
    accountCreateError,
    accountCreateForm,
    accountCreateId,
    accountCreateModal,
    accountCreateName,
    accountCreateRole,
    accountRoleOptions,
    getCurrentRole = () => "",
    apiRequest,
    appendAccountRecord,
    closeModal,
    getSortedAccountRows = null,
    getSystemInitialPassword,
    getTableState = null,
    handleAuthenticationFailure,
    normalizeAccountRecord,
    renderView,
    showToast,
  }) {
    function getAvailableRoles() {
      const superRole = globalThis.AdmitCardAppConfig.superAdminRole;
      return accountRoleOptions.filter(role => getCurrentRole() === superRole || role !== superRole);
    }

    function getDefaultAccountRole() {
      return accountRoleOptions.includes("관리자") ? "관리자" : String(accountRoleOptions[0] || "조회용");
    }

    function syncAccountCreateRoleOptions(selectedRole = getDefaultAccountRole()) {
      if (!accountCreateRole) {
        return;
      }

      const optionElements = getAvailableRoles().map((role) => {
        const option = document.createElement("option");
        option.value = role;
        option.textContent = role;
        option.selected = role === selectedRole;
        return option;
      });

      accountCreateRole.replaceChildren(...optionElements);
      accountCreateRole.value = selectedRole;
    }

    function setAccountCreateError(message = "") {
      if (!accountCreateError) {
        return;
      }

      const normalizedMessage = String(message || "").trim();
      accountCreateError.textContent = normalizedMessage;
      accountCreateError.classList.toggle("hidden", !normalizedMessage);
    }

    function syncAccountCreateSubmitButton(isSubmitting = false) {
      const submitButton = accountCreateForm?.querySelector("[data-account-create-submit]");

      if (!submitButton) {
        return;
      }

      submitButton.disabled = isSubmitting;
      submitButton.textContent = isSubmitting ? "등록 중..." : "등록";
    }

    function resetAccountCreateFormState() {
      accountCreateForm?.reset();

      if (accountCreateId) {
        accountCreateId.value = "";
      }

      if (accountCreateName) {
        accountCreateName.value = "";
      }

      syncAccountCreateRoleOptions();
      setAccountCreateError("");
      syncAccountCreateSubmitButton(false);
    }

    function prepareAccountCreateModal() {
      if (!accountCreateModal) {
        return;
      }

      resetAccountCreateFormState();
      window.setTimeout(() => {
        accountCreateId?.focus();
      }, 0);
    }

    async function submitAccountCreate() {
      const accountId = String(accountCreateId?.value || "").trim();
      const name = String(accountCreateName?.value || "").trim();
      const role = String(accountCreateRole?.value || "").trim();

      if (!accountId) {
        setAccountCreateError("계정 ID를 입력하세요.");
        accountCreateId?.focus();
        return;
      }

      if (!name) {
        setAccountCreateError("계정 이름을 입력하세요.");
        accountCreateName?.focus();
        return;
      }

      if (!getAvailableRoles().includes(role)) {
        setAccountCreateError("계정 권한을 선택하세요.");
        accountCreateRole?.focus();
        return;
      }

      setAccountCreateError("");
      syncAccountCreateSubmitButton(true);

      try {
        const createdAccount = await apiRequest("/api/accounts", {
          method: "POST",
          body: JSON.stringify({
            id: accountId,
            name,
            role,
          }),
        });

        appendAccountRecord(normalizeAccountRecord(createdAccount));

        if (typeof getTableState === "function") {
          const tableState = getTableState("accountManagementGrid");
          const sortedRows = typeof getSortedAccountRows === "function" ? getSortedAccountRows() : [];
          const createdIndex = sortedRows.findIndex((row) => row.id === createdAccount.id);

          if (tableState && createdIndex >= 0) {
            tableState.page = Math.floor(createdIndex / tableState.pageSize) + 1;
          }
        }

        closeModal("accountCreateModal");
        renderView();
        showToast(`계정을 등록했습니다. 초기 비밀번호는 ${getSystemInitialPassword()}입니다.`);
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return;
        }

        setAccountCreateError(error.message);
      } finally {
        syncAccountCreateSubmitButton(false);
      }
    }

    return Object.freeze({
      getDefaultAccountRole,
      prepareAccountCreateModal,
      resetAccountCreateFormState,
      setAccountCreateError,
      submitAccountCreate,
      syncAccountCreateRoleOptions,
      syncAccountCreateSubmitButton,
    });
  }

  return Object.freeze({
    createAccountCreateController,
  });
});
