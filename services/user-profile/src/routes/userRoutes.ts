/**
 * User Routes
 * API endpoints for user operations
 */

import { Router } from 'express';
import multer from 'multer';
import { UserController } from '../controllers/userController';
import { HhIntegrationController } from '../controllers/hhIntegrationController';
import { authenticateToken } from '../middleware/auth';
import { authRateLimit, passwordResetRateLimit } from '../middleware/ipRateLimit';

const router = Router();

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype);
    if (!ok) {
      cb(new Error('Допустимы только изображения JPEG, PNG, WebP или GIF'));
      return;
    }
    cb(null, true);
  },
});

// Public routes
router.post('/', authRateLimit, UserController.registerValidation, UserController.register);
router.post('/register', authRateLimit, UserController.registerValidation, UserController.register);

router.get('/login', (_req, res) => {
  res.status(405).set('Allow', 'POST').json({
    error: 'Метод не поддерживается. Для входа используйте POST /api/users/login с JSON { email, password }.',
  });
});

router.post('/login', authRateLimit, UserController.loginValidation, UserController.login);
router.post('/logout', UserController.logout);
router.post('/forgot-password', passwordResetRateLimit, UserController.forgotPasswordValidation, UserController.forgotPassword);
router.post('/reset-password', passwordResetRateLimit, UserController.resetPasswordValidation, UserController.resetPassword);
router.get('/reset-password/validate', passwordResetRateLimit, UserController.validateResetToken);
router.get('/oauth/hh/start', authenticateToken, HhIntegrationController.oauthStart);
router.get('/oauth/hh/callback', HhIntegrationController.oauthCallback);
router.get('/oauth/callback', HhIntegrationController.oauthCallback);
router.get('/oauth/:provider/start', UserController.oauthStart);
router.get('/oauth/:provider/callback', UserController.oauthCallback);
router.get('/integrations/hh', authenticateToken, HhIntegrationController.getStatus);
router.delete('/integrations/hh', authenticateToken, HhIntegrationController.revoke);

// Public avatar image (for <img src>)
router.get('/:userId/avatar', UserController.getAvatar);

// Protected routes (require authentication)
router.get('/profile', authenticateToken, UserController.getProfile);
router.put('/profile', authenticateToken, UserController.updateProfile);
router.post(
  '/profile/avatar',
  authenticateToken,
  (req, res, next) => {
    avatarUpload.single('file')(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        return res.status(400).json({ error: message });
      }
      return next();
    });
  },
  UserController.uploadAvatar
);
router.delete('/profile/avatar', authenticateToken, UserController.deleteAvatar);

export default router;
