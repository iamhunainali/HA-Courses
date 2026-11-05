import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, media } from '../api';
import { useAuth } from '../auth';
import { notifyEnrolled } from '../enroll';

export default function CourseDetail() {
  const { id } = useParams();
  const { user, ready } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [c, setC] = useState<any>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [err, setErr] = useState('');

  const doEnroll = async () => { await api(`/courses/${id}/enroll`, { method: 'POST' }); setEnrolled(true); notifyEnrolled(); };

  useEffect(() => { api(`/courses/${id}`).then(setC).catch((e) => setErr(e.message)); }, [id]);
  useEffect(() => {
    if (!ready || !user) { setEnrolled(false); return; }
    api('/my/enrollments').then(async (r) => {
      const has = r.some((x: any) => x.id === id);
      setEnrolled(has);
      // login/signup ke baad auto-enroll
      if (!has && sp.get('enroll') === '1') { await doEnroll(); nav(`/course/${id}`, { replace: true }); }
    });
  }, [user, ready, id]);

  const click = async () => {
    if (!user) return nav(`/login?next=${encodeURIComponent(`/course/${id}?enroll=1`)}`);
    try { await doEnroll(); } catch (e: any) { setErr(e.message); }
  };

  if (err && !c) return <div className="page"><p className="err">{err}</p></div>;
  if (!c) return <div className="page">Loading…</div>;
  return (
    <div className="page detail">
      <div className="dthumb">{c.thumbnail ? <img src={media(c.thumbnail)} alt="" /> : <span>{c.title[0]}</span>}</div>
      <div>
        {c.category && <small className="tag">{c.category.name}</small>}
        <h1>{c.title}</h1>
        <p className="desc">{c.description}</p>
        <p className="muted">{c._count.lessons} videos · {c._count.enrollments} students enrolled{c.price > 0 ? ` · Rs ${c.price}` : ' · Free'}</p>
        {err && <p className="err">{err}</p>}
        {enrolled ? (
          <div className="row"><span className="ok">You are enrolled</span><Link className="btn" to={`/dashboard?course=${id}`}>Open in dashboard</Link></div>
        ) : (
          <button className="btn big" onClick={click}>Enroll Now</button>
        )}
      </div>
    </div>
  );
}
