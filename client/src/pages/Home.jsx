import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, metres, walkMins, hoursLabel } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useLocation2 } from '../lib/location.jsx';
import LocationGate from '../components/LocationGate.jsx';
import ProductCard from '../components/ProductCard.jsx';
import RadiusToggle, { fmtRadius } from '../components/RadiusToggle.jsx';
import { Mascot } from '../components/Brand.jsx';
import TextGenerate from '../components/TextGenerate.jsx';
import { ArrowRightIcon, CategoryIcon } from '../components/icons.jsx';

const CATS = ['Dairy', 'Bakery', 'Fruits & Veg', 'Snacks', 'Beverages', 'Ready to eat', 'Other'];

function SectionHead({ title, sub, action }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="section-title">{title}</h2>
        {sub && <p className="text-xs text-ink-soft">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/** Round arrow button for "see everything" links; the words are for screen readers and the tooltip. */
function SeeAll({ to, label }) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className="group grid h-9 w-9 shrink-0 place-items-center rounded-full border border-cream-line bg-white text-ink shadow-card transition hover:border-saffron-400 hover:bg-saffron-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron-300"
    >
      <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function HomeInner() {
  const { user } = useAuth();
  const { loc, radius } = useLocation2();
  const [shops, setShops] = useState(null);
  const [items, setItems] = useState(null);
  // Products this customer reserved before; null until loaded (or not a customer).
  const [repeat, setRepeat] = useState(null);
  const [error, setError] = useState('');
  const isCustomer = user?.role === 'customer';

  useEffect(() => {
    const params = { lat: loc.lat, lng: loc.lng, radius };
    setError('');
    api('/shops/nearby', { params }).then(setShops).catch((e) => setError(e.message));
    api('/search', { params: { ...params, sort: 'expiry' } })
      .then((r) => setItems(r.hits.filter((h) => h.stock > 0).slice(0, 12)))
      .catch(() => setItems([]));
  }, [loc.lat, loc.lng, radius]);

  useEffect(() => {
    setRepeat(null);
    if (!isCustomer) return;
    api('/reorder', { params: { lat: loc.lat, lng: loc.lng, radius } })
      .then((r) => setRepeat(r.items))
      .catch(() => setRepeat([]));
  }, [isCustomer, user?.id, loc.lat, loc.lng, radius]);

  // Ordered before and something from those orders is available nearby: show "Repeat order".
  const showRepeat = isCustomer && repeat?.length > 0;
  const list = showRepeat ? repeat : items;
  const loading = isCustomer ? repeat === null || (!showRepeat && items === null) : items === null;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:pb-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Namaste{user ? `, ${user.name.split(' ')[0]}` : ''}</h1>
          <p className="text-sm text-ink-soft">
            {shops ? `${shops.length} neighbourhood shop${shops.length === 1 ? '' : 's'} within ${fmtRadius(radius)} of ${loc.label}` : 'Finding shops near you…'}
          </p>
        </div>
      </div>

      {/* Hero */}
      <section className="mt-5 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="relative flex overflow-hidden rounded-2xl bg-saffron-400 on-saffron">
          <div className="relative z-10 p-6 sm:p-8">
            <p className="text-[11px] font-bold uppercase tracking-wider text-maroon-700">Fresh from your lane</p>
            <TextGenerate lines={['Ghar ki zarooratein.', 'Bas, Dailykart se.']} className="mt-2 text-2xl font-extrabold leading-tight text-maroon-600 sm:text-3xl" />
            <p className="mt-2 max-w-xs text-sm text-ink/80">Milk, bread, sabzi and snacks from shops you already trust.</p>
            <Link to="/search" className="btn-primary mt-5">Start your daily basket →</Link>
          </div>
          <div className="dots ml-auto hidden items-end pr-6 sm:flex"><Mascot className="h-48" /></div>
        </div>
        <div className="glass-maroon flex flex-col justify-between rounded-2xl p-6 text-white">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-saffron-300">How it works</p>
            <h3 className="mt-2 text-xl font-bold">Reserve now.<br />Pay at the shop.</h3>
            <p className="mt-2 text-sm text-white/80">We hold your items for 30 minutes. No online payment, no delivery fee.</p>
          </div>
          <Link to="/cart" className="mt-4 rounded-lg bg-white px-4 py-2.5 text-center text-sm font-semibold text-maroon-600 hover:bg-cream">View my basket</Link>
        </div>
      </section>

      {error && <p className="card mt-6 p-4 text-sm text-maroon-600">{error}</p>}

      {/* Categories */}
      <section className="mt-8">
        <SectionHead title="What's on your list today?" sub="Shop by category" action={<SeeAll to="/search" label="Shop all categories" />} />
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:px-0">
          {CATS.map((c) => (
            <Link key={c} to={`/search?category=${encodeURIComponent(c)}`} className="group flex w-24 shrink-0 flex-col items-center gap-2 rounded-xl border border-cream-line bg-white p-3 text-center hover:border-saffron-400 sm:w-auto">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-maroon-600 text-white shadow-lift transition group-hover:scale-105 group-hover:bg-maroon-700" aria-hidden="true">
                <CategoryIcon category={c} className="h-6 w-6" />
              </span>
              <span className="text-xs font-semibold">{c}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Products */}
      <section className="mt-8">
        {showRepeat ? (
          <SectionHead title="Repeat order" sub="Things you've reserved before, available near you now" action={<Link to="/orders" className="link text-sm">My orders →</Link>} />
        ) : (
          <SectionHead title="Everyday favourites" sub="Freshest first: grab these before they're gone" action={<SeeAll to="/search" label="View all products" />} />
        )}
        {loading ? (
          <Skeleton />
        ) : list.length === 0 ? (
          <p className="card p-6 text-sm text-ink-soft">Nothing listed within {fmtRadius(radius)} yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {list.map((p) => (
              <ProductCard key={p.id} product={p} shop={{ id: p.shop_id, name: p.shop_name, distance_m: p.distance_m }} showShop />
            ))}
          </div>
        )}
      </section>

      {/* Shops */}
      <section className="mt-8">
        <SectionHead title="Your neighbourhood, online" sub="Shops you can walk to" action={<RadiusToggle />} />
        {shops === null ? (
          <Skeleton />
        ) : shops.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-3xl">🏪</p>
            <p className="mt-2 font-semibold">No Dailykart shops within {fmtRadius(radius)} yet</p>
            <p className="mt-1 text-sm text-ink-soft">Know a shop nearby? Ask them to <Link to="/shop/login?register=1" className="link">list their dukaan</Link>.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map((s) => (
              <Link key={s.id} to={`/shops/${s.id}`} className="flex min-w-0 gap-3 rounded-xl border border-cream-line bg-white p-3 hover:border-saffron-400">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-saffron-50 text-2xl">🏪</div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{s.name}</h3>
                  <p className="truncate text-xs text-ink-soft">{s.address}</p>
                  <p className="mt-1 text-xs">
                    <span className="font-semibold text-leaf-600">{metres(s.distance_m)} · {walkMins(s.distance_m)} min walk</span>
                    <span className="text-ink-faint"> · {s.in_stock} in stock</span>
                  </p>
                  {s.reserve && (!s.reserve.open || s.reserve.closingSoon) && (
                    <p className={`mt-1 text-[11px] font-semibold ${s.reserve.open ? 'text-maroon-600' : 'text-ink-faint'}`}>
                      {hoursLabel(s)}{s.reserve.open && !s.reserve.canReserve ? ' · too far to reserve now' : ''}
                    </p>
                  )}
                </div>
                <span className="self-center text-maroon-600" aria-hidden="true">›</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl border border-cream-line bg-cream-deep p-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-maroon-600">Pick up on your walk</p>
          <h3 className="mt-1 text-xl font-bold">Your daily needs. One less thing to remember.</h3>
        </div>
        <Link to="/search" className="btn-primary shrink-0">Explore nearby shops →</Link>
      </section>
    </main>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-52 animate-pulse rounded-xl bg-white" />)}
    </div>
  );
}

export default function Home() {
  return <LocationGate><HomeInner /></LocationGate>;
}
