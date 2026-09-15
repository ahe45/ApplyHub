# ApplyHub

회원가입, 원서접수, 접수결과 조회, 수험표 출력과 서류 제출을 관리하는 원서접수시스템.

- 프로젝트명: **ApplyHub**
- npm 패키지명: `apply-hub`
- 사용자 표시 시스템명: **원서접수시스템**
- 서버 실행: `npm start`
- 회귀 테스트: `npm test`, `npm run test:membership`
- 전체 UI: **Quiet Glass** — [화면 스타일 기준](docs/PUBLIC_UI.md)

기본 데이터베이스명은 `applyhub`입니다. 기존 설치에서는 `.env`에 지정한 `DB_NAME`을 사용합니다.
세션/쿠키/저장소 키와 `AdmitCard*` 내부 모듈 식별자는 호환성을 위해 유지합니다.

수험표는 접수 이력을 기준으로 생성합니다. 양식 데이터태그는 수험번호, 이름, 생년월일, 모집시기, 전형, 계열, 모집단위, 전공, 수험생사진, 현재날짜를 지원합니다.

## 새 Windows 서버 PC에서 처음 실행하기

`git clone`은 소스 파일만 가져옵니다. Node.js, DB 서버, `.env`, 설치된 의존성, 기존 DB 데이터와 업로드 파일은 별도로 준비해야 합니다.

1. MySQL 또는 MariaDB를 설치하고 DB 서비스를 실행합니다. 사용할 DB 계정에는 해당 DB와 테이블을 생성·변경할 권한이 필요합니다.
2. `start-server.bat`을 실행합니다. Node.js, `.env` 또는 의존성이 준비되지 않았다면 `deploy/setup-windows.ps1`이 초기 설정을 시작합니다.
3. 화면의 질문에 서버 포트, DB 호스트·포트·이름, 계정과 비밀번호를 입력합니다. 기본값은 서버 포트 `3000`, DB 주소 `127.0.0.1:3306`, DB 이름 `applyhub`입니다. Enter를 누르면 현재 값을 유지합니다. 비밀번호 입력은 화면에 표시되지 않습니다.
4. 초기 설정이 `npm ci`와 `npm run db:setup`을 실행하고 DB 연결을 확인합니다. 완료되면 서버가 자동으로 시작됩니다.
5. 서버 PC에서 `http://localhost:3000`에 접속합니다. 포트를 바꿨다면 변경한 포트를 사용하세요. 실행 중에는 창을 열어 두세요.

Node.js가 없거나 22.13보다 오래된 경우 winget으로 설치를 시도합니다. Windows의 설치 권한 안내가 표시될 수 있습니다. winget을 사용할 수 없다면 Node.js 24를 직접 설치한 후 다시 실행합니다. DB 서버 설치와 계정 생성은 별도로 해야 합니다. 수험표 PDF 생성에는 Microsoft Edge가 필요합니다.

기존 `.env`의 이메일 등 다른 설정은 유지합니다. DB 접속정보를 다시 설정하거나 설치 실패 후 재시도하려면 `start-server.bat --setup`을 실행합니다. 기존 서버의 데이터를 옮기는 경우에는 DB와 업로드 파일도 복원해야 합니다.

이미 `.env`에 `DB_NAME=admitcard`가 설정되어 있다면 업데이트 후에도 해당 DB를 사용합니다. `applyhub`로 변경하려면 초기 설정에서 DB 이름을 직접 입력하거나 `.env`를 수정하세요. 기존 데이터가 필요하다면 `applyhub` DB로 데이터를 이전해야 하며, 설정 변경만으로 기존 DB가 이름 변경되거나 복사되지는 않습니다.

오류가 발생하면 창을 유지하고 로그 위치를 안내합니다. 초기 설정 로그는 `log/setup-windows.log`, 실행 전 DB 확인 결과는 `log/startup-check.log`에 저장됩니다. 다른 PC에서 접속하려면 서버 PC의 IP 주소와 `.env`의 `PORT`를 사용하고 Windows 방화벽에서 해당 포트 접근을 허용해야 합니다.

## Windows 서버 업데이트

1. 실행 중인 서버 창에서 Ctrl+C로 서버를 종료합니다.
2. `update-server.bat`을 실행하고 안내에 따라 진행합니다.
3. 완료 메시지가 표시되면 `start-server.bat`을 실행합니다.

