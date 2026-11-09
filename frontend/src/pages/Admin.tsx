import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, media, upload } from '../api';
import { useStored } from '../useStored';
import Progress from '../components/Progress';
import HomepageBuilder from './HomepageBuilder';
import LabsPanel from './AdminLabs';
import { UsersPanel, MessagesPanel, EnrollmentsPanel, PaymentsPanel, CheckoutPanel } from './AdminExtra';
import { parseMenu, useSettings } from '../settings';

const TABS = ['Overview', 'Homepage', 'Courses', 'Videos', 'Slides', 'Categories', 'Header', 'Course categories', 'Reviews', 'Users', 'Payments', 'Checkout', 'Enrollments', 'Messages', 'Settings'];

const GROUPS = [
  { name: 'Overview', items: [{ id: 'Overview', label: 'Dashboard', icon: '📊' }] },
  { name: 'Website', items: [
    { id: 'Homepage', label: 'Homepage builder', icon: '🏠' }, { id: 'Header', label: 'Header and menu', icon: '🧭' },
    { id: 'Slides', label: 'Image slides', icon: '🖼️' }, { id: 'Settings', label: 'Settings', icon: '⚙️' }] },
  { name: 'Courses', items: [
    { id: 'Courses', label: 'Courses and plans', icon: '📚' }, { id: 'Videos', label: 'Lectures (videos)', icon: '🎬' },
    { id: 'Labs', label: 'Labs and quizzes', icon: '🧪' }, { id: 'Categories', label: 'Categories', icon: '🏷️' }, { id: 'Course categories', label: 'Category display', icon: '🗂️' }] },
  { name: 'Students', items: [
    { id: 'Users', label: 'Users and activity', icon: '👥' }, { id: 'Enrollments', label: 'Enrollments', icon: '🎓' },
    { id: 'Payments', label: 'Payment requests', icon: '💳' }, { id: 'Checkout', label: 'Checkout page', icon: '🔒' },
    { id: 'Messages', label: 'Messages', icon: '✉️' }, { id: 'Reviews', label: 'Reviews', icon: '⭐' }] },
];

export default function Admin() {
  const [sp, setSp] = useSearchParams();   // tab URL mein: refresh par wahi page
  const tab = sp.get('tab') || 'Overview';
  const setTab = (t: string) => setSp({ tab: t });
  const [pending, setPending] = useState(0);
  useEffect(() => {
    const f = () => api('/admin/stats').then((s) => setPending(s['pending payments'] || 0)).catch(() => {});
    f(); const i = setInterval(f, 30000); return () => clearInterval(i);
  }, [tab]);
  const label = GROUPS.flatMap((g) => g.items).find((i) => i.id === tab)?.label || tab;
  return (
    <div className="adminwrap">
      <aside className="adminnav">
        {GROUPS.map((g) => (
          <div key={g.name}>
            <div className="angroup">{g.name}</div>
            {g.items.map((it) => (
              <button key={it.id} className={'anitem' + (tab === it.id ? ' on' : '')} onClick={() => setTab(it.id)}>
                <span className="anicon">{it.icon}</span><span>{it.label}</span>
                {it.id === 'Payments' && pending > 0 && <b className="badge2">{pending}</b>}
              </button>
            ))}
          </div>
        ))}
      </aside>
      <section className="admincontent">
        <h1>{label}</h1>
        {tab === 'Overview' && <Overview go={setTab} />}
        {tab === 'Homepage' && <HomepageBuilder />}
        {tab === 'Courses' && <CoursesTab />}
        {tab === 'Videos' && <VideosTab />}
        {tab === 'Labs' && <LabsPanel />}
        {tab === 'Slides' && <SlidesTab />}
        {tab === 'Categories' && <CategoriesTab />}
        {tab === 'Header' && <HeaderTab />}
        {tab === 'Course categories' && <CourseCategoriesTab />}
        {tab === 'Reviews' && <ReviewsTab />}
        {tab === 'Users' && <UsersPanel />}
        {tab === 'Payments' && <PaymentsPanel />}
        {tab === 'Checkout' && <CheckoutPanel />}
        {tab === 'Enrollments' && <EnrollmentsPanel />}
        {tab === 'Messages' && <MessagesPanel />}
        {tab === 'Settings' && <SettingsTab />}
      </section>
    </div>
  );
}

