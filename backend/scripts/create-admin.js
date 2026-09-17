import bcrypt from 'bcryptjs';
import pool from '../src/db/pool.js';

async function createAdmin() {
  const username = process.argv[2] || 'Admin23';
  const password = process.argv[3] || '@Bkkivz23';

  console.log(`Creating/updating admin account: "${username}"...`);

  try {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const [result] = await pool.query(
      `INSERT INTO admins (username, password_hash)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [username, passwordHash]
    );

    console.log(` Admin account "${username}" saved successfully!`);

    // Verify record
    const [rows] = await pool.query('SELECT id, username, created_at FROM admins WHERE username = ?', [username]);
    console.log(' Admin details:', rows[0]);
  } catch (error) {
    console.error('❌ Failed to create admin:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

createAdmin();
