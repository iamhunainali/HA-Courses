import { useMemo } from 'react';
import { useSettings } from '../settings';

// Admin ke har option ke neeche: website par ye cheez aisi dikhegi
export function PreviewBox({ title = 'Live preview', note = 'This is how it will look on the website', children }: any) {
  return (
    <div className="previewbox">
      <div className="previewhead"><span>👁 {title}</span><small>{note}</small></div>
      <div className="previewbody">{children}</div>
    </div>
  );
}

export function HeaderPreview({ menu, showCats, cats, showTeach, siteName }: any) {
  return (
    <div className="header" style={{ position: 'static' }}>
      <span className="logo">{siteName}</span>
      <nav className="cats">
        {menu.filter((m: any) => m.show).map((m: any) => <a key={m.id}>{m.label}</a>)}
        {showTeach && <a>Apply for Teaching</a>}
        {showCats && cats.filter((c: any) => c.showInHeader).map((c: any) => <a key={c.id}>{c.name}</a>)}
      </nav>
      <div className="right"><span className="btn ghost">Login</span><span className="btn">Sign up</span></div>
    </div>
  );
}

export function SettingsPreview({ f }: any) {
  const c = f.brandColor || '#1f3a5f';
  const style: any = { '--brand': c, '--brand2': `color-mix(in srgb, ${c} 80%, black)` };
  return (
    <div style={style}>
      <div className="header" style={{ position: 'static' }}>
        <span className="logo">{f.siteName}</span>
        <nav className="cats"><a>{f.coursesTitle || 'Courses'}</a><a>Reviews</a></nav>
        <div className="right"><span className="btn ghost">Login</span><span className="btn">Sign up</span></div>
      </div>
      <div className="hero-empty" style={{ padding: '36px 16px' }}><h1>{f.tagline}</h1><p>Sign up to explore courses and start watching.</p></div>
      <div className="footer">© {new Date().getFullYear()} {f.siteName}. {f.footerText}{f.contactEmail ? ` · ${f.contactEmail}` : ''}</div>
    </div>
  );
}

export function CoursePreview({ form, cats, thumb }: any) {
  const { settings } = useSettings();
  const url = useMemo(() => (thumb ? URL.createObjectURL(thumb) : ''), [thumb]);
  const premium = form.plan === 'PREMIUM';
  const cat = cats.find((c: any) => c.id === form.categoryId);
  return (
    <PreviewBox title="Course card preview">
      <div style={{ maxWidth: 290 }}>
        <div className="ccard">
          <div className="thumb">{url ? <img src={url} alt="" /> : <span>{(form.title || 'C')[0]}</span>}</div>
          <div className="cbody">
            <div className="row">{cat && <small className="tag">{cat.name}</small>}<small className={'tag ' + (premium ? 'warn' : '')}>{premium ? `Premium · ${settings.currency} ${form.price || 0}` : 'Free'}</small></div>
            <h3>{form.title || 'Course title'}</h3>
            <p className="muted clamp">{form.description || 'Course description appears here.'}</p>
            <small className="muted">0 lectures{premium ? ` · ${Number(form.durationDays) ? form.durationDays + ' days access' : 'lifetime access'}` : ''}</small>
          </div>
          <div className="cfoot"><span className="btn sm">{premium ? 'Buy now' : 'Enroll Now'}</span></div>
        </div>
      </div>
    </PreviewBox>
  );
}

