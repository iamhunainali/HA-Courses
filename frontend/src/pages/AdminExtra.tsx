import { Fragment, useEffect, useState } from 'react';
import { api, token } from '../api';
import { Fields, F } from './HomepageBuilder';
import { useStored } from '../useStored';
import { CheckoutPreview, NotificationPreview } from '../components/AdminPreview';

const ago = (d?: string) => {
  if (!d) return 'never';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + ' min ago';
  if (m < 1440) return Math.floor(m / 60) + ' h ago';
  return Math.floor(m / 1440) + ' d ago';
};
// Custom sender name (user ko "Admin" ki jagah ye naam dikhega)
const askSender = () => {
  const s = prompt('Sender name shown to the user (e.g. Support Team):', localStorage.getItem('senderName') || 'Support Team');
  if (s !== null) localStorage.setItem('senderName', s);
  return s;
};

/* ---------------- Users: online status + activity ---------------- */
export function UsersPanel() {
  const [q, setQ] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState<string | null>(null);
  const [acts, setActs] = useState<any[]>([]);
  const load = () => api(`/admin/users?q=${encodeURIComponent(q)}`).then(setList);
  useEffect(() => { const t = setTimeout(load, 250); const i = setInterval(load, 30000); return () => { clearTimeout(t); clearInterval(i); }; }, [q]);

  const act = async (u: any, action: string) => {
    let reason = '', sender: string | null = '', minutes = '60';
    if (action === 'warn' || action === 'suspend') {
      const r = prompt(`Reason for ${action} (user will see this):`, ''); if (r === null) return; reason = r;
      sender = askSender(); if (sender === null) return;
      if (action === 'suspend') { const m = prompt('Suspend for how many minutes? (60 = 1 hour, 0 = until you activate it manually)', '60'); if (m === null) return; minutes = m; }
    }
    if (action === 'delete' && !confirm(`Delete ${u.email} permanently?`)) return;
    try {
      const r = await api(`/admin/users/${u.id}/action`, { method: 'PATCH', body: { action, reason, sender, minutes } });
      if (r.tempPassword) alert(`Temporary password for ${u.email}: ${r.tempPassword}`);
      load();
    } catch (e: any) { alert(e.message); }
  };
  const toggleTeacher = async (u: any) => {
    await api(`/admin/users/${u.id}/role`, { method: 'PATCH', body: { role: u.role === 'TEACHER' ? 'USER' : 'TEACHER' } }).catch((e) => alert(e.message)); load();
  };
  const msg = async (u: any) => {
    const title = prompt('Message title:'); if (!title) return;
    const message = prompt('Message:'); if (!message) return;
    const sender = askSender(); if (sender === null) return;
    await api('/admin/message', { method: 'POST', body: { email: u.email, title, message, sender } });
    alert('Sent');
  };
  const editU = async (u: any) => {
    const name = prompt('Name', u.name); if (name === null) return;
    const email = prompt('Email', u.email); if (email === null) return;
    try { await api(`/admin/users/${u.id}`, { method: 'PATCH', body: { name, email } }); load(); } catch (e: any) { alert(e.message); }
  };
  const toggleAct = async (u: any) => {
    if (open === u.id) return setOpen(null);
    setActs(await api(`/admin/users/${u.id}/activity`)); setOpen(u.id);
  };

  const shown = list.filter((u) => filter === 'all' || (filter === 'online' && u.online) || (filter === 'offline' && !u.online) || (filter === 'suspended' && u.status === 'SUSPENDED'));
  return (
    <div className="card">
      <div className="row">
        <input placeholder="Search by email or name" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
        {['all', 'online', 'offline', 'suspended'].map((f) => <button key={f} className={'chip' + (filter === f ? ' on' : '')} onClick={() => setFilter(f)}>{f}{f === 'online' ? ` (${list.filter((u) => u.online).length})` : ''}</button>)}
      </div>
      <div className="tablewrap">
        <table>
          <thead><tr><th>User</th><th>Presence</th><th>Status</th><th>Logins</th><th>Failed</th><th>Courses</th><th>Last login</th><th>Actions</th></tr></thead>
          <tbody>
            {shown.map((u) => (
              <Fragment key={u.id}>
                <tr>
                  <td><b>{u.name}</b><br /><small className="muted">{u.email}</small>{u.phone && <><br /><small className="muted">📞 {u.phone}{u.fatherName ? ` · Father: ${u.fatherName}` : ''}</small></>}</td>
                  <td><span className={'dot ' + (u.online ? 'on' : '')} /> {u.online ? 'Online' : `Offline · ${ago(u.lastSeen || u.lastLogin)}`}</td>
                  <td><span className={'tag s-' + u.status}>{u.role === 'SUPER_ADMIN' ? 'ADMIN' : u.status}</span>{u.role === 'TEACHER' && <small className="tag buy"> Teacher</small>}{u.warnings > 0 && <small> ⚠ {u.warnings}</small>}{u.status === 'SUSPENDED' && <small className="muted"><br />{u.suspendedUntil ? 'back in ' + Math.max(0, Math.ceil((new Date(u.suspendedUntil).getTime() - Date.now()) / 60000)) + ' min' : 'until activated'}</small>}</td>
                  <td>{u.loginCount}</td>
                  <td className={u.failedLogins > 0 ? 'err' : ''}>{u.failedLogins}</td>
                  <td>{u._count.enrollments}</td>
                  <td>{u.lastLogin ? new Date(u.lastLogin).toLocaleString() : '-'}</td>
                  <td>
                    <div className="row">
                      <button className="btn sm ghost" onClick={() => toggleAct(u)}>{open === u.id ? 'Hide activity' : 'Activity'}</button>
                      {u.role !== 'SUPER_ADMIN' && <>
                        <button className="btn sm" onClick={() => editU(u)}>Edit</button>
                        <button className="btn sm ghost" onClick={() => toggleTeacher(u)}>{u.role === 'TEACHER' ? 'Remove teacher' : 'Make teacher'}</button>
                        <button className="btn sm" onClick={() => msg(u)}>Message</button>
                        <button className="btn sm ghost" onClick={() => act(u, 'warn')}>Warn</button>
                        {u.status === 'SUSPENDED' ? <button className="btn sm" onClick={() => act(u, 'activate')}>Activate</button> : <button className="btn sm ghost" onClick={() => act(u, 'suspend')}>Suspend</button>}
                        {u.warnings > 0 && <button className="btn sm ghost" onClick={() => act(u, 'clear_warnings')}>Clear warnings</button>}
                        <button className="btn sm ghost" onClick={() => act(u, 'reset_password')}>Reset password</button>
                        <button className="btn sm danger" onClick={() => act(u, 'delete')}>Delete</button>
                      </>}
                    </div>
                  </td>
                </tr>
                {open === u.id && (
                  <tr><td colSpan={8}>
                    {acts.length === 0 ? <small className="muted">No activity recorded yet.</small> : acts.map((a) => (
                      <div className="line sub" key={a.id}>
                        <span className={a.type.includes('FAILED') || a.type.includes('BLOCKED') ? 'err' : 'ok'}>{a.type.replace('_', ' ')}</span>
                        <small className="muted">{a.ip || '-'} · {(a.agent || '').slice(0, 70)}</small>
                        <small>{new Date(a.createdAt).toLocaleString()}</small>
                      </div>
                    ))}
                  </td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Messages with custom sender ---------------- */
export function MessagesPanel() {
  const [f, setF] = useState({ sender: localStorage.getItem('senderName') || 'Support Team', email: '', title: '', message: '', sendEmail: false });
  const [res, setRes] = useState('');
  const send = async () => {
    localStorage.setItem('senderName', f.sender);
    try { const r = await api('/admin/message', { method: 'POST', body: f }); setRes(`Sent to ${r.sent} user(s)`); setF({ ...f, email: '', title: '', message: '' }); } catch (e: any) { setRes(e.message); }
  };
  return (
    <div className="card">
      <h3>Send notification</h3>
      <input placeholder="Sender name (user sees: from ...)" value={f.sender} onChange={(e) => setF({ ...f, sender: e.target.value })} />
      <input placeholder="User email (leave empty to send to ALL users)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <input placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <textarea rows={3} placeholder="Message" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
      <label className="fld"><input type="checkbox" checked={f.sendEmail} onChange={(e) => setF({ ...f, sendEmail: e.target.checked })} /> Also send as email (SMTP)</label>
      <NotificationPreview sender={f.sender} title={f.title} message={f.message} />
      <button className="btn" onClick={send}>Send</button>
      {res && <p className="muted">{res}</p>}
    </div>
  );
}

/* ---------------- Enrollments with expiry ---------------- */
export function EnrollmentsPanel() {
  const [courses, setCourses] = useState<any[]>([]);
  const [sel, setSel] = useStored('sel_enr', '');
  const [list, setList] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [days, setDays] = useState('0');
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/admin/courses').then(setCourses); }, []);
  const load = () => (sel ? api(`/admin/courses/${sel}/enrollments`).then(setList) : setList([]));
  useEffect(() => { load(); const c = courses.find((x) => x.id === sel); setDays(String(c?.durationDays || 0)); }, [sel]);
  const add = async () => {
    try { await api(`/admin/courses/${sel}/enrollments`, { method: 'POST', body: { email, days } }); setEmail(''); setMsg(''); load(); } catch (e: any) { setMsg(e.message); }
  };
  const setExp = async (e: any) => {
    const d = prompt('Access days from today (0 = lifetime):', '30'); if (d === null) return;
    await api(`/admin/enrollments/${e.id}`, { method: 'PATCH', body: { days: d } }); load();
  };
  const revoke = async (e: any) => {
    const reason = prompt('Reason (user will see this). The user must pay again to re-enroll:', ''); if (reason === null) return;
    const sender = askSender(); if (sender === null) return;
    await api(`/admin/enrollments/${e.id}/revoke`, { method: 'POST', body: { reason, sender } }); load();
  };
  const restore = async (e: any) => { await api(`/admin/enrollments/${e.id}/restore`, { method: 'POST' }); load(); };
  const remove = async (id: string) => { if (confirm('Remove this student from the course?')) { await api(`/admin/enrollments/${id}`, { method: 'DELETE' }); load(); } };
  return (
    <div className="card">
      <select value={sel} onChange={(e) => setSel(e.target.value)}>
        <option value="">Select a course</option>
        {courses.map((c) => <option key={c.id} value={c.id}>{c.title} ({c._count.enrollments})</option>)}
      </select>
      {sel && (<>
        <div className="row"><input placeholder="Student email" value={email} onChange={(e) => setEmail(e.target.value)} /><input placeholder="Access days (0 = lifetime)" value={days} onChange={(e) => setDays(e.target.value)} style={{ maxWidth: 200 }} /><button className="btn" onClick={add}>Enroll student</button></div>
        {msg && <p className="err">{msg}</p>}
        {list.length === 0 && <p className="muted">No students enrolled yet.</p>}
        {list.map((e) => {
          const exp = e.expiresAt ? new Date(e.expiresAt) : null; const expired = exp && exp < new Date();
          return (
            <div className="line" key={e.id}>
              <span>{e.user.name} <small className="muted">{e.user.email}</small> · {e.revokedAt ? <small className="err">Terminated {new Date(e.revokedAt).toLocaleDateString()} (must pay again)</small> : <small className={expired ? 'err' : 'ok'}>{exp ? (expired ? 'Expired ' : 'Expires ') + exp.toLocaleDateString() : 'No expiry'}</small>}</span>
              <span className="row">{e.revokedAt ? <button className="btn sm" onClick={() => restore(e)}>Restore access</button> : <button className="btn sm danger" onClick={() => revoke(e)}>Terminate access</button>}<button className="btn sm ghost" onClick={() => setExp(e)}>Set expiry</button><button className="btn sm ghost" onClick={() => remove(e.id)}>Delete record</button></span>
            </div>
          );
        })}
      </>)}
    </div>
  );
}

/* ---------------- Payment requests ---------------- */
export function PaymentsPanel() {
  const [status, setStatus] = useState('PENDING');
  const [list, setList] = useState<any[]>([]);
  const [, tick] = useState(0);
  const load = () => api(`/admin/payments?status=${status}`).then(setList);
  useEffect(() => { load(); const i = setInterval(load, 30000); const t = setInterval(() => tick((x) => x + 1), 30000); return () => { clearInterval(i); clearInterval(t); }; }, [status]);

  const approve = async (p: any) => {
    const days = prompt('Access duration in days (0 = lifetime):', String(p.days)); if (days === null) return;
    const note = prompt('Internal note (optional):', '') || '';
    try { await api(`/admin/payments/${p.id}/approve`, { method: 'POST', body: { days, note } }); load(); } catch (e: any) { alert(e.message); }
  };
  const reject = async (p: any) => {
    const reason = prompt('Reason shown to the user:', ''); if (reason === null) return;
    try { await api(`/admin/payments/${p.id}/reject`, { method: 'POST', body: { reason } }); load(); } catch (e: any) { alert(e.message); }
  };
  const due = (p: any) => {
    const m = Math.round((new Date(p.dueAt).getTime() - Date.now()) / 60000);
    return m >= 0 ? `Review due in ${Math.floor(m / 60)}h ${m % 60}m` : `Overdue by ${Math.floor(-m / 60)}h ${(-m) % 60}m`;
  };
  return (
    <div>
      <div className="filters">{['PENDING', 'APPROVED', 'REJECTED'].map((s) => <button key={s} className={'chip' + (status === s ? ' on' : '')} onClick={() => setStatus(s)}>{s}</button>)}</div>
      {list.length === 0 && <p className="muted">No {status.toLowerCase()} requests.</p>}
      {list.map((p) => (
        <div className="card" key={p.id}>
          <div className="line">
            <span><b>{p.user.name}</b> <small className="muted">{p.user.email}</small> → <b>{p.course.title}</b> {p.gateway && <small className="tag">{p.gateway}</small>}</span>
            <span><b>{p.amount}</b> · {p.days ? p.days + ' days' : 'lifetime'}</span>
          </div>
          <small className="muted">Submitted {new Date(p.createdAt).toLocaleString()}</small>
          {p.status === 'PENDING' && <small className={new Date(p.dueAt) < new Date() ? 'err' : 'ok'}> · {due(p)}</small>}
          <div className="answers">
            <div><span className="muted">Father name: </span><b>{p.fatherName || '-'}</b></div>
            <div><span className="muted">Phone: </span><b>{p.phone || '-'}</b></div>
            {(p.answers || []).map((a: any) => (
              <div key={a.key}><span className="muted">{a.label}: </span>
                {a.type === 'file' ? (a.value ? <a href={`/api/admin/payment-files/${a.value}?token=${token()}`} target="_blank" rel="noreferrer">View file</a> : '-') : (a.value || '-')}
              </div>
            ))}
          </div>
          {p.note && <p className="muted">Note: {p.note}</p>}
          {p.status === 'PENDING' && <div className="row"><button className="btn" onClick={() => approve(p)}>Approve and grant access</button><button className="btn danger" onClick={() => reject(p)}>Reject</button></div>}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Checkout page editor ---------------- */
const t = (k: string, label: string): F => ({ k, label, t: 'text' });
const a = (k: string, label: string): F => ({ k, label, t: 'area' });
const CHECKOUT_SCHEMA: F[] = [
  t('title', 'Page title'), a('intro', 'Intro text'), a('instructions', 'Payment instructions'),
  { k: 'methods', label: 'Payment methods / accounts', t: 'list', add: 'method', fields: [t('name', 'Method name'), a('details', 'Details (account title, number...)')] },
  { k: 'fields', label: 'Form fields (the form the user fills)', t: 'list', add: 'field', fields: [
    t('label', 'Field label'), { k: 'type', label: 'Type', t: 'select', opts: ['text', 'textarea', 'number', 'select', 'file'] },
    { k: 'required', label: 'Required', t: 'bool' }, t('options', 'Dropdown options (comma separated)')] },
  t('terms', 'Confirmation checkbox text (empty = no checkbox)'), t('buttonText', 'Submit button text'), t('securityNote', 'Security note under the button'),
  { k: 'reviewHours', label: 'Review time in hours (countdown shown to the user)', t: 'number' },
  t('pendingTitle', 'After submit: title'), a('pendingText', 'After submit: text'), a('overdueText', 'Text when the review time is over'),
];

export function CheckoutPanel() {
  const [cfg, setCfg] = useState<any>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/admin/checkout').then(setCfg); }, []);
  if (!cfg) return <p>Loading…</p>;
  const save = async () => {
    const fields = (cfg.fields || []).map((f: any) => ({ ...f, type: f.type || 'text', required: !!f.required, key: f.key || 'f_' + Math.random().toString(36).slice(2, 8) }));
    const config = { ...cfg, fields, reviewHours: Number(cfg.reviewHours) || 3 };
    await api('/admin/checkout', { method: 'PATCH', body: { config } }); setCfg(config); setMsg('Saved. Checkout page updated.');
  };
  return (
    <div className="card">
      <h3>Checkout page (premium courses)</h3>
      <p className="muted">Edit everything users see on the payment page: text, payment accounts, and the form they must fill. Access is granted only after you approve the request in the Payments tab.</p>
      <Fields fields={CHECKOUT_SCHEMA} value={cfg} onChange={setCfg} cats={[]} />
      <CheckoutPreview cfg={cfg} />
      <div className="row"><button className="btn" onClick={save}>Save checkout page</button>{msg && <span className="ok">{msg}</span>}</div>
    </div>
  );
}
