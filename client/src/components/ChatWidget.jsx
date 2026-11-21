import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useLocation2 } from '../lib/location.jsx';
import { useUI } from '../lib/ui.jsx';
import { ExpandIcon, HelpHandsIcon, MinimizeIcon, SendIcon, XIcon } from './icons.jsx';

const KEY = 'dailycart.chat';
const load = () => {
  try {
    const list = JSON.parse(sessionStorage.getItem(KEY)) || [];
    return list.filter((m) => !m.error);
  } catch {
    return [];
  }
};

const SUGGESTIONS = {
  customer: ["What's expiring soon near me?", 'How do I reserve items?', "Where's my order?"],
  shopkeeper: ['How do I add a product?', 'How do I complete a pickup?', 'How many reservations do I have?'],
};

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Daily Help chat with three states (opened from the dock or the footer):
 *  closed - hidden
 *  popup  - big window in the middle, page dimmed behind it
 *  docked - minimized: small window in the corner, rest of the site stays usable
 * The conversation lives in this tab only.
 */
export default function ChatWidget() {
  const { user } = useAuth();
  const { loc, radius } = useLocation2();
  const { chat: mode, setChat: setMode } = useUI();
  const [closing, setClosing] = useState(false);
  const [msgs, setMsgs] = useState(load);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-30))); } catch {} }, [msgs]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy, mode]);
  useEffect(() => { if (mode === 'popup') inputRef.current?.focus(); }, [mode]);

  // Play the pop-out animation, then hide the chat.
  const close = () => {
    if (closing) return;
    if (reduceMotion()) return setMode('closed');
    setClosing(true);
    setTimeout(() => { setMode('closed'); setClosing(false); }, 180);
  };

  // Only the full popup blocks the page: Esc closes it and the page can't scroll.
  useEffect(() => {
    if (mode !== 'popup') return;
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [mode]);

  const send = async (raw) => {
    const content = raw.trim();
    if (!content || busy) return;
    const next = [...msgs, { role: 'user', content }];
    setMsgs(next);
    setText('');
    setBusy(true);
    try {
      const { reply } = await api('/chat', {
        method: 'POST',
        body: {
          // Error notes are shown locally only, never sent to the model.
          messages: next.filter((m) => !m.error).slice(-12).map(({ role, content }) => ({ role, content })),
          lat: loc?.lat, lng: loc?.lng, radius,
        },
      });
      setMsgs((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', content: e.message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const tips = SUGGESTIONS[user?.role === 'shopkeeper' ? 'shopkeeper' : 'customer'];
  const docked = mode === 'docked';
  const iconBtn = 'grid h-8 w-8 place-items-center rounded-md hover:bg-white/10';

  const windowBox = (
    <section
      role="dialog"
      aria-modal={docked ? undefined : 'true'}
      aria-label="Daily Help"
      className={
        docked
          ? `fixed bottom-24 right-4 z-50 flex h-[min(58dvh,460px)] w-[min(calc(100vw-2rem),360px)] flex-col overflow-hidden rounded-2xl border border-cream-line bg-white shadow-pop sm:bottom-28 ${closing ? 'chat-window-out' : 'chat-dock'}`
          : `flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-card sm:h-[min(80vh,640px)] sm:max-w-lg sm:rounded-2xl ${closing ? 'chat-window-out' : 'chat-window'}`
      }
    >
      <header className="flex items-center justify-between gap-2 bg-maroon-600 px-4 py-3 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <HelpHandsIcon className="h-5 w-5 shrink-0" />
          <div className="min-w-0">
          <p className="font-bold leading-tight">Daily Help</p>
          {!docked && <p className="text-[11px] text-white/80">Ask about products, orders or how things work</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {msgs.length > 0 && (
            <button onClick={() => setMsgs([])} className="rounded-md px-2 py-1 text-xs text-white/80 hover:bg-white/10 hover:text-white">Clear</button>
          )}
          {docked ? (
            <button aria-label="Expand chat" title="Expand" onClick={() => setMode('popup')} className={iconBtn}>
              <ExpandIcon className="h-4 w-4" />
            </button>
          ) : (
            <button aria-label="Minimize chat" title="Minimize to corner" onClick={() => setMode('docked')} className={iconBtn}>
              <MinimizeIcon className="h-4 w-4" />
            </button>
          )}
          <button aria-label="Close chat" title="Close" onClick={close} className={iconBtn}>
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto bg-cream p-3 text-sm">
        {msgs.length === 0 && (
          <div className="space-y-3">
            <p className="rounded-xl bg-white p-3 text-ink-soft">
              Namaste{user ? `, ${user.name.split(' ')[0]}` : ''}! I'm Daily Help. I can find fresh items near you, check your pickups, or explain how DailyCart works.
            </p>
            <div className="flex flex-wrap gap-2">
              {tips.map((t) => (
                <button key={t} onClick={() => send(t)} className="rounded-full border border-saffron-400 bg-white px-3 py-1.5 text-xs font-semibold text-maroon-600 hover:bg-saffron-50">
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${
                m.role === 'user'
                  ? 'rounded-br-sm bg-maroon-600 text-white'
                  : m.error
                    ? 'rounded-bl-sm border border-maroon-100 bg-maroon-50 text-maroon-700'
                    : 'rounded-bl-sm bg-white text-ink'
              }`}
            >
              {m.content}
            </p>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <p className="rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-ink-faint">Thinking…</p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(text); }}
        className="flex items-center gap-2 border-t border-cream-line bg-white p-2"
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder="Type your question…"
          className="input flex-1"
        />
        <button type="submit" aria-label="Send" disabled={busy || !text.trim()} className="btn-primary h-10 w-10 shrink-0 p-0 disabled:opacity-40">
          <SendIcon className="h-4 w-4" />
        </button>
      </form>
    </section>
  );

  return (
    <>
      {mode === 'popup' && (
        <div
          className={`fixed inset-0 z-[60] flex items-end justify-center bg-shade/50 backdrop-blur-sm sm:items-center sm:p-4 ${closing ? 'chat-backdrop-out' : 'chat-backdrop'}`}
          onMouseDown={(e) => e.target === e.currentTarget && close()}
        >
          {windowBox}
        </div>
      )}

      {docked && windowBox}
    </>
  );
}
