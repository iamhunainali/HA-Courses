import { useEffect, useState } from 'react';
import { api, media } from '../api';

export default function Slideshow() {
  const [slides, setSlides] = useState<any[]>([]);
  const [i, setI] = useState(0);
  useEffect(() => { api('/slides').then(setSlides).catch(() => {}); }, []);
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setTimeout(() => setI((x) => (x + 1) % slides.length), 5000);
    return () => clearTimeout(t);
  }, [slides, i]);

  if (!slides.length)
    return (
      <section className="hero-empty">
        <h1>Learn at your own pace</h1>
        <p>Sign up to explore courses and start watching.</p>
      </section>
    );
  const go = (d: number) => setI((i + d + slides.length) % slides.length);
  return (
    <section className="slider">
      {slides.map((s, k) => (
        <div key={s.id} className={'slide' + (k === i ? ' on' : '')}>
          {/* blurred copy fills the frame, sharp copy is fully visible: any image size looks good */}
          <div className="bg" style={{ backgroundImage: `url(${media(s.image)})` }} />
          <img src={media(s.image)} alt={s.caption || ''} />
          {s.caption && <div className="cap">{s.caption}</div>}
        </div>
      ))}
      {slides.length > 1 && (
        <>
          <button className="arrow l" onClick={() => go(-1)} aria-label="Previous">‹</button>
          <button className="arrow r" onClick={() => go(1)} aria-label="Next">›</button>
          <div className="dots">
            {slides.map((s, k) => <span key={s.id} className={k === i ? 'on' : ''} onClick={() => setI(k)} />)}
          </div>
        </>
      )}
    </section>
  );
}
