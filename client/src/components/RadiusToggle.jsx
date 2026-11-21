import { useLocation2 } from '../lib/location.jsx';

export const RADII = [500, 750, 1000];
/** 500 -> "500 m", 1000 -> "1 km" */
export const fmtRadius = (r) => (r >= 1000 ? `${r / 1000} km` : `${r} m`);

export default function RadiusToggle() {
  const { radius, setRadius } = useLocation2();
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-cream-line bg-white p-0.5" role="group" aria-label="Walking distance">
      {RADII.map((r) => (
        <button
          key={r}
          onClick={() => setRadius(r)}
          aria-pressed={radius === r}
          className={`whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold transition ${radius === r ? 'bg-maroon-600 text-white' : 'text-ink-soft hover:text-ink'}`}
        >
          {fmtRadius(r)}
        </button>
      ))}
    </div>
  );
}
