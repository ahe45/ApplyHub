const { normalizeSignupSettings } = require('./membership');

// Authentication fields are never part of a membership information export.
const excludedKeys = new Set(['loginId', 'password', 'passwordConfirm', 'password_hash', 'name', 'email', '__proto__', 'constructor', 'prototype']);

function formatMemberAnswer(value) {
  if (Array.isArray(value)) return value.map(formatMemberAnswer).join(', ');
  if (value && typeof value === 'object') return String(value.fileName || '');
  return String(value ?? '');
}

async function createMemberExport(query, submissionIds) {
  const [settingsRow] = await query("SELECT setting_value AS value FROM system_set WHERE setting_key = 'applicantSignupSettings'");
  const settings = normalizeSignupSettings(settingsRow ? JSON.parse(settingsRow.value) : {});
  const fields = new Map(settings.questions.filter(question => !excludedKeys.has(question.key)).map(question => [question.key, question.label]));

  async function loadMembers(ids) {
    if (!ids.length) return new Map();
    const rows = await query(`
      SELECT meta.id AS submissionId, m.name, m.email, m.profile_json AS profileJson,
        DATE_FORMAT(m.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
      FROM app_meta meta
      INNER JOIN applicant_members m ON m.id = meta.member_id
      WHERE meta.id IN (${ids.map(() => '?').join(', ')})
    `, ids);
    return new Map(rows.map(row => [Number(row.submissionId), { ...row, profile: JSON.parse(row.profileJson || '{}') }]));
  }

  // Discover preserved answers to deleted questions without retaining every member profile in memory.
  for (let offset = 0; offset < submissionIds.length; offset += 100) {
    const members = await loadMembers(submissionIds.slice(offset, offset + 100));
    for (const member of members.values()) {
      for (const key of Object.keys(member.profile)) {
        if (!excludedKeys.has(key) && !fields.has(key)) {
          fields.set(key, key === 'birth' ? '생년월일' : key === 'phone' ? '연락처' : `기존 질문 (${key})`);
        }
      }
    }
  }

  const profileColumns = [...fields].map(([fieldKey, label], index) => ({
    header: `회원가입 · ${label}`, key: `memberAnswer${index + 1}`, fieldKey, width: 24,
  }));
  const columns = [
    { header: '회원가입 · 이름', key: 'memberName', width: 20 },
    { header: '회원가입 · 이메일', key: 'memberEmail', width: 28 },
    { header: '회원가입일시', key: 'memberCreatedAt', width: 22 },
    ...profileColumns,
  ];

  async function loadRecords(ids) {
    const members = await loadMembers(ids);
    return new Map([...members].map(([id, member]) => [id, {
      memberName: member.name,
      memberEmail: member.email,
      memberCreatedAt: member.createdAt,
      ...Object.fromEntries(profileColumns.map(column => [column.key, formatMemberAnswer(member.profile[column.fieldKey])])),
    }]));
  }

  return { columns, loadRecords };
}

module.exports = { createMemberExport };
