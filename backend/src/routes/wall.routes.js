import { Router } from 'express';
import { WallController } from '../controllers/wall.controller.js';
import { photoUpload } from '../middleware/upload.js';

const router = Router();

// GET /wall (?after_id=&limit=)
router.get('/', WallController.getWallGreetings);

// GET /wall/:id/image (stream attached image)
router.get('/:id/image', WallController.getWallImage);

// POST /wall (submit new greeting with optional photo & teacher dedication)
router.post('/', photoUpload.single('image'), WallController.postGreeting);

export default router;

