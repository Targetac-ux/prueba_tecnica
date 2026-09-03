// High default so functional tests across other files (which also hit
// POST /events) never trip the limiter. The rate-limit test itself loads
// a fresh copy of the module with its own low limit via vi.resetModules().
process.env.RATE_LIMIT_MAX = '1000';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.API_KEY = 'test-api-key-for-vitest';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/events';
