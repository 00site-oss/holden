import { useEffect } from 'react';
import { useApp } from '../context/AppContext';

export default function Leaders() {
  const { board, me, refreshData } = useApp();
  useEffect(() => { refreshData(); }, [refreshData]);
  const list = board || [];
  if (!list.length) return <div className="empty"><i className="fas fa-ranking-star" />No players yet</div>;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {list.map((u, i) => {
        const isMe = me && me.username === u.username;
        return (
          <div className={`lrow${isMe ? ' me' : ''}`} key={u.username + i}>
            <span className="rk">#{i + 1}</span>
            <strong>{u.username}{u.verified ? ' ✓' : ''}</strong>
            {isMe && <span className="tag pending">you</span>}
            <span className="muted" style={{ fontSize: 12 }}>Att {u.attendanceRate || 100}%</span>
            <span className="d"><i className="fas fa-gem" style={{ color: 'var(--violet)' }} /> {Number(u.diamonds).toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}
