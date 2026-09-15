require("dotenv").config({ quiet: true });

const http = require("http");
const fs = require("fs");
const path = require("path");
const { getPool, query } = require("./db");
const { createApiRouteDependencies } = require("./server/app/api-route-dependencies");
const { createApplicationServices } = require("./server/app/services");
const { readBinaryBody, readJsonBody } = require("./server/http/body");
const { buildContentDisposition } = require("./server/http/content-disposition");
const { createApiRoutes } = require("./server/http/api-routes");
const { createPageRequestHandlers } = require("./server/http/page-handler");
const { getCorsHeaders, sendBinary, sendJson } = require("./server/http/response");
const { dispatchRoute } = require("./server/http/router");
const {
  getDefaultAccessibleView,
  getViewFromPathname,
  getViewRoutePath,
  isLoginRoutePath,
  isViewAccessibleForRole,
  loginRoutePath: LOGIN_ROUTE_PATH,
  normalizeRoutePath,
} = require("./shared/app-config");

const port = Number(process.env.PORT) || 3000;
const root = __dirname;

const applicationServices = createApplicationServices({
  fs,
  getPool,
  path,
  query,
  rootDir: root,
});
const {
  admitCardService,
  applicantService,
  membershipService,
  authService,
  createHttpError,
  databaseName,
  ticketDataService,
  getAuthenticatedAccountFromRequest,
  getAuthSessionPayload,
  getPublicSuperAdminSettings,
  getRoleMenuVisibilitySettings,
  initializeApplicationData,
  printHistoryService,
  superAdminRole,
  systemService,
  templateService,
  translateDatabaseError,
  verifySystemDataDeletionPassword,
} = applicationServices;

const apiRoutes = createApiRoutes(createApiRouteDependencies({
  admitCardService,
  applicantService,
  membershipService,
  authService,
  buildContentDisposition,
  createHttpError,
  databaseName,
  ticketDataService,
  printHistoryService,
  query,
  readBinaryBody,
  readJsonBody,
  sendBinary,
  sendJson,
  superAdminRole,
  systemService,
  templateService,
  verifySystemDataDeletionPassword,
}));

const { handlePageRequest, serveStaticFile } = createPageRequestHandlers({
  fs,
  path,
  root,
  getRoleMenuVisibilitySettings,
  membershipService,
  getAuthSessionPayload,
  getDefaultAccessibleView,
  getPublicSuperAdminSettings,
  getViewFromPathname,
  getViewRoutePath,
  isLoginRoutePath,
  isViewAccessibleForRole,
  loginRoutePath: LOGIN_ROUTE_PATH,
  normalizeRoutePath,
});

async function handleApiRequest(request, response, requestUrl) {
  const handled = await dispatchRoute(
    apiRoutes,
    { request, response, requestUrl },
    { authenticate: getAuthenticatedAccountFromRequest },
  );

  if (handled) {
    return;
  }

  return sendJson(response, 404, { error: "API 경로를 찾을 수 없습니다." });
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const { pathname } = requestUrl;

  try {
    if (pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") {
        response.writeHead(204, getCorsHeaders());
        response.end();
        return;
      }

      await handleApiRequest(request, response, requestUrl);
      return;
    }

    if (await handlePageRequest(request, response, pathname)) {
      return;
    }

    serveStaticFile(response, pathname, {
      acceptEncoding: request.headers['accept-encoding'],
      assetVersion: requestUrl.searchParams.get('v'),
    });
  } catch (error) {
    const translatedError = translateDatabaseError(error);
    sendJson(response, translatedError.statusCode || 500, {
      error: translatedError.message,
      code: translatedError.errorCode || "",
      ...(translatedError.fieldKey ? { fieldKey: translatedError.fieldKey } : {}),
    });
  }
});

async function initializeServer() {
  try {
    await initializeApplicationData();
  } catch (error) {
    console.error(`Schema check skipped: ${translateDatabaseError(error).message}`);
  }

  return new Promise((resolve, reject) => {
    const handleError = (error) => {
      server.off("error", handleError);
      reject(error);
    };

    server.once("error", handleError);
    server.listen(port, () => {
      server.off("error", handleError);
      console.log(`원서접수시스템 running at http://localhost:${port}`);
      resolve(server);
    });
  });
}

function reportStartupError(error) {
  if (error?.code === "EADDRINUSE") {
    console.error(
      `Server start failed: port ${port} is already in use. Stop the existing process or change PORT in .env.`,
    );
    return;
  }

  console.error(error);
}

if (require.main === module) {
  initializeServer().catch((error) => {
    reportStartupError(error);
    process.exit(1);
  });
}

module.exports = {
  initializeServer,
  reportStartupError,
  server,
};
