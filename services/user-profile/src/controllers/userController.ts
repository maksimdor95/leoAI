/**
 * User Controller
 * Handles HTTP requests for user operations
 */

import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { UserService } from '../services/userService';
import { PasswordResetService } from '../services/passwordResetService';
import { OAuthProvider, OAuthService } from '../services/oauthService';
import { HhIntegrationController } from './hhIntegrationController';
import { HhIntegrationService } from '../services/hhIntegrationService';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import {
  AUTH_ERROR_CODES,
  buildAuthErrorBody,
  sendAuthError,
  sendValidationAuthError,
} from '../utils/authErrors';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error';

function getCookieOptions(httpOnly: boolean) {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

function clearAuthCookies(res: Response): void {
  const options = getCookieOptions(true);
  res.clearCookie('leo_access_token', { ...options, maxAge: undefined });
  res.clearCookie('leo_auth', { ...getCookieOptions(false), maxAge: undefined });
}

function setAuthCookies(res: Response, token: string): void {
  res.cookie('leo_access_token', token, getCookieOptions(true));
  res.cookie('leo_auth', '1', getCookieOptions(false));
}

export class UserController {
  private static parseProvider(providerRaw: string): OAuthProvider {
    // Google OAuth отключён (требования РФ). Код в oauthService сохранён для возможного возврата.
    if (providerRaw === 'google') {
      throw new Error('Google OAuth is disabled');
    }
    if (providerRaw === 'yandex') {
      return providerRaw;
    }
    throw new Error('Unsupported OAuth provider');
  }
  /**
   * Validation rules for registration
   */
  static registerValidation = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[A-Za-z]/)
      .withMessage('Password must contain at least one letter')
      .matches(/\d/)
      .withMessage('Password must contain at least one digit'),
    body('first_name').optional().isString().trim(),
    body('last_name').optional().isString().trim(),
  ];

  /**
   * Register a new user
   */
  static async register(req: Request, res: Response) {
    try {
      logger.info('Register request received');

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Validation errors:', errors.array());
        return sendValidationAuthError(res, errors.array());
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
      setAuthCookies(res, result.token);
      return res.status(201).json({
        message: 'User registered successfully',
        ...result,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logger.error('Registration error:', error);
      if (message === 'User with this email already exists') {
        return sendAuthError(res, 409, AUTH_ERROR_CODES.EMAIL_TAKEN, {
          fields: { email: [AUTH_ERROR_CODES.EMAIL_TAKEN] },
        });
      }
      return sendAuthError(res, 500, AUTH_ERROR_CODES.INTERNAL);
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

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Validation errors:', errors.array());
        return sendValidationAuthError(res, errors.array());
      }

      const { email, password } = req.body;
      logger.info(`Login attempt for: ${email}`);

      const result = await UserService.login(email, password);

      logger.info('Login successful for:', result.user.id);
      setAuthCookies(res, result.token);
      return res.json({
        message: 'Login successful',
        ...result,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logger.error('Login error:', error);
      if (message === 'Invalid email or password') {
        return sendAuthError(res, 401, AUTH_ERROR_CODES.INVALID_CREDENTIALS);
      }
      return sendAuthError(res, 500, AUTH_ERROR_CODES.INTERNAL);
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

  static async uploadAvatar(
    req: AuthRequest & { file?: { buffer: Buffer; originalname: string; mimetype: string } },
    res: Response
  ) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!req.file?.buffer) {
        return res.status(400).json({
          error: 'Файл не передан. Используйте поле file (multipart/form-data).',
        });
      }
      const user = await UserService.uploadAvatar(req.userId, {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
      });
      return res.status(200).json({
        message: 'Avatar updated',
        user,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logger.error('Upload avatar error:', error);
      if (message === 'User not found') {
        return res.status(404).json({ error: message });
      }
      return res.status(400).json({ error: message });
    }
  }

  static async deleteAvatar(req: AuthRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const user = await UserService.deleteAvatar(req.userId);
      return res.json({ message: 'Avatar removed', user });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logger.error('Delete avatar error:', error);
      if (message === 'User not found') {
        return res.status(404).json({ error: message });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /** Public: serve avatar image for <img src>. */
  static async getAvatar(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
        return res.status(400).json({ error: 'Invalid user id' });
      }
      const file = await UserService.resolveAvatarFile(userId);
      if (!file) {
        return res.status(404).json({ error: 'Avatar not found' });
      }
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      // Allow <img> from Next.js origin in local dev (different port).
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      return res.sendFile(file.absolutePath);
    } catch (error: unknown) {
      logger.error('Get avatar error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async oauthStart(req: Request, res: Response) {
    if (req.params.provider === 'hh') {
      return HhIntegrationController.oauthStart(req as AuthRequest, res);
    }

    let provider: OAuthProvider | null = null;
    try {
      provider = UserController.parseProvider(req.params.provider);
      const url = OAuthService.getAuthorizationUrl(provider);
      return res.redirect(url);
    } catch (error: unknown) {
      logger.error('OAuth start error:', error);
      if (provider !== null) {
        const reason = getErrorMessage(error);
        return res.redirect(OAuthService.getFailureRedirect(provider, reason));
      }
      return res.status(400).json({ error: getErrorMessage(error) });
    }
  }

  static async oauthCallback(req: Request, res: Response) {
    if (
      req.params.provider === 'hh' ||
      HhIntegrationService.isIntegrationCallbackState(req.query.state)
    ) {
      return HhIntegrationController.oauthCallback(req, res);
    }

    let provider: OAuthProvider;
    try {
      provider = UserController.parseProvider(req.params.provider);
    } catch (error: unknown) {
      return res.status(400).json({ error: getErrorMessage(error) });
    }

    try {
      const code = req.query.code;
      const state = req.query.state;
      if (typeof code !== 'string' || typeof state !== 'string') {
        throw new Error('Missing OAuth callback parameters');
      }

      const token = await OAuthService.exchangeCodeAndLogin(provider, code, state);
      setAuthCookies(res, token);
      return res.redirect(OAuthService.getSuccessRedirect(provider));
    } catch (error: unknown) {
      const reason = getErrorMessage(error);
      logger.error('OAuth callback error:', error);
      return res.redirect(OAuthService.getFailureRedirect(provider, reason));
    }
  }

  static async logout(_req: Request, res: Response) {
    clearAuthCookies(res);
    return res.json({ message: 'Logout successful' });
  }

  static forgotPasswordValidation = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  ];

  static async forgotPassword(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendValidationAuthError(res, errors.array());
      }

      const { email } = req.body as { email: string };
      await PasswordResetService.requestReset(email);

      return res.json({
        message:
          'Если аккаунт с таким email существует, мы отправили ссылку для сброса пароля.',
      });
    } catch (error: unknown) {
      logger.error('Forgot password error:', error);
      return sendAuthError(res, 500, AUTH_ERROR_CODES.INTERNAL, {
        message: 'Не удалось отправить письмо. Попробуйте позже.',
      });
    }
  }

  static resetPasswordValidation = [
    body('token').isString().trim().notEmpty().withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[A-Za-z]/)
      .withMessage('Password must contain at least one letter')
      .matches(/\d/)
      .withMessage('Password must contain at least one digit'),
  ];

  static async resetPassword(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendValidationAuthError(res, errors.array());
      }

      const { token, password } = req.body as { token: string; password: string };
      await PasswordResetService.resetPassword(token, password);

      return res.json({ message: 'Пароль успешно обновлён. Теперь можно войти.' });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logger.error('Reset password error:', error);
      if (message === 'Invalid or expired reset token') {
        return sendAuthError(res, 400, AUTH_ERROR_CODES.RESET_TOKEN_INVALID, {
          message: 'Ссылка недействительна или устарела. Запросите новую.',
          fields: { token: [AUTH_ERROR_CODES.RESET_TOKEN_INVALID] },
        });
      }
      return sendAuthError(res, 500, AUTH_ERROR_CODES.INTERNAL, {
        message: 'Не удалось обновить пароль. Попробуйте позже.',
      });
    }
  }

  static async validateResetToken(req: Request, res: Response) {
    try {
      const token = typeof req.query.token === 'string' ? req.query.token : '';
      const valid = await PasswordResetService.validateToken(token);
      if (!valid) {
        return res.status(400).json({
          valid: false,
          ...buildAuthErrorBody(AUTH_ERROR_CODES.RESET_TOKEN_INVALID, {
            message: 'Ссылка недействительна или устарела.',
          }),
        });
      }
      return res.json({ valid: true });
    } catch (error: unknown) {
      logger.error('Validate reset token error:', error);
      return res.status(500).json({
        valid: false,
        ...buildAuthErrorBody(AUTH_ERROR_CODES.INTERNAL),
      });
    }
  }
}
