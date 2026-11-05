import { Link } from 'react-router-dom';
import { media } from '../api';
import { useSettings } from '../settings';

export default function CourseCard({ c, enrolled, onEnroll }: { c: any; enrolled: boolean; onEnroll: () => void }) {
  const { settings } = useSettings();
  const premium = c.plan === 'PREMIUM';
  return (
    <div className="ccard">
      <Link to={`/course/${c.id}`} className="clink">
        <div className="thumb">{c.thumbnail ? <img src={media(c.thumbnail)} alt="" /> : <span>{c.title[0]}</span>}</div>
        <div className="cbody">
          <div className="row">
            {c.category && <small className="tag">{c.category.name}</small>}
            <small className={'tag ' + (premium ? 'warn' : '')}>{premium ? `Premium · ${settings.currency} ${c.price}` : 'Free'}</small>
          </div>
          <h3>{c.title}</h3>
          <p className="muted clamp">{c.description}</p>
          <small className="muted">{c._count?.lessons ?? 0} videos{premium ? ` · ${c.durationDays ? c.durationDays + ' days access' : 'lifetime access'}` : ''}</small>
        </div>
      </Link>
      <div className="cfoot">
        {enrolled
          ? <Link className="btn ghost sm" to={`/dashboard?course=${c.id}`}>Open in dashboard</Link>
          : premium
            ? <Link className="btn sm" to={`/checkout/${c.id}`}>Buy now</Link>
            : <button className="btn sm" onClick={onEnroll}>Enroll Now</button>}
      </div>
    </div>
  );
}
