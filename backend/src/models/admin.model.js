import pool from '../db/pool.js';

export const AdminModel = {
  async findByUsername(username) {
    const [rows] = await pool.query(
      'SELECT id, username, password_hash, created_at FROM admins WHERE username = ?',
      [username]
    );
    return rows[0] || null;
  },

  async getById(id) {
    const [rows] = await pool.query(
      'SELECT id, username, created_at FROM admins WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },
};
