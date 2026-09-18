import pool from '../src/db/pool.js';

async function migrate() {
  console.log('--- Starting Wall Messages Cross-Post Migration & Sync ---');

  const connection = await pool.getConnection();
  try {
    // 1. Inspect existing columns in wall_messages
    const [columns] = await connection.query('SHOW COLUMNS FROM wall_messages');
    const colNames = columns.map(c => c.Field);
    console.log('Current wall_messages columns:', colNames.join(', '));

    // 2. Add teacher_id if missing
    if (!colNames.includes('teacher_id')) {
      console.log('Adding teacher_id column to wall_messages...');
      await connection.query(`
        ALTER TABLE wall_messages 
        ADD COLUMN teacher_id INT NULL AFTER id,
        ADD CONSTRAINT fk_wall_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
        ADD INDEX idx_wall_teacher (teacher_id)
      `);
      console.log('✓ Added teacher_id column & foreign key.');
    } else {
      console.log('• teacher_id column already exists.');
    }

    // 3. Add media_data if missing
    if (!colNames.includes('media_data')) {
      console.log('Adding media_data column to wall_messages...');
      await connection.query('ALTER TABLE wall_messages ADD COLUMN media_data LONGBLOB NULL AFTER message_text');
      console.log('✓ Added media_data column.');
    } else {
      console.log('• media_data column already exists.');
    }

    // 4. Add media_mime if missing
    if (!colNames.includes('media_mime')) {
      console.log('Adding media_mime column to wall_messages...');
      await connection.query('ALTER TABLE wall_messages ADD COLUMN media_mime VARCHAR(50) NULL AFTER media_data');
      console.log('✓ Added media_mime column.');
    } else {
      console.log('• media_mime column already exists.');
    }

    // 5. Add media_size_bytes if missing
    if (!colNames.includes('media_size_bytes')) {
      console.log('Adding media_size_bytes column to wall_messages...');
      await connection.query('ALTER TABLE wall_messages ADD COLUMN media_size_bytes INT NULL AFTER media_mime');
      console.log('✓ Added media_size_bytes column.');
    } else {
      console.log('• media_size_bytes column already exists.');
    }

    // 6. One-time backfill of existing teacher tributes (messages and photos, excluding video)
    console.log('\n--- Checking for Teacher Tributes to Backfill to Open Wall ---');
    
    // Select all messages from teacher timeline that don't have video attachments
    const [messagesToSync] = await connection.query(`
      SELECT 
        m.id AS message_id,
        m.teacher_id,
        m.sender_name,
        m.message_text,
        m.created_at,
        mm.media_data,
        mm.media_mime,
        mm.media_size_bytes,
        mm.media_type
      FROM messages m
      LEFT JOIN message_media mm ON m.id = mm.message_id
      WHERE mm.media_type IS NULL OR mm.media_type = 'image'
      ORDER BY m.id ASC
    `);

    console.log(`Found ${messagesToSync.length} eligible teacher timeline tributes (text & photos).`);

    let insertedCount = 0;
    for (const msg of messagesToSync) {
      // Avoid inserting duplicates: check if this message text + teacher_id already exists in wall_messages
      const [existing] = await connection.query(
        'SELECT id FROM wall_messages WHERE teacher_id = ? AND message_text = ? LIMIT 1',
        [msg.teacher_id, msg.message_text]
      );

      if (existing.length === 0) {
        await connection.query(`
          INSERT INTO wall_messages 
            (teacher_id, sender_name, message_text, media_data, media_mime, media_size_bytes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          msg.teacher_id,
          msg.sender_name || 'Anonymous',
          msg.message_text,
          msg.media_data || null,
          msg.media_mime || null,
          msg.media_size_bytes || null,
          msg.created_at || new Date()
        ]);
        insertedCount++;
      }
    }

    console.log(`✓ Backfill complete: ${insertedCount} timeline tributes synced to Open Wall.`);
    console.log('--- Migration & Sync Finished Successfully ---');
  } catch (err) {
    console.error('Migration error:', err);
    throw err;
  } finally {
    connection.release();
    await pool.end();
  }
}

migrate()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
