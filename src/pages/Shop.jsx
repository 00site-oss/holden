import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';

function rewardLogo(it) {
  if (it.logo) return it.logo;
  const t = String(it.type || it.title || '').toLowerCase();
  const map = {
    paypal: 'paypal.com', amazon: 'amazon.com', steam: 'steampowered.com',
    roblox: 'roblox.com', discord: 'discord.com', visa: 'visa.com',
    bitcoin: 'bitcoin.org', btc: 'bitcoin.org', litecoin: 'litecoin.org', ltc: 'litecoin.org',
    ethereum: 'ethereum.org', eth: 'ethereum.org', solana: 'solana.com',
    google: 'google.com', apple: 'apple.com'
  };
  for (const k of Object.keys(map)) {
    if (t.includes(k)) return `https://www.google.com/s2/favicons?domain=${map[k]}&sz=128`;
  }
  return 'https://www.google.com/s2/favicons?domain=example.com&sz=128';
}

export default function Shop() {
  const { me, shop, refreshData, setUser } = useApp();
  const [pick, setPick] = useState(null);
  const [info, setInfo] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { if (me?.id) refreshData(); }, [me?.id]);

  if (!me) {
    return (
      <div className="card gate">
        <i className="fas fa-lock" />
        <h3>Rewards are for members</h3>
        <p className="muted">Log in to continue.</p>
      </div>
    );
  }

  const bal = Number(me.accessibleDiamonds ?? me.diamonds) || 0;
  const items = [...(shop || [])].sort((a, b) => (bal >= b.cost) - (bal >= a.cost) || a.cost - b.cost);

  const confirm = async () => {
    if (!pick || !info.trim()) return setErr('Required');
    setErr('');
    const payload = pick.type === 'crypto' ? { walletAddress: info } : { email: info };
    const r = await api('requestCashout', me.id, pick.id, payload);
    if (r?.success) {
      if (r.user) setUser(r.user);
      setPick(null);
      setInfo('');
      alert('Request sent! An admin will review it.');
      refreshData();
    } else setErr(r?.error || 'Failed');
  };

  return (
    <>
      <div className="shop-head">
        <div>
          <div className="muted" style={{ fontWeight: 600 }}>Your accessible balance</div>
          <div className="shop-bal"><i className="fas fa-gem" /> {bal.toLocaleString()}</div>
        </div>
        <p className="muted">Cash out to crypto, PayPal, or gift cards.</p>
      </div>

      {!items.length && <div className="empty"><i className="fas fa-gift" />No rewards configured yet</div>}

      <div className="shop-grid">
        {items.map(it => {
          const can = bal >= it.cost;
          const pct = Math.min(100, Math.round((bal / Math.max(1, it.cost)) * 100));
          return (
            <div key={it.id} className="card reward">
              <div className="reward-top">
                <img className="logo" src={rewardLogo(it)} alt="" onError={e => { e.target.src = 'https://www.google.com/s2/favicons?domain=google.com&sz=128'; }} />
                <div>
                  <b>{it.title}</b>
                  <div className="muted" style={{ fontSize: 13 }}>{it.subtitle || it.type}</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
                <span className="price">${it.amount}</span>
                <span className="cost"><i className="fas fa-gem" /> {Number(it.cost).toLocaleString()}</span>
              </div>
              <div className="bar"><div style={{ width: `${pct}%`, background: can ? 'var(--green)' : undefined }} /></div>
              <div className="prog">{can ? 'Ready to redeem' : `${(it.cost - bal).toLocaleString()} more diamonds`}</div>
              <button className={`btn block${can ? ' green' : ''}`} disabled={!can} type="button" onClick={() => { setPick(it); setInfo(''); setErr(''); }}>
                {can ? 'Redeem' : 'Not enough diamonds'}
              </button>
            </div>
          );
        })}
      </div>

      {pick && (
        <div className="overlay on" onClick={() => setPick(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-h">
              <h3>Redeem reward</h3>
              <button className="x" type="button" onClick={() => setPick(null)}><i className="fas fa-xmark" /></button>
            </div>
            <div className="modal-b">
              <div style={{ textAlign: 'center', marginBottom: 18 }}>
                <img className="logo" style={{ width: 64, height: 64, margin: '0 auto 10px', display: 'block' }} src={rewardLogo(pick)} alt="" />
                <h3 style={{ fontSize: 20 }}>{pick.title}</h3>
                <div className="price">${pick.amount}</div>
              </div>
              <div className="field">
                <label className="l">{pick.type === 'crypto' ? 'Wallet address' : 'Delivery email'}</label>
                <input className="input" value={info} onChange={e => setInfo(e.target.value)}
                  placeholder={pick.type === 'crypto' ? 'Paste wallet address' : 'you@example.com'} />
              </div>
              <div className="err">{err}</div>
              <div className="row-flex">
                <button className="btn light" type="button" style={{ flex: 1 }} onClick={() => setPick(null)}>Cancel</button>
                <button className="btn green" type="button" style={{ flex: 2 }} onClick={confirm}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
