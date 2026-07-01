/**
 * Free egress to api.telegram.org for RU VPS.
 * VPS → this Worker (Cloudflare edge) → api.telegram.org
 *
 * Deploy: see README.md in this folder.
 */
export default {
  async fetch(request, env) {
    if (request.method !== 'POST' && request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    const secret = request.headers.get('X-Telegram-Proxy-Secret');
    if (!env.PROXY_SECRET || secret !== env.PROXY_SECRET) {
      return new Response('Forbidden', { status: 403 });
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith('/bot')) {
      return new Response('Not found', { status: 404 });
    }

    const target = `https://api.telegram.org${url.pathname}${url.search}`;
    const headers = new Headers();
    const contentType = request.headers.get('Content-Type');
    if (contentType) headers.set('Content-Type', contentType);

    return fetch(target, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });
  },
};
