import pool from '../db/pool.js';

export const MessageModel = {
  // Get all timeline messages for a teacher (without raw BLOB data)
  async getByTeacherId(teacherId) {
    const sql = `
      SELECT 
        m.id,
        m.teacher_id,
        m.sender_name,
        m.message_text,
        m.created_at,
        mm.id AS media_id,
        mm.media_type,
        mm.media_mime,
        mm.media_size_bytes
      FROM messages m
      LEFT JOIN message_media mm ON mm.message_id = m.id
      WHERE m.teacher_id = ?
      ORDER BY m.id DESC
    `;
    const [rows] = await pool.query(sql, [teacherId]);
    return rows;
  },

  // Get single message by id with media metadata
  async getById(id) {
    const sql = `
      SELECT 
        m.id,
        m.teacher_id,
        m.sender_name,
        m.message_text,
        m.created_at,
        mm.id AS media_id,
        mm.media_type,
        mm.media_mime,
        mm.media_size_bytes
      FROM messages m
      LEFT JOIN message_media mm ON mm.message_id = m.id
      WHERE m.id = ?
    `;
    const [rows] = await pool.query(sql, [id]);
    return rows[0] || null;
  },

  // Insert a message
  async create({ teacher_id, sender_name, message_text }) {
    const [result] = await pool.query(
      'INSERT INTO messages (teacher_id, sender_name, message_text) VALUES (?, ?, ?)',
      [teacher_id, sender_name || 'Anonymous', message_text]
    );
    return result.insertId;
  },

  // Delete message (cascades to message_media)
  async deleteById(id) {
    const [result] = await pool.query('DELETE FROM messages WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};
