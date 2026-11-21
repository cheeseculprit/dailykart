const TOKEN_KEY = 'dailycart.token';

// Per-tab storage: each browser window/tab keeps its own login, so you can be
// signed in as a customer in one window and a shopkeeper in another at once.
// sessionStorage survives a refresh but is not shared across tabs.
export const tokenStore = {
  get: () => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t) => { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch {} },
};

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api(path, { method = 'GET', body, params } = {}) {
  const url = new URL(`/api${path}`, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
  }
  // A Blob (e.g. a voice recording) is sent as-is with its own type; anything else as JSON.
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
  const headers = { 'Content-Type': isBlob ? body.type || 'application/octet-stream' : 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { method, headers, body: isBlob ? body : body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, "Can't reach the server. Is the backend running?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'Request failed', data);
  return data;
}

export const rupees = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const metres = (m) => (m == null ? '' : m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);

/** About 80 m per minute walking. */
export const walkMins = (m) => Math.max(1, Math.round(m / 80));

/** '22:00' -> '10:00 pm' */
export const fmtTime = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

/** Short status for a shop's opening hours, from the server's `reserve` info. */
export function hoursLabel(shop) {
  const r = shop?.reserve;
  if (!r) return `Open ${fmtTime(shop.opens_at)} – ${fmtTime(shop.closes_at)}`;
  if (!r.open) return `Closed · opens ${fmtTime(shop.opens_at)}`;
  if (r.closesInMin == null) return 'Open 24 hours';
  if (r.closingSoon) return `Closing in ${r.closesInMin} min`;
  return `Open · closes ${fmtTime(shop.closes_at)}`;
}

export const CATEGORY_EMOJI = {
  Dairy: '🥛',
  Bakery: '🍞',
  Snacks: '🍪',
  'Fruits & Veg': '🥬',
  Beverages: '🧃',
  'Ready to eat': '🥟',
  Other: '🛍️',
};

export const CATEGORY_TINT = {
  Dairy: 'bg-sky-50',
  Bakery: 'bg-amber-50',
  Snacks: 'bg-peach-50',
  'Fruits & Veg': 'bg-mint-50',
  Beverages: 'bg-brand-50',
  'Ready to eat': 'bg-rose-50',
  Other: 'bg-slate-50',
};

/** Days until a YYYY-MM-DD date (0 = today). */
export function daysLeft(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateStr}T00:00:00`);
  return Math.round((d - today) / 86400000);
}

export function expiryLabel(dateStr) {
  const n = daysLeft(dateStr);
  if (n == null) return null;
  if (n < 0) return { text: 'Expired', tone: 'bg-red-100 text-red-700' };
  if (n === 0) return { text: 'Best today', tone: 'bg-peach-100 text-peach-700' };
  if (n === 1) return { text: 'Expires tomorrow', tone: 'bg-peach-100 text-peach-700' };
  if (n <= 4) return { text: `${n} days left`, tone: 'bg-amber-100 text-amber-800' };
  return { text: `${n} days left`, tone: 'bg-mint-50 text-mint-700' };
}
