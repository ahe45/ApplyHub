#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const sourceRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(sourceRoot, "client", "template-editor-kit", "manifest.js");
const manifest = require(manifestPath);
const defaultTarget = path.resolve(process.cwd(), "public", "admit-card-template-editor");
const markerFileName = ".admit-card-template-editor-kit.json";

function printHelp() {
  console.log(`
Usage:
  node path/to/AdmitCard/scripts/install-template-editor-kit.js [options]

Options:
  --target <dir>  Destination directory. Default: ./public/admit-card-template-editor
  --clean         Remove the existing destination first. Only works for a kit-owned directory.
  --help          Show this help.
`);
}

function parseArgs(argv) {
  const options = {
    clean: false,
    target: defaultTarget,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--help" || value === "-h") {
      options.help = true;
      continue;
    }

    if (value === "--clean") {
      options.clean = true;
      continue;
    }

    if (value === "--target" || value === "--out" || value === "--dir") {
      const nextValue = argv[index + 1];

      if (!nextValue) {
        throw new Error(`${value} requires a directory path.`);
      }

      options.target = path.resolve(process.cwd(), nextValue);
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${value}`);
  }

  return options;
}

function toPosixPath(filePath) {
  return String(filePath || "").replace(/\\/g, "/");
}

function ensureSafeTarget(targetRoot) {
  const resolvedTarget = path.resolve(targetRoot);
  const currentRoot = path.parse(resolvedTarget).root;

  if (resolvedTarget === currentRoot) {
    throw new Error("Refusing to install into a filesystem root.");
  }

  if (resolvedTarget === process.cwd()) {
    throw new Error("Refusing to install directly into the current project root. Use --target.");
  }

  return resolvedTarget;
}

function resetTargetIfRequested(targetRoot, clean) {
  if (!clean || !fs.existsSync(targetRoot)) {
    return;
  }

  const markerPath = path.join(targetRoot, markerFileName);
  const existingEntries = fs.readdirSync(targetRoot);

  if (!fs.existsSync(markerPath) && existingEntries.length > 0) {
    throw new Error(
      `Refusing to clean non-kit directory: ${targetRoot}. Delete it manually or choose another --target.`,
    );
  }

  fs.rmSync(targetRoot, { recursive: true, force: true });
}

function copyFileRelative(relativePath, targetRoot) {
  const normalizedRelativePath = toPosixPath(relativePath);
  const sourcePath = path.join(sourceRoot, normalizedRelativePath);
  const targetPath = path.join(targetRoot, normalizedRelativePath);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Required template editor kit file is missing: ${normalizedRelativePath}`);
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  return normalizedRelativePath;
}

function buildLoaderSource() {
  return `(function (globalScope) {
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
      /(?:^|\\/)loader\\.js(?:[?#]|$)/.test(script.getAttribute("src") || script.src || ""),
    );

    if (scriptElement && scriptElement.src) {
      return new URL("./", scriptElement.src).href;
    }

    return new URL("./", window.location.href).href;
  }

  function getAssetUrl(baseUrl, assetPath) {
    return new URL(String(assetPath || "").replace(/^\\/+/, ""), baseUrl).href;
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
      link.dataset.admitCardTemplateEditorKit = "true";
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
      script.dataset.admitCardTemplateEditorKit = "true";
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
    if (globalScope.AdmitCardTemplateEditorKitManifest) {
      return Promise.resolve(globalScope.AdmitCardTemplateEditorKitManifest);
    }

    if (!state.manifestPromise) {
      state.manifestPromise = loadScript(getAssetUrl(baseUrl, "client/template-editor-kit/manifest.js")).then(() => {
        if (!globalScope.AdmitCardTemplateEditorKitManifest) {
          throw new Error("AdmitCardTemplateEditorKitManifest was not registered.");
        }

        return globalScope.AdmitCardTemplateEditorKitManifest;
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

        if (!globalScope.AdmitCardTemplateEditorKit) {
          throw new Error("AdmitCardTemplateEditorKit was not registered.");
        }

        return globalScope.AdmitCardTemplateEditorKit;
      })();
    }

    return state.loadPromise;
  }

  async function createTemplateEditor(options) {
    const kit = await load(options || {});
    return kit.createTemplateEditor(options || {});
  }

  globalScope.AdmitCardTemplateEditorKitLoader = Object.freeze({
    createTemplateEditor,
    load,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
`;
}

