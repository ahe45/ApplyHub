import {
  buildGeneratedObjectMarkup as buildGeneratedObjectMarkupFromConfig,
  buildGeneratedObjectPreviewData as buildGeneratedObjectPreviewDataFromDefinitions,
  buildGeneratedObjectSvg as buildGeneratedObjectSvgFromConfig,
  createGeneratedObjectSvgDataUrl as createGeneratedObjectSvgDataUrlFromConfig,
  generatedObjectDefaults,
  getGeneratedObjectSourceLabel as getGeneratedObjectSourceLabelFromDefinitions,
  getGeneratedObjectSourceOptions as getGeneratedObjectSourceOptionsFromDefinitions,
  normalizeGeneratedObjectSourceKey as normalizeGeneratedObjectSourceKeyFromConfig,
  normalizeGeneratedObjectType as normalizeGeneratedObjectTypeFromConfig,
  resolveGeneratedObjectPreviewValue as resolveGeneratedObjectPreviewValueFromRecord,
  resolveGeneratedObjectType as resolveGeneratedObjectTypeFromConfig,
} from "./generated-objects-adapter.js";
import { editorRuntimeGlobals } from "./editor-runtime-loader.js";

let generatedObjectControllerPatched = false;
let tagDefinitionsProvider = () => [];

function getActiveTagDefinitions() {
  const tagDefinitions = tagDefinitionsProvider();

  return Array.isArray(tagDefinitions) ? tagDefinitions : [];
}

function normalizeGeneratedObjectType(value) {
  return normalizeGeneratedObjectTypeFromConfig(value);
}

function resolveGeneratedObjectType(value) {
  return resolveGeneratedObjectTypeFromConfig(value);
}

function normalizeGeneratedObjectSourceKey(value) {
  return normalizeGeneratedObjectSourceKeyFromConfig(value);
}

function getGeneratedObjectSourceOptions(tagDefinitions = getActiveTagDefinitions()) {
  return getGeneratedObjectSourceOptionsFromDefinitions(tagDefinitions);
}

function getGeneratedObjectSourceLabel(sourceKey, tagDefinitions = getActiveTagDefinitions()) {
  return getGeneratedObjectSourceLabelFromDefinitions(sourceKey, tagDefinitions);
}

export function resolveGeneratedObjectPreviewValue(record, sourceKey, tagDefinitions = getActiveTagDefinitions()) {
  return resolveGeneratedObjectPreviewValueFromRecord(record, sourceKey, tagDefinitions);
}

function createGeneratedObjectSvgDataUrl(svgMarkup) {
  return createGeneratedObjectSvgDataUrlFromConfig(svgMarkup);
}

function buildGeneratedObjectSvg(objectType, objectValue, sourceKey) {
  return buildGeneratedObjectSvgFromConfig(objectType, objectValue, normalizeGeneratedObjectSourceKey(sourceKey));
}

export function buildGeneratedObjectMarkup(objectType, objectSourceKey = "candidate.examNo", { previewRecord = null, tagDefinitions = getActiveTagDefinitions() } = {}) {
  return buildGeneratedObjectMarkupFromConfig(objectType, objectSourceKey, {
    previewRecord,
    tagDefinitions,
  });
}

export function buildGeneratedObjectPreviewData(tagDefinitions = getActiveTagDefinitions()) {
  return buildGeneratedObjectPreviewDataFromDefinitions(tagDefinitions);
}