업데이트는 현재 브랜치에 대응하는 `origin`의 변경 사항을 가져온 뒤 `npm ci`, `npm run db:setup`, DB 연결 확인을 순서대로 실행합니다. 로컬 파일에 변경이 있거나 브랜치를 자동으로 합칠 수 없는 경우 중단합니다. `.env`, 업로드 파일과 로그는 Git 업데이트 대상에서 제외됩니다. 결과와 오류는 `log/update-server.log`에서 확인할 수 있습니다. 중간 단계가 실패하면 오류 원인을 해결한 후 다시 실행합니다.

Windows 실행·설정·업데이트 동작 검증: `npm run test:windows-launchers`

## DB 구조 정리

`npm run db:setup`과 서버 시작 시 기존 DB 구조를 검사하고 필요한 변경을 적용합니다. 업데이트할 때는 기존 서버를 먼저 종료하세요.

- `app_meta.promoted_examinee_no` → `examinee_no`: 접수 시 발급한 수험번호
- `app_meta.promotion_override_json` → `field_overrides_json`: 수험표와 서류 제출 일정 판단에 적용하는 접수 정보 보정값
- `app_meta.promoted_at`: 현재 기능에서 사용하지 않는 과거 이관일 컬럼 삭제
- 미사용 테이블 `examinee`, `app_assign`, `pdf_audit_logs`, `pdf_generation_batches`, `pdf_generation_histories`, `pdf_templates`, `pdf_template_elements`, `pdf_template_pages`, `pdf_template_versions`, `school_settings`, `surveys`, `survey_admins`, `survey_answers`, `survey_questions`, `survey_responses` 삭제
- 예전 접수 데이터 변환 과정에서 남긴 `app_subm_legacy_<숫자>` 테이블도 구조 확인 후 정리

변경 전 영향받는 테이블의 구조와 데이터를 `.private/schema-backups/`에 SQL 파일로 보관하고 파일 검증을 완료한 뒤 변경합니다. 이 폴더는 Git과 웹 공개 대상에서 제외됩니다. JSON 파일에 테이블별 행 수와 SQL 파일의 SHA-256 검증값을 함께 기록합니다. 복구가 필요하면 SQL 파일을 **별도 DB**에 불러와 이전 데이터를 확인하세요.

삭제 대상에 다른 테이블의 외래키 참조가 있거나 백업에 실패하면 정리를 중단합니다. 대상 목록에 없는 테이블은 유지합니다. 기존 ZIP 백업의 이전 컬럼명은 복원 과정에서 새 컬럼명으로 변환합니다.

응답의 접수 정보도 `examineeNo`, `fieldOverrides`를 사용합니다. 구조 정리 및 이전 백업 복원 검증: `npm run test:schema-maintenance`

## 이메일 인증 발송

관리자 **시스템 설정 → 이메일 발송 설정**에서 서버 주소, 포트, 보안 방식, 계정, 비밀번호와 발신 정보를 입력합니다. **연결 확인** 후 **메일 설정 저장**을 누르면 다음 인증 메일부터 즉시 적용됩니다. 연결 확인은 SMTP 연결·인증까지만 검사하며 실제 수신 여부를 보장하지는 않습니다.

- 저장된 설정이 `.env`의 SMTP 설정보다 우선합니다. 최초에는 기존 환경 설정을 불러옵니다.
- 비밀번호를 비워 두면 기존 값을 유지합니다. 저장된 비밀번호는 조회 API에 반환하지 않습니다.
- 비밀번호는 데이터베이스에 암호화되어 저장되며, 키는 서버의 `.private/smtp.key`에 보관합니다. 이 파일은 Git·웹 공개·시스템 ZIP 백업 대상에서 제외됩니다. 서버를 이전하거나 키를 잃어버린 경우 설정 화면에서 비밀번호를 다시 입력하세요.
- `APPLICANT_SIGNUP_CODE_PREVIEW=false`이면 실제 인증 메일을 발송합니다. 메일 서비스가 요구하는 경우 앱 비밀번호와 SMTP 사용 허용 설정이 필요합니다.
- 현재 저장된 설정 점검: `npm run smtp:check` / 이메일 설정·발송·화면 검증: `npm run test:verification-mail`
