(function (globalScope, factory) {
  const api = factory(globalScope.AdmitCardUploadDropzoneEvents || (typeof require === 'function' ? require('./dropzone-events') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else globalScope.AdmitCardUploadDropzoneBindings = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, dropzoneEvents => {
  function createUploadDropzoneBindingsController({applicantUnitUploadFileInput, applicantUnitUploadFileName, previewApplicantRecruitmentUnitUploadFile, showToast}) {
    const controller = dropzoneEvents.createUploadDropzoneController({
      getState: inputId => inputId === 'applicantUnitUploadFileInput' ? {
        inputElement: applicantUnitUploadFileInput, labelElement: applicantUnitUploadFileName,
        emptyLabel: '선택된 데이터 파일이 없습니다.',
      } : null,
      showInvalidFileToast: message => showToast(message, 'error'),
    });
    function bindUploadInputs() {
      controller.bindFileInputChange('applicantUnitUploadFileInput', () => {void previewApplicantRecruitmentUnitUploadFile();});
      controller.bindUploadDropzones();
    }
    return Object.freeze({bindUploadInputs, bindUploadDropzoneEvents: bindUploadInputs});
  }
  return Object.freeze({createUploadDropzoneBindingsController});
});
