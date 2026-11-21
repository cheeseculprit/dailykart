import express, { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from './db.js';
import { config } from './config.js';
import { signToken, requireAuth, HttpError, wrap } from './auth.js';
import { publish, TOPICS } from './kafka.js';
import { searchProducts, os } from './search.js';
import { kafkaStatus } from './status.js';
import { reserveWindow, readHours } from './hours.js';
import { transcribe, parseStock, voiceTooMany, MAX_BYTES } from './voice.js';
import { verifyGoogleToken } from './google.js';
import {
  createFreeze, cancelFreeze, collectFreeze, freezesForUser, freezesForShop,
} from './freezes.js';

export const CATEGORIES = ['Dairy', 'Bakery', 'Snacks', 'Fruits & Veg', 'Beverages', 'Ready to eat', 'Other'];

const r = Router();

// ---------- helpers ----------

const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

function readPoint(q, required = true) {
  const lat = num(q.lat);
  const lng = num(q.lng);
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    if (required) throw new HttpError(400, 'Share your location to see nearby shops');
    return null;
  }
  return { lat, lng };
}

const readRadius = (v) => Math.min(config.radius.max, Math.max(config.radius.min, num(v) || config.radius.default));

const DISTANCE_SQL = (latP, lngP) => `
  6371000 * 2 * asin(sqrt(
    power(sin(radians(s.lat - ${latP}) / 2), 2) +
    cos(radians(${latP})) * cos(radians(s.lat)) * power(sin(radians(s.lng - ${lngP}) / 2), 2)
  ))`;

function cleanProduct(body, partial = false) {
  const out = {};
  const str = (k, max = 80) => {
    if (body[k] === undefined) return;
    const v = String(body[k] ?? '').trim();
    if (v.length > max) throw new HttpError(400, `${k} is too long`);
    out[k] = v;
  };
  str('name'); str('brand'); str('unit', 30);
  if (body.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) throw new HttpError(400, 'Pick a category from the list');
    out.category = body.category;
  }
  if (body.price !== undefined) {
    const p = Number(body.price);
    if (!(p >= 0) || p > 100000) throw new HttpError(400, 'Enter a valid price');
    out.price = p;
  }
  if (body.stock !== undefined) {
    const s = Number(body.stock);
    if (!Number.isInteger(s) || s < 0 || s > 10000) throw new HttpError(400, 'Stock must be a whole number');
    out.stock = s;
  }
  if (body.expires_on !== undefined) {
    out.expires_on = body.expires_on ? String(body.expires_on).slice(0, 10) : null;
  }
  if (body.active !== undefined) out.active = Boolean(body.active);
  if (body.image_id !== undefined) {
    const id = body.image_id === null || body.image_id === '' ? null : Number(body.image_id);
    if (id !== null && !Number.isInteger(id)) throw new HttpError(400, 'Invalid photo');
    out.image_id = id;
  }
  if (!partial) {
    for (const k of ['name', 'category', 'price', 'stock']) {
      if (out[k] === undefined || out[k] === '') throw new HttpError(400, `${k} is required`);
    }
  }
  return out;
}

