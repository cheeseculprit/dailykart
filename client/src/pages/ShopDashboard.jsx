import { useCallback, useEffect, useRef, useState } from 'react';
import { api, rupees, CATEGORY_EMOJI, expiryLabel, fmtTime, hoursLabel } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import Countdown from '../components/Countdown.jsx';
import VoiceStock from '../components/VoiceStock.jsx';
import ProductImage, { imageUrl, shrinkImage } from '../components/ProductImage.jsx';
import { PlusIcon, MinusIcon, PickupIcon, CheckIcon, XIcon, BellIcon, ClockIcon, StoreIcon } from '../components/icons.jsx';

const CATEGORIES = ['Dairy', 'Bakery', 'Snacks', 'Fruits & Veg', 'Beverages', 'Ready to eat', 'Other'];
const EMPTY = { name: '', brand: '', category: 'Dairy', unit: '', price: '', stock: '', expires_on: '', image_id: null };

/** "Add photo" picker: camera or gallery, preview, shrinks before upload. */
function PhotoPicker({ imageId, onChange, category }) {
  const [preview, setPreview] = useState(imageUrl(imageId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const data = await shrinkImage(file);
      setPreview(data);
      const { id } = await api('/shop/images', { method: 'POST', body: { data } });
      onChange(id);
    } catch (err) {
      setError(err.message);
      setPreview(imageUrl(imageId));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sm:col-span-2">
      <span className="label">Product photo</span>
      <div className="flex items-center gap-4">
        <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-cream-line bg-cream text-4xl">
          {preview ? <img src={preview} alt="" className="h-full w-full object-contain" /> : <span aria-hidden="true">{CATEGORY_EMOJI[category]}</span>}
        </div>
        <div className="space-y-2">
          <label className={`btn-outline cursor-pointer px-3 py-1.5 text-xs ${busy ? 'pointer-events-none opacity-60' : ''}`}>
            {busy ? 'Uploading…' : preview ? 'Change photo' : 'Add photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={pick} className="sr-only" />
          </label>
          {preview && !busy && (
            <button type="button" onClick={() => { setPreview(null); onChange(null); }} className="block text-xs font-semibold text-ink-faint hover:text-maroon-600">Remove photo</button>
          )}
          <p className="text-[11px] text-ink-faint">A clear photo of the pack, front-facing. JPG, PNG or WebP.</p>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-maroon-600">{error}</p>}
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className={`rounded-2xl p-5 ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-3xl font-extrabold">{value}</p>
    </div>
  );
}

function ProductForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ? { ...EMPTY, ...initial, expires_on: initial.expires_on || '' } : EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave({ ...form, price: Number(form.price), stock: Number(form.stock), expires_on: form.expires_on || null });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-shade/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="card max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-b-none p-6 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold">{initial ? 'Edit item' : 'Add an item'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-xl p-2 hover:bg-cream"><XIcon /></button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <PhotoPicker imageId={form.image_id} category={form.category} onChange={(id) => setForm((f) => ({ ...f, image_id: id }))} />
          <label className="sm:col-span-2"><span className="label">Item name</span><input className="input" value={form.name} onChange={set('name')} required placeholder="Toned Milk" /></label>
          <label><span className="label">Brand</span><input className="input" value={form.brand || ''} onChange={set('brand')} placeholder="Nandini" /></label>
          <label><span className="label">Pack size</span><input className="input" value={form.unit} onChange={set('unit')} placeholder="500 ml" /></label>
          <label><span className="label">Category</span>
            <select className="input" value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label><span className="label">Best before</span><input className="input" type="date" value={form.expires_on} onChange={set('expires_on')} /></label>
          <label><span className="label">Price (₹)</span><input className="input" type="number" min="0" step="0.5" value={form.price} onChange={set('price')} required /></label>
          <label><span className="label">Units on shelf</span><input className="input" type="number" min="0" step="1" value={form.stock} onChange={set('stock')} required /></label>
        </div>
        {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="btn-primary mt-6 w-full">{busy ? 'Saving…' : initial ? 'Save changes' : 'List item'}</button>
      </form>
    </div>
  );
}

/* ---------- Live activity feed (read from the database, works on any hosting) ---------- */

const ago = (iso, now) => {
  const s = Math.max(0, Math.round((now - new Date(iso)) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const itemList = (items = []) => items.map((i) => `${i.qty}× ${i.name}`).join(', ');
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

const TONES = {
  order: 'bg-saffron-100 text-saffron-600',
  done: 'bg-leaf-50 text-leaf-600',
  bad: 'bg-maroon-50 text-maroon-600',
  quiet: 'bg-cream-deep text-ink-soft',
};

/** Turn an activity row from /shop/activity into a sentence a shopkeeper understands. */
function describe(e) {
  const who = e.customer || 'A customer';
  const shelf = e.stock != null ? ` · ${e.stock} on the shelf now` : '';
  switch (e.type) {
    case 'reserved':
      return { Icon: PickupIcon, tone: 'order', tag: 'New order', title: `${who} reserved items`,
        detail: `${itemList(e.items)} · ${rupees(e.total)}`, code: e.code };
    case 'collected':
      return { Icon: CheckIcon, tone: 'done', tag: 'Picked up', title: `${who} picked up their order`,
        detail: `${itemList(e.items)} · ${rupees(e.total)} paid at the counter`, code: e.code };
    case 'cancelled':
      return { Icon: XIcon, tone: 'bad', tag: 'Cancelled', title: `${who} cancelled their order`,
        detail: `${itemList(e.items)} went back on your shelf`, code: e.code };
    case 'expired':
      return { Icon: ClockIcon, tone: 'quiet', tag: 'Not picked up', title: `${who} didn't come in time`,
        detail: `${itemList(e.items)} went back on your shelf`, code: e.code };
    case 'added':
      return { Icon: PlusIcon, tone: 'done', title: `You listed ${e.name}`, detail: `Customers nearby can find it now${shelf}` };
    case 'adjusted':
      return { Icon: e.delta < 0 ? MinusIcon : PlusIcon, tone: 'quiet', title: `${e.name}: ${signed(e.delta)} on the shelf`,
        detail: `Counted at the counter${shelf}` };
    case 'edited':
      return { Icon: StoreIcon, tone: 'quiet', title: `You edited ${e.name}`,
        detail: e.delta ? `Stock ${signed(e.delta)}${shelf}` : 'Details updated' };
    case 'removed':
      return { Icon: MinusIcon, tone: 'bad', title: `You removed ${e.name}`, detail: 'Hidden from customers' };
    default:
      return { Icon: StoreIcon, tone: 'quiet', title: 'Shop updated', detail: '' };
  }
}

const FILTERS = [['all', 'All'], ['order', 'Orders'], ['stock', 'Stock']];

function EventFeed() {
  const [events, setEvents] = useState(null);
  const [filter, setFilter] = useState('all');
  const [now, setNow] = useState(Date.now());
  const [failed, setFailed] = useState(false);
  const seen = useRef(null);

  useEffect(() => {
    const load = () => {
      // Skip refreshes while the tab is hidden; catch up as soon as it's visible again.
      if (document.hidden) return;
      api('/shop/activity')
        .then((rows) => { setEvents(rows); setFailed(false); setNow(Date.now()); })
        .catch(() => setFailed(true));
    };
    load();
    const t = setInterval(load, 4000);
    document.addEventListener('visibilitychange', load);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', load); };
  }, []);

  const rows = (events || [])
    .map((e) => ({ e, d: describe(e) }))
    .filter(({ e }) => filter === 'all' || e.kind === filter);

  // Highlight items that arrived since the last refresh (not on the first load).
  const fresh = new Set();
  if (seen.current) for (const { e } of rows) if (!seen.current.has(e.key)) fresh.add(e.key);
  useEffect(() => { if (events) seen.current = new Set(events.map((e) => e.key)); }, [events]);

  return (
    <section className="card overflow-hidden">
      <header className="border-b border-cream-line p-5 pb-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">Live activity</h2>
          <span className="flex items-center gap-1.5 rounded-full bg-leaf-50 px-2.5 py-1 text-[11px] font-semibold text-leaf-600">
            <span className="relative flex h-2 w-2">
              {!failed && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-leaf-600 opacity-60" />}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${failed ? 'bg-ink-faint' : 'bg-leaf-600'}`} />
            </span>
            {failed ? 'Reconnecting…' : 'Live'}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-ink-soft">Orders and stock changes at your shop, as they happen.</p>
        <div className="mt-3 flex gap-1.5" role="group" aria-label="Show">
          {FILTERS.map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${filter === k ? 'bg-maroon-600 text-white' : 'bg-cream-deep text-ink-soft hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
      </header>

      <ul className="max-h-[28rem] divide-y divide-cream-line overflow-y-auto">
        {events === null ? (
          [0, 1, 2].map((i) => <li key={i} className="flex gap-3 p-4"><span className="h-9 w-9 animate-pulse rounded-full bg-cream-deep" /><span className="h-9 flex-1 animate-pulse rounded-lg bg-cream-deep" /></li>)
        ) : rows.length === 0 ? (
          <li className="p-8 text-center">
            <p className="text-3xl" aria-hidden="true">🛎️</p>
            <p className="mt-2 text-sm font-semibold">Nothing here yet</p>
            <p className="mt-1 text-xs text-ink-soft">New reservations and stock changes will show up here automatically.</p>
          </li>
        ) : (
          rows.map(({ e, d }) => (
            <li key={e.key} className={`flex gap-3 p-4 ${fresh.has(e.key) ? 'feed-in bg-saffron-50' : ''}`}>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${TONES[d.tone]}`}><d.Icon className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-snug">{d.title}</p>
                  <time dateTime={e.at} title={new Date(e.at).toLocaleString('en-IN')} className="shrink-0 text-[11px] text-ink-faint">{ago(e.at, now)}</time>
                </div>
                {d.detail && <p className="mt-0.5 text-xs text-ink-soft">{d.detail}</p>}
                {(d.tag || d.code) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {d.tag && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TONES[d.tone]}`}>{d.tag}</span>}
                    {d.code && <span className="rounded border border-cream-line px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-ink-soft">{d.code}</span>}
                  </div>
                )}
              </div>
            </li>
          ))
        )}
      </ul>

      <footer className="border-t border-cream-line px-5 py-2.5 text-[11px] text-ink-faint">
        Last 7 days · refreshes every few seconds
      </footer>
    </section>
  );
}

/** Opening hours. The dashboard refreshes every few seconds, so edits stay local until saved. */
function ShopHours({ shop, onSaved }) {
  const toast = useToast();
  const [opens, setOpens] = useState(shop.opens_at);
  const [closes, setCloses] = useState(shop.closes_at);
  const [busy, setBusy] = useState(false);
  const changed = opens !== shop.opens_at || closes !== shop.closes_at;
  const r = shop.reserve;
  const tone = !r?.open ? 'bg-cream-deep text-ink-soft' : r.closingSoon ? 'bg-saffron-50 text-maroon-700' : 'bg-leaf-50 text-leaf-600';

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/shop/hours', { method: 'PATCH', body: { opens_at: opens, closes_at: closes } });
      toast(`Hours saved: ${fmtTime(opens)} – ${fmtTime(closes)}`, 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold"><ClockIcon className="h-5 w-5 text-maroon-600" />Shop hours</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{hoursLabel(shop)}</span>
      </div>
      <form onSubmit={save} className="mt-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="label">Opens at</span><input type="time" required value={opens} onChange={(e) => setOpens(e.target.value)} className="input" /></label>
          <label className="block"><span className="label">Closes at</span><input type="time" required value={closes} onChange={(e) => setCloses(e.target.value)} className="input" /></label>
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          No reservations while you're closed. In the last 30 minutes, holds end at closing time and only customers who can walk here in time can reserve.
        </p>
        {changed && (
          <div className="mt-3 flex gap-2">
            <button disabled={busy} className="btn-primary flex-1 py-2">{busy ? 'Saving…' : 'Save hours'}</button>
            <button type="button" onClick={() => { setOpens(shop.opens_at); setCloses(shop.closes_at); }} className="btn-ghost py-2">Undo</button>
          </div>
        )}
      </form>
    </section>
  );
}

export default function ShopDashboard() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [freezes, setFreezes] = useState([]);
  const [notes, setNotes] = useState([]);
  const [editing, setEditing] = useState(null); // null | 'new' | product
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/shop/me').then(setData).catch((e) => setError(e.message));
    api('/shop/freezes').then(setFreezes).catch(() => {});
    api('/notifications').then(setNotes).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  const saveProduct = async (p) => {
    if (editing === 'new') await api('/shop/products', { method: 'POST', body: p });
    else await api(`/shop/products/${editing.id}`, { method: 'PATCH', body: p });
    toast(editing === 'new' ? 'Item listed' : 'Item updated', 'success');
    load();
  };

  const bump = async (p, delta) => {
    setData((d) => ({ ...d, products: d.products.map((x) => (x.id === p.id ? { ...x, stock: Math.max(0, x.stock + delta) } : x)) }));
    try {
      const r = await api(`/shop/products/${p.id}/adjust`, { method: 'POST', body: { delta } });
      setData((d) => ({ ...d, products: d.products.map((x) => (x.id === p.id ? { ...x, stock: r.stock } : x)) }));
    } catch (e) {
      toast(e.message, 'error');
      load();
    }
  };

  const remove = async (p) => {
    if (!confirm(`Remove ${p.name} from your listing?`)) return;
    try {
      const r = await api(`/shop/products/${p.id}`, { method: 'DELETE' });
      toast(r.hidden ? 'Hidden. It has active freezes, so it stays until they close.' : 'Item removed');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const collect = async (body) => {
    try {
      const r = await api('/shop/freezes/collect', { method: 'POST', body });
      toast(`${r.code} collected · ${rupees(r.total)} received`, 'success');
      setCode('');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  if (error) return <main className="mx-auto max-w-6xl px-4 py-10"><p className="card p-6 text-red-600">{error}</p></main>;
  if (!data) return <main className="mx-auto max-w-6xl px-4 py-10"><div className="h-40 animate-pulse rounded-2xl bg-white" /></main>;

  const { shop, products, stats } = data;
  const active = freezes.filter((f) => f.status === 'active');
  const recent = freezes.filter((f) => f.status !== 'active').slice(0, 6);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink-soft">Shop dashboard</p>
          <h1 className="text-3xl font-extrabold">{shop.name}</h1>
          <p className="text-sm text-ink-soft">{shop.address}, {shop.city}</p>
        </div>
        <button onClick={() => setEditing('new')} className="btn-primary"><PlusIcon className="h-4 w-4" />Add item</button>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Waiting for pickup" value={stats.active} tone="bg-maroon-600 text-white" />
        <Stat label="Collected today" value={stats.collected_today} tone="bg-leaf-50 text-leaf-600" />
        <Stat label="Sales today" value={rupees(stats.sales_today)} tone="bg-saffron-50 text-maroon-700" />
        <Stat label="Items listed" value={products.filter((p) => p.active).length} tone="bg-white text-ink shadow-card" />
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          {/* Pickups */}
          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-extrabold"><PickupIcon className="h-5 w-5 text-maroon-600" />Pickups</h2>
              <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) collect({ code: code.trim() }); }} className="flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="DC-XXXXX" className="input w-36 py-2 font-mono uppercase" aria-label="Pickup code" />
                <button className="btn bg-maroon-600 px-4 py-2 text-white">Collect</button>
              </form>
            </div>
            {active.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-cream p-6 text-center text-sm text-ink-soft">No one is on their way right now.</p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {active.map((f) => (
                  <li key={f.id} className="rounded-2xl p-4 ring-1 ring-saffron-300">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-lg font-extrabold text-maroon-700">{f.code}</span>
                      <span className="text-xs text-ink-soft">⏱ <Countdown until={f.expires_at} onDone={load} /></span>
                    </div>
                    <p className="text-sm font-semibold">{f.customer_name}{f.customer_phone && <span className="font-normal text-ink-soft"> · {f.customer_phone}</span>}</p>
                    <ul className="mt-2 text-sm text-ink-soft">
                      {f.items.map((i) => <li key={i.productId}>{i.qty} × {i.name}</li>)}
                    </ul>
                    <p className="mt-3 font-extrabold">{rupees(f.total)}</p>
                  </li>
                ))}
              </ul>
            )}
            {recent.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-ink-soft">Recent ({recent.length})</summary>
                <ul className="mt-2 divide-y divide-black/5 text-sm">
                  {recent.map((f) => (
                    <li key={f.id} className="flex justify-between py-2">
                      <span><span className="font-mono">{f.code}</span> · {f.customer_name}</span>
                      <span className="capitalize text-ink-soft">{f.status} · {rupees(f.total)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          {/* Inventory */}
          <section className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold">Shelf</h2>
                <p className="text-sm text-ink-soft">Tap − / + as items sell over the counter, or speak an update. Frozen units are already taken out.</p>
              </div>
            </div>
            <div className="mt-3"><VoiceStock onApplied={load} /></div>
            <ul className="mt-4 divide-y divide-black/5">
              {products.map((p) => {
                const exp = expiryLabel(p.expires_on);
                return (
                  <li key={p.id} className={`flex flex-wrap items-center gap-3 py-3 ${p.active ? '' : 'opacity-50'}`}>
                    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-cream"><ProductImage product={p} emojiSize="text-xl" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.name} <span className="text-xs font-normal text-ink-faint">{p.unit}</span></p>
                      <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                        <span className="text-ink-soft">{rupees(p.price)}</span>
                        {exp && <span className={`rounded-full px-2 ${exp.tone}`}>{exp.text}</span>}
                        {p.frozen > 0 && <span className="rounded-full bg-saffron-50 px-2 text-maroon-600">{p.frozen} frozen</span>}
                        {!p.active && <span className="rounded-full bg-slate-100 px-2">hidden</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 rounded-2xl bg-cream p-1">
                      <button onClick={() => bump(p, -1)} disabled={p.stock === 0} aria-label={`One less ${p.name}`} className="grid h-8 w-8 place-items-center rounded-xl bg-white disabled:opacity-40"><MinusIcon className="h-4 w-4" /></button>
                      <span className={`w-8 text-center font-bold ${p.stock === 0 ? 'text-red-600' : ''}`}>{p.stock}</span>
                      <button onClick={() => bump(p, 1)} aria-label={`One more ${p.name}`} className="grid h-8 w-8 place-items-center rounded-xl bg-white"><PlusIcon className="h-4 w-4" /></button>
                    </div>
                    <button onClick={() => setEditing(p)} className="rounded-xl px-3 py-2 text-xs font-semibold text-maroon-600 hover:bg-saffron-50">Edit</button>
                    <button onClick={() => remove(p)} className="rounded-xl px-3 py-2 text-xs font-semibold text-ink-faint hover:bg-red-50 hover:text-red-600">Remove</button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <ShopHours key={`${shop.opens_at}-${shop.closes_at}`} shop={shop} onSaved={load} />
          {notes.length > 0 && (
            <section className="glass-maroon rounded-2xl p-5 text-white">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <BellIcon className="h-4 w-4 text-saffron-300" />
                </span>
                <h2 className="font-bold">Alerts</h2>
                <span className="ml-auto rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-white/15">
                  {Math.min(notes.length, 5)} new
                </span>
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {notes.slice(0, 5).map((n) => (
                  <li key={n.id} className="rounded-xl bg-white/10 px-3 py-2.5 ring-1 ring-white/10 backdrop-blur-sm">
                    <p className="leading-snug text-white/95">{n.message}</p>
                    <time dateTime={n.created_at} className="mt-1 block text-[11px] text-white/60">{ago(n.created_at, Date.now())}</time>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <EventFeed />
        </aside>
      </div>

      {editing && <ProductForm initial={editing === 'new' ? null : editing} onSave={saveProduct} onClose={() => setEditing(null)} />}
    </main>
  );
}
