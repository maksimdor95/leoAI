import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { reportController } from '../controllers/reportController';

const router = Router();

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