function buildReadme() {
  return `# AdmitCard Template Editor Kit

This directory was generated by \`scripts/install-template-editor-kit.js\`.

## Browser usage

\`\`\`html
<div id="editorRoot"></div>
<script src="/admit-card-template-editor/loader.js"></script>
<script>
  (async () => {
    const editor = await AdmitCardTemplateEditorKitLoader.createTemplateEditor({
      root: "#editorRoot",
      initialHtml: "<p>Initial template</p>",
      tags: [
        { label: "Name", dataKey: "name" },
        { label: "Exam No", dataKey: "examineeNo" }
      ],
      previewData: {
        name: "Hong Gil-dong",
        examineeNo: "A-000001"
      },
      onChange(html) {
        console.log(html);
      }
    });

    window.templateEditor = editor;
  })();
</script>
\`\`\`

If this directory is served from a different URL, pass \`baseUrl\`:

\`\`\`js
await AdmitCardTemplateEditorKitLoader.createTemplateEditor({
  baseUrl: "/assets/admit-card-template-editor/",
  root: "#editorRoot"
});
\`\`\`

Use \`editor.getHtml()\` to save the template and \`editor.setHtml(html)\` to restore it.

Generated helper files:

- \`server-examples/template-objects.express.js\`: optional Express route for barcode/QR SVG preview objects.

## Host responsibilities

The kit only provides the editor UI/runtime. The host project still owns:

- template list, save, update, delete, and activation screens
- database/API storage for the HTML returned by \`editor.getHtml()\`
- preview data mapping
- authentication and authorization
- generated barcode/QR endpoints when barcode or QR objects are used

Save the HTML exactly as returned by \`editor.getHtml()\`. Do not strip inline styles, \`data-template-page-*\`, \`data-template-tag-value\`, \`data-template-object-type\`, \`rowspan\`, \`colspan\`, or \`colgroup\`; those are part of the editor document format.

## Common options

\`\`\`js
const editor = await AdmitCardTemplateEditorKitLoader.createTemplateEditor({
  root: "#editorRoot",
  initialHtml: savedHtml,
  tags: [
    { id: "name", label: "Name", dataKey: "name" },
    { id: "examNo", label: "Exam No", dataKey: "examineeNo" }
  ],
  previewData: {
    name: "Hong Gil-dong",
    examineeNo: "A-000001",
    photoUrl: "/photos/A-000001.jpg"
  },
  buildApiUrl: (path) => path,
  buildPhotoUrl: (record) => record.photoUrl || "",
  onChange(html) {
    // Persist this HTML in the host project.
  }
});
\`\`\`

Runtime methods: \`setHtml\`, \`getHtml\`, \`insertTag\`, \`insertHtml\`, \`insertImage\`, \`applyCommand\`, \`undo\`, \`redo\`, \`render\`, \`renderInto\`, \`sync\`, and \`destroy\`.
`;
}

