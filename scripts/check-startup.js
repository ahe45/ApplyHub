const mysql = require("mysql2/promise");
const { getDbConfig } = require("../db");

async function main() {
  let connection;
  try {
    connection = await mysql.createConnection({ ...getDbConfig(), connectTimeout: 5000 });
    await connection.query("SELECT 1");
    console.log("Database connection OK.");
  } catch (error) {
    const hints = {
      ER_BAD_DB_ERROR: "Database does not exist. Run npm run db:setup in this folder, then start again.",
      ER_ACCESS_DENIED_ERROR: "Database login failed. Check DB_USER and DB_PASSWORD in .env.",
      ER_DBACCESS_DENIED_ERROR: "Database access denied. Check the database permissions for DB_USER.",
      ECONNREFUSED: "Database connection refused. Start MySQL/MariaDB and check DB_HOST and DB_PORT in .env.",
      ENOTFOUND: "Database host was not found. Check DB_HOST in .env.",
      ETIMEDOUT: "Database connection timed out. Check DB_HOST, DB_PORT and network access.",
    };
    console.error(`Database check failed (${error.code || "unknown"}).`);
    console.error(hints[error.code] || "Check your database service, account and .env settings.");
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

main();
