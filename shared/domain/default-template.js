(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  globalScope.AdmitCardTemplateEditorDefaultContent = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createDefaultTemplateContentBuilder({ buildTemplateTokenHtml }) {
    return function getDefaultTemplateContent() {
      const token = (label) => buildTemplateTokenHtml(`@{${label}}`);
      const cellStyle = "border: 1px solid #5b6e8f; padding: 12px 10px;";
      const pairs = [["수험번호", "모집시기"], ["이름", "전형"], ["생년월일", "계열"], ["모집단위", "전공"]];
      const rows = pairs.map((labels, index) => `<tr>
        ${index === 0 ? `<td rowspan="4" style="${cellStyle} text-align: center;">${token("수험생사진")}</td>` : ""}
        ${labels.map(label => `<th style="${cellStyle} background: #f6f8fc;">${label}</th><td style="${cellStyle}">${token(label)}</td>`).join("")}
      </tr>`).join("");
      return `<div class="template-doc" style="color: #16233b; font-family: 'Noto Sans KR', sans-serif;">
        <h1 style="text-align: center; margin: 24px 0 32px; font-size: 42px;">수험표</h1>
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 15px;">
          <colgroup><col style="width: 22%;" /><col style="width: 16%;" /><col style="width: 23%;" /><col style="width: 16%;" /><col style="width: 23%;" /></colgroup>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top: 24px; font-size: 14px; line-height: 1.7;">
          <p style="margin: 0; font-weight: 700;">[안내사항]</p>
          <p style="margin: 0;">수험번호와 지원 정보를 확인해 주세요.</p>
          <p style="margin: 0;">자세한 전형 안내는 입학처 공지를 확인해 주세요.</p>
        </div>
        <p style="margin-top: 32px; text-align: right;">출력일: ${token("현재날짜")}</p>
      </div>`;
    };
  }
  return Object.freeze({ createDefaultTemplateContentBuilder });
});
