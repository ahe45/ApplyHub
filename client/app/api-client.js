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

  function createApiResponseError(status, contentType, responseText) {
    let payload;
    try { payload = parseApiPayload(contentType, responseText); } catch { /* A proxy can return HTML with a JSON content type. */ }
    const message = typeof payload?.error === "string" ? payload.error : typeof payload === "string" ? payload : "";
    const readableMessage = !/html/i.test(contentType) && message.trim().length <= 500 && !/<[^>]*>/.test(message);
    const fallback = [502, 503, 504, 520, 521, 522, 523, 524].includes(status)
      ? "서버 연결이 일시적으로 원활하지 않습니다. 잠시 후 다시 시도해 주세요."
      : "요청 처리 중 오류가 발생했습니다.";
    const error = new Error(readableMessage && message.trim() ? message.trim() : fallback);
    error.status = status;
    error.code = typeof payload?.code === "string" ? payload.code : "";
    error.fieldKey = typeof payload?.fieldKey === "string" ? payload.fieldKey : "";
    return error;
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
    const responseText = await response.text();

    if (!response.ok) {
      throw createApiResponseError(response.status, contentType, responseText);
    }

    return parseApiPayload(contentType, responseText);
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
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(createApiResponseError(xhr.status, contentType, xhr.responseText || ""));
            return;
          }

          resolve(parseApiPayload(contentType, xhr.responseText || ""));
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
            reject(createApiResponseError(xhr.status, contentType, responseText));
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
