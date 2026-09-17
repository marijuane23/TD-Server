import pool from '../db/pool.js';
import { config } from '../config/env.js';

function formatTeacher(t) {
  if (!t) return null;
  const teacher = { ...t };
  if (teacher.has_photo) {
    teacher.photo_url = `${config.backendPublicUrl}/teachers/${teacher.id}/photo`;
  } else if (!teacher.photo_url || teacher.photo_url === '[object Object]' || teacher.photo_url === 'null') {
    teacher.photo_url = null;
  }
  delete teacher.has_photo;
  delete teacher.photo_data;
  delete teacher.photo_mime;
  return teacher;
}

export const TeacherModel = {
  // Paginated list with search, college filter, and sort
  async getTeachers({ q = '', college = '', sort = 'name_asc', page = 1, limit = 12 }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 12));
    const offset = (pageNum - 1) * limitNum;

    let whereConditions = [];
    const params = [];

    if (q && q.trim() !== '') {
      whereConditions.push('(t.name LIKE ? OR t.department LIKE ? OR c.name LIKE ? OR c.code LIKE ?)');
      const searchTerm = `%${q.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (college && college !== 'all' && college.trim() !== '') {
      const colTrim = college.trim();
      const colId = parseInt(colTrim, 10);
      if (!isNaN(colId) && String(colId) === colTrim) {
        whereConditions.push('(t.college_id = ? OR c.code = ?)');
        params.push(colId, colTrim);
      } else {
        whereConditions.push('(c.code = ? OR c.name = ?)');
        params.push(colTrim, colTrim);
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Sort mapping
    let orderBy = 'ORDER BY t.name ASC';
    switch (sort) {
      case 'name_desc':
        orderBy = 'ORDER BY t.name DESC';
        break;
      case 'newest':
        orderBy = 'ORDER BY t.id DESC';
        break;
      case 'department':
        orderBy = 'ORDER BY c.name ASC, t.department ASC, t.name ASC';
        break;
      case 'college':
      case 'college_asc':
      case 'colleges':
        orderBy = 'ORDER BY CASE WHEN c.name IS NULL OR c.name = \'\' THEN 1 ELSE 0 END, c.name ASC, t.name ASC';
        break;
      case 'college_desc':
        orderBy = 'ORDER BY CASE WHEN c.name IS NULL OR c.name = \'\' THEN 1 ELSE 0 END, c.name DESC, t.name ASC';
        break;
      case 'name_asc':
      default:
        orderBy = 'ORDER BY t.name ASC';
        break;
    }

    // Total count query
    const countSql = `SELECT COUNT(*) AS total FROM teachers t LEFT JOIN colleges c ON t.college_id = c.id ${whereClause}`;
    const [countRows] = await pool.query(countSql, params);
    const totalCount = countRows[0].total;
    const totalPages = Math.ceil(totalCount / limitNum) || 1;

    // Items query (excluding large binary photo_data payload for fast listing)
    const itemsSql = `
      SELECT t.id, t.name, t.department, t.college_id, c.name AS college_name, c.code AS college_code,
             t.photo_url, t.slug, t.created_at, (t.photo_data IS NOT NULL) AS has_photo
      FROM teachers t
      LEFT JOIN colleges c ON t.college_id = c.id
      ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;
    const [items] = await pool.query(itemsSql, [...params, limitNum, offset]);

    return {
      items: items.map(formatTeacher),
      page: pageNum,
      totalPages,
      totalCount,
    };
  },

  // Get single teacher by slug
  async getBySlug(slug) {
    const [rows] = await pool.query(
      `SELECT t.id, t.name, t.department, t.college_id, c.name AS college_name, c.code AS college_code,
              t.photo_url, t.slug, t.created_at, (t.photo_data IS NOT NULL) AS has_photo
       FROM teachers t
       LEFT JOIN colleges c ON t.college_id = c.id
       WHERE t.slug = ?`,
      [slug]
    );
    return rows[0] ? formatTeacher(rows[0]) : null;
  },

  // Get single teacher by id
  async getById(id) {
    const [rows] = await pool.query(
      `SELECT t.id, t.name, t.department, t.college_id, c.name AS college_name, c.code AS college_code,
              t.photo_url, t.slug, t.created_at, (t.photo_data IS NOT NULL) AS has_photo
       FROM teachers t
       LEFT JOIN colleges c ON t.college_id = c.id
       WHERE t.id = ?`,
      [id]
    );
    return rows[0] ? formatTeacher(rows[0]) : null;
  },

  // Retrieve raw binary photo data for streaming
  async getPhotoById(id) {
    const [rows] = await pool.query(
      'SELECT photo_data, photo_mime FROM teachers WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  // Check if name or slug exists
  async existsByNameOrSlug(name, slug) {
    const [rows] = await pool.query(
      'SELECT id, name, slug FROM teachers WHERE LOWER(name) = LOWER(?) OR slug = ?',
      [name, slug]
    );
    return rows.length > 0 ? rows[0] : null;
  },

  // Create single teacher with optional binary photo and college_id
  async create({ name, department, college_id = null, photo_url, slug, photo_data = null, photo_mime = null }) {
    const [result] = await pool.query(
      'INSERT INTO teachers (name, department, college_id, photo_url, slug, photo_data, photo_mime) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, department || null, college_id || null, photo_url || null, slug, photo_data, photo_mime]
    );
    return this.getById(result.insertId);
  },

  // Update teacher photo (supports binary data and/or external photo_url)
  async updatePhoto({ id, slug, photo_data = null, photo_mime = null, photo_url = null }) {
    let where = '';
    const params = [photo_data, photo_mime, photo_url];

    if (id) {
      where = 'WHERE id = ?';
      params.push(id);
    } else if (slug) {
      where = 'WHERE slug = ?';
      params.push(slug);
    } else {
      throw new Error('Teacher id or slug is required to update photo.');
    }

    await pool.query(
      `UPDATE teachers SET photo_data = ?, photo_mime = ?, photo_url = ? ${where}`,
      params
    );

    return id ? this.getById(id) : this.getBySlug(slug);
  },

  // Delete single teacher by id (cascades messages and media via MySQL FK)
  async delete(id) {
    const [result] = await pool.query('DELETE FROM teachers WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  // Bulk delete teachers by array of ids
  async deleteMany(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    const [result] = await pool.query('DELETE FROM teachers WHERE id IN (?)', [ids]);
    return result.affectedRows;
  },

  // Export list honoring filters (no pagination limit)
  async getAllForExport({ q = '', sort = 'name_asc' }) {
    let whereClause = '';
    const params = [];

    if (q && q.trim() !== '') {
      whereClause = 'WHERE (t.name LIKE ? OR t.department LIKE ? OR c.name LIKE ? OR c.code LIKE ?)';
      const searchTerm = `%${q.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    let orderBy = 'ORDER BY t.name ASC';
    switch (sort) {
      case 'name_desc':
        orderBy = 'ORDER BY t.name DESC';
        break;
      case 'newest':
        orderBy = 'ORDER BY t.id DESC';
        break;
      case 'department':
        orderBy = 'ORDER BY c.name ASC, t.department ASC, t.name ASC';
        break;
      case 'name_asc':
      default:
        orderBy = 'ORDER BY t.name ASC';
        break;
    }

    const [rows] = await pool.query(
      `SELECT t.name, t.department, t.college_id, c.name AS college_name, c.code AS college_code, t.slug, t.created_at 
       FROM teachers t 
       LEFT JOIN colleges c ON t.college_id = c.id 
       ${whereClause} 
       ${orderBy}`,
      params
    );
    return rows;
  },
};

export default TeacherModel;
