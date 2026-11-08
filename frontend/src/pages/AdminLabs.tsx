import { useEffect, useState } from 'react';
import { api } from '../api';
import { Fields, F } from './HomepageBuilder';
import { useStored } from '../useStored';

const t = (k: string, label: string): F => ({ k, label, t: 'text' });
const a = (k: string, label: string): F => ({ k, label, t: 'area' });
const SCHEMA: F[] = [
  t('title', 'Lab title'), a('description', 'Description / instructions for students'),
  { k: 'kind', label: 'Type', t: 'select', opts: ['Quiz', 'Practice', 'Exam'] },
  { k: 'timeLimitMin', label: 'Time limit in minutes (0 = no limit)', t: 'number' },
  { k: 'passPercent', label: 'Pass percentage', t: 'number' },
  { k: 'published', label: 'Published (visible to students)', t: 'bool' },
  { k: 'items', label: 'Questions', t: 'list', add: 'question', fields: [
    { k: 'type', label: 'Question type', t: 'select', opts: ['mcq', 'multi', 'short', 'task'] },
    a('text', 'Question / task instructions'),
    a('options', 'Options, one per line (for mcq and multi)'),
    t('correct', 'Correct option number: 2 for mcq, or 1,3 for multi'),
    a('answers', 'Accepted answers, one per line (for short answer)'),
    a('hint', 'Hint (optional)'), a('explanation', 'Explanation shown after submit (optional)'), a('solution', 'Solution (for practice tasks)'),
  ] },
];

// Bulk format: blank line between questions. First line = question, next lines = options, "*" before the correct option(s).
const strip = (o: string) => o.replace(/^[A-Da-d][).]\s+/, '').trim();
const parseBulk = (txt: string) => txt.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((b) => {
  const ls = b.split('\n').map((x) => x.trim()).filter(Boolean);
  const correct: number[] = [];
  const opts = ls.slice(1).map((o, i) => { if (o.startsWith('*')) { correct.push(i + 1); return strip(o.slice(1).trim()); } return strip(o); });
  return { type: correct.length > 1 ? 'multi' : 'mcq', text: ls[0].replace(/^\d+[).\s]+/, ''), options: opts.join('\n'), correct: correct.join(',') };
});

export default function LabsPanel() {
  const [courses, setCourses] = useState<any[]>([]);
  const [sel, setSel] = useStored('sel_labs', '');
  const [labs, setLabs] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [bulk, setBulk] = useState('');
  const [attempts, setAttempts] = useState<any[] | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => { api('/admin/courses').then(setCourses); }, []);
  const load = () => (sel ? api(`/admin/courses/${sel}/labs`).then(setLabs) : setLabs([]));
  useEffect(() => { load(); setDraft(null); setAttempts(null); }, [sel]);

  const newLab = () => { setEditId(null); setDraft({ title: '', description: '', kind: 'Quiz', timeLimitMin: 0, passPercent: 60, published: true, items: [] }); setMsg(''); };
  const edit = (l: any) => { setEditId(l.id); setDraft({ title: l.title, description: l.description, kind: l.kind, timeLimitMin: l.timeLimitMin, passPercent: l.passPercent, published: l.published, items: l.items || [] }); setMsg(''); window.scrollTo(0, 0); };
  const save = async () => {
    try {
      if (editId) await api(`/admin/labs/${editId}`, { method: 'PATCH', body: draft });
      else { const r = await api(`/admin/courses/${sel}/labs`, { method: 'POST', body: draft }); setEditId(r.id); }
      setMsg('Saved'); load();
    } catch (e: any) { setMsg(e.message); }
  };
  const del = async (l: any) => { if (confirm('Delete this lab and all attempts?')) { await api(`/admin/labs/${l.id}`, { method: 'DELETE' }); if (editId === l.id) setDraft(null); load(); } };
  const addBulk = () => { const qs = parseBulk(bulk); if (!qs.length) return; setDraft({ ...draft, items: [...(draft.items || []), ...qs] }); setBulk(''); setMsg(`${qs.length} question(s) added. Click Save.`); };
  const results = async (l: any) => setAttempts(await api(`/admin/labs/${l.id}/attempts`));

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
          <div className="row"><button className="btn" onClick={save}>Save lab</button><button className="btn ghost" onClick={() => setDraft(null)}>Close</button>{msg && <span className="ok">{msg}</span>}</div>
        </div>
      )}
    </div>
  );
}
