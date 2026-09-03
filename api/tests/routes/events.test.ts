import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.ts';
import { clearEvents, closeDb, insertTestEvent } from '../helpers/db.ts';

const AUTH = { Authorization: `Bearer ${process.env.API_KEY}` };

beforeEach(async () => {
  await clearEvents();
});

afterAll(async () => {
  await closeDb();
});

describe('POST /events validation', () => {
  it('rejects an unknown level', async () => {
    const res = await request(app)
      .post('/events')
      .set(AUTH)
      .send({ level: 'critical', message: 'x', source: 'y' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed timestamp', async () => {
    const res = await request(app)
      .post('/events')
      .set(AUTH)
      .send({ level: 'info', message: 'x', source: 'y', timestamp: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects metadata nested beyond the allowed depth', async () => {
    let deepMetadata: Record<string, unknown> = { leaf: true };
    for (let i = 0; i < 15; i++) {
      deepMetadata = { nested: deepMetadata };
    }

    const res = await request(app)
      .post('/events')
      .set(AUTH)
      .send({ level: 'info', message: 'x', source: 'y', metadata: deepMetadata });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty body', async () => {
    const res = await request(app).post('/events').set(AUTH).send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a body missing required fields', async () => {
    const res = await request(app).post('/events').set(AUTH).send({ level: 'info' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'message' })])
    );
  });

  it('accepts a valid event and defaults metadata and timestamp', async () => {
    const res = await request(app)
      .post('/events')
      .set(AUTH)
      .send({ level: 'error', message: 'payment failed', source: 'checkout' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.received_at).toBeDefined();
  });
});

describe('GET /events filters', () => {
  beforeEach(async () => {
    await insertTestEvent({ level: 'info', message: 'user logged in', source: 'auth-service' });
    await insertTestEvent({ level: 'error', message: 'payment failed', source: 'checkout-service' });
    await insertTestEvent({ level: 'error', message: 'db timeout', source: 'checkout-service' });
    await insertTestEvent({ level: 'fatal', message: 'crash', source: 'auth-service' });
  });

  it('filters by a single level', async () => {
    const res = await request(app).get('/events').query({ level: 'error' }).set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((e: { level: string }) => e.level === 'error')).toBe(true);
  });

  it('filters by multiple levels', async () => {
    const res = await request(app).get('/events').query({ level: ['error', 'fatal'] }).set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
  });

  it('filters by source', async () => {
    const res = await request(app).get('/events').query({ source: 'auth-service' }).set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('filters by free-text search on message', async () => {
    const res = await request(app).get('/events').query({ q: 'payment' }).set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].message).toBe('payment failed');
  });

  it('combines level and source filters', async () => {
    const res = await request(app)
      .get('/events')
      .query({ level: 'error', source: 'checkout-service' })
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('returns an empty result when no event matches', async () => {
    const res = await request(app).get('/events').query({ q: 'nothing-matches-this' }).set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.has_more).toBe(false);
  });
});

describe('GET /events cursor pagination', () => {
  beforeEach(async () => {
    // Explicit, strictly increasing received_at values: back-to-back inserts
    // can otherwise land on the same microsecond, and the id-based tie-break
    // (a random UUID) would then make the page distribution non-deterministic.
    const base = Date.now();
    for (let i = 0; i < 5; i++) {
      await insertTestEvent({ message: `event ${i}`, receivedAt: new Date(base + i * 1000).toISOString() });
    }
  });

  it('paginates without skipping or repeating events', async () => {
    const firstPage = await request(app).get('/events').query({ limit: 2 }).set(AUTH);
    expect(firstPage.body.data).toHaveLength(2);
    expect(firstPage.body.has_more).toBe(true);
    expect(firstPage.body.next_cursor).toBeTruthy();

    const secondPage = await request(app)
      .get('/events')
      .query({ limit: 2, cursor: firstPage.body.next_cursor })
      .set(AUTH);
    expect(secondPage.body.data).toHaveLength(2);

    const firstPageIds = firstPage.body.data.map((e: { id: string }) => e.id);
    const secondPageIds = secondPage.body.data.map((e: { id: string }) => e.id);
    expect(new Set([...firstPageIds, ...secondPageIds]).size).toBe(4);

    const thirdPage = await request(app)
      .get('/events')
      .query({ limit: 2, cursor: secondPage.body.next_cursor })
      .set(AUTH);
    expect(thirdPage.body.data).toHaveLength(1);
    expect(thirdPage.body.has_more).toBe(false);
    expect(thirdPage.body.next_cursor).toBeNull();
  });
});

describe('POST /events payload size limit', () => {
  it('rejects a body over 64KB with 413', async () => {
    const res = await request(app)
      .post('/events')
      .set(AUTH)
      .send({
        level: 'info',
        message: 'x',
        source: 'y',
        metadata: { blob: 'a'.repeat(70 * 1024) },
      });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('GET /events/stats', () => {
  beforeEach(async () => {
    const now = new Date();
    const thisHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    await insertTestEvent({ level: 'info', timestamp: thisHour.toISOString() });
    await insertTestEvent({ level: 'info', timestamp: thisHour.toISOString() });
    await insertTestEvent({ level: 'error', timestamp: thisHour.toISOString() });
  });

  it('returns counts grouped by hour and level', async () => {
    const res = await request(app).get('/events/stats').set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.buckets).toHaveLength(1);
    expect(res.body.buckets[0].counts).toEqual({ info: 2, error: 1 });
  });

  it('respects the same filters as GET /events', async () => {
    const res = await request(app).get('/events/stats').query({ level: 'error' }).set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.buckets[0].counts).toEqual({ error: 1 });
  });
});
