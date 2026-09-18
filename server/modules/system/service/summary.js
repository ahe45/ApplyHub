function createSystemSummaryService({
  formatDateAsYmd,
  getAccounts,
  getApplicantFormTemplates,
  getApplicantFormFields,
  getApplicantRecruitmentUnits,
  getApplicantNoticeHtml,
  getApplicantSchedules,
  getApplicantSettings,
  getApplicantSubmissions,
  getExaminees,
  getLoginNoticeHtml,
  getPrintHistory,
  getSystemBackupAutomationSettings,
  getSuperAdminSettings,
  getSystemSettings,
  getTemplates,
  query,
}) {
  async function getSummary() {
    const [examineeSummary] = await query(`SELECT COUNT(DISTINCT id) AS registeredExaminees FROM app_subm`);
    const [printSummary] = await query(`SELECT COUNT(*) AS totalPrints FROM print_log`);
    const [todayPrintSummary] = await query(`
      SELECT COUNT(*) AS todayPrints
      FROM print_log
      WHERE DATE(printed_at) = CURDATE()
    `);

    return {
      registeredExaminees: Number(examineeSummary?.registeredExaminees || 0),
      totalPrints: Number(printSummary?.totalPrints || 0),
      todayPrints: Number(todayPrintSummary?.todayPrints || 0),
    };
  }

  async function getBootstrapPayload() {
    const [examinees, printHistory, templates, accounts, summary, systemSettings, systemBackupAutomation, superAdminSettings, loginNoticeHtml, applicantNoticeHtml, applicantFormFields, applicantRecruitmentUnits, applicantSchedules, applicantSubmissions, applicantSettings] = await Promise.all([
      getExaminees(),
      getPrintHistory(),
      getTemplates(),
      getAccounts(),
      getSummary(),
      getSystemSettings(),
      getSystemBackupAutomationSettings(),
      getSuperAdminSettings(),
      getLoginNoticeHtml(),
      getApplicantNoticeHtml(),
      getApplicantFormFields(),
      getApplicantRecruitmentUnits(),
      getApplicantSchedules(),
      getApplicantSubmissions(),
      getApplicantSettings(),
    ]);

    return {
      applicantManager: {
        formTemplates: await getApplicantFormTemplates(),
        fields: applicantFormFields,
        recruitmentUnits: applicantRecruitmentUnits,
        schedules: applicantSchedules,
        settings: applicantSettings,
        submissions: applicantSubmissions,
      },
      examinees,
      printHistory,
      templates,
      accounts,
      summary,
      systemSettings,
      systemBackupAutomation,
      superAdminSettings,
      loginNoticeHtml,
      applicantNoticeHtml,
      loginNoticeHtmlEn: await getLoginNoticeHtml("login", "en"),
      applicantNoticeHtmlEn: await getLoginNoticeHtml("applicant", "en"),
      serverDate: formatDateAsYmd(new Date()),
      serverTime: Date.now(),
    };
  }

  return Object.freeze({
    getBootstrapPayload,
    getSummary,
  });
}

module.exports = {
  createSystemSummaryService,
};
