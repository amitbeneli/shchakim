// שחקים: Google Apps Script שמקבל הזמנות מהאתר ומנהל זמינות.
// - POST (text/plain JSON): הזמנה → שורה בגיליון Leads (סטטוס "ממתינה"), מייל מעוצב לבעל המקום ומייל אישור לאורח.
// - GET ?action=availability: הלילות החסומים לכל סוויטה (מלשונית "זמינות"), לשימוש לוח השנה באתר.
// - GET ?admin=1: ממשק ניהול (HTML) לבעל המקום בלבד: אישור/דחיית הזמנות וחסימת לילות.
// פריסות: (1) Web app, Execute as: Me, Who has access: Anyone — לאתר.
//          (2) Web app, Execute as: User accessing, Who has access: Only myself — לממשק הניהול.

const SITE = 'https://shchakim-plum.vercel.app';
const PHONE = '08-0000000';
const HEADERS = ['תאריך', 'שם', 'טלפון', 'אימייל', 'סוויטה', 'הגעה', 'עזיבה', 'לילות', 'אורחים', 'תוספות', 'קופון', 'לינה', 'הנחה', 'תוספות סה״כ', 'סה״כ', 'מע״מ', 'הערות', 'סטטוס'];
const AV_HEADERS = ['תאריך', 'סוויטה', 'מקור', 'הערה'];
const SLUGS = { 'סוויטת מכתש': 'makhtesh', 'סוויטת כוכב': 'kochav', 'וילת גלקסיה': 'galaxia' };
const STATUS_COL = 18;
const SUITE_IMG = { 'סוויטת מכתש': 'makhtesh', 'סוויטת כוכב': 'kochav', 'וילת גלקסיה': 'galaxia' };

// Palette from the site
const C = { night: '#0B0E1A', card: '#10142A', line: '#2A2E45', sand: '#D9A86C', star: '#F4F1E8', muted: '#B9B2A4', ember: '#E2683C' };

function leadsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('Leads');
  if (!sh) {
    sh = ss.getSheets()[0];
    sh.setName('Leads');
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sh.setRightToLeft(true);
  }
  if (sh.getRange(1, STATUS_COL).getValue() === '') sh.getRange(1, STATUS_COL).setValue('סטטוס').setFontWeight('bold');
  return sh;
}

function availSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('זמינות');
  if (!sh) {
    sh = ss.insertSheet('זמינות');
    sh.appendRow(AV_HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, AV_HEADERS.length).setFontWeight('bold');
    sh.setRightToLeft(true);
    sh.getRange('A:A').setNumberFormat('@'); // dates stay as YYYY-MM-DD text
  }
  return sh;
}

function isoDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Jerusalem', 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}
function addDays_(iso, n) {
  const p = iso.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.toISOString().slice(0, 10);
}

