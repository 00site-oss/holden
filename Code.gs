/**
 * 01GH – Apps Script backend (GrindBux-style GPT mechanism)
 *
 * Features kept (like GrindBux):
 *   - Diamonds balance
 *   - Offerwalls with min unlock
 *   - Daily claim (needs 500 earned this month)
 *   - Large offers >= 4000 on hold until admin proof release
 *   - Chat unlock at 500 total earned
 *   - Cashouts, promo codes, support, admin verify
 *   - Strict Attendance Rate system (starts 100%, -4% per skipped day)
 *
 * Removed:
 *   - Levels, daily targets, hold rates, overall score system
 *
 * (matches your existing 5 tabs and columns)
 *
 *  Users    : ID | Username | Password | Diamonds | TotalEarned | Level | Experience | ReferralCode
 *             | Referrals | JoinDate | LastLogin | SessionToken
 *  Records  : ID | Type | UserID | Username | Ref | Amount | Status | Data | Timestamp
 *  Codes    : Code | Status | Diamonds | MaxUses | UsedCount | ExpiresAt
 *  Daily    : UserID | LastClaim | Level | Username | ClaimedAt
 *  Settings : Kind | ID | Status | Data     (Kind = offerwall | reward)
 *
 * The code NEVER adds columns to your tabs. Extra data is stored as rows:
 *   hold balance  = sum of pending Records rows with Type "hold"
 *   rate coverage = sum of Records rows with Type "cover"
 *   muted users   = Settings rows with Kind "muted" (ID = user id)
 *
 * ADMIN: the user whose Username is "admin".
 *
 * MAINTENANCE (all safe, nothing is wiped; menu 01GH in the sheet):
 *   ensureSchema       – checks the 5 tabs
 *   previewSyncHolds / syncHolds     – copies old hold amounts into Records so the dashboard shows them
 *   previewCleanup / cleanupSheets   – removes junk left by older versions (backs up first)
 *
 * DEPLOY: HTML file must be named  index  . After editing: Deploy → Manage deployments →
 * Edit → New version → Deploy.  Open the /exec link.
 */
// ===================== CONFIG =====================
var CFG = {
  HOLD_DAYS: 30,
  DAILY_MIN_MONTH_EARN: 500,
  LARGE_OFFER_HOLD: 4000,
  CHAT_MIN_EARNED: 500,
  ATTENDANCE_DEDUCT_PER_DAY: 4,   // % deducted per skipped day
  ATTENDANCE_RECOVER_PER_CHUNK: 10, // % recovered per recovery cycle
  MIN_ATTENDANCE_FOR_CASHOUT: 60, // minimum attendance % required to cash out
  DAILY_REWARD: 5                 // fixed daily reward (level removed)
};

var SHEETS = { USERS: 'Users', RECORDS: 'Records', CODES: 'Codes', DAILY: 'Daily', SETTINGS: 'Settings' };

// [internalKey, real column header]
var SCHEMA = {
  users: [['id', 'ID'], ['username', 'Username'], ['password', 'Password'], ['diamonds', 'Diamonds'],
    ['totalEarned', 'TotalEarned'], ['level', 'Level'], ['experience', 'Experience'],
    ['referralCode', 'ReferralCode'], ['referrals', 'Referrals'], ['createdAt', 'JoinDate'],
    ['lastActivity', 'LastLogin'], ['sessionToken', 'SessionToken'],
    ['attendanceRate', 'AttendanceRate'], ['skippedDays', 'SkippedDays'],
    ['recoveryDays', 'RecoveryDays'], ['lastActiveDate', 'LastActiveDate'],
    ['banned', 'Banned'],
    ['onHold', 'OnHold']],
  records: [['id', 'ID'], ['type', 'Type'], ['userId', 'UserID'], ['username', 'Username'], ['ref', 'Ref'],
    ['amount', 'Amount'], ['status', 'Status'], ['data', 'Data'], ['timestamp', 'Timestamp']],
  codes: [['code', 'Code'], ['status', 'Status'], ['diamonds', 'Diamonds'], ['maxUses', 'MaxUses'],
    ['usedCount', 'UsedCount'], ['expiresAt', 'ExpiresAt']],
  daily: [['userId', 'UserID'], ['lastClaim', 'LastClaim'], ['level', 'Level'], ['username', 'Username'],
    ['claimedAt', 'ClaimedAt']],
  settings: [['kind', 'Kind'], ['id', 'ID'], ['status', 'Status'], ['data', 'Data']]
};

var CRYPTO_TYPES = ['crypto', 'litecoin', 'ltc', 'bitcoin', 'btc', 'ethereum', 'eth', 'usdt', 'doge', 'dogecoin'];

var SS_ = null;
var SCHEMA_DONE_ = false;

// ===================== ENTRY / MENU =====================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('01GH')
    .addItem('Check setup (safe – no data wipe)', 'ensureSchema')
    .addItem('Fill Overall Score columns', 'syncScoreToSheet')
    .addItem('Release due holds (all users)', 'releaseAllDueHolds')
    .addSeparator()
    .addItem('Preview hold sync (no changes)', 'previewSyncHolds')
    .addItem('Sync holds into Records', 'syncHolds')
    .addSeparator()
    .addItem('Preview cleanup (no changes)', 'previewCleanup')
    .addItem('Clean up junk (backup first)', 'cleanupSheets')
    .addSeparator()
    .addItem('Reset to 5 tabs only (backup first)', 'resetSheetsToFive')
    .addToUi();
}



/**
 * DANGEROUS: backs up the spreadsheet, deletes every tab that is NOT
 * Users / Records / Codes / Daily / Settings, then recreates those five
 * with the correct headers. User data in the five tabs is KEPT.
 * Run from the 01GH menu or the editor.
 */
function resetSheetsToFive() {
  return withLock_(function () {
    var ss = ss_();
    var keep = { users: 1, records: 1, codes: 1, daily: 1, settings: 1 };
    // backup first
    try {
      var copy = ss.copy('01GH backup before sheet reset ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'));
      Logger.log('Backup: ' + copy.getUrl());
    } catch (e) {
      Logger.log('Backup failed: ' + e);
    }
    var sheets = ss.getSheets();
    var removed = [];
    for (var i = sheets.length - 1; i >= 0; i--) {
      var n = sheets[i].getName().trim().toLowerCase();
      if (!keep[n]) {
        removed.push(sheets[i].getName());
        // cannot delete last sheet — rename then delete after ensure
        if (ss.getSheets().length === 1) {
          sheets[i].setName('_DELETE_ME_');
        } else {
          ss.deleteSheet(sheets[i]);
        }
      }
    }
    // ensure the five exist with correct headers
    SCHEMA_DONE_ = false;
    try { CacheService.getScriptCache().remove('schema_ok_v6'); } catch (e) {}
    ensureSchema_();
    // delete leftover placeholder
    var junk = findTab_('_DELETE_ME_');
    if (junk && ss.getSheets().length > 1) ss.deleteSheet(junk);
    var msg = 'Reset done. Removed: ' + (removed.length ? removed.join(', ') : '(none)') +
      '. Active tabs: Users, Records, Codes, Daily, Settings. Backup saved in Drive.';
    Logger.log(msg);
    try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
    return msg;
  });
}

function transferPoints(fromId, toUsername, amount) {
  return { success: false, error: 'Not available' };
}

function adminCloseSupport(adminId, supportId) {
  return withLock_(function () {
    if (!requireAdmin_(adminId)) return { success: false, error: 'Access denied' };
    var sh = sheet_(SHEETS.RECORDS);
    var rows = rowsAsObjects_(sh);
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].id) === String(supportId) && String(rows[i].type) === 'support') {
        rows[i].status = 'closed';
        writeObject_(sh, rows[i]._row, rows[i]);
        return { success: true };
      }
    }
    return { success: false, error: 'Not found' };
  });
}

function adminDeleteReward(adminId, rewardId) {
  return withLock_(function () {
    if (!requireAdmin_(adminId)) return { success: false, error: 'Access denied' };
    var sh = sheet_(SHEETS.SETTINGS);
    var rows = rowsAsObjects_(sh);
    for (var i = rows.length - 1; i >= 0; i--) {
      var r = rows[i];
      if (String(r.kind).trim().toLowerCase() !== 'reward') continue;
      if (rewardOut_(r).id === String(rewardId) || String(r.id) === String(rewardId)) {
        sh.deleteRow(r._row);
        return { success: true };
      }
    }
    return { success: false, error: 'Not found' };
  });
}

function adminSaveOfferwall(adminId, data) {
  return withLock_(function () {
    if (!requireAdmin_(adminId)) return { success: false, error: 'Access denied' };
    data = data || {};
    var name = String(data.name || 'Offerwall');
    var id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || uid_();
    appendObject_(sheet_(SHEETS.SETTINGS), {
      kind: 'offerwall', id: id, status: 'active',
      data: JSON.stringify({ name: name, domain: '', urlTemplate: String(data.urlTemplate || ''), minDiamonds: Number(data.minDiamonds) || 0 })
    });
    return { success: true };
  });
}

function adminDeleteOfferwall(adminId, wallId) {
  return withLock_(function () {
    if (!requireAdmin_(adminId)) return { success: false, error: 'Access denied' };
    var sh = sheet_(SHEETS.SETTINGS);
    var rows = rowsAsObjects_(sh);
    for (var i = rows.length - 1; i >= 0; i--) {
      var r = rows[i];
      if (String(r.kind).trim().toLowerCase() !== 'offerwall') continue;
      if (String(r.id) === String(wallId)) {
        sh.deleteRow(r._row);
        return { success: true };
      }
    }
    return { success: false, error: 'Not found' };
  });
}

function doGet(e) {
  if (e && e.parameter && (e.parameter.user_id || e.parameter.userId || e.parameter.uid)) {
    return handlePostback_(e.parameter);
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('01GH – Get Paid To')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    var raw = (e.postData && e.postData.contents) ? e.postData.contents : '';
    var data = {};
    if (raw) {
      try { data = JSON.parse(raw); } catch (err) {}
    }
    if (!data.fn && e.parameter && e.parameter.fn) {
      data = e.parameter;
      if (typeof data.args === 'string') {
        try { data.args = JSON.parse(data.args); } catch (err) { data.args = []; }
      }
    }
    if (data.user_id || data.userId || data.uid) return handlePostback_(data);
    if (data.fn) {
      var fn = data.fn;
      var args = data.args || [];
      if (typeof this[fn] !== 'function') {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Unknown function: ' + fn })).setMimeType(ContentService.MimeType.JSON);
      }
      var result = this[fn].apply(this, args);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'No fn received' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message || String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ===================== SPREADSHEET + SCHEMA =====================
function ss_() {
  if (SS_) return SS_;
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (!ss) {
    var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (id) ss = SpreadsheetApp.openById(id);
  }
  if (!ss) throw new Error('Spreadsheet not found. Open the script from the sheet (Extensions > Apps Script) or add Script Property SHEET_ID.');
  SS_ = ss;
  return ss;
}


/** Run once: stores the open spreadsheet id so web app can find it */
function bindSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open this script from the Google Sheet');
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  Logger.log('SHEET_ID set to ' + ss.getId());
  try { ss.toast('Sheet bound: ' + ss.getName(), '01GH', 5); } catch (e) {}
  return ss.getId();
}

function ensureSchema() {
  try { CacheService.getScriptCache().remove('schema_ok_v6'); } catch (e) {}
  SCHEMA_DONE_ = false;
  ensureSchema_();
  ss_().toast('Setup OK. Tabs used: Users, Records, Codes, Daily, Settings.', '01GH', 6);
}

function findTab_(name) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (sh) return sh;
  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) {
    if (all[i].getName().trim().toLowerCase() === name.toLowerCase()) return all[i];
  }
  return null;
}

function ensureSchema_() {
  if (SCHEMA_DONE_) return;
  var cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) {}
  if (cache && cache.get('schema_ok_v6')) { SCHEMA_DONE_ = true; return; }

  var users = ensureSheet_(SHEETS.USERS, SCHEMA.users);
  ensureSheet_(SHEETS.RECORDS, SCHEMA.records);
  ensureSheet_(SHEETS.CODES, SCHEMA.codes);
  ensureSheet_(SHEETS.DAILY, SCHEMA.daily);
  var settings = ensureSheet_(SHEETS.SETTINGS, SCHEMA.settings);

  // users without an ID get one
  var uh = headers_(users), idCol = uh.indexOf('id') + 1, nameCol = uh.indexOf('username') + 1;
  var lr = users.getLastRow();
  if (lr >= 2 && idCol > 0 && nameCol > 0) {
    var ids = users.getRange(2, idCol, lr - 1, 1).getValues();
    var names = users.getRange(2, nameCol, lr - 1, 1).getValues();
    var changed = false;
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === '' && String(names[i][0]).trim() !== '') { ids[i][0] = uid_(); changed = true; }
    }
    if (changed) users.getRange(2, idCol, ids.length, 1).setValues(ids);
  }

  // make sure the built-in daily wall exists
  var hasDaily = rowsAsObjects_(settings).some(function (r) {
    return String(r.kind).trim().toLowerCase() === 'offerwall' && String(r.data).indexOf('internal:daily') >= 0;
  });
  if (!hasDaily) {
    appendObject_(settings, {
      kind: 'offerwall', id: 'OFFICIAL', status: 'active',
      data: JSON.stringify({ name: '01GH Rewards', domain: '', urlTemplate: 'internal:daily', minDiamonds: 0 })
    });
  }

  SCHEMA_DONE_ = true;
  if (cache) { try { cache.put('schema_ok_v6', '1', 600); } catch (e) {} }
}