function Overview({ go }: { go: (t: string) => void }) {
  const [s, setS] = useState<any>({});
  const [pay, setPay] = useState<any[]>([]);
  const [act, setAct] = useState<any[]>([]);
  useEffect(() => {
    api('/admin/stats').then(setS);
    api('/admin/payments?status=PENDING').then((r) => setPay(r.slice(0, 5)));
    api('/admin/activity').then((r) => setAct(r.slice(0, 8)));
  }, []);
  const cards = [['👥', 'users', 'Students'], ['🟢', 'online now', 'Online now'], ['📚', 'courses', 'Courses'], ['🎓', 'enrollments', 'Enrollments'], ['💳', 'pending payments', 'Pending payments'], ['⭐', 'reviews', 'Reviews']];
  return (
    <>
      <div className="statcards">
        {cards.map(([icon, k, label]) => (
          <div className="statcard" key={k}><span className="sicon">{icon}</span><div><b>{s[k] ?? '–'}</b><small>{label}</small></div></div>
        ))}
      </div>
      <div className="twocol">
        <div className="card">
          <div className="line"><h3 style={{ margin: 0 }}>Pending payments</h3><button className="btn sm ghost" onClick={() => go('Payments')}>Open</button></div>
          {pay.length === 0 && <p className="muted">Nothing waiting for review.</p>}
          {pay.map((p) => <div className="line" key={p.id}><span>{p.user.name} <small className="muted">→ {p.course.title}</small></span><small className="muted">{new Date(p.createdAt).toLocaleString()}</small></div>)}
        </div>
        <div className="card">
          <div className="line"><h3 style={{ margin: 0 }}>Recent login activity</h3><button className="btn sm ghost" onClick={() => go('Users')}>Open</button></div>
          {act.length === 0 && <p className="muted">No activity yet.</p>}
          {act.map((a) => <div className="line" key={a.id}><span className={a.type.includes('FAILED') || a.type.includes('BLOCKED') ? 'err' : 'ok'}>{a.type.replace('_', ' ')}</span><small className="muted">{a.email}</small><small className="muted">{new Date(a.createdAt).toLocaleString()}</small></div>)}
        </div>
      </div>
    </>
  );
}

function CategoriesTab() {
  const [list, setList] = useState<any[]>([]);
  const [name, setName] = useState('');
  const load = () => api('/categories').then(setList);
  useEffect(() => { load(); }, []);
  const add = async () => { if (name.trim()) { await api('/admin/categories', { method: 'POST', body: { name } }).catch((e) => alert(e.message)); setName(''); load(); } };
  const rename = async (c: any) => { const name = prompt('Category name', c.name); if (name && name.trim()) { await api(`/admin/categories/${c.id}`, { method: 'PATCH', body: { name } }).catch((e) => alert(e.message)); load(); } };
  const del = async (id: string) => { if (confirm('Delete category?')) { await api(`/admin/categories/${id}`, { method: 'DELETE' }); load(); } };
  return (
    <div className="card">
      <div className="row"><input placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn" onClick={add}>Add</button></div>
      {list.map((c) => <div className="line" key={c.id}><span>{c.name}</span><span className="row"><button className="btn ghost" onClick={() => rename(c)}>Rename</button><button className="btn danger" onClick={() => del(c.id)}>Delete</button></span></div>)}
    </div>
  );
}