export function patchGeneratedObjectController({ getTagDefinitions = null } = {}) {
  if (typeof getTagDefinitions === "function") {
    tagDefinitionsProvider = getTagDefinitions;
  }

  const generatedObjectsModule = window[editorRuntimeGlobals.generatedObjects];

  if (generatedObjectControllerPatched || !generatedObjectsModule) {
    return;
  }

  const originalModule = generatedObjectsModule;
  const baseConfig = originalModule.TEMPLATE_GENERATED_OBJECT_CONFIG || generatedObjectDefaults;

  function createTemplateGeneratedObjectController({
    getObjectValue = null,
    objectSourceKey = "candidate.examNo",
  } = {}) {
    const defaultSourceKey = normalizeGeneratedObjectSourceKey(objectSourceKey);

    function getTemplateGeneratedObjectConfig(objectType) {
      const resolvedType = resolveGeneratedObjectType(objectType);

      return resolvedType ? baseConfig[resolvedType] || generatedObjectDefaults[resolvedType] : null;
    }

    function getTemplateGeneratedObjectValue(examinee, sourceKey = defaultSourceKey) {
      if (typeof getObjectValue === "function") {
        const customValue = String(getObjectValue(examinee, sourceKey) ?? "").trim();

        if (customValue) {
          return customValue;
        }
      }

      return resolveGeneratedObjectPreviewValue(examinee, sourceKey);
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

    function buildTemplateGeneratedObjectPreviewUrl(objectType, examinee, sourceKey = defaultSourceKey) {
      const objectConfig = getTemplateGeneratedObjectConfig(objectType);

      if (!objectConfig) {
        return "";
      }

      const value = getTemplateGeneratedObjectValue(examinee, sourceKey);
      return createGeneratedObjectSvgDataUrl(buildGeneratedObjectSvg(objectType, value, sourceKey));
    }

    function decorateTemplateGeneratedObjectImage(imageElement, { examinee = null, getPreviewExaminee = null } = {}) {
      if (!(imageElement instanceof HTMLImageElement)) {
        return false;
      }

      const objectType = resolveGeneratedObjectType(imageElement.dataset.templateObjectType);

      imageElement.classList.remove(
        "template-generated-object",
        generatedObjectDefaults.barcode.className,
        generatedObjectDefaults.qrcode.className,
      );

      if (!objectType) {
        return false;
      }

      const objectConfig = getTemplateGeneratedObjectConfig(objectType);

      if (!objectConfig) {
        return false;
      }

      const sourceKey = normalizeGeneratedObjectSourceKey(imageElement.dataset.templateObjectSource || defaultSourceKey);
      const sourceLabel = getGeneratedObjectSourceLabel(sourceKey);
      const resolvedExaminee = resolveTemplateGeneratedObjectExaminee(examinee, getPreviewExaminee);
      const value = getTemplateGeneratedObjectValue(resolvedExaminee, sourceKey);
      const previewUrl = buildTemplateGeneratedObjectPreviewUrl(objectType, resolvedExaminee, sourceKey);

      imageElement.classList.add("template-generated-object", objectConfig.className || generatedObjectDefaults[objectType].className);
      imageElement.dataset.templateObjectSource = sourceKey;
      imageElement.alt = `${sourceLabel} ${objectConfig.altSuffix || generatedObjectDefaults[objectType].altSuffix}`;
      imageElement.title = `${sourceLabel} ${objectConfig.labelSuffix || generatedObjectDefaults[objectType].labelSuffix}`;

      if (!String(imageElement.style.width || "").trim() && !imageElement.getAttribute("width")) {
        imageElement.style.width = `${objectConfig.width || generatedObjectDefaults[objectType].width}px`;
      }

      if (!String(imageElement.style.height || "").trim() && !imageElement.getAttribute("height")) {
        imageElement.style.height = `${objectConfig.height || generatedObjectDefaults[objectType].height}px`;
      }

      if (previewUrl) {
        imageElement.src = previewUrl;
      } else if (value) {
        imageElement.src = createGeneratedObjectSvgDataUrl(buildGeneratedObjectSvg(objectType, value, sourceKey));
      }

      return true;
    }

    function buildTemplateGeneratedObjectMarkup(objectType, {
      getPreviewExaminee = null,
      objectSource = null,
      objectSourceKey: optionSourceKey = null,
      previewExaminee = null,
    } = {}) {
      const resolvedSourceKey = normalizeGeneratedObjectSourceKey(objectSource || optionSourceKey || defaultSourceKey);
      const resolvedExaminee = resolveTemplateGeneratedObjectExaminee(previewExaminee, getPreviewExaminee);

      return buildGeneratedObjectMarkup(objectType, resolvedSourceKey, { previewRecord: resolvedExaminee });
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
      TEMPLATE_GENERATED_OBJECT_CONFIG: baseConfig,
      applyTemplateRenderedObjects,
      buildTemplateGeneratedObjectMarkup,
      buildTemplateGeneratedObjectPreviewUrl,
      decorateTemplateGeneratedObjectImage,
      getTemplateGeneratedObjectConfig,
      getTemplateGeneratedObjectValue,
    });
  }

  const patchedModule = Object.freeze({
    ...originalModule,
    createTemplateGeneratedObjectController,
  });
  const defaultController = createTemplateGeneratedObjectController();

  window[editorRuntimeGlobals.generatedObjects] = Object.freeze({
    ...patchedModule,
    ...defaultController,
    createTemplateGeneratedObjectController,
  });
  generatedObjectControllerPatched = true;
}
