import pool from '../db/pool.js';

export const CollegesModel = {
  // Get all normalized colleges
  async getAll() {
    const [rows] = await pool.query('SELECT id, name, code, created_at FROM colleges ORDER BY id ASC');
    return rows;
  },

  // Get college by ID
  async getById(id) {
    const [rows] = await pool.query('SELECT id, name, code FROM colleges WHERE id = ?', [id]);
    return rows[0] || null;
  },
};

export default CollegesModel;
