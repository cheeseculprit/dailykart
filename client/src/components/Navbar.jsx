import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../lib/auth.jsx';
import { useCart } from '../lib/cart.jsx';
import { useLocation2 } from '../lib/location.jsx';
import { useUI } from '../lib/ui.jsx';
import { Logo, LogoMark } from './Brand.jsx';
import SearchIsland from './SearchIsland.jsx';
import { CartIcon, PinIcon, UserIcon, XIcon } from './icons.jsx';

function AccountMenu({ onClose }) {
  const { user, logout } = useAuth();
  const { openCart } = useUI();
  const nav = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    const out = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, [onClose]);

  const item = 'flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-cream-deep';
  return (
    <div ref={ref} className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-cream-line bg-cream shadow-pop">
      <div className="flex items-start justify-between border-b border-cream-line p-4">
        <div>
          <p className="font-bold">Namaste, {user.name.split(' ')[0]}</p>
          <p className="text-xs text-ink-soft">{user.email}</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="grid h-7 w-7 place-items-center rounded-lg border border-cream-line bg-white text-maroon-600"><XIcon className="h-4 w-4" /></button>
      </div>
      <Link to="/orders" onClick={onClose} className={item}>My orders <span aria-hidden="true">›</span></Link>
      <button onClick={() => { onClose(); openCart(); }} className={item}>My basket <span aria-hidden="true">›</span></button>
      <button onClick={() => { logout(); onClose(); nav('/'); }} className={`${item} text-maroon-600`}>Log out</button>
    </div>
  );
}

/** True when the screen is at least `px` wide (Tailwind's `sm` is 640). */
function useMinWidth(px) {
  const query = `(min-width: ${px}px)`;
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatch(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return match;
}

/** Inner (content-box) width of an element, kept up to date. */
function useInnerWidth(ref, active = true) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el) return undefined;
    const measure = () => setWidth(el.clientWidth);
    measure(); // right away, so the search shows on the first paint
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [ref, active]);
  return width;
}

/** Swaps between two looks with a quick scale-and-fade. */
function Swap({ id, children }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={id}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.18 }}
        className="inline-flex"
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}

/*
 * Header: logo and menu on the left, the search bar filling the middle, and
 * location / cart / account on the right. When the search pops open, the other
 * items stay but shrink (the logo becomes its "D", buttons drop their words) and
 * the bar springs wider into the room they free up. On closing, the bar shrinks
 * back first and only then do the buttons grow again, so nothing overlaps.
 */
