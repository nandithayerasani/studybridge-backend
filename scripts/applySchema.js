require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { getConnection } = require('../src/config/db');

async function main() {
  const schemaPath = path.resolve(__dirname, '../../studybridge-ui-showcase/db/schema.sql');
  console.log('Applying schema from', schemaPath);

  const sql = fs.readFileSync(schemaPath, 'utf8');
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const conn = await getConnection();
  try {
    for (const stmt of statements) {
      await conn.query(stmt);
    }
    console.log('Schema applied successfully.');
  } catch (err) {
    console.error('Error applying schema:', err);
    process.exitCode = 1;
  } finally {
    conn.release();
  }
}

main();
