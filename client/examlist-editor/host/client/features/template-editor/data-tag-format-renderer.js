import { escapeHtml } from "../../app/html-utils.js";
import {
  getDataTagFormatInputError,
  getDataTagFormatOptions,
  getDataTagFormatTokenGuides,
  renderDataTagFormatPreview,
} from "./data-tag-format-options.js";

function renderFormatPresetSelect(modalState) {
  const draftFormat = String(modalState.draftFormat || "").trim();
  const formatOptions = getDataTagFormatOptions(modalState.formatType);
  const hasMatchingPreset = formatOptions.some((option) => option.value === draftFormat);

  return `
    <label class="data-tag-format-field data-tag-format-preset-field">
      <span class="data-tag-format-field-label">프리셋</span>
      <select class="data-tag-format-select data-tag-format-preset-select" data-data-tag-format-field="preset">
        ${
          !hasMatchingPreset && draftFormat
            ? '<option value="__custom__" selected disabled>직접 입력 중</option>'
            : ""
        }
        ${formatOptions
          .map((option) => `
            <option value="${escapeHtml(option.value)}" ${option.value === draftFormat ? "selected" : ""}>
              ${escapeHtml(option.preview)}
            </option>
          `)
          .join("")}
      </select>
    </label>
  `;
}

function renderTokenGuide(modalState) {
  const tokenGuides = getDataTagFormatTokenGuides(modalState.formatType);

  if (!tokenGuides.length) {
    return "";
  }

  return `
    <div class="data-tag-format-token-guide">
      <p class="data-tag-format-token-guide-title">토큰 가이드</p>
      <div class="data-tag-format-token-grid">
        ${tokenGuides
          .map((guide) => `
            <div class="data-tag-format-token-row">
              <code>${escapeHtml(guide.token)}</code>
              <span>${escapeHtml(guide.description)}</span>
              <small>${escapeHtml(guide.example)}</small>
            </div>
          `)
          .join("")}
      </div>
    </div>
  `;
}

function renderFormatEditor(modalState) {
  const draftFormat = String(modalState.draftFormat || "");
  const errorMessage = String(modalState.errorMessage || getDataTagFormatInputError(modalState.formatType, draftFormat) || "");
  const previewText = errorMessage ? "" : renderDataTagFormatPreview(modalState.formatType, draftFormat);

  return `
    ${renderFormatPresetSelect(modalState)}
    <div class="data-tag-format-editor">
      <label class="data-tag-format-field">
        <span class="data-tag-format-field-label">데이터 형식</span>
        <input
          class="data-tag-format-input"
          data-data-tag-format-field="format"
          data-data-tag-format-type="${escapeHtml(modalState.formatType || "")}"
          type="text"
          value="${escapeHtml(draftFormat)}"
          maxlength="60"
          autocomplete="off"
          spellcheck="false"
          placeholder="${modalState.formatType === "time" ? "HH:mm" : "YYYY.MM.DD (ddd)"}"
          aria-describedby="dataTagFormatHelp"
        />
      </label>
      <div class="data-tag-format-preview" id="dataTagFormatHelp">
        <span>예시 결과</span>
        <strong data-data-tag-format-preview-value>${escapeHtml(previewText || "형식을 입력하면 예시가 표시됩니다.")}</strong>
      </div>
      <p class="data-tag-format-error${errorMessage ? "" : " hidden"}" data-data-tag-format-error>${escapeHtml(errorMessage)}</p>
    </div>
    ${renderTokenGuide(modalState)}
    <p class="data-tag-format-note">
      프리셋을 선택하면 데이터 형식 입력란에 자동으로 채워집니다. 입력된 형식은 자유롭게 수정할 수 있으며, 원본 업로드 값은 변경하지 않습니다.
    </p>
  `;
}

export function renderDataTagFormatModal(editor = {}) {
  const modalState = editor.dataTagFormatModal || {};

  if (!modalState.isOpen || !modalState.isSupported) {
    return "";
  }

  const tagLabel = String(modalState.tagLabel || modalState.tagKey || "").trim();
  const hasError = Boolean(modalState.errorMessage || getDataTagFormatInputError(modalState.formatType, modalState.draftFormat || ""));

  return `
    <div class="modal-overlay data-tag-format-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dataTagFormatModalTitle">
      <div class="modal-card data-tag-format-modal-card">
        <div class="modal-header">
          <div>
            <p class="modal-kicker">데이터태그 형식</p>
            <h2 id="dataTagFormatModalTitle">${escapeHtml(tagLabel || "데이터태그")}</h2>
          </div>
          <button class="icon-button" data-action="close-data-tag-format-modal" type="button" aria-label="닫기">×</button>
        </div>

        <div class="data-tag-format-modal-body">
          ${renderFormatEditor(modalState)}
        </div>

        <div class="modal-actions data-tag-format-modal-actions">
          <button class="ghost-button" data-action="close-data-tag-format-modal" type="button">취소</button>
          <button class="primary-button" data-action="save-data-tag-format-modal" type="button" ${!hasError ? "" : "disabled"}>적용</button>
        </div>
      </div>
    </div>
  `;
}
