import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requestId } from './middleware/request-id.ts';
import { errorHandler, notFoundHandler } from './middleware/error-handler.ts';
import { auth } from './middleware/auth.ts';
import { rateLimit } from './middleware/rate-limit.ts';
import { healthRouter } from './routes/health.ts';
import { eventsRouter } from './routes/events.ts';
import { logger } from './lib/logger.ts';

export const app = express();

// CloudFront is the only reverse proxy in front of this server, so trust
// exactly one hop: req.ip becomes the real client IP from X-Forwarded-For
// instead of CloudFront's own edge IP. Without this, rate limiting by IP
// would key on CloudFront instead of the actual caller.
app.set('trust proxy', 1);

const corsOrigins = (process.env.CORS_ORIGIN || '*').split(',').map((origin) => origin.trim());

app.use(helmet());
app.use(cors({ origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins }));
app.use(express.json());
app.use(requestId);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('request', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
});

app.use(healthRouter);
app.use(auth);
app.post('/events', rateLimit);
app.use(eventsRouter);

app.use(notFoundHandler);
app.use(errorHandler);
