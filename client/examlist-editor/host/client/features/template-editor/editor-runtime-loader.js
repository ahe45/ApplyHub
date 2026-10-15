import { loadFeatureStyles } from "../../app/lazy-feature.js";
export const editorRuntimeBaseUrl = "/client/template-editor-runtime/";

const editorRuntimeLoaderUrl = `${editorRuntimeBaseUrl}loader.js`;
const globalEditorRuntimeStylesheetPaths = Object.freeze([
  "styles/base.css",
  "styles/features/templates.css",
  "styles/features/template-editor.css",
]);

export const editorRuntimeGlobals = Object.freeze({
  generatedObjects: "ExamListTemplateGeneratedObjects",
  loader: "ExamListTemplateEditorRuntimeLoader",
  stylesheetDatasetKey: "examListTemplateEditorRuntime",
  tableUtils: "ExamListEditorTableUtils",
});

let loaderPromise = null;

export function loadEditorRuntimeLoader() {
  const existingLoader = window[editorRuntimeGlobals.loader];

  if (existingLoader) {
    return Promise.resolve(existingLoader);
  }

  if (loaderPromise) {
    return loaderPromise;
  }

  if (window.ExamListAssets?.runtimeScript) {
    loaderPromise = Promise.all([
      loadFeatureStyles(window.ExamListAssets.runtimeStyles),
      new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = window.ExamListAssets.runtimeScript;
        script.onload = resolve;
        script.onerror = () => { script.remove(); reject(new Error("양식 편집기를 불러오지 못했습니다.")); };
        document.head.append(script);
      }),
    ]).then(() => {
      const runtime = window.ExamListTemplateEditorRuntime;
      if (!runtime) throw new Error("양식 편집기가 초기화되지 않았습니다.");
      const loader = { load: () => Promise.resolve(runtime), createTemplateEditor: options => runtime.createTemplateEditor(options) };
      window[editorRuntimeGlobals.loader] = loader;
      return loader;
    }).catch(error => { loaderPromise = null; throw error; });
    return loaderPromise;
  }

  loaderPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${editorRuntimeLoaderUrl}"]`);

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window[editorRuntimeGlobals.loader]), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("양식 편집기 런타임을 불러오지 못했습니다.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = editorRuntimeLoaderUrl;
    script.async = false;
    script.dataset.examlistTemplateEditorRuntimeLoader = "true";
    script.addEventListener("load", () => {
      const loadedEditorRuntimeLoader = window[editorRuntimeGlobals.loader];

      if (!loadedEditorRuntimeLoader) {
        reject(new Error("양식 편집기 런타임 로더가 초기화되지 않았습니다."));
        return;
      }

      resolve(loadedEditorRuntimeLoader);
    });
    script.addEventListener("error", () => reject(new Error("양식 편집기 런타임을 불러오지 못했습니다.")));
    document.head.append(script);
  });

  return loaderPromise;
}

export function removeGlobalEditorRuntimeStylesheets() {
  const globalStyleUrls = new Set(globalEditorRuntimeStylesheetPaths.map((assetPath) => new URL(assetPath, window.location.origin + editorRuntimeBaseUrl).href));

  document.querySelectorAll('link[rel="stylesheet"]').forEach((linkElement) => {
    if (linkElement.dataset?.[editorRuntimeGlobals.stylesheetDatasetKey] === "true" && globalStyleUrls.has(linkElement.href)) {
      linkElement.remove();
    }
  });
}

export function exposeEditorRuntimeAliases() {
  if (window[editorRuntimeGlobals.tableUtils]) {
    window.ExamListEditorTableUtils = window[editorRuntimeGlobals.tableUtils];
  }
}