function schemaFor_(name) { return SCHEMA[String(name).trim().toLowerCase()] || []; }

function ensureSheet_(name, schema) {
  var sh = findTab_(name);
  var required = schema.map(function (p) { return p[1]; });
  if (!sh) {
    sh = ss_().insertSheet(name);
    sh.getRange(1, 1, 1, required.length).setValues([required]);
    sh.setFrozenRows(1);
    return sh;
  }
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var existing = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || '').trim(); });
  if (existing.every(function (h) { return h === ''; })) {
    sh.getRange(1, 1, 1, required.length).setValues([required]);
    sh.setFrozenRows(1);
    return sh;
  }
  // add the Overall Score columns to an existing Users tab (only these; nothing else is ever added)
  var AUTO_ADD = ['AttendanceRate', 'SkippedDays', 'RecoveryDays', 'LastActiveDate', 'Banned', 'OnHold'];
  var have = existing.map(function (h) { return h.toLowerCase(); });
  var missing = required.filter(function (h) { return AUTO_ADD.indexOf(h) !== -1 && have.indexOf(h.toLowerCase()) === -1; });
  if (missing.length) {
    var start = 1;
    for (var c = existing.length - 1; c >= 0; c--) { if (existing[c] !== '') { start = c + 2; break; } }
    sh.getRange(1, start, 1, missing.length).setValues([missing]);
  }
  return sh;
}

// ===================== SHEET HELPERS =====================
function sheet_(name) {
  ensureSchema_();
  var sh = findTab_(name);
  if (!sh) throw new Error('Missing tab: ' + name);
  return sh;
}

// returns internal keys (e.g. "JoinDate" -> "createdAt").
// Duplicate or unknown columns get a "~name" key so they can never overwrite real data.
function headers_(sh) {
  var map = {};
  schemaFor_(sh.getName()).forEach(function (p) { map[p[1].toLowerCase()] = p[0]; });
  var seen = {};
  var lc = Math.max(sh.getLastColumn(), 1);
  return sh.getRange(1, 1, 1, lc).getValues()[0].map(function (h, j) {
    var t = String(h || '').trim();
    var k = map[t.toLowerCase()];
    if (k && !seen[k]) { seen[k] = true; return k; }
    return '~' + (t || 'col' + (j + 1));
  });
}

function rowsAsObjects_(sh) {
  var h = headers_(sh);
  var lr = sh.getLastRow();
  if (lr < 2) return [];
  var data = sh.getRange(2, 1, lr - 1, h.length).getValues();
  return data.map(function (row, i) {
    var o = { _row: i + 2 };
    h.forEach(function (key, j) { if (key) o[key] = row[j]; });
    return o;
  });
}

function writeObject_(sh, rowIndex, obj) {
  var h = headers_(sh);
  var row = h.map(function (key) { return obj[key] !== undefined && obj[key] !== null ? obj[key] : ''; });
  sh.getRange(rowIndex, 1, 1, h.length).setValues([row]);
}

function appendObject_(sh, obj) {
  var h = headers_(sh);
  var row = h.map(function (key) { return obj[key] !== undefined && obj[key] !== null ? obj[key] : ''; });
  sh.appendRow(row);
}

function deleteRows_(sh, predicate) {
  var rows = rowsAsObjects_(sh);
  for (var i = rows.length - 1; i >= 0; i--) {
    if (predicate(rows[i])) sh.deleteRow(rows[i]._row);
  }
}

function uid_() { return Utilities.getUuid(); }
function nowIso_() { return new Date().toISOString(); }
function stamp_(d) {
  return Utilities.formatDate(d || new Date(), Session.getScriptTimeZone(), 'MM/dd/yyyy HH:mm:ss');
}
function isTrue_(v) { return v === true || String(v).toLowerCase() === 'true'; }
function safeJson_(s, def) { try { return s ? JSON.parse(s) : def; } catch (e) { return def; } }

function parseDate_(v) {
  if (v === '' || v === null || v === undefined) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') return new Date(v);
  var s = String(v).trim();
  if (/^\d{11,}$/.test(s)) return new Date(Number(s));
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function iso_(v) {
  var d = parseDate_(v);
  return d ? d.toISOString() : (v === undefined || v === null ? '' : String(v));
}
function plain_(o) {
  var out = {};
  Object.keys(o).forEach(function (k) {
    var v = o[k];
    if (Object.prototype.toString.call(v) === '[object Date]') v = isNaN(v.getTime()) ? '' : v.toISOString();
    out[k] = v;
  });
  return out;
}

function daysBetween_(from, to) {
  var a = parseDate_(from), b = to ? parseDate_(to) : new Date();
  if (!a || !b) return 0;
  var ms = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.max(0, Math.floor(ms / 86400000));
}

function hashPassword_(pw) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pw) + '|01gh');
  return raw.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}
function passwordOk_(user, pw) {
  return String(user.password) === String(pw) || String(user.password) === hashPassword_(pw);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// ===================== DERIVED VALUES (no extra columns) =====================
// Tolerant readers for HOLD rows in the Records tab (case, spaces and "1,200"-style numbers don't matter)
function lc_(v) { return String(v === null || v === undefined ? '' : v).trim().toLowerCase(); }
function numOf_(v) { var n = Number(String(v === null || v === undefined ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; }
function isPendingHold_(r) { return lc_(r.type) === 'hold' && lc_(r.status) === 'pending'; }
function holdBalanceMap_() {
  var m = {};
  rowsAsObjects_(sheet_(SHEETS.RECORDS)).forEach(function (r) {
    if (!isPendingHold_(r)) return;
    var id = String(r.userId).trim();
    m[id] = (m[id] || 0) + numOf_(r.amount);
  });
  return m;
}
function coverageMap_() {
  var m = {};
  rowsAsObjects_(sheet_(SHEETS.RECORDS)).forEach(function (r) {
    if (String(r.type) === 'cover') m[String(r.userId)] = (m[String(r.userId)] || 0) + (Number(r.amount) || 0);
  });
  return m;
}
function mutedMap_() {
  var m = {};
  rowsAsObjects_(sheet_(SHEETS.SETTINGS)).forEach(function (r) {
    if (String(r.kind).trim().toLowerCase() === 'muted' && statusOn_(r.status)) m[String(r.id)] = true;
  });
  return m;
}
function isMuted_(userId) { return !!mutedMap_()[String(userId)]; }
function isBanned_(user) {
  if (!user) return false;
  return String(user.banned || '').toLowerCase() === 'true' || user.banned === true;
}

// ===================== USERS =====================
function isAdminUser_(u) {
  return !!u && String(u.username || '').trim().toLowerCase() === 'admin';
}
function findUserById_(id) {
  if (!id) return null;
  var rows = rowsAsObjects_(sheet_(SHEETS.USERS));
  for (var i = 0; i < rows.length; i++) if (String(rows[i].id) === String(id)) return rows[i];
  return null;
}
function findUserByUsername_(username) {
  if (!username) return null;
  var u = String(username).trim().toLowerCase();
  var rows = rowsAsObjects_(sheet_(SHEETS.USERS));
  for (var i = 0; i < rows.length; i++) if (String(rows[i].username || '').trim().toLowerCase() === u) return rows[i];
  return null;
}
function findUserByToken_(token) {
  if (!token) return null;
  var rows = rowsAsObjects_(sheet_(SHEETS.USERS));
  for (var i = 0; i < rows.length; i++) if (rows[i].sessionToken && String(rows[i].sessionToken) === String(token)) return rows[i];
  return null;
}
function saveUser_(user) {
  user.level = rankFromScore_(computeScore_(user.id));
  try {
    var sv = scoreView_(scoreState_(user.id).st);
    user.overallScore = sv.points; user.dailyTarget = sv.target; user.holdRate = sv.holdPct + '%';
  } catch (e) {}
  try { user.onHold = holdBalanceMap_()[String(user.id)] || 0; } catch (e) {}
  writeObject_(sheet_(SHEETS.USERS), user._row, user);
}

function syncRanksToSheet() {
  return withLock_(function () {
    var users = rowsAsObjects_(sheet_(SHEETS.USERS)).filter(function (u) { return u.id; });
    users.forEach(function (u) { saveUser_(u); });
    return 'Updated ' + users.length + ' users. Level column now shows rank.';
  });
}
/** Keeps OnHold / OverallScore / DailyTarget / HoldRate in the Users sheet equal to the live values. */
function syncUserCols_(u) {
  try {
    var hold = holdBalanceMap_()[String(u.id)] || 0;
    var sv = scoreView_(scoreState_(u.id).st);
    var same = String(u.onHold) !== '' && Number(u.onHold) === hold &&
      String(u.overallScore) !== '' && Number(u.overallScore) === sv.points &&
      Number(u.dailyTarget) === sv.target && String(u.holdRate) === sv.holdPct + '%';
    if (!same) {
      u.onHold = hold; u.overallScore = sv.points; u.dailyTarget = sv.target; u.holdRate = sv.holdPct + '%';
      writeObject_(sheet_(SHEETS.USERS), u._row, u);
    }
  } catch (e) {}
}
function touchLogin_(user) { user.lastActivity = stamp_(); saveUser_(user); }

function publicUser_(u) {
  if (!u) return null;
  releaseDueHoldsForUser_(u);
  u = findUserById_(u.id) || u;
  updateAttendance_(u); // apply any pending day skips
  u = findUserById_(u.id) || u;
  syncUserCols_(u);
  var total = Number(u.totalEarned) || 0;
  var rate = Number(u.attendanceRate);
  if (isNaN(rate) || rate === 0 && !u.attendanceRate) rate = 100;
  var cut = attendanceCutPct_(rate);
  var accessible = Math.floor((Number(u.diamonds) || 0) * (100 - cut) / 100);
  var join = parseDate_(u.createdAt) || parseDate_(u.lastActivity);
  var joinDays = join ? daysBetween_(join, new Date()) : 0;
  return {
    id: String(u.id),
    username: String(u.username || ''),
    diamonds: Number(u.diamonds) || 0,
    accessibleDiamonds: accessible,
    attendanceCutPct: cut,
    holdBalance: holdBalanceMap_()[String(u.id)] || 0,
    totalEarned: total,
    level: 0, // removed
    attendanceRate: Math.max(0, Math.min(100, rate)),
    minAttendanceForCashout: CFG.MIN_ATTENDANCE_FOR_CASHOUT || 60,
    skippedDays: Number(u.skippedDays) || 0,
    recoveryDays: Number(u.recoveryDays) || 0,
    recoveryNeeded: Math.max(1, Number(u.skippedDays) || 0),
    verified: isVerified_(u.id),
    isAdmin: isAdminUser_(u),
    isMuted: isMuted_(u.id),
    isBanned: isBanned_(u),
    referrals: Number(u.referrals) || 0,
    sessionToken: String(u.sessionToken || ''),
    createdAt: iso_(u.createdAt),
    lastActivity: iso_(u.lastActivity),
    joinDays: joinDays,
    daysInactive: joinDays,
    canCashout: true,
    chatUnlocked: total >= CFG.CHAT_MIN_EARNED,
    monthEarn: monthEarn_(u.id)
  };
}

/** Cut % applied to accessible balance based on attendance rate. */
function attendanceCutPct_(rate) {
  rate = Number(rate) || 0;
  if (rate >= 80) return 0;
  if (rate >= 70) return 25;
  if (rate >= 60) return 50;
  return 75; // < 60
}

/** Apply skipped-day deductions and init attendance if needed. Updates user in sheet. */
function updateAttendance_(user) {
  if (!user || !user.id) return user;
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var rate = Number(user.attendanceRate);
  var skipped = Number(user.skippedDays) || 0;
  var recovery = Number(user.recoveryDays) || 0;
  var last = String(user.lastActiveDate || '').trim();

  // Default on first login / new user
  if (isNaN(rate) || (rate === 0 && !user.attendanceRate && !last)) {
    rate = 100;
    skipped = 0;
    recovery = 0;
    // do not set last until an offer is completed
  }

  var refDate = last ? parseDate_(last + 'T00:00:00') : (parseDate_(user.createdAt) || new Date());
  if (refDate) {
    var days = daysBetween_(refDate, new Date());
    var expectedSkipped = Math.max(0, days - 1);
    if (expectedSkipped > skipped) {
      var add = expectedSkipped - skipped;
      skipped = expectedSkipped;
      rate = Math.max(0, rate - CFG.ATTENDANCE_DEDUCT_PER_DAY * add);
    }
  }

  // Ban if attendance reaches 0%
  var banned = String(user.banned || '').toLowerCase() === 'true' || user.banned === true;
  if (rate <= 0 && !banned) {
    user.banned = true;
    banned = true;
  }

  // Persist if changed
  var changed = Number(user.attendanceRate) !== rate ||
                Number(user.skippedDays) !== skipped ||
                String(user.lastActiveDate) !== last ||
                (user.banned !== banned && banned);
  if (changed || user.attendanceRate === undefined || user.attendanceRate === '') {
    user.attendanceRate = rate;
    user.skippedDays = skipped;
    user.recoveryDays = recovery;
    user.lastActiveDate = last;
    user.banned = banned;
    saveUser_(user);
  }
  return user;
}

/** Called when user completes a credited offer. Marks today active and advances recovery. */
function markActiveDay_(user) {
  if (!user || !user.id) return;
  updateAttendance_(user);
  user = findUserById_(user.id);
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var last = String(user.lastActiveDate || '');
  var rate = Number(user.attendanceRate) || 100;
  var skipped = Number(user.skippedDays) || 0;
  var recovery = Number(user.recoveryDays) || 0;

  if (last !== today) {
    // New active day
    recovery += 1;
    user.lastActiveDate = today;
    // Check recovery
    var needed = Math.max(1, skipped);
    if (recovery >= needed && rate < 100) {
      rate = Math.min(100, rate + CFG.ATTENDANCE_RECOVER_PER_CHUNK);
      recovery = 0;
      skipped = Math.max(0, Math.round((100 - rate) / CFG.ATTENDANCE_DEDUCT_PER_DAY));
    }
    user.attendanceRate = rate;
    user.skippedDays = skipped;
    user.recoveryDays = recovery;
    saveUser_(user);
  }
}

function isVerified_(userId) {
  var m = {};
  rowsAsObjects_(sheet_(SHEETS.SETTINGS)).forEach(function (r) {
    if (String(r.kind).trim().toLowerCase() === 'verified' && statusOn_(r.status)) m[String(r.id)] = true;
  });
  return !!m[String(userId)];
}

function adminSetVerified(adminId, userId, on) {
  return withLock_(function () {
    if (!requireAdmin_(adminId)) return { success: false, error: 'Access denied' };
    var user = findUserById_(userId);
    if (!user) return { success: false, error: 'User not found' };
    var sh = sheet_(SHEETS.SETTINGS);
    var rows = rowsAsObjects_(sh);
    var found = null;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].kind).trim().toLowerCase() === 'verified' && String(rows[i].id) === String(userId)) {
        found = rows[i]; break;
      }
    }
    if (on) {
      if (found) {
        found.status = 'active';
        writeObject_(sh, found._row, found);
      } else {
        appendObject_(sh, { kind: 'verified', id: String(userId), status: 'active', data: '{}' });
      }
    } else if (found) {
      found.status = 'off';
      writeObject_(sh, found._row, found);
    }
    return { success: true, verified: !!on, user: publicUser_(user) };
  });
}

