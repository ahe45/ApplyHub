(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardAccountRenderers = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function renderAccountRoleOptions(selectedRole) {
    return accountRoleOptions
      .filter(role => state.auth.currentUser?.role === superAdminRole || role !== superAdminRole)
      .map(
        (role) =>
          `<option value="${escapeAttribute(role)}" ${role === selectedRole ? "selected" : ""}>${escapeHtml(role)}</option>`,
      )
      .join("");
  }

  function renderAccountManagement() {
    return `
      <section class="view-stack table-view-stack">
        ${renderExamineeResultTable({
          title: "계정 관리",
          description: "운영 계정을 생성하고 권한, 초기화, 삭제 같은 계정 작업을 관리합니다.",
          gridKey: "accountManagementGrid",
          showPrintColumn: false,
          selectable: false,
          showRowNumber: true,
          emptyMessage: "등록된 계정이 없습니다.",
          headerActionsMarkup: renderGridHeaderActions({ gridKey: "accountManagementGrid" }),
        })}
      </section>
    `;
  }

  return {
    renderAccountManagement,
    renderAccountRoleOptions,
  };
});
