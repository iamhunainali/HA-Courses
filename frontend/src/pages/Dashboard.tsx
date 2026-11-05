import { useEffect, useState } from 'react';
import { api } from '../api';
import CourseCard from './CourseCard';

export default function Dashboard() {
  const [list, setList] = useState<any[] | null>(null);
  useEffect(() => { api('/my/enrollments').then(setList); }, []);
  return (
    <div className="page">
      <h1>My courses</h1>
      {list === null ? <p>Loading…</p> : list.length === 0 ? <p className="muted">You have not enrolled in any course yet.</p> : (
        <div className="grid">{list.map((c) => <CourseCard key={c.id} c={c} to={`/learn/${c.id}`} />)}</div>
      )}
    </div>
  );
}
