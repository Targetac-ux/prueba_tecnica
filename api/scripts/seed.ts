import 'dotenv/config';
import pg from 'pg';

const LEVELS = ['debug', 'info', 'warning', 'error', 'fatal'] as const;
// Distribución realista: muchos info, pocos error, casi ningún fatal
const LEVEL_WEIGHTS = [10, 55, 20, 12, 3];

const SOURCES = ['checkout-service', 'auth-service', 'payment-gateway', 'inventory-service', 'notification-service'];

const MESSAGES: Record<(typeof LEVELS)[number], string[]> = {
  debug: ['Cache hit for key user_session', 'Retrying connection pool acquisition', 'Query executed in 12ms'],
  info: ['User logged in successfully', 'Order created', 'Payment processed', 'Email sent to customer'],
  warning: ['Response time exceeded 500ms', 'Retry attempt 2 of 3', 'Deprecated API endpoint called'],
  error: ['Connection to payment gateway timed out', 'Failed to process order', 'Database query failed'],
  fatal: ['Service crashed due to out of memory', 'Unrecoverable database connection loss'],
};

function weightedRandom<T>(items: readonly T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return items[i];
  }
  return items[items.length - 1];
}

function randomPastTimestamp(hoursAgo: number): Date {
  const now = Date.now();
  const past = now - hoursAgo * 60 * 60 * 1000;
  const randomTime = past + Math.random() * (now - past);
  return new Date(randomTime);
}

async function seed() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/events',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();

  const COUNT = 500;
  console.log(`▶  Generando ${COUNT} eventos...`);

  for (let i = 0; i < COUNT; i++) {
    const level = weightedRandom(LEVELS, LEVEL_WEIGHTS);
    const source = SOURCES[Math.floor(Math.random() * SOURCES.length)];
    const messages = MESSAGES[level];
    const message = messages[Math.floor(Math.random() * messages.length)];
    const timestamp = randomPastTimestamp(48);
    const metadata = {
      userId: `u_${Math.floor(Math.random() * 10000)}`,
      requestId: `req_${Math.random().toString(36).slice(2, 8)}`,
    };

    await client.query(
      `INSERT INTO events (level, message, source, timestamp, metadata) VALUES ($1, $2, $3, $4, $5)`,
      [level, message, source, timestamp.toISOString(), JSON.stringify(metadata)]
    );
  }

  await client.end();
  console.log(`✓ ${COUNT} eventos insertados`);
}

seed().catch((err) => {
  console.error('✗ Error en seed:', err);
  process.exit(1);
});
