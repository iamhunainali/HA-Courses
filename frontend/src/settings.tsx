import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from './api';

export const DEFAULTS: any = {
  siteName: 'Learning Portal', tagline: 'Learn at your own pace', footerText: 'All rights reserved.',
  coursesTitle: 'Courses', reviewsTitle: 'What students say', contactEmail: '', brandColor: '#0f6b5c',
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
