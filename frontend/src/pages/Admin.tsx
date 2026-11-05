import { useEffect, useState } from 'react';
import { api, media, upload } from '../api';
import Progress from '../components/Progress';
import { useSettings } from '../settings';

const TABS = ['Overview', 'Courses', 'Videos', 'Slides', 'Categories', 'Reviews', 'Users', 'Enrollments', 'Messages', 'Settings'];

export default function Admin() {
  const [tab, setTab] = useState('Overview');
  return (
    <div className="page">
      <h1>Admin panel</h1>
      <div className="filters">{TABS.map((t) => <button key={t} className={'chip' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === 'Overview' && <Overview />}
      {tab === 'Courses' && <CoursesTab />}
      {tab === 'Videos' && <VideosTab />}
      {tab === 'Slides' && <SlidesTab />}
      {tab === 'Categories' && <CategoriesTab />}
      {tab === 'Reviews' && <ReviewsTab />}
      {tab === 'Users' && <UsersTab />}
      {tab === 'Messages' && <MessagesTab />}
      {tab === 'Enrollments' && <EnrollmentsTab />}
      {tab === 'Settings' && <SettingsTab />}
    </div>
  );
}

function Overview() {
  const [s, setS] = useState<any>({});
  useEffect(() => { api('/admin/stats').then(setS); }, []);
  return <div className="stats">{Object.entries(s).map(([k, v]: any) => <div className="card stat" key={k}><b>{v}</b><span>{k}</span></div>)}</div>;
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
  const empty = { title: '', description: '', price: '0', categoryId: '', published: true };
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
  const edit = (c: any) => { setEditId(c.id); setForm({ title: c.title, description: c.description, price: String(c.price), categoryId: c.categoryId || '', published: c.published }); window.scrollTo(0, 0); };
  const del = async (id: string) => { if (confirm('Delete course and all its videos?')) { await api(`/admin/courses/${id}`, { method: 'DELETE' }); load(); } };

  return (
    <>
      <div className="card">
        <h3>{editId ? 'Edit course' : 'Post a new course'}</h3>
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea rows={4} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="row">
          <input placeholder="Price (0 = free)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
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
            <span><b>{c.title}</b> <small className="muted">{c._count.lessons} videos · {c._count.enrollments} students {!c.published && '· draft'}</small></span>
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
  const [video, setVideo] = useState<File | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [fpct, setFpct] = useState<{ id: string; n: number } | null>(null);
  const load = () => api(`/admin/courses/${course.id}/lessons`).then(setList);
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!video) return alert('Choose a video');
    const f = new FormData(); f.append('title', title); f.append('video', video);
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
  const editL = async (l: any) => { const t = prompt('Video title', l.title); if (t === null) return; const o = prompt('Order number', String(l.order)); await api(`/admin/lessons/${l.id}`, { method: 'PATCH', body: { title: t, order: o } }); load(); };
  const delL = async (id: string) => { if (confirm('Delete video?')) { await api(`/admin/lessons/${id}`, { method: 'DELETE' }); load(); } };
  const delF = async (id: string) => { await api(`/admin/files/${id}`, { method: 'DELETE' }); load(); };

  return (
    <div className="card manage">
      <div className="line"><h3>Videos: {course.title}</h3>{onClose && <button className="btn ghost" onClick={onClose}>Close</button>}</div>
      <div className="row"><input placeholder="Video title" value={title} onChange={(e) => setTitle(e.target.value)} /><input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] || null)} /><button className="btn" onClick={add}>Upload video</button></div>
      <Progress pct={pct} label="Uploading video" />
      {list.map((l) => (
        <div className="lesson" key={l.id}>
          <div className="line"><b>{l.order}. {l.title}</b><span className="row"><button className="btn sm ghost" onClick={() => editL(l)}>Edit</button><button className="btn sm danger" onClick={() => delL(l.id)}>Delete</button></span></div>
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
  const [sel, setSel] = useState('');
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
      <label>Brand color <input type="color" className="colorpick" value={f.brandColor || '#0f6b5c'} onChange={(e) => setF({ ...f, brandColor: e.target.value })} /></label>
      <div className="row"><button className="btn" onClick={save}>Save settings</button>{msg && <span className="ok">{msg}</span>}</div>
    </div>
  );
}
