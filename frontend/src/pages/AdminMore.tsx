import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { api, media, token, upload } from '../api';
import Progress from '../components/Progress';
import PopupView, { POPUP_THEMES } from '../components/PopupView';
import { EmailPreview, PreviewBox } from '../components/AdminPreview';
import { useSettings } from '../settings';
import { useStored } from '../useStored';

const toLocal = (iso?: string) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const toIso = (v?: string) => (v ? new Date(v).toISOString() : null);
const Sel = ({ label, value, onChange, opts }: any) => (
  <label className="fld"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}>{opts.map(([v, l]: any) => <option key={v} value={v}>{l}</option>)}</select></label>
);

/* ======================= POPUPS ======================= */
const EMPTY = {
  name: 'New popup', active: true, title: 'Special offer', body: 'Write your message here.', image: '', buttonText: 'Learn more', buttonLink: '/courses',
  pages: 'all', delaySec: 2, priority: 0, startAt: '', endAt: '',
  style: { layout: 'center', theme: 'classic', size: 'md', anim: 'zoom', imagePos: 'top', overlay: true, closable: true, autoClose: 0, radius: 16, laterBtn: true, laterText: 'Maybe later', bg: '#ffffff', color: '#1d2433', accent: '#1f3a5f' },
  audience: { type: 'ALL', courseIds: [] }, frequency: { mode: 'once_per_login', maxTimes: 3 },
};
const FREQ: any = { once_ever: 'Only once per user, ever', once_per_login: 'Once on every login', max_total: 'Up to N times in total (once per login)', every_load: 'Every time the website is opened or refreshed' };
const AUD: any = { ALL: 'All users', COURSE: 'Students of selected courses', NO_COURSE: 'Users with no course yet', NEW: 'New users (joined in the last 7 days)' };

