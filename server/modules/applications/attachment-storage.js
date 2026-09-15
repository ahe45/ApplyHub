const fs = require("fs");
const path = require("path");
const { createHash } = require("crypto");
const { formatUploadFileBaseName, isAllowedUploadExtension } = require("../../../shared/domain/applicant-form");

function createAttachmentHttpErrorFactory(createHttpError) {
  if (typeof createHttpError === "function") {
    return createHttpError;
  }

  return (status, message, code) => {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
  };
}

function createApplicantAttachmentStorage({
  applicantFileStorageDirName = "uploads/file",
  applicantPhotoStorageDirName = "uploads/photo",
  createHttpError,
  examineePhotoStorageDirName = "photo",
  rootDir = process.cwd(),
} = {}) {
  const httpError = createAttachmentHttpErrorFactory(createHttpError);
  const applicantFileStorageDirectoryPath = path.join(rootDir, applicantFileStorageDirName);
  const applicantPhotoStorageDirectoryPath = path.join(rootDir, applicantPhotoStorageDirName);
  const legacyApplicantPhotoStorageDirectoryPath = path.join(rootDir, "uploads", "applicant-photos");
  const examineePhotoStorageDirectoryPath = path.join(rootDir, examineePhotoStorageDirName);

  function normalizeApplicantPhotoPayload(photoPayload = {}) {
    if (!photoPayload || typeof photoPayload !== "object") {
      return null;
    }

    const base64 = String(photoPayload.base64 || "").trim();

    if (!base64) {
      return null;
    }

    const mimeType = String(photoPayload.mimeType || "").trim() || "application/octet-stream";
    const fileName = String(photoPayload.fileName || "").trim() || `photo-${Date.now()}`;

    return {
      base64,
      fileName,
      mimeType,
    };
  }

  function normalizeApplicantFilePayload(filePayload = {}) {
    if (!filePayload || typeof filePayload !== "object") {
      return null;
    }

    const base64 = String(filePayload.base64 || "").trim();

    if (!base64) {
      return null;
    }

    const mimeType = String(filePayload.mimeType || "").trim() || "application/octet-stream";
    const fileName = String(filePayload.fileName || "").trim() || `file-${Date.now()}`;

    return {
      base64,
      fileName,
      mimeType,
    };
  }

  function getApplicantStoredPhotoMimeType(extension = "") {
    const normalizedExtension = String(extension || "").trim().toLowerCase();

    if (normalizedExtension === ".png") {
      return "image/png";
    }

    if (normalizedExtension === ".jpg" || normalizedExtension === ".jpeg") {
      return "image/jpeg";
    }

    return "";
  }

  function sanitizeApplicantStoredFileNameSegment(value = "", fallbackValue = "file") {
    const normalizedValue = String(value || "")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/g, "");

    return normalizedValue || String(fallbackValue || "file").trim() || "file";
  }

  function resolveApplicantStoredPhotoExtension(photoValue = {}) {
    const supportedExtensions = new Set([".jpg", ".jpeg", ".png"]);
    const normalizedFileName = String(photoValue?.fileName || "").trim();
    const normalizedMimeType = String(photoValue?.mimeType || "").trim().toLowerCase();
    const fileExtension = path.extname(normalizedFileName).toLowerCase();

    if (supportedExtensions.has(fileExtension)) {
      return fileExtension;
    }

    if (normalizedMimeType === "image/png") {
      return ".png";
    }

    if (normalizedMimeType === "image/jpeg" || normalizedMimeType === "image/jpg") {
      return ".jpg";
    }

    throw httpError(400, "사진 파일 형식은 JPG, JPEG, PNG만 지원합니다.", "APPLICANT_PHOTO_MIME_INVALID");
  }

  function resolveApplicantStoredFileExtension(fileValue = {}) {
    const normalizedFileName = path.basename(String(fileValue?.fileName || "").trim());
    const fileExtension = path.extname(normalizedFileName);

    if (fileExtension) {
      return fileExtension;
    }

    const normalizedMimeType = String(fileValue?.mimeType || "").trim().toLowerCase();

    if (normalizedMimeType === "application/pdf") {
      return ".pdf";
    }

    if (normalizedMimeType === "application/zip") {
      return ".zip";
    }

    if (normalizedMimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return ".docx";
    }

    if (normalizedMimeType === "application/msword") {
      return ".doc";
    }

    if (normalizedMimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
      return ".xlsx";
    }

    if (normalizedMimeType === "application/vnd.ms-excel") {
      return ".xls";
    }

    if (normalizedMimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
      return ".pptx";
    }

    if (normalizedMimeType === "application/vnd.ms-powerpoint") {
      return ".ppt";
    }

    if (normalizedMimeType === "text/plain") {
      return ".txt";
    }

    if (normalizedMimeType === "image/png") {
      return ".png";
    }

    if (normalizedMimeType === "image/jpeg" || normalizedMimeType === "image/jpg") {
      return ".jpg";
    }

    return "";
  }

  function normalizeApplicantStoredPhotoValue(photoValue = {}) {
    const normalizedHasPhoto =
      photoValue?.hasPhoto === true || Number(photoValue?.hasPhoto) === 1 || Boolean(String(photoValue?.base64 || "").trim());

    if (!normalizedHasPhoto) {
      return {
        fileName: "",
        mimeType: "",
        hasPhoto: false,
      };
    }

    const extension = resolveApplicantStoredPhotoExtension(photoValue);
    const normalizedFileName = path.basename(String(photoValue?.fileName || "").trim());
    const baseFileName = path.basename(normalizedFileName, path.extname(normalizedFileName)).trim() || "photo";

    return {
      fileName: `${baseFileName}${extension}`,
      mimeType: getApplicantStoredPhotoMimeType(extension) || String(photoValue?.mimeType || "").trim() || "image/jpeg",
      hasPhoto: true,
    };
  }

  function normalizeApplicantStoredFileValue(fileValue = {}) {
    const normalizedHasFile =
      fileValue?.hasFile === true || Number(fileValue?.hasFile) === 1 || Boolean(String(fileValue?.base64 || "").trim());

    if (!normalizedHasFile) {
      return {
        fileName: "",
        mimeType: "",
        hasFile: false,
      };
    }

    const normalizedFileName = path.basename(String(fileValue?.fileName || "").trim());
    const resolvedExtension = resolveApplicantStoredFileExtension(fileValue);
    const baseFileName = sanitizeApplicantStoredFileNameSegment(
      path.basename(normalizedFileName, path.extname(normalizedFileName)).trim() || "file",
      "file",
    );

    return {
      fileName: `${baseFileName}${resolvedExtension}`,
      mimeType: String(fileValue?.mimeType || "").trim() || "application/octet-stream",
      hasFile: true,
    };
  }

  function buildStoredApplicantPhotoAnswerData(storedPhotoRecord = null, fallbackPhotoValue = {}) {
    const normalizedFallbackPhotoValue = normalizeApplicantStoredPhotoValue(fallbackPhotoValue);

    if (!storedPhotoRecord) {
      return normalizedFallbackPhotoValue;
    }

    return {
      fileName: String(storedPhotoRecord.fileName || "").trim(),
      mimeType: String(storedPhotoRecord.mimeType || "").trim() || normalizedFallbackPhotoValue.mimeType || "image/jpeg",
      hasPhoto: true,
    };
  }

  function buildStoredApplicantFileAnswerData(storedFileRecord = null, fallbackFileValue = {}) {
    const normalizedFallbackFileValue = normalizeApplicantStoredFileValue(fallbackFileValue);

    if (!storedFileRecord) {
      return normalizedFallbackFileValue;
    }

    return {
      fileName: String(storedFileRecord.fileName || "").trim(),
      mimeType: String(storedFileRecord.mimeType || "").trim() || normalizedFallbackFileValue.mimeType || "application/octet-stream",
      hasFile: true,
    };
  }

  function getApplicantStoredPhotoCandidateFileNames(examineeNo = "", photoName = "") {
    const normalizedExamineeNo = String(examineeNo || "").trim();
    const normalizedPhotoName = path.basename(String(photoName || "").trim());
    const photoExtension = path.extname(normalizedPhotoName).toLowerCase();

    return Array.from(
      new Set(
        [
          normalizedPhotoName,
          normalizedExamineeNo && photoExtension ? `${normalizedExamineeNo}${photoExtension}` : "",
          normalizedExamineeNo ? `${normalizedExamineeNo}.jpg` : "",
          normalizedExamineeNo ? `${normalizedExamineeNo}.jpeg` : "",
          normalizedExamineeNo ? `${normalizedExamineeNo}.png` : "",
        ].filter(Boolean),
      ),
    );
  }

  function getLegacyApplicantStoredPhotoCandidateFileNames(photoName = "") {
    const normalizedPhotoName = path.basename(String(photoName || "").trim());
    const photoExtension = path.extname(normalizedPhotoName).toLowerCase();
    const photoBaseName = path.basename(normalizedPhotoName, photoExtension).trim();

    return Array.from(
      new Set(
        [
          normalizedPhotoName,
          photoBaseName ? `${photoBaseName}.jpg` : "",
          photoBaseName ? `${photoBaseName}.jpeg` : "",
          photoBaseName ? `${photoBaseName}.png` : "",
        ].filter(Boolean),
      ),
    );
  }

  async function readStoredApplicantPhotoFile(submissionId, examineeNo = "", photoName = "", photoMime = "") {
    const normalizedSubmissionId = Number(submissionId);
    const candidateFileNames = getApplicantStoredPhotoCandidateFileNames(examineeNo, photoName);

    for (const candidateFileName of candidateFileNames) {
      const normalizedCandidateFileName = path.basename(String(candidateFileName || "").trim());
      const candidateFilePath = path.join(applicantPhotoStorageDirectoryPath, normalizedCandidateFileName);

      try {
        const photoBlob = await fs.promises.readFile(candidateFilePath);

        if (Buffer.isBuffer(photoBlob) && photoBlob.length > 0) {
          const fileExtension = path.extname(normalizedCandidateFileName).toLowerCase();

          return {
            photoBlob,
            photoMime: getApplicantStoredPhotoMimeType(fileExtension) || String(photoMime || "").trim() || "application/octet-stream",
            photoName: normalizedCandidateFileName,
          };
        }
      } catch (error) {
        if (error?.code !== "ENOENT") {
          throw error;
        }
      }
    }

    if (Number.isInteger(normalizedSubmissionId) && normalizedSubmissionId > 0) {
      const legacyPhotoDirectoryPath = path.join(legacyApplicantPhotoStorageDirectoryPath, String(normalizedSubmissionId));

      for (const candidateFileName of getLegacyApplicantStoredPhotoCandidateFileNames(photoName)) {
        const normalizedCandidateFileName = path.basename(String(candidateFileName || "").trim());
        const candidateFilePath = path.join(legacyPhotoDirectoryPath, normalizedCandidateFileName);

        try {
          const photoBlob = await fs.promises.readFile(candidateFilePath);

          if (Buffer.isBuffer(photoBlob) && photoBlob.length > 0) {
            const fileExtension = path.extname(normalizedCandidateFileName).toLowerCase();

            return {
              photoBlob,
              photoMime: getApplicantStoredPhotoMimeType(fileExtension) || String(photoMime || "").trim() || "application/octet-stream",
              photoName: normalizedCandidateFileName,
            };
          }
        } catch (error) {
          if (error?.code !== "ENOENT") {
            throw error;
          }
        }
      }
    }

    return null;
  }

  function getPromotedApplicantPhotoCandidateFileNames(examineeNo, photoName = "") {
    const normalizedExamineeNo = String(examineeNo || "").trim();
    const normalizedPhotoName = path.basename(String(photoName || "").trim());

    return Array.from(
      new Set(
        [
          normalizedPhotoName,
          normalizedExamineeNo ? `${normalizedExamineeNo}.jpg` : "",
          normalizedExamineeNo ? `${normalizedExamineeNo}.jpeg` : "",
          normalizedExamineeNo ? `${normalizedExamineeNo}.png` : "",
        ].filter(Boolean),
      ),
    );
  }

  async function readStoredPromotedPhotoFile(examineeNo, photoName = "") {
    const candidateFileNames = getPromotedApplicantPhotoCandidateFileNames(examineeNo, photoName);

    for (const candidateFileName of candidateFileNames) {
      const normalizedCandidateFileName = path.basename(String(candidateFileName || "").trim());
      const candidateFilePath = path.join(examineePhotoStorageDirectoryPath, normalizedCandidateFileName);

      try {
        const photoBlob = await fs.promises.readFile(candidateFilePath);

        if (Buffer.isBuffer(photoBlob) && photoBlob.length > 0) {
          const fileExtension = path.extname(normalizedCandidateFileName).toLowerCase();

          return {
            photoBlob,
            photoMime: getApplicantStoredPhotoMimeType(fileExtension) || "application/octet-stream",
            photoName: normalizedCandidateFileName,
          };
        }
      } catch (error) {
        if (error?.code !== "ENOENT") {
          throw error;
        }
      }
    }

    return null;
  }

  async function readStoredApplicantFile(fileName = "", fileMime = "") {
    const normalizedFileName = path.basename(String(fileName || "").trim());

    if (!normalizedFileName) {
      return null;
    }

    const candidateFilePath = path.join(applicantFileStorageDirectoryPath, normalizedFileName);

    try {
      const fileBlob = await fs.promises.readFile(candidateFilePath);

      if (Buffer.isBuffer(fileBlob) && fileBlob.length > 0) {
        return {
          fileBlob,
          fileMime: String(fileMime || "").trim() || "application/octet-stream",
          fileName: normalizedFileName,
        };
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }

    return null;
  }

  async function deleteStoredFileIfExists(filePath = "") {
    const normalizedFilePath = String(filePath || "").trim();

    if (!normalizedFilePath) {
      return 0;
    }

    try {
      await fs.promises.unlink(normalizedFilePath);
      return 1;
    } catch (error) {
      if (error?.code === "ENOENT") {
        return 0;
      }

      return 0;
    }
  }

  async function deleteApplicantStoredPhotoFiles(submissionId, examineeNo = "", photoName = "") {
    const normalizedSubmissionId = Number(submissionId);
    const candidateFileNames = Array.from(
      new Set(
        getApplicantStoredPhotoCandidateFileNames(examineeNo, photoName)
          .map((fileName) => path.basename(String(fileName || "").trim()))
          .filter(Boolean),
      ),
    );
    const currentDeleteResults = await Promise.all(
      candidateFileNames.map((fileName) => deleteStoredFileIfExists(path.join(applicantPhotoStorageDirectoryPath, fileName))),
    );
    let legacyDeleteResults = [];

    if (Number.isInteger(normalizedSubmissionId) && normalizedSubmissionId > 0) {
      const legacyPhotoDirectoryPath = path.join(legacyApplicantPhotoStorageDirectoryPath, String(normalizedSubmissionId));
      const legacyCandidateFileNames = Array.from(
        new Set(
          getLegacyApplicantStoredPhotoCandidateFileNames(photoName)
            .map((fileName) => path.basename(String(fileName || "").trim()))
            .filter(Boolean),
        ),
      );

      legacyDeleteResults = await Promise.all(
        legacyCandidateFileNames.map((fileName) => deleteStoredFileIfExists(path.join(legacyPhotoDirectoryPath, fileName))),
      );

      const remainingLegacyEntries = await fs.promises.readdir(legacyPhotoDirectoryPath).catch((error) => {
        if (error?.code === "ENOENT") {
          return null;
        }

        return null;
      });

      if (Array.isArray(remainingLegacyEntries) && remainingLegacyEntries.length === 0) {
        await fs.promises.rmdir(legacyPhotoDirectoryPath).catch(() => 0);
      }
    }

    return [...currentDeleteResults, ...legacyDeleteResults].reduce((total, value) => total + Number(value || 0), 0);
  }

  async function deleteApplicantStoredFileVariants(fileName = "") {
    const normalizedFileName = path.basename(String(fileName || "").trim());

    if (!normalizedFileName) {
      return 0;
    }

    const parsedFileName = path.parse(normalizedFileName);
    const siblingEntries = await fs.promises.readdir(applicantFileStorageDirectoryPath, { withFileTypes: true }).catch((error) => {
      if (error?.code === "ENOENT") {
        return [];
      }

      return [];
    });
    const candidateFileNames = siblingEntries
      .filter((entry) => entry.isFile() && path.parse(entry.name).name === parsedFileName.name)
      .map((entry) => entry.name);

    if (candidateFileNames.length === 0) {
      candidateFileNames.push(normalizedFileName);
    }

    const deleteResults = await Promise.all(
      Array.from(
        new Set(
          candidateFileNames
            .map((candidateFileName) => path.basename(String(candidateFileName || "").trim()))
            .filter(Boolean),
        ),
      ).map((candidateFileName) => deleteStoredFileIfExists(path.join(applicantFileStorageDirectoryPath, candidateFileName))),
    );

    return deleteResults.reduce((total, value) => total + Number(value || 0), 0);
  }

  function buildStoredApplicantPhotoRecord(examineeNo, photoValue = {}, options = {}) {
    const normalizedExamineeNo = String(examineeNo || "").trim();
    const normalizedPhotoValue = normalizeApplicantStoredPhotoValue(photoValue);
    const bufferedPhoto = Buffer.isBuffer(options.photoBuffer) ? options.photoBuffer : null;

    if (!normalizedExamineeNo || normalizedPhotoValue.hasPhoto !== true) {
      return null;
    }

    const extension = resolveApplicantStoredPhotoExtension(normalizedPhotoValue);
    const targetFileName = `${normalizedExamineeNo}${extension}`;
    const targetFilePath = path.join(applicantPhotoStorageDirectoryPath, targetFileName);
    const photoBuffer = bufferedPhoto || Buffer.from(String(photoValue.base64 || "").trim(), "base64");

    if (!Buffer.isBuffer(photoBuffer) || photoBuffer.length === 0) {
      throw httpError(400, "사진 파일 데이터가 없습니다.", "APPLICANT_PHOTO_BUFFER_EMPTY");
    }

    return {
      examineeNo: normalizedExamineeNo,
      fileName: targetFileName,
      filePath: targetFilePath,
      mimeType: getApplicantStoredPhotoMimeType(extension) || normalizedPhotoValue.mimeType || "image/jpeg",
      photoBuffer,
    };
  }

  async function persistApplicantPhotoFile(storedPhotoRecord = null) {
    if (!storedPhotoRecord?.filePath || !Buffer.isBuffer(storedPhotoRecord.photoBuffer) || storedPhotoRecord.photoBuffer.length === 0) {
      return null;
    }

    const normalizedFilePath = String(storedPhotoRecord.filePath || "").trim();
    const parsedFilePath = path.parse(normalizedFilePath);

    await fs.promises.mkdir(parsedFilePath.dir, { recursive: true });
    await fs.promises.writeFile(normalizedFilePath, storedPhotoRecord.photoBuffer);

    await Promise.all(
      [".jpg", ".jpeg", ".png"]
        .filter((candidateExtension) => candidateExtension !== parsedFilePath.ext)
        .map(async (candidateExtension) => {
          const candidatePath = path.join(parsedFilePath.dir, `${parsedFilePath.name}${candidateExtension}`);

          try {
            await fs.promises.unlink(candidatePath);
          } catch (error) {
            if (error?.code !== "ENOENT") {
              throw error;
            }
          }
        }),
    );

    return storedPhotoRecord;
  }

  function buildStoredApplicantFileRecord(examineeNo, questionText = "", fieldKey = "", fileValue = {}, options = {}) {
    if (!isAllowedUploadExtension(fileValue.fileName, options.allowedExtensions)) {
      throw httpError(400, `${questionText}: ${options.allowedExtensions.join(", ")} 파일만 업로드할 수 있습니다.`, "APPLICANT_FILE_EXTENSION_INVALID");
    }
    const normalizedExamineeNo = String(examineeNo || "").trim();
    const normalizedFileValue = normalizeApplicantStoredFileValue(fileValue);
    const bufferedFile = Buffer.isBuffer(options.fileBuffer) ? options.fileBuffer : null;

    if (!normalizedExamineeNo || normalizedFileValue.hasFile !== true) {
      return null;
    }

    const sanitizedQuestionTitle = sanitizeApplicantStoredFileNameSegment(questionText, fieldKey || "file");
    const extension = resolveApplicantStoredFileExtension(normalizedFileValue);
    const customBase = options.fileNamePattern ? formatUploadFileBaseName(options.fileNamePattern, {
      "수험번호": normalizedExamineeNo, "질문제목": questionText,
      "원본파일명": path.parse(path.basename(normalizedFileValue.fileName)).name,
    }) : "";
    const uniqueKey = createHash("sha256").update(JSON.stringify([normalizedExamineeNo, fieldKey])).digest("hex").slice(0, 16);
    const targetFileName = customBase ? `${customBase}_${uniqueKey}${extension}` : `${normalizedExamineeNo}_${sanitizedQuestionTitle}${extension}`;
    const filePath = path.join(applicantFileStorageDirectoryPath, targetFileName);
    const fileBuffer = bufferedFile || Buffer.from(String(fileValue?.base64 || "").trim(), "base64");

    if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
      throw httpError(400, "첨부 파일 데이터가 없습니다.", "APPLICANT_FILE_BUFFER_EMPTY");
    }

    return {
      fieldKey: String(fieldKey || "").trim(),
      questionText: String(questionText || "").trim(),
      fileName: targetFileName,
      filePath,
      mimeType: normalizedFileValue.mimeType || "application/octet-stream",
      fileBuffer,
    };
  }

  async function persistApplicantFile(storedFileRecord = null) {
    if (!storedFileRecord?.filePath || !Buffer.isBuffer(storedFileRecord.fileBuffer) || storedFileRecord.fileBuffer.length === 0) {
      return null;
    }

    const normalizedFilePath = String(storedFileRecord.filePath || "").trim();
    const parsedFilePath = path.parse(normalizedFilePath);

    await fs.promises.mkdir(parsedFilePath.dir, { recursive: true });
    await fs.promises.writeFile(normalizedFilePath, storedFileRecord.fileBuffer);

    const siblingEntries = await fs.promises.readdir(parsedFilePath.dir, { withFileTypes: true }).catch((error) => {
      if (error?.code === "ENOENT") {
        return [];
      }

      throw error;
    });

    await Promise.all(
      siblingEntries
        .filter((entry) => entry.isFile() && path.parse(entry.name).name === parsedFilePath.name && entry.name !== parsedFilePath.base)
        .map(async (entry) => {
          const candidatePath = path.join(parsedFilePath.dir, entry.name);

          try {
            await fs.promises.unlink(candidatePath);
          } catch (error) {
            if (error?.code !== "ENOENT") {
              throw error;
            }
          }
        }),
    );

    return storedFileRecord;
  }

  async function deleteApplicantSubmissionArtifacts(submission = null) {
    const normalizedSubmission = submission && typeof submission === "object" ? submission : null;

    if (!normalizedSubmission) {
      return {
        deletedApplicantPhotoCount: 0,
        deletedApplicantFileCount: 0,

      };
    }

    const answerItems = Array.isArray(normalizedSubmission.answerItems) ? normalizedSubmission.answerItems : [];
    const photoAnswerItem = answerItems.find((answerItem) => answerItem?.inputType === "photo") || null;
    const fileNames = Array.from(
      new Set(
        answerItems
          .filter((answerItem) => answerItem?.inputType === "file")
          .map((answerItem) => path.basename(String(answerItem?.value?.fileName || "").trim()))
          .filter(Boolean),
      ),
    );
    const deletedApplicantPhotoCount = await deleteApplicantStoredPhotoFiles(
      normalizedSubmission.id,
      normalizedSubmission.promotedExamineeNo,
      photoAnswerItem?.value?.fileName || normalizedSubmission.internalPhotoValue?.fileName || "",
    );
    const deletedApplicantFileResults = await Promise.all(
      fileNames.map((fileName) => deleteApplicantStoredFileVariants(fileName)),
    );

    return {
      deletedApplicantPhotoCount,
      deletedApplicantFileCount: deletedApplicantFileResults.reduce((total, value) => total + Number(value || 0), 0),

    };
  }

  return Object.freeze({

    buildStoredApplicantFileAnswerData,
    buildStoredApplicantFileRecord,
    buildStoredApplicantPhotoAnswerData,
    buildStoredApplicantPhotoRecord,

    deleteApplicantStoredFileVariants,
    deleteApplicantStoredPhotoFiles,
    deleteApplicantSubmissionArtifacts,
    getApplicantStoredPhotoMimeType,
    normalizeApplicantFilePayload,
    normalizeApplicantPhotoPayload,
    normalizeApplicantStoredFileValue,
    normalizeApplicantStoredPhotoValue,
    persistApplicantFile,
    persistApplicantPhotoFile,

    readStoredApplicantFile,
    readStoredApplicantPhotoFile,
    readStoredPromotedPhotoFile,
    resolveApplicantStoredFileExtension,
    resolveApplicantStoredPhotoExtension,
    sanitizeApplicantStoredFileNameSegment,
  });
}

module.exports = {
  createApplicantAttachmentStorage,
};
