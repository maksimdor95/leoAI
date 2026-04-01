import { Router } from 'express';
import { CareerController } from '../controllers/careerController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Minimal Stage 1 API
router.post('/profile', authenticateToken, CareerController.upsertProfile);
router.get('/ai-readiness', authenticateToken, CareerController.getAiReadinessScore);

// Stage 1 data model helpers
router.get(
  '/career-profile/:userId',
  authenticateToken,
  CareerController.getCareerProfileByUserId
);
router.post('/ai-readiness/mock', authenticateToken, CareerController.calculateMockAiReadiness);

// Also expose flat endpoints when router is mounted at /api
// POST /api/resume - save resume text for current user
router.post('/resume', authenticateToken, CareerController.upsertProfile);

export default router;

