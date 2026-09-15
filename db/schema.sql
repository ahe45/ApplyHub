
CREATE TABLE IF NOT EXISTS print_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  examinee_no VARCHAR(30) NOT NULL,
  print_count INT NOT NULL,
  printed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_print_log_examinee_no (examinee_no),
  KEY idx_print_log_printed_at (printed_at)
);

CREATE TABLE IF NOT EXISTS templates (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  version_label VARCHAR(100) NOT NULL,
  status ENUM('used', 'unused') NOT NULL DEFAULT 'unused',
  content_html MEDIUMTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS accounts (
  login_id VARCHAR(60) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  role ENUM('슈퍼관리자', '관리자', '운영자', '조회용') NOT NULL DEFAULT '조회용',
  password_value VARCHAR(255) NOT NULL DEFAULT '1111',
  password_temporary TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (login_id),
  KEY idx_accounts_role (role),
  KEY idx_accounts_last_login_at (last_login_at)
);

CREATE TABLE IF NOT EXISTS system_set (
  setting_key VARCHAR(100) NOT NULL,
  setting_value MEDIUMTEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
);

CREATE TABLE IF NOT EXISTS system_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_login_id VARCHAR(100) NOT NULL DEFAULT '',
  account_display_name VARCHAR(100) NOT NULL DEFAULT '',
  account_role VARCHAR(30) NOT NULL DEFAULT '',
  action_type VARCHAR(80) NOT NULL,
  target_scope VARCHAR(80) NOT NULL DEFAULT '',
  summary_text VARCHAR(255) NOT NULL DEFAULT '',
  details_json MEDIUMTEXT NULL,
  ip_address VARCHAR(100) NOT NULL DEFAULT '',
  user_agent VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_system_audit_log_created_at (created_at),
  KEY idx_system_audit_log_action_type (action_type),
  KEY idx_system_audit_log_account_login_id (account_login_id)
);

INSERT IGNORE INTO system_set (setting_key, setting_value)
VALUES
  ('initialPassword', '1111'),
  ('autoLogoutMinutes', '0'),
  ('admissionHomepageUrl', ''),
  ('applicantExamNoDigitCount', '10'),
  ('applicantExamNoComponentsJson', '["admissionCode","seriesCode","unitCode","sequence",""]'),
  ('applicantExamNoPattern', 'AD-{YY}{MM}{DD}-{SEQ:4}'),
  ('applicantExamNoSequenceStart', '1');

CREATE TABLE IF NOT EXISTS app_form (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  form_scope ENUM('application', 'documents') NOT NULL DEFAULT 'application',
  field_key VARCHAR(60) NOT NULL,
  question_text VARCHAR(255) NOT NULL,
  question_description VARCHAR(500) NOT NULL DEFAULT '',
  input_type ENUM('text', 'textarea', 'select', 'date', 'birthdate', 'time', 'photo', 'file', 'phone', 'nationality') NOT NULL DEFAULT 'text',
  system_field_key VARCHAR(40) NOT NULL DEFAULT '',
  options_json TEXT NULL,
  required TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_app_form_field_key (field_key),
  KEY idx_app_form_sort_order (sort_order)
);

CREATE TABLE IF NOT EXISTS app_subm (
  id BIGINT UNSIGNED NOT NULL,
  applicant_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NULL,
  status ENUM('submitted', 'promoted') NOT NULL DEFAULT 'submitted',
  field_key VARCHAR(60) NOT NULL,
  answer_data MEDIUMTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id, field_key),
  KEY idx_app_subm_lookup (email, applicant_name, id),
  KEY idx_app_subm_status (status),
  KEY idx_app_subm_field_key (field_key)
);

CREATE TABLE IF NOT EXISTS app_meta (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  member_id BIGINT UNSIGNED NULL,
  examinee_no VARCHAR(30) NULL,
  field_overrides_json MEDIUMTEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_app_meta_member (member_id),
  KEY idx_app_meta_examinee_no (examinee_no)
);

CREATE TABLE IF NOT EXISTS applicant_members (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  login_id VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  email_verified TINYINT NOT NULL DEFAULT 0,
  profile_json MEDIUMTEXT NOT NULL,
  consent_json MEDIUMTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS applicant_member_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  member_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  KEY (member_id), KEY (expires_at)
);

CREATE TABLE IF NOT EXISTS applicant_member_recovery (
  id CHAR(48) PRIMARY KEY,
  member_id BIGINT UNSIGNED NULL,
  email VARCHAR(255) NOT NULL,
  purpose VARCHAR(16) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  KEY (member_id), KEY (expires_at)
);

CREATE TABLE IF NOT EXISTS applicant_member_verifications (
  id CHAR(48) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  verified TINYINT NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  KEY (email), KEY (expires_at)
);

CREATE TABLE IF NOT EXISTS app_unit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  track_name VARCHAR(100) NOT NULL DEFAULT '',
  admission_code VARCHAR(30) NOT NULL,
  admission_name VARCHAR(100) NOT NULL,
  series_code VARCHAR(30) NOT NULL DEFAULT '',
  series_name VARCHAR(100) NOT NULL DEFAULT '',
  unit_code VARCHAR(30) NOT NULL,
  unit_name VARCHAR(100) NOT NULL,
  major_code VARCHAR(30) NOT NULL DEFAULT '',
  major_name VARCHAR(100) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_app_unit_codes (track_name, admission_code, series_code, unit_code, major_code),
  UNIQUE KEY uniq_app_unit_names (track_name, admission_name, series_name, unit_name, major_name),
  KEY idx_app_unit_sort_order (sort_order)
);

CREATE TABLE IF NOT EXISTS app_schedule (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  track_name VARCHAR(100) NOT NULL DEFAULT '',
  admission_code VARCHAR(30) NOT NULL,
  admission_name VARCHAR(100) NOT NULL,
  applicant_schedule_start_at DATETIME NULL,
  applicant_schedule_end_at DATETIME NULL,
  admit_card_lookup_schedule_start_at DATETIME NULL,
  admit_card_lookup_schedule_end_at DATETIME NULL,
  document_submission_schedule_start_at DATETIME NULL,
  document_submission_schedule_end_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_app_schedule_track_admission (track_name, admission_code, admission_name),
  KEY idx_app_schedule_track_name (track_name),
  KEY idx_app_schedule_admission_name (admission_name)
);


CREATE TABLE IF NOT EXISTS app_email_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  applicant_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  code_value VARCHAR(12) NOT NULL,
  expires_at DATETIME NOT NULL,
  verified_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_app_email_log_lookup (email, applicant_name),
  KEY idx_app_email_log_expires (expires_at)
);

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS description VARCHAR(255) NOT NULL DEFAULT '' AFTER name;



ALTER TABLE app_meta
  ADD COLUMN IF NOT EXISTS field_overrides_json MEDIUMTEXT NULL AFTER examinee_no;

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(100) NOT NULL DEFAULT '' AFTER login_id,
  ADD COLUMN IF NOT EXISTS role ENUM('슈퍼관리자', '관리자', '운영자', '조회용') NOT NULL DEFAULT '조회용' AFTER display_name,
  ADD COLUMN IF NOT EXISTS password_value VARCHAR(255) NOT NULL DEFAULT '1111' AFTER role,
  ADD COLUMN IF NOT EXISTS password_temporary TINYINT(1) NOT NULL DEFAULT 1 AFTER password_value,
  ADD COLUMN IF NOT EXISTS last_login_at DATETIME NULL AFTER password_temporary;
