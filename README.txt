01GH — complete package

FRONTEND (Vercel/GitHub):
  1. Upload this folder (or push to GitHub)
  2. Do NOT delete package.json or vite.config.js
  3. Build: npm run build   Output: dist
  4. Node 18+

BACKEND (Google Apps Script):
  1. Open your Google Sheet → Extensions → Apps Script
  2. Paste Code.gs
  3. Run bindSheet, then ensureSchema
  4. Deploy → Web app → Execute as Me → Anyone → New version
  5. Put the /exec URL into src/utils/api.js (EXEC_URL)

Users sheet needs Username + Password columns.
Admin username must be exactly: admin

ATTENDANCE SYSTEM (strict rules):
- Default Attendance Rate: 100% on first login
- Each day without a credited offer: -4%
- >=80%: full balance accessible
- 70-79%: 25% of balance locked
- 60-69%: 50% of balance locked
- <60%: 75% of balance locked
- To recover +10%: complete credited offers on as many days as your current skipped days
  (e.g. 22 skipped days → 22 active days to recover 10%)
- Levels, daily targets, and hold rates removed
