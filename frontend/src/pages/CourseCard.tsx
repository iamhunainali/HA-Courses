import { Link } from 'react-router-dom';
import { media } from '../api';
import { useSettings } from '../settings';

export default function CourseCard({ c, enrolled, renew, onEnroll }: { c: any; enrolled: boolean; renew?: boolean; onEnroll: () => void }) {
  const { settings } = useSettings();
  const premium = c.plan === 'PREMIUM';
  // Purchased (green) / Expired (red) / Premium+price / Free
  const tag = renew ? <small className="tag exp">Expired</small>
    : enrolled && premium ? <small className="tag buy">Purchased</small>
    : premium ? <small className="tag warn">Premium · {settings.currency} {c.price}</small>
    : <small className="tag">Free</small>;
  return (
    <div className="ccard">
      <Link to={`/course/${c.id}`} className="clink">
        <div className="thumb">{c.thumbnail ? <img src={media(c.thumbnail)} alt="" /> : <span>{c.title[0]}</span>}</div>
        <div className="cbody">
          <div className="row">{c.category && <small className="tag">{c.category.name}</small>}{tag}</div>
          <h3>{c.title}</h3>
          <p className="muted clamp">{c.description}</p>
          <small className="muted">{c._count?.lessons ?? 0} lectures{premium && !enrolled && !renew ? ` · ${c.durationDays ? c.durationDays + ' days access' : 'lifetime access'}` : ''}</small>
        </div>
      </Link>
      <div className="cfoot">
        {enrolled
          ? <Link className="btn ghost sm" to={`/learn/${c.id}`}>Open course</Link>
          : renew
            ? <Link className="btn sm" to={`/checkout/${c.id}`}>Pay again to re-enroll</Link>
            : premium
              ? <Link className="btn sm" to={`/checkout/${c.id}`}>Buy now</Link>
              : <button className="btn sm" onClick={onEnroll}>Enroll Now</button>}
      </div>
    </div>
  );
}
