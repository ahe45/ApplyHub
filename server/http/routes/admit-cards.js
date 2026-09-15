const { exactRoute, regexRoute } = require("../router");

function decodeRouteParams(groups = {}) {
  return Object.fromEntries(
    Object.entries(groups).map(([key, value]) => [key, decodeURIComponent(String(value || ""))]),
  );
}

function createAdmitCardRoutes(deps) {
  return [

    exactRoute("POST", "/api/admit-cards/jobs", async ({ request, response, authenticatedAccount }) => {
      const body = await deps.readJsonBody(request);
      const examineeNos = deps.normalizeExamineeNoList(Array.isArray(body?.examineeNos) ? body.examineeNos : body?.examineeNo);

      return deps.sendJson(response, 202, deps.createBatchAdmitCardJob(authenticatedAccount.id, examineeNos, body?.outputMode), {
        "Cache-Control": "no-store",
      });
    }),
    regexRoute(
      "DELETE",
      /^\/api\/admit-cards\/jobs\/(?<jobId>[^/]+)$/,
      async ({ response, params, authenticatedAccount }) => {
        return deps.sendJson(response, 202, deps.cancelBatchAdmitCardJob(params.jobId, authenticatedAccount.id), {
          "Cache-Control": "no-store",
        });
      },
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
    regexRoute(
      "GET",
      /^\/api\/admit-cards\/jobs\/(?<jobId>[^/]+)$/,
      async ({ response, params, authenticatedAccount }) => {
        const job = deps.getBatchAdmitCardJobOrThrow(params.jobId, authenticatedAccount.id);

        return deps.sendJson(response, 200, deps.buildBatchAdmitCardJobPayload(job), {
          "Cache-Control": "no-store",
        });
      },
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
    regexRoute(
      "GET",
      /^\/api\/admit-cards\/jobs\/(?<jobId>[^/]+)\/file$/,
      async ({ response, params, authenticatedAccount }) => {
        const job = deps.getBatchAdmitCardJobOrThrow(params.jobId, authenticatedAccount.id);

        if (job.status === "failed") {
          throw deps.createHttpError(409, job.error || "수험표 파일을 생성할 수 없습니다.", job.errorCode || "BATCH_JOB_FAILED");
        }

        if (job.status === "cancelled") {
          throw deps.createHttpError(409, job.error || "수험표 파일 생성을 취소했습니다.", job.errorCode || "BATCH_JOB_CANCELLED");
        }

        if (job.status !== "completed" || !job.fileBuffer) {
          throw deps.createHttpError(409, "수험표 파일 생성이 아직 완료되지 않았습니다.", "BATCH_JOB_NOT_READY");
        }

        return deps.sendBinary(
          response,
          200,
          {
            "Content-Type": job.fileContentType || "application/octet-stream",
            "Content-Disposition": deps.buildContentDisposition("attachment", job.fileName || "admit-cards.pdf"),
            "Cache-Control": "no-store",
          },
          job.fileBuffer,
        );
      },
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
    regexRoute(
      "GET",
      /^\/api\/admit-cards\/jobs\/(?<jobId>[^/]+)\/pdf$/,
      async ({ response, params, authenticatedAccount }) => {
        const job = deps.getBatchAdmitCardJobOrThrow(params.jobId, authenticatedAccount.id);

        if (job.status === "failed") {
          throw deps.createHttpError(409, job.error || "수험표 PDF를 생성할 수 없습니다.", job.errorCode || "BATCH_JOB_FAILED");
        }

        if (job.status === "cancelled") {
          throw deps.createHttpError(409, job.error || "수험표 PDF 생성을 취소했습니다.", job.errorCode || "BATCH_JOB_CANCELLED");
        }

        if (job.outputMode !== "combined-pdf") {
          throw deps.createHttpError(409, "통합 PDF 출력 작업이 아닙니다.", "BATCH_JOB_INVALID_OUTPUT_MODE");
        }

        if (job.status !== "completed" || !job.fileBuffer) {
          throw deps.createHttpError(409, "수험표 PDF 생성이 아직 완료되지 않았습니다.", "BATCH_JOB_NOT_READY");
        }

        return deps.sendBinary(
          response,
          200,
          {
            "Content-Type": "application/pdf",
            "Content-Disposition": deps.buildContentDisposition("inline", job.fileName || "admit-cards.pdf"),
            "Cache-Control": "no-store",
          },
          job.fileBuffer,
        );
      },
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
    regexRoute(
      "GET",
      /^\/api\/admit-cards\/(?<examineeNo>[^/]+)\/pdf$/,
      async ({ response, params }) => {
        const pdfBuffer = await deps.buildAdmitCardPdfBuffer(params.examineeNo);

        return deps.sendBinary(
          response,
          200,
          {
            "Content-Type": "application/pdf",
            "Content-Disposition": deps.buildContentDisposition("inline", `${params.examineeNo}.pdf`),
            "Cache-Control": "no-store",
          },
          pdfBuffer,
        );
      },
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
    exactRoute("POST", "/api/admit-cards/batch.pdf", async ({ request, response }) => {
      const body = await deps.readJsonBody(request);
      const examineeNos = deps.normalizeExamineeNoList(Array.isArray(body?.examineeNos) ? body.examineeNos : body?.examineeNo);
      const pdfBuffer = await deps.buildBatchAdmitCardPdfBuffer(examineeNos);

      return deps.sendBinary(
        response,
        200,
        {
          "Content-Type": "application/pdf",
          "Content-Disposition": deps.buildContentDisposition("inline", `admit-cards-${examineeNos.length}.pdf`),
          "Cache-Control": "no-store",
        },
        pdfBuffer,
      );
    }),

  ];
}

module.exports = {
  createAdmitCardRoutes,
};
