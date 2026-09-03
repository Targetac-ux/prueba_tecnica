import type { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, WINDOW_MS).unref();

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || 'unknown';
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  bucket.count++;
  const remaining = Math.max(0, MAX_REQUESTS - bucket.count);
  res.setHeader('X-RateLimit-Remaining', remaining.toString());

  if (bucket.count > MAX_REQUESTS) {
    const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfterSec.toString());
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Demasiadas peticiones, intenta más tarde',
        request_id: req.requestId,
      },
    });
    return;
  }

  next();
}
