import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor } from '../../src/lib/cursor.ts';

describe('cursor encode/decode', () => {
  it('round-trips received_at and id', () => {
    const receivedAt = '2026-09-02T14:23:12.114Z';
    const id = '3f2a1b2c-1234-5678-9abc-def012345678';

    const cursor = encodeCursor(receivedAt, id);
    const decoded = decodeCursor(cursor);

    expect(decoded).toEqual({ received_at: receivedAt, id });
  });

  it('produces an opaque base64 string, not raw JSON', () => {
    const cursor = encodeCursor('2026-09-02T14:23:12.114Z', 'some-id');
    expect(() => JSON.parse(cursor)).toThrow();
    expect(cursor).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('returns null for garbage input', () => {
    expect(decodeCursor('not-valid-base64-json!!!')).toBeNull();
  });

  it('returns null when the decoded payload is missing required fields', () => {
    const badPayload = Buffer.from(JSON.stringify({ received_at: '2026-09-02T14:23:12.114Z' })).toString(
      'base64'
    );
    expect(decodeCursor(badPayload)).toBeNull();
  });

  it('returns null when fields have the wrong type', () => {
    const badPayload = Buffer.from(JSON.stringify({ received_at: 123, id: 'abc' })).toString('base64');
    expect(decodeCursor(badPayload)).toBeNull();
  });

  it('produces distinct cursors for two events with the same received_at but different ids', () => {
    // This is the tie-breaker case: when a client offline batch lands, several
    // events can share the exact same received_at. The cursor must still be
    // unique per event so pagination doesn't skip or repeat rows at that boundary.
    const sameTimestamp = '2026-09-02T14:23:12.114Z';
    const cursorA = encodeCursor(sameTimestamp, 'id-a');
    const cursorB = encodeCursor(sameTimestamp, 'id-b');

    expect(cursorA).not.toBe(cursorB);
    expect(decodeCursor(cursorA)?.id).toBe('id-a');
    expect(decodeCursor(cursorB)?.id).toBe('id-b');
  });
});
