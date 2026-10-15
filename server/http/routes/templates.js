const { exactRoute, regexRoute } = require("../router");

function decodeRouteParams(groups = {}) {
  return Object.fromEntries(
    Object.entries(groups).map(([key, value]) => [key, decodeURIComponent(String(value || ""))]),
  );
}

function createTemplateRoutes(deps) {
  return [
    regexRoute('GET', /^\/api\/templates\/(?<templateId>[^/]+)\/editor-context$/,
      async ({ response, params }) => deps.sendJson(response, 200, await deps.getTemplateEditorContext(params.templateId)),
      { getParams: match => decodeRouteParams(match.groups) }),
    regexRoute('POST', /^\/api\/templates\/(?<templateId>[^/]+)\/preview$/,
      async ({ request, response, params }) => { const body = await deps.readJsonBody(request); return deps.sendJson(response, 200, await deps.previewTemplate(params.templateId, body.contentHtml)); },
      { getParams: match => decodeRouteParams(match.groups) }),
    regexRoute(
      "GET",
      /^\/api\/template-objects\/(?<objectType>barcode|qrcode)\.svg$/,
      async ({ response, searchParams, params }) => {
        const objectValue = searchParams.get("value") || "-";
        const svgMarkup = await deps.buildTemplateGeneratedObjectSvg(params.objectType, objectValue);

        return deps.sendBinary(
          response,
          200,
          {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "no-store",
          },
          Buffer.from(svgMarkup, "utf8"),
        );
      },
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
    exactRoute("POST", "/api/templates", async ({ request, response }) => {
      const body = await deps.readJsonBody(request);
      return deps.sendJson(response, 201, await deps.createTemplate(body));
    }),
    regexRoute(
      "POST",
      /^\/api\/templates\/(?<templateId>[^/]+)\/activate$/,
      async ({ response, params }) => deps.sendJson(response, 200, await deps.activateTemplate(params.templateId)),
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
    regexRoute(
      "PUT",
      /^\/api\/templates\/(?<templateId>[^/]+)$/,
      async ({ request, response, params }) => {
        const body = await deps.readJsonBody(request);
        return deps.sendJson(response, 200, await deps.updateTemplate(params.templateId, body));
      },
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
    regexRoute(
      "DELETE",
      /^\/api\/templates\/(?<templateId>[^/]+)$/,
      async ({ response, params }) => deps.sendJson(response, 200, await deps.deleteTemplate(params.templateId)),
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
  ];
}

module.exports = {
  createTemplateRoutes,
};
