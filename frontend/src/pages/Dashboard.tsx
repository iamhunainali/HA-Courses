import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, media, token } from '../api';
import VideoPlayer from '../components/VideoPlayer';

// Jis course mein enroll kiya wo yahan dikhta hai, aur admin ka upload kiya hua video/notes bhi
export default function Dashboard() {
  const [sp, setSp] = useSearchParams();
  const [courses, setCourses] = useState<any[] | null>(null);
  const [lessons, setLessons] = useState<any[] | null>(null);
  const [cur, setCur] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => { api('/my/enrollments').then(setCourses); }, []);
  const courseId = sp.get('course') || courses?.[0]?.id;
  const course = courses?.find((c) => c.id === courseId);

  useEffect(() => {
    if (!courseId) return;
    setLessons(null); setCur(0); setErr('');
    api(`/my/courses/${courseId}/lessons`).then(setLessons).catch((e) => setErr(e.message));
  }, [courseId]);

  if (courses === null) return <div className="page">Loading…</div>;
  if (courses.length === 0)
    return <div className="page"><h1>My dashboard</h1><p className="muted">You have not enrolled in any course yet. <Link to="/courses">Browse courses</Link></p></div>;

  const l = lessons?.[cur];
  return (
    <div className="page">
      <h1>My dashboard</h1>
      <h3>Enrolled courses</h3>
      <div className="mycourses">
        {courses.map((c) => (
          <button key={c.id} className={'mycourse' + (c.id === courseId ? ' on' : '')} onClick={() => setSp({ course: c.id })}>
            <span className="mt">{c.thumbnail && <img src={media(c.thumbnail)} alt="" />}</span>
            <span><b>{c.title}</b><br /><small className="muted">{c._count?.lessons ?? 0} videos</small></span>
          </button>
        ))}
      </div>
      {course && <h2>{course.title}</h2>}
      {err && <p className="err">{err}</p>}
      {!err && lessons === null && <p>Loading…</p>}
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
