import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';

export default function DailyModal({ onClose }) {
  const { me, refreshData } = useApp();
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!me) return;
    api('getDailyStatus', me.id).then(setSt).catch(() => {});
  }, [me]);

  const claim = async () => {
    if (!me || busy) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await api('claimDaily', me.id);
      if (r?.success) {
        setMsg('+' + (r.diamonds || 0) + ' diamonds!');
        refreshData();
        setSt(await api('getDailyStatus', me.id));
      } else setMsg(r?.error || 'Could not claim');
    } catch { setMsg('Server error'); }
    setBusy(false);
  };

  return (
    <div className="overlay on" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-h">
          <h3>01GH Rewards</h3>
          <button className="x" type="button" onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>
        <div className="modal-b">
          {!st ? <div className="skel" /> : (
            <div className="dm-box">
              <div className="dm-sub">
                <span className="tag pending">Daily reward</span>
                
              </div>
              <p className="muted" style={{ margin: '10px 0', fontSize: 13 }}>
                Need <strong>{st.monthRequired || 500}</strong> offer diamonds this month.
                You have <strong>{st.monthEarn || 0}</strong>.
              </p>
              {st.monthOk === false ? (
                <div className="err"><i className="fas fa-lock" /> Earn more from offers this month</div>
              ) : st.canClaim ? (
                <button className="btn green block" type="button" disabled={busy} onClick={claim}>
                  {busy ? '...' : `Claim ${st.reward || 1}`}
                </button>
              ) : (
                <div className="muted" style={{ textAlign: 'center', fontWeight: 700 }}>Already claimed — come back later</div>
              )}
              {msg && <div className="dm-msg">{msg}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
