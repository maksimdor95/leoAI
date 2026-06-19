/**
 * User Controller
 * Handles HTTP requests for user operations
 */

import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { UserService } from '../services/userService';
import { PasswordResetService } from '../services/passwordResetService';
import { OAuthProvider, OAuthService } from '../services/oauthService';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

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

      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Validation errors:', errors.array());
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
      setAuthCookies(res, result.token);
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
      setAuthCookies(res, result.token);
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

  static async oauthStart(req: Request, res: Response) {
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
      return res.redirect(OAuthService.getSuccessRedirect(provider, token));
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
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body as { email: string };
      await PasswordResetService.requestReset(email);

      return res.json({
        message:
          'Если аккаунт с таким email существует, мы отправили ссылку для сброса пароля.',
      });
    } catch (error: unknown) {
      logger.error('Forgot password error:', error);
      return res.status(500).json({ error: 'Не удалось отправить письмо. Попробуйте позже.' });
    }
  }

  static resetPasswordValidation = [
    body('token').isString().trim().notEmpty().withMessage('Reset token is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ];

  static async resetPassword(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, password } = req.body as { token: string; password: string };
      await PasswordResetService.resetPassword(token, password);

      return res.json({ message: 'Пароль успешно обновлён. Теперь можно войти.' });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logger.error('Reset password error:', error);
      if (message === 'Invalid or expired reset token') {
        return res.status(400).json({ error: 'Ссылка недействительна или устарела. Запросите новую.' });
      }
      return res.status(500).json({ error: 'Не удалось обновить пароль. Попробуйте позже.' });
    }
  }

  static async validateResetToken(req: Request, res: Response) {
    try {
      const token = typeof req.query.token === 'string' ? req.query.token : '';
      const valid = await PasswordResetService.validateToken(token);
      if (!valid) {
        return res.status(400).json({ valid: false, error: 'Ссылка недействительна или устарела.' });
      }
      return res.json({ valid: true });
    } catch (error: unknown) {
      logger.error('Validate reset token error:', error);
      return res.status(500).json({ valid: false, error: 'Internal server error' });
    }
  }
}
