import { useEffect, useRef, useState } from 'react';

const BENGALURU = { lat: 12.9716, lng: 77.5946 };
const same = (a, b) => a && b && Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;

/**
 * Map with a pin fixed in the middle. Drag the map (or tap a spot) to put the
 * pin on the exact building; onChange({ lat, lng }) fires when the map stops.
 * value: { lat, lng } or null. start: where to open when there is no value yet.
 * Leaflet + OpenStreetMap tiles are loaded only when this map is shown.
 */
export default function MapPinPicker({ value, start, onChange }) {
  const box = useRef(null);
  const map = useRef(null);
  const last = useRef(value);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [moving, setMoving] = useState(false);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')])
      .then(([mod]) => {
        if (cancelled || !box.current) return;
        const L = mod.default || mod;
        const at = value || start || BENGALURU;
        const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([at.lat, at.lng], value ? 18 : start ? 16 : 13);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
        }).addTo(m);
        // Only a drag, a tap or arrow keys place the pin. Zooming, resizing or
        // our own jumps ("Find my address") move the map without choosing a spot.
        let byPerson = false;
        m.on('dragstart', () => { byPerson = true; });
        m.on('click', (e) => { byPerson = true; m.panTo(e.latlng); });
        box.current.addEventListener('keydown', (e) => { if (e.key.startsWith('Arrow')) byPerson = true; });
        m.on('movestart', () => setMoving(true));
        m.on('moveend', () => {
          setMoving(false);
          if (!byPerson) return;
          byPerson = false;
          const c = m.getCenter();
          const next = { lat: Number(c.lat.toFixed(6)), lng: Number(c.lng.toFixed(6)) };
          if (same(next, last.current)) return;
          last.current = next;
          changeRef.current(next);
        });
        map.current = m;
        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Find on map" / "I'm at my shop" move the map to the new spot.
  useEffect(() => {
    const m = map.current;
    if (!m || !value || same(value, last.current)) return;
    last.current = { lat: Number(value.lat.toFixed(6)), lng: Number(value.lng.toFixed(6)) };
    m.setView([last.current.lat, last.current.lng], Math.max(m.getZoom(), 17), { animate: false });
  }, [value, ready]);

  if (failed) return <p className="rounded-lg bg-cream-deep p-3 text-xs text-ink-soft">The map couldn't load. Use "Find my address" or "I'm at my shop" instead.</p>;

  return (
    <div className="relative isolate z-0 h-56 overflow-hidden rounded-lg border border-cream-line bg-cream-deep sm:h-64">
      <div ref={box} className="map-pick h-full w-full" role="application" aria-label="Map. Drag it so the pin sits on your shop." />
      {!ready && <div className="absolute inset-0 grid place-items-center text-xs text-ink-soft">Loading map…</div>}

      {/* The pin stays in the centre; the map moves under it. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full">
        <svg viewBox="0 0 24 32" className={`h-10 w-8 drop-shadow-md transition-transform duration-150 ${moving ? '-translate-y-2' : ''}`} aria-hidden="true">
          <path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0z" className={value ? 'fill-maroon-600' : 'fill-ink-faint'} />
          <circle cx="12" cy="12" r="4.5" fill="white" />
        </svg>
      </div>
      <span className={`pointer-events-none absolute left-1/2 top-1/2 z-[499] h-1.5 w-3 -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-black/30 transition-opacity ${moving ? 'opacity-100' : 'opacity-60'}`} />

      {ready && !value && (
        <p className="pointer-events-none absolute inset-x-2 bottom-6 z-[500] rounded-md bg-shade/75 px-2.5 py-1.5 text-center text-[11px] font-medium text-white">
          Drag the map so the pin sits on your shop
        </p>
      )}
    </div>
  );
}
