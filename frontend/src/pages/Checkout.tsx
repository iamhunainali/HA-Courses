import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, upload } from '../api';
import Progress from '../components/Progress';
import { useSettings } from '../settings';
import { useAuth } from '../auth';
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
  const { user } = useAuth();
  const [fatherName, setFatherName] = useState(user?.fatherName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [online, setOnline] = useState<any>({});
  const [sp] = useSearchParams();
  useEffect(() => { api('/payments/methods').then(setOnline).catch(() => {}); }, []);
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
  const active = mine && !mine.enrollment.expired && !mine.enrollment.revoked;
  const payable = c.plan === 'PREMIUM' || !!mine?.enrollment?.revoked;
  const lastRejected = !pending && pays.find((p) => p.courseId === id)?.status === 'REJECTED' ? pays.find((p) => p.courseId === id) : null;

  // JazzCash / Easypaisa: signed form banakar gateway ke page par POST karta hai
  const payOnline = async (gw: string) => {
    setErr('');
    try {
      const r = await api(`/payments/${gw}/start`, { method: 'POST', body: { courseId: id } });
      const form = document.createElement('form'); form.method = 'POST'; form.action = r.action;
      Object.entries(r.fields).forEach(([k, v]) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = String(v); form.appendChild(i); });
      document.body.appendChild(form); form.submit();
    } catch (e: any) { setErr(e.message); }
  };
  const submit = async () => {
    setErr('');
    const fd = new FormData();
    fd.append('answers', JSON.stringify({ ...vals, __terms: terms }));
    fd.append('fatherName', fatherName); fd.append('phone', phone);
    Object.entries(files).forEach(([k, f]) => fd.append(k, f));
    setPct(0);
    try { await upload(`/courses/${id}/checkout`, fd, 'POST', setPct); await load(); notifyEnrolled(); } catch (e: any) { setErr(e.message); }
    setPct(null);
  };

  return (
    <div className="page checkout">
      <div>
        <h1>{cfg.title}</h1>
        {sp.get('paid') && <div className="card notice ok">✅ Payment successful. Your access is being activated.</div>}
        {sp.get('submitted') && <div className="card notice">⏳ Payment submitted. Access will be granted once it is confirmed.</div>}
        {sp.get('failed') && <div className="card notice err">❌ The online payment was not completed. You can try again.</div>}
        {mine?.enrollment?.revoked && <div className="card notice err">Your access to this course was ended by admin. To enroll again, please complete the payment again.</div>}
        {!payable && <p>This course is free. <Link to={`/course/${id}`}>Go to the course</Link></p>}
        {payable && active && <div className="card notice">You already have access to this course. <Link className="btn sm" to={`/learn/${id}`}>Open course</Link></div>}

        {payable && !active && pending && (
          <div className="card pendingbox">
            <h2>⏳ {cfg.pendingTitle}</h2>
            <p>{cfg.pendingText}</p>
            {left > 0
              ? <><p className="muted">Estimated review time left</p><div className="timer">{hms(left)}</div></>
              : <p className="err"><b>{cfg.overdueText}</b></p>}
            <small className="muted">Submitted {new Date(pending.createdAt).toLocaleString()}</small>
          </div>
        )}

        {payable && !active && !pending && (
          <>
            {lastRejected && <div className="card notice err">Your last request was not approved.{lastRejected.note ? ` Reason: ${lastRejected.note}` : ''} Please submit again.</div>}
            {cfg.intro && <p>{cfg.intro}</p>}
            {cfg.instructions && <p className="muted">{cfg.instructions}</p>}
            {(online.jazzcash || online.easypaisa) && (
              <div className="card"><b>Pay securely online</b><p className="muted" style={{ margin: '4px 0 10px' }}>Instant access after a successful payment.</p>
                <div className="row">
                  {online.jazzcash && <button className="btn gw jazz" onClick={() => payOnline('jazzcash')}>Pay with JazzCash</button>}
                  {online.easypaisa && <button className="btn gw easy" onClick={() => payOnline('easypaisa')}>Pay with Easypaisa</button>}
                </div>
                {err && <p className="err">{err}</p>}
                <p className="muted" style={{ margin: '10px 0 0' }}>Or pay manually using the details below and submit the form.</p>
              </div>
            )}
            <div className="methods">
              {(cfg.methods || []).map((m: any, i: number) => <div className="card" key={i}><b>{m.name}</b><p style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{m.details}</p></div>)}
            </div>
            <div className="card">
              <label className="fld"><span>Father name *</span><input value={fatherName} onChange={(e) => setFatherName(e.target.value)} placeholder="Father's full name" /></label>
              <label className="fld"><span>Phone number *</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 3XX XXXXXXX" /></label>
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
