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
  metadata?: Record<string, unknown>;
} = {}) {
  const result = await query(
    `INSERT INTO events (level, message, source, timestamp, metadata)
     VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()), $5)
     RETURNING id, received_at`,
    [
      overrides.level ?? 'info',
      overrides.message ?? 'test event',
      overrides.source ?? 'test-source',
      overrides.timestamp ?? null,
      JSON.stringify(overrides.metadata ?? {}),
    ]
  );
  return result.rows[0];
}
