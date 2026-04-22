import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { reportController } from '../controllers/reportController';

const router = Router();

// JSON preview for interview completion UI (must be before /:reportId routes)
router.get('/preview/:sessionId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  await reportController.previewSessionReport(req, res);
});

router.post('/preview-compute', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  await reportController.previewFromCollected(req, res);
});

// Generate a new report
router.post('/generate', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  await reportController.generateReport(req, res);
});

// Get report status
router.get('/:reportId/status', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  await reportController.getReportStatus(req, res);
});

// Download report (redirects to signed URL or streams PDF)
router.get('/:reportId/download', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  await reportController.downloadReport(req, res);
});

export { router as reportRoutes };
