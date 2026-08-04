import {
  redactProxyUrl,
  resolveTgHttpProxyUrl,
  socksUrlWithRemoteDns,
  getTgAxiosProxyConfig,
  resetTgProxyLogFlagForTests,
} from '../tgHttpProxy';

describe('tgHttpProxy', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
    resetTgProxyLogFlagForTests();
  });

  it('prefers TG_HTTP_PROXY over TELEGRAM_PROXY_URL', () => {
    process.env.TG_HTTP_PROXY = 'socks5://u:p@host:8000';
    process.env.TELEGRAM_PROXY_URL = 'socks5://other:x@host:1';
    expect(resolveTgHttpProxyUrl()).toBe('socks5://u:p@host:8000');
  });

  it('falls back to TELEGRAM_PROXY_URL', () => {
    delete process.env.TG_HTTP_PROXY;
    process.env.TELEGRAM_PROXY_URL = 'socks5://a:b@1.2.3.4:1080';
    expect(resolveTgHttpProxyUrl()).toBe('socks5://a:b@1.2.3.4:1080');
  });

  it('rewrites socks5 → socks5h for remote DNS', () => {
    expect(socksUrlWithRemoteDns('socks5://u:p@h:1')).toBe('socks5h://u:p@h:1');
    expect(socksUrlWithRemoteDns('socks5h://u:p@h:1')).toBe('socks5h://u:p@h:1');
  });

  it('redacts credentials in proxy URL', () => {
    expect(redactProxyUrl('socks5://user:secret@1.2.3.4:8000')).toContain('***');
    expect(redactProxyUrl('socks5://user:secret@1.2.3.4:8000')).not.toContain('secret');
  });

  it('builds axios agent config when proxy set', () => {
    process.env.TG_HTTP_PROXY = 'socks5://u:p@127.0.0.1:1080';
    const cfg = getTgAxiosProxyConfig();
    expect(cfg).toBeDefined();
    expect(cfg!.proxy).toBe(false);
    expect(cfg!.httpsAgent).toBeDefined();
  });

  it('returns undefined when no proxy', () => {
    delete process.env.TG_HTTP_PROXY;
    delete process.env.TELEGRAM_PROXY_URL;
    delete process.env.HTTPS_PROXY;
    delete process.env.HTTP_PROXY;
    expect(getTgAxiosProxyConfig()).toBeUndefined();
  });
});
