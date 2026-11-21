import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useToast } from './Toast.jsx';
import { MicIcon } from './icons.jsx';

const MAX_SECS = 8;
// Chrome/Android record webm; iPhone Safari records mp4. Use the first one this browser can do.
const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

const VERB = {
  set: (c) => `you said ${c.qty} on the shelf`,
  add: (c) => `+${c.qty} arrived`,
  remove: (c) => `−${c.qty} sold or removed`,
};

/**
 * Shopkeeper speaks a stock update; we show what we understood and change
 * nothing until they confirm. Changes go through the same relative /adjust
 * call as the −/+ buttons, so a pickup reserved meanwhile is never overwritten.
 */
export default function VoiceStock({ onApplied }) {
  const toast = useToast();
  const [state, setState] = useState('idle'); // idle | recording | thinking | review | applying
  const [secs, setSecs] = useState(0);
  const [result, setResult] = useState(null);
  const [picked, setPicked] = useState({});
  const rec = useRef(null);
  const stream = useRef(null);
  const timer = useRef(null);

  const supported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && !!window.MediaRecorder;

  const release = () => {
    clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  // Leaving the page mid-recording: stop quietly (don't upload) and free the mic.
  useEffect(() => () => {
    const r = rec.current;
    if (r?.state === 'recording') { r.onstop = null; r.stop(); }
    release();
  }, []);

  const send = async (blob) => {
    if (blob.size < 1000) { toast('That was too short. Hold on and say the item and number.', 'error'); return setState('idle'); }
    setState('thinking');
    try {
      const r = await api('/shop/voice', { method: 'POST', body: blob });
      setResult(r);
      setPicked(Object.fromEntries(r.changes.filter((c) => c.delta !== 0).map((c) => [c.productId, true])));
      setState('review');
    } catch (e) {
      toast(e.message, 'error');
      setState('idle');
    }
  };

  const start = async () => {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      return toast('Allow microphone access to update stock by voice', 'error');
    }
    const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));
    const r = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined);
    const chunks = [];
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => { release(); send(new Blob(chunks, { type: (r.mimeType || mimeType || 'audio/webm').split(';')[0] })); };
    rec.current = r;
    r.start();
    setResult(null);
    setSecs(0);
    setState('recording');
    timer.current = setInterval(() => setSecs((s) => {
      if (s + 1 >= MAX_SECS && r.state === 'recording') r.stop();
      return s + 1;
    }), 1000);
  };

  const stop = () => { if (rec.current?.state === 'recording') rec.current.stop(); };

  const apply = async () => {
    const todo = result.changes.filter((c) => picked[c.productId] && c.delta !== 0);
    setState('applying');
    let done = 0;
    const failed = [];
    for (const c of todo) {
      try { await api(`/shop/products/${c.productId}/adjust`, { method: 'POST', body: { delta: c.delta } }); done++; }
      catch { failed.push(c.name); }
    }
    if (done) toast(`Stock updated for ${done} item${done === 1 ? '' : 's'}`, 'success');
    if (failed.length) toast(`Couldn't update ${failed.join(', ')}`, 'error');
    setResult(null);
    setState('idle');
    onApplied();
  };

  if (!supported) return null;
  const chosen = result ? result.changes.filter((c) => picked[c.productId] && c.delta !== 0).length : 0;

  return (
    <div>
      {state === 'recording' ? (
        <button onClick={stop} className="btn bg-maroon-600 px-4 py-2 text-white hover:bg-maroon-700" aria-live="polite">
          <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" /></span>
          Stop · 0:0{Math.min(secs, MAX_SECS)}
        </button>
      ) : (
        // Red-and-yellow "rainbow" button with a light glass shine (styles in index.css).
        <span className="rainbow-wrap">
          <span className="rainbow-glow" aria-hidden="true" />
          <button onClick={start} disabled={state === 'thinking' || state === 'applying'} className="btn rainbow-btn px-4 py-2">
            <MicIcon className="h-4 w-4" />
            <span>{state === 'thinking' ? 'Listening…' : 'Voice update'}</span>
          </button>
        </span>
      )}

      {state === 'recording' && (
        <p className="mt-2 text-xs text-ink-soft">Say the item and the number, e.g. “Paneer bees packet, 2 dahi bik gaye”. Tap Stop when done.</p>
      )}

      {result && (state === 'review' || state === 'applying') && (
        <div className="menu-pop mt-3 rounded-2xl border border-cream-line bg-cream p-4" role="dialog" aria-label="Confirm voice stock update">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">We heard</p>
          <p className="mt-1 text-sm italic">“{result.text || '…'}”</p>

          {result.changes.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">We couldn't match that to your items. Try again, saying the item name and a number.</p>
          ) : (
            <ul className="mt-3 divide-y divide-cream-line rounded-xl border border-cream-line bg-white">
              {result.changes.map((c) => (
                <li key={c.productId}>
                  <label className={`flex items-center gap-3 p-3 ${c.delta === 0 ? 'opacity-60' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-maroon-600"
                      disabled={c.delta === 0 || state === 'applying'}
                      checked={!!picked[c.productId]}
                      onChange={(e) => setPicked((p) => ({ ...p, [c.productId]: e.target.checked }))}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{c.name} <span className="font-normal text-ink-faint">{c.unit}</span></span>
                      <span className="block text-xs text-ink-soft">
                        {VERB[c.action](c)}
                        {c.action === 'set' && c.frozen > 0 && ` · ${c.frozen} held for pickups`}
                        {c.delta === 0 && ' · no change'}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-sm font-bold">
                      {c.stock} <span className="text-ink-faint">→</span> <span className={c.delta > 0 ? 'text-leaf-600' : c.delta < 0 ? 'text-maroon-600' : ''}>{c.newStock}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {result.unknown?.length > 0 && (
            <p className="mt-2 text-xs text-ink-soft">Not in your shop: {result.unknown.join(', ')}. Add them with “Add item” first.</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {chosen > 0 && (
              <button onClick={apply} disabled={state === 'applying'} className="btn-primary flex-1 py-2">
                {state === 'applying' ? 'Updating…' : `Update ${chosen} item${chosen === 1 ? '' : 's'}`}
              </button>
            )}
            <button onClick={start} disabled={state === 'applying'} className="btn-ghost py-2"><MicIcon className="h-4 w-4" />Try again</button>
            <button onClick={() => { setResult(null); setState('idle'); }} disabled={state === 'applying'} className="btn-ghost py-2">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
