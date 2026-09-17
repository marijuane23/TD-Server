import pool from '../src/db/pool.js';

async function testConnection() {
  console.log('Testing remote MySQL connection to Hostinger...');
  try {
    const connection = await pool.getConnection();
    console.log(' Successfully connected to MySQL database!');

    // Check version
    const [versionRows] = await connection.query('SELECT VERSION() AS version');
    console.log(` MySQL Version: ${versionRows[0].version}`);

    // Check max_allowed_packet
    const [packetRows] = await connection.query("SHOW VARIABLES LIKE 'max_allowed_packet'");
    if (packetRows.length > 0) {
      const bytes = parseInt(packetRows[0].Value, 10);
      const megabytes = (bytes / (1024 * 1024)).toFixed(2);
      console.log(` max_allowed_packet: ${bytes} bytes (~${megabytes} MB)`);
      if (bytes < 16 * 1024 * 1024) {
        console.warn('⚠️ Warning: max_allowed_packet is below 16MB. Raising to 64MB or 128MB is recommended for video uploads.');
      }
    }

    // List existing tables
    const [tableRows] = await connection.query('SHOW TABLES');
    console.log(` Current tables (${tableRows.length}):`, tableRows.map(r => Object.values(r)[0]));

    connection.release();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testConnection();
