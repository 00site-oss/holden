// PASTE YOUR NEW /exec URL HERE after redeploying Apps Script
const EXEC_URL = 'https://script.google.com/macros/s/AKfycbzdKEd1j_EvB-boKNz5mFGNrICN74UlWJ_ki96fGiDSRN6wl3v12meoVRNjz-taFaY_/exec';

function parseBody(text) {
  if (!text) throw new Error('Empty response from server');
  if (/^\s*</.test(text) || text.includes('<!DOCTYPE')) {
    throw new Error('API returned HTML. In Apps Script: Deploy → Web app → Execute as Me → Anyone → New version, then put the NEW /exec URL here.');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Server returned non-JSON: ' + text.slice(0, 180));
  }
}

export async function api(fn, ...args) {
  if (typeof google !== 'undefined' && google.script && google.script.run) {
    return new Promise((resolve, reject) => {
      google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[fn].apply(null, args);
    });
  }

  // 1) POST (preferred)
  try {
    const res = await fetch(EXEC_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn, args })
    });
    const text = await res.text();
    if (res.ok) return parseBody(text);
    // fall through on 405/401/etc
  } catch (e) {
    // network / CORS — try GET
  }

  // 2) GET fallback (works when POST is blocked)
  const q = new URLSearchParams();
  q.set('fn', fn);
  q.set('args', JSON.stringify(args));
  const res2 = await fetch(EXEC_URL + '?' + q.toString(), {
    method: 'GET',
    redirect: 'follow'
  });
  const text2 = await res2.text();
  return parseBody(text2);
}

export const TOKEN_KEY = 'gpt_token_v2';
