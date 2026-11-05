import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useEnrollment } from '../enroll';
import CourseCard from './CourseCard';

export default function Courses() {
  const [sp, setSp] = useSearchParams();
  const category = sp.get('category') || '';
  const [q, setQ] = useState('');
  const [cats, setCats] = useState<any[]>([]);
  const [list, setList] = useState<any[] | null>(null);
  const { enroll, enrolled } = useEnrollment();

  useEffect(() => { api('/categories').then(setCats); }, []);
  useEffect(() => {
    setList(null);
    const t = setTimeout(() => api(`/courses?category=${category}&q=${encodeURIComponent(q)}`).then(setList), 250);
    return () => clearTimeout(t);
  }, [category, q]);

  return (
    <div className="page">
      <h1>All courses</h1>
      <div className="filters">
        <input placeholder="Search courses" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={'chip' + (!category ? ' on' : '')} onClick={() => setSp({})}>All</button>
        {cats.map((c) => <button key={c.id} className={'chip' + (category === c.id ? ' on' : '')} onClick={() => setSp({ category: c.id })}>{c.name}</button>)}
      </div>
      {list === null ? <p>Loading…</p> : list.length === 0 ? <p className="muted">No courses found.</p> : (
        <div className="grid">{list.map((c) => <CourseCard key={c.id} c={c} enrolled={enrolled(c.id)} onEnroll={() => enroll(c.id)} />)}</div>
      )}
    </div>
  );
}