// ===================== INACTIVITY RATE =====================
function calcInactivityRate_(user, covMap) {
  var join = user && (user.createdAt || user.lastActivity) || new Date();
  var joinDays = daysBetween_(join, new Date());
  return {
    joinDays: joinDays, daysInactive: joinDays, dailyRate: 0, dailyCoverage: 0,
    dailyCoverLeft: 0, baseRate: 0, earnReduction: 0, coverage: 0, rate: 0,
    toCover: 0, canCashout: true, joinDate: iso_(join)
  };
}

function convertBalanceToCoverage(userId, percent) {
  return { success: false, error: 'Not available' };
  return withLock_(function () {
    var user = findUserById_(userId);
    if (!user) return { success: false, error: 'User not found' };
    releaseDueHoldsForUser_(user);
    user = findUserById_(userId);

    var info = calcInactivityRate_(user);
    if (info.dailyCoverLeft <= 0) {
      return { success: false, error: 'Daily rate is already fully covered (0% per day).', user: publicUser_(user) };
    }
    var want = Number(percent);
    if (!want || want <= 0) want = info.dailyCoverLeft;
    want = Math.round(want * 10) / 10;

    var costPer = CFG.DIAMONDS_PER_1_PERCENT_DAILY;
    var bal = Number(user.diamonds) || 0;
    var maxByBal = Math.floor(bal / costPer);
    var maxLeft = Math.ceil(info.dailyCoverLeft * 10) / 10;
    var apply = Math.floor(Math.min(want, maxByBal, maxLeft) * 10) / 10;
    if (apply <= 0) {
      return { success: false, error: 'Need ' + costPer + ' available diamonds per 1% daily coverage. You have ' + bal + '.', user: publicUser_(user) };
    }
    var cost = Math.round(apply * costPer);
    user.diamonds = bal - cost;
    saveUser_(user);
    addRecord_(user, 'cover', 'daily', apply, 'ok', { cost: cost });

    addRecord_(user, 'balance', 'rate_cover', -cost, 'ok', { after: Number(user.diamonds), detail: 'covered ' + apply + '% daily rate' });
    addActivity_(user, 'cover', 'covered ' + apply + '% of daily inactivity rate');
    return {
      success: true, covered: apply, cost: cost,
      dailyRate: Math.max(0, Math.round((info.dailyCoverLeft - apply) * 10) / 10),
      newBalance: Number(user.diamonds), user: publicUser_(user)
    };
  });
}

// ===================== RECORDS HELPERS =====================
function addRecord_(user, type, ref, amount, status, data) {
  appendObject_(sheet_(SHEETS.RECORDS), {
    id: uid_(), type: type, userId: user ? user.id : '', username: user ? user.username : '',
    ref: ref === undefined ? '' : ref, amount: Number(amount) || 0, status: status || '',
    data: data ? JSON.stringify(data) : '', timestamp: stamp_()
  });
}

function addActivity_(user, action, detail) {
  addRecord_(user, 'activity', action, 0, '', { detail: detail });
  if (Math.random() < 0.05) pruneType_('activity', 500);
}

function pruneType_(type, keep) {
  var sh = sheet_(SHEETS.RECORDS);
  var rows = rowsAsObjects_(sh).filter(function (r) { return String(r.type) === type; });
  var extra = rows.length - keep;
  if (extra <= 0) return;
  rows.slice(0, extra).map(function (r) { return r._row; }).sort(function (a, b) { return b - a; })
    .forEach(function (n) { sh.deleteRow(n); });
}

// ===================== EARNINGS + HOLDS =====================
/**
 * The inactivity rate is the % of each new earning that is HELD for 30 days
 * (it may be reversed in that window). The rest is available immediately.
 * opts: { kind: 'offer'|'bonus'|'daily', ref, detail, data }
 */
function monthEarn_(userId) {
  var uid = String(userId);
  var now = new Date();
  var y = now.getFullYear(), m = now.getMonth();
  var total = 0;
  rowsAsObjects_(sheet_(SHEETS.RECORDS)).forEach(function (r) {
    if (String(r.userId) !== uid) return;
    var t = String(r.type);
    if (t !== 'offer' && t !== 'balance') return;
    if (t === 'balance' && String(r.ref) === 'cover') return;
    if (t === 'offer' && String(r.status) !== 'credited') return;
    if (t === 'balance' && String(r.status) !== 'ok') return;
    if (t === 'balance' && (Number(r.amount) || 0) <= 0) return;
    // only count positive offer credits for monthly activity
    if (t === 'offer') {
      var d = parseDate_(r.timestamp);
      if (!d || d.getFullYear() !== y || d.getMonth() !== m) return;
      total += Number(r.amount) || 0;
    }
  });
  return total;
}

function creditEarnings_(user, amount, opts) {
  amount = Math.floor(Number(amount) || 0);
  if (amount <= 0) return { success: false, error: 'Invalid amount' };
  opts = opts || {};

  releaseDueHoldsForUser_(user);
  user = findUserById_(user.id);
  updateAttendance_(user);
  user = findUserById_(user.id);

  var rate = 0;
  // Single credit of 4,000+ goes on hold until proof / admin release
  var holdPart = 0;
  var proofHold = false;
  if (opts.kind === 'offer' && amount >= CFG.LARGE_OFFER_HOLD) {
    holdPart = amount;
    proofHold = true;
  }
  if (holdPart > amount) holdPart = amount;
  var available = amount - holdPart;

  user.diamonds = (Number(user.diamonds) || 0) + available;
  user.totalEarned = (Number(user.totalEarned) || 0) + amount;
  saveUser_(user);

  if (opts.kind === 'offer') {
    addRecord_(user, 'offer', opts.ref, amount, holdPart > 0 ? 'held' : 'credited', opts.data || {});
    markActiveDay_(user); // attendance recovery / mark today active
  } else if (opts.kind === 'bonus') {
    addRecord_(user, 'bonus', opts.ref, amount, 'redeemed', null);
  }
  addRecord_(user, 'balance', opts.kind || 'earn', available, 'ok',
    { after: Number(user.diamonds), detail: opts.detail || opts.kind || 'earn', held: holdPart });

  if (holdPart > 0 && proofHold) {
    addRecord_(user, 'hold', opts.kind || 'earn', holdPart, 'pending',
      { needsProof: true, available: available, ref: opts.ref || '', detail: opts.detail || '' });
    addActivity_(user, 'hold', '+' + holdPart + ' on hold (proof required)');
  }
  if (opts.kind === 'offer' && !proofHold) {
    addActivity_(user, 'offer', '+' + amount + ' pts from ' + (opts.detail || 'offer'));
  }
  saveUser_(user);

  return {
    success: true, amount: amount, available: available, hold: holdPart, reversalRate: 0,
    daysInactive: 0, newBalance: Number(user.diamonds) || 0,
    holdBalance: holdBalanceMap_()[String(user.id)] || 0, user: publicUser_(user),
    needsProof: proofHold
  };
}

// ===================== OVERALL SCORE (daily target + hold %) =====================
/**
 * Per-user state lives in Settings (Kind "score", ID = userId, Data = JSON {target, day, points, hit}).
 *  - points   = offer points of the current/last active day (script time zone); kept as-is across days
 *               until the next earning, which starts a fresh count for that day
 *  - target   = today's target; if the previous target was hit it grew by SCORE_TARGET_GROWTH %,
 *               otherwise it stays the same (never decreases)
 *  - hold %   = adminRate * (1 - points/target), 0 when points >= target
 */
