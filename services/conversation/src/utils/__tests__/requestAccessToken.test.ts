import { extractRequestAccessToken } from '../requestAccessToken';

describe('extractRequestAccessToken', () => {
  it('reads Bearer from Authorization header', () => {
    const req = {
      headers: { authorization: 'Bearer header-token' },
    } as Parameters<typeof extractRequestAccessToken>[0];

    expect(extractRequestAccessToken(req)).toBe('header-token');
  });

  it('reads token from leo_access_token cookie when header is absent', () => {
    const req = {
      headers: { cookie: 'other=1; leo_access_token=cookie-token; path=/' },
    } as Parameters<typeof extractRequestAccessToken>[0];

    expect(extractRequestAccessToken(req)).toBe('cookie-token');
  });

  it('prefers header over cookie', () => {
    const req = {
      headers: {
        authorization: 'Bearer header-token',
        cookie: 'leo_access_token=cookie-token',
      },
    } as Parameters<typeof extractRequestAccessToken>[0];

    expect(extractRequestAccessToken(req)).toBe('header-token');
  });
});
