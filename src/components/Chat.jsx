import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';

const EMOJIS = ['😀','😂','🔥','💎','👍','❤️','🎉','😎','🙏','✅','❌','💰','🏆','⭐','🚀','👀'];

export default function Chat({ open, onClose }) {
  const { me } = useApp();
  const [tab, setTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [supportMsgs, setSupportMsgs] = useState([]);
  const [text, setText] = useState('');
  const [supText, setSupText] = useState('');
  const [supBusy, setSupBusy] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (!open || tab !== 'chat') return;
    const load = () => api('getChatMessages').then(m => setMessages(Array.isArray(m) ? m : [])).catch(() => {});
    load();
    const id = setInterval(load, 12000);
    return () => clearInterval(id);
  }, [open, tab]);

  useEffect(() => {
    if (!open || tab !== 'support' || !me) return;
    api('getSupportMessages', me.id).then(m => setSupportMsgs(Array.isArray(m) ? m : [])).catch(() => {});
  }, [open, tab, me]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, supportMsgs, tab]);

  const send = async () => {
    if (!me || !text.trim()) return;
    if (me.chatUnlocked === false && (me.totalEarned || 0) < 500) {
      return alert('Earn 500 diamonds to unlock chat');
    }
    const v = text.trim();
    setText('');
    setShowEmoji(false);
    const r = await api('sendChatMessage', me.id, me.username, v);
    if (r?.success) api('getChatMessages').then(m => setMessages(Array.isArray(m) ? m : []));
    else if (r?.error) alert(r.error);
  };

  const sendSupport = async () => {
    if (!me || !supText.trim() || supBusy) return;
    setSupBusy(true);
    try {
      const r = await api('sendSupportMessage', me.id, supText.trim());
      if (r?.success) {
        setSupText('');
        setSupportMsgs(await api('getSupportMessages', me.id) || []);
      } else alert(r?.error || 'Failed');
    } catch {
      alert('Send failed');
    } finally {
      setSupBusy(false);
    }
  };

  if (!open) return null;

  return (
    <section className="chat on">
      <div className="chat-h">
        <div className="chat-tabs">
          <button type="button" className={`chat-tab${tab === 'chat' ? ' active' : ''}`} onClick={() => setTab('chat')}>Chat</button>
          <button type="button" className={`chat-tab${tab === 'support' ? ' active' : ''}`} onClick={() => setTab('support')}>Support</button>
          <button type="button" className={`chat-tab${tab === 'rules' ? ' active' : ''}`} onClick={() => setTab('rules')}>Rules</button>
        </div>
        <button type="button" className="x" onClick={onClose} style={{ background: '#fff' }}><i className="fas fa-xmark" /></button>
      </div>

      <div className="chat-body" ref={bodyRef}>
        {tab === 'chat' && (
          messages.length ? messages.map((x, i) => (
            <div key={i} className={`msg${me && x.username === me.username ? ' mine' : ''}`}>
              <div className="msg-av" style={{ background: `hsl(${Math.abs((x.username || 'A').charCodeAt(0) * 37) % 360},55%,42%)` }}>
                {(x.username || '?').charAt(0).toUpperCase()}
              </div>
              <div className="msg-main">
                <div className="who">{x.username}<span className="ts">{x.timestamp}</span></div>
                <div className="tx">{x.message}</div>
              </div>
            </div>
          )) : <div className="empty">No messages yet. Say hi 👋</div>
        )}

        {tab === 'rules' && (
          <div className="card" style={{ margin: 0, boxShadow: 'none' }}>
            <h3 style={{ marginBottom: 8 }}>Chat rules</h3>
            <ul style={{ paddingLeft: 18, color: 'var(--muted)', lineHeight: 1.7, fontSize: 14 }}>
              <li>Be respectful</li>
              <li>No spam or advertising</li>
              <li>No harassment</li>
              <li>Chat unlocks at 500 total earned</li>
              <li>Admins may mute accounts</li>
            </ul>
          </div>
        )}

        {tab === 'support' && (
          !me ? (
            <div className="empty">Log in to contact support.</div>
          ) : (
            <>
              <div className="policy" style={{ marginBottom: 12 }}>
                Use support for holds, missing credits, and cashouts. Reply times vary.
              </div>
              {supportMsgs.length ? supportMsgs.map((x, i) => (
                <div key={i} className={`msg${x.fromAdmin ? '' : ' mine'}`} style={{ maxWidth: '100%' }}>
                  <div className="msg-av" style={{ background: x.fromAdmin ? 'var(--violet)' : 'var(--orange)' }}>
                    {x.fromAdmin ? 'A' : (me.username || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="msg-main">
                    <div className="who">{x.fromAdmin ? 'Support' : 'You'}<span className="ts">{x.timestamp || ''}</span></div>
                    <div className="tx">{x.message}</div>
                  </div>
                </div>
              )) : <div className="empty" style={{ padding: 16 }}>No tickets yet</div>}
            </>
          )
        )}
      </div>

      {tab === 'chat' && (
        <div className="chat-in" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          {showEmoji && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {EMOJIS.map(e => (
                <button key={e} type="button" className="btn sm light" style={{ padding: '4px 8px', boxShadow: 'none' }}
                  onClick={() => setText(t => t + e)}>{e}</button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn sm light" style={{ flex: 'none' }} onClick={() => setShowEmoji(v => !v)}>😊</button>
            <input className="input" value={text} onChange={e => setText(e.target.value)}
              placeholder={me ? 'Message…' : 'Log in to chat'} disabled={!me}
              onKeyDown={e => e.key === 'Enter' && send()} />
            <button type="button" className="btn sm green" onClick={send} disabled={!me || !text.trim()}>Send</button>
          </div>
        </div>
      )}

      {tab === 'support' && me && (
        <div className="chat-in" style={{ flexDirection: 'column', gap: 8 }}>
          <textarea className="input" rows={2} value={supText} onChange={e => setSupText(e.target.value)}
            placeholder="Describe your issue…" maxLength={1000} style={{ resize: 'none' }} />
          <button type="button" className="btn sm green block" onClick={sendSupport} disabled={supBusy || !supText.trim()}>
            {supBusy ? 'Sending…' : 'Send to support'}
          </button>
        </div>
      )}
    </section>
  );
}
