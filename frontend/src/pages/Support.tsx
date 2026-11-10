import { useEffect, useMemo, useRef, useState } from 'react';
import { api, token, upload } from '../api';

// WhatsApp / iMessage jaisa chat: sirf message aur photo
export default function Support() {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);

  const load = () => api('/support/messages').then(setMsgs).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  const send = async () => {
    if (!text.trim() && !file) return;
    setBusy(true); setErr('');
    try {
      const fd = new FormData(); fd.append('text', text); if (file) fd.append('image', file);
      await upload('/support/messages', fd, 'POST', () => {});
      setText(''); setFile(null); await load();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  const img = (m: any) => `/api/support/image/${m.image}?token=${token()}`;

  return (
    <div className="page narrow">
      <h1>Support</h1>
      <p className="muted">Report an issue: send a message and a photo (screenshot). Our team will reply here.</p>
      <div className="chat">
        <div className="chatbody">
          {msgs.length === 0 && <p className="muted" style={{ textAlign: 'center', marginTop: 40 }}>No messages yet. Say hello 👋</p>}
          {msgs.map((m) => (
            <div key={m.id} className={'bub ' + (m.from === 'USER' ? 'me' : 'them')}>
              {m.image && <img src={img(m)} alt="" onClick={() => setZoom(img(m))} />}
              {m.text && <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>}
              <small>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{m.from === 'USER' && <b className={m.readByAdmin ? 'read' : ''}> {m.readByAdmin ? '✓✓' : '✓'}</b>}</small>
            </div>
          ))}
          <div ref={end} />
        </div>
        {preview && <div className="chatpreview"><img src={preview} alt="" /><button className="btn sm danger" onClick={() => setFile(null)}>Remove</button></div>}
        {err && <p className="err" style={{ margin: '4px 12px' }}>{err}</p>}
        <div className="chatbar">
          <input ref={pick} type="file" accept="image/*" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button className="chatbtn" onClick={() => pick.current?.click()} title="Attach photo">📷</button>
          <input value={text} placeholder="Type a message" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
          <button className="chatbtn send" onClick={send} disabled={busy}>➤</button>
        </div>
      </div>
      {zoom && <div className="modal-back" onClick={() => setZoom('')}><img src={zoom} alt="" style={{ maxWidth: '92%', maxHeight: '88vh', borderRadius: 12 }} /></div>}
    </div>
  );
}
