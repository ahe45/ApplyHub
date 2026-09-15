function getDefaultLoginNoticeHtml(initialPassword = "1111") {
  return [
    '<p><span style="display:inline-flex;padding:3px 8px;border-radius:6px;background:#2f63c8;color:#fff;font-weight:800;">계정 안내</span></p>',
    "<p>수험생은 인증한 이메일과 비밀번호로, 관리자는 기존 ID와 비밀번호로 로그인하세요.</p>",
    "<p>처음 방문한 수험생은 회원가입 후 접수를 진행해 주세요.</p>",
    "<p>관리자 계정은 부여된 권한에 맞는 관리 화면으로 이동합니다.</p>",
  ].join("");
}

function getDefaultApplicantNoticeHtml() {
  return [
    '<p><span style="display:inline-flex;padding:3px 8px;border-radius:6px;background:#2f63c8;color:#fff;font-weight:800;">접수 안내</span></p>',
    "<p>접수하기에서 신청서를 작성하세요. 접수결과 조회, 수험표 출력, 서류 제출 메뉴를 이용할 수 있습니다.</p>",
    "<p>관리자가 수험생 등록을 완료하기 전에는 수험표 PDF가 표시되지 않을 수 있습니다.</p>",
  ].join("");
}

module.exports = {
  getDefaultApplicantNoticeHtml,
  getDefaultLoginNoticeHtml,
};
