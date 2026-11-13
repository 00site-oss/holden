import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, TOKEN_KEY } from '../utils/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState([]);
  const [walls, setWalls] = useState([]);
  const [board, setBoard] = useState([]);
  const [ticker, setTicker] = useState([]);
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const meIdRef = useRef(null);
  const refreshing = useRef(false);
  const allowLogin = useRef(true);

  useEffect(() => {
    meIdRef.current = me?.id || null;
  }, [me?.id]);

  const setUser = useCallback((u) => {
    if (!u) return;
    // Always allow explicit login — clear logout guard
    try { sessionStorage.removeItem('justLoggedOut'); } catch {}
    allowLogin.current = true;
    const tok = u.sessionToken || '';
    const next = { ...u };
    if (tok) {
      try { localStorage.setItem(TOKEN_KEY, tok); } catch {}
    }
    meIdRef.current = next.id || null;
    setMe(next);
  }, []);

  const clearUser = useCallback(() => {
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
    try { sessionStorage.setItem('justLoggedOut', '1'); } catch {}
    meIdRef.current = null;
    allowLogin.current = false;
    setMe(null);
    // Re-enable login after this tick (blocks only auto token restore)
    setTimeout(() => { allowLogin.current = true; }, 300);
  }, []);

  const refreshData = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const id = meIdRef.current;
      const d = await api('getInitialData', id || null);
      if (!d) return d;

      setMaintenance(!!d.maintenance);
      setMaintenanceMessage(d.maintenanceMessage || 'Under maintenance. Please check back soon.');

      if (Array.isArray(d.shopItems) && (d.shopItems.length || !id)) setShop(d.shopItems);
      if (Array.isArray(d.offerwalls) && (d.offerwalls.length || !id)) setWalls(d.offerwalls);
      if (Array.isArray(d.leaderboard)) setBoard(d.leaderboard);
      if (Array.isArray(d.activityTicker) && d.activityTicker.length) setTicker(d.activityTicker);

      // Only sync user if still logged in (have id)
      if (d.user && d.user.id && meIdRef.current) {
        setMe(prev => prev ? { ...prev, ...d.user } : prev);
      }
      return d;
    } catch (e) {
      console.error(e);
    } finally {
      refreshing.current = false;
    }
  }, []);

  useEffect(() => {
    // Skip auto-login if user just logged out this session
    if (sessionStorage.getItem('justLoggedOut')) {
      try { sessionStorage.removeItem('justLoggedOut'); } catch {}
      try { localStorage.removeItem(TOKEN_KEY); } catch {}
      setMe(null);
      setLoading(false);
      api('getInitialData', null).then(d => {
        if (d?.shopItems) setShop(d.shopItems);
        if (d?.leaderboard) setBoard(d.leaderboard);
        if (d?.activityTicker) setTicker(d.activityTicker);
      }).catch(() => {});
      return;
    }

    const tok = localStorage.getItem(TOKEN_KEY);
    if (!tok) {
      setLoading(false);
      api('getInitialData', null).then(d => {
        if (d?.shopItems) setShop(d.shopItems);
        if (d?.leaderboard) setBoard(d.leaderboard);
        if (d?.activityTicker) setTicker(d.activityTicker);
        setMaintenance(!!d?.maintenance);
      }).catch(() => {});
      return;
    }

    api('loginWithToken', tok)
      .then(async r => {
        if (r && r.success && r.user) {
          setUser(r.user);
          meIdRef.current = r.user.id;
          const d = await api('getInitialData', r.user.id);
          if (d?.shopItems) setShop(d.shopItems);
          if (d?.offerwalls) setWalls(d.offerwalls);
          if (d?.leaderboard) setBoard(d.leaderboard);
          if (d?.activityTicker) setTicker(d.activityTicker);
          if (d?.user) setUser(d.user);
          setMaintenance(!!d?.maintenance);
        } else {
          try { localStorage.removeItem(TOKEN_KEY); } catch {}
          setMe(null);
        }
      })
      .catch(() => {
        try { localStorage.removeItem(TOKEN_KEY); } catch {}
        setMe(null);
      })
      .finally(() => setLoading(false));
  }, [setUser]);

  const value = {
    me, setUser, clearUser, loading,
    shop, walls, board, ticker,
    maintenance, maintenanceMessage,
    refreshData, setShop, setWalls, setBoard, setTicker
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
