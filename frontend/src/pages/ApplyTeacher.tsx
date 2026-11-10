import { useEffect, useState } from 'react';
import { api, upload } from '../api';
import { useAuth } from '../auth';
import Progress from '../components/Progress';

export default function ApplyTeacher() {
  const { user } = useAuth();
  const [app, setApp] = useState<any>(undefined);
  const [f, setF] = useState<any>({ name: user?.name || '', phone: user?.phone || '', city: '', qualification: '', experienceYears: '', subjects: '', bio: '', sampleLink: '' });
  const [cv, setCv] = useState<File | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const load = () => api('/teaching/application').then((r) => setApp(r || null)).catch(() => setApp(null));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    setErr('');
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.append(k, String(v)));
    if (cv) fd.append('cv', cv);
    setPct(0);
    try { await upload('/teaching/apply', fd, 'POST', setPct); await load(); } catch (e: any) { setErr(e.message); }
    setPct(null);
  };
  const field = (k: string, label: string, ph = '') => <label className="fld"><span>{label}</span><input value={f[k]} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>;

  if (app === undefined) return <div className="page">Loading…</div>;
  if (user.role === 'TEACHER') return <div className="page narrow"><div className="card notice">You already have teacher access. Open the <a href="/teacher">Teacher portal</a>.</div></div>;
  const open = app && app.status === 'PENDING';
  return (
    <div className="page narrow">
      <h1>Apply for Teaching</h1>
      <p className="muted">Share your details. Our admin will review your application and, if approved, give you access to the Teacher portal.</p>
      {app && (
        <div className={'card ' + (app.status === 'APPROVED' ? 'pass' : app.status === 'REJECTED' ? 'fail' : 'notice')}>
          <b>Application status: {app.status}</b>
          <p className="muted" style={{ margin: '4px 0 0' }}>Submitted {new Date(app.createdAt).toLocaleString()}{app.note ? ` · Note: ${app.note}` : ''}</p>
        </div>
      )}
      {!open && (
        <div className="card">
          {field('name', 'Full name *')}
          <label className="fld"><span>Email</span><input value={user.email} disabled /></label>
          {field('phone', 'Phone number *', '+92 3XX XXXXXXX')}
          {field('city', 'City')}
          {field('qualification', 'Highest qualification *', 'e.g. MSc Computer Science')}
          {field('experienceYears', 'Years of teaching experience', '3')}
          {field('subjects', 'Subjects you can teach *', 'e.g. Python, Web Development')}
          <label className="fld"><span>About you *</span><textarea rows={5} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="Your background, teaching style and achievements (at least 30 characters)" /></label>
          {field('sampleLink', 'Sample lecture link (YouTube / Drive), optional', 'https://')}
          <label className="fld"><span>CV (PDF, optional)</span><input type="file" accept="application/pdf" onChange={(e) => setCv(e.target.files?.[0] || null)} /></label>
          {err && <p className="err">{err}</p>}
          <Progress pct={pct} label="Submitting" />
          <button className="btn big" onClick={submit} disabled={pct !== null}>Submit application</button>
        </div>
      )}
    </div>
  );
}
