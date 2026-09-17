import pool from '../db/pool.js';

export const MessageMediaModel = {
  // Insert media attachment (raw Buffer stored in LONGBLOB)
  async create({ message_id, media_data, media_type, media_mime, media_size_bytes }) {
    const [result] = await pool.query(
      `INSERT INTO message_media (message_id, media_data, media_type, media_mime, media_size_bytes)
       VALUES (?, ?, ?, ?, ?)`,
      [message_id, media_data, media_type, media_mime, media_size_bytes]
    );
    return result.insertId;
  },

  // Get raw media bytes and metadata
  async getById(id) {
    const [rows] = await pool.query(
      `SELECT id, message_id, media_data, media_type, media_mime, media_size_bytes, created_at
       FROM message_media
       WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  // Delete media row only (leaving message intact)
  async deleteById(id) {
    const [result] = await pool.query('DELETE FROM message_media WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};
