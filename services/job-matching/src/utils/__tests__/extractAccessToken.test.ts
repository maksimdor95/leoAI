import {
  extractAccessToken,
  extractCookieToken,
} from '../extractAccessToken';
import { buildBearerAuthorization } from '../../services/llmRerank';

function mockReq(headers: Record<string, string | undefined>) {
  return { headers } as Parameters<typeof extractAccessToken>[0];
}

describe('extractAccessToken cookie→JWT', () => {
  it('reads leo_access_token from Cookie when Authorization is absent', () => {
    const token = extractAccessToken(
      mockReq({
        cookie: 'leo_access_token=cookie-jwt-value; other=1',
      })
    );
    expect(token).toBe('cookie-jwt-value');
  });

  it('prefers Authorization Bearer over cookie', () => {
    const token = extractAccessToken(
      mockReq({
        authorization: 'Bearer header-jwt',
        cookie: 'leo_access_token=cookie-jwt',
      })
    );
    expect(token).toBe('header-jwt');
  });

  it('prefers X-Auth-Token over cookie', () => {
    const token = extractAccessToken(
      mockReq({
        'x-auth-token': 'Bearer x-jwt',
        cookie: 'leo_access_token=cookie-jwt',
      })
    );
    expect(token).toBe('x-jwt');
  });

  it('decodes URI-encoded cookie values', () => {
    expect(extractCookieToken('leo_access_token=a%2Fb', 'leo_access_token')).toBe('a/b');
  });
});

describe('buildBearerAuthorization', () => {
  it('adds Bearer prefix for raw JWT from cookie path', () => {
    expect(buildBearerAuthorization('raw.jwt.token')).toBe('Bearer raw.jwt.token');
  });

  it('keeps existing Bearer prefix', () => {
    expect(buildBearerAuthorization('Bearer already')).toBe('Bearer already');
  });

  it('returns undefined for empty token (authPresent=false path)', () => {
    expect(buildBearerAuthorization('')).toBeUndefined();
    expect(buildBearerAuthorization(undefined)).toBeUndefined();
  });
});