function round2_(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function scoreToday_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

function scoreCfg_() {
  var c = { adminRate: CFG.SCORE_ADMIN_RATE, startTarget: CFG.SCORE_START_TARGET, growth: CFG.SCORE_TARGET_GROWTH };
  settingsRows_('scoreconfig').forEach(function (r) {
    var v = Number(safeJson_(r.data, null));
    if (isNaN(v) || !statusOn_(r.status)) return;
    var k = String(r.id).trim();
    if (k === 'adminRate' || k === 'startTarget' || k === 'growth') c[k] = v;
  });
  return c;
}

/** Returns {row, st} with st rolled forward to today. Does not write. */
function scoreState_(userId) {
  var cfg = scoreCfg_(), today = scoreToday_(), row = null;
  settingsRows_('score').forEach(function (r) { if (String(r.id) === String(userId)) row = r; });
  var st = row ? safeJson_(row.data, null) : null;
  if (!st || !(Number(st.target) > 0)) st = { target: cfg.startTarget, day: today, points: 0, hit: false };
  if (st.day !== today) {
    if (st.hit) st.target = round2_(st.target * (1 + cfg.growth / 100));
    // New day: target rolls, but the score is NOT reset - it stays as it was until the next earning
    st.day = today; st.hit = false; st.carry = true;
  }
  st.target = Number(st.target); st.points = Number(st.points) || 0;
  return { row: row, st: st };
}
function saveScoreState_(userId, sc) {
  var sh = sheet_(SHEETS.SETTINGS);
  var obj = { kind: 'score', id: String(userId), status: 'on', data: JSON.stringify(sc.st) };
  if (sc.row) writeObject_(sh, sc.row._row, obj);
  else appendObject_(sh, obj);
}
function scoreView_(st) {
  var cfg = scoreCfg_();
  var pct = st.points >= st.target ? 0 : round2_(cfg.adminRate * (1 - st.points / st.target));
  return { day: st.day, points: round2_(st.points), target: st.target, hit: st.points >= st.target,
           holdPct: pct, adminRate: cfg.adminRate,
           nextTarget: round2_(st.target * (1 + cfg.growth / 100)) };
}
function releaseScoreHolds_(userId, day) {
  var sh = sheet_(SHEETS.RECORDS), total = 0;
  rowsAsObjects_(sh).forEach(function (h) {
    if (!isPendingHold_(h) || String(h.userId).trim() !== String(userId)) return;
    var d = safeJson_(h.data, {});
    if (!d.scoreHold || d.scoreDay !== day) return;
    h.status = 'released';
    writeObject_(sh, h._row, h);
    total += numOf_(h.amount);
  });
  return total;
}
/** Menu helper: fills OverallScore / DailyTarget / HoldRate for every user. */
function syncScoreToSheet() {
  return withLock_(function () {
    var users = rowsAsObjects_(sheet_(SHEETS.USERS)).filter(function (u) { return u.id; });
    users.forEach(function (u) { saveUser_(u); });
    return 'Updated score + OnHold columns for ' + users.length + ' users.';
  });
}
function getScore(userId) {
  var u = findUserById_(userId);
  if (!u) return { success: false, error: 'User not found' };
  return { success: true, score: scoreView_(scoreState_(u.id).st) };
}
/** Admin: change admin rate (%), starting target and/or growth (%). Pass null to leave a value unchanged. */
function adminSetScoreConfig(adminId, adminRate, startTarget, growth) {
  return withLock_(function () {
    if (!requireAdmin_(adminId)) return { success: false, error: 'Access denied' };
    var sh = sheet_(SHEETS.SETTINGS), vals = { adminRate: adminRate, startTarget: startTarget, growth: growth };
    Object.keys(vals).forEach(function (k) {
      if (vals[k] === null || vals[k] === undefined || vals[k] === '') return;
      var n = Number(vals[k]);
      if (isNaN(n) || n < 0 || (k === 'startTarget' && n <= 0)) throw new Error('Invalid ' + k);
      var row = null;
      settingsRows_('scoreconfig').forEach(function (r) { if (String(r.id).trim() === k) row = r; });
      var obj = { kind: 'scoreconfig', id: k, status: 'on', data: JSON.stringify(n) };
      if (row) writeObject_(sh, row._row, obj); else appendObject_(sh, obj);
    });
    return { success: true, config: scoreCfg_() };
  });
}

function releaseDueHoldsForUser_(user) {
  if (!user || !user.id) return 0;
  var sh = sheet_(SHEETS.RECORDS);
  var rows = rowsAsObjects_(sh);
  var now = new Date();
  var released = 0;
  rows.forEach(function (h) {
    if (!isPendingHold_(h)) return;
    if (String(h.userId).trim() !== String(user.id)) return;
    var when = parseDate_(safeJson_(h.data, {}).releaseAt);
    if (!when || when > now) return;
    var amt = numOf_(h.amount);
    if (amt <= 0) return;
    h.status = 'released';
    writeObject_(sh, h._row, h);
    released += amt;
  });
  if (released > 0) {
    var fresh = findUserById_(user.id);
    if (!fresh) return 0;
    fresh.diamonds = (Number(fresh.diamonds) || 0) + released;
    saveUser_(fresh);
    addRecord_(fresh, 'balance', 'hold_release', released, 'ok',
      { after: Number(fresh.diamonds), detail: 'hold released after ' + CFG.HOLD_DAYS + ' days' });
  }
  return released;
}

function releaseAllDueHolds() {
  return withLock_(function () {
    ensureSchema_();
    var total = 0;
    rowsAsObjects_(sheet_(SHEETS.USERS)).forEach(function (u) { if (u.id) total += releaseDueHoldsForUser_(u); });
    try { ss_().toast('Released ' + total + ' diamonds from holds.', '01GH', 5); } catch (e) {}
    return total;
  });
}

function setupDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'releaseAllDueHolds') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('releaseAllDueHolds').timeBased().everyDays(1).atHour(3).create();
}

// ===================== POSTBACK =====================
function handlePostback_(p) {
  try {
    return withLock_(function () {
      ensureSchema_();
      var userId = p.user_id || p.userId || p.uid;
      var amount = Number(p.amount || p.points || p.diamonds || 0);
      var txId = String(p.trans_id || p.transaction_id || p.tx || '');
      var wall = String(p.offerwall || p.wall || 'offerwall');
      if (!userId || !(amount > 0)) return ContentService.createTextOutput('error: missing params');

      // networks send status=1 for completed; ignore anything else (reversals etc.)
      if (p.status !== undefined && p.status !== '' && ['1', 'true', 'completed', 'credited'].indexOf(String(p.status).toLowerCase()) === -1) {
        return ContentService.createTextOutput('ok:ignored');
      }
      if (txId) {
        var recs = rowsAsObjects_(sheet_(SHEETS.RECORDS));
        for (var i = 0; i < recs.length; i++) {
          if (String(recs[i].type) === 'offer' && String(recs[i].ref) === txId) {
            return ContentService.createTextOutput('ok:duplicate');
          }
        }
      }
      var user = findUserById_(userId) || findUserByUsername_(userId);
      if (!user) return ContentService.createTextOutput('error: user not found');
      var r = creditEarnings_(user, amount, { kind: 'offer', ref: txId, detail: wall, data: { offerwall: wall, params: p } });
      return ContentService.createTextOutput(r.success ? 'ok' : ('error:' + (r.error || '')));
    });
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err);
  }
}

// ===================== API: AUTH =====================
function loginUser(username, password) {
  try {
    ensureSchema_();
    username = String(username || '').trim();
    password = String(password || '');
    if (!username || !password) return { success: false, error: 'Enter username and password' };
    var user = findUserByUsername_(username);
    if (!user) return { success: false, error: 'Invalid username or password' };
    if (!passwordOk_(user, password)) return { success: false, error: 'Invalid username or password' };
    updateAttendance_(user);
    user = findUserById_(user.id);
    if (isBanned_(user)) return { success: false, error: 'Account banned. Attendance Rate reached 0%.' };
    user.sessionToken = uid_();
    user.lastActivity = stamp_();
    saveUser_(user);
    var pub = null;
    try { pub = publicUser_(user); } catch (e1) {
      // minimal user if publicUser fails
      pub = {
        id: String(user.id), username: String(user.username),
        diamonds: Number(user.diamonds) || 0, totalEarned: Number(user.totalEarned) || 0,
        level: 0,
        sessionToken: String(user.sessionToken), isAdmin: isAdminUser_(user),
        holdBalance: 0, verified: false, canCashout: true
      };
    }
    return { success: true, user: pub };
  } catch (err) {
    return { success: false, error: 'Login failed: ' + (err.message || String(err)) };
  }
}

function loginWithToken(token) {
  try {
    ensureSchema_();
    token = String(token || '').trim();
    if (!token) return { success: false, error: 'Session expired' };
    var user = findUserByToken_(token);
    if (!user) return { success: false, error: 'Session expired' };
    updateAttendance_(user);
    user = findUserById_(user.id);
    if (isBanned_(user)) return { success: false, error: 'Account banned. Attendance Rate reached 0%.' };
    var pub = null;
    try { pub = publicUser_(user); } catch (e1) {
      pub = {
        id: String(user.id), username: String(user.username),
        diamonds: Number(user.diamonds) || 0, totalEarned: Number(user.totalEarned) || 0,
        level: 1, sessionToken: String(user.sessionToken || token),
        isAdmin: isAdminUser_(user), holdBalance: 0, verified: false, canCashout: true
      };
    }
    return { success: true, user: pub };
  } catch (err) {
    return { success: false, error: 'Session error: ' + (err.message || String(err)) };
  }
}

// ===================== SETTINGS: rewards + offerwalls =====================
function settingsRows_(kind) {
  return rowsAsObjects_(sheet_(SHEETS.SETTINGS)).filter(function (r) {
    return String(r.kind).trim().toLowerCase() === kind && String(r.id).trim() !== '';
  });
}
function statusOn_(s) {
  return ['enabled', 'active', 'on', 'true', '1', 'yes'].indexOf(String(s).trim().toLowerCase()) !== -1;
}
function logoForReward_(d) {
  if (d.logo) return String(d.logo);
  var t = String(d.type || d.title || '').toLowerCase();
  var map = {
    paypal: 'paypal.com', amazon: 'amazon.com', steam: 'steampowered.com',
    roblox: 'roblox.com', discord: 'discord.com', visa: 'visa.com',
    bitcoin: 'bitcoin.org', btc: 'bitcoin.org', litecoin: 'litecoin.org', ltc: 'litecoin.org',
    ethereum: 'ethereum.org', eth: 'ethereum.org', solana: 'solana.com', sol: 'solana.com',
    usdt: 'tether.to', doge: 'dogecoin.com', dogecoin: 'dogecoin.com',
    google: 'google.com', apple: 'apple.com', netflix: 'netflix.com'
  };
  for (var k in map) {
    if (t.indexOf(k) >= 0) return 'https://www.google.com/s2/favicons?domain=' + map[k] + '&sz=128';
  }
  return 'https://www.google.com/s2/favicons?domain=example.com&sz=128';
}

function rewardOut_(r) {
  var d = safeJson_(r.data, {});
  var t = String(d.type || 'giftcard').toLowerCase();
  return {
    id: String(d.id || r.id), title: String(d.title || r.id), subtitle: String(d.subtitle || ''),
    type: CRYPTO_TYPES.indexOf(t) !== -1 ? 'crypto' : t, coin: t,
    amount: Number(d.amount) || 0, cost: Number(d.cost) || 0,
    description: String(d.description || ''), deliveryTime: String(d.deliveryTime || ''),
    logo: logoForReward_(d), status: statusOn_(r.status) ? 'active' : 'disabled'
  };
}
function wallOut_(r, userId) {
  var d = safeJson_(r.data, {});
  var tpl = String(d.urlTemplate || d.url || '');
  var url = tpl.indexOf('internal:') === 0 ? tpl : tpl.split('{id}').join(encodeURIComponent(userId || ''));
  var domain = String(d.domain || '');
  if (!domain && /^https?:\/\//i.test(url)) {
    try { domain = url.replace(/^https?:\/\//i, '').split('/')[0]; } catch (e) {}
  }
  var name = String(d.name || r.id || '');
  var logo = d.logo ? String(d.logo) : '';
  if (!logo && domain) logo = 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=128';
  if (!logo) {
    var n = name.toLowerCase();
    var guess = {
      cpx: 'cpx-research.com', wannads: 'wannads.com', adgate: 'adgatemedia.com',
      adgem: 'adgem.com', ayet: 'ayetstudios.com', bitlabs: 'bitlabs.ai',
      timewall: 'timewall.io', lootably: 'lootably.com', torox: 'torox.io',
      offerwall: 'google.com'
    };
    for (var k in guess) {
      if (n.indexOf(k) >= 0) { logo = 'https://www.google.com/s2/favicons?domain=' + guess[k] + '&sz=128'; break; }
    }
  }
  if (!logo) logo = 'https://www.google.com/s2/favicons?domain=google.com&sz=128';
  return {
    id: String(r.id), name: name, url: url, logo: logo,
    minDiamonds: Number(d.minDiamonds) || 0, domain: domain,
    enabled: statusOn_(r.status), template: tpl
  };
}

// ===================== API: DATA =====================
function isMaintenance_() {
  var rows = rowsAsObjects_(sheet_(SHEETS.SETTINGS));
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].kind).trim().toLowerCase() === 'maintenance' && statusOn_(rows[i].status)) {
      var d = safeJson_(rows[i].data, {});
      return { on: true, message: d.message || 'Under maintenance. Please check back soon.' };
    }
  }
  return { on: false, message: '' };
}

function getMaintenance() {
  ensureSchema_();
  return isMaintenance_();
}

function adminSetMaintenance(adminId, on, message) {
  return withLock_(function () {
    if (!requireAdmin_(adminId)) return { success: false, error: 'Access denied' };
    var sh = sheet_(SHEETS.SETTINGS);
    var rows = rowsAsObjects_(sh);
    var found = null;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].kind).trim().toLowerCase() === 'maintenance') { found = rows[i]; break; }
    }
    var data = JSON.stringify({ message: String(message || 'Under maintenance. Please check back soon.') });
    if (found) {
      found.status = on ? 'active' : 'off';
      found.data = data;
      writeObject_(sh, found._row, found);
    } else if (on) {
      appendObject_(sh, { kind: 'maintenance', id: 'site', status: 'active', data: data });
    }
    return { success: true, maintenance: isMaintenance_() };
  });
}

