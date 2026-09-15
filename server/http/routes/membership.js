const { exactRoute, regexRoute } = require("../router");
const { createMemberAdminService } = require('../../modules/applications/member-admin');

function createMembershipRoutes(deps) {
  const members = deps.membershipService;
  const applicants = deps.applicantService;
  const memberAdmin = createMemberAdminService({ query: deps.query, getSettings: members.getSettings, createHttpError: deps.createHttpError });
  const publicRoute = (method, path, handler) => exactRoute(method, path, async (ctx) => {
    ctx.response.setHeader("Cache-Control", "no-store");
    if (method !== "GET") {
      const origin = ctx.request.headers.origin;
      if (origin && new URL(origin).host !== ctx.request.headers.host) throw deps.createHttpError(403, "허용되지 않은 요청입니다.");
      if (!String(ctx.request.headers["content-type"] || "").startsWith("application/json")) throw deps.createHttpError(415, "JSON 요청이 필요합니다.");
    }
    return deps.sendJson(ctx.response, 200, await handler(ctx));
  }, { auth: false });
  const body = async (request) => {
    let size = 0;
    const chunks = [];
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 30 * 1024 * 1024) throw deps.createHttpError(413, "첨부 파일을 포함한 요청은 30MB 이하여야 합니다.");
      chunks.push(chunk);
    }
    try {
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid payload");
      return payload;
    }
    catch { throw deps.createHttpError(400, "요청 형식이 올바르지 않습니다."); }
  };
  const context = async (request) => applicants.getMemberApplicationContext(await members.requireMember(request));
  const requireManager = (account) => {
    if (![deps.superAdminRole, "관리자"].includes(account?.role)) throw deps.createHttpError(403, "관리자 권한이 필요합니다.");
  };
  return [
    exactRoute('GET', '/api/applicant-members', async ({ response, requestUrl, authenticatedAccount }) => {
      requireManager(authenticatedAccount);
      response.setHeader('Cache-Control', 'no-store');
      return deps.sendJson(response, 200, await memberAdmin.list(Object.fromEntries(requestUrl.searchParams)));
    }),
    regexRoute('GET', /^\/api\/applicant-members\/(?<memberId>\d+)$/, async ({ response, params, authenticatedAccount }) => {
      requireManager(authenticatedAccount);
      response.setHeader('Cache-Control', 'no-store');
      return deps.sendJson(response, 200, await memberAdmin.detail(params.memberId));
    }),
    regexRoute('GET', /^\/api\/applicant-members\/(?<memberId>\d+)\/files\/(?<fieldKey>[a-zA-Z0-9_-]+)$/, async ({ response, params, authenticatedAccount }) => {
      requireManager(authenticatedAccount);
      const file = await memberAdmin.attachment(params.memberId, params.fieldKey);
      return deps.sendBinary(response, 200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': deps.buildContentDisposition('attachment', file.fileName) }, file.buffer);
    }),
    publicRoute("POST", "/api/public/members/recovery/request", async ({ request }) => members.requestRecovery(await body(request), request.socket.remoteAddress)),
    publicRoute("POST", "/api/public/members/recovery/complete", async ({ request }) => members.completeRecovery(await body(request), request.socket.remoteAddress)),
    publicRoute("GET", "/api/public/members/settings", () => members.publicSettings()),
    publicRoute("GET", "/api/public/members/session", async ({ request }) => ({ member: await members.session(request) })),
    publicRoute("POST", "/api/public/members/email-code", async ({ request }) => members.sendCode(await body(request), request.socket.remoteAddress)),
    publicRoute("POST", "/api/public/members/verify-email", async ({ request }) => members.verifyCode(await body(request), request.socket.remoteAddress)),
    publicRoute("POST", "/api/public/members/register", async ({ request, response }) => {
      const result = await members.register(await body(request), request.socket.remoteAddress, { request, response });
      deps.logoutAccount(request, response);
      return result;
    }),
    publicRoute("POST", "/api/public/members/login", async ({ request, response }) => members.login(await body(request), request, response)),
    publicRoute("POST", "/api/public/members/logout", ({ request, response }) => members.logout(request, response)),
    publicRoute("GET", "/api/public/members/application", ({ request }) => context(request)),
    publicRoute("POST", "/api/public/applications", async ({ request }) => {
      const member = await members.requireMember(request);
      const current = await applicants.getMemberApplicationContext(member);
      if (current.submission?.id) throw deps.createHttpError(409, "이미 접수가 완료된 계정입니다. 접수는 계정당 한 번만 가능합니다.", "APPLICANT_ALREADY_SUBMITTED");
      return applicants.saveApplicantSubmission({ ...await body(request), accessToken: current.accessToken, submissionId: current.submission?.id || 0, password: "" });
    }),
    publicRoute("POST", "/api/public/members/documents", async ({ request }) => applicants.saveMemberDocuments(await members.requireMember(request), await body(request))),
    ...["/api/public/email-verifications", "/api/public/email-verifications/verify", "/api/public/applications/lookup"].map((path) => publicRoute("POST", path, () => { throw deps.createHttpError(401, "회원가입 후 로그인해 주세요."); })),
    regexRoute("GET", /^\/api\/public\/applications\/(?<submissionId>\d+)\/admit-card\.pdf$/, async ({ request, response, params }) => {
      const current = await context(request);
      if (Number(current.submission?.id) !== Number(params.submissionId)) throw deps.createHttpError(403, "본인의 수험표만 조회할 수 있습니다.");
      const pdf = await applicants.buildApplicantAdmitCardPdfForAccessToken(current.accessToken, params.submissionId);
      return deps.sendBinary(response, 200, { "Content-Type": "application/pdf", "Cache-Control": "no-store", "Content-Disposition": deps.buildContentDisposition("inline", `${pdf.fileNameBase}.pdf`) }, pdf.pdfBuffer);
    }, { auth: false }),
    exactRoute("GET", "/api/applicant-signup-settings", async ({ response, authenticatedAccount }) => {
      requireManager(authenticatedAccount);
      return deps.sendJson(response, 200, await members.getSettings());
    }),
    exactRoute("PUT", "/api/applicant-signup-settings", async ({ request, response, authenticatedAccount }) => {
      requireManager(authenticatedAccount);
      return deps.sendJson(response, 200, await members.saveSettings(await body(request)));
    }),
  ];
}
module.exports = { createMembershipRoutes };
