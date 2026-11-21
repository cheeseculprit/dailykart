import pg from 'pg';
import { config } from './config.js';

// NUMERIC -> JS number (prices are small, no precision risk here)
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
// DATE -> keep as 'YYYY-MM-DD' string instead of a timezone-shifted Date
pg.types.setTypeParser(1082, (v) => v);

function sslOptions() {
  const url = config.pg.connectionString;
  if (config.pg.ca) return { ca: config.pg.ca, rejectUnauthorized: true };
  if (/sslmode=require/.test(url)) return { rejectUnauthorized: false };
  return undefined;
}

// Strip sslmode from the URL so our ssl object is the one that applies.
const connectionString = config.pg.connectionString.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');

export const pool = new pg.Pool({
  connectionString,
  ssl: sslOptions(),
  max: process.env.VERCEL ? 1 : 10,
  // Close unused connections ourselves before the network or Aiven cuts them.
  idleTimeoutMillis: process.env.VERCEL ? 5_000 : 30_000,
  // Small "still here" packets so live connections aren't treated as dead.
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  // Fail a request after 10 s instead of hanging if the database is unreachable.
  connectionTimeoutMillis: 10_000,
});

// A dropped idle connection emits 'error' on the pool. Without this listener
// Node treats it as fatal and the whole server crashes. The pool discards the
// dead connection by itself and opens a fresh one on the next request.
pool.on('error', (err) => {
  console.error('[postgres] idle connection dropped, will reconnect:', err.message);
});

export const query = (text, params) => pool.query(text, params);

/** Network-level failures (ECONNRESET, ETIMEDOUT, "Connection terminated"), not SQL or app errors. */
const isConnectionError = (err) =>
  /^E[A-Z]+$/.test(err?.code || '') || /connection (terminated|ended|closed)/i.test(err?.message || '');

/** Run fn inside a transaction; rolls back on any thrown error. */
export async function tx(fn) {
  const client = await pool.connect();
  // The connection can also drop while checked out; don't let that crash the server.
  const onError = (err) => console.error('[postgres] connection dropped during a transaction:', err.message);
  client.on('error', onError);
  let broken = null;
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (isConnectionError(err)) broken = err;
    throw err;
  } finally {
    client.removeListener('error', onError);
    // A broken connection is destroyed instead of going back into the pool.
    client.release(broken || undefined);
  }
}
