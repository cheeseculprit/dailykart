import { createContext, useContext, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useAuth } from '../lib/auth.jsx';
import { useCart } from '../lib/cart.jsx';
import { useTheme } from '../lib/theme.jsx';
import { useUI } from '../lib/ui.jsx';
import { BasketIcon, HelpHandsIcon, HomeIcon, MoonIcon, ReceiptIcon, SearchIcon, StoreIcon, SunIcon } from './icons.jsx';

/*
 * Floating dock, after Magic UI's Dock (magicui.design/docs/components/dock):
 * icons grow as the mouse passes over them. On touch screens they stay
 * at the normal size. Styled as yellow "liquid glass".
 */
const SIZE = 44;
const MAGNIFIED = 62;
const DISTANCE = 140;

const DockCtx = createContext(null);

function Dock({ children }) {
  const mouseX = useMotionValue(Infinity);
  return (
    <DockCtx.Provider value={mouseX}>
      <motion.nav
        aria-label="Quick menu"
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className="glass-dock pointer-events-auto flex h-[60px] items-end gap-1.5 rounded-[22px] px-2 pb-2"
      >
        {children}
      </motion.nav>
    </DockCtx.Provider>
  );
}

/** One dock button: grows with the mouse, shows a label above on hover. */
function DockIcon({ label, active, badge, onClick, to, end, children }) {
  const mouseX = useContext(DockCtx);
  const ref = useRef(null);
  const distance = useTransform(mouseX, (x) => {
    const box = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return x - box.x - window.scrollX - box.width / 2;
  });
  const target = useTransform(distance, [-DISTANCE, 0, DISTANCE], [SIZE, MAGNIFIED, SIZE]);
  const size = useSpring(target, { mass: 0.1, stiffness: 150, damping: 12 });

  const look = (on) =>
    `dock-btn group relative grid h-full w-full place-items-center rounded-full transition-colors ${
      on ? 'bg-maroon-600 text-white shadow-lift' : 'text-ink hover:bg-white/45 dark:hover:bg-white/10'
    }`;
  const inner = (
    <>
      {children}
      {badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-maroon-600 px-1 text-[10px] font-bold text-white ring-2 ring-saffron-300">
          {badge}
        </span>
      )}
      <span className="dock-tip pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-shade px-2 py-1 text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
        {label}
      </span>
    </>
  );

  return (
    <motion.div ref={ref} style={{ width: size, height: size }} className="shrink-0">
      {to ? (
        <NavLink to={to} end={end} aria-label={label} className={({ isActive }) => look(isActive)}>
          {inner}
        </NavLink>
      ) : (
        <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} className={look(active)}>
          {inner}
        </button>
      )}
    </motion.div>
  );
}

const Divider = () => <span aria-hidden="true" className="mx-1 mb-2 h-8 w-px self-end bg-ink/15" />;

export default function AppDock() {
  const { user } = useAuth();
  const { count } = useCart();
  const { theme, toggleTheme } = useTheme();
  const { chat, openChat, cartOpen, openCart } = useUI();
  const isShop = user?.role === 'shopkeeper';
  const icon = 'h-[46%] w-[46%]';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-3 sm:bottom-5">
      <Dock>
        {isShop ? (
          <DockIcon to="/shop/dashboard" label="Dashboard"><StoreIcon className={icon} /></DockIcon>
        ) : (
          <>
            <DockIcon to="/" end label="Home"><HomeIcon className={icon} /></DockIcon>
            <DockIcon to="/search" label="Search"><SearchIcon className={icon} /></DockIcon>
            <DockIcon onClick={openCart} active={cartOpen} badge={count} label="Basket"><BasketIcon className={icon} /></DockIcon>
            <DockIcon to="/orders" label="Orders"><ReceiptIcon className={icon} /></DockIcon>
          </>
        )}
        <Divider />
        <DockIcon onClick={openChat} active={chat !== 'closed'} label="Daily Help"><HelpHandsIcon className={icon} /></DockIcon>
        <DockIcon onClick={toggleTheme} label={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
          {theme === 'dark' ? <SunIcon className={icon} /> : <MoonIcon className={icon} />}
        </DockIcon>
      </Dock>
    </div>
  );
}
