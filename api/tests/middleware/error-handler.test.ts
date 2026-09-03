import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/db/client.ts', async () => {
  const actual = await vi.importActual<typeof import('../../src/db/client.ts')>('../../src/db/client.ts');
  return {
    ...actual,
    query: vi.fn().mockRejectedValue(new Error('relation "events" does not exist at line 42, column 7')),
  };
});

import request from 'supertest';
import { app } from '../../src/app.ts';

describe('error handler', () => {
  it('does not leak database error details when a query fails', async () => {
    const res = await request(app).get('/events').set('Authorization', `Bearer ${process.env.API_KEY}`);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).not.toMatch(/relation|column|does not exist/i);
    expect(res.body.error.request_id).toBeDefined();
    expect(JSON.stringify(res.body)).not.toContain('does not exist');
  });
});
