import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { parseMenu, useSettings } from '../settings';

export default function Header() {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const menu = parseMenu(settings.headerMenu);
  const nav = useNavigate();
  const [cats, setCats] = useState<any[]>([]);
  const [enrolled, setEnrolled] = useState(0);
  const [notes, setNotes] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const unread = notes.filter((n) => !n.read).length;

  const loadNotes = () => api('/notifications').then(setNotes).catch(() => {});
  useEffect(() => {
    const load = () => api('/categories').then(setCats).catch(() => {});
    load();
    window.addEventListener('site-changed', load);   // admin panel se save hote hi header update
    return () => window.removeEventListener('site-changed', load);
  }, []);
  const loadEnrolled = () => api('/my/enrollments').then((r) => setEnrolled(r.length)).catch(() => {});
  useEffect(() => {
    if (!user) { setEnrolled(0); setNotes([]); return; }
    loadEnrolled();
    loadNotes();
    const t = setInterval(loadNotes, 30000);
    // enroll hote hi Dashboard icon aur notification foran update
    const onEnrolled = () => { loadEnrolled(); loadNotes(); };
    window.addEventListener('enrolled-changed', onEnrolled);
    return () => { clearInterval(t); window.removeEventListener('enrolled-changed', onEnrolled); };
  }, [user]);

  const toggleBell = async () => {
    setOpen(!open);
    if (!open && unread) { await api('/notifications/read', { method: 'POST' }); setTimeout(loadNotes, 1500); }
  };

  return (
    <header className="header">
      <Link to="/" className="logo">{settings.siteName}</Link>
      <nav className="cats">
        {menu.map((m: any) => /^https?:/.test(m.to)
          ? <a key={m.id} href={m.to} target="_blank" rel="noreferrer">{m.label}</a>
          : <Link key={m.id} to={m.to}>{m.label}</Link>)}
        {settings.headerShowCategories !== 'false' && cats.filter((c) => c.showInHeader).map((c) => (
          <Link key={c.id} to={`/courses?category=${c.id}`}>{c.name}</Link>
        ))}
      </nav>
      <div className="right">
        {!user ? (
          <>
            <Link className="btn ghost" to="/login">Login</Link>
            <Link className="btn" to="/signup">Sign up</Link>
          </>
        ) : (
          <>
            {(enrolled > 0 || user.role === 'SUPER_ADMIN') && (
              <Link to="/dashboard" className="icon" title="Dashboard">🎓<span className="lbl">Dashboard</span></Link>
            )}
            {user.role === 'SUPER_ADMIN' && <Link to="/admin" className="navlink">Admin</Link>}
            <div className="bellwrap">
              <button className="icon" onClick={toggleBell} title="Notifications">🔔{unread > 0 && <b className="badge">{unread}</b>}</button>
              {open && (
                <div className="drop">
                  {notes.length === 0 && <p className="muted pad">No notifications yet.</p>}
                  {notes.map((n) => (
                    <div key={n.id} className={'note' + (n.read ? '' : ' unread')}>
                      <strong>{n.title}</strong>{n.sender && <small className="muted"> · from {n.sender}</small>}
                      <p>{n.message}</p>
                      <small>{new Date(n.createdAt).toLocaleString()}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span className="hello">{user.name.split(' ')[0]}</span>
            <button className="btn ghost" onClick={() => { logout(); nav('/'); }}>Logout</button>
          </>
        )}
      </div>
    </header>
  );
}
