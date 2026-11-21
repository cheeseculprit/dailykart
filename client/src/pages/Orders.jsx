import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, rupees } from '../lib/api.js';
import Countdown from '../components/Countdown.jsx';
import { CheckIcon, ChevronDownIcon, ClockIcon, ReceiptIcon, StoreIcon } from '../components/icons.jsx';

const STATUS = {
  active: { label: 'Ready for pickup', chip: 'bg-maroon-600 text-white', stripe: 'bg-maroon-600' },
  collected: { label: 'Picked up', chip: 'bg-leaf-50 text-leaf-600', stripe: 'bg-leaf-600' },
  expired: { label: 'Not picked up', chip: 'bg-maroon-50 text-maroon-600', stripe: 'bg-maroon-500' },
  cancelled: { label: 'Cancelled', chip: 'bg-cream-deep text-ink-soft', stripe: 'bg-ink-faint' },
};

const when = (iso) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const summary = (items) => {
  const parts = items.map((i) => `${i.name} ×${i.qty}`);
  return parts.length > 2 ? `${parts.slice(0, 2).join(', ')} +${parts.length - 2} more` : parts.join(', ');
};

/** A reservation waiting to be picked up: the code is the hero. */
function PickupCard({ f, onExpire }) {
  return (
    <article className="overflow-hidden rounded-2xl border-2 border-maroon-600 bg-white shadow-card">
      <div className="flex items-center justify-between gap-3 bg-maroon-600 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-saffron-300">Ready for pickup</p>
          <h3 className="truncate font-bold">{f.shop_name}</h3>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
          <ClockIcon className="h-4 w-4" />
          <Countdown until={f.expires_at} onDone={onExpire} className="tabular-nums" />
        </span>
      </div>
      <div className="p-4">
        {f.shop_address && <p className="truncate text-xs text-ink-soft">{f.shop_address}</p>}
        <div className="mt-3 rounded-xl border-2 border-dashed border-saffron-400 bg-saffron-50 p-3 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wider text-maroon-600">Show this code at the counter</p>
          <p className="mt-1 font-mono text-3xl font-extrabold tracking-widest text-maroon-700">{f.code}</p>
        </div>
        <ul className="mt-3 space-y-1 text-sm">
          {f.items.map((i) => (
            <li key={i.productId} className="flex justify-between gap-2">
              <span className="truncate">{i.qty} × {i.name}</span>
              <span>{rupees(i.price * i.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-cream-line pt-3">
          <span className="font-bold">Pay at shop</span>
          <span className="text-lg font-extrabold text-maroon-600">{rupees(f.total)}</span>
        </div>
        <Link to="/cart" className="btn-outline mt-3 w-full py-2">Manage pickup</Link>
      </div>
    </article>
  );
}

function OrderCard({ f }) {
  const [open, setOpen] = useState(false);
  const s = STATUS[f.status] || STATUS.cancelled;
  const count = f.items.reduce((n, i) => n + i.qty, 0);
  return (
    <article className="relative overflow-hidden rounded-xl border border-cream-line bg-white transition hover:border-maroon-100 hover:shadow-card">
      <span className={`absolute inset-y-0 left-0 w-1 ${s.stripe}`} aria-hidden="true" />
      <div className="p-4 pl-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-maroon-50 text-maroon-600">
            <StoreIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate font-bold">{f.shop_name}</h3>
              <span className="shrink-0 font-extrabold text-maroon-600">{rupees(f.total)}</span>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${s.chip}`}>
                {f.status === 'collected' && <CheckIcon className="h-3 w-3" />}{s.label}
              </span>
              {when(f.created_at)} · {count} item{count === 1 ? '' : 's'}
            </p>
            <p className="mt-1.5 truncate text-sm text-ink-soft">{summary(f.items)}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-ink-faint">#{f.code}</span>
          <div className="flex items-center gap-1">
            {f.status !== 'active' && (
              <Link to={`/shops/${f.shop_id}`} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-maroon-600 hover:bg-maroon-50">
                Order again
              </Link>
            )}
            <button
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-cream-deep hover:text-ink"
            >
              {open ? 'Hide' : 'Details'}
              <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {open && (
          <div className="menu-pop mt-3 rounded-xl bg-cream p-3">
            <ul className="space-y-1.5 text-sm">
              {f.items.map((i) => (
                <li key={i.productId} className="flex justify-between gap-2">
                  <span className="truncate">{i.qty} × {i.name} {i.unit && <span className="text-ink-faint">({i.unit})</span>}</span>
                  <span className="font-semibold">{rupees(i.price * i.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-between border-t border-cream-line pt-2 text-sm font-bold">
              <span>{f.status === 'collected' ? 'Paid at shop' : 'Total'}</span>
              <span>{rupees(f.total)}</span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function Stat({ value, label }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15">
      <p className="text-lg font-extrabold leading-tight">{value}</p>
      <p className="text-[11px] text-white/70">{label}</p>
    </div>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/freezes').then(setOrders).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const active = (orders || []).filter((f) => f.status === 'active');
  const past = (orders || []).filter((f) => f.status !== 'active');
  const collected = past.filter((f) => f.status === 'collected');
  const spent = collected.reduce((s, f) => s + Number(f.total), 0);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-6 sm:pb-16">
      <section className="glass-maroon rounded-2xl p-5 text-white sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-saffron-300">My orders</p>
            <h1 className="mt-1 text-2xl font-extrabold">Your orders</h1>
            <p className="text-sm text-white/75">Good things, from around the corner.</p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
            <ReceiptIcon className="h-5 w-5 text-saffron-300" />
          </span>
        </div>
        {orders?.length > 0 && (
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Stat value={orders.length} label="Orders" />
            <Stat value={collected.length} label="Picked up" />
            <Stat value={rupees(spent)} label="Paid at shops" />
          </div>
        )}
      </section>

      {error && <p className="mt-4 rounded-xl bg-maroon-50 px-4 py-3 text-sm text-maroon-700">{error}</p>}

      {orders === null && !error && (
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-white" />)}
        </div>
      )}

      {orders?.length === 0 && (
        <div className="mt-6 rounded-2xl border border-maroon-100 bg-white p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-maroon-50 text-maroon-600">
            <ReceiptIcon className="h-7 w-7" />
          </span>
          <p className="mt-3 font-bold">No orders yet</p>
          <p className="mt-1 text-sm text-ink-soft">Reserve something nearby and it will show up here.</p>
          <Link to="/" className="btn-primary mt-5">Start shopping</Link>
        </div>
      )}

      {active.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-maroon-600">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-maroon-500/60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-maroon-600" />
            </span>
            Waiting for you · {active.length}
          </h2>
          <div className="space-y-4">
            {active.map((f) => <PickupCard key={f.id} f={f} onExpire={load} />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-soft">Past orders · {past.length}</h2>
          <div className="space-y-3">
            {past.map((f) => <OrderCard key={f.id} f={f} />)}
          </div>
        </section>
      )}
    </main>
  );
}
