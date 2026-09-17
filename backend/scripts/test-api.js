import http from 'http';
import app from '../src/app.js';
import { TeacherExcelService } from '../src/services/teacherExcel.service.js';

// Minimal multipart form-data builder for testing without external fetch libs
function buildMultipartBody(fields, file) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const crlf = '\r\n';
  let body = '';

  for (const [key, value] of Object.entries(fields)) {
    body += `--${boundary}${crlf}`;
    body += `Content-Disposition: form-data; name="${key}"${crlf}${crlf}`;
    body += `${value}${crlf}`;
  }

  if (file) {
    body += `--${boundary}${crlf}`;
    body += `Content-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"${crlf}`;
    body += `Content-Type: ${file.mimetype}${crlf}${crlf}`;
  }

  const prefixBuffer = Buffer.from(body, 'utf-8');
  const suffixBuffer = Buffer.from(`${crlf}--${boundary}--${crlf}`, 'utf-8');

  let finalBuffer = prefixBuffer;
  if (file) {
    finalBuffer = Buffer.concat([prefixBuffer, file.buffer, suffixBuffer]);
  } else {
    finalBuffer = Buffer.concat([prefixBuffer, Buffer.from(`--${boundary}--${crlf}`, 'utf-8')]);
  }

  return {
    boundary,
    contentType: `multipart/form-data; boundary=${boundary}`,
    buffer: finalBuffer,
  };
}

// Minimal 1x1 transparent PNG buffer
const SAMPLE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

