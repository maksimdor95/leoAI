import { NextResponse } from 'next/server';

const SERVICES = [
  { name: 'user-profile', url: 'http://127.0.0.1:3001/health' },
  { name: 'conversation', url: 'http://127.0.0.1:3002/health' },
  { name: 'ai-nlp', url: 'http://127.0.0.1:3003/health' },
  { name: 'job-matching', url: 'http://127.0.0.1:3004/health' },
  { name: 'email', url: 'http://127.0.0.1:3005/health' },
  { name: 'report', url: 'http://127.0.0.1:3007/health' },
  { name: 'telegram-support', url: 'http://127.0.0.1:3008/health' },
  { name: 'resume-parser', url: 'http://127.0.0.1:3011/health' },
];

interface ServiceHealth {
  name: string;
  status: 'ok' | 'down';
  latencyMs: number;
  detail?: unknown;
}

async function checkService(svc: (typeof SERVICES)[number]): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const res = await fetch(svc.url, {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) return { name: svc.name, status: 'down', latencyMs };
    const detail = await res.json().catch(() => null);
    return { name: svc.name, status: 'ok', latencyMs, detail };
  } catch {
    return { name: svc.name, status: 'down', latencyMs: Date.now() - start };
  }
}

export async function GET() {
  const results = await Promise.all(SERVICES.map(checkService));
  const allOk = results.every((r) => r.status === 'ok');

  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: results,
    },
    { status: allOk ? 200 : 503 },
  );
}
