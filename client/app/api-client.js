(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardApiClient = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function getApiBaseUrl() {
    const explicitBaseUrl = window.localStorage.getItem("admitcard.apiBaseUrl");

    if (explicitBaseUrl) {
      return explicitBaseUrl.replace(/\/$/, "");
    }

    const currentOrigin = window.location.origin;

    if (/^https?:\/\//i.test(currentOrigin)) {
      return currentOrigin;
    }

    return "http://localhost:3000";
  }

  function buildApiUrl(resource) {
    if (/^https?:\/\//i.test(resource)) {
      return resource;
    }

    return new URL(resource, `${getApiBaseUrl()}/`).toString();
  }

  function shouldApplyJsonContentType(body, headers = {}) {
    if (!body) {
      return false;
    }

    const hasContentTypeHeader = Object.keys(headers || {}).some((headerName) => String(headerName).toLowerCase() === "content-type");

    if (hasContentTypeHeader) {
      return false;
    }

    return typeof body === "string";
  }

  function parseApiPayload(contentType, responseText) {
    if (!String(contentType || "").includes("application/json")) {
      return responseText;
    }

    return responseText ? JSON.parse(responseText) : {};
  }

  async function apiRequest(resource, options = {}) {
    const requestOptions = {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(shouldApplyJsonContentType(options.body, options.headers) ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    };
    const response = await fetch(buildApiUrl(resource), requestOptions);
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
      const error = new Error(payload?.error || payload || "요청 처리 중 오류가 발생했습니다.");
      error.status = response.status;
      error.code = payload?.code || "";
      error.fieldKey = payload?.fieldKey || "";
      throw error;
    }

    return payload;
  }

  function apiRequestWithUploadProgress(resource, options = {}, callbacks = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const requestHeaders = {
        ...(shouldApplyJsonContentType(options.body, options.headers) ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      };
      const requestUrl = buildApiUrl(resource);
      let didNotifyUploadComplete = false;

      const notifyUploadComplete = () => {
        if (didNotifyUploadComplete) {
          return;
        }

        didNotifyUploadComplete = true;
        callbacks.onUploadComplete?.();
      };

      xhr.open(options.method || "GET", requestUrl, true);
      xhr.withCredentials = options.credentials === "include";

      Object.entries(requestHeaders).forEach(([headerName, headerValue]) => {
        xhr.setRequestHeader(headerName, headerValue);
      });

      xhr.addEventListener("load", () => {
        notifyUploadComplete();

        try {
          const contentType = xhr.getResponseHeader("content-type") || "";
          const payload = parseApiPayload(contentType, xhr.responseText || "");

          if (xhr.status < 200 || xhr.status >= 300) {
            const error = new Error(payload?.error || payload || "요청 처리 중 오류가 발생했습니다.");
            error.status = xhr.status;
            error.code = payload?.code || "";
            reject(error);
            return;
          }

          resolve(payload);
        } catch (error) {
          reject(error);
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("요청 처리 중 네트워크 오류가 발생했습니다."));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("요청이 중단되었습니다."));
      });

      if (xhr.upload) {
        xhr.upload.addEventListener("progress", (event) => {
          if (!event.lengthComputable) {
            return;
          }

          callbacks.onProgress?.({
            loaded: event.loaded,
            total: event.total,
            percent: event.total > 0 ? Math.round((event.loaded / event.total) * 100) : 0,
          });
        });

        xhr.upload.addEventListener("load", notifyUploadComplete);
      }

      xhr.send(options.body || null);
    });
  }

  function apiRequestForBlobWithProgress(resource, options = {}, callbacks = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const requestHeaders = {
        ...(shouldApplyJsonContentType(options.body, options.headers) ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      };
      const requestUrl = buildApiUrl(resource);
      let didNotifyResponseStart = false;

      const notifyResponseStart = () => {
        if (didNotifyResponseStart) {
          return;
        }

        didNotifyResponseStart = true;
        callbacks.onResponseStart?.();
      };

      xhr.open(options.method || "GET", requestUrl, true);
      xhr.responseType = "blob";
      xhr.withCredentials = options.credentials === "include";

      Object.entries(requestHeaders).forEach(([headerName, headerValue]) => {
        xhr.setRequestHeader(headerName, headerValue);
      });

      xhr.addEventListener("readystatechange", () => {
        if (xhr.readyState >= XMLHttpRequest.HEADERS_RECEIVED) {
          notifyResponseStart();
        }
      });

      xhr.addEventListener("progress", (event) => {
        notifyResponseStart();
        callbacks.onProgress?.({
          loaded: event.loaded,
          total: event.total,
          lengthComputable: event.lengthComputable,
          percent: event.lengthComputable && event.total > 0 ? Math.round((event.loaded / event.total) * 100) : 0,
        });
      });

      xhr.addEventListener("load", async () => {
        notifyResponseStart();

        try {
          const contentType = xhr.getResponseHeader("content-type") || "";
          const responseBlob = xhr.response instanceof Blob ? xhr.response : new Blob();

          if (xhr.status < 200 || xhr.status >= 300) {
            const responseText = await responseBlob.text();
            const payload = parseApiPayload(contentType, responseText);
            const error = new Error(payload?.error || payload || "요청 처리 중 오류가 발생했습니다.");
            error.status = xhr.status;
            error.code = payload?.code || "";
            reject(error);
            return;
          }

          resolve({
            blob: responseBlob,
            contentType,
          });
        } catch (error) {
          reject(error);
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("요청 처리 중 네트워크 오류가 발생했습니다."));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("요청이 중단되었습니다."));
      });

      callbacks.onRequest?.({
        xhr,
        abort: () => xhr.abort(),
      });

      xhr.send(options.body || null);
    });
  }

  return {
    apiRequest,
    apiRequestForBlobWithProgress,
    apiRequestWithUploadProgress,
    buildApiUrl,
    getApiBaseUrl,
    parseApiPayload,
    shouldApplyJsonContentType,
  };
});
