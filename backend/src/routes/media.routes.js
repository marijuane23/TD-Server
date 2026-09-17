import { Router } from 'express';
import { MediaController } from '../controllers/media.controller.js';

const router = Router();

// GET /media/:media_id (?download=1)
router.get('/:media_id', MediaController.getMedia);

export default router;
