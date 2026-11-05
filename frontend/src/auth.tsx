import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, token } from './api';

const Ctx = createContext<any>(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token()) { setReady(true); return; }
    api('/auth/me').then(setUser).catch(() => localStorage.removeItem('token')).finally(() => setReady(true));
  }, []);

  const finish = (d: any) => { localStorage.setItem('token', d.token); setUser(d.user); return d.user; };
  const login = async (email: string, password: string) => finish(await api('/auth/login', { method: 'POST', body: { email, password } }));
  const signup = async (name: string, email: string, password: string) => finish(await api('/auth/signup', { method: 'POST', body: { name, email, password } }));
  const logout = () => { localStorage.removeItem('token'); setUser(null); };

  return <Ctx.Provider value={{ user, ready, login, signup, logout }}>{children}</Ctx.Provider>;
}
