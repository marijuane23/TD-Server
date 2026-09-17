import pool from '../db/pool.js';

export const WallMessageModel = {
  // Cursor-paginated greetings (newest first, id < after_id)
  async getWallMessages({ after_id = null, limit = 50 }) {
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    let sql = 'SELECT id, sender_name, message_text, created_at FROM wall_messages';
    const params = [];

    if (after_id && !isNaN(parseInt(after_id, 10))) {
      sql += ' WHERE id < ?';
      params.push(parseInt(after_id, 10));
    }

    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(limitNum);

    const [rows] = await pool.query(sql, params);
    return rows;
  },

  // Insert a wall greeting
  async create({ sender_name, message_text }) {
    const [result] = await pool.query(
      'INSERT INTO wall_messages (sender_name, message_text) VALUES (?, ?)',
      [sender_name || 'Anonymous', message_text]
    );
    const [rows] = await pool.query(
      'SELECT id, sender_name, message_text, created_at FROM wall_messages WHERE id = ?',
      [result.insertId]
    );
    return rows[0];
  },

  // Delete greeting
  async deleteById(id) {
    const [result] = await pool.query('DELETE FROM wall_messages WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};