export function CheckoutPreview({ cfg }: any) {
  return (
    <PreviewBox title="Checkout page preview">
      <h2 style={{ marginTop: 0 }}>{cfg.title}</h2>
      {cfg.intro && <p>{cfg.intro}</p>}
      {cfg.instructions && <p className="muted">{cfg.instructions}</p>}
      <div className="methods">{(cfg.methods || []).map((m: any, i: number) => <div className="card" key={i}><b>{m.name}</b><p style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{m.details}</p></div>)}</div>
      <div className="card">
        <label className="fld"><span>Father name *</span><input disabled placeholder="Father's full name" /></label>
        <label className="fld"><span>Phone number *</span><input disabled placeholder="+92 3XX XXXXXXX" /></label>
        {(cfg.fields || []).map((f: any, i: number) => (
          <label className="fld" key={i}><span>{f.label}{f.required && ' *'}</span>
            {f.type === 'textarea' ? <textarea rows={2} disabled /> : f.type === 'select' ? <select disabled><option>Select…</option>{String(f.options || '').split(',').filter(Boolean).map((o) => <option key={o}>{o.trim()}</option>)}</select> : f.type === 'file' ? <input type="file" disabled /> : <input disabled />}
          </label>
        ))}
        {cfg.terms && <label className="fld"><input type="checkbox" disabled /> {cfg.terms}</label>}
        <span className="btn big">{cfg.buttonText}</span>
        {cfg.securityNote && <p className="muted secnote">{cfg.securityNote}</p>}
      </div>
    </PreviewBox>
  );
}

export function NotificationPreview({ sender, title, message }: any) {
  return (
    <PreviewBox title="Notification preview" note="How the user sees it in the bell menu">
      <div className="note unread" style={{ maxWidth: 340, border: '1px solid var(--line)', borderRadius: 10 }}>
        <strong>{title || 'Title'}</strong>{sender && <small className="muted"> · from {sender}</small>}
        <p>{message || 'Your message appears here.'}</p><small>{new Date().toLocaleString()}</small>
      </div>
    </PreviewBox>
  );
}

export function QuestionsPreview({ items }: any) {
  if (!items.length) return <PreviewBox title="What students will see"><p className="muted">Add a question to see the preview.</p></PreviewBox>;
  return (
    <PreviewBox title="What students will see" note="Green tick = correct answer (hidden from students)">
      {items.map((q: any, i: number) => (
        <div className="card q" key={i}>
          <div className="qnum">Question {i + 1}{q.type === 'task' ? ' · Practice task' : q.type === 'multi' ? ' · Select all that apply' : ''}</div>
          <p className="qtext">{q.text || 'Question text'}</p>
          {(q.type === 'mcq' || q.type === 'multi') && (q.options || []).map((o: string, k: number) => (
            <label className="opt" key={k}><input type={q.type === 'mcq' ? 'radio' : 'checkbox'} disabled /> {o || `Option ${k + 1}`}{(q.correct || []).includes(k) && <b className="ok"> ✓</b>}</label>
          ))}
          {q.type === 'short' && <input disabled placeholder="Type your answer" />}
          {q.type === 'task' && <label className="opt"><input type="checkbox" disabled /> I completed this task</label>}
        </div>
      ))}
    </PreviewBox>
  );
}

export function EmailPreview({ subject, body, siteName }: any) {
  const v: any = { name: 'Ali Khan', siteName, course: 'Sample Course', hours: '3', reason: '', until: 'after 1 hour' };
  const r = (t: string) => (t || '').replace(/\{\{(\w+)\}\}/g, (_m, k) => v[k] ?? '');
  return (
    <PreviewBox title="Email preview" note="Sample values are used for {{name}} etc.">
      <div style={{ background: '#faf7f1', padding: 16, borderRadius: 8 }}>
        <div style={{ fontSize: '.8rem', color: '#6b7280', marginBottom: 8 }}>Subject: <b>{r(subject)}</b></div>
        <div style={{ maxWidth: 520, margin: 'auto', background: '#fff', border: '1px solid #e8dfcf', borderTop: '4px solid #c8a24a', borderRadius: 8, padding: 22 }}>
          <h3 style={{ margin: '0 0 10px', color: '#1f3a5f' }}>{siteName}</h3>
          <div dangerouslySetInnerHTML={{ __html: r(body) }} />
        </div>
      </div>
    </PreviewBox>
  );
}
