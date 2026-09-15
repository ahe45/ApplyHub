(function (scope, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else scope.AdmitCardDashboardData = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const FILTER_KEYS = ["track", "admission", "series"];
  const scheduleTypes = [
    { label: "원서접수", key: "applicantSchedule" },
    { label: "서류 제출", key: "documentSubmissionSchedule" },
    { label: "수험표 조회", key: "admitCardLookupSchedule" },
  ];
  const koreaDate = (now = Date.now()) => new Date(Number(now) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const matchesFilters = (row, filters = {}) => FILTER_KEYS.every(key => !filters[key] || row[key] === filters[key]);
  const requiredDocumentFields = (fields = []) => fields.filter(field =>
    field.formScope === "documents" && field.active !== false && field.active !== 0 && field.required === true);
  function hasAnswer(answer, field) {
    if (field.inputType === "file") return answer?.hasFile === true && Boolean(String(answer.fileName || "").trim());
    if (Array.isArray(answer)) return answer.length > 0;
    return answer != null && String(answer).trim() !== "";
  }
  function isMissingDocuments(submission, requiredFields) {
    return requiredFields.some(field => {
      const answer = submission.answerMap?.[field.fieldKey] ?? submission.answerItems?.find(item => item.fieldKey === field.fieldKey)?.value;
      return !hasAnswer(answer, field);
    });
  }
  function historyUrl(mode = "all", filters = {}, today = koreaDate()) {
    const params = new URLSearchParams({ dashboard: mode });
    for (const key of FILTER_KEYS) if (filters[key]) params.set(key, filters[key]);
    if (mode === "today") params.set("date", today);
    return `/applicant-history?${params}`;
  }
  function readHistoryFilter(search = "") {
    const params = new URLSearchParams(search);
    const mode = params.get("dashboard");
    if (!["all", "today", "documents"].includes(mode)) return null;
    return { mode, date: params.get("date") || koreaDate(), ...Object.fromEntries(FILTER_KEYS.map(key => [key, params.get(key) || ""])) };
  }
  function filterHistoryRows(rows, fields, filter) {
    if (!filter) return rows;
    const required = requiredDocumentFields(fields);
    return rows.filter(row => matchesFilters(row, filter) &&
      (filter.mode !== "today" || String(row.createdAt || "").slice(0, 10) === filter.date) &&
      (filter.mode !== "documents" || isMissingDocuments(row, required)));
  }
  function schedulePeriod(schedule, type, now) {
    const start = String(schedule[`${type.key}StartAt`] || "");
    const end = String(schedule[`${type.key}EndAt`] || "");
    const timestamp = value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? Date.parse(`${value}:00+09:00`) : NaN;
    const startAt = timestamp(start);
    const endAt = timestamp(end) + 59999;
    const configured = Number.isFinite(startAt) && Number.isFinite(endAt) && endAt >= startAt;
    const status = !configured ? "unset" : now < startAt ? "upcoming" : now > endAt ? "ended" : "open";
    return { label: type.label, start, end, startAt, endAt, status,
      statusLabel: { unset: "미설정", upcoming: "시작 전", ended: "종료", open: "진행 중" }[status] };
  }
  function buildDashboardData(manager = {}, filters = {}, now = Date.now()) {
    const today = koreaDate(now);
    const submissions = (manager.submissions || []).filter(row => matchesFilters(row, filters));
    const required = requiredDocumentFields(manager.fields);
    const todayRows = submissions.filter(row => String(row.createdAt || "").slice(0, 10) === today);
    const days = Array.from({length: 7}, (_, index) => ({ date: koreaDate(now - (6 - index) * 86400000), count: 0 }));
    const daysByDate = new Map(days.map(day => [day.date, day]));
    for (const row of submissions) {
      const day = daysByDate.get(String(row.createdAt || "").slice(0, 10));
      if (day) day.count++;
    }
    const schedules = (manager.schedules || []).filter(schedule =>
      (!filters.track || schedule.trackName === filters.track) &&
      (!filters.admission || schedule.admissionName === filters.admission) &&
      (!filters.series || (manager.recruitmentUnits || []).some(unit =>
        unit.trackName === schedule.trackName && unit.admissionName === schedule.admissionName && unit.seriesName === filters.series))
    ).map(schedule => ({ ...schedule, periods: scheduleTypes.map(type => schedulePeriod(schedule, type, now)) }));
    const rank = schedule => {
      const open = schedule.periods.filter(period => period.status === "open");
      if (open.length) return [0, Math.min(...open.map(period => period.endAt))];
      const upcoming = schedule.periods.filter(period => period.status === "upcoming");
      if (upcoming.length) return [1, Math.min(...upcoming.map(period => period.startAt))];
      return [2, -Math.max(0, ...schedule.periods.map(period => period.endAt).filter(Number.isFinite))];
    };
    schedules.sort((a,b) => rank(a)[0] - rank(b)[0] || rank(a)[1] - rank(b)[1] || Number(a.id) - Number(b.id));
    return { today, total: submissions.length, todayCount: todayRows.length,
      missingCount: submissions.filter(row => isMissingDocuments(row, required)).length,
      hasRequiredDocuments: required.length > 0, days,
      recent: [...submissions].sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)) || Number(b.id) - Number(a.id)).slice(0,5),
      schedule: schedules[0] || null, scheduleCount: schedules.length };
  }
  return Object.freeze({ buildDashboardData, requiredDocumentFields, isMissingDocuments, historyUrl, readHistoryFilter, filterHistoryRows, koreaDate, schedulePeriod });
});
