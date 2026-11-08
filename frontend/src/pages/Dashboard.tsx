import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, media } from '../api';
import { useAuth } from '../auth';

const daysLeft = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
const expiry = (c: any) => {
  const e = c.enrollment;
  if (e.revoked) return 'Access ended by admin';
  if (!e.expiresAt) return c.plan === 'PREMIUM' ? 'Lifetime access' : 'Free · no expiry';
  if (e.expired) return 'Expired';
  return `Expires ${new Date(e.expiresAt).toLocaleDateString()} · ${daysLeft(e.expiresAt)} days left`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<any[] | null>(null);
  const [pays, setPays] = useState<any[]>([]);
  useEffect(() => { api('/my/enrollments').then(setCourses); api('/my/payments').then(setPays).catch(() => {}); }, []);
  if (courses === null) return <div className="page">Loading…</div>;
  const open = pays.filter((p) => p.status === 'PENDING');
  const active = courses.filter((c) => !c.enrollment.expired && !c.enrollment.revoked);
  const lectures = active.reduce((n, c) => n + c.enrollment.completed, 0);

  return (
    <div className="page">
      <div className="welcome">
        <div><h1>Hello, {user?.name?.split(' ')[0]} 👋</h1><p className="muted">Continue where you left off.</p></div>
        <div className="mini-stats"><div><b>{active.length}</b><small>Active courses</small></div><div><b>{lectures}</b><small>Lectures completed</small></div></div>
      </div>
      {open.map((p) => (
        <div className="card notice" key={p.id}>⏳ Payment request for <b>{p.course.title}</b> is under review. <Link to={`/checkout/${p.courseId}`}>View status and timer</Link></div>
      ))}
      {courses.length === 0 ? <p className="muted">You have not enrolled in any course yet. <Link to="/courses">Browse courses</Link></p> : (
        <div className="grid">
          {courses.map((c) => {
            const blocked = c.enrollment.expired || c.enrollment.revoked;
            const total = c._count?.lessons || 0;
            const pct = total ? Math.round((c.enrollment.completed / total) * 100) : 0;
            return (
              <div className="ccard" key={c.id}>
                <div className="thumb">{c.thumbnail ? <img src={media(c.thumbnail)} alt="" /> : <span>{c.title[0]}</span>}</div>
                <div className="cbody">
                  <div className="row">{blocked ? <small className="tag exp">Expired</small> : c.plan === 'PREMIUM' ? <small className="tag buy">Purchased</small> : <small className="tag">Free</small>}</div>
                  <h3>{c.title}</h3>
                  <small className={blocked ? 'err' : 'ok'}>{expiry(c)}</small>
                  <div className="pbar" style={{ margin: '10px 0 4px' }}><i style={{ width: pct + '%' }} /></div>
                  <small className="muted">{c.enrollment.completed}/{total} lectures · {pct}%</small>
                </div>
                <div className="cfoot">
                  {blocked ? <Link className="btn sm" to={`/checkout/${c.id}`}>{c.enrollment.revoked ? 'Pay again to re-enroll' : 'Renew access'}</Link>
                    : <Link className="btn sm" to={`/learn/${c.id}`}>{pct > 0 ? 'Continue' : 'Start'}</Link>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
