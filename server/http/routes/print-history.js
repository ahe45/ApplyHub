const {sendDataExport} = require('../../modules/applications/data-export');
const {isViewAccessibleForRole} = require('../../../shared/app-config');
const { exactRoute } = require("../router");

function createPrintHistoryRoutes(deps) {
  return [
    exactRoute("POST", "/api/print-history/export.xlsx", async ({ request, response, authenticatedAccount }) => {
      const roles=await deps.getRoleMenuVisibilitySettings();
      if(!authenticatedAccount || !isViewAccessibleForRole('printHistory',authenticatedAccount.role,{roleMenuVisibility:roles})) throw deps.createHttpError(403,'출력 이력 다운로드 권한이 없습니다.');
      const body = await deps.readJsonBody(request);
      if(body.filters) return sendDataExport({service:deps.applicantService,query:deps.query,body,response,buildContentDisposition:deps.buildContentDisposition,kind:'print'});
      const workbookBuffer = await deps.buildPrintHistoryExportBuffer(
        Array.isArray(body?.rows) ? body.rows : [],
        Array.isArray(body?.summaryExaminees) ? body.summaryExaminees : [],
      );

      return deps.sendBinary(
        response,
        200,
        {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": deps.buildContentDisposition("attachment", "수험표 출력 이력.xlsx"),
          "Cache-Control": "no-store",
        },
        workbookBuffer,
      );
    }),
    exactRoute("POST", "/api/print-history", async ({ request, response }) => {
      const body = await deps.readJsonBody(request);
      return deps.sendJson(response, 201, await deps.recordPrintHistory(body));
    }),
  ];
}

module.exports = {
  createPrintHistoryRoutes,
};
