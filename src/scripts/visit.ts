// Visit log: one small beacon per page view to the same Apps Script that takes the leads.
// The script writes a row to the "ביקורים" tab and emails the owner when a new visit starts.
// No IP, no cookies, no personal details: a random id per browser tab session, the page,
// where the visitor came from, and a short device label.
// The owner's own visits: open the site once with ?me=1 (and ?me=0 to undo) on each device.

const ENDPOINT = import.meta.env.PUBLIC_LEAD_ENDPOINT as string | undefined;
const SESSION_KEY = 'shchakim-visit';
const OWNER_KEY = 'shchakim-owner';

function device() {
  const ua = navigator.userAgent;
  const os = /iPad|Macintosh.*Mobile/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    ? 'iPad'
    : /iPhone/.test(ua) ? 'iPhone'
    : /Android/.test(ua) ? 'Android'
    : /Mac OS X/.test(ua) ? 'Mac'
    : /Windows/.test(ua) ? 'Windows'
    : 'אחר';
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /CriOS|Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : '';
  return [os, browser].filter(Boolean).join(' · ');
}

function isOwner() {
  try {
    const me = new URLSearchParams(location.search).get('me');
    if (me === '1') localStorage.setItem(OWNER_KEY, '1');
    if (me === '0') localStorage.removeItem(OWNER_KEY);
    return localStorage.getItem(OWNER_KEY) === '1';
  } catch {
    return false;
  }
}

export function logVisit() {
  // no endpoint (local builds, CI), automated browsers, and the owner are not logged
  if (!ENDPOINT || navigator.webdriver || isOwner()) return;

  let session = '';
  let first = false;
  try {
    session = sessionStorage.getItem(SESSION_KEY) ?? '';
    if (!session) {
      session = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem(SESSION_KEY, session);
      first = true;
    }
  } catch {
    session = 'x';
  }

  const payload = JSON.stringify({
    type: 'visit',
    session,
    first,
    page: location.pathname + location.search,
    // only the referring site, not the full address
    referrer: first && document.referrer ? new URL(document.referrer).hostname : '',
    device: device(),
    screen: `${screen.width}×${screen.height}`,
  });

  // sendBeacon posts text/plain (no CORS preflight) and survives the page closing
  const sent = navigator.sendBeacon?.(ENDPOINT, payload);
  if (!sent) fetch(ENDPOINT, { method: 'POST', body: payload, mode: 'no-cors', keepalive: true }).catch(() => {});
}
