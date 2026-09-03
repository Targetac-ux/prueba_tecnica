import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// The rate limiter reads RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS once at module
// load time, and the global setup uses a high limit so it doesn't interfere
// with functional tests elsewhere. To test the actual blocking behavior with
// a small, fast window, load a fresh copy of the module with its own env.
async function buildLimitedApp(max: number, windowMs: number) {
  vi.resetModules();
  process.env.RATE_LIMIT_MAX = String(max);
  process.env.RATE_LIMIT_WINDOW_MS = String(windowMs);

  const { rateLimit } = await import('../../src/middleware/rate-limit.ts');

  const app = express();
  app.use((req, _res, next) => {
    // rateLimit reads req.ip; supertest requests all share the same loopback IP.
    next();
  });
  app.get('/probe', rateLimit, (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

beforeEach(() => {
  process.env.RATE_LIMIT_MAX = '1000';
  process.env.RATE_LIMIT_WINDOW_MS = '60000';
});

describe('rate limit middleware', () => {
  it('allows requests up to the limit and blocks the next one with 429', async () => {
    const app = await buildLimitedApp(3, 60000);

    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/probe');
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).get('/probe');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('releases the limit once the window passes', async () => {
    const app = await buildLimitedApp(1, 300);

    const first = await request(app).get('/probe');
    expect(first.status).toBe(200);

    const blocked = await request(app).get('/probe');
    expect(blocked.status).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 400));

    const afterWindow = await request(app).get('/probe');
    expect(afterWindow.status).toBe(200);
  });
});
