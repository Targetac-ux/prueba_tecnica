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

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
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

app.listen(PORT, () => {
  logger.info(`API listening on port ${PORT}`);
});
