import express from 'express';
import request from 'supertest';
import userRoutes from '../userRoutes';
import { HhIntegrationService } from '../../services/hhIntegrationService';

describe('userRoutes HH OAuth', () => {
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
    app.use('/api/users', userRoutes);
    return app;
  }

  it('delegates /oauth/hh/callback to HH integration handler', async () => {
    jest.spyOn(HhIntegrationService, 'exchangeAuthorizationCode').mockResolvedValue({} as never);
    jest
      .spyOn(HhIntegrationService, 'getSuccessRedirect')
      .mockReturnValue('http://localhost:3000/oauth/callback?success=1');

    const state = HhIntegrationService.buildStateToken('user-hh', '/chat');
    const response = await request(buildApp())
      .get('/api/users/oauth/hh/callback')
      .query({ code: 'auth-code', state });

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('success=1');
    expect(HhIntegrationService.exchangeAuthorizationCode).toHaveBeenCalledWith('auth-code', 'user-hh');
  });

  it('does not return Unsupported OAuth provider for /oauth/hh/callback', async () => {
    jest.spyOn(HhIntegrationService, 'exchangeAuthorizationCode').mockResolvedValue({} as never);
    jest
      .spyOn(HhIntegrationService, 'getSuccessRedirect')
      .mockReturnValue('http://localhost:3000/oauth/callback?success=1');

    const state = HhIntegrationService.buildStateToken('user-hh');
    const response = await request(buildApp())
      .get('/api/users/oauth/hh/callback')
      .query({ code: 'auth-code', state });

    expect(response.text).not.toContain('Unsupported OAuth provider');
  });
});
