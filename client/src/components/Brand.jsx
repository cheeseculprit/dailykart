import { useState } from 'react';

export function Logo({ light = false, small = false, taglineFromSm = false }) {
  return (
    <span className="inline-flex flex-col leading-none">
      <span className={`font-brand ${small ? 'text-2xl' : 'text-3xl'} ${light ? 'text-white' : 'text-maroon-600'}`}>Dailykart</span>
      <span className={`mt-0.5 text-[10px] font-medium tracking-wide ${light ? 'text-white/90' : 'text-ink-soft'} ${taglineFromSm ? 'hidden sm:block' : ''}`}>
        Shopping Nayi, Bharosa Wahi!
      </span>
    </span>
  );
}

/** Just the "D" of the logo, for when the header is squeezed. */
export function LogoMark() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-maroon-600 font-brand text-xl leading-none text-white shadow-sm" aria-label="Dailykart">
      D
    </span>
  );
}

/**
 * The turbaned mascot from the Figma file. Export it from Figma as PNG
 * (transparent background) and save it as client/public/mascot.png.
 * Until then a simple stand-in is shown.
 */
export function Mascot({ className = 'h-56' }) {
  const [missing, setMissing] = useState(false);
  if (missing) {
    return (
      <div className={`${className} grid aspect-[3/4] place-items-center`} aria-hidden="true">
        <span className="text-[7rem] leading-none">🙏</span>
      </div>
    );
  }
  return <img src="/mascot.png" alt="" onError={() => setMissing(true)} className={`${className} w-auto object-contain`} />;
}

/** The mascot inside the arch frame used on the login screens. */
export function ArchMascot() {
  return (
    // Grows with the screen height (up to 32rem) so the slogan below stays in view.
    <div className="relative mx-auto flex aspect-[7/9] h-[min(32rem,50vh)] min-h-72 items-end justify-center overflow-hidden rounded-t-full border-2 border-white/80 bg-saffron-300/40">
      <Mascot className="h-[92%]" />
    </div>
  );
}