export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const { loc, setPickerOpen } = useLocation2();
  const { openCart } = useUI();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const [focused, setFocused] = useState(false);
  const isShop = user?.role === 'shopkeeper';

  const middle = useRef(null);
  const middleWidth = useInnerWidth(middle, !isShop); // the space between the two sides
  const wide = useMinWidth(640);
  const open = !isShop && (focused || q.length > 0);

  // After closing, the buttons stay small until the bar has shrunk back ("settling").
  // Decided during render (not in an effect), so the buttons never get a frame at full size too early.
  const [settling, setSettling] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  const justClosed = prevOpen && !open;
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) setSettling(true);
  }
  useEffect(() => {
    if (!settling) return undefined;
    const t = setTimeout(() => setSettling(false), 800); // in case the bar had nothing to animate
    return () => clearTimeout(t);
  }, [settling]);

  const small = open || settling || justClosed; // header items in their compact form
  const squeeze = small || !wide; // phones always use the compact buttons
  // The bar fills the middle. Remember that width with the buttons at full size,
  // so on closing the bar can shrink straight to it.
  const restWidth = useRef(0);
  if (!small && middleWidth) restWidth.current = middleWidth;
  const barWidth = open || !restWidth.current ? middleWidth : restWidth.current;

  const submit = (e) => {
    e.preventDefault();
    nav(`/search?q=${encodeURIComponent(q.trim())}`);
  };
  const tab = ({ isActive }) => `rounded-md px-3 py-1.5 text-sm font-semibold ${isActive ? 'bg-white/70 text-maroon-700' : 'text-ink hover:bg-white/40'}`;
  const iconBtn = 'relative grid h-9 w-9 shrink-0 place-items-center rounded-full';
  const badge = count > 0 && (
    <span className="on-saffron absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-saffron-400 px-1 text-[10px] font-bold text-ink ring-2 ring-maroon-600">
      {count}
    </span>
  );

  return (
    <header className="sticky top-0 z-40 bg-saffron-400 shadow-sm transition-colors dark:border-b dark:border-cream-line dark:bg-cream-deep">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
        {/* Left side */}
        <div className={`flex shrink-0 items-center gap-1 ${isShop ? 'flex-1' : ''}`}>
          <Link to={isShop ? '/shop/dashboard' : '/'} className="shrink-0" aria-label="Dailykart home">
            <Swap id={small ? 'mark' : 'logo'}>{small ? <LogoMark /> : <Logo light small taglineFromSm />}</Swap>
          </Link>
          {!isShop && (
            <nav className="ml-2 hidden items-center gap-1 lg:flex">
              <NavLink to="/" end className={tab}>Home</NavLink>
              <NavLink to="/search" className={tab}>Categories</NavLink>
              <NavLink to="/orders" className={tab}>Orders</NavLink>
            </nav>
          )}
        </div>

        {/* Middle: the search bar fills the space between the sides */}
        {!isShop && (
          <div ref={middle} className="flex min-w-0 flex-1 justify-center">
            {middleWidth > 0 && (
              <SearchIsland
                open={open}
                width={barWidth}
                onFocusChange={setFocused}
                onSettled={() => { if (!open) setSettling(false); }}
                value={q}
                onChange={setQ}
                onSubmit={submit}
                placeholder={wide ? 'Search for milk, atta, vegetables…' : open ? 'Search milk, atta…' : 'Search'}
              />
            )}
          </div>
        )}

        {/* Right side */}
        <div className="relative flex shrink-0 items-center justify-end gap-2">
          {isShop ? (
            <button onClick={() => { logout(); nav('/shop/login'); }} className="btn-ghost py-2">Log out</button>
          ) : (
            <>
              {(
                <button
                  onClick={() => setPickerOpen(true)}
                  aria-label={loc ? `Location: ${loc.label}` : 'Set location'}
                  className={`flex h-9 min-w-0 items-center gap-1.5 rounded-full bg-maroon-600 text-xs font-semibold text-white hover:bg-maroon-700 ${
                    squeeze ? 'w-9 shrink-0 justify-center' : 'max-w-[190px] px-3 lg:rounded-lg'
                  }`}
                >
                  <PinIcon className="h-4 w-4 shrink-0" />
                  {!squeeze && <span className="hidden truncate md:inline">{loc ? loc.label : 'Set location'}</span>}
                </button>
              )}

              <button
                onClick={openCart}
                aria-label="Cart"
                className={`${squeeze ? iconBtn : 'relative flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold'} bg-maroon-600 text-white hover:bg-maroon-700`}
              >
                <CartIcon className="h-4 w-4" />
                {!squeeze && <span>Cart</span>}
                {badge}
              </button>

              {(user ? (
                  <>
                    <button onClick={() => setMenu((m) => !m)} aria-label="Account" className={`${iconBtn} bg-white font-bold text-maroon-600`}>
                      {user.name[0].toUpperCase()}
                    </button>
                    {menu && <AccountMenu onClose={() => setMenu(false)} />}
                  </>
                ) : squeeze ? (
                  <Link to="/login" aria-label="Log in" className={`${iconBtn} bg-white text-maroon-600`}>
                    <UserIcon className="h-[18px] w-[18px]" />
                  </Link>
                ) : (
                  <Link to="/login" className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-maroon-600 hover:bg-cream">Log in</Link>
                ))}
            </>
          )}
        </div>
      </div>
      {/* The old phone bottom bar is replaced by the floating dock (Dock.jsx). */}
    </header>
  );
}
