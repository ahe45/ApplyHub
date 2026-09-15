(function (globalScope, factory) {
  const moduleApi = factory(globalScope);

  if (typeof module === "object" && module.exports) {
    module.exports = moduleApi;
    return;
  }

  globalScope.AdmitCardNavigationEvents = moduleApi;
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  function createNavigationEventController({
    brandHome,
    getDefaultAccessibleView,
    hasPendingSystemSettingsChanges,
    menuToggle,
    navigateToView,
    navItems = [],
    sidebar,
  }) {
    function closeSidebar() {
      sidebar?.classList.remove("open");
      menuToggle?.setAttribute('aria-expanded', 'false');
    }

    function bindNavigationEvents() {
      (Array.isArray(navItems) ? navItems : []).forEach((item) => {
        item.addEventListener("click", () => {
          const targetView = String(item.dataset.view || "").trim();

          if (!targetView) {
            return;
          }

          if (!navigateToView(targetView)) {
            closeSidebar();
          }
        });
      });

      if (menuToggle) {
        menuToggle.addEventListener("click", () => {
          sidebar?.classList.toggle("open");
          menuToggle.setAttribute('aria-expanded', String(Boolean(sidebar?.classList.contains('open'))));
        });
      }

      if (brandHome) {
        brandHome.addEventListener("click", () => {
          if (!navigateToView(getDefaultAccessibleView())) {
            closeSidebar();
          }
        });
      }

      if (typeof globalScope.addEventListener === "function") {
        globalScope.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' && (sidebar?.classList.contains('open') || menuToggle?.getAttribute('aria-expanded') === 'true')) {
            closeSidebar();
            menuToggle?.focus();
          }
        });
        globalScope.addEventListener('pointerdown', (event) => {
          if (sidebar?.classList.contains('open') && !sidebar.contains(event.target) && !menuToggle?.contains(event.target)) closeSidebar();
        });
        globalScope.addEventListener("beforeunload", (event) => {
          if (typeof hasPendingSystemSettingsChanges !== "function" || !hasPendingSystemSettingsChanges()) {
            return;
          }

          event.preventDefault();
          event.returnValue = "";
        });
      }
    }

    return Object.freeze({
      bindNavigationEvents,
    });
  }

  return Object.freeze({
    createNavigationEventController,
  });
});
