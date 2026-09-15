const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const { getDbConfig } = require("../db");

dotenv.config({ path: path.join(__dirname, "..", ".env"), quiet: true });

async function main() {
  const databaseName = getDbConfig().database;
  const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const rootConfig = getDbConfig(false);

  const connection = await mysql.createConnection(rootConfig);

  try {
    await connection.query(
      "CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", [databaseName],
    );
    await connection.query("USE ??", [databaseName]);
    await connection.query(schemaSql);

    console.log(`Database '${databaseName}' is ready.`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Failed to set up database.");

  if (error.code === "AUTH_SWITCH_PLUGIN_ERROR" || String(error.message || "").includes("auth_gssapi_client")) {
    console.error(
      "현재 DB 계정은 auth_gssapi_client 인증을 사용 중입니다. mysql_native_password 기반의 앱 전용 계정을 만들어 .env에 넣어주세요.",
    );
  } else {
    console.error(error.message);
  }

  process.exitCode = 1;
});
