(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardExamineeFileTransfer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const apiClient = globalThis.AdmitCardApiClient;

  function triggerBlobDownload(blob, fileName) {
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = downloadUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }

  function waitForNextFrame() {
    return new Promise((resolve) => {
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => resolve());
        return;
      }

      window.setTimeout(resolve, 0);
    });
  }

  function wait(delayMs) {
    const normalizedDelay = Math.max(0, Math.round(Number(delayMs) || 0));

    if (normalizedDelay === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      window.setTimeout(resolve, normalizedDelay);
    });
  }

  function readFileAsArrayBuffer(file, { onProgress } = {}) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.addEventListener("progress", (event) => {
        if (!event.lengthComputable) {
          return;
        }

        onProgress?.({
          loaded: event.loaded,
          total: event.total,
          percent: event.total > 0 ? Math.round((event.loaded / event.total) * 100) : 0,
        });
      });
      reader.addEventListener("load", () => {
        onProgress?.({
          loaded: file?.size || 0,
          total: file?.size || 0,
          percent: 100,
        });
        resolve(reader.result);
      });
      reader.addEventListener("error", () => reject(new Error("파일을 읽는 중 오류가 발생했습니다.")));
      reader.readAsArrayBuffer(file);
    });
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, offset + chunkSize);
      binary += String.fromCharCode(...chunk);
    }

    return window.btoa(binary);
  }

  async function downloadPrintHistoryGridWorkbook() {
    const filteredRows = typeof getGridRows === "function" ? getGridRows("printHistoryGrid") : [];
    const summaryExaminees = typeof getPrintHistorySummaryExamineeRows === "function" ? getPrintHistorySummaryExamineeRows() : [];

    if ((!Array.isArray(filteredRows) || filteredRows.length === 0) && (!Array.isArray(summaryExaminees) || summaryExaminees.length === 0)) {
      showToast("필터링된 데이터가 없습니다.", "error", 4200);
      return;
    }

    try {
      const response = await fetch(apiClient.buildApiUrl("/api/print-history/export.xlsx"), {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rows: filteredRows,
          summaryExaminees,
        }),
      });
      const contentType = response.headers.get("content-type") || "";

      if (!response.ok) {
        const payload = contentType.includes("application/json") ? await response.json() : await response.text();
        throw new Error(payload?.error || payload || "출력 이력 XLSX를 다운로드할 수 없습니다.");
      }

      triggerBlobDownload(await response.blob(), "수험표 출력 이력.xlsx");
    } catch (error) {
      showToast(error.message, "error", 4200);
    }
  }

  return {
    arrayBufferToBase64,

    downloadPrintHistoryGridWorkbook,

    readFileAsArrayBuffer,
    wait,
    waitForNextFrame,
  };
});
