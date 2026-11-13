import { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Chat from './Chat';
import { api } from '../utils/api';

export default function Layout({ children }) {
  const { me, clearUser, ticker, setTicker, maintenance, maintenanceMessage, refreshData } = useApp();
  const [chatOn, setChatOn] = useState(false);
  const refreshRef = useRef(refreshData);
  refreshRef.current = refreshData;

  useEffect(() => {
    const id = setInterval(() => {
      api('getActivityTicker', 25).then(t => {
        if (Array.isArray(t) && t.length) setTicker(t);
      }).catch(() => {});
    }, 60000);
    return () => clearInterval(id);
  }, [setTicker]);

  // Soft refresh every 2 minutes — stable, no loop
  useEffect(() => {
    const id = setInterval(() => { refreshRef.current?.(); }, 120000);
    return () => clearInterval(id);
  }, []);

  const items = (ticker || []).slice(0, 12);

  return (
    <>
      <div className="bg" aria-hidden="true">
        <i className="b1" /><i className="b2" /><i className="b3" /><i className="b4" />
      </div>

      {maintenance && !me?.isAdmin && (
        <div className="maint-lock" role="alertdialog" aria-modal="true" aria-label="Under maintenance">
          <div className="maint-card">
            <div className="maint-ico"><i className="fas fa-screwdriver-wrench" /></div>
            <h2>Under maintenance</h2>
            <p>{maintenanceMessage || 'We are updating the site. Please check back soon.'}</p>
            <div className="maint-note">This notice cannot be closed.</div>
          </div>
        </div>
      )}

      <div className="app">
        <aside className="side">
          <div className="brand">
            <span className="logo-sq"><i className="fas fa-gem" style={{fontSize:14}} /></span>
            01GH
          </div>
          <NavLink to="/earn" className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
            <i className="fas fa-bolt" /> Earn
          </NavLink>
          <NavLink to="/shop" className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
            <i className="fas fa-gift" /> Rewards
          </NavLink>
          <NavLink to="/leaders" className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
            <i className="fas fa-crown" /> Top
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
            <i className="fas fa-user" /> Me
          </NavLink>
          <NavLink to="/help" className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}>
            <i className="fas fa-circle-question" /> Help
          </NavLink>
          {me?.isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => `nav-btn admin${isActive ? ' active' : ''}`}>
              <i className="fas fa-shield-halved" /> Admin
            </NavLink>
          )}
          <button
            type="button"
            className={`nav-btn${chatOn ? ' active' : ''}`}
            onClick={() => setChatOn(v => !v)}
          >
            <i className="fas fa-comments" /> Chat
          </button>
          <div className="side-foot">
            {me ? (
              <button type="button" className="btn light block sm" onClick={() => { clearUser(); }}>
                <i className="fas fa-right-from-bracket" /> Log out
              </button>
            ) : null}
          </div>
        </aside>

        <div className="main">
          <div className="topbar">
            <div className="m-brand"><span className="logo-sq"><i className="fas fa-gem" style={{fontSize:12}} /></span> 01GH</div>
            <h1>Get Paid To</h1>
            <div className="top-right">
              {me?.score && (
                <div className="pill" title="Overall Score: points today / daily target">
                  <i className="fas fa-bullseye" /> {me.score.points.toLocaleString()}/{me.score.target.toLocaleString()}
                </div>
              )}
              <div className="pill"><i className="fas fa-gem" /> {(me?.diamonds || 0).toLocaleString()}</div>
            </div>
          </div>

          {items.length > 0 && (
            <div className="ticker">
              <div className="ticker-track">
                {[...items, ...items].map((t, i) => (
                  <span className="tk" key={i}>
                    <span className="tk-dot" />
                    <strong>{t.username}</strong> {t.detail || t.action}
                    {t.time ? <b>{t.time}</b> : null}
                  </span>
                ))}
              </div>
            </div>
          )}

          {children}
        </div>
      </div>

      <nav className="dock">
        <NavLink to="/earn" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-bolt" />Earn
        </NavLink>
        <NavLink to="/shop" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-gift" />Rewards
        </NavLink>
        <NavLink to="/leaders" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-crown" />Top
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-user" />Me
        </NavLink>
        <NavLink to="/help" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-circle-question" />Help
        </NavLink>
        {me?.isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>
            <i className="fas fa-shield-halved" />Admin
          </NavLink>
        )}
        <button type="button" onClick={() => setChatOn(v => !v)} className={chatOn ? 'active' : ''}>
          <i className="fas fa-comments" />Chat
        </button>
      </nav>

      <Chat open={chatOn} onClose={() => setChatOn(false)} />
    </>
  );
}