/** { makhtesh: [dates], kochav: [...], galaxia: [...] } from the availability tab */
function blockedNights_() {
  const out = { makhtesh: [], kochav: [], galaxia: [] };
  const sh = availSheet_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return out;
  sh.getRange(2, 1, n, 2).getValues().forEach(function (r) {
    const slug = String(r[1]);
    if (out[slug]) out[slug].push(isoDate_(r[0]));
  });
  return out;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ───────── GET: availability for the site, or the admin page ───────── */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.admin) {
    if (!isOwner_()) return HtmlService.createHtmlOutput('<p dir="rtl" style="font-family:Arial;padding:2rem">אין גישה. ממשק הניהול פתוח רק לבעל המקום.</p>');
    return HtmlService.createHtmlOutput(ADMIN_HTML).setTitle('שחקים · ניהול').addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  // always JSON, even on an error: an HTML error page has no CORS header, so the browser would
  // only report a CORS error and the site would fall back to demo availability
  try {
    return json_({ ok: true, blocked: blockedNights_() });
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

/* ───────── admin (called from admin.html via google.script.run) ───────── */

function isOwner_() {
  const me = Session.getActiveUser().getEmail();
  return !!me && me === SpreadsheetApp.getActiveSpreadsheet().getOwner().getEmail();
}
function guard_() {
  if (!isOwner_()) throw new Error('אין הרשאה');
}

function adminData() {
  guard_();
  const sh = leadsSheet_();
  const n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, STATUS_COL).getValues() : [];
  const bookings = rows.map(function (r, i) {
    return {
      row: i + 2, created: isoDate_(r[0]), name: r[1], phone: String(r[2]), email: r[3], suite: r[4], slug: SLUGS[r[4]] || '',
      checkIn: isoDate_(r[5]), checkOut: isoDate_(r[6]), nights: r[7], guests: r[8], addons: r[9], total: r[14], notes: r[16],
      status: r[17] || 'ממתינה',
    };
  }).reverse();
  return { blocked: blockedNights_(), bookings: bookings };
}

/** Block or free one night in one suite; returns the new state */
function toggleNight(slug, date) {
  guard_();
  const sh = availSheet_();
  const n = sh.getLastRow() - 1;
  if (n > 0) {
    const vals = sh.getRange(2, 1, n, 2).getValues();
    for (let i = vals.length - 1; i >= 0; i--) {
      if (isoDate_(vals[i][0]) === date && String(vals[i][1]) === slug) {
        sh.deleteRow(i + 2);
        return false;
      }
    }
  }
  sh.appendRow([date, slug, 'ידני', '']);
  return true;
}

/** Approve or decline a booking. Approving blocks its nights in that suite. */
function setBookingStatus(row, status) {
  guard_();
  const sh = leadsSheet_();
  const r = sh.getRange(row, 1, 1, STATUS_COL).getValues()[0];
  sh.getRange(row, STATUS_COL).setValue(status);
  if (status === 'אושרה') {
    const slug = SLUGS[r[4]];
    const start = isoDate_(r[5]);
    const nights = Number(r[7]) || 0;
    const av = availSheet_();
    const existing = blockedNights_()[slug] || [];
    for (let i = 0; i < nights; i++) {
      const d = addDays_(start, i);
      if (existing.indexOf(d) === -1) av.appendRow([d, slug, 'הזמנה', r[1]]);
    }
  }
  return adminData();
}

// Run once from the editor: creates the headers and asks for permissions
function setup() {
  leadsSheet_();
  availSheet_();
}

// Always answers with JSON, even on failure. An uncaught exception makes Apps Script return its
// own HTML error page, which carries no CORS header: the browser then reports a CORS error
// instead of the real one. Caught here, the site gets { ok: false } and shows "try again".
function doPost(e) {
  try {
    return savePost_(e);
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function savePost_(e) {
  const d = JSON.parse(e.postData.contents);
  // only a real booking is saved and mailed: anything without a name and phone is ignored
  if (!d || d.type || !d.name || !d.phone) return json_({ ok: false, error: 'not-a-booking' });
  // the nights are checked against the availability tab here too: a night closed in the sheet
  // can't be booked even if the site couldn't load the live calendar
  const slug = SLUGS[d.suite];
  const closed = (slug && blockedNights_()[slug]) || [];
  for (let i = 0; i < (Number(d.nights) || 0); i++) {
    if (closed.indexOf(addDays_(isoDate_(d.checkIn), i)) !== -1) return json_({ ok: false, error: 'taken' });
  }
  const addonsText = (d.addons || []).map(function (a) { return a.name + ' ×' + a.qty + ' (' + money_(a.total) + ')'; }).join(', ');
  leadsSheet_().appendRow([
    new Date(), d.name, "'" + d.phone, d.email,
    d.suite, d.checkIn, d.checkOut, d.nights, d.guests,
    addonsText, d.coupon || '',
    d.lodging, d.discount, d.addonsTotal, d.total, d.vat,
    d.notes || '', 'ממתינה'
  ]);

  const owner = Session.getEffectiveUser().getEmail();
  try {
    MailApp.sendEmail({
      to: owner,
      replyTo: d.email,
      name: 'שחקים · הזמנות',
      subject: 'הזמנה חדשה: ' + d.name + ' · ' + d.suite + ' · ' + shortDate_(d.checkIn),
      htmlBody: ownerHtml_(d),
    });
  } catch (err) {}
  try {
    if (d.email) {
      MailApp.sendEmail({
        to: d.email,
        replyTo: owner,
        name: 'שחקים',
        subject: 'קיבלנו את הבקשה שלכם · ' + d.suite + ', ' + shortDate_(d.checkIn),
        htmlBody: guestHtml_(d),
      });
    }
  } catch (err) {}

  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

/* ───────── helpers ───────── */

function money_(n) {
  const v = Number(n) || 0;
  const fixed = v % 1 ? v.toFixed(2) : String(Math.round(v));
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.') + ' ₪';
}
const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
function shortDate_(iso) {
  if (!iso) return '';
  const p = String(iso).split('-').map(Number);
  const wd = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  return 'יום ' + DAYS[wd] + ', ' + p[2] + '.' + p[1];
}
function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function intlPhone_(p) {
  const digits = String(p || '').replace(/\D/g, '');
  return digits.charAt(0) === '0' ? '972' + digits.slice(1) : digits;
}
function nightsLabel_(n) {
  return Number(n) === 1 ? 'לילה אחד' : n + ' לילות';
}

/* ───────── shared blocks ───────── */

function shell_(inner, preheader) {
  return '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>' +
    '<body style="margin:0;padding:0;background:' + C.night + ';">' +
    '<div style="display:none;max-height:0;overflow:hidden;color:' + C.night + ';">' + esc_(preheader) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + C.night + ';"><tr><td align="center" style="padding:28px 12px;">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" dir="rtl" style="width:100%;max-width:600px;font-family:Arial,Helvetica,sans-serif;color:' + C.star + ';text-align:right;">' +
    // wordmark
    '<tr><td style="padding:0 4px 18px;">' +
    '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:30px;line-height:1;color:' + C.star + ';">שחקים <span style="color:' + C.sand + ';font-size:20px;">✦</span></div>' +
    '<div style="font-size:11px;letter-spacing:5px;color:' + C.sand + ';padding-top:6px;">SHCHAKIM</div>' +
    '</td></tr>' +
    inner +
    // footer
    '<tr><td style="padding:22px 4px 0;font-size:12px;line-height:1.7;color:' + C.muted + ';">' +
    'שחקים · דרך בראשית, מצפה רמון · <a href="tel:+97280000000" style="color:' + C.muted + ';">' + PHONE + '</a><br>' +
    '<a href="' + SITE + '" style="color:' + C.sand + ';text-decoration:none;">shchakim</a> · תשע סוויטות על שפת מכתש רמון' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function hero_(d) {
  const key = SUITE_IMG[d.suite] || 'lodge';
  return '<tr><td style="padding:0;"><img src="' + SITE + '/email/' + key + '.jpg" width="600" alt="' + esc_(d.suite) + '" style="display:block;width:100%;max-width:600px;height:auto;border-radius:4px 4px 0 0;"></td></tr>';
}

function stay_(d) {
  const cell = function (label, value, sub, align) {
    return '<td width="40%" style="padding:16px 18px;text-align:' + align + ';vertical-align:top;">' +
      '<div style="font-size:12px;font-weight:bold;color:' + C.sand + ';">' + label + '</div>' +
      '<div style="font-size:17px;font-weight:bold;color:' + C.star + ';padding-top:4px;">' + esc_(value) + '</div>' +
      '<div style="font-size:12px;color:' + C.muted + ';padding-top:2px;">' + sub + '</div></td>';
  };
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ' + C.line + ';border-radius:4px;">' +
    '<tr>' + cell('צ׳ק־אין', shortDate_(d.checkIn), 'מ־15:00', 'right') +
    '<td width="20%" align="center" style="vertical-align:middle;"><span style="display:inline-block;padding:5px 10px;background:#2A2433;color:' + C.sand + ';font-size:12px;font-weight:bold;border-radius:3px;white-space:nowrap;">' + nightsLabel_(d.nights) + '</span></td>' +
    cell('צ׳ק־אאוט', shortDate_(d.checkOut), 'עד 11:00', 'left') + '</tr></table>';
}

function lines_(d) {
  const row = function (label, value, opts) {
    opts = opts || {};
    return '<tr><td style="padding:7px 0;font-size:14px;color:' + (opts.muted ? C.muted : C.star) + ';">' + label + '</td>' +
      '<td style="padding:7px 0;font-size:14px;text-align:left;white-space:nowrap;color:' + (opts.green ? '#CFE8C9' : C.star) + ';">' + value + '</td></tr>';
  };
  let rows = row(esc_(d.suite) + ' · ' + nightsLabel_(d.nights), money_(d.lodging));
  if (Number(d.discount) > 0) rows += row('הנחת ' + esc_(d.coupon || 'קופון'), '−' + money_(d.discount), { green: true });
  (d.addons || []).forEach(function (a) {
    rows += row(esc_(a.name) + ' <span style="color:' + C.muted + ';">× ' + a.qty + '</span>', money_(a.total));
  });
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-top:1px solid ' + C.line + ';">' +
    '<tr><td colspan="2" style="height:8px;"></td></tr>' + rows +
    '<tr><td colspan="2" style="border-top:1px solid ' + C.line + ';height:10px;"></td></tr>' +
    '<tr><td style="font-size:16px;font-weight:bold;">סה״כ לתשלום</td>' +
    '<td style="text-align:left;font-family:Georgia,serif;font-size:26px;color:' + C.sand + ';white-space:nowrap;">' + money_(d.total) + '</td></tr>' +
    '<tr><td style="font-size:12px;color:' + C.muted + ';padding-top:2px;">מתוכם מע״מ (18%)</td>' +
    '<td style="font-size:12px;color:' + C.muted + ';text-align:left;padding-top:2px;">' + money_(d.vat) + '</td></tr></table>';
}

function button_(href, label, primary) {
  return '<a href="' + href + '" style="display:inline-block;margin:0 0 8px 8px;padding:12px 20px;border-radius:3px;font-size:14px;font-weight:bold;text-decoration:none;' +
    (primary ? 'background:' + C.sand + ';color:' + C.night + ';' : 'border:1px solid ' + C.line + ';color:' + C.star + ';') + '">' + label + '</a>';
}

/* ───────── the two emails ───────── */

function ownerHtml_(d) {
  const sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const inner =
    '<tr><td style="background:' + C.card + ';border-radius:4px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + hero_(d) +
    '<tr><td style="padding:24px 24px 26px;">' +
    '<div style="font-size:12px;font-weight:bold;color:' + C.ember + ';">הזמנה חדשה</div>' +
    '<div style="font-family:Georgia,serif;font-size:26px;line-height:1.25;padding:6px 0 4px;">' + esc_(d.name) + '</div>' +
    '<div style="font-size:14px;line-height:1.8;color:' + C.muted + ';padding-bottom:18px;">' +
    '<a href="tel:+' + intlPhone_(d.phone) + '" style="color:' + C.star + ';text-decoration:none;">' + esc_(d.phone) + '</a> · ' +
    '<a href="mailto:' + esc_(d.email) + '" style="color:' + C.star + ';text-decoration:none;">' + esc_(d.email) + '</a> · ' + d.guests + ' אורחים</div>' +
    stay_(d) + lines_(d) +
    (d.notes ? '<div style="margin-top:18px;padding:12px 14px;border-right:3px solid ' + C.sand + ';background:#141831;font-size:14px;line-height:1.7;"><b style="color:' + C.sand + ';">בקשות מיוחדות:</b> ' + esc_(d.notes) + '</div>' : '') +
    '<div style="padding-top:22px;">' +
    button_('tel:+' + intlPhone_(d.phone), 'להתקשר ל' + esc_(String(d.name).split(' ')[0]), true) +
    button_('https://wa.me/' + intlPhone_(d.phone), 'וואטסאפ', false) +
    button_(sheetUrl, 'לגיליון ההזמנות', false) +
    '</div></td></tr></table></td></tr>';
  return shell_(inner, d.name + ' · ' + d.suite + ' · ' + shortDate_(d.checkIn) + ' · ' + money_(d.total));
}

function guestHtml_(d) {
  const first = esc_(String(d.name).split(' ')[0]);
  const step = function (n, text) {
    return '<tr><td width="34" style="vertical-align:top;padding:6px 0;"><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;background:#2A2433;color:' + C.sand + ';font-size:12px;font-weight:bold;">' + n + '</span></td>' +
      '<td style="padding:8px 0;font-size:14px;line-height:1.6;color:' + C.star + ';">' + text + '</td></tr>';
  };
  const inner =
    '<tr><td style="background:' + C.card + ';border-radius:4px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + hero_(d) +
    '<tr><td style="padding:26px 24px 28px;">' +
    '<div style="font-family:Georgia,serif;font-size:28px;line-height:1.25;">' + first + ', קיבלנו את הבקשה שלכם</div>' +
    '<div style="font-size:15px;line-height:1.8;color:' + C.muted + ';padding:8px 0 20px;">' + esc_(d.suite) + ' שמורה לכם בינתיים. נחזור אליכם תוך יום כדי לאשר את ההזמנה. אין צורך לשלם עכשיו.</div>' +
    stay_(d) + lines_(d) +
    '<div style="font-family:Georgia,serif;font-size:19px;padding:26px 0 6px;">מה קורה עכשיו</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    step(1, 'נציג שלנו יתקשר אליכם תוך יום לאישור התאריכים והתוספות.') +
    step(2, 'התשלום מתבצע רק אחרי האישור. ביטול ללא עלות עד 14 יום לפני ההגעה.') +
    step(3, 'ביום ההגעה: צ׳ק־אין מ־15:00, כדי שתספיקו להתמקם לפני השקיעה.') +
    '</table>' +
    '<div style="padding-top:22px;">' + button_(SITE + '/experiences', 'לחוויות הלילה', true) + button_('tel:+97280000000', 'להתקשר אלינו', false) + '</div>' +
    '</td></tr></table></td></tr>';
  return shell_(inner, 'קיבלנו את הבקשה שלכם ל' + d.suite + ', ' + shortDate_(d.checkIn) + '. נחזור אליכם תוך יום.');
}

/* ───────── the admin page (source also in docs/admin.html) ───────── */
const ADMIN_HTML = `
<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<base target="_top">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600&family=Frank+Ruhl+Libre:wght@500&display=swap">
<style>
  :root { --night:#0b0e1a; --night-2:#10142a; --night-3:#181c33; --line:rgb(217 168 108 / .2); --line-strong:rgb(217 168 108 / .42); --sand:#d9a86c; --ember:#e2683c; --star:#f4f1e8; --muted:#b9b2a4; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--night); color:var(--star); font-family:Assistant, Arial, sans-serif; font-size:16px; line-height:1.55; }
  .wrap { max-width:1100px; margin:0 auto; padding:24px 16px 64px; }
  header { display:flex; align-items:center; justify-content:space-between; gap:16px; padding-bottom:18px; border-bottom:1px solid var(--line); }
  .wm { font-family:'Frank Ruhl Libre', serif; font-size:30px; line-height:1; }
  .wm small { display:block; font-family:Assistant; font-size:11px; letter-spacing:.5em; color:var(--sand); margin-top:6px; }
  h1 { font-family:'Frank Ruhl Libre', serif; font-weight:500; font-size:22px; margin:0; color:var(--muted); }
  .tabs { display:flex; gap:6px; margin:22px 0 18px; }
  .tab { padding:10px 18px; border:1px solid var(--line-strong); background:none; color:var(--star); font:600 15px Assistant; border-radius:2px; cursor:pointer; }
  .tab[aria-selected="true"] { background:var(--sand); color:var(--night); border-color:var(--sand); }
  .pane[hidden] { display:none; }
  .stats { display:flex; flex-wrap:wrap; gap:8px 26px; color:var(--muted); margin-bottom:18px; }
  .stats b { font-family:'Frank Ruhl Libre'; font-size:26px; color:var(--star); font-weight:500; margin-inline-end:6px; }
  /* bookings */
  .bk { display:grid; grid-template-columns:1fr auto; gap:6px 18px; padding:16px 18px; background:var(--night-2); border-radius:2px; margin-bottom:8px; border-inline-start:3px solid var(--line-strong); }
  .bk[data-status="אושרה"] { border-inline-start-color:#7fc28a; }
  .bk[data-status="נדחתה"] { opacity:.55; border-inline-start-color:var(--ember); }
  .bk h3 { margin:0; font-family:'Frank Ruhl Libre'; font-weight:500; font-size:20px; }
  .bk .meta { color:var(--muted); font-size:14px; }
  .bk .meta a { color:var(--star); }
  .bk .side { display:grid; justify-items:end; gap:8px; align-content:start; }
  .bk .total { font-family:'Frank Ruhl Libre'; font-size:22px; }
  .pill { font-size:12px; font-weight:600; padding:3px 9px; border-radius:2px; background:var(--night-3); color:var(--sand); }
  .acts { display:flex; gap:6px; }
  .btn { padding:8px 14px; border-radius:2px; border:0; font:600 14px Assistant; cursor:pointer; background:var(--sand); color:var(--night); }
  .btn.ghost { background:none; color:var(--star); border:1px solid var(--line-strong); }
  .notes { grid-column:1 / -1; font-size:14px; color:var(--star); padding:8px 12px; background:var(--night-3); border-inline-start:2px solid var(--sand); }
  .empty { color:var(--muted); padding:30px 0; }
  /* calendar */
  .suites { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px; }
  .months { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:22px; }
  .month h4 { margin:0 0 8px; font-family:'Frank Ruhl Libre'; font-weight:500; font-size:18px; }
  .grid { display:grid; grid-template-columns:repeat(7, 1fr); gap:3px; }
  .dow { text-align:center; font-size:12px; color:var(--muted); padding-bottom:4px; }
  .day { aspect-ratio:1; border:0; border-radius:2px; background:var(--night-2); color:var(--star); font:600 14px Assistant; cursor:pointer; }
  .day:hover { outline:1px solid var(--sand); }
  .day.off { background:var(--ember); color:var(--night); }
  .day.booked { background:#7fc28a; color:var(--night); }
  .day.past { opacity:.25; pointer-events:none; }
  .legend { display:flex; gap:18px; margin-top:16px; color:var(--muted); font-size:14px; }
  .legend i { display:inline-block; width:12px; height:12px; border-radius:2px; vertical-align:middle; margin-inline-end:6px; }
  .toast { position:fixed; inset-inline:0; bottom:18px; margin:auto; width:max-content; padding:10px 18px; background:var(--star); color:var(--night); border-radius:2px; font-weight:600; opacity:0; transition:opacity .3s; pointer-events:none; }
  .toast.on { opacity:1; }
  .busy { opacity:.6; pointer-events:none; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="wm">שחקים<small>SHCHAKIM</small></div>
    <h1>ממשק ניהול</h1>
  </header>

  <div class="tabs" role="tablist">
    <button class="tab" role="tab" aria-selected="true" data-tab="bookings">הזמנות</button>
    <button class="tab" role="tab" aria-selected="false" data-tab="avail">זמינות</button>
  </div>

  <section class="pane" id="bookings">
    <div class="stats" id="stats"></div>
    <div id="list"><p class="empty">טוענים…</p></div>
  </section>

  <section class="pane" id="avail" hidden>
    <div class="suites" id="suites"></div>
    <div class="months" id="months"></div>
    <div class="legend">
      <span><i style="background:var(--night-2);outline:1px solid var(--line-strong)"></i>פנוי</span>
      <span><i style="background:#7fc28a"></i>הזמנה מאושרת</span>
      <span><i style="background:var(--ember)"></i>חסום ידנית</span>
    </div>
    <p style="color:var(--muted);font-size:14px">לחיצה על לילה חוסמת או משחררת אותו. השינוי מופיע מיד בלוח השנה באתר.</p>
  </section>
</div>
<div class="toast" id="toast"></div>

<script>
  const SUITES = [['makhtesh', 'סוויטת מכתש'], ['kochav', 'סוויטת כוכב'], ['galaxia', 'וילת גלקסיה']];
  const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const DOW = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
  let data = null, suite = 'makhtesh', sources = {};
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const money = (n) => Number(n || 0).toLocaleString('he-IL', { maximumFractionDigits: 2 }) + ' ₪';
  const short = (iso) => { const p = String(iso).split('-'); return +p[2] + '.' + +p[1]; };
  const toast = (t) => { const el = $('toast'); el.textContent = t; el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 1800); };
  const call = (fn, ...args) => new Promise((ok, no) => google.script.run.withSuccessHandler(ok).withFailureHandler(no)[fn](...args));
  const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);

  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.setAttribute('aria-selected', x === t));
    document.querySelectorAll('.pane').forEach((p) => (p.hidden = p.id !== t.dataset.tab));
  }));

  function renderBookings() {
    const b = data.bookings;
    const pending = b.filter((x) => x.status === 'ממתינה').length;
    const approved = b.filter((x) => x.status === 'אושרה');
    $('stats').innerHTML = '<span><b>' + pending + '</b>ממתינות לאישור</span><span><b>' + approved.length + '</b>מאושרות</span><span><b>' + money(approved.reduce((s, x) => s + Number(x.total || 0), 0)) + '</b>בהזמנות מאושרות</span>';
    if (!b.length) { $('list').innerHTML = '<p class="empty">עוד אין הזמנות.</p>'; return; }
    $('list').innerHTML = b.map((x) => '<article class="bk" data-status="' + esc(x.status) + '">' +
      '<div><h3>' + esc(x.name) + ' · ' + esc(x.suite) + '</h3>' +
      '<div class="meta">' + short(x.checkIn) + ' עד ' + short(x.checkOut) + ' · ' + esc(x.nights) + ' לילות · ' + esc(x.guests) + ' אורחים</div>' +
      '<div class="meta"><a href="tel:' + esc(x.phone) + '">' + esc(x.phone) + '</a> · <a href="mailto:' + esc(x.email) + '">' + esc(x.email) + '</a>' + (x.addons ? ' · ' + esc(x.addons) : '') + '</div></div>' +
      '<div class="side"><span class="total">' + money(x.total) + '</span><span class="pill">' + esc(x.status) + '</span>' +
      (x.status === 'ממתינה' ? '<div class="acts"><button class="btn" data-row="' + x.row + '" data-st="אושרה">לאשר</button><button class="btn ghost" data-row="' + x.row + '" data-st="נדחתה">לדחות</button></div>' : '') + '</div>' +
      (x.notes ? '<div class="notes">' + esc(x.notes) + '</div>' : '') + '</article>').join('');
    $('list').querySelectorAll('[data-row]').forEach((btn) => btn.addEventListener('click', async () => {
      $('list').classList.add('busy');
      try { data = await call('setBookingStatus', Number(btn.dataset.row), btn.dataset.st); render(); toast(btn.dataset.st === 'אושרה' ? 'ההזמנה אושרה והלילות נחסמו' : 'ההזמנה נדחתה'); }
      catch (e) { toast('משהו השתבש, נסו שוב'); }
      $('list').classList.remove('busy');
    }));
  }

  function renderSuites() {
    $('suites').innerHTML = SUITES.map(([s, n]) => '<button class="tab" aria-selected="' + (s === suite) + '" data-s="' + s + '">' + n + '</button>').join('');
    $('suites').querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => { suite = b.dataset.s; renderSuites(); renderCal(); }));
  }

  function renderCal() {
    const blocked = new Set(data.blocked[suite] || []);
    const fromBooking = new Set();
    data.bookings.filter((x) => x.status === 'אושרה' && x.slug === suite).forEach((x) => {
      for (let i = 0; i < Number(x.nights); i++) { const d = new Date(x.checkIn + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + i); fromBooking.add(d.toISOString().slice(0, 10)); }
    });
    const start = new Date(today.slice(0, 7) + '-01T00:00:00Z');
    let html = '';
    for (let m = 0; m < 6; m++) {
      const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + m, 1));
      const y = first.getUTCFullYear(), mo = first.getUTCMonth(), days = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
      html += '<div class="month"><h4>' + MONTHS[mo] + ' ' + y + '</h4><div class="grid">' + DOW.map((d) => '<span class="dow">' + d + '</span>').join('');
      for (let i = 0; i < first.getUTCDay(); i++) html += '<span></span>';
      for (let d = 1; d <= days; d++) {
        const iso = y + '-' + String(mo + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        const cls = ['day', iso < today ? 'past' : '', blocked.has(iso) ? (fromBooking.has(iso) ? 'booked' : 'off') : ''].join(' ');
        html += '<button class="' + cls + '" data-d="' + iso + '" aria-pressed="' + blocked.has(iso) + '">' + d + '</button>';
      }
      html += '</div></div>';
    }
    $('months').innerHTML = html;
    $('months').querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const now = await call('toggleNight', suite, b.dataset.d);
        const list = data.blocked[suite] || (data.blocked[suite] = []);
        if (now) list.push(b.dataset.d); else data.blocked[suite] = list.filter((x) => x !== b.dataset.d);
        renderCal(); toast(now ? 'הלילה נחסם' : 'הלילה שוחרר');
      } catch (e) { toast('משהו השתבש, נסו שוב'); b.disabled = false; }
    }));
  }

  function render() { renderBookings(); renderSuites(); renderCal(); }
  call('adminData').then((d) => { data = d; render(); }).catch(() => { $('list').innerHTML = '<p class="empty">אין הרשאה, או שהגיליון לא זמין.</p>'; });
</script>
</body>
</html>
`;
