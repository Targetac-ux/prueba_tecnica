import { Router } from 'express';
import { CreateEventSchema, PaginationSchema } from '@event-logger/shared';
import { insertEvent, findEvents, getStats } from '../db/queries.ts';
import { encodeCursor } from '../lib/cursor.ts';
import { ApiError } from '../middleware/error-handler.ts';

export const eventsRouter = Router();

const MAX_BODY_BYTES = 64 * 1024;

eventsRouter.post('/events', async (req, res, next) => {
  try {
    const bodySize = Buffer.byteLength(JSON.stringify(req.body ?? {}));
    if (bodySize > MAX_BODY_BYTES) {
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'El body excede el límite de 64 KB');
    }

    const input = CreateEventSchema.parse(req.body);
    const result = await insertEvent(input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

eventsRouter.get('/events', async (req, res, next) => {
  try {
    const rawLevel = req.query.level;
    const levelArray = Array.isArray(rawLevel) ? rawLevel : rawLevel ? [rawLevel] : undefined;

    const params = PaginationSchema.parse({
      ...req.query,
      level: levelArray,
    });

    const { data, hasMore } = await findEvents(params);
    const lastEvent = data[data.length - 1];
    const nextCursor = hasMore && lastEvent ? encodeCursor(lastEvent.received_at, lastEvent.id) : null;

    res.status(200).json({
      data,
      next_cursor: nextCursor,
      has_more: hasMore,
    });
  } catch (err) {
    next(err);
  }
});

eventsRouter.get('/events/stats', async (req, res, next) => {
  try {
    const rawLevel = req.query.level;
    const levelArray = Array.isArray(rawLevel) ? rawLevel : rawLevel ? [rawLevel] : undefined;

    const params = PaginationSchema.omit({ cursor: true, limit: true }).parse({
      ...req.query,
      level: levelArray,
    });

    const buckets = await getStats(params);
    res.status(200).json({ buckets });
  } catch (err) {
    next(err);
  }
});
