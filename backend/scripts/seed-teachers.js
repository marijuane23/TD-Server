import pool from '../src/db/pool.js';

// Helper function to generate clean URL slug from name
function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const sampleFaculty = [
  { name: 'Dr. Maria Elena Santos', department: 'College of Teacher Education', photo_url: null },
  { name: 'Prof. Juan Carlos Dela Cruz', department: 'College of Agriculture', photo_url: null },
  { name: 'Engr. Roberto M. Garcia', department: 'College of Technology & Allied Sciences', photo_url: null },
  { name: 'Dr. Carmela R. Mendoza', department: 'College of Forestry & Environmental Science', photo_url: null },
  { name: 'Prof. Antonio L. Reyes', department: 'College of Teacher Education', photo_url: null },
  { name: 'Dr. Grace V. Fernandez', department: 'College of Agriculture', photo_url: null },
  { name: 'Prof. Mark Joseph Bautista', department: 'Computer Studies & ICT', photo_url: null },
  { name: 'Dr. Lourdes B. Ramos', department: 'General Education', photo_url: null },
  { name: 'Prof. Christopher D. Tan', department: 'College of Technology & Allied Sciences', photo_url: null },
  { name: 'Dr. Rowena P. Castro', department: 'College of Teacher Education', photo_url: null },
  { name: 'Prof. Joel T. Aquino', department: 'College of Agriculture', photo_url: null },
  { name: 'Dr. Evelyn S. Mercado', department: 'General Education', photo_url: null },
  { name: 'Prof. Arnold K. Villanueva', department: 'College of Forestry & Environmental Science', photo_url: null },
  { name: 'Dr. Patricia Mae Navarro', department: 'Computer Studies & ICT', photo_url: null },
  { name: 'Prof. Ferdinand G. Soriano', department: 'College of Teacher Education', photo_url: null },
];

async function seedTeachers() {
  console.log('Seeding initial faculty records into teachers table...');
  try {
    const connection = await pool.getConnection();

    // Check existing count
    const [existing] = await connection.query('SELECT COUNT(*) AS count FROM teachers');
    console.log(`Current teacher count in DB: ${existing[0].count}`);

    let inserted = 0;
    let skipped = 0;

    for (const faculty of sampleFaculty) {
      const baseSlug = generateSlug(faculty.name);
      let slug = baseSlug;
      let counter = 1;

      // Check if slug or name exists
      const [duplicate] = await connection.query(
        'SELECT id FROM teachers WHERE LOWER(name) = LOWER(?) OR slug = ?',
        [faculty.name, slug]
      );

      if (duplicate.length > 0) {
        skipped++;
        continue;
      }

      // Ensure unique slug
      while (true) {
        const [slugCheck] = await connection.query('SELECT id FROM teachers WHERE slug = ?', [slug]);
        if (slugCheck.length === 0) break;
        counter++;
        slug = `${baseSlug}-${counter}`;
      }

      await connection.query(
        'INSERT INTO teachers (name, department, photo_url, slug) VALUES (?, ?, ?, ?)',
        [faculty.name, faculty.department, faculty.photo_url, slug]
      );
      inserted++;
    }

    console.log(` Seeding complete: ${inserted} teachers added, ${skipped} already existed.`);

    // Display all teachers
    const [allTeachers] = await connection.query('SELECT id, name, department, slug FROM teachers ORDER BY id ASC');
    console.log(`\nTotal teachers in database: ${allTeachers.length}`);
    console.table(allTeachers);

    connection.release();
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seedTeachers();
