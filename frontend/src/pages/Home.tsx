import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useEnrollment } from '../enroll';
import Slideshow from '../components/Slideshow';
import ReviewsStrip from '../components/ReviewsStrip';
import CourseCard from './CourseCard';

export default function Home() {
  const [list, setList] = useState<any[] | null>(null);
  const { enroll, enrolled } = useEnrollment();
  useEffect(() => { api('/courses').then(setList).catch(() => setList([])); }, []);
  return (
    <>
      <Slideshow />
      <section className="page">
        <div className="sectionhead"><h2>Courses</h2><Link to="/courses">View all</Link></div>
        {list === null ? <p>Loading…</p> : list.length === 0 ? <p className="muted">Courses will appear here soon.</p> : (
          <div className="grid">{list.slice(0, 8).map((c) => <CourseCard key={c.id} c={c} enrolled={enrolled(c.id)} onEnroll={() => enroll(c.id)} />)}</div>
        )}
      </section>
      <ReviewsStrip />
    </>
  );
}
