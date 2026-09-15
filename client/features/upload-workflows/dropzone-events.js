(function (globalScope, factory) {
  const dropzoneEvents = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = dropzoneEvents;
    return;
  }

  globalScope.AdmitCardUploadDropzoneEvents = dropzoneEvents;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function isAcceptedUploadFile(inputElement, file) {
    const acceptedTypes = String(inputElement?.accept || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (acceptedTypes.length === 0 || !file) {
      return true;
    }

    const fileName = String(file.name || "").toLowerCase();
    const mimeType = String(file.type || "").toLowerCase();

    return acceptedTypes.some((acceptedType) => {
      if (acceptedType.startsWith(".")) {
        return fileName.endsWith(acceptedType);
      }

      if (acceptedType.endsWith("/*")) {
        return mimeType.startsWith(acceptedType.slice(0, -1));
      }

      return mimeType === acceptedType;
    });
  }

  function createUploadDropzoneController({ getState, showInvalidFileToast } = {}) {
    function resolveState(inputId = "") {
      const state = typeof getState === "function" ? getState(String(inputId || "").trim()) : null;

      return {
        inputElement: state?.inputElement || null,
        labelElement: state?.labelElement || null,
        emptyLabel: String(state?.emptyLabel || "").trim(),
      };
    }

    function syncUploadDropzoneLabel(inputId = "") {
      const { inputElement, labelElement, emptyLabel } = resolveState(inputId);

      if (!inputElement || !labelElement) {
        return;
      }

      labelElement.textContent = inputElement.files?.[0]?.name || emptyLabel;
    }

    function assignDroppedFileToUploadInput(inputId = "", fileList = []) {
      const { inputElement } = resolveState(inputId);
      const nextFile = Array.from(fileList || []).find(Boolean) || null;

      if (!inputElement || !nextFile) {
        return;
      }

      if (!isAcceptedUploadFile(inputElement, nextFile)) {
        showInvalidFileToast?.("허용되지 않는 파일 형식입니다.");
        return;
      }

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(nextFile);
      inputElement.files = dataTransfer.files;
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function bindFileInputChange(inputId = "", onChange) {
      const { inputElement, labelElement } = resolveState(inputId);

      if (!inputElement || !labelElement) {
        return;
      }

      inputElement.addEventListener("change", () => {
        syncUploadDropzoneLabel(inputId);
        onChange?.();
      });
    }

    function bindUploadDropzones(root = document) {
      root.querySelectorAll("[data-upload-dropzone]").forEach((dropzone) => {
        dropzone.addEventListener("dragover", (event) => {
          event.preventDefault();
          dropzone.classList.add("is-dragover");

          if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "copy";
          }
        });

        dropzone.addEventListener("dragenter", (event) => {
          event.preventDefault();
          dropzone.classList.add("is-dragover");
        });

        dropzone.addEventListener("dragleave", (event) => {
          const relatedTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;

          if (relatedTarget && dropzone.contains(relatedTarget)) {
            return;
          }

          dropzone.classList.remove("is-dragover");
        });

        dropzone.addEventListener("drop", (event) => {
          event.preventDefault();
          dropzone.classList.remove("is-dragover");
          assignDroppedFileToUploadInput(dropzone.dataset.uploadDropzone, event.dataTransfer?.files || []);
        });
      });
    }

    return Object.freeze({
      assignDroppedFileToUploadInput,
      bindFileInputChange,
      bindUploadDropzones,
      syncUploadDropzoneLabel,
    });
  }

  return Object.freeze({
    createUploadDropzoneController,
    isAcceptedUploadFile,
  });
});
