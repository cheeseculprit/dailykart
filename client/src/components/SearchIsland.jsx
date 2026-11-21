import { useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { SearchIcon, XIcon } from './icons.jsx';

// Springy enough to overshoot a little, like Apple's Dynamic Island.
const POP = { type: 'spring', stiffness: 380, damping: 26, mass: 0.9 };

/**
 * Search bar that fills the space it is given and pops (Dynamic-Island style)
 * to a new width when that space changes. The header shrinks its buttons while
 * the search is open, so the bar grows into the room they free up (see Navbar).
 * `onSettled` fires when the bar finishes moving.
 */
export default function SearchIsland({ open, width, onFocusChange, onSettled, value, onChange, onSubmit, placeholder }) {
  const input = useRef(null);
  const reduce = useReducedMotion();
  const roomy = width >= 96; // narrow bars show just the lens

  return (
    <motion.form
      role="search"
      onSubmit={(e) => { onSubmit(e); input.current?.blur(); }}
      onClick={() => input.current?.focus()}
      initial={false}
      animate={{ width, height: open ? 44 : 40 }}
      transition={reduce ? { duration: 0 } : POP}
      onAnimationComplete={onSettled}
      className={`relative flex shrink-0 cursor-text items-center overflow-hidden rounded-full bg-white transition-shadow duration-300 ${
        open ? 'shadow-pop ring-2 ring-maroon-600/25' : 'shadow-sm'
      }`}
    >
      <span className={`grid shrink-0 place-items-center text-maroon-600 ${open ? 'w-11' : roomy ? 'w-9 pl-1' : 'w-full'}`}>
        <SearchIcon className="h-[18px] w-[18px]" />
      </span>
      <input
        ref={input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => onFocusChange(true)}
        onBlur={() => onFocusChange(false)}
        onKeyDown={(e) => e.key === 'Escape' && input.current?.blur()}
        placeholder={placeholder}
        aria-label="Search products"
        enterKeyHint="search"
        // 16px text on phones: smaller text makes iPhones zoom the page when the field is tapped.
        className={`min-w-0 bg-transparent text-base ${open ? 'pr-3' : 'pr-2'} text-ink placeholder:text-ink-faint focus:outline-none sm:text-sm ${
          roomy || open ? 'flex-1' : 'w-0 opacity-0'
        }`}
      />
      {open && value && (
        <button
          type="button"
          aria-label="Clear search"
          // Keep focus in the field while pressing, then clear and close.
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => { e.stopPropagation(); onChange(''); input.current?.blur(); }}
          className="mr-2 grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-cream-deep"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </motion.form>
  );
}
