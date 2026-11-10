import { useEffect, useState } from 'react';
import { api } from '../api';
import { Fields, F } from './HomepageBuilder';
import { useStored } from '../useStored';
import { PreviewBox, QuestionsPreview } from '../components/AdminPreview';

const t = (k: string, label: string): F => ({ k, label, t: 'text' });
const a = (k: string, label: string): F => ({ k, label, t: 'area' });
const SCHEMA: F[] = [
  t('title', 'Lab title'), a('description', 'Description / instructions for students'),
  { k: 'kind', label: 'Type', t: 'select', opts: ['Quiz', 'Practice', 'Exam'] },
  { k: 'timeLimitMin', label: 'Time limit in minutes (0 = no limit)', t: 'number' },
  { k: 'passPercent', label: 'Pass percentage', t: 'number' },
  { k: 'published', label: 'Published (visible to students)', t: 'bool' },
];

// Bulk format: blank line between questions. First line = question, next lines = options, "*" before the correct option(s).
const strip = (o: string) => o.replace(/^[A-Da-d][).]\s+/, '').trim();
const parseBulk = (txt: string) => txt.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((b) => {
  const ls = b.split('\n').map((x) => x.trim()).filter(Boolean);
  const correct: number[] = [];
  const opts = ls.slice(1).map((o, i) => { if (o.startsWith('*')) { correct.push(i + 1); return strip(o.slice(1).trim()); } return strip(o); });
  return { type: correct.length > 1 ? 'multi' : 'mcq', text: ls[0].replace(/^\d+[).\s]+/, ''), options: opts, correct: correct.map((n) => n - 1) };
});