function SlidesTab() {
  const [list, setList] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [pct, setPct] = useState<number | null>(null);
  const load = () => api('/admin/slides').then(setList);
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!file) return alert('Choose an image');
    const f = new FormData(); f.append('caption', caption); f.append('image', file);
    setPct(0);
    try { await upload('/admin/slides', f, 'POST', setPct); setFile(null); setCaption(''); load(); } catch (e: any) { alert(e.message); }
    setPct(null);
  };
  const editCap = async (s: any) => { const c = prompt('Caption', s.caption || ''); if (c !== null) { await api(`/admin/slides/${s.id}`, { method: 'PATCH', body: { caption: c } }); load(); } };
  const move = async (i: number, d: number) => {
    const a = [...list]; const j = i + d; if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    await Promise.all(a.map((s, k) => api(`/admin/slides/${s.id}`, { method: 'PATCH', body: { order: k + 1 } })));
    load();
  };
  const del = async (id: string) => { await api(`/admin/slides/${id}`, { method: 'DELETE' }); load(); };
  return (
    <div className="card">
      <div className="row"><input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /><input placeholder="Caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} /><button className="btn" onClick={add}>Upload slide</button></div>
      <Progress pct={pct} />
      <div className="grid small">{list.map((s, i) => <div key={s.id} className="mini"><img src={media(s.image)} alt="" /><small className="muted">{s.caption || 'No caption'}</small><div className="row"><button className="btn sm ghost" onClick={() => move(i, -1)}>◀</button><button className="btn sm ghost" onClick={() => move(i, 1)}>▶</button><button className="btn sm ghost" onClick={() => editCap(s)}>Caption</button><button className="btn sm danger" onClick={() => del(s.id)}>Delete</button></div></div>)}</div>
    </div>
  );
}

function CoursesTab() {
  const empty = { title: '', description: '', price: '0', categoryId: '', published: true, plan: 'FREE', durationDays: '0' };
  const [list, setList] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [thumb, setThumb] = useState<File | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [managing, setManaging] = useState<any>(null);
  const load = () => api('/admin/courses').then(setList);
  useEffect(() => { load(); api('/categories').then(setCats); }, []);

  const save = async () => {
    const f = new FormData();
    Object.entries(form).forEach(([k, v]) => f.append(k, String(v)));
    if (thumb) f.append('thumbnail', thumb);
    setPct(0);
    try { await upload(editId ? `/admin/courses/${editId}` : '/admin/courses', f, editId ? 'PATCH' : 'POST', setPct); setForm(empty); setEditId(null); setThumb(null); load(); } catch (e: any) { alert(e.message); }
    setPct(null);
  };
  const edit = (c: any) => { setEditId(c.id); setForm({ title: c.title, description: c.description, price: String(c.price), categoryId: c.categoryId || '', published: c.published, plan: c.plan || 'FREE', durationDays: String(c.durationDays || 0) }); window.scrollTo(0, 0); };
  const del = async (id: string) => { if (confirm('Delete course and all its videos?')) { await api(`/admin/courses/${id}`, { method: 'DELETE' }); load(); } };

  return (
    <>
      <div className="card">
        <h3>{editId ? 'Edit course' : 'Post a new course'}</h3>
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea rows={4} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="row">
          <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}><option value="FREE">Free plan</option><option value="PREMIUM">Premium plan (checkout)</option></select>
          {form.plan === 'PREMIUM' && <><input placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /><input placeholder="Access days (0 = lifetime)" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} /></>}
          <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">No category</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <label><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> Published</label>
        </div>
        <label className="muted">Thumbnail <input type="file" accept="image/*" onChange={(e) => setThumb(e.target.files?.[0] || null)} /></label>
        <Progress pct={pct} />
        <div className="row"><button className="btn" onClick={save}>{editId ? 'Save changes' : 'Post course'}</button>{editId && <button className="btn ghost" onClick={() => { setEditId(null); setForm(empty); }}>Cancel</button>}</div>
      </div>
      <div className="card">
        {list.map((c) => (
          <div className="line" key={c.id}>
            <span><b>{c.title}</b> {c.plan === 'PREMIUM' ? <small className="tag warn">Premium</small> : <small className="tag">Free</small>} <small className="muted">{c._count.lessons} videos · {c._count.enrollments} students {!c.published && '· draft'}</small></span>
            <span className="row"><button className="btn" onClick={() => setManaging(c)}>Videos & files</button><button className="btn ghost" onClick={() => edit(c)}>Edit</button><button className="btn danger" onClick={() => del(c.id)}>Delete</button></span>
          </div>
        ))}
      </div>
      {managing && <Lessons course={managing} onClose={() => { setManaging(null); load(); }} />}
    </>
  );
}

