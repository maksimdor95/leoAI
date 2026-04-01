import { Request, Response } from 'express';

export function healthCheck(_req: Request, res: Response) {
  res.json({
    status: 'ok',
    service: 'report-service',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
  });
}
