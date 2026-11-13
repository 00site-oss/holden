import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';

export default function Admin() {
  const { me } = useApp();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('cashouts');
  const [execUrl, setExecUrl] = useState(localStorage.getItem('gpt_exec_url') || '');

  const load = async () => {
    const r = await api('adminGetDashboard', me.id);
    if (r?.success) setData(r);
  };

  useEffect(() => { load(); }, [me]);

  if (!data) return <div className="skel" />;

  const doAction = async (fn, args, msg) => {
    const r = await api(fn, me.id, ...args);
    if (r?.success) {
      alert(msg || 'Done');
      load();
    } else alert(r?.error || 'Failed');
  };

  const tabs = [
    ['cashouts', 'Cashouts', data.pendingCashouts.length],
    ['users', 'Users', data.users.length],
    ['support', 'Support', (data.support || []).length],
    ['codes', 'Codes', data.bonusCodes.length],
    ['rewards', 'Rewards', data.rewards.length],
    ['walls', 'Offerwalls', data.offerwalls.length]
  ];

  return (
    <>
      <div className="policy"><i className="fas fa-circle-info" /> Verified badge is granted by admins only. Large holds need proof.</div>
      <div className="tabs">
        {tabs.map(([id, label, ct]) => (
          <button key={id} className={`tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
            {label}<span className="ct">{ct}</span>
          </button>
        ))}
      </div>
      <div className="card">
        {tab === 'cashouts' && (
          data.pendingCashouts.length ? data.pendingCashouts.map(c => {
            let info = {};
            try { info = typeof c.deliveryInfo === 'string' ? JSON.parse(c.deliveryInfo) : (c.deliveryInfo || {}); } catch {}
            const addr = info.address || info.wallet || info.ltc || '';
            const isCrypto = /ltc|btc|eth|crypto|doge/i.test(c.rewardTitle || '');
            return (
              <div key={c.id} className="list-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                <div className="grow">
                  <strong>{c.rewardTitle}</strong> · ${c.amount}
                  <div className="sub">{c.username} · {c.cost} diamonds</div>
                  {addr && <div className="sub" style={{ wordBreak: 'break-all' }}>{addr}</div>}
                </div>
                {isCrypto && addr && (
                  <img
                    alt="QR"
                    width={80}
                    height={80}
                    style={{ borderRadius: 8, background: '#fff', padding: 4 }}
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(addr)}`}
                  />
                )}
                {isCrypto && (
                  <input className="input" id={`tx-${c.id}`} placeholder="Paste tx hash" style={{ maxWidth: 220 }} />
                )}
                <button className="btn sm green" onClick={() => {
                  const tx = isCrypto ? (document.getElementById(`tx-${c.id}`)?.value || '') : '';
                  doAction('adminUpdateCashout', [c.id, 'approved', tx], 'Approved');
                }}>Approve</button>
                <button className="btn sm red" onClick={() => doAction('adminUpdateCashout', [c.id, 'rejected', ''], 'Rejected')}>Reject</button>
              </div>
            );
          }) : <div className="empty">All caught up.</div>
        )}

        {tab === 'users' && (
          <>
            <div className="inline-form">
              <input className="input" id="nuU" placeholder="New username" />
              <input className="input" id="nuP" placeholder="Password" />
              <input className="input w80" id="nuD" type="number" defaultValue="0" />
              <button className="btn sm" onClick={() => doAction('adminCreateUser', [document.getElementById('nuU').value, document.getElementById('nuP').value, document.getElementById('nuD').value], 'Created')}>Create</button>
            </div>
            {data.users.map(u => (
              <div key={u.id} className="list-row">
                <div className="grow"><strong>{u.username}</strong><div className="sub">Att {u.attendanceRate || 100}% · {u.totalEarned} earned · skipped {u.skippedDays || 0}</div></div>
                <input className="input w80" type="number" defaultValue={u.diamonds} id={`bal-${u.id}`} />
                <button className="btn sm red" onClick={() => { if (window.confirm(`Reset ${u.username}'s profile (diamonds, earned, holds, score) to 0?`)) doAction('adminResetUser', [u.id], 'Profile reset'); }}>Reset</button>
                <button className="btn sm violet" onClick={() => doAction('adminSetDiamonds', [u.id, document.getElementById(`bal-${u.id}`).value], 'Updated')}>Save</button>
              </div>
            ))}
          </>
        )}

        {tab === 'codes' && (
          <>
            <div className="inline-form">
              <input className="input" id="ncC" placeholder="CODE" />
              <input className="input w80" id="ncD" type="number" placeholder="Diamonds" />
              <input className="input w80" id="ncM" type="number" placeholder="Max uses" />
              <button className="btn sm green" onClick={() => doAction('adminCreateBonusCode', [document.getElementById('ncC').value, document.getElementById('ncD').value, document.getElementById('ncM').value || 0], 'Created')}>Add</button>
            </div>
            {data.bonusCodes.map(c => (
              <div key={c.code} className="list-row">
                <div className="grow"><strong>{c.code}</strong></div>
                <span>{c.diamonds} <i className="fas fa-gem" style={{ color: 'var(--orange)' }} /></span>
                <span className="muted">{c.usedCount}{c.maxUses ? `/${c.maxUses}` : ''} used</span>
                <span className={`tag ${String(c.status).toLowerCase() === 'active' ? 'approved' : 'rejected'}`}>{c.status}</span>
              </div>
            ))}
          </>
        )}

        {tab === 'rewards' && (
          <>
            <div className="inline-form">
              <input className="input" id="nrT" placeholder="Title (PayPal $5)" />
              <input className="input w80" id="nrY" placeholder="paypal" />
              <input className="input w80" id="nrA" type="number" placeholder="$" />
              <input className="input w80" id="nrC" type="number" placeholder="Cost" />
              <button className="btn sm green" onClick={() => doAction('adminSaveReward', [{ title: document.getElementById('nrT').value, type: document.getElementById('nrY').value || 'giftcard', amount: document.getElementById('nrA').value, cost: document.getElementById('nrC').value }], 'Added')}>Add</button>
            </div>
            {data.rewards.map(x => (
              <div key={x.id} className="list-row">
                <div className="grow"><strong>{x.title}</strong><div className="sub">${x.amount} · {x.cost} diamonds · {x.type}</div></div>
                <button className={`btn sm ${String(x.status).toLowerCase() === 'active' ? 'light' : 'green'}`} onClick={() => doAction('adminToggleReward', [x.id, String(x.status).toLowerCase() !== 'active'], 'Updated')}>
                  {String(x.status).toLowerCase() === 'active' ? 'Disable' : 'Enable'}
                </button>
                <button className="btn sm red" onClick={() => { if (confirm('Delete this reward?')) doAction('adminDeleteReward', [x.id], 'Deleted'); }}>Delete</button>
              </div>
            ))}
          </>
        )}

        {tab === 'walls' && (
          <>
            <div className="inline-form">
              <input className="input" id="nwN" placeholder="Name (Lootably)" />
              <input className="input" id="nwU" placeholder="URL template with {id}" />
              <input className="input w80" id="nwM" type="number" placeholder="Min diamonds" defaultValue="0" />
              <button className="btn sm green" onClick={() => doAction('adminSaveOfferwall', [{ name: document.getElementById('nwN').value, urlTemplate: document.getElementById('nwU').value, minDiamonds: document.getElementById('nwM').value }], 'Added')}>Add</button>
            </div>
            {data.offerwalls.map(o => (
              <div key={o.id} className="list-row">
                <div className="grow"><strong>{o.name}</strong></div>
                <button className={`btn sm ${o.enabled ? 'light' : 'green'}`} onClick={() => doAction('adminUpdateOfferwall', [o.id, !o.enabled, null], 'Updated')}>
                  {o.enabled ? 'Disable' : 'Enable'}
                </button>
                <button className="btn sm red" onClick={() => { if (confirm('Delete this offerwall?')) doAction('adminDeleteOfferwall', [o.id], 'Deleted'); }}>Delete</button>
              </div>
            ))}
          </>
        )}

        {tab === 'support' && (
          data.support?.length ? data.support.map(s => (
            <div key={s.id} className="list-row">
              <div className="grow"><strong>{s.username}</strong><div className="sub">{s.message}</div></div>
              <button className="btn sm" onClick={() => {
                const reply = prompt('Reply:');
                if (reply) doAction('adminReplySupport', [s.id, reply], 'Sent');
              }}>Reply</button>
              <button className="btn sm light" onClick={() => doAction('adminCloseSupport', [s.id], 'Closed')}>Close</button>
            </div>
          )) : <div className="empty">No support messages.</div>
        )}
      </div>
    </>
  );
}