function Lessons({ course, onClose }: { course: any; onClose?: () => void }) {
  const [list, setList] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [section, setSection] = useState('');
  const [video, setVideo] = useState<File | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [fpct, setFpct] = useState<{ id: string; n: number } | null>(null);
  const load = () => api(`/admin/courses/${course.id}/lessons`).then(setList);
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!video) return alert('Choose a video');
    const f = new FormData(); f.append('title', title); f.append('section', section); f.append('video', video);
    setPct(0);
    try { await upload(`/admin/courses/${course.id}/lessons`, f, 'POST', setPct); setTitle(''); setVideo(null); load(); } catch (e: any) { alert(e.message); }
    setPct(null);
  };
  const addFile = async (lid: string, file: File) => {
    const f = new FormData(); f.append('file', file);
    setFpct({ id: lid, n: 0 });
    try { await upload(`/admin/lessons/${lid}/files`, f, 'POST', (n) => setFpct({ id: lid, n })); load(); } catch (e: any) { alert(e.message); }
    setFpct(null);
  };
  const editL = async (l: any) => { const t = prompt('Video title', l.title); if (t === null) return; const o = prompt('Order number', String(l.order)); if (o === null) return; const sec = prompt('Section / module', l.section || ''); if (sec === null) return; const desc = prompt('Lecture description (optional)', l.description || ''); if (desc === null) return; await api(`/admin/lessons/${l.id}`, { method: 'PATCH', body: { title: t, order: o, section: sec, description: desc } }); load(); };
  const delL = async (id: string) => { if (confirm('Delete video?')) { await api(`/admin/lessons/${id}`, { method: 'DELETE' }); load(); } };
  const delF = async (id: string) => { await api(`/admin/files/${id}`, { method: 'DELETE' }); load(); };

  return (
    <div className="card manage">
      <div className="line"><h3>Videos: {course.title}</h3>{onClose && <button className="btn ghost" onClick={onClose}>Close</button>}</div>
      <div className="row"><input placeholder="Lecture title" value={title} onChange={(e) => setTitle(e.target.value)} /><input placeholder="Section / module (optional)" value={section} onChange={(e) => setSection(e.target.value)} /><input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] || null)} /><button className="btn" onClick={add}>Upload video</button></div>
      <Progress pct={pct} label="Uploading video" />
      {list.map((l) => (
        <div className="lesson" key={l.id}>
          <div className="line"><b>{l.order}. {l.title}</b> {l.section && <small className="tag">{l.section}</small>}<span className="row"><button className="btn sm ghost" onClick={() => editL(l)}>Edit</button><button className="btn sm danger" onClick={() => delL(l.id)}>Delete</button></span></div>
          {l.files.map((f: any) => <div className="line sub" key={f.id}><span>📎 {f.name}</span><button className="btn danger" onClick={() => delF(f.id)}>Remove</button></div>)}
          <label className="muted">Add notes/file (optional): <input type="file" onChange={(e) => e.target.files?.[0] && addFile(l.id, e.target.files[0])} /></label>
          {fpct?.id === l.id && <Progress pct={fpct.n} label="Uploading file" />}
        </div>
      ))}
    </div>
  );
}

function ReviewsTab() {
  const [list, setList] = useState<any[]>([]);
  const load = () => api('/admin/reviews').then(setList);
  useEffect(() => { load(); }, []);
  const patch = async (id: string, body: any) => { await api(`/admin/reviews/${id}`, { method: 'PATCH', body }); load(); };
  const del = async (id: string) => { if (confirm('Delete review?')) { await api(`/admin/reviews/${id}`, { method: 'DELETE' }); load(); } };
  return (
    <div>
      {list.length === 0 && <p className="muted">No reviews yet.</p>}
      {list.map((r) => <ReviewRow key={r.id} r={r} patch={patch} del={del} />)}
    </div>
  );
}
function ReviewRow({ r, patch, del }: any) {
  const [c, setC] = useState(r.comment);
  const [n, setN] = useState(r.rating);
  return (
    <div className="card">
      <small className="muted">{r.user.name} · {r.user.email} · {new Date(r.createdAt).toLocaleString()} · <b>{r.status}</b></small>
      <textarea rows={2} value={c} onChange={(e) => setC(e.target.value)} />
      <div className="row">
        <select value={n} onChange={(e) => setN(+e.target.value)}>{[5, 4, 3, 2, 1].map((x) => <option key={x} value={x}>{x} stars</option>)}</select>
        <button className="btn" onClick={() => patch(r.id, { comment: c, rating: n })}>Save edit</button>
        <button className="btn ghost" onClick={() => patch(r.id, { status: r.status === 'VISIBLE' ? 'HIDDEN' : 'VISIBLE' })}>{r.status === 'VISIBLE' ? 'Hide' : 'Show'}</button>
        <button className="btn danger" onClick={() => del(r.id)}>Delete</button>
      </div>
    </div>
  );
}

