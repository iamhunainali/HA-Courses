import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, media } from '../api';
import { useEnrollment } from '../enroll';
import CourseCard from '../pages/CourseCard';
import Slideshow from './Slideshow';
import ReviewsStrip from './ReviewsStrip';

export function SmartLink({ to, className, children }: any) {
  if (!to) return null;
  return /^(https?:|mailto:|tel:)/.test(to)
    ? <a className={className} href={to} target="_blank" rel="noreferrer">{children}</a>
    : <Link className={className} to={to}>{children}</Link>;
}
const lines = (s?: string) => (s || '').split('\n').map((x) => x.trim()).filter(Boolean);

function Head({ d }: any) {
  if (!d.title && !d.subtitle) return null;
  return <div className="shead">{d.title && <h2>{d.title}</h2>}{d.subtitle && <p className="sub">{d.subtitle}</p>}</div>;
}

const OV: any = { none: 0, light: 0.25, medium: 0.45, dark: 0.65 };
function slideBg(s: any) {
  const base: any = { background: s.bg || '#0f3d4c', color: s.color || '#fff' };
  if (s.bgImage) {
    const a = OV[s.overlay || 'medium'] ?? 0.45;
    base.background = `linear-gradient(rgba(0,0,0,${a}),rgba(0,0,0,${a})), url(${media(s.bgImage)}) center/cover no-repeat`;
  }
  return base;
}

function PhotoSlider({ d }: any) {
  const imgs: any[] = d.images || [];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (imgs.length < 2) return;
    const t = setTimeout(() => setI((x) => (x + 1) % imgs.length), 5000);
    return () => clearTimeout(t);
  }, [i, imgs.length]);
  if (!imgs.length) return null;
  const go = (n: number) => setI((i + n + imgs.length) % imgs.length);
  return (
    <section className="slider">
      {imgs.map((s, k) => {
        const inner = (<><div className="bg" style={{ backgroundImage: `url(${media(s.image)})` }} /><img src={media(s.image)} alt={s.caption || ''} />{s.caption && <div className="cap">{s.caption}</div>}</>);
        return <div key={k} className={'slide' + (k === i ? ' on' : '')}>{s.link ? <SmartLink to={s.link} className="slidelink">{inner}</SmartLink> : inner}</div>;
      })}
      {imgs.length > 1 && (<>
        <button className="arrow l" onClick={() => go(-1)} aria-label="Previous">‹</button>
        <button className="arrow r" onClick={() => go(1)} aria-label="Next">›</button>
        <div className="dots">{imgs.map((_, k) => <span key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} />)}</div>
      </>)}
    </section>
  );
}

function Hero({ d }: any) {
  const slides: any[] = d.slides || [];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setTimeout(() => setI((x) => (x + 1) % slides.length), 6000);
    return () => clearTimeout(t);
  }, [i, slides.length]);
  if (!slides.length) return null;
  const go = (n: number) => setI((i + n + slides.length) % slides.length);
  return (
    <section className="hero2">
      {slides.map((s, k) => (
        <div key={k} className={'hslide' + (k === i ? ' on' : '')} style={slideBg(s)}>
          <div className={'wrap hgrid' + (s.image ? '' : ' noimg')}>
            <div className="htext">
              {s.badge && <span className="hbadge">{s.badge}</span>}
              {s.title && <h1>{s.title}</h1>}
              {s.subtitle && <p className="hsub">{s.subtitle}</p>}
              {lines(s.bullets).length > 0 && <ul className="hbul">{lines(s.bullets).map((b, j) => <li key={j}>{b}</li>)}</ul>}
              <div className="row">
                {s.buttonText && <SmartLink to={s.buttonLink} className="btn accent">{s.buttonText}</SmartLink>}
                {s.button2Text && <SmartLink to={s.button2Link} className="btn outline">{s.button2Text}</SmartLink>}
              </div>
            </div>
            {s.image && <div className="himg"><img src={media(s.image)} alt="" /></div>}
          </div>
        </div>
      ))}
      {slides.length > 1 && (
        <>
          <button className="arrow l" onClick={() => go(-1)} aria-label="Previous">‹</button>
          <button className="arrow r" onClick={() => go(1)} aria-label="Next">›</button>
          <div className="dots">{slides.map((_, k) => <span key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} />)}</div>
        </>
      )}
    </section>
  );
}

