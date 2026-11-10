import { useEffect, useState } from 'react';
import { api } from '../api';

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function LabRunner({ id, onClose }: { id: string; onClose: () => void }) {
  const [lab, setLab] = useState<any>(null);
  const [ans, setAns] = useState<any>({});
  const [res, setRes] = useState<any>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [hints, setHints] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const start = () => api(`/labs/${id}`).then((l) => { setLab(l); setAns({}); setRes(null); setHints({}); setLeft(l.timeLimitMin > 0 ? l.timeLimitMin * 60 : null); }).catch((e) => setErr(e.message));
  useEffect(() => { start(); }, [id]);

  const submit = async () => {
    if (busy || res) return;
    setBusy(true);
    try { setRes(await api(`/labs/${id}/submit`, { method: 'POST', body: { answers: ans } })); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  useEffect(() => {
    if (left === null || res) return;
    if (left <= 0) { submit(); return; }
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left, res]);

  if (err) return <div className="card"><p className="err">{err}</p><button className="btn ghost" onClick={onClose}>Back</button></div>;
  if (!lab) return <p>Loading…</p>;

  return (
    <div className="labrun">
      <div className="line" style={{ border: 0 }}>
        <div><button className="btn ghost sm" onClick={onClose}>← All labs</button><h2 style={{ margin: '8px 0 0' }}>{lab.title}</h2></div>
        {left !== null && !res && <div className={'labtimer' + (left < 60 ? ' low' : '')}>⏱ {mmss(left)}</div>}
      </div>
      {lab.description && !res && <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{lab.description}</p>}

      {res && (
        <div className={'card result ' + (res.passed ? 'pass' : 'fail')}>
          <div className="bigscore">{res.percent}%</div>
          <div><h3 style={{ margin: 0 }}>{res.passed ? '🎉 Passed' : 'Not passed yet'}</h3><p className="muted" style={{ margin: 0 }}>{res.score} of {res.total} correct · pass mark {lab.passPercent}%</p></div>
          <div className="row"><button className="btn" onClick={start}>Try again</button><button className="btn ghost" onClick={onClose}>Back to labs</button></div>
        </div>
      )}

      {lab.items.map((q: any, i: number) => {
        const r = res?.results?.[i];
        return (
          <div className={'card q' + (r ? (r.type === 'task' ? '' : r.ok ? ' good' : ' bad') : '')} key={i}>
            <div className="qnum">Question {i + 1}{q.type === 'task' ? ' · Practice task' : q.type === 'multi' ? ' · Select all that apply' : ''}</div>
            <p className="qtext">{q.text}</p>
            {q.type === 'mcq' && q.options.map((o: string, k: number) => (
              <label className="opt" key={k}><input type="radio" name={'q' + i} disabled={!!res} checked={ans[i] === k} onChange={() => setAns({ ...ans, [i]: k })} /> {o}</label>
            ))}
            {q.type === 'multi' && q.options.map((o: string, k: number) => {
              const cur: number[] = ans[i] || [];
              return <label className="opt" key={k}><input type="checkbox" disabled={!!res} checked={cur.includes(k)} onChange={(e) => setAns({ ...ans, [i]: e.target.checked ? [...cur, k] : cur.filter((x) => x !== k) })} /> {o}</label>;
            })}
            {(q.type === 'mcq' || q.type === 'multi') && q.options.length === 0 && <p className="err">No options were added to this question. Please tell your teacher.</p>}
            {q.type === 'short' && <input placeholder="Type your answer" disabled={!!res} value={ans[i] || ''} onChange={(e) => setAns({ ...ans, [i]: e.target.value })} />}
            {q.type === 'task' && <label className="opt"><input type="checkbox" disabled={!!res} checked={!!ans[i]} onChange={(e) => setAns({ ...ans, [i]: e.target.checked })} /> I completed this task</label>}
            {q.hint && !res && (hints[i] ? <p className="hint">💡 {q.hint}</p> : <button className="btn ghost sm" onClick={() => setHints({ ...hints, [i]: true })}>Show hint</button>)}
            {r && r.type !== 'task' && <p className={r.ok ? 'ok' : 'err'}><b>{r.ok ? '✓ Correct' : '✗ Incorrect'}</b>{!r.ok && r.correct && <> · Correct answer: <b>{r.correct}</b></>}</p>}
            {r?.explanation && <p className="muted">{r.explanation}</p>}
            {r?.type === 'task' && r.solution && <p className="muted"><b>Solution:</b> {r.solution}</p>}
          </div>
        );
      })}
      {!res && <button className="btn big" onClick={submit} disabled={busy}>{busy ? 'Checking…' : 'Submit'}</button>}
    </div>
  );
}
