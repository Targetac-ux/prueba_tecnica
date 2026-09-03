import { Router } from 'express';
import { healthCheck } from '../db/client.ts';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const dbOk = await healthCheck();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    db: dbOk ? 'ok' : 'error',
  });
});
