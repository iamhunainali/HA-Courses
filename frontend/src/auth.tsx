import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, token } from './api';

const Ctx = createContext<any>(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token()) { setReady(true); return; }
    // Refresh par logout nahi: server restart / network error par dobara try karta hai
    let tries = 0, stop = false;
    const run = () => api('/auth/me').then((u) => { if (!stop) { setUser(u); setReady(true); } }).catch((e: any) => {
      if (e.status === 401 || e.status === 403) { localStorage.removeItem('token'); if (!stop) setReady(true); }
      else if (++tries < 6) setTimeout(run, 1500);
      else if (!stop) setReady(true);
    });
    run();
    return () => { stop = true; };
  }, []);

  useEffect(() => {
    const h = () => { localStorage.removeItem('token'); setUser(null); };
    window.addEventListener('suspended', h);
    return () => window.removeEventListener('suspended', h);
  }, []);

  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => api('/auth/ping', { method: 'POST' }).catch(() => {}), 45000);
    return () => clearInterval(t);
  }, [user]);

  const finish = (d: any) => { localStorage.setItem('token', d.token); setUser(d.user); return d.user; };
  const login = async (email: string, password: string) => finish(await api('/auth/login', { method: 'POST', body: { email, password } }));
  const signup = async (name: string, email: string, password: string) => finish(await api('/auth/signup', { method: 'POST', body: { name, email, password } }));
  const logout = () => { api('/auth/logout', { method: 'POST' }).catch(() => {}); localStorage.removeItem('token'); setUser(null); };

  return <Ctx.Provider value={{ user, ready, login, signup, logout }}>{children}</Ctx.Provider>;
}
