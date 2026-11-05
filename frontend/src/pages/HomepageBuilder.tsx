import { useEffect, useRef, useState } from 'react';
import { api, media, upload } from '../api';
import Progress from '../components/Progress';
import { DEFAULT_SECTIONS } from '../homeDefaults';

export type F = { k: string; label: string; t: string; fields?: F[]; add?: string; opts?: string[]; ph?: string; multi?: string };
const T = (k: string, label: string, ph?: string): F => ({ k, label, t: 'text', ph });
const A = (k: string, label: string): F => ({ k, label, t: 'area' });
const I = (k: string, label: string): F => ({ k, label, t: 'image' });
const L = (k: string, label: string, add: string, fields: F[]): F => ({ k, label, t: 'list', add, fields });
const BG: F[] = [T('bg', 'Section background (color or CSS gradient)', '#ffffff or linear-gradient(...)'), T('color', 'Text color', '#14232b')];
const LINK = 'Link (/courses or https://...)';

const SCHEMAS: Record<string, { label: string; fields: F[]; defaults: any }> = {
  hero: { label: 'Hero slider (big slides)', defaults: { slides: [{ title: 'New slide', subtitle: '', bg: 'linear-gradient(135deg,#0f3d4c,#0f6b5c)', color: '#ffffff' }] },
    fields: [L('slides', 'Slides', 'slide', [T('badge', 'Small badge'), T('title', 'Heading'), A('subtitle', 'Sub text'), A('bullets', 'Bullet points (one per line)'),
      T('buttonText', 'Button 1 text'), T('buttonLink', 'Button 1 ' + LINK), T('button2Text', 'Button 2 text'), T('button2Link', 'Button 2 ' + LINK),
      I('image', 'Side image (optional)'), I('bgImage', 'Background photo (optional, full width)'),
      { k: 'overlay', label: 'Dark overlay on background photo', t: 'select', opts: ['medium', 'none', 'light', 'dark'] }, T('bg', 'Background (color or CSS gradient)'), T('color', 'Text color')])] },
  imageSlider: { label: 'Image slider (from Slides tab)', defaults: {}, fields: [] },
  photoSlider: { label: 'Photo slider (upload your own photos)', defaults: { images: [] },
    fields: [{ ...L('images', 'Photos (use the multi-select button to add many at once)', 'photo', [I('image', 'Photo'), T('caption', 'Caption'), T('link', LINK)]), multi: 'image' }] },
  stats: { label: 'Numbers strip', defaults: { items: [{ value: '100+', label: 'Courses' }] }, fields: [L('items', 'Numbers', 'number', [T('value', 'Value'), T('label', 'Label')]), ...BG] },
  chips: { label: 'Link pills (learning paths)', defaults: { title: 'Find your path', items: [{ label: 'Beginner', link: '/courses' }] },
    fields: [T('title', 'Heading'), A('subtitle', 'Sub text'), L('items', 'Pills', 'pill', [T('label', 'Label'), T('link', LINK)]), ...BG] },
  logos: { label: 'Logos / partners (scrolling)', defaults: { title: 'Our partners', items: [{ name: 'Partner' }] },
    fields: [T('title', 'Heading'), L('items', 'Logos', 'logo', [T('name', 'Name (shown if no image)'), I('image', 'Logo image')]), ...BG] },
  courses: { label: 'Courses grid', defaults: { title: 'Popular courses', limit: 8 },
    fields: [T('title', 'Heading'), A('subtitle', 'Sub text'), { k: 'limit', label: 'How many courses', t: 'number' }, { k: 'categoryId', label: 'Only this category (optional)', t: 'category' },
      { k: 'showTabs', label: 'Show category tabs', t: 'bool' }, ...BG] },
  steps: { label: 'Steps / process', defaults: { title: 'How it works', items: [{ icon: '📝', title: 'Step', text: '' }] },
    fields: [T('title', 'Heading'), A('subtitle', 'Sub text'), L('items', 'Steps', 'step', [T('icon', 'Icon (emoji)'), T('title', 'Title'), T('text', 'Text')]), ...BG] },
  feature: { label: 'Image + text block', defaults: { title: 'New block', text: '', imageSide: 'right' },
    fields: [T('badge', 'Small badge'), T('title', 'Heading'), A('text', 'Text'), A('bullets', 'Bullet points (one per line)'), T('buttonText', 'Button text'), T('buttonLink', 'Button ' + LINK),
      I('image', 'Image'), { k: 'imageSide', label: 'Image side', t: 'select', opts: ['right', 'left'] }, ...BG] },
  cards: { label: 'Cards (promo / programs)', defaults: { title: 'Featured', items: [{ title: 'Card', text: '' }] },
    fields: [T('title', 'Heading'), A('subtitle', 'Sub text'), L('items', 'Cards', 'card', [I('image', 'Image'), T('title', 'Title'), A('text', 'Text'), T('buttonText', 'Button text'), T('link', LINK)]), ...BG] },
  reviews: { label: 'Student reviews (scrolling)', defaults: { title: '' }, fields: [T('title', 'Heading (empty = default)')] },
  richtext: { label: 'Text section (about / SEO)', defaults: { title: 'About us', body: 'Write here.' },
    fields: [T('title', 'Heading'), A('body', 'Text. Blank line = new paragraph. Line starting with "## " = sub heading'), ...BG] },
  cta: { label: 'Call-to-action banner', defaults: { title: 'Ready to start?', buttonText: 'Sign up', buttonLink: '/signup', bg: 'linear-gradient(135deg,#0f3d4c,#0f6b5c)', color: '#ffffff' },
    fields: [T('title', 'Heading'), A('text', 'Text'), T('buttonText', 'Button text'), T('buttonLink', 'Button ' + LINK), ...BG] },
  html: { label: 'Custom HTML', defaults: { html: '<div style="padding:30px;text-align:center">Custom HTML</div>' }, fields: [A('html', 'HTML code (admin only)')] },
};

