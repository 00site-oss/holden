import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import AuthModal from '../components/AuthModal';
import DailyModal from '../components/DailyModal';

function Landing({ board, walls, shop }) {
  const top = board && board[0] ? board[0].diamonds.toLocaleString() : '0';
  return (
    <section className="land">
      <h1 className="land-h">Turn spare time into <span>REAL REWARDS</span></h1>
      <p className="land-p">Finish offers and surveys, collect diamonds, then cash out to crypto, PayPal or gift cards.</p>
      <div className="lt-grid">
        <button className="lt" type="button" onClick={() => document.getElementById('auth-trigger')?.click()}>
          <div className="lt-t">Take <span>Surveys</span></div>
          <div className="lt-i"><i className="fas fa-clipboard-list" /></div>
        </button>
        <button className="lt" type="button" onClick={() => document.getElementById('auth-trigger')?.click()}>
          <div className="lt-t">Try <span>Apps</span></div>
          <div className="lt-i"><i className="fas fa-mobile-screen" /></div>
        </button>
        <button className="lt" type="button" onClick={() => document.getElementById('auth-trigger')?.click()}>
          <div className="lt-t">Play <span>Games</span></div>
          <div className="lt-i"><i className="fas fa-gamepad" /></div>
        </button>
        <button className="lt" type="button" onClick={() => document.getElementById('auth-trigger')?.click()}>
          <div className="lt-t">Gift <span>Cards</span></div>
          <div className="lt-i"><i className="fas fa-gift" /></div>
        </button>
      </div>
      <div className="ls-grid">
        <div className="ls"><div className="ls-t">OFFER WALLS</div><div className="ls-v">{walls.length}</div></div>
        <div className="ls"><div className="ls-t">REWARDS</div><div className="ls-v">{shop.length}</div></div>
        <div className="ls"><div className="ls-t">TOP BALANCE</div><div className="ls-v">{top}</div></div>
        <div className="ls"><div className="ls-t">PLAYERS</div><div className="ls-v">{board.length}</div></div>
      </div>
      <div className="land-cta">
        <button className="btn block" type="button" onClick={() => document.getElementById('auth-trigger')?.click()}>
          <i className="fas fa-right-to-bracket" /> Log in to start earning
        </button>
      </div>
    </section>
  );
}

export default function Earn() {
  const { me, walls, shop, board, refreshData } = useApp();
  const [showAuth, setShowAuth] = useState(false);
  const [showDaily, setShowDaily] = useState(false);
  const [wallUrl, setWallUrl] = useState('');
  const [wallTitle, setWallTitle] = useState('');

  useEffect(() => { if (me?.id) refreshData(); }, [me?.id]); // stable — no flicker loop

  const openWall = (w) => {
    if (w.name?.toLowerCase() === '01gh rewards' || /internal:daily/i.test(w.url || '')) {
      setShowDaily(true);
      return;
    }
    if (!/^https?:\/\//i.test(w.url)) return alert('No link set');
    setWallTitle(w.name);
    setWallUrl(w.url);
  };

  if (!me) {
    return (
      <>
        <Landing board={board || []} walls={walls || []} shop={shop || []} />
        <button id="auth-trigger" className="hidden" type="button" onClick={() => setShowAuth(true)} />
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </>
    );
  }

  const bal = me.accessibleDiamonds ?? me.diamonds ?? 0;
  const totalBal = me.diamonds || 0;
  const earned = me.totalEarned || 0;
  const rate = me.attendanceRate ?? 100;
  const cut = me.attendanceCutPct ?? 0;

  return (
    <>
      <div className="hero">
        <small>Accessible balance</small>
        <div className="big"><i className="fas fa-gem" /> {bal.toLocaleString()}</div>
        <div className="hero-row">
          <span><i className="fas fa-chart-line" /> {earned.toLocaleString()} earned all-time</span>
          <span><i className="fas fa-calendar-check" /> Attendance {rate}%</span>
        </div>
        {cut > 0 && (
          <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            Total balance {totalBal.toLocaleString()} · {cut}% locked due to attendance
          </div>
        )}
      </div>

      {me.holdBalance > 0 && (
        <div className="policy" style={{ marginTop: 14 }}>
          <i className="fas fa-lock" /> {me.holdBalance.toLocaleString()} diamonds on hold — large offers may need proof before release.
        </div>
      )}

      <div className="sec-title"><i className="fas fa-bolt" style={{ color: 'var(--orange)' }} /> Ways to earn</div>
      <div className="cols2">
        {(walls || []).map((w) => {
          const min = Number(w.minDiamonds) || 0;
          const locked = bal < min;
          return (
            <button
              key={w.id || w.name}
              type="button"
              className={`wall${locked ? ' locked' : ''}`}
              onClick={() => {
                if (locked) return alert(`Unlocks at ${min} diamonds`);
                openWall(w);
              }}
            >
              <div className="logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, overflow: 'hidden' }}>
                {w.logo ? <img src={w.logo} alt="" onError={e => { e.target.style.display='none'; }} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <i className="fas fa-globe" />}
              </div>
              <div>
                <div className="nm">{w.name}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {locked ? `Unlocks at ${min.toLocaleString()} diamonds` : 'Tap to open'}
                </div>
              </div>
              <div className="go">
                <i className={`fas ${locked ? 'fa-lock' : 'fa-arrow-up-right-from-square'}`} />
              </div>
            </button>
          );
        })}
      </div>
      {!(walls || []).length && <div className="empty"><i className="fas fa-layer-group" />No offerwalls yet</div>}

      {showDaily && <DailyModal onClose={() => setShowDaily(false)} />}
      {wallUrl && (
        <div className="overlay on" id="wallOv" onClick={() => setWallUrl('')}>
          <div className="wall-frame" onClick={e => e.stopPropagation()}>
            <div className="wall-frame-h">
              <strong>{wallTitle}</strong>
              <button className="x" type="button" onClick={() => setWallUrl('')}><i className="fas fa-xmark" /></button>
            </div>
            <iframe title={wallTitle} src={wallUrl} allow="fullscreen" />
          </div>
        </div>
      )}
    </>
  );
}
