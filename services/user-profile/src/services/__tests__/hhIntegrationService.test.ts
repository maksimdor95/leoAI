import jwt from 'jsonwebtoken';
import { HhIntegrationService } from '../hhIntegrationService';

describe('HhIntegrationService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'test-secret-for-hh-integration',
      HH_OAUTH_CLIENT_ID: 'test-client-id',
      HH_OAUTH_CLIENT_SECRET: 'test-client-secret',
      OAUTH_CALLBACK_BASE_URL: 'http://localhost:3001',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('builds authorization URL with state', () => {
    const url = HhIntegrationService.getAuthorizationUrl('user-123', '/chat');
    expect(url).toContain('https://hh.ru/oauth/authorize');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('response_type=code');
    expect(decodeURIComponent(url)).toContain(
      'redirect_uri=http://localhost:3001/api/users/oauth/hh/callback'
    );
    expect(url).toContain('state=');
  });

  it('preserves legacy redirect URI from env for HH token exchange', () => {
    process.env.HH_OAUTH_REDIRECT_URI = 'https://leo-ai.ru/api/users/oauth/callback';
    const url = HhIntegrationService.getAuthorizationUrl('user-123');
    expect(decodeURIComponent(url)).toContain(
      'redirect_uri=https://leo-ai.ru/api/users/oauth/callback'
    );
  });

  it('round-trips integration state token', () => {
    const state = HhIntegrationService.buildStateToken('user-abc', '/chat');
    const parsed = HhIntegrationService.parseStateToken(state);
    expect(parsed.userId).toBe('user-abc');
    expect(parsed.returnTo).toBe('/chat');
    expect(parsed.kind).toBe('hh_integration');
  });

  it('rejects invalid state token', () => {
    const badState = jwt.sign({ kind: 'other', userId: 'x' }, process.env.JWT_SECRET!, {
      expiresIn: '5m',
    });
    expect(() => HhIntegrationService.parseStateToken(badState)).toThrow('Invalid HH OAuth state');
  });
});
