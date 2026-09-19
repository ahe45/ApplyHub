(function (scope, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./data"));
  else scope.AdmitCardDashboardRenderers = factory(scope.AdmitCardDashboardData);
})(typeof globalThis !== "undefined" ? globalThis : this, (data) => {
  function createDashboardRenderer({ escapeHtml: esc, state, isViewAccessible = () => true }) {
    const count = value => Number(value || 0).toLocaleString("ko-KR");
    const shortDate = value => value ? `${value.slice(5,7)}.${value.slice(8,10)} ${value.slice(11,16)}` : "—";
    function renderDashboard() {
      const info = { ...data.buildDashboardData({...state.applicantManager,submissions:[]}, state.headerFilters, Date.now() + (state.bootstrap.serverTimeOffsetMs || 0)), ...globalThis.AdmitCardRemoteGrids?.dashboard() };
      const canViewHistory = isViewAccessible("applicantHistory");
      const url = mode => esc(data.historyUrl(mode, state.headerFilters, info.today));
      const metric = (mode, label, value, detail) => {
        const tag = canViewHistory ? "a" : "article";
        return `<${tag} class="metric-card dashboard-metric" ${canViewHistory ? `href="${url(mode)}"` : ""}>
          <span class="dashboard-metric-label">${label}</span><strong data-dashboard-metric="${mode}">${count(value)}<small>건</small></strong>
          <span class="dashboard-metric-caption">${detail}</span></${tag}>`;
      };
      const maxCount = Math.max(1, ...info.days.map(day => day.count));
      const graph = info.days.map(day => `<div class="dashboard-day${day.date === info.today ? " is-today" : ""}" aria-label="${day.date} 접수 ${day.count}건">
        <span class="dashboard-day-count">${count(day.count)}</span>
        <div class="dashboard-day-track"><span class="dashboard-day-bar" style="height:${day.count / maxCount * 100}%"></span></div>
        <span class="dashboard-day-label">${day.date === info.today ? "오늘" : `${Number(day.date.slice(5,7))}/${Number(day.date.slice(8,10))}`}</span>
      </div>`).join("");
      const schedule = info.schedule;
      const scheduleMarkup = schedule ? `<p class="dashboard-schedule-name">${esc([schedule.trackName, schedule.admissionName].filter(Boolean).join(" · "))}</p>
        <div class="dashboard-schedule-list">${schedule.periods.map(period => `<div class="dashboard-schedule-item">
          <div><strong>${period.label}</strong><span class="dashboard-schedule-date">${period.status === "unset" ? "일정이 설정되지 않았습니다." : `${esc(shortDate(period.start))} ~ ${esc(shortDate(period.end))}`}</span></div>
          <span class="dashboard-status is-${period.status}">${period.statusLabel}</span>
        </div>`).join("")}</div>` : `<div class="dashboard-empty">선택한 모집 범위에 등록된 일정이 없습니다.</div>`;
      const recent = info.recent.map(row => `<tr ${canViewHistory ? `data-dashboard-submission="${Number(row.id)}"` : ""}>
        <td>${esc(shortDate(row.createdAt))}</td><td>${canViewHistory ? `<button class="dashboard-detail-link" type="button" data-applicant-submission-toggle="${Number(row.id)}" aria-label="${esc(row.name)} 접수 상세 보기">${esc(row.examineeNo || "미부여")}</button>` : esc(row.examineeNo || "미부여")}</td>
        <td>${esc(row.name)}</td><td>${esc(row.admission || "—")}</td></tr>`).join("");
      const filters = [["headerTrack", "모집시기"], ["headerAdmission", "전형"], ["headerSeries", "계열"]]
        .map(([id,label]) => `<div class="field"><label for="${id}">${label}</label><select id="${id}" aria-label="${label}"><option value="">전체</option></select></div>`).join("");
      return `<section class="view-stack dashboard-view">
        <div class="section-header"><h3>대시보드</h3><span class="dashboard-date">${esc(info.today.replaceAll("-", "."))} 기준</span></div>
        <div class="dashboard-filters" aria-label="모집 범위">${filters}</div>
        <section class="metric-grid dashboard-metrics" aria-label="접수 요약">
          ${metric("all", "전체 접수", info.total, "선택한 모집 범위의 누적 접수")}
          ${metric("today", "오늘 접수", info.todayCount, "오늘 새로 접수한 원서")}
          ${metric("documents", "서류 미제출", info.missingCount, info.hasRequiredDocuments ? "필수 서류가 부족한 접수" : "등록된 필수 서류가 없습니다")}
        </section>
        <section class="dashboard-chart-grid">
          <article class="panel-card dashboard-chart-card"><div class="section-header"><h3>최근 7일 접수</h3><span class="dashboard-date">총 ${count(info.days.reduce((sum,day) => sum + day.count,0))}건</span></div>
            <div class="dashboard-week-chart" role="group" aria-label="최근 7일 날짜별 접수 건수">${graph}</div>
          </article>
          <article class="panel-card dashboard-chart-card"><div class="section-header"><h3>주요 일정</h3>${isViewAccessible("applicantScheduleManagement") ? `<a class="dashboard-text-link" href="/applicant-schedules">전체 보기${info.scheduleCount > 1 ? ` · ${info.scheduleCount}개 전형` : ""}</a>` : ""}</div>${scheduleMarkup}</article>
        </section>
        <article class="panel-card dashboard-recent"><div class="section-header"><h3>최근 접수</h3>${canViewHistory ? `<a class="dashboard-text-link" href="${url("all")}">접수 이력 전체 보기</a>` : ""}</div>
          ${recent ? `<div class="dashboard-table-scroll"><table class="dashboard-recent-table"><thead><tr><th scope="col">접수 일시</th><th scope="col">수험번호</th><th scope="col">이름</th><th scope="col">전형</th></tr></thead><tbody>${recent}</tbody></table></div>` : '<div class="dashboard-empty">아직 접수된 원서가 없습니다.</div>'}
        </article>
      </section>`;
    }
    return Object.freeze({ renderDashboard });
  }
  return Object.freeze({ createDashboardRenderer });
});
