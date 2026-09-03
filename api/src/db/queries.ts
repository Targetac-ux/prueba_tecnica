import { query } from './client.ts';
import { decodeCursor } from '../lib/cursor.ts';
import type { CreateEventInput, PaginationParams, Event } from '@event-logger/shared';

export async function insertEvent(input: CreateEventInput): Promise<{ id: string; received_at: string }> {
  const result = await query(
    `INSERT INTO events (level, message, source, timestamp, metadata)
     VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()), $5)
     RETURNING id, received_at`,
    [input.level, input.message, input.source, input.timestamp ?? null, JSON.stringify(input.metadata ?? {})]
  );
  return {
    id: result.rows[0].id,
    received_at: result.rows[0].received_at.toISOString(),
  };
}

export async function findEvents(params: PaginationParams): Promise<{ data: Event[]; hasMore: boolean }> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (params.level && params.level.length > 0) {
    conditions.push(`level = ANY($${paramIndex}::event_level[])`);
    values.push(params.level);
    paramIndex++;
  }

  if (params.source) {
    conditions.push(`source = $${paramIndex}`);
    values.push(params.source);
    paramIndex++;
  }

  if (params.from) {
    conditions.push(`timestamp >= $${paramIndex}`);
    values.push(params.from);
    paramIndex++;
  }

  if (params.to) {
    conditions.push(`timestamp <= $${paramIndex}`);
    values.push(params.to);
    paramIndex++;
  }

  if (params.q) {
    conditions.push(`message ILIKE $${paramIndex}`);
    values.push(`%${params.q}%`);
    paramIndex++;
  }

  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);
    if (decoded) {
      conditions.push(
        `(received_at, id) < ($${paramIndex}::timestamptz, $${paramIndex + 1}::uuid)`
      );
      values.push(decoded.received_at, decoded.id);
      paramIndex += 2;
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = params.limit + 1;

  const result = await query(
    `SELECT id, level, message, source, timestamp, received_at, metadata
     FROM events
     ${whereClause}
     ORDER BY received_at DESC, id DESC
     LIMIT $${paramIndex}`,
    [...values, limit]
  );

  const hasMore = result.rows.length > params.limit;
  const rows = hasMore ? result.rows.slice(0, params.limit) : result.rows;

  const data: Event[] = rows.map((row) => ({
    id: row.id,
    level: row.level,
    message: row.message,
    source: row.source,
    timestamp: row.timestamp.toISOString(),
    received_at: row.received_at.toISOString(),
    metadata: row.metadata,
  }));

  return { data, hasMore };
}

export async function getStats(params: Omit<PaginationParams, 'cursor' | 'limit'>): Promise<
  Array<{ hour: string; counts: Record<string, number> }>
> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (params.level && params.level.length > 0) {
    conditions.push(`level = ANY($${paramIndex}::event_level[])`);
    values.push(params.level);
    paramIndex++;
  }

  if (params.source) {
    conditions.push(`source = $${paramIndex}`);
    values.push(params.source);
    paramIndex++;
  }

  if (params.from) {
    conditions.push(`timestamp >= $${paramIndex}`);
    values.push(params.from);
    paramIndex++;
  }

  if (params.to) {
    conditions.push(`timestamp <= $${paramIndex}`);
    values.push(params.to);
    paramIndex++;
  }

  if (params.q) {
    conditions.push(`message ILIKE $${paramIndex}`);
    values.push(`%${params.q}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT date_trunc('hour', timestamp) AS hour, level, COUNT(*) AS count
     FROM events
     ${whereClause}
     GROUP BY hour, level
     ORDER BY hour ASC`,
    values
  );

  const bucketsMap = new Map<string, Record<string, number>>();
  for (const row of result.rows) {
    const hourIso = row.hour.toISOString();
    if (!bucketsMap.has(hourIso)) bucketsMap.set(hourIso, {});
    bucketsMap.get(hourIso)![row.level] = parseInt(row.count, 10);
  }

  return Array.from(bucketsMap.entries()).map(([hour, counts]) => ({ hour, counts }));
}
