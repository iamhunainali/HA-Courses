import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, token } from '../api';
import VideoPlayer from '../components/VideoPlayer';

// Sirf video + (agar admin ne upload ki ho to) files. Course page nahi.
export default function Learn() {
  const { id } = useParams();
  const [lessons, setLessons] = useState<any[] | null>(null);
  const [cur, setCur] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => { api(`/my/courses/${id}/lessons`).then(setLessons).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <div className="page"><p className="err">{err}</p></div>;
  if (!lessons) return <div className="page">Loading…</div>;
  if (!lessons.length) return <div className="page"><p className="muted">No videos have been added yet.</p></div>;
  const l = lessons[cur];

  return (
    <div className="learn">
      <div className="main">
        <VideoPlayer key={l.id} src={`/api/stream/${l.id}?token=${token()}`} />
        <h2>{l.title}</h2>
        {l.files.length > 0 && (
          <div className="files">
            {l.files.map((f: any) => (
              <a key={f.id} href={`/api/files/${f.id}?token=${token()}`} className="file">📎 {f.name}</a>
            ))}
          </div>
        )}
      </div>
      {lessons.length > 1 && (
        <aside className="side">
          {lessons.map((x, k) => <button key={x.id} className={k === cur ? 'on' : ''} onClick={() => setCur(k)}>{k + 1}. {x.title}</button>)}
        </aside>
      )}
    </div>
  );
}
