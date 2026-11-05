import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, media } from '../api';
import { useAuth } from '../auth';
import { notifyEnrolled } from '../enroll';
import { useSettings } from '../settings';

export default function CourseDetail() {
  const { id } = useParams();
  const { user, ready } = useAuth();
  const { settings } = useSettings();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [c, setC] = useState<any>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [expired, setExpired] = useState(false);
  const [err, setErr] = useState('');

  const doEnroll = async () => { await api(`/courses/${id}/enroll`, { method: 'POST' }); setEnrolled(true); notifyEnrolled(); };

  useEffect(() => { api(`/courses/${id}`).then(setC).catch((e) => setErr(e.message)); }, [id]);
  useEffect(() => {
    if (!ready || !user) { setEnrolled(false); return; }
    api('/my/enrollments').then(async (r) => {
      const mine = r.find((x: any) => x.id === id);
      setEnrolled(!!mine && !mine.enrollment.expired);
      setExpired(!!mine && mine.enrollment.expired);
      if (!mine && sp.get('enroll') === '1' && c && c.plan !== 'PREMIUM') { await doEnroll(); nav(`/course/${id}`, { replace: true }); }
    });
  }, [user, ready, id, c]);

  const click = async () => {
    if (!user) return nav(`/login?next=${encodeURIComponent(`/course/${id}?enroll=1`)}`);
    try { await doEnroll(); } catch (e: any) { setErr(e.message); }
  };

  if (err && !c) return <div className="page"><p className="err">{err}</p></div>;
  if (!c) return <div className="page">Loading…</div>;
  const premium = c.plan === 'PREMIUM';
  return (
    <div className="page detail">
      <div className="dthumb">{c.thumbnail ? <img src={media(c.thumbnail)} alt="" /> : <span>{c.title[0]}</span>}</div>
      <div>
        <div className="row">
          {c.category && <small className="tag">{c.category.name}</small>}
          <small className={'tag ' + (premium ? 'warn' : '')}>{premium ? 'Premium plan' : 'Free plan'}</small>
        </div>
        <h1>{c.title}</h1>
        <p className="desc">{c.description}</p>
        <p className="muted">
          {c._count.lessons} videos · {c._count.enrollments} students enrolled
          {premium && ` · ${settings.currency} ${c.price} · ${c.durationDays ? c.durationDays + ' days access' : 'lifetime access'}`}
        </p>
        {err && <p className="err">{err}</p>}
        {enrolled ? (
          <div className="row"><span className="ok">You have access</span><Link className="btn" to={`/dashboard?course=${id}`}>Open in dashboard</Link></div>
        ) : premium ? (
          <Link className="btn big" to={`/checkout/${id}`}>{expired ? 'Renew access' : 'Buy now'} · {settings.currency} {c.price}</Link>
        ) : (
          <button className="btn big" onClick={click}>Enroll Now</button>
        )}
      </div>
    </div>
  );
}
