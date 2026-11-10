import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, media } from '../api';
import { useStored } from '../useStored';
import { Lessons } from './Admin';
import LabsPanel from './AdminLabs';

const TABS = [['courses', '📚 My courses'], ['lectures', '🎬 Lectures'], ['labs', '🧪 Labs'], ['students', '🎓 Students']];

// Teacher portal: admin ne jo courses assign kiye sirf wohi
export default function TeacherPortal() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'courses';
  const [courses, setCourses] = useState<any[] | null>(null);
  const [sel, setSel] = useStored('teacher_sel', '');
  const [students, setStudents] = useState<any[]>([]);
  useEffect(() => { api('/teacher/courses').then(setCourses); }, []);
  useEffect(() => { if (tab === 'students' && sel) api(`/teacher/courses/${sel}/students`).then(setStudents).catch(() => setStudents([])); }, [tab, sel]);
  const course = courses?.find((c) => c.id === sel);
  const picker = (
    <div className="card"><select value={sel} onChange={(e) => setSel(e.target.value)}><option value="">Select a course</option>{courses?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div>
  );

  if (!courses) return <div className="page">Loading…</div>;
  return (
    <div className="page">
      <h1>Teacher portal</h1>
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setSp({ tab: k })}>{l}</button>)}</div>
      {courses.length === 0 && <div className="card notice">No course is assigned to you yet. Please contact the admin.</div>}

      {tab === 'courses' && <div className="grid">{courses.map((c) => (
        <div className="ccard" key={c.id}>
          <div className="thumb">{c.thumbnail ? <img src={media(c.thumbnail)} alt="" /> : <span>{c.title[0]}</span>}</div>
          <div className="cbody"><h3>{c.title}</h3><small className="muted">{c._count.lessons} lectures · {c._count.labs} labs · {c._count.enrollments} students</small></div>
          <div className="cfoot row"><button className="btn sm" onClick={() => { setSel(c.id); setSp({ tab: 'lectures' }); }}>Add lectures</button><button className="btn sm ghost" onClick={() => { setSel(c.id); setSp({ tab: 'students' }); }}>Students</button></div>
        </div>))}</div>}

      {tab === 'lectures' && <>{picker}{course && <Lessons key={course.id} course={course} base="/teacher" />}</>}
      {tab === 'labs' && <LabsPanel base="/teacher" />}
      {tab === 'students' && <>{picker}{sel && (
        <div className="card"><div className="tablewrap"><table><thead><tr><th>Student</th><th>Progress</th><th>Access</th></tr></thead><tbody>
          {students.map((s) => <tr key={s.id}><td><b>{s.user.name}</b><br /><small className="muted">{s.user.email}</small></td>
            <td style={{ minWidth: 160 }}><div className="pbar"><i style={{ width: (s.total ? Math.round((s.completed / s.total) * 100) : 0) + '%' }} /></div><small className="muted">{s.completed}/{s.total} lectures</small></td>
            <td>{s.revoked ? <span className="err">Ended</span> : s.expiresAt ? 'Until ' + new Date(s.expiresAt).toLocaleDateString() : 'No expiry'}</td></tr>)}
          {students.length === 0 && <tr><td colSpan={3} className="muted">No students yet.</td></tr>}
        </tbody></table></div></div>)}</>}
    </div>
  );
}