function getInitialData(userId) {
  ensureSchema_();
  var maint = isMaintenance_();
  var user = userId ? findUserById_(userId) : null;
  var pubUser = user ? publicUser_(user) : null;
  // Non-admins see lock screen only during maintenance
  if (maint.on && (!pubUser || !pubUser.isAdmin)) {
    return {
      maintenance: true,
      maintenanceMessage: maint.message,
      user: pubUser,
      shopItems: [], offerwalls: [], leaderboard: [], activityTicker: []
    };
  }
  var bal = pubUser ? pubUser.diamonds : 0;

  var rewards = settingsRows_('reward').map(rewardOut_).filter(function (r) { return r.status === 'active'; });

  var walls = pubUser ? settingsRows_('offerwall').map(function (r) { return wallOut_(r, pubUser.id); })
    .filter(function (w) { return w.enabled; })
    .map(function (w) {
      return {
        id: w.id, name: w.name, url: w.url, logo: w.logo, minDiamonds: w.minDiamonds,
        locked: bal < w.minDiamonds, canAccess: bal >= w.minDiamonds
      };
    }) : [];

  var board = rowsAsObjects_(sheet_(SHEETS.USERS))
    .filter(function (u) { return u.username; })
    .map(function (u) {
      return {
        username: String(u.username),
        diamonds: Number(u.diamonds) || 0,
        level: 0,
        attendanceRate: Number(u.attendanceRate) || 100,
        verified: isVerified_(u.id)
      };
    })
    .sort(function (a, b) { return b.diamonds - a.diamonds; })
    .slice(0, 50);

  return {
    user: pubUser, shopItems: rewards, offerwalls: walls, leaderboard: board,
    activityTicker: getActivityTicker(20), maintenance: false, maintenanceMessage: ''
  };
}

function getActivityTicker(limit) {
  ensureSchema_();
  limit = Math.min(Number(limit) || 20, 40);
  return rowsAsObjects_(sheet_(SHEETS.RECORDS))
    .filter(function (a) { return String(a.type) === 'activity' && a.username && String(a.ref) !== 'admin' && String(a.ref) !== 'cover'; })
    .slice(-limit).reverse()
    .map(function (a) {
      var t = parseDate_(a.timestamp);
      return {
        username: String(a.username), action: String(a.ref || ''),
        detail: String(safeJson_(a.data, {}).detail || ''), amount: 0,
        time: t ? Utilities.formatDate(t, Session.getScriptTimeZone(), 'MMM d HH:mm') : ''
      };
    });
}

// ===================== DAILY (Daily tab: one row per user) =====================
function dailyReward_() {
  return CFG.DAILY_REWARD || 5;
}

function getDailyStatus(userId) {
  ensureSchema_();
  var user = findUserById_(userId);
  if (!user) return { success: false, error: 'User not found' };
  releaseDueHoldsForUser_(user);
  user = findUserById_(userId);

  var last = null;
  rowsAsObjects_(sheet_(SHEETS.DAILY)).forEach(function (r) {
    if (String(r.userId) === String(userId)) last = parseDate_(r.lastClaim) || parseDate_(r.claimedAt);
  });
  var msLeft = 0, canClaim = true;
  if (last) {
    msLeft = Math.max(0, last.getTime() + 24 * 3600 * 1000 - Date.now());
    canClaim = msLeft <= 0;
  }
  var monthEarn = monthEarn_(userId);
  var monthOk = monthEarn >= CFG.DAILY_MIN_MONTH_EARN;
  if (!monthOk) canClaim = false;
  return {
    success: true, level: 0, reward: dailyReward_(), canClaim: canClaim, msLeft: msLeft,
    monthEarn: monthEarn, monthRequired: CFG.DAILY_MIN_MONTH_EARN, monthOk: monthOk
  };
}

function claimDaily(userId) {
  return withLock_(function () {
    var user = findUserById_(userId);
    if (!user) return { success: false, error: 'User not found' };
    // GrindBux-style: monthly activity only (no rank gate)
    var monthEarn = monthEarn_(userId);
    if (monthEarn < CFG.DAILY_MIN_MONTH_EARN) {
      return { success: false, error: 'Earn ' + CFG.DAILY_MIN_MONTH_EARN + ' diamonds this month first (have ' + monthEarn + ')' };
    }
    var st = getDailyStatus(userId);
    if (!st.canClaim) return { success: false, error: 'Already claimed. Wait for the timer.', status: st };

    var r = creditEarnings_(user, st.reward, { kind: 'daily', detail: 'daily reward' });
    if (!r.success) return { success: false, error: r.error || 'Could not credit reward' };

    var sh = sheet_(SHEETS.DAILY), row = null;
    rowsAsObjects_(sh).forEach(function (x) { if (String(x.userId) === String(userId)) row = x; });
    var now = new Date();
    if (row) {
      row.lastClaim = now.getTime(); row.level = st.level; row.username = user.username; row.claimedAt = stamp_(now);
      writeObject_(sh, row._row, row);
    } else {
      appendObject_(sh, { userId: user.id, lastClaim: now.getTime(), level: st.level, username: user.username, claimedAt: stamp_(now) });
    }
    addActivity_(user, 'daily', 'claimed daily reward (+' + st.reward + ')');
    return {
      success: true, diamonds: r.available, hold: r.hold, reversalRate: r.reversalRate,
      newBalance: r.newBalance, user: r.user, status: getDailyStatus(userId)
    };
  });
}

// ===================== PROMO CODES (Codes tab) =====================
function redeemBonusCode(userId, code) {
  return withLock_(function () {
    var user = findUserById_(userId);
    if (!user) return { success: false, error: 'User not found' };
    code = String(code || '').trim().toUpperCase();
    if (!code) return { success: false, error: 'Enter a code' };

    var sh = sheet_(SHEETS.CODES), found = null;
    rowsAsObjects_(sh).forEach(function (r) {
      if (!found && String(r.code || '').trim().toUpperCase() === code) found = r;
    });
    if (!found) return { success: false, error: 'Invalid code' };
    if (String(found.status || 'active').trim().toLowerCase() !== 'active') return { success: false, error: 'Code inactive' };
    var exp = parseDate_(found.expiresAt);
    if (exp && exp.getTime() < Date.now()) return { success: false, error: 'Code expired' };
    var max = Number(found.maxUses) || 0, used = Number(found.usedCount) || 0;
    if (max > 0 && used >= max) return { success: false, error: 'Code fully redeemed' };

    var prior = rowsAsObjects_(sheet_(SHEETS.RECORDS)).some(function (r) {
      return String(r.type) === 'bonus' && String(r.userId) === String(userId) && String(r.ref).toUpperCase() === code;
    });
    if (prior) return { success: false, error: 'You already used this code' };

    var amt = Number(found.diamonds) || 0;
    if (amt <= 0) return { success: false, error: 'Invalid code value' };

    found.usedCount = used + 1;
    writeObject_(sh, found._row, found);

    var r = creditEarnings_(user, amt, { kind: 'bonus', ref: code, detail: code });
    if (!r.success) return { success: false, error: r.error || 'Could not credit code' };
    addActivity_(user, 'bonus', 'redeemed ' + code + ' (+' + amt + ')');
    return { success: true, diamonds: r.available, hold: r.hold, reversalRate: r.reversalRate, newBalance: r.newBalance, user: r.user };
  });
}

// ===================== CASHOUT =====================
function requestCashout(userId, rewardId, info) {
  return withLock_(function () {
    var user = findUserById_(userId);
    if (!user) return { success: false, error: 'User not found' };
    releaseDueHoldsForUser_(user);
    user = findUserById_(userId);

    var reward = null;
    settingsRows_('reward').forEach(function (r) {
      var o = rewardOut_(r);
      if (o.id === String(rewardId) || String(r.id) === String(rewardId)) reward = o;
    });
    if (!reward || reward.status !== 'active') return { success: false, error: 'Reward not available' };

    var cost = reward.cost;
    if (reward.type === 'crypto') cost = cost + Math.round(cost * 0.05);
    updateAttendance_(user);
    user = findUserById_(userId);
    var rate = Number(user.attendanceRate) || 100;
    var minRate = CFG.MIN_ATTENDANCE_FOR_CASHOUT || 60;
    if (isBanned_(user) || rate <= 0) {
      return { success: false, error: 'Account banned. Attendance Rate reached 0%.' };
    }
    if (rate < minRate) {
      return { success: false, error: 'Cashout requires at least ' + minRate + '% Attendance Rate. Your rate is ' + rate + '%.' };
    }
    var cut = attendanceCutPct_(rate);
    var accessible = Math.floor((Number(user.diamonds) || 0) * (100 - cut) / 100);
    if (accessible < cost) {
      return { success: false, error: 'Not enough accessible diamonds. Attendance ' + rate + '% locks ' + cut + '% of balance. Accessible: ' + accessible };
    }
    user.diamonds = Number(user.diamonds) - cost;
    saveUser_(user);

    addRecord_(user, 'cashout', reward.id, cost, 'pending', {
      rewardId: reward.id, rewardTitle: reward.title, amount: reward.amount, cost: cost,
      logo: reward.logo || '', deliveryInfo: info || {}
    });
    addRecord_(user, 'balance', 'cashout', -cost, 'ok', { after: Number(user.diamonds), detail: reward.title });
    addActivity_(user, 'cashout', 'cashed out');
    return { success: true, newBalance: Number(user.diamonds), user: publicUser_(user) };
  });
}

function getUserCashouts(userId) {
  ensureSchema_();
  return rowsAsObjects_(sheet_(SHEETS.RECORDS))
    .filter(function (r) { return String(r.userId) === String(userId) && String(r.type) === 'cashout'; })
    .reverse()
    .map(function (r) {
      var d = safeJson_(r.data, {});
      return {
        id: String(r.id), rewardTitle: d.rewardTitle || String(r.ref || ''), amount: d.amount || '',
        cost: d.cost || Number(r.amount) || 0, logo: d.logo || '',
        status: String(r.status || 'pending'), timestamp: iso_(r.timestamp), txHash: d.txHash || ''
      };
    });
}

// ===================== PROFILE DATA RIGHTS =====================
function exportUserData(userId) {
  ensureSchema_();
  var user = findUserById_(userId);
  if (!user) return { success: false, error: 'User not found' };
  var mine = function (name) {
    return rowsAsObjects_(sheet_(name)).filter(function (r) { return String(r.userId) === String(userId); }).map(plain_);
  };
  var profile = publicUser_(user);
  delete profile.sessionToken;
  return { success: true, exportedAt: nowIso_(), profile: profile, records: mine(SHEETS.RECORDS), dailyClaims: mine(SHEETS.DAILY) };
}

function deleteUserAccount(userId, password) {
  return withLock_(function () {
    var user = findUserById_(userId);
    if (!user) return { success: false, error: 'User not found' };
    if (isAdminUser_(user)) return { success: false, error: 'Admin accounts cannot be self-deleted' };
    if (!passwordOk_(user, password)) return { success: false, error: 'Wrong password' };

    deleteRows_(sheet_(SHEETS.RECORDS), function (r) { return String(r.userId) === String(userId); });
    deleteRows_(sheet_(SHEETS.DAILY), function (r) { return String(r.userId) === String(userId); });
    var fresh = findUserById_(userId);
    if (fresh) sheet_(SHEETS.USERS).deleteRow(fresh._row);
    return { success: true };
  });
}

// ===================== CHAT (Records, Type = chat) =====================
function getChatMessages() {
  ensureSchema_();
  var ranks = {};
  var admins = {};
  rowsAsObjects_(sheet_(SHEETS.USERS)).forEach(function (u) {
    var un = String(u.username || '');
    ranks[un] = String(u.level || 'None');
    admins[un] = isAdminUser_(u);
  });
  return rowsAsObjects_(sheet_(SHEETS.RECORDS))
    .filter(function (c) { return String(c.type) === 'chat'; })
    .slice(-80)
    .map(function (c) {
      var t = parseDate_(c.timestamp);
      var un = String(c.username || '');
      return {
        username: un, message: String(safeJson_(c.data, {}).message || ''),
        rank: ranks[un] || 'None',
        isAdmin: !!admins[un],
        timestamp: t ? Utilities.formatDate(t, Session.getScriptTimeZone(), 'MMM d HH:mm') : ''
      };
    });
}

function sendChatMessage(userId, username, message) {
  ensureSchema_();
  var user = findUserById_(userId);
  if (!user) return { success: false, error: 'Log in first' };
  if (isMuted_(user.id)) return { success: false, error: 'You are muted' };
  if ((Number(user.totalEarned) || 0) < CFG.CHAT_MIN_EARNED) {
    return { success: false, error: 'Earn ' + CFG.CHAT_MIN_EARNED + ' diamonds first to unlock chat' };
  }
  message = String(message || '').trim().slice(0, 500);
  if (!message) return { success: false, error: 'Empty message' };
  addRecord_(user, 'chat', '', 0, 'user', { avatar: '👤', message: message });
  if (Math.random() < 0.05) pruneType_('chat', 300);
  return { success: true };
}

