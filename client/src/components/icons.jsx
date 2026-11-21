const Svg = ({ children, className = 'h-5 w-5', ...p }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...p}>
    {children}
  </svg>
);

export const HomeIcon = (p) => <Svg {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></Svg>;
export const UserIcon = (p) => <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>;
export const SearchIcon =(p) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
export const CartIcon = (p) => <Svg {...p}><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h3l2.6 12.3a1 1 0 0 0 1 .7h9.7a1 1 0 0 0 1-.8L21 7H6" /></Svg>;
export const PinIcon = (p) => <Svg {...p}><path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></Svg>;
export const StoreIcon = (p) => <Svg {...p}><path d="M3 9 4.5 4h15L21 9M3 9h18M3 9v1.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9M5 13v8h14v-8" /></Svg>;
export const ClockIcon = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
/** Pickups / new orders: a ring on a line, ─◯─ */
export const PickupIcon = (p) => <Svg {...p}><circle cx="12" cy="12" r="4.5" /><path d="M2 12h5.5M16.5 12H22" /></Svg>;
export const WalkIcon = (p) => <Svg {...p}><circle cx="13" cy="4" r="1.6" /><path d="m9 21 2.5-6.5L14 17v4M7 11l3-3.5 3.5 1.5 2 3.5 2.5 1M11.5 14.5 10 8" /></Svg>;
export const PlusIcon = (p) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const MinusIcon = (p) => <Svg {...p}><path d="M5 12h14" /></Svg>;
export const XIcon = (p) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const BoltIcon = (p) => <Svg {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></Svg>;
export const CheckIcon = (p) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7" /></Svg>;
export const ChatIcon = (p) => <Svg {...p}><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></Svg>;
export const MinimizeIcon = (p) => <Svg {...p}><path d="M5 19h14" /><path d="M9 9l6 6M15 9.5V15H9.5" /></Svg>;
export const ExpandIcon = (p) => <Svg {...p}><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></Svg>;
export const BasketIcon = (p) => <Svg {...p}><path d="M3 10h18l-1.6 8.4a2 2 0 0 1-2 1.6H6.6a2 2 0 0 1-2-1.6z" /><path d="m8 10 4-6 4 6M9 14v2.5M12 14v2.5M15 14v2.5" /></Svg>;
export const ReceiptIcon = (p) => <Svg {...p}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></Svg>;
/** Folded hands (namaste) for the Daily Help assistant. */
export const HelpHandsIcon = (p) => <Svg {...p}><path d="M12 4c-1.3 1.6-2.2 4-2.2 6.6v3.2L6 17.6a1.4 1.4 0 0 0 0 2L7.4 21H12" /><path d="M12 4c1.3 1.6 2.2 4 2.2 6.6v3.2l3.8 3.8a1.4 1.4 0 0 1 0 2L16.6 21H12" /><path d="M12 4v17" /></Svg>;
export const MoonIcon = (p) => <Svg {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></Svg>;
export const SunIcon = (p) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>;
/* ---------- Shop categories ---------- */
export const MilkIcon = (p) => <Svg {...p}><path d="M9 2h6M10 2v3L8 8.5V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8.5L14 5V2" /><path d="M8 13h8" /></Svg>;
export const BreadIcon = (p) => <Svg {...p}><path d="M6 11a4 4 0 1 1 0-8h12a4 4 0 1 1 0 8v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" /><path d="m10 8-1.5 2.5M14 8l-1.5 2.5" /></Svg>;
export const AppleIcon = (p) => <Svg {...p}><path d="M12 7.5c-1.6-1.3-3.6-1.5-5.1-.5C4 9 4.6 14.4 7 18.2c1.3 2 3 3 5 2.1 2 .9 3.7-.1 5-2.1 2.4-3.8 3-9.2.1-11.2-1.5-1-3.5-.8-5.1.5z" /><path d="M12 7.5c0-2.2 1-4 3-5" /></Svg>;
export const CookieIcon = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8.5 9h.01M14.5 8h.01M15.5 13.5h.01M10 15.5h.01M12 11.5h.01" strokeWidth="2.6" /></Svg>;
export const DrinkIcon = (p) => <Svg {...p}><path d="M6 8h12l-1.4 12.2a2 2 0 0 1-2 1.8H9.4a2 2 0 0 1-2-1.8z" /><path d="M5 8h14M13 8l1.6-6H18" /></Svg>;
export const BowlIcon = (p) => <Svg {...p}><path d="M3 12h18a9 9 0 0 1-18 0z" /><path d="M9 3c-1 1.5 1 2.5 0 4.5M14 3c-1 1.5 1 2.5 0 4.5" /></Svg>;
export const BagIcon = (p) => <Svg {...p}><path d="M5 8h14l-1 13H6z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></Svg>;

const CATEGORY_ICONS = {
  Dairy: MilkIcon,
  Bakery: BreadIcon,
  'Fruits & Veg': AppleIcon,
  Snacks: CookieIcon,
  Beverages: DrinkIcon,
  'Ready to eat': BowlIcon,
};
/** Line icon for a shop category (shopping bag for anything else). */
export const CategoryIcon = ({ category, ...p }) => {
  const Icon = CATEGORY_ICONS[category] || BagIcon;
  return <Icon {...p} />;
};

export const ArrowRightIcon =(p) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const ChevronDownIcon =(p) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>;
export const MicIcon = (p) => <Svg {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" /></Svg>;
export const SendIcon =(p) => <Svg {...p}><path d="M4 12 20 4l-6 16-3-7z" /></Svg>;
export const BellIcon =(p) => <Svg {...p}><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 21h4" /></Svg>;
