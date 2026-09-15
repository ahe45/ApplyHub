const { createAccountRoutes } = require("./routes/accounts");
const { createMembershipRoutes } = require("./routes/membership");
const { createApplicantRoutes } = require("./routes/applications");
const { createAuthRoutes } = require("./routes/auth");
const { createAdmitCardRoutes } = require("./routes/admit-cards");
const { createPrintHistoryRoutes } = require("./routes/print-history");
const { createSystemRoutes } = require("./routes/system");
const { createTemplateRoutes } = require("./routes/templates");

function createApiRoutes(deps) {
  return Object.freeze([
    ...createMembershipRoutes(deps),
    ...createAuthRoutes(deps),
    ...createApplicantRoutes(deps),
    ...createAdmitCardRoutes(deps),
    ...createPrintHistoryRoutes(deps),
    ...createSystemRoutes(deps),
    ...createTemplateRoutes(deps),
    ...createAccountRoutes(deps),
  ]);
}

module.exports = {
  createApiRoutes,
};