/** Admin releases a pending hold after user shows proof */
function adminReleaseHold(adminId, holdId) {
  return withLock_(function () {
    if (!requireAdmin_(adminId)) return { success: false, error: 'Access denied' };
    var sh = sheet_(SHEETS.RECORDS);
    var rows = rowsAsObjects_(sh);
    var hold = null;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].id) === String(holdId) && isPendingHold_(rows[i])) {
        hold = rows[i]; break;
      }
    }
    if (!hold) return { success: false, error: 'Hold not found' };
    var user = findUserById_(hold.userId);
    if (!user) return { success: false, error: 'User not found' };
    var amt = numOf_(hold.amount);
    hold.status = 'released';
    writeObject_(sh, hold._row, hold);
    user.diamonds = (Number(user.diamonds) || 0) + amt;
    saveUser_(user);
    addRecord_(user, 'balance', 'hold_release', amt, 'ok', { after: Number(user.diamonds), detail: 'released after proof', holdId: holdId });
    addActivity_(user, 'hold', 'hold released +' + amt + ' (proof approved)');
    // mark related offer as credited for rank tasks
    rowsAsObjects_(sh).forEach(function (r) {
      if (String(r.userId) === String(user.id) && String(r.type) === 'offer' && String(r.status) === 'held' &&
          String(r.ref) === String(safeJson_(hold.data, {}).ref || r.ref) && Number(r.amount) === amt) {
        r.status = 'credited';
        writeObject_(sh, r._row, r);
        creditTaskScore_(user, 'held offer released');
      }
    });
    return { success: true, amount: amt, user: publicUser_(user) };
  });
}

// ===================== PRIVATE SUPPORT =====================
function sendSupportMessage(userId, message) {
  return withLock_(function () {
    var user = findUserById_(userId);
    if (!user) return { success: false, error: 'Log in first' };
    message = String(message || '').trim().slice(0, 1000);
    if (!message) return { success: false, error: 'Empty message' };
    addRecord_(user, 'support', '', 0, 'open', { message: message });
    return { success: true };
  });
}

function getSupportMessages(userId) {
  ensureSchema_();
  var user = findUserById_(userId);
  if (!user) return [];
  var rows = rowsAsObjects_(sheet_(SHEETS.RECORDS));
  var mine = rows.filter(function (r) {
    return (String(r.type) === 'support' || String(r.type) === 'support_reply') && String(r.userId) === String(userId);
  });
  return mine.map(function (r) {
    var d = safeJson_(r.data, {});
    var t = parseDate_(r.timestamp);
    return {
      id: String(r.id),
      message: String(d.message || ''),
      fromAdmin: String(r.type) === 'support_reply',
      timestamp: t ? Utilities.formatDate(t, Session.getScriptTimeZone(), 'MMM d HH:mm') : ''
    };
  }).sort(function (a, b) { return a.timestamp.localeCompare(b.timestamp); });
}

function adminReplySupport(adminId, supportId, message) {
  return withLock_(function () {
    if (!requireAdmin_(adminId)) return { success: false, error: 'Access denied' };
    message = String(message || '').trim().slice(0, 1000);
    if (!message) return { success: false, error: 'Empty reply' };
    var sh = sheet_(SHEETS.RECORDS);
    var rows = rowsAsObjects_(sh);
    var ticket = null;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].id) === String(supportId) && String(rows[i].type) === 'support') { ticket = rows[i]; break; }
    }
    if (!ticket) return { success: false, error: 'Ticket not found' };
    var user = findUserById_(ticket.userId);
    if (!user) return { success: false, error: 'User not found' };
    addRecord_(user, 'support_reply', supportId, 0, 'ok', { message: message });
    // mark original as answered
    ticket.status = 'answered';
    writeObject_(sh, ticket._row, ticket);
    return { success: true };
  });
}

// ===================== ADMIN =====================
function requireAdmin_(adminId) {
  var a = findUserById_(adminId);
  return isAdminUser_(a) ? a : null;
}

function adminGetDashboard(adminId) {
  ensureSchema_();
  if (!requireAdmin_(adminId)) return { success: false, error: 'Access denied' };

  var pending = rowsAsObjects_(sheet_(SHEETS.RECORDS)).filter(function (r) {
    return String(r.type) === 'cashout' && String(r.status).toLowerCase() === 'pending';
  }).map(function (r) {
    var d = safeJson_(r.data, {});
    return {
      id: String(r.id), username: String(r.username || ''), rewardTitle: d.rewardTitle || String(r.ref || ''),
      amount: d.amount || '', cost: d.cost || Number(r.amount) || 0, logo: d.logo || '',
      deliveryInfo: JSON.stringify(d.deliveryInfo || {})
    };
  });

  var holds = holdBalanceMap_(), cov = coverageMap_(), muted = mutedMap_();
  var users = rowsAsObjects_(sheet_(SHEETS.USERS)).filter(function (u) { return u.id; }).map(function (u) {
    syncUserCols_(u);
    var ri = calcInactivityRate_(u, cov);
    return {
      id: String(u.id), username: String(u.username || ''), diamonds: Number(u.diamonds) || 0,
      holdBalance: holds[String(u.id)] || 0, totalEarned: Number(u.totalEarned) || 0,
      attendanceRate: Number(u.attendanceRate) || 100,
      skippedDays: Number(u.skippedDays) || 0,
      recoveryDays: Number(u.recoveryDays) || 0,
      isMuted: !!muted[String(u.id)], lastActivity: iso_(u.lastActivity),
      joinDays: ri.joinDays, daysInactive: ri.joinDays
    };
  });

  return {
    success: true,
    pendingCashouts: pending,
    users: users,
    support: rowsAsObjects_(sheet_(SHEETS.RECORDS)).filter(function (r) {
      return String(r.type) === 'support' && String(r.status) !== 'closed';
    }).map(function (r) {
      var d = safeJson_(r.data, {});
      var t = parseDate_(r.timestamp);
      return {
        id: String(r.id), username: String(r.username || ''), message: String(d.message || ''),
        status: String(r.status || 'open'), timestamp: t ? Utilities.formatDate(t, Session.getScriptTimeZone(), 'MMM d HH:mm') : ''
      };
    }).reverse(),
    bonusCodes: rowsAsObjects_(sheet_(SHEETS.CODES)).filter(function (c) { return c.code; }).map(function (c) {
      return {
        id: String(c.code), code: String(c.code), diamonds: Number(c.diamonds) || 0,
        maxUses: Number(c.maxUses) || 0, usedCount: Number(c.usedCount) || 0, status: String(c.status || 'active')
      };
    }),
    rewards: settingsRows_('reward').map(rewardOut_),
    offerwalls: settingsRows_('offerwall').map(function (r) {
      var w = wallOut_(r, '');
      return { id: w.id, name: w.name, url: w.template, logo: w.logo, minDiamonds: w.minDiamonds, enabled: w.enabled };
    })
  };
}

function adminUpdateCashout(adminId, cashoutId, status, note) {
  return withLock_(function () {
    if (!requireAdmin_(adminId)) return { success: false, error: 'Access denied' };
    status = String(status || '').toLowerCase();
    if (status !== 'approved' && status !== 'rejected') return { success: false, error: 'Invalid status' };
    var sh = sheet_(SHEETS.RECORDS);
    var rows = rowsAsObjects_(sh);
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (String(r.id) !== String(cashoutId) || String(r.type) !== 'cashout') continue;
      if (String(r.status).toLowerCase() !== 'pending') return { success: false, error: 'Already processed' };
      if (status === 'rejected') {
        var user = findUserById_(r.userId);
        if (user) {
          user.diamonds = (Number(user.diamonds) || 0) + (Number(r.amount) || 0);
          saveUser_(user);
          addRecord_(user, 'balance', 'refund', Number(r.amount) || 0, 'ok', { after: Number(user.diamonds), detail: 'cashout rejected' });
        }
      }
      if (note) {
        var d = safeJson_(r.data, {});
        d.txHash = String(note);
        r.data = JSON.stringify(d);
      }
      r.status = status;
      writeObject_(sh, r._row, r);
      return { success: true };
    }
    return { success: false, error: 'Not found' };
  });
}

function adminSetDiamonds(adminId, userId, diamonds) {
  if (!requireAdmin_(adminId)) return { success: false, error: 'Access denied' };
  var user = findUserById_(userId);
  if (!user) return { success: false, error: 'User not found' };
  var before = Number(user.diamonds) || 0;
  user.diamonds = Math.max(0, Number(diamonds) || 0);
  saveUser_(user);
  addRecord_(user, 'balance', 'admin', user.diamonds - before, 'ok', { after: user.diamonds, detail: 'set by admin' });
  addActivity_(user, 'admin', 'diamonds set to ' + user.diamonds);
  return { success: true };
}

/** Admin: reset a user's profile amounts (diamonds, total earned, level, pending holds, score). */
function adminResetUser(adminId, userId) {
  return withLock_(function () {
    if (!requireAdmin_(adminId)) return { success: false, error: 'Access denied' };
    var user = findUserById_(userId);
    if (!user) return { success: false, error: 'User not found' };
    var sh = sheet_(SHEETS.RECORDS), cancelled = 0;
    rowsAsObjects_(sh).forEach(function (h) {
      if (isPendingHold_(h) && String(h.userId).trim() === String(user.id)) {
        h.status = 'cancelled'; writeObject_(sh, h._row, h); cancelled += numOf_(h.amount);
      }
    });
    var before = Number(user.diamonds) || 0;
    user.diamonds = 0; user.totalEarned = 0; user.experience = 0; user.level = 1;
    var ss = sheet_(SHEETS.SETTINGS);
    rowsAsObjects_(ss).filter(function (r) { return String(r.kind).trim().toLowerCase() === 'score' && String(r.id) === String(user.id); })
      .sort(function (a, b) { return b._row - a._row; }).forEach(function (r) { ss.deleteRow(r._row); });
    saveUser_(user);
    addRecord_(user, 'balance', 'admin_reset', -before, 'ok', { after: 0, detail: 'profile reset by admin', cancelledHolds: cancelled });
    addActivity_(user, 'admin', 'profile reset');
    return { success: true };
  });
}

function adminSetMute(adminId, userId, muted) {
  if (!requireAdmin_(adminId)) return { success: false, error: 'Access denied' };
  var user = findUserById_(userId);
  if (!user) return { success: false, error: 'User not found' };
  var sh = sheet_(SHEETS.SETTINGS), row = null;
  rowsAsObjects_(sh).forEach(function (r) {
    if (String(r.kind).trim().toLowerCase() === 'muted' && String(r.id) === String(userId)) row = r;
  });
  if (row) { row.status = muted ? 'active' : 'disabled'; writeObject_(sh, row._row, row); }
  else if (muted) appendObject_(sh, { kind: 'muted', id: String(userId), status: 'active', data: JSON.stringify({ username: user.username }) });
  return { success: true };
}

function adminCreateUser(adminId, username, password, diamonds) {
  return withLock_(function () {
    if (!requireAdmin_(adminId)) return { success: false, error: 'Access denied' };
    username = String(username || '').trim();
    if (!username || !password) return { success: false, error: 'Username and password required' };
    if (findUserByUsername_(username)) return { success: false, error: 'Username taken' };
    appendObject_(sheet_(SHEETS.USERS), {
      id: uid_(), username: username, password: String(password),
      diamonds: Number(diamonds) || 0, totalEarned: 0, level: 1, experience: 0,
      referralCode: username.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6),
      referrals: 0, createdAt: stamp_(), lastActivity: '', sessionToken: ''
    });
    return { success: true };
  });
}

function adminCreateBonusCode(adminId, code, diamonds, maxUses) {
  if (!requireAdmin_(adminId)) return { success: false, error: 'Access denied' };
  code = String(code || '').trim().toUpperCase();
  if (!code) return { success: false, error: 'Code required' };
  appendObject_(sheet_(SHEETS.CODES), {
    code: code, status: 'active', diamonds: Number(diamonds) || 0, maxUses: Number(maxUses) || 0, usedCount: 0, expiresAt: ''
  });
  return { success: true };
}

function adminSaveReward(adminId, data) {
  return withLock_(function () {
    if (!requireAdmin_(adminId)) return { success: false, error: 'Access denied' };
    data = data || {};
    var title = String(data.title || 'Reward');
    var id = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || uid_();
    appendObject_(sheet_(SHEETS.SETTINGS), {
      kind: 'reward', id: id, status: 'active',
      data: JSON.stringify({
        id: id, title: title, subtitle: String(data.subtitle || ''), type: String(data.type || 'giftcard'),
        amount: Number(data.amount) || 0, cost: Number(data.cost) || 0, description: '', deliveryTime: 'Up to 5 days'
      })
    });
    return { success: true };
  });
}

