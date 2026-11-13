import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { api, TOKEN_KEY } from '../utils/api';

export default function AuthModal({ onClose }) {
  const { setUser } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!username || !password) return setErr('Enter both fields.');
    setBusy(true);
    setErr('');
    try {
      // Clear any logout guard so the next login can succeed
      try { sessionStorage.removeItem('justLoggedOut'); } catch {}
      const r = await api('loginUser', username.trim(), password.trim());
      if (r && r.success && r.user) {
        if (r.user.sessionToken) {
          try { localStorage.setItem(TOKEN_KEY, r.user.sessionToken); } catch {}
        }
        setUser(r.user);
        onClose();
      } else {
        setErr(r?.error || 'Invalid username or password');
      }
    } catch (ex) {
      setErr(ex?.message || 'Server error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay on" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-h">
          <h3>Log in</h3>
          <button type="button" className="x" onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>
        <div className="modal-b">
          <form onSubmit={submit}>
            <div className="field"><label className="l">Username</label><input className="input" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" /></div>
            <div className="field"><label className="l">Password</label><input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></div>
            <div className="err">{err}</div>
            <button className="btn block" disabled={busy} type="submit">{busy ? 'Logging in...' : 'Log in'}</button>
          </form>
          <p className="muted" style={{ fontSize: 12, marginTop: 12, textAlign: 'center' }}>No account? Ask the administrator to create one.</p>
        </div>
      </div>
    </div>
  );
}
