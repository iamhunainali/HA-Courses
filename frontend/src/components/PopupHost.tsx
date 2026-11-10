import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import PopupView from './PopupView';

// Admin ke popups: audience aur frequency server filter karta hai, yahan sirf dikhaya jata hai
export default function PopupHost() {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [queue, setQueue] = useState<any[]>([]);
  const [cur, setCur] = useState<any>(null);

  useEffect(() => {
    setCur(null);
    if (!user || user.role === 'SUPER_ADMIN') { setQueue([]); return; }
    api('/popups/active').then(setQueue).catch(() => {});
  }, [user?.id]);

  const pageOk = (p: any) => p.pages === 'all' || (p.pages === 'home' && loc.pathname === '/') || (p.pages === 'dashboard' && loc.pathname.startsWith('/dashboard')) || (p.pages === 'courses' && loc.pathname.startsWith('/courses'));
  useEffect(() => {
    if (cur || !queue.length) return;
    const next = queue.find(pageOk);
    if (!next) return;
    const t = setTimeout(() => {
      setCur(next);
      setQueue((q) => q.filter((x) => x.id !== next.id));
      api(`/popups/${next.id}/seen`, { method: 'POST' }).catch(() => {});
    }, (next.delaySec || 0) * 1000);
    return () => clearTimeout(t);
  }, [queue, cur, loc.pathname]);

  useEffect(() => {
    const s = Number(cur?.style?.autoClose) || 0;
    if (!cur || !s) return;
    const t = setTimeout(() => setCur(null), s * 1000);
    return () => clearTimeout(t);
  }, [cur]);

  if (!cur) return null;
  const act = () => {
    const l = cur.buttonLink;
    setCur(null);
    if (!l) return;
    if (/^https?:/.test(l)) window.open(l, '_blank'); else nav(l);
  };
  return <PopupView p={cur} onClose={() => setCur(null)} onAction={act} />;
}
