import { Link } from 'react-router-dom';
import { media } from '../api';

export default function CourseCard({ c, to }: { c: any; to: string }) {
  return (
    <Link to={to} className="ccard">
      <div className="thumb">{c.thumbnail ? <img src={media(c.thumbnail)} alt="" /> : <span>{c.title[0]}</span>}</div>
      <div className="cbody">
        {c.category && <small className="tag">{c.category.name}</small>}
        <h3>{c.title}</h3>
        <p className="muted clamp">{c.description}</p>
        <small className="muted">{c._count?.lessons ?? 0} videos</small>
      </div>
    </Link>
  );
}
