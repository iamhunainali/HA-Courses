import { media } from '../api';

const THEMES: any = {
  classic: { bg: '#fffdf8', color: '#1d2433', accent: '#1f3a5f' },
  gold: { bg: '#14213d', color: '#fdf3d7', accent: '#c8a24a' },
  light: { bg: '#ffffff', color: '#1d2433', accent: '#2f6fed' },
  dark: { bg: '#111827', color: '#f3f4f6', accent: '#10b981' },
  rose: { bg: '#fff1f2', color: '#4c0519', accent: '#e11d48' },
};
export const POPUP_THEMES = [...Object.keys(THEMES), 'custom'];
export const themeOf = (s: any = {}) => (s.theme === 'custom' ? { bg: s.bg || '#ffffff', color: s.color || '#1d2433', accent: s.accent || '#1f3a5f' } : THEMES[s.theme || 'classic'] || THEMES.classic);

// Popup ka design: website par aur admin preview dono mein yehi use hota hai
export default function PopupView({ p, onClose, onAction, inline }: { p: any; onClose: () => void; onAction: () => void; inline?: boolean }) {
  const s = p.style || {};
  const th = themeOf(s);
  const layout = s.layout || 'center';
  const imgPos = p.image ? s.imagePos || 'top' : 'none';
  const box = (
    <div className={`popbox sz-${s.size || 'md'} an-${s.anim || 'zoom'} ip-${imgPos}`} style={{ background: th.bg, color: th.color, borderRadius: (s.radius ?? 16) + 'px' }}>
      {s.closable !== false && <button className="popx" onClick={onClose} aria-label="Close" style={{ color: th.color }}>×</button>}
      {imgPos !== 'none' && <div className="popimg"><img src={media(p.image)} alt="" /></div>}
      <div className="popbody">
        {p.title && <h2>{p.title}</h2>}
        {p.body && <p>{p.body}</p>}
        <div className="row">
          {p.buttonText && <button className="btn" style={{ background: th.accent, borderColor: th.accent, color: '#fff' }} onClick={onAction}>{p.buttonText}</button>}
          {s.laterBtn !== false && <button className="btn ghost" style={{ color: th.color, borderColor: 'currentColor', background: 'transparent' }} onClick={onClose}>{s.laterText || 'Maybe later'}</button>}
        </div>
      </div>
    </div>
  );
  if (inline) return <div className={'popstage lay-' + layout}>{box}</div>;
  if (layout === 'corner') return <div className="pop-corner">{box}</div>;
  if (layout === 'banner') return <div className="pop-banner">{box}</div>;
  return <div className={'pop-back' + (s.overlay === false ? ' noov' : '')} onClick={(e) => e.target === e.currentTarget && s.closable !== false && onClose()}>{box}</div>;
}
