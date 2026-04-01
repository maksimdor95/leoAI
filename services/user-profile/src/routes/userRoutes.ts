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

router.post('/login', UserController.loginValidation, UserController.login);

// Protected routes (require authentication)
router.get('/profile', authenticateToken, UserController.getProfile);
router.put('/profile', authenticateToken, UserController.updateProfile);

export default router;
