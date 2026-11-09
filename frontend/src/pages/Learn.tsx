import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, token } from '../api';
import VideoPlayer from '../components/VideoPlayer';
import LabRunner from '../components/LabRunner';
import { useStored } from '../useStored';

const isPdf = (n: string) => /\.pdf$/i.test(n);

// Course workspace: Lectures, Labs, Resources, Overview
export default function Learn() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'lectures';
  const [course, setCourse] = useState<any>(undefined);
  const [lessons, setLessons] = useState<any[] | null>(null);
  const [labs, setLabs] = useState<any[] | null>(null);
  const [cur, setCur] = useStored('lec_' + id, 0);
  const [labId, setLabId] = useState<string | null>(null);

  useEffect(() => { api('/my/enrollments').then((r) => setCourse(r.find((c: any) => c.id === id) || null)); }, [id]);
  const blocked = course && (course.enrollment.expired || course.enrollment.revoked);
  const loadLabs = () => api(`/my/courses/${id}/labs`).then(setLabs).catch(() => setLabs([]));
  useEffect(() => {
    if (course && !blocked) { api(`/my/courses/${id}/lessons`).then(setLessons).catch(() => setLessons([])); loadLabs(); }
  }, [course, blocked]);

  if (course === undefined) return <div className="page">Loading…</div>;
  if (course === null) return <div className="page"><div className="card notice">You are not enrolled in this course. <Link className="btn sm" to={`/course/${id}`}>View course</Link></div></div>;
  if (blocked) return (
    <div className="page"><div className="card notice">
      {course.enrollment.revoked ? 'Your access to this course was ended by admin. To enroll again, please complete the payment again.' : 'Your access to this course has expired.'}{' '}
      <Link className="btn sm" to={`/checkout/${id}`}>{course.enrollment.revoked ? 'Pay again to re-enroll' : 'Renew access'}</Link>
    </div></div>
  );

  const total = lessons?.length || 0;
  const done = lessons?.filter((l) => l.completed).length || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const l = lessons?.[cur];
  const toggle = async (x: any) => {
    await api(`/lessons/${x.id}/complete`, { method: 'POST', body: { done: !x.completed } });
    setLessons(lessons!.map((y) => (y.id === x.id ? { ...y, completed: !y.completed } : y)));
  };
  const groups: { name: string; items: { l: any; i: number }[] }[] = [];
  (lessons || []).forEach((x, i) => {
    const n = x.section || 'Lectures';
    let g = groups.find((y) => y.name === n);
    if (!g) { g = { name: n, items: [] }; groups.push(g); }
    g.items.push({ l: x, i });
  });
  const files = (lessons || []).flatMap((x) => x.files.map((f: any) => ({ ...f, lecture: x.title }))).filter((f: any) => isPdf(f.name));
  const setTab = (t: string) => { setLabId(null); setSp({ tab: t }); };

  return (
    <div className="learnwrap">
      <div className="lhead">
        <div><Link to="/dashboard" className="muted">← My courses</Link><h1>{course.title}</h1></div>
        <div className="lprog"><small className="muted">{done}/{total} lectures · {pct}%</small><div className="pbar"><i style={{ width: pct + '%' }} /></div></div>
      </div>
      <div className="tabs">
        {[['lectures', `Lectures${total ? ` (${total})` : ''}`], ['labs', `Labs${labs?.length ? ` (${labs.length})` : ''}`], ['resources', 'Resources'], ['overview', 'Overview']].map(([k, label]) => (
          <button key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'lectures' && (lessons === null ? <p>Loading…</p> : lessons.length === 0 ? <p className="muted">No lectures have been added yet.</p> : (
        <div className="learn" style={{ padding: 0 }}>
          <div className="main">
            <VideoPlayer key={l.id} src={`/api/stream/${l.id}?token=${token()}`} />
            <div className="line" style={{ border: 0 }}>
              <h2 style={{ margin: 0 }}>{l.title}</h2>
              <button className={'btn ' + (l.completed ? '' : 'ghost')} onClick={() => toggle(l)}>{l.completed ? '✓ Completed' : 'Mark as completed'}</button>
            </div>
            {l.description && <p className="desc muted">{l.description}</p>}
            {l.files.filter((f: any) => isPdf(f.name)).length > 0 && <div className="files">{l.files.filter((f: any) => isPdf(f.name)).map((f: any) => <a key={f.id} href={`/api/files/${f.id}?token=${token()}`} target="_blank" rel="noreferrer" className="file">📄 {f.name}</a>)}</div>}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn ghost sm" disabled={cur === 0} onClick={() => setCur(cur - 1)}>← Previous</button>
              <button className="btn ghost sm" disabled={cur === lessons.length - 1} onClick={() => setCur(cur + 1)}>Next →</button>
            </div>
          </div>
          <aside className="side">
            {groups.map((g) => (
              <div key={g.name}>
                <div className="secttitle">{g.name}</div>
                {g.items.map(({ l: x, i }) => (
                  <button key={x.id} className={i === cur ? 'on' : ''} onClick={() => setCur(i)}>
                    <span className={'tick' + (x.completed ? ' done' : '')}>{x.completed ? '✓' : i + 1}</span> {x.title}
                  </button>
                ))}
              </div>
            ))}
          </aside>
        </div>
      ))}

      {tab === 'labs' && (labId ? <LabRunner id={labId} onClose={() => { setLabId(null); loadLabs(); }} /> : labs === null ? <p>Loading…</p> : labs.length === 0 ? <p className="muted">No labs have been added to this course yet.</p> : (
        <div className="labgrid">
          {labs.map((x) => (
            <div className="card labcard" key={x.id}>
              <div className="row"><span className="tag">{x.kind}</span>{x.passed && <span className="tag s-ACTIVE">Passed</span>}</div>
              <h3>{x.title}</h3>
              <p className="muted clamp">{x.description}</p>
              <small className="muted">{x.questions} questions{x.timeLimitMin ? ` · ${x.timeLimitMin} min` : ''} · pass {x.passPercent}%</small>
              <div className="line" style={{ border: 0, padding: '10px 0 0' }}>
                <small>{x.attempts ? `Best: ${x.best}% · ${x.attempts} attempt(s)` : 'Not attempted'}</small>
                <button className="btn sm" onClick={() => setLabId(x.id)}>{x.attempts ? 'Try again' : 'Start'}</button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {tab === 'resources' && (files.length === 0 ? <p className="muted">No PDF resources have been uploaded for this course.</p> : (
        <div className="card">{files.map((f: any) => <div className="line" key={f.id}><span>📄 {f.name} <small className="muted">· {f.lecture}</small></span><a className="btn sm ghost" href={`/api/files/${f.id}?token=${token()}&dl=1`}>Download PDF</a></div>)}</div>
      ))}

      {tab === 'overview' && (
        <div className="twocol">
          <div className="card"><h3>About this course</h3><p className="desc">{course.description}</p></div>
          <div className="card">
            <h3>Your progress</h3>
            <div className="pbar"><i style={{ width: pct + '%' }} /></div>
            <p>{done} of {total} lectures completed ({pct}%)</p>
            <p>Labs passed: {labs?.filter((x) => x.passed).length || 0} of {labs?.length || 0}</p>
            <p className="muted">{course.enrollment.expiresAt ? `Access until ${new Date(course.enrollment.expiresAt).toLocaleDateString()}` : 'No expiry'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
