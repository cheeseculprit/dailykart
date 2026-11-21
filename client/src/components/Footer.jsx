import { Link } from 'react-router-dom';
import { useTheme } from '../lib/theme.jsx';
import { useUI } from '../lib/ui.jsx';
import { HelpHandsIcon, MoonIcon, SunIcon } from './icons.jsx';

export default function Footer() {
  const { theme, toggleTheme } = useTheme();
  const { openChat } = useUI();
  return (
    <footer className="mt-16 bg-maroon-600 pb-24 text-white dark:border-t dark:border-cream-line dark:bg-cream-deep">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[2fr_1fr_1fr]">
        <div>
          <p className="font-brand text-2xl text-saffron-300">Shopping Nayi, Bharosa Wahi!</p>
          <p className="mt-2 max-w-sm text-sm text-white/80 dark:text-ink-soft">
            Everything from your neighbourhood shops, reserved in seconds and picked up on your walk.
          </p>
        </div>
        <div>
          <p className="text-sm font-bold dark:text-ink">Dailykart</p>
          <ul className="mt-3 space-y-2 text-sm text-white/80 dark:text-ink-soft">
            <li><Link to="/" className="hover:text-white">Home</Link></li>
            <li><Link to="/search" className="hover:text-white">Search</Link></li>
            <li><Link to="/orders" className="hover:text-white">My orders</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-bold dark:text-ink">For shops</p>
          <ul className="mt-3 space-y-2 text-sm text-white/80 dark:text-ink-soft">
            <li><Link to="/shop/login" className="hover:text-white">Shopkeeper login</Link></li>
            <li><Link to="/shop/login?register=1" className="hover:text-white">List your dukaan</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/15 dark:border-cream-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <p className="text-xs text-white/70 dark:text-ink-faint">© {new Date().getFullYear()} Dailykart. Made for Indian neighbourhoods.</p>
          <div className="flex items-center gap-2">
            <button onClick={openChat} className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-maroon-600 shadow-card hover:bg-cream-deep dark:text-ink">
              <HelpHandsIcon className="h-4 w-4" /> Chat with Daily Help
            </button>
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className="grid h-9 w-9 place-items-center rounded-full bg-white text-maroon-600 shadow-card hover:bg-cream-deep dark:text-ink"
            >
              {theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