export function PopupsPanel() {
  const [list, setList] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const load = () => api('/admin/popups').then(setList);
  useEffect(() => { load(); api('/admin/courses').then(setCourses); }, []);

  const set = (k: string, v: any) => setDraft({ ...draft, [k]: v });
  const sty = (k: string, v: any) => setDraft({ ...draft, style: { ...draft.style, [k]: v } });
  const edit = (p: any) => { setEditId(p.id); setDraft({ ...EMPTY, ...p, image: p.image || '', buttonText: p.buttonText || '', buttonLink: p.buttonLink || '', startAt: toLocal(p.startAt), endAt: toLocal(p.endAt), style: { ...EMPTY.style, ...p.style }, audience: { courseIds: [], ...p.audience }, frequency: { maxTimes: 3, ...p.frequency } }); setMsg(''); window.scrollTo(0, 0); };
  const save = async () => {
    const body = { ...draft, startAt: toIso(draft.startAt), endAt: toIso(draft.endAt) };
    try {
      if (editId) await api(`/admin/popups/${editId}`, { method: 'PATCH', body });
      else { const r = await api('/admin/popups', { method: 'POST', body }); setEditId(r.id); }
      setMsg('Saved'); load();
    } catch (e: any) { setMsg(e.message); }
  };
  const act = async (p: any, what: string) => {
    if (what === 'delete' && !confirm('Delete this popup?')) return;
    if (what === 'delete') await api(`/admin/popups/${p.id}`, { method: 'DELETE' });
    if (what === 'toggle') await api(`/admin/popups/${p.id}`, { method: 'PATCH', body: { ...p, active: !p.active } });
    if (what === 'reset') { await api(`/admin/popups/${p.id}/reset`, { method: 'POST' }); alert('Views reset: it can be shown to everyone again.'); }
    if (what === 'dup') await api('/admin/popups', { method: 'POST', body: { ...p, name: p.name + ' (copy)' } });
    load();
  };
  const pickImage = async (file?: File) => {
    if (!file) return;
    const fd = new FormData(); fd.append('file', file); setPct(0);
    try { const r = await upload('/admin/upload', fd, 'POST', setPct); set('image', r.file); } catch (e: any) { alert(e.message); }
    setPct(null);
  };
  const toggleCourse = (id: string) => { const a = draft.audience.courseIds || []; setDraft({ ...draft, audience: { ...draft.audience, courseIds: a.includes(id) ? a.filter((x: string) => x !== id) : [...a, id] } }); };

  return (
    <div>
      <div className="card"><button className="btn" onClick={() => { setEditId(null); setDraft(JSON.parse(JSON.stringify(EMPTY))); setMsg(''); }}>+ New popup</button></div>
      {list.map((p) => (
        <div className="card" key={p.id}>
          <div className="line" style={{ border: 0 }}>
            <span><b>{p.name}</b> {p.active ? <small className="tag s-ACTIVE">Active</small> : <small className="tag warn">Paused</small>}<br />
              <small className="muted">{AUD[p.audience?.type] || 'All users'} · {FREQ[p.frequency?.mode]?.split(' (')[0]} · shown {p.shown}× to {p.users} user(s)</small></span>
            <span className="row"><button className="btn sm" onClick={() => edit(p)}>Edit</button><button className="btn sm ghost" onClick={() => act(p, 'toggle')}>{p.active ? 'Pause' : 'Activate'}</button><button className="btn sm ghost" onClick={() => act(p, 'dup')}>Duplicate</button><button className="btn sm ghost" onClick={() => act(p, 'reset')}>Reset views</button><button className="btn sm danger" onClick={() => act(p, 'delete')}>Delete</button></span>
          </div>
        </div>
      ))}
      {list.length === 0 && <p className="muted">No popups yet.</p>}

      {draft && (
        <div className="card">
          <h3>{editId ? 'Edit popup' : 'New popup'}</h3>
          <h4>1. Content</h4>
          <label className="fld"><span>Internal name</span><input value={draft.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label className="fld"><span>Title</span><input value={draft.title} onChange={(e) => set('title', e.target.value)} /></label>
          <label className="fld"><span>Message</span><textarea rows={4} value={draft.body} onChange={(e) => set('body', e.target.value)} /></label>
          <div className="fld"><span>Image (optional)</span>
            {draft.image && <div className="row"><img src={media(draft.image)} alt="" style={{ height: 60, borderRadius: 6 }} /><button className="btn sm danger" onClick={() => set('image', '')}>Remove</button></div>}
            <input type="file" accept="image/*" onChange={(e) => pickImage(e.target.files?.[0])} /><Progress pct={pct} />
          </div>
          <div className="row"><label className="fld" style={{ flex: 1 }}><span>Button text</span><input value={draft.buttonText} onChange={(e) => set('buttonText', e.target.value)} /></label>
            <label className="fld" style={{ flex: 1 }}><span>Button link (/courses or https://...)</span><input value={draft.buttonLink} onChange={(e) => set('buttonLink', e.target.value)} /></label></div>

          <h4>2. Design</h4>
          <div className="optgrid">
            <Sel label="Layout" value={draft.style.layout} onChange={(v: string) => sty('layout', v)} opts={[['center', 'Center popup'], ['corner', 'Bottom-right corner card'], ['banner', 'Top banner'], ['full', 'Large / full']]} />
            <Sel label="Theme" value={draft.style.theme} onChange={(v: string) => sty('theme', v)} opts={POPUP_THEMES.map((t) => [t, t[0].toUpperCase() + t.slice(1)])} />
            <Sel label="Size" value={draft.style.size} onChange={(v: string) => sty('size', v)} opts={[['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large']]} />
            <Sel label="Animation" value={draft.style.anim} onChange={(v: string) => sty('anim', v)} opts={[['zoom', 'Zoom in'], ['fade', 'Fade'], ['slide', 'Slide up']]} />
            <Sel label="Image position" value={draft.style.imagePos} onChange={(v: string) => sty('imagePos', v)} opts={[['top', 'Top'], ['left', 'Left'], ['none', 'Hide image']]} />
            <label className="fld"><span>Corner radius: {draft.style.radius}px</span><input type="range" min={0} max={32} value={draft.style.radius} onChange={(e) => sty('radius', +e.target.value)} /></label>
          </div>
          {draft.style.theme === 'custom' && <div className="row">{[['bg', 'Background'], ['color', 'Text'], ['accent', 'Button']].map(([k, l]) => <label className="fld" key={k}><span>{l}</span><input type="color" className="colorpick" value={draft.style[k]} onChange={(e) => sty(k, e.target.value)} /></label>)}</div>}
          <div className="row">
            <label><input type="checkbox" checked={draft.style.overlay !== false} onChange={(e) => sty('overlay', e.target.checked)} /> Dim the page behind</label>
            <label><input type="checkbox" checked={draft.style.closable !== false} onChange={(e) => sty('closable', e.target.checked)} /> Show close (×) button</label>
            <label><input type="checkbox" checked={draft.style.laterBtn !== false} onChange={(e) => sty('laterBtn', e.target.checked)} /> Show "later" button</label>
          </div>
          {draft.style.laterBtn !== false && <label className="fld"><span>"Later" button text</span><input value={draft.style.laterText} onChange={(e) => sty('laterText', e.target.value)} /></label>}

          <h4>3. When and where</h4>
          <div className="optgrid">
            <Sel label="Show on page" value={draft.pages} onChange={(v: string) => set('pages', v)} opts={[['all', 'Any page'], ['home', 'Homepage only'], ['dashboard', 'Dashboard only'], ['courses', 'Courses page only']]} />
            <label className="fld"><span>Delay before showing (seconds)</span><input type="number" min={0} value={draft.delaySec} onChange={(e) => set('delaySec', e.target.value)} /></label>
            <label className="fld"><span>Auto-close after (seconds, 0 = never)</span><input type="number" min={0} value={draft.style.autoClose} onChange={(e) => sty('autoClose', e.target.value)} /></label>
            <label className="fld"><span>Priority (higher shows first)</span><input type="number" value={draft.priority} onChange={(e) => set('priority', e.target.value)} /></label>
            <label className="fld"><span>Start date (optional)</span><input type="datetime-local" value={draft.startAt} onChange={(e) => set('startAt', e.target.value)} /></label>
            <label className="fld"><span>End date (optional)</span><input type="datetime-local" value={draft.endAt} onChange={(e) => set('endAt', e.target.value)} /></label>
          </div>

          <h4>4. Who sees it</h4>
          <Sel label="Audience" value={draft.audience.type} onChange={(v: string) => setDraft({ ...draft, audience: { ...draft.audience, type: v } })} opts={Object.entries(AUD)} />
          {draft.audience.type === 'COURSE' && <div className="fld"><span>Courses (students enrolled in any of these)</span>{courses.map((c) => <label key={c.id} className="opt"><input type="checkbox" checked={(draft.audience.courseIds || []).includes(c.id)} onChange={() => toggleCourse(c.id)} /> {c.title}</label>)}</div>}

          <h4>5. How many times</h4>
          <Sel label="Frequency" value={draft.frequency.mode} onChange={(v: string) => setDraft({ ...draft, frequency: { ...draft.frequency, mode: v } })} opts={Object.entries(FREQ)} />
          {draft.frequency.mode === 'max_total' && <label className="fld"><span>Maximum times per user</span><input type="number" min={1} value={draft.frequency.maxTimes} onChange={(e) => setDraft({ ...draft, frequency: { ...draft.frequency, maxTimes: e.target.value } })} /></label>}
          <label><input type="checkbox" checked={draft.active} onChange={(e) => set('active', e.target.checked)} /> Active</label>

          <PreviewBox title="Popup preview" note={`Layout: ${draft.style.layout}`}><PopupView p={draft} inline onClose={() => {}} onAction={() => {}} /></PreviewBox>
          <div className="row"><button className="btn" onClick={save}>Save popup</button><button className="btn ghost" onClick={() => setDraft(null)}>Close</button>{msg && <span className="ok">{msg}</span>}</div>
        </div>
      )}
    </div>
  );
}

/* ======================= EMAIL ======================= */
export function EmailPanel() {
  const { settings } = useSettings();
  const [cfg, setCfg] = useState<any>(null);
  const [auto, setAuto] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [test, setTest] = useState('');
  const [mail, setMail] = useState({ to: '', subject: '', body: '' });
  const [msg, setMsg] = useState('');
  const loadLogs = () => api('/admin/email/logs').then(setLogs);
  useEffect(() => { api('/admin/email/config').then(setCfg); api('/admin/email/automations').then(setAuto); loadLogs(); }, []);
  if (!cfg || !auto) return <p>Loading…</p>;
  const run = async (fn: () => Promise<any>, ok: string) => { try { await fn(); setMsg(ok); } catch (e: any) { setMsg('Error: ' + e.message); } loadLogs(); };
  const upd = (k: string, p: any) => setAuto({ ...auto, [k]: { ...auto[k], ...p } });

  return (
    <div>
      <div className="card">
        <h3>SMTP (Gmail) settings</h3>
        <p className="muted">For Gmail: turn on 2-Step Verification, create an <b>App password</b> in your Google account and paste it below (not your normal password). Host <code>smtp.gmail.com</code>, port 465 (SSL).</p>
        <div className="optgrid">
          <label className="fld"><span>SMTP host</span><input value={cfg.host} onChange={(e) => setCfg({ ...cfg, host: e.target.value })} /></label>
          <label className="fld"><span>Port</span><input type="number" value={cfg.port} onChange={(e) => setCfg({ ...cfg, port: e.target.value })} /></label>
          <label className="fld"><span>Gmail address (username)</span><input value={cfg.user} onChange={(e) => setCfg({ ...cfg, user: e.target.value })} /></label>
          <label className="fld"><span>App password</span><input type="password" value={cfg.pass} onChange={(e) => setCfg({ ...cfg, pass: e.target.value })} placeholder="16-character app password" /></label>
          <label className="fld"><span>Sender name</span><input value={cfg.fromName} onChange={(e) => setCfg({ ...cfg, fromName: e.target.value })} placeholder={settings.siteName} /></label>
          <label className="fld"><span>From email (optional)</span><input value={cfg.fromEmail} onChange={(e) => setCfg({ ...cfg, fromEmail: e.target.value })} /></label>
        </div>
        <label><input type="checkbox" checked={cfg.secure} onChange={(e) => setCfg({ ...cfg, secure: e.target.checked })} /> Use SSL (port 465). Untick for port 587.</label>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={() => run(() => api('/admin/email/config', { method: 'PATCH', body: cfg }), 'SMTP saved')}>Save SMTP</button>
          <input placeholder="Send test email to..." value={test} onChange={(e) => setTest(e.target.value)} style={{ maxWidth: 260 }} />
          <button className="btn ghost" onClick={() => run(() => api('/admin/email/test', { method: 'POST', body: { to: test } }), 'Test email sent')}>Send test</button>
          {msg && <span className={msg.startsWith('Error') ? 'err' : 'ok'}>{msg}</span>}
        </div>
      </div>

      <div className="card">
        <h3>Email automation</h3>
        <p className="muted">Emails sent automatically. Use {'{{name}}'}, {'{{siteName}}'}, {'{{course}}'}, {'{{reason}}'} in the text.</p>
        {Object.entries(auto).map(([k, a]: any) => (
          <details className="autoitem" key={k}>
            <summary><label onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={a.enabled} onChange={(e) => upd(k, { enabled: e.target.checked })} /></label> <b>{a.label}</b> {a.enabled ? <small className="tag s-ACTIVE">On</small> : <small className="tag warn">Off</small>}</summary>
            <label className="fld"><span>Subject</span><input value={a.subject} onChange={(e) => upd(k, { subject: e.target.value })} /></label>
            <label className="fld"><span>Message (HTML allowed)</span><textarea rows={5} value={a.body} onChange={(e) => upd(k, { body: e.target.value })} /></label>
            <EmailPreview subject={a.subject} body={a.body} siteName={settings.siteName} />
          </details>
        ))}
        <button className="btn" onClick={() => run(() => api('/admin/email/automations', { method: 'PATCH', body: { automations: auto } }), 'Automation saved')}>Save automation</button>
      </div>

      <div className="card">
        <h3>Send an email</h3>
        <input placeholder="To: user email, or type ALL for every user" value={mail.to} onChange={(e) => setMail({ ...mail, to: e.target.value })} />
        <input placeholder="Subject" value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} />
        <textarea rows={5} placeholder="Message" value={mail.body} onChange={(e) => setMail({ ...mail, body: e.target.value })} />
        <EmailPreview subject={mail.subject} body={mail.body.replace(/\n/g, '<br>')} siteName={settings.siteName} />
        <button className="btn" onClick={() => run(() => api('/admin/email/send', { method: 'POST', body: mail }), 'Email queued / sent')}>Send email</button>
      </div>

      <div className="card">
        <div className="line" style={{ border: 0 }}><h3 style={{ margin: 0 }}>Email log</h3><button className="btn sm ghost" onClick={loadLogs}>Refresh</button></div>
        <div className="tablewrap"><table><thead><tr><th>To</th><th>Subject</th><th>Type</th><th>Status</th><th>Time</th></tr></thead><tbody>
          {logs.map((l) => <tr key={l.id}><td>{l.to}</td><td>{l.subject}</td><td>{l.kind}</td><td><span className={'tag ' + (l.status === 'SENT' ? 's-ACTIVE' : 's-SUSPENDED')}>{l.status}</span>{l.error && <><br /><small className="err">{l.error}</small></>}</td><td>{new Date(l.createdAt).toLocaleString()}</td></tr>)}
        </tbody></table></div>
      </div>
    </div>
  );
}

/* ======================= SUPPORT INBOX ======================= */
export function SupportPanel() {
  const [threads, setThreads] = useState<any[]>([]);
  const [sel, setSel] = useStored('support_sel', '');
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const loadThreads = () => api('/admin/support/threads').then(setThreads);
  const loadMsgs = () => (sel ? api(`/admin/support/${sel}`).then(setMsgs) : setMsgs([]));
  useEffect(() => { loadThreads(); const t = setInterval(loadThreads, 8000); return () => clearInterval(t); }, []);
  useEffect(() => { loadMsgs(); const t = setInterval(loadMsgs, 4000); return () => clearInterval(t); }, [sel]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length, sel]);
  const send = async () => {
    if (!text.trim() && !file) return;
    const fd = new FormData(); fd.append('text', text); if (file) fd.append('image', file);
    try { await upload(`/admin/support/${sel}`, fd, 'POST', () => {}); setText(''); setFile(null); loadMsgs(); loadThreads(); } catch (e: any) { alert(e.message); }
  };
  const img = (m: any) => `/api/support/image/${m.image}?token=${token()}`;
  const cur = threads.find((t) => t.userId === sel);

  return (
    <div className="inbox">
      <div className="threads card">
        {threads.length === 0 && <p className="muted">No conversations yet.</p>}
        {threads.map((t) => (
          <button key={t.userId} className={'thread' + (t.userId === sel ? ' on' : '')} onClick={() => setSel(t.userId)}>
            <span className="avatar">{(t.user?.name || '?')[0]}</span>
            <span className="tmeta"><b>{t.user?.name || 'Deleted user'}</b><small>{t.last.image && !t.last.text ? '📷 Photo' : (t.last.text || '').slice(0, 40)}</small></span>
            {t.unread > 0 && <b className="badge2">{t.unread}</b>}
          </button>
        ))}
      </div>
      <div className="card chat" style={{ margin: 0 }}>
        {!sel ? <p className="muted" style={{ padding: 20 }}>Select a conversation.</p> : (
          <>
            <div className="chathead"><b>{cur?.user?.name || 'User'}</b><small className="muted"> {cur?.user?.email}</small></div>
            <div className="chatbody">
              {msgs.map((m) => (
                <div key={m.id} className={'bub ' + (m.from === 'ADMIN' ? 'me' : 'them')}>
                  {m.image && <img src={img(m)} alt="" onClick={() => setZoom(img(m))} />}
                  {m.text && <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>}
                  <small>{new Date(m.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</small>
                </div>
              ))}
              <div ref={end} />
            </div>
            {file && <div className="chatpreview"><img src={URL.createObjectURL(file)} alt="" /><button className="btn sm danger" onClick={() => setFile(null)}>Remove</button></div>}
            <div className="chatbar">
              <input ref={pick} type="file" accept="image/*" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <button className="chatbtn" onClick={() => pick.current?.click()}>📷</button>
              <input value={text} placeholder="Reply…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
              <button className="chatbtn send" onClick={send}>➤</button>
            </div>
          </>
        )}
      </div>
      {zoom && <div className="modal-back" onClick={() => setZoom('')}><img src={zoom} alt="" style={{ maxWidth: '92%', maxHeight: '88vh', borderRadius: 12 }} /></div>}
    </div>
  );
}

/* ======================= TEACHERS ======================= */
export function TeachersPanel() {
  const [apps, setApps] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [filter, setFilter] = useState('PENDING');
  const [email, setEmail] = useState('');
  const load = () => { api('/admin/teacher-applications').then(setApps); api('/admin/teachers').then(setTeachers); };
  useEffect(() => { load(); }, []);
  const approve = async (a: any) => { const note = prompt('Note (optional):', '') ?? ''; await api(`/admin/teacher-applications/${a.id}/approve`, { method: 'POST', body: { note } }).catch((e) => alert(e.message)); load(); };
  const reject = async (a: any) => { const reason = prompt('Reason (user will see this):', ''); if (reason === null) return; await api(`/admin/teacher-applications/${a.id}/reject`, { method: 'POST', body: { reason } }).catch((e) => alert(e.message)); load(); };
  const setRole = async (id: string, role: string) => { await api(`/admin/users/${id}/role`, { method: 'PATCH', body: { role } }).catch((e) => alert(e.message)); load(); };
  const grant = async () => {
    const u = (await api(`/admin/users?q=${encodeURIComponent(email)}`)).find((x: any) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u) return alert('No user with this email');
    await setRole(u.id, 'TEACHER'); setEmail('');
  };
  const shown = apps.filter((a) => a.status === filter);
  return (
    <div>
      <div className="card">
        <h3>Teachers ({teachers.length})</h3>
        <div className="row"><input placeholder="Give teacher access by user email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ maxWidth: 320 }} /><button className="btn" onClick={grant}>Make teacher</button></div>
        {teachers.map((t) => <div className="line" key={t.id}><span><b>{t.name}</b> <small className="muted">{t.email} {t.phone ? '· ' + t.phone : ''}</small></span><button className="btn sm danger" onClick={() => setRole(t.id, 'USER')}>Remove teacher access</button></div>)}
        <p className="muted">Assign courses to a teacher from Courses and plans (Teacher field).</p>
      </div>
      <div className="filters">{['PENDING', 'APPROVED', 'REJECTED'].map((s) => <button key={s} className={'chip' + (filter === s ? ' on' : '')} onClick={() => setFilter(s)}>{s} ({apps.filter((a) => a.status === s).length})</button>)}</div>
      {shown.length === 0 && <p className="muted">No {filter.toLowerCase()} applications.</p>}
      {shown.map((a) => (
        <div className="card" key={a.id}>
          <div className="line" style={{ border: 0 }}><span><b>{a.name}</b> <small className="muted">{a.email} · {a.phone}{a.city ? ' · ' + a.city : ''}</small></span><small className="muted">{new Date(a.createdAt).toLocaleString()}</small></div>
          <div className="answers">
            <div><span className="muted">Qualification: </span>{a.qualification}</div>
            <div><span className="muted">Experience: </span>{a.experienceYears} year(s)</div>
            <div><span className="muted">Subjects: </span>{a.subjects}</div>
            <div><span className="muted">About: </span><span style={{ whiteSpace: 'pre-wrap' }}>{a.bio}</span></div>
            {a.sampleLink && <div><span className="muted">Sample lecture: </span><a href={a.sampleLink} target="_blank" rel="noreferrer">{a.sampleLink}</a></div>}
            {a.cv && <div><span className="muted">CV: </span><a href={`/api/admin/payment-files/${a.cv}?token=${token()}`} target="_blank" rel="noreferrer">Open PDF</a></div>}
            {a.note && <div><span className="muted">Note: </span>{a.note}</div>}
          </div>
          {a.status === 'PENDING' && <div className="row"><button className="btn" onClick={() => approve(a)}>Approve and give teacher access</button><button className="btn danger" onClick={() => reject(a)}>Reject</button></div>}
        </div>
      ))}
    </div>
  );
}

/* ======================= PAYMENT GATEWAYS ======================= */
export function GatewaysPanel() {
  const [c, setC] = useState<any>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/admin/gateways').then(setC); }, []);
  if (!c) return <p>Loading…</p>;
  const j = c.jazzcash, e = c.easypaisa;
  const sj = (k: string, v: any) => setC({ ...c, jazzcash: { ...j, [k]: v } });
  const se = (k: string, v: any) => setC({ ...c, easypaisa: { ...e, [k]: v } });
  const save = async () => { try { await api('/admin/gateways', { method: 'PATCH', body: c }); setMsg('Saved'); setC(await api('/admin/gateways')); } catch (x: any) { setMsg(x.message); } };
  const inp = (label: string, v: any, on: (x: string) => void, type = 'text', ph = '') => <label className="fld"><span>{label}</span><input type={type} value={v || ''} placeholder={ph} onChange={(ev) => on(ev.target.value)} /></label>;
  return (
    <div>
      <div className="card notice">Online payments use the merchant account you get from JazzCash / Easypaisa. Test in <b>sandbox</b> first. Keys are stored encrypted. Manual payment (form + approval) keeps working next to online payment.</div>
      <div className="card">
        <h3>Website address</h3>
        {inp('Public URL of this website (must be reachable by the gateway)', c.publicUrl, (v) => setC({ ...c, publicUrl: v }), 'text', 'https://yourdomain.com')}
        <p className="muted">Return URLs to register with the gateway:<br /><code>{c.publicUrl || 'https://yourdomain.com'}/api/payments/jazzcash/return</code><br /><code>{c.publicUrl || 'https://yourdomain.com'}/api/payments/easypaisa/return</code></p>
      </div>
      <div className="card">
        <h3>JazzCash</h3>
        <label><input type="checkbox" checked={!!j.enabled} onChange={(ev) => sj('enabled', ev.target.checked)} /> Enable JazzCash checkout</label>
        <div className="optgrid">
          <label className="fld"><span>Environment</span><select value={j.env || 'sandbox'} onChange={(ev) => sj('env', ev.target.value)}><option value="sandbox">Sandbox (testing)</option><option value="production">Production (live)</option></select></label>
          {inp('Merchant ID', j.merchantId, (v) => sj('merchantId', v))}
          {inp('Password', j.password, (v) => sj('password', v), 'password')}
          {inp('Integrity salt', j.salt, (v) => sj('salt', v), 'password')}
          {inp('Checkout URL override (optional)', j.checkoutUrl, (v) => sj('checkoutUrl', v))}
        </div>
        <p className="muted">Access is granted automatically only after JazzCash returns a verified (signed) success response with the same amount.</p>
      </div>
      <div className="card">
        <h3>Easypaisa</h3>
        <label><input type="checkbox" checked={!!e.enabled} onChange={(ev) => se('enabled', ev.target.checked)} /> Enable Easypaisa checkout</label>
        <div className="optgrid">
          <label className="fld"><span>Environment</span><select value={e.env || 'sandbox'} onChange={(ev) => se('env', ev.target.value)}><option value="sandbox">Sandbox (testing)</option><option value="production">Production (live)</option></select></label>
          {inp('Store ID', e.storeId, (v) => se('storeId', v))}
          {inp('Hash key', e.hashKey, (v) => se('hashKey', v), 'password')}
          {inp('Payment method value', e.paymentMethod, (v) => se('paymentMethod', v), 'text', 'InitialRequest')}
          {inp('Checkout URL override (optional)', e.checkoutUrl, (v) => se('checkoutUrl', v))}
        </div>
        <p className="muted">After the user pays, the request appears in <b>Payment requests</b> marked EASYPAISA. Confirm it in your Easypay portal and press Approve.</p>
      </div>
      <PreviewBox title="Checkout buttons preview" note="Shown on the checkout page when enabled">
        <div className="card"><b>Pay securely online</b><div className="row" style={{ marginTop: 8 }}>
          {j.enabled && <span className="btn gw jazz">Pay with JazzCash</span>}{e.enabled && <span className="btn gw easy">Pay with Easypaisa</span>}
          {!j.enabled && !e.enabled && <span className="muted">Enable a gateway to show its button.</span>}</div></div>
      </PreviewBox>
      <div className="row"><button className="btn" onClick={save}>Save gateways</button>{msg && <span className="ok">{msg}</span>}</div>
    </div>
  );
}
