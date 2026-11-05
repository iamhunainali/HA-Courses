import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, token } from '../api';
import VideoPlayer from '../components/VideoPlayer';

// Enrolled courses ka content (video + notes/files) yahin dikhta hai
export default function Dashboard() {
  const [sp, setSp] = useSearchParams();
  const [courses, setCourses] = useState<any[] | null>(null);
  const [lessons, setLessons] = useState<any[] | null>(null);
  const [cur, setCur] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => { api('/my/enrollments').then(setCourses); }, []);
  const courseId = sp.get('course') || courses?.[0]?.id;

  useEffect(() => {
    if (!courseId) return;
    setLessons(null); setCur(0); setErr('');
    api(`/my/courses/${courseId}/lessons`).then(setLessons).catch((e) => setErr(e.message));
  }, [courseId]);

  if (courses === null) return <div className="page">Loading…</div>;
  if (courses.length === 0)
    return <div className="page"><h1>Dashboard</h1><p className="muted">You have not enrolled in any course yet. <Link to="/courses">Browse courses</Link></p></div>;

  const l = lessons?.[cur];
  return (
    <div className="page">
      <h1>My dashboard</h1>
      <div className="filters">
        {courses.map((c) => <button key={c.id} className={'chip' + (c.id === courseId ? ' on' : '')} onClick={() => setSp({ course: c.id })}>{c.title}</button>)}
      </div>
      {err && <p className="err">{err}</p>}
      {!err && lessons === null && <p>Loading…</p>}
      {lessons && lessons.length === 0 && <p className="muted">No videos have been added to this course yet.</p>}
      {l && (
        <div className="learn" style={{ padding: 0 }}>
          <div className="main">
            <VideoPlayer key={l.id} src={`/api/stream/${l.id}?token=${token()}`} />
            <h2>{l.title}</h2>
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
