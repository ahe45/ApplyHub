const {sendDataExport} = require('../../modules/applications/data-export');
const { exactRoute, regexRoute } = require("../router");
const { isViewAccessibleForRole } = require("../../../shared/app-config");

function decodeRouteParams(groups = {}) {
  return Object.fromEntries(
    Object.entries(groups).map(([key, value]) => [key, decodeURIComponent(String(value || ""))]),
  );
}

function createApplicantRoutes(deps) {
  async function requireArchiveAccess(account) {
    if (!account?.id) throw deps.createHttpError(401, "로그인이 필요합니다.");
    const roleMenuVisibility = await deps.getRoleMenuVisibilitySettings?.();
    if (!isViewAccessibleForRole("applicantHistory", account.role, { roleMenuVisibility })) throw deps.createHttpError(403, "접수 이력 다운로드 권한이 없습니다.");
  }
  async function requireDocumentAccess(account) {
    const roleMenuVisibility = await deps.getRoleMenuVisibilitySettings?.();
    if (!account?.id || !isViewAccessibleForRole('applicantDocumentManagement', account.role, { roleMenuVisibility })) {
      throw deps.createHttpError(403, '서류 제출 관리 권한이 없습니다.');
    }
  }
  async function requireFormTemplateAccess(account) {
    if (!account) throw deps.createHttpError(401, '로그인이 필요합니다.');
    const permissions = await deps.getRoleMenuVisibilitySettings();
    if (!isViewAccessibleForRole('applicantQuestionTemplateManagement', account.role, { roleMenuVisibility: permissions })) {
      throw deps.createHttpError(403, '가입 접수 설정 권한이 없습니다.');
    }
  }

  async function requireListAccess(account, kind = '') {
    const roles = await deps.getRoleMenuVisibilitySettings();
    const view = kind === 'print' ? 'printHistory' : kind === 'ticket' ? 'admitCardLookup' : kind === 'dashboard' ? 'dashboard' : 'applicantHistory';
    if (!account || !isViewAccessibleForRole(view,account.role,{roleMenuVisibility:roles})) throw deps.createHttpError(403,'조회 권한이 없습니다.');
  }
  return [
    exactRoute('POST','/api/applicant-submissions/list',async ({request,response,authenticatedAccount}) => {
      const body = await deps.readJsonBody(request);
      await requireListAccess(authenticatedAccount, body.kind);
      const queries = deps.applicantService.submissionQuery;
      if (body.kind === 'dashboard') return deps.sendJson(response,200,await queries.dashboard(body));
      if (body.optionsKey) return deps.sendJson(response,200,{values:await queries.options(body,body.optionsKey)});
      const result = await queries.list(body);
      result.references = await queries.references(body);
      return deps.sendJson(response,200,result);
    }),
    regexRoute('GET',/^\/api\/applicant-submissions\/(?<submissionId>\d+)$/,async ({response,params,authenticatedAccount}) => {
      await requireListAccess(authenticatedAccount);
      return deps.sendJson(response,200,await deps.applicantService.getApplicantSubmissionById(params.submissionId));
    }),
    exactRoute('GET', '/api/applicant-document-status', async ({ response, requestUrl, authenticatedAccount }) => {
      await requireDocumentAccess(authenticatedAccount);
      return deps.sendJson(response, 200, await deps.applicantService.documentStatusService.list(Object.fromEntries(requestUrl.searchParams)), { 'Cache-Control': 'no-store' });
    }),
    regexRoute('GET', /^\/api\/applicant-document-status\/(?<submissionId>\d+)$/, async ({ response, params, authenticatedAccount }) => {
      await requireDocumentAccess(authenticatedAccount);
      return deps.sendJson(response, 200, await deps.applicantService.documentStatusService.detail(params.submissionId), { 'Cache-Control': 'no-store' });
    }),
    regexRoute('PUT', /^\/api\/applicant-document-status\/(?<submissionId>\d+)$/, async ({ request, response, params, authenticatedAccount }) => {
      await requireDocumentAccess(authenticatedAccount);
      const body = await deps.readJsonBody(request);
      return deps.sendJson(response, 200, await deps.applicantService.documentStatusService.save(params.submissionId, body, authenticatedAccount.id), { 'Cache-Control': 'no-store' });
    }),
    exactRoute("POST", "/api/applicant-submissions/archive-jobs", async ({ request, response, authenticatedAccount }) => {
      await requireArchiveAccess(authenticatedAccount);
      const body = await deps.readJsonBody(request);
      const job = await deps.applicantService.attachmentArchiveJobs.create(body, authenticatedAccount?.id);
      return deps.sendJson(response, 202, job, { "Cache-Control": "no-store" });
    }),
    regexRoute("GET", /^\/api\/applicant-submissions\/archive-jobs\/(?<jobId>[a-f0-9-]+)$/, async ({ response, params, authenticatedAccount }) => {
      await requireArchiveAccess(authenticatedAccount);
      return deps.sendJson(response, 200, deps.applicantService.attachmentArchiveJobs.status(params.jobId, authenticatedAccount?.id), { "Cache-Control": "no-store" });
    }),
    regexRoute("GET", /^\/api\/applicant-submissions\/archive-jobs\/(?<jobId>[a-f0-9-]+)\/download$/, async ({ response, params, authenticatedAccount }) => {
      await requireArchiveAccess(authenticatedAccount);
      return deps.applicantService.attachmentArchiveJobs.download(params.jobId, authenticatedAccount?.id, response, deps.buildContentDisposition);
    }),
    exactRoute("GET", "/api/public/applicant-form", async ({ response }) => {
      const [applicantForm, superAdminSettings] = await Promise.all([
        deps.getApplicantPublicForm(),
        typeof deps.getPublicSuperAdminSettings === "function" ? deps.getPublicSuperAdminSettings() : {},
      ]);

      return deps.sendJson(response, 200, {
        ...applicantForm,
        superAdminSettings,
      });
    }, { auth: false }),
    exactRoute("POST", "/api/public/email-verifications", async ({ request, response }) => {
      const body = await deps.readJsonBody(request);
      return deps.sendJson(response, 200, await deps.sendApplicantVerificationCode(body));
    }, { auth: false }),
    exactRoute("POST", "/api/public/email-verifications/verify", async ({ request, response }) => {
      const body = await deps.readJsonBody(request);
      return deps.sendJson(response, 200, await deps.verifyApplicantVerificationCode(body));
    }, { auth: false }),
    exactRoute("POST", "/api/public/applications/lookup", async ({ request, response }) => {
      const body = await deps.readJsonBody(request);
      return deps.sendJson(response, 200, await deps.lookupApplicantSubmission(body));
    }, { auth: false }),
    exactRoute("POST", "/api/public/applications", async ({ request, response }) => {
      const body = await deps.readJsonBody(request);
      return deps.sendJson(response, 200, await deps.saveApplicantSubmission(body));
    }, { auth: false }),
    exactRoute("GET", "/api/applicant-recruitment-units/template.xlsx", async ({ response }) => {
      const workbookBuffer = await deps.buildApplicantRecruitmentUnitTemplateBuffer();

      return deps.sendBinary(
        response,
        200,
        {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": deps.buildContentDisposition("attachment", "전형 관리 업로드 양식.xlsx"),
        },
        workbookBuffer,
      );
    }),
    exactRoute("POST", "/api/applicant-recruitment-units/export.xlsx", async ({ request, response }) => {
      const body = await deps.readJsonBody(request);
      const workbookBuffer = await deps.buildApplicantRecruitmentUnitExportBuffer(Array.isArray(body?.rows) ? body.rows : []);

      return deps.sendBinary(
        response,
        200,
        {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": deps.buildContentDisposition("attachment", "전형 관리 데이터.xlsx"),
          "Cache-Control": "no-store",
        },
        workbookBuffer,
      );
    }),

    exactRoute("POST", "/api/applicant-submissions/export.xlsx", async ({ request, response, authenticatedAccount }) => {
      await requireArchiveAccess(authenticatedAccount);
      const body = await deps.readJsonBody(request);
      return sendDataExport({service:deps.applicantService,query:deps.query,body,response,buildContentDisposition:deps.buildContentDisposition,kind:'applications'});
    }),

    exactRoute("POST", "/api/applicant-submissions/photos.zip", async ({ request, response, authenticatedAccount }) => {
      await requireArchiveAccess(authenticatedAccount);
      const body = await deps.readJsonBody(request);
      return sendDataExport({service:deps.applicantService,query:deps.query,body,response,buildContentDisposition:deps.buildContentDisposition,kind:'photos'});
    }),

    regexRoute(
      "DELETE",
      /^\/api\/applicant-submissions\/(?<submissionId>\d+)$/,
      async ({ response, params }) => deps.sendJson(response, 200, await deps.deleteApplicantSubmission(params.submissionId)),
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
    regexRoute(
      "GET",
      /^\/api\/applicant-submissions\/(?<submissionId>\d+)\/photo$/,
      async ({ response, params }) => {
        const applicantSubmissionPhoto = await deps.getApplicantSubmissionPhoto(params.submissionId);

        return deps.sendBinary(
          response,
          200,
          {
            "Content-Type": applicantSubmissionPhoto.photoMime || "application/octet-stream",
            "Content-Disposition": deps.buildContentDisposition(
              "inline",
              applicantSubmissionPhoto.photoName || `applicant-submission-${params.submissionId}.jpg`,
            ),
            "Cache-Control": "no-store",
          },
          applicantSubmissionPhoto.photoBlob,
        );
      },
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
    regexRoute(
      "GET",
      /^\/api\/applicant-submissions\/(?<submissionId>\d+)\/files\/(?<fieldKey>[^/]+)$/,
      async ({ response, params }) => {
        const applicantSubmissionFile = await deps.getApplicantSubmissionFile(params.submissionId, params.fieldKey);

        return deps.sendBinary(
          response,
          200,
          {
            "Content-Type": applicantSubmissionFile.fileMime || "application/octet-stream",
            "Content-Disposition": deps.buildContentDisposition(
              "attachment",
              applicantSubmissionFile.fileName || `applicant-submission-${params.submissionId}`,
            ),
            "Cache-Control": "no-store",
          },
          applicantSubmissionFile.fileBlob,
        );
      },
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
    exactRoute("POST", "/api/applicant-recruitment-units/import", async ({ request, response }) => {
      const body = await deps.readJsonBody(request);
      return deps.sendJson(response, 200, await deps.importApplicantRecruitmentUnits(body));
    }),
    exactRoute("POST", "/api/applicant-recruitment-units/import/preview", async ({ request, response }) => {
      const body = await deps.readJsonBody(request);
      return deps.sendJson(response, 200, await deps.previewApplicantRecruitmentUnitImport(body));
    }),

    regexRoute(
      "GET",
      /^\/api\/public\/applications\/(?<submissionId>\d+)\/admit-card\.pdf$/,
      async ({ response, params, searchParams }) => {
        const admitCardPdf = await deps.buildApplicantAdmitCardPdfForAccessToken(
          searchParams.get("token"),
          params.submissionId,
        );

        return deps.sendBinary(
          response,
          200,
          {
            "Content-Type": "application/pdf",
            "Content-Disposition": deps.buildContentDisposition(
              searchParams.get("download") === "1" ? "attachment" : "inline",
              `${admitCardPdf.fileNameBase || params.submissionId}.pdf`,
            ),
            "Cache-Control": "no-store",
          },
          admitCardPdf.pdfBuffer,
        );
      },
      { auth: false, getParams: (match) => decodeRouteParams(match.groups) },
    ),
    exactRoute("GET", "/api/applicant-form-templates", async ({ response, authenticatedAccount }) => {
      await requireFormTemplateAccess(authenticatedAccount);
      return deps.sendJson(response, 200, await deps.applicantService.getApplicantFormTemplates()); }),
    exactRoute("POST", "/api/applicant-form-templates", async ({ request, response, authenticatedAccount }) => {
      await requireFormTemplateAccess(authenticatedAccount);
      return deps.sendJson(response, 201, await deps.applicantService.saveApplicantFormTemplate(await deps.readJsonBody(request))); }),
    regexRoute("PUT", /^\/api\/applicant-form-templates\/(?<templateId>\d+)$/, async ({ request, response, params, authenticatedAccount }) => {
      await requireFormTemplateAccess(authenticatedAccount);
      return deps.sendJson(response, 200, await deps.applicantService.saveApplicantFormTemplate(await deps.readJsonBody(request), params.templateId)); },
      { getParams: match => decodeRouteParams(match.groups) }),
    regexRoute("DELETE", /^\/api\/applicant-form-templates\/(?<templateId>\d+)$/, async ({ response, params, authenticatedAccount }) => {
      await requireFormTemplateAccess(authenticatedAccount);
      return deps.sendJson(response, 200, await deps.applicantService.deleteApplicantFormTemplate(params.templateId)); },
      { getParams: match => decodeRouteParams(match.groups) }),
    exactRoute("POST", "/api/applicant-form-fields", async ({ request, response }) => {
      const body = await deps.readJsonBody(request);
      return deps.sendJson(response, 201, await deps.createApplicantFormField(body));
    }),
    regexRoute(
      "PUT",
      /^\/api\/applicant-form-fields\/(?<fieldId>\d+)$/,
      async ({ request, response, params }) => {
        const body = await deps.readJsonBody(request);
        return deps.sendJson(response, 200, await deps.updateApplicantFormField(params.fieldId, body));
      },
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
    regexRoute(
      "DELETE",
      /^\/api\/applicant-form-fields\/(?<fieldId>\d+)$/,
      async ({ response, params }) => deps.sendJson(response, 200, await deps.deleteApplicantFormField(params.fieldId)),
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
    regexRoute(
      "POST",
      /^\/api\/applicant-form-fields\/(?<fieldId>\d+)\/move$/,
      async ({ request, response, params }) => {
        const body = await deps.readJsonBody(request);
        return deps.sendJson(response, 200, await deps.moveApplicantFormField(params.fieldId, body || {}));
      },
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
    exactRoute("POST", "/api/applicant-recruitment-units", async ({ request, response }) => {
      const body = await deps.readJsonBody(request);
      return deps.sendJson(response, 201, await deps.createApplicantRecruitmentUnit(body));
    }),
    exactRoute("PUT", "/api/applicant-schedules", async ({ request, response }) => {
      const body = await deps.readJsonBody(request);
      return deps.sendJson(response, 200, await deps.saveApplicantSchedule(body));
    }),
    exactRoute("PUT", "/api/applicant-schedules/bulk", async ({ request, response }) => {
      const body = await deps.readJsonBody(request);
      return deps.sendJson(response, 200, await deps.saveApplicantSchedules(body));
    }),

    regexRoute(
      "PUT",
      /^\/api\/applicant-recruitment-units\/(?<unitId>\d+)$/,
      async ({ request, response, params }) => {
        const body = await deps.readJsonBody(request);
        return deps.sendJson(response, 200, await deps.updateApplicantRecruitmentUnit(params.unitId, body));
      },
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
    regexRoute(
      "DELETE",
      /^\/api\/applicant-recruitment-units\/(?<unitId>\d+)$/,
      async ({ response, params }) => deps.sendJson(response, 200, await deps.deleteApplicantRecruitmentUnit(params.unitId)),
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
    exactRoute("PUT", "/api/applicant-settings", async ({ request, response }) => {
      const body = await deps.readJsonBody(request);
      return deps.sendJson(response, 200, await deps.updateApplicantSettings(body));
    }),
    regexRoute(
      "PUT",
      /^\/api\/applicant-submissions\/(?<submissionId>\d+)\/photo$/,
      async ({ request, response, params }) => {
        const body = await deps.readJsonBody(request);
        return deps.sendJson(response, 200, await deps.updateApplicantSubmissionPhoto(params.submissionId, body));
      },
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
  ];
}

module.exports = {
  createApplicantRoutes,
};
