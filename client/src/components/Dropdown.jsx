import { useEffect, useId, useRef, useState } from 'react';
import { CheckIcon, ChevronDownIcon } from './icons.jsx';

/**
 * Themed replacement for <select>: a pill button that opens a small menu.
 * options: [[value, label], ...]. Keyboard: arrows, Home/End, Enter/Space, Esc, Tab.
 */
export default function Dropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef(null);
  const button = useRef(null);
  const list = useRef(null);
  const id = useId();
  const index = Math.max(0, options.findIndex(([v]) => v === value));
  const current = options[index]?.[1];
  const changed = index !== 0; // highlight when not on the default choice

  const show = () => { setActive(index); setOpen(true); };
  const pick = (i) => { onChange(options[i][0]); setOpen(false); button.current?.focus(); };

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const out = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, [open]);

  useEffect(() => { if (open) list.current?.focus(); }, [open]);

  const onButtonKey = (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(); }
  };
  const onListKey = (e) => {
    const last = options.length - 1;
    const keys = {
      ArrowDown: () => setActive((a) => Math.min(last, a + 1)),
      ArrowUp: () => setActive((a) => Math.max(0, a - 1)),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => pick(active),
      ' ': () => pick(active),
      Escape: () => { setOpen(false); button.current?.focus(); },
      Tab: () => setOpen(false),
    };
    if (keys[e.key]) { if (e.key !== 'Tab') e.preventDefault(); keys[e.key](); }
  };

  return (
    <div ref={box} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current}`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onButtonKey}
        className={`chip gap-2 py-2 pl-4 pr-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron-300 ${
          changed ? 'border-maroon-600 text-maroon-600' : 'hover:bg-saffron-50'
        } ${open ? 'border-maroon-600 ring-2 ring-maroon-100' : ''}`}
      >
        <span className="text-ink-faint">{label}:</span>
        <span className="font-semibold">{current}</span>
        <ChevronDownIcon className={`h-4 w-4 text-ink-soft transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          ref={list}
          id={id}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onListKey}
          className="menu-pop absolute left-0 top-full z-30 mt-2 min-w-full overflow-hidden rounded-2xl border border-cream-line bg-white p-1.5 shadow-pop focus:outline-none"
        >
          {options.map(([v, text], i) => {
            const selected = i === index;
            return (
              <li
                key={v}
                id={`${id}-${i}`}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(i)}
                className={`flex cursor-pointer items-center justify-between gap-4 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors ${
                  selected ? 'bg-maroon-600 font-semibold text-white' : i === active ? 'bg-saffron-50 text-ink' : 'text-ink'
                }`}
              >
                {text}
                <CheckIcon className={`h-4 w-4 ${selected ? 'opacity-100' : 'opacity-0'}`} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
