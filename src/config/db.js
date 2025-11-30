const mysql = require('mysql2/promise');

const connectionUri = process.env.DATABASE_URL || process.env.MYSQL_URL;

async function createPool() {
  if (connectionUri) {
    return mysql.createPool(connectionUri);
  }
  return mysql.createPool({
    host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'railway',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

let poolPromise = createPool();

async function query(sql, params) {
  const pool = await poolPromise;
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function getConnection() {
  const pool = await poolPromise;
  return pool.getConnection();
}

module.exports = { query, getConnection };
