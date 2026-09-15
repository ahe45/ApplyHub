const { randomUUID } = require("crypto");

const BATCH_ADMIT_CARD_OUTPUT_MODES = Object.freeze({
  COMBINED_PDF: "combined-pdf",
  PDF_ZIP: "pdf-zip",
});

const BATCH_ADMIT_CARD_JOB_STATUSES = Object.freeze({
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
});

const BATCH_ADMIT_CARD_CANCELLED_ERROR_CODE = "BATCH_JOB_CANCELLED";
const BATCH_ADMIT_CARD_CANCELLED_MESSAGE = "수험표 파일 생성을 취소했습니다.";

function createBatchAdmitCardCancelledError(message = BATCH_ADMIT_CARD_CANCELLED_MESSAGE) {
  const error = new Error(String(message || BATCH_ADMIT_CARD_CANCELLED_MESSAGE));

  error.code = BATCH_ADMIT_CARD_CANCELLED_ERROR_CODE;
  return error;
}

function isBatchAdmitCardCancelledError(error) {
  return String(error?.code || "").trim() === BATCH_ADMIT_CARD_CANCELLED_ERROR_CODE;
}

function createBatchAdmitCardJobController({
  batchAdmitCardJobTtlMs,
  buildBatchAdmitCardPdfBuffer,
  buildBatchAdmitCardZipBuffer,
  createHttpError,
  normalizeExamineeNoList,
  translateDatabaseError,
}) {
  const batchAdmitCardJobStore = new Map();

  function normalizeBatchAdmitCardOutputMode(value) {
    return String(value || "").trim() === BATCH_ADMIT_CARD_OUTPUT_MODES.PDF_ZIP
      ? BATCH_ADMIT_CARD_OUTPUT_MODES.PDF_ZIP
      : BATCH_ADMIT_CARD_OUTPUT_MODES.COMBINED_PDF;
  }

  function getBatchAdmitCardOutputFileName(outputMode, count) {
    const normalizedCount = Math.max(0, Number(count || 0));

    if (normalizeBatchAdmitCardOutputMode(outputMode) === BATCH_ADMIT_CARD_OUTPUT_MODES.PDF_ZIP) {
      return `admit-card-pdfs-${normalizedCount}.zip`;
    }

    return `admit-cards-${normalizedCount}.pdf`;
  }

  function getBatchAdmitCardOutputContentType(outputMode) {
    return normalizeBatchAdmitCardOutputMode(outputMode) === BATCH_ADMIT_CARD_OUTPUT_MODES.PDF_ZIP
      ? "application/zip"
      : "application/pdf";
  }

  function touchBatchAdmitCardJob(job) {
    if (!job) {
      return null;
    }

    job.updatedAt = Date.now();
    job.expiresAt = job.updatedAt + batchAdmitCardJobTtlMs;
    return job;
  }

  function cleanupBatchAdmitCardJobs() {
    const now = Date.now();

    batchAdmitCardJobStore.forEach((job, jobId) => {
      if (Number(job?.expiresAt || 0) > now) {
        return;
      }

      batchAdmitCardJobStore.delete(jobId);
    });
  }

  function clearBatchAdmitCardJobExecutionState(job) {
    if (!job) {
      return;
    }

    job.cancelHandler = null;
  }

  function buildBatchAdmitCardJobPayload(job) {
    return {
      jobId: String(job?.jobId || ""),
      status: String(job?.status || BATCH_ADMIT_CARD_JOB_STATUSES.RUNNING),
      phase: String(job?.phase || "preparing"),
      outputMode: normalizeBatchAdmitCardOutputMode(job?.outputMode),
      countUnit: String(job?.countUnit || "examinee"),
      totalCount: Math.max(0, Number(job?.totalCount || 0)),
      completedCount: Math.max(0, Number(job?.completedCount || 0)),
      completedPageCount: Math.max(0, Number(job?.completedPageCount || 0)),
      totalPageCount: Math.max(0, Number(job?.totalPageCount || 0)),
      examineeTotalCount: Math.max(0, Number(job?.examineeTotalCount || job?.totalCount || 0)),
      fileName: String(job?.fileName || ""),
      fileContentType: String(job?.fileContentType || ""),
      cancelRequested: Boolean(job?.cancelRequested),
      error: String(job?.error || ""),
      errorCode: String(job?.errorCode || ""),
    };
  }

  function getBatchAdmitCardJobOrThrow(jobId, accountId) {
    cleanupBatchAdmitCardJobs();

    const normalizedJobId = String(jobId || "").trim();

    if (!normalizedJobId) {
      throw createHttpError(400, "배치 출력 작업 ID가 필요합니다.", "INVALID_BATCH_JOB_ID");
    }

    const job = batchAdmitCardJobStore.get(normalizedJobId);

    if (!job || job.accountId !== accountId) {
      throw createHttpError(404, "배치 출력 작업을 찾을 수 없습니다.", "BATCH_JOB_NOT_FOUND");
    }

    return touchBatchAdmitCardJob(job);
  }

  function setBatchAdmitCardJobCancelHandler(jobId, cancelHandler) {
    const activeJob = batchAdmitCardJobStore.get(jobId);

    if (!activeJob) {
      return;
    }

    activeJob.cancelHandler = typeof cancelHandler === "function" ? cancelHandler : null;
    touchBatchAdmitCardJob(activeJob);

    if (activeJob.cancelRequested && typeof activeJob.cancelHandler === "function") {
      void Promise.resolve(activeJob.cancelHandler()).catch(() => {});
    }
  }

  function isBatchAdmitCardJobCancellationRequested(jobId) {
    return Boolean(batchAdmitCardJobStore.get(jobId)?.cancelRequested);
  }

  function updateBatchAdmitCardJobProgress(jobId, payload = {}) {
    const activeJob = batchAdmitCardJobStore.get(jobId);

    if (
      !activeJob ||
      activeJob.status !== BATCH_ADMIT_CARD_JOB_STATUSES.RUNNING ||
      activeJob.cancelRequested
    ) {
      return;
    }

    activeJob.phase = String(payload.phase || activeJob.phase || "preparing");
    activeJob.outputMode = normalizeBatchAdmitCardOutputMode(payload.outputMode || activeJob.outputMode);
    activeJob.countUnit = String(payload.countUnit || activeJob.countUnit || "examinee");
    activeJob.completedCount = Math.max(0, Number(payload.completedCount || 0));
    activeJob.totalCount = Math.max(activeJob.completedCount, Number(payload.totalCount || activeJob.totalCount || 0));
    activeJob.completedPageCount = Math.max(0, Number(payload.completedPageCount || activeJob.completedPageCount || 0));
    activeJob.totalPageCount = Math.max(
      activeJob.completedPageCount,
      Number(payload.totalPageCount || activeJob.totalPageCount || 0),
    );
    activeJob.examineeTotalCount = Math.max(
      0,
      Number(payload.examineeTotalCount || activeJob.examineeTotalCount || activeJob.totalCount || 0),
    );
    touchBatchAdmitCardJob(activeJob);
  }

  async function runBatchAdmitCardJob(jobId, examineeNos, outputMode) {
    const job = batchAdmitCardJobStore.get(jobId);

    if (!job) {
      return;
    }

    try {
      if (job.cancelRequested) {
        throw createBatchAdmitCardCancelledError();
      }

      const normalizedOutputMode = normalizeBatchAdmitCardOutputMode(outputMode);
      const buildBatchAdmitCardBuffer =
        normalizedOutputMode === BATCH_ADMIT_CARD_OUTPUT_MODES.PDF_ZIP
          ? buildBatchAdmitCardZipBuffer
          : buildBatchAdmitCardPdfBuffer;
      const fileBuffer = await buildBatchAdmitCardBuffer(examineeNos, {
        onPhaseChange: (payload) => {
          updateBatchAdmitCardJobProgress(jobId, payload);
        },
        onProgress: (payload) => {
          updateBatchAdmitCardJobProgress(jobId, {
            ...payload,
            phase: "rendering",
          });
        },
        registerCancelHandler: (cancelHandler) => {
          setBatchAdmitCardJobCancelHandler(jobId, cancelHandler);
        },
        shouldCancel: () => isBatchAdmitCardJobCancellationRequested(jobId),
      });
      const activeJob = batchAdmitCardJobStore.get(jobId);

      if (!activeJob) {
        return;
      }

      clearBatchAdmitCardJobExecutionState(activeJob);

      if (activeJob.cancelRequested) {
        activeJob.status = BATCH_ADMIT_CARD_JOB_STATUSES.CANCELLED;
        activeJob.phase = "cancelled";
        activeJob.error = BATCH_ADMIT_CARD_CANCELLED_MESSAGE;
        activeJob.errorCode = BATCH_ADMIT_CARD_CANCELLED_ERROR_CODE;
        activeJob.fileBuffer = null;
        touchBatchAdmitCardJob(activeJob);
        return;
      }

      activeJob.status = BATCH_ADMIT_CARD_JOB_STATUSES.COMPLETED;
      activeJob.phase = "ready";
      activeJob.completedCount = Math.max(activeJob.completedCount, activeJob.totalCount);
      activeJob.completedPageCount = Math.max(activeJob.completedPageCount, activeJob.totalPageCount);
      activeJob.fileBuffer = fileBuffer;
      activeJob.error = "";
      activeJob.errorCode = "";
      touchBatchAdmitCardJob(activeJob);
    } catch (error) {
      const activeJob = batchAdmitCardJobStore.get(jobId);

      if (!activeJob) {
        return;
      }

      clearBatchAdmitCardJobExecutionState(activeJob);

      const normalizedError = error?.statusCode ? error : translateDatabaseError(error);
      const shouldMarkCancelled = activeJob.cancelRequested || isBatchAdmitCardCancelledError(normalizedError);

      if (shouldMarkCancelled) {
        activeJob.status = BATCH_ADMIT_CARD_JOB_STATUSES.CANCELLED;
        activeJob.phase = "cancelled";
        activeJob.error = BATCH_ADMIT_CARD_CANCELLED_MESSAGE;
        activeJob.errorCode = BATCH_ADMIT_CARD_CANCELLED_ERROR_CODE;
        activeJob.fileBuffer = null;
        touchBatchAdmitCardJob(activeJob);
        return;
      }

      activeJob.status = BATCH_ADMIT_CARD_JOB_STATUSES.FAILED;
      activeJob.phase = "failed";
      activeJob.error = String(normalizedError?.message || "수험표 파일을 생성할 수 없습니다.");
      activeJob.errorCode = String(normalizedError?.errorCode || "");
      activeJob.fileBuffer = null;
      touchBatchAdmitCardJob(activeJob);
    }
  }

  function createBatchAdmitCardJob(accountId, examineeNos, outputMode) {
    const normalizedExamineeNos = normalizeExamineeNoList(examineeNos);

    if (normalizedExamineeNos.length === 0) {
      throw createHttpError(400, "출력 대상 수험번호가 필요합니다.");
    }

    cleanupBatchAdmitCardJobs();

    const normalizedOutputMode = normalizeBatchAdmitCardOutputMode(outputMode);
    const jobId = randomUUID();
    const now = Date.now();
    const job = {
      jobId,
      accountId: String(accountId || ""),
      status: BATCH_ADMIT_CARD_JOB_STATUSES.RUNNING,
      phase: "preparing",
      outputMode: normalizedOutputMode,
      countUnit: normalizedOutputMode === BATCH_ADMIT_CARD_OUTPUT_MODES.PDF_ZIP ? "file" : "examinee",
      totalCount: normalizedExamineeNos.length,
      completedCount: 0,
      completedPageCount: 0,
      totalPageCount: 0,
      examineeTotalCount: normalizedExamineeNos.length,
      fileName: getBatchAdmitCardOutputFileName(normalizedOutputMode, normalizedExamineeNos.length),
      fileContentType: getBatchAdmitCardOutputContentType(normalizedOutputMode),
      fileBuffer: null,
      cancelRequested: false,
      cancelHandler: null,
      error: "",
      errorCode: "",
      createdAt: now,
      updatedAt: now,
      expiresAt: now + batchAdmitCardJobTtlMs,
    };

    batchAdmitCardJobStore.set(jobId, job);
    void runBatchAdmitCardJob(jobId, normalizedExamineeNos, normalizedOutputMode);

    return buildBatchAdmitCardJobPayload(job);
  }

  function cancelBatchAdmitCardJob(jobId, accountId) {
    const job = getBatchAdmitCardJobOrThrow(jobId, accountId);

    if (job.status === BATCH_ADMIT_CARD_JOB_STATUSES.CANCELLED) {
      return buildBatchAdmitCardJobPayload(job);
    }

    if (job.status !== BATCH_ADMIT_CARD_JOB_STATUSES.RUNNING) {
      throw createHttpError(409, "이미 종료된 배치 출력 작업입니다.", "BATCH_JOB_NOT_RUNNING");
    }

    job.cancelRequested = true;
    job.phase = "cancelling";
    touchBatchAdmitCardJob(job);

    if (typeof job.cancelHandler === "function") {
      void Promise.resolve(job.cancelHandler()).catch(() => {});
    }

    return buildBatchAdmitCardJobPayload(job);
  }

  return Object.freeze({
    buildBatchAdmitCardJobPayload,
    cancelBatchAdmitCardJob,
    createBatchAdmitCardCancelledError,
    createBatchAdmitCardJob,
    getBatchAdmitCardJobOrThrow,
  });
}

module.exports = {
  BATCH_ADMIT_CARD_CANCELLED_ERROR_CODE,
  BATCH_ADMIT_CARD_CANCELLED_MESSAGE,
  BATCH_ADMIT_CARD_JOB_STATUSES,
  BATCH_ADMIT_CARD_OUTPUT_MODES,
  createBatchAdmitCardCancelledError,
  createBatchAdmitCardJobController,
  isBatchAdmitCardCancelledError,
};