async function runApiTests() {
  console.log(' Starting Sprint 2 End-to-End API Test Suite...');

  // Start test server on ephemeral port
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(` Test server listening at ${baseUrl}\n`);

  let adminToken = null;
  let testTeacherSlug = 'dr-maria-elena-santos';
  let createdMessageId = null;
  let createdMediaId = null;
  let createdWallId = null;
  let createdAdminTeacherId = null;

  async function request(path, options = {}) {
    const url = `${baseUrl}${path}`;
    return fetch(url, options);
  }

  try {
    // 1. Health Check
    console.log('1️⃣ Testing Health Check (GET /health)...');
    const healthRes = await request('/health');
    const healthJson = await healthRes.json();
    if (healthRes.status !== 200 || healthJson.status !== 'healthy') {
      throw new Error(`Health check failed: status ${healthRes.status}`);
    }
    console.log('   Health check passed!');

    // 2. Public Teachers Directory
    console.log('2️⃣ Testing Public Teacher Directory (GET /teachers)...');
    const dirRes = await request('/teachers?page=1&limit=12&sort=name_asc');
    const dirJson = await dirRes.json();
    if (dirRes.status !== 200 || !Array.isArray(dirJson.items) || dirJson.totalCount < 1) {
      throw new Error(`Teacher directory failed: ${JSON.stringify(dirJson)}`);
    }
    console.log(`   Retrieved ${dirJson.items.length} of ${dirJson.totalCount} teachers (Page ${dirJson.page}/${dirJson.totalPages}).`);

    // 3. Search Teachers
    console.log('3️⃣ Testing Teacher Search (GET /teachers?q=Santos)...');
    const searchRes = await request('/teachers?q=Santos');
    const searchJson = await searchRes.json();
    if (searchRes.status !== 200 || searchJson.items.length === 0) {
      throw new Error(`Search failed: ${JSON.stringify(searchJson)}`);
    }
    console.log(`   Search returned: ${searchJson.items[0].name} (${searchJson.items[0].department})`);

    // 4. Teacher Detail & Timeline
    console.log(`4️⃣ Testing Teacher Profile (GET /teachers/${testTeacherSlug})...`);
    const profileRes = await request(`/teachers/${testTeacherSlug}`);
    const profileJson = await profileRes.json();
    if (profileRes.status !== 200 || !profileJson.teacher) {
      throw new Error(`Teacher profile failed: status ${profileRes.status}`);
    }
    console.log(`   Profile loaded for: ${profileJson.teacher.name}`);

    // 5. Submit Message with Media Attachment (Image BLOB)
    console.log(`5️⃣ Testing Public Timeline Submission (POST /teachers/${testTeacherSlug}/messages)...`);
    const multipart = buildMultipartBody(
      {
        sender_name: 'E2E Tester',
        message_text: 'Thank you for being such an inspirational professor!',
      },
      {
        fieldname: 'media',
        filename: 'tribute.png',
        mimetype: 'image/png',
        buffer: SAMPLE_PNG,
      }
    );

    const submitRes = await request(`/teachers/${testTeacherSlug}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': multipart.contentType,
      },
      body: multipart.buffer,
    });
    const submitJson = await submitRes.json();
    if (submitRes.status !== 201 || !submitJson.data?.id) {
      throw new Error(`Timeline submit failed: ${JSON.stringify(submitJson)}`);
    }
    createdMessageId = submitJson.data.id;
    createdMediaId = submitJson.data.media_id;
    console.log(`   Submitted message ID: ${createdMessageId}, media ID: ${createdMediaId}`);

    // 6. Media Streaming
    console.log(`6️⃣ Testing Binary Media Streaming (GET /media/${createdMediaId})...`);
    const mediaRes = await request(`/media/${createdMediaId}`);
    if (mediaRes.status !== 200 || mediaRes.headers.get('content-type') !== 'image/png') {
      throw new Error(`Media streaming failed: ${mediaRes.status}`);
    }
    const mediaBuffer = await mediaRes.arrayBuffer();
    if (mediaBuffer.byteLength !== SAMPLE_PNG.length) {
      throw new Error(`Media byte length mismatch: got ${mediaBuffer.byteLength}, expected ${SAMPLE_PNG.length}`);
    }
    console.log(`   Media streamed successfully (${mediaBuffer.byteLength} bytes).`);

    // 7. Media Download Header
    console.log(`7️⃣ Testing Media Download (GET /media/${createdMediaId}?download=1)...`);
    const downloadRes = await request(`/media/${createdMediaId}?download=1`);
    const disposition = downloadRes.headers.get('content-disposition');
    if (!disposition || !disposition.includes('attachment; filename=')) {
      throw new Error(`Content-Disposition missing or invalid: ${disposition}`);
    }
    console.log(`   Download disposition header verified: "${disposition}"`);

    // 8. Facebook Share OG Bridge
    console.log(`8️⃣ Testing Facebook Share Bridge (GET /share/media/${createdMediaId})...`);
    const shareRes = await request(`/share/media/${createdMediaId}`);
    const shareHtml = await shareRes.text();
    if (shareRes.status !== 200 || !shareHtml.includes('property="og:image"') || !shareHtml.includes('property="og:title"')) {
      throw new Error(`Share preview HTML missing OG tags: ${shareHtml}`);
    }
    console.log('   Facebook OG tags and redirect markup verified!');

    // 9. Public Wall Greeting
    console.log('9️⃣ Testing Public Wall Submission (POST /wall)...');
    const wallRes = await request('/wall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_name: 'Student Leader',
        message_text: "Happy Teacher's Day to all BISU Bilar Faculty!",
      }),
    });
    const wallJson = await wallRes.json();
    if (wallRes.status !== 201 || !wallJson.data?.id) {
      throw new Error(`Wall submit failed: ${JSON.stringify(wallJson)}`);
    }
    createdWallId = wallJson.data.id;
    console.log(`   Wall greeting posted with ID: ${createdWallId}`);

    // 10. Wall Cursor Pagination
    console.log('🔟 Testing Public Wall Retrieval (GET /wall)...');
    const getWallRes = await request('/wall?limit=10');
    const getWallJson = await getWallRes.json();
    if (getWallRes.status !== 200 || !Array.isArray(getWallJson.items) || getWallJson.count < 1) {
      throw new Error(`Get wall failed: ${JSON.stringify(getWallJson)}`);
    }
    console.log(`   Retrieved ${getWallJson.count} greetings from Public Wall.`);

    // 11. Honeypot Spam Protection
    console.log('1️⃣1️⃣ Testing Honeypot Bot Trap (POST /wall with website field)...');
    const spamRes = await request('/wall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_name: 'Spam Bot',
        message_text: 'Buy cheap watches here!',
        website: 'http://spam-link.com',
      }),
    });
    if (spamRes.status !== 400) {
      throw new Error(`Expected 400 Bad Request for honeypot, got: ${spamRes.status}`);
    }
    console.log('   Honeypot successfully trapped spam bot (400 Bad Request).');

    // 12. Admin Authentication
    console.log('1️⃣2️⃣ Testing Admin Login (POST /admin/login)...');
    const loginRes = await request('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Admin23',
        password: '@Bkkivz23',
      }),
    });
    const loginJson = await loginRes.json();
    if (loginRes.status !== 200 || !loginJson.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(loginJson)}`);
    }
    adminToken = loginJson.token;
    console.log(`   Admin authenticated successfully! JWT issued.`);

    // 13. Protected Route Without Token
    console.log('1️⃣3️⃣ Testing Route Protection Without Token (GET /admin/teachers)...');
    const unauthRes = await request('/admin/teachers');
    if (unauthRes.status !== 401) {
      throw new Error(`Expected 401 Unauthorized, got: ${unauthRes.status}`);
    }
    console.log('   Protected route correctly rejected unauthorized access (401).');

    // 14. Admin Teacher Management - Add Teacher
    console.log('1️⃣4️⃣ Testing Admin Add Teacher (POST /admin/teachers)...');
    const addTeacherRes = await request('/admin/teachers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Dr. Automated Test Educator',
        department: 'College of Teacher Education',
        photo_url: 'https://example.com/test.jpg',
      }),
    });
    const addTeacherJson = await addTeacherRes.json();
    if (addTeacherRes.status !== 201 || !addTeacherJson.data?.id) {
      throw new Error(`Add teacher failed: ${JSON.stringify(addTeacherJson)}`);
    }
    createdAdminTeacherId = addTeacherJson.data.id;
    console.log(`   Added teacher: "${addTeacherJson.data.name}", Slug: "${addTeacherJson.data.slug}"`);

    // 15. Admin Export Teachers (.xlsx)
    console.log('1️⃣5️⃣ Testing Admin Export Teachers (GET /admin/teachers/export)...');
    const exportRes = await request('/admin/teachers/export', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (exportRes.status !== 200) {
      throw new Error(`Export failed: status ${exportRes.status}`);
    }
    const exportBuffer = await exportRes.arrayBuffer();
    if (exportBuffer.byteLength < 100) {
      throw new Error(`Export buffer unexpectedly small: ${exportBuffer.byteLength} bytes`);
    }
    console.log(`   Exported Excel workbook successfully (${exportBuffer.byteLength} bytes).`);

    // 16. Admin Bulk Import (.xlsx)
    console.log('1️⃣6️⃣ Testing Admin Bulk Import (POST /admin/teachers/import)...');
    const templateBuffer = await TeacherExcelService.generateTemplateBuffer();
    const importMultipart = buildMultipartBody({}, {
      fieldname: 'file',
      filename: 'teachers-import.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(templateBuffer),
    });

    const importRes = await request('/admin/teachers/import', {
      method: 'POST',
      headers: {
        'Content-Type': importMultipart.contentType,
        Authorization: `Bearer ${adminToken}`,
      },
      body: importMultipart.buffer,
    });
    const importJson = await importRes.json();
    if (importRes.status !== 200) {
      throw new Error(`Import failed: ${JSON.stringify(importJson)}`);
    }
    console.log(`   Import response: ${importJson.createdCount} created, ${importJson.skipped?.length || 0} skipped.`);

    // 17. Admin Moderation: Media-Only Delete (leaves text message)
    console.log(`1️⃣7️⃣ Testing Media-Only Delete (DELETE /admin/media/${createdMediaId})...`);
    const delMediaRes = await request(`/admin/media/${createdMediaId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (delMediaRes.status !== 200) {
      throw new Error(`Delete media failed: status ${delMediaRes.status}`);
    }

    // Verify media is gone from /media/:id
    const verifyMediaGone = await request(`/media/${createdMediaId}`);
    if (verifyMediaGone.status !== 404) {
      throw new Error(`Expected 404 for deleted media, got: ${verifyMediaGone.status}`);
    }

    // Verify parent message text is still intact on teacher timeline
    const verifyMessageStillThere = await request(`/teachers/${testTeacherSlug}`);
    const verifyJson = await verifyMessageStillThere.json();
    const targetMsg = verifyJson.messages.find(m => m.id === createdMessageId);
    if (!targetMsg || targetMsg.media_id !== null) {
      throw new Error(`Message was unexpectedly modified or removed during media-only delete.`);
    }
    console.log('   Attached media successfully removed; message text remains intact!');

    // 18. Admin Moderation: Message Delete (cascades)
    console.log(`1️⃣8️⃣ Testing Message Delete (DELETE /admin/messages/${createdMessageId})...`);
    const delMsgRes = await request(`/admin/messages/${createdMessageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (delMsgRes.status !== 200) {
      throw new Error(`Delete message failed: status ${delMsgRes.status}`);
    }
    console.log('   Message deleted successfully.');

    // 19. Admin Moderation: Wall Greeting Delete
    console.log(`1️⃣9️⃣ Testing Wall Greeting Delete (DELETE /admin/wall/${createdWallId})...`);
    const delWallRes = await request(`/admin/wall/${createdWallId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (delWallRes.status !== 200) {
      throw new Error(`Delete wall greeting failed: status ${delWallRes.status}`);
    }
    console.log('   Wall greeting deleted successfully.');

    console.log('\n🎉 ALL 19 SPRINT 2 TESTS PASSED SUCCESSFULLY! 🎉\n');
  } catch (err) {
    console.error('\n❌ Test failure:', err.message);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runApiTests();