export default function LabsPanel({ base = '/admin' }: { base?: string }) {
  const [courses, setCourses] = useState<any[]>([]);
  const [sel, setSel] = useStored('sel_labs', '');
  const [labs, setLabs] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [bulk, setBulk] = useState('');
  const [attempts, setAttempts] = useState<any[] | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => { api(`${base}/courses`).then(setCourses); }, []);
  const load = () => (sel ? api(`${base}/courses/${sel}/labs`).then(setLabs) : setLabs([]));
  useEffect(() => { load(); setDraft(null); setAttempts(null); }, [sel]);

  const newLab = () => { setEditId(null); setDraft({ title: '', description: '', kind: 'Quiz', timeLimitMin: 0, passPercent: 60, published: true, items: [] }); setMsg(''); };
  const edit = (l: any) => { setEditId(l.id); setDraft({ title: l.title, description: l.description, kind: l.kind, timeLimitMin: l.timeLimitMin, passPercent: l.passPercent, published: l.published, items: (l.items || []).map(normQ) }); setMsg(''); window.scrollTo(0, 0); };
  const save = async () => {
    const items = clean(draft.items || []);
    const bad = items.findIndex((q: any) => (q.type === 'mcq' || q.type === 'multi') && (q.options.length < 2 || q.correct.length === 0));
    if (bad >= 0) { setMsg(`Question ${bad + 1}: add at least 2 options and tick the correct answer`); return; }
    const payload = { ...draft, items };
    try {
      if (editId) await api(`${base}/labs/${editId}`, { method: 'PATCH', body: payload });
      else { const r = await api(`${base}/courses/${sel}/labs`, { method: 'POST', body: payload }); setEditId(r.id); }
      setMsg('Saved'); load();
    } catch (e: any) { setMsg(e.message); }
  };
  const del = async (l: any) => { if (confirm('Delete this lab and all attempts?')) { await api(`${base}/labs/${l.id}`, { method: 'DELETE' }); if (editId === l.id) setDraft(null); load(); } };
  const addBulk = () => { const qs = parseBulk(bulk); if (!qs.length) return; setDraft({ ...draft, items: [...(draft.items || []), ...qs] }); setBulk(''); setMsg(`${qs.length} question(s) added. Click Save.`); };
  const results = async (l: any) => setAttempts(await api(`${base}/labs/${l.id}/attempts`));

  return (
    <div>
      <div className="card">
        <select value={sel} onChange={(e) => setSel(e.target.value)}>
          <option value="">Select a course</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        {sel && <div className="row" style={{ marginTop: 8 }}><button className="btn" onClick={newLab}>+ New lab</button></div>}
      </div>

      {sel && labs.map((l) => (
        <div className="card" key={l.id}>
          <div className="line" style={{ border: 0 }}>
            <span><b>{l.title}</b> <small className="tag">{l.kind}</small> {!l.published && <small className="tag warn">Hidden</small>} <small className="muted">{(l.items || []).length} questions · {l._count.attempts} attempts</small></span>
            <span className="row"><button className="btn sm ghost" onClick={() => results(l)}>Results</button><button className="btn sm" onClick={() => edit(l)}>Edit</button><button className="btn sm danger" onClick={() => del(l)}>Delete</button></span>
          </div>
        </div>
      ))}
      {sel && labs.length === 0 && <p className="muted">No labs yet for this course.</p>}

      {attempts && (
        <div className="card">
          <div className="line"><h3 style={{ margin: 0 }}>Student results</h3><button className="btn sm ghost" onClick={() => setAttempts(null)}>Close</button></div>
          {attempts.length === 0 ? <p className="muted">No attempts yet.</p> : (
            <div className="tablewrap"><table><thead><tr><th>Student</th><th>Score</th><th>Result</th><th>Date</th></tr></thead><tbody>
              {attempts.map((x) => <tr key={x.id}><td>{x.user.name}<br /><small className="muted">{x.user.email}</small></td><td>{x.score}/{x.total} ({x.percent}%)</td><td><span className={'tag ' + (x.passed ? 's-ACTIVE' : 's-SUSPENDED')}>{x.passed ? 'Passed' : 'Failed'}</span></td><td>{new Date(x.createdAt).toLocaleString()}</td></tr>)}
            </tbody></table></div>
          )}
        </div>
      )}

      {draft && (
        <div className="card">
          <h3>{editId ? 'Edit lab' : 'New lab'}</h3>
          <div className="fld">
            <span>Quick add MCQs: paste questions. Blank line between questions, first line is the question, then options. Put * before the correct option(s).</span>
            <textarea rows={6} placeholder={'What is 2 + 2?\n3\n*4\n5\n\nWhich are fruits?\n*Apple\nCar\n*Mango'} value={bulk} onChange={(e) => setBulk(e.target.value)} />
            <button className="btn ghost sm" onClick={addBulk}>Add pasted questions</button>
          </div>
          <Fields fields={SCHEMA} value={draft} onChange={setDraft} cats={[]} />
          <QuestionsEditor items={draft.items || []} onChange={(items: any[]) => setDraft({ ...draft, items })} />
          <PreviewBox title="What students will see"><QuestionsPreview items={draft.items || []} /></PreviewBox>
          <div className="row"><button className="btn" onClick={save}>Save lab</button><button className="btn ghost" onClick={() => setDraft(null)}>Close</button>{msg && <span className="ok">{msg}</span>}</div>
        </div>
      )}
    </div>
  );
}

const normQ = (q: any) => ({
  ...q, type: q.type || 'mcq',
  options: Array.isArray(q.options) ? q.options : String(q.options || '').split('\n').map((x: string) => x.trim()).filter(Boolean),
  correct: Array.isArray(q.correct) ? q.correct : String(q.correct || '').split(/[\s,]+/).map((n) => parseInt(n) - 1).filter((n) => n >= 0),
});
// Khali options hata kar sahi option ke index dobara set karta hai
const clean = (items: any[]) => items.map((q) => {
  if (q.type !== 'mcq' && q.type !== 'multi') return q;
  const map: Record<number, number> = {}; const opts: string[] = [];
  (q.options || []).forEach((o: string, k: number) => { if (String(o).trim()) { map[k] = opts.length; opts.push(String(o).trim()); } });
  let correct = (q.correct || []).filter((k: number) => map[k] !== undefined).map((k: number) => map[k]);
  if (q.type === 'mcq') correct = correct.slice(0, 1);
  return { ...q, options: opts, correct };
});

