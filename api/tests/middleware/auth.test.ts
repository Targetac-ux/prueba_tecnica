import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.ts';
import { closeDb } from '../helpers/db.ts';

afterAll(async () => {
  await closeDb();
});

describe('auth middleware', () => {
  it('returns 401 when the Authorization header is missing', async () => {
    const res = await request(app).get('/events');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when the key is incorrect', async () => {
    const res = await request(app).get('/events').set('Authorization', 'Bearer wrong-key');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for a malformed Authorization header (no Bearer prefix)', async () => {
    const res = await request(app).get('/events').set('Authorization', process.env.API_KEY!);
    expect(res.status).toBe(401);
  });

  it('passes through with the correct key', async () => {
    const res = await request(app).get('/events').set('Authorization', `Bearer ${process.env.API_KEY}`);
    expect(res.status).toBe(200);
  });

  it('does not require a key for GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
