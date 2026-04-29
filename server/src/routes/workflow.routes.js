import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { getChartData, getWorkflowUsers, addTime, upsertWorkLog } from '../controllers/workflow.controller.js';

const router = express.Router();

// Public ingest endpoint — called by the Python sync service to write worklogs.
// Registered BEFORE requireAuth so it skips the JWT check.
router.post('/', upsertWorkLog);

router.use(requireAuth);

router.get('/chart', getChartData);
router.get('/users', getWorkflowUsers);
router.post('/add-time', requireRole('SUPER_ADMIN', 'ADMIN', 'BOSS'), addTime);

export default router;
