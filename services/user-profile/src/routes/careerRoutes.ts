import { Router } from 'express';
import multer from 'multer';
import { CareerController } from '../controllers/careerController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(pdf|docx)$/i.test(file.originalname);
    if (!ok) {
      cb(new Error('Допустимы только файлы .pdf и .docx'));
      return;
    }
    cb(null, true);
  },
});

router.get('/tracks', authenticateToken, CareerController.listTracks);
router.post('/tracks', authenticateToken, CareerController.createTrack);
router.patch('/tracks/:trackId', authenticateToken, CareerController.updateTrack);
router.post('/tracks/:trackId/set-default', authenticateToken, CareerController.setDefaultTrack);

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

router.post(
  '/resumes/upload',
  authenticateToken,
  resumeUpload.single('file'),
  CareerController.uploadResume
);
router.get('/resumes', authenticateToken, CareerController.listResumes);
router.get('/resumes/:resumeId', authenticateToken, CareerController.getResumeById);
router.delete('/resumes/:resumeId', authenticateToken, CareerController.deleteResume);

export default router;

