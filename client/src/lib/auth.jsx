import { createContext, useContext, useState, useCallback } from 'react';
import { api, tokenStore } from './api.js';

const AuthCtx = createContext(null);
const USER_KEY = 'dailycart.user';

function loadUser() {
  try {
    return tokenStore.get() ? JSON.parse(sessionStorage.getItem(USER_KEY)) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);

  const save = useCallback(({ token, user }) => {
    tokenStore.set(token);
    try { sessionStorage.setItem(USER_KEY, JSON.stringify(user)); } catch {}
    setUser(user);
    return user;
  }, []);

  const login = (email, password, role) => api('/auth/login', { method: 'POST', body: { email, password, role } }).then(save);
  const register = (payload) => api('/auth/register', { method: 'POST', body: payload }).then(save);
  const googleLogin = (credential, role) => api('/auth/google', { method: 'POST', body: { credential, role } }).then(save);
  const logout = () => {
    tokenStore.set(null);
    try { sessionStorage.removeItem(USER_KEY); } catch {}
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, login, register, googleLogin, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
