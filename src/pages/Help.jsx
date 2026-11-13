export default function Help() {
  const steps = [
    ['fa-right-to-bracket', 'var(--yellow)', '1. Log in', 'Use the account your administrator created for you.'],
    ['fa-bolt', 'var(--orange)', '2. Earn', 'Open an offerwall and finish surveys or offers. Diamonds land in your balance automatically.'],
    ['fa-calendar-check', 'var(--violet)', '3. Attendance', 'Attendance starts at 100%. Each day without a credited offer deducts 4%. Keep 80%+ for full balance access.'],
    ['fa-calendar-day', 'var(--green)', '4. Daily reward', 'Claim once every 24 hours if you earned at least 500 diamonds from offers this month.'],
    ['fa-lock', 'var(--yellow)', '5. Large offers', 'Credits of 4,000+ diamonds go on hold until you show proof and an admin releases them.'],
    ['fa-comments', 'var(--blue)', '6. Chat', 'Chat unlocks after you have earned 500 diamonds total.'],
    ['fa-bag-shopping', 'var(--green)', '7. Redeem', 'Pick a reward in Rewards. An admin reviews cashouts.'],
    ['fa-gift', 'var(--orange)', 'Bonus codes', 'Enter promo codes on your Profile page for free diamonds.'],
  ];

  return (
    <div className="grid">
      <div className="card" style={{ gridColumn: '1 / -1', background: 'rgba(234,179,8,.12)', borderColor: 'var(--yellow)' }}>
        <h3 style={{ marginBottom: 10 }}>⚠️ Important System Changes</h3>
        <p style={{ marginBottom: 12 }}>We’ve simplified the system. <strong>Daily targets, levels, and hold rates have been removed.</strong></p>
        <ul style={{ margin: '0 0 12px 18px', lineHeight: 1.6 }}>
          <li>Attendance starts at <strong>100%</strong>.</li>
          <li>Each skipped day = <strong>−4% Attendance</strong>.</li>
          <li><strong>80%+</strong> → keep 100% of your balance.</li>
          <li><strong>70–79%</strong> → 25% balance reduction.</li>
          <li><strong>60–69%</strong> → 50% balance reduction.</li>
          <li><strong>Below 60%</strong> → 75% balance reduction.</li>
          <li>To recover <strong>10% Attendance</strong>, you must complete credited offers for as many active days as you have currently skipped (example: 22 skipped days → 22 active days to recover 10%).</li>
          <li>Cashout requires at least <strong>60% Attendance Rate</strong> plus sufficient accessible balance.</li>
          <li><strong>0% Attendance Rate = permanent ban.</strong></li>
        </ul>
        <p className="muted">You are free to skip days, but inactivity will affect your Attendance Rate and available balance.</p>
      </div>

      {steps.map((s, i) => (
        <div className="card" key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{
            width: 46, height: 46, border: 'var(--b)', borderRadius: 14, background: s[1],
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <i className={`fas ${s[0]}`} />
          </div>
          <div>
            <h3>{s[2]}</h3>
            <p className="muted">{s[3]}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