/** A photo can only be attached to a product of the shop that uploaded it. */
async function checkImage(imageId, shopId) {
  if (imageId == null) return;
  const { rowCount } = await query(`SELECT 1 FROM product_images WHERE id = $1 AND shop_id = $2`, [imageId, shopId]);
  if (!rowCount) throw new HttpError(400, 'That photo does not belong to your shop');
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function myShop(userId) {
  const { rows: [shop] } = await query(`SELECT * FROM shops WHERE owner_id = $1`, [userId]);
  if (!shop) throw new HttpError(404, 'No shop is linked to this account');
  return shop;
}

// ---------- meta ----------

r.get('/config', (req, res) => {
  res.json({
    freezeMinutes: config.freeze.minutes, maxActive: config.freeze.maxActivePerUser, radius: config.radius, categories: CATEGORIES,
    googleClientId: config.googleClientId || null,
  });
});

r.get('/health', wrap(async (req, res) => {
  const out = { postgres: false, opensearch: false, kafka: kafkaStatus() };
  try { await query('SELECT 1'); out.postgres = true; } catch {}
  try { await os.ping(); out.opensearch = true; } catch {}
  res.json(out);
}));

/**
 * The shop's live activity: the last events Kafka consumers handled for this
 * shopkeeper's own shop only (reservations, pickups, stock changes).
 * Stock events also carry the product names, for a readable feed.
 */
r.get('/events', requireAuth('shopkeeper'), wrap(async (req, res) => {
  const shop = await myShop(req.user.id);
  const { rows } = await query(
    `SELECT e.id, e.topic, e.event_type, e.consumer, e.result, e.payload, e.processed_at,
            (SELECT array_agg(p.name ORDER BY p.name) FROM products p
              WHERE p.id::text IN (SELECT jsonb_array_elements_text(e.payload->'productIds'))) AS product_names
     FROM event_log e
     WHERE e.payload->>'shopId' = ($1::int)::text
        OR EXISTS (SELECT 1 FROM products p
                   WHERE p.shop_id = $1::int
                     AND p.id::text IN (SELECT jsonb_array_elements_text(e.payload->'productIds')))
     ORDER BY e.id DESC LIMIT 40`,
    [shop.id]
  );
  res.json(rows);
}));

/** Public product photo. Images never change once uploaded, so cache them hard. */
r.get('/images/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(404, 'Not found');
  const { rows: [img] } = await query(`SELECT mime, data FROM product_images WHERE id = $1`, [id]);
  if (!img) throw new HttpError(404, 'Not found');
  res.set({
    'Content-Type': img.mime,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(img.data);
}));

// ---------- auth ----------

r.post('/auth/register', wrap(async (req, res) => {
  const { name, email, password, phone, role = 'customer', shop } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password) throw new HttpError(400, 'Name, email and password are required');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  if (!['customer', 'shopkeeper'].includes(role)) throw new HttpError(400, 'Invalid role');
  if (role === 'shopkeeper') {
    if (!shop?.name?.trim() || !shop?.address?.trim() || !shop?.city?.trim()) throw new HttpError(400, 'Shop name, address and city are required');
    if (num(shop.lat) == null || num(shop.lng) == null) throw new HttpError(400, 'Set your shop location');
    Object.assign(shop, readHours(shop)); // defaults to 07:00-22:00 when not sent
  }

  const hash = await bcrypt.hash(password, 10);
  let user;
  try {
    ({ rows: [user] } = await query(
      `INSERT INTO users (name, email, phone, password_hash, role) VALUES ($1, lower($2), $3, $4, $5)
       RETURNING id, name, email, role`,
      [name.trim(), email.trim(), phone || null, hash, role]
    ));
  } catch (e) {
    if (e.code === '23505') throw new HttpError(409, 'An account with this email already exists');
    throw e;
  }
  if (role === 'shopkeeper') {
    await query(
      `INSERT INTO shops (owner_id, name, address, city, lat, lng, opens_at, closes_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [user.id, shop.name.trim(), shop.address.trim(), shop.city.trim(), num(shop.lat), num(shop.lng), shop.opens_at, shop.closes_at]
    );
  }
  res.status(201).json({ token: signToken(user), user });
}));

r.post('/auth/login', wrap(async (req, res) => {
  const { email, password, role } = req.body || {};
  const { rows: [user] } = await query(`SELECT * FROM users WHERE email = lower($1)`, [email || '']);
  if (user && !user.password_hash) throw new HttpError(401, 'This account signs in with Google. Use "Continue with Google".');
  if (!user || !(await bcrypt.compare(password || '', user.password_hash))) throw new HttpError(401, 'Wrong email or password');
  checkRole(user, role);
  const safe = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ token: signToken(safe), user: safe });
}));

function checkRole(user, role) {
  if (role && user.role !== role) {
    throw new HttpError(403, user.role === 'shopkeeper' ? 'This is a shopkeeper account. Use the shop login.' : 'This is a customer account. Use the customer login.');
  }
}

/**
 * "Continue with Google". The browser sends Google's signed ID token; we verify it,
 * then sign in the matching account. An existing email/password account with the same
 * (Google-verified) email is linked on first use. New customers are created here; new
 * shops still register through the shop form, since they need the shop's details.
 */
r.post('/auth/google', wrap(async (req, res) => {
  const { credential, role = 'customer' } = req.body || {};
  if (!['customer', 'shopkeeper'].includes(role)) throw new HttpError(400, 'Invalid role');
  const g = await verifyGoogleToken(credential);

  let { rows: [user] } = await query(
    `SELECT id, name, email, role, google_sub FROM users WHERE google_sub = $1 OR email = lower($2)
     ORDER BY (google_sub = $1) DESC NULLS LAST LIMIT 1`,
    [g.sub, g.email]
  );
  if (user?.google_sub && user.google_sub !== g.sub) {
    throw new HttpError(409, 'This email is linked to a different Google account.');
  }
  if (user && !user.google_sub) {
    await query(`UPDATE users SET google_sub = $1 WHERE id = $2`, [g.sub, user.id]);
  }
  if (!user) {
    if (role === 'shopkeeper') {
      throw new HttpError(404, 'No shop is registered with this Google email yet. Register your shop first.');
    }
    try {
      ({ rows: [user] } = await query(
        `INSERT INTO users (name, email, google_sub, role) VALUES ($1, lower($2), $3, 'customer') RETURNING id, name, email, role`,
        [g.name, g.email, g.sub]
      ));
    } catch (e) {
      if (e.code === '23505') throw new HttpError(409, 'Account was just created. Please try again.');
      throw e;
    }
  }
  checkRole(user, role);
  const safe = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ token: signToken(safe), user: safe });
}));

// ---------- customer: browse ----------

r.get('/shops/nearby', wrap(async (req, res) => {
  const { lat, lng } = readPoint(req.query);
  const radius = readRadius(req.query.radius);
  const { rows } = await query(
    `SELECT * FROM (
       SELECT s.id, s.name, s.address, s.city, s.lat, s.lng, s.opens_at, s.closes_at,
              ${DISTANCE_SQL('$1', '$2')} AS distance_m,
              (SELECT count(*)::int FROM products p WHERE p.shop_id = s.id AND p.active AND p.stock > 0) AS in_stock,
              (SELECT array_agg(DISTINCT p.category) FROM products p WHERE p.shop_id = s.id AND p.active) AS categories
       FROM shops s) x
     WHERE distance_m <= $3 ORDER BY distance_m`,
    [lat, lng, radius]
  );
  res.json(rows.map((s) => ({ ...s, distance_m: Math.round(s.distance_m), reserve: reserveWindow(s, s.distance_m) })));
}));

r.get('/shops/:id', wrap(async (req, res) => {
  const { lat, lng } = readPoint(req.query);
  const { rows: [shop] } = await query(
    `SELECT s.id, s.name, s.address, s.city, s.lat, s.lng, s.opens_at, s.closes_at, ${DISTANCE_SQL('$2', '$3')} AS distance_m
     FROM shops s WHERE s.id = $1`,
    [req.params.id, lat, lng]
  );
  if (!shop) throw new HttpError(404, 'Shop not found');
  if (shop.distance_m > config.radius.max) throw new HttpError(403, `This shop is ${(shop.distance_m / 1000).toFixed(1)} km away, outside your ${config.radius.max} m walking range`);
  const { rows: products } = await query(
    `SELECT id, name, brand, category, unit, price, stock, expires_on, image_id FROM products
     WHERE shop_id = $1 AND active ORDER BY category, (stock = 0), name`,
    [shop.id]
  );
  res.json({ ...shop, distance_m: Math.round(shop.distance_m), reserve: reserveWindow(shop, shop.distance_m), products });
}));

r.get('/search', wrap(async (req, res) => {
  const point = readPoint(req.query);
  const result = await searchProducts({
    q: (req.query.q || '').toString().trim().slice(0, 100),
    category: req.query.category || null,
    minPrice: num(req.query.minPrice),
    maxPrice: num(req.query.maxPrice),
    lat: point.lat,
    lng: point.lng,
    radius: readRadius(req.query.radius),
    sort: req.query.sort,
  });
  res.json({ source: 'opensearch', ...result });
}));

// ---------- customer: freezes (orders) ----------

r.post('/freezes', requireAuth('customer'), wrap(async (req, res) => {
  // The customer's position decides who can still reserve near closing time.
  const from = readPoint(req.body || {}, false);
  const freeze = await createFreeze(req.user, Number(req.body?.shopId), req.body?.items, from);
  res.status(201).json(freeze);
}));

r.get('/freezes', requireAuth('customer'), wrap(async (req, res) => {
  res.json(await freezesForUser(req.user.id));
}));

/**
 * "Repeat order": products this customer reserved before (cancelled orders
 * don't count), with today's price and stock, still listed, not past their
 * expiry date, and inside the walking radius. Most often / most recent first.
 */
r.get('/reorder', requireAuth('customer'), wrap(async (req, res) => {
  const { lat, lng } = readPoint(req.query);
  const radius = readRadius(req.query.radius);
  const { rows } = await query(
    `SELECT * FROM (
       SELECT p.id, p.name, p.brand, p.category, p.unit, p.price, p.stock, p.expires_on, p.image_id,
              s.id AS shop_id, s.name AS shop_name,
              ${DISTANCE_SQL('$2', '$3')} AS distance_m,
              h.times, h.last_at
       FROM (
         SELECT fi.product_id, count(*)::int AS times, max(f.created_at) AS last_at
         FROM freeze_items fi JOIN freezes f ON f.id = fi.freeze_id
         WHERE f.user_id = $1 AND f.status <> 'cancelled'
         GROUP BY fi.product_id
       ) h
       JOIN products p ON p.id = h.product_id
       JOIN shops s ON s.id = p.shop_id
       WHERE p.active AND (p.expires_on IS NULL OR p.expires_on >= current_date)
     ) x
     WHERE distance_m <= $4
     ORDER BY (stock > 0) DESC, times DESC, last_at DESC
     LIMIT 12`,
    [req.user.id, lat, lng, radius]
  );
  const { rows: [{ orders }] } = await query(
    `SELECT count(*)::int AS orders FROM freezes WHERE user_id = $1 AND status <> 'cancelled'`,
    [req.user.id]
  );
  res.json({ orders, items: rows.map((p) => ({ ...p, distance_m: Math.round(p.distance_m) })) });
}));

r.delete('/freezes/:id', requireAuth('customer'), wrap(async (req, res) => {
  await cancelFreeze(req.user.id, Number(req.params.id));
  res.json({ ok: true });
}));

r.get('/notifications', requireAuth(), wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT id, message, created_at FROM notifications WHERE user_id = $1 ORDER BY id DESC LIMIT 20`,
    [req.user.id]
  );
  res.json(rows);
}));

// ---------- shopkeeper ----------

const shopOnly = requireAuth('shopkeeper');

r.get('/shop/me', shopOnly, wrap(async (req, res) => {
  const shop = await myShop(req.user.id);
  const { rows: products } = await query(
    `SELECT p.*, COALESCE((SELECT sum(i.qty) FROM freeze_items i JOIN freezes f ON f.id = i.freeze_id
                           WHERE i.product_id = p.id AND f.status = 'active'), 0)::int AS frozen
     FROM products p WHERE p.shop_id = $1 ORDER BY p.active DESC, p.category, p.name`,
    [shop.id]
  );
  const { rows: [stats] } = await query(
    `SELECT count(*) FILTER (WHERE status = 'active')::int AS active,
            count(*) FILTER (WHERE status = 'collected' AND closed_at::date = current_date)::int AS collected_today,
            COALESCE(sum(total) FILTER (WHERE status = 'collected' AND closed_at::date = current_date), 0) AS sales_today
     FROM freezes WHERE shop_id = $1`,
    [shop.id]
  );
  res.json({ shop: { ...shop, reserve: reserveWindow(shop, 0) }, products, stats });
}));

/** Shopkeeper sets opening and closing times (shop's local time, 24-hour 'HH:MM'). */
r.patch('/shop/hours', shopOnly, wrap(async (req, res) => {
  const shop = await myShop(req.user.id);
  const { opens_at, closes_at } = readHours(req.body, true);
  const { rows: [updated] } = await query(
    `UPDATE shops SET opens_at = $2, closes_at = $3 WHERE id = $1 RETURNING *`,
    [shop.id, opens_at, closes_at]
  );
  res.json({ shop: updated, reserve: reserveWindow(updated, 0) });
}));

/** Record a shopkeeper's stock change for the activity feed. Never fails the change itself. */
async function logStock(shopId, product, action, delta = null) {
  try {
    await query(
      `INSERT INTO stock_log (shop_id, product_id, name, action, delta, stock) VALUES ($1, $2, $3, $4, $5, $6)`,
      [shopId, product.id, product.name, action, delta, product.stock ?? null]
    );
  } catch (e) {
    console.error('[activity] stock log failed:', e.message);
  }
}

/**
 * The shop's live activity, read straight from the database (no Kafka), so it
 * works the same on a full server and on serverless hosting like Vercel.
 * Orders come from the reservations themselves; stock changes from stock_log.
 * A reservation past its time counts as "not picked up" even where the expiry
 * worker isn't running.
 */
r.get('/shop/activity', shopOnly, wrap(async (req, res) => {
  const shop = await myShop(req.user.id);
  const { rows: orders } = await query(
    `WITH f AS (
       SELECT f.id, f.code, f.status, f.total, f.created_at, f.closed_at, f.expires_at, u.name AS customer,
              json_agg(json_build_object('name', i.name, 'qty', i.qty) ORDER BY i.name) AS items
       FROM freezes f JOIN users u ON u.id = f.user_id JOIN freeze_items i ON i.freeze_id = f.id
       WHERE f.shop_id = $1 AND GREATEST(f.created_at, COALESCE(f.closed_at, f.expires_at)) > now() - interval '7 days'
       GROUP BY f.id, u.name
     )
     SELECT * FROM (
       SELECT 'r' || id AS key, 'reserved' AS type, created_at AS at, code, customer, total, items FROM f
       UNION ALL
       SELECT 'c' || id, CASE WHEN status = 'active' THEN 'expired' ELSE status END,
              COALESCE(closed_at, expires_at), code, customer, total, items
       FROM f WHERE status <> 'active' OR expires_at <= now()
     ) x
     ORDER BY at DESC LIMIT 40`,
    [shop.id]
  );
  let stock = [];
  try {
    ({ rows: stock } = await query(
      `SELECT 's' || id AS key, action AS type, created_at AS at, name, delta, stock FROM stock_log
       WHERE shop_id = $1 AND created_at > now() - interval '7 days' ORDER BY created_at DESC LIMIT 40`,
      [shop.id]
    ));
  } catch (e) {
    console.error('[activity] stock log read failed:', e.message);
  }
  const feed = [
    ...orders.map((o) => ({ ...o, kind: 'order' })),
    ...stock.map((s) => ({ ...s, kind: 'stock' })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 40);
  res.json(feed);
}));

r.post('/shop/products', shopOnly, wrap(async (req, res) => {
  const shop = await myShop(req.user.id);
  const p = cleanProduct(req.body || {});
  await checkImage(p.image_id, shop.id);
  const { rows: [created] } = await query(
    `INSERT INTO products (shop_id, name, brand, category, unit, price, stock, expires_on, image_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [shop.id, p.name, p.brand || null, p.category, p.unit || '1 pc', p.price, p.stock, p.expires_on || null, p.image_id ?? null]
  );
  await publish(TOPICS.inventory, 'inventory.changed', { reason: 'product.added', productIds: [created.id] }, shop.id);
  await logStock(shop.id, created, 'added');
  res.status(201).json(created);
}));

r.patch('/shop/products/:id', shopOnly, wrap(async (req, res) => {
  const shop = await myShop(req.user.id);
  const p = cleanProduct(req.body || {}, true);
  await checkImage(p.image_id, shop.id);
  const keys = Object.keys(p);
  if (!keys.length) throw new HttpError(400, 'Nothing to update');
  const sets = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
  const { rows: [before] } = await query(`SELECT stock FROM products WHERE id = $1 AND shop_id = $2`, [req.params.id, shop.id]);
  const { rows: [updated] } = await query(
    `UPDATE products SET ${sets}, updated_at = now() WHERE id = $1 AND shop_id = $2 RETURNING *`,
    [req.params.id, shop.id, ...keys.map((k) => p[k])]
  );
  if (!updated) throw new HttpError(404, 'Product not found');
  await publish(TOPICS.inventory, 'inventory.changed', { reason: 'product.updated', productIds: [updated.id] }, shop.id);
  await logStock(shop.id, updated, 'edited', before ? updated.stock - before.stock : null);
  res.json(updated);
}));

/** Counter sales: relative change so it can't overwrite units a customer froze meanwhile. */
r.post('/shop/products/:id/adjust', shopOnly, wrap(async (req, res) => {
  const shop = await myShop(req.user.id);
  const delta = Number(req.body?.delta);
  if (!Number.isInteger(delta) || Math.abs(delta) > 1000) throw new HttpError(400, 'Invalid change');
  const { rows: [p] } = await query(
    `UPDATE products SET stock = GREATEST(0, stock + $3), updated_at = now()
     WHERE id = $1 AND shop_id = $2 RETURNING id, name, stock`,
    [req.params.id, shop.id, delta]
  );
  if (!p) throw new HttpError(404, 'Product not found');
  await publish(TOPICS.inventory, 'inventory.changed', { reason: 'counter.adjust', productIds: [p.id] }, shop.id);
  await logStock(shop.id, p, 'adjusted', delta);
  res.json(p);
}));

r.delete('/shop/products/:id', shopOnly, wrap(async (req, res) => {
  const shop = await myShop(req.user.id);
  const id = Number(req.params.id);
  // Products in active freezes are hidden instead of deleted, so pickups still work.
  const { rows: [busy] } = await query(
    `SELECT 1 FROM freeze_items i JOIN freezes f ON f.id = i.freeze_id WHERE i.product_id = $1 AND f.status = 'active' LIMIT 1`,
    [id]
  );
  const { rows: [gone] } = busy
    ? await query(`UPDATE products SET active = false, updated_at = now() WHERE id = $1 AND shop_id = $2 RETURNING id, name`, [id, shop.id])
    : await query(`DELETE FROM products WHERE id = $1 AND shop_id = $2 RETURNING id, name`, [id, shop.id]);
  if (!gone) throw new HttpError(404, 'Product not found');
  await logStock(shop.id, gone, 'removed');
  await publish(TOPICS.inventory, 'inventory.changed', { reason: 'product.removed', productIds: [id] }, shop.id);
  res.json({ ok: true, hidden: Boolean(busy) });
}));

/** Upload a product photo: { data: "data:image/webp;base64,..." } (already shrunk in the browser). */
r.post('/shop/images', shopOnly, wrap(async (req, res) => {
  const shop = await myShop(req.user.id);
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.data || '');
  if (!m || !IMAGE_TYPES.includes(m[1])) throw new HttpError(400, 'Upload a JPG, PNG or WebP photo');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 700 * 1024) throw new HttpError(413, 'Photo is too large, please use a smaller one');
  // Check the file really is the image type it claims to be (magic bytes).
  const ok =
    (m[1] === 'image/jpeg' && buf[0] === 0xff && buf[1] === 0xd8) ||
    (m[1] === 'image/png' && buf.subarray(0, 4).toString('hex') === '89504e47') ||
    (m[1] === 'image/webp' && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP');
  if (!ok) throw new HttpError(400, "That file isn't a valid image");
  const { rows: [img] } = await query(
    `INSERT INTO product_images (shop_id, mime, data) VALUES ($1, $2, $3) RETURNING id`,
    [shop.id, m[1], buf]
  );
  res.status(201).json({ id: img.id });
}));

/**
 * Voice stock update: the shopkeeper speaks ("paneer bees packet, 2 dahi bik gaye"),
 * we return the proposed changes. Nothing is saved here: the dashboard shows a
 * confirm card and applies the ticked changes through /adjust, like the −/+ buttons.
 */
r.post(
  '/shop/voice',
  shopOnly,
  express.raw({ type: 'audio/*', limit: MAX_BYTES }),
  wrap(async (req, res) => {
    if (voiceTooMany(req.user.id)) throw new HttpError(429, 'Too many voice updates. Please wait a minute.');
    const shop = await myShop(req.user.id);
    const { rows: products } = await query(
      `SELECT p.id, p.name, p.unit, p.stock,
              COALESCE((SELECT sum(i.qty) FROM freeze_items i JOIN freezes f ON f.id = i.freeze_id
                        WHERE i.product_id = p.id AND f.status = 'active'), 0)::int AS frozen
       FROM products p WHERE p.shop_id = $1 AND p.active ORDER BY p.name`,
      [shop.id]
    );
    if (!products.length) throw new HttpError(400, 'Add some items first, then update them by voice');
    const text = await transcribe(req.body, req.headers['content-type'], products.map((p) => p.name));
    const { changes, unknown } = await parseStock(text, products);
    res.json({ text, changes, unknown });
  })
);

r.get('/shop/freezes', shopOnly, wrap(async (req, res) => {
  const shop = await myShop(req.user.id);
  res.json(await freezesForShop(shop.id));
}));

r.post('/shop/freezes/collect', shopOnly, wrap(async (req, res) => {
  const shop = await myShop(req.user.id);
  const closed = await collectFreeze(shop.id, { id: num(req.body?.id), code: req.body?.code?.trim() });
  res.json({ ok: true, code: closed.code, total: closed.total });
}));

export default r;
