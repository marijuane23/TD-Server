import { Router } from 'express';
import { MessagesController } from '../controllers/messages.controller.js';
import { mediaUpload } from '../middleware/upload.js';

const router = Router({ mergeParams: true });

// POST /teachers/:slug/messages (multipart: sender_name, message_text, optional media)
router.post('/:slug/messages', mediaUpload.single('media'), MessagesController.submitMessage);

export default router;
