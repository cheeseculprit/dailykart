import { createContext, useContext, useEffect, useState } from 'react';

/**
 * Shared open/closed state for the floating pieces, so the dock, navbar and
 * footer can all open the Daily Help chat and the cart drawer.
 *   chat: 'closed' | 'popup' | 'docked'
 */
const MODE_KEY = 'dailycart.chatMode';
// Reopen minimized after a refresh; a full popup always starts closed.
const loadMode = () => { try { return sessionStorage.getItem(MODE_KEY) === 'docked' ? 'docked' : 'closed'; } catch { return 'closed'; } };

const UICtx = createContext(null);

export function UIProvider({ children }) {
  const [chat, setChat] = useState(loadMode);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => { try { sessionStorage.setItem(MODE_KEY, chat); } catch {} }, [chat]);

  const openChat = () => { setCartOpen(false); setChat((m) => (m === 'closed' ? 'popup' : m)); };
  const openCart = () => setCartOpen(true);

  return (
    <UICtx.Provider value={{ chat, setChat, openChat, cartOpen, setCartOpen, openCart }}>{children}</UICtx.Provider>
  );
}

export const useUI = () => useContext(UICtx);
