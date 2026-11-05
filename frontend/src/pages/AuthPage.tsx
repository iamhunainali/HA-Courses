import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';

export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { login, signup } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = sp.get('next') || '/courses';
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const u = mode === 'login' ? await login(f.email, f.password) : await signup(f.name, f.email, f.password);
      nav(u.role === 'SUPER_ADMIN' && next === '/courses' ? '/admin' : next, { replace: true });
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };

  return (
    <div className="authbox">
      <form onSubmit={submit} className="card">
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        {mode === 'signup' && <input placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />}
        <input type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <input type="password" placeholder="Password (min 6 characters)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
        {err && <p className="err">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Sign up'}</button>
        <p className="muted">
          {mode === 'login' ? <>New here? <Link to={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link></> : <>Already registered? <Link to={`/login?next=${encodeURIComponent(next)}`}>Login</Link></>}
        </p>
      </form>
    </div>
  );
}
