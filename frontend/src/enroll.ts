import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api';
import { useAuth } from './auth';

export const notifyEnrolled = () => window.dispatchEvent(new Event('enrolled-changed'));

// Enrolled courses + "Enroll Now" action. Login na ho to login/signup, phir wapis aa kar auto-enroll.
export function useEnrollment() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [ids, setIds] = useState<string[]>([]);

  const load = () => {
    if (!user) return setIds([]);
    api('/my/enrollments').then((r) => setIds(r.filter((c: any) => !c.enrollment?.expired).map((c: any) => c.id))).catch(() => {});
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
  return { enroll, enrolled: (id: string) => ids.includes(id) };
}