// MCQ editor: har option alag box mein, sahi jawab tick se
function QuestionsEditor({ items, onChange }: { items: any[]; onChange: (x: any[]) => void }) {
  const set = (i: number, p: any) => onChange(items.map((q, k) => (k === i ? { ...q, ...p } : q)));
  const swap = (i: number, d: number) => { const a = [...items]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  const setType = (i: number, type: string) => { const q = items[i]; set(i, { type, options: q.options?.length ? q.options : ['', ''], correct: type === 'mcq' ? (q.correct || []).slice(0, 1) : q.correct || [] }); };
  const toggle = (i: number, k: number) => {
    const q = items[i]; const cur: number[] = q.correct || [];
    set(i, { correct: q.type === 'mcq' ? [k] : cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] });
  };
  const rmOpt = (i: number, k: number) => { const q = items[i]; set(i, { options: q.options.filter((_: any, x: number) => x !== k), correct: (q.correct || []).filter((x: number) => x !== k).map((x: number) => (x > k ? x - 1 : x)) }); };
  return (
    <div className="listf">
      <b>Questions</b>
      {items.map((q, i) => (
        <div className="item" key={i}>
          <div className="row">
            <small className="muted">#{i + 1}</small>
            <select value={q.type} onChange={(e) => setType(i, e.target.value)} style={{ width: 'auto' }}>
              <option value="mcq">MCQ (one correct answer)</option><option value="multi">MCQ (multiple correct answers)</option><option value="short">Short answer</option><option value="task">Practice task</option>
            </select>
            <button className="btn sm ghost" onClick={() => swap(i, -1)}>▲</button><button className="btn sm ghost" onClick={() => swap(i, 1)}>▼</button>
            <button className="btn sm danger" onClick={() => onChange(items.filter((_, k) => k !== i))}>Remove</button>
          </div>
          <textarea rows={2} placeholder={q.type === 'task' ? 'Task instructions' : 'Question'} value={q.text || ''} onChange={(e) => set(i, { text: e.target.value })} />
          {(q.type === 'mcq' || q.type === 'multi') && (
            <div>
              {(q.options || []).map((o: string, k: number) => (
                <div className="optrow" key={k}>
                  <input type={q.type === 'mcq' ? 'radio' : 'checkbox'} checked={(q.correct || []).includes(k)} onChange={() => toggle(i, k)} title="Tick = correct answer" />
                  <input value={o} placeholder={`Option ${k + 1}`} onChange={(e) => set(i, { options: q.options.map((x: string, y: number) => (y === k ? e.target.value : x)) })} />
                  <button className="btn sm danger" onClick={() => rmOpt(i, k)}>×</button>
                </div>
              ))}
              <button className="btn sm ghost" onClick={() => set(i, { options: [...(q.options || []), ''] })}>+ Add option</button>
              <small className="muted"> Tick the correct answer{q.type === 'multi' ? '(s)' : ''}.</small>
            </div>
          )}
          {q.type === 'short' && <textarea rows={2} placeholder="Accepted answers, one per line" value={q.answers || ''} onChange={(e) => set(i, { answers: e.target.value })} />}
          {q.type === 'task' && <textarea rows={2} placeholder="Solution (shown after submit)" value={q.solution || ''} onChange={(e) => set(i, { solution: e.target.value })} />}
          <input placeholder="Hint (optional)" value={q.hint || ''} onChange={(e) => set(i, { hint: e.target.value })} />
          <input placeholder="Explanation shown after submit (optional)" value={q.explanation || ''} onChange={(e) => set(i, { explanation: e.target.value })} />
        </div>
      ))}
      <button className="btn ghost sm" onClick={() => onChange([...items, { type: 'mcq', text: '', options: ['', '', '', ''], correct: [] }])}>+ Add question</button>
    </div>
  );
}
