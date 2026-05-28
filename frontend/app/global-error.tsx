'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2>Что-то пошло не так</h2>
          <button onClick={() => reset()} style={{ marginTop: 16, padding: '8px 24px' }}>
            Попробовать снова
          </button>
        </div>
      </body>
    </html>
  );
}
