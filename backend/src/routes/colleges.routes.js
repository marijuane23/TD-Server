import { Router } from 'express';
import { CollegesController } from '../controllers/colleges.controller.js';

const router = Router();

// GET /colleges
router.get('/', CollegesController.getColleges);

export default router;