function UsersTab() {
  const [q, setQ] = useState('');
  const [list, setList] = useState<any[]>([]);
  const load = () => api(`/admin/users?q=${encodeURIComponent(q)}`).then(setList);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q]);

  const act = async (u: any, action: string) => {
    let reason: string | null = '';
    if (action === 'warn' || action === 'suspend') { reason = prompt(`Reason for ${action} (user will see this):`, ''); if (reason === null) return; }
    if (action === 'delete' && !confirm(`Delete ${u.email} permanently?`)) return;
    try {
      const r = await api(`/admin/users/${u.id}/action`, { method: 'PATCH', body: { action, reason } });
      if (r.tempPassword) alert(`Temporary password for ${u.email}: ${r.tempPassword}`);
      load();
    } catch (e: any) { alert(e.message); }
  };
  const editU = async (u: any) => {
    const name = prompt('Name', u.name); if (name === null) return;
    const email = prompt('Email', u.email); if (email === null) return;
    try { await api(`/admin/users/${u.id}`, { method: 'PATCH', body: { name, email } }); load(); } catch (e: any) { alert(e.message); }
  };
  const msg = async (u: any) => {
    const title = prompt('Message title:'); if (!title) return;
    const message = prompt('Message:'); if (!message) return;
    await api('/admin/message', { method: 'POST', body: { email: u.email, title, message } });
    alert('Sent');
  };

  return (
    <div className="card">
      <input placeholder="Search by email or name" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="tablewrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Warnings</th><th>Courses</th><th>Last login</th><th>Actions</th></tr></thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td><td>{u.email}</td>
                <td><span className={'tag s-' + u.status}>{u.role === 'SUPER_ADMIN' ? 'ADMIN' : u.status}</span></td>
                <td>{u.warnings}</td><td>{u._count.enrollments}</td><td>{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : '-'}</td>
                <td>
                  {u.role !== 'SUPER_ADMIN' && (
                    <div className="row">
                      <button className="btn sm" onClick={() => editU(u)}>Edit</button>
                      <button className="btn sm" onClick={() => msg(u)}>Message</button>
                      <button className="btn sm ghost" onClick={() => act(u, 'warn')}>Warn</button>
                      {u.status === 'SUSPENDED' ? <button className="btn sm" onClick={() => act(u, 'activate')}>Activate</button> : <button className="btn sm ghost" onClick={() => act(u, 'suspend')}>Suspend</button>}
                      {u.warnings > 0 && <button className="btn sm ghost" onClick={() => act(u, 'clear_warnings')}>Clear warnings</button>}
                      <button className="btn sm ghost" onClick={() => act(u, 'reset_password')}>Reset password</button>
                      <button className="btn sm danger" onClick={() => act(u, 'delete')}>Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MessagesTab() {
  const [f, setF] = useState({ email: '', title: '', message: '' });
  const [res, setRes] = useState('');
  const send = async () => {
    try { const r = await api('/admin/message', { method: 'POST', body: f }); setRes(`Sent to ${r.sent} user(s)`); setF({ email: '', title: '', message: '' }); } catch (e: any) { setRes(e.message); }
  };
  return (
    <div className="card">
      <h3>Send notification</h3>
      <input placeholder="User email (leave empty to send to ALL users)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <input placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <textarea rows={3} placeholder="Message" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
      <button className="btn" onClick={send}>Send</button>
      {res && <p className="muted">{res}</p>}
    </div>
  );
}

// Videos tab: course select karo, video + notes upload karo -> enrolled users ke dashboard mein show hoga
function VideosTab() {
  const [courses, setCourses] = useState<any[]>([]);
  const [sel, setSel] = useStored('sel_videos', '');
  useEffect(() => { api('/admin/courses').then(setCourses); }, []);
  const course = courses.find((c) => c.id === sel);
  return (
    <div>
      <div className="card">
        <h3>Upload videos and notes</h3>
        <select value={sel} onChange={(e) => setSel(e.target.value)}>
          <option value="">Select a course</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <p className="muted">Uploaded videos and files appear in the dashboard of every enrolled student.</p>
      </div>
      {course && <Lessons key={course.id} course={course} />}
    </div>
  );
}

// Admin kisi bhi course mein student add / remove kar sakta hai
function EnrollmentsTab() {
  const [courses, setCourses] = useState<any[]>([]);
  const [sel, setSel] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/admin/courses').then(setCourses); }, []);
  const load = () => (sel ? api(`/admin/courses/${sel}/enrollments`).then(setList) : setList([]));
  useEffect(() => { load(); }, [sel]);
  const add = async () => {
    try { await api(`/admin/courses/${sel}/enrollments`, { method: 'POST', body: { email } }); setEmail(''); setMsg(''); load(); } catch (e: any) { setMsg(e.message); }
  };
  const remove = async (id: string) => { if (confirm('Remove this student from the course?')) { await api(`/admin/enrollments/${id}`, { method: 'DELETE' }); load(); } };
  return (
    <div className="card">
      <select value={sel} onChange={(e) => setSel(e.target.value)}>
        <option value="">Select a course</option>
        {courses.map((c) => <option key={c.id} value={c.id}>{c.title} ({c._count.enrollments})</option>)}
      </select>
      {sel && (
        <>
          <div className="row"><input placeholder="Student email to enroll" value={email} onChange={(e) => setEmail(e.target.value)} /><button className="btn" onClick={add}>Enroll student</button></div>
          {msg && <p className="err">{msg}</p>}
          {list.length === 0 && <p className="muted">No students enrolled yet.</p>}
          {list.map((e) => <div className="line" key={e.id}><span>{e.user.name} <small className="muted">{e.user.email}</small></span><button className="btn sm danger" onClick={() => remove(e.id)}>Remove</button></div>)}
        </>
      )}
    </div>
  );
}

// Portal ka naam, tagline, footer, headings, contact, color
function SettingsTab() {
  const { settings, reload } = useSettings();
  const [f, setF] = useState<any>(settings);
  const [msg, setMsg] = useState('');
  useEffect(() => { setF(settings); }, [settings]);
  const field = (k: string, label: string) => (
    <label key={k}>{label}<input value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  );
  const save = async () => { await api('/admin/settings', { method: 'PATCH', body: f }); await reload(); setMsg('Saved'); };
  return (
    <div className="card">
      <h3>Portal settings</h3>
      {field('siteName', 'Portal name')}
      {field('tagline', 'Homepage tagline (shown when no slides)')}
      {field('coursesTitle', 'Courses section heading')}
      {field('reviewsTitle', 'Reviews section heading')}
      {field('footerText', 'Footer text')}
      {field('contactEmail', 'Contact email')}
      {field('currency', 'Currency symbol (e.g. Rs, $)')}
      <label>Brand color <input type="color" className="colorpick" value={f.brandColor || '#1f3a5f'} onChange={(e) => setF({ ...f, brandColor: e.target.value })} /></label>
      <div className="row"><button className="btn" onClick={save}>Save settings</button>{msg && <span className="ok">{msg}</span>}</div>
    </div>
  );
}

const siteChanged = () => window.dispatchEvent(new Event('site-changed'));

// Header panel: konse pages/links aur konsi categories header mein dikhani hain
function HeaderTab() {
  const { settings, reload } = useSettings();
  const [menu, setMenu] = useState<any[]>([]);
  const [showCats, setShowCats] = useState(true);
  const [cats, setCats] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  useEffect(() => { setMenu(parseMenu(settings.headerMenu, true)); setShowCats(settings.headerShowCategories !== 'false'); }, [settings]);
  useEffect(() => { api('/categories').then(setCats); }, []);

  const upd = (i: number, p: any) => setMenu(menu.map((m, k) => (k === i ? { ...m, ...p } : m)));
  const move = (i: number, d: number) => {
    const a = [...menu]; const j = i + d; if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]]; setMenu(a);
  };
  const save = async () => {
    await api('/admin/settings', { method: 'PATCH', body: { headerMenu: JSON.stringify(menu), headerShowCategories: String(showCats) } });
    await Promise.all(cats.map((c) => api(`/admin/categories/${c.id}`, { method: 'PATCH', body: { showInHeader: c.showInHeader } })));
    await reload(); siteChanged(); setMsg('Saved. Header updated.');
  };

  return (
    <>
      <div className="card">
        <h3>Header pages and links</h3>
        <p className="muted">Tick the pages you want in the header. Edit the name or path, and change the order with the arrows.</p>
        {menu.map((m, i) => (
          <div className="row hrow" key={m.id}>
            <label><input type="checkbox" checked={m.show} onChange={(e) => upd(i, { show: e.target.checked })} /> Show</label>
            <input placeholder="Label" value={m.label} onChange={(e) => upd(i, { label: e.target.value })} />
            <input placeholder="/path or https://..." value={m.to} onChange={(e) => upd(i, { to: e.target.value })} />
            <button className="btn sm ghost" onClick={() => move(i, -1)}>▲</button>
            <button className="btn sm ghost" onClick={() => move(i, 1)}>▼</button>
            <button className="btn sm danger" onClick={() => setMenu(menu.filter((_, k) => k !== i))}>Remove</button>
          </div>
        ))}
        <button className="btn ghost" onClick={() => setMenu([...menu, { id: 'c' + Date.now(), label: 'New link', to: '/', show: true }])}>+ Add link</button>
      </div>
      <div className="card">
        <h3>Categories in header</h3>
        <label><input type="checkbox" checked={showCats} onChange={(e) => setShowCats(e.target.checked)} /> Show categories in header</label>
        {showCats && cats.map((c, i) => (
          <label className="line" key={c.id}>
            <span>{c.name}</span>
            <input type="checkbox" checked={c.showInHeader} onChange={(e) => setCats(cats.map((x, k) => (k === i ? { ...x, showInHeader: e.target.checked } : x)))} />
          </label>
        ))}
        {cats.length === 0 && <p className="muted">No categories yet. Add them in the Categories tab.</p>}
      </div>
      <div className="row"><button className="btn" onClick={save}>Save header</button>{msg && <span className="ok">{msg}</span>}</div>
    </>
  );
}

// Courses page par konsi categories dikhani hain (alag panel)
function CourseCategoriesTab() {
  const [cats, setCats] = useState<any[]>([]);
  const load = () => api('/categories').then(setCats);
  useEffect(() => { load(); }, []);
  const set = async (c: any, body: any) => { await api(`/admin/categories/${c.id}`, { method: 'PATCH', body }); await load(); siteChanged(); };
  const move = async (i: number, d: number) => {
    const a = [...cats]; const j = i + d; if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    await Promise.all(a.map((c, k) => api(`/admin/categories/${c.id}`, { method: 'PATCH', body: { order: k + 1 } })));
    await load(); siteChanged();
  };
  return (
    <div className="card">
      <h3>Categories on the Courses page</h3>
      <p className="muted">Choose which categories appear as filters on the Courses page, and their order. Hidden categories still keep their courses under "All".</p>
      {cats.length === 0 && <p className="muted">No categories yet.</p>}
      {cats.map((c, i) => (
        <div className="line" key={c.id}>
          <label><input type="checkbox" checked={c.showInCourses} onChange={(e) => set(c, { showInCourses: e.target.checked })} /> {c.name}</label>
          <span className="row"><button className="btn sm ghost" onClick={() => move(i, -1)}>▲</button><button className="btn sm ghost" onClick={() => move(i, 1)}>▼</button></span>
        </div>
      ))}
    </div>
  );
}
