import express from 'express';
import request from 'supertest';
import { HhIntegrationController } from '../../controllers/hhIntegrationController';
import { HhIntegrationService } from '../../services/hhIntegrationService';

describe('HH OAuth callback routes', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'test-secret-for-hh-integration',
    };
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function buildApp() {
    const app = express();
    const router = express.Router();
    router.get('/oauth/hh/callback', HhIntegrationController.oauthCallback);
    router.get('/oauth/callback', HhIntegrationController.oauthCallback);
    app.use('/api/users', router);
    return app;
  }

  it('accepts legacy /oauth/callback path', async () => {
    jest.spyOn(HhIntegrationService, 'exchangeAuthorizationCode').mockResolvedValue({} as never);
    jest
      .spyOn(HhIntegrationService, 'getSuccessRedirect')
      .mockReturnValue('http://localhost:3000/oauth/callback?success=1');

    const state = HhIntegrationService.buildStateToken('user-123', '/chat');
    const app = buildApp();

    const response = await request(app)
      .get('/api/users/oauth/callback')
      .query({ code: 'auth-code', state });

    expect(response.status).toBe(302);
    expect(HhIntegrationService.exchangeAuthorizationCode).toHaveBeenCalledWith('auth-code', 'user-123');
  });

  it('accepts canonical /oauth/hh/callback path', async () => {
    jest.spyOn(HhIntegrationService, 'exchangeAuthorizationCode').mockResolvedValue({} as never);
    jest
      .spyOn(HhIntegrationService, 'getSuccessRedirect')
      .mockReturnValue('http://localhost:3000/oauth/callback?success=1');

    const state = HhIntegrationService.buildStateToken('user-456');
    const app = buildApp();

    const response = await request(app)
      .get('/api/users/oauth/hh/callback')
      .query({ code: 'auth-code-2', state });

    expect(response.status).toBe(302);
    expect(HhIntegrationService.exchangeAuthorizationCode).toHaveBeenCalledWith('auth-code-2', 'user-456');
  });
});
