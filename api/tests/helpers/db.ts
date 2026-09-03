import { query, end } from '../../src/db/client.ts';

export async function clearEvents() {
  await query('TRUNCATE TABLE events');
}

export async function closeDb() {
  await end();
}

export async function insertTestEvent(overrides: {
  level?: string;
  message?: string;
  source?: string;
  timestamp?: string;
  receivedAt?: string;
  metadata?: Record<string, unknown>;
} = {}) {
  // received_at defaults to now(), but tests that assert an exact page
  // distribution need distinct, caller-controlled values: back-to-back
  // inserts can land on the same microsecond in CI, where the tie-break by
  // id (a random UUID) can shuffle which event lands on which page.
  const result = await query(
    `INSERT INTO events (level, message, source, timestamp, metadata, received_at)
     VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()), $5, COALESCE($6::timestamptz, now()))
     RETURNING id, received_at`,
    [
      overrides.level ?? 'info',
      overrides.message ?? 'test event',
      overrides.source ?? 'test-source',
      overrides.timestamp ?? null,
      JSON.stringify(overrides.metadata ?? {}),
      overrides.receivedAt ?? null,
    ]
  );
  return result.rows[0];
}
