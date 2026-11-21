import { config } from './config.js';
import { query } from './db.js';
import { syncProduct } from './search.js';

// What happens after an event: keep the search index in sync and send notifications.
// Kafka consumers call this; when Kafka isn't available (e.g. on Vercel, where nothing
// runs in the background), publish() calls it directly so the work still happens.

const TOPICS = config.kafka.topics;

async function logEvent(topic, evt, consumer, result) {
  await query(
    `INSERT INTO event_log (topic, event_type, consumer, payload, result) VALUES ($1, $2, $3, $4, $5)`,
    [topic, evt.type, consumer, evt, result]
  );
}

const notify = (userId, message) =>
  query(`INSERT INTO notifications (user_id, message) VALUES ($1, $2)`, [userId, message]);

const time = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: config.timezone });

/** inventory.changed -> keep the OpenSearch product index in sync with Postgres. */
async function handleInventory(evt) {
  const results = [];
  for (const id of evt.productIds) results.push(`#${id} ${await syncProduct(id)}`);
  return `search index updated: ${results.join(', ')}`;
}

/** freeze events -> confirmations for the customer, alerts for the shopkeeper. */
async function handleFreeze(evt) {
  const items = evt.items?.map((i) => `${i.qty}× ${i.name}`).join(', ');
  switch (evt.type) {
    case 'freeze.created':
      await notify(evt.userId, `Frozen at ${evt.shopName}: ${items}. Pick up and pay by ${time(evt.expiresAt)} with code ${evt.code}.`);
      await notify(evt.shopOwnerId, `New freeze ${evt.code} from ${evt.customerName}: ${items} (₹${evt.total}).`);
      return 'customer confirmation + shop alert sent';
    case 'freeze.collected':
      await notify(evt.userId, `Collected at ${evt.shopName}. Thanks for shopping local!`);
      return 'collection receipt sent';
    case 'freeze.expired':
      await notify(evt.userId, `Your freeze ${evt.code} at ${evt.shopName} expired and the items were released.`);
      await notify(evt.shopOwnerId, `Freeze ${evt.code} expired, stock returned to shelf.`);
      return 'expiry notices sent';
    case 'freeze.cancelled':
      await notify(evt.shopOwnerId, `Freeze ${evt.code} was cancelled by the customer, stock returned.`);
      return 'shop alerted of cancellation';
    default:
      return 'ignored';
  }
}

export const HANDLERS = {
  [TOPICS.inventory]: { name: 'search-indexer', fn: handleInventory },
  [TOPICS.freeze]: { name: 'notifier', fn: handleFreeze },
};

/**
 * Run the handler for one event and record it in event_log. Never throws:
 * a failed side effect (e.g. search briefly down) must not fail the request
 * that caused it; the reindex script can repair the search index.
 */
export async function handleEvent(topic, evt, via = 'kafka') {
  const handler = HANDLERS[topic];
  if (!handler) return;
  const consumer = via === 'kafka' ? handler.name : `${handler.name} (${via})`;
  try {
    const result = await handler.fn(evt);
    await logEvent(topic, evt, consumer, result);
    console.log(`[${consumer}] ${evt.type} -> ${result}`);
  } catch (err) {
    console.error(`[${consumer}] failed:`, err.message);
    await logEvent(topic, evt, consumer, `error: ${err.message}`).catch(() => {});
  }
}
