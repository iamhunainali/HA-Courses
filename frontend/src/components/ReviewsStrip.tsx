import { useEffect, useState } from 'react';
import { api } from '../api';

export const Stars = ({ n }: { n: number }) => <span className="stars">{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>;

export default function ReviewsStrip() {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => { api('/reviews').then(setList).catch(() => {}); }, []);
  if (!list.length) return null;
  const items = list.length < 4 ? [...list, ...list, ...list, ...list] : list;
  return (
    <section className="reviews">
      <h2>What students say</h2>
      <div className="marquee">
        <div className="track" style={{ animationDuration: `${Math.max(25, items.length * 6)}s` }}>
          {[...items, ...items].map((r, k) => (
            <article className="rcard" key={k}>
              <Stars n={r.rating} />
              <p>{r.comment}</p>
              <strong>{r.user?.name}</strong>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
