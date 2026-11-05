import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, media, token } from '../api';
import VideoPlayer from '../components/VideoPlayer';

const daysLeft = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
const expiry = (c: any) => {
  const e = c.enrollment;
  if (!e?.expiresAt) return c.plan === 'PREMIUM' ? 'Lifetime access' : 'Free · no expiry';
  if (e.expired) return 'Expired';
  return `Expires ${new Date(e.expiresAt).toLocaleDateString()} · ${daysLeft(e.expiresAt)} days left`;
};

// Enrolled courses + expiry + admin ka upload kiya hua video/notes
export default function Dashboard() {
  const [sp, setSp] = useSearchParams();
  const [courses, setCourses] = useState<any[] | null>(null);
  const [pays, setPays] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[] | null>(null);
  const [cur, setCur] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => { api('/my/enrollments').then(setCourses); api('/my/payments').then(setPays).catch(() => {}); }, []);
  const courseId = sp.get('course') || courses?.[0]?.id;
  const course = courses?.find((c) => c.id === courseId);
  const expired = !!course?.enrollment?.expired;

  useEffect(() => {
    if (!courseId || expired) { setLessons(null); return; }
    setLessons(null); setCur(0); setErr('');
    api(`/my/courses/${courseId}/lessons`).then(setLessons).catch((e) => setErr(e.message));
  }, [courseId, expired]);

  if (courses === null) return <div className="page">Loading…</div>;
  const open = pays.filter((p) => p.status === 'PENDING');
  if (courses.length === 0 && open.length === 0)
    return <div className="page"><h1>My dashboard</h1><p className="muted">You have not enrolled in any course yet. <Link to="/courses">Browse courses</Link></p></div>;

  const l = lessons?.[cur];
  return (
    <div className="page">
      <h1>My dashboard</h1>
      {open.map((p) => (
        <div className="card notice" key={p.id}>
          ⏳ Payment request for <b>{p.course.title}</b> is under review. <Link to={`/checkout/${p.courseId}`}>View status and timer</Link>
        </div>
      ))}
      {courses.length > 0 && <h3>Enrolled courses</h3>}
      <div className="mycourses">
        {courses.map((c) => (
          <button key={c.id} className={'mycourse' + (c.id === courseId ? ' on' : '')} onClick={() => setSp({ course: c.id })}>
            <span className="mt">{c.thumbnail && <img src={media(c.thumbnail)} alt="" />}</span>
            <span><b>{c.title}</b><br /><small className="muted">{c._count?.lessons ?? 0} videos</small><br />
              <small className={c.enrollment?.expired ? 'err' : 'ok'}>{expiry(c)}</small></span>
          </button>
        ))}
      </div>
      {course && <h2>{course.title}</h2>}
      {expired && (
        <div className="card notice">Your access to this course has expired. <Link className="btn sm" to={`/checkout/${course.id}`}>Renew access</Link></div>
      )}
      {err && <p className="err">{err}</p>}
      {!expired && !err && course && lessons === null && <p>Loading…</p>}
      {lessons && lessons.length === 0 && <p className="muted">The instructor has not uploaded any content for this course yet.</p>}
      {l && (
        <div className="learn" style={{ padding: 0 }}>
          <div className="main">
            <VideoPlayer key={l.id} src={`/api/stream/${l.id}?token=${token()}`} />
            <h3>{l.title}</h3>
            {l.files.length > 0 && (
              <div className="files">
                {l.files.map((f: any) => <a key={f.id} href={`/api/files/${f.id}?token=${token()}`} className="file">📎 {f.name}</a>)}
              </div>
            )}
          </div>
          {lessons!.length > 1 && (
            <aside className="side">
              {lessons!.map((x, k) => <button key={x.id} className={k === cur ? 'on' : ''} onClick={() => setCur(k)}>{k + 1}. {x.title}</button>)}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
