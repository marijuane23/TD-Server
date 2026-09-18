import { Router } from 'express';
import { TeachersController } from '../controllers/teachers.controller.js';
import { photoUpload } from '../middleware/upload.js';

const router = Router();

// GET /teachers (search, sort, pagination)
router.get('/', TeachersController.getTeachers);

// GET /teachers/:id/photo (stream stored LONGBLOB photo)
router.get('/:id/photo', TeachersController.getTeacherPhoto);

// POST /teachers/resolve-preview (Instant preview for web links & Pinterest pins)
router.post('/resolve-preview', TeachersController.resolvePhotoPreview);

// POST /teachers/:slug/photo (Upload or update profile picture from timeline)
router.post('/:slug/photo', photoUpload.single('photo'), TeachersController.updateTeacherPhoto);

// GET /teachers/dropdown (Lightweight list of all teachers for dropdowns)
router.get('/dropdown', TeachersController.getDropdownList);

// GET /teachers/:slug (teacher detail + timeline messages)
router.get('/:slug', TeachersController.getTeacherBySlug);

export default router;
