// שחקים: Google Apps Script שמקבל הזמנות מהאתר (POST, text/plain JSON).
// כל הזמנה: שורה בגיליון Leads, מייל מעוצב לבעל המקום, ומייל אישור מעוצב לאורח.
// פריסה: Deploy → Web app, Execute as: Me, Who has access: Anyone.

const SITE = 'https://shchakim-plum.vercel.app';
const PHONE = '08-0000000';
const HEADERS = ['תאריך', 'שם', 'טלפון', 'אימייל', 'סוויטה', 'הגעה', 'עזיבה', 'לילות', 'אורחים', 'תוספות', 'קופון', 'לינה', 'הנחה', 'תוספות סה״כ', 'סה״כ', 'מע״מ', 'הערות'];
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
  return sh;
}

// Run once from the editor: creates the headers and asks for permissions
function setup() {
  leadsSheet_();
}

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  const addonsText = (d.addons || []).map(function (a) { return a.name + ' ×' + a.qty + ' (' + money_(a.total) + ')'; }).join(', ');
  leadsSheet_().appendRow([
    new Date(), d.name, "'" + d.phone, d.email,
    d.suite, d.checkIn, d.checkOut, d.nights, d.guests,
    addonsText, d.coupon || '',
    d.lodging, d.discount, d.addonsTotal, d.total, d.vat,
    d.notes || ''
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
