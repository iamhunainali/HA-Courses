import { useEffect, useState } from 'react';
import { api } from '../api';
import { Stars } from '../components/ReviewsStrip';

export default function ReviewsPage() {
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [all, setAll] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [form, setForm] = useState({ rating: 5, comment: '' });
  const [edit, setEdit] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const load = () => { api('/reviews').then(setAll); api('/my/reviews').then(setMine); };
  useEffect(load, []);

  const post = async () => {
    try { await api('/reviews', { method: 'POST', body: form }); setForm({ rating: 5, comment: '' }); setMsg('Review posted'); load(); setTab('mine'); } catch (e: any) { setMsg(e.message); }
  };
  const save = async () => { await api(`/reviews/${edit.id}`, { method: 'PATCH', body: edit }); setEdit(null); load(); };
  const del = async (id: string) => { if (confirm('Delete this review?')) { await api(`/reviews/${id}`, { method: 'DELETE' }); load(); } };

  return (
    <div className="page narrow">
      <h1>Reviews</h1>
      <div className="card">
        <h3>Write a review</h3>
        <select value={form.rating} onChange={(e) => setForm({ ...form, rating: +e.target.value })}>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
        </select>
        <textarea rows={3} placeholder="Share your experience" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
        <button className="btn" onClick={post}>Post review</button>
        {msg && <p className="muted">{msg}</p>}
      </div>
      <div className="filters">
        <button className={'chip' + (tab === 'all' ? ' on' : '')} onClick={() => setTab('all')}>All reviews</button>
        <button className={'chip' + (tab === 'mine' ? ' on' : '')} onClick={() => setTab('mine')}>My reviews ({mine.length})</button>
      </div>
      {tab === 'all' && all.map((r) => <div className="card" key={r.id}><Stars n={r.rating} /><p>{r.comment}</p><strong>{r.user?.name}</strong></div>)}
      {tab === 'mine' && (mine.length === 0 ? <p className="muted">You have not posted any review.</p> : mine.map((r) => (
        <div className="card" key={r.id}>
          {edit?.id === r.id ? (
            <>
              <select value={edit.rating} onChange={(e) => setEdit({ ...edit, rating: +e.target.value })}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}</select>
              <textarea rows={3} value={edit.comment} onChange={(e) => setEdit({ ...edit, comment: e.target.value })} />
              <div className="row"><button className="btn" onClick={save}>Save</button><button className="btn ghost" onClick={() => setEdit(null)}>Cancel</button></div>
            </>
          ) : (
            <>
              <Stars n={r.rating} /> {r.status === 'HIDDEN' && <small className="tag warn">Hidden by admin</small>}
              <p>{r.comment}</p>
              <div className="row"><button className="btn ghost" onClick={() => setEdit(r)}>Edit</button><button className="btn danger" onClick={() => del(r.id)}>Delete</button></div>
            </>
          )}
        </div>
      )))}
    </div>
  );
}
