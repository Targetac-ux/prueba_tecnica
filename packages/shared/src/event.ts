import { z } from 'zod';

export const EventLevelEnum = z.enum(['debug', 'info', 'warning', 'error', 'fatal']);
export type EventLevel = z.infer<typeof EventLevelEnum>;

const MAX_METADATA_DEPTH = 10;

function exceedsMaxDepth(value: unknown, depth = 0): boolean {
  if (depth > MAX_METADATA_DEPTH) return true;
  if (value === null || typeof value !== 'object') return false;
  const children = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  return children.some((child) => exceedsMaxDepth(child, depth + 1));
}

export const CreateEventSchema = z.object({
  level: EventLevelEnum,
  message: z.string().min(1).max(10000),
  source: z.string().min(1).max(255),
  timestamp: z.string().datetime().optional(),
  metadata: z
    .record(z.unknown())
    .optional()
    .default({})
    .refine((value) => !exceedsMaxDepth(value), {
      message: `metadata no puede tener más de ${MAX_METADATA_DEPTH} niveles de anidación`,
    }),
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export const EventSchema = CreateEventSchema.extend({
  id: z.string().uuid(),
  received_at: z.string().datetime(),
});

export type Event = z.infer<typeof EventSchema>;

export const PaginationSchema = z.object({
  level: EventLevelEnum.array().optional(),
  source: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  q: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type PaginationParams = z.infer<typeof PaginationSchema>;

export const PaginatedResponseSchema = z.object({
  data: EventSchema.array(),
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
});

export type PaginatedResponse = z.infer<typeof PaginatedResponseSchema>;

export const StatsSchema = z.object({
  buckets: z.array(
    z.object({
      hour: z.string().datetime(),
      counts: z.record(EventLevelEnum, z.number()),
    })
  ),
});

export type Stats = z.infer<typeof StatsSchema>;

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.enum(['VALIDATION_ERROR', 'UNAUTHORIZED', 'RATE_LIMITED', 'PAYLOAD_TOO_LARGE', 'INTERNAL_ERROR', 'NOT_FOUND']),
    message: z.string(),
    details: z.array(z.object({
      field: z.string().optional(),
      issue: z.string(),
    })).optional(),
    request_id: z.string(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
