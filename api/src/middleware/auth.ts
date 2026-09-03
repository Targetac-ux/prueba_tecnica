import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function auth(req: Request, res: Response, next: NextFunction) {
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    next();
    return;
  }

  const header = req.headers.authorization;
  const provided = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!provided || !safeCompare(provided, apiKey)) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Falta o es inválida la cabecera Authorization',
        request_id: req.requestId,
      },
    });
    return;
  }

  next();
}