function ImageField({ f, v, set }: { f: F; v: string; set: (x: string) => void }) {
  const [pct, setPct] = useState<number | null>(null);
  const pick = async (file?: File) => {
    if (!file) return;
    const fd = new FormData(); fd.append('file', file); setPct(0);
    try { const r = await upload('/admin/upload', fd, 'POST', setPct); set(r.file); } catch (e: any) { alert(e.message); }
    setPct(null);
  };
  return (
    <div className="fld"><span>{f.label}</span>
      {v && <div className="row"><img src={media(v)} alt="" style={{ height: 60, borderRadius: 6 }} /><button className="btn sm danger" onClick={() => set('')}>Remove</button></div>}
      <input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} />
      <Progress pct={pct} />
    </div>
  );
}

function MultiAdd({ field, arr, set }: { field: string; arr: any[]; set: (x: any) => void }) {
  const [pct, setPct] = useState<number | null>(null);
  const pick = async (files: FileList | null) => {
    if (!files) return;
    let cur = [...arr];
    for (const file of Array.from(files)) {
      const fd = new FormData(); fd.append('file', file); setPct(0);
      try { const r = await upload('/admin/upload', fd, 'POST', setPct); cur = [...cur, { [field]: r.file }]; set(cur); } catch (e: any) { alert(e.message); }
    }
    setPct(null);
  };
  return <div className="fld"><span>Add many photos at once</span><input type="file" accept="image/*" multiple onChange={(e) => pick(e.target.files)} /><Progress pct={pct} label="Uploading photo" /></div>;
}

