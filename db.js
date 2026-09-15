const mysql = require("mysql2/promise");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env"), quiet: true });

let pool;

function getDbConfig(includeDatabase = true) {
  const config = {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
    namedPlaceholders: true,
    multipleStatements: true,
  };

  if (includeDatabase) {
    config.database = process.env.DB_NAME || "applyhub";
  }

  return config;
}

function getPool() {
  if (!pool) {
    pool = mysql.createPool(getDbConfig(true));
  }

  return pool;
}

async function query(sql, params = []) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

module.exports = {
  getDbConfig,
  getPool,
  query,
};
