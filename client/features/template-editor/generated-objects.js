(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalScope);
    return;
  }

  globalScope.AdmitCardTemplateGeneratedObjects = factory(globalScope);
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  const apiClient = globalScope.AdmitCardApiClient;
  const defaultBuildApiUrl =
    typeof apiClient?.buildApiUrl === "function" ? apiClient.buildApiUrl : (path) => String(path || "");

  const TEMPLATE_GENERATED_OBJECT_CONFIG = Object.freeze({
    barcode: Object.freeze({
      label: "수험번호 바코드",
      altSuffix: "Code128 바코드",
      className: "template-generated-object-barcode",
      width: 240,
      height: 72,
    }),
    qrcode: Object.freeze({
      label: "수험번호 QR코드",
      altSuffix: "QR코드",
      className: "template-generated-object-qrcode",
      width: 112,
      height: 112,
    }),
  });

  function escapeAttribute(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function createTemplateGeneratedObjectController({
    buildApiUrl = defaultBuildApiUrl,
    objectSourceKey = "examineeNo",
    getObjectValue = null,
  } = {}) {
    const resolveObjectValue = (examinee, sourceKey = objectSourceKey) => {
      if (typeof getObjectValue === "function") {
        const customValue = String(getObjectValue(examinee, sourceKey) ?? "").trim();
        return customValue || "-";
      }

      const value = globalScope.ApplyHubTemplateData?.getObjectValue(examinee, sourceKey) || String(examinee?.[sourceKey] ?? "").trim();
      return value || "-";
    };

    function getTemplateGeneratedObjectConfig(objectType) {
      return TEMPLATE_GENERATED_OBJECT_CONFIG[String(objectType || "").trim().toLowerCase()] || null;
    }

    function getTemplateGeneratedObjectValue(examinee, sourceKey = objectSourceKey) {
      return resolveObjectValue(examinee, sourceKey);
    }

    function resolveTemplateGeneratedObjectExaminee(examinee = null, getPreviewExaminee = null) {
      if (examinee && typeof examinee === "object") {
        return examinee;
      }

      if (typeof getPreviewExaminee === "function") {
        return getPreviewExaminee() || {};
      }

      return {};
    }

    function buildTemplateGeneratedObjectPreviewUrl(objectType, examinee, sourceKey = objectSourceKey) {
      const objectConfig = getTemplateGeneratedObjectConfig(objectType);

      if (!objectConfig) {
        return "";
      }

      const value = getTemplateGeneratedObjectValue(examinee, sourceKey);
      const query = new URLSearchParams({ value }).toString();
      return buildApiUrl(`/api/template-objects/${encodeURIComponent(objectType)}.svg?${query}`);
    }

    function decorateTemplateGeneratedObjectImage(imageElement, { examinee = null, getPreviewExaminee = null } = {}) {
      if (!(imageElement instanceof HTMLImageElement)) {
        return false;
      }

      const objectType = String(imageElement.dataset.templateObjectType || "").trim().toLowerCase();
      const objectConfig = getTemplateGeneratedObjectConfig(objectType);

      imageElement.classList.remove(
        "template-generated-object",
        TEMPLATE_GENERATED_OBJECT_CONFIG.barcode.className,
        TEMPLATE_GENERATED_OBJECT_CONFIG.qrcode.className,
      );

      if (!objectConfig) {
        imageElement.removeAttribute("data-template-object-source");
        return false;
      }

      const resolvedExaminee = resolveTemplateGeneratedObjectExaminee(examinee, getPreviewExaminee);
      const sourceKey = imageElement.dataset.templateObjectSource || objectSourceKey;
      const value = getTemplateGeneratedObjectValue(resolvedExaminee, sourceKey);
      const previewUrl = buildTemplateGeneratedObjectPreviewUrl(objectType, resolvedExaminee, sourceKey);

      imageElement.classList.add("template-generated-object", objectConfig.className);
      imageElement.dataset.templateObjectSource = sourceKey;
      imageElement.alt = `${value} ${objectConfig.altSuffix}`;
      imageElement.title = objectConfig.label;

      if (!String(imageElement.style.width || "").trim() && !imageElement.getAttribute("width")) {
        imageElement.style.width = `${objectConfig.width}px`;
      }

      if (!String(imageElement.style.height || "").trim() && !imageElement.getAttribute("height")) {
        imageElement.style.height = `${objectConfig.height}px`;
      }

      if (previewUrl) {
        imageElement.src = previewUrl;
      }

      return true;
    }

    function buildTemplateGeneratedObjectMarkup(objectType, { previewExaminee = null, getPreviewExaminee = null } = {}) {
      const objectConfig = getTemplateGeneratedObjectConfig(objectType);

      if (!objectConfig) {
        return "";
      }

      const resolvedExaminee = resolveTemplateGeneratedObjectExaminee(previewExaminee, getPreviewExaminee);
      const previewUrl = buildTemplateGeneratedObjectPreviewUrl(objectType, resolvedExaminee);
      const objectValue = getTemplateGeneratedObjectValue(resolvedExaminee);

      return `
        <img
          class="template-generated-object ${objectConfig.className}"
          data-template-object-type="${escapeAttribute(objectType)}"
          data-template-object-source="${escapeAttribute(objectSourceKey)}"
          src="${escapeAttribute(previewUrl)}"
          alt="${escapeAttribute(`${objectValue} ${objectConfig.altSuffix}`)}"
          title="${escapeAttribute(objectConfig.label)}"
          style="width: ${objectConfig.width}px; height: ${objectConfig.height}px;"
        />
      `;
    }

    function applyTemplateRenderedObjects(rootElement, examinee = null, { getPreviewExaminee = null } = {}) {
      if (!rootElement?.querySelectorAll) {
        return;
      }

      rootElement.querySelectorAll("img[data-template-object-type]").forEach((imageElement) => {
        decorateTemplateGeneratedObjectImage(imageElement, { examinee, getPreviewExaminee });
      });
    }

    return Object.freeze({
      TEMPLATE_GENERATED_OBJECT_CONFIG,
      applyTemplateRenderedObjects,
      buildTemplateGeneratedObjectMarkup,
      buildTemplateGeneratedObjectPreviewUrl,
      decorateTemplateGeneratedObjectImage,
      getTemplateGeneratedObjectConfig,
      getTemplateGeneratedObjectValue,
    });
  }

  const defaultController = createTemplateGeneratedObjectController();

  return Object.freeze({
    TEMPLATE_GENERATED_OBJECT_CONFIG,
    ...defaultController,
    createTemplateGeneratedObjectController,
  });
});
