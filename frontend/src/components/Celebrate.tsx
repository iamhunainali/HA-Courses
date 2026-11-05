import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, media } from '../api';
import { useAuth } from '../auth';

// Course ka access pehli dafa milne par congratulation popup
export default function Celebrate() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [queue, setQueue] = useState<any[]>([]);
  const bits = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    e: ['🎉', '✨', '🎊', '⭐'][i % 4], left: Math.random() * 100, delay: Math.random() * 2, dur: 2.5 + Math.random() * 2.5,
  })), []);

  const load = () => { if (user) api('/my/celebrations').then(setQueue).catch(() => {}); else setQueue([]); };
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    window.addEventListener('enrolled-changed', load);
    return () => { clearInterval(t); window.removeEventListener('enrolled-changed', load); };
  }, [user]);

  const cur = queue[0];
  if (!cur) return null;
  const close = async (go?: boolean) => {
    await api(`/my/celebrations/${cur.id}/seen`, { method: 'POST' }).catch(() => {});
    setQueue(queue.slice(1));
    window.dispatchEvent(new Event('enrolled-changed'));
    if (go) nav(`/dashboard?course=${cur.courseId}`);
  };
  return (
    <div className="modal-back">
      <div className="modal celebrate">
        <div className="confetti">{bits.map((b, i) => <span key={i} style={{ left: b.left + '%', animationDelay: b.delay + 's', animationDuration: b.dur + 's' }}>{b.e}</span>)}</div>
        <div className="bigemoji">🎉</div>
        <h2>Congratulations!</h2>
        <p>You now have access to</p>
        {cur.course.thumbnail && <img className="cthumb" src={media(cur.course.thumbnail)} alt="" />}
        <h3>{cur.course.title}</h3>
        {cur.expiresAt && <p className="muted">Access until {new Date(cur.expiresAt).toLocaleDateString()}</p>}
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={() => close(true)}>Start learning</button>
          <button className="btn ghost" onClick={() => close()}>Close</button>
        </div>
      </div>
    </div>
  );
}
