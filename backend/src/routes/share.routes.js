import { Router } from 'express';
import { ShareController } from '../controllers/share.controller.js';

const router = Router();

// GET /share/media/:media_id (Facebook OG preview + redirect)
router.get('/media/:media_id', ShareController.getSharePreview);

export default router;
