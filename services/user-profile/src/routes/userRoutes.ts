/**
 * User Routes
 * API endpoints for user operations
 */

import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/', UserController.registerValidation, UserController.register);
router.post('/register', UserController.registerValidation, UserController.register);

router.get('/login', (_req, res) => {
  res.status(405).set('Allow', 'POST').json({
    error: 'Метод не поддерживается. Для входа используйте POST /api/users/login с JSON { email, password }.',
  });
});

router.post('/login', UserController.loginValidation, UserController.login);
router.post('/logout', UserController.logout);
router.post('/forgot-password', UserController.forgotPasswordValidation, UserController.forgotPassword);
router.post('/reset-password', UserController.resetPasswordValidation, UserController.resetPassword);
router.get('/reset-password/validate', UserController.validateResetToken);
router.get('/oauth/:provider/start', UserController.oauthStart);
router.get('/oauth/:provider/callback', UserController.oauthCallback);

// Protected routes (require authentication)
router.get('/profile', authenticateToken, UserController.getProfile);
router.put('/profile', authenticateToken, UserController.updateProfile);

export default router;
