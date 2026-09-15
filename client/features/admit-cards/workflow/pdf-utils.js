(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardWorkflowPdfUtils = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createAdmitCardPdfHelpers({ buildApiUrl }) {
    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function renderPendingPdfPrintWindow(previewWindow, {
      title = "수험표 인쇄 준비 중",
      message = "PDF를 준비하고 있습니다.",
      hint = "준비가 끝나면 인쇄 창을 자동으로 시도합니다.",
    } = {}) {
      if (!previewWindow || previewWindow.closed) {
        return false;
      }

      try {
        previewWindow.document.open();
        previewWindow.document.write(`
          <!DOCTYPE html>
          <html lang="ko">
            <head>
              <meta charset="UTF-8" />
              <title>${escapeHtml(title)}</title>
              <style>
                * { box-sizing: border-box; }
                body {
                  margin: 0;
                  min-height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 24px;
                  font-family: "Noto Sans KR", sans-serif;
                  color: #d9e7ff;
                  background:
                    radial-gradient(circle at top, rgba(61, 132, 255, 0.22), transparent 42%),
                    linear-gradient(180deg, #0e1728 0%, #14213a 100%);
                }
                .pending-print-card {
                  width: min(100%, 480px);
                  padding: 32px 28px;
                  border-radius: 24px;
                  background: rgba(16, 24, 40, 0.78);
                  box-shadow: 0 24px 56px rgba(15, 23, 42, 0.34);
                }
                .pending-print-title {
                  margin: 0 0 12px;
                  font-size: 24px;
                  line-height: 1.35;
                }
                .pending-print-message,
                .pending-print-hint {
                  margin: 0;
                  line-height: 1.7;
                }
                .pending-print-message {
                  color: rgba(233, 241, 255, 0.95);
                }
                .pending-print-hint {
                  margin-top: 14px;
                  color: rgba(181, 203, 240, 0.9);
                  font-size: 14px;
                }
              </style>
            </head>
            <body>
              <main class="pending-print-card">
                <h1 class="pending-print-title">${escapeHtml(title)}</h1>
                <p class="pending-print-message">${escapeHtml(message)}</p>
                <p class="pending-print-hint">${escapeHtml(hint)}</p>
              </main>
            </body>
          </html>
        `);
        previewWindow.document.close();
        return true;
      } catch (error) {
        return false;
      }
    }

    async function fetchExamineeAdmitCardPdfUrl(examineeNo) {
      const response = await fetch(buildApiUrl(`/api/admit-cards/${encodeURIComponent(examineeNo)}/pdf`));
      const contentType = response.headers.get("content-type") || "";

      if (!response.ok) {
        const payload = contentType.includes("application/json") ? await response.json() : await response.text();
        throw new Error(payload?.error || payload || "수험표 PDF를 생성할 수 없습니다.");
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }

    function openPendingPdfPrintWindow(options = {}) {
      const previewWindow = window.open("", "_blank");

      if (!previewWindow) {
        return null;
      }

      renderPendingPdfPrintWindow(previewWindow, options);
      previewWindow.focus();
      return previewWindow;
    }

    function openPdfWindow(pdfUrl, { shouldPrint = false } = {}) {
      const normalizedUrl = String(pdfUrl || "").trim();

      if (!normalizedUrl) {
        return null;
      }

      const previewWindow = window.open(normalizedUrl, "_blank", "noopener,noreferrer");

      if (!previewWindow) {
        return null;
      }

      previewWindow.focus();

      if (shouldPrint) {
        window.setTimeout(() => {
          try {
            previewWindow.print();
          } catch (error) {
            // Ignore print invocation failures and keep the viewer open.
          }
        }, 400);
      }

      return previewWindow;
    }

    function printPdfInWindow(previewWindow, pdfUrl, {
      autoPrintDelayMs = 2500,
    } = {}) {
      const normalizedUrl = String(pdfUrl || "").trim();

      if (!normalizedUrl) {
        return Promise.reject(new Error("인쇄할 PDF 문서가 없습니다."));
      }

      if (!previewWindow || previewWindow.closed) {
        return Promise.reject(new Error("브라우저에서 PDF 인쇄 창을 열지 못했습니다. 팝업 허용 후 다시 시도하세요."));
      }

      try {
        previewWindow.location.replace(normalizedUrl);
      } catch (error) {
        previewWindow.location.href = normalizedUrl;
      }

      window.setTimeout(() => {
        if (!previewWindow || previewWindow.closed) {
          return;
        }

        try {
          previewWindow.focus();
          previewWindow.print();
        } catch (error) {
          // Keep the PDF viewer open so the user can print manually.
        }
      }, Math.max(0, Number(autoPrintDelayMs || 0)));

      return Promise.resolve(previewWindow);
    }

    function printPdfUrl(pdfUrl, { printDelayMs = 400, fallbackDelayMs = 1600 } = {}) {
      const normalizedUrl = String(pdfUrl || "").trim();

      if (!normalizedUrl) {
        return Promise.reject(new Error("인쇄할 PDF 문서가 없습니다."));
      }

      return new Promise((resolve, reject) => {
        const printFrame = document.createElement("iframe");
        let hasCompleted = false;
        let fallbackTimerId = 0;
        let printTimerId = 0;

        const finalize = (error) => {
          if (hasCompleted) {
            return;
          }

          hasCompleted = true;
          window.clearTimeout(fallbackTimerId);
          window.clearTimeout(printTimerId);
          window.setTimeout(() => {
            printFrame.remove();
          }, 1000);

          if (error) {
            reject(error);
            return;
          }

          resolve();
        };

        const triggerPrint = () => {
          try {
            if (!printFrame.contentWindow) {
              throw new Error("PDF 인쇄 프레임을 열 수 없습니다.");
            }

            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
            finalize();
          } catch (error) {
            finalize(error);
          }
        };

        printFrame.setAttribute("aria-hidden", "true");
        printFrame.style.position = "fixed";
        printFrame.style.right = "0";
        printFrame.style.bottom = "0";
        printFrame.style.width = "0";
        printFrame.style.height = "0";
        printFrame.style.border = "0";
        printFrame.style.opacity = "0";
        printFrame.style.pointerEvents = "none";
        printFrame.onload = () => {
          printTimerId = window.setTimeout(triggerPrint, Math.max(0, Number(printDelayMs || 0)));
        };
        fallbackTimerId = window.setTimeout(
          triggerPrint,
          Math.max(Math.max(0, Number(printDelayMs || 0)) + 400, Number(fallbackDelayMs || 0)),
        );
        printFrame.src = normalizedUrl;
        document.body.appendChild(printFrame);
      });
    }

    return Object.freeze({
      fetchExamineeAdmitCardPdfUrl,
      openPendingPdfPrintWindow,
      openPdfWindow,
      printPdfInWindow,
      printPdfUrl,
    });
  }

  return Object.freeze({
    createAdmitCardPdfHelpers,
  });
});
