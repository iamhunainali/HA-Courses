import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api';
import { useAuth } from './auth';

export const notifyEnrolled = () => window.dispatchEvent(new Event('enrolled-changed'));

// Active enrollments + "renew" (expire ya admin ne terminate kiya) + Enroll Now action
export function useEnrollment() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [ids, setIds] = useState<string[]>([]);
  const [renewIds, setRenewIds] = useState<string[]>([]);

  const load = () => {
    if (!user) { setIds([]); setRenewIds([]); return; }
    api('/my/enrollments').then((r) => {
      const blocked = (c: any) => c.enrollment?.expired || c.enrollment?.revoked;
      setIds(r.filter((c: any) => !blocked(c)).map((c: any) => c.id));
      setRenewIds(r.filter(blocked).map((c: any) => c.id));
    }).catch(() => {});
  };
  useEffect(() => {
    load();
    window.addEventListener('enrolled-changed', load);
    return () => window.removeEventListener('enrolled-changed', load);
  }, [user]);

  const enroll = async (courseId: string) => {
    if (!user) return nav(`/login?next=${encodeURIComponent(`/course/${courseId}?enroll=1`)}`);
    try { await api(`/courses/${courseId}/enroll`, { method: 'POST' }); notifyEnrolled(); } catch (e: any) { alert(e.message); }
  };
  return { enroll, enrolled: (id: string) => ids.includes(id), renew: (id: string) => renewIds.includes(id) };
}
