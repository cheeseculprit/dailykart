import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { rupees } from '../lib/api.js';
import { useCart } from '../lib/cart.jsx';
import { useUI } from '../lib/ui.jsx';
import { Basket } from '../pages/Cart.jsx';
import { XIcon } from './icons.jsx';

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The basket as a panel that slides in from the right, over any page. */
export default function CartDrawer() {
  const { cartOpen, setCartOpen } = useUI();
  const { cart, count } = useCart();
  const nav = useNavigate();
  const here = useLocation();
  const [closing, setClosing] = useState(false);
  const groups = Object.values(cart);
  const total = groups.reduce((s, g) => s + Object.values(g.items).reduce((m, i) => m + i.price * i.qty, 0), 0);

  const close = () => {
    if (closing) return;
    if (reduceMotion()) return setCartOpen(false);
    setClosing(true);
    setTimeout(() => { setCartOpen(false); setClosing(false); }, 220);
  };

  // Going to another page (a shop link, login) closes the drawer.
  useEffect(() => { setCartOpen(false); }, [here.pathname]);

  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [cartOpen]);

  if (!cartOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[60] bg-shade/40 backdrop-blur-[2px] ${closing ? 'chat-backdrop-out' : 'chat-backdrop'}`}
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Your basket"
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-cream shadow-pop ${closing ? 'drawer-out' : 'drawer'}`}
      >
        <header className="flex items-center justify-between border-b border-cream-line bg-white px-4 py-3">
          <div>
            <h2 className="text-lg font-bold">Your basket</h2>
            <p className="text-xs text-ink-soft">{count ? `${count} item${count > 1 ? 's' : ''} · ${rupees(total)}` : 'Nothing added yet'}</p>
          </div>
          <button onClick={close} aria-label="Close basket" className="grid h-9 w-9 place-items-center rounded-lg border border-cream-line bg-white text-maroon-600 hover:bg-cream-deep">
            <XIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {groups.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-4xl">🧺</p>
              <p className="mt-3 font-semibold">Your basket is empty</p>
              <p className="mt-1 text-sm text-ink-soft">Add a few things from the shops around you.</p>
              <button onClick={() => { close(); nav('/'); }} className="btn-primary mt-5">Browse nearby shops</button>
            </div>
          ) : (
            groups.map((g) => <Basket key={g.shopId} group={g} onReserved={() => nav('/orders')} />)
          )}
        </div>

        <footer className="border-t border-cream-line bg-white p-3">
          <Link to="/cart" onClick={() => setCartOpen(false)} className="btn-outline w-full py-3">
            Open full basket and pickups <span aria-hidden="true">→</span>
          </Link>
        </footer>
      </aside>
    </div>
  );
}
