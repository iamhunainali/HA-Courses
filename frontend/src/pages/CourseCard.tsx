import { Link } from 'react-router-dom';
import { media } from '../api';

export default function CourseCard({ c, enrolled, onEnroll }: { c: any; enrolled: boolean; onEnroll: () => void }) {
  return (
    <div className="ccard">
      <Link to={`/course/${c.id}`} className="clink">
        <div className="thumb">{c.thumbnail ? <img src={media(c.thumbnail)} alt="" /> : <span>{c.title[0]}</span>}</div>
        <div className="cbody">
          {c.category && <small className="tag">{c.category.name}</small>}
          <h3>{c.title}</h3>
          <p className="muted clamp">{c.description}</p>
          <small className="muted">{c._count?.lessons ?? 0} videos</small>
        </div>
      </Link>
      <div className="cfoot">
        {enrolled
          ? <Link className="btn ghost sm" to={`/dashboard?course=${c.id}`}>Open in dashboard</Link>
          : <button className="btn sm" onClick={onEnroll}>Enroll Now</button>}
      </div>
    </div>
  );
}
