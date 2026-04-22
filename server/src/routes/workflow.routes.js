import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { getChartData, getWorkflowUsers, addTime } from '../controllers/workflow.controller.js';

const router = express.Router();

router.use(requireAuth);

router.get('/chart', getChartData);
router.get('/users', getWorkflowUsers);
router.post('/add-time', requireRole('SUPER_ADMIN', 'ADMIN', 'BOSS'), addTime);

export default router;
