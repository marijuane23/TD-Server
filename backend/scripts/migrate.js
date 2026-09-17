import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../src/db/pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('Starting database migration...');
  const schemaPath = path.resolve(__dirname, '../src/db/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');

  try {
    const connection = await pool.getConnection();
    console.log('Applying schema statements from schema.sql...');

    await connection.query(sql);

    console.log(' Schema executed successfully!');

    // Verify created tables
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(r => Object.values(r)[0]);
    console.log(' Verified tables in database:');
    tableNames.forEach(t => console.log(`   - ${t}`));

    const expectedTables = ['teachers', 'messages', 'message_media', 'wall_messages', 'admins'];
    const missing = expectedTables.filter(t => !tableNames.includes(t));
    if (missing.length === 0) {
      console.log(' All 5 required tables are present and verified!');
    } else {
      console.warn('⚠️ Missing tables:', missing);
    }

    connection.release();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();
