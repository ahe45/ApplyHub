function createSystemAccountBootstrapService({
  defaultInitialPassword,
  defaultSeedAccounts,
  getSystemSettings,
  hashPassword,
  isPasswordHash,
  query,
}) {
  async function migrateLegacyAccountPasswords() {
    const { initialPassword } = await getSystemSettings();
    const accounts = await query(`
      SELECT
        login_id AS id,
        password_value AS passwordValue,
        password_temporary AS passwordTemporary
      FROM accounts
    `);

    for (const account of accounts) {
      if (isPasswordHash(account.passwordValue)) {
        continue;
      }

      const rawPasswordValue = String(account.passwordValue || initialPassword);
      const nextPasswordValue = await hashPassword(rawPasswordValue);
      const nextPasswordTemporary =
        rawPasswordValue === defaultInitialPassword || rawPasswordValue === initialPassword ? 1 : 0;

      await query(
        `
          UPDATE accounts
          SET
            password_value = ?,
            password_temporary = ?
          WHERE login_id = ?
        `,
        [nextPasswordValue, nextPasswordTemporary, account.id],
      );
    }
  }

  async function migrateLegacySeedAccountIds() {
    const accountIds = defaultSeedAccounts.flatMap((account) => [account.legacyId, account.id]);
    const placeholders = accountIds.map(() => "?").join(", ");
    const accounts = await query(
      `
        SELECT login_id AS id
        FROM accounts
        WHERE login_id IN (${placeholders})
      `,
      accountIds,
    );
    const existingIds = new Set(accounts.map((account) => String(account.id || "").trim()));

    for (const account of defaultSeedAccounts) {
      if (!existingIds.has(account.legacyId) || existingIds.has(account.id)) {
        continue;
      }

      await query(`UPDATE accounts SET login_id = ? WHERE login_id = ?`, [account.id, account.legacyId]);
      existingIds.delete(account.legacyId);
      existingIds.add(account.id);
    }
  }

  async function seedAccounts() {
    const [accountSummary] = await query(`SELECT COUNT(*) AS totalAccounts FROM accounts`);

    if (Number(accountSummary?.totalAccounts || 0) > 0) {
      return;
    }

    const { initialPassword } = await getSystemSettings();

    await query(
      `
        INSERT INTO accounts (login_id, display_name, role, password_value, password_temporary, last_login_at)
        VALUES
          (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 16 MINUTE)),
          (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 2 HOUR)),
          (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 1 DAY))
      `,
      [
        defaultSeedAccounts[0].id,
        defaultSeedAccounts[0].name,
        defaultSeedAccounts[0].role,
        await hashPassword(initialPassword),
        1,
        defaultSeedAccounts[1].id,
        defaultSeedAccounts[1].name,
        defaultSeedAccounts[1].role,
        await hashPassword(initialPassword),
        1,
        defaultSeedAccounts[2].id,
        defaultSeedAccounts[2].name,
        defaultSeedAccounts[2].role,
        await hashPassword(initialPassword),
        1,
      ],
    );
  }

  return Object.freeze({
    migrateLegacyAccountPasswords,
    migrateLegacySeedAccountIds,
    seedAccounts,
  });
}

module.exports = {
  createSystemAccountBootstrapService,
};
