(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardExamineePageRenderers = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {

  function renderAdmitCardLookup() {
    const filters = state.lookupFilters;
    const optionMap = getLookupOptionMap();

    return `
      <section class="view-stack lookup-view-stack" id="admitCardLookupViewMount">
        <article class="form-card lookup-filter-card">
          <div class="section-header">
            <div class="menu-section-copy">
              <h3>수험표 출력</h3>
              <p>접수 이력을 검색하고 단건 또는 일괄 수험표를 출력합니다.</p>
            </div>
          </div>

          <div class="search-grid five">
            <div class="field">
              <label for="searchTrack">모집시기</label>
              <select id="searchTrack">
                ${buildOptionMarkup(optionMap.track, filters.track)}
              </select>
            </div>
            <div class="field">
              <label for="searchAdmission">전형</label>
              <select id="searchAdmission">
                ${buildOptionMarkup(optionMap.admission, filters.admission)}
              </select>
            </div>
            <div class="field">
              <label for="searchSeries">계열</label>
              <select id="searchSeries">
                ${buildOptionMarkup(optionMap.series, filters.series)}
              </select>
            </div>
            <div class="field">
              <label for="searchUnit">모집단위</label>
              <select id="searchUnit">
                ${buildOptionMarkup(optionMap.unit, filters.unit)}
              </select>
            </div>
            <div class="field">
              <label for="searchMajor">전공</label>
              <select id="searchMajor">
                ${buildOptionMarkup(optionMap.major, filters.major)}
              </select>
            </div>
          </div>

          <div class="search-grid four lookup-search-grid-actions">
            <div class="field">
              <label for="searchExamineeNo">수험번호</label>
              <input
                id="searchExamineeNo"
                value="${escapeAttribute(filters.examineeNo)}"
                placeholder="수험번호 전체 또는 일부를 입력하세요"
              />
            </div>
            <div class="field">
              <label for="searchExamineeName">이름</label>
              <input
                id="searchExamineeName"
                value="${escapeAttribute(filters.examineeName)}"
                placeholder="이름 전체 또는 일부를 입력하세요"
              />
            </div>
            <div class="lookup-filter-actions" aria-label="수험표 출력 작업">
              ${renderBatchPrintButton()}
              <button class="outline-button" data-reset-lookup="true" type="button">초기화</button>
            </div>
          </div>
        </article>

        ${renderAdmitCardLookupGridSection()}
      </section>
    `;
  }

  function renderAdmitCardLookupGridSection() {
    return `
      <div id="admitCardLookupResultMount" class="table-view-mount">
        ${renderExamineeResultTable({
          title: "검색 결과",
          gridKey: "admitCardLookupGrid",
          showPrintColumn: true,
          showRowNumber: true,
          checkboxFirst: true,
          showSectionHeader: false,
        })}
      </div>
    `;
  }

  return {
    renderAdmitCardLookup,
    renderAdmitCardLookupGridSection,

  };
});
