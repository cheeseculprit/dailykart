// Shop opening hours and the closing-time reservation rule.
//
// Hours are stored as 'HH:MM' (24-hour) in the shop's local time (India).
// Same open and close time means open all day; a close time earlier than the
// open time means the shop is open past midnight (e.g. 18:00 to 02:00).
import { config } from './config.js';
import { HttpError } from './auth.js';

const DAY = 24 * 60 * 60;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const WALK_M_PER_MIN = 80;   // same walking speed the website uses
const PICKUP_BUFFER_MIN = 3; // time to find the item and pay at the counter

export const isTime = (v) => typeof v === 'string' && HHMM.test(v);
const toSecs = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return (h * 60 + m) * 60; };

/** Seconds since midnight right now, on the shops' clock (not the server's). */
function nowSecs(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: config.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return get('hour') * 3600 + get('minute') * 60 + get('second');
}

/** Is the shop open now, and how long until it closes (or opens)? */
export function shopClock(shop, now = new Date()) {
  const open = isTime(shop.opens_at) ? toSecs(shop.opens_at) : 7 * 3600;
  const close = isTime(shop.closes_at) ? toSecs(shop.closes_at) : 22 * 3600;
  if (open === close) return { open: true, secsToClose: Infinity };
  const t = nowSecs(now);
  const sinceOpen = (t - open + DAY) % DAY;
  const length = (close - open + DAY) % DAY;
  if (sinceOpen < length) return { open: true, secsToClose: length - sinceOpen };
  return { open: false, secsToOpen: (open - t + DAY) % DAY };
}

const fmt12 = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

/**
 * Can someone this far away reserve at this shop right now, and for how long?
 *
 * A hold normally lasts config.freeze.minutes (30), but never past closing
 * time. Near closing the hold gets shorter, so only people who can walk there
 * before the shutter comes down may reserve. Far-away people are told to try
 * tomorrow. distanceM may be null when the customer's position is unknown.
 */
export function reserveWindow(shop, distanceM, now = new Date()) {
  const clock = shopClock(shop, now);
  if (!clock.open) {
    return { open: false, canReserve: false, opensInMin: Math.ceil(clock.secsToOpen / 60),
      reason: `${shop.name} is closed now. It opens at ${fmt12(shop.opens_at)}.` };
  }
  const fullHold = config.freeze.minutes * 60;
  const holdSecs = Math.min(fullHold, clock.secsToClose);
  const closesInMin = Number.isFinite(clock.secsToClose) ? Math.floor(clock.secsToClose / 60) : null;
  const closingSoon = holdSecs < fullHold;
  const base = { open: true, closesInMin, closingSoon, holdMins: Math.floor(holdSecs / 60) };

  if (!closingSoon) return { ...base, canReserve: true };
  if (distanceM == null) {
    return { ...base, canReserve: false, reason: `${shop.name} closes soon. Share your location so we can check you can reach it in time.` };
  }
  const walkMin = Math.ceil(distanceM / WALK_M_PER_MIN);
  const needSecs = (walkMin + PICKUP_BUFFER_MIN) * 60;
  if (needSecs > holdSecs) {
    return { ...base, canReserve: false, walkMin,
      reason: `${shop.name} closes in ${closesInMin} min and you're about a ${walkMin} min walk away, so you may not make it. Only customers close by can reserve now. You can reserve again when it opens at ${fmt12(shop.opens_at)}.` };
  }
  return { ...base, canReserve: true, walkMin };
}

/** Throw a friendly error if this reservation isn't allowed; otherwise return the hold length in seconds. */
export function checkReserve(shop, distanceM, now = new Date()) {
  const w = reserveWindow(shop, distanceM, now);
  if (!w.canReserve) throw new HttpError(409, w.reason);
  const clock = shopClock(shop, now);
  return Math.min(config.freeze.minutes * 60, clock.secsToClose);
}

/** Validate opening hours from a form. Returns { opens_at, closes_at }. */
export function readHours(body, required = false) {
  const opens = body?.opens_at ?? (required ? undefined : '07:00');
  const closes = body?.closes_at ?? (required ? undefined : '22:00');
  if (!isTime(opens) || !isTime(closes)) throw new HttpError(400, 'Enter opening and closing times like 07:00 and 22:00');
  return { opens_at: opens, closes_at: closes };
}

/** Distance in metres between two points (same formula as the SQL). */
export function metresBetween(a, b) {
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
