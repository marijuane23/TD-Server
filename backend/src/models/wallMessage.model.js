import pool from '../db/pool.js';

export const WallMessageModel = {
  // Cursor-paginated greetings (newest first, id < after_id)
  async getWallMessages({ after_id = null, limit = 50 }) {
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    let sql = `
      SELECT 
        w.id,
        w.teacher_id,
        w.sender_name,
        w.message_text,
        w.created_at,
        t.name AS teacher_name,
        t.slug AS teacher_slug,
        (w.media_data IS NOT NULL) AS has_media
      FROM wall_messages w
      LEFT JOIN teachers t ON w.teacher_id = t.id
    `;
    const params = [];

    if (after_id && !isNaN(parseInt(after_id, 10))) {
      sql += ' WHERE w.id < ?';
      params.push(parseInt(after_id, 10));
    }

    sql += ' ORDER BY w.id DESC LIMIT ?';
    params.push(limitNum);

    const [rows] = await pool.query(sql, params);
    return rows;
  },

  // Insert a wall greeting (with optional teacher attribution and image attachment)
  async create({ teacher_id = null, sender_name, message_text, media_data = null, media_mime = null, media_size_bytes = null }) {
    const [result] = await pool.query(
      `INSERT INTO wall_messages 
        (teacher_id, sender_name, message_text, media_data, media_mime, media_size_bytes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        teacher_id || null,
        sender_name || 'Anonymous',
        message_text,
        media_data || null,
        media_mime || null,
        media_size_bytes || null,
      ]
    );
    const [rows] = await pool.query(
      `SELECT 
        w.id,
        w.teacher_id,
        w.sender_name,
        w.message_text,
        w.created_at,
        t.name AS teacher_name,
        t.slug AS teacher_slug,
        (w.media_data IS NOT NULL) AS has_media
       FROM wall_messages w
       LEFT JOIN teachers t ON w.teacher_id = t.id
       WHERE w.id = ?`,
      [result.insertId]
    );
    return rows[0];
  },

  // Retrieve raw image blob for streaming
  async getImageById(id) {
    const [rows] = await pool.query(
      'SELECT id, media_data, media_mime, media_size_bytes FROM wall_messages WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  // Delete greeting
  async deleteById(id) {
    const [result] = await pool.query('DELETE FROM wall_messages WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};

