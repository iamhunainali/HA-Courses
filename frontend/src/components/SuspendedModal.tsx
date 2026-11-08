import { useEffect, useState } from 'react';

const hms = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
};

// Suspended account: har login attempt par (email detect hone par) warning popup + countdown
export default function SuspendedModal() {
  const [info, setInfo] = useState<any>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const h = (e: any) => setInfo(e.detail);
    window.addEventListener('suspended', h);
    return () => window.removeEventListener('suspended', h);
  }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!info) return null;
  const left = info.until ? new Date(info.until).getTime() - now : null;
  return (
    <div className="modal-back">
      <div className="modal suspendbox">
        <div className="bigemoji">⚠️</div>
        <h2>Account suspended</h2>
        {info.reason && <p className="err"><b>{info.reason}</b></p>}
        {left === null && <p>Your account stays suspended until an admin reactivates it. Please contact support.</p>}
        {left !== null && left > 0 && (
          <>
            <p>You will be able to log in again after <b>{new Date(info.until).toLocaleTimeString()}</b>.</p>
            <p className="muted">Time remaining</p>
            <div className="timer">{hms(left)}</div>
          </>
        )}
        {left !== null && left <= 0 && <p className="ok"><b>Your suspension is over. You can log in now.</b></p>}
        <button className="btn" onClick={() => setInfo(null)}>OK</button>
      </div>
    </div>
  );
}
