import ExcelJS from 'exceljs';
import pool from '../db/pool.js';
import { generateSlug } from '../utils/validators.js';
import { TeacherModel } from '../models/teacher.model.js';

export const TeacherExcelService = {
  // Parse uploaded .xlsx file and bulk insert teachers
  async importFromBuffer(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('Spreadsheet does not contain any worksheets');
    }

    const rowsToInsert = [];
    const skipped = [];
    let nameCol = 1;
    let collegeCol = null;
    let deptCol = 2;
    let photoCol = 3;

    // Detect header row
    const firstRow = worksheet.getRow(1);
    firstRow.eachCell((cell, colNumber) => {
      const val = String(cell.value || '').trim().toLowerCase();
      if (val.includes('name')) nameCol = colNumber;
      if (val.includes('college')) collegeCol = colNumber;
      if (val.includes('department') || val.includes('dept')) deptCol = colNumber;
      if (val.includes('photo') || val.includes('image')) photoCol = colNumber;
    });

    const [colleges] = await pool.query('SELECT id, name, code FROM colleges');
    const collegeMap = new Map();
    colleges.forEach(c => {
      collegeMap.set(c.name.toLowerCase().trim(), c.id);
      collegeMap.set(c.code.toLowerCase().trim(), c.id);
    });

    const [existingTeachers] = await pool.query('SELECT name, slug FROM teachers');
    const existingNames = new Set(existingTeachers.map(t => t.name.toLowerCase().trim()));
    const existingSlugs = new Set(existingTeachers.map(t => t.slug.toLowerCase().trim()));

    // Iterate data rows (starting from row 2)
    for (let r = 2; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const nameRaw = row.getCell(nameCol).value;
      const collegeRaw = collegeCol ? row.getCell(collegeCol).value : null;
      const deptRaw = deptCol ? row.getCell(deptCol).value : null;
      const photoRaw = photoCol ? row.getCell(photoCol).value : null;

      const name = nameRaw ? String(nameRaw).trim() : '';
      const collegeVal = collegeRaw ? String(collegeRaw).trim() : null;
      const department = deptRaw ? String(deptRaw).trim() : null;
      const photo_url = photoRaw ? String(photoRaw).trim() : null;

      if (!name) {
        skipped.push({ row: r, reason: 'Missing required teacher name' });
        continue;
      }

      if (existingNames.has(name.toLowerCase())) {
        skipped.push({ row: r, name, reason: 'Teacher name already exists' });
        continue;
      }

      // Map college_id from college column or department fallback
      let college_id = null;
      if (collegeVal && collegeMap.has(collegeVal.toLowerCase())) {
        college_id = collegeMap.get(collegeVal.toLowerCase());
      } else if (department && collegeMap.has(department.toLowerCase())) {
        college_id = collegeMap.get(department.toLowerCase());
      }

      // Generate unique slug
      const baseSlug = generateSlug(name);
      let slug = baseSlug;
      let counter = 1;
      while (existingSlugs.has(slug)) {
        counter++;
        slug = `${baseSlug}-${counter}`;
      }

      existingNames.add(name.toLowerCase());
      existingSlugs.add(slug);

      rowsToInsert.push({ name, department, college_id, photo_url, slug });
    }

    // Insert valid rows in a database transaction
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const t of rowsToInsert) {
        await connection.query(
          'INSERT INTO teachers (name, department, college_id, photo_url, slug) VALUES (?, ?, ?, ?, ?)',
          [t.name, t.department, t.college_id, t.photo_url, t.slug]
        );
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    return {
      createdCount: rowsToInsert.length,
      skipped,
    };
  },

  // Export teachers to .xlsx buffer
  async exportToBuffer({ q = '', sort = 'name_asc' } = {}) {
    const teachers = await TeacherModel.getAllForExport({ q, sort });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "BISU Bilar Teacher's Day";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Teachers');

    worksheet.columns = [
      { header: 'Teacher Name', key: 'name', width: 32 },
      { header: 'College', key: 'college', width: 35 },
      { header: 'Department', key: 'department', width: 35 },
      { header: 'Profile URL Slug', key: 'slug', width: 30 },
      { header: 'Date Added', key: 'created_at', width: 22 },
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // Navy Blue
    };

    teachers.forEach(t => {
      worksheet.addRow({
        name: t.name,
        college: t.college_name || 'N/A',
        department: t.department || 'N/A',
        slug: t.slug,
        created_at: t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : '',
      });
    });

    return await workbook.xlsx.writeBuffer();
  },

  // Generate blank template with instructions
  async generateTemplateBuffer() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Teachers Template');

    worksheet.columns = [
      { header: 'Name', key: 'name', width: 32 },
      { header: 'College', key: 'college', width: 35 },
      { header: 'Department', key: 'department', width: 35 },
      { header: 'Photo URL', key: 'photo_url', width: 40 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0D9488' }, // Teal
    };

    worksheet.addRow({
      name: 'Sample Teacher Name (Required)',
      college: 'College of Teacher Education (or CTE)',
      department: 'Secondary Education (Optional)',
      photo_url: 'https://example.com/photo.jpg (Optional)',
    });

    return await workbook.xlsx.writeBuffer();
  },
};
