function createAuthAccountAdminService({
  accountRoleOptions,
  createHttpError,
  destroySessionsByAccountId,
  getAccountAuthRecord,
  getAccountById,
  getSystemSettings,
  hashPassword,
  query,
}) {
  function normalizeAccountPayload(payload, existingAccount = {}) {
    const id = String(payload.id ?? existingAccount.id ?? "").trim();
    const name = String(payload.name ?? existingAccount.name ?? "").trim();
    const role = String(payload.role ?? existingAccount.role ?? "").trim();

    if (!id) {
      throw createHttpError(400, "계정 ID가 필요합니다.");
    }

    if (!name) {
      throw createHttpError(400, "계정 이름이 필요합니다.");
    }

    if (!accountRoleOptions.includes(role)) {
      throw createHttpError(400, `계정 권한은 ${accountRoleOptions.join(", ")} 중 하나여야 합니다.`);
    }

    return {
      id,
      name,
      role,
    };
  }

  async function createAccount(payload) {
    const nextAccount = normalizeAccountPayload(payload);
    const existingAccount = await getAccountAuthRecord(nextAccount.id);

    if (existingAccount) {
      throw createHttpError(409, "이미 등록된 계정 ID입니다.", "ACCOUNT_ID_EXISTS");
    }

    const [member] = await query("SELECT id FROM applicant_members WHERE email = ?", [nextAccount.id]);
    if (member) throw createHttpError(409, "이미 사용 중인 계정 ID입니다.", "ACCOUNT_ID_EXISTS");

    const { initialPassword } = await getSystemSettings();

    try {
      await query(
        `
          INSERT INTO accounts (
            login_id,
            display_name,
            role,
            password_value,
            password_temporary,
            last_login_at
          )
          VALUES (?, ?, ?, ?, 1, NULL)
        `,
        [nextAccount.id, nextAccount.name, nextAccount.role, hashPassword(initialPassword)],
      );
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") {
        throw createHttpError(409, "이미 등록된 계정 ID입니다.", "ACCOUNT_ID_EXISTS");
      }

      throw error;
    }

    return getAccountById(nextAccount.id);
  }

  async function updateAccount(accountId, payload) {
    const existingAccount = await getAccountById(accountId);
    const nextAccount = normalizeAccountPayload(payload, existingAccount);

    await query(
      `
        UPDATE accounts
        SET
          display_name = ?,
          role = ?
        WHERE login_id = ?
      `,
      [nextAccount.name, nextAccount.role, accountId],
    );

    return getAccountById(accountId);
  }

  async function resetAccountPassword(accountId) {
    await getAccountById(accountId);
    const { initialPassword } = await getSystemSettings();

    await query(
      `
        UPDATE accounts
        SET
          password_value = ?,
          password_temporary = 1
        WHERE login_id = ?
      `,
      [hashPassword(initialPassword), accountId],
    );

    destroySessionsByAccountId(accountId);
    return { id: accountId, password: initialPassword };
  }

  async function deleteAccount(accountId) {
    await getAccountById(accountId);
    await query(`DELETE FROM accounts WHERE login_id = ?`, [accountId]);
    destroySessionsByAccountId(accountId);
    return { id: accountId };
  }

  return Object.freeze({
    createAccount,
    deleteAccount,
    normalizeAccountPayload,
    resetAccountPassword,
    updateAccount,
  });
}

module.exports = {
  createAuthAccountAdminService,
};
