(function (globalScope, factory) {
  const moduleApi = factory(globalScope);

  if (typeof module === "object" && module.exports) {
    module.exports = moduleApi;
    return;
  }

  globalScope.AdmitCardApplicantSubmissionWorkflow = moduleApi;
})(typeof globalThis !== "undefined" ? globalThis : this, (globalScope) => {
  function createApplicantSubmissionWorkflowController({
    arrayBufferToBase64,
    apiRequest,
    handleAuthenticationFailure,
    loadBootstrapData,
    openModal,
    readFileAsArrayBuffer,
    refreshApplicantBootstrap,
    renderView,
    requestCloseModal,
    showToast,
    state,
  }) {
    function resetApplicantSubmissionDetail({ render = true } = {}) {
      state.applicantManager.expandedSubmissionId = 0;

      if (render) {
        renderView();
      }
    }

    function toggleApplicantSubmissionDetail(submissionId) {
      const normalizedSubmissionId = Number(submissionId || 0);

      if (!Number.isInteger(normalizedSubmissionId) || normalizedSubmissionId <= 0) {
        resetApplicantSubmissionDetail();
        return;
      }

      const submissions = Array.isArray(state.applicantManager?.submissions) ? state.applicantManager.submissions : [];
      const targetSubmission = submissions.find((submission) => Number(submission?.id || 0) === normalizedSubmissionId) || null;

      if (!targetSubmission) {
        showToast("답변을 확인할 접수 이력을 찾을 수 없습니다.", "error", 3200);
        return;
      }

      state.applicantManager.expandedSubmissionId = normalizedSubmissionId;
      renderView();
      openModal?.("applicantSubmissionDetailModal");
    }

    function resolveApplicantPhotoMimeType(fileName = "", mimeType = "") {
      const normalizedMimeType = String(mimeType || "").trim().toLowerCase();

      if (normalizedMimeType === "image/jpeg" || normalizedMimeType === "image/png") {
        return normalizedMimeType;
      }

      const normalizedFileName = String(fileName || "").trim().toLowerCase();

      if (normalizedFileName.endsWith(".png")) {
        return "image/png";
      }

      if (normalizedFileName.endsWith(".jpg") || normalizedFileName.endsWith(".jpeg")) {
        return "image/jpeg";
      }

      return "";
    }

    async function uploadApplicantSubmissionPhoto(file, submissionId = 0) {
      const normalizedSubmissionId = Number(submissionId || state.applicantManager?.expandedSubmissionId || 0);
      const normalizedFileName = String(file?.name || "").trim();
      const fileExtension =
        normalizedFileName && normalizedFileName.includes(".")
          ? normalizedFileName.slice(normalizedFileName.lastIndexOf(".")).toLowerCase()
          : "";

      if (!Number.isInteger(normalizedSubmissionId) || normalizedSubmissionId <= 0) {
        showToast("사진을 등록할 접수 이력을 찾을 수 없습니다.", "error", 3200);
        return;
      }

      if (!file || !normalizedFileName) {
        showToast("등록할 사진 파일을 먼저 선택하세요.", "error", 3200);
        return;
      }

      if (![".jpg", ".jpeg", ".png"].includes(fileExtension)) {
        showToast("사진 파일은 JPG, JPEG, PNG 형식만 업로드할 수 있습니다.", "error", 3200);
        return;
      }

      try {
        const fileContentBase64 = arrayBufferToBase64(await readFileAsArrayBuffer(file));

        await apiRequest(`/api/applicant-submissions/${normalizedSubmissionId}/photo`, {
          method: "PUT",
          body: JSON.stringify({
            fileName: normalizedFileName,
            fileContentBase64,
            mimeType: resolveApplicantPhotoMimeType(normalizedFileName, file.type),
          }),
        });

        await loadBootstrapData({ showLoading: false });
        showToast("접수 사진을 다시 등록했습니다.");
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return;
        }

        showToast(error?.message || "접수 사진을 다시 등록하지 못했습니다.", "error", 4200);
      }
    }

    async function deleteApplicantSubmission(submissionId) {
      const normalizedSubmissionId = Number(submissionId || 0);

      if (!Number.isInteger(normalizedSubmissionId) || normalizedSubmissionId <= 0) {
        return;
      }

      const submissions = Array.isArray(state.applicantManager?.submissions) ? state.applicantManager.submissions : [];
      const targetSubmission = submissions.find((submission) => Number(submission?.id || 0) === normalizedSubmissionId) || null;
      const confirmationLines = [
        targetSubmission?.name
          ? `${targetSubmission.name} (${normalizedSubmissionId}) 접수를 취소하고 삭제하시겠습니까?`
          : `접수번호 ${normalizedSubmissionId} 접수를 취소하고 삭제하시겠습니까?`,
        "삭제된 접수 이력은 복구할 수 없습니다.",
      ];

      if (String(targetSubmission?.status || "").trim() === "promoted" || String(targetSubmission?.promotedExamineeNo || "").trim()) {
        confirmationLines.push("접수 사진·서류와 해당 수험번호의 출력 이력도 함께 삭제됩니다.");
      }

      if (!globalScope.confirm(confirmationLines.join("\n"))) {
        return;
      }

      try {
        await apiRequest(`/api/applicant-submissions/${normalizedSubmissionId}`, {
          method: "DELETE",
        });

        if (Number(state.applicantManager?.expandedSubmissionId || 0) === normalizedSubmissionId) {
          resetApplicantSubmissionDetail({ render: false });
          await requestCloseModal?.("applicantSubmissionDetailModal");
        }

        const applicantHistoryTableState = state.tableSettings?.applicantHistoryGrid;

        if (applicantHistoryTableState && Array.isArray(applicantHistoryTableState.selectedRowIds)) {
          applicantHistoryTableState.selectedRowIds = applicantHistoryTableState.selectedRowIds.filter(
            (rowId) => String(rowId || "").trim() !== String(normalizedSubmissionId),
          );

          if (String(applicantHistoryTableState.selectionAnchorRowId || "").trim() === String(normalizedSubmissionId)) {
            applicantHistoryTableState.selectionAnchorRowId = "";
          }
        }

        await refreshApplicantBootstrap("접수 이력을 삭제했습니다.");
      } catch (error) {
        if (handleAuthenticationFailure(error)) {
          return;
        }

        showToast(error?.message || "접수 이력을 삭제하지 못했습니다.", "error", 4200);
      }
    }

    return Object.freeze({
      deleteApplicantSubmission,
      resetApplicantSubmissionDetail,
      toggleApplicantSubmissionDetail,
      uploadApplicantSubmissionPhoto,
    });
  }

  return Object.freeze({
    createApplicantSubmissionWorkflowController,
  });
});
