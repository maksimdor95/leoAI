import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn && process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.replayIntegration()],
    beforeSend(event, hint) {
      const error = hint.originalException;
      if (isThirdPartyBrowserExtensionError(error, event)) {
        return null;
      }
      return event;
    },
  });
}

function isThirdPartyBrowserExtensionError(
  error: unknown,
  event: Sentry.ErrorEvent
): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : event.message ?? '';

  if (/tronlink|metamask|phantom|coinbase wallet/i.test(message)) {
    return true;
  }

  const frames = event.exception?.values?.flatMap((value) => value.stacktrace?.frames ?? []) ?? [];
  return frames.some((frame) => {
    const filename = frame.filename ?? '';
    return (
      filename.includes('injected/injected.js') ||
      filename.includes('chrome-extension://') ||
      filename.includes('moz-extension://')
    );
  });
}