function adminToggleReward(adminId, rewardId, enable) {
  return withLock_(function () {
    if (!requireAdmin_(adminId)) return { success: false, error: 'Access denied' };
    var sh = sheet_(SHEETS.SETTINGS);
    var rows = rowsAsObjects_(sh);
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (String(r.kind).trim().toLowerCase() !== 'reward') continue;
      if (rewardOut_(r).id === String(rewardId) || String(r.id) === String(rewardId)) {
        r.status = enable ? 'active' : 'disabled';
        writeObject_(sh, r._row, r);
        return { success: true };
      }
    }
    return { success: false, error: 'Not found' };
  });
}

function adminUpdateOfferwall(adminId, wallId, enabled, minDiamonds) {
  return withLock_(function () {
    if (!requireAdmin_(adminId)) return { success: false, error: 'Access denied' };
    var sh = sheet_(SHEETS.SETTINGS);
    var rows = rowsAsObjects_(sh);
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (String(r.kind).trim().toLowerCase() !== 'offerwall' || String(r.id) !== String(wallId)) continue;
      if (enabled !== null && enabled !== undefined && enabled !== '') r.status = enabled ? 'enabled' : 'disabled';
      if (minDiamonds !== null && minDiamonds !== undefined && minDiamonds !== '') {
        var d = safeJson_(r.data, {});
        d.minDiamonds = Number(minDiamonds) || 0;
        r.data = JSON.stringify(d);
      }
      writeObject_(sh, r._row, r);
      return { success: true };
    }
    return { success: false, error: 'Not found' };
  });
}

// ===================== MAINTENANCE: CLEANUP =====================
/* previewCleanup() shows what would go. cleanupSheets() makes a Drive backup copy first, then removes only: extra tabs from old versions, duplicate/empty/old-script columns, junk rows, blank edges. Unknown columns with data are kept. */
var CLEAN_CORE_ = ['Users', 'Records', 'Codes', 'Daily', 'Settings'];
var CLEAN_LEGACY_TABS_ = ['holds', 'chat', 'activity', 'offerwalls', 'bonuscodes', 'rewards'];
var CLEAN_LEGACY_HEADERS_ = ['id', 'key', 'value', 'verified', 'nextlevelpts', 'pointsperlevel', 'createdat',
  'lastactivity', 'detail', 'meta', 'availablepart', 'holdpart', 'reversalrate', 'releaseat', 'txid', 'source',
  'released', 'message', 'action', 'timestamp', 'amount', 'level', 'username', 'userid', 'type', 'status',
  'data', 'code', 'diamonds', 'maxuses', 'usedcount', 'ismuted', 'isadmin', 'holdbalance', 'ratecoverage'];
var CLEAN_USER_ALIASES_ = { createdat: 'JoinDate', lastactivity: 'LastLogin' };
var CLEAN_IDENTITY_ = { users: 'Username', records: 'Type', codes: 'Code', daily: 'UserID', settings: 'Kind' };

function previewCleanup() { return runCleanup_(true); }
function cleanupSheets() { return runCleanup_(false); }

function runCleanup_(dry) {
  var ss = ss_();
  var log = [];
  if (!dry) {
    try {
      ss.copy('01GH backup before cleanup ' + stamp_());
      log.push('Backup copy saved in your Google Drive (name starts with "01GH backup before cleanup").');
    } catch (e) {
      throw new Error('Could not create a backup, so NOTHING was changed. ' + e);
    }
  }
  var verb = dry ? 'WOULD remove' : 'Removed';

  // 1) extra tabs from old versions
  ss.getSheets().forEach(function (sh) {
    var n = sh.getName().trim().toLowerCase();
    if (CLEAN_CORE_.some(function (c) { return c.toLowerCase() === n; })) return;
    if (CLEAN_LEGACY_TABS_.indexOf(n) === -1) { log.push('Left alone (not from this app): tab "' + sh.getName() + '"'); return; }
    var first = sh.getLastColumn() > 0 ? String(sh.getRange(1, 1).getValue()).trim().toLowerCase() : '';
    if (sh.getLastRow() <= 1 || first === 'id') {
      log.push(verb + ' extra tab "' + sh.getName() + '" (' + Math.max(0, sh.getLastRow() - 1) + ' rows)');
      if (!dry) ss.deleteSheet(sh);
    } else {
      log.push('KEPT tab "' + sh.getName() + '" (looks like your own data)');
    }
  });

  // 2) the five real tabs
  CLEAN_CORE_.forEach(function (name) {
    var sh = findTab_(name);
    if (!sh) { log.push('Tab "' + name + '" not found.'); return; }
    cleanCore_(sh, dry, log, verb);
  });

  var text = (dry ? 'PREVIEW (nothing changed)\n' : 'CLEANUP DONE\n') + log.join('\n');
  Logger.log(text);
  try { ss.toast(dry ? 'Preview ready – see View > Logs / Executions.' : 'Cleanup finished.', '01GH', 6); } catch (e) {}
  try { SpreadsheetApp.getUi().alert(text.slice(0, 1800)); } catch (e) {}
  return text;
}

function cleanCore_(sh, dry, log, verb) {
  var tab = sh.getName(), tabKey = tab.trim().toLowerCase();
  var schema = schemaFor_(tab);
  var canon = {};
  schema.forEach(function (p) { canon[p[1].toLowerCase()] = p[1]; });

  var lastCol = sh.getLastColumn(), lastRow = sh.getLastRow();
  if (lastCol < 1) return;
  var hdr = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || '').trim(); });
  var nrows = Math.max(0, lastRow - 1);
  var data = nrows ? sh.getRange(2, 1, nrows, lastCol).getValues() : [];
  var blank = function (v) { return v === '' || v === null || v === undefined || (typeof v === 'string' && v.trim() === ''); };
  var colEmpty = function (j) { for (var i = 0; i < data.length; i++) if (!blank(data[i][j])) return false; return true; };

  // which column is THE column for each real header (exact capitalisation wins)
  var keepIdx = {};
  hdr.forEach(function (h, j) {
    var l = h.toLowerCase();
    if (!canon[l]) return;
    if (keepIdx[l] === undefined || (h === canon[l] && hdr[keepIdx[l]] !== canon[l])) keepIdx[l] = j;
  });

  // decide which columns go
  var del = {}, mergeTo = {};
  hdr.forEach(function (h, j) {
    var l = h.toLowerCase();
    if (canon[l]) {
      if (keepIdx[l] !== j) { del[j] = 'duplicate of ' + canon[l]; mergeTo[j] = keepIdx[l]; }
      return;
    }
    if (h === '') { if (colEmpty(j)) del[j] = 'empty unnamed column'; return; }
    var alias = tabKey === 'users' ? CLEAN_USER_ALIASES_[l] : null;
    if (alias && keepIdx[alias.toLowerCase()] !== undefined) {
      del[j] = 'old copy of ' + alias; mergeTo[j] = keepIdx[alias.toLowerCase()]; return;
    }
    if (colEmpty(j)) { del[j] = 'unused empty column'; return; }
    if (CLEAN_LEGACY_HEADERS_.indexOf(l) !== -1) { del[j] = 'leftover from earlier script versions'; return; }
    log.push('KEPT column "' + h + '" in ' + tab + ' (contains data and is not part of the app)');
  });

  // Users only: rescue values from old copies into the real column when that is blank
  var rescued = 0;
  if (tabKey === 'users') {
    Object.keys(mergeTo).forEach(function (js) {
      var j = Number(js), t = mergeTo[js];
      for (var i = 0; i < data.length; i++) {
        if (blank(data[i][t]) && !blank(data[i][j])) {
          data[i][t] = data[i][j]; rescued++;
          if (!dry) sh.getRange(i + 2, t + 1).setValue(data[i][j]);
        }
      }
    });
  }

  // junk rows
  var junk = [];
  var idIdx = keepIdx[(CLEAN_IDENTITY_[tabKey] || '').toLowerCase()];
  var seen = {}, kIdx = keepIdx['kind'], sIdx = keepIdx['id'];
  if (idIdx !== undefined) {
    data.forEach(function (row, i) {
      if (blank(row[idIdx])) { junk.push(i); return; }
      if (tabKey === 'settings' && kIdx !== undefined && sIdx !== undefined) {
        var k = String(row[kIdx]).trim().toLowerCase() + '|' + String(row[sIdx]).trim().toLowerCase();
        if (seen[k]) junk.push(i); else seen[k] = true;
      }
    });
  }

  var delCols = Object.keys(del).map(Number).sort(function (a, b) { return b - a; });
  delCols.slice().reverse().forEach(function (j) { log.push(verb + ' column "' + (hdr[j] || '(no name)') + '" from ' + tab + ' – ' + del[j]); });
  if (rescued) log.push((dry ? 'WOULD copy ' : 'Copied ') + rescued + ' value(s) from old columns into the real columns in ' + tab);
  if (junk.length) log.push(verb + ' ' + junk.length + ' junk/duplicate row(s) from ' + tab);
  if (!delCols.length && !junk.length) log.push(tab + ': already clean');

  if (dry) return;

  junk.sort(function (a, b) { return b - a; }).forEach(function (i) { sh.deleteRow(i + 2); });
  delCols.forEach(function (j) { sh.deleteColumn(j + 1); });

  // trim unused blank grid space at the edges
  var lc = sh.getLastColumn(), mc = sh.getMaxColumns();
  if (lc >= 1 && mc > lc) sh.deleteColumns(lc + 1, mc - lc);
  var lr = sh.getLastRow(), mr = sh.getMaxRows();
  var keep = Math.max(lr + 1, 2);
  if (mr > keep) sh.deleteRows(keep + 1, mr - keep);
}

// ===================== MAINTENANCE: HOLD SYNC =====================
/* previewSyncHolds() / syncHolds(): copy hold amounts found in the old Holds tab or a Users.HoldBalance column into Records (Type hold). Only adds the difference; never changes Diamonds. */
function previewSyncHolds() { return syncHolds_(true); }
function syncHolds() { return syncHolds_(false); }

function rawRowsLower_(sh) {
  var lc = sh.getLastColumn(), lr = sh.getLastRow();
  if (lc < 1 || lr < 2) return [];
  var hdr = sh.getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
  return sh.getRange(2, 1, lr - 1, lc).getValues().map(function (row) {
    var o = {};
    hdr.forEach(function (h, j) { if (h && o[h] === undefined) o[h] = row[j]; });
    return o;
  });
}

function syncHolds_(dry) {
  return withLock_(function () {
    ensureSchema_();
    var log = [];
    var users = rowsAsObjects_(sheet_(SHEETS.USERS)).filter(function (u) { return u.id; });
    var byId = {};
    users.forEach(function (u) { byId[String(u.id)] = u; });

    var pending = holdBalanceMap_();          // what the dashboard sees now
    var target = {};                          // what the sheet says: userId -> { amount, releaseAt }

    // Source A: the old "Holds" tab (unreleased rows keep their real release date)
    var holdsTab = findTab_('Holds');
    if (holdsTab) {
      rawRowsLower_(holdsTab).forEach(function (r) {
        var uid = String(r.userid || '');
        var amt = Number(r.amount) || 0;
        if (!uid || amt <= 0 || isTrue_(r.released)) return;
        var t = target[uid] || (target[uid] = { amount: 0, releaseAt: null, src: 'old Holds tab' });
        t.amount += amt;
        var d = parseDate_(r.releaseat);
        if (d && (!t.releaseAt || d > t.releaseAt)) t.releaseAt = d;
      });
    }

    // Source B: a "HoldBalance" column in Users (only for users not covered by source A)
    var usersSheet = sheet_(SHEETS.USERS);
    rawRowsLower_(usersSheet).forEach(function (r) {
      var uid = String(r.id || '');
      var amt = Number(r.holdbalance) || 0;
      if (!uid || amt <= 0 || target[uid]) return;
      target[uid] = { amount: amt, releaseAt: null, src: 'Users.HoldBalance column' };
    });

    var added = 0, total = 0;
    Object.keys(target).forEach(function (uid) {
      var user = byId[uid];
      if (!user) { log.push('Skipped unknown user id ' + uid); return; }
      var t = target[uid];
      var diff = Math.round(t.amount - (pending[uid] || 0));
      if (diff <= 0) { log.push(user.username + ': dashboard already shows ' + (pending[uid] || 0) + ' on hold (sheet: ' + t.amount + ') – nothing to add'); return; }
      var releaseAt = t.releaseAt;
      if (!releaseAt || releaseAt < new Date()) { releaseAt = new Date(); releaseAt.setDate(releaseAt.getDate() + CFG.HOLD_DAYS); }
      log.push((dry ? 'WOULD add ' : 'Added ') + diff + ' on hold for ' + user.username + ' (from ' + t.src + '), releases ' + releaseAt.toISOString().slice(0, 10));
      if (!dry) addRecord_(user, 'hold', 'migrated', diff, 'pending', { releaseAt: releaseAt.toISOString(), migrated: true });
      added++; total += diff;
    });

    if (!Object.keys(target).length) {
      log.push('No hold amounts found in the sheet (no old Holds tab rows and no Users.HoldBalance values).');
      log.push('If you already ran the cleanup, those were removed – open the "01GH backup before cleanup" copy in Drive to see the old values.');
    }
    var text = (dry ? 'PREVIEW (nothing changed)\n' : 'HOLD SYNC DONE\n') + log.join('\n') + (added ? '\nTotal: ' + total + ' diamonds across ' + added + ' user(s).' : '');
    Logger.log(text);
    try { SpreadsheetApp.getUi().alert(text.slice(0, 1800)); } catch (e) {}
    return text;
  });
}
// ===================== RANK SCORE =====================
// Silver 55, Gold 75, Platinum 85
// Inactivity debt = days since join * 10
// Check-ins and tasks pay down debt first, then count toward rank

