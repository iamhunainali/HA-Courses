import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from './api';

export const DEFAULT_MENU = [
  { id: 'home', label: 'Home', to: '/', show: false },
  { id: 'courses', label: 'Courses', to: '/courses', show: true },
  { id: 'reviews', label: 'Reviews', to: '/reviews', show: true },
];
// all=true: admin panel ke liye poori list; warna sirf jo show karni hain
export function parseMenu(s: string, all = false): any[] {
  let m: any[];
  try { m = JSON.parse(s); if (!Array.isArray(m)) throw 0; } catch { m = DEFAULT_MENU; }
  return all ? m : m.filter((x) => x.show);
}

export const DEFAULTS: any = {
  siteName: 'Learning Portal', tagline: 'Learn at your own pace', footerText: 'All rights reserved.',
  coursesTitle: 'Courses', reviewsTitle: 'What students say', contactEmail: '', brandColor: '#0f6b5c', currency: 'Rs',
  headerShowCategories: 'true', headerMenu: JSON.stringify(DEFAULT_MENU),
};
const Ctx = createContext<any>({ settings: DEFAULTS, reload: () => {} });
export const useSettings = () => useContext(Ctx);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<any>(DEFAULTS);
  const reload = () => api('/settings').then((s) => {
    const clean: any = {};
    Object.keys(s).forEach((k) => { if (s[k] !== '') clean[k] = s[k]; }); // khali value par default
    setSettings({ ...DEFAULTS, ...clean });
  }).catch(() => {});
  useEffect(() => { reload(); }, []);
  useEffect(() => {
    document.title = settings.siteName;
    const r = document.documentElement.style;
    r.setProperty('--brand', settings.brandColor);
    r.setProperty('--brand2', `color-mix(in srgb, ${settings.brandColor} 80%, black)`);
  }, [settings]);
  return <Ctx.Provider value={{ settings, reload }}>{children}</Ctx.Provider>;
}
