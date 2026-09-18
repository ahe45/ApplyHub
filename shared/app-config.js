(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardAppConfig = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const superAdminRole = "슈퍼관리자";
  const superAdminView = "superAdminManagement";
  const defaultLoginBrandMarkPath = "/client/assets/logo.png";
  const defaultLoginBackgroundImagePath = "/client/assets/bg.png";
  const accountRoleOptions = Object.freeze([superAdminRole, "관리자", "운영자", "조회용"]);
  const defaultView = "dashboard";
  const loginRoutePath = "/login";
  const pageTitles = Object.freeze({
    login: "로그인",
    dashboard: "대시보드",
    applicantRecruitmentManagement: "전형 관리",
    applicantScheduleManagement: "일정 관리",
    applicantQuestionTemplateManagement: "가입·접수 설정",
    applicantHistory: "접수 이력",
    applicantDocumentManagement: "서류 제출 관리",
    applicantMembers: "회원 목록",

    admitCardLookup: "수험표 출력",
    printHistory: "수험표 출력 이력",
    templateManagement: "수험표 양식 설정",
    accountManagement: "계정 관리",
    loginNoticeSettings: "공지사항 설정",
    systemSettings: "시스템 설정",
    systemDataDeletion: "데이터 삭제",
    systemBackupRestore: "백업 및 복구",
    [superAdminView]: "슈퍼관리자",
  });
  const sidebarMenuSections = Object.freeze([
    Object.freeze({
      key: "application-management",
      title: "접수 및 등록",
      views: Object.freeze(["applicantRecruitmentManagement", "applicantScheduleManagement", "applicantQuestionTemplateManagement", "applicantMembers", "applicantHistory", "applicantDocumentManagement"]),
    }),
    Object.freeze({
      key: "admit-card-management",
      title: "수험표 관리",
      views: Object.freeze(["admitCardLookup", "printHistory", "templateManagement"]),
    }),

    Object.freeze({
      key: "system-management",
      title: "시스템 관리",
      views: Object.freeze([
        "loginNoticeSettings",
        "accountManagement",
        "systemSettings",
      ]),
    }),
    Object.freeze({
      key: "super-admin-management",
      title: "슈퍼관리자",
      views: Object.freeze([superAdminView, "systemBackupRestore", "systemDataDeletion"]),
    }),
  ]);
  const sidebarMenuViewDefinitions = Object.freeze(
    sidebarMenuSections.reduce((definitions, section) => {
      section.views.forEach((view) => {
        definitions[view] = Object.freeze({
          sectionKey: section.key,
          sectionTitle: section.title,
          view,
          label: pageTitles[view] || view,
        });
      });

      return definitions;
    }, {}),
  );
  const sidebarMenuViews = Object.freeze(
    sidebarMenuSections.reduce((views, section) => {
      section.views.forEach((view) => {
        views.push(view);
      });
      return views;
    }, []),
  );
  const sidebarMenuViewSet = new Set(sidebarMenuViews);
  const viewRouteDefinitions = Object.freeze([
    Object.freeze({ view: defaultView, path: "/dashboard", title: pageTitles.dashboard }),
    Object.freeze({
      view: "applicantRecruitmentManagement",
      path: "/applicant-recruitment-management",
      title: pageTitles.applicantRecruitmentManagement,
    }),
    Object.freeze({
      view: "applicantScheduleManagement",
      path: "/applicant-schedules",
      title: pageTitles.applicantScheduleManagement,
    }),
    Object.freeze({
      view: "applicantQuestionTemplateManagement",
      path: "/applicant-question-template-management",
      title: pageTitles.applicantQuestionTemplateManagement,
    }),
    Object.freeze({ view: "applicantHistory", path: "/applicant-history", title: pageTitles.applicantHistory }),
    Object.freeze({ view: "applicantDocumentManagement", path: "/applicant-documents", title: pageTitles.applicantDocumentManagement }),
    Object.freeze({ view: "applicantMembers", path: "/applicant-members", title: pageTitles.applicantMembers }),

    Object.freeze({ view: "admitCardLookup", path: "/admit-cards", title: pageTitles.admitCardLookup }),
    Object.freeze({ view: "printHistory", path: "/print-history", title: pageTitles.printHistory }),
    Object.freeze({ view: "templateManagement", path: "/templates", title: pageTitles.templateManagement }),
    Object.freeze({ view: "accountManagement", path: "/accounts", title: pageTitles.accountManagement }),
    Object.freeze({ view: "loginNoticeSettings", path: "/login-notice", title: pageTitles.loginNoticeSettings }),
    Object.freeze({ view: "systemSettings", path: "/system-settings", title: pageTitles.systemSettings }),
    Object.freeze({ view: "systemDataDeletion", path: "/system-data-deletion", title: pageTitles.systemDataDeletion }),
    Object.freeze({ view: "systemBackupRestore", path: "/system-backup-restore", title: pageTitles.systemBackupRestore }),
    Object.freeze({ view: superAdminView, path: "/super-admin", title: pageTitles[superAdminView] }),
  ]);
  const availableViews = Object.freeze(viewRouteDefinitions.map((definition) => definition.view));
  const roleMenuViews = Object.freeze({
    [superAdminRole]: Object.freeze([...sidebarMenuViews]),
    관리자: Object.freeze([
      "applicantMembers",
      "applicantRecruitmentManagement",
      "applicantScheduleManagement",
      "applicantQuestionTemplateManagement",

      "applicantHistory",
      "applicantDocumentManagement",

      "admitCardLookup",
      "printHistory",
      "templateManagement",
      "accountManagement",
      "loginNoticeSettings",
      "systemSettings",
    ]),
    운영자: Object.freeze([
      "applicantRecruitmentManagement",
      "applicantScheduleManagement",
      "applicantQuestionTemplateManagement",

      "applicantHistory",
      "applicantDocumentManagement",

      "admitCardLookup",
      "printHistory",
      "templateManagement",
    ]),
    조회용: Object.freeze([
      "admitCardLookup",
      "printHistory",
    ]),
  });
  const roleDefaultViews = Object.freeze({
    [superAdminRole]: defaultView,
    관리자: defaultView,
    운영자: defaultView,
    조회용: "admitCardLookup",
  });
  const viewRouteMap = Object.freeze(
    viewRouteDefinitions.reduce((definitionsByView, definition) => {
      definitionsByView[definition.view] = definition;
      return definitionsByView;
    }, {}),
  );
  const legacyViewPathAliases = Object.freeze({
    "/applicant-form-settings": "applicantRecruitmentManagement",
  });
  const viewByPathMap = Object.freeze(
    viewRouteDefinitions.reduce(
      (viewsByPath, definition) => {
        viewsByPath[definition.path] = definition.view;
        return viewsByPath;
      },
      { ...legacyViewPathAliases },
    ),
  );

  const normalizeRoutePath = (pathname) => {
    const normalizedValue = `/${String(pathname || "/").trim()}`
      .replace(/\/{2,}/g, "/")
      .replace(/\/+$/g, "");

    return normalizedValue || "/";
  };

  const getNormalizedRole = (role = "") =>
    accountRoleOptions.includes(String(role || "").trim()) ? String(role || "").trim() : "관리자";
  const normalizeRoleMenuViewsForRole = (role = "", views = null) => {
    const normalizedRole = getNormalizedRole(role);
    const normalizedViews = [];
    const sourceViews = Array.isArray(views) ? views : roleMenuViews[normalizedRole] || roleMenuViews.관리자 || [];

    sourceViews.forEach((view) => {
      const normalizedView = String(view || "").trim();

      if (!sidebarMenuViewSet.has(normalizedView)) {
        return;
      }

      if ([superAdminView, "systemBackupRestore", "systemDataDeletion"].includes(normalizedView) && normalizedRole !== superAdminRole) {
        return;
      }

      if (!normalizedViews.includes(normalizedView)) {
        normalizedViews.push(normalizedView);
      }
    });

    if (normalizedRole === superAdminRole && !normalizedViews.includes(superAdminView)) {
      normalizedViews.push(superAdminView);
    }

    return Object.freeze(normalizedViews);
  };
  const normalizeRoleMenuVisibilitySettings = (settings = {}) =>
    Object.freeze(
      accountRoleOptions.reduce((normalizedSettings, role) => {
        normalizedSettings[role] = normalizeRoleMenuViewsForRole(role, settings?.[role]);
        return normalizedSettings;
      }, {}),
    );
  const normalizeSuperAdminImageUrl = (value = "") => String(value || "").trim();
  const normalizeSuperAdminSettings = (settings = {}) =>
    Object.freeze({
      schoolName: String(settings?.schoolName || "").trim(),
      logoImageUrl: normalizeSuperAdminImageUrl(settings?.logoImageUrl),
      backgroundImageUrl: normalizeSuperAdminImageUrl(settings?.backgroundImageUrl),
      recruitmentEnabled: settings?.recruitmentEnabled !== false,
    });
  const resolveSuperAdminLogoImageUrl = (settings = {}) =>
    normalizeSuperAdminSettings(settings).logoImageUrl || defaultLoginBrandMarkPath;
  const resolveSuperAdminBackgroundImageUrl = (settings = {}) =>
    normalizeSuperAdminSettings(settings).backgroundImageUrl || defaultLoginBackgroundImagePath;
  const buildDefaultRoleMenuVisibility = () => {
    const nextRoleMenuViews = {
      [superAdminRole]: [...(roleMenuViews[superAdminRole] || [])],
      관리자: [...(roleMenuViews.관리자 || [])],
      운영자: [...(roleMenuViews.운영자 || [])],
      조회용: [...(roleMenuViews.조회용 || [])],
    };

    return normalizeRoleMenuVisibilitySettings(nextRoleMenuViews);
  };
  const getViewRoutePath = (view) => viewRouteMap[String(view || "").trim()]?.path || viewRouteMap[defaultView].path;
  const getViewFromPathname = (pathname) => viewByPathMap[normalizeRoutePath(pathname)] || "";
  const isLoginRoutePath = (pathname) => normalizeRoutePath(pathname) === loginRoutePath;
  const getVisibleMenuViewsForRole = (role = "", options = {}) => {
    const normalizedRole = getNormalizedRole(role);
    const roleMenuVisibility = normalizeRoleMenuVisibilitySettings(options.roleMenuVisibility);
    return Array.from(roleMenuVisibility[normalizedRole] || roleMenuVisibility.관리자 || roleMenuViews.관리자);
  };
  const getAccessibleViewsForRole = (role = "", options = {}) => {
    const normalizedRole = getNormalizedRole(role);
    const accessibleViews = new Set(getVisibleMenuViewsForRole(normalizedRole, options));

    if (normalizedRole !== "조회용") {
      accessibleViews.add(defaultView);
    }

    return Array.from(accessibleViews);
  };
  const getDefaultAccessibleView = (role = "", options = {}) => {
    const normalizedRole = getNormalizedRole(role);
    const accessibleViews = getAccessibleViewsForRole(normalizedRole, options);
    const preferredView = roleDefaultViews[normalizedRole] || defaultView;

    return accessibleViews.includes(preferredView) ? preferredView : accessibleViews[0] || defaultView;
  };
  const isViewAccessibleForRole = (view, role = "", options = {}) =>
    getAccessibleViewsForRole(role, options).includes(String(view || "").trim());
  const createTemplateTagDefinition = ({ label, examineeKey, aliases = [], legacyTokens = [], legacyTags = [] }) => {
    const normalizedAliases = Array.from(new Set([label, ...aliases].filter(Boolean)));

    return Object.freeze({
      label,
      token: `@{${label}}`,
      legacyTag: `@${label}`,
      editorToken: `#${label}`,
      examineeKey,
      aliases: Object.freeze(normalizedAliases),
      editorTokens: Object.freeze(normalizedAliases.map((alias) => `#${alias}`)),
      legacyTokens: Object.freeze(legacyTokens),
      legacyTags: Object.freeze(legacyTags),
    });
  };
  const templateTagDefinitions = Object.freeze([
    createTemplateTagDefinition({ label: "수험번호", examineeKey: "examineeNo" }),
    createTemplateTagDefinition({ label: "이름", examineeKey: "name" }),
    createTemplateTagDefinition({ label: "생년월일", examineeKey: "birth" }),
    createTemplateTagDefinition({
      label: "현재날짜",
      examineeKey: "currentDate",
      aliases: ["날짜"],
      legacyTokens: ["@{날짜}"],
      legacyTags: ["@날짜"],
    }),
    createTemplateTagDefinition({ label: "모집시기", examineeKey: "track" }),
    createTemplateTagDefinition({
      label: "전형",
      examineeKey: "admission",
      aliases: ["시험"],
      legacyTokens: ["@{시험}"],
      legacyTags: ["@시험"],
    }),
    createTemplateTagDefinition({ label: "계열", examineeKey: "series" }),
    createTemplateTagDefinition({ label: "모집단위", examineeKey: "unit" }),
    createTemplateTagDefinition({ label: "전공", examineeKey: "major" }),
    createTemplateTagDefinition({ label: "수험생사진", examineeKey: "examineePhoto" }),
  ].sort((left, right) => String(left?.label || "").localeCompare(String(right?.label || ""), "ko-KR")));

  // Keep saved layouts intact, but never print retired tags or stale assignment values.
  // These definitions are only used for rendering, never offered in the editor.
  const templateRenderTagDefinitions = Object.freeze([
    ...templateTagDefinitions,
    ...["시험날짜", "고사건물", "고사실", "시간", "교시", "조"].map((label) =>
      createTemplateTagDefinition({ label, examineeKey: null }),
    ),
  ]);

  return {
    templateRenderTagDefinitions,
    accountRoleOptions,
    availableViews,
    buildDefaultRoleMenuVisibility,
    defaultLoginBackgroundImagePath,
    defaultView,
    defaultLoginBrandMarkPath,
    getAccessibleViewsForRole,
    getDefaultAccessibleView,
    getNormalizedRole,
    getViewFromPathname,
    getViewRoutePath,
    getVisibleMenuViewsForRole,
    isLoginRoutePath,
    isViewAccessibleForRole,
    loginRoutePath,
    normalizeSuperAdminSettings,
    normalizeRoleMenuVisibilitySettings,
    normalizeRoutePath,
    pageTitles,
    roleDefaultViews,
    roleMenuViews,
    resolveSuperAdminBackgroundImageUrl,
    resolveSuperAdminLogoImageUrl,
    sidebarMenuSections,
    sidebarMenuViewDefinitions,
    superAdminRole,
    superAdminView,
    templateTagDefinitions,
    viewRouteDefinitions,
  };
});
