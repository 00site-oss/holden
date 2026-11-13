import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';

export default function Profile() {
  const { me, clearUser, refreshData } = useApp();
  const [hist, setHist] = useState(null);
  const [code, setCode] = useState('');

  useEffect(() => { refreshData(); }, [refreshData]);

  if (!me) {
    return (
      <div className="card gate">
        <i className="fas fa-lock" style={{ fontSize: 28, marginBottom: 10 }} />
        <h3>Your profile</h3>
        <p className="muted">Log in to continue.</p>
      </div>
    );
  }

  const rate = me.attendanceRate ?? 100;
  const cut = me.attendanceCutPct ?? 0;
  const accessible = me.accessibleDiamonds ?? me.diamonds ?? 0;
  const skipped = me.skippedDays ?? 0;
  const recovery = me.recoveryDays ?? 0;
  const needed = me.recoveryNeeded ?? Math.max(1, skipped);

  const redeem = async () => {
    const c = code.trim();
    if (!c) return alert('Enter a code');
    const r = await api('redeemBonusCode', me.id, c);
    if (r?.success) {
      alert('+' + r.diamonds + ' diamonds');
      setCode('');
      refreshData();
    } else alert(r?.error || 'Invalid code');
  };

  const showHistory = async () => {
    const l = await api('getUserCashouts', me.id);
    setHist(l || []);
  };

  const logout = () => {
    clearUser();
    try { localStorage.removeItem('gpt_token_v2'); } catch {}
    window.location.href = '/#/';
  };

  return (
    <>
      <div className="card">
        <div className="prof-head">
          <div className="avatar">{me.username.charAt(0).toUpperCase()}</div>
          <div>
            <h2 style={{ letterSpacing: '-.5px' }}>
              {me.username}
              {me.verified && <i className="fas fa-circle-check" style={{ color: 'var(--blue)', marginLeft: 6 }} />}
            </h2>
            {me.isAdmin ? <span className="tag pending">Administrator</span> : <span className="muted">Member</span>}
          </div>
        </div>
        <div className="stat-grid">
          <div className="stat"><b>{accessible.toLocaleString()}</b><span>Accessible</span></div>
          <div className="stat"><b>{(me.diamonds || 0).toLocaleString()}</b><span>Total balance</span></div>
          <div className="stat"><b>{(me.totalEarned || 0).toLocaleString()}</b><span>Total earned</span></div>
          <div className="stat"><b>{rate}%</b><span>Attendance</span></div>
          <div className="stat"><b>{skipped}</b><span>Skipped days</span></div>
          <div className="stat"><b>{(me.holdBalance || 0).toLocaleString()}</b><span>On hold</span></div>
        </div>
        <div className="card" style={{ padding: '12px 14px', border: 'var(--b)', marginTop: 8, background: rate >= 80 ? 'rgba(34,197,94,.08)' : rate >= 60 ? 'rgba(234,179,8,.1)' : 'rgba(239,68,68,.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
            <span>Attendance Rate</span>
            <span>{rate}%</span>
          </div>
          <div className="bar" style={{ borderColor: '#fff' }}>
            <div style={{ width: `${Math.min(100, rate)}%`, background: rate >= 80 ? 'var(--green)' : rate >= 60 ? 'var(--yellow)' : 'var(--red)', borderColor: '#fff' }} />
          </div>
          <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            {rate >= 80 ? 'Full balance accessible.' :
             rate >= 70 ? `25% of balance locked (accessible ${accessible.toLocaleString()}).` :
             rate >= 60 ? `50% of balance locked.` :
             `75% of balance locked.`}
            {skipped > 0 && ` Recovery: ${recovery}/${needed} active days for next +10%.`}
          </p>
          <p className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            Each skipped day (no credited offer) deducts 4%. Recover 10% by completing offers on as many days as you have currently skipped.
          </p>
          <p className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            Cashout requires at least {me.minAttendanceForCashout || 60}% Attendance Rate and enough accessible balance.
          </p>
          <p className="muted" style={{ marginTop: 4, fontSize: 12, color: 'var(--red)' }}>
            Reaching 0% Attendance Rate results in a permanent ban.
          </p>
        </div>
        {me.holdBalance > 0 && (
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
            Diamonds on hold need admin approval after you show proof for large offers (4,000+).
          </p>
        )}
        {!me.chatUnlocked && (
          <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
            Chat unlocks after {Math.max(0, 500 - (me.totalEarned || 0))} more earned diamonds.
          </p>
        )}
      </div>

      <div className="sec-title"><i className="fas fa-gift" style={{ color: 'var(--orange)' }} /> Bonus code</div>
      <div className="card">
        <div className="inline-form" style={{ margin: 0 }}>
          <input className="input" value={code} onChange={e => setCode(e.target.value)} placeholder="ENTER CODE" style={{ textTransform: 'uppercase' }} />
          <button className="btn green" type="button" onClick={redeem}>Redeem</button>
        </div>
      </div>

      <div className="row-flex" style={{ marginTop: 18 }}>
        <button className="btn violet" type="button" onClick={showHistory}><i className="fas fa-clock-rotate-left" /> Cashout history</button>
        <button className="btn light" type="button" onClick={logout}><i className="fas fa-right-from-bracket" /> Log out</button>
      </div>

      {hist && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 10 }}>Cashout history</h3>
          {!hist.length && <div className="empty">No cashouts yet</div>}
          {hist.map((c, i) => (
            <div className="list-row" key={i}>
              <div className="grow">
                <strong>{c.rewardTitle || 'Reward'}</strong>
                <div className="sub">{c.timestamp ? new Date(c.timestamp).toLocaleString() : ''}</div>
              </div>
              <span className={`tag ${String(c.status || '').toLowerCase()}`}>{c.status}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
