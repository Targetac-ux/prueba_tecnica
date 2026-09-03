import type { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'node:crypto';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  req.requestId = `req_${randomBytes(6).toString('hex')}`;
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
