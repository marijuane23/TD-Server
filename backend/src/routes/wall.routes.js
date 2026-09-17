import { Router } from 'express';
import { WallController } from '../controllers/wall.controller.js';

const router = Router();

// GET /wall (?after_id=&limit=)
router.get('/', WallController.getWallGreetings);

// POST /wall (submit new greeting)
router.post('/', WallController.postGreeting);

export default router;
