import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';

// Google's own "Sign in with Google" button (Google Identity Services). The client ID
// comes from /api/config, so the server's GOOGLE_CLIENT_ID is the only setting needed.
let configPromise;
const getClientId = () =>
  (configPromise ||= Promise.resolve(
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    api('/config').then((c) => c.googleClientId).catch(() => null)
  ));

let scriptPromise;
const loadGis = () => (scriptPromise ||= new Promise((resolve, reject) => {
  if (window.google?.accounts?.id) return resolve();
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  s.onload = resolve;
  s.onerror = () => { scriptPromise = null; reject(new Error('Could not load Google sign-in')); };
  document.head.appendChild(s);
}));

// Google allows one initialize per page, so the latest button's handler is kept here.
let onCredential = () => {};
let initializedFor = null;

/** Renders "Continue with Google"; calls onToken(credential) when the user picks an account. Hidden if not set up. */
export default function GoogleButton({ onToken, disabled }) {
  const box = useRef(null);
  const [state, setState] = useState('loading'); // loading | ready | off | error

  onCredential = (resp) => resp?.credential && onToken(resp.credential);

  useEffect(() => {
    let live = true;
    (async () => {
      const clientId = await getClientId();
      if (!clientId) return live && setState('off');
      try { await loadGis(); } catch { return live && setState('error'); }
      if (!live || !box.current) return;
      if (initializedFor !== clientId) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp) => onCredential(resp),
          ux_mode: 'popup',
          context: 'signin',
        });
        initializedFor = clientId;
      }
      const dark = document.documentElement.classList.contains('dark');
      box.current.innerHTML = '';
      window.google.accounts.id.renderButton(box.current, {
        type: 'standard', theme: dark ? 'filled_black' : 'outline', size: 'large',
        text: 'continue_with', shape: 'pill', logo_alignment: 'center',
        width: Math.min(400, Math.max(220, box.current.offsetWidth || 320)),
      });
      setState('ready');
    })();
    return () => { live = false; };
  }, []);

  if (state === 'off') return null;
  return (
    <div>
      <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
        <span className="h-px flex-1 bg-cream-line" />or<span className="h-px flex-1 bg-cream-line" />
      </div>
      <div className={`flex min-h-11 justify-center ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
        <div ref={box} className="w-full max-w-[400px] [&>div]:mx-auto" />
      </div>
      {state === 'error' && <p className="mt-2 text-center text-xs text-ink-soft">Google sign-in couldn't load. Check your connection, or use email and password.</p>}
    </div>
  );
}