function CoursesSec({ d }: any) {
  const [list, setList] = useState<any[] | null>(null);
  const [cats, setCats] = useState<any[]>([]);
  const [tab, setTab] = useState('');
  const { enroll, enrolled, renew } = useEnrollment();
  useEffect(() => {
    api(`/courses?category=${d.categoryId || ''}`).then(setList).catch(() => setList([]));
    if (d.showTabs && !d.categoryId) api('/categories').then(setCats).catch(() => {});
  }, [d.categoryId, d.showTabs]);
  const shown = (list || []).filter((c) => !tab || c.categoryId === tab).slice(0, Number(d.limit) || 8);
  return (
    <>
      <Head d={d} />
      {d.showTabs && !d.categoryId && (
        <div className="filters" style={{ justifyContent: 'center' }}>
          <button className={'chip' + (!tab ? ' on' : '')} onClick={() => setTab('')}>All</button>
          {cats.filter((c) => (list || []).some((x) => x.categoryId === c.id)).map((c) => <button key={c.id} className={'chip' + (tab === c.id ? ' on' : '')} onClick={() => setTab(c.id)}>{c.name}</button>)}
        </div>
      )}
      {list === null ? <p className="muted" style={{ textAlign: 'center' }}>Loading…</p> : shown.length === 0 ? <p className="muted" style={{ textAlign: 'center' }}>Courses will appear here soon.</p> : (
        <div className="grid">{shown.map((c) => <CourseCard key={c.id} c={c} enrolled={enrolled(c.id)} renew={renew(c.id)} onEnroll={() => enroll(c.id)} />)}</div>
      )}
      <div style={{ textAlign: 'center', marginTop: 22 }}><Link className="btn ghost" to="/courses">View all courses</Link></div>
    </>
  );
}

function Inner({ type, d }: any) {
  switch (type) {
    case 'stats':
      return <div className="stats2">{(d.items || []).map((x: any, k: number) => <div key={k}><b>{x.value}</b><span>{x.label}</span></div>)}</div>;
    case 'chips':
      return <><Head d={d} /><div className="pills">{(d.items || []).map((x: any, k: number) => <SmartLink key={k} to={x.link || '/courses'} className="pill">{x.label}</SmartLink>)}</div></>;
    case 'logos': {
      const items = d.items || [];
      if (!items.length) return null;
      const row = [...items, ...items, ...items, ...items];
      return (
        <>
          <Head d={d} />
          <div className="marquee logos"><div className="track" style={{ animationDuration: `${Math.max(20, items.length * 5)}s` }}>
            {row.map((x: any, k: number) => x.image ? <img key={k} src={media(x.image)} alt={x.name || ''} /> : <span key={k}>{x.name}</span>)}
          </div></div>
        </>
      );
    }
    case 'courses': return <CoursesSec d={d} />;
    case 'steps':
      return <><Head d={d} /><div className="steps2">{(d.items || []).map((x: any, k: number) => <div className="step2" key={k}><div className="ic">{x.icon}</div><b>{x.title}</b><p className="muted">{x.text}</p></div>)}</div></>;
    case 'feature':
      return (
        <div className={'feat' + (d.imageSide === 'left' ? ' imgleft' : '')}>
          <div>
            {d.badge && <span className="tag">{d.badge}</span>}
            <h2>{d.title}</h2>
            {d.text && <p className="sub">{d.text}</p>}
            {lines(d.bullets).length > 0 && <ul className="hbul dark">{lines(d.bullets).map((b, j) => <li key={j}>{b}</li>)}</ul>}
            {d.buttonText && <SmartLink to={d.buttonLink} className="btn">{d.buttonText}</SmartLink>}
          </div>
          {d.image && <div className="fimg"><img src={media(d.image)} alt="" /></div>}
        </div>
      );
    case 'cards':
      return (
        <>
          <Head d={d} />
          <div className="cards2">{(d.items || []).map((x: any, k: number) => (
            <div className="card2" key={k}>
              {x.image && <img src={media(x.image)} alt="" />}
              <div className="cb"><h3>{x.title}</h3><p className="muted">{x.text}</p>{x.link && <SmartLink to={x.link} className="btn sm">{x.buttonText || 'Learn more'}</SmartLink>}</div>
            </div>
          ))}</div>
        </>
      );
    case 'richtext':
      return (
        <div className="rich">
          {d.title && <h2>{d.title}</h2>}
          {(d.body || '').split(/\n\s*\n/).map((p: string, k: number) => p.startsWith('## ')
            ? <div key={k}><h3>{p.split('\n')[0].slice(3)}</h3>{p.split('\n').slice(1).join(' ') && <p>{p.split('\n').slice(1).join(' ')}</p>}</div>
            : <p key={k}>{p}</p>)}
        </div>
      );
    case 'cta':
      return <div className="ctab"><h2>{d.title}</h2>{d.text && <p className="sub">{d.text}</p>}{d.buttonText && <SmartLink to={d.buttonLink} className="btn accent big">{d.buttonText}</SmartLink>}</div>;
    default:
      return null;
  }
}

function Block({ s }: any) {
  const d = s.data || {};
  if (s.type === 'hero') return <Hero d={d} />;
  if (s.type === 'imageSlider') return <Slideshow />;
  if (s.type === 'photoSlider') return <PhotoSlider d={d} />;
  if (s.type === 'reviews') return <ReviewsStrip title={d.title} />;
  if (s.type === 'html') return <div dangerouslySetInnerHTML={{ __html: d.html || '' }} />;
  return (
    <section className="sec" style={{ background: d.bg || undefined, color: d.color || undefined }}>
      <div className="wrap"><Inner type={s.type} d={d} /></div>
    </section>
  );
}

export default function Sections({ list }: { list: any[] }) {
  return <>{list.map((s, k) => <Block key={s.id || k} s={s} />)}</>;
}
