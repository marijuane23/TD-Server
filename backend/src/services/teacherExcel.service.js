import ExcelJS from 'exceljs';
import pool from '../db/pool.js';
import { generateSlug } from '../utils/validators.js';
import { TeacherModel } from '../models/teacher.model.js';

export const TeacherExcelService = {
  // Parse uploaded .xlsx file and bulk insert teachers/staff
  async importFromBuffer(buffer, { defaultRole = 'faculty' } = {}) {
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
    let roleCol = null;

    // Detect header row
    const firstRow = worksheet.getRow(1);
    firstRow.eachCell((cell, colNumber) => {
      const val = String(cell.value || '').trim().toLowerCase();
      if (val.includes('name')) nameCol = colNumber;
      if (val.includes('college')) collegeCol = colNumber;
      if (val.includes('department') || val.includes('dept') || val.includes('office') || val.includes('unit')) deptCol = colNumber;
      if (val.includes('photo') || val.includes('image')) photoCol = colNumber;
      if (val.includes('role') || val.includes('category') || val.includes('type')) roleCol = colNumber;
    });

    const [colleges] = await pool.query('SELECT id, name, code FROM colleges');
    
    function resolveCollegeId(val, dept) {
      if (!val && !dept) return null;
      const candidates = [val, dept].filter(Boolean).map(s => String(s).trim().toLowerCase());
      for (const text of candidates) {
        for (const col of colleges) {
          const codeLower = col.code.toLowerCase();
          const nameLower = col.name.toLowerCase();
          if (text === codeLower || text === nameLower || text.includes(codeLower) || text.includes(nameLower)) {
            return col.id;
          }
        }
      }
      return null;
    }

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
      const roleRaw = roleCol ? row.getCell(roleCol).value : null;

      const name = nameRaw ? String(nameRaw).trim() : '';
      const collegeVal = collegeRaw ? String(collegeRaw).trim() : null;
      const department = deptRaw ? String(deptRaw).trim() : null;
      const photo_url = photoRaw ? String(photoRaw).trim() : null;
      const roleVal = roleRaw ? String(roleRaw).trim().toLowerCase() : '';
      const role = (roleVal === 'staff' || roleVal === 'faculty') ? roleVal : (defaultRole === 'staff' ? 'staff' : 'faculty');

      if (!name) {
        skipped.push({ row: r, reason: 'Missing required name' });
        continue;
      }

      if (existingNames.has(name.toLowerCase())) {
        skipped.push({ row: r, name, reason: 'Name already exists' });
        continue;
      }

      // Map college_id from college column or department fallback (optional)
      let college_id = null;
      if (collegeVal || department) {
        college_id = resolveCollegeId(collegeVal, department);
        if (collegeVal && !college_id) {
          skipped.push({
            row: r,
            name,
            reason: `Unrecognized college "${collegeVal}". Valid colleges: CTECH, CTE, CBM, CFES, COAS, CADS. Leave blank if not affiliated.`,
          });
          continue;
        }
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

      rowsToInsert.push({ name, department, role, college_id, photo_url, slug });
    }

    // Insert valid rows in a database transaction
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const t of rowsToInsert) {
        await connection.query(
          'INSERT INTO teachers (name, department, role, college_id, photo_url, slug) VALUES (?, ?, ?, ?, ?, ?)',
          [t.name, t.department, t.role, t.college_id, t.photo_url, t.slug]
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

    const worksheet = workbook.addWorksheet('Directory Roster');

    worksheet.columns = [
      { header: 'Name', key: 'name', width: 32 },
      { header: 'Role', key: 'role', width: 16 },
      { header: 'College', key: 'college', width: 42 },
      { header: 'College Code', key: 'college_code', width: 16 },
      { header: 'Department / Office', key: 'department', width: 35 },
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
        role: t.role === 'staff' ? 'Staff' : 'Faculty',
        college: t.college_name || 'N/A',
        college_code: t.college_code || 'N/A',
        department: t.department || '',
        slug: t.slug,
        created_at: t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : '',
      });
    });

    return await workbook.xlsx.writeBuffer();
  },

  // Generate blank template with reference sheet
  async generateTemplateBuffer({ role = 'faculty' } = {}) {
    const isStaff = role === 'staff';
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "BISU Bilar Teacher's Day";
    workbook.created = new Date();

    // Sheet 1: Template
    const sheetName = isStaff ? 'Staff Template' : 'Faculty Template';
    const templateSheet = workbook.addWorksheet(sheetName);
    templateSheet.columns = [
      { header: isStaff ? 'Staff Name' : 'Faculty Name', key: 'name', width: 32 },
      { header: 'College (Optional)', key: 'college', width: 42 },
      { header: isStaff ? 'Department / Office (Optional)' : 'Department (Optional)', key: 'department', width: 35 },
      { header: 'Photo URL (Optional)', key: 'photo_url', width: 40 },
    ];

    const headerRow = templateSheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isStaff ? 'FF0D9488' : 'FF1E3A8A' }, // Teal for Staff, Navy for Faculty
    };

    if (isStaff) {
      templateSheet.addRow({
        name: 'Engr. Roberto Cruz',
        college: 'CADS',
        department: 'Administrative Services',
        photo_url: '',
      });
      templateSheet.addRow({
        name: 'Ms. Carmela Bautista',
        college: '',
        department: 'Registrar Office',
        photo_url: '',
      });
    } else {
      templateSheet.addRow({
        name: 'Dr. Maria Elena Santos',
        college: 'CTECH',
        department: 'Computer Science Department',
        photo_url: '',
      });
      templateSheet.addRow({
        name: 'Prof. Juan Dela Cruz',
        college: 'College of Teacher Education',
        department: '',
        photo_url: '',
      });
    }

    // Sheet 2: Colleges Reference
    const refSheet = workbook.addWorksheet('Colleges Reference');
    refSheet.columns = [
      { header: 'College Code', key: 'code', width: 18 },
      { header: 'Official College Name', key: 'name', width: 50 },
    ];

    const refHeader = refSheet.getRow(1);
    refHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    refHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // Navy Blue
    };

    const [colleges] = await pool.query('SELECT code, name FROM colleges ORDER BY id ASC');
    colleges.forEach(c => {
      refSheet.addRow({ code: c.code, name: c.name });
    });

    return await workbook.xlsx.writeBuffer();
  },
};