function buildExampleHtml() {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AdmitCard Template Editor Kit Example</title>
  <style>
    body {
      margin: 0;
      padding: 24px;
      background: #eef2f7;
      font-family: Arial, sans-serif;
    }
  </style>
</head>
<body>
  <div id="editorRoot"></div>
  <script src="./loader.js"></script>
  <script>
    (async () => {
      const editor = await AdmitCardTemplateEditorKitLoader.createTemplateEditor({
        root: "#editorRoot",
        initialHtml: "<p>수험표 양식 편집기를 시작합니다.</p>",
        tags: [
          { label: "수험번호", dataKey: "examineeNo" },
          { label: "이름", dataKey: "name" },
          { label: "수험생사진", dataKey: "photoUrl" }
        ],
        previewData: {
          examineeNo: "A-000001",
          name: "홍길동"
        },
        onChange(html) {
          console.log(html);
        }
      });

      window.templateEditor = editor;
    })();
  </script>
</body>
</html>
`;
}

function buildTemplateObjectExpressExample() {
  return `const express = require("express");
const bwipjs = require("bwip-js");
const QRCode = require("qrcode");

async function buildTemplateGeneratedObjectSvg(objectType, rawValue) {
  const normalizedType = String(objectType || "").trim().toLowerCase();
  const value = String(rawValue ?? "").trim() || "-";

  if (normalizedType === "barcode") {
    return bwipjs.toSVG({
      bcid: "code128",
      text: value,
      scale: 2,
      height: 12,
      includetext: false,
      paddingwidth: 0,
      paddingheight: 0,
      backgroundcolor: "FFFFFF",
    });
  }

  if (normalizedType === "qrcode") {
    return QRCode.toString(value, {
      type: "svg",
      margin: 0,
      width: 168,
      errorCorrectionLevel: "M",
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
  }

  const error = new Error("Unsupported template object type.");
  error.status = 400;
  throw error;
}

function createTemplateObjectRouter() {
  const router = express.Router();

  router.get("/api/template-objects/:objectType.svg", async (request, response, next) => {
    try {
      const objectType = String(request.params.objectType || "").trim().toLowerCase();

      if (objectType !== "barcode" && objectType !== "qrcode") {
        response.status(404).end();
        return;
      }

      const svgMarkup = await buildTemplateGeneratedObjectSvg(objectType, request.query.value || "-");

      response
        .status(200)
        .set({
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "no-store",
        })
        .send(svgMarkup);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = {
  buildTemplateGeneratedObjectSvg,
  createTemplateObjectRouter,
};
`;
}

function writeGeneratedFiles(targetRoot, copiedFiles) {
  const generatedFiles = {
    "loader.js": buildLoaderSource(),
    "README.md": buildReadme(),
    "example.html": buildExampleHtml(),
    "server-examples/template-objects.express.js": buildTemplateObjectExpressExample(),
  };

  Object.entries(generatedFiles).forEach(([relativePath, contents]) => {
    const targetPath = path.join(targetRoot, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, contents, "utf8");
    copiedFiles.push(relativePath);
  });

  const marker = {
    name: "admit-card-template-editor-kit",
    sourceRoot,
    installedAt: new Date().toISOString(),
    files: copiedFiles,
  };

  fs.writeFileSync(path.join(targetRoot, markerFileName), JSON.stringify(marker, null, 2), "utf8");
}

function install() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const targetRoot = ensureSafeTarget(options.target);
  resetTargetIfRequested(targetRoot, options.clean);
  fs.mkdirSync(targetRoot, { recursive: true });

  const assetPaths = [
    "client/template-editor-kit/manifest.js",
    ...(manifest.css || []),
    ...(manifest.optionalPresetScripts || []),
    ...(manifest.requiredScripts || []),
  ];
  const copiedFiles = Array.from(new Set(assetPaths)).map((relativePath) => copyFileRelative(relativePath, targetRoot));

  writeGeneratedFiles(targetRoot, copiedFiles);

  console.log(`Installed AdmitCard template editor kit to: ${targetRoot}`);
  console.log(`Copied ${copiedFiles.length} files.`);
  console.log("");
  console.log("Use it from the host page:");
  console.log('  <script src="/admit-card-template-editor/loader.js"></script>');
  console.log("  const editor = await AdmitCardTemplateEditorKitLoader.createTemplateEditor({ root: '#editorRoot' });");
}

try {
  install();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
