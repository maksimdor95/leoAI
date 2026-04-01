/**
 * User Controller
 * Handles HTTP requests for user operations
 */

import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { UserService } from '../services/userService';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error';

export class UserController {
  /**
   * Validation rules for registration
   */
  static registerValidation = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('first_name').optional().isString().trim(),
    body('last_name').optional().isString().trim(),
  ];

  /**
   * Register a new user
   */
  static async register(req: Request, res: Response) {
    try {
      logger.info('Register request received');
      // #region agent log
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs');
      const logPath = 'c:\\Users\\Marina\\Desktop\\AIheroes\\.cursor\\debug.log';
      const logEntry =
        JSON.stringify({
          location: 'userController.ts:29',
          message: 'Backend: Register controller entry',
          data: {
            bodyType: typeof req.body,
            bodyIsArray: Array.isArray(req.body),
            bodyStringified: JSON.stringify(req.body),
            bodyRaw: req.body,
            contentType: req.headers['content-type'],
            contentLength: req.headers['content-length'],
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'C',
        }) + '\n';
      try {
        fs.appendFileSync(logPath, logEntry, 'utf8');
      } catch (e) {
        // Ignore file write errors in production
      }
      // #endregion

      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Validation errors:', errors.array());
        // #region agent log
        const errorLog =
          JSON.stringify({
            location: 'userController.ts:38',
            message: 'Backend: Validation errors',
            data: { errors: errors.array(), body: req.body },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'C',
          }) + '\n';
        try {
          fs.appendFileSync(logPath, errorLog, 'utf8');
        } catch (e) {
          // Ignore file write errors in production
        }
        // #endregion
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, first_name, last_name } = req.body;
      logger.info(`Registering user: ${email}`);

      const result = await UserService.register({
        email,
        password,
        first_name,
        last_name,
      });

      logger.info('User registered successfully:', result.user.id);
      return res.status(201).json({
        message: 'User registered successfully',
        ...result,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logger.error('Registration error:', error);
      if (message === 'User with this email already exists') {
        return res.status(409).json({ error: message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Validation rules for login
   */
  static loginValidation = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ];

  /**
   * Login user
   */
  static async login(req: Request, res: Response) {
    try {
      logger.info('Login request received');

      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;
      logger.info(`Login attempt for: ${email}`);

      const result = await UserService.login(email, password);

      logger.info('Login successful for:', result.user.id);
      return res.json({
        message: 'Login successful',
        ...result,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logger.error('Login error:', error);
      if (message === 'Invalid email or password') {
        return res.status(401).json({ error: message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get current user profile
   */
  static async getProfile(req: AuthRequest, res: Response) {
    try {
      logger.info('Get profile request received');

      if (!req.userId) {
        logger.warn('Unauthorized request: no userId');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      logger.info(`Getting profile for user: ${req.userId}`);
      const user = await UserService.getUserById(req.userId);
      logger.info('Profile retrieved successfully');
      return res.json(user);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logger.error('Get profile error:', error);
      if (message === 'User not found') {
        return res.status(404).json({ error: message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { email, first_name, last_name } = req.body;

      const user = await UserService.updateUser(req.userId, {
        email,
        first_name,
        last_name,
      });

      return res.json({
        message: 'Profile updated successfully',
        user,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logger.error('Update profile error:', error);
      if (message === 'User not found') {
        return res.status(404).json({ error: message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
