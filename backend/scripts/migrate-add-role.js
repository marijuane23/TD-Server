import pool from '../src/db/pool.js';

async function migrate() {
  console.log('--- Starting Teachers Table Migration: Adding Role Column ---');

  const connection = await pool.getConnection();
  try {
    // 1. Inspect existing columns in teachers table
    const [columns] = await connection.query('SHOW COLUMNS FROM teachers');
    const colNames = columns.map((c) => c.Field);
    console.log('Current teachers columns:', colNames.join(', '));

    // 2. Add role column if missing
    if (!colNames.includes('role')) {
      console.log('Adding role column to teachers table...');
      await connection.query(`
        ALTER TABLE teachers 
        ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'faculty' AFTER department,
        ADD INDEX idx_teachers_role (role)
      `);
      console.log('✓ Successfully added role column (VARCHAR(20) DEFAULT "faculty") and index.');
    } else {
      console.log('• Column "role" already exists in teachers table.');
    }

    // 3. Verify counts
    const [counts] = await connection.query(`
      SELECT role, COUNT(*) AS count FROM teachers GROUP BY role
    `);
    console.log('Current teachers counts by role:');
    counts.forEach((r) => console.log(`   - ${r.role}: ${r.count}`));

    connection.release();
    console.log('--- Migration Complete! ---');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