function rankFromScore_(info) {
  var score = (info && typeof info === 'object') ? info.score : (Number(info) || 0);
  if (score >= 85) return 'Platinum';
  if (score >= 75) return 'Gold';
  if (score >= 55) return 'Silver';
  return 'None';
}

function userScoreEvents_(userId) {
  var uid = String(userId);
  return rowsAsObjects_(sheet_(SHEETS.RECORDS)).filter(function (r) {
    return String(r.userId) === uid && String(r.type) === 'score';
  });
}

function computeScore_(userId) {
  var uid = String(userId);
  var rows = rowsAsObjects_(sheet_(SHEETS.RECORDS));
  var user = findUserById_(userId);
  if (!user) return { score: 0, debt: 0, days: 0, coverCost: 0 };

  var join = parseDate_(user.createdAt) || new Date();
  var days = daysBetween_(join, new Date());

  var checkins = 0, tasks = 0, covered = 0;
  rows.forEach(function (r) {
    if (String(r.userId) !== uid) return;
    if (String(r.type) === 'score' && String(r.ref) === 'checkin') checkins++;
    if (String(r.type) === 'score' && String(r.ref) === 'cover') covered += Number(r.amount) || 0;
    if (String(r.type) === 'offer' && String(r.status) === 'credited') tasks++;
  });

  var baseDebt = days * 10;
  var earned = (checkins * 5) + (tasks * 2.5);
  var debt = Math.max(0, baseDebt - covered);
  // Rank based on earned points (debt tracked separately)
  var score = earned;
  // Cover cost: 100% fee per skipped day → cost = debt * (1 + days)
  var coverCost = Math.ceil(debt * (1 + days));

  return { score: score, debt: debt, days: days, coverCost: coverCost, earned: earned };
}


function lastCheckin_(userId) {
  var events = userScoreEvents_(userId).filter(function (e) { return String(e.ref) === 'checkin'; });
  if (!events.length) return null;
  events.sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
  return events[0];
}

function applyInactivityPenalty_(user) {
  var last = lastCheckin_(user.id);
  if (!last) return;
  var lastTime = parseDate_(last.timestamp);
  if (!lastTime) return;
  var deadline = new Date(lastTime.getTime() + 24 * 60 * 60 * 1000);
  if (new Date() < deadline) return; // still within window
  // Check if penalty already applied for this window
  var events = userScoreEvents_(user.id);
  var already = events.some(function (e) {
    return String(e.ref) === 'penalty' && parseDate_(e.timestamp) >= deadline;
  });
  if (already) return;
  addRecord_(user, 'score', 'penalty', -10, 'ok', { reason: 'missed check-in window' });
  addActivity_(user, 'score', 'inactivity penalty -10');
}

function checkIn(userId) {
  return { success: false, error: 'Not available' };
  return withLock_(function () {
    var user = findUserById_(userId);
    if (!user) return { success: false, error: 'Not found' };
    applyInactivityPenalty_(user);
    // Strict once per calendar day (script timezone)
    var tz = Session.getScriptTimeZone();
    var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var events = userScoreEvents_(userId).filter(function (e) { return String(e.ref) === 'checkin'; });
    var already = events.some(function (e) {
      var d = parseDate_(e.timestamp);
      return d && Utilities.formatDate(d, tz, 'yyyy-MM-dd') === today;
    });
    if (already) return { success: false, error: 'Already checked in today' };
    addRecord_(user, 'score', 'checkin', 5, 'ok', {});
    addActivity_(user, 'score', 'checked in +5');
    var score = computeScore_(user.id);
    return { success: true, score: score, rank: rankFromScore_(score), user: publicUser_(user) };
  });
}

function fixUserCheckin() {
  return removeExtraCheckins('2e83ce24-987b-4830-af15-7f3d5b04c707');
}

function removeExtraCheckins(userId) {
  return withLock_(function () {
    var sh = sheet_(SHEETS.RECORDS);
    var rows = rowsAsObjects_(sh).filter(function (r) {
      return String(r.userId) === String(userId) && String(r.type) === 'score' && String(r.ref) === 'checkin';
    });
    if (rows.length <= 1) return 'No extras';
    rows.sort(function (a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
    for (var i = rows.length - 1; i >= 1; i--) sh.deleteRow(rows[i]._row);
    return 'Removed ' + (rows.length - 1) + ' extra check-in(s)';
  });
}

function coverInactivityDebt(userId, points) {
  return { success: false, error: 'Not available' };
  return withLock_(function () {
    var user = findUserById_(userId);
    if (!user) return { success: false, error: 'Not found' };
    var info = computeScore_(userId);
    if (info.debt <= 0) return { success: false, error: 'No debt to cover' };
    points = Math.min(Number(points) || info.debt, info.debt);
    if (points <= 0) return { success: false, error: 'Invalid amount' };
    var cost = Math.ceil(points * (1 + info.days));
    if ((Number(user.diamonds) || 0) < cost) {
      return { success: false, error: 'Need ' + cost + ' diamonds (includes ' + info.days + ' day fee)' };
    }
    user.diamonds = Number(user.diamonds) - cost;
    saveUser_(user);
    addRecord_(user, 'score', 'cover', points, 'ok', { cost: cost, days: info.days });
    addRecord_(user, 'balance', 'cover', -cost, 'ok', { after: Number(user.diamonds) });
    addActivity_(user, 'cover', 'covered ' + points + ' debt for ' + cost + ' diamonds');
    var after = computeScore_(userId);
    return { success: true, covered: points, cost: cost, debt: after.debt, score: after.score, user: publicUser_(user) };
  });
}

function creditTaskScore_(user, taskName) {
  /* rank scoring disabled – GrindBux uses totalEarned levels only */
}

function getRankInfo(userId) {
  return { success: false, error: 'Not available' };
  var user = findUserById_(userId);
  if (!user) return { success: false, error: 'Not found' };
  var info = computeScore_(userId);
  var rank = rankFromScore_(info);
  var next = rank === 'None' ? 55 : rank === 'Silver' ? 75 : rank === 'Gold' ? 85 : 85;
  var last = lastCheckin_(userId);
  var deadline = null;
  if (last) {
    var t = parseDate_(last.timestamp);
    if (t) deadline = new Date(t.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }
  return {
    success: true,
    score: info.score,
    debt: info.debt,
    days: info.days,
    coverCost: info.coverCost,
    rank: rank,
    nextRankAt: next,
    toNext: info.debt > 0 ? info.debt : Math.max(0, next - info.score),
    recovering: info.debt > 0,
    lastCheckin: last ? iso_(last.timestamp) : null,
    penaltyDeadline: deadline,
    rules: { checkin: 5, task: 2.5, debtPerDay: 10, silver: 55, gold: 75, platinum: 85 }
  };
}

// ===================== ACCOUNT CLOSURE (15-day inactivity) =====================
// User must confirm activity before day 15. Final 2 days (day 13-15) to confirm.
// If confirmed but no activity same day, still closes. Admin can restore for $1.

function daysSinceActivity_(user) {
  var last = parseDate_(user.lastActivity) || parseDate_(user.createdAt);
  if (!last) return 0;
  return daysBetween_(last, new Date());
}

function getAccountStatus(userId) {
  var user = findUserById_(userId);
  if (!user) return { success: false, error: 'Not found' };
  var days = daysSinceActivity_(user);
  var confirmed = false;
  rowsAsObjects_(sheet_(SHEETS.RECORDS)).forEach(function (r) {
    if (String(r.userId) === String(userId) && String(r.type) === 'confirm' && String(r.status) === 'ok') {
      var d = parseDate_(r.timestamp);
      if (d && daysBetween_(d, new Date()) === 0) confirmed = true;
    }
  });
  return {
    success: true,
    daysSinceActivity: days,
    daysLeft: Math.max(0, 15 - days),
    inWarning: days >= 13 && days < 15,
    confirmedToday: confirmed,
    willClose: days >= 15 || (days >= 13 && !confirmed && days >= 15)
  };
}

function confirmActivity(userId) {
  return { success: false, error: 'Not available' };
  return withLock_(function () {
    var user = findUserById_(userId);
    if (!user) return { success: false, error: 'Not found' };
    var days = daysSinceActivity_(user);
    if (days < 13) return { success: false, error: 'Confirmation opens on day 13' };
    if (days >= 15) return { success: false, error: 'Account already closed' };
    // Check if already confirmed today
    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var already = rowsAsObjects_(sheet_(SHEETS.RECORDS)).some(function (r) {
      return String(r.userId) === String(userId) && String(r.type) === 'confirm' &&
        Utilities.formatDate(parseDate_(r.timestamp) || new Date(0), Session.getScriptTimeZone(), 'yyyy-MM-dd') === today;
    });
    if (already) return { success: false, error: 'Already confirmed today' };
    addRecord_(user, 'confirm', 'activity', 0, 'ok', {});
    user.lastActivity = stamp_();
    saveUser_(user);
    return { success: true, message: 'Confirmed. Stay active today to keep your account.' };
  });
}

function closeInactiveAccounts() {
  return 'Disabled';
  return withLock_(function () {
    var sh = sheet_(SHEETS.USERS);
    var users = rowsAsObjects_(sh).filter(function (u) { return u.id && !isAdminUser_(u); });
    var closed = [];
    users.forEach(function (u) {
      var days = daysSinceActivity_(u);
      if (days < 15) return;
      // Must have confirmed AND have overall score >= 25
      var info = computeScore_(u.id);
      var score = (info && info.score) || 0;
      if (score < 25) {
        // Below 25 — close regardless
      } else {
        var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
        var confirmedToday = rowsAsObjects_(sheet_(SHEETS.RECORDS)).some(function (r) {
          return String(r.userId) === String(u.id) && String(r.type) === 'confirm' &&
            Utilities.formatDate(parseDate_(r.timestamp) || new Date(0), Session.getScriptTimeZone(), 'yyyy-MM-dd') === today;
        });
        if (confirmedToday) return; // confirmed and score ok
      }
      // Backup user data then delete
      var backup = {
        id: u.id, username: u.username, password: u.password, diamonds: u.diamonds,
        totalEarned: u.totalEarned, level: u.level, experience: u.experience,
        referralCode: u.referralCode, referrals: u.referrals, createdAt: u.createdAt,
        lastActivity: u.lastActivity, sessionToken: u.sessionToken
      };
      appendObject_(sheet_(SHEETS.SETTINGS), {
        kind: 'deleted_user', id: String(u.id), status: 'closed',
        data: JSON.stringify(backup)
      });
      sh.deleteRow(u._row);
      closed.push(u.username);
    });
    return 'Closed ' + closed.length + ' account(s): ' + closed.join(', ');
  });
}

function adminRestoreUser(adminId, userId) {
  return withLock_(function () {
    if (!requireAdmin_(adminId)) return { success: false, error: 'Access denied' };
    var sh = sheet_(SHEETS.SETTINGS);
    var rows = rowsAsObjects_(sh);
    var found = null;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].kind) === 'deleted_user' && String(rows[i].id) === String(userId)) {
        found = rows[i]; break;
      }
    }
    if (!found) return { success: false, error: 'No backup found for this user' };
    var data = safeJson_(found.data, {});
    if (!data.username) return { success: false, error: 'Backup corrupted' };
    // Restore user
    appendObject_(sheet_(SHEETS.USERS), {
      id: data.id, username: data.username, password: data.password,
      diamonds: data.diamonds || 0, totalEarned: data.totalEarned || 0,
      level: data.level || 'None', experience: data.experience || 0,
      referralCode: data.referralCode || '', referrals: data.referrals || 0,
      createdAt: data.createdAt || stamp_(), lastActivity: stamp_(), sessionToken: ''
    });
    // Mark backup as restored
    found.status = 'restored';
    writeObject_(sh, found._row, found);
    addActivity_({ id: data.id, username: data.username }, 'admin', 'account restored ($1 fee)');
    return { success: true, message: 'Restored ' + data.username + '. Collect $1.00 USD.' };
  });
}