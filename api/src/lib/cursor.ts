interface CursorPayload {
  received_at: string;
  id: string;
}

export function encodeCursor(receivedAt: string, id: string): string {
  const payload: CursorPayload = { received_at: receivedAt, id };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const payload = JSON.parse(decoded);
    if (typeof payload.received_at !== 'string' || typeof payload.id !== 'string') {
      return null;
    }
    return payload as CursorPayload;
  } catch {
    return null;
  }
}