function Field({ f, v, set, cats }: { f: F; v: any; set: (x: any) => void; cats: any[] }) {
  if (f.t === 'list') {
    const arr: any[] = v || [];
    const swap = (i: number, d: number) => { const a = [...arr]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set(a); };
    return (
      <div className="listf"><b>{f.label}</b>
        {arr.map((it, i) => (
          <div className="item" key={i}>
            <div className="row"><small className="muted">#{i + 1}</small>
              <button className="btn sm ghost" onClick={() => swap(i, -1)}>▲</button><button className="btn sm ghost" onClick={() => swap(i, 1)}>▼</button>
              <button className="btn sm danger" onClick={() => set(arr.filter((_, k) => k !== i))}>Remove</button></div>
            <Fields fields={f.fields!} value={it} onChange={(nv: any) => set(arr.map((x, k) => (k === i ? nv : x)))} cats={cats} />
          </div>
        ))}
        <button className="btn ghost sm" onClick={() => set([...arr, {}])}>+ Add {f.add || 'item'}</button>
        {f.multi && <MultiAdd field={f.multi} arr={arr} set={set} />}
      </div>
    );
  }
  if (f.t === 'image') return <ImageField f={f} v={v} set={set} />;
  if (f.t === 'area') return <label className="fld"><span>{f.label}</span><textarea rows={f.k === 'html' ? 12 : f.k === 'body' ? 9 : 3} value={v || ''} onChange={(e) => set(e.target.value)} /></label>;
  if (f.t === 'number') return <label className="fld"><span>{f.label}</span><input type="number" value={v ?? ''} onChange={(e) => set(e.target.value)} /></label>;
  if (f.t === 'bool') return <label className="fld"><input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} /> {f.label}</label>;
  if (f.t === 'select') return <label className="fld"><span>{f.label}</span><select value={v || f.opts![0]} onChange={(e) => set(e.target.value)}>{f.opts!.map((o) => <option key={o}>{o}</option>)}</select></label>;
  if (f.t === 'category') return <label className="fld"><span>{f.label}</span><select value={v || ''} onChange={(e) => set(e.target.value)}><option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>;
  const isColor = f.k === 'color' || (f.k === 'bg');
  return (
    <label className="fld"><span>{f.label}</span>
      <div className="row"><input placeholder={f.ph} value={v || ''} onChange={(e) => set(e.target.value)} />
        {isColor && <input type="color" className="colorpick" value={/^#[0-9a-f]{6}$/i.test(v || '') ? v : '#ffffff'} onChange={(e) => set(e.target.value)} />}</div>
    </label>
  );
}
export function Fields({ fields, value, onChange, cats }: { fields: F[]; value: any; onChange: (v: any) => void; cats: any[] }) {
  return <>{fields.map((f) => <Field key={f.k} f={f} v={value?.[f.k]} set={(x) => onChange({ ...value, [f.k]: x })} cats={cats} />)}</>;
}

const summary = (s: any) => s.data?.title || s.data?.slides?.[0]?.title || s.data?.items?.[0]?.title || '';

export default function HomepageBuilder() {
  const [list, setList] = useState<any[] | null>(null);
  const [cats, setCats] = useState<any[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({});
  const [type, setType] = useState('feature');
  const [msg, setMsg] = useState('');

  const first = useRef(true);
  // Pehli dafa khali ho to default layout khud load ho jata hai: wahi default page edit hota hai
  const load = async () => {
    let r = await api('/admin/sections');
    if (r.length === 0 && first.current) {
      await api('/admin/sections/bulk', { method: 'POST', body: { sections: DEFAULT_SECTIONS } });
      r = await api('/admin/sections');
    }
    first.current = false;
    setList(r);
  };
  useEffect(() => { load(); api('/categories').then(setCats); }, []);

  const loadDefaults = async () => { await api('/admin/sections/bulk', { method: 'POST', body: { sections: DEFAULT_SECTIONS } }); load(); };
  const add = async () => {
    const r = await api('/admin/sections', { method: 'POST', body: { type, data: SCHEMAS[type].defaults } });
    await load(); setEditId(r.id); setDraft(r.data);
  };
  const dup = async (s: any) => { await api('/admin/sections', { method: 'POST', body: { type: s.type, data: s.data } }); load(); };
  const toggle = async (s: any) => { await api(`/admin/sections/${s.id}`, { method: 'PATCH', body: { visible: !s.visible } }); load(); };
  const del = async (s: any) => { if (confirm('Delete this section?')) { await api(`/admin/sections/${s.id}`, { method: 'DELETE' }); if (editId === s.id) setEditId(null); load(); } };
  const move = async (i: number, d: number) => {
    const a = [...list!]; const j = i + d; if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    await api('/admin/sections/reorder', { method: 'POST', body: { ids: a.map((x) => x.id) } }); load();
  };
  const save = async () => { await api(`/admin/sections/${editId}`, { method: 'PATCH', body: { data: draft } }); setMsg('Saved. Homepage updated.'); load(); };

  if (!list) return <p>Loading…</p>;
  return (
    <div>
      <div className="card">
        <h3>Homepage builder</h3>
        <p className="muted">The homepage is built from sections, top to bottom. Add, edit, reorder, hide or delete any section. The header and footer text are in the Header and Settings tabs.</p>
        <div className="row">
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ maxWidth: 300 }}>{Object.entries(SCHEMAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <button className="btn" onClick={add}>+ Add section</button>
          <a className="btn ghost" href="/" target="_blank" rel="noreferrer">Open homepage</a>
        </div>
      </div>
      {list.length === 0 && (
        <div className="card">
          <p>No custom layout saved yet. The website is showing the default layout. Load it here to start editing every section.</p>
          <button className="btn" onClick={loadDefaults}>Load default layout</button>
        </div>
      )}
      {list.map((s, i) => (
        <div className={'card sec-item' + (s.visible ? '' : ' off')} key={s.id}>
          <div className="line">
            <span><b>{SCHEMAS[s.type]?.label || s.type}</b> <small className="muted">{summary(s)}</small> {!s.visible && <small className="tag warn">Hidden</small>}</span>
            <span className="row">
              <button className="btn sm ghost" onClick={() => move(i, -1)}>▲</button><button className="btn sm ghost" onClick={() => move(i, 1)}>▼</button>
              <button className="btn sm ghost" onClick={() => toggle(s)}>{s.visible ? 'Hide' : 'Show'}</button>
              <button className="btn sm ghost" onClick={() => dup(s)}>Duplicate</button>
              <button className="btn sm" onClick={() => { setEditId(editId === s.id ? null : s.id); setDraft(s.data || {}); setMsg(''); }}>{editId === s.id ? 'Close' : 'Edit'}</button>
              <button className="btn sm danger" onClick={() => del(s)}>Delete</button>
            </span>
          </div>
          {editId === s.id && (
            <div className="editor">
              {SCHEMAS[s.type]?.fields.length === 0 && <p className="muted">Nothing to edit here. Manage the images in the Slides tab.</p>}
              <Fields fields={SCHEMAS[s.type]?.fields || []} value={draft} onChange={setDraft} cats={cats} />
              <div className="row"><button className="btn" onClick={save}>Save section</button>{msg && <span className="ok">{msg}</span>}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
