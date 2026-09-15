const { createBatchAdmitCardJobController } = require("./admit-card-jobs");
const { createAdmitCardPdfService } = require("./admit-card-pdf");

function createAdmitCardService({
  batchAdmitCardJobTtlMs,
  createHttpError,
  createTemplateExamineeRenderer,
  edgeExecutablePaths,
  escapeHtml,
  getActiveTemplate,
  getExamineeByNo,
  getExamineesByNos,
  normalizeExamineeNoList,
  renderTemplateWithExaminee,
  translateDatabaseError,
}) {
  const admitCardPdfService = createAdmitCardPdfService({
    createHttpError,
    createTemplateExamineeRenderer,
    edgeExecutablePaths,
    escapeHtml,
    getActiveTemplate,
    getExamineeByNo,
    getExamineesByNos,
    normalizeExamineeNoList,
    renderTemplateWithExaminee,
  });
  const {
    buildAdmitCardPdfBuffer,
    buildAdmitCardPdfBufferFromRecord,
    buildBatchAdmitCardPdfBuffer,
    buildBatchAdmitCardZipBuffer,
  } = admitCardPdfService;

  const batchAdmitCardJobController = createBatchAdmitCardJobController({
    batchAdmitCardJobTtlMs,
    buildBatchAdmitCardPdfBuffer,
    buildBatchAdmitCardZipBuffer,
    createHttpError,
    normalizeExamineeNoList,
    translateDatabaseError,
  });
  const {
    buildBatchAdmitCardJobPayload,
    cancelBatchAdmitCardJob,
    createBatchAdmitCardJob,
    getBatchAdmitCardJobOrThrow,
  } = batchAdmitCardJobController;

  return Object.freeze({
    buildAdmitCardPdfBuffer,
    buildAdmitCardPdfBufferFromRecord,
    buildBatchAdmitCardJobPayload,
    buildBatchAdmitCardPdfBuffer,
    buildBatchAdmitCardZipBuffer,
    cancelBatchAdmitCardJob,
    createBatchAdmitCardJob,
    getBatchAdmitCardJobOrThrow,
  });
}

module.exports = {
  createAdmitCardService,
};
