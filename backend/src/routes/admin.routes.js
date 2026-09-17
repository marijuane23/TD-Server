import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { excelUpload, photoUpload } from '../middleware/upload.js';

const router = Router();

// Public admin login (rate limited in app.js)
router.post('/login', AdminController.login);

// --- Protected Admin Routes (JWT Required) ---
router.use(requireAdmin);

// Teachers management
router.get('/teachers', AdminController.getTeachers);
router.post('/teachers', photoUpload.single('photo'), AdminController.addTeacher);
router.delete('/teachers/:id', AdminController.deleteTeacher);
router.post('/teachers/bulk-delete', AdminController.bulkDeleteTeachers);
router.post('/teachers/import', excelUpload.single('file'), AdminController.importTeachers);
router.get('/teachers/export', AdminController.exportTeachers);
router.get('/teachers/template', AdminController.downloadTemplate);
router.get('/teachers/:id/messages', AdminController.getTeacherMessages);

// Post-hoc moderation
router.delete('/messages/:id', AdminController.deleteMessage);
router.delete('/media/:id', AdminController.deleteMedia);
router.delete('/wall/:id', AdminController.deleteWallGreeting);

export default router;
