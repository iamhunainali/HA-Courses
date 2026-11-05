import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, upload } from '../api';
import Progress from '../components/Progress';
import { useSettings } from '../settings';
import { notifyEnrolled } from '../enroll';

const hms = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
};
function useLeft(due?: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  return due ? new Date(due).getTime() - now : 0;
}

// Premium course ka checkout: form admin ke Checkout tab se banta hai
export default function Checkout() {
  const { id } = useParams();
  const { settings } = useSettings();
  const [c, setC] = useState<any>(null);
  const [cfg, setCfg] = useState<any>(null);
  const [pays, setPays] = useState<any[]>([]);
  const [mine, setMine] = useState<any>(null);
  const [vals, setVals] = useState<any>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [terms, setTerms] = useState(false);
  const [err, setErr] = useState('');
  const [pct, setPct] = useState<number | null>(null);

  const load = async () => {
    setC(await api(`/courses/${id}`)); setCfg(await api('/checkout/config')); setPays(await api('/my/payments'));
    const e = await api('/my/enrollments'); setMine(e.find((x: any) => x.id === id) || null);
  };
  useEffect(() => { load().catch((e) => setErr(e.message)); }, [id]);
  const pending = pays.find((p) => p.courseId === id && p.status === 'PENDING');
  const left = useLeft(pending?.dueAt);

  if (err && !c) return <div className="page"><p className="err">{err}</p></div>;
  if (!c || !cfg) return <div className="page">Loading…</div>;
  const cur = settings.currency;
  const active = mine && !mine.enrollment.expired;
  const lastRejected = !pending && pays.find((p) => p.courseId === id)?.status === 'REJECTED' ? pays.find((p) => p.courseId === id) : null;

  const submit = async () => {
    setErr('');
    const fd = new FormData();
    fd.append('answers', JSON.stringify({ ...vals, __terms: terms }));
    Object.entries(files).forEach(([k, f]) => fd.append(k, f));
    setPct(0);
    try { await upload(`/courses/${id}/checkout`, fd, 'POST', setPct); await load(); notifyEnrolled(); } catch (e: any) { setErr(e.message); }
    setPct(null);
  };

  return (
    <div className="page checkout">
      <div>
        <h1>{cfg.title}</h1>
        {c.plan !== 'PREMIUM' && <p>This course is free. <Link to={`/course/${id}`}>Go to the course</Link></p>}
        {c.plan === 'PREMIUM' && active && <div className="card notice">You already have access to this course. <Link className="btn sm" to={`/dashboard?course=${id}`}>Open in dashboard</Link></div>}

        {c.plan === 'PREMIUM' && !active && pending && (
          <div className="card pendingbox">
            <h2>⏳ {cfg.pendingTitle}</h2>
            <p>{cfg.pendingText}</p>
            {left > 0
              ? <><p className="muted">Estimated review time left</p><div className="timer">{hms(left)}</div></>
              : <p className="err"><b>{cfg.overdueText}</b></p>}
            <small className="muted">Submitted {new Date(pending.createdAt).toLocaleString()}</small>
          </div>
        )}

        {c.plan === 'PREMIUM' && !active && !pending && (
          <>
            {lastRejected && <div className="card notice err">Your last request was not approved.{lastRejected.note ? ` Reason: ${lastRejected.note}` : ''} Please submit again.</div>}
            {cfg.intro && <p>{cfg.intro}</p>}
            {cfg.instructions && <p className="muted">{cfg.instructions}</p>}
            <div className="methods">
              {(cfg.methods || []).map((m: any, i: number) => <div className="card" key={i}><b>{m.name}</b><p style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{m.details}</p></div>)}
            </div>
            <div className="card">
              {(cfg.fields || []).map((f: any) => (
                <label className="fld" key={f.key}><span>{f.label}{f.required && ' *'}</span>
                  {f.type === 'textarea' ? <textarea rows={3} value={vals[f.key] || ''} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />
                    : f.type === 'select' ? <select value={vals[f.key] || ''} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}><option value="">Select…</option>{String(f.options || '').split(',').map((o) => o.trim()).filter(Boolean).map((o) => <option key={o}>{o}</option>)}</select>
                      : f.type === 'file' ? <input type="file" accept="image/*,application/pdf" onChange={(e) => e.target.files?.[0] && setFiles({ ...files, [f.key]: e.target.files[0] })} />
                        : <input type={f.type === 'number' ? 'number' : 'text'} value={vals[f.key] || ''} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />}
                </label>
              ))}
              {cfg.terms && <label className="fld"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /> {cfg.terms}</label>}
              {err && <p className="err">{err}</p>}
              <Progress pct={pct} label="Submitting" />
              <button className="btn big" onClick={submit} disabled={pct !== null}>{cfg.buttonText}</button>
              {cfg.securityNote && <p className="muted secnote">{cfg.securityNote}</p>}
            </div>
          </>
        )}
      </div>
      <aside className="card summary">
        <h3>Order summary</h3>
        <b>{c.title}</b>
        <p className="muted">{c.plan === 'PREMIUM' ? (c.durationDays ? `${c.durationDays} days access` : 'Lifetime access') : 'Free'}</p>
        <div className="total">{cur} {c.price}</div>
      </aside>
    </div>
  );
}
