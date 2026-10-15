(function (globalScope) {
  const state = {
    manifestPromise: null,
    loadPromise: null,
  };
  const loaderScriptUrl =
    typeof document !== "undefined" && document.currentScript && document.currentScript.src
      ? document.currentScript.src
      : "";

  function getBaseUrl(explicitBaseUrl) {
    if (explicitBaseUrl) {
      return new URL(String(explicitBaseUrl), window.location.href).href;
    }

    if (loaderScriptUrl) {
      return new URL("./", loaderScriptUrl).href;
    }

    const scriptElement = Array.from(document.scripts).find((script) =>
      /(?:^|\/)loader\.js(?:[?#]|$)/.test(script.getAttribute("src") || script.src || ""),
    );

    if (scriptElement && scriptElement.src) {
      return new URL("./", scriptElement.src).href;
    }

    return new URL("./", window.location.href).href;
  }

  function getAssetUrl(baseUrl, assetPath) {
    return new URL(String(assetPath || "").replace(/^\/+/, ""), baseUrl).href;
  }

  function hasStylesheet(url) {
    return Array.from(document.querySelectorAll("link[rel='stylesheet']")).some((link) => link.href === url);
  }

  function hasScript(url) {
    return Array.from(document.scripts).some((script) => script.src === url);
  }

  function loadStylesheet(url) {
    if (hasStylesheet(url)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.dataset.examListTemplateEditorRuntime = "true";
      link.onload = resolve;
      link.onerror = () => reject(new Error("Failed to load stylesheet: " + url));
      document.head.appendChild(link);
    });
  }

  function loadScript(url) {
    if (hasScript(url)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = false;
      script.dataset.examListTemplateEditorRuntime = "true";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Failed to load script: " + url));
      document.head.appendChild(script);
    });
  }

  function loadOptionalScript(url) {
    return loadScript(url).catch((error) => {
      if (globalScope.console && typeof globalScope.console.warn === "function") {
        globalScope.console.warn(error.message);
      }
    });
  }

  function loadManifest(baseUrl) {
    if (globalScope.ExamListTemplateEditorRuntimeManifest) {
      return Promise.resolve(globalScope.ExamListTemplateEditorRuntimeManifest);
    }

    if (!state.manifestPromise) {
      state.manifestPromise = loadScript(getAssetUrl(baseUrl, "client/template-editor-runtime/manifest.js")).then(() => {
        if (!globalScope.ExamListTemplateEditorRuntimeManifest) {
          throw new Error("ExamListTemplateEditorRuntimeManifest was not registered.");
        }

        return globalScope.ExamListTemplateEditorRuntimeManifest;
      });
    }

    return state.manifestPromise;
  }

  async function load(options) {
    const baseUrl = getBaseUrl(options && options.baseUrl);
    const includePreset = !options || options.includePreset !== false;

    if (!state.loadPromise) {
      state.loadPromise = (async () => {
        const manifest = await loadManifest(baseUrl);
        await Promise.all((manifest.css || []).map((assetPath) => loadStylesheet(getAssetUrl(baseUrl, assetPath))));

        if (includePreset) {
          for (const assetPath of manifest.optionalPresetScripts || []) {
            await loadOptionalScript(getAssetUrl(baseUrl, assetPath));
          }
        }

        for (const assetPath of manifest.requiredScripts || []) {
          await loadScript(getAssetUrl(baseUrl, assetPath));
        }

        if (!globalScope.ExamListTemplateEditorRuntime) {
          throw new Error("ExamListTemplateEditorRuntime was not registered.");
        }

        return globalScope.ExamListTemplateEditorRuntime;
      })();
    }

    return state.loadPromise;
  }

  async function createTemplateEditor(options) {
    const runtime = await load(options || {});
    return runtime.createTemplateEditor(options || {});
  }

  globalScope.ExamListTemplateEditorRuntimeLoader = Object.freeze({
    createTemplateEditor,
    load,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
