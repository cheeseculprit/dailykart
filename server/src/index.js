import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { pool } from './db.js';
import routes from './routes.js';
import chat from './chat.js';
import { ensureTopics, connectProducer, disconnectProducer } from './kafka.js';
import { startConsumers, stopConsumers } from './consumers.js';
import { ensureIndex } from './search.js';
import { expireDueFreezes } from './freezes.js';
import { setKafkaUp } from './status.js';
import { applySchema } from './scripts/schema.js';
import { HttpError } from './auth.js';

const app = express();
app.use(cors());

// Release reservations whose time ran out. A normal server does this on a 15 s timer
// (see start()); on Vercel nothing runs between requests, so requests do it instead,
// at most every 15 s per instance, before reading or changing any stock.
let expiryTimerRunning = false;
let lastExpiryRun = 0;
let schemaReady = false;
app.use('/api', async (req, res, next) => {
  if (!schemaReady) {
    try {
      await applySchema();
      schemaReady = true;
    } catch (e) {
      console.error('[postgres] schema check failed:', e.message);
    }
  }
  if (!expiryTimerRunning && Date.now() - lastExpiryRun >= 15_000) {
    lastExpiryRun = Date.now();
    try {
      const n = await expireDueFreezes();
      if (n) console.log(`[expiry] released ${n} freeze(s) on request`);
    } catch (e) {
      console.error('[expiry]', e.message);
    }
  }
  next();
});
// Photo uploads need a bigger body than normal requests.
app.use('/api/shop/images', express.json({ limit: '1mb' }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', chat);
app.use('/api', routes);

// Serve the built React app in production (npm run build in client/).
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist');
if (!process.env.VERCEL && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  // Our own HttpErrors carry a message written for users (e.g. "The assistant is busy"),
  // so show it; anything unexpected gets a generic message and details stay in the log.
  const friendly = status < 500 || err instanceof HttpError;
  res.status(status).json({ error: friendly ? err.message : 'Something went wrong on our side', stock: err.stock });
});

async function start() {
  await applySchema();
  console.log('[postgres] schema ready');

  await ensureIndex();

  try {
    await ensureTopics();
    await connectProducer();
    await startConsumers();
    setKafkaUp(true);
  } catch (err) {
    console.error('[kafka] could not connect:', err.message);
    console.error('[kafka] the app will run, but events and search sync are off until Kafka is reachable.');
  }

  expiryTimerRunning = true;
  setInterval(() => {
    expireDueFreezes()
      .then((n) => n && console.log(`[expiry] released ${n} freeze(s)`))
      .catch((e) => console.error('[expiry]', e.message));
  }, 15_000);

  app.listen(config.port, () => console.log(`DailyCart API on http://localhost:${config.port}`));
}

async function shutdown() {
  await stopConsumers().catch(() => {});
  await disconnectProducer().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(0);
}
if (!process.env.VERCEL) {
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  start().catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
}

export default app;
