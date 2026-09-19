(function (globalScope, factory) {
  const moduleApi = factory(globalScope);

  if (typeof module === "object" && module.exports) {
    module.exports = moduleApi;
    return;
  }

  globalScope.AdmitCardApplicantAdminDownloads = moduleApi;
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  function createApplicantAdminDownloadController({
    buildApiUrl,

    requestCloseModal,
    showToast,
    state,
  }) {
    function triggerBlobDownload(blob, fileName) {
      const downloadUrl = globalScope.URL.createObjectURL(blob);
      const anchor = globalScope.document.createElement("a");

      anchor.href = downloadUrl;
      anchor.download = fileName;
      globalScope.document.body.appendChild(anchor);
      anchor.click();
      globalScope.document.body.removeChild(anchor);
      globalScope.setTimeout(() => globalScope.URL.revokeObjectURL(downloadUrl), 1000);
    }

    async function assertSuccessfulFileResponse(response, fallbackMessage = "") {
      const contentType = response.headers.get("content-type") || "";

      if (response.ok) {
        return;
      }

      const payload = contentType.includes("application/json") ? await response.json() : await response.text();
      throw new Error(payload?.error || payload || fallbackMessage);
    }

    function getFilteredRows(gridId = "", fallbackRows = []) {
      return typeof globalScope.getGridRows === "function" ? globalScope.getGridRows(gridId) : fallbackRows;
    }

    async function downloadApplicantRecruitmentUnitTemplate() {
      try {
        const response = await globalScope.fetch(buildApiUrl("/api/applicant-recruitment-units/template.xlsx"), {
          credentials: "same-origin",
        });

        await assertSuccessfulFileResponse(response, "전형 관리 양식을 다운로드할 수 없습니다.");
        triggerBlobDownload(await response.blob(), "전형 관리 업로드 양식.xlsx");
      } catch (error) {
        showToast(error.message, "error", 4200);
      }
    }

    async function downloadApplicantRecruitmentUnits() {
      const filteredRows = getFilteredRows("applicantRecruitmentGrid", state.applicantManager?.recruitmentUnits);

      if (!Array.isArray(filteredRows) || filteredRows.length === 0) {
        showToast("필터링된 데이터가 없습니다.", "error", 4200);
        return;
      }

      try {
        const response = await globalScope.fetch(buildApiUrl("/api/applicant-recruitment-units/export.xlsx"), {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rows: filteredRows,
          }),
        });

        await assertSuccessfulFileResponse(response, "전형 관리 데이터를 다운로드할 수 없습니다.");
        triggerBlobDownload(await response.blob(), "전형 관리 데이터.xlsx");
      } catch (error) {
        showToast(error.message, "error", 4200);
      }
    }

    async function downloadApplicantSubmissions() {
      const filteredRows = globalScope.AdmitCardRemoteGrids?.references("applicantHistoryGrid") || getFilteredRows("applicantHistoryGrid", state.applicantManager?.submissions);

      if (!Array.isArray(filteredRows) || filteredRows.length === 0) {
        showToast("필터링된 데이터가 없습니다.", "error", 4200);
        return;
      }

      try {
        const response = await globalScope.fetch(buildApiUrl("/api/applicant-submissions/export.xlsx"), {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            submissionIds: filteredRows.map(row => row.id),
          }),
        });

        await assertSuccessfulFileResponse(response, "접수 이력 데이터를 다운로드할 수 없습니다.");
        await requestCloseModal?.("applicantSubmissionDownloadModal");
        triggerBlobDownload(await response.blob(), "접수 이력 데이터.xlsx");
      } catch (error) {
        showToast(error.message, "error", 4200);
      }
    }

    async function downloadApplicantSubmissionPhotos() {
      const filteredRows = globalScope.AdmitCardRemoteGrids?.references("applicantHistoryGrid") || getFilteredRows("applicantHistoryGrid", state.applicantManager?.submissions);

      if (!Array.isArray(filteredRows) || filteredRows.length === 0) {
        showToast("필터링된 데이터가 없습니다.", "error", 4200);
        return;
      }

      try {
        const response = await globalScope.fetch(buildApiUrl("/api/applicant-submissions/photos.zip"), {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            submissionIds: filteredRows.map(row => row.id),
          }),
        });

        await assertSuccessfulFileResponse(response, "수험생 사진 ZIP을 다운로드할 수 없습니다.");
        await requestCloseModal?.("applicantSubmissionDownloadModal");
        triggerBlobDownload(await response.blob(), "접수 이력 수험생 사진.zip");
      } catch (error) {
        showToast(error.message, "error", 4200);
      }
    }

    return Object.freeze({

      downloadApplicantSubmissionPhotos,
      downloadApplicantSubmissions,
      downloadApplicantRecruitmentUnits,
      downloadApplicantRecruitmentUnitTemplate,
    });
  }

  return Object.freeze({
    createApplicantAdminDownloadController,
  });
});
