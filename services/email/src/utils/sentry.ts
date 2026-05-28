import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;

export function initSentry(serviceName: string): void {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: `${serviceName}@${process.env.APP_VERSION || '0.0.0'}`,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });
}

export { Sentry };
